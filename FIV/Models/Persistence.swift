import Foundation
import SwiftData

@Model
final class UserProfile {
    var name: String = ""
    var sexRaw: String = Sex.male.rawValue
    var birthYear: Int = 1990
    var heightCm: Double = 180
    var weightKg: Double = 80
    var goalRaw: String = Goal.buildMuscle.rawValue
    var experienceRaw: String = Experience.beginner.rawValue
    var daysPerWeek: Int = 3
    var sessionMinutes: Int = 60
    var locationsData: Data = Data()
    var activeLocationId: String = ""
    /// 0 = automatisk mål.
    var targetBodyFat: Double = 0
    var limitationsRaw: [String] = []
    var physiqueRaw: String = PhysiqueGoal.balanced.rawValue
    var postureGoalsRaw: [String] = []
    var createdAt: Date = Date()

    init() {}

    var sex: Sex {
        get { Sex(rawValue: sexRaw) ?? .male }
        set { sexRaw = newValue.rawValue }
    }
    var goal: Goal {
        get { Goal(rawValue: goalRaw) ?? .buildMuscle }
        set { goalRaw = newValue.rawValue }
    }
    var experience: Experience {
        get { Experience(rawValue: experienceRaw) ?? .beginner }
        set { experienceRaw = newValue.rawValue }
    }
    var locations: [TrainingLocation] {
        get {
            let decoded = (try? JSONDecoder().decode([TrainingLocation].self, from: locationsData)) ?? []
            return decoded.isEmpty ? [TrainingLocation.gym(id: TrainingLocation.defaultId)] : decoded
        }
        set { locationsData = (try? JSONEncoder().encode(newValue)) ?? Data() }
    }

    var activeLocation: TrainingLocation {
        get { locations.first { $0.id.uuidString == activeLocationId } ?? locations[0] }
        set {
            var all = locations
            if let i = all.firstIndex(where: { $0.id == newValue.id }) { all[i] = newValue } else { all.append(newValue) }
            locations = all
            activeLocationId = newValue.id.uuidString
        }
    }
    var physique: PhysiqueGoal {
        get { PhysiqueGoal(rawValue: physiqueRaw) ?? .balanced }
        set { physiqueRaw = newValue.rawValue }
    }
    var postureGoals: Set<PostureGoal> {
        get { Set(postureGoalsRaw.compactMap(PostureGoal.init(rawValue:))) }
        set { postureGoalsRaw = newValue.map(\.rawValue).sorted() }
    }
    var limitations: Set<Limitation> {
        get { Set(limitationsRaw.compactMap(Limitation.init(rawValue:))) }
        set { limitationsRaw = newValue.map(\.rawValue).sorted() }
    }

    var age: Int {
        Calendar.current.component(.year, from: Date()) - birthYear
    }

    var data: ProfileData { data(at: activeLocation) }

    func data(at location: TrainingLocation) -> ProfileData {
        ProfileData(sex: sex, age: age, heightCm: heightCm, weightKg: weightKg,
                    goal: goal, experience: experience, daysPerWeek: daysPerWeek,
                    sessionMinutes: sessionMinutes, location: location, limitations: limitations,
                    targetBodyFat: targetBodyFat > 0 ? targetBodyFat : nil,
                    physique: physique, postureGoals: postureGoals)
    }
}

@Model
final class BodyScan {
    var date: Date = Date()
    var weightKg: Double = 0
    var measurementsData: Data = Data()

    init(date: Date = Date(), weightKg: Double, measurements: ScanMeasurements) {
        self.date = date
        self.weightKg = weightKg
        self.measurementsData = (try? JSONEncoder().encode(measurements)) ?? Data()
    }

    var measurements: ScanMeasurements {
        get { (try? JSONDecoder().decode(ScanMeasurements.self, from: measurementsData)) ?? ScanMeasurements() }
        set { measurementsData = (try? JSONEncoder().encode(newValue)) ?? Data() }
    }
}

@Model
final class SavedProgram {
    var createdAt: Date = Date()
    var programData: Data = Data()

    init(program: TrainingProgram) {
        self.createdAt = program.createdAt
        self.programData = (try? JSONEncoder().encode(program)) ?? Data()
    }

    var program: TrainingProgram? {
        try? JSONDecoder().decode(TrainingProgram.self, from: programData)
    }
}

@Model
final class WorkoutEntry {
    var date: Date = Date()
    var dayName: String = ""
    var exerciseId: String = ""
    var setsData: Data = Data()

    init(date: Date = Date(), dayName: String, exerciseId: String, sets: [SetLog]) {
        self.date = date
        self.dayName = dayName
        self.exerciseId = exerciseId
        self.setsData = (try? JSONEncoder().encode(sets)) ?? Data()
    }

    var sets: [SetLog] {
        (try? JSONDecoder().decode([SetLog].self, from: setsData)) ?? []
    }
}
