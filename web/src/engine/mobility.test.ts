import { describe, expect, it } from 'vitest'
import { analyzeBody } from './analyzer'
import { generateProgram } from './generator'
import { exercise, isAvailable } from './library'
import { parseMobility, planMobility, strengthAreas, suggestLevel } from './mobility'
import { applyPain } from './pain'
import { PRESETS } from './presets'
import type { ProfileData } from './types'

const USER = 'Jeg er ekstremt stiv i kroppen lite bevegelighet klarer ikke å sitte på alle fire å svinge armene en av gangen å peke opp mot taket. Jeg har så vondt i den muskelen som ligger oppe på skulderbladet. Får ikke gjort benkpress fordi det verker i skulderen'

describe('plager og bevegelighet', () => {
  it('forstår brukerens beskrivelse', () => {
    const p = parseMobility(USER)
    expect(p.regions).toEqual(expect.arrayContaining(['upperTrap', 'shoulder', 'thoracic']))
    expect(p.limits).toEqual(expect.arrayContaining(['noQuadruped', 'benchPain']))
    expect(p.stiff).toBe(true)
  })
  it('rutinen unngår alle fire og trener baksiden av skuldrene', () => {
    const p = parseMobility(USER)
    const plan = planMobility({ ...p, level: 2, pain: 4 })
    expect(plan.daily.some((d) => d.needs?.includes('quadruped'))).toBe(false)
    expect(plan.daily.map((d) => d.id)).toEqual(expect.arrayContaining(['band_pull_apart']))
    expect(plan.daily.length).toBeLessThanOrEqual(8)
    expect(plan.goal?.id).toBe('quad_rotation')
    // Mye smerte: bare nivå 1
    expect(planMobility({ ...p, level: 2, pain: 7 }).daily.every((d) => d.level === 1)).toBe(true)
  })
  it('styrkeprogrammet får skånsom benk og øvelse for baksiden av skuldrene', () => {
    const pd: ProfileData = { sex: 'male', age: 45, heightCm: 180, weightKg: 86, goal: 'buildMuscle', experience: 'intermediate', daysPerWeek: 3,
      sessionMinutes: 40, location: PRESETS.gym(), limitations: [], physique: 'balanced', postureGoals: [] }
    const prog = generateProgram(pd, analyzeBody(pd))
    const areas = strengthAreas({ ...parseMobility(USER), text: USER, pain: 5, level: 1, since: '2026-11-22' })
    expect(areas).toEqual(['shoulder'])
    const items = new Set(pd.location.equipment)
    const { program } = applyPain(prog, areas, (id) => isAvailable(exercise(id)!, items))
    const ex = program!.days.flatMap((d) => d.exercises)
    expect(ex.some((x) => x.exerciseId === 'bench_bb')).toBe(false)
    expect(ex.some((x) => exercise(x.exerciseId)!.pattern === 'horizontalPush' && /Skånsom|nøytralt/.test(x.note ?? ''))).toBe(true)
    expect(ex.some((x) => exercise(x.exerciseId)!.pattern === 'rearDelt')).toBe(true)
  })
  it('nivå opp når smerten holder seg lav', () => {
    const m = { ...parseMobility(USER), text: USER, pain: 3, level: 1 as const, since: '2026-11-01' }
    const logs = ['2026-11-20', '2026-11-21', '2026-11-22'].map((date) => ({ date, pain: 2, done: true }))
    expect(suggestLevel(m, logs)?.level).toBe(2)
    expect(strengthAreas({ ...m, resolved: '2026-12-01' })).toEqual([])
  })
})
