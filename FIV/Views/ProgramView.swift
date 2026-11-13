import SwiftData
import SwiftUI

struct ProgramView: View {
    @Bindable var profile: UserProfile
    @Environment(\.modelContext) private var context
    @Query(sort: \SavedProgram.createdAt, order: .reverse) private var programs: [SavedProgram]
    @Query(sort: \BodyScan.date, order: .reverse) private var scans: [BodyScan]

    private var program: TrainingProgram? { programs.first?.program }

    var body: some View {
        NavigationStack {
            Group {
                if let program {
                    content(program)
                } else {
                    ContentUnavailableView("Ingen program ennå", systemImage: "list.bullet.clipboard",
                                           description: Text("Trykk «Lag nytt» for å generere et program."))
                }
            }
            .navigationTitle("Treningsprogram")
            .toolbar {
                Button("Lag nytt") {
                    CoachService.regenerateProgram(profile: profile, scans: scans, context: context)
                }
            }
        }
    }

    private func content(_ p: TrainingProgram) -> some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    Text(p.title).font(.headline)
                    Text(p.summary).font(.subheadline).foregroundStyle(.secondary)
                    Text("Laget \(p.createdAt.formatted(date: .abbreviated, time: .omitted))").font(.caption).foregroundStyle(.tertiary)
                }
            }

            Section("Økter") {
                ForEach(p.days) { day in
                    NavigationLink {
                        DayDetailView(day: day, warmup: p.warmup)
                    } label: {
                        VStack(alignment: .leading) {
                            Text(day.name).font(.headline)
                            Text("\(day.focus) · \(day.totalSets) sett").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }

            Section("Ukentlig volum (harde sett)") {
                ForEach(Muscle.allCases) { m in
                    let done = p.weeklySets[m.rawValue] ?? 0
                    let target = p.targetSets[m.rawValue] ?? 0
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(m.label).font(.subheadline)
                            Spacer()
                            Text(String(format: "%.1f / %.0f", done, target)).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                        }
                        ProgressView(value: min(done, max(target, 1) * 1.3), total: max(target, 1) * 1.3)
                            .tint(done >= target * 0.9 ? .green : .orange)
                    }
                }
            }

            Section("Periodisering") {
                ForEach(p.mesocycle) { w in
                    HStack(alignment: .top) {
                        Text("Uke \(w.number)").font(.subheadline.bold()).frame(width: 60, alignment: .leading)
                        VStack(alignment: .leading) {
                            Text("RIR \(w.rir)").font(.subheadline)
                            Text(w.volumeNote).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }

            Section("Kondisjon") {
                Text("Sone 2: \(p.cardio.zone2SessionsPerWeek) × \(p.cardio.zone2Minutes) min, puls \(p.cardio.zone2HeartRate.lowerBound)–\(p.cardio.zone2HeartRate.upperBound)")
                if p.cardio.intervalSessionsPerWeek > 0 {
                    Text(p.cardio.intervalDescription).font(.subheadline)
                    Text("Intervallpuls: \(p.cardio.intervalHeartRate.lowerBound)–\(p.cardio.intervalHeartRate.upperBound)").font(.caption)
                }
                Text("Skritt: \(p.cardio.dailySteps.formatted()) per dag")
            }

            Section("PT-notater") {
                ForEach(p.focusNotes, id: \.self) { Text($0).font(.subheadline) }
            }
        }
    }
}

struct DayDetailView: View {
    let day: WorkoutDay
    let warmup: [String]

    var body: some View {
        List {
            Section("Oppvarming") {
                ForEach(warmup, id: \.self) { Text($0).font(.subheadline) }
            }
            Section("Øvelser") {
                ForEach(day.exercises) { p in
                    if let ex = p.exercise {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(ex.name).font(.headline)
                                if ex.unilateral { Tag("ettsidig") }
                                if ex.lengthenedBias { Tag("strekk") }
                            }
                            Text("\(p.sets) × \(p.repsMin)–\(p.repsMax) · RIR \(p.rir) · pause \(p.restSeconds / 60):\(String(format: "%02d", p.restSeconds % 60))")
                                .font(.subheadline.monospacedDigit())
                            Text(ex.cue).font(.caption).foregroundStyle(.secondary)
                            if let note = p.note {
                                Text(note).font(.caption.bold()).foregroundStyle(.orange)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            Section {
                NavigationLink("Start økta") { WorkoutLogView(day: day) }
                    .font(.headline)
            }
        }
        .navigationTitle(day.name)
    }
}

struct Tag: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(.orange.opacity(0.2), in: Capsule())
    }
}
