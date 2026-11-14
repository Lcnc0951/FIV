import type { Sex } from './types'

/** U.S. Navy (Hodgdon & Beckett 1984). */
export function navyBodyFat(sex: Sex, heightCm: number, neckCm: number, waistCm: number, hipCm?: number): number | undefined {
  let v: number
  if (sex === 'male') {
    const d = waistCm - neckCm
    if (d <= 0) return undefined
    v = 495 / (1.0324 - 0.19077 * Math.log10(d) + 0.15456 * Math.log10(heightCm)) - 450
  } else {
    if (hipCm == null) return undefined
    const d = waistCm + hipCm - neckCm
    if (d <= 0) return undefined
    v = 495 / (1.29579 - 0.35004 * Math.log10(d) + 0.221 * Math.log10(heightCm)) - 450
  }
  return Number.isFinite(v) && v >= 2 && v <= 60 ? v : undefined
}

export const leanMass = (w: number, bf: number) => w * (1 - bf / 100)

export function normalizedFFMI(w: number, hCm: number, bf: number): number {
  const h = hCm / 100
  return leanMass(w, bf) / (h * h) + 6.1 * (1.8 - h)
}

export const bmi = (w: number, hCm: number) => w / ((hCm / 100) ** 2)

/** Ramanujan-ellipse fra bredde og dybde. */
export function ellipseCircumference(width: number, depth: number): number {
  const a = width / 2, b = depth / 2
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))
}

/** HUNT-formelen (Nes 2013). */
export const maxHeartRate = (age: number) => Math.round(211 - 0.64 * age)
