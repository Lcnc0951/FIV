import ARKit
import SwiftUI

/// Viser kamerabildet fra en ARSession.
struct ARCameraView: UIViewRepresentable {
    let session: ARSession
    var holder: ARViewHolder? = nil

    func makeUIView(context: Context) -> ARSCNView {
        let view = holder?.view ?? ARSCNView(frame: .zero)
        view.session = session
        view.automaticallyUpdatesLighting = false
        view.rendersCameraGrain = false
        return view
    }

    func updateUIView(_ uiView: ARSCNView, context: Context) {}
}

/// Holder på AR-visningen så vi kan ta skjermbilder av den.
final class ARViewHolder: ObservableObject {
    let view = ARSCNView(frame: .zero)
    func snapshot() -> UIImage { view.snapshot() }
}

struct DepthCameraView: View {
    @StateObject private var engine = DepthCaptureEngine()
    @EnvironmentObject private var store: CaptureStore

    var body: some View {
        ZStack {
            GeometryReader { geo in
                ZStack {
                    ARCameraView(session: engine.session)
                    if engine.mode != .camera {
                        if engine.mode == .depth { Color.black }
                        if let heat = engine.heatmap {
                            Image(uiImage: heat)
                                .resizable()
                                .scaledToFill()
                                .frame(width: geo.size.width, height: geo.size.height)
                                .opacity(engine.mode == .blend ? 0.6 : 1)
                        }
                    }
                    // Sikte i midten
                    Image(systemName: "plus").font(.title2.weight(.light)).foregroundStyle(.white).shadow(radius: 3)
                }
                .frame(width: geo.size.width, height: geo.size.height)
                .clipped()
            }
            .ignoresSafeArea()

            VStack(spacing: 12) {
                HStack {
                    Picker("Visning", selection: $engine.mode) {
                        ForEach(DepthViewMode.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .frame(maxWidth: 260)
                    Spacer()
                    if let d = engine.centerDistance {
                        Text(String(format: "%.2f m", d))
                            .font(.headline.monospacedDigit())
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(.ultraThinMaterial, in: Capsule())
                    }
                }
                .padding(.horizontal)

                if engine.isRecording {
                    Label(String(format: "Tar opp  %.0f s", engine.recordingSeconds), systemImage: "record.circle")
                        .font(.headline.monospacedDigit())
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 8)
                        .background(.red, in: Capsule())
                }

                Spacer()

                if let message = engine.message {
                    Text(message)
                        .font(.subheadline)
                        .multilineTextAlignment(.center)
                        .padding(10)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                        .onTapGesture { engine.message = nil }
                }

                VStack(spacing: 10) {
                    if engine.mode != .camera {
                        HStack {
                            Text("Rekkevidde").font(.caption)
                            Slider(value: $engine.maxDistance, in: 0.5...5, step: 0.25)
                            Text(String(format: "%.1f m", engine.maxDistance)).font(.caption.monospacedDigit()).frame(width: 44)
                        }
                        LegendBar(far: engine.maxDistance)
                    }
                    Toggle("Lagre også i Bilder", isOn: $engine.saveToPhotos).font(.caption)

                    HStack(spacing: 40) {
                        Button { engine.capturePhoto() } label: {
                            Image(systemName: "camera.fill")
                                .font(.title2)
                                .frame(width: 64, height: 64)
                                .background(.white, in: Circle())
                                .foregroundStyle(.black)
                        }
                        .disabled(engine.isBusy || engine.isRecording)
                        .accessibilityLabel("Ta dybdebilde")

                        Button { engine.toggleRecording() } label: {
                            ZStack {
                                Circle().stroke(.white, lineWidth: 4).frame(width: 72, height: 72)
                                RoundedRectangle(cornerRadius: engine.isRecording ? 6 : 30)
                                    .fill(.red)
                                    .frame(width: engine.isRecording ? 28 : 58, height: engine.isRecording ? 28 : 58)
                            }
                        }
                        .disabled(engine.isBusy && !engine.isRecording)
                        .accessibilityLabel(engine.isRecording ? "Stopp video" : "Start video")
                    }
                }
                .padding()
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20))
                .padding(.horizontal)
                .padding(.bottom, 8)
            }
            .padding(.top, 8)
        }
        .onAppear { engine.start() }
        .onDisappear { engine.stop() }
        .onChange(of: engine.isBusy) { _, busy in if !busy { store.reload() } }
        .onChange(of: engine.message) { _, message in
            guard message != nil else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 4) { if engine.message == message { engine.message = nil } }
        }
    }
}

/// Fargeskala: rødt er nært, blått er langt unna.
private struct LegendBar: View {
    let far: Float
    var body: some View {
        VStack(spacing: 2) {
            LinearGradient(colors: [.red, .orange, .yellow, .green, .cyan, .blue, .indigo], startPoint: .leading, endPoint: .trailing)
                .frame(height: 6)
                .clipShape(Capsule())
            HStack {
                Text("0,2 m"); Spacer(); Text("nært → langt"); Spacer(); Text(String(format: "%.1f m", far))
            }
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
    }
}
