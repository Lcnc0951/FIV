import Foundation

// MARK: - Programmodell

struct ExercisePrescription: Codable, Identifiable, Hashable {
    var id = UUID()
    var exerciseId: String
    var sets: Int
    var repsMin: Int
    var repsMax: Int
    var rir: Int
    var restSeconds: Int
    var note: String?

    var exercise: Exercise? { ExerciseLibrary.exercise(id: exerciseId) }
}

struct WorkoutDay: Codable, Identifiable, Hashable {
    var id = UUID()
    var name: String
    var focus: String
    var exercises: [ExercisePrescription]
    var totalSets: Int { exercises.reduce(0) { $0 + $1.sets } }
}

struct MesoWeek: Codable, Hashable, Identifiable {
    var id: Int { number }
    var number: Int
    var rir: String
    var volumeNote: String
}

struct CardioPlan: Codable, Hashable {
    var zone2SessionsPerWeek: Int
    var zone2Minutes: Int
    var intervalSessionsPerWeek: Int
    var dailySteps: Int
    var zone2HeartRate: ClosedRange<Int>
    var intervalHeartRate: ClosedRange<Int>
    var intervalDescription: String
}

struct TrainingProgram: Codable, Hashable {
    var createdAt: Date
    var locationId: UUID
    var locationName: String
    var title: String
    var summary: String
    var days: [WorkoutDay]
    var weeklySets: [String: Double]
    var targetSets: [String: Double]
    var mesocycle: [MesoWeek]
    var cardio: CardioPlan
    var warmup: [String]
    var focusNotes: [String]
    /// Holdningsrutine (valgfri for eldre lagrede program).
    var postureRoutine: [PostureDrill]? = nil
}

// MARK: - Generator

enum ProgramGenerator {

    private struct Slot {
        var pattern: MovementPattern
        var preferPrimary: Muscle? = nil
    }

    private struct DayTemplate {
        var name: String
        var focus: String
        var slots: [Slot]
    }

    static func generate(profile: ProfileData, analysis: BodyAnalysis, postureRoutine: [PostureDrill] = [], now: Date = Date()) -> TrainingProgram {
        let templates = split(for: profile.daysPerWeek)
        let fullTarget = weeklyTargets(profile: profile, analysis: analysis)
        let maxSetsPerSession = max(10, Int(Double(profile.sessionMinutes - 8) / 2.8))
        // Får ikke alt plass i ukas økter? Skaler målene ned jevnt, så ingen muskel blir glemt.
        var target = fullTarget
        let budget = Double(maxSetsPerSession * templates.count)
        let estimate = fullTarget.values.reduce(0, +) * 0.8
        if estimate > budget {
            let f = max(0.5, budget / estimate)
            target = fullTarget.mapValues { max(2, ($0 * f).rounded()) }
        }

        // 1) Velg øvelser
        var occurrences: [MovementPattern: Int] = [:]
        var days: [WorkoutDay] = templates.map { template in
            var used = Set<String>()
            let exercises: [ExercisePrescription] = template.slots.compactMap { slot in
                let occ = occurrences[slot.pattern, default: 0]
                occurrences[slot.pattern] = occ + 1
                guard let ex = pick(slot.pattern, prefer: slot.preferPrimary, profile: profile, analysis: analysis, occurrence: occ, exclude: used) else { return nil }
                used.insert(ex.id)
                return prescription(for: ex, sets: 2, profile: profile, analysis: analysis)
            }
            return WorkoutDay(name: template.name, focus: template.focus, exercises: exercises)
        }

        // 2) Juster sett mot ukentlig målvolum (fraksjonell telling: primær 1, sekundær 0,5 — Pelland 2024)
        for _ in 0..<200 {
            let volume = weeklyVolume(days)
            let deficits = Muscle.allCases
                .map { ($0, (target[$0, default: 0] - volume[$0, default: 0]) / max(target[$0, default: 1], 1)) }
                .filter { $0.1 > 0.08 }
                .sorted { $0.1 > $1.1 }
            var progressed = false
            for (muscle, _) in deficits {
                // Legg et sett på øvelsen som trener muskelen primært, på dagen med færrest sett
                let candidates = days.indices.flatMap { d in
                    days[d].exercises.indices.compactMap { e -> (Int, Int)? in
                        let p = days[d].exercises[e]
                        let maxSets = p.exercise?.pattern.isCompound == true ? 5 : 4
                        guard p.exercise?.primary == muscle, p.sets < maxSets, days[d].totalSets < maxSetsPerSession else { return nil }
                        return (d, e)
                    }
                }.sorted { days[$0.0].totalSets < days[$1.0].totalSets }
                if let c = candidates.first {
                    days[c.0].exercises[c.1].sets += 1
                    progressed = true
                    break
                }
                // Ingen plass? Legg til en isolasjonsøvelse for muskelen på en dag som trener samme kroppsdel.
                let open = days.indices.filter { days[$0].totalSets + 2 <= maxSetsPerSession }
                let region = bodyRegion(of: muscle)
                let matching = open.filter { d in
                    region == nil || days[d].exercises.contains { $0.exercise.map { bodyRegion(of: $0.primary) == region } ?? false }
                }
                // Små muskler (sidehev, armer, legger) kan legges på "feil" dag — store muskler ikke.
                let smallMuscles: Set<Muscle> = [.sideDelts, .biceps, .triceps, .calves, .abs, .upperBack]
                let dayChoices = matching.isEmpty && smallMuscles.contains(muscle) ? open : matching
                if let d = dayChoices.min(by: { days[$0].totalSets < days[$1].totalSets }),
                   let pattern = isolationPattern(for: muscle),
                   let ex = pick(pattern, prefer: muscle, profile: profile, analysis: analysis, occurrence: 1,
                                 exclude: Set(days[d].exercises.map(\.exerciseId))),
                   ex.primary == muscle {
                    days[d].exercises.append(prescription(for: ex, sets: 2, profile: profile, analysis: analysis))
                    progressed = true
                    break
                }
            }
            if !progressed { break }
        }

        // 3) Trim overskudd (> 30 % over mål)
        let volume = weeklyVolume(days)
        for muscle in Muscle.allCases where volume[muscle, default: 0] > target[muscle, default: 0] * 1.3 {
            for d in days.indices {
                for e in days[d].exercises.indices where days[d].exercises[e].exercise?.primary == muscle && days[d].exercises[e].sets > 2 {
                    days[d].exercises[e].sets -= 1
                }
            }
        }

        // Basisløft først, isolasjon til slutt
        for d in days.indices {
            days[d].exercises.sort { ($0.exercise?.pattern.isCompound ?? false) && !($1.exercise?.pattern.isCompound ?? false) }
        }

        let finalVolume = weeklyVolume(days)
        var notes = focusNotes(profile: profile, analysis: analysis)
        if profile.physique != .balanced {
            notes.append("Kroppsform-mål: \(profile.physique.label). Volumet er vektet mot musklene som former dette.")
        }
        if !days.flatMap(\.exercises).contains(where: { $0.exercise?.pattern == .verticalPull }) {
            notes.append("PT-tips: En pull-up-stang i døra (ca. 300–500 kr) gir deg pull-ups og chin-ups — den beste øvelsen for rygg-bredde. Legg den til under Utstyr når du har den.")
        }
        let coverage = Muscle.allCases.map { min(1, finalVolume[$0, default: 0] / max(fullTarget[$0, default: 1], 1)) }.reduce(0, +) / Double(Muscle.allCases.count)
        if coverage < 0.8 {
            notes.append("Med \(profile.daysPerWeek) økter à \(profile.sessionMinutes) min når vi bare ~\(Int(coverage * 100)) % av ideelt ukevolum. En ekstra økt eller lengre økter gir raskere fremgang — men dette programmet virker også.")
        }
        return TrainingProgram(
            createdAt: now,
            locationId: profile.location.id,
            locationName: profile.location.name,
            title: title(profile: profile),
            summary: summary(profile: profile, analysis: analysis),
            days: days,
            weeklySets: Dictionary(uniqueKeysWithValues: finalVolume.map { ($0.key.rawValue, $0.value) }),
            targetSets: Dictionary(uniqueKeysWithValues: fullTarget.map { ($0.key.rawValue, $0.value) }),
            mesocycle: mesocycle(for: profile.experience),
            cardio: cardioPlan(profile: profile, analysis: analysis),
            warmup: warmup(analysis: analysis),
            focusNotes: notes,
            postureRoutine: postureRoutine.isEmpty ? nil : postureRoutine)
    }

    // MARK: Volum

    /// Harde sett per muskel per uke. 10–20 er "sweet spot" for de fleste (Schoenfeld 2017, Pelland 2024).
    static func weeklyTargets(profile: ProfileData, analysis: BodyAnalysis) -> [Muscle: Double] {
        let base: Double = switch profile.experience {
        case .beginner: 9
        case .intermediate: 12
        case .advanced: 15
        }
        let goalFactor: Double = switch profile.goal {
        case .buildMuscle: 1.0
        case .recomposition: 0.95
        case .loseFat: 0.85
        case .strength: 0.85
        case .health: 0.75
        }
        var result: [Muscle: Double] = [:]
        for m in Muscle.allCases {
            let muscleFactor: Double = switch m {
            case .calves, .abs: 0.6
            case .upperBack: 0.8
            case .biceps, .triceps: 0.7 // får mye indirekte volum fra press og drag
            default: 1.0
            }
            let priority = analysis.priorities[m, default: 1]
            result[m] = min(22, (base * goalFactor * muscleFactor * priority).rounded())
        }
        return result
    }

    static func weeklyVolume(_ days: [WorkoutDay]) -> [Muscle: Double] {
        var v: [Muscle: Double] = [:]
        for day in days {
            for p in day.exercises {
                guard let ex = p.exercise else { continue }
                v[ex.primary, default: 0] += Double(p.sets)
                for s in ex.secondary { v[s, default: 0] += Double(p.sets) * 0.5 }
            }
        }
        return v
    }

    // MARK: Splitt

    private static func split(for days: Int) -> [DayTemplate] {
        let fbA = DayTemplate(name: "Helkropp A", focus: "Knebøy · press · roing", slots: [
            Slot(pattern: .squat), Slot(pattern: .horizontalPush), Slot(pattern: .horizontalPull),
            Slot(pattern: .kneeFlexion), Slot(pattern: .lateralRaise), Slot(pattern: .elbowFlexion), Slot(pattern: .core)])
        let fbB = DayTemplate(name: "Helkropp B", focus: "Hengsel · skulderpress · nedtrekk", slots: [
            Slot(pattern: .hinge), Slot(pattern: .verticalPull), Slot(pattern: .verticalPush),
            Slot(pattern: .singleLeg), Slot(pattern: .chestFly), Slot(pattern: .elbowExtension), Slot(pattern: .calfRaise)])
        let fbC = DayTemplate(name: "Helkropp C", focus: "Ettbeins · skråbenk · rygg", slots: [
            Slot(pattern: .singleLeg), Slot(pattern: .horizontalPush), Slot(pattern: .verticalPull),
            Slot(pattern: .hinge, preferPrimary: .glutes), Slot(pattern: .rearDelt), Slot(pattern: .elbowExtension), Slot(pattern: .core)])
        let upperA = DayTemplate(name: "Overkropp A", focus: "Bryst & rygg", slots: [
            Slot(pattern: .horizontalPush), Slot(pattern: .verticalPull), Slot(pattern: .verticalPush),
            Slot(pattern: .horizontalPull), Slot(pattern: .lateralRaise), Slot(pattern: .elbowFlexion), Slot(pattern: .elbowExtension)])
        let upperB = DayTemplate(name: "Overkropp B", focus: "Rygg & skuldre", slots: [
            Slot(pattern: .verticalPull), Slot(pattern: .horizontalPush), Slot(pattern: .horizontalPull),
            Slot(pattern: .chestFly), Slot(pattern: .lateralRaise), Slot(pattern: .rearDelt), Slot(pattern: .elbowExtension), Slot(pattern: .elbowFlexion)])
        let lowerA = DayTemplate(name: "Underkropp A", focus: "Knebøy-fokus", slots: [
            Slot(pattern: .squat), Slot(pattern: .hinge), Slot(pattern: .kneeFlexion),
            Slot(pattern: .kneeExtension), Slot(pattern: .calfRaise), Slot(pattern: .core)])
        let lowerB = DayTemplate(name: "Underkropp B", focus: "Hofte-fokus", slots: [
            Slot(pattern: .hinge, preferPrimary: .glutes), Slot(pattern: .singleLeg), Slot(pattern: .kneeFlexion),
            Slot(pattern: .kneeExtension), Slot(pattern: .calfRaise), Slot(pattern: .carry)])
        let push = DayTemplate(name: "Press", focus: "Bryst · skuldre · triceps", slots: [
            Slot(pattern: .horizontalPush), Slot(pattern: .verticalPush), Slot(pattern: .chestFly),
            Slot(pattern: .lateralRaise), Slot(pattern: .elbowExtension)])
        let pull = DayTemplate(name: "Drag", focus: "Rygg · bakre skulder · biceps", slots: [
            Slot(pattern: .verticalPull), Slot(pattern: .horizontalPull), Slot(pattern: .rearDelt),
            Slot(pattern: .elbowFlexion), Slot(pattern: .core)])
        let legs = DayTemplate(name: "Bein", focus: "Lår · sete · legger", slots: [
            Slot(pattern: .squat), Slot(pattern: .hinge), Slot(pattern: .singleLeg),
            Slot(pattern: .kneeFlexion), Slot(pattern: .calfRaise)])

        switch days {
        case ...2: return [fbA, fbB]
        case 3: return [fbA, fbB, fbC]
        case 4: return [upperA, lowerA, upperB, lowerB]
        case 5: return [upperA, lowerA, push, pull, legs]
        default:
            return [push, pull, legs,
                    DayTemplate(name: "Press 2", focus: push.focus, slots: push.slots),
                    DayTemplate(name: "Drag 2", focus: pull.focus, slots: pull.slots),
                    DayTemplate(name: "Bein 2", focus: legs.focus, slots: legs.slots)]
        }
    }

    /// 0 = overkropp, 1 = underkropp, nil = kjerne (passer overalt).
    private static func bodyRegion(of muscle: Muscle) -> Int? {
        switch muscle {
        case .quads, .hamstrings, .glutes, .calves: 1
        case .abs: nil
        default: 0
        }
    }

    private static func isolationPattern(for muscle: Muscle) -> MovementPattern? {
        switch muscle {
        case .chest: .chestFly
        case .lats: .verticalPull
        case .upperBack: .rearDelt
        case .sideDelts: .lateralRaise
        case .biceps: .elbowFlexion
        case .triceps: .elbowExtension
        case .quads: .kneeExtension
        case .hamstrings: .kneeFlexion
        case .glutes: .hinge
        case .calves: .calfRaise
        case .abs: .core
        }
    }

    private static func pick(_ pattern: MovementPattern, prefer: Muscle?, profile: ProfileData, analysis: BodyAnalysis,
                             occurrence: Int, exclude: Set<String>) -> Exercise? {
        let targetMuscle = prefer ?? ExerciseLibrary.all.first { $0.pattern == pattern }?.primary
        var wantsUnilateral = targetMuscle.map { analysis.unilateralFocus[$0] != nil } ?? false
        if pattern == .carry || (pattern == .core && !analysis.postureFlags.isDisjoint(with: [.shoulderTilt, .hipTilt])) {
            wantsUnilateral = true
        }
        // Med lette vekter: ettbeins-/ettarmsvarianter dobler den relative belastningen.
        if lightLoadsOnly(profile) && ([.squat, .hinge, .singleLeg, .horizontalPush] as [MovementPattern]).contains(pattern) {
            wantsUnilateral = true
        }
        return ExerciseLibrary.select(pattern: pattern, available: profile.location.equipment, limitations: profile.limitations,
                                      preferPrimary: prefer, preferUnilateral: wantsUnilateral,
                                      occurrence: occurrence, exclude: exclude)
    }

    /// Ingen stang/maskiner og manualer under ~30 % av kroppsvekten.
    static func lightLoadsOnly(_ profile: ProfileData) -> Bool {
        let loc = profile.location
        if loc.equipment.contains(where: \.isHeavyEquipment) { return false }
        let heaviest = max(loc.maxDumbbell ?? 0, loc.equipment.contains(.kettlebell) ? (loc.kettlebellWeights.max() ?? 0) : 0)
        return heaviest < profile.weightKg * 0.3
    }

    // MARK: Reps, RIR, pause

    static func prescription(for ex: Exercise, sets: Int, profile: ProfileData, analysis: BodyAnalysis) -> ExercisePrescription {
        let compound = ex.pattern.isCompound
        var lo = 8, hi = 12
        switch (profile.goal, compound) {
        case (.strength, true): (lo, hi) = (3, 6)
        case (.strength, false): (lo, hi) = (8, 12)
        case (_, true): (lo, hi) = profile.experience == .beginner ? (8, 12) : (6, 10)
        case (_, false): (lo, hi) = (10, 15)
        }
        if ex.pattern == .lateralRaise || ex.pattern == .rearDelt || ex.pattern == .calfRaise { (lo, hi) = (12, 20) }
        if ex.pattern == .carry { (lo, hi) = (30, 45) } // sekunder per side
        if ex.pattern == .core { (lo, hi) = (8, 15) }

        var rir: Int = switch profile.experience {
        case .beginner: compound ? 3 : 2
        case .intermediate: compound ? 2 : 1
        case .advanced: compound ? 1 : 0
        }
        // Lette vekter bygger like mye muskler som tunge når settene tas nær failure (Schoenfeld 2017, Lasevicius 2018).
        let light = ex.tier < 2 && lightLoadsOnly(profile) && ex.pattern != .core && ex.pattern != .carry
            && ex.requires.isDisjoint(with: [.pullUpBar, .dipBars]) // kroppsvekt-drag er allerede tungt
        if light {
            (lo, hi) = compound ? (12, 20) : (15, 25)
            rir = max(0, rir - 1)
        }
        // Lengre pauser gir mer vekst og styrke (Schoenfeld 2016; Singer 2024)
        let rest = compound ? (profile.goal == .strength ? 180 : 150) : 90

        var notes: [String] = []
        if let side = analysis.unilateralFocus[ex.primary], ex.unilateral {
            notes.append("Start med \(side.label) side. Ta like mange reps på sterk side.")
        }
        if ex.lengthenedBias && !compound && profile.experience != .beginner {
            notes.append("Siste sett: fortsett med delvise reps i strukket posisjon etter failure.")
        }
        if ex.pattern == .carry { notes.append("Sekunder per side.") }
        if light { notes.append("Lette vekter: flere reps og helt nær failure gir samme effekt. Bruk 3–4 sek nedfase.") }
        return ExercisePrescription(exerciseId: ex.id, sets: sets, repsMin: lo, repsMax: hi, rir: rir, restSeconds: rest,
                                    note: notes.isEmpty ? nil : notes.joined(separator: " "))
    }

    // MARK: Periodisering

    static func mesocycle(for experience: Experience) -> [MesoWeek] {
        if experience == .beginner {
            return [
                MesoWeek(number: 1, rir: "3", volumeNote: "Lær teknikken. Finn arbeidsvektene."),
                MesoWeek(number: 2, rir: "2–3", volumeNote: "Øk vekt eller reps fra forrige uke."),
                MesoWeek(number: 3, rir: "2", volumeNote: "Fortsett progresjonen."),
                MesoWeek(number: 4, rir: "2", volumeNote: "Fortsett progresjonen."),
                MesoWeek(number: 5, rir: "1–2", volumeNote: "Push litt hardere på siste sett."),
                MesoWeek(number: 6, rir: "4", volumeNote: "Lett uke: halvparten av settene, samme vekter."),
            ]
        }
        return [
            MesoWeek(number: 1, rir: "3", volumeNote: "Startvolum. Alle sett skal føles kontrollerte."),
            MesoWeek(number: 2, rir: "2", volumeNote: "+1 sett på prioriterte muskler hvis restitusjonen er god."),
            MesoWeek(number: 3, rir: "1–2", volumeNote: "Øk vekt/reps. Hold teknikken ren."),
            MesoWeek(number: 4, rir: "0–1", volumeNote: "Topp-uke: isolasjon til failure, basis 1 rep unna."),
            MesoWeek(number: 5, rir: "4+", volumeNote: "Deload: ~50 % av settene. Restituer, så start ny syklus."),
        ]
    }

    // MARK: Kondisjon

    static func cardioPlan(profile: ProfileData, analysis: BodyAnalysis) -> CardioPlan {
        let hrMax = BodyComposition.maxHeartRate(age: profile.age)
        let z2 = Int(Double(hrMax) * 0.60)...Int(Double(hrMax) * 0.70)
        let hi = Int(Double(hrMax) * 0.85)...Int(Double(hrMax) * 0.95)
        let (sessions, minutes, intervals, steps): (Int, Int, Int, Int) = switch (profile.goal, analysis.cardioEmphasis) {
        case (.loseFat, _), (_, 2): (3, 40, 1, 10_000)
        case (.health, _): (2, 45, 1, 9_000)
        case (.strength, _): (2, 30, 0, 8_000)
        default: (2, 30, 1, 8_000)
        }
        return CardioPlan(
            zone2SessionsPerWeek: sessions, zone2Minutes: minutes,
            intervalSessionsPerWeek: intervals, dailySteps: steps,
            zone2HeartRate: z2, intervalHeartRate: hi,
            intervalDescription: "4×4 \(cardioModality(profile.location)): 10 min oppvarming, 4 × 4 min på 85–95 % av makspuls med 3 min rolig mellom. Norsk metode (Helgerud/NTNU) — en av de mest effektive måtene å øke VO₂maks på.")
    }

    private static func cardioModality(_ location: TrainingLocation) -> String {
        if location.equipment.contains(.treadmill) { return "på tredemølle med 5–8 % stigning" }
        if location.equipment.contains(.rower) { return "på romaskin" }
        if location.equipment.contains(.bike) { return "på sykkel" }
        if location.equipment.contains(.kettlebell) { return "som bakkeløp ute eller kettlebell swings" }
        return "som bakkeløp, rask gange i motbakke eller trappeløp"
    }

    // MARK: Tekst

    private static func warmup(analysis: BodyAnalysis) -> [String] {
        var w = [
            "5 min lett kondisjon (sykkel, rask gange, roing).",
            "2 oppvarmingssett på første øvelse: ~50 % × 8 og ~75 % × 3.",
        ]
        if analysis.postureFlags.contains(.forwardHead) {
            w.append("Chin tucks 2 × 10 med 3 sek hold + wall slides 2 × 10.")
        }
        if !analysis.postureFlags.isDisjoint(with: [.shoulderTilt, .hipTilt]) {
            w.append("Sideplanke 2 × 30 sek per side — start med svakeste side.")
        }
        return w
    }

    private static func title(profile: ProfileData) -> String {
        "\(profile.goal.label) · \(profile.daysPerWeek) dager/uke"
    }

    private static func summary(profile: ProfileData, analysis: BodyAnalysis) -> String {
        let prioritized = analysis.priorities.filter { $0.value > 1.05 }.sorted { $0.value > $1.value }.prefix(3).map { $0.key.label.lowercased() }
        var s = "Laget for \(profile.experience.label.lowercased()) · \(profile.location.name) (\(profile.location.summary.lowercased()))."
        if !prioritized.isEmpty { s += " Ekstra fokus: \(prioritized.joined(separator: ", "))." }
        if !analysis.unilateralFocus.isEmpty { s += " Ettsidige øvelser for å rette opp ubalanser." }
        return s
    }

    private static func focusNotes(profile: ProfileData, analysis: BodyAnalysis) -> [String] {
        var n = [
            "Progresjon: når du klarer toppen av rep-intervallet i alle sett — øk vekten 2,5–5 % neste økt.",
            "Tren nær failure: de siste 1–3 repsene skal være tunge. Sett langt unna failure gir lite.",
            "Kontroller nedfasen (2–3 sek) og gå gjennom hele bevegelsesbanen — særlig i strukket posisjon.",
        ]
        if profile.goal == .loseFat || analysis.cardioEmphasis == 2 {
            n.append("I underskudd: hold vektene oppe. Styrketrening er det som forteller kroppen at musklene skal beholdes.")
        }
        if profile.goal == .strength {
            n.append("Basisløftene trenes tungt (3–6 reps) med lange pauser. Isolasjon bygger muskelen som løfter vekten.")
        }
        if !profile.limitations.isEmpty {
            n.append("Øvelser som ofte provoserer \(profile.limitations.map { $0.label.lowercased() }.sorted().joined(separator: "/")) er byttet ut. Smerte opp til 3/10 som roer seg innen et døgn er normalt OK.")
        }
        return n
    }
}
