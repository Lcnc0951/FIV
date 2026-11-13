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

enum Equipment: String, Codable, CaseIterable, Identifiable {
    case bodyweight, homeDumbbells, fullGym
    var id: String { rawValue }
    var rank: Int {
        switch self {
        case .bodyweight: 0
        case .homeDumbbells: 1
        case .fullGym: 2
        }
    }
    var label: String {
        switch self {
        case .bodyweight: "Kroppsvekt (+ stang for pull-ups)"
        case .homeDumbbells: "Hjemme: manualer, benk, strikk"
        case .fullGym: "Treningssenter"
        }
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
    var equipment: Equipment
    var limitations: Set<Limitation>
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
