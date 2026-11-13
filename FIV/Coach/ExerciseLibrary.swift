import Foundation

enum MovementPattern: String, Codable, CaseIterable {
    case squat, hinge, singleLeg, kneeExtension, kneeFlexion
    case horizontalPush, verticalPush, horizontalPull, verticalPull
    case chestFly, lateralRaise, rearDelt, elbowFlexion, elbowExtension
    case calfRaise, core, carry

    var isCompound: Bool {
        switch self {
        case .squat, .hinge, .singleLeg, .horizontalPush, .verticalPush, .horizontalPull, .verticalPull, .carry: true
        default: false
        }
    }
}

struct Exercise: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let pattern: MovementPattern
    let primary: Muscle
    let secondary: [Muscle]
    /// Minste utstyrsnivå som kreves.
    let equipment: Equipment
    var unilateral: Bool = false
    /// Øvelsen belaster muskelen i forlenget posisjon (sterkt evidensgrunnlag for hypertrofi, Maeo 2021/2023, Pedrosa 2022).
    var lengthenedBias: Bool = false
    var avoidWith: Set<Limitation> = []
    let cue: String
}

enum ExerciseLibrary {
    static func exercise(id: String) -> Exercise? { byId[id] }

    private static let byId: [String: Exercise] = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })

    static let all: [Exercise] = [
        // Knebøy
        Exercise(id: "back_squat", name: "Knebøy med stang", pattern: .squat, primary: .quads, secondary: [.glutes],
                 equipment: .fullGym, lengthenedBias: true, avoidWith: [.lowerBack],
                 cue: "Brace magen før hver rep, knærne følger tærne, gå så dypt du kan med nøytral rygg."),
        Exercise(id: "hack_squat", name: "Hack squat / beinpress", pattern: .squat, primary: .quads, secondary: [.glutes],
                 equipment: .fullGym, lengthenedBias: true,
                 cue: "Full dybde, kontrollert 2–3 sek ned. Ryggen limt til puten."),
        Exercise(id: "goblet_squat", name: "Goblet squat", pattern: .squat, primary: .quads, secondary: [.glutes],
                 equipment: .homeDumbbells, lengthenedBias: true,
                 cue: "Manual inntil brystet, albuer mellom knærne i bunnen. Rolig ned, eksplosivt opp."),
        Exercise(id: "tempo_squat", name: "Tempo-knebøy (kroppsvekt)", pattern: .squat, primary: .quads, secondary: [.glutes],
                 equipment: .bodyweight,
                 cue: "4 sek ned, 2 sek pause i bunnen. Gjør det tungt med tempo og ettbeins-varianter."),

        // Hoftehengsel
        Exercise(id: "rdl_barbell", name: "Rumensk markløft (stang)", pattern: .hinge, primary: .hamstrings, secondary: [.glutes, .upperBack],
                 equipment: .fullGym, lengthenedBias: true, avoidWith: [.lowerBack],
                 cue: "Skyv hoften bakover, lett bøy i knærne, stangen tett på beina. Stopp når baksiden er strukket."),
        Exercise(id: "rdl_db", name: "Rumensk markløft (manualer)", pattern: .hinge, primary: .hamstrings, secondary: [.glutes],
                 equipment: .homeDumbbells, lengthenedBias: true,
                 cue: "Nøytral rygg, hoften bakover. Kjenn strekk i baksiden av låret."),
        Exercise(id: "hip_thrust", name: "Hip thrust", pattern: .hinge, primary: .glutes, secondary: [.hamstrings],
                 equipment: .homeDumbbells,
                 cue: "Hake mot brystet, bekkenet vippet bakover i toppen, press gjennom hælene. Pause 1 sek øverst."),
        Exercise(id: "sl_rdl", name: "Ettbeins rumensk markløft", pattern: .hinge, primary: .hamstrings, secondary: [.glutes],
                 equipment: .homeDumbbells, unilateral: true, lengthenedBias: true,
                 cue: "Hold hoftene parallelle med gulvet. Start med svakeste side."),
        Exercise(id: "sl_glute_bridge", name: "Ettbeins seteløft", pattern: .hinge, primary: .glutes, secondary: [.hamstrings],
                 equipment: .bodyweight, unilateral: true,
                 cue: "Skulderne på benk/sofa, press opp gjennom hælen, 2 sek pause i toppen."),

        // Ettbeins
        Exercise(id: "bulgarian", name: "Bulgarsk utfallsknebøy", pattern: .singleLeg, primary: .quads, secondary: [.glutes],
                 equipment: .homeDumbbells, unilateral: true, lengthenedBias: true,
                 cue: "Lang fot = mer sete, kort fot = mer forside lår. Gå dypt. Start med svakeste side."),
        Exercise(id: "walking_lunge", name: "Gående utfall", pattern: .singleLeg, primary: .quads, secondary: [.glutes],
                 equipment: .homeDumbbells, unilateral: true, avoidWith: [.knee],
                 cue: "Lange steg, bakre kne nesten i gulvet, overkropp oppreist."),
        Exercise(id: "step_up", name: "Step-up", pattern: .singleLeg, primary: .quads, secondary: [.glutes],
                 equipment: .bodyweight, unilateral: true,
                 cue: "Hele foten på kassen, press opp med fremre bein — ikke spark fra med det bakre."),
        Exercise(id: "split_squat", name: "Split squat", pattern: .singleLeg, primary: .quads, secondary: [.glutes],
                 equipment: .bodyweight, unilateral: true, lengthenedBias: true,
                 cue: "Rolig ned, bakre kne mot gulvet. Øk med tempo eller ryggsekk."),

        // Kneekstensjon
        Exercise(id: "leg_extension", name: "Beinspark (leg extension)", pattern: .kneeExtension, primary: .quads, secondary: [],
                 equipment: .fullGym, lengthenedBias: true,
                 cue: "Len setet bakover for mer strekk på rectus femoris. Full bevegelse, kontrollert ned."),
        Exercise(id: "reverse_nordic", name: "Reverse nordic", pattern: .kneeExtension, primary: .quads, secondary: [],
                 equipment: .bodyweight, lengthenedBias: true, avoidWith: [.knee],
                 cue: "Knestående, rett linje kne–hode, len bakover så langt du kontrollerer."),

        // Knefleksjon
        Exercise(id: "seated_leg_curl", name: "Sittende lårcurl", pattern: .kneeFlexion, primary: .hamstrings, secondary: [],
                 equipment: .fullGym, lengthenedBias: true,
                 cue: "Sittende gir mer vekst enn liggende (Maeo 2021). Len overkroppen fremover for ekstra strekk."),
        Exercise(id: "db_leg_curl", name: "Lårcurl med manual / strikk", pattern: .kneeFlexion, primary: .hamstrings, secondary: [],
                 equipment: .homeDumbbells,
                 cue: "Kontrollert ned, ikke svai i korsryggen."),
        Exercise(id: "nordic", name: "Nordic hamstring curl", pattern: .kneeFlexion, primary: .hamstrings, secondary: [],
                 equipment: .bodyweight, lengthenedBias: true,
                 cue: "Halverer risikoen for strekkskader i baksiden av låret (van der Horst 2015). Bremse så sakte du kan."),

        // Horisontalt press
        Exercise(id: "bench_bb", name: "Benkpress (stang)", pattern: .horizontalPush, primary: .chest, secondary: [.triceps],
                 equipment: .fullGym,
                 cue: "Skulderblad sammen og ned, lett bue, stangen mot nedre del av brystet."),
        Exercise(id: "bench_db", name: "Benkpress med manualer", pattern: .horizontalPush, primary: .chest, secondary: [.triceps],
                 equipment: .homeDumbbells, lengthenedBias: true,
                 cue: "Gå dypt i bunnen for strekk i brystet, albuer ca. 45° ut."),
        Exercise(id: "incline_db", name: "Skråbenk med manualer", pattern: .horizontalPush, primary: .chest, secondary: [.triceps],
                 equipment: .homeDumbbells, lengthenedBias: true,
                 cue: "15–30° helling. Fokus på øvre bryst og dyp strekk."),
        Exercise(id: "pushup", name: "Push-ups (deficit)", pattern: .horizontalPush, primary: .chest, secondary: [.triceps],
                 equipment: .bodyweight, lengthenedBias: true,
                 cue: "Hendene på bøker/håndtak for ekstra dybde. Kroppen som en planke."),
        Exercise(id: "dips", name: "Dips", pattern: .horizontalPush, primary: .chest, secondary: [.triceps],
                 equipment: .fullGym, avoidWith: [.shoulder],
                 cue: "Len fremover for mer bryst. Ned til skulderen er under albuen hvis det føles bra."),

        // Vertikalt press
        Exercise(id: "ohp_db", name: "Skulderpress med manualer", pattern: .verticalPush, primary: .sideDelts, secondary: [.triceps],
                 equipment: .homeDumbbells,
                 cue: "Sittende med ryggstøtte. Albuer litt foran kroppen."),
        Exercise(id: "ohp_bb", name: "Militærpress (stang)", pattern: .verticalPush, primary: .sideDelts, secondary: [.triceps],
                 equipment: .fullGym, avoidWith: [.shoulder, .lowerBack],
                 cue: "Stram sete og mage, hodet gjennom 'vinduet' i toppen."),
        Exercise(id: "landmine_press", name: "Landmine press (én arm)", pattern: .verticalPush, primary: .sideDelts, secondary: [.chest, .triceps],
                 equipment: .fullGym, unilateral: true,
                 cue: "Skulderskånsom presse-vinkel. Start med svakeste side."),
        Exercise(id: "pike_pushup", name: "Pike push-ups", pattern: .verticalPush, primary: .sideDelts, secondary: [.triceps],
                 equipment: .bodyweight,
                 cue: "Hoften høyt, hodet ned mellom hendene. Føttene på stol for progresjon."),

        // Horisontalt drag
        Exercise(id: "cable_row", name: "Sittende kabelroing", pattern: .horizontalPull, primary: .upperBack, secondary: [.lats, .biceps],
                 equipment: .fullGym, lengthenedBias: true,
                 cue: "La skulderbladene gli frem i strekk, trekk albuene bak og ned."),
        Exercise(id: "chest_supported_row", name: "Brystsupportert manualroing", pattern: .horizontalPull, primary: .upperBack, secondary: [.lats, .biceps],
                 equipment: .homeDumbbells,
                 cue: "Brystet på skråbenk — ingen juks med ryggen. Pause 1 sek i toppen."),
        Exercise(id: "one_arm_row", name: "Enarms manualroing", pattern: .horizontalPull, primary: .lats, secondary: [.upperBack, .biceps],
                 equipment: .homeDumbbells, unilateral: true, lengthenedBias: true,
                 cue: "Trekk albuen mot hofta. Full strekk i bunnen. Start med svakeste side."),
        Exercise(id: "inverted_row", name: "Inverted row", pattern: .horizontalPull, primary: .upperBack, secondary: [.lats, .biceps],
                 equipment: .bodyweight,
                 cue: "Under et bord eller ringer. Brystet til stangen, kroppen strak."),

        // Vertikalt drag
        Exercise(id: "lat_pulldown", name: "Nedtrekk", pattern: .verticalPull, primary: .lats, secondary: [.biceps],
                 equipment: .fullGym, lengthenedBias: true,
                 cue: "Full strekk i toppen, trekk albuene ned mot lommene."),
        Exercise(id: "single_arm_pulldown", name: "Enarms kabelnedtrekk", pattern: .verticalPull, primary: .lats, secondary: [.biceps],
                 equipment: .fullGym, unilateral: true, lengthenedBias: true,
                 cue: "Len litt mot siden for maksimal strekk. Start med svakeste side."),
        Exercise(id: "pullup", name: "Pull-ups", pattern: .verticalPull, primary: .lats, secondary: [.biceps, .upperBack],
                 equipment: .bodyweight, lengthenedBias: true,
                 cue: "Død heng i bunnen, brystet mot stangen. Bruk strikk eller negative reps om nødvendig."),
        Exercise(id: "band_pulldown", name: "Nedtrekk med strikk", pattern: .verticalPull, primary: .lats, secondary: [.biceps],
                 equipment: .homeDumbbells,
                 cue: "Strikk festet høyt, trekk albuene ned og inn."),

        // Flyes
        Exercise(id: "cable_fly", name: "Kabelflyes", pattern: .chestFly, primary: .chest, secondary: [],
                 equipment: .fullGym, lengthenedBias: true,
                 cue: "Myk albue, la brystet strekkes fullt bakover. Fokus på den nedre halvdelen av bevegelsen."),
        Exercise(id: "db_fly", name: "Flyes med manualer", pattern: .chestFly, primary: .chest, secondary: [],
                 equipment: .homeDumbbells, lengthenedBias: true,
                 cue: "Gå dypt og kontrollert. Stopp før manualene møtes."),

        // Sidehev
        Exercise(id: "cable_lateral", name: "Kabel-sidehev bak kroppen", pattern: .lateralRaise, primary: .sideDelts, secondary: [],
                 equipment: .fullGym, unilateral: true, lengthenedBias: true,
                 cue: "Kabelen bak kroppen gir belastning i strukket posisjon. Lede med albuen."),
        Exercise(id: "db_lateral", name: "Sidehev med manualer", pattern: .lateralRaise, primary: .sideDelts, secondary: [],
                 equipment: .homeDumbbells,
                 cue: "Len deg litt fremover, løft ut til siden til skulderhøyde. Lett vekt, mange reps."),
        Exercise(id: "lean_away_lateral", name: "Ettarms sidehev lent fra stolpe", pattern: .lateralRaise, primary: .sideDelts, secondary: [],
                 equipment: .bodyweight, unilateral: true, lengthenedBias: true,
                 cue: "Bruk vannflaske/sekk. Len deg ut fra en dørkarm for mer strekk i bunnen."),

        // Bakre skulder / øvre rygg
        Exercise(id: "face_pull", name: "Face pulls", pattern: .rearDelt, primary: .upperBack, secondary: [],
                 equipment: .fullGym,
                 cue: "Trekk mot pannen, roter armene utover. Fin for skulderhelse og fremoverlutet holdning."),
        Exercise(id: "reverse_fly", name: "Bakre skulder-flyes", pattern: .rearDelt, primary: .upperBack, secondary: [],
                 equipment: .homeDumbbells,
                 cue: "Liggende på skråbenk eller foroverbøyd. Små vekter, kontroller toppen."),
        Exercise(id: "band_pull_apart", name: "Band pull-aparts", pattern: .rearDelt, primary: .upperBack, secondary: [],
                 equipment: .homeDumbbells,
                 cue: "Strake armer, dra strikken mot brystet og klem skulderbladene."),
        Exercise(id: "ytw", name: "Y-T-W liggende", pattern: .rearDelt, primary: .upperBack, secondary: [],
                 equipment: .bodyweight,
                 cue: "Mageliggende, tomlene opp. Hold 2 sek i hver posisjon."),

        // Biceps
        Exercise(id: "incline_curl", name: "Skråbenk-curl", pattern: .elbowFlexion, primary: .biceps, secondary: [],
                 equipment: .homeDumbbells, lengthenedBias: true,
                 cue: "Armene henger bak kroppen = maksimal strekk på biceps. Ingen sving."),
        Exercise(id: "bayesian_curl", name: "Bayesian kabelcurl", pattern: .elbowFlexion, primary: .biceps, secondary: [],
                 equipment: .fullGym, unilateral: true, lengthenedBias: true,
                 cue: "Rygg mot kabelen, armen bak kroppen. Start med svakeste arm."),
        Exercise(id: "hammer_curl", name: "Hammercurl", pattern: .elbowFlexion, primary: .biceps, secondary: [],
                 equipment: .homeDumbbells, unilateral: true,
                 cue: "Nøytralt grep — treffer også brachialis og underarm."),
        Exercise(id: "chinup", name: "Chin-ups (underhåndsgrep)", pattern: .elbowFlexion, primary: .biceps, secondary: [.lats],
                 equipment: .bodyweight, lengthenedBias: true,
                 cue: "Skulderbreddes underhåndsgrep. Full strekk i bunnen."),

        // Triceps
        Exercise(id: "overhead_cable_ext", name: "Triceps overhead (kabel)", pattern: .elbowExtension, primary: .triceps, secondary: [],
                 equipment: .fullGym, lengthenedBias: true,
                 cue: "Overhead-varianter gir ~40 % mer vekst enn pushdowns (Maeo 2023)."),
        Exercise(id: "db_overhead_ext", name: "Fransk press over hodet (manual)", pattern: .elbowExtension, primary: .triceps, secondary: [],
                 equipment: .homeDumbbells, lengthenedBias: true,
                 cue: "Albuene peker opp, senk manualen dypt bak hodet."),
        Exercise(id: "pushdown", name: "Triceps pushdown", pattern: .elbowExtension, primary: .triceps, secondary: [],
                 equipment: .fullGym,
                 cue: "Albuene i ro inntil kroppen. Lås ut i bunnen."),
        Exercise(id: "diamond_pushup", name: "Diamant push-ups", pattern: .elbowExtension, primary: .triceps, secondary: [.chest],
                 equipment: .bodyweight,
                 cue: "Hendene tett sammen under brystet. Albuene langs kroppen."),

        // Legger
        Exercise(id: "standing_calf", name: "Stående tåhev (maskin)", pattern: .calfRaise, primary: .calves, secondary: [],
                 equipment: .fullGym, lengthenedBias: true,
                 cue: "2 sek pause i bunnen i full strekk — der skjer veksten."),
        Exercise(id: "sl_calf", name: "Ettbeins tåhev på trappetrinn", pattern: .calfRaise, primary: .calves, secondary: [],
                 equipment: .bodyweight, unilateral: true, lengthenedBias: true,
                 cue: "Hæl dypt ned, pause, helt opp på tå. Hold manual for progresjon."),

        // Kjerne
        Exercise(id: "cable_crunch", name: "Kabelcrunch", pattern: .core, primary: .abs, secondary: [],
                 equipment: .fullGym,
                 cue: "Rull ryggen ned som en ball — tenk ribbein mot hofte."),
        Exercise(id: "pallof", name: "Pallof press", pattern: .core, primary: .abs, secondary: [],
                 equipment: .homeDumbbells, unilateral: true,
                 cue: "Anti-rotasjon. Stå sidelengs til strikken og press rett frem uten å vri deg."),
        Exercise(id: "hanging_leg_raise", name: "Hengende kneløft", pattern: .core, primary: .abs, secondary: [],
                 equipment: .bodyweight,
                 cue: "Vipp bekkenet opp, ikke bare løft beina. Ingen sving."),
        Exercise(id: "dead_bug", name: "Dead bug", pattern: .core, primary: .abs, secondary: [],
                 equipment: .bodyweight,
                 cue: "Korsryggen presset mot gulvet hele tiden. Pust ut når du strekker."),

        // Bæring
        Exercise(id: "suitcase_carry", name: "Kofferbæring (én hånd)", pattern: .carry, primary: .abs, secondary: [.upperBack],
                 equipment: .homeDumbbells, unilateral: true,
                 cue: "Tung manual i én hånd, gå rett uten å lene deg. Super for skjeve skuldre/hofter."),
    ]

    /// Velger beste øvelse for et bevegelsesmønster gitt brukerens forutsetninger.
    static func select(pattern: MovementPattern,
                       equipment: Equipment,
                       limitations: Set<Limitation>,
                       preferPrimary: Muscle? = nil,
                       preferUnilateral: Bool = false,
                       occurrence: Int = 0,
                       exclude: Set<String> = []) -> Exercise? {
        let candidates = all.filter {
            $0.pattern == pattern &&
            $0.equipment.rank <= equipment.rank &&
            $0.avoidWith.isDisjoint(with: limitations) &&
            !exclude.contains($0.id)
        }
        guard !candidates.isEmpty else { return nil }

        func score(_ e: Exercise) -> Int {
            var s = 0
            if let p = preferPrimary, e.primary == p { s += 40 }
            if preferUnilateral && e.unilateral { s += 25 }
            if e.lengthenedBias { s += 10 }
            // Bruk mest mulig av tilgjengelig utstyr (maskiner/stenger gir enklere progresjon)
            s += e.equipment.rank * 6
            return s
        }
        let ranked = candidates.sorted { score($0) > score($1) || (score($0) == score($1) && $0.id < $1.id) }
        // Roter mellom nesten like gode varianter når mønsteret går igjen i uka.
        let best = score(ranked[0])
        let top = ranked.filter { score($0) >= best - 5 }.prefix(3)
        return Array(top)[occurrence % top.count]
    }
}
