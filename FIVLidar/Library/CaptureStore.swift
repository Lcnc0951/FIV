import Foundation
import Photos
import SwiftUI

/// Én lagret opptaksmappe i Dokumenter. Mappene vises også i Filer-appen under «På min iPhone → FIV LiDAR».
struct CaptureItem: Identifiable, Hashable {
    enum Kind: String, CaseIterable {
        case body = "Kroppsmål"
        case photo = "Dybdebilde"
        case video = "Dybdevideo"
        case mesh = "3D-skann"

        var icon: String {
            switch self {
            case .body: "figure.stand"
            case .photo: "photo"
            case .video: "video"
            case .mesh: "cube.transparent"
            }
        }
    }

    let folder: URL
    let kind: Kind
    let date: Date
    let files: [URL]
    var id: URL { folder }
    var name: String { folder.lastPathComponent }

    /// JSON-filen som kan importeres i FIV-appen, hvis mappen har en.
    var scanFile: URL? { files.first { $0.pathExtension == "json" && $0.lastPathComponent.hasPrefix("FIV-skann") } }
}

/// Brukes fra hovedtråden. De statiske hjelperne kan kalles fra hvilken som helst tråd.
final class CaptureStore: ObservableObject {
    @Published private(set) var items: [CaptureItem] = []

    static var documents: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    private static let folderDate: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "yyyy-MM-dd HH.mm.ss"
        return f
    }()

    /// Lager en ny mappe, f.eks. «Dybdebilde 2026-11-19 16.40.12». Trygg å kalle fra hvilken som helst tråd.
    static func makeFolder(_ kind: CaptureItem.Kind, date: Date = Date()) throws -> URL {
        let url = documents.appendingPathComponent("\(kind.rawValue) \(folderDate.string(from: date))", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    func reload() {
        let fm = FileManager.default
        let folders = (try? fm.contentsOfDirectory(at: Self.documents, includingPropertiesForKeys: [.creationDateKey, .isDirectoryKey])) ?? []
        items = folders.compactMap { folder -> CaptureItem? in
            let values = try? folder.resourceValues(forKeys: [.creationDateKey, .isDirectoryKey])
            guard values?.isDirectory == true,
                  let kind = CaptureItem.Kind.allCases.first(where: { folder.lastPathComponent.hasPrefix($0.rawValue) }) else { return nil }
            let files = ((try? fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? [])
                .filter { !$0.lastPathComponent.hasPrefix(".") }
                .sorted { $0.lastPathComponent < $1.lastPathComponent }
            return CaptureItem(folder: folder, kind: kind, date: values?.creationDate ?? .distantPast, files: files)
        }
        .sorted { $0.date > $1.date }
    }

    func delete(_ item: CaptureItem) {
        try? FileManager.default.removeItem(at: item.folder)
        reload()
    }
}

/// Lagring i Bilder-appen (kun tilgang til å legge til).
enum PhotoLibrary {
    enum Failure: LocalizedError {
        case denied
        var errorDescription: String? { "Appen har ikke lov til å lagre i Bilder. Slå det på i Innstillinger → FIV LiDAR → Bilder." }
    }

    static func save(images: [URL] = [], videos: [URL] = []) async throws {
        guard !images.isEmpty || !videos.isEmpty else { return }
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else { throw Failure.denied }
        try await PHPhotoLibrary.shared().performChanges {
            for url in images { PHAssetCreationRequest.creationRequestForAssetFromImage(atFileURL: url) }
            for url in videos { PHAssetCreationRequest.creationRequestForAssetFromVideo(atFileURL: url) }
        }
    }
}
