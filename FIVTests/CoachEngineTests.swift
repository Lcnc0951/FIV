import XCTest
@testable import FIV

final class CoachEngineTests: XCTestCase {

    private func profile(goal: Goal = .buildMuscle, days: Int = 4, location: TrainingLocation = .gym(),
                         experience: Experience = .intermediate, limitations: Set<Limitation> = []) -> ProfileData {
        ProfileData(sex: .male, age: 35, heightCm: 180, weightKg: 82, goal: goal, experience: experience,
                    daysPerWeek: days, sessionMinutes: 60, location: location, limitations: limitations)
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
            XCTAssertGreaterThanOrEqual(done, target * 0.5, m.rawValue)
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
        let p = profile(location: .homeDumbbells(), limitations: [.lowerBack, .shoulder])
        let program = ProgramGenerator.generate(profile: p, analysis: BodyAnalyzer.analyze(profile: p, scan: nil))
        for ex in program.days.flatMap(\.exercises).compactMap(\.exercise) {
            XCTAssertTrue(ex.isAvailable(with: p.location.equipment), ex.name)
            XCTAssertTrue(ex.avoidWith.isDisjoint(with: p.limitations), ex.name)
        }
    }

    func testAllSplitsGenerate() {
        for days in 2...6 {
            for loc in [TrainingLocation.gym(), .homeGym(), .homeDumbbells(), .bodyweight()] {
                let p = profile(days: days, location: loc)
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

    func testEveryExerciseHasAnimation() {
        for ex in ExerciseLibrary.all {
            XCTAssertNotNil(ExerciseAnimationStore.animation(for: ex.id), "Mangler animasjon: \(ex.id)")
        }
    }

    func testLightHomeDumbbellsGiveHigherReps() {
        var light = TrainingLocation.homeDumbbells()
        light.dumbbellWeights = [2, 4, 6, 8, 10]
        let p = profile(location: light)
        XCTAssertTrue(ProgramGenerator.lightLoadsOnly(p))
        let program = ProgramGenerator.generate(profile: p, analysis: BodyAnalyzer.analyze(profile: p, scan: nil))
        let compounds = program.days.flatMap(\.exercises).filter { $0.exercise?.pattern.isCompound == true && $0.exercise?.pattern != .carry }
        XCTAssertTrue(compounds.allSatisfy { $0.repsMin >= 12 })
    }

    func testProgressionUsesAvailableDumbbells() throws {
        let p = ExercisePrescription(exerciseId: "bench_db", sets: 3, repsMin: 8, repsMax: 12, rir: 2, restSeconds: 120)
        let sets = Array(repeating: SetLog(weightKg: 20, reps: 12, rir: 1), count: 3)
        let s = ProgressionEngine.suggest(for: p, lastSets: sets, dumbbellWeights: [10, 15, 20, 25])
        XCTAssertEqual(s.weightKg, 25)
        let maxed = ProgressionEngine.suggest(for: p, lastSets: sets, dumbbellWeights: [10, 15, 20])
        XCTAssertEqual(maxed.weightKg, 20)
        XCTAssertGreaterThan(maxed.targetReps, 12)
    }

    func testFatLossPlan() {
        let p = profile(goal: .loseFat)
        var scan = ScanMeasurements()
        scan.neckCm = 38; scan.waistCm = 100; scan.hipCm = 104
        let fat = FatLossPlanner.analyze(profile: p, scan: scan)
        XCTAssertEqual(fat.source, .scan)
        XCTAssertEqual(fat.distribution, .central)
        let plan = FatLossPlanner.plan(profile: p, analysis: fat, waistCm: 100)
        XCTAssertTrue(plan.needed)
        XCTAssertEqual(plan.targetBodyFat, 15)
        XCTAssertGreaterThan(plan.weeks, 4)
        XCTAssertLessThanOrEqual(plan.weeklyLossKg, 82 * 0.01)
        XCTAssertEqual(plan.milestones.first?.week, 0)
        XCTAssertEqual(plan.milestones.last?.week, plan.weeks)
    }

    func testFatEstimateWithoutScanUsesBMI() {
        let fat = FatLossPlanner.analyze(profile: profile(), scan: nil)
        XCTAssertEqual(fat.source, .bmiEstimate)
        XCTAssertGreaterThan(fat.bodyFatPercent, 10)
    }

    func testPhysiqueGoalShiftsPriorities() {
        var p = profile()
        p.physique = .vTaper
        let a = BodyAnalyzer.analyze(profile: p, scan: nil)
        XCTAssertGreaterThan(a.priorities[.lats] ?? 0, a.priorities[.quads] ?? 0)
        p.physique = .lowerBody
        let b = BodyAnalyzer.analyze(profile: p, scan: nil)
        XCTAssertGreaterThan(b.priorities[.glutes] ?? 0, b.priorities[.chest] ?? 0)
    }

    func testMuscleReportFlagsNarrowUpperBodyForVTaper() {
        var p = profile()
        p.physique = .vTaper
        var scan = sampleScan
        scan.chestCm = 95; scan.waistCm = 86
        let report = MuscleAnalyzer.analyze(profile: p, scan: scan, bodyFat: 15)
        let upper = report.regions.first { $0.name == "Overkropp vs. midje" }
        XCTAssertEqual(upper?.prioritize, true)
        XCTAssertNotNil(report.overallScore)
    }

    func testPosturePlanFromScanAndGoals() {
        var p = profile()
        p.postureGoals = [.lowerBack]
        var scan = ScanMeasurements()
        scan.forwardHeadCm = 8
        scan.roundedShouldersCm = 6
        let plan = PostureAnalyzer.plan(profile: p, scan: scan)
        let ids = plan.drills.map(\.id)
        XCTAssertTrue(ids.contains("chin_tuck"))
        XCTAssertTrue(ids.contains("face_pull"))
        XCTAssertTrue(ids.contains("curl_up"))
        XCTAssertLessThanOrEqual(plan.drills.count, 7)
        for d in plan.drills { if let a = d.animation { XCTAssertNotNil(ExerciseAnimationStore.animation(named: a), a) } }
    }
}
