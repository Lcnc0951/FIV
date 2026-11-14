// GENERERT fra FIV/Coach/ExerciseLibrary.swift — ikke rediger for hånd (npm run gen).
import type { Exercise } from '../engine/types'

export const EXERCISES: Exercise[] = [
 {
  "id": "back_squat",
  "name": "Knebøy med stang",
  "pattern": "squat",
  "primary": "quads",
  "secondary": [
   "glutes"
  ],
  "requires": [
   "barbell",
   "squatRack"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [
   "lowerBack"
  ],
  "cue": "Brace magen før hver rep, knærne følger tærne, gå så dypt du kan med nøytral rygg."
 },
 {
  "id": "hack_squat",
  "name": "Beinpress / hack squat",
  "pattern": "squat",
  "primary": "quads",
  "secondary": [
   "glutes"
  ],
  "requires": [
   "legPressMachine"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Full dybde, kontrollert 2–3 sek ned. Ryggen limt til puten."
 },
 {
  "id": "goblet_squat",
  "name": "Goblet squat",
  "pattern": "squat",
  "primary": "quads",
  "secondary": [
   "glutes"
  ],
  "requires": [],
  "anyOf": [
   "dumbbells",
   "kettlebell"
  ],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Manual inntil brystet, albuer mellom knærne i bunnen. Rolig ned, eksplosivt opp."
 },
 {
  "id": "tempo_squat",
  "name": "Tempo-knebøy (kroppsvekt)",
  "pattern": "squat",
  "primary": "quads",
  "secondary": [
   "glutes"
  ],
  "requires": [],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "4 sek ned, 2 sek pause i bunnen. Gjør det tungt med tempo og ettbeins-varianter."
 },
 {
  "id": "rdl_barbell",
  "name": "Rumensk markløft (stang)",
  "pattern": "hinge",
  "primary": "hamstrings",
  "secondary": [
   "glutes",
   "upperBack"
  ],
  "requires": [
   "barbell"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [
   "lowerBack"
  ],
  "cue": "Skyv hoften bakover, lett bøy i knærne, stangen tett på beina. Stopp når baksiden er strukket."
 },
 {
  "id": "rdl_db",
  "name": "Rumensk markløft (manualer)",
  "pattern": "hinge",
  "primary": "hamstrings",
  "secondary": [
   "glutes"
  ],
  "requires": [],
  "anyOf": [
   "dumbbells",
   "kettlebell"
  ],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Nøytral rygg, hoften bakover. Kjenn strekk i baksiden av låret."
 },
 {
  "id": "hip_thrust",
  "name": "Hip thrust",
  "pattern": "hinge",
  "primary": "glutes",
  "secondary": [
   "hamstrings"
  ],
  "requires": [
   "bench"
  ],
  "anyOf": [
   "barbell",
   "dumbbells",
   "kettlebell"
  ],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Hake mot brystet, bekkenet vippet bakover i toppen, press gjennom hælene. Pause 1 sek øverst."
 },
 {
  "id": "sl_rdl",
  "name": "Ettbeins rumensk markløft",
  "pattern": "hinge",
  "primary": "hamstrings",
  "secondary": [
   "glutes"
  ],
  "requires": [],
  "anyOf": [
   "dumbbells",
   "kettlebell"
  ],
  "unilateral": true,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Hold hoftene parallelle med gulvet. Start med svakeste side."
 },
 {
  "id": "sl_glute_bridge",
  "name": "Ettbeins seteløft",
  "pattern": "hinge",
  "primary": "glutes",
  "secondary": [
   "hamstrings"
  ],
  "requires": [],
  "anyOf": [],
  "unilateral": true,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Skulderne på benk/sofa, press opp gjennom hælen, 2 sek pause i toppen."
 },
 {
  "id": "bulgarian",
  "name": "Bulgarsk utfallsknebøy",
  "pattern": "singleLeg",
  "primary": "quads",
  "secondary": [
   "glutes"
  ],
  "requires": [],
  "anyOf": [
   "dumbbells",
   "kettlebell"
  ],
  "unilateral": true,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Lang fot = mer sete, kort fot = mer forside lår. Gå dypt. Start med svakeste side."
 },
 {
  "id": "walking_lunge",
  "name": "Gående utfall",
  "pattern": "singleLeg",
  "primary": "quads",
  "secondary": [
   "glutes"
  ],
  "requires": [],
  "anyOf": [
   "dumbbells",
   "kettlebell"
  ],
  "unilateral": true,
  "lengthenedBias": false,
  "avoidWith": [
   "knee"
  ],
  "cue": "Lange steg, bakre kne nesten i gulvet, overkropp oppreist."
 },
 {
  "id": "step_up",
  "name": "Step-up",
  "pattern": "singleLeg",
  "primary": "quads",
  "secondary": [
   "glutes"
  ],
  "requires": [],
  "anyOf": [],
  "unilateral": true,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Hele foten på kassen, press opp med fremre bein — ikke spark fra med det bakre."
 },
 {
  "id": "split_squat",
  "name": "Split squat",
  "pattern": "singleLeg",
  "primary": "quads",
  "secondary": [
   "glutes"
  ],
  "requires": [],
  "anyOf": [],
  "unilateral": true,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Rolig ned, bakre kne mot gulvet. Øk med tempo eller ryggsekk."
 },
 {
  "id": "leg_extension",
  "name": "Beinspark (leg extension)",
  "pattern": "kneeExtension",
  "primary": "quads",
  "secondary": [],
  "requires": [
   "legExtensionMachine"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Len setet bakover for mer strekk på rectus femoris. Full bevegelse, kontrollert ned."
 },
 {
  "id": "reverse_nordic",
  "name": "Reverse nordic",
  "pattern": "kneeExtension",
  "primary": "quads",
  "secondary": [],
  "requires": [],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [
   "knee"
  ],
  "cue": "Knestående, rett linje kne–hode, len bakover så langt du kontrollerer."
 },
 {
  "id": "seated_leg_curl",
  "name": "Sittende lårcurl",
  "pattern": "kneeFlexion",
  "primary": "hamstrings",
  "secondary": [],
  "requires": [
   "legCurlMachine"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Sittende gir mer vekst enn liggende (Maeo 2021). Len overkroppen fremover for ekstra strekk."
 },
 {
  "id": "db_leg_curl",
  "name": "Lårcurl med manual / strikk",
  "pattern": "kneeFlexion",
  "primary": "hamstrings",
  "secondary": [],
  "requires": [],
  "anyOf": [
   "dumbbells",
   "resistanceBands"
  ],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Kontrollert ned, ikke svai i korsryggen."
 },
 {
  "id": "nordic",
  "name": "Nordic hamstring curl",
  "pattern": "kneeFlexion",
  "primary": "hamstrings",
  "secondary": [],
  "requires": [],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Halverer risikoen for strekkskader i baksiden av låret (van der Horst 2015). Bremse så sakte du kan."
 },
 {
  "id": "bench_bb",
  "name": "Benkpress (stang)",
  "pattern": "horizontalPush",
  "primary": "chest",
  "secondary": [
   "triceps"
  ],
  "requires": [
   "barbell",
   "bench"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Skulderblad sammen og ned, lett bue, stangen mot nedre del av brystet."
 },
 {
  "id": "bench_db",
  "name": "Benkpress med manualer",
  "pattern": "horizontalPush",
  "primary": "chest",
  "secondary": [
   "triceps"
  ],
  "requires": [
   "dumbbells",
   "bench"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Gå dypt i bunnen for strekk i brystet, albuer ca. 45° ut."
 },
 {
  "id": "incline_db",
  "name": "Skråbenk med manualer",
  "pattern": "horizontalPush",
  "primary": "chest",
  "secondary": [
   "triceps"
  ],
  "requires": [
   "dumbbells",
   "bench"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "15–30° helling. Fokus på øvre bryst og dyp strekk."
 },
 {
  "id": "pushup",
  "name": "Push-ups (deficit)",
  "pattern": "horizontalPush",
  "primary": "chest",
  "secondary": [
   "triceps"
  ],
  "requires": [],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Hendene på bøker/håndtak for ekstra dybde. Kroppen som en planke."
 },
 {
  "id": "dips",
  "name": "Dips",
  "pattern": "horizontalPush",
  "primary": "chest",
  "secondary": [
   "triceps"
  ],
  "requires": [
   "dipBars"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [
   "shoulder"
  ],
  "cue": "Len fremover for mer bryst. Ned til skulderen er under albuen hvis det føles bra."
 },
 {
  "id": "ohp_db",
  "name": "Skulderpress med manualer",
  "pattern": "verticalPush",
  "primary": "sideDelts",
  "secondary": [
   "triceps"
  ],
  "requires": [
   "dumbbells"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Sittende med ryggstøtte. Albuer litt foran kroppen."
 },
 {
  "id": "ohp_bb",
  "name": "Militærpress (stang)",
  "pattern": "verticalPush",
  "primary": "sideDelts",
  "secondary": [
   "triceps"
  ],
  "requires": [
   "barbell"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [
   "shoulder",
   "lowerBack"
  ],
  "cue": "Stram sete og mage, hodet gjennom 'vinduet' i toppen."
 },
 {
  "id": "landmine_press",
  "name": "Landmine press (én arm)",
  "pattern": "verticalPush",
  "primary": "sideDelts",
  "secondary": [
   "chest",
   "triceps"
  ],
  "requires": [
   "barbell"
  ],
  "anyOf": [],
  "unilateral": true,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Skulderskånsom presse-vinkel. Start med svakeste side."
 },
 {
  "id": "pike_pushup",
  "name": "Pike push-ups",
  "pattern": "verticalPush",
  "primary": "sideDelts",
  "secondary": [
   "triceps"
  ],
  "requires": [],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Hoften høyt, hodet ned mellom hendene. Føttene på stol for progresjon."
 },
 {
  "id": "cable_row",
  "name": "Sittende kabelroing",
  "pattern": "horizontalPull",
  "primary": "upperBack",
  "secondary": [
   "lats",
   "biceps"
  ],
  "requires": [
   "cableMachine"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "La skulderbladene gli frem i strekk, trekk albuene bak og ned."
 },
 {
  "id": "chest_supported_row",
  "name": "Brystsupportert manualroing",
  "pattern": "horizontalPull",
  "primary": "upperBack",
  "secondary": [
   "lats",
   "biceps"
  ],
  "requires": [
   "dumbbells",
   "bench"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Brystet på skråbenk — ingen juks med ryggen. Pause 1 sek i toppen."
 },
 {
  "id": "one_arm_row",
  "name": "Enarms manualroing",
  "pattern": "horizontalPull",
  "primary": "lats",
  "secondary": [
   "upperBack",
   "biceps"
  ],
  "requires": [
   "dumbbells"
  ],
  "anyOf": [],
  "unilateral": true,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Trekk albuen mot hofta. Full strekk i bunnen. Start med svakeste side."
 },
 {
  "id": "inverted_row",
  "name": "Inverted row",
  "pattern": "horizontalPull",
  "primary": "upperBack",
  "secondary": [
   "lats",
   "biceps"
  ],
  "requires": [],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Under et bord eller ringer. Brystet til stangen, kroppen strak."
 },
 {
  "id": "lat_pulldown",
  "name": "Nedtrekk",
  "pattern": "verticalPull",
  "primary": "lats",
  "secondary": [
   "biceps"
  ],
  "requires": [
   "latPulldown"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Full strekk i toppen, trekk albuene ned mot lommene."
 },
 {
  "id": "single_arm_pulldown",
  "name": "Enarms kabelnedtrekk",
  "pattern": "verticalPull",
  "primary": "lats",
  "secondary": [
   "biceps"
  ],
  "requires": [
   "cableMachine"
  ],
  "anyOf": [],
  "unilateral": true,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Len litt mot siden for maksimal strekk. Start med svakeste side."
 },
 {
  "id": "pullup",
  "name": "Pull-ups",
  "pattern": "verticalPull",
  "primary": "lats",
  "secondary": [
   "biceps",
   "upperBack"
  ],
  "requires": [
   "pullUpBar"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Død heng i bunnen, brystet mot stangen. Bruk strikk eller negative reps om nødvendig."
 },
 {
  "id": "band_pulldown",
  "name": "Nedtrekk med strikk",
  "pattern": "verticalPull",
  "primary": "lats",
  "secondary": [
   "biceps"
  ],
  "requires": [
   "resistanceBands"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Strikk festet høyt, trekk albuene ned og inn."
 },
 {
  "id": "cable_fly",
  "name": "Kabelflyes",
  "pattern": "chestFly",
  "primary": "chest",
  "secondary": [],
  "requires": [
   "cableMachine"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Myk albue, la brystet strekkes fullt bakover. Fokus på den nedre halvdelen av bevegelsen."
 },
 {
  "id": "db_fly",
  "name": "Flyes med manualer",
  "pattern": "chestFly",
  "primary": "chest",
  "secondary": [],
  "requires": [
   "dumbbells",
   "bench"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Gå dypt og kontrollert. Stopp før manualene møtes."
 },
 {
  "id": "cable_lateral",
  "name": "Kabel-sidehev bak kroppen",
  "pattern": "lateralRaise",
  "primary": "sideDelts",
  "secondary": [],
  "requires": [
   "cableMachine"
  ],
  "anyOf": [],
  "unilateral": true,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Kabelen bak kroppen gir belastning i strukket posisjon. Lede med albuen."
 },
 {
  "id": "db_lateral",
  "name": "Sidehev med manualer",
  "pattern": "lateralRaise",
  "primary": "sideDelts",
  "secondary": [],
  "requires": [
   "dumbbells"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Len deg litt fremover, løft ut til siden til skulderhøyde. Lett vekt, mange reps."
 },
 {
  "id": "lean_away_lateral",
  "name": "Ettarms sidehev lent fra stolpe",
  "pattern": "lateralRaise",
  "primary": "sideDelts",
  "secondary": [],
  "requires": [],
  "anyOf": [],
  "unilateral": true,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Bruk vannflaske/sekk. Len deg ut fra en dørkarm for mer strekk i bunnen."
 },
 {
  "id": "face_pull",
  "name": "Face pulls",
  "pattern": "rearDelt",
  "primary": "upperBack",
  "secondary": [],
  "requires": [
   "cableMachine"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Trekk mot pannen, roter armene utover. Fin for skulderhelse og fremoverlutet holdning."
 },
 {
  "id": "reverse_fly",
  "name": "Bakre skulder-flyes",
  "pattern": "rearDelt",
  "primary": "upperBack",
  "secondary": [],
  "requires": [
   "dumbbells"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Liggende på skråbenk eller foroverbøyd. Små vekter, kontroller toppen."
 },
 {
  "id": "band_pull_apart",
  "name": "Band pull-aparts",
  "pattern": "rearDelt",
  "primary": "upperBack",
  "secondary": [],
  "requires": [
   "resistanceBands"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Strake armer, dra strikken mot brystet og klem skulderbladene."
 },
 {
  "id": "ytw",
  "name": "Y-T-W liggende",
  "pattern": "rearDelt",
  "primary": "upperBack",
  "secondary": [],
  "requires": [],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Mageliggende, tomlene opp. Hold 2 sek i hver posisjon."
 },
 {
  "id": "incline_curl",
  "name": "Skråbenk-curl",
  "pattern": "elbowFlexion",
  "primary": "biceps",
  "secondary": [],
  "requires": [
   "dumbbells",
   "bench"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Armene henger bak kroppen = maksimal strekk på biceps. Ingen sving."
 },
 {
  "id": "bayesian_curl",
  "name": "Bayesian kabelcurl",
  "pattern": "elbowFlexion",
  "primary": "biceps",
  "secondary": [],
  "requires": [
   "cableMachine"
  ],
  "anyOf": [],
  "unilateral": true,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Rygg mot kabelen, armen bak kroppen. Start med svakeste arm."
 },
 {
  "id": "hammer_curl",
  "name": "Hammercurl",
  "pattern": "elbowFlexion",
  "primary": "biceps",
  "secondary": [],
  "requires": [
   "dumbbells"
  ],
  "anyOf": [],
  "unilateral": true,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Nøytralt grep — treffer også brachialis og underarm."
 },
 {
  "id": "chinup",
  "name": "Chin-ups (underhåndsgrep)",
  "pattern": "elbowFlexion",
  "primary": "biceps",
  "secondary": [
   "lats"
  ],
  "requires": [
   "pullUpBar"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Skulderbreddes underhåndsgrep. Full strekk i bunnen."
 },
 {
  "id": "overhead_cable_ext",
  "name": "Triceps overhead (kabel)",
  "pattern": "elbowExtension",
  "primary": "triceps",
  "secondary": [],
  "requires": [
   "cableMachine"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Overhead-varianter gir ~40 % mer vekst enn pushdowns (Maeo 2023)."
 },
 {
  "id": "db_overhead_ext",
  "name": "Fransk press over hodet (manual)",
  "pattern": "elbowExtension",
  "primary": "triceps",
  "secondary": [],
  "requires": [
   "dumbbells"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Albuene peker opp, senk manualen dypt bak hodet."
 },
 {
  "id": "pushdown",
  "name": "Triceps pushdown",
  "pattern": "elbowExtension",
  "primary": "triceps",
  "secondary": [],
  "requires": [
   "cableMachine"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Albuene i ro inntil kroppen. Lås ut i bunnen."
 },
 {
  "id": "diamond_pushup",
  "name": "Diamant push-ups",
  "pattern": "elbowExtension",
  "primary": "triceps",
  "secondary": [
   "chest"
  ],
  "requires": [],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Hendene tett sammen under brystet. Albuene langs kroppen."
 },
 {
  "id": "standing_calf",
  "name": "Tåhev i beinpress / maskin",
  "pattern": "calfRaise",
  "primary": "calves",
  "secondary": [],
  "requires": [
   "legPressMachine"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "2 sek pause i bunnen i full strekk — der skjer veksten."
 },
 {
  "id": "sl_calf",
  "name": "Ettbeins tåhev på trappetrinn",
  "pattern": "calfRaise",
  "primary": "calves",
  "secondary": [],
  "requires": [],
  "anyOf": [],
  "unilateral": true,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Hæl dypt ned, pause, helt opp på tå. Hold manual for progresjon."
 },
 {
  "id": "cable_crunch",
  "name": "Kabelcrunch",
  "pattern": "core",
  "primary": "abs",
  "secondary": [],
  "requires": [
   "cableMachine"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Rull ryggen ned som en ball — tenk ribbein mot hofte."
 },
 {
  "id": "pallof",
  "name": "Pallof press",
  "pattern": "core",
  "primary": "abs",
  "secondary": [],
  "requires": [],
  "anyOf": [
   "cableMachine",
   "resistanceBands"
  ],
  "unilateral": true,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Anti-rotasjon. Stå sidelengs til strikken og press rett frem uten å vri deg."
 },
 {
  "id": "hanging_leg_raise",
  "name": "Hengende kneløft",
  "pattern": "core",
  "primary": "abs",
  "secondary": [],
  "requires": [
   "pullUpBar"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Vipp bekkenet opp, ikke bare løft beina. Ingen sving."
 },
 {
  "id": "dead_bug",
  "name": "Dead bug",
  "pattern": "core",
  "primary": "abs",
  "secondary": [],
  "requires": [],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Korsryggen presset mot gulvet hele tiden. Pust ut når du strekker."
 },
 {
  "id": "suitcase_carry",
  "name": "Kofferbæring (én hånd)",
  "pattern": "carry",
  "primary": "abs",
  "secondary": [
   "upperBack"
  ],
  "requires": [],
  "anyOf": [
   "dumbbells",
   "kettlebell"
  ],
  "unilateral": true,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Tung manual i én hånd, gå rett uten å lene deg. Super for skjeve skuldre/hofter."
 },
 {
  "id": "kb_swing",
  "name": "Kettlebell swing",
  "pattern": "hinge",
  "primary": "glutes",
  "secondary": [
   "hamstrings"
  ],
  "requires": [
   "kettlebell"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Eksplosiv hoftestrekk — armene er bare tau. Stram sete og mage i toppen. Også supert som intervall-kondisjon."
 },
 {
  "id": "band_row",
  "name": "Roing med strikk",
  "pattern": "horizontalPull",
  "primary": "upperBack",
  "secondary": [
   "lats",
   "biceps"
  ],
  "requires": [
   "resistanceBands"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Strikk rundt en stolpe eller dørhåndtak. Trekk albuene bak og klem skulderbladene."
 },
 {
  "id": "trx_row",
  "name": "TRX-/ringroing",
  "pattern": "horizontalPull",
  "primary": "upperBack",
  "secondary": [
   "lats",
   "biceps"
  ],
  "requires": [
   "trxRings"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Jo mer vannrett kroppen er, jo tyngre. Full strekk i bunnen."
 },
 {
  "id": "band_lateral",
  "name": "Sidehev med strikk",
  "pattern": "lateralRaise",
  "primary": "sideDelts",
  "secondary": [],
  "requires": [
   "resistanceBands"
  ],
  "anyOf": [],
  "unilateral": true,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Stå på strikken med motsatt fot. Løft ut til skulderhøyde, rolig ned."
 },
 {
  "id": "band_face_pull",
  "name": "Face pulls med strikk",
  "pattern": "rearDelt",
  "primary": "upperBack",
  "secondary": [],
  "requires": [
   "resistanceBands"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Strikken festet i øyehøyde. Trekk mot pannen og roter armene utover."
 },
 {
  "id": "band_pushdown",
  "name": "Triceps pushdown med strikk",
  "pattern": "elbowExtension",
  "primary": "triceps",
  "secondary": [],
  "requires": [
   "resistanceBands"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [],
  "cue": "Strikken festet høyt. Albuene i ro inntil kroppen."
 },
 {
  "id": "kb_goblet_calf",
  "name": "Tåhev med vekt",
  "pattern": "calfRaise",
  "primary": "calves",
  "secondary": [],
  "requires": [],
  "anyOf": [
   "dumbbells",
   "kettlebell"
  ],
  "unilateral": false,
  "lengthenedBias": true,
  "avoidWith": [],
  "cue": "Fremfoten på et trappetrinn, hold vekt. Pause 2 sek i bunnen."
 },
 {
  "id": "dips_bench",
  "name": "Benkdips",
  "pattern": "elbowExtension",
  "primary": "triceps",
  "secondary": [
   "chest"
  ],
  "requires": [
   "bench"
  ],
  "anyOf": [],
  "unilateral": false,
  "lengthenedBias": false,
  "avoidWith": [
   "shoulder"
  ],
  "cue": "Hendene på benk bak deg, albuene peker rett bak. Ikke gå dypere enn det kjennes bra i skulderen."
 }
] as Exercise[]
