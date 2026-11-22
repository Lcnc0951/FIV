// Plager og bevegelighet: brukeren beskriver med egne ord hva som er vondt og stivt.
// Motoren tolker teksten, lager en daglig mobilitets- og opptreningsrutine i nivåer
// (lettest først, uten stillinger brukeren ikke klarer) og sier hvordan styrkeprogrammet endres.
import type { Limitation } from './types'

export type Region = 'neck' | 'upperTrap' | 'shoulder' | 'thoracic' | 'lowerBack' | 'hip' | 'knee'
export type MobilityLimit = 'noQuadruped' | 'noFloor' | 'noOverhead' | 'benchPain'
export type Level = 1 | 2 | 3

export interface MobilityProfile {
  text: string
  pain: number // 0–10 nå
  regions: Region[]
  limits: MobilityLimit[]
  level: Level
  since: string
  /** Satt når brukeren sier plagene er borte. */
  resolved?: string
}
export interface MobilityLog { date: string; pain: number; done: boolean }

export const REGION_LABEL: Record<Region, string> = {
  neck: 'Nakke', upperTrap: 'Oppå skulderbladet / nakke–skulder', shoulder: 'Skulder', thoracic: 'Øvre rygg (brystrygg)',
  lowerBack: 'Korsrygg', hip: 'Hofte', knee: 'Kne',
}
export const LIMIT_LABEL: Record<MobilityLimit, string> = {
  noQuadruped: 'Klarer ikke å stå på alle fire', noFloor: 'Vanskelig å ligge på gulvet',
  noOverhead: 'Vondt å løfte armen over hodet', benchPain: 'Verker i skulderen på benkpress',
}

const has = (t: string, re: RegExp) => re.test(t)
const CANT = /(klarer|får) (ikke|ikkje)|vanskelig|vondt|verk|smert|stiv|går ikke|umulig/

/** Tolker fritekst: hvilke områder, hva brukeren ikke klarer, og om det er stivhet. */
export function parseMobility(input: string): { regions: Region[]; limits: MobilityLimit[]; stiff: boolean; pain?: number } {
  const t = input.toLowerCase()
  const regions = new Set<Region>()
  const limits = new Set<MobilityLimit>()
  if (has(t, /oppå skulderblad|oppe på skulderblad|øverst på skulderblad|over skulderblad|mellom nakke og skulder|trapes|skulderbladheve|levator/)) regions.add('upperTrap')
  if (has(t, /nakke/)) regions.add('neck')
  if (has(t, /skulder(?!blad|plate)|skuldre|\barm(en)?\b|rotator/) || (has(t, /skulderblad|skulderplate/) && !regions.has('upperTrap'))) regions.add('shoulder')
  if (has(t, /skulderblad|skulderplate/) && !regions.has('upperTrap')) regions.add('upperTrap')
  if (has(t, /øvre rygg|brystrygg|mellom skulderblad|stiv i (hele )?(kroppen|overkroppen|ryggen)|rotere|vri (på )?overkropp|svinge armene/)) regions.add('thoracic')
  if (has(t, /korsrygg|nedre rygg|lav rygg|isjias|ryggen(?! øverst)/) && !has(t, /øvre rygg/)) regions.add('lowerBack')
  if (has(t, /hofte|lyske|sete|hamstring|baksiden av låret/)) regions.add('hip')
  if (has(t, /\bkne|knær/)) regions.add('knee')
  const stiff = has(t, /stiv|bevegelighet|mobilitet|lite beveg|stram/)
  if (stiff && !regions.size) { regions.add('thoracic'); regions.add('hip') }
  if (has(t, /stiv i (hele )?kroppen/)) { regions.add('thoracic'); regions.add('hip') }

  if (has(t, /alle fire|firefot|på knærne|knestående/) && has(t, CANT)) limits.add('noQuadruped')
  if (has(t, /ligge på gulvet|ned på gulvet|opp fra gulvet|ligge på ryggen/) && has(t, CANT)) limits.add('noFloor')
  if (has(t, /løfte armen|over hodet|mot taket|peke opp|strekke armen/) && has(t, CANT)) limits.add('noOverhead')
  if (has(t, /benk/) && has(t, /verk|vondt|smert|klarer ikke|får ikke/)) { limits.add('benchPain'); regions.add('shoulder') }
  const p = t.match(/(\d{1,2})\s*(av|\/)\s*10/)
  return { regions: [...regions], limits: [...limits], stiff, pain: p ? Math.min(10, +p[1]) : undefined }
}

export interface MobDrill {
  id: string; name: string; dose: string; cue: string; why: string; level: Level
  regions: Region[]; animation?: string
  needs?: ('quadruped' | 'floor' | 'overhead')[]
}

// Øvelser per område og nivå. Nivå 1 = smertedempende og lett, 2 = mer bevegelse og lett styrke, 3 = målet.
export const MOB_DRILLS: MobDrill[] = [
  // Brystrygg
  { id: 'seated_rotation', name: 'Sittende rotasjon på stol', dose: '2 × 8 per side', level: 1, regions: ['thoracic'],
    cue: 'Sitt på kanten av stolen, armene i kors over brystet. Vri overkroppen rolig til siden, pust ut i ytterstilling, tilbake og bytt side.', why: 'Rotasjon i øvre rygg uten å stå på alle fire.' },
  { id: 'chair_ext', name: 'Bakoverbøy over stolryggen', dose: '2 × 8', level: 1, regions: ['thoracic', 'neck'],
    cue: 'Sitt med stolryggen midt på ryggen. Hendene lett bak hodet, albuene sammen. Len deg rolig bakover over stolryggen og pust ut.', why: 'Motvirker rund øvre rygg, som ofte gir stramme muskler oppå skulderbladet.' },
  { id: 'open_book', name: 'Bok-åpning liggende på siden', dose: '2 × 6 per side, pust ut i ytterstilling', level: 2, regions: ['thoracic', 'shoulder'], needs: ['floor'],
    cue: 'Ligg på siden med knærne bøyd 90° og en pute under hodet. Armene rett fram. Åpne den øverste armen som en bok mot gulvet bak deg, blikket følger hånden.', why: 'Samme rotasjon som på alle fire, men liggende og lettere.' },
  { id: 'wall_rotation', name: 'Rotasjon med hånden mot veggen', dose: '2 × 6 per side', level: 2, regions: ['thoracic', 'shoulder'],
    cue: 'Stå sidelengs til veggen, ytterste hånd følger veggen bakover i skulderhøyde mens du vrir overkroppen. Bare så langt det er behagelig.', why: 'Stående variant av rotasjonen, uten gulv.' },
  { id: 'thoracic_ext', name: 'Brystrygg-ekstensjon på foam roller', dose: '2 × 6 per nivå', level: 2, regions: ['thoracic'], needs: ['floor'],
    cue: 'Rulla under øvre rygg, hendene bak hodet. Len deg rolig bakover, flytt rulla ett hakk og gjenta.', why: 'Mer bevegelse i øvre rygg.' },
  { id: 'quad_rotation', name: 'Rotasjon på alle fire, armen mot taket', dose: '2 × 6 per side', level: 3, regions: ['thoracic', 'shoulder'], needs: ['quadruped', 'overhead'],
    cue: 'På alle fire, én hånd bak hodet. Før albuen ned mot motsatt hånd, så åpne opp mot taket. Blikket følger albuen.', why: 'Målet: når denne går greit, er bevegeligheten i øvre rygg tilbake.' },
  // Nakke / oppå skulderbladet
  { id: 'chin_tuck', name: 'Chin tucks (dobbelthake)', dose: '2 × 10, hold 3 sek', level: 1, regions: ['neck', 'upperTrap'],
    cue: 'Sitt eller stå rett. Skyv haken rett bakover uten å bøye nakken. Kjenn et lett drag bak i nakken.', why: 'Avlaster nakken og musklene oppå skulderbladet.' },
  { id: 'scap_depress', name: 'Skuldersenk', dose: '2 × 10, hold 5 sek', level: 1, regions: ['upperTrap', 'shoulder'],
    cue: 'Trekk skuldrene rolig ned og litt bak, som om du skal putte skulderbladene i baklommene. Ikke skyv brystet fram.', why: 'Aktiverer nedre del av trapes, så den øvre (som verker) får hvile.' },
  { id: 'upper_trap_stretch', name: 'Lett tøy oppå skulderen', dose: '2 × 30 sek per side', level: 1, regions: ['upperTrap', 'neck'],
    cue: 'Sitt på hånden på den vonde siden. Bøy hodet rolig mot motsatt skulder og drei nesa litt ned mot armhulen. Svak strekk, aldri smerte.', why: 'Demper stramhet i trapes og skulderbladheveren.' },
  { id: 'heat_breath', name: 'Varme og rolig pust', dose: '5–10 min, gjerne kveld', level: 1, regions: ['upperTrap', 'neck'],
    cue: 'Varmepute eller varm dusj over nakke og skulder. Pust rolig med magen, la skuldrene synke for hver utpust.', why: 'Stresset og stramme muskler slipper lettere med varme og rolig pust.' },
  { id: 'band_pull_apart', name: 'Strikk-pull-apart i brysthøyde', dose: '2 × 15, lett strikk', level: 2, regions: ['upperTrap', 'shoulder', 'thoracic'],
    cue: 'Armene strake foran deg i brysthøyde. Trekk strikken ut til sidene ved å klemme skulderbladene sammen og ned. Skuldrene vekk fra ørene.', why: 'Styrker baksiden av skuldrene og midt i ryggen uten å belaste oppå skulderbladet.', animation: 'rear_delt' },
  { id: 'wall_slide_w', name: 'Veggskli i W (ikke over hodet)', dose: '2 × 10', level: 2, regions: ['upperTrap', 'shoulder', 'thoracic'],
    cue: 'Rygg og underarmer mot veggen, albuene i skulderhøyde. Skyv armene litt opp og trekk dem ned til W mens du klemmer skulderbladene ned.', why: 'Trener nedre trapes og bevegelse uten å løfte armen over hodet.', animation: 'wall_slide' },
  { id: 'wall_slide', name: 'Veggskli helt opp (Y)', dose: '2 × 10', level: 3, regions: ['upperTrap', 'shoulder', 'thoracic'], needs: ['overhead'],
    cue: 'Samme som W, men skyv helt opp til Y uten at korsryggen svaier eller skuldrene trekkes mot ørene.', why: 'Full bevegelse over hodet med kontroll.', animation: 'wall_slide' },
  { id: 'prone_y', name: 'Y-løft liggende på skråbenk', dose: '2 × 10, 1–2 kg eller uten vekt', level: 3, regions: ['upperTrap', 'shoulder'],
    cue: 'Ligg på magen på skråbenk. Løft armene i Y med tomlene opp, hold 2 sek. Skuldrene ned.', why: 'Styrker nedre trapes, som avlaster musklene oppå skulderbladet.', animation: 'ytw' },
  // Skulder
  { id: 'iso_er', name: 'Isometrisk utadrotasjon mot dørkarm', dose: '5 × 30 sek, 30–50 % kraft', level: 1, regions: ['shoulder'],
    cue: 'Albuen inntil kroppen og bøyd 90°. Press håndbaken utover mot dørkarmen uten at armen flytter seg.', why: 'Isometrisk trening demper ofte smerte i rotatorcuffen.' },
  { id: 'pendulum', name: 'Pendel', dose: '1 min per retning', level: 1, regions: ['shoulder'],
    cue: 'Len deg med den friske hånden på et bord. La den vonde armen henge avslappet og lag små sirkler med kroppen.', why: 'Bevegelse uten muskelarbeid. Fin når det verker.' },
  { id: 'band_er', name: 'Utadrotasjon med strikk', dose: '2 × 15, lett', level: 2, regions: ['shoulder'],
    cue: 'Albuen inntil kroppen med et sammenrullet håndkle under. Drei underarmen utover mot strikken, rolig tilbake.', why: 'Styrker rotatorcuffen bak på skulderen.' },
  { id: 'side_er', name: 'Sideliggende utadrotasjon med manual', dose: '2 × 12, 1–3 kg', level: 3, regions: ['shoulder'], needs: ['floor'],
    cue: 'Ligg på den friske siden, albuen inntil kroppen. Løft manualen rolig opp ved å rotere skulderen.', why: 'Mer belastning for baksiden av skulderen.' },
  // Korsrygg
  { id: 'seated_cat_camel', name: 'Sittende katt–kamel', dose: '1 × 10 rolige', level: 1, regions: ['lowerBack', 'thoracic'],
    cue: 'Sitt på kanten av stolen med hendene på knærne. Rund ryggen og se ned, så rett deg opp og skyv brystet fram.', why: 'Samme bevegelse som på alle fire, sittende.' },
  { id: 'curl_up', name: 'McGill curl-up', dose: '2 × 6, hold 8 sek', level: 1, regions: ['lowerBack'], needs: ['floor'],
    cue: 'Ligg på ryggen, ett kne bøyd, hendene under korsryggen. Løft hode og skuldre en centimeter, hold.', why: 'Stabil kjerne uten å bøye ryggen.' },
  { id: 'wall_bird_dog', name: 'Stående bird dog mot veggen', dose: '2 × 8 per side', level: 1, regions: ['lowerBack', 'hip'],
    cue: 'Hendene mot veggen. Strekk ett bein rett bakover mens du holder ryggen helt rolig. Bytt.', why: 'Bird dog uten å stå på alle fire.' },
  { id: 'bird_dog', name: 'Bird dog', dose: '2 × 8 per side, hold 5 sek', level: 3, regions: ['lowerBack', 'hip'], needs: ['quadruped'],
    cue: 'På alle fire, strekk motsatt arm og bein uten å vippe bekkenet.', why: 'Kjernekontroll på alle fire.' },
  { id: 'side_plank_wall', name: 'Sideplanke mot vegg', dose: '2 × 20 sek per side', level: 2, regions: ['lowerBack'],
    cue: 'Stå skrått med underarmen mot veggen, kroppen rett. Hold.', why: 'Lett sideplanke uten gulv.' },
  // Hofte
  { id: 'standing_hip_flexor', name: 'Hoftebøyer-tøy stående', dose: '2 × 30 sek per side', level: 1, regions: ['hip', 'lowerBack'],
    cue: 'Ett skritt fram, stram setet på bakerste bein og skyv hofta rolig fram. Ikke svai.', why: 'Strammer hoftebøyere drar i korsryggen.' },
  { id: 'chair_figure4', name: 'Setetøy på stol (figur 4)', dose: '2 × 30 sek per side', level: 1, regions: ['hip'],
    cue: 'Ankelen over motsatt kne. Len deg fram med rett rygg til du kjenner strekk i setet.', why: 'Mer bevegelse i hofta uten gulv.' },
  { id: 'hip_hinge_dowel', name: 'Hoftehengsel med kost langs ryggen', dose: '2 × 10', level: 2, regions: ['hip', 'lowerBack'],
    cue: 'Kosten langs ryggen (bakhode, skulderblad, sete). Skyv setet bakover med myke knær uten at kosten mister kontakt.', why: 'Lærer kroppen å bøye i hofta i stedet for ryggen.' },
  { id: 'world_greatest', name: "World's greatest stretch", dose: '1 × 5 per side', level: 3, regions: ['hip', 'thoracic'], needs: ['floor'],
    cue: 'Utfall, albuen ned mot foten, roter så armen opp mot taket.', why: 'Hofte og brystrygg i ett.' },
  // Kne
  { id: 'wall_sit', name: 'Veggsitt', dose: '5 × 30–45 sek', level: 1, regions: ['knee'],
    cue: 'Rygg mot veggen, gli ned så langt det er smertefritt. Hold.', why: 'Isometrisk trening demper ofte knesmerter.' },
  { id: 'step_up_low', name: 'Lav step-up', dose: '2 × 10 per side', level: 2, regions: ['knee', 'hip'],
    cue: 'Lav trapp eller kasse. Kneet peker over tærne, rolig ned.', why: 'Bygger styrke rundt kneet gradvis.' },
]

export interface MobilityPlan {
  daily: MobDrill[]
  warmup: MobDrill[]
  goal?: MobDrill
  minutes: number
  avoid: string[]
  notes: string[]
}

const allowed = (d: MobDrill, limits: MobilityLimit[]) =>
  !(d.needs?.includes('quadruped') && limits.includes('noQuadruped')) &&
  !(d.needs?.includes('floor') && limits.includes('noFloor')) &&
  !(d.needs?.includes('overhead') && limits.includes('noOverhead'))

/** Lager dagens rutine: inntil 8 øvelser på brukerens nivå (og nivået under), dekker alle områder. */
export function planMobility(m: Pick<MobilityProfile, 'regions' | 'limits' | 'level' | 'pain'>): MobilityPlan {
  const level: Level = m.pain >= 6 ? 1 : m.level
  const fits = MOB_DRILLS.filter((d) => d.level <= level && allowed(d, m.limits) && d.regions.some((r) => m.regions.includes(r)))
  // Ett–to per område, høyest nivå først innen området, og ingen duplikater
  const picked: MobDrill[] = []
  const per = Math.max(2, Math.ceil(8 / Math.max(1, m.regions.length)))
  for (const r of m.regions) {
    // Hovedområdet først, så høyeste nivå; én på brukerens nivå og én lettere
    const forR = fits.filter((d) => d.regions.includes(r) && d.regions.indexOf(r) <= 1)
      .sort((a, b) => a.regions.indexOf(r) - b.regions.indexOf(r) || b.level - a.level)
    const top = forR.find((d) => d.level === level && !picked.includes(d)) ?? forR.find((d) => !picked.includes(d))
    const easier = forR.find((d) => d.level < (top?.level ?? level) && !picked.includes(d) && d !== top)
    const chosen = [top, easier, ...forR].filter((d, i, arr): d is MobDrill => !!d && arr.indexOf(d) === i && !picked.includes(d)).slice(0, per)
    for (const d of chosen) if (picked.length < 8) picked.push(d)
  }
  // Mobilitet først, så aktivering/styrke
  const daily = picked.sort((a, b) => a.level - b.level)
  const goal = MOB_DRILLS.find((d) => d.level === 3 && d.regions.some((r) => m.regions.includes(r)) && !allowed(d, m.limits))
    ?? MOB_DRILLS.find((d) => d.level === 3 && d.regions.some((r) => m.regions.includes(r)) && level < 3)
  const warmup = daily.filter((d) => !d.id.startsWith('heat') && !d.dose.includes('min,')).slice(0, 3)
  const minutes = Math.max(6, Math.round(daily.length * 1.4))
  const avoid: string[] = []
  const notes: string[] = []
  const up = m.regions.includes('upperTrap') || m.regions.includes('shoulder') || m.regions.includes('neck')
  if (up) {
    avoid.push('Skulderpress og sidehev til det verker mindre', 'Tunge skuldertrekk (shrugs) og tung bæring')
    notes.push('Benkpress: bruk manualer med nøytralt grep (håndflatene mot hverandre) og senk bare til albuene er i høyde med kroppen. Gulvpress fungerer også: ligg på gulvet, albuene stopper mot gulvet.')
    notes.push('Baksiden av skuldrene og øvre rygg trenes med brystliggende roing, strikk-pull-apart og veggskli, så du slipper å stå på alle fire.')
  }
  if (m.limits.includes('noQuadruped')) notes.push('Øvelser på alle fire er byttet med sittende, stående eller liggende varianter. Målet er å klare dem igjen på nivå 3.')
  if (m.regions.includes('lowerBack')) avoid.push('Tunge markløft og knebøy med stang til ryggen er rolig')
  if (m.regions.includes('knee')) avoid.push('Dype utfall og hopp til kneet er rolig')
  notes.push('Smerte opp til 3/10 under øvelsene er greit hvis det har roet seg neste dag. Blir det verre: gå ned et nivå.')
  return { daily, warmup, goal, minutes, avoid, notes }
}

/** Foreslår neste nivå når de siste tre loggene (minst tre ulike dager) er 3/10 eller lavere. */
export function suggestLevel(m: MobilityProfile, logs: MobilityLog[]): { level: Level; reason: string } | undefined {
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
  if (recent.length < 3) return undefined
  if (recent.every((l) => l.pain <= 3) && m.level < 3) return { level: (m.level + 1) as Level, reason: 'Tre økter på rad med smerte på 3/10 eller lavere. Klar for neste nivå.' }
  if (recent.every((l) => l.pain >= 6) && m.level > 1) return { level: (m.level - 1) as Level, reason: 'Det har verket mye de siste gangene. Gå ned et nivå en periode.' }
  return undefined
}

/** Hvilke områder som skal tilpasse styrkeprogrammet. */
export function strengthAreas(m?: MobilityProfile): Limitation[] {
  if (!m || m.resolved || m.pain < 2) return []
  const out = new Set<Limitation>()
  if (m.regions.some((r) => r === 'shoulder' || r === 'upperTrap' || r === 'neck')) out.add('shoulder')
  if (m.regions.includes('lowerBack')) out.add('lowerBack')
  if (m.regions.includes('knee')) out.add('knee')
  return [...out]
}
