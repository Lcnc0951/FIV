import SwiftData
import SwiftUI

/// Muskelbalanse mot ønsket kroppsform + holdningsanalyse og -rutine.
struct MusclePostureView: View {
    @Bindable var profile: UserProfile
    @Query(sort: \BodyScan.date, order: .reverse) private var scans: [BodyScan]
    @State private var tab = 0

    private var scan: ScanMeasurements? { scans.first?.measurements }
    private var bodyFat: Double? { FatLossPlanner.analyze(profile: profile.data, scan: scan).bodyFatPercent }
    private var report: MuscleReport { MuscleAnalyzer.analyze(profile: profile.data, scan: scan, bodyFat: bodyFat) }
    private var posture: PosturePlan { PostureAnalyzer.plan(profile: profile.data, scan: scan) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Picker("", selection: $tab) {
                    Text("Muskler").tag(0)
                    Text("Holdning").tag(1)
                }
                .pickerStyle(.segmented)

                if tab == 0 { muscles } else { postureSection }
            }
            .padding()
        }
        .navigationTitle("Muskler & holdning")
    }

    // MARK: Muskler

    @ViewBuilder
    private var muscles: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Label(profile.physique.label, systemImage: profile.physique.symbol).font(.headline)
                    Spacer()
                    if let score = report.overallScore {
                        Text("\(score)/100").font(.title2.bold()).foregroundStyle(scoreColor(score))
                    }
                }
                Text(report.summary).font(.subheadline)
                Text("Endre ønsket kroppsform under Profil.").font(.caption).foregroundStyle(.secondary)
            }
        }
        if !report.regions.isEmpty {
            Card {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Proporsjoner mot målet").font(.headline)
                    ForEach(report.regions) { RegionRow(region: $0) }
                }
            }
        }
        if !report.symmetry.isEmpty {
            Card {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Symmetri").font(.headline)
                    ForEach(report.symmetry) { RegionRow(region: $0) }
                }
            }
        }
        Text("Tallene er forhold mellom kroppsdeler fra LiDAR-skannet, justert for estimert fett. De sier noe om balanse og utvikling over tid — ikke eksakt muskelmasse.")
            .font(.caption).foregroundStyle(.secondary)
    }

    // MARK: Holdning

    @ViewBuilder
    private var postureSection: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                Text("Hva PT-en ser").font(.headline)
                if posture.issues.isEmpty {
                    Label("Ingen tydelige holdningsavvik i siste skann.", systemImage: "checkmark.seal.fill").foregroundStyle(.green)
                }
                ForEach(posture.issues) { issue in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: issue.fromScan ? "camera.metering.matrix" : "person.fill.questionmark")
                            .foregroundStyle(.orange).frame(width: 24)
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(issue.title).font(.subheadline.bold())
                                if let m = issue.measured { Text(m).font(.caption.monospacedDigit()).foregroundStyle(.secondary) }
                            }
                            Text(issue.detail).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        if !posture.drills.isEmpty {
            Card {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Din holdningsrutine").font(.headline)
                    Text(posture.frequency).font(.caption).foregroundStyle(.secondary)
                    ForEach(posture.drills) { DrillRow(drill: $0) }
                }
            }
        }
        if !posture.strengthFocus.isEmpty {
            Card {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Lagt inn i treningsprogrammet").font(.headline)
                    ForEach(posture.strengthFocus, id: \.self) { Label($0, systemImage: "dumbbell.fill").font(.subheadline) }
                }
            }
        }
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Text("Hverdagsvaner").font(.headline)
                ForEach(posture.habits, id: \.self) { Text("• \($0)").font(.subheadline) }
            }
        }
        Text("Holdning henger svakere sammen med smerte enn mange tror. Har du smerter, nummenhet eller utstråling: oppsøk fysioterapeut eller lege.")
            .font(.caption).foregroundStyle(.secondary)
    }

    private func scoreColor(_ s: Int) -> Color { s >= 85 ? .green : s >= 65 ? .orange : .red }
}

private struct RegionRow: View {
    let region: RegionScore
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(region.name).font(.subheadline.bold())
                Spacer()
                Text(String(format: region.format, region.value)).font(.subheadline.monospacedDigit())
                Text("mål \(String(format: region.format, region.target.lowerBound))–\(String(format: region.format, region.target.upperBound))")
                    .font(.caption2).foregroundStyle(.secondary)
            }
            ProgressView(value: Double(region.score), total: 100)
                .tint(region.score >= 85 ? .green : region.score >= 65 ? .orange : .red)
            HStack {
                Text(region.status).font(.caption).foregroundStyle(region.prioritize ? .orange : .secondary)
                if region.prioritize { Tag("prioritert") }
            }
        }
    }
}

struct DrillRow: View {
    let drill: PostureDrill
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Group {
                if let name = drill.animation, let anim = ExerciseAnimationStore.animation(named: name) {
                    StickFigureView(animation: anim, showsPhase: false).padding(4)
                } else {
                    Image(systemName: "figure.flexibility").font(.title2).foregroundStyle(.orange)
                }
            }
            .frame(width: 64, height: 64)
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12))
            VStack(alignment: .leading, spacing: 3) {
                Text(drill.name).font(.subheadline.bold())
                Text(drill.dose).font(.caption.bold()).foregroundStyle(.orange)
                Text(drill.cue).font(.caption).foregroundStyle(.secondary)
            }
        }
    }
}
