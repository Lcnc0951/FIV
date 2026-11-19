import ARKit
import CoreImage
import SwiftUI

/// LiDAR-dybdekamera: live fargekart, bilder (foto + dybde + punktsky) og video.
final class DepthCaptureEngine: NSObject, ObservableObject, ARSessionDelegate {

    @Published var mode: DepthViewMode = .blend { didSet { settings.mode = mode } }
    @Published var maxDistance: Float = 3 { didSet { settings.far = maxDistance } }
    @Published var saveToPhotos = true
    @Published private(set) var heatmap: UIImage?
    @Published private(set) var centerDistance: Float?
    @Published private(set) var isRecording = false
    @Published private(set) var recordingSeconds: Double = 0
    @Published private(set) var isBusy = false
    @Published var message: String?

    let session = ARSession()

    /// Innstillinger som leses fra AR-køen.
    private final class Settings: @unchecked Sendable {
        private let lock = NSLock()
        private var _mode: DepthViewMode = .blend
        private var _far: Float = 3
        var mode: DepthViewMode { get { lock.withLock { _mode } } set { lock.withLock { _mode = newValue } } }
        var far: Float { get { lock.withLock { _far } } set { lock.withLock { _far = newValue } } }
    }
    private let settings = Settings()

    private let queue = DispatchQueue(label: "no.fiv.lidar.depth", qos: .userInitiated)
    private let ciContext = CIContext(options: [.cacheIntermediates: false])
    private static let videoSize = CGSize(width: 1080, height: 1440)

    // Kun fra `queue`
    private var frameIndex = 0
    private var recorder: VideoRecorder?
    private var recordingFolder: URL?
    private var photoRequested = false

    // MARK: Livssyklus

    func start() {
        let config = ARWorldTrackingConfiguration()
        var semantics: ARConfiguration.FrameSemantics = [.sceneDepth]
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.smoothedSceneDepth) { semantics.insert(.smoothedSceneDepth) }
        config.frameSemantics = semantics
        session.delegate = self
        session.delegateQueue = queue
        session.run(config)
    }

    func stop() {
        if isRecording { toggleRecording() }
        session.pause()
    }

    // MARK: Handlinger

    func capturePhoto() {
        guard !isBusy else { return }
        isBusy = true
        queue.async { self.photoRequested = true }
    }

    func toggleRecording() {
        if isRecording {
            isRecording = false
            isBusy = true
            queue.async { self.finishRecording() }
        } else {
            queue.async { self.beginRecording() }
        }
    }

    // MARK: ARSessionDelegate

    func session(_ session: ARSession, didFailWithError error: Error) {
        DispatchQueue.main.async { self.message = error.localizedDescription }
    }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        frameIndex += 1
        // ARKit leverer 60 bilder/s; 30 holder for forhåndsvisning og video
        guard frameIndex % 2 == 0 else { return }
        guard let depthData = frame.smoothedSceneDepth ?? frame.sceneDepth else { return }

        let far = settings.far
        let mode = settings.mode
        let heat = DepthImaging.heatmap(depth: depthData.depthMap, confidence: depthData.confidenceMap, near: 0.2, far: far)

        if photoRequested {
            photoRequested = false
            savePhoto(frame: frame, depthData: depthData, heatmap: heat, mode: mode)
        }
        if let recorder {
            let image = FrameComposer.compose(cameraImage: frame.capturedImage, heatmap: heat, mode: mode, size: recorder.size)
            recorder.append(image, time: frame.timestamp, context: ciContext)
        }

        let distance = frameIndex % 10 == 0 ? DepthImaging.centerDistance(depthData.depthMap) : nil
        let seconds = recorder?.duration
        let preview = heat.map { UIImage(cgImage: $0, scale: 1, orientation: .right) }
        DispatchQueue.main.async {
            self.heatmap = preview
            if let distance { self.centerDistance = distance }
            if let seconds { self.recordingSeconds = seconds }
        }
    }

    // MARK: Bilde

    private func savePhoto(frame: ARFrame, depthData: ARDepthData, heatmap: CGImage?, mode: DepthViewMode) {
        do {
            let folder = try CaptureStore.makeFolder(.photo)
            let full = CGSize(width: 1440, height: 1920)
            var forPhotos: [URL] = []

            func writeJPEG(_ image: CIImage, _ name: String) throws {
                guard let cg = ciContext.createCGImage(image, from: image.extent),
                      let data = DepthImaging.encode(cg, type: .jpeg) else { return }
                let url = folder.appendingPathComponent(name)
                try data.write(to: url)
                forPhotos.append(url)
            }

            try writeJPEG(FrameComposer.compose(cameraImage: frame.capturedImage, heatmap: nil, mode: .camera, size: full), "foto.jpg")
            if let heatmap {
                try writeJPEG(FrameComposer.compose(cameraImage: frame.capturedImage, heatmap: heatmap, mode: .depth, size: full), "dybde-farger.jpg")
                try writeJPEG(FrameComposer.compose(cameraImage: frame.capturedImage, heatmap: heatmap, mode: .blend, size: full), "dybde-blandet.jpg")
            }
            try DepthImaging.millimeterPNG(depthData.depthMap)?.write(to: folder.appendingPathComponent("dybde-mm.png"))
            try DepthImaging.pointCloudPLY(frame: frame, depth: depthData.depthMap, confidence: depthData.confidenceMap, context: ciContext)?
                .write(to: folder.appendingPathComponent("punktsky.ply"))
            try writeInfo(frame: frame, depth: depthData.depthMap, to: folder)

            let toPhotos = mode == .camera ? Array(forPhotos.prefix(1)) : forPhotos
            finish(message: "Lagret: foto, dybdekart og punktsky", photos: toPhotos)
        } catch {
            finish(message: "Kunne ikke lagre: \(error.localizedDescription)")
        }
    }

    private func writeInfo(frame: ARFrame, depth: CVPixelBuffer, to folder: URL) throws {
        let k = frame.camera.intrinsics
        let info: [String: Any] = [
            "app": "FIV LiDAR",
            "dato": ISO8601DateFormatter().string(from: Date()),
            "kameraOppløsning": [frame.camera.imageResolution.width, frame.camera.imageResolution.height],
            "dybdeOppløsning": [CVPixelBufferGetWidth(depth), CVPixelBufferGetHeight(depth)],
            "intrinsikk": ["fx": k.columns.0.x, "fy": k.columns.1.y, "cx": k.columns.2.x, "cy": k.columns.2.y],
            "avstandMidtMeter": DepthImaging.centerDistance(depth) ?? 0,
            "forklaring": "dybde-mm.png: 16-bit gråtone, hver verdi er avstand i millimeter (liggende orientering). punktsky.ply: punkter i meter i kamerakoordinater.",
        ]
        let data = try JSONSerialization.data(withJSONObject: info, options: [.prettyPrinted, .sortedKeys])
        try data.write(to: folder.appendingPathComponent("info.json"))
    }

    // MARK: Video

    private func beginRecording() {
        do {
            let folder = try CaptureStore.makeFolder(.video)
            recorder = try VideoRecorder(url: folder.appendingPathComponent("dybdevideo.mov"), size: Self.videoSize)
            recordingFolder = folder
            DispatchQueue.main.async { self.isRecording = true; self.recordingSeconds = 0 }
        } catch {
            DispatchQueue.main.async { self.message = "Kunne ikke starte opptak: \(error.localizedDescription)" }
        }
    }

    private func finishRecording() {
        guard let recorder else { finish(message: nil); return }
        self.recorder = nil
        let folder = recordingFolder
        Task {
            let ok = await recorder.finish()
            if ok {
                self.finish(message: "Videoen er lagret", videos: [recorder.url])
            } else {
                if let folder { try? FileManager.default.removeItem(at: folder) }
                self.finish(message: "Opptaket ble tomt")
            }
        }
    }

    // MARK: Felles

    private func finish(message: String?, photos: [URL] = [], videos: [URL] = []) {
        Task { @MainActor in
            var text = message
            if saveToPhotos, !(photos.isEmpty && videos.isEmpty) {
                do {
                    try await PhotoLibrary.save(images: photos, videos: videos)
                    if let t = text { text = t + " (også i Bilder)" }
                } catch {
                    text = (text ?? "") + ". " + error.localizedDescription
                }
            }
            self.message = text
            self.isBusy = false
        }
    }
}
