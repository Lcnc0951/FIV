// Kalibrering av kameraskann, ukesrapport og supersett.
import { estimated1RM } from './coach'
import { readiness, sleepFromScore, weightTrend, type Checkin, type WeightEntry } from './daily'
import type { Prescription, WorkoutDay } from './generator'
import { exercise } from './library'
import type { BodyScan, Goal, MovementPattern, ScanMeasurements, WorkoutEntry } from './types'
import { RUN_INFO, weekdayIndex, type DayPlan } from './week'

// ---------------- 1. Kalibrering mot målebånd ----------------

export type CalKey = 'neck' | 'chest' | 'waist' | 'hip' | 'arm' | 'thigh'
export type Calibration = Partial<Record<CalKey, number>>

export const CAL_FIELDS: [keyof ScanMeasurements, CalKey][] = [
  ['neckCm', 'neck'], ['chestCm', 'chest'], ['waistCm', 'waist'], ['hipCm', 'hip'],
  ['upperArmLeftCm', 'arm'], ['upperArmRightCm', 'arm'], ['thighLeftCm', 'thigh'], ['thighRightCm', 'thigh'],
]
export const CAL_LABEL: Record<CalKey, string> = { neck: 'Hals', chest: 'Bryst', waist: 'Midje', hip: 'Hofte', arm: 'Armer', thigh: 'Lår' }

const r1 = (v: number) => Math.round(v * 10) / 10

/** Bruker lagrede korreksjonsfaktorer på et rått kameraskann. */
export function applyCalibration(raw: ScanMeasurements, cal: Calibration = {}): ScanMeasurements {
  const out = { ...raw }
  for (const [field, key] of CAL_FIELDS) {
    const v = raw[field] as number | undefined
    const f = cal[key]
    if (v != null && f) (out[field] as number) = r1(v * f)
  }
  return out
}

/**
 * Lærer av målebåndet: der brukeren har rettet et tall, blir forholdet mot rå kameramåling en ny faktor.
 * Faktoren snittes med tidligere kalibrering, så én dårlig måling ikke styrer alt. Begrenset til ±25 %.
 */
export function learnCalibration(raw: ScanMeasurements, corrected: ScanMeasurements, previous: Calibration = {}): { cal: Calibration; learned: CalKey[] } {
  const ratios: Partial<Record<CalKey, number[]>> = {}
  for (const [field, key] of CAL_FIELDS) {
    const r = raw[field] as number | undefined, c = corrected[field] as number | undefined
    if (!r || !c) continue
    const shown = r * (previous[key] ?? 1)
    if (Math.abs(c - shown) < 0.5) continue // ikke rettet
    ;(ratios[key] ??= []).push(c / r)
  }
  const cal: Calibration = { ...previous }
  const learned: CalKey[] = []
  for (const [k, list] of Object.entries(ratios) as [CalKey, number[]][]) {
    const ratio = list.reduce((a, b) => a + b, 0) / list.length
    const blended = previous[k] ? (previous[k]! + ratio) / 2 : ratio
    cal[k] = Math.round(Math.min(1.25, Math.max(0.8, blended)) * 1000) / 1000
    learned.push(k)
  }
  return { cal, learned }
}

// ---------------- 2. Ukesrapport ----------------

export interface WeekReport {
  from: string; to: string; complete: boolean
  planned: number; done: number; strengthDone: number; runsDone: number
  records: { name: string; e1rm: number }[]
  runNotes: string[]
  weightChangeKg?: number; avgWeight?: number
  sleepAvg?: number; shortNights: number; checkins: number; red: number; yellow: number
  streak: number
  headline: string; focus: string
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export function mondayOf(d: Date): Date { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - weekdayIndex(d)); return m }

export function weeklyReport(input: {
  days: DayPlan[]; workouts: WorkoutEntry[]; checkins: Checkin[]; weights: WeightEntry[]; goal: Goal; restingHR?: number; weekStart: Date; now?: Date
  /** Dager før brukeren startet med appen telles ikke som planlagte. */
  since?: Date
}): WeekReport {
  const now = input.now ?? new Date()
  const start = mondayOf(input.weekStart)
  const end = new Date(start); end.setDate(end.getDate() + 7)
  const complete = now >= end
  const lastDay = complete ? 6 : weekdayIndex(now)
  const inWeek = (iso: string) => { const t = new Date(iso); return t >= start && t < end }

  const sinceDay = input.since ? new Date(input.since.getFullYear(), input.since.getMonth(), input.since.getDate()) : undefined
  const dateOf = (weekday: number) => { const x = new Date(start); x.setDate(x.getDate() + weekday); return x }
  const planned = input.days.filter((d) => d.weekday <= lastDay && (d.kind === 'strength' || d.kind === 'run') && (!sinceDay || dateOf(d.weekday) >= sinceDay)).length
  const wk = input.workouts.filter((w) => inWeek(w.date))
  const doneDays = new Set(wk.map((w) => weekdayIndex(new Date(w.date))))
  const strengthDays = new Set(wk.filter((w) => !w.run).map((w) => weekdayIndex(new Date(w.date))))
  const runs = wk.filter((w) => w.run)

  // Nye rekorder: beste estimerte 1RM denne uka over alt tidligere
  const records: WeekReport['records'] = []
  const byEx = new Map<string, { before: number; now: number }>()
  for (const w of input.workouts) {
    if (w.run || !w.sets.length) continue
    const best = Math.max(...w.sets.map(estimated1RM))
    const e = byEx.get(w.exerciseId) ?? { before: 0, now: 0 }
    if (new Date(w.date) < start) e.before = Math.max(e.before, best)
    else if (inWeek(w.date)) e.now = Math.max(e.now, best)
    byEx.set(w.exerciseId, e)
  }
  for (const [id, v] of byEx) if (v.before > 0 && v.now > v.before * 1.01) records.push({ name: exercise(id)?.name ?? id, e1rm: Math.round(v.now) })

  const runNotes = runs.map((w) => `${RUN_INFO[w.run!.type].short}${w.run!.reps ? ` · ${w.run!.reps} drag` : ''}${w.run!.minutes ? ` · ${w.run!.minutes} min` : ''} · føltes ${w.run!.rpe}/10`)

  // Vekt: snitt denne uka mot uka før
  const wTrend = weightTrend(input.weights.filter((x) => new Date(x.date + 'T12:00') < end))
  const thisWeek = input.weights.filter((x) => inWeek(x.date + 'T12:00'))
  const prevStart = new Date(start); prevStart.setDate(prevStart.getDate() - 7)
  const prevWeek = input.weights.filter((x) => { const t = new Date(x.date + 'T12:00'); return t >= prevStart && t < start })
  const avg = (l: WeightEntry[]) => (l.length ? l.reduce((s, x) => s + x.kg, 0) / l.length : undefined)
  const a1 = avg(thisWeek), a0 = avg(prevWeek)
  void wTrend

  // Søvn og dagsform
  const ck = input.checkins.filter((c) => inWeek(c.date + 'T12:00'))
  const sleepVals = ck.map((c) => (c.sleepScore != null ? sleepFromScore(c.sleepScore) : c.sleep))
  const levels = ck.map((c) => readiness(c, input.restingHR).level)
  const shortNights = sleepVals.filter((v) => v <= 2).length

  // Rekke: sammenhengende uker med minst 80 % av planlagte økter (ser bakover fra forrige uke)
  let streak = 0
  for (let i = 1; i <= 52; i++) {
    const s = new Date(start); s.setDate(s.getDate() - 7 * i)
    const e = new Date(s); e.setDate(e.getDate() + 7)
    if (sinceDay && e <= sinceDay) break
    const days = new Set(input.workouts.filter((w) => { const t = new Date(w.date); return t >= s && t < e }).map((w) => weekdayIndex(new Date(w.date))))
    const plannedAll = input.days.filter((d) => d.kind === 'strength' || d.kind === 'run').length
    if (plannedAll && days.size >= plannedAll * 0.8) streak++
    else break
  }
  const doneCount = Math.min(doneDays.size, Math.max(planned, doneDays.size))
  if (complete && planned && doneCount >= planned * 0.8) streak++

  const pct = planned ? doneCount / planned : 1
  const headline = !planned ? 'Uka har så vidt startet.'
    : pct >= 1 ? `Alle ${planned} økter gjennomført${records.length ? ` og ${records.length} ny${records.length > 1 ? 'e' : ''} rekord${records.length > 1 ? 'er' : ''}` : ''}. Sterkt!`
      : pct >= 0.8 ? `${doneCount} av ${planned} økter — solid uke.`
        : `${doneCount} av ${planned} økter så langt.`

  // Én beskjed fra PT-en: det viktigste først
  let focus: string
  const weeklyPct = a1 && a0 ? ((a1 - a0) / a0) * 100 : undefined
  if (shortNights >= 2) focus = `Søvnen var kort ${shortNights} netter. Neste uke: legg deg 22:30 mandag–torsdag — det gir mer igjen enn en ekstra økt.`
  else if (levels.filter((l) => l === 'red').length >= 2) focus = 'To røde dager i dagsformen. Ta en roligere uke: dropp ett intervalldrag og prioriter søvn og mat.'
  else if (planned >= 3 && pct < 0.6) focus = 'Flere økter falt ut. Velg de to viktigste neste uke (én styrke, én intervall) og beskytt dem i kalenderen.'
  else if (input.goal === 'loseFat' && weeklyPct != null && weeklyPct > -0.2) focus = 'Vekten står stille. Trekk fra 150 kcal per dag eller legg til 2 000 skritt neste uke.'
  else if (input.goal === 'buildMuscle' && weeklyPct != null && weeklyPct < 0) focus = 'Vekten gikk ned mens målet er muskler. Spis 150–200 kcal mer, gjerne mer karbohydrat rundt øktene.'
  else if (records.length) focus = `Ny rekord i ${records[0].name}. Hold samme tempo — øk vekt når toppen av rep-intervallet sitter i alle sett.`
  else if (runs.some((r) => r.run!.rpe <= 7)) focus = 'Løpeøktene føltes kontrollerte. Neste uke øker vi: ett drag mer eller litt høyere fart.'
  else focus = 'Fortsett planen. Små økninger hver uke er det som gir resultater over tid.'

  return {
    from: dayKey(start), to: dayKey(new Date(end.getTime() - 86_400_000)), complete, planned, done: doneCount,
    strengthDone: strengthDays.size, runsDone: runs.length, records, runNotes,
    weightChangeKg: a1 && a0 ? Math.round((a1 - a0) * 10) / 10 : undefined, avgWeight: a1 ? Math.round(a1 * 10) / 10 : undefined,
    sleepAvg: sleepVals.length ? Math.round((sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length) * 10) / 10 : undefined,
    shortNights, checkins: ck.length, red: levels.filter((l) => l === 'red').length, yellow: levels.filter((l) => l === 'yellow').length,
    streak, headline, focus,
  }
}

// ---------------- 3. Supersett ----------------

type Cat = 'push' | 'pull' | 'lower' | 'core'
const CAT: Record<MovementPattern, Cat> = {
  horizontalPush: 'push', verticalPush: 'push', chestFly: 'push', lateralRaise: 'push', elbowExtension: 'push',
  horizontalPull: 'pull', verticalPull: 'pull', rearDelt: 'pull', elbowFlexion: 'pull',
  squat: 'lower', hinge: 'lower', singleLeg: 'lower', kneeExtension: 'lower', kneeFlexion: 'lower', calfRaise: 'lower',
  core: 'core', carry: 'core',
}
const PARTNER_ORDER: Record<Cat, Cat[]> = { push: ['pull', 'core', 'lower'], pull: ['push', 'core', 'lower'], lower: ['core', 'pull', 'push'], core: ['lower', 'push', 'pull'] }

export interface SupersetGroup { label: string; items: Prescription[]; restSeconds: number }

/**
 * Setter øvelser sammen i par som ikke konkurrerer om samme muskler (press + drag, bein + kjerne).
 * Brukes når økta er 50 min eller kortere. Sparer ~30 % tid uten å tape effekt (Robbins 2010; Iversen 2021).
 */
export function supersets(day: WorkoutDay, sessionMinutes: number): SupersetGroup[] {
  const items = day.exercises
  if (sessionMinutes > 50 || items.length < 3) return items.map((p, i) => ({ label: String.fromCharCode(65 + i), items: [p], restSeconds: p.restSeconds }))
  const cat = (p: Prescription) => CAT[exercise(p.exerciseId)?.pattern ?? 'core']
  const used = new Set<string>()
  const groups: SupersetGroup[] = []
  for (const p of items) {
    if (used.has(p.id)) continue
    used.add(p.id)
    const c = cat(p)
    let partner: Prescription | undefined
    for (const want of PARTNER_ORDER[c]) {
      partner = items.find((q) => !used.has(q.id) && cat(q) === want)
      if (partner) break
    }
    if (partner) used.add(partner.id)
    const pair = partner ? [p, partner] : [p]
    groups.push({
      label: String.fromCharCode(65 + groups.length), items: pair,
      // Pause etter hele paret: litt kortere enn for én øvelse, siden musklene har hvilt mens du tok den andre
      restSeconds: partner ? Math.max(60, Math.round(Math.max(p.restSeconds, partner.restSeconds) * 0.6 / 15) * 15) : p.restSeconds,
    })
  }
  return groups
}

/** Anslått tid for økta (min), med og uten supersett. */
export function estimateMinutes(groups: SupersetGroup[]): number {
  let s = 8 * 60 // oppvarming
  for (const g of groups) {
    const sets = Math.max(...g.items.map((p) => p.sets))
    const work = g.items.length * 45 + (g.items.length - 1) * 20
    s += sets * work + (sets - 1) * g.restSeconds + 60
  }
  return Math.round(s / 60)
}

export function _internal() { return { CAT } }
export type { BodyScan }
