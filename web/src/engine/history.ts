// Historikk: oppsummering per dag og uke, og progresjonstabeller for styrke og løping.
import type { SkipEntry } from './absence'
import { estimated1RM } from './coach'
import type { Checkin } from './daily'
import { mondayOf } from './extras'
import { exercise } from './library'
import type { WorkoutEntry } from './types'
import { RUN_INFO, type RunType } from './week'

export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const localDay = (iso: string) => isoDay(new Date(iso))

export interface SessionSummary {
  key: string; date: string; day: string; title: string; kind: 'strength' | 'run'
  minutes?: number; sets?: number; volumeKg?: number; exercises?: string[]
  run?: WorkoutEntry['run']; note?: string; records: string[]
}

/** Slår sammen oppføringene til økter og finner nye rekorder (beste estimerte 1RM per øvelse). */
export function sessions(workouts: WorkoutEntry[]): SessionSummary[] {
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date))
  const best = new Map<string, number>()
  const map = new Map<string, SessionSummary>()
  for (const w of sorted) {
    const key = w.run ? w.id : `${w.date}|${w.dayName}`
    let s = map.get(key)
    if (!s) {
      s = { key, date: w.date, day: localDay(w.date), title: w.run ? RUN_INFO[w.run.type as RunType].label : w.dayName, kind: w.run ? 'run' : 'strength', run: w.run, note: w.note, records: [], minutes: w.durationMin ?? (w.run?.type === 'easy' ? w.run.minutes : undefined) }
      if (!w.run) { s.sets = 0; s.volumeKg = 0; s.exercises = [] }
      map.set(key, s)
    }
    s.note ??= w.note
    if (!w.run && w.sets.length) {
      s.sets! += w.sets.length
      s.volumeKg! += w.sets.reduce((v, x) => v + x.weightKg * x.reps, 0)
      const name = exercise(w.exerciseId)?.name ?? w.exerciseId
      s.exercises!.push(name)
      const top = Math.max(...w.sets.map(estimated1RM))
      const prev = best.get(w.exerciseId) ?? 0
      if (prev > 0 && top > prev * 1.01) s.records.push(name)
      if (top > prev) best.set(w.exerciseId, top)
    }
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
}

export interface DaySummary {
  day: string; sessions: SessionSummary[]; checkin?: Checkin; skip?: SkipEntry; sick?: boolean
}

export interface WeekSummary {
  start: string; end: string; days: DaySummary[]
  strength: number; runs: number; sets: number; volumeKg: number; minutes: number
  avgRunRpe?: number; avgHR?: number; km: number; records: string[]; skipped: number; sick: number
  avgSleep?: number; avgEnergy?: number
}

/** Uker bakover fra `now` (nyeste først), med alle sju dager. */
export function weekSummaries(input: { workouts: WorkoutEntry[]; checkins: Checkin[]; skips?: SkipEntry[]; sickDays?: Set<string>; weeks?: number; now?: Date }): WeekSummary[] {
  const now = input.now ?? new Date()
  const all = sessions(input.workouts)
  const out: WeekSummary[] = []
  const first = all.length ? new Date(all[all.length - 1].date) : now
  const weeks = input.weeks ?? Math.min(52, Math.max(1, Math.ceil((mondayOf(now).getTime() - mondayOf(first).getTime()) / (7 * 864e5)) + 1))
  for (let w = 0; w < weeks; w++) {
    const start = mondayOf(now); start.setDate(start.getDate() - 7 * w)
    const days: DaySummary[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i)
      const key = isoDay(d)
      if (d > now && key !== isoDay(now)) continue
      days.push({
        day: key,
        sessions: all.filter((s) => s.day === key).reverse(),
        checkin: input.checkins.find((c) => c.date === key),
        skip: input.skips?.find((s) => s.date === key),
        sick: input.sickDays?.has(key),
      })
    }
    const ss = days.flatMap((d) => d.sessions)
    const runs = ss.filter((s) => s.kind === 'run')
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)
    const cks = days.flatMap((d) => (d.checkin ? [d.checkin] : []))
    const end = new Date(start); end.setDate(end.getDate() + 6)
    out.push({
      start: isoDay(start), end: isoDay(end), days: days.reverse(),
      strength: ss.filter((s) => s.kind === 'strength').length, runs: runs.length,
      sets: ss.reduce((n, s) => n + (s.sets ?? 0), 0), volumeKg: Math.round(ss.reduce((n, s) => n + (s.volumeKg ?? 0), 0)),
      minutes: ss.reduce((n, s) => n + (s.minutes ?? 0), 0),
      avgRunRpe: avg(runs.map((r) => r.run!.rpe)), avgHR: avg(runs.flatMap((r) => (r.run?.avgHR ? [r.run.avgHR] : []))),
      km: Math.round(runs.reduce((n, r) => n + (r.run?.km ?? 0), 0) * 10) / 10,
      records: [...new Set(ss.flatMap((s) => s.records))],
      skipped: days.filter((d) => d.skip && !d.sessions.length).length, sick: days.filter((d) => d.sick).length,
      avgSleep: avg(cks.map((c) => c.sleep)), avgEnergy: avg(cks.map((c) => c.energy)),
    })
  }
  // Ikke vis tomme uker før brukeren startet
  while (out.length > 1 && !out[out.length - 1].days.some((d) => d.sessions.length || d.checkin || d.skip)) out.pop()
  return out
}

export interface StrengthRow { date: string; best: { weightKg: number; reps: number }; e1rm: number; sets: number; volumeKg: number }
export interface StrengthProgress { exerciseId: string; name: string; rows: StrengthRow[]; first: number; last: number; best: number; changePct: number }

/** Progresjon per styrkeøvelse: beste sett per økt og estimert 1RM. */
export function strengthProgress(workouts: WorkoutEntry[]): StrengthProgress[] {
  const by = new Map<string, StrengthRow[]>()
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    if (w.run || !w.sets.length) continue
    const top = w.sets.reduce((b, s) => (estimated1RM(s) > estimated1RM(b) ? s : b))
    const row: StrengthRow = { date: localDay(w.date), best: { weightKg: top.weightKg, reps: top.reps }, e1rm: Math.round(estimated1RM(top) * 10) / 10, sets: w.sets.length, volumeKg: Math.round(w.sets.reduce((v, x) => v + x.weightKg * x.reps, 0)) }
    by.set(w.exerciseId, [...(by.get(w.exerciseId) ?? []), row])
  }
  return [...by.entries()].map(([id, rows]) => {
    const first = rows[0].e1rm, last = rows[rows.length - 1].e1rm
    return { exerciseId: id, name: exercise(id)?.name ?? id, rows, first, last, best: Math.max(...rows.map((r) => r.e1rm)), changePct: first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0 }
  }).sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name))
}

export interface RunRow { date: string; reps?: number; minutes?: number; km?: number; avgHR?: number; rpe: number; note?: string }
export interface RunProgress { type: RunType; label: string; rows: RunRow[] }

export function runProgress(workouts: WorkoutEntry[]): RunProgress[] {
  const by = new Map<RunType, RunRow[]>()
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!w.run) continue
    const t = w.run.type as RunType
    by.set(t, [...(by.get(t) ?? []), { date: localDay(w.date), reps: w.run.reps, minutes: w.run.minutes, km: w.run.km, avgHR: w.run.avgHR, rpe: w.run.rpe, note: w.note }])
  }
  return [...by.entries()].map(([type, rows]) => ({ type, label: RUN_INFO[type].label, rows })).sort((a, b) => b.rows.length - a.rows.length)
}
