import SwiftData
import SwiftUI

struct ProgramView: View {
    @Bindable var profile: UserProfile
    @Environment(\.modelContext) private var context
    @Query(sort: \SavedProgram.createdAt, order: .reverse) private var programs: [SavedProgram]
    @Query(sort: \BodyScan.date, order: .reverse) private var scans: [BodyScan]

    private var saved: SavedProgram? { CoachService.saved(for: profile.activeLocation, in: programs) }

    var body: some View {
        NavigationStack {
            Group {
                if let saved, let program = saved.program {
                    content(program, saved: saved)
                } else {
                    ContentUnavailableView {
                        Label("Ingen program for \(profile.activeLocation.name)", systemImage: "list.bullet.clipboard")
                    } actions: {
                        Button("Lag program") {
                            CoachService.regenerateProgram(profile: profile, scans: scans, context: context)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
            }
            .navigationTitle("Treningsprogram")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    NavigationLink {
                        EquipmentSetupView(profile: profile)
                    } label: {
                        Image(systemName: "dumbbell")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lag nytt") {
                        CoachService.regenerateProgram(profile: profile, scans: scans, context: context)
                    }
                }
            }
        }
    }

    private var locationPicker: some View {
        Picker("Treningssted", selection: Binding(
            get: { profile.activeLocation.id },
            set: { id in
                profile.activeLocationId = id.uuidString
                if CoachService.saved(for: profile.activeLocation, in: programs) == nil {
                    CoachService.regenerateProgram(profile: profile, scans: scans, context: context)
                }
            })) {
            ForEach(profile.locations) { loc in
                Label(loc.name, systemImage: loc.kind.symbol).tag(loc.id)
            }
        }
        .pickerStyle(.segmented)
    }

    private func content(_ p: TrainingProgram, saved: SavedProgram) -> some View {
        List {
            if profile.locations.count > 1 {
                Section {
                    locationPicker
                } footer: {
                    Text(profile.activeLocation.summary)
                }
            }

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
                        DayDetailView(day: day, warmup: p.warmup, saved: saved, profile: profile)
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
    var saved: SavedProgram? = nil
    var profile: UserProfile? = nil
    @Environment(\.modelContext) private var context
    @Query private var scans: [BodyScan]

    /// Leser oppdatert dag fra lagret program (etter bytte av øvelse).
    private var current: WorkoutDay {
        saved?.program?.days.first { $0.id == day.id } ?? day
    }

    var body: some View {
        List {
            Section("Oppvarming") {
                ForEach(warmup, id: \.self) { Text($0).font(.subheadline) }
            }
            Section {
                ForEach(current.exercises) { p in
                    if let ex = p.exercise {
                        NavigationLink {
                            ExerciseDetailView(exercise: ex, prescription: p, location: profile?.activeLocation,
                                               limitations: profile?.limitations ?? [],
                                               onSwap: swapHandler(for: p))
                        } label: {
                            ExerciseRow(exercise: ex, prescription: p)
                        }
                    }
                }
            } header: {
                Text("Øvelser")
            } footer: {
                Text("Trykk på en øvelse for å se hvordan den gjøres, eller bytte den ut.")
            }
            Section {
                NavigationLink("Start økta") {
                    WorkoutLogView(day: current, dumbbellWeights: profile?.activeLocation.dumbbellWeights ?? [])
                }
                .font(.headline)
            }
        }
        .navigationTitle(day.name)
    }

    private func swapHandler(for p: ExercisePrescription) -> ((Exercise) -> Void)? {
        guard let saved, let profile else { return nil }
        return { newExercise in
            CoachService.swap(prescriptionId: p.id, to: newExercise, in: saved, profile: profile, scans: scans, context: context)
        }
    }
}

struct ExerciseRow: View {
    let exercise: Exercise
    let prescription: ExercisePrescription

    var body: some View {
        HStack(spacing: 12) {
            Group {
                if let anim = ExerciseAnimationStore.animation(for: exercise.id) {
                    StickFigureView(animation: anim, highlight: exercise.primary, showsPhase: false)
                        .padding(4)
                } else {
                    Image(systemName: "figure.strengthtraining.traditional").foregroundStyle(.orange)
                }
            }
            .frame(width: 64, height: 64)
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(exercise.name).font(.headline)
                    if exercise.unilateral { Tag("ettsidig") }
                }
                Text("\(prescription.sets) × \(prescription.repsMin)–\(prescription.repsMax) · RIR \(prescription.rir) · pause \(prescription.restSeconds / 60):\(String(format: "%02d", prescription.restSeconds % 60))")
                    .font(.subheadline.monospacedDigit())
                if let note = prescription.note {
                    Text(note).font(.caption.bold()).foregroundStyle(.orange).lineLimit(2)
                }
            }
        }
        .padding(.vertical, 4)
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
