import { describe, expect, it } from 'vitest'
import { defaultProfile } from '../ui/ProfileForm'
import { music, planWeek, runSegments, totalSeconds, weekWarnings } from './week'
import { withDefaults } from './types'

const monday = new Date('2026-11-16T07:00:00') // uke 47

describe('ukeplan', () => {
  it('3 styrke + 2 løp man–fre + valgfri lørdag', () => {
    const p = withDefaults(defaultProfile())
    const days = planWeek(p, 3, monday)
    expect(days.map((d) => d.kind)).toEqual(['strength', 'run', 'strength', 'run', 'strength', 'optional', 'rest'])
    expect(days[1].run && ['intervals4x4', 'short45_20']).toContain(days[1].run)
    expect(days[3].run).toBe('tempo20')
    expect(weekWarnings(days)).toEqual([])
  })
  it('veksler mellom 4×4 og 45/20 fra uke til uke', () => {
    const p = withDefaults(defaultProfile())
    const a = planWeek(p, 3, monday)[1].run
    const b = planWeek(p, 3, new Date('2026-11-23T07:00:00'))[1].run
    expect(a).not.toBe(b)
  })
  it('brukerens egne endringer vinner', () => {
    const p = { ...withDefaults(defaultProfile()), weekOverrides: { 1: { kind: 'rest' as const }, 2: { kind: 'run' as const, run: 'short45_20' as const } } }
    const days = planWeek(p, 3, monday)
    expect(days[1].kind).toBe('rest')
    expect(days[2].run).toBe('short45_20')
    // styrkeøktene nummereres på nytt (A, B …)
    expect(days.filter((d) => d.kind === 'strength').map((d) => d.strengthIndex)).toEqual([0, 1])
  })
  it('advarer mot harde intervaller to dager på rad', () => {
    const p = { ...withDefaults(defaultProfile()), weekOverrides: { 1: { kind: 'run' as const, run: 'intervals4x4' as const }, 2: { kind: 'run' as const, run: 'short45_20' as const } } }
    expect(weekWarnings(planWeek(p, 3, monday)).length).toBeGreaterThan(0)
  })
  it('løpeøktene passer i 40 minutter', () => {
    expect(totalSeconds(runSegments('intervals4x4'))).toBe(40 * 60)
    expect(totalSeconds(runSegments('short45_20'))).toBeLessThanOrEqual(40 * 60)
    expect(totalSeconds(runSegments('tempo20'))).toBe(30 * 60)
    expect(runSegments('short45_20').filter((s) => s.intensity === 'hard')).toHaveLength(12)
  })
  it('har musikk til alle treningsdager', () => {
    const days = planWeek(withDefaults(defaultProfile()), 3, monday)
    for (const d of days) if (d.kind !== 'rest') expect(music(d)?.playlists.length).toBeGreaterThan(0)
  })
})
