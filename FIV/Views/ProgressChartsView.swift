import Charts
import SwiftData
import SwiftUI

struct ProgressChartsView: View {
    @Bindable var profile: UserProfile
    @Query(sort: \BodyScan.date) private var scans: [BodyScan]
    @Query(sort: \WorkoutEntry.date) private var entries: [WorkoutEntry]

    private struct Point: Identifiable {
        let id = UUID()
        let date: Date
        let value: Double
        let series: String
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    if scans.count < 2 {
                        Card {
                            Label("Skann deg minst to ganger (anbefalt hver 4. uke) for å se kurvene.", systemImage: "chart.xyaxis.line")
                        }
                    }
                    chart("Vekt (kg)", points(\.weightKg))
                    chart("Fettprosent", bodyFatPoints)
                    chart("Midje (cm)", measurementPoints(\.waistCm, series: "Midje"))
                    chart("Armer & lår (cm)",
                          measurementPoints(\.upperArmLeftCm, series: "Arm V") + measurementPoints(\.upperArmRightCm, series: "Arm H")
                          + measurementPoints(\.thighLeftCm, series: "Lår V") + measurementPoints(\.thighRightCm, series: "Lår H"))
                    strengthSection
                }
                .padding()
            }
            .navigationTitle("Fremgang")
        }
    }

    private func points(_ key: KeyPath<BodyScan, Double>) -> [Point] {
        scans.map { Point(date: $0.date, value: $0[keyPath: key], series: "") }
    }

    private func measurementPoints(_ key: KeyPath<ScanMeasurements, Double?>, series: String) -> [Point] {
        scans.compactMap { s in s.measurements[keyPath: key].map { Point(date: s.date, value: $0, series: series) } }
    }

    private var bodyFatPoints: [Point] {
        scans.compactMap { s in
            let m = s.measurements
            guard let neck = m.neckCm, let waist = m.waistCm,
                  let bf = BodyComposition.navyBodyFat(sex: profile.sex, heightCm: profile.heightCm, neckCm: neck, waistCm: waist, hipCm: m.hipCm)
            else { return nil }
            return Point(date: s.date, value: bf, series: "")
        }
    }

    @ViewBuilder
    private func chart(_ title: String, _ data: [Point]) -> some View {
        if !data.isEmpty {
            Card {
                VStack(alignment: .leading) {
                    Text(title).font(.headline)
                    Chart(data) { p in
                        LineMark(x: .value("Dato", p.date), y: .value(title, p.value))
                            .foregroundStyle(by: .value("Serie", p.series))
                            .interpolationMethod(.catmullRom)
                        PointMark(x: .value("Dato", p.date), y: .value(title, p.value))
                            .foregroundStyle(by: .value("Serie", p.series))
                    }
                    .chartYScale(domain: .automatic(includesZero: false))
                    .frame(height: 180)
                }
            }
        }
    }

    /// Estimert 1RM over tid for basisøvelsene du har logget.
    private var strengthSection: some View {
        let compoundIds = Set(entries.map(\.exerciseId)).filter { ExerciseLibrary.exercise(id: $0)?.pattern.isCompound == true }
        let data: [Point] = entries.compactMap { e in
            guard compoundIds.contains(e.exerciseId),
                  let best = e.sets.map(ProgressionEngine.estimatedOneRepMax).max(), best > 0,
                  let name = ExerciseLibrary.exercise(id: e.exerciseId)?.name else { return nil }
            return Point(date: e.date, value: best, series: name)
        }
        return chart("Estimert 1RM (kg)", data)
    }
}
