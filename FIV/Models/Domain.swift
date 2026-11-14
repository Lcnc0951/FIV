import Foundation

// MARK: - Grunnleggende typer

enum Sex: String, Codable, CaseIterable, Identifiable {
    case male, female
    var id: String { rawValue }
    var label: String { self == .male ? "Mann" : "Kvinne" }
}

enum Goal: String, Codable, CaseIterable, Identifiable {
    case buildMuscle, loseFat, recomposition, strength, health
    var id: String { rawValue }

    var label: String {
        switch self {
        case .buildMuscle: "Bygge muskler"
        case .loseFat: "Gå ned i fett"
        case .recomposition: "Rekomponering"
        case .strength: "Bli sterkere"
        case .health: "Helse & levealder"
        }
    }

    var detail: String {
        switch self {
        case .buildMuscle: "Maksimal muskelvekst med lite kalorioverskudd."
        case .loseFat: "Miste fett og beholde muskler med moderat underskudd."
        case .recomposition: "Bygge muskler og miste fett samtidig, rundt vedlikeholdskalorier."
        case .strength: "Øke maksstyrken i basisløftene."
        case .health: "Kondisjon, styrke og mobilitet for et langt, sterkt liv."
        }
    }
}

enum Experience: String, Codable, CaseIterable, Identifiable {
    case beginner, intermediate, advanced
    var id: String { rawValue }
    var label: String {
        switch self {
        case .beginner: "Nybegynner (< 1 år)"
        case .intermediate: "Viderekommen (1–3 år)"
        case .advanced: "Erfaren (3+ år)"
        }
    }
}

enum EquipmentCategory: String, CaseIterable, Identifiable {
    case freeWeights = "Frivekter"
    case racksBenches = "Stativ, benk & stenger"
    case machines = "Maskiner & kabler"
    case bodyweight = "Kroppsvekt-utstyr"
    case cardio = "Kondisjon"
    var id: String { rawValue }
}

/// Konkrete apparater og vekter brukeren har tilgang til.
enum EquipmentItem: String, Codable, CaseIterable, Identifiable {
    case dumbbells, kettlebell, barbell
    case squatRack, bench
    case cableMachine, latPulldown, legPressMachine, legCurlMachine, legExtensionMachine
    case pullUpBar, dipBars, resistanceBands, trxRings
    case treadmill, bike, rower

    var id: String { rawValue }

    var label: String {
        switch self {
        case .dumbbells: "Manualer"
        case .kettlebell: "Kettlebell"
        case .barbell: "Vektstang med skiver"
        case .squatRack: "Knebøystativ / rack"
        case .bench: "Justerbar benk"
        case .cableMachine: "Kabelmaskin / kryss"
        case .latPulldown: "Nedtrekksapparat"
        case .legPressMachine: "Beinpress / hack squat"
        case .legCurlMachine: "Lårcurl-maskin"
        case .legExtensionMachine: "Beinspark-maskin"
        case .pullUpBar: "Pull-up-stang"
        case .dipBars: "Dips-stativ"
        case .resistanceBands: "Treningsstrikker"
        case .trxRings: "TRX / ringer"
        case .treadmill: "Tredemølle"
        case .bike: "Spinning / ergometersykkel"
        case .rower: "Romaskin"
        }
    }

    var symbol: String {
        switch self {
        case .dumbbells, .kettlebell, .barbell: "dumbbell.fill"
        case .squatRack, .bench: "square.split.bottomrightquarter"
        case .cableMachine, .latPulldown, .legPressMachine, .legCurlMachine, .legExtensionMachine: "gearshape.2.fill"
        case .pullUpBar, .dipBars, .trxRings: "figure.climbing"
        case .resistanceBands: "lasso"
        case .treadmill: "figure.run"
        case .bike: "figure.indoor.cycle"
        case .rower: "figure.rower"
        }
    }

    var category: EquipmentCategory {
        switch self {
        case .dumbbells, .kettlebell, .barbell: .freeWeights
        case .squatRack, .bench: .racksBenches
        case .cableMachine, .latPulldown, .legPressMachine, .legCurlMachine, .legExtensionMachine: .machines
        case .pullUpBar, .dipBars, .resistanceBands, .trxRings: .bodyweight
        case .treadmill, .bike, .rower: .cardio
        }
    }

    /// Utstyr som gir enkel, finjustert progresjon (maskiner/stang).
    var isHeavyEquipment: Bool {
        switch self {
        case .barbell, .squatRack, .cableMachine, .latPulldown, .legPressMachine, .legCurlMachine, .legExtensionMachine: true
        default: false
        }
    }
}

/// Et sted du trener (hjemme, senteret, hytta …) med utstyret og vektene som finnes der.
struct TrainingLocation: Codable, Identifiable, Hashable {
    enum Kind: String, Codable, CaseIterable {
        case home, gym, other
        var label: String { self == .home ? "Hjemme" : self == .gym ? "Treningssenter" : "Annet" }
        var symbol: String { self == .home ? "house.fill" : self == .gym ? "building.2.fill" : "mappin.circle.fill" }
    }

    var id = UUID()
    var name: String
    var kind: Kind
    var equipment: Set<EquipmentItem>
    /// Tilgjengelige manualvekter (kg per manual).
    var dumbbellWeights: [Double] = []
    var kettlebellWeights: [Double] = []
    var barbellMaxKg: Double? = nil

    var maxDumbbell: Double? { equipment.contains(.dumbbells) ? dumbbellWeights.max() : nil }

    var summary: String {
        if equipment.isEmpty { return "Kun kroppsvekt" }
        var parts: [String] = []
        if let max = maxDumbbell, let min = dumbbellWeights.min() {
            parts.append("manualer \(min.kgText)–\(max.kgText)")
        }
        let others = equipment.filter { $0 != .dumbbells && $0.category != .cardio }
        if !others.isEmpty { parts.append("\(others.count) andre apparater") }
        return parts.joined(separator: ", ")
    }

    static let defaultId = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!

    static func gym(id: UUID = UUID()) -> TrainingLocation {
        TrainingLocation(id: id, name: "Treningssenter", kind: .gym, equipment: Set(EquipmentItem.allCases),
                         dumbbellWeights: stride(from: 2.0, through: 50, by: 2).map { $0 },
                         kettlebellWeights: [8, 12, 16, 20, 24, 28, 32], barbellMaxKg: 200)
    }

    static func homeGym() -> TrainingLocation {
        TrainingLocation(name: "Hjemmegym", kind: .home,
                         equipment: [.barbell, .squatRack, .bench, .dumbbells, .pullUpBar, .resistanceBands],
                         dumbbellWeights: stride(from: 2.5, through: 24, by: 2.5).map { $0 }, barbellMaxKg: 120)
    }

    static func homeDumbbells() -> TrainingLocation {
        TrainingLocation(name: "Hjemme", kind: .home, equipment: [.dumbbells, .bench, .resistanceBands],
                         dumbbellWeights: [2, 4, 6, 8, 10, 12.5, 15, 17.5, 20])
    }

    static func bodyweight() -> TrainingLocation {
        TrainingLocation(name: "Hjemme (uten utstyr)", kind: .home, equipment: [])
    }
}

extension Double {
    var kgText: String {
        truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(self)) kg" : String(format: "%.1f kg", self)
    }
}

enum Limitation: String, Codable, CaseIterable, Identifiable {
    case knee, lowerBack, shoulder
    var id: String { rawValue }
    var label: String {
        switch self {
        case .knee: "Kne"
        case .lowerBack: "Korsrygg"
        case .shoulder: "Skulder"
        }
    }
}

enum Muscle: String, Codable, CaseIterable, Identifiable {
    case chest, lats, upperBack, sideDelts, biceps, triceps, quads, hamstrings, glutes, calves, abs
    var id: String { rawValue }
    var label: String {
        switch self {
        case .chest: "Bryst"
        case .lats: "Latissimus (rygg-bredde)"
        case .upperBack: "Øvre rygg & bakre skulder"
        case .sideDelts: "Sidre skulder"
        case .biceps: "Biceps"
        case .triceps: "Triceps"
        case .quads: "Forside lår"
        case .hamstrings: "Bakside lår"
        case .glutes: "Sete"
        case .calves: "Legger"
        case .abs: "Kjerne"
        }
    }
}

enum BodySide: String, Codable {
    case left, right
    var label: String { self == .left ? "venstre" : "høyre" }
}

// MARK: - Profil (ren verdi-type som brukes av PT-motoren)

struct ProfileData: Codable, Equatable {
    var sex: Sex
    var age: Int
    var heightCm: Double
    var weightKg: Double
    var goal: Goal
    var experience: Experience
    var daysPerWeek: Int
    var sessionMinutes: Int
    var location: TrainingLocation
    var limitations: Set<Limitation>
    /// Ønsket fettprosent. nil = PT-en velger et sunt mål.
    var targetBodyFat: Double? = nil
    /// Hvordan du ønsker at kroppen skal se ut / fungere.
    var physique: PhysiqueGoal = .balanced
    /// Holdningsområder du vil forbedre (i tillegg til det skannet finner).
    var postureGoals: Set<PostureGoal> = []
}

/// Ønsket kroppsform. Styrer hvilke muskler som prioriteres.
enum PhysiqueGoal: String, Codable, CaseIterable, Identifiable {
    case balanced, vTaper, defined, powerful, lowerBody, functional
    var id: String { rawValue }

    var label: String {
        switch self {
        case .balanced: "Balansert og symmetrisk"
        case .vTaper: "Bred overkropp (V-form)"
        case .defined: "Slank og definert"
        case .powerful: "Kraftig og sterk"
        case .lowerBody: "Sterke bein og sete"
        case .functional: "Funksjonell og atletisk"
        }
    }

    var detail: String {
        switch self {
        case .balanced: "Jevne proporsjoner — ingen muskelgruppe dominerer."
        case .vTaper: "Bredere skuldre og rygg, smal midje."
        case .defined: "Synlige muskler: lav fettprosent og moderat muskelmasse."
        case .powerful: "Mye muskelmasse i store muskelgrupper og tunge basisløft."
        case .lowerBody: "Ekstra fokus på sete, lår og hofter."
        case .functional: "Sterk kjerne, ettsidig styrke og god bevegelighet."
        }
    }

    var symbol: String {
        switch self {
        case .balanced: "figure.stand"
        case .vTaper: "figure.arms.open"
        case .defined: "sparkles"
        case .powerful: "figure.strengthtraining.traditional"
        case .lowerBody: "figure.step.training"
        case .functional: "figure.cross.training"
        }
    }

    /// Ekstra prioritet per muskel for denne kroppsformen.
    var muscleBias: [Muscle: Double] {
        switch self {
        case .balanced: [:]
        case .vTaper: [.lats: 0.35, .sideDelts: 0.4, .upperBack: 0.15, .quads: -0.1, .glutes: -0.1]
        case .defined: [.abs: 0.2, .sideDelts: 0.15]
        case .powerful: [.quads: 0.2, .glutes: 0.2, .hamstrings: 0.15, .chest: 0.15, .upperBack: 0.15]
        case .lowerBody: [.glutes: 0.45, .hamstrings: 0.3, .quads: 0.25, .chest: -0.15, .biceps: -0.15, .triceps: -0.1]
        case .functional: [.abs: 0.35, .upperBack: 0.2, .glutes: 0.15]
        }
    }
}

/// Holdningsmål brukeren kan velge.
enum PostureGoal: String, Codable, CaseIterable, Identifiable {
    case upperBack, neck, shoulders, lowerBack, pelvis, mobility
    var id: String { rawValue }

    var label: String {
        switch self {
        case .upperBack: "Rettere øvre rygg (mindre rundrygg)"
        case .neck: "Mindre fremoverlent hode / nakke"
        case .shoulders: "Mindre fremoverrullede eller skjeve skuldre"
        case .lowerBack: "Sterkere korsrygg"
        case .pelvis: "Bedre bekkenstilling / svairygg"
        case .mobility: "Generell bevegelighet"
        }
    }

    var symbol: String {
        switch self {
        case .upperBack: "figure.stand"
        case .neck: "person.bust"
        case .shoulders: "figure.arms.open"
        case .lowerBack: "figure.core.training"
        case .pelvis: "figure.walk"
        case .mobility: "figure.flexibility"
        }
    }
}

// MARK: - Skanneresultat

/// Alle mål i centimeter / grader. Optional når et mål ikke kunne beregnes sikkert.
struct ScanMeasurements: Codable, Equatable {
    var measuredHeightCm: Double?
    var shoulderWidthCm: Double?
    var neckCm: Double?
    var chestCm: Double?
    var waistCm: Double?
    var hipCm: Double?
    var upperArmLeftCm: Double?
    var upperArmRightCm: Double?
    var thighLeftCm: Double?
    var thighRightCm: Double?
    var armLengthLeftCm: Double?
    var armLengthRightCm: Double?
    var legLengthLeftCm: Double?
    var legLengthRightCm: Double?
    /// Positiv = venstre skulder høyest.
    var shoulderTiltDeg: Double?
    /// Positiv = venstre hofte høyest.
    var hipTiltDeg: Double?
    /// Hodets horisontale avstand foran skulderlinjen.
    var forwardHeadCm: Double?
    /// Skulderleddenes avstand foran øvre del av ryggraden (fremoverrullede skuldre).
    var roundedShouldersCm: Double?
    /// Øvre rygg-vinkel (kyfose-estimat) fra skjelettets ryggradsledd, grader.
    var thoracicAngleDeg: Double?
    var usedLiDAR: Bool = false
    var sampleCount: Int = 0

    var upperArmAverage: Double? { average(upperArmLeftCm, upperArmRightCm) }
    var thighAverage: Double? { average(thighLeftCm, thighRightCm) }

    private func average(_ a: Double?, _ b: Double?) -> Double? {
        switch (a, b) {
        case let (a?, b?): (a + b) / 2
        case let (a?, nil): a
        case let (nil, b?): b
        default: nil
        }
    }
}
