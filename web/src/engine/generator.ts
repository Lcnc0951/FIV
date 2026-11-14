// Port av ProgramGenerator.swift.
import type { BodyAnalysis, PostureDrill } from './analyzer'
import { effectiveMaxHR } from './composition'
import { allExercises, exercise, isCompound, select, tier } from './library'
import {
  EQUIPMENT_INFO, EXPERIENCE_LABEL, GOAL_INFO, LIMITATION_LABEL, MUSCLE_LABEL, MUSCLES, PHYSIQUE_INFO, uid,
  type Exercise, type Experience, type Muscle, type MovementPattern, type ProfileData, type TrainingLocation,
} from './types'

export interface Prescription { id: string; exerciseId: string; sets: number; repsMin: number; repsMax: number; rir: number; restSeconds: number; note?: string }
export interface WorkoutDay { id: string; name: string; focus: string; exercises: Prescription[] }
export interface MesoWeek { number: number; rir: string; note: string }
export interface CardioPlan {
  zone2Sessions: number; zone2Minutes: number; intervalSessions: number; dailySteps: number
  zone2HR: [number, number]; intervalHR: [number, number]; intervalDescription: string
}
export interface TrainingProgram {
  createdAt: string; locationId: string; locationName: string; title: string; summary: string
  days: WorkoutDay[]; weeklySets: Record<string, number>; targetSets: Record<string, number>
  mesocycle: MesoWeek[]; cardio: CardioPlan; warmup: string[]; focusNotes: string[]; postureRoutine: PostureDrill[]
}

interface Slot { pattern: MovementPattern; prefer?: Muscle }
const S = (...p: (MovementPattern | [MovementPattern, Muscle])[]): Slot[] => p.map((x) => (Array.isArray(x) ? { pattern: x[0], prefer: x[1] } : { pattern: x }))

export const totalSets = (d: WorkoutDay) => d.exercises.reduce((s, p) => s + p.sets, 0)

function split(days: number): { name: string; focus: string; slots: Slot[] }[] {
  const fbA = { name: 'Helkropp A', focus: 'Knebøy · press · roing', slots: S('squat', 'horizontalPush', 'horizontalPull', 'kneeFlexion', 'lateralRaise', 'elbowFlexion', 'core') }
  const fbB = { name: 'Helkropp B', focus: 'Hengsel · skulderpress · nedtrekk', slots: S('hinge', 'verticalPull', 'verticalPush', 'singleLeg', 'chestFly', 'elbowExtension', 'calfRaise') }
  const fbC = { name: 'Helkropp C', focus: 'Ettbeins · skråbenk · rygg', slots: S('singleLeg', 'horizontalPush', 'verticalPull', ['hinge', 'glutes'], 'rearDelt', 'elbowExtension', 'core') }
  const upA = { name: 'Overkropp A', focus: 'Bryst & rygg', slots: S('horizontalPush', 'verticalPull', 'verticalPush', 'horizontalPull', 'lateralRaise', 'elbowFlexion', 'elbowExtension') }
  const upB = { name: 'Overkropp B', focus: 'Rygg & skuldre', slots: S('verticalPull', 'horizontalPush', 'horizontalPull', 'chestFly', 'lateralRaise', 'rearDelt', 'elbowExtension', 'elbowFlexion') }
  const loA = { name: 'Underkropp A', focus: 'Knebøy-fokus', slots: S('squat', 'hinge', 'kneeFlexion', 'kneeExtension', 'calfRaise', 'core') }
  const loB = { name: 'Underkropp B', focus: 'Hofte-fokus', slots: S(['hinge', 'glutes'], 'singleLeg', 'kneeFlexion', 'kneeExtension', 'calfRaise', 'carry') }
  const push = { name: 'Press', focus: 'Bryst · skuldre · triceps', slots: S('horizontalPush', 'verticalPush', 'chestFly', 'lateralRaise', 'elbowExtension') }
  const pull = { name: 'Drag', focus: 'Rygg · bakre skulder · biceps', slots: S('verticalPull', 'horizontalPull', 'rearDelt', 'elbowFlexion', 'core') }
  const legs = { name: 'Bein', focus: 'Lår · sete · legger', slots: S('squat', 'hinge', 'singleLeg', 'kneeFlexion', 'calfRaise') }
  if (days <= 2) return [fbA, fbB]
  if (days === 3) return [fbA, fbB, fbC]
  if (days === 4) return [upA, loA, upB, loB]
  if (days === 5) return [upA, loA, push, pull, legs]
  return [push, pull, legs, { ...push, name: 'Press 2' }, { ...pull, name: 'Drag 2' }, { ...legs, name: 'Bein 2' }]
}

const ISO: Record<Muscle, MovementPattern> = {
  chest: 'chestFly', lats: 'verticalPull', upperBack: 'rearDelt', sideDelts: 'lateralRaise', biceps: 'elbowFlexion',
  triceps: 'elbowExtension', quads: 'kneeExtension', hamstrings: 'kneeFlexion', glutes: 'hinge', calves: 'calfRaise', abs: 'core',
}
const region = (m: Muscle): number | null => (['quads', 'hamstrings', 'glutes', 'calves'].includes(m) ? 1 : m === 'abs' ? null : 0)
const SMALL = new Set<Muscle>(['sideDelts', 'biceps', 'triceps', 'calves', 'abs', 'upperBack'])

export function weeklyTargets(p: ProfileData, a: BodyAnalysis): Record<Muscle, number> {
  const base = p.experience === 'beginner' ? 9 : p.experience === 'intermediate' ? 12 : 15
  const gf = { buildMuscle: 1, recomposition: 0.95, loseFat: 0.85, strength: 0.85, health: 0.75 }[p.goal]
  const out = {} as Record<Muscle, number>
  for (const m of MUSCLES) {
    const mf = m === 'calves' || m === 'abs' ? 0.6 : m === 'upperBack' ? 0.8 : m === 'biceps' || m === 'triceps' ? 0.7 : 1
    out[m] = Math.min(22, Math.round(base * gf * mf * a.priorities[m]))
  }
  return out
}

export function weeklyVolume(days: WorkoutDay[]): Record<Muscle, number> {
  const v = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>
  for (const d of days) for (const p of d.exercises) {
    const e = exercise(p.exerciseId)
    if (!e) continue
    v[e.primary] += p.sets
    for (const s of e.secondary) v[s] += p.sets * 0.5
  }
  return v
}

export function lightLoadsOnly(p: ProfileData): boolean {
  const l = p.location
  if (l.equipment.some((i) => EQUIPMENT_INFO[i].heavy)) return false
  const db = l.equipment.includes('dumbbells') ? Math.max(0, ...l.dumbbellWeights) : 0
  const kb = l.equipment.includes('kettlebell') ? Math.max(0, ...l.kettlebellWeights) : 0
  return Math.max(db, kb) < p.weightKg * 0.3
}

function pick(pattern: MovementPattern, prefer: Muscle | undefined, p: ProfileData, a: BodyAnalysis, occurrence: number, exclude: Set<string>) {
  const target = prefer ?? exerciseForPattern(pattern)?.primary
  let uni = target ? a.unilateralFocus[target] != null : false
  if (pattern === 'carry' || (pattern === 'core' && (a.postureFlags.has('shoulderTilt') || a.postureFlags.has('hipTilt')))) uni = true
  if (lightLoadsOnly(p) && ['squat', 'hinge', 'singleLeg', 'horizontalPush'].includes(pattern)) uni = true
  return select({ pattern, available: new Set(p.location.equipment), limitations: p.limitations, preferPrimary: prefer, preferUnilateral: uni, occurrence, exclude })
}
const exerciseForPattern = (p: MovementPattern) => allExercises.find((e) => e.pattern === p)

export function prescription(e: Exercise, sets: number, p: ProfileData, a: BodyAnalysis): Prescription {
  const compound = isCompound(e)
  let [lo, hi] = p.goal === 'strength' ? (compound ? [3, 6] : [8, 12]) : compound ? (p.experience === 'beginner' ? [8, 12] : [6, 10]) : [10, 15]
  if (['lateralRaise', 'rearDelt', 'calfRaise'].includes(e.pattern)) [lo, hi] = [12, 20]
  if (e.pattern === 'carry') [lo, hi] = [30, 45]
  if (e.pattern === 'core') [lo, hi] = [8, 15]
  let rir = p.experience === 'beginner' ? (compound ? 3 : 2) : p.experience === 'intermediate' ? (compound ? 2 : 1) : (compound ? 1 : 0)
  const light = tier(e) < 2 && lightLoadsOnly(p) && e.pattern !== 'core' && e.pattern !== 'carry' && !e.requires.some((r) => r === 'pullUpBar' || r === 'dipBars')
  if (light) { [lo, hi] = compound ? [12, 20] : [15, 25]; rir = Math.max(0, rir - 1) }
  const rest = compound ? (p.goal === 'strength' ? 180 : 150) : 90
  const notes: string[] = []
  const side = a.unilateralFocus[e.primary]
  if (side && e.unilateral) notes.push(`Start med ${side === 'left' ? 'venstre' : 'høyre'} side. Ta like mange reps på sterk side.`)
  if (e.lengthenedBias && !compound && p.experience !== 'beginner') notes.push('Siste sett: fortsett med delvise reps i strukket posisjon etter failure.')
  if (e.pattern === 'carry') notes.push('Sekunder per side.')
  if (light) notes.push('Lette vekter: flere reps og helt nær failure gir samme effekt. Bruk 3–4 sek nedfase.')
  return { id: uid(), exerciseId: e.id, sets, repsMin: lo, repsMax: hi, rir, restSeconds: rest, note: notes.length ? notes.join(' ') : undefined }
}

export function mesocycle(exp: Experience): MesoWeek[] {
  if (exp === 'beginner') return [
    { number: 1, rir: '3', note: 'Lær teknikken. Finn arbeidsvektene.' },
    { number: 2, rir: '2–3', note: 'Øk vekt eller reps fra forrige uke.' },
    { number: 3, rir: '2', note: 'Fortsett progresjonen.' },
    { number: 4, rir: '2', note: 'Fortsett progresjonen.' },
    { number: 5, rir: '1–2', note: 'Push litt hardere på siste sett.' },
    { number: 6, rir: '4', note: 'Lett uke: halvparten av settene, samme vekter.' },
  ]
  return [
    { number: 1, rir: '3', note: 'Startvolum. Alle sett skal føles kontrollerte.' },
    { number: 2, rir: '2', note: '+1 sett på prioriterte muskler hvis restitusjonen er god.' },
    { number: 3, rir: '1–2', note: 'Øk vekt/reps. Hold teknikken ren.' },
    { number: 4, rir: '0–1', note: 'Topp-uke: isolasjon til failure, basis 1 rep unna.' },
    { number: 5, rir: '4+', note: 'Deload: ~50 % av settene. Restituer, så start ny syklus.' },
  ]
}

function modality(l: TrainingLocation): string {
  if (l.equipment.includes('treadmill')) return 'på tredemølle med 5–8 % stigning'
  if (l.equipment.includes('rower')) return 'på romaskin'
  if (l.equipment.includes('bike')) return 'på sykkel'
  if (l.equipment.includes('kettlebell')) return 'som bakkeløp ute eller kettlebell swings'
  return 'som bakkeløp, rask gange i motbakke eller trappeløp'
}

/** Skrittmål: minst PT-ens anbefaling, og ca. 1 000 over snittet ditt (maks 12 000). */
export function personalSteps(recommended: number, current?: number): number {
  if (!current) return recommended
  return Math.min(12000, Math.max(recommended, Math.round((current + 1000) / 500) * 500))
}

export function cardioPlan(p: ProfileData, a: BodyAnalysis): CardioPlan {
  const hr = effectiveMaxHR(p.age, p.watch?.maxHR)
  const [s, m, i, st] = p.goal === 'loseFat' || a.cardioEmphasis === 2 ? [3, 40, 1, 10000] : p.goal === 'health' ? [2, 45, 1, 9000] : p.goal === 'strength' ? [2, 30, 0, 8000] : [2, 30, 1, 8000]
  return {
    zone2Sessions: s, zone2Minutes: m, intervalSessions: i, dailySteps: personalSteps(st, p.watch?.steps),
    zone2HR: [Math.floor(hr * 0.6), Math.floor(hr * 0.7)], intervalHR: [Math.floor(hr * 0.85), Math.floor(hr * 0.95)],
    intervalDescription: `4×4 ${modality(p.location)}: 10 min oppvarming, 4 × 4 min på 85–95 % av makspuls med 3 min rolig mellom. Norsk metode (Helgerud/NTNU) — en av de mest effektive måtene å øke VO₂maks på.`,
  }
}

export function locationSummary(l: TrainingLocation): string {
  if (!l.equipment.length) return 'Kun kroppsvekt'
  const parts: string[] = []
  if (l.equipment.includes('dumbbells') && l.dumbbellWeights.length) {
    parts.push(`manualer ${Math.min(...l.dumbbellWeights)}–${Math.max(...l.dumbbellWeights)} kg`)
  }
  const others = l.equipment.filter((e) => e !== 'dumbbells' && EQUIPMENT_INFO[e].category !== 'Kondisjon')
  if (others.length) parts.push(`${others.length} andre apparater`)
  return parts.join(', ')
}

export function generateProgram(p: ProfileData, a: BodyAnalysis, postureRoutine: PostureDrill[] = []): TrainingProgram {
  const templates = split(p.daysPerWeek)
  const fullTarget = weeklyTargets(p, a)
  const maxSets = Math.max(10, Math.floor((p.sessionMinutes - 8) / 2.8))
  let target = fullTarget
  const budget = maxSets * templates.length
  const estimate = MUSCLES.reduce((s, m) => s + fullTarget[m], 0) * 0.8
  if (estimate > budget) {
    const f = Math.max(0.5, budget / estimate)
    target = Object.fromEntries(MUSCLES.map((m) => [m, Math.max(2, Math.round(fullTarget[m] * f))])) as Record<Muscle, number>
  }

  const occ = new Map<MovementPattern, number>()
  const days: WorkoutDay[] = templates.map((t) => {
    const used = new Set<string>()
    const ex: Prescription[] = []
    for (const slot of t.slots) {
      const o = occ.get(slot.pattern) ?? 0
      occ.set(slot.pattern, o + 1)
      const e = pick(slot.pattern, slot.prefer, p, a, o, used)
      if (!e) continue
      used.add(e.id)
      ex.push(prescription(e, 2, p, a))
    }
    return { id: uid(), name: t.name, focus: t.focus, exercises: ex }
  })

  for (let iter = 0; iter < 200; iter++) {
    const vol = weeklyVolume(days)
    const deficits = MUSCLES.map((m) => [m, (target[m] - vol[m]) / Math.max(target[m], 1)] as const)
      .filter(([, d]) => d > 0.08).sort((x, y) => y[1] - x[1])
    let progressed = false
    for (const [muscle] of deficits) {
      const cands: [number, number][] = []
      days.forEach((d, di) => d.exercises.forEach((p2, ei) => {
        const e = exercise(p2.exerciseId)
        const max = e && isCompound(e) ? 5 : 4
        if (e?.primary === muscle && p2.sets < max && totalSets(d) < maxSets) cands.push([di, ei])
      }))
      cands.sort((x, y) => totalSets(days[x[0]]) - totalSets(days[y[0]]))
      if (cands.length) { days[cands[0][0]].exercises[cands[0][1]].sets++; progressed = true; break }
      const open = days.map((_, i) => i).filter((i) => totalSets(days[i]) + 2 <= maxSets)
      const r = region(muscle)
      const matching = open.filter((i) => r === null || days[i].exercises.some((x) => { const e = exercise(x.exerciseId); return e && region(e.primary) === r }))
      const choices = !matching.length && SMALL.has(muscle) ? open : matching
      if (choices.length) {
        const di = choices.reduce((b, i) => (totalSets(days[i]) < totalSets(days[b]) ? i : b))
        const e = pick(ISO[muscle], muscle, p, a, 1, new Set(days[di].exercises.map((x) => x.exerciseId)))
        if (e && e.primary === muscle) { days[di].exercises.push(prescription(e, 2, p, a)); progressed = true; break }
      }
    }
    if (!progressed) break
  }

  const vol = weeklyVolume(days)
  for (const m of MUSCLES) if (vol[m] > target[m] * 1.3) {
    for (const d of days) for (const x of d.exercises) if (exercise(x.exerciseId)?.primary === m && x.sets > 2) x.sets--
  }
  for (const d of days) d.exercises.sort((x, y) => Number(isCompound(exercise(y.exerciseId)!)) - Number(isCompound(exercise(x.exerciseId)!)))

  const final = weeklyVolume(days)
  const notes = [
    'Progresjon: når du klarer toppen av rep-intervallet i alle sett — øk vekten 2,5–5 % neste økt.',
    'Tren nær failure: de siste 1–3 repsene skal være tunge. Sett langt unna failure gir lite.',
    'Kontroller nedfasen (2–3 sek) og gå gjennom hele bevegelsesbanen — særlig i strukket posisjon.',
  ]
  if (p.goal === 'loseFat' || a.cardioEmphasis === 2) notes.push('I underskudd: hold vektene oppe. Styrketrening er det som forteller kroppen at musklene skal beholdes.')
  if (p.goal === 'strength') notes.push('Basisløftene trenes tungt (3–6 reps) med lange pauser. Isolasjon bygger muskelen som løfter vekten.')
  if (p.sessionMinutes <= 45) notes.push('Kort økt? Kjør to og to øvelser som supersett (f.eks. press + roing, knebøy + kjerne) med 60–90 sek pause etter hvert par. Det sparer ~30 % tid uten å tape effekt.')
  if (p.limitations.length) notes.push(`Øvelser som ofte provoserer ${p.limitations.map((l) => LIMITATION_LABEL[l].toLowerCase()).sort().join('/')} er byttet ut. Smerte opp til 3/10 som roer seg innen et døgn er normalt OK.`)
  if (p.physique !== 'balanced') notes.push(`Kroppsform-mål: ${PHYSIQUE_INFO[p.physique].label}. Volumet er vektet mot musklene som former dette.`)
  if (!days.some((d) => d.exercises.some((x) => exercise(x.exerciseId)?.pattern === 'verticalPull'))) {
    notes.push('PT-tips: En pull-up-stang i døra (ca. 300–500 kr) gir deg pull-ups og chin-ups — den beste øvelsen for rygg-bredde. Legg den til under Utstyr når du har den.')
  }
  const coverage = MUSCLES.reduce((s, m) => s + Math.min(1, final[m] / Math.max(fullTarget[m], 1)), 0) / MUSCLES.length
  if (coverage < 0.8) notes.push(`Med ${p.daysPerWeek} økter à ${p.sessionMinutes} min når vi bare ~${Math.round(coverage * 100)} % av ideelt ukevolum. En ekstra økt eller lengre økter gir raskere fremgang — men dette programmet virker også.`)

  const warmup = ['5 min lett kondisjon (sykkel, rask gange, roing).', '2 oppvarmingssett på første øvelse: ~50 % × 8 og ~75 % × 3.']
  if (a.postureFlags.has('forwardHead')) warmup.push('Chin tucks 2 × 10 med 3 sek hold + wall slides 2 × 10.')
  if (a.postureFlags.has('shoulderTilt') || a.postureFlags.has('hipTilt')) warmup.push('Sideplanke 2 × 30 sek per side — start med svakeste side.')

  const prioritized = MUSCLES.filter((m) => a.priorities[m] > 1.05).sort((x, y) => a.priorities[y] - a.priorities[x]).slice(0, 3).map((m) => MUSCLE_LABEL[m].toLowerCase())
  let summary = `Laget for ${EXPERIENCE_LABEL[p.experience].toLowerCase()} · ${p.location.name} (${locationSummary(p.location).toLowerCase()}).`
  if (prioritized.length) summary += ` Ekstra fokus: ${prioritized.join(', ')}.`
  if (Object.keys(a.unilateralFocus).length) summary += ' Ettsidige øvelser for å rette opp ubalanser.'

  return {
    createdAt: new Date().toISOString(), locationId: p.location.id, locationName: p.location.name,
    title: `${GOAL_INFO[p.goal].label} · ${p.daysPerWeek} dager/uke`, summary, days,
    weeklySets: final, targetSets: fullTarget, mesocycle: mesocycle(p.experience), cardio: cardioPlan(p, a),
    warmup, focusNotes: notes, postureRoutine,
  }
}
