import ARKit
import SwiftUI

/// FIV LiDAR – egen app som bruker LiDAR-sensoren på iPhone Pro.
/// Lagrer kroppsmål som en JSON-fil som FIV-treningsappen kan importere,
/// og dybdebilder, dybdevideo, punktsky og 3D-modeller som vanlige filer og i Bilder.
@main
struct FIVLidarApp: App {
    @StateObject private var store = CaptureStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .onAppear { store.reload() }
        }
    }
}

struct RootView: View {
    var body: some View {
        if !ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) {
            ContentUnavailableView(
                "Krever LiDAR",
                systemImage: "sensor.tag.radiowaves.forward",
                description: Text("Appen trenger en iPhone eller iPad med LiDAR-sensor (Pro-modeller). Den virker ikke i simulatoren.")
            )
        } else {
            TabView {
                BodyMeasureView()
                    .tabItem { Label("Kroppsmål", systemImage: "figure.stand") }
                DepthCameraView()
                    .tabItem { Label("Dybdekamera", systemImage: "camera.metering.matrix") }
                MeshScanView()
                    .tabItem { Label("3D-skann", systemImage: "cube.transparent") }
                LibraryView()
                    .tabItem { Label("Filer", systemImage: "folder") }
            }
        }
    }
}
