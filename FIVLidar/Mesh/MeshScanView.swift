import RealityKit
import SwiftUI

struct MeshScanView: View {
    @StateObject private var engine = MeshScanEngine()
    @EnvironmentObject private var store: CaptureStore

    var body: some View {
        ZStack {
            MeshARView(arView: engine.arView).ignoresSafeArea()

            VStack(spacing: 12) {
                HStack {
                    Label("\(engine.vertexCount.formatted()) punkter", systemImage: "cube.transparent")
                        .font(.subheadline.monospacedDigit())
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(.ultraThinMaterial, in: Capsule())
                    Spacer()
                    Button { engine.start(reset: true) } label: {
                        Label("Start på nytt", systemImage: "arrow.counterclockwise")
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(.ultraThinMaterial, in: Capsule())
                    }
                }
                .padding(.horizontal)

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
                    Text(engine.isScanning
                         ? "Gå sakte rundt det du skanner. Hold 0,5–3 m avstand. Nettet viser hva som er fanget."
                         : "Skanningen er satt på pause.")
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                    Toggle("Lagre forhåndsvisning i Bilder", isOn: $engine.saveToPhotos).font(.caption)
                    HStack(spacing: 12) {
                        Button {
                            engine.isScanning ? engine.pause() : engine.start(reset: false)
                        } label: {
                            Label(engine.isScanning ? "Pause" : "Fortsett", systemImage: engine.isScanning ? "pause.fill" : "play.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)

                        Button {
                            Task { await engine.export(); store.reload() }
                        } label: {
                            if engine.isExporting {
                                ProgressView().frame(maxWidth: .infinity)
                            } else {
                                Label("Lagre 3D-fil", systemImage: "square.and.arrow.down").frame(maxWidth: .infinity)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(engine.isExporting || engine.vertexCount == 0)
                    }
                    .controlSize(.large)
                }
                .padding()
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20))
                .padding(.horizontal)
                .padding(.bottom, 8)
            }
            .padding(.top, 8)
        }
        .onAppear {
            if MeshScanEngine.isSupported { engine.start(reset: false) } else { engine.message = "Enheten støtter ikke 3D-rekonstruksjon." }
        }
        .onDisappear { engine.pause() }
    }
}

private struct MeshARView: UIViewRepresentable {
    let arView: ARView
    func makeUIView(context: Context) -> ARView { arView }
    func updateUIView(_ uiView: ARView, context: Context) {}
}
