import { describe, expect, it } from 'vitest'
import { analyzeBody, analyzeMuscles, planPosture } from './analyzer'
import { analyzeFat, nutrition, planFatLoss, suggest } from './coach'
import { ellipseCircumference, navyBodyFat } from './composition'
import { generateProgram, lightLoadsOnly, totalSets } from './generator'
import { allExercises, exercise, isAvailable, isCompound } from './library'
import { PRESETS } from './presets'
import { MUSCLES, type ProfileData, type ScanMeasurements, type TrainingLocation } from './types'
import animations from '../data/animations.json'

const profile = (o: Partial<ProfileData> = {}): ProfileData => ({
  sex: 'male', age: 35, heightCm: 180, weightKg: 82, goal: 'buildMuscle', experience: 'intermediate', daysPerWeek: 4,
  sessionMinutes: 60, location: PRESETS.gym(), limitations: [], physique: 'balanced', postureGoals: [], ...o,
})
const scan: ScanMeasurements = {
  neckCm: 38, chestCm: 102, waistCm: 86, hipCm: 98, upperArmLeftCm: 33, upperArmRightCm: 35.5,
  thighLeftCm: 57, thighRightCm: 57.5, shoulderTiltDeg: 0.8, hipTiltDeg: -0.5, forwardHeadCm: 7,
}

describe('kroppssammensetning', () => {
  it('Navy for menn', () => expect(navyBodyFat('male', 180, 38, 86)).toBeCloseTo(16.9, 0))
  it('ellipse = sirkel', () => expect(ellipseCircumference(10, 10)).toBeCloseTo(Math.PI * 10, 3))
})

describe('analyse', () => {
  it('finner asymmetri og holdning', () => {
    const a = analyzeBody(profile(), scan)
    expect(a.unilateralFocus.biceps).toBe('left')
    expect(a.postureFlags.has('forwardHead')).toBe(true)
    expect(a.priorities.upperBack).toBeGreaterThan(1)
  })
  it('kroppsform flytter prioriteringer', () => {
    const v = analyzeBody(profile({ physique: 'vTaper' }))
    expect(v.priorities.lats).toBeGreaterThan(v.priorities.quads)
  })
  it('V-form flagger smal overkropp', () => {
    const r = analyzeMuscles(profile({ physique: 'vTaper' }), { ...scan, chestCm: 95 }, 15)
    expect(r.regions.find((x) => x.name === 'Overkropp vs. midje')?.prioritize).toBe(true)
  })
  it('holdningsplan fra skann og mål', () => {
    const plan = planPosture(profile({ postureGoals: ['lowerBack'] }), { forwardHeadCm: 8, roundedShouldersCm: 6 })
    const ids = plan.drills.map((d) => d.id)
    expect(ids).toContain('chin_tuck'); expect(ids).toContain('face_pull'); expect(ids).toContain('curl_up')
    expect(plan.drills.length).toBeLessThanOrEqual(7)
  })
})

describe('program', () => {
  it('respekterer tid og når volum', () => {
    const p = profile()
    const prog = generateProgram(p, analyzeBody(p, scan))
    expect(prog.days).toHaveLength(4)
    const cap = Math.floor((p.sessionMinutes - 8) / 2.8)
    for (const d of prog.days) { expect(totalSets(d)).toBeLessThanOrEqual(cap + 1); expect(d.exercises.length).toBeGreaterThan(0) }
    for (const m of MUSCLES) expect(prog.weeklySets[m]).toBeGreaterThanOrEqual(prog.targetSets[m] * 0.5)
  })
  it('velger ettsidig øvelse ved asymmetri', () => {
    const p = profile()
    const prog = generateProgram(p, analyzeBody(p, scan))
    const biceps = prog.days.flatMap((d) => d.exercises).map((x) => exercise(x.exerciseId)!).filter((e) => e.primary === 'biceps')
    expect(biceps.some((e) => e.unilateral)).toBe(true)
  })
  it('alle splitter og utstyr', () => {
    for (let d = 2; d <= 6; d++) for (const loc of Object.values(PRESETS)) {
      const p = profile({ daysPerWeek: d, location: loc() })
      const prog = generateProgram(p, analyzeBody(p))
      expect(prog.days.length).toBe(Math.max(2, d))
      for (const x of prog.days.flatMap((dd) => dd.exercises)) expect(isAvailable(exercise(x.exerciseId)!, new Set(p.location.equipment))).toBe(true)
    }
  })
  it('lette manualer gir flere reps', () => {
    const loc: TrainingLocation = { ...PRESETS.homeDumbbells(), dumbbellWeights: [2, 4, 6, 8, 10] }
    const p = profile({ location: loc })
    expect(lightLoadsOnly(p)).toBe(true)
    const prog = generateProgram(p, analyzeBody(p))
    const comp = prog.days.flatMap((d) => d.exercises).filter((x) => { const e = exercise(x.exerciseId)!; return isCompound(e) && e.pattern !== 'carry' })
    expect(comp.every((x) => x.repsMin >= 12)).toBe(true)
  })
  it('alle øvelser har animasjon', () => {
    const map = (animations as { exercises: Record<string, string>; animations: Record<string, unknown> })
    for (const e of allExercises) expect(map.animations[map.exercises[e.id]], e.id).toBeTruthy()
  })
})

describe('coach', () => {
  it('progresjon med tilgjengelige manualer', () => {
    const p = { id: 'x', exerciseId: 'bench_db', sets: 3, repsMin: 8, repsMax: 12, rir: 2, restSeconds: 120 }
    const sets = [1, 2, 3].map(() => ({ weightKg: 20, reps: 12, rir: 1 }))
    expect(suggest(p, sets, [10, 15, 20, 25]).weightKg).toBe(25)
    const maxed = suggest(p, sets, [10, 15, 20])
    expect(maxed.weightKg).toBe(20); expect(maxed.targetReps).toBeGreaterThan(12)
  })
  it('fettplan', () => {
    const p = profile({ goal: 'loseFat' })
    const fat = analyzeFat(p, { neckCm: 38, waistCm: 100, hipCm: 104 })
    expect(fat.distribution).toBe('central')
    const plan = planFatLoss(p, fat, 100)
    expect(plan.needed).toBe(true); expect(plan.targetBodyFat).toBe(15); expect(plan.weeks).toBeGreaterThan(4)
    expect(plan.milestones.at(-1)!.week).toBe(plan.weeks)
  })
  it('fett uten skann bruker BMI', () => expect(analyzeFat(profile()).source).toBe('bmiEstimate'))
  it('protein ved fettap', () => {
    const n = nutrition(profile({ goal: 'loseFat' }), 22)
    expect(n.proteinG).toBe(Math.round(82 * 2.2)); expect(n.targetKcal).toBeLessThan(n.maintenanceKcal)
  })
})
