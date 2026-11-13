import Foundation

struct NutritionTargets: Equatable {
    var maintenanceKcal: Int
    var targetKcal: Int
    var proteinG: Int
    var fatG: Int
    var carbsG: Int
    var fiberG: Int
    var waterLiters: Double
    var weeklyChangeNote: String
    var supplements: [String]
}

enum NutritionCalculator {

    static func targets(profile: ProfileData, bodyFatPercent: Double?) -> NutritionTargets {
        let w = profile.weightKg
        // Hvilestoffskifte: Katch-McArdle hvis fettprosent er kjent, ellers Mifflin-St Jeor.
        let bmr: Double
        if let bf = bodyFatPercent {
            bmr = 370 + 21.6 * BodyComposition.leanMass(weightKg: w, bodyFatPercent: bf)
        } else {
            bmr = 10 * w + 6.25 * profile.heightCm - 5 * Double(profile.age) + (profile.sex == .male ? 5 : -161)
        }
        let activity = min(1.725, 1.3 + 0.06 * Double(profile.daysPerWeek))
        let maintenance = bmr * activity

        let (factor, note): (Double, String) = switch profile.goal {
        case .loseFat: (0.80, "Mål: −0,5 til −1 % av kroppsvekten per uke.")
        case .buildMuscle: (profile.experience == .beginner ? 1.10 : 1.06,
                            "Mål: +0,25–0,5 % av kroppsvekten per måned (nybegynnere kan gå litt raskere).")
        case .recomposition: (0.95, "Vekten står omtrent stille, midjen går ned og styrken opp.")
        case .strength: (1.05, "Lite overskudd gir best styrkeutvikling.")
        case .health: (1.0, "Hold vekten stabil, fokuser på kvalitet og protein.")
        }
        let target = maintenance * factor

        // Protein: 1,6 g/kg dekker ~95 % av effekten (Morton 2018); høyere i underskudd for å bevare muskelmasse.
        let proteinPerKg: Double = switch profile.goal {
        case .loseFat: 2.2
        case .recomposition: 2.0
        case .buildMuscle, .strength: 1.8
        case .health: 1.6
        }
        let protein = proteinPerKg * w
        let fat = max(0.7 * w, target * 0.25 / 9)
        let carbs = max(0, (target - protein * 4 - fat * 9) / 4)

        return NutritionTargets(
            maintenanceKcal: Int(maintenance.rounded()),
            targetKcal: Int(target.rounded()),
            proteinG: Int(protein.rounded()),
            fatG: Int(fat.rounded()),
            carbsG: Int(carbs.rounded()),
            fiberG: Int((target / 1000 * 14).rounded()),
            waterLiters: (w * 0.035 * 10).rounded() / 10,
            weeklyChangeNote: note,
            supplements: [
                "Kreatin monohydrat 3–5 g daglig — best dokumenterte tilskudd for styrke og muskelmasse, og lovende for hjernehelse.",
                "Vitamin D 1000–2000 IE i vinterhalvåret (oktober–april i Norge).",
                "Koffein 3 mg/kg 30–60 min før trening kan gi bedre prestasjon — ikke etter kl. 14 av hensyn til søvnen.",
                "Proteinpulver er mat, ikke magi — bare praktisk hvis du ikke når proteinmålet.",
            ])
    }
}
