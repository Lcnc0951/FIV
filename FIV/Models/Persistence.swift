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
    var equipmentRaw: String = Equipment.fullGym.rawValue
    var limitationsRaw: [String] = []
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
    var equipment: Equipment {
        get { Equipment(rawValue: equipmentRaw) ?? .fullGym }
        set { equipmentRaw = newValue.rawValue }
    }
    var limitations: Set<Limitation> {
        get { Set(limitationsRaw.compactMap(Limitation.init(rawValue:))) }
        set { limitationsRaw = newValue.map(\.rawValue).sorted() }
    }

    var age: Int {
        Calendar.current.component(.year, from: Date()) - birthYear
    }

    var data: ProfileData {
        ProfileData(sex: sex, age: age, heightCm: heightCm, weightKg: weightKg,
                    goal: goal, experience: experience, daysPerWeek: daysPerWeek,
                    sessionMinutes: sessionMinutes, equipment: equipment, limitations: limitations)
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
