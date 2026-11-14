import SwiftData
import SwiftUI

struct ScanFlowView: View {
    @Bindable var profile: UserProfile
    @Environment(\.modelContext) private var context
    @Query(sort: \BodyScan.date, order: .reverse) private var scans: [BodyScan]
    @State private var weight: Double = 0
    @State private var showScanner = false
    @State private var resultScan: BodyScan?

    var body: some View {
        NavigationStack {
            List {
                if !BodyScanner.isSupported {
                    Section {
                        Label("Denne enheten støtter ikke kroppsskanning. Bruk en iPhone med LiDAR (Pro-modell).", systemImage: "exclamationmark.triangle")
                    }
                }
                Section("Før du starter") {
                    Checklist(icon: "tshirt", text: "Tettsittende klær (eller undertøy/treningstøy). Løse klær gir for store mål.")
                    Checklist(icon: "sun.max", text: "Godt, jevnt lys og en rolig bakgrunn.")
                    Checklist(icon: "iphone", text: "Sett telefonen stående i hoftehøyde mot en vegg eller flaske.")
                    Checklist(icon: "ruler", text: "Stå 2,5–3 meter unna, hele kroppen i bildet.")
                    Checklist(icon: "figure.arms.open", text: "Forfra: armene litt ut (A-stilling), føttene i skulderbredde.")
                    Checklist(icon: "arrow.turn.up.left", text: "Deretter: snu deg en kvart runde til venstre, armene ned.")
                    Checklist(icon: "speaker.wave.2", text: "Skru opp lyden — jeg guider deg med stemmen.")
                }
                Section("Dagens vekt") {
                    Stepper(String(format: "%.1f kg", weight), value: $weight, in: 35...250, step: 0.1)
                    Text("Vei deg om morgenen etter toalettbesøk, før frokost.").font(.caption).foregroundStyle(.secondary)
                }
                Section {
                    Button {
                        showScanner = true
                    } label: {
                        Label("Start skanning", systemImage: "camera.metering.matrix")
                            .frame(maxWidth: .infinity)
                            .font(.headline)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(!BodyScanner.isSupported)
                    .listRowInsets(EdgeInsets())
                }
                if !scans.isEmpty {
                    Section("Tidligere skann") {
                        ForEach(scans) { scan in
                            NavigationLink {
                                ScanResultView(scan: scan, profile: profile)
                            } label: {
                                HStack {
                                    Text(scan.date, style: .date)
                                    Spacer()
                                    if let w = scan.measurements.waistCm {
                                        Text(String(format: "Midje %.0f cm", w)).foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                        .onDelete { idx in
                            for i in idx { context.delete(scans[i]) }
                        }
                    }
                }
            }
            .navigationTitle("Kroppsskann")
            .onAppear { if weight == 0 { weight = profile.weightKg } }
            .fullScreenCover(isPresented: $showScanner) {
                BodyScanView { measurements in
                    save(measurements)
                }
            }
            .sheet(item: $resultScan) { scan in
                NavigationStack { ScanResultView(scan: scan, profile: profile) }
            }
        }
    }

    private func save(_ m: ScanMeasurements) {
        profile.weightKg = weight
        let scan = BodyScan(weightKg: weight, measurements: m)
        context.insert(scan)
        CoachService.regenerateAllPrograms(profile: profile, scans: scans + [scan], context: context)
        resultScan = scan
    }
}

private struct Checklist: View {
    let icon: String
    let text: String
    var body: some View {
        Label(text, systemImage: icon).font(.subheadline)
    }
}

// MARK: - Selve skanningen

struct BodyScanView: View {
    var onComplete: (ScanMeasurements) -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var scanner = BodyScanner()

    var body: some View {
        GeometryReader { geo in
            ZStack {
                ARScanContainer(session: scanner.session)
                    .ignoresSafeArea()

                // Skjelett-overlay
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
                        ProgressView(value: scanner.progress)
                            .tint(.green)
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
        .onChange(of: scanner.phase) { _, phase in
            if phase == .finished, let result = scanner.result {
                onComplete(result)
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

struct ScanResultView: View {
    @Bindable var scan: BodyScan
    @Bindable var profile: UserProfile
    @Query(sort: \BodyScan.date, order: .reverse) private var scans: [BodyScan]
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var m = ScanMeasurements()

    private var analysis: BodyAnalysis {
        let previous = scans.first { $0.date < scan.date }?.measurements
        return BodyAnalyzer.analyze(profile: profile.data, scan: m, previous: previous)
    }

    var body: some View {
        Form {
            Section("Kroppssammensetning") {
                row("Fettprosent (Navy)", analysis.bodyFatPercent, unit: "%", format: "%.1f")
                row("Fettfri masse", analysis.leanMassKg, unit: "kg", format: "%.1f")
                row("FFMI (normalisert)", analysis.ffmi, unit: "", format: "%.1f")
                row("Midje/høyde", analysis.waistToHeight, unit: "", format: "%.2f")
            }
            Section {
                editable("Hals", \.neckCm)
                editable("Bryst", \.chestCm)
                editable("Midje", \.waistCm)
                editable("Hofte", \.hipCm)
                editable("Overarm venstre", \.upperArmLeftCm)
                editable("Overarm høyre", \.upperArmRightCm)
                editable("Lår venstre", \.thighLeftCm)
                editable("Lår høyre", \.thighRightCm)
            } header: {
                Text("Omkretser (cm)")
            } footer: {
                Text("Trykk på et tall for å korrigere med målebånd. Analysen oppdateres med en gang.")
            }
            Section("Holdning & proporsjoner") {
                row("Skulderskjevhet", m.shoulderTiltDeg, unit: "°", format: "%+.1f")
                row("Bekkenskjevhet", m.hipTiltDeg, unit: "°", format: "%+.1f")
                row("Hode foran skulder", m.forwardHeadCm, unit: "cm", format: "%.1f")
                row("Skuldre foran rygg", m.roundedShouldersCm, unit: "cm", format: "%.1f")
                row("Øvre rygg-kurve", m.thoracicAngleDeg, unit: "°", format: "%.0f")
                row("Skulderbredde (ledd)", m.shoulderWidthCm, unit: "cm", format: "%.1f")
                row("Armlengde V / H", m.armLengthLeftCm, unit: String(format: "/ %.1f cm", m.armLengthRightCm ?? 0), format: "%.1f")
                row("Beinlengde V / H", m.legLengthLeftCm, unit: String(format: "/ %.1f cm", m.legLengthRightCm ?? 0), format: "%.1f")
                row("Målt høyde", m.measuredHeightCm, unit: "cm", format: "%.0f")
            }
            Section("PT-vurdering") {
                ForEach(analysis.findings) { FindingRow(finding: $0) }
            }
            Section {
                Label(m.usedLiDAR ? "Målt med LiDAR · \(m.sampleCount) målinger" : "Målt med estimert dybde · \(m.sampleCount) målinger",
                      systemImage: m.usedLiDAR ? "checkmark.seal" : "exclamationmark.triangle")
                    .font(.caption)
                Text("Skannet er et estimat (typisk ±2–3 cm på omkretser). Følg trenden over flere skann, tatt under like forhold.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .navigationTitle(Text(scan.date, style: .date))
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Lagre") {
                    scan.measurements = m
                    CoachService.regenerateAllPrograms(profile: profile, scans: scans, context: context)
                    dismiss()
                }
            }
        }
        .onAppear { m = scan.measurements }
    }

    private func row(_ title: String, _ value: Double?, unit: String, format: String) -> some View {
        LabeledContent(title) {
            Text(value.map { String(format: format, $0) + " " + unit } ?? "–").monospacedDigit()
        }
    }

    private func editable(_ title: String, _ key: WritableKeyPath<ScanMeasurements, Double?>) -> some View {
        LabeledContent(title) {
            TextField("–", value: Binding(get: { m[keyPath: key] }, set: { m[keyPath: key] = $0 }),
                      format: .number.precision(.fractionLength(1)))
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .monospacedDigit()
        }
    }
}
