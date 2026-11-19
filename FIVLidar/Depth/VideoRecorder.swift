import AVFoundation
import CoreImage

/// Skriver CIImage-bilder til en H.264-video (.mov). Brukes fra én seriekø.
final class VideoRecorder {
    let url: URL
    let size: CGSize
    private let writer: AVAssetWriter
    private let input: AVAssetWriterInput
    private let adaptor: AVAssetWriterInputPixelBufferAdaptor
    private var startTime: TimeInterval?
    private(set) var frameCount = 0

    init(url: URL, size: CGSize) throws {
        self.url = url
        self.size = size
        writer = try AVAssetWriter(outputURL: url, fileType: .mov)
        input = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: Int(size.width),
            AVVideoHeightKey: Int(size.height),
        ])
        input.expectsMediaDataInRealTime = true
        adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
            kCVPixelBufferWidthKey as String: Int(size.width),
            kCVPixelBufferHeightKey as String: Int(size.height),
        ])
        writer.add(input)
        guard writer.startWriting() else { throw writer.error ?? CocoaError(.fileWriteUnknown) }
        writer.startSession(atSourceTime: .zero)
    }

    var duration: TimeInterval { startTime.map { _ in Double(frameCount) / 30 } ?? 0 }

    func append(_ image: CIImage, time: TimeInterval, context: CIContext) {
        let start = startTime ?? time
        startTime = start
        guard input.isReadyForMoreMediaData, let pool = adaptor.pixelBufferPool else { return }
        var buffer: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer)
        guard let buffer else { return }
        context.render(image, to: buffer)
        if adaptor.append(buffer, withPresentationTime: CMTime(seconds: time - start, preferredTimescale: 600)) {
            frameCount += 1
        }
    }

    func finish() async -> Bool {
        input.markAsFinished()
        await writer.finishWriting()
        return writer.status == .completed && frameCount > 0
    }
}
