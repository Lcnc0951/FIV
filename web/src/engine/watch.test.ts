import { describe, expect, it } from 'vitest'
import { assessFitness, effectiveMaxHR } from './composition'
import { nutrition } from './coach'
import { personalSteps } from './generator'
import { PRESETS } from './presets'
import type { ProfileData } from './types'

const pd = (o: Partial<ProfileData> = {}): ProfileData => ({
  sex: 'male', age: 50, heightCm: 182, weightKg: 86, goal: 'recomposition', experience: 'intermediate', daysPerWeek: 3,
  sessionMinutes: 40, location: PRESETS.gym(), limitations: [], physique: 'balanced', postureGoals: [], ...o,
})

describe('klokkedata', () => {
  it('målt makspuls brukes når den er høyere enn formelen', () => {
    expect(effectiveMaxHR(50, 190)).toBe(193)
    expect(effectiveMaxHR(50)).toBe(179)
    expect(effectiveMaxHR(50, 175)).toBe(179) // formel innenfor +10 av målt
  })
  it('kondisjonsalder og nivå', () => {
    const f = assessFitness(32.6, 55, 'male')
    expect(f.fitnessAge).toBe(55)
    expect(f.percentOfAverage).toBe(100)
    // VO₂maks 39 som 50-åring: over snittet, kondisjonsalder rundt 40
    const me = assessFitness(39, 50, 'male')
    expect(me.label).toBe('Over snittet')
    expect(me.fitnessAge).toBeLessThan(45)
  })
  it('skrittmål bygger på snittet', () => {
    expect(personalSteps(8000, 8764)).toBe(10000)
    expect(personalSteps(10000, 12500)).toBe(12000)
    expect(personalSteps(8000)).toBe(8000)
  })
  it('kalorier fra aktiv energi', () => {
    const n = nutrition(pd({ watch: { activeKcal: 657 } }), 20)
    expect(n.fromWatch).toBe(true)
    expect(n.maintenanceKcal).toBeGreaterThan(2500)
  })
})
