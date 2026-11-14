// Port av BodyAnalyzer.swift + MusclePostureAnalyzer.swift.
import { leanMass, navyBodyFat, normalizedFFMI } from './composition'
import { avg, MUSCLES, PHYSIQUE_INFO, type BodySide, type Muscle, type PostureGoal, type ProfileData, type ScanMeasurements } from './types'

export type Severity = 0 | 1 | 2 | 3 // positiv, info, obs, viktig
export interface Finding { title: string; detail: string; action: string; severity: Severity }
export type PostureFlag = 'forwardHead' | 'shoulderTilt' | 'hipTilt'

export interface BodyAnalysis {
  bodyFatPercent?: number
  leanMassKg?: number
  ffmi?: number
  waistToHeight?: number
  findings: Finding[]
  priorities: Record<Muscle, number>
  unilateralFocus: Partial<Record<Muscle, BodySide>>
  postureFlags: Set<PostureFlag>
  cardioEmphasis: number
}

const f0 = (v: number) => v.toFixed(0)
const f1 = (v: number) => v.toFixed(1).replace('.', ',')
const f2 = (v: number) => v.toFixed(2).replace('.', ',')

export function analyzeBody(profile: ProfileData, scan?: ScanMeasurements, previous?: ScanMeasurements): BodyAnalysis {
  const a: BodyAnalysis = {
    findings: [], priorities: Object.fromEntries(MUSCLES.map((m) => [m, 1])) as Record<Muscle, number>,
    unilateralFocus: {}, postureFlags: new Set(), cardioEmphasis: profile.goal === 'loseFat' || profile.goal === 'health' ? 2 : 1,
  }
  const add = (m: Muscle, v: number) => { a.priorities[m] += v }
  const pg = new Set(profile.postureGoals)

  for (const [m, b] of Object.entries(PHYSIQUE_INFO[profile.physique].bias)) add(m as Muscle, b!)
  if (profile.physique === 'defined') a.cardioEmphasis = Math.max(a.cardioEmphasis, 2)
  if (pg.has('upperBack') || pg.has('neck') || pg.has('shoulders')) { add('upperBack', 0.3); add('lats', 0.1) }
  if (pg.has('lowerBack') || pg.has('pelvis')) { add('abs', 0.25); add('glutes', 0.2) }
  if (pg.has('shoulders') || pg.has('pelvis')) a.postureFlags.add(pg.has('pelvis') ? 'hipTilt' : 'shoulderTilt')

  if (!scan) {
    a.findings.push({ title: 'Ingen skann ennå', detail: 'Programmet er laget ut fra profilen din. Skann kroppen for å få det målrettet.',
      action: 'Gå til «Skann» og følg instruksjonene.', severity: 1 })
    return a
  }
  const h = profile.heightCm
  const male = profile.sex === 'male'

  if (scan.neckCm != null && scan.waistCm != null) {
    const bf = navyBodyFat(profile.sex, h, scan.neckCm, scan.waistCm, scan.hipCm)
    if (bf != null) {
      a.bodyFatPercent = bf
      a.leanMassKg = leanMass(profile.weightKg, bf)
      const ffmi = normalizedFFMI(profile.weightKg, h, bf)
      a.ffmi = ffmi
      const [lean, high] = male ? [12, 25] : [20, 33]
      if (bf >= high) {
        a.cardioEmphasis = 2
        a.findings.push({ title: `Fettprosent ca. ${f0(bf)} %`, severity: 3,
          detail: 'Over anbefalt område. Fettap gir størst helsegevinst nå — styrketreningen sørger for at vekttapet blir fett, ikke muskler.',
          action: 'Kaloriunderskudd på ~20 %, høyt protein, 8–10 000 skritt og sone 2-kondisjon.' })
      } else if (bf <= lean) {
        a.findings.push({ title: `Fettprosent ca. ${f0(bf)} %`, severity: 0,
          detail: 'Du er slank — perfekt utgangspunkt for å bygge muskler med et lite overskudd.',
          action: 'Spis 5–10 % over vedlikehold og fokuser på progressiv overbelastning.' })
      }
      const [lowF, highF] = male ? [19, 22.5] : [15, 18.5]
      if (ffmi < lowF) {
        for (const m of MUSCLES) if (m !== 'abs' && m !== 'calves') add(m, 0.1)
        a.findings.push({ title: `Muskelmasseindeks (FFMI) ${f1(ffmi)}`, severity: 2,
          detail: 'Under gjennomsnittet — du har mye å hente. Muskelmasse er en av de sterkeste prediktorene for sunn aldring.',
          action: 'Prioriter helkropps styrketrening og 1,6–2,2 g protein per kg.' })
      } else if (ffmi >= highF) {
        a.findings.push({ title: `Muskelmasseindeks (FFMI) ${f1(ffmi)}`, severity: 0,
          detail: 'Godt over gjennomsnittet. Videre fremgang krever presis programmering og mer volum på etterslepende muskler.',
          action: 'Programmet fordeler ekstra volum til svakeste muskelgrupper.' })
      }
    }
  }

  if (scan.waistCm != null) {
    const whtr = scan.waistCm / h
    a.waistToHeight = whtr
    if (whtr >= 0.5) {
      a.cardioEmphasis = 2
      a.findings.push({ title: `Midje/høyde ${f2(whtr)}`, severity: whtr >= 0.6 ? 3 : 2,
        detail: whtr >= 0.6 ? 'Betydelig forhøyet — sterkt knyttet til hjerte- og stoffskiftesykdom. Bukfett reagerer godt på trening.'
          : 'Over 0,5, grensen for økt risiko. Målet er å holde midjen under halvparten av høyden.',
        action: 'Kondisjon 3×/uke + styrke + kaloriunderskudd. Mål midjen hver 2.–4. uke.' })
    } else {
      a.findings.push({ title: `Midje/høyde ${f2(whtr)}`, detail: 'Innenfor sunt område (< 0,5).', action: 'Fortsett — følg med på trenden over tid.', severity: 0 })
    }
  }

  const arm = avg(scan.upperArmLeftCm, scan.upperArmRightCm), thigh = avg(scan.thighLeftCm, scan.thighRightCm)
  if (arm && thigh) {
    const ratio = thigh / arm
    if (ratio < 1.6) {
      for (const m of ['quads', 'hamstrings', 'glutes'] as Muscle[]) add(m, 0.35)
      a.findings.push({ title: 'Beina henger etter', detail: `Lår/overarm-ratio ${f2(ratio)} (typisk 1,7–1,9).`, action: 'Ekstra volum til forside lår, bakside lår og sete.', severity: 2 })
    } else if (ratio > 2.1) {
      for (const m of ['chest', 'lats', 'sideDelts', 'biceps', 'triceps'] as Muscle[]) add(m, 0.3)
      a.findings.push({ title: 'Overkroppen henger etter', detail: `Lår/overarm-ratio ${f2(ratio)} (typisk 1,7–1,9).`, action: 'Ekstra volum til bryst, rygg, skuldre og armer.', severity: 2 })
    }
  }
  if (scan.chestCm && scan.waistCm && (profile.goal === 'buildMuscle' || profile.goal === 'recomposition')) {
    const r = scan.chestCm / scan.waistCm
    if (r < 1.15) {
      add('lats', 0.3); add('sideDelts', 0.35)
      a.findings.push({ title: 'Bygg bredde i overkroppen', detail: `Bryst/midje-ratio ${f2(r)}. Bredere rygg og skuldre gir en sterkere V-form.`, action: 'Mer nedtrekk/pull-ups og sidehev.', severity: 1 })
    }
  }

  const asym = (l: number | undefined, r: number | undefined, muscles: Muscle[], name: string) => {
    if (l == null || r == null || Math.max(l, r) <= 0) return
    const diff = Math.abs(l - r) / Math.max(l, r) * 100
    if (diff < 4) return
    const weak: BodySide = l < r ? 'left' : 'right'
    const label = weak === 'left' ? 'venstre' : 'høyre'
    for (const m of muscles) { a.unilateralFocus[m] = weak; add(m, 0.15) }
    a.findings.push({ title: `Ubalanse i ${name}`, severity: diff >= 7 ? 3 : 2,
      detail: `${label[0].toUpperCase() + label.slice(1)} side er ${f1(diff)} % mindre (${f1(Math.min(l, r))} vs ${f1(Math.max(l, r))} cm).`,
      action: `Ettsidige øvelser, start alltid med ${label} side og match antall reps med den sterke.` })
  }
  asym(scan.upperArmLeftCm, scan.upperArmRightCm, ['biceps', 'triceps'], 'overarmene')
  asym(scan.thighLeftCm, scan.thighRightCm, ['quads', 'hamstrings', 'glutes'], 'lårene')

  if (scan.legLengthLeftCm != null && scan.legLengthRightCm != null && Math.abs(scan.legLengthLeftCm - scan.legLengthRightCm) >= 1.5) {
    a.findings.push({ title: 'Mulig beinlengdeforskjell', severity: 1,
      detail: `Ca. ${f1(Math.abs(scan.legLengthLeftCm - scan.legLengthRightCm))} cm forskjell. Kan være måleunøyaktighet eller skjev stilling under skannet.`,
      action: 'Skann igjen. Har du smerter i rygg/hofte, få det vurdert av fysioterapeut.' })
  }
  if (scan.shoulderTiltDeg != null && Math.abs(scan.shoulderTiltDeg) >= 2.5) {
    a.postureFlags.add('shoulderTilt')
    a.findings.push({ title: 'Skjeve skuldre', severity: 2,
      detail: `${scan.shoulderTiltDeg > 0 ? 'Venstre' : 'Høyre'} skulder står ca. ${f1(Math.abs(scan.shoulderTiltDeg))}° høyere.`,
      action: 'Kofferbæring og ettarms øvelser. Bær vesken på motsatt side i hverdagen.' })
  }
  if (scan.hipTiltDeg != null && Math.abs(scan.hipTiltDeg) >= 2.5) {
    a.postureFlags.add('hipTilt')
    a.findings.push({ title: 'Skjevt bekken', severity: 2,
      detail: `${scan.hipTiltDeg > 0 ? 'Venstre' : 'Høyre'} hofte står ca. ${f1(Math.abs(scan.hipTiltDeg))}° høyere.`,
      action: 'Ettbeins øvelser og kofferbæring. Ofte funksjonelt og ufarlig.' })
  }
  if (scan.forwardHeadCm != null && scan.forwardHeadCm >= 6) {
    a.postureFlags.add('forwardHead'); add('upperBack', 0.35)
    a.findings.push({ title: 'Hodet foran skulderlinjen', severity: 2,
      detail: `Ca. ${f0(scan.forwardHeadCm)} cm. Holdning henger svakere sammen med smerte enn mange tror, men sterk øvre rygg og variasjon i stillinger hjelper.`,
      action: 'Mer roing og face pulls (2:1 drag vs. press), chin tucks i oppvarmingen.' })
  }
  if (previous?.waistCm != null && scan.waistCm != null) {
    const d = scan.waistCm - previous.waistCm
    if (Math.abs(d) >= 1) {
      const good = ['loseFat', 'recomposition', 'health'].includes(profile.goal) ? d < 0 : d < 2
      a.findings.push({ title: `Midje ${d > 0 ? '+' : ''}${f1(d)} cm siden forrige skann`, severity: good ? 0 : 2,
        detail: good ? 'Du er på rett vei.' : 'Trenden går motsatt vei av målet ditt.',
        action: good ? 'Fortsett slik.' : 'Juster kaloriene med ~150–250 kcal og sjekk skrittene.' })
    }
  }

  const report = analyzeMuscles(profile, scan, a.bodyFatPercent)
  for (const r of report.regions) if (r.prioritize) for (const m of r.muscles) add(m, 0.2)
  if (scan.roundedShouldersCm != null && scan.roundedShouldersCm >= 5) { a.postureFlags.add('forwardHead'); add('upperBack', 0.2) }

  a.findings.sort((x, y) => y.severity - x.severity)
  return a
}

// ---------------- Muskelanalyse ----------------

export interface RegionScore {
  name: string; detail: string; value: number; target: [number, number]; digits: number; percent?: boolean
  score: number; status: string; muscles: Muscle[]; prioritize: boolean
}
export interface MuscleReport { regions: RegionScore[]; symmetry: RegionScore[]; overallScore?: number; summary: string }

export function analyzeMuscles(profile: ProfileData, scan: ScanMeasurements | undefined, bodyFat?: number): MuscleReport {
  if (!scan) return { regions: [], symmetry: [], summary: 'Skann kroppen for å se hvordan musklene dine er fordelt i forhold til målet ditt.' }
  const male = profile.sex === 'male'
  const g = profile.physique
  const regions: RegionScore[] = []
  const fatFactor = 1 - Math.min(0.25, Math.max(0, ((bodyFat ?? (male ? 18 : 26)) - (male ? 12 : 20)) / 100))
  const score = (v: number, [lo, hi]: [number, number]) => {
    if (v >= lo && v <= hi) return 100
    const width = Math.max(hi - lo, 0.01)
    const dist = v < lo ? lo - v : v - hi
    return Math.max(0, Math.round(100 - dist / width * 60))
  }
  const push = (name: string, detail: string, v: number | undefined, r: [number, number], digits: number,
    low: string, high: string, muscles: Muscle[], prioritizeWhenLow = true) => {
    if (v == null || !Number.isFinite(v)) return
    const s = score(v, r)
    const inside = v >= r[0] && v <= r[1]
    regions.push({ name, detail, value: v, target: r, digits, score: s, status: inside ? 'Innenfor målet' : v < r[0] ? low : high,
      muscles, prioritize: prioritizeWhenLow && v < r[0] && s < 85 })
  }
  const ratio = (a?: number, b?: number) => (a != null && b ? a / b : undefined)

  const chestWaist: [number, number] = g === 'vTaper' ? (male ? [1.32, 1.5] : [1.22, 1.38]) : g === 'powerful' ? (male ? [1.22, 1.4] : [1.15, 1.3])
    : g === 'lowerBody' ? (male ? [1.12, 1.3] : [1.08, 1.25]) : (male ? [1.2, 1.38] : [1.12, 1.3])
  push('Overkropp vs. midje', 'Bryst ÷ midje. Bredere rygg og skuldre gir høyere tall.', ratio(scan.chestCm, scan.waistCm), chestWaist, 2,
    'Bygg bredde: rygg og skuldre', 'Over målet — godt utviklet overkropp', ['lats', 'sideDelts', 'upperBack', 'chest'])

  const armT: [number, number] = g === 'powerful' || g === 'vTaper' ? (male ? [0.2, 0.23] : [0.175, 0.2])
    : g === 'lowerBody' ? (male ? [0.18, 0.215] : [0.16, 0.185]) : (male ? [0.188, 0.22] : [0.168, 0.192])
  const arm = avg(scan.upperArmLeftCm, scan.upperArmRightCm), thigh = avg(scan.thighLeftCm, scan.thighRightCm)
  push('Armer', 'Overarmsomkrets justert for fett, delt på høyde.', arm != null ? arm * fatFactor / profile.heightCm : undefined, armT, 3,
    'Under målet — mer armvolum', 'Over målet', ['biceps', 'triceps'])

  const thighT: [number, number] = g === 'lowerBody' || g === 'powerful' ? (male ? [0.335, 0.38] : [0.34, 0.39])
    : g === 'vTaper' ? (male ? [0.3, 0.345] : [0.31, 0.355]) : (male ? [0.315, 0.36] : [0.32, 0.37])
  push('Lår', 'Lårsomkrets justert for fett, delt på høyde.', thigh != null ? thigh * fatFactor / profile.heightCm : undefined, thighT, 3,
    'Under målet — mer beintrening', 'Over målet', ['quads', 'hamstrings', 'glutes'])

  const balT: [number, number] = g === 'lowerBody' ? [1.85, 2.1] : g === 'vTaper' ? [1.6, 1.8] : [1.68, 1.9]
  if (arm && thigh) {
    const v = thigh / arm, s = score(v, balT), lowLegs = v < balT[0]
    regions.push({ name: 'Over- vs. underkropp', detail: 'Lår ÷ overarm.', value: v, target: balT, digits: 2, score: s,
      status: v >= balT[0] && v <= balT[1] ? 'Balansert' : lowLegs ? 'Beina henger etter' : 'Overkroppen henger etter',
      muscles: lowLegs ? ['quads', 'hamstrings', 'glutes'] : ['chest', 'lats', 'sideDelts'], prioritize: s < 85 })
  }
  if (g === 'lowerBody' || g === 'powerful') {
    push('Sete & hofter', 'Hofte ÷ midje.', ratio(scan.hipCm, scan.waistCm), male ? [1.02, 1.15] : [1.3, 1.5], 2, 'Mer setetrening', 'Over målet', ['glutes'])
  }
  push('Definisjon (midje)', 'Midje ÷ høyde. Lavere = mer synlige muskler.', ratio(scan.waistCm, profile.heightCm),
    g === 'defined' ? [0.4, 0.45] : [0.4, 0.5], 2, 'Svært slank', 'Mer fettap gir mer definisjon', ['abs'], false)

  const symmetry: RegionScore[] = []
  for (const [name, l, r, muscles] of [
    ['Armer V/H', scan.upperArmLeftCm, scan.upperArmRightCm, ['biceps', 'triceps']],
    ['Lår V/H', scan.thighLeftCm, scan.thighRightCm, ['quads', 'hamstrings', 'glutes']],
  ] as [string, number | undefined, number | undefined, Muscle[]][]) {
    if (l == null || r == null || Math.max(l, r) <= 0) continue
    const v = Math.min(l, r) / Math.max(l, r)
    symmetry.push({ name, detail: `${f1(l)} vs ${f1(r)} cm`, value: v * 100, target: [96, 100], digits: 0, percent: true,
      score: score(v, [0.96, 1]), status: v >= 0.96 ? 'Symmetrisk' : `${l < r ? 'Venstre' : 'Høyre'} side er svakere`,
      muscles, prioritize: v < 0.96 })
  }
  const all = [...regions, ...symmetry]
  const overall = all.length ? Math.round(all.reduce((s, r) => s + r.score, 0) / all.length) : undefined
  const behind = all.filter((r) => r.prioritize).map((r) => r.name.toLowerCase())
  const label = PHYSIQUE_INFO[g].label.toLowerCase()
  return {
    regions, symmetry, overallScore: overall,
    summary: behind.length ? `For å nå «${label}» prioriterer programmet: ${behind.join(', ')}.`
      : `Proporsjonene dine passer godt med målet «${label}». Fortsett med balansert progresjon.`,
  }
}

// ---------------- Holdning ----------------

export interface PostureIssue { title: string; detail: string; measured?: string; goal: PostureGoal; fromScan: boolean }
export interface PostureDrill { id: string; name: string; dose: string; cue: string; animation?: string }
export interface PosturePlan { issues: PostureIssue[]; drills: PostureDrill[]; strengthFocus: string[]; habits: string[]; frequency: string }

export const DRILLS: Record<string, PostureDrill> = {
  chin_tuck: { id: 'chin_tuck', name: 'Chin tucks', dose: '2 × 10, hold 3 sek', cue: 'Skyv haken rett bakover («dobbelthake») uten å bøye nakken. Kjenn strekk i nakken bak.' },
  wall_slide: { id: 'wall_slide', name: 'Wall slides', dose: '2 × 10', cue: 'Rygg, bakhode og armer mot veggen. Skyv armene opp til Y og ned til W uten å miste kontakten.', animation: 'wall_slide' },
  thoracic_ext: { id: 'thoracic_ext', name: 'Brystrygg-ekstensjon på foam roller', dose: '2 × 8 per nivå', cue: 'Rull under øvre rygg, hender bak hodet, len deg bakover over rulla. Flytt rulla ett hakk og gjenta.' },
  pec_stretch: { id: 'pec_stretch', name: 'Brysttøy i døråpning', dose: '2 × 30 sek per side', cue: 'Underarmen mot dørkarmen i skulderhøyde, ta et steg frem til du kjenner strekk i brystet.' },
  face_pull: { id: 'face_pull', name: 'Face pulls / band pull-aparts', dose: '2 × 15', cue: 'Trekk mot ansiktet, roter armene utover, klem skulderbladene sammen.', animation: 'face_pull' },
  ytw: { id: 'ytw', name: 'Y-T-W', dose: '1 × 6 av hver', cue: 'Tomlene opp. Løft armene i Y, T og W og hold 2 sek i hver.', animation: 'ytw' },
  dead_bug: { id: 'dead_bug', name: 'Dead bug', dose: '2 × 8 per side', cue: 'Korsryggen presset mot gulvet hele tiden. Strekk motsatt arm og bein.', animation: 'dead_bug' },
  side_plank: { id: 'side_plank', name: 'Sideplanke', dose: '2 × 20–40 sek per side', cue: 'Rett linje fra hode til føtter. Start med svakeste side.' },
  bird_dog: { id: 'bird_dog', name: 'Bird dog', dose: '2 × 8 per side, hold 5 sek', cue: 'På alle fire, strekk motsatt arm og bein uten å vri bekkenet. (McGill big 3)' },
  curl_up: { id: 'curl_up', name: 'McGill curl-up', dose: '2 × 6, hold 8 sek', cue: 'Ett kne bøyd, hendene under korsryggen. Løft hode og skuldre så vidt — nøytral rygg.' },
  glute_bridge: { id: 'glute_bridge', name: 'Seteløft', dose: '2 × 12, pause 2 sek', cue: 'Vipp bekkenet bakover, press opp med setet — ikke svai i korsryggen.', animation: 'glute_bridge' },
  hip_flexor: { id: 'hip_flexor', name: 'Hoftebøyer-tøy knestående', dose: '2 × 30 sek per side', cue: 'Knestående utfall. Stram setet på bakre side og skyv hoften forsiktig frem.', animation: 'hip_flexor' },
  suitcase_carry: { id: 'suitcase_carry', name: 'Kofferbæring', dose: '3 × 30 m per side', cue: 'Tung vekt i én hånd, gå helt rett uten å lene deg. Start med svakeste side.', animation: 'carry' },
  cat_camel: { id: 'cat_camel', name: 'Katt–kamel', dose: '1 × 10 rolige', cue: 'På alle fire, rund og svai ryggen rolig. God oppvarming for ryggen.' },
  world_greatest: { id: 'world_greatest', name: "World's greatest stretch", dose: '1 × 5 per side', cue: 'Utfall, albuen ned mot foten, roter armen opp mot taket.', animation: 'lunge' },
}

export function planPosture(profile: ProfileData, scan?: ScanMeasurements): PosturePlan {
  const issues: PostureIssue[] = []
  const goals = new Set<PostureGoal>(profile.postureGoals)
  if (scan) {
    if (scan.forwardHeadCm != null && scan.forwardHeadCm >= 6) {
      goals.add('neck')
      issues.push({ title: 'Fremoverlent hode', detail: 'Hodet står foran skulderlinjen.', measured: `${f0(scan.forwardHeadCm)} cm`, goal: 'neck', fromScan: true })
    }
    if (scan.roundedShouldersCm != null && scan.roundedShouldersCm >= 5) {
      goals.add('shoulders')
      issues.push({ title: 'Fremoverrullede skuldre', detail: 'Skulderleddene ligger foran øvre del av ryggen.', measured: `${f0(scan.roundedShouldersCm)} cm`, goal: 'shoulders', fromScan: true })
    }
    if (scan.thoracicAngleDeg != null && scan.thoracicAngleDeg >= 25) {
      goals.add('upperBack')
      issues.push({ title: 'Rund øvre rygg', detail: 'Øvre del av ryggen krummer mer fremover enn nedre.', measured: `${f0(scan.thoracicAngleDeg)}°`, goal: 'upperBack', fromScan: true })
    }
    if (scan.shoulderTiltDeg != null && Math.abs(scan.shoulderTiltDeg) >= 2.5) {
      goals.add('shoulders')
      issues.push({ title: 'Skjeve skuldre', detail: `${scan.shoulderTiltDeg > 0 ? 'Venstre' : 'Høyre'} skulder står høyere.`, measured: `${f1(Math.abs(scan.shoulderTiltDeg))}°`, goal: 'shoulders', fromScan: true })
    }
    if (scan.hipTiltDeg != null && Math.abs(scan.hipTiltDeg) >= 2.5) {
      goals.add('pelvis')
      issues.push({ title: 'Skjevt bekken', detail: `${scan.hipTiltDeg > 0 ? 'Venstre' : 'Høyre'} hofte står høyere.`, measured: `${f1(Math.abs(scan.hipTiltDeg))}°`, goal: 'pelvis', fromScan: true })
    }
  }
  const LABEL: Record<PostureGoal, string> = {
    upperBack: 'Rettere øvre rygg (mindre rundrygg)', neck: 'Mindre fremoverlent hode / nakke', shoulders: 'Mindre fremoverrullede eller skjeve skuldre',
    lowerBack: 'Sterkere korsrygg', pelvis: 'Bedre bekkenstilling / svairygg', mobility: 'Generell bevegelighet',
  }
  for (const g of profile.postureGoals) if (!issues.some((i) => i.goal === g)) issues.push({ title: LABEL[g], detail: 'Ditt eget mål.', goal: g, fromScan: false })

  const ids: string[] = []
  const use = (l: string[]) => { for (const id of l) if (!ids.includes(id)) ids.push(id) }
  if (goals.has('neck')) use(['chin_tuck', 'wall_slide'])
  if (goals.has('upperBack')) use(['thoracic_ext', 'wall_slide', 'ytw'])
  if (goals.has('shoulders')) use(['face_pull', 'pec_stretch', 'suitcase_carry'])
  if (goals.has('lowerBack')) use(['curl_up', 'side_plank', 'bird_dog'])
  if (goals.has('pelvis')) use(['hip_flexor', 'glute_bridge', 'dead_bug', 'side_plank'])
  if (goals.has('mobility')) use(['cat_camel', 'world_greatest', 'thoracic_ext', 'hip_flexor'])
  const drills = ids.slice(0, 7).map((id) => DRILLS[id])

  const strengthFocus: string[] = []
  if (goals.has('neck') || goals.has('upperBack') || goals.has('shoulders')) strengthFocus.push('Dobbelt så mange sett drag (roing, nedtrekk, face pulls) som press denne perioden.')
  if (goals.has('lowerBack') || goals.has('pelvis')) strengthFocus.push('Tunge hofteøvelser (hip thrust, rumensk markløft) og anti-rotasjon (Pallof) for en sterk korsrygg.')
  if (goals.has('shoulders') || goals.has('pelvis')) strengthFocus.push('Ettsidige øvelser og bæring jevner ut forskjeller mellom høyre og venstre.')

  return {
    issues, drills, strengthFocus,
    habits: [
      'Den beste holdningen er den neste — bytt stilling minst hver 30.–45. min.',
      'Skjermen i øyehøyde og bena i gulvet ved PC-arbeid.',
      'Gå en kort tur etter måltider og ta telefonsamtaler stående.',
      'Holdningsendringer tar 8–12 uker. Skann deg hver 4. uke for å se fremgangen.',
    ],
    frequency: drills.length ? 'Ca. 10 min — som oppvarming før hver økt eller daglig hjemme.' : '',
  }
}
