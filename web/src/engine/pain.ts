// Midlertidige plager: gjenkjenn smertespørsmål, tilpass programmet i en periode og gi opptrening.
import type { Prescription, TrainingProgram } from './generator'
import { exercise } from './library'
import type { Limitation, MovementPattern } from './types'

export type { TempLimitation } from './types'
import type { TempLimitation } from './types'

const PAIN = /vond|smert|verk|skade|strekk|stiv|låst|prikk|nummen|hovne|ømt?\b|kink|ille i|plage|irritert|betent|klemt/i
const AREAS: [Limitation, RegExp][] = [
  ['shoulder', /skulder|skulderblad|skulderplate|nakke|\barm(en)?\b|albue|rotator|kragebein|trapes/i],
  ['knee', /kne|\blår|\bleggen|ankel|hofte|lyske|akilles|\bfot/i],
  ['lowerBack', /rygg|korsrygg|isjias|bekken|sete/i],
]

/** Gjenkjenner om spørsmålet handler om smerte/skade, og hvilket område. */
export function detectPain(text: string): { pain: boolean; area?: Limitation } {
  const pain = PAIN.test(text)
  if (!pain) return { pain }
  const t = text.toLowerCase()
  // Skulderblad/øvre rygg regnes som skulder (armløft), korsrygg som rygg
  if (/skulderbla|skulderplat/.test(t)) return { pain, area: 'shoulder' }
  for (const [area, re] of AREAS) if (re.test(t)) return { pain, area }
  return { pain }
}

interface Rule { patterns: MovementPattern[]; ids: string[]; careful: MovementPattern[]; rehab: string[]; run?: string }
export const PAIN_RULES: Record<Limitation, Rule> = {
  shoulder: {
    patterns: ['verticalPush', 'lateralRaise', 'chestFly', 'verticalPull'],
    ids: ['bench_bb', 'dips', 'dips_bench', 'face_pull', 'hanging_leg_raise', 'overhead_cable_ext', 'db_overhead_ext', 'pullup', 'chinup'],
    careful: ['horizontalPush', 'horizontalPull', 'rearDelt', 'elbowFlexion', 'elbowExtension'],
    rehab: [
      'Isometrisk utadrotasjon: albuen inntil kroppen, press håndbaken mot dørkarmen med 30–50 % kraft. 5 × 30 sek, daglig.',
      'Skulderbladsett: trekk skulderbladene rolig ned og bak, hold 5 sek. 10 repetisjoner.',
      'Når det er smertefritt: utadrotasjon med lett strikk, 2 × 15, albuen inntil kroppen.',
    ],
    run: 'Løping er ok hvis armsvingen ikke gjør vondt. Hold armene lave og avslappet.',
  },
  knee: {
    patterns: ['kneeExtension'],
    ids: ['walking_lunge', 'bulgarian', 'back_squat', 'hack_squat', 'nordic', 'tempo_squat'],
    careful: ['squat', 'singleLeg', 'calfRaise'],
    rehab: [
      'Veggsitt (isometrisk): 5 × 45 sek, så dypt det er smertefritt. Demper ofte kneet.',
      'Seteløft på ett bein: 3 × 12 per side.',
      'Tåhev på trapp: 3 × 15 rolig.',
    ],
    run: 'Bytt intervallene til sykkel eller rolig løp på flatt underlag. Unngå bakker og nedoverbakker.',
  },
  lowerBack: {
    patterns: [],
    ids: ['back_squat', 'rdl_barbell', 'ohp_bb', 'kb_swing', 'hanging_leg_raise', 'tempo_squat', 'nordic'],
    careful: ['hinge', 'squat', 'carry', 'horizontalPull'],
    rehab: [
      'McGills tre: curl-up 5 × 10 sek, sideplanke 3 × 15 sek per side, bird dog 6 per side.',
      'Gå 15–30 min daglig i rolig tempo. Bevegelse hjelper mer enn hvile.',
      'Katt-ku 10 rolige repetisjoner morgen og kveld.',
    ],
    run: 'Rolig løp er ofte greit. Dropp intervaller til ryggen er rolig.',
  },
}

export const AREA_TEXT: Record<Limitation, string> = { shoulder: 'skulder', knee: 'kne', lowerBack: 'rygg' }

export const activeTemp = (list: TempLimitation[] | undefined, now = new Date()) =>
  (list ?? []).filter((t) => new Date(t.until) >= now)

export function painBlocked(exerciseId: string, areas: Limitation[]): boolean {
  const e = exercise(exerciseId)
  return areas.some((a) => PAIN_RULES[a].ids.includes(exerciseId) || (!!e && PAIN_RULES[a].patterns.includes(e.pattern)))
}

// Skånsomme erstatninger (hvis utstyret finnes) og ekstra øvelser for baksiden av skuldrene
const SUBSTITUTE: Record<string, { id: string; note: string }[]> = {
  bench_bb: [
    { id: 'bench_db', note: 'Skånsom benk: manualer med nøytralt grep, senk bare til albuene er i høyde med kroppen (eller gulvpress).' },
    { id: 'pushup', note: 'Skånsom variant: hendene på en benk eller bordkant, kort bevegelse.' },
  ],
  dips: [{ id: 'pushup', note: 'Erstatter dips: armhevinger med hendene høyt, albuene inntil kroppen.' }],
}
const PREHAB: Partial<Record<Limitation, string[]>> = { shoulder: ['band_pull_apart', 'reverse_fly', 'band_face_pull', 'chest_supported_row'] }
const BENCH_NOTE = 'Skånsom benk: nøytralt grep (håndflatene mot hverandre), senk bare til albuene er i høyde med kroppen. Gulvpress er også et godt valg.'

/** Tar ut øvelser som irriterer området, bytter til skånsomme varianter og gjør resten lettere. Endrer ikke det lagrede programmet. */
export function applyPain(program: TrainingProgram | undefined, areas: Limitation[], available?: (exerciseId: string) => boolean): { program?: TrainingProgram; removed: string[] } {
  if (!program || !areas.length) return { program, removed: [] }
  const removed = new Set<string>()
  const ok = (id: string) => (available ? available(id) : true) && !painBlocked(id, areas)
  const days = program.days.map((d) => {
    const out: Prescription[] = []
    for (const x of d.exercises) {
      if (painBlocked(x.exerciseId, areas)) {
        removed.add(x.exerciseId)
        const sub = (SUBSTITUTE[x.exerciseId] ?? []).find((s) => ok(s.id) && !d.exercises.some((y) => y.exerciseId === s.id) && !out.some((y) => y.exerciseId === s.id))
        if (sub) out.push({ ...x, exerciseId: sub.id, rir: Math.min(4, x.rir + 1), note: sub.note })
        continue
      }
      const e = exercise(x.exerciseId)
      const careful = e && areas.some((a) => PAIN_RULES[a].careful.includes(e.pattern))
      const bench = areas.includes('shoulder') && e?.pattern === 'horizontalPush' && x.exerciseId !== 'pushup'
      out.push(careful ? { ...x, rir: Math.min(4, x.rir + 1), note: `${bench ? BENCH_NOTE : 'Lettere vekt.'} Hold smerten på 3/10 eller lavere. ${x.note ?? ''}`.trim() } : x)
    }
    // Baksiden av skuldrene: legg til én lett øvelse på dager der noe ble tatt ut
    const changed = out.length !== d.exercises.length || out.some((x, i) => x.exerciseId !== d.exercises[i]?.exerciseId)
    for (const a of areas) {
      if (!changed) break
      const pre = (PREHAB[a] ?? []).find((id) => ok(id) && !out.some((y) => y.exerciseId === id || exercise(y.exerciseId)?.pattern === 'rearDelt'))
      if (pre && !out.some((y) => exercise(y.exerciseId)?.pattern === 'rearDelt')) {
        out.push({ id: `${d.id}-prehab-${pre}`, exerciseId: pre, sets: 2, repsMin: 15, repsMax: 20, rir: 3, restSeconds: 45, note: 'Lett og smertefritt: styrker baksiden av skuldrene og øvre rygg.' })
      }
    }
    const keep = out
    return { ...d, exercises: keep, focus: changed ? `${d.focus} · tilpasset ${areas.map((a) => AREA_TEXT[a]).join('/')}` : d.focus }
  })
  return { program: { ...program, days }, removed: [...removed] }
}
