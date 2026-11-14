import Foundation

// MARK: - Muskelanalyse

/// Ett kroppsområde vurdert mot proporsjonene som passer ønsket kroppsform.
struct RegionScore: Identifiable, Equatable {
    var id: String { name }
    let name: String
    let detail: String
    let value: Double
    let target: ClosedRange<Double>
    let format: String
    /// 0–100: hvor nær målet du er.
    let score: Int
    let status: String
    let muscles: [Muscle]
    /// true hvis området skal prioriteres i programmet.
    let prioritize: Bool
}

struct MuscleReport: Equatable {
    var regions: [RegionScore] = []
    var symmetry: [RegionScore] = []
    var overallScore: Int? = nil
    var summary: String = ""
}

/// Sammenligner proporsjoner fra skannet med målet for valgt kroppsform.
/// Forhold mellom kroppsdeler (f.eks. bryst/midje) er mindre påvirket av fett enn rå omkretser.
enum MuscleAnalyzer {

    static func analyze(profile: ProfileData, scan: ScanMeasurements?, bodyFat: Double?) -> MuscleReport {
        guard let scan else {
            return MuscleReport(summary: "Skann kroppen for å se hvordan musklene dine er fordelt i forhold til målet ditt.")
        }
        let male = profile.sex == .male
        let goal = profile.physique
        var regions: [RegionScore] = []

        // Fettkorrigert omkrets: trekker fra et estimat av underhudsfett (grovt, men gjør tall sammenlignbare over tid)
        let fatFactor = 1 - min(0.25, max(0, ((bodyFat ?? (male ? 18 : 26)) - (male ? 12 : 20)) / 100))

        func score(_ v: Double, _ r: ClosedRange<Double>) -> Int {
            if r.contains(v) { return 100 }
            let width = max(r.upperBound - r.lowerBound, 0.01)
            let dist = v < r.lowerBound ? r.lowerBound - v : v - r.upperBound
            return max(0, Int((100 - dist / width * 60).rounded()))
        }
        func add(_ name: String, _ detail: String, _ v: Double?, _ r: ClosedRange<Double>, _ format: String,
                 low: String, high: String, muscles: [Muscle], prioritizeWhenLow: Bool = true) {
            guard let v else { return }
            let s = score(v, r)
            let status = r.contains(v) ? "Innenfor målet" : (v < r.lowerBound ? low : high)
            regions.append(RegionScore(name: name, detail: detail, value: v, target: r, format: format, score: s,
                                       status: status, muscles: muscles,
                                       prioritize: prioritizeWhenLow && v < r.lowerBound && s < 85))
        }

        // 1) Overkroppsbredde: bryst/midje
        let chestWaistTarget: ClosedRange<Double> = switch goal {
        case .vTaper: male ? 1.32...1.50 : 1.22...1.38
        case .powerful: male ? 1.22...1.40 : 1.15...1.30
        case .lowerBody: male ? 1.12...1.30 : 1.08...1.25
        default: male ? 1.20...1.38 : 1.12...1.30
        }
        add("Overkropp vs. midje", "Bryst ÷ midje. Bredere rygg og skuldre gir høyere tall.",
            ratio(scan.chestCm, scan.waistCm), chestWaistTarget, "%.2f",
            low: "Bygg bredde: rygg og skuldre", high: "Over målet — godt utviklet overkropp",
            muscles: [.lats, .sideDelts, .upperBack, .chest])

        // 2) Arm-utvikling (fettkorrigert, per høyde)
        let armTarget: ClosedRange<Double> = switch goal {
        case .powerful, .vTaper: male ? 0.200...0.230 : 0.175...0.200
        case .lowerBody: male ? 0.180...0.215 : 0.160...0.185
        default: male ? 0.188...0.220 : 0.168...0.192
        }
        add("Armer", "Overarmsomkrets justert for fett, delt på høyde.",
            scan.upperArmAverage.map { $0 * fatFactor / profile.heightCm }, armTarget, "%.3f",
            low: "Under målet — mer armvolum", high: "Over målet",
            muscles: [.biceps, .triceps])

        // 3) Bein-utvikling (fettkorrigert, per høyde)
        let thighTarget: ClosedRange<Double> = switch goal {
        case .lowerBody, .powerful: male ? 0.335...0.380 : 0.340...0.390
        case .vTaper: male ? 0.300...0.345 : 0.310...0.355
        default: male ? 0.315...0.360 : 0.320...0.370
        }
        add("Lår", "Lårsomkrets justert for fett, delt på høyde.",
            scan.thighAverage.map { $0 * fatFactor / profile.heightCm }, thighTarget, "%.3f",
            low: "Under målet — mer beintrening", high: "Over målet",
            muscles: [.quads, .hamstrings, .glutes])

        // 4) Over/underkropp-balanse
        let balanceTarget: ClosedRange<Double> = switch goal {
        case .lowerBody: 1.85...2.10
        case .vTaper: 1.60...1.80
        default: 1.68...1.90
        }
        if let arm = scan.upperArmAverage, let thigh = scan.thighAverage, arm > 0 {
            let v = thigh / arm
            let s = score(v, balanceTarget)
            let lowLegs = v < balanceTarget.lowerBound
            regions.append(RegionScore(
                name: "Over- vs. underkropp", detail: "Lår ÷ overarm.", value: v, target: balanceTarget, format: "%.2f",
                score: s, status: balanceTarget.contains(v) ? "Balansert" : (lowLegs ? "Beina henger etter" : "Overkroppen henger etter"),
                muscles: lowLegs ? [.quads, .hamstrings, .glutes] : [.chest, .lats, .sideDelts],
                prioritize: s < 85))
        }

        // 5) Sete/hofte (relevant for sete-mål)
        if goal == .lowerBody || goal == .powerful {
            add("Sete & hofter", "Hofte ÷ midje.", ratio(scan.hipCm, scan.waistCm),
                male ? 1.02...1.15 : 1.30...1.50, "%.2f",
                low: "Mer setetrening", high: "Over målet", muscles: [.glutes])
        }

        // 6) Definisjon: midje/høyde
        let whtrTarget: ClosedRange<Double> = goal == .defined ? 0.40...0.45 : 0.40...0.50
        add("Definisjon (midje)", "Midje ÷ høyde. Lavere = mer synlige muskler.",
            ratio(scan.waistCm, profile.heightCm), whtrTarget, "%.2f",
            low: "Svært slank", high: "Mer fettap gir mer definisjon",
            muscles: [.abs], prioritizeWhenLow: false)

        // Symmetri venstre/høyre
        var symmetry: [RegionScore] = []
        for (name, l, r, muscles) in [("Armer V/H", scan.upperArmLeftCm, scan.upperArmRightCm, [Muscle.biceps, .triceps]),
                                      ("Lår V/H", scan.thighLeftCm, scan.thighRightCm, [Muscle.quads, .hamstrings, .glutes])] {
            guard let l, let r, max(l, r) > 0 else { continue }
            let v = min(l, r) / max(l, r)
            let s = score(v, 0.96...1.0)
            symmetry.append(RegionScore(name: name, detail: String(format: "%.1f vs %.1f cm", l, r), value: v * 100,
                                        target: 96...100, format: "%.0f %%", score: s,
                                        status: v >= 0.96 ? "Symmetrisk" : "\(l < r ? "Venstre" : "Høyre") side er svakere",
                                        muscles: muscles, prioritize: v < 0.96))
        }

        let all = regions + symmetry
        let overall = all.isEmpty ? nil : all.map(\.score).reduce(0, +) / all.count
        let behind = all.filter(\.prioritize).map { $0.name.lowercased() }
        let summary = behind.isEmpty
            ? "Proporsjonene dine passer godt med målet «\(goal.label.lowercased())». Fortsett med balansert progresjon."
            : "For å nå «\(goal.label.lowercased())» prioriterer programmet: \(behind.joined(separator: ", "))."
        return MuscleReport(regions: regions, symmetry: symmetry, overallScore: overall, summary: summary)
    }

    private static func ratio(_ a: Double?, _ b: Double?) -> Double? {
        guard let a, let b, b > 0 else { return nil }
        return a / b
    }
}

// MARK: - Holdning

struct PostureIssue: Identifiable, Equatable {
    var id: String { title }
    let title: String
    let detail: String
    let measured: String?
    let goal: PostureGoal
    let fromScan: Bool
}

struct PostureDrill: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let dose: String
    let cue: String
    /// Navn på animasjon i ExerciseAnimations.json, eller en øvelses-id.
    let animation: String?
}

struct PosturePlan: Equatable {
    var issues: [PostureIssue]
    var drills: [PostureDrill]
    var strengthFocus: [String]
    var habits: [String]
    var frequency: String
}

enum PostureAnalyzer {

    static let drills: [String: PostureDrill] = [
        "chin_tuck": PostureDrill(id: "chin_tuck", name: "Chin tucks", dose: "2 × 10, hold 3 sek",
                                  cue: "Skyv haken rett bakover («dobbelthake») uten å bøye nakken. Kjenn strekk i nakken bak.", animation: nil),
        "wall_slide": PostureDrill(id: "wall_slide", name: "Wall slides", dose: "2 × 10",
                                   cue: "Rygg, bakhode og armer mot veggen. Skyv armene opp til Y og ned til W uten å miste kontakten.", animation: "wall_slide"),
        "thoracic_ext": PostureDrill(id: "thoracic_ext", name: "Brystrygg-ekstensjon på foam roller", dose: "2 × 8 per nivå",
                                     cue: "Rull under øvre rygg, hender bak hodet, len deg bakover over rulla. Flytt rulla ett hakk og gjenta.", animation: nil),
        "pec_stretch": PostureDrill(id: "pec_stretch", name: "Brysttøy i døråpning", dose: "2 × 30 sek per side",
                                    cue: "Underarmen mot dørkarmen i skulderhøyde, ta et steg frem til du kjenner strekk i brystet.", animation: nil),
        "face_pull": PostureDrill(id: "face_pull", name: "Face pulls / band pull-aparts", dose: "2 × 15",
                                  cue: "Trekk mot ansiktet, roter armene utover, klem skulderbladene sammen.", animation: "face_pull"),
        "ytw": PostureDrill(id: "ytw", name: "Y-T-W", dose: "1 × 6 av hver",
                            cue: "Tomlene opp. Løft armene i Y, T og W og hold 2 sek i hver.", animation: "ytw"),
        "dead_bug": PostureDrill(id: "dead_bug", name: "Dead bug", dose: "2 × 8 per side",
                                 cue: "Korsryggen presset mot gulvet hele tiden. Strekk motsatt arm og bein.", animation: "dead_bug"),
        "side_plank": PostureDrill(id: "side_plank", name: "Sideplanke", dose: "2 × 20–40 sek per side",
                                   cue: "Rett linje fra hode til føtter. Start med svakeste side.", animation: nil),
        "bird_dog": PostureDrill(id: "bird_dog", name: "Bird dog", dose: "2 × 8 per side, hold 5 sek",
                                 cue: "På alle fire, strekk motsatt arm og bein uten å vri bekkenet. (McGill big 3)", animation: nil),
        "curl_up": PostureDrill(id: "curl_up", name: "McGill curl-up", dose: "2 × 6, hold 8 sek",
                                cue: "Ett kne bøyd, hendene under korsryggen. Løft hode og skuldre så vidt — nøytral rygg.", animation: nil),
        "glute_bridge": PostureDrill(id: "glute_bridge", name: "Seteløft", dose: "2 × 12, pause 2 sek",
                                     cue: "Vipp bekkenet bakover, press opp med setet — ikke svai i korsryggen.", animation: "glute_bridge"),
        "hip_flexor": PostureDrill(id: "hip_flexor", name: "Hoftebøyer-tøy knestående", dose: "2 × 30 sek per side",
                                   cue: "Knestående utfall. Stram setet på bakre side og skyv hoften forsiktig frem.", animation: "hip_flexor"),
        "suitcase_carry": PostureDrill(id: "suitcase_carry", name: "Kofferbæring", dose: "3 × 30 m per side",
                                       cue: "Tung vekt i én hånd, gå helt rett uten å lene deg. Start med svakeste side.", animation: "carry"),
        "cat_camel": PostureDrill(id: "cat_camel", name: "Katt–kamel", dose: "1 × 10 rolige",
                                  cue: "På alle fire, rund og svai ryggen rolig. God oppvarming for ryggen.", animation: nil),
        "world_greatest": PostureDrill(id: "world_greatest", name: "World's greatest stretch", dose: "1 × 5 per side",
                                       cue: "Utfall, albuen ned mot foten, roter armen opp mot taket.", animation: "lunge"),
    ]

    static func plan(profile: ProfileData, scan: ScanMeasurements?) -> PosturePlan {
        var issues: [PostureIssue] = []
        var goals = profile.postureGoals

        if let s = scan {
            if let fh = s.forwardHeadCm, fh >= 6 {
                goals.insert(.neck)
                issues.append(PostureIssue(title: "Fremoverlent hode", detail: "Hodet står foran skulderlinjen.",
                                           measured: String(format: "%.0f cm", fh), goal: .neck, fromScan: true))
            }
            if let rs = s.roundedShouldersCm, rs >= 5 {
                goals.insert(.shoulders)
                issues.append(PostureIssue(title: "Fremoverrullede skuldre", detail: "Skulderleddene ligger foran øvre del av ryggen.",
                                           measured: String(format: "%.0f cm", rs), goal: .shoulders, fromScan: true))
            }
            if let th = s.thoracicAngleDeg, th >= 25 {
                goals.insert(.upperBack)
                issues.append(PostureIssue(title: "Rund øvre rygg", detail: "Øvre del av ryggraden krummer mer fremover enn nedre.",
                                           measured: String(format: "%.0f°", th), goal: .upperBack, fromScan: true))
            }
            if let t = s.shoulderTiltDeg, abs(t) >= 2.5 {
                goals.insert(.shoulders)
                issues.append(PostureIssue(title: "Skjeve skuldre", detail: "\(t > 0 ? "Venstre" : "Høyre") skulder står høyere.",
                                           measured: String(format: "%.1f°", abs(t)), goal: .shoulders, fromScan: true))
            }
            if let t = s.hipTiltDeg, abs(t) >= 2.5 {
                goals.insert(.pelvis)
                issues.append(PostureIssue(title: "Skjevt bekken", detail: "\(t > 0 ? "Venstre" : "Høyre") hofte står høyere.",
                                           measured: String(format: "%.1f°", abs(t)), goal: .pelvis, fromScan: true))
            }
        }
        for g in profile.postureGoals where !issues.contains(where: { $0.goal == g }) {
            issues.append(PostureIssue(title: g.label, detail: "Ditt eget mål.", measured: nil, goal: g, fromScan: false))
        }

        // Velg øvelser etter mål (rekkefølge = prioritet)
        var ids: [String] = []
        func use(_ list: [String]) { for id in list where !ids.contains(id) { ids.append(id) } }
        if goals.contains(.neck) { use(["chin_tuck", "wall_slide"]) }
        if goals.contains(.upperBack) { use(["thoracic_ext", "wall_slide", "ytw"]) }
        if goals.contains(.shoulders) { use(["face_pull", "pec_stretch", "suitcase_carry"]) }
        if goals.contains(.lowerBack) { use(["curl_up", "side_plank", "bird_dog"]) }
        if goals.contains(.pelvis) { use(["hip_flexor", "glute_bridge", "dead_bug", "side_plank"]) }
        if goals.contains(.mobility) { use(["cat_camel", "world_greatest", "thoracic_ext", "hip_flexor"]) }
        let chosen = ids.prefix(7).compactMap { drills[$0] }

        var strength: [String] = []
        if !goals.isDisjoint(with: [.neck, .upperBack, .shoulders]) {
            strength.append("Dobbelt så mange sett drag (roing, nedtrekk, face pulls) som press denne perioden.")
        }
        if !goals.isDisjoint(with: [.lowerBack, .pelvis]) {
            strength.append("Tunge hofteøvelser (hip thrust, rumensk markløft) og anti-rotasjon (Pallof) for en sterk korsrygg.")
        }
        if goals.contains(.shoulders) || goals.contains(.pelvis) {
            strength.append("Ettsidige øvelser og bæring jevner ut forskjeller mellom høyre og venstre.")
        }

        return PosturePlan(
            issues: issues, drills: chosen, strengthFocus: strength,
            habits: [
                "Den beste holdningen er den neste — bytt stilling minst hver 30.–45. min.",
                "Skjermen i øyehøyde og bena i gulvet ved PC-arbeid.",
                "Gå en kort tur etter måltider og ta telefonsamtaler stående.",
                "Holdningsendringer tar 8–12 uker. Skann deg hver 4. uke for å se fremgangen.",
            ],
            frequency: chosen.isEmpty ? "" : "Ca. 10 min — som oppvarming før hver økt eller daglig hjemme.")
    }
}
