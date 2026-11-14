import Charts
import SwiftData
import SwiftUI

/// Hvor mye fett du har, hvor det sitter, og planen for å få det ned uten å miste muskler.
struct FatAnalysisView: View {
    @Bindable var profile: UserProfile
    @Environment(\.modelContext) private var context
    @Query(sort: \BodyScan.date, order: .reverse) private var scans: [BodyScan]

    private var latest: ScanMeasurements? { scans.first?.measurements }
    private var fat: FatAnalysis { FatLossPlanner.analyze(profile: profile.data, scan: latest) }
    private var plan: FatLossPlan { FatLossPlanner.plan(profile: profile.data, analysis: fat, waistCm: latest?.waistCm) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                hero
                distributionCard
                goalCard
                if plan.needed {
                    timelineCard
                }
                pillarsCard
                Card {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Slik justerer vi underveis", systemImage: "slider.horizontal.3").font(.headline)
                        Text(plan.adjustmentRule).font(.subheadline)
                        Divider()
                        Label("Enkelt kosthold", systemImage: "fork.knife").font(.headline)
                        Text(plan.plateNote).font(.subheadline)
                    }
                }
                Text("Estimater basert på skann og validerte formler — ikke medisinsk diagnose. Følg trenden, ikke enkeltmålinger.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .padding()
        }
        .navigationTitle("Fett & plan")
    }

    // MARK: Kort

    private var hero: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    Text(String(format: "%.1f", fat.bodyFatPercent))
                        .font(.system(size: 56, weight: .bold, design: .rounded))
                        .contentTransition(.numericText())
                    Text("% fett").font(.title3.bold()).foregroundStyle(.secondary)
                    Spacer()
                    Text(fat.category.label)
                        .font(.subheadline.bold())
                        .padding(.horizontal, 10).padding(.vertical, 5)
                        .background(categoryColor.opacity(0.2), in: Capsule())
                        .foregroundStyle(categoryColor)
                }
                FatScale(position: fat.scalePosition)
                HStack {
                    Metric(title: "Fettmasse", value: String(format: "%.1f kg", fat.fatMassKg))
                    Metric(title: "Fettfri masse", value: String(format: "%.1f kg", fat.leanMassKg))
                    Metric(title: "Vekt", value: String(format: "%.1f kg", profile.weightKg))
                }
                if fat.source == .bmiEstimate {
                    Label("Grovt anslag fra BMI og alder. Skann kroppen for et mye bedre estimat.", systemImage: "exclamationmark.triangle")
                        .font(.caption).foregroundStyle(.orange)
                }
            }
        }
    }

    private var categoryColor: Color {
        switch fat.category {
        case .essential, .high: .orange
        case .athletic, .fit: .green
        case .average: .yellow
        case .veryHigh: .red
        }
    }

    private var distributionCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                Text("Hvor sitter fettet?").font(.headline)
                Label(fat.distribution.label, systemImage: fat.distribution == .central ? "circle.dashed.inset.filled" : "figure.stand")
                HStack {
                    Metric(title: "Midje/hofte", value: fat.waistToHip.map { String(format: "%.2f", $0) })
                    Metric(title: "Midje/høyde", value: fat.waistToHeight.map { String(format: "%.2f", $0) })
                    Metric(title: "Midje", value: latest?.waistCm.map { String(format: "%.0f cm", $0) })
                }
                Text("Bukfett (visceralt): \(fat.visceralRisk)").font(.subheadline)
            }
        }
    }

    private var goalCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Ditt mål").font(.headline)
                    Spacer()
                    Text(String(format: "%.0f %% fett", plan.targetBodyFat)).font(.headline).foregroundStyle(.orange)
                }
                Slider(value: Binding(
                    get: { profile.targetBodyFat > 0 ? profile.targetBodyFat : plan.targetBodyFat },
                    set: { profile.targetBodyFat = ($0 * 2).rounded() / 2 }),
                       in: profile.sex == .male ? 8...30 : 15...38, step: 0.5)
                if plan.needed {
                    HStack {
                        Metric(title: "Fett å miste", value: String(format: "%.1f kg", plan.fatToLoseKg))
                        Metric(title: "Målvekt", value: String(format: "%.1f kg", plan.targetWeightKg))
                        Metric(title: "Tid", value: "\(plan.weeks) uker")
                    }
                    if let date = Calendar.current.date(byAdding: .weekOfYear, value: plan.weeks, to: Date()) {
                        Text("Realistisk ved \(date.formatted(.dateTime.month(.wide).year())) med ~\(String(format: "%.1f", plan.weeklyLossKg)) kg/uke.")
                            .font(.subheadline)
                    }
                    HStack {
                        Metric(title: "Kalorier", value: "\(plan.targetKcal)")
                        Metric(title: "Underskudd", value: "−\(plan.dailyDeficitKcal)")
                        Metric(title: "Protein", value: "\(plan.proteinG) g")
                        Metric(title: "Skritt", value: plan.dailySteps.formatted())
                    }
                    if profile.goal != .loseFat {
                        Button {
                            profile.goal = .loseFat
                            CoachService.regenerateAllPrograms(profile: profile, scans: scans, context: context)
                        } label: {
                            Label("Gjør fettap til hovedmål og tilpass programmet", systemImage: "wand.and.stars")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                    } else {
                        Label("Programmet ditt er tilpasset fettap.", systemImage: "checkmark.seal.fill")
                            .font(.subheadline).foregroundStyle(.green)
                    }
                } else {
                    Label("Du er på eller under målet. Fokuser på å bygge muskler — da blir du også slankere.", systemImage: "checkmark.seal.fill")
                        .font(.subheadline).foregroundStyle(.green)
                }
            }
        }
    }

    private var timelineCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Text("Forventet utvikling").font(.headline)
                Chart(plan.milestones) { m in
                    LineMark(x: .value("Uke", m.week), y: .value("Fett %", m.bodyFatPercent))
                        .foregroundStyle(.orange)
                        .interpolationMethod(.catmullRom)
                    PointMark(x: .value("Uke", m.week), y: .value("Fett %", m.bodyFatPercent))
                        .foregroundStyle(.orange)
                        .annotation(position: .top) {
                            Text(String(format: "%.0f kg", m.weightKg)).font(.caption2).foregroundStyle(.secondary)
                        }
                }
                .chartXAxisLabel("Uker")
                .chartYAxisLabel("Fett %")
                .chartYScale(domain: .automatic(includesZero: false))
                .frame(height: 200)
                if let last = plan.milestones.last, let w = last.waistCm, let start = latest?.waistCm {
                    Text(String(format: "Midjen kan gå fra ca. %.0f til %.0f cm.", start, w)).font(.caption).foregroundStyle(.secondary)
                }
            }
        }
    }

    private var pillarsCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 14) {
                Text("Slik jobber vi bort fettet").font(.headline)
                ForEach(plan.pillars.indices, id: \.self) { i in
                    let p = plan.pillars[i]
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: p.symbol).font(.title3).foregroundStyle(.orange).frame(width: 28)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(p.title).font(.subheadline.bold())
                            Text(p.detail).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }
}

/// Fargeskala fra svært lav til svært høy fettprosent med markør.
struct FatScale: View {
    let position: Double
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                LinearGradient(colors: [.orange, .green, .green, .yellow, .orange, .red], startPoint: .leading, endPoint: .trailing)
                    .frame(height: 10)
                    .clipShape(Capsule())
                Circle()
                    .fill(.white)
                    .stroke(.black.opacity(0.6), lineWidth: 2)
                    .frame(width: 20, height: 20)
                    .offset(x: max(0, min(geo.size.width - 20, geo.size.width * position - 10)))
            }
        }
        .frame(height: 20)
    }
}
