import SwiftData
import SwiftUI

@main
struct FIVApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .tint(.orange)
        }
        .modelContainer(for: [UserProfile.self, BodyScan.self, SavedProgram.self, WorkoutEntry.self])
    }
}

struct RootView: View {
    @Query private var profiles: [UserProfile]

    var body: some View {
        if let profile = profiles.first {
            MainTabView(profile: profile)
        } else {
            OnboardingView()
        }
    }
}

struct MainTabView: View {
    @Bindable var profile: UserProfile

    var body: some View {
        TabView {
            DashboardView(profile: profile)
                .tabItem { Label("Hjem", systemImage: "house.fill") }
            ScanFlowView(profile: profile)
                .tabItem { Label("Skann", systemImage: "figure.stand") }
            ProgramView(profile: profile)
                .tabItem { Label("Program", systemImage: "list.bullet.clipboard") }
            ProgressChartsView(profile: profile)
                .tabItem { Label("Fremgang", systemImage: "chart.xyaxis.line") }
            CoachView()
                .tabItem { Label("PT", systemImage: "brain.head.profile") }
        }
    }
}

/// Felles logikk som kobler lagrede data til PT-motoren.
enum CoachService {
    static func analysis(profile: UserProfile, scans: [BodyScan]) -> BodyAnalysis {
        let sorted = scans.sorted { $0.date > $1.date }
        return BodyAnalyzer.analyze(profile: profile.data,
                                    scan: sorted.first?.measurements,
                                    previous: sorted.dropFirst().first?.measurements)
    }

    @discardableResult
    static func regenerateProgram(profile: UserProfile, scans: [BodyScan], context: ModelContext) -> TrainingProgram {
        let program = ProgramGenerator.generate(profile: profile.data, analysis: analysis(profile: profile, scans: scans))
        context.insert(SavedProgram(program: program))
        try? context.save()
        return program
    }
}
