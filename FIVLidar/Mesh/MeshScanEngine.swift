import ARKit
import ModelIO
import RealityKit
import SwiftUI

/// 3D-skann av rom, gjenstander eller en person med LiDAR-scenerekonstruksjon.
/// Eksporterer til USDZ (åpnes rett i iPhone/Mac), OBJ og PLY.
/// AR-delegaten kalles på hovedtråden (standard når delegateQueue ikke er satt).
final class MeshScanEngine: NSObject, ObservableObject, ARSessionDelegate {
    static var isSupported: Bool { ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) }

    let arView: ARView

    @Published private(set) var isScanning = false
    @Published private(set) var meshCount = 0
    @Published private(set) var vertexCount = 0
    @Published private(set) var isExporting = false
    @Published var saveToPhotos = true
    @Published var message: String?

    private var lastCount = Date.distantPast

    override init() {
        arView = ARView(frame: .zero, cameraMode: .ar, automaticallyConfigureSession: false)
        super.init()
        arView.debugOptions.insert(.showSceneUnderstanding)
        arView.renderOptions.insert(.disableMotionBlur)
        arView.session.delegate = self
    }

    func start(reset: Bool) {
        let config = ARWorldTrackingConfiguration()
        config.sceneReconstruction = .mesh
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) { config.frameSemantics.insert(.sceneDepth) }
        arView.session.run(config, options: reset ? [.resetTracking, .removeExistingAnchors] : [])
        isScanning = true
        if reset { meshCount = 0; vertexCount = 0 }
    }

    func pause() {
        arView.session.pause()
        isScanning = false
    }

    func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) { recount() }

    func session(_ session: ARSession, didAdd anchors: [ARAnchor]) { recount() }

    func session(_ session: ARSession, didFailWithError error: Error) {
        message = error.localizedDescription
        isScanning = false
    }

    private func recount() {
        guard Date().timeIntervalSince(lastCount) > 0.5 else { return }
        lastCount = Date()
        let meshes = arView.session.currentFrame?.anchors.compactMap { $0 as? ARMeshAnchor } ?? []
        meshCount = meshes.count
        vertexCount = meshes.reduce(0) { $0 + $1.geometry.vertices.count }
    }

    @MainActor func export() async {
        let meshes = arView.session.currentFrame?.anchors.compactMap { $0 as? ARMeshAnchor } ?? []
        guard !meshes.isEmpty else {
            message = "Ingen 3D-data ennå. Beveg telefonen sakte rundt det du vil skanne."
            return
        }
        isExporting = true
        defer { isExporting = false }

        let snapshot: UIImage? = await withCheckedContinuation { cont in
            arView.snapshot(saveToHDR: false) { cont.resume(returning: $0) }
        }
        do {
            let folder = try CaptureStore.makeFolder(.mesh)
            var photos: [URL] = []
            if let data = snapshot?.jpegData(compressionQuality: 0.9) {
                let url = folder.appendingPathComponent("forhandsvisning.jpg")
                try data.write(to: url)
                photos.append(url)
            }
            let summary = try await Task.detached(priority: .userInitiated) {
                try MeshExporter.export(meshes, to: folder)
            }.value
            if saveToPhotos, !photos.isEmpty { try? await PhotoLibrary.save(images: photos) }
            message = "Lagret \(summary)"
        } catch {
            message = "Kunne ikke eksportere: \(error.localizedDescription)"
        }
    }
}

enum MeshExporter {
    /// Skriver modell.obj, modell.ply og (hvis mulig) modell.usdz. Returnerer en kort oppsummering.
    static func export(_ anchors: [ARMeshAnchor], to folder: URL) throws -> String {
        var positions: [SIMD3<Float>] = []
        var triangles: [SIMD3<UInt32>] = []

        for anchor in anchors {
            let geometry = anchor.geometry
            let base = UInt32(positions.count)

            let vertices = geometry.vertices
            let vPointer = vertices.buffer.contents()
            for i in 0..<vertices.count {
                let p = vPointer.advanced(by: vertices.offset + vertices.stride * i).assumingMemoryBound(to: Float.self)
                let world = anchor.transform * SIMD4<Float>(p[0], p[1], p[2], 1)
                positions.append(SIMD3(world.x, world.y, world.z))
            }

            let faces = geometry.faces
            guard faces.indexCountPerPrimitive == 3 else { continue }
            let fPointer = faces.buffer.contents()
            for f in 0..<faces.count {
                var idx = SIMD3<UInt32>(repeating: 0)
                for k in 0..<3 {
                    let offset = (f * 3 + k) * faces.bytesPerIndex
                    let value: UInt32 = faces.bytesPerIndex == 2
                        ? UInt32(fPointer.load(fromByteOffset: offset, as: UInt16.self))
                        : fPointer.load(fromByteOffset: offset, as: UInt32.self)
                    idx[k] = base + value
                }
                triangles.append(idx)
            }
        }

        // OBJ
        var obj = "# FIV LiDAR 3D-skann, meter\n"
        obj.reserveCapacity(positions.count * 32 + triangles.count * 24)
        for p in positions { obj += String(format: "v %.4f %.4f %.4f\n", p.x, p.y, p.z) }
        for t in triangles { obj += "f \(t.x + 1) \(t.y + 1) \(t.z + 1)\n" }
        let objURL = folder.appendingPathComponent("modell.obj")
        try obj.write(to: objURL, atomically: true, encoding: .utf8)

        // PLY (binær, mindre fil)
        var ply = Data("""
        ply
        format binary_little_endian 1.0
        comment FIV LiDAR 3D-skann, meter
        element vertex \(positions.count)
        property float x
        property float y
        property float z
        element face \(triangles.count)
        property list uchar uint vertex_indices
        end_header

        """.utf8)
        for p in positions {
            withUnsafeBytes(of: p.x.bitPattern.littleEndian) { ply.append(contentsOf: $0) }
            withUnsafeBytes(of: p.y.bitPattern.littleEndian) { ply.append(contentsOf: $0) }
            withUnsafeBytes(of: p.z.bitPattern.littleEndian) { ply.append(contentsOf: $0) }
        }
        for t in triangles {
            ply.append(3)
            for v in [t.x, t.y, t.z] { withUnsafeBytes(of: v.littleEndian) { ply.append(contentsOf: $0) } }
        }
        try ply.write(to: folder.appendingPathComponent("modell.ply"))

        // USDZ via Model I/O – kan forhåndsvises direkte i appen, Filer og Meldinger
        var formats = ["OBJ", "PLY"]
        if MDLAsset.canExportFileExtension("usdz") {
            let asset = MDLAsset(url: objURL)
            if (try? asset.export(to: folder.appendingPathComponent("modell.usdz"))) != nil { formats.insert("USDZ", at: 0) }
        }
        return "3D-modell (\(formats.joined(separator: ", "))) med \(positions.count.formatted()) punkter"
    }
}
