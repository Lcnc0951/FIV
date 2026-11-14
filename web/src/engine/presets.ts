import { EQUIPMENT_ITEMS, uid, type TrainingLocation } from './types'

const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => +(from + i * step).toFixed(1))

export const PRESETS = {
  gym: (): TrainingLocation => ({ id: uid(), name: 'Treningssenter', kind: 'gym', equipment: [...EQUIPMENT_ITEMS],
    dumbbellWeights: range(2, 50, 2), kettlebellWeights: [8, 12, 16, 20, 24, 28, 32], barbellMaxKg: 200 }),
  homeGym: (): TrainingLocation => ({ id: uid(), name: 'Hjemmegym', kind: 'home',
    equipment: ['barbell', 'squatRack', 'bench', 'dumbbells', 'pullUpBar', 'resistanceBands'],
    dumbbellWeights: range(2.5, 24, 2.5), kettlebellWeights: [], barbellMaxKg: 120 }),
  homeDumbbells: (): TrainingLocation => ({ id: uid(), name: 'Hjemme', kind: 'home', equipment: ['dumbbells', 'bench', 'resistanceBands'],
    dumbbellWeights: [2, 4, 6, 8, 10, 12.5, 15, 17.5, 20], kettlebellWeights: [] }),
  bodyweight: (): TrainingLocation => ({ id: uid(), name: 'Uten utstyr', kind: 'home', equipment: [], dumbbellWeights: [], kettlebellWeights: [] }),
}
export type PresetKey = keyof typeof PRESETS
export const PRESET_LABEL: Record<PresetKey, string> = {
  gym: 'Treningssenter', homeGym: 'Hjemmegym (stang, stativ, benk)', homeDumbbells: 'Hjemme med manualer', bodyweight: 'Hjemme uten utstyr',
}
