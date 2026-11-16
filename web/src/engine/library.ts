import { EXERCISES } from '../data/exercises'
import { COMPOUND, EQUIPMENT_INFO, type EquipmentItem, type Exercise, type Limitation, type Muscle, type MovementPattern, type TrainingLocation } from './types'

const byId = new Map(EXERCISES.map((e) => [e.id, e]))

export const exercise = (id: string): Exercise | undefined => byId.get(id)
export const allExercises = EXERCISES

export function isAvailable(e: Exercise, items: Set<EquipmentItem>): boolean {
  return e.requires.every((r) => items.has(r)) && (e.anyOf.length === 0 || e.anyOf.some((a) => items.has(a)))
}

/** 2 = maskin/stang, 1 = manualer/strikk/benk, 0 = kroppsvekt. */
export function tier(e: Exercise): number {
  const all = [...e.requires, ...e.anyOf]
  if (all.some((i) => EQUIPMENT_INFO[i].heavy)) return 2
  return all.length ? 1 : 0
}

export const isCompound = (e: Exercise) => COMPOUND.has(e.pattern)
export const usesDumbbells = (e: Exercise) => e.requires.includes('dumbbells') || e.anyOf.includes('dumbbells')

export function equipmentText(e: Exercise): string {
  const parts = e.requires.map((i) => EQUIPMENT_INFO[i].label).sort()
  if (e.anyOf.length) parts.push(e.anyOf.map((i) => EQUIPMENT_INFO[i].label).sort().join(' eller '))
  return parts.length ? parts.join(' + ') : 'Ingen utstyr'
}

export function select(opts: {
  pattern: MovementPattern
  available: Set<EquipmentItem>
  limitations: Limitation[]
  preferPrimary?: Muscle
  preferUnilateral?: boolean
  occurrence?: number
  exclude?: Set<string>
  /** Brukeren vil heller ha manualer, kettlebell og strikk enn kabler. */
  preferFreeWeights?: boolean
}): Exercise | undefined {
  const { pattern, available, limitations, preferPrimary, preferUnilateral = false, occurrence = 0, exclude = new Set(), preferFreeWeights = false } = opts
  const candidates = EXERCISES.filter((e) =>
    e.pattern === pattern && isAvailable(e, available) && !e.avoidWith.some((l) => limitations.includes(l)) && !exclude.has(e.id))
  if (!candidates.length) return undefined
  const score = (e: Exercise) =>
    (preferPrimary && e.primary === preferPrimary ? 40 : 0) + (preferUnilateral && e.unilateral ? 25 : 0) +
    (e.lengthenedBias ? 10 : 0) + tier(e) * 6 + (preferFreeWeights ? freeWeightBonus(e) : 0)
  const ranked = [...candidates].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
  const best = score(ranked[0])
  const top = ranked.filter((e) => score(e) >= best - 5).slice(0, 3)
  return top[occurrence % top.length]
}

const FREE = new Set(['dumbbells', 'kettlebell', 'resistanceBands'])
/** Bonus for manualer/kettlebell/strikk, trekk for kabelmaskin. Andre maskiner (f.eks. lårcurl) er nøytrale. */
export function freeWeightBonus(e: Exercise): number {
  const all = [...e.requires, ...e.anyOf]
  if (e.requires.includes('cableMachine')) return -16
  return all.some((i) => FREE.has(i)) ? 14 : 0
}

export function alternatives(to: Exercise, location: TrainingLocation, limitations: Limitation[], preferFreeWeights = false): Exercise[] {
  const items = new Set(location.equipment)
  return EXERCISES.filter((e) => e.id !== to.id && (e.pattern === to.pattern || e.primary === to.primary) &&
    isAvailable(e, items) && !e.avoidWith.some((l) => limitations.includes(l)))
    .sort((a, b) => {
      const fa = preferFreeWeights ? freeWeightBonus(a) : 0, fb = preferFreeWeights ? freeWeightBonus(b) : 0
      const ka = [a.pattern === to.pattern ? 1 : 0, fa, tier(a), a.lengthenedBias ? 1 : 0]
      const kb = [b.pattern === to.pattern ? 1 : 0, fb, tier(b), b.lengthenedBias ? 1 : 0]
      for (let i = 0; i < 4; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]
      return 0
    })
}
