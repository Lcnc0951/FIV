import Foundation

struct SetLog: Codable, Hashable, Identifiable {
    var id = UUID()
    var weightKg: Double
    var reps: Int
    var rir: Int?
}

struct ProgressionSuggestion: Equatable {
    var weightKg: Double?
    var targetReps: Int
    var message: String
}

/// Dobbel progresjon: øk reps innenfor intervallet, deretter vekt.
enum ProgressionEngine {

    /// `dumbbellWeights`: manualvektene som faktisk finnes der du trener. Forslag rundes til nærmeste tilgjengelige vekt.
    static func suggest(for p: ExercisePrescription, lastSets: [SetLog], dumbbellWeights: [Double] = []) -> ProgressionSuggestion {
        var s = baseSuggestion(for: p, lastSets: lastSets)
        guard let ex = p.exercise, ex.usesDumbbells, !dumbbellWeights.isEmpty, let wanted = s.weightKg, wanted > 0 else { return s }
        let sorted = dumbbellWeights.sorted()
        let top = lastSets.map(\.weightKg).max() ?? 0
        if wanted > top {
            // Neste vekt opp som faktisk finnes
            if let next = sorted.first(where: { $0 > top }) {
                s.weightKg = next
                if next - top > top * 0.15 {
                    s.message = "Neste manual (\(next.kgText)) er et stort hopp — start på \(max(p.repsMin - 3, 5)) reps og bygg opp."
                    s.targetReps = max(p.repsMin - 3, 5)
                }
            } else {
                s.weightKg = top
                s.targetReps = p.repsMax + 2
                s.message = "Du har nådd tyngste manual. Øk reps, bruk 3–4 sek nedfase, pause i bunnen eller en ettsidig variant."
            }
        } else {
            s.weightKg = sorted.min(by: { abs($0 - wanted) < abs($1 - wanted) })
        }
        return s
    }

    private static func baseSuggestion(for p: ExercisePrescription, lastSets: [SetLog]) -> ProgressionSuggestion {
        guard let ex = p.exercise else {
            return ProgressionSuggestion(weightKg: nil, targetReps: p.repsMin, message: "")
        }
        let working = lastSets.filter { $0.reps > 0 }
        guard let top = working.map(\.weightKg).max(), !working.isEmpty else {
            return ProgressionSuggestion(
                weightKg: nil, targetReps: p.repsMax,
                message: "Første gang: velg en vekt der du klarer \(p.repsMin)–\(p.repsMax) reps med \(p.rir) reps i reserve.")
        }

        let atTop = working.filter { $0.weightKg >= top }
        let allHitTop = atTop.count >= p.sets && atTop.allSatisfy { $0.reps >= p.repsMax }
        let missedBottom = atTop.contains { $0.reps < p.repsMin && ($0.rir ?? 0) == 0 }

        if top == 0 { // kroppsvekt
            let best = working.map(\.reps).max() ?? p.repsMin
            return ProgressionSuggestion(weightKg: 0, targetReps: best + 1,
                                         message: allHitTop ? "Gjør øvelsen tyngre: tempo 4 sek ned, pause, eller en vanskeligere variant." : "Prøv å slå \(best) reps.")
        }

        if allHitTop {
            let increment = increment(for: ex, current: top)
            return ProgressionSuggestion(weightKg: round(to: top + increment, step: ex.pattern.isCompound ? 2.5 : 1),
                                         targetReps: p.repsMin,
                                         message: "Alle sett i toppen av intervallet — øk vekten og start på \(p.repsMin) reps.")
        }
        if missedBottom {
            return ProgressionSuggestion(weightKg: round(to: top * 0.92, step: ex.pattern.isCompound ? 2.5 : 1),
                                         targetReps: p.repsMin,
                                         message: "For tungt forrige gang. Litt lettere vekt, bygg opp igjen.")
        }
        let bestReps = atTop.map(\.reps).max() ?? p.repsMin
        return ProgressionSuggestion(weightKg: top, targetReps: min(p.repsMax, bestReps + 1),
                                     message: "Samme vekt — sikte på +1 rep i så mange sett som mulig.")
    }

    private static func increment(for ex: Exercise, current: Double) -> Double {
        let lower: Set<MovementPattern> = [.squat, .hinge, .singleLeg]
        let pct = lower.contains(ex.pattern) ? 0.05 : 0.025
        return max(ex.pattern.isCompound ? 2.5 : 1, current * pct)
    }

    private static func round(to value: Double, step: Double) -> Double {
        (value / step).rounded() * step
    }

    /// Estimert 1RM (Epley), justert for reps i reserve.
    static func estimatedOneRepMax(_ set: SetLog) -> Double {
        let reps = Double(set.reps + (set.rir ?? 0))
        return reps <= 1 ? set.weightKg : set.weightKg * (1 + reps / 30)
    }
}
