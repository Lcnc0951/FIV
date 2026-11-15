import { describe, expect, it } from 'vitest'
import { adjustDay, cycleInfo, kcalSuggestion, nextRun, parseWatchText, readiness, weightTrend } from './daily'

describe('dagsform', () => {
  it('grønn, gul og rød', () => {
    expect(readiness({ date: 'x', sleep: 4, soreness: 4, energy: 4 }).level).toBe('green')
    expect(readiness({ date: 'x', sleep: 3, soreness: 3, energy: 3 }).level).toBe('yellow')
    expect(readiness({ date: 'x', sleep: 1, soreness: 2, energy: 2 }).level).toBe('red')
    expect(readiness({ date: 'x', sleep: 4, soreness: 4, energy: 4, restingHR: 62 }, 52).level).toBe('yellow')
  })
  it('rød dag gjør intervaller om til rolig løp', () => {
    const a = adjustDay({ weekday: 1, kind: 'run', run: 'intervals4x4' }, 'red', false)
    expect(a.day.run).toBe('easy')
    expect(adjustDay({ weekday: 0, kind: 'strength', strengthIndex: 0 }, 'yellow', false).volumeFactor).toBe(0.75)
    expect(adjustDay({ weekday: 0, kind: 'strength', strengthIndex: 0 }, undefined, true).volumeFactor).toBe(0.5)
  })
})

describe('vekt', () => {
  const days = (start: number, kgs: number[]) => kgs.map((kg, i) => ({ date: `2026-11-${String(start + i).padStart(2, '0')}`, kg }))
  it('ukesnitt og kaloriforslag ved fettap', () => {
    const t = weightTrend([...days(1, [90, 90, 90, 90, 90, 90, 90]), ...days(8, [90, 90, 89.9, 90, 90, 89.9, 90])])
    expect(t.avg7).toBeCloseTo(89.97, 1)
    expect(kcalSuggestion('loseFat', t)?.kcal).toBe(-150)
    const ok = weightTrend([...days(1, [90, 90, 90, 90, 90, 90, 90]), ...days(8, [89.5, 89.4, 89.4, 89.5, 89.3, 89.4, 89.4])])
    expect(kcalSuggestion('loseFat', ok)?.kcal).toBe(0)
  })
})

describe('løpeprogresjon', () => {
  it('45/20 øker ett drag når det føles lett', () => {
    expect(nextRun('short45_20', []).reps).toBe(10)
    expect(nextRun('short45_20', [{ type: 'short45_20', date: '2026-11-10', rpe: 7, reps: 11 }]).reps).toBe(12)
    expect(nextRun('short45_20', [{ type: 'short45_20', date: '2026-11-10', rpe: 9, reps: 12 }]).reps).toBe(11)
    expect(nextRun('tempo20', [{ type: 'tempo20', date: '2026-11-10', rpe: 6, minutes: 20 }]).minutes).toBe(25)
  })
})

describe('periode og klokkedata', () => {
  it('uke i perioden og lett uke', () => {
    const start = new Date('2026-11-02T06:00:00')
    expect(cycleInfo(start.toISOString(), 5, new Date('2026-11-04')).week).toBe(1)
    expect(cycleInfo(start.toISOString(), 5, new Date('2026-12-01')).deload).toBe(true)
    expect(cycleInfo(start.toISOString(), 5, new Date('2026-12-10')).finished).toBe(true)
  })
  it('leser tekst fra Snarvei', () => {
    const w = parseWatchText('Kondisjon: 39,2\nHvilepuls: 52\nSkritt: 8 764\nAktiv energi: 657 kcal\nMaks puls: 175')
    expect(w).toMatchObject({ vo2max: 39.2, restingHR: 52, steps: 8764, activeKcal: 657, maxHR: 175 })
  })
})

import { bedtimeFor, sleepAvailable, sleepFromScore } from './daily'
describe('søvn', () => {
  it('leggetid før 06:10-trening', () => {
    expect(bedtimeFor('06:10', 7)).toEqual({ wake: '05:45', bed: '22:30' })
    expect(sleepAvailable('06:10', '23:46')).toBeCloseTo(5.7, 1)
  })
  it('Apples søvnscore og vitale tegn i dagsformen', () => {
    expect(sleepFromScore(71)).toBe(3)
    expect(readiness({ date: 'x', sleep: 5, soreness: 4, energy: 4, sleepScore: 45 }).reasons).toContain('søvnscore 45')
    expect(readiness({ date: 'x', sleep: 4, soreness: 4, energy: 4, vitalsOutlier: true }).level).toBe('yellow')
  })
  it('leser leggetid fra Snarvei-tekst', () => {
    expect(parseWatchText('Hvilepuls: 53\nLeggetid: 23:46')).toMatchObject({ restingHR: 53, avgBedtime: '23:46' })
  })
})
