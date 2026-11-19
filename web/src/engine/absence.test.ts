import { describe, expect, it } from 'vitest'
import { adjustForHealth, excusedDays, healthPhase } from './absence'
import type { DayPlan } from './week'

const run4x4 = { weekday: 1, kind: 'run', run: 'intervals4x4' } as unknown as DayPlan
const base = { day: run4x4, volumeFactor: 1, runScale: 1, message: '' }

describe('syk-modus', () => {
  it('syk → opptrapping → normal', () => {
    const sick = { since: '2026-11-19' }
    expect(healthPhase(sick, new Date('2026-11-20T07:00')).phase).toBe('sick')
    const rec = { ...sick, recovered: '2026-11-22' }
    const d1 = healthPhase(rec, new Date('2026-11-22T07:00'))
    expect(d1).toMatchObject({ phase: 'return', step: 1 })
    const a = adjustForHealth(base, d1)
    expect(a.day.run).toBe('easy'); expect(a.runScale).toBeLessThan(1)
    expect(healthPhase(rec, new Date('2026-11-24T07:00'))).toMatchObject({ phase: 'return', step: 2 })
    expect(healthPhase(rec, new Date('2026-11-26T07:00')).phase).toBe('normal')
  })
  it('lang sykdom gir lengre opptrapping', () => {
    const rec = { since: '2026-11-01', recovered: '2026-11-12' }
    expect(healthPhase(rec, new Date('2026-11-17T07:00')).phase).toBe('return')
  })
  it('sliten forrige gang gir litt lettere økt', () => {
    const a = adjustForHealth({ ...base, day: { weekday: 0, kind: 'strength' } as unknown as DayPlan }, { phase: 'normal' }, { date: '2026-11-18', reason: 'tired' })
    expect(a.volumeFactor).toBe(0.8)
  })
  it('syke dager unntas, friskmeldingsdagen teller', () => {
    const d = excusedDays([{ date: '2026-11-10', reason: 'busy' }], { since: '2026-11-19', recovered: '2026-11-21' })
    expect([...d].sort()).toEqual(['2026-11-19', '2026-11-20'])
  })
})
