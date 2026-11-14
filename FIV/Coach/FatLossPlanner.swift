import Foundation

/// Fettanalyse og plan for å redusere fett mens musklene beholdes.
struct FatAnalysis: Equatable {
    enum Category: Int, Comparable {
        case essential, athletic, fit, average, high, veryHigh
        static func < (l: Category, r: Category) -> Bool { l.rawValue < r.rawValue }

        var label: String {
            switch self {
            case .essential: "Svært lav"
            case .athletic: "Atletisk"
            case .fit: "Sprek"
            case .average: "Gjennomsnittlig"
            case .high: "Høy"
            case .veryHigh: "Svært høy"
            }
        }
    }

    enum Distribution: Equatable {
        case central, balanced, peripheral, unknown
        var label: String {
            switch self {
            case .central: "Mest rundt magen (bukfett)"
            case .balanced: "Jevnt fordelt"
            case .peripheral: "Mest på hofter og lår"
            case .unknown: "Ukjent — skann for å se fordelingen"
            }
        }
    }

    enum Source: Equatable { case scan, bmiEstimate }

    var bodyFatPercent: Double
    var source: Source
    var fatMassKg: Double
    var leanMassKg: Double
    var category: Category
    /// 0–1 posisjon på skalaen fra svært lav til svært høy (for visning).
    var scalePosition: Double
    var distribution: Distribution
    var waistToHip: Double?
    var waistToHeight: Double?
    var visceralRisk: String
}

struct FatLossMilestone: Identifiable, Equatable {
    var id: Int { week }
    let week: Int
    let weightKg: Double
    let bodyFatPercent: Double
    let waistCm: Double?
}

struct FatLossPlan: Equatable {
    var needed: Bool
    var targetBodyFat: Double
    var fatToLoseKg: Double
    var targetWeightKg: Double
    var weeklyLossKg: Double
    var weeks: Int
    var dailyDeficitKcal: Int
    var targetKcal: Int
    var proteinG: Int
    var dailySteps: Int
    var milestones: [FatLossMilestone]
    var pillars: [(title: String, detail: String, symbol: String)]
    var adjustmentRule: String
    var plateNote: String

    static func == (l: FatLossPlan, r: FatLossPlan) -> Bool {
        l.targetBodyFat == r.targetBodyFat && l.weeks == r.weeks && l.targetKcal == r.targetKcal
    }
}

enum FatLossPlanner {

    /// Fettprosent fra skann (Navy) når det finnes, ellers grovt BMI-anslag (Deurenberg 1991).
    static func analyze(profile: ProfileData, scan: ScanMeasurements?) -> FatAnalysis {
        var bf: Double?
        var source = FatAnalysis.Source.scan
        if let scan, let neck = scan.neckCm, let waist = scan.waistCm {
            bf = BodyComposition.navyBodyFat(sex: profile.sex, heightCm: profile.heightCm, neckCm: neck, waistCm: waist, hipCm: scan.hipCm)
        }
        if bf == nil {
            source = .bmiEstimate
            let bmi = BodyComposition.bmi(weightKg: profile.weightKg, heightCm: profile.heightCm)
            bf = 1.2 * bmi + 0.23 * Double(profile.age) - 10.8 * (profile.sex == .male ? 1 : 0) - 5.4
        }
        let bodyFat = min(60, max(3, bf ?? 20))
        let fatMass = profile.weightKg * bodyFat / 100

        // Kategorier etter American Council on Exercise
        let limits: [Double] = profile.sex == .male ? [6, 14, 18, 25, 32] : [14, 21, 25, 32, 39]
        let category: FatAnalysis.Category = switch bodyFat {
        case ..<limits[0]: .essential
        case ..<limits[1]: .athletic
        case ..<limits[2]: .fit
        case ..<limits[3]: .average
        case ..<limits[4]: .high
        default: .veryHigh
        }
        let scaleMin = limits[0] - 4, scaleMax = limits[4] + 8
        let position = min(1, max(0, (bodyFat - scaleMin) / (scaleMax - scaleMin)))

        // Fettfordeling: midje/hofte (WHO: menn > 0,90, kvinner > 0,85 = abdominal fedme)
        var distribution = FatAnalysis.Distribution.unknown
        var whr: Double?
        var whtr: Double?
        if let waist = scan?.waistCm {
            whtr = waist / profile.heightCm
            if let hip = scan?.hipCm, hip > 0 {
                let ratio = waist / hip
                whr = ratio
                let (centralCut, peripheralCut) = profile.sex == .male ? (0.90, 0.82) : (0.85, 0.75)
                distribution = ratio >= centralCut ? .central : ratio < peripheralCut ? .peripheral : .balanced
            }
        }

        let visceral: String
        if let w = whtr, w >= 0.6 {
            visceral = "Høy risiko for indre organfett (visceralt fett). Dette er fettet som er mest skadelig — og heldigvis det første som forsvinner med trening og underskudd."
        } else if (whtr ?? 0) >= 0.5 || distribution == .central {
            visceral = "Forhøyet. Bukfett er knyttet til insulinresistens, høyt blodtrykk og hjertesykdom. Kondisjon og styrke reduserer visceralt fett effektivt — selv før vekta endrer seg mye."
        } else if whtr != nil {
            visceral = "Lav. Midjen er under halvparten av høyden."
        } else {
            visceral = "Skann kroppen for å vurdere bukfett (midje/høyde)."
        }

        return FatAnalysis(bodyFatPercent: bodyFat, source: source, fatMassKg: fatMass,
                           leanMassKg: profile.weightKg - fatMass, category: category, scalePosition: position,
                           distribution: distribution, waistToHip: whr, waistToHeight: whtr, visceralRisk: visceral)
    }

    /// Sunt, oppnåelig mål: "sprek" kategori.
    static func defaultTarget(sex: Sex, current: Double) -> Double {
        let target = sex == .male ? 15.0 : 23.0
        return current > target ? target : current
    }

    static func plan(profile: ProfileData, analysis fat: FatAnalysis, waistCm: Double?) -> FatLossPlan {
        let target = profile.targetBodyFat ?? defaultTarget(sex: profile.sex, current: fat.bodyFatPercent)
        let lean = fat.leanMassKg
        // Antar at fettfri masse bevares (realistisk med styrketrening + høyt protein)
        let targetWeight = lean / (1 - target / 100)
        let toLose = max(0, profile.weightKg - targetWeight)
        let needed = toLose >= 1

        // 0,5–1 % av kroppsvekt per uke: raskere ved høy fettprosent, roligere når du er slank (Helms 2014, Garthe 2011).
        let rate: Double = switch fat.category {
        case .veryHigh: 0.009
        case .high: 0.0075
        case .average: 0.006
        default: 0.005
        }
        let weekly = profile.weightKg * rate
        // Maks underskudd begrenses av fettmassen (~69 kcal per kg fett per døgn, Alpert 2005).
        let maxDeficit = fat.fatMassKg * 69
        let deficit = min(weekly * 7700 / 7, maxDeficit, 1000)
        let effectiveWeekly = deficit * 7 / 7700
        let weeks = needed ? Int((toLose / effectiveWeekly).rounded(.up)) : 0

        let maintenance = Double(NutritionCalculator.targets(profile: profile, bodyFatPercent: fat.bodyFatPercent).maintenanceKcal)
        let floor = profile.sex == .male ? 1500.0 : 1200.0
        let targetKcal = max(floor, maintenance - (needed ? deficit : 0))

        var milestones: [FatLossMilestone] = []
        if needed {
            var week = 0
            while week <= weeks {
                // Litt langsommere tap over tid (metabolsk tilpasning) — regner 5 % tregere per 12 uker
                let slowdown = 1 - 0.05 * Double(week) / 12
                let lost = min(toLose, effectiveWeekly * Double(week) * slowdown)
                let weight = profile.weightKg - lost
                let bf = (fat.fatMassKg - lost) / weight * 100
                // Tommelfingerregel: ~1 cm midje per kg fett tapt
                milestones.append(FatLossMilestone(week: week, weightKg: weight, bodyFatPercent: bf,
                                                   waistCm: waistCm.map { $0 - lost }))
                week += 4
            }
            if milestones.last?.week != weeks {
                let weight = targetWeight
                milestones.append(FatLossMilestone(week: weeks, weightKg: weight, bodyFatPercent: target,
                                                   waistCm: waistCm.map { $0 - toLose }))
            }
        }

        var pillars: [(String, String, String)] = [
            ("Kaloriunderskudd", needed
                ? "Ca. \(Int(deficit)) kcal under vedlikehold per dag → ~\(String(format: "%.1f", effectiveWeekly)) kg i uka. Det er underskuddet som fjerner fett — trening alene sjelden nok."
                : "Du er allerede på eller under målet. Spis rundt vedlikehold og bygg muskler.", "flame"),
            ("Styrketrening 2–4× i uka", "Forteller kroppen at musklene skal beholdes. Uten styrketrening kan opptil en tredel av vekttapet være muskler.", "dumbbell.fill"),
            ("Protein \(Int(profile.weightKg * 2.2)) g daglig", "2,2 g/kg i underskudd beskytter muskelmassen og holder deg mett lengst.", "fork.knife"),
            ("\((profile.goal == .loseFat || fat.category >= .high) ? 10_000 : 8_000) skritt", "Hverdagsaktivitet forbrenner ofte mer enn selve treningen, og den synker ubevisst når du slanker deg. Tell skrittene.", "figure.walk"),
            ("Kondisjon: sone 2 + 4×4", "Reduserer spesielt bukfett (visceralt fett) og forbedrer insulinfølsomheten, selv uten stort vekttap.", "heart.fill"),
            ("Søvn 7–9 timer", "Med lite søvn kommer en større del av vekttapet fra musklene, og suget øker (Nedeltcheva 2010).", "moon.zzz.fill"),
        ]
        if fat.distribution == .central {
            pillars.append(("Begrens alkohol og sukkerholdig drikke", "Begge bidrar særlig til bukfett, og alkohol hemmer fettforbrenning og restitusjon.", "wineglass"))
        }
        pillars.append(("Du kan ikke punktforbrenne fett", "Situps fjerner ikke magefett, og lårøvelser fjerner ikke lårfett (Vispute 2011). Kroppen bestemmer selv rekkefølgen — men bukfett går ofte først hos menn. Tren hele kroppen.", "exclamationmark.bubble"))

        return FatLossPlan(
            needed: needed, targetBodyFat: target, fatToLoseKg: toLose, targetWeightKg: targetWeight,
            weeklyLossKg: effectiveWeekly, weeks: weeks, dailyDeficitKcal: needed ? Int(deficit) : 0,
            targetKcal: Int(targetKcal.rounded()), proteinG: Int((profile.weightKg * 2.2).rounded()),
            dailySteps: (profile.goal == .loseFat || fat.category >= .high) ? 10_000 : 8_000,
            milestones: milestones,
            pillars: pillars.map { (title: $0.0, detail: $0.1, symbol: $0.2) },
            adjustmentRule: "Vei deg hver morgen og se på ukesnittet. Går snittet ned mindre enn 0,25 % to uker på rad: trekk fra 150–200 kcal eller legg til 2 000 skritt. Går det ned mer enn 1 % i uka: spis litt mer, for å skåne musklene.",
            plateNote: "Tallerkenmodellen: halvparten grønnsaker, en firedel protein (kylling, fisk, egg, skyr, bønner), en firedel fullkorn/poteter. Mettende og lett å følge uten å telle alt.")
    }
}
