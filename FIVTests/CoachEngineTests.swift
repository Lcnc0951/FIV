import XCTest
@testable import FIV

final class CoachEngineTests: XCTestCase {

    private func profile(goal: Goal = .buildMuscle, days: Int = 4, equipment: Equipment = .fullGym,
                         experience: Experience = .intermediate, limitations: Set<Limitation> = []) -> ProfileData {
        ProfileData(sex: .male, age: 35, heightCm: 180, weightKg: 82, goal: goal, experience: experience,
                    daysPerWeek: days, sessionMinutes: 60, equipment: equipment, limitations: limitations)
    }

    private var sampleScan: ScanMeasurements {
        var m = ScanMeasurements()
        m.neckCm = 38; m.chestCm = 102; m.waistCm = 86; m.hipCm = 98
        m.upperArmLeftCm = 33.0; m.upperArmRightCm = 35.5
        m.thighLeftCm = 57; m.thighRightCm = 57.5
        m.shoulderTiltDeg = 0.8; m.hipTiltDeg = -0.5; m.forwardHeadCm = 7
        return m
    }

    func testNavyBodyFatMale() throws {
        let bf = try XCTUnwrap(BodyComposition.navyBodyFat(sex: .male, heightCm: 180, neckCm: 38, waistCm: 86, hipCm: nil))
        XCTAssertEqual(bf, 16.9, accuracy: 0.3)
    }

    func testEllipseCircumferenceOfCircle() {
        XCTAssertEqual(BodyComposition.ellipseCircumference(width: 10, depth: 10), .pi * 10, accuracy: 0.001)
    }

    func testAnalysisDetectsArmAsymmetryAndForwardHead() {
        let a = BodyAnalyzer.analyze(profile: profile(), scan: sampleScan)
        XCTAssertEqual(a.unilateralFocus[.biceps], .left)
        XCTAssertTrue(a.postureFlags.contains(.forwardHead))
        XCTAssertGreaterThan(a.priorities[.upperBack] ?? 0, 1)
        XCTAssertNotNil(a.bodyFatPercent)
    }

    func testProgramRespectsSessionLengthAndHitsVolume() {
        let p = profile()
        let analysis = BodyAnalyzer.analyze(profile: p, scan: sampleScan)
        let program = ProgramGenerator.generate(profile: p, analysis: analysis)
        XCTAssertEqual(program.days.count, 4)
        let cap = Int(Double(p.sessionMinutes - 8) / 2.8)
        for day in program.days {
            XCTAssertLessThanOrEqual(day.totalSets, cap + 1, day.name)
            XCTAssertFalse(day.exercises.isEmpty)
        }
        for m in Muscle.allCases {
            let done = program.weeklySets[m.rawValue] ?? 0
            let target = program.targetSets[m.rawValue] ?? 0
            XCTAssertGreaterThanOrEqual(done, target * 0.6, m.rawValue)
            XCTAssertLessThanOrEqual(done, target * 1.4, m.rawValue)
        }
    }

    func testUnilateralExerciseChosenForAsymmetry() {
        let p = profile()
        let analysis = BodyAnalyzer.analyze(profile: p, scan: sampleScan)
        let program = ProgramGenerator.generate(profile: p, analysis: analysis)
        let bicepsExercises = program.days.flatMap(\.exercises).compactMap(\.exercise).filter { $0.primary == .biceps }
        XCTAssertTrue(bicepsExercises.contains { $0.unilateral })
    }

    func testLimitationsAndEquipmentAreRespected() {
        let p = profile(equipment: .homeDumbbells, limitations: [.lowerBack, .shoulder])
        let program = ProgramGenerator.generate(profile: p, analysis: BodyAnalyzer.analyze(profile: p, scan: nil))
        for ex in program.days.flatMap(\.exercises).compactMap(\.exercise) {
            XCTAssertLessThanOrEqual(ex.equipment.rank, Equipment.homeDumbbells.rank, ex.name)
            XCTAssertTrue(ex.avoidWith.isDisjoint(with: p.limitations), ex.name)
        }
    }

    func testAllSplitsGenerate() {
        for days in 2...6 {
            for eq in Equipment.allCases {
                let p = profile(days: days, equipment: eq)
                let program = ProgramGenerator.generate(profile: p, analysis: BodyAnalyzer.analyze(profile: p, scan: nil))
                XCTAssertEqual(program.days.count, max(2, days))
                XCTAssertTrue(program.days.allSatisfy { !$0.exercises.isEmpty })
            }
        }
    }

    func testDoubleProgression() throws {
        let ex = try XCTUnwrap(ExerciseLibrary.exercise(id: "bench_db"))
        let p = ExercisePrescription(exerciseId: ex.id, sets: 3, repsMin: 8, repsMax: 12, rir: 2, restSeconds: 120)
        let hitTop = [SetLog(weightKg: 30, reps: 12, rir: 2), SetLog(weightKg: 30, reps: 12, rir: 1), SetLog(weightKg: 30, reps: 12, rir: 0)]
        let up = ProgressionEngine.suggest(for: p, lastSets: hitTop)
        XCTAssertGreaterThan(up.weightKg ?? 0, 30)
        XCTAssertEqual(up.targetReps, 8)

        let mid = [SetLog(weightKg: 30, reps: 10, rir: 2), SetLog(weightKg: 30, reps: 9, rir: 1), SetLog(weightKg: 30, reps: 8, rir: 1)]
        let same = ProgressionEngine.suggest(for: p, lastSets: mid)
        XCTAssertEqual(same.weightKg, 30)
        XCTAssertEqual(same.targetReps, 11)
    }

    func testNutritionProteinForFatLoss() {
        let n = NutritionCalculator.targets(profile: profile(goal: .loseFat), bodyFatPercent: 22)
        XCTAssertEqual(n.proteinG, Int((82 * 2.2).rounded()))
        XCTAssertLessThan(n.targetKcal, n.maintenanceKcal)
        XCTAssertGreaterThan(n.carbsG, 0)
    }
}
