import { describe, expect, it } from 'vitest'
import { runProgress, sessions, strengthProgress, weekSummaries } from './history'
import type { WorkoutEntry } from './types'

const lift = (date: string, kg: number, reps = 8, id = 'bench_db', day = 'Helkropp A'): WorkoutEntry =>
  ({ id: `${id}${date}`, date: `${date}T06:40:00`, dayName: day, exerciseId: id, sets: [{ weightKg: kg, reps, rir: 2 }, { weightKg: kg, reps: reps - 1, rir: 1 }] }) as WorkoutEntry
const run = (date: string, rpe: number, extra = {}): WorkoutEntry =>
  ({ id: `r${date}`, date: `${date}T06:40:00`, dayName: '4×4', exerciseId: 'run:intervals4x4', sets: [], run: { type: 'intervals4x4', rpe, reps: 4, ...extra } }) as WorkoutEntry

const W = [lift('2026-11-16', 20), lift('2026-11-16', 30, 10, 'goblet_squat'), run('2026-11-17', 8, { avgHR: 152, km: 6 }), lift('2026-11-23', 22.5), run('2026-11-24', 7, { avgHR: 148 }), lift('2026-11-26', 25)]

describe('historikk', () => {
  it('grupperer økter og finner rekorder', () => {
    const s = sessions(W)
    expect(s.filter((x) => x.kind === 'strength')).toHaveLength(3)
    const first = s.find((x) => x.day === '2026-11-16')!
    expect(first.exercises).toHaveLength(2); expect(first.sets).toBe(4)
    expect(s.find((x) => x.day === '2026-11-23')!.records).toEqual(['Benkpress med manualer'])
  })
  it('ukesoppsummering med dager', () => {
    const w = weekSummaries({ workouts: W, checkins: [{ date: '2026-11-24', sleep: 4, soreness: 3, energy: 4 }], skips: [{ date: '2026-11-25', reason: 'sick' }], now: new Date('2026-11-27T08:00:00') })
    expect(w).toHaveLength(2)
    expect(w[0]).toMatchObject({ start: '2026-11-23', strength: 2, runs: 1, skipped: 1 })
    expect(w[0].days[0].day).toBe('2026-11-27')
    expect(w[0].days).toHaveLength(5)
    expect(w[1]).toMatchObject({ strength: 1, runs: 1, km: 6 })
    expect(w[0].records).toContain('Benkpress med manualer')
  })
  it('progresjonstabeller', () => {
    const p = strengthProgress(W).find((x) => x.exerciseId === 'bench_db')!
    expect(p.rows).toHaveLength(3); expect(p.changePct).toBeGreaterThan(20)
    const r = runProgress(W)[0]
    expect(r.rows.map((x) => x.rpe)).toEqual([8, 7])
  })
})
