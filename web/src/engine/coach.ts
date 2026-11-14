// Ernæring, fettap og progresjon (port av NutritionCalculator, FatLossPlanner og ProgressionEngine).
import { bmi, leanMass, navyBodyFat } from './composition'
import { exercise, isCompound, usesDumbbells } from './library'
import type { Prescription } from './generator'
import { kgText, type ProfileData, type ScanMeasurements, type SetLog } from './types'

// ---------------- Ernæring ----------------

export interface NutritionTargets {
  maintenanceKcal: number; fromWatch: boolean; targetKcal: number; proteinG: number; fatG: number; carbsG: number; fiberG: number
  waterLiters: number; note: string; supplements: string[]
}

export function nutrition(p: ProfileData, bodyFat?: number, overrideKcal?: number): NutritionTargets {
  const w = p.weightKg
  const bmr = bodyFat != null ? 370 + 21.6 * leanMass(w, bodyFat) : 10 * w + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161)
  // Med klokkedata: hvilestoffskifte + 85 % av målt aktiv energi (klokker overestimerer litt) + 10 % for fordøyelse
  const fromWatch = p.watch?.activeKcal && p.watch.activeKcal > 100 ? (bmr + p.watch.activeKcal * 0.85) * 1.1 : undefined
  const maintenance = fromWatch ?? bmr * Math.min(1.725, 1.3 + 0.06 * p.daysPerWeek)
  const [factor, note] = ({
    loseFat: [0.8, 'Mål: −0,5 til −1 % av kroppsvekten per uke.'],
    buildMuscle: [p.experience === 'beginner' ? 1.1 : 1.06, 'Mål: +0,25–0,5 % av kroppsvekten per måned (nybegynnere kan gå litt raskere).'],
    recomposition: [0.95, 'Vekten står omtrent stille, midjen går ned og styrken opp.'],
    strength: [1.05, 'Lite overskudd gir best styrkeutvikling.'],
    health: [1, 'Hold vekten stabil, fokuser på kvalitet og protein.'],
  } as Record<string, [number, string]>)[p.goal]
  const target = overrideKcal ?? maintenance * factor
  const perKg = { loseFat: 2.2, recomposition: 2.0, buildMuscle: 1.8, strength: 1.8, health: 1.6 }[p.goal]
  const protein = perKg * w
  const fat = Math.max(0.7 * w, target * 0.25 / 9)
  const carbs = Math.max(0, (target - protein * 4 - fat * 9) / 4)
  return {
    maintenanceKcal: Math.round(maintenance), fromWatch: fromWatch != null, targetKcal: Math.round(target), proteinG: Math.round(protein), fatG: Math.round(fat),
    carbsG: Math.round(carbs), fiberG: Math.round(target / 1000 * 14), waterLiters: Math.round(w * 0.35) / 10, note,
    supplements: [
      'Kreatin monohydrat 3–5 g daglig — best dokumenterte tilskudd for styrke og muskelmasse, og lovende for hjernehelse.',
      'Vitamin D 1000–2000 IE i vinterhalvåret (oktober–april i Norge).',
      'Koffein 3 mg/kg 30–60 min før trening kan gi bedre prestasjon — ikke etter kl. 14 av hensyn til søvnen.',
      'Proteinpulver er mat, ikke magi — bare praktisk hvis du ikke når proteinmålet.',
    ],
  }
}

// ---------------- Fett ----------------

export type FatCategory = 0 | 1 | 2 | 3 | 4 | 5
export const FAT_CATEGORY_LABEL = ['Svært lav', 'Atletisk', 'Sprek', 'Gjennomsnittlig', 'Høy', 'Svært høy']
export type Distribution = 'central' | 'balanced' | 'peripheral' | 'unknown'
export const DISTRIBUTION_LABEL: Record<Distribution, string> = {
  central: 'Mest rundt magen (bukfett)', balanced: 'Jevnt fordelt', peripheral: 'Mest på hofter og lår', unknown: 'Ukjent — skann for å se fordelingen',
}

export interface FatAnalysis {
  bodyFatPercent: number; source: 'scan' | 'bmiEstimate'; fatMassKg: number; leanMassKg: number; category: FatCategory
  scalePosition: number; distribution: Distribution; waistToHip?: number; waistToHeight?: number; visceralRisk: string
}

export function analyzeFat(p: ProfileData, scan?: ScanMeasurements): FatAnalysis {
  let bf: number | undefined
  let source: FatAnalysis['source'] = 'scan'
  if (scan?.neckCm != null && scan.waistCm != null) bf = navyBodyFat(p.sex, p.heightCm, scan.neckCm, scan.waistCm, scan.hipCm)
  if (bf == null) {
    source = 'bmiEstimate'
    bf = 1.2 * bmi(p.weightKg, p.heightCm) + 0.23 * p.age - 10.8 * (p.sex === 'male' ? 1 : 0) - 5.4
  }
  const bodyFat = Math.min(60, Math.max(3, bf))
  const fatMass = p.weightKg * bodyFat / 100
  const lim = p.sex === 'male' ? [6, 14, 18, 25, 32] : [14, 21, 25, 32, 39]
  const category = (lim.findIndex((l) => bodyFat < l) === -1 ? 5 : lim.findIndex((l) => bodyFat < l)) as FatCategory
  const pos = Math.min(1, Math.max(0, (bodyFat - (lim[0] - 4)) / (lim[4] + 8 - (lim[0] - 4))))
  let distribution: Distribution = 'unknown', whr: number | undefined, whtr: number | undefined
  if (scan?.waistCm != null) {
    whtr = scan.waistCm / p.heightCm
    if (scan.hipCm) {
      whr = scan.waistCm / scan.hipCm
      const [c, per] = p.sex === 'male' ? [0.9, 0.82] : [0.85, 0.75]
      distribution = whr >= c ? 'central' : whr < per ? 'peripheral' : 'balanced'
    }
  }
  const visceralRisk = whtr != null && whtr >= 0.6
    ? 'Høy risiko for indre organfett (visceralt fett). Dette er fettet som er mest skadelig — og heldigvis det første som forsvinner med trening og underskudd.'
    : (whtr ?? 0) >= 0.5 || distribution === 'central'
      ? 'Forhøyet. Bukfett er knyttet til insulinresistens, høyt blodtrykk og hjertesykdom. Kondisjon og styrke reduserer visceralt fett effektivt — selv før vekta endrer seg mye.'
      : whtr != null ? 'Lav. Midjen er under halvparten av høyden.' : 'Skann kroppen for å vurdere bukfett (midje/høyde).'
  return { bodyFatPercent: bodyFat, source, fatMassKg: fatMass, leanMassKg: p.weightKg - fatMass, category, scalePosition: pos,
    distribution, waistToHip: whr, waistToHeight: whtr, visceralRisk }
}

export interface Milestone { week: number; weightKg: number; bodyFatPercent: number; waistCm?: number }
export interface FatLossPlan {
  needed: boolean; targetBodyFat: number; fatToLoseKg: number; targetWeightKg: number; weeklyLossKg: number; weeks: number
  dailyDeficitKcal: number; targetKcal: number; proteinG: number; dailySteps: number; milestones: Milestone[]
  pillars: { title: string; detail: string; icon: string }[]; adjustmentRule: string; plateNote: string
}

export const defaultFatTarget = (p: ProfileData, current: number) => Math.min(current, p.sex === 'male' ? 15 : 23)

export function planFatLoss(p: ProfileData, fat: FatAnalysis, waistCm?: number): FatLossPlan {
  const target = p.targetBodyFat || defaultFatTarget(p, fat.bodyFatPercent)
  const targetWeight = fat.leanMassKg / (1 - target / 100)
  const toLose = Math.max(0, p.weightKg - targetWeight)
  const needed = toLose >= 1
  const rate = fat.category === 5 ? 0.009 : fat.category === 4 ? 0.0075 : fat.category === 3 ? 0.006 : 0.005
  const deficit = Math.min(p.weightKg * rate * 7700 / 7, fat.fatMassKg * 69, 1000)
  const weekly = deficit * 7 / 7700
  const weeks = needed ? Math.ceil(toLose / weekly) : 0
  const maintenance = nutrition(p, fat.bodyFatPercent).maintenanceKcal
  const targetKcal = Math.max(p.sex === 'male' ? 1500 : 1200, maintenance - (needed ? deficit : 0))
  const milestones: Milestone[] = []
  if (needed) {
    for (let w = 0; w <= weeks; w += 4) {
      const lost = Math.min(toLose, weekly * w * (1 - 0.05 * w / 12))
      const weight = p.weightKg - lost
      milestones.push({ week: w, weightKg: weight, bodyFatPercent: (fat.fatMassKg - lost) / weight * 100, waistCm: waistCm != null ? waistCm - lost : undefined })
    }
    if (milestones[milestones.length - 1].week !== weeks) {
      milestones.push({ week: weeks, weightKg: targetWeight, bodyFatPercent: target, waistCm: waistCm != null ? waistCm - toLose : undefined })
    }
  }
  const steps = p.goal === 'loseFat' || fat.category >= 4 ? 10000 : 8000
  const pillars = [
    { title: 'Kaloriunderskudd', icon: 'flame', detail: needed
      ? `Ca. ${Math.round(deficit)} kcal under vedlikehold per dag → ~${weekly.toFixed(1).replace('.', ',')} kg i uka. Det er underskuddet som fjerner fett — trening alene sjelden nok.`
      : 'Du er allerede på eller under målet. Spis rundt vedlikehold og bygg muskler.' },
    { title: 'Styrketrening 2–4× i uka', icon: 'dumbbell', detail: 'Forteller kroppen at musklene skal beholdes. Uten styrketrening kan opptil en tredel av vekttapet være muskler.' },
    { title: `Protein ${Math.round(p.weightKg * 2.2)} g daglig`, icon: 'food', detail: '2,2 g/kg i underskudd beskytter muskelmassen og holder deg mett lengst.' },
    { title: `${steps.toLocaleString('nb-NO')} skritt`, icon: 'walk', detail: 'Hverdagsaktivitet forbrenner ofte mer enn selve treningen, og den synker ubevisst når du slanker deg. Tell skrittene.' },
    { title: 'Kondisjon: sone 2 + 4×4', icon: 'heart', detail: 'Reduserer spesielt bukfett (visceralt fett) og forbedrer insulinfølsomheten, selv uten stort vekttap.' },
    { title: 'Søvn 7–9 timer', icon: 'moon', detail: 'Med lite søvn kommer en større del av vekttapet fra musklene, og suget øker (Nedeltcheva 2010).' },
  ]
  if (fat.distribution === 'central') pillars.push({ title: 'Begrens alkohol og sukkerholdig drikke', icon: 'glass', detail: 'Begge bidrar særlig til bukfett, og alkohol hemmer fettforbrenning og restitusjon.' })
  pillars.push({ title: 'Du kan ikke punktforbrenne fett', icon: 'info', detail: 'Situps fjerner ikke magefett, og lårøvelser fjerner ikke lårfett (Vispute 2011). Kroppen bestemmer selv rekkefølgen — men bukfett går ofte først hos menn. Tren hele kroppen.' })
  return {
    needed, targetBodyFat: target, fatToLoseKg: toLose, targetWeightKg: targetWeight, weeklyLossKg: weekly, weeks,
    dailyDeficitKcal: needed ? Math.round(deficit) : 0, targetKcal: Math.round(targetKcal), proteinG: Math.round(p.weightKg * 2.2),
    dailySteps: steps, milestones, pillars,
    adjustmentRule: 'Vei deg hver morgen og se på ukesnittet. Går snittet ned mindre enn 0,25 % to uker på rad: trekk fra 150–200 kcal eller legg til 2 000 skritt. Går det ned mer enn 1 % i uka: spis litt mer, for å skåne musklene.',
    plateNote: 'Tallerkenmodellen: halvparten grønnsaker, en firedel protein (kylling, fisk, egg, skyr, bønner), en firedel fullkorn/poteter. Mettende og lett å følge uten å telle alt.',
  }
}

// ---------------- Progresjon ----------------

export interface Suggestion { weightKg?: number; targetReps: number; message: string }

function base(p: Prescription, last: SetLog[]): Suggestion {
  const e = exercise(p.exerciseId)
  if (!e) return { targetReps: p.repsMin, message: '' }
  const working = last.filter((s) => s.reps > 0)
  if (!working.length) return { targetReps: p.repsMax, message: `Første gang: velg en vekt der du klarer ${p.repsMin}–${p.repsMax} reps med ${p.rir} reps i reserve.` }
  const top = Math.max(...working.map((s) => s.weightKg))
  const atTop = working.filter((s) => s.weightKg >= top)
  const allHitTop = atTop.length >= p.sets && atTop.every((s) => s.reps >= p.repsMax)
  const missed = atTop.some((s) => s.reps < p.repsMin && (s.rir ?? 0) === 0)
  if (top === 0) {
    const best = Math.max(...working.map((s) => s.reps))
    return { weightKg: 0, targetReps: best + 1, message: allHitTop ? 'Gjør øvelsen tyngre: tempo 4 sek ned, pause, eller en vanskeligere variant.' : `Prøv å slå ${best} reps.` }
  }
  const step = isCompound(e) ? 2.5 : 1
  const round = (v: number) => Math.round(v / step) * step
  if (allHitTop) {
    const inc = Math.max(step, top * (['squat', 'hinge', 'singleLeg'].includes(e.pattern) ? 0.05 : 0.025))
    return { weightKg: round(top + inc), targetReps: p.repsMin, message: `Alle sett i toppen av intervallet — øk vekten og start på ${p.repsMin} reps.` }
  }
  if (missed) return { weightKg: round(top * 0.92), targetReps: p.repsMin, message: 'For tungt forrige gang. Litt lettere vekt, bygg opp igjen.' }
  const best = Math.max(...atTop.map((s) => s.reps))
  return { weightKg: top, targetReps: Math.min(p.repsMax, best + 1), message: 'Samme vekt — sikte på +1 rep i så mange sett som mulig.' }
}

export function suggest(p: Prescription, last: SetLog[], dumbbells: number[] = []): Suggestion {
  const s = base(p, last)
  const e = exercise(p.exerciseId)
  if (!e || !usesDumbbells(e) || !dumbbells.length || !s.weightKg) return s
  const sorted = [...dumbbells].sort((a, b) => a - b)
  const top = Math.max(0, ...last.map((x) => x.weightKg))
  if (s.weightKg > top) {
    const next = sorted.find((w) => w > top)
    if (next != null) {
      s.weightKg = next
      if (next - top > top * 0.15) { s.targetReps = Math.max(p.repsMin - 3, 5); s.message = `Neste manual (${kgText(next)}) er et stort hopp — start på ${s.targetReps} reps og bygg opp.` }
    } else {
      s.weightKg = top; s.targetReps = p.repsMax + 2
      s.message = 'Du har nådd tyngste manual. Øk reps, bruk 3–4 sek nedfase, pause i bunnen eller en ettsidig variant.'
    }
  } else {
    const w = s.weightKg
    s.weightKg = sorted.reduce((b, x) => (Math.abs(x - w) < Math.abs(b - w) ? x : b))
  }
  return s
}

export const estimated1RM = (s: SetLog) => {
  const r = s.reps + (s.rir ?? 0)
  return r <= 1 ? s.weightKg : s.weightKg * (1 + r / 30)
}
