import { describe, expect, it } from 'vitest'
import { applyCalibration, estimateMinutes, learnCalibration, supersets, weeklyReport } from './extras'
import { exercise } from './library'
import type { WorkoutDay } from './generator'
import type { DayPlan } from './week'

describe('kalibrering', () => {
  it('lærer av målebånd og retter neste skann', () => {
    const raw = { waistCm: 90, neckCm: 38, upperArmLeftCm: 33, upperArmRightCm: 34 }
    const { cal, learned } = learnCalibration(raw, { ...raw, waistCm: 94.5 })
    expect(learned).toEqual(['waist'])
    expect(cal.waist).toBeCloseTo(1.05, 3)
    expect(applyCalibration({ waistCm: 100, neckCm: 40 }, cal)).toEqual({ waistCm: 105, neckCm: 40 })
    // Ny korreksjon snittes med den gamle
    const next = learnCalibration({ waistCm: 100 }, { waistCm: 103 }, cal)
    expect(next.cal.waist).toBeCloseTo((1.05 + 1.03) / 2, 3)
  })
  it('urimelige korreksjoner begrenses', () => {
    expect(learnCalibration({ waistCm: 80 }, { waistCm: 140 }).cal.waist).toBe(1.25)
  })
})

describe('supersett', () => {
  const day: WorkoutDay = { id: 'd', name: 'Helkropp A', focus: '', exercises: ['back_squat', 'bench_db', 'cable_row', 'seated_leg_curl', 'db_lateral', 'cable_crunch'].map((id, i) => ({ id: String(i), exerciseId: id, sets: 3, repsMin: 8, repsMax: 12, rir: 2, restSeconds: exercise(id)!.pattern === 'squat' || ['bench_db', 'cable_row'].includes(id) ? 150 : 90 })) }
  it('setter press med drag og bein med kjerne', () => {
    const g = supersets(day, 40)
    const names = g.map((x) => x.items.map((p) => p.exerciseId))
    expect(names).toContainEqual(['back_squat', 'cable_crunch'])
    expect(names).toContainEqual(['bench_db', 'cable_row'])
    expect(g.length).toBeLessThan(day.exercises.length)
    expect(estimateMinutes(g)).toBeLessThan(estimateMinutes(supersets(day, 90)))
  })
  it('ingen supersett i lange økter', () => {
    expect(supersets(day, 75).every((g) => g.items.length === 1)).toBe(true)
  })
})

describe('ukesrapport', () => {
  const days: DayPlan[] = [
    { weekday: 0, kind: 'strength', strengthIndex: 0 }, { weekday: 1, kind: 'run', run: 'intervals4x4' }, { weekday: 2, kind: 'strength', strengthIndex: 1 },
    { weekday: 3, kind: 'run', run: 'tempo20' }, { weekday: 4, kind: 'strength', strengthIndex: 2 }, { weekday: 5, kind: 'optional', run: 'easy' }, { weekday: 6, kind: 'rest' },
  ]
  const w = (date: string, kg: number, reps = 8) => ({ id: date + kg, date: date + 'T06:30:00', dayName: 'A', exerciseId: 'bench_db', sets: [{ weightKg: kg, reps, rir: 2 }] })
  it('teller økter, rekorder og gir én beskjed', () => {
    const r = weeklyReport({
      days, goal: 'buildMuscle', weekStart: new Date('2026-11-16T12:00'), now: new Date('2026-11-23T08:00'),
      workouts: [w('2026-11-09', 30), w('2026-11-16', 32.5), { id: 'r', date: '2026-11-17T06:30', dayName: '4×4', exerciseId: 'run:intervals4x4', sets: [], run: { type: 'intervals4x4', rpe: 7, reps: 4 } },
        w('2026-11-18', 32.5), w('2026-11-20', 32.5)],
      checkins: [{ date: '2026-11-16', sleep: 2, soreness: 4, energy: 4 }, { date: '2026-11-17', sleep: 4, soreness: 4, energy: 4, sleepScore: 52 }],
      weights: [],
    })
    expect(r.complete).toBe(true)
    expect(r.planned).toBe(5)
    expect(r.done).toBe(4)
    expect(r.records[0]?.name).toBe('Benkpress med manualer')
    expect(r.shortNights).toBe(2)
    expect(r.focus).toMatch(/Søvnen/)
  })
})

describe('ukesrapport for ny bruker', () => {
  it('teller ikke dager før start', () => {
    const days: DayPlan[] = [0, 1, 2, 3, 4].map((d) => ({ weekday: d, kind: d % 2 ? 'run' : 'strength', run: d % 2 ? 'tempo20' : undefined, strengthIndex: 0 })) as DayPlan[]
    const r = weeklyReport({ days, workouts: [], checkins: [], weights: [], goal: 'buildMuscle', weekStart: new Date('2026-11-16T12:00'), now: new Date('2026-11-19T07:00'), since: new Date('2026-11-18T09:00') })
    expect(r.planned).toBe(2) // onsdag og torsdag
    expect(r.streak).toBe(0)
  })
})
