import Foundation

/// Validerte formler for kroppssammensetning. Alle mål i cm og kg.
enum BodyComposition {

    /// U.S. Navy-metoden (Hodgdon & Beckett 1984). Typisk feilmargin ±3–4 %-poeng mot DEXA.
    static func navyBodyFat(sex: Sex, heightCm: Double, neckCm: Double, waistCm: Double, hipCm: Double?) -> Double? {
        let value: Double
        switch sex {
        case .male:
            let diff = waistCm - neckCm
            guard diff > 0 else { return nil }
            value = 495 / (1.0324 - 0.19077 * log10(diff) + 0.15456 * log10(heightCm)) - 450
        case .female:
            guard let hip = hipCm else { return nil }
            let diff = waistCm + hip - neckCm
            guard diff > 0 else { return nil }
            value = 495 / (1.29579 - 0.35004 * log10(diff) + 0.22100 * log10(heightCm)) - 450
        }
        guard value.isFinite, (2...60).contains(value) else { return nil }
        return value
    }

    static func leanMass(weightKg: Double, bodyFatPercent: Double) -> Double {
        weightKg * (1 - bodyFatPercent / 100)
    }

    /// Fettfri masseindeks, normalisert til 1,8 m (Kouri 1995). ~25 regnes som naturlig toppnivå for menn.
    static func normalizedFFMI(weightKg: Double, heightCm: Double, bodyFatPercent: Double) -> Double {
        let h = heightCm / 100
        let ffmi = leanMass(weightKg: weightKg, bodyFatPercent: bodyFatPercent) / (h * h)
        return ffmi + 6.1 * (1.8 - h)
    }

    /// Midje/høyde-ratio. ≥ 0,5 er assosiert med økt kardiometabolsk risiko (Ashwell 2012, NICE 2022).
    static func waistToHeight(waistCm: Double, heightCm: Double) -> Double { waistCm / heightCm }

    static func bmi(weightKg: Double, heightCm: Double) -> Double {
        let h = heightCm / 100
        return weightKg / (h * h)
    }

    /// Ellipse-omkrets (Ramanujan) fra bredde (front) og dybde (side).
    static func ellipseCircumference(width: Double, depth: Double) -> Double {
        let a = width / 2, b = depth / 2
        return Double.pi * (3 * (a + b) - ((3 * a + b) * (a + 3 * b)).squareRoot())
    }

    /// Maks puls (Nes et al. 2013, HUNT-studien): 211 − 0,64 × alder.
    static func maxHeartRate(age: Int) -> Int {
        Int((211 - 0.64 * Double(age)).rounded())
    }
}
