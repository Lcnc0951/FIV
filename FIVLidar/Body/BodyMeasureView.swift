import ARKit
import SwiftUI

/// Kroppsmål med LiDAR. Bruker samme skannemotor som FIV-appen (FIV/Scanning/BodyScanner.swift)
/// og lagrer resultatet som en JSON-fil som FIV-treningsappen kan importere.
struct BodyMeasureView: View {
    @EnvironmentObject private var store: CaptureStore
    @AppStorage("weightKg") private var weight: Double = 80
    @AppStorage("includeWeight") private var includeWeight = true
    @AppStorage("bodyPhotosToLibrary") private var photosToLibrary = false
    @State private var showScanner = false
    @State private var saved: SavedScan?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            List {
                if !BodyScanner.isSupported {
                    Label("Enheten støtter ikke kroppssporing. Bruk dybdekameraet eller 3D-skann i stedet.", systemImage: "exclamationmark.triangle")
                }
                Section("Før du starter") {
                    Label("Tettsittende klær eller treningstøy", systemImage: "tshirt")
                    Label("Godt, jevnt lys og rolig bakgrunn", systemImage: "sun.max")
                    Label("Telefonen stående i hoftehøyde mot en vegg", systemImage: "iphone")
                    Label("Stå 2,5–3 m unna, hele kroppen i bildet", systemImage: "ruler")
                    Label("Forfra med armene litt ut, så en kvart runde til venstre", systemImage: "arrow.turn.up.left")
                    Label("Skru opp lyden, du blir guidet med stemmen", systemImage: "speaker.wave.2")
                }
                Section {
                    Toggle("Ta med vekt i filen", isOn: $includeWeight)
                    if includeWeight {
                        Stepper(String(format: "%.1f kg", weight), value: $weight, in: 35...250, step: 0.1)
                    }
                    Toggle("Lagre bildene i Bilder også", isOn: $photosToLibrary)
                } footer: {
                    Text("Bildene forfra og fra siden lagres alltid i appens mappe sammen med JSON-filen.")
                }
                Section {
                    Button { showScanner = true } label: {
                        Label("Start kroppsskann", systemImage: "camera.metering.matrix")
                            .frame(maxWidth: .infinity)
                            .font(.headline)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(!BodyScanner.isSupported)
                    .listRowInsets(EdgeInsets())
                }
                Section("Slik får du målene inn i FIV") {
                    Label("Del JSON-filen til «Lagre i Filer» (eller AirDrop til en annen enhet).", systemImage: "1.circle")
                    Label("Åpne FIV, gå til Kropp → Skann og trykk «Importer skann fra iPhone-appen».", systemImage: "2.circle")
                    Label("Velg filen. Kontroller tallene og lagre.", systemImage: "3.circle")
                }
                .font(.subheadline)
                if let error {
                    Text(error).foregroundStyle(.red)
                }
            }
            .navigationTitle("Kroppsmål")
            .fullScreenCover(isPresented: $showScanner) {
                BodyCaptureView { result, front, side in
                    save(result, front: front, side: side)
                }
            }
            .sheet(item: $saved) { scan in
                NavigationStack { BodyResultView(scan: scan) }
            }
        }
    }

    private func save(_ m: ScanMeasurements, front: UIImage?, side: UIImage?) {
        let frontData = front?.jpegData(compressionQuality: 0.9)
        let sideData = side?.jpegData(compressionQuality: 0.9)
        do {
            let url = try FIVScanFile.save(m, weightKg: includeWeight ? weight : nil, front: frontData, side: sideData)
            store.reload()
            saved = SavedScan(url: url, measurements: m)
            if photosToLibrary {
                let folder = url.deletingLastPathComponent()
                let images = ["forfra.jpg", "fra-siden.jpg"].map { folder.appendingPathComponent($0) }
                    .filter { FileManager.default.fileExists(atPath: $0.path) }
                Task { try? await PhotoLibrary.save(images: images) }
            }
        } catch {
            self.error = "Kunne ikke lagre skannet: \(error.localizedDescription)"
        }
    }
}

struct SavedScan: Identifiable {
    let url: URL
    let measurements: ScanMeasurements
    var id: URL { url }
}

// MARK: - Selve skanningen

struct BodyCaptureView: View {
    var onComplete: (ScanMeasurements, UIImage?, UIImage?) -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var scanner = BodyScanner()
    @StateObject private var holder = ARViewHolder()
    @State private var frontPhoto: UIImage?
    @State private var sidePhoto: UIImage?

    var body: some View {
        GeometryReader { geo in
            ZStack {
                ARCameraView(session: scanner.session, holder: holder).ignoresSafeArea()

                Canvas { ctx, _ in
                    for p in scanner.overlayPoints {
                        ctx.fill(Path(ellipseIn: CGRect(x: p.x - 5, y: p.y - 5, width: 10, height: 10)),
                                 with: .color(scanner.phase == .front || scanner.phase == .side ? .green : .orange))
                    }
                }
                .ignoresSafeArea()
                .allowsHitTesting(false)

                VStack {
                    HStack {
                        Button {
                            scanner.stop()
                            dismiss()
                        } label: {
                            Image(systemName: "xmark").font(.title2.bold()).padding(12)
                                .background(.ultraThinMaterial, in: Circle())
                        }
                        Spacer()
                        Label(scanner.bodyDetected ? "Kropp funnet" : "Leter …",
                              systemImage: scanner.bodyDetected ? "figure.stand" : "magnifyingglass")
                            .padding(10)
                            .background(.ultraThinMaterial, in: Capsule())
                    }
                    .padding()

                    Spacer()

                    if case .countdown(let s) = scanner.phase {
                        Text("\(s)")
                            .font(.system(size: 120, weight: .black, design: .rounded))
                            .foregroundStyle(.white)
                            .shadow(radius: 10)
                        Text("Plasser telefonen og gå på plass")
                            .font(.title3.bold()).foregroundStyle(.white).shadow(radius: 6)
                    }

                    Spacer()

                    VStack(spacing: 12) {
                        Text(phaseTitle).font(.caption.bold()).foregroundStyle(.orange)
                        Text(scanner.instruction)
                            .font(.title3.bold())
                            .multilineTextAlignment(.center)
                        ProgressView(value: scanner.progress).tint(.green)
                        if case .failed(let message) = scanner.phase {
                            Text(message).foregroundStyle(.red)
                        }
                    }
                    .padding()
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20))
                    .padding()
                }
            }
            .onAppear {
                scanner.viewportSize = geo.size
                scanner.start()
            }
            .onChange(of: geo.size) { _, size in scanner.viewportSize = size }
        }
        // Bilder tas midt i hver fase, mens du står riktig
        .onChange(of: scanner.progress) { _, p in
            if frontPhoto == nil, scanner.phase == .front, p >= 0.25 { frontPhoto = holder.snapshot() }
            if sidePhoto == nil, scanner.phase == .side, p >= 0.75 { sidePhoto = holder.snapshot() }
        }
        .onChange(of: scanner.phase) { _, phase in
            if phase == .finished, let result = scanner.result {
                onComplete(result, frontPhoto, sidePhoto)
                dismiss()
            }
        }
        .onDisappear { scanner.stop() }
        .statusBarHidden()
    }

    private var phaseTitle: String {
        switch scanner.phase {
        case .idle, .countdown: "KLARGJØR"
        case .front: "1/2 · FORFRA"
        case .turn: "SNU DEG"
        case .side: "2/2 · FRA SIDEN"
        case .finished: "FERDIG"
        case .failed: "FEIL"
        }
    }
}

// MARK: - Resultat

struct BodyResultView: View {
    let scan: SavedScan
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let m = scan.measurements
        Form {
            Section {
                ShareLink(item: scan.url) {
                    Label("Del fil til FIV (\(scan.url.lastPathComponent))", systemImage: "square.and.arrow.up")
                        .font(.headline)
                }
            } footer: {
                Text("Velg «Lagre i Filer». Importer så filen i FIV under Kropp → Skann. Filen ligger også under Filer-fanen her og i Filer-appen → På min iPhone → FIV LiDAR.")
            }
            Section("Omkretser") {
                row("Hals", m.neckCm)
                row("Bryst", m.chestCm)
                row("Midje", m.waistCm)
                row("Hofte", m.hipCm)
                row("Overarm venstre", m.upperArmLeftCm)
                row("Overarm høyre", m.upperArmRightCm)
                row("Lår venstre", m.thighLeftCm)
                row("Lår høyre", m.thighRightCm)
            }
            Section("Lengder og holdning") {
                row("Målt høyde", m.measuredHeightCm)
                row("Skulderbredde", m.shoulderWidthCm)
                row("Armlengde V", m.armLengthLeftCm)
                row("Armlengde H", m.armLengthRightCm)
                row("Beinlengde V", m.legLengthLeftCm)
                row("Beinlengde H", m.legLengthRightCm)
                row("Skulderskjevhet", m.shoulderTiltDeg, unit: "°")
                row("Bekkenskjevhet", m.hipTiltDeg, unit: "°")
                row("Hode foran skulder", m.forwardHeadCm)
                row("Skuldre foran rygg", m.roundedShouldersCm)
                row("Øvre rygg-kurve", m.thoracicAngleDeg, unit: "°")
            }
            Section {
                Label(m.usedLiDAR ? "Målt med LiDAR · \(m.sampleCount) målinger" : "Målt med estimert dybde · \(m.sampleCount) målinger",
                      systemImage: m.usedLiDAR ? "checkmark.seal" : "exclamationmark.triangle")
                Text("Målene er estimater (typisk ±2–3 cm på omkretser). Ta skann under like forhold og følg trenden.")
                    .foregroundStyle(.secondary)
            }
            .font(.caption)
        }
        .navigationTitle("Skann lagret")
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Ferdig") { dismiss() } } }
    }

    private func row(_ title: String, _ value: Double?, unit: String = "cm") -> some View {
        LabeledContent(title) {
            Text(value.map { String(format: "%.1f %@", $0, unit) } ?? "–").monospacedDigit()
        }
    }
}
