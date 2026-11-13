import ARKit
import CoreVideo
import simd

/// Kopi av en pikselbuffer slik at vi kan slippe ARFrame raskt.
struct PixelGrid<T> {
    let width: Int
    let height: Int
    private let values: [T]

    init?(_ buffer: CVPixelBuffer) {
        CVPixelBufferLockBaseAddress(buffer, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(buffer) else { return nil }
        let w = CVPixelBufferGetWidth(buffer)
        let h = CVPixelBufferGetHeight(buffer)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
        guard bytesPerRow >= w * MemoryLayout<T>.stride else { return nil }
        var v = [T]()
        v.reserveCapacity(w * h)
        for y in 0..<h {
            let row = base.advanced(by: y * bytesPerRow).assumingMemoryBound(to: T.self)
            for x in 0..<w { v.append(row[x]) }
        }
        width = w; height = h; values = v
    }

    /// Normaliserte koordinater (0–1) i kameraets native (liggende) orientering.
    func sample(_ n: SIMD2<Float>) -> T? {
        let x = Int(n.x * Float(width)), y = Int(n.y * Float(height))
        guard x >= 0, y >= 0, x < width, y < height else { return nil }
        return values[y * width + x]
    }
}

/// Geometri for én ARFrame: personmaske + dybdekart + kameraets intrinsikk.
/// Brukes til å måle silhuettbredder i meter.
struct FrameGeometry {
    let mask: PixelGrid<UInt8>
    let depth: PixelGrid<Float32>
    let camera: ARCamera
    let imageSize: CGSize
    let usesLiDAR: Bool

    init?(frame: ARFrame) {
        guard let maskBuffer = frame.segmentationBuffer, let mask = PixelGrid<UInt8>(maskBuffer) else { return nil }
        let lidar = frame.smoothedSceneDepth?.depthMap ?? frame.sceneDepth?.depthMap
        guard let depthBuffer = lidar ?? frame.estimatedDepthData,
              [kCVPixelFormatType_DepthFloat32, kCVPixelFormatType_OneComponent32Float]
                .contains(CVPixelBufferGetPixelFormatType(depthBuffer)),
              let depth = PixelGrid<Float32>(depthBuffer) else { return nil }
        self.mask = mask
        self.depth = depth
        self.camera = frame.camera
        self.imageSize = frame.camera.imageResolution
        self.usesLiDAR = lidar != nil
    }

    // MARK: Projeksjon

    /// Verdenspunkt → pikselkoordinat i kamerabildet (native liggende orientering).
    func project(_ p: SIMD3<Float>) -> SIMD2<Float>? {
        // Punktet må være foran kameraet
        let camPos = camera.transform.columns.3
        let forward = -SIMD3(camera.transform.columns.2.x, camera.transform.columns.2.y, camera.transform.columns.2.z)
        guard simd_dot(p - SIMD3(camPos.x, camPos.y, camPos.z), forward) > 0.2 else { return nil }
        let pt = camera.projectPoint(p, orientation: .landscapeRight, viewportSize: imageSize)
        return SIMD2(Float(pt.x), Float(pt.y))
    }

    func normalized(_ px: SIMD2<Float>) -> SIMD2<Float> {
        SIMD2(px.x / Float(imageSize.width), px.y / Float(imageSize.height))
    }

    func inImage(_ px: SIMD2<Float>, margin: Float = 0) -> Bool {
        let n = normalized(px)
        return n.x >= margin && n.y >= margin && n.x <= 1 - margin && n.y <= 1 - margin
    }

    func isPerson(_ px: SIMD2<Float>) -> Bool {
        (mask.sample(normalized(px)) ?? 0) > 127
    }

    /// Pikselkoordinat + dybde → 3D-punkt i kameraets koordinatsystem (pinhole-modell).
    func unproject(_ px: SIMD2<Float>, depth d: Float) -> SIMD3<Float> {
        let k = camera.intrinsics
        let fx = k.columns.0.x, fy = k.columns.1.y, cx = k.columns.2.x, cy = k.columns.2.y
        return SIMD3((px.x - cx) * d / fx, (px.y - cy) * d / fy, d)
    }

    // MARK: Silhuettmåling

    /// Måler bredden (i meter) av kroppssilhuetten gjennom punktet `point`,
    /// vinkelrett på kroppsaksen `axis` (f.eks. ryggraden eller lårbeinet).
    /// `edgeDepthOffset`: kroppens sider ligger litt lenger unna enn fremsiden vi måler dybden på.
    func silhouetteWidth(at point: SIMD3<Float>, axis: SIMD3<Float>, edgeDepthOffset: Float = 0.04) -> Float? {
        guard simd_length(axis) > 0.001,
              let c = project(point),
              let a = project(point + simd_normalize(axis) * 0.1) else { return nil }
        let dir = a - c
        guard simd_length(dir) > 0.5 else { return nil }
        let perp = simd_normalize(SIMD2(-dir.y, dir.x))
        guard isPerson(c) else { return nil }

        // Ett maskepiksel i kamerabilde-piksler
        let step = Float(imageSize.width) / Float(mask.width)

        func walk(_ sign: Float) -> SIMD2<Float>? {
            var last = c
            var misses = 0
            for i in 1...220 {
                let q = c + perp * sign * step * Float(i)
                guard inImage(q, margin: 0.005) else { return nil } // traff bildekanten → ugyldig
                if isPerson(q) {
                    last = q
                    misses = 0
                } else {
                    misses += 1
                    if misses > 2 { return last + perp * sign * step * 0.5 } // halv piksel ut til kanten
                }
            }
            return nil
        }
        guard let e1 = walk(1), let e2 = walk(-1) else { return nil }

        // Median dybde langs den indre delen av linjen (unngår kantstøy)
        var depths: [Float] = []
        for i in 0...20 {
            let t = 0.2 + 0.6 * Float(i) / 20
            let q = e1 + (e2 - e1) * t
            if isPerson(q), let d = depth.sample(normalized(q)), d.isFinite, d > 0.3, d < 6 {
                depths.append(d)
            }
        }
        guard depths.count >= 5 else { return nil }
        depths.sort()
        let d = depths[depths.count / 2] + edgeDepthOffset

        let width = simd_distance(unproject(e1, depth: d), unproject(e2, depth: d))
        guard width > 0.04, width < 0.9 else { return nil }
        return width
    }
}
