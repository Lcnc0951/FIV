import { describe, expect, it } from 'vitest'
import { weekRings } from './extras'
import type { DayPlan } from './week'
import type { WorkoutEntry } from './types'

const kinds: DayPlan['kind'][] = ['strength', 'run', 'strength', 'run', 'strength', 'rest', 'rest']
const days = kinds.map((kind, weekday) => ({ weekday, kind, run: kind === 'run' ? 'intervals4x4' : undefined })) as unknown as DayPlan[]
const monday = new Date('2026-11-16T00:00:00')
const at = (wd: number, h = 7) => { const d = new Date(monday); d.setDate(d.getDate() + wd); d.setHours(h); return d.toISOString() }
const lift = (wd: number): WorkoutEntry => ({ id: 's' + wd, date: at(wd), exerciseId: 'bench_db', sets: [{ weightKg: 20, reps: 10, rir: 2 }] } as unknown as WorkoutEntry)
const run = (wd: number): WorkoutEntry => ({ id: 'r' + wd, date: at(wd), exerciseId: 'run', sets: [], run: { type: 'intervals4x4', rpe: 7 } } as unknown as WorkoutEntry)
const night = (wd: number, sleep = 4) => ({ date: at(wd).slice(0, 10), sleep, soreness: 3, energy: 3 })

describe('ukeringer', () => {
  it('fylles mot hele ukas plan og viser om man er i rute', () => {
    const r = weekRings({ days, workouts: [lift(0), run(1)], checkins: [night(0), night(1, 2)], weekStart: monday, now: new Date(at(2, 5)) })
    const [s, k, rec] = r.rings
    expect([s.done, s.goal, s.expected]).toEqual([1, 3, 1])
    expect([k.done, k.goal]).toEqual([1, 2])
    expect(rec.done).toBe(1) // dårlig natt teller ikke
    expect(r.closed).toBe(false)
    expect(r.days[0].done).toBe(true); expect(r.days[2].done).toBe(false)
  })
  it('alle ringer lukket når uka er gjennomført, også med flyttet økt', () => {
    const workouts = [lift(0), run(1), lift(2), run(3), lift(5)] // fredagsøkta tatt lørdag
    const checkins = [0, 1, 2, 3, 4].map((d) => night(d))
    const r = weekRings({ days, workouts, checkins, weekStart: monday, now: new Date(at(7, 12)) })
    expect(r.rings.map((x) => x.pct)).toEqual([1, 1, 1])
    expect(r.closed).toBe(true); expect(r.complete).toBe(true)
  })
  it('første uke teller bare fra startdagen', () => {
    const r = weekRings({ days, workouts: [lift(2)], checkins: [], weekStart: monday, now: new Date(at(3, 5)), since: new Date(at(2, 6)) })
    expect(r.rings[0].goal).toBe(2); expect(r.rings[1].goal).toBe(1)
    expect(r.rings[2].goal).toBeLessThan(5)
  })
})
