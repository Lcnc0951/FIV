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

    /// Nyeste program for et treningssted.
    static func saved(for location: TrainingLocation, in programs: [SavedProgram]) -> SavedProgram? {
        programs.sorted { $0.createdAt > $1.createdAt }.first { $0.program?.locationId == location.id }
    }

    static func currentProgram(profile: UserProfile, programs: [SavedProgram]) -> TrainingProgram? {
        saved(for: profile.activeLocation, in: programs)?.program
    }

    /// Lager nytt program for det aktive stedet.
    @discardableResult
    static func regenerateProgram(profile: UserProfile, scans: [BodyScan], context: ModelContext) -> TrainingProgram {
        regenerate(profile: profile, location: profile.activeLocation, scans: scans, context: context)
    }

    /// Lager nye program for alle treningssteder (etter skann, profil- eller utstyrsendring).
    static func regenerateAllPrograms(profile: UserProfile, scans: [BodyScan], context: ModelContext) {
        for location in profile.locations {
            regenerate(profile: profile, location: location, scans: scans, context: context)
        }
    }

    @discardableResult
    private static func regenerate(profile: UserProfile, location: TrainingLocation, scans: [BodyScan], context: ModelContext) -> TrainingProgram {
        let data = profile.data(at: location)
        let sorted = scans.sorted { $0.date > $1.date }
        let analysis = BodyAnalyzer.analyze(profile: data, scan: sorted.first?.measurements, previous: sorted.dropFirst().first?.measurements)
        let program = ProgramGenerator.generate(profile: data, analysis: analysis)
        // Rydd bort gamle program for samme sted
        if let old = try? context.fetch(FetchDescriptor<SavedProgram>()) {
            for p in old where p.program?.locationId == location.id { context.delete(p) }
        }
        context.insert(SavedProgram(program: program))
        try? context.save()
        return program
    }

    /// Bytter én øvelse i et lagret program og tilpasser reps/RIR til den nye øvelsen.
    static func swap(prescriptionId: UUID, to exercise: Exercise, in saved: SavedProgram,
                     profile: UserProfile, scans: [BodyScan], context: ModelContext) {
        guard var program = saved.program else { return }
        let bodyAnalysis = Self.analysis(profile: profile, scans: scans)
        let location = profile.locations.first { $0.id == program.locationId } ?? profile.activeLocation
        for d in program.days.indices {
            if let e = program.days[d].exercises.firstIndex(where: { $0.id == prescriptionId }) {
                let old = program.days[d].exercises[e]
                var new = ProgramGenerator.prescription(for: exercise, sets: old.sets, profile: profile.data(at: location), analysis: bodyAnalysis)
                new.id = old.id
                program.days[d].exercises[e] = new
            }
        }
        saved.programData = (try? JSONEncoder().encode(program)) ?? saved.programData
        try? context.save()
    }
}
