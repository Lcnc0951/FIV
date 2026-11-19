import ARKit
import CoreImage
import ImageIO
import UIKit
import UniformTypeIdentifiers

enum DepthViewMode: String, CaseIterable, Identifiable {
    case blend = "Blandet"
    case depth = "Dybde"
    case camera = "Kamera"
    var id: String { rawValue }
}

/// Gjør LiDAR-dybdekart om til bilder og filer.
enum DepthImaging {

    /// «Turbo»-fargeskala (Google, 2019) som oppslagstabell: 0 = blått, 1 = rødt.
    private static let lut: [(UInt8, UInt8, UInt8)] = (0..<256).map { i in
        let t = Double(i) / 255
        func c(_ v: Double) -> UInt8 { UInt8((max(0, min(1, v)) * 255).rounded()) }
        let r = 0.13572138 + t * (4.61539260 + t * (-42.66032258 + t * (132.13108234 + t * (-152.94239396 + t * 59.28637943))))
        let g = 0.09140261 + t * (2.19418839 + t * (4.84296658 + t * (-14.18503333 + t * (4.27729857 + t * 2.82956604))))
        let b = 0.10667330 + t * (12.64194608 + t * (-60.58204836 + t * (110.36276771 + t * (-89.90310912 + t * 27.34824973))))
        return (c(r), c(g), c(b))
    }

    /// Fargelegger dybdekartet: nært = rødt, langt unna = blått, utenfor rekkevidde = gjennomsiktig.
    /// Bildet har kameraets native (liggende) orientering.
    static func heatmap(depth: CVPixelBuffer, confidence: CVPixelBuffer?, near: Float, far: Float) -> CGImage? {
        CVPixelBufferLockBaseAddress(depth, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(depth, .readOnly) }
        if let confidence { CVPixelBufferLockBaseAddress(confidence, .readOnly) }
        defer { if let confidence { CVPixelBufferUnlockBaseAddress(confidence, .readOnly) } }

        let w = CVPixelBufferGetWidth(depth), h = CVPixelBufferGetHeight(depth)
        guard let base = CVPixelBufferGetBaseAddress(depth) else { return nil }
        let rowBytes = CVPixelBufferGetBytesPerRow(depth)
        let confBase = confidence.flatMap { CVPixelBufferGetBaseAddress($0) }
        let confRow = confidence.map { CVPixelBufferGetBytesPerRow($0) } ?? 0
        let span = max(0.05, far - near)

        var pixels = [UInt8](repeating: 0, count: w * h * 4)
        for y in 0..<h {
            let row = base.advanced(by: y * rowBytes).assumingMemoryBound(to: Float32.self)
            let conf = confBase?.advanced(by: y * confRow).assumingMemoryBound(to: UInt8.self)
            for x in 0..<w {
                let d = row[x]
                guard d.isFinite, d > 0, d <= far else { continue }
                let t = 1 - max(0, min(1, (d - near) / span))
                let (r, g, b) = lut[Int(t * 255)]
                // Lav sikkerhet (kanter, svarte flater) tones ned
                let alpha: UInt16 = (conf?[x] ?? 2) == 0 ? 110 : 255
                let i = (y * w + x) * 4
                pixels[i] = UInt8(UInt16(r) * alpha / 255)
                pixels[i + 1] = UInt8(UInt16(g) * alpha / 255)
                pixels[i + 2] = UInt8(UInt16(b) * alpha / 255)
                pixels[i + 3] = UInt8(alpha)
            }
        }
        return pixels.withUnsafeMutableBytes { buffer -> CGImage? in
            CGContext(data: buffer.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                      space: CGColorSpace(name: CGColorSpace.sRGB)!,
                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)?.makeImage()
        }
    }

    /// Dybde i meter i midten av bildet.
    static func centerDistance(_ depth: CVPixelBuffer) -> Float? {
        CVPixelBufferLockBaseAddress(depth, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(depth, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(depth) else { return nil }
        let w = CVPixelBufferGetWidth(depth), h = CVPixelBufferGetHeight(depth)
        let rowBytes = CVPixelBufferGetBytesPerRow(depth)
        var values: [Float] = []
        for y in (h / 2 - 2)...(h / 2 + 2) {
            let row = base.advanced(by: y * rowBytes).assumingMemoryBound(to: Float32.self)
            for x in (w / 2 - 2)...(w / 2 + 2) where row[x].isFinite && row[x] > 0 { values.append(row[x]) }
        }
        guard !values.isEmpty else { return nil }
        values.sort()
        return values[values.count / 2]
    }

    /// Rå dybde som 16-bits gråtone-PNG der hver pikselverdi er avstanden i millimeter (native liggende orientering).
    static func millimeterPNG(_ depth: CVPixelBuffer) -> Data? {
        CVPixelBufferLockBaseAddress(depth, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(depth, .readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(depth) else { return nil }
        let w = CVPixelBufferGetWidth(depth), h = CVPixelBufferGetHeight(depth)
        let rowBytes = CVPixelBufferGetBytesPerRow(depth)
        var mm = [UInt16](repeating: 0, count: w * h)
        for y in 0..<h {
            let row = base.advanced(by: y * rowBytes).assumingMemoryBound(to: Float32.self)
            for x in 0..<w {
                let d = row[x]
                if d.isFinite, d > 0 { mm[y * w + x] = UInt16(min(65535, (d * 1000).rounded())) }
            }
        }
        let data = mm.withUnsafeBytes { Data($0) } as CFData
        guard let provider = CGDataProvider(data: data),
              let image = CGImage(width: w, height: h, bitsPerComponent: 16, bitsPerPixel: 16, bytesPerRow: w * 2,
                                  space: CGColorSpaceCreateDeviceGray(),
                                  bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.none.rawValue).union(.byteOrder16Little),
                                  provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)
        else { return nil }
        return encode(image, type: .png)
    }

    static func encode(_ image: CGImage, type: UTType, quality: Double = 0.92) -> Data? {
        let out = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(out, type.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
        guard CGImageDestinationFinalize(dest) else { return nil }
        return out as Data
    }

    /// Fargelagt punktsky (PLY, ASCII) i kameraets koordinatsystem, i meter. Kan åpnes i f.eks. MeshLab, Blender eller CloudCompare.
    static func pointCloudPLY(frame: ARFrame, depth: CVPixelBuffer, confidence: CVPixelBuffer?, context: CIContext) -> Data? {
        let w = CVPixelBufferGetWidth(depth), h = CVPixelBufferGetHeight(depth)

        // Kamerabildet nedskalert til dybdekartets oppløsning gir én farge per punkt
        let camera = CIImage(cvPixelBuffer: frame.capturedImage)
        let small = camera.transformed(by: CGAffineTransform(scaleX: CGFloat(w) / camera.extent.width,
                                                             y: CGFloat(h) / camera.extent.height))
        var rgba = [UInt8](repeating: 0, count: w * h * 4)
        context.render(small, toBitmap: &rgba, rowBytes: w * 4, bounds: CGRect(x: 0, y: 0, width: w, height: h),
                       format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB))

        let k = frame.camera.intrinsics
        let res = frame.camera.imageResolution
        let sx = Float(w) / Float(res.width), sy = Float(h) / Float(res.height)
        let fx = k.columns.0.x * sx, fy = k.columns.1.y * sy, cx = k.columns.2.x * sx, cy = k.columns.2.y * sy

        CVPixelBufferLockBaseAddress(depth, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(depth, .readOnly) }
        if let confidence { CVPixelBufferLockBaseAddress(confidence, .readOnly) }
        defer { if let confidence { CVPixelBufferUnlockBaseAddress(confidence, .readOnly) } }
        guard let base = CVPixelBufferGetBaseAddress(depth) else { return nil }
        let rowBytes = CVPixelBufferGetBytesPerRow(depth)
        let confBase = confidence.flatMap { CVPixelBufferGetBaseAddress($0) }
        let confRow = confidence.map { CVPixelBufferGetBytesPerRow($0) } ?? 0

        var body = ""
        body.reserveCapacity(w * h * 40)
        var count = 0
        for y in 0..<h {
            let row = base.advanced(by: y * rowBytes).assumingMemoryBound(to: Float32.self)
            let conf = confBase?.advanced(by: y * confRow).assumingMemoryBound(to: UInt8.self)
            for x in 0..<w {
                let d = row[x]
                guard d.isFinite, d > 0.1, d < 5.5, (conf?[x] ?? 2) >= 1 else { continue }
                // ARKit-kamerarom: x mot høyre, y opp, kameraet ser langs −z
                let px = (Float(x) - cx) * d / fx
                let py = -(Float(y) - cy) * d / fy
                let i = (y * w + x) * 4
                body += String(format: "%.4f %.4f %.4f %d %d %d\n", px, py, -d, rgba[i], rgba[i + 1], rgba[i + 2])
                count += 1
            }
        }
        let header = """
        ply
        format ascii 1.0
        comment FIV LiDAR punktsky, meter, kamerakoordinater
        element vertex \(count)
        property float x
        property float y
        property float z
        property uchar red
        property uchar green
        property uchar blue
        end_header

        """
        return (header + body).data(using: .utf8)
    }
}

/// Setter sammen kamerabilde og dybde til stående bilder/videoframes.
enum FrameComposer {
    /// Roterer et liggende kamerabilde til stående og fyller `size` (sentrert beskjæring).
    static func portrait(_ image: CIImage, size: CGSize) -> CIImage {
        let o = image.oriented(.right)
        let moved = o.transformed(by: CGAffineTransform(translationX: -o.extent.minX, y: -o.extent.minY))
        let s = max(size.width / moved.extent.width, size.height / moved.extent.height)
        let scaled = moved.transformed(by: CGAffineTransform(scaleX: s, y: s))
        let dx = (scaled.extent.width - size.width) / 2, dy = (scaled.extent.height - size.height) / 2
        return scaled.transformed(by: CGAffineTransform(translationX: -dx, y: -dy))
            .cropped(to: CGRect(origin: .zero, size: size))
    }

    static func compose(cameraImage: CVPixelBuffer, heatmap: CGImage?, mode: DepthViewMode, size: CGSize) -> CIImage {
        let camera = portrait(CIImage(cvPixelBuffer: cameraImage), size: size)
        guard let heatmap, mode != .camera else { return camera }
        let depth = portrait(CIImage(cgImage: heatmap), size: size)
        switch mode {
        case .depth:
            let black = CIImage(color: .black).cropped(to: CGRect(origin: .zero, size: size))
            return depth.composited(over: black)
        default:
            let faded = depth.applyingFilter("CIColorMatrix", parameters: ["inputAVector": CIVector(x: 0, y: 0, z: 0, w: 0.6)])
            return faded.composited(over: camera)
        }
    }
}
