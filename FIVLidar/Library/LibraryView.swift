import QuickLook
import SwiftUI

/// Alt som er lagret: kroppsmål (JSON), dybdebilder, videoer og 3D-modeller.
struct LibraryView: View {
    @EnvironmentObject private var store: CaptureStore

    var body: some View {
        NavigationStack {
            List {
                if store.items.isEmpty {
                    ContentUnavailableView("Ingen opptak ennå", systemImage: "folder",
                                           description: Text("Kroppsmål, dybdebilder, videoer og 3D-skann havner her."))
                }
                ForEach(store.items) { item in
                    NavigationLink { CaptureDetailView(item: item) } label: {
                        HStack(spacing: 12) {
                            Image(systemName: item.kind.icon).frame(width: 28).foregroundStyle(.tint)
                            VStack(alignment: .leading) {
                                Text(item.kind.rawValue).font(.headline)
                                Text(item.date.formatted(date: .abbreviated, time: .shortened))
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            if let scan = item.scanFile {
                                ShareLink(item: scan) { Image(systemName: "square.and.arrow.up") }
                                    .buttonStyle(.borderless)
                            }
                        }
                    }
                }
                .onDelete { offsets in
                    for i in offsets { store.delete(store.items[i]) }
                }
            }
            .navigationTitle("Filer")
            .refreshable { store.reload() }
            .onAppear { store.reload() }
        }
    }
}

struct CaptureDetailView: View {
    let item: CaptureItem
    @State private var preview: URL?

    var body: some View {
        List {
            if item.kind == .body {
                Section {
                    Text("Importer JSON-filen i FIV under Kropp → Skann → «Importer skann fra iPhone-appen».")
                        .font(.subheadline)
                }
            }
            Section("Filer") {
                ForEach(item.files, id: \.self) { file in
                    HStack {
                        Button { preview = file } label: {
                            VStack(alignment: .leading) {
                                Text(file.lastPathComponent)
                                Text(describe(file)).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        .buttonStyle(.plain)
                        Spacer()
                        ShareLink(item: file) { Image(systemName: "square.and.arrow.up") }
                            .buttonStyle(.borderless)
                    }
                }
            }
            Section {
                ShareLink(items: item.files) {
                    Label("Del alle filene", systemImage: "square.and.arrow.up.on.square")
                }
            }
        }
        .navigationTitle(item.kind.rawValue)
        .quickLookPreview($preview, in: item.files)
    }

    private func describe(_ url: URL) -> String {
        let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize).flatMap { $0 } ?? 0
        let bytes = ByteCountFormatter.string(fromByteCount: Int64(size), countStyle: .file)
        let kind: String = switch url.pathExtension.lowercased() {
        case "json": url.lastPathComponent.hasPrefix("FIV-skann") ? "Kroppsmål for FIV-appen" : "Info om opptaket"
        case "jpg": "Bilde"
        case "png": "Rå dybde, 16-bit millimeter"
        case "mov": "Video"
        case "ply": "Punktsky / 3D (MeshLab, Blender)"
        case "obj": "3D-modell (Blender, 3D-printing)"
        case "usdz": "3D-modell (åpnes rett på iPhone og Mac)"
        default: "Fil"
        }
        return "\(kind) · \(bytes)"
    }
}
