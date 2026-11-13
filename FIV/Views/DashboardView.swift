import SwiftData
import SwiftUI

struct DashboardView: View {
    @Bindable var profile: UserProfile
    @Query(sort: \BodyScan.date, order: .reverse) private var scans: [BodyScan]
    @Query(sort: \SavedProgram.createdAt, order: .reverse) private var programs: [SavedProgram]
    @Query(sort: \WorkoutEntry.date, order: .reverse) private var entries: [WorkoutEntry]
    @State private var showProfile = false

    private var analysis: BodyAnalysis { CoachService.analysis(profile: profile, scans: scans) }
    private var program: TrainingProgram? { programs.first?.program }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    tipCard
                    if let day = nextWorkout {
                        nextWorkoutCard(day)
                    }
                    if let scan = scans.first {
                        bodyCard(scan)
                    }
                    findingsCard
                    nutritionCard
                    if let cardio = program?.cardio {
                        cardioCard(cardio)
                    }
                }
                .padding()
            }
            .navigationTitle(profile.name.isEmpty ? "Hei!" : "Hei, \(profile.name)!")
            .toolbar {
                Button { showProfile = true } label: { Image(systemName: "person.crop.circle") }
            }
            .sheet(isPresented: $showProfile) {
                ProfileEditView(profile: profile)
            }
        }
    }

    // MARK: Neste økt

    private var nextWorkout: WorkoutDay? {
        guard let days = program?.days, !days.isEmpty else { return nil }
        guard let last = entries.first else { return days.first }
        let index = days.firstIndex { $0.name == last.dayName } ?? -1
        return days[(index + 1) % days.count]
    }

    private func nextWorkoutCard(_ day: WorkoutDay) -> some View {
        NavigationLink {
            WorkoutLogView(day: day)
        } label: {
            Card {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("NESTE ØKT").font(.caption.bold()).foregroundStyle(.orange)
                        Text(day.name).font(.title2.bold())
                        Text("\(day.exercises.count) øvelser · \(day.totalSets) sett · \(day.focus)")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "play.circle.fill").font(.system(size: 44)).foregroundStyle(.orange)
                }
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: Kort

    private var tipCard: some View {
        Card {
            Label(CoachKnowledge.tipOfTheDay(), systemImage: "lightbulb.fill")
                .font(.subheadline)
        }
    }

    private func bodyCard(_ scan: BodyScan) -> some View {
        let m = scan.measurements
        return Card {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Siste skann").font(.headline)
                    Spacer()
                    Text(scan.date, style: .date).font(.caption).foregroundStyle(.secondary)
                }
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    Metric(title: "Fett", value: analysis.bodyFatPercent.map { String(format: "%.0f %%", $0) })
                    Metric(title: "FFMI", value: analysis.ffmi.map { String(format: "%.1f", $0) })
                    Metric(title: "Midje", value: m.waistCm.map { String(format: "%.0f cm", $0) })
                    Metric(title: "Bryst", value: m.chestCm.map { String(format: "%.0f cm", $0) })
                    Metric(title: "Arm", value: m.upperArmAverage.map { String(format: "%.1f cm", $0) })
                    Metric(title: "Lår", value: m.thighAverage.map { String(format: "%.1f cm", $0) })
                }
            }
        }
    }

    private var findingsCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                Text("PT-vurdering").font(.headline)
                ForEach(analysis.findings.prefix(5)) { f in
                    FindingRow(finding: f)
                }
            }
        }
    }

    private var nutritionCard: some View {
        let n = NutritionCalculator.targets(profile: profile.data, bodyFatPercent: analysis.bodyFatPercent)
        return Card {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Ernæring i dag").font(.headline)
                    Spacer()
                    Text("\(n.targetKcal) kcal").font(.headline).foregroundStyle(.orange)
                }
                HStack {
                    Metric(title: "Protein", value: "\(n.proteinG) g")
                    Metric(title: "Karbo", value: "\(n.carbsG) g")
                    Metric(title: "Fett", value: "\(n.fatG) g")
                    Metric(title: "Fiber", value: "\(n.fiberG) g")
                }
                Text(n.weeklyChangeNote).font(.caption).foregroundStyle(.secondary)
                DisclosureGroup("Tilskudd") {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(n.supplements, id: \.self) { Text("• \($0)").font(.caption) }
                    }
                }
                .font(.subheadline)
            }
        }
    }

    private func cardioCard(_ c: CardioPlan) -> some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Text("Kondisjon denne uka").font(.headline)
                Label("\(c.zone2SessionsPerWeek) × \(c.zone2Minutes) min sone 2 (puls \(c.zone2HeartRate.lowerBound)–\(c.zone2HeartRate.upperBound))", systemImage: "heart")
                if c.intervalSessionsPerWeek > 0 {
                    Label("\(c.intervalSessionsPerWeek) × 4×4-intervaller (puls \(c.intervalHeartRate.lowerBound)–\(c.intervalHeartRate.upperBound))", systemImage: "bolt.heart")
                }
                Label("\(c.dailySteps.formatted()) skritt per dag", systemImage: "figure.walk")
            }
            .font(.subheadline)
        }
    }
}

// MARK: - Gjenbrukbare komponenter

struct Card<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct Metric: View {
    let title: String
    let value: String?
    var body: some View {
        VStack(spacing: 2) {
            Text(value ?? "–").font(.headline.monospacedDigit())
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

struct FindingRow: View {
    let finding: Finding
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon).foregroundStyle(color).font(.title3)
            VStack(alignment: .leading, spacing: 3) {
                Text(finding.title).font(.subheadline.bold())
                Text(finding.detail).font(.caption).foregroundStyle(.secondary)
                Text(finding.action).font(.caption.bold())
            }
        }
    }
    private var icon: String {
        switch finding.severity {
        case .positive: "checkmark.seal.fill"
        case .info: "info.circle.fill"
        case .attention: "exclamationmark.circle.fill"
        case .important: "exclamationmark.triangle.fill"
        }
    }
    private var color: Color {
        switch finding.severity {
        case .positive: .green
        case .info: .blue
        case .attention: .orange
        case .important: .red
        }
    }
}
