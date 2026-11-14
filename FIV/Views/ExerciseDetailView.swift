import SwiftUI

/// Viser hvordan øvelsen gjøres (video/animasjon), musklene den trener, og alternativer som passer utstyret ditt.
struct ExerciseDetailView: View {
    let exercise: Exercise
    var prescription: ExercisePrescription? = nil
    var location: TrainingLocation? = nil
    var limitations: Set<Limitation> = []
    /// Settes når øvelsen kan byttes i programmet.
    var onSwap: ((Exercise) -> Void)? = nil
    @Environment(\.dismiss) private var dismiss

    private var alternatives: [Exercise] {
        guard let location else { return [] }
        return Array(ExerciseLibrary.alternatives(to: exercise, available: location.equipment, limitations: limitations).prefix(6))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                ExerciseMediaView(exercise: exercise)

                VStack(alignment: .leading, spacing: 8) {
                    Text(exercise.name).font(.title.bold())
                    HStack {
                        if exercise.unilateral { Tag("ettsidig") }
                        if exercise.lengthenedBias { Tag("strekk-fokus") }
                        Tag(exercise.pattern.isCompound ? "basisøvelse" : "isolasjon")
                    }
                    Label(exercise.equipmentText, systemImage: "dumbbell").font(.subheadline).foregroundStyle(.secondary)
                }

                if let p = prescription {
                    Card {
                        HStack {
                            Metric(title: "Sett", value: "\(p.sets)")
                            Metric(title: "Reps", value: "\(p.repsMin)–\(p.repsMax)")
                            Metric(title: "RIR", value: "\(p.rir)")
                            Metric(title: "Pause", value: "\(p.restSeconds / 60):\(String(format: "%02d", p.restSeconds % 60))")
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Muskler").font(.headline)
                    FlowChips(items: [(exercise.primary.label, true)] + exercise.secondary.map { ($0.label, false) })
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Slik gjør du det").font(.headline)
                    Text(exercise.cue)
                    if let note = prescription?.note {
                        Label(note, systemImage: "person.fill.checkmark").font(.subheadline.bold()).foregroundStyle(.orange)
                    }
                    Text("RIR = reps i reserve: hvor mange reps du kunne tatt til. Siste sett skal være tungt.")
                        .font(.caption).foregroundStyle(.secondary)
                }

                if onSwap != nil, !alternatives.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Bytt øvelse").font(.headline)
                        Text("Apparatet opptatt eller passer ikke? Disse trener det samme med utstyret på \(location?.name ?? "stedet ditt").")
                            .font(.caption).foregroundStyle(.secondary)
                        ForEach(alternatives) { alt in
                            HStack {
                                NavigationLink {
                                    ExerciseDetailView(exercise: alt)
                                } label: {
                                    VStack(alignment: .leading) {
                                        Text(alt.name).font(.subheadline.bold())
                                        Text("\(alt.primary.label) · \(alt.equipmentText)").font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                                Spacer()
                                Button("Bytt") {
                                    onSwap?(alt)
                                    dismiss()
                                }
                                .buttonStyle(.bordered)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            .padding()
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct FlowChips: View {
    let items: [(String, Bool)]
    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), alignment: .leading)], alignment: .leading, spacing: 8) {
            ForEach(items.indices, id: \.self) { i in
                let item = items[i]
                Text(item.0)
                    .font(.caption.bold())
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(item.1 ? Color.orange.opacity(0.25) : Color.gray.opacity(0.15), in: Capsule())
            }
        }
    }
}
