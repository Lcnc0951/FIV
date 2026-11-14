import Foundation

struct Finding: Identifiable, Codable, Hashable {
    enum Severity: Int, Codable, Comparable {
        case positive, info, attention, important
        static func < (l: Severity, r: Severity) -> Bool { l.rawValue < r.rawValue }
    }
    var id: String { title }
    let title: String
    let detail: String
    let action: String
    let severity: Severity
}

enum PostureFlag: String, Codable {
    case forwardHead, shoulderTilt, hipTilt
}

struct BodyAnalysis: Equatable {
    var bodyFatPercent: Double?
    var leanMassKg: Double?
    var ffmi: Double?
    var waistToHeight: Double?
    var findings: [Finding] = []
    /// 1.0 = normal. > 1 = prioritert muskel (mer volum).
    var priorities: [Muscle: Double] = Dictionary(uniqueKeysWithValues: Muscle.allCases.map { ($0, 1.0) })
    /// Muskler som skal trenes med ettsidige øvelser, og hvilken side som er svakest.
    var unilateralFocus: [Muscle: BodySide] = [:]
    var postureFlags: Set<PostureFlag> = []
    /// 0 = lite, 1 = normal, 2 = høy prioritet på kondisjon/fettap.
    var cardioEmphasis: Int = 1
}

/// Oversetter skannedata til konkrete PT-vurderinger.
enum BodyAnalyzer {

    static func analyze(profile: ProfileData, scan: ScanMeasurements?, previous: ScanMeasurements? = nil) -> BodyAnalysis {
        var a = BodyAnalysis()
        a.cardioEmphasis = profile.goal == .loseFat || profile.goal == .health ? 2 : 1

        // Ønsket kroppsform
        for (m, bias) in profile.physique.muscleBias { a.priorities[m, default: 1] += bias }
        if profile.physique == .defined { a.cardioEmphasis = max(a.cardioEmphasis, 2) }

        // Egne holdningsmål
        if !profile.postureGoals.isDisjoint(with: [.upperBack, .neck, .shoulders]) {
            a.priorities[.upperBack, default: 1] += 0.3
            a.priorities[.lats, default: 1] += 0.1
        }
        if !profile.postureGoals.isDisjoint(with: [.lowerBack, .pelvis]) {
            a.priorities[.abs, default: 1] += 0.25
            a.priorities[.glutes, default: 1] += 0.2
        }
        if profile.postureGoals.contains(.shoulders) || profile.postureGoals.contains(.pelvis) {
            a.postureFlags.insert(profile.postureGoals.contains(.pelvis) ? .hipTilt : .shoulderTilt)
        }

        guard let scan else {
            a.findings.append(Finding(
                title: "Ingen skann ennå",
                detail: "Programmet er laget ut fra profilen din. Skann kroppen for å få det målrettet.",
                action: "Gå til «Skann» og følg instruksjonene.",
                severity: .info))
            return a
        }

        let height = profile.heightCm

        // --- Kroppssammensetning ---
        if let neck = scan.neckCm, let waist = scan.waistCm,
           let bf = BodyComposition.navyBodyFat(sex: profile.sex, heightCm: height, neckCm: neck, waistCm: waist, hipCm: scan.hipCm) {
            a.bodyFatPercent = bf
            a.leanMassKg = BodyComposition.leanMass(weightKg: profile.weightKg, bodyFatPercent: bf)
            let ffmi = BodyComposition.normalizedFFMI(weightKg: profile.weightKg, heightCm: height, bodyFatPercent: bf)
            a.ffmi = ffmi

            let (lean, high) = profile.sex == .male ? (12.0, 25.0) : (20.0, 33.0)
            if bf >= high {
                a.cardioEmphasis = 2
                a.findings.append(Finding(
                    title: String(format: "Fettprosent ca. %.0f %%", bf),
                    detail: "Over anbefalt område. Fettap gir størst helsegevinst nå — styrketreningen sørger for at vekttapet blir fett, ikke muskler.",
                    action: "Kaloriunderskudd på ~20 %, høyt protein, 8–10 000 skritt og sone 2-kondisjon.",
                    severity: .important))
            } else if bf <= lean {
                a.findings.append(Finding(
                    title: String(format: "Fettprosent ca. %.0f %%", bf),
                    detail: "Du er slank — perfekt utgangspunkt for å bygge muskler med et lite overskudd.",
                    action: "Spis 5–10 % over vedlikehold og fokuser på progressiv overbelastning.",
                    severity: .positive))
            }

            let (lowFFMI, highFFMI) = profile.sex == .male ? (19.0, 22.5) : (15.0, 18.5)
            if ffmi < lowFFMI {
                for m in Muscle.allCases where m != .abs && m != .calves { a.priorities[m, default: 1] += 0.1 }
                a.findings.append(Finding(
                    title: String(format: "Muskelmasseindeks (FFMI) %.1f", ffmi),
                    detail: "Under gjennomsnittet — du har mye å hente. Muskelmasse er en av de sterkeste prediktorene for sunn aldring.",
                    action: "Prioriter helkropps styrketrening og 1,6–2,2 g protein per kg.",
                    severity: .attention))
            } else if ffmi >= highFFMI {
                a.findings.append(Finding(
                    title: String(format: "Muskelmasseindeks (FFMI) %.1f", ffmi),
                    detail: "Godt over gjennomsnittet. Videre fremgang krever presis programmering og mer volum på etterslepende muskler.",
                    action: "Programmet fordeler ekstra volum til svakeste muskelgrupper.",
                    severity: .positive))
            }
        }

        if let waist = scan.waistCm {
            let whtr = BodyComposition.waistToHeight(waistCm: waist, heightCm: height)
            a.waistToHeight = whtr
            if whtr >= 0.5 {
                a.cardioEmphasis = 2
                a.findings.append(Finding(
                    title: String(format: "Midje/høyde %.2f", whtr),
                    detail: whtr >= 0.6
                        ? "Betydelig forhøyet — sterkt knyttet til hjerte- og stoffskiftesykdom. Bukfett reagerer godt på trening."
                        : "Over 0,5, grensen for økt risiko. Målet er å holde midjen under halvparten av høyden.",
                    action: "Kondisjon 3×/uke + styrke + kaloriunderskudd. Mål midjen hver 2.–4. uke.",
                    severity: whtr >= 0.6 ? .important : .attention))
            } else {
                a.findings.append(Finding(
                    title: String(format: "Midje/høyde %.2f", whtr),
                    detail: "Innenfor sunt område (< 0,5).",
                    action: "Fortsett — følg med på trenden over tid.",
                    severity: .positive))
            }
        }

        // --- Proporsjoner: over- vs. underkropp ---
        if let arm = scan.upperArmAverage, let thigh = scan.thighAverage, arm > 0 {
            let ratio = thigh / arm
            if ratio < 1.6 {
                for m in [Muscle.quads, .hamstrings, .glutes] { a.priorities[m, default: 1] += 0.35 }
                a.findings.append(Finding(
                    title: "Beina henger etter",
                    detail: String(format: "Lår/overarm-ratio %.2f (typisk 1,7–1,9).", ratio),
                    action: "Ekstra volum til forside lår, bakside lår og sete.",
                    severity: .attention))
            } else if ratio > 2.1 {
                for m in [Muscle.chest, .lats, .sideDelts, .biceps, .triceps] { a.priorities[m, default: 1] += 0.3 }
                a.findings.append(Finding(
                    title: "Overkroppen henger etter",
                    detail: String(format: "Lår/overarm-ratio %.2f (typisk 1,7–1,9).", ratio),
                    action: "Ekstra volum til bryst, rygg, skuldre og armer.",
                    severity: .attention))
            }
        }

        if let chest = scan.chestCm, let waist = scan.waistCm, waist > 0,
           profile.goal == .buildMuscle || profile.goal == .recomposition {
            let ratio = chest / waist
            if ratio < 1.15 {
                a.priorities[.lats, default: 1] += 0.3
                a.priorities[.sideDelts, default: 1] += 0.35
                a.findings.append(Finding(
                    title: "Bygg bredde i overkroppen",
                    detail: String(format: "Bryst/midje-ratio %.2f. Bredere rygg og skuldre gir en sterkere V-form.", ratio),
                    action: "Mer nedtrekk/pull-ups og sidehev.",
                    severity: .info))
            }
        }

        // --- Asymmetri ---
        func checkAsymmetry(left: Double?, right: Double?, muscles: [Muscle], name: String) {
            guard let l = left, let r = right, max(l, r) > 0 else { return }
            let diff = abs(l - r) / max(l, r) * 100
            guard diff >= 4 else { return }
            let weak: BodySide = l < r ? .left : .right
            for m in muscles {
                a.unilateralFocus[m] = weak
                a.priorities[m, default: 1] += 0.15
            }
            a.findings.append(Finding(
                title: "Ubalanse i \(name)",
                detail: String(format: "%@ side er %.1f %% mindre (%.1f vs %.1f cm).", weak.label.capitalized, diff, min(l, r), max(l, r)),
                action: "Ettsidige øvelser, start alltid med \(weak.label) side og match antall reps med den sterke.",
                severity: diff >= 7 ? .important : .attention))
        }
        checkAsymmetry(left: scan.upperArmLeftCm, right: scan.upperArmRightCm, muscles: [.biceps, .triceps], name: "overarmene")
        checkAsymmetry(left: scan.thighLeftCm, right: scan.thighRightCm, muscles: [.quads, .hamstrings, .glutes], name: "lårene")

        if let l = scan.legLengthLeftCm, let r = scan.legLengthRightCm, abs(l - r) >= 1.5 {
            a.findings.append(Finding(
                title: "Mulig beinlengdeforskjell",
                detail: String(format: "Ca. %.1f cm forskjell. Kan være måleunøyaktighet eller skjev stilling under skannet.", abs(l - r)),
                action: "Skann igjen. Har du smerter i rygg/hofte, få det vurdert av fysioterapeut.",
                severity: .info))
        }

        // --- Holdning ---
        if let tilt = scan.shoulderTiltDeg, abs(tilt) >= 2.5 {
            a.postureFlags.insert(.shoulderTilt)
            a.findings.append(Finding(
                title: "Skjeve skuldre",
                detail: String(format: "%@ skulder står ca. %.1f° høyere.", tilt > 0 ? "Venstre" : "Høyre", abs(tilt)),
                action: "Kofferbæring og ettarms øvelser. Bær vesken på motsatt side i hverdagen.",
                severity: .attention))
        }
        if let tilt = scan.hipTiltDeg, abs(tilt) >= 2.5 {
            a.postureFlags.insert(.hipTilt)
            a.findings.append(Finding(
                title: "Skjevt bekken",
                detail: String(format: "%@ hofte står ca. %.1f° høyere.", tilt > 0 ? "Venstre" : "Høyre", abs(tilt)),
                action: "Ettbeins øvelser og kofferbæring. Ofte funksjonelt og ufarlig.",
                severity: .attention))
        }
        if let fh = scan.forwardHeadCm, fh >= 6 {
            a.postureFlags.insert(.forwardHead)
            a.priorities[.upperBack, default: 1] += 0.35
            a.findings.append(Finding(
                title: "Hodet foran skulderlinjen",
                detail: String(format: "Ca. %.0f cm. Holdning henger svakere sammen med smerte enn mange tror, men sterk øvre rygg og variasjon i stillinger hjelper.", fh),
                action: "Mer roing og face pulls (2:1 drag vs. press), chin tucks i oppvarmingen.",
                severity: .attention))
        }

        // --- Fremgang siden forrige skann ---
        if let prev = previous, let w = scan.waistCm, let pw = prev.waistCm {
            let delta = w - pw
            if abs(delta) >= 1 {
                let good = (profile.goal == .loseFat || profile.goal == .recomposition || profile.goal == .health) ? delta < 0 : delta < 2
                a.findings.append(Finding(
                    title: String(format: "Midje %+.1f cm siden forrige skann", delta),
                    detail: good ? "Du er på rett vei." : "Trenden går motsatt vei av målet ditt.",
                    action: good ? "Fortsett slik." : "Juster kaloriene med ~150–250 kcal og sjekk skrittene.",
                    severity: good ? .positive : .attention))
            }
        }

        // Muskelbalanse mot ønsket kroppsform
        let report = MuscleAnalyzer.analyze(profile: profile, scan: scan, bodyFat: a.bodyFatPercent)
        for region in report.regions where region.prioritize {
            for m in region.muscles { a.priorities[m, default: 1] += 0.2 }
        }
        if let rs = scan.roundedShouldersCm, rs >= 5 {
            a.postureFlags.insert(.forwardHead)
            a.priorities[.upperBack, default: 1] += 0.2
        }

        a.findings.sort { $0.severity > $1.severity }
        return a
    }
}
