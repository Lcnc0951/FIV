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

/** Makspuls: målt verdi fra klokka (+3 for at sjelden noen treffer helt maks), ellers HUNT-formelen. */
export function effectiveMaxHR(age: number, measured?: number): number {
  const formula = maxHeartRate(age)
  return measured && measured > 120 ? Math.max(measured + 3, Math.min(formula, measured + 10)) : formula
}

// Median VO₂maks etter alder (FRIEND-registeret, Kaminsky 2015), midtpunkt per tiår.
// Ligger nærmere klokkemålinger enn lab-referanser som HUNT, som er høyere.
const NORM_MEDIAN: Record<'male' | 'female', [number, number][]> = {
  male: [[25, 48.0], [35, 42.4], [45, 37.8], [55, 32.6], [65, 28.2], [75, 24.4]],
  female: [[25, 37.6], [35, 30.2], [45, 26.7], [55, 23.4], [65, 20.0], [75, 18.3]],
}

export interface FitnessAssessment { vo2max: number; average: number; fitnessAge: number; percentOfAverage: number; label: string; goal12w: number }

/** Kondisjonsalder: alderen der medianen har din VO₂maks. Grovt anslag — klokkemålinger har ±3–5 i usikkerhet. */
export function assessFitness(vo2max: number, age: number, sex: 'male' | 'female'): FitnessAssessment {
  const t = NORM_MEDIAN[sex]
  const avgAt = (a: number) => {
    if (a <= t[0][0]) return t[0][1]
    for (let i = 1; i < t.length; i++) if (a <= t[i][0]) {
      const [a0, v0] = t[i - 1], [a1, v1] = t[i]
      return v0 + (v1 - v0) * (a - a0) / (a1 - a0)
    }
    return t[t.length - 1][1]
  }
  let fitnessAge: number
  if (vo2max >= t[0][1]) fitnessAge = 20
  else if (vo2max <= t[t.length - 1][1]) fitnessAge = 80
  else {
    fitnessAge = 80
    for (let i = 1; i < t.length; i++) {
      const [a0, v0] = t[i - 1], [a1, v1] = t[i]
      if (vo2max <= v0 && vo2max >= v1) { fitnessAge = a0 + (v0 - vo2max) / (v0 - v1) * (a1 - a0); break }
    }
  }
  const average = avgAt(age)
  const pct = vo2max / average * 100
  const label = pct >= 115 ? 'Svært god' : pct >= 100 ? 'Over snittet' : pct >= 85 ? 'Rundt snittet' : 'Under snittet'
  // Strukturerte intervaller gir typisk 5–10 % på 8–12 uker hos trente (Helgerud 2007)
  return { vo2max, average, fitnessAge: Math.round(fitnessAge), percentOfAverage: Math.round(pct), label, goal12w: Math.round(vo2max * 1.06 * 10) / 10 }
}
