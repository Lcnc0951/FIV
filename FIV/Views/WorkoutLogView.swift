import SwiftData
import SwiftUI

struct WorkoutLogView: View {
    let day: WorkoutDay
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \WorkoutEntry.date, order: .reverse) private var history: [WorkoutEntry]
    @State private var logs: [UUID: [SetLog]] = [:]
    @State private var restEndsAt: Date?

    var body: some View {
        List {
            if let end = restEndsAt, end > Date() {
                Section {
                    HStack {
                        Image(systemName: "timer")
                        Text("Pause: ")
                        Text(timerInterval: Date()...end, countsDown: true).monospacedDigit().bold()
                        Spacer()
                        Button("Hopp over") { restEndsAt = nil }
                    }
                }
            }
            ForEach(day.exercises) { p in
                if let ex = p.exercise {
                    Section {
                        let suggestion = ProgressionEngine.suggest(for: p, lastSets: lastSets(for: ex.id))
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Mål: \(p.sets) × \(p.repsMin)–\(p.repsMax) · RIR \(p.rir)").font(.subheadline)
                            if let w = suggestion.weightKg, w > 0 {
                                Text(String(format: "Forslag: %.1f kg × %d", w, suggestion.targetReps)).font(.subheadline.bold()).foregroundStyle(.orange)
                            }
                            Text(suggestion.message).font(.caption).foregroundStyle(.secondary)
                            if let note = p.note { Text(note).font(.caption.bold()) }
                        }
                        ForEach(Array((logs[p.id] ?? []).enumerated()), id: \.element.id) { index, _ in
                            SetRow(index: index + 1, set: binding(p.id, index))
                        }
                        Button {
                            addSet(p, suggestion: suggestion)
                        } label: {
                            Label("Logg sett", systemImage: "plus.circle.fill")
                        }
                    } header: {
                        HStack {
                            Text(ex.name)
                            if ex.unilateral { Tag("ettsidig") }
                        }
                    }
                }
            }
            Section {
                Button("Fullfør økta") { finish() }
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .disabled(logs.values.allSatisfy(\.isEmpty))
            }
        }
        .navigationTitle(day.name)
        .scrollDismissesKeyboard(.interactively)
    }

    private func lastSets(for exerciseId: String) -> [SetLog] {
        history.first { $0.exerciseId == exerciseId }?.sets ?? []
    }

    private func binding(_ id: UUID, _ index: Int) -> Binding<SetLog> {
        Binding(
            get: { logs[id]?[safe: index] ?? SetLog(weightKg: 0, reps: 0) },
            set: { logs[id]?[index] = $0 })
    }

    private func addSet(_ p: ExercisePrescription, suggestion: ProgressionSuggestion) {
        var list = logs[p.id] ?? []
        let template = list.last ?? SetLog(weightKg: suggestion.weightKg ?? 0, reps: suggestion.targetReps, rir: p.rir)
        list.append(SetLog(weightKg: template.weightKg, reps: template.reps, rir: template.rir))
        logs[p.id] = list
        if list.count > 1 {
            restEndsAt = Date().addingTimeInterval(TimeInterval(p.restSeconds))
        }
    }

    private func finish() {
        let now = Date()
        for p in day.exercises {
            let sets = (logs[p.id] ?? []).filter { $0.reps > 0 }
            guard !sets.isEmpty else { continue }
            context.insert(WorkoutEntry(date: now, dayName: day.name, exerciseId: p.exerciseId, sets: sets))
        }
        try? context.save()
        VoiceCoach.shared.speak("Bra jobba! Økta er lagret.", interrupt: true)
        dismiss()
    }
}

private struct SetRow: View {
    let index: Int
    @Binding var set: SetLog

    var body: some View {
        HStack(spacing: 10) {
            Text("\(index)").font(.headline).frame(width: 22)
            TextField("kg", value: $set.weightKg, format: .number.precision(.fractionLength(0...1)))
                .keyboardType(.decimalPad).textFieldStyle(.roundedBorder).frame(width: 70)
            Text("kg").font(.caption)
            Stepper("\(set.reps) reps", value: $set.reps, in: 0...100)
            Picker("RIR", selection: Binding(get: { set.rir ?? 2 }, set: { set.rir = $0 })) {
                ForEach(0...5, id: \.self) { Text("RIR \($0)").tag($0) }
            }
            .labelsHidden()
        }
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
