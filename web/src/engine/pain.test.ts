import { describe, expect, it } from 'vitest'
import { analyzeBody } from './analyzer'
import { generateProgram } from './generator'
import { exercise } from './library'
import { activeTemp, applyPain, detectPain } from './pain'
import { PRESETS } from './presets'
import type { ProfileData } from './types'

const pd: ProfileData = {
  sex: 'male', age: 45, heightCm: 180, weightKg: 86, goal: 'buildMuscle', experience: 'intermediate', daysPerWeek: 3,
  sessionMinutes: 40, location: PRESETS.gym(), limitations: [], physique: 'balanced', postureGoals: [],
}

describe('plager', () => {
  it('gjenkjenner smerte og område', () => {
    expect(detectPain('Jeg har vondt, tror det er i en muskel bak i skulderplaten venstre side. Det gjør vondt å løfte armen'))
      .toEqual({ pain: true, area: 'shoulder' })
    expect(detectPain('Kneet verker etter løping').area).toBe('knee')
    expect(detectPain('Stiv i korsryggen i dag').area).toBe('lowerBack')
    expect(detectPain('Hva bør jeg spise før økta?').pain).toBe(false)
    expect(detectPain('Er det varmt nok å løpe ute?').pain).toBe(false)
  })
  it('tar ut skulderbelastende øvelser og gjør resten lettere', () => {
    const prog = generateProgram(pd, analyzeBody(pd))
    const { program, removed } = applyPain(prog, ['shoulder'])
    const left = program!.days.flatMap((d) => d.exercises).map((x) => exercise(x.exerciseId)!)
    expect(removed.length).toBeGreaterThan(0)
    expect(left.some((e) => ['verticalPush', 'lateralRaise', 'chestFly', 'verticalPull'].includes(e.pattern))).toBe(false)
    expect(left.some((e) => e.pattern === 'squat')).toBe(true)
    // Lagret program endres ikke
    expect(prog.days.flatMap((d) => d.exercises).length).toBeGreaterThan(left.length)
  })
  it('utløpte plager er ikke aktive', () => {
    const list = [{ area: 'knee' as const, since: '2026-01-01', until: '2026-01-08' }]
    expect(activeTemp(list, new Date('2026-01-05'))).toHaveLength(1)
    expect(activeTemp(list, new Date('2026-01-10'))).toHaveLength(0)
  })
})
