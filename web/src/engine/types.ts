import type { DayKind, RunType } from './week'

// Domene-typer. Speiler FIV/Models/Domain.swift så data kan deles med iOS-appen (LiDAR).

export type Sex = 'male' | 'female'
export type Goal = 'buildMuscle' | 'loseFat' | 'recomposition' | 'strength' | 'health'
export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type Limitation = 'knee' | 'lowerBack' | 'shoulder'
export type Muscle = 'chest' | 'lats' | 'upperBack' | 'sideDelts' | 'biceps' | 'triceps' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs'
export type BodySide = 'left' | 'right'
export type PhysiqueGoal = 'balanced' | 'vTaper' | 'defined' | 'powerful' | 'lowerBody' | 'functional'
export type PostureGoal = 'upperBack' | 'neck' | 'shoulders' | 'lowerBack' | 'pelvis' | 'mobility'
export type MovementPattern =
  | 'squat' | 'hinge' | 'singleLeg' | 'kneeExtension' | 'kneeFlexion'
  | 'horizontalPush' | 'verticalPush' | 'horizontalPull' | 'verticalPull'
  | 'chestFly' | 'lateralRaise' | 'rearDelt' | 'elbowFlexion' | 'elbowExtension'
  | 'calfRaise' | 'core' | 'carry'
export type EquipmentItem =
  | 'dumbbells' | 'kettlebell' | 'barbell' | 'squatRack' | 'bench'
  | 'cableMachine' | 'latPulldown' | 'legPressMachine' | 'legCurlMachine' | 'legExtensionMachine'
  | 'pullUpBar' | 'dipBars' | 'resistanceBands' | 'trxRings' | 'treadmill' | 'bike' | 'rower'

export const MUSCLES: Muscle[] = ['chest', 'lats', 'upperBack', 'sideDelts', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'abs']

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Bryst', lats: 'Latissimus (rygg-bredde)', upperBack: 'Øvre rygg & bakre skulder', sideDelts: 'Sidre skulder',
  biceps: 'Biceps', triceps: 'Triceps', quads: 'Forside lår', hamstrings: 'Bakside lår', glutes: 'Sete', calves: 'Legger', abs: 'Kjerne',
}

export const GOAL_INFO: Record<Goal, { label: string; detail: string }> = {
  buildMuscle: { label: 'Bygge muskler', detail: 'Maksimal muskelvekst med lite kalorioverskudd.' },
  loseFat: { label: 'Gå ned i fett', detail: 'Miste fett og beholde muskler med moderat underskudd.' },
  recomposition: { label: 'Rekomponering', detail: 'Bygge muskler og miste fett samtidig, rundt vedlikeholdskalorier.' },
  strength: { label: 'Bli sterkere', detail: 'Øke maksstyrken i basisløftene.' },
  health: { label: 'Helse & levealder', detail: 'Kondisjon, styrke og mobilitet for et langt, sterkt liv.' },
}

export const EXPERIENCE_LABEL: Record<Experience, string> = {
  beginner: 'Nybegynner (< 1 år)', intermediate: 'Viderekommen (1–3 år)', advanced: 'Erfaren (3+ år)',
}

export const LIMITATION_LABEL: Record<Limitation, string> = { knee: 'Kne', lowerBack: 'Korsrygg', shoulder: 'Skulder' }

export const PHYSIQUE_INFO: Record<PhysiqueGoal, { label: string; detail: string; bias: Partial<Record<Muscle, number>> }> = {
  balanced: { label: 'Balansert og symmetrisk', detail: 'Jevne proporsjoner — ingen muskelgruppe dominerer.', bias: {} },
  vTaper: { label: 'Bred overkropp (V-form)', detail: 'Bredere skuldre og rygg, smal midje.',
    bias: { lats: 0.35, sideDelts: 0.4, upperBack: 0.15, quads: -0.1, glutes: -0.1 } },
  defined: { label: 'Slank og definert', detail: 'Synlige muskler: lav fettprosent og moderat muskelmasse.', bias: { abs: 0.2, sideDelts: 0.15 } },
  powerful: { label: 'Kraftig og sterk', detail: 'Mye muskelmasse i store muskelgrupper og tunge basisløft.',
    bias: { quads: 0.2, glutes: 0.2, hamstrings: 0.15, chest: 0.15, upperBack: 0.15 } },
  lowerBody: { label: 'Sterke bein og sete', detail: 'Ekstra fokus på sete, lår og hofter.',
    bias: { glutes: 0.45, hamstrings: 0.3, quads: 0.25, chest: -0.15, biceps: -0.15, triceps: -0.1 } },
  functional: { label: 'Funksjonell og atletisk', detail: 'Sterk kjerne, ettsidig styrke og god bevegelighet.', bias: { abs: 0.35, upperBack: 0.2, glutes: 0.15 } },
}

export const POSTURE_GOAL_LABEL: Record<PostureGoal, string> = {
  upperBack: 'Rettere øvre rygg (mindre rundrygg)', neck: 'Mindre fremoverlent hode / nakke',
  shoulders: 'Mindre fremoverrullede eller skjeve skuldre', lowerBack: 'Sterkere korsrygg',
  pelvis: 'Bedre bekkenstilling / svairygg', mobility: 'Generell bevegelighet',
}

export const EQUIPMENT_INFO: Record<EquipmentItem, { label: string; category: string; heavy: boolean }> = {
  dumbbells: { label: 'Manualer', category: 'Frivekter', heavy: false },
  kettlebell: { label: 'Kettlebell', category: 'Frivekter', heavy: false },
  barbell: { label: 'Vektstang med skiver', category: 'Frivekter', heavy: true },
  squatRack: { label: 'Knebøystativ / rack', category: 'Stativ & benk', heavy: true },
  bench: { label: 'Justerbar benk', category: 'Stativ & benk', heavy: false },
  cableMachine: { label: 'Kabelmaskin / kryss', category: 'Maskiner & kabler', heavy: true },
  latPulldown: { label: 'Nedtrekksapparat', category: 'Maskiner & kabler', heavy: true },
  legPressMachine: { label: 'Beinpress / hack squat', category: 'Maskiner & kabler', heavy: true },
  legCurlMachine: { label: 'Lårcurl-maskin', category: 'Maskiner & kabler', heavy: true },
  legExtensionMachine: { label: 'Beinspark-maskin', category: 'Maskiner & kabler', heavy: true },
  pullUpBar: { label: 'Pull-up-stang', category: 'Kroppsvekt-utstyr', heavy: false },
  dipBars: { label: 'Dips-stativ', category: 'Kroppsvekt-utstyr', heavy: false },
  resistanceBands: { label: 'Treningsstrikker', category: 'Kroppsvekt-utstyr', heavy: false },
  trxRings: { label: 'TRX / ringer', category: 'Kroppsvekt-utstyr', heavy: false },
  treadmill: { label: 'Tredemølle', category: 'Kondisjon', heavy: false },
  bike: { label: 'Spinning / ergometersykkel', category: 'Kondisjon', heavy: false },
  rower: { label: 'Romaskin', category: 'Kondisjon', heavy: false },
}
export const EQUIPMENT_ITEMS = Object.keys(EQUIPMENT_INFO) as EquipmentItem[]

export interface TrainingLocation {
  id: string
  name: string
  kind: 'home' | 'gym' | 'other'
  equipment: EquipmentItem[]
  dumbbellWeights: number[]
  kettlebellWeights: number[]
  barbellMaxKg?: number
}

export interface Profile {
  name: string
  sex: Sex
  birthYear: number
  heightCm: number
  weightKg: number
  goal: Goal
  experience: Experience
  daysPerWeek: number
  sessionMinutes: number
  limitations: Limitation[]
  physique: PhysiqueGoal
  postureGoals: PostureGoal[]
  targetBodyFat: number // 0 = automatisk
  locations: TrainingLocation[]
  activeLocationId: string
  /** Hvilken skannemetode som er aktiv. LiDAR krever iPhone-appen. */
  scanMethod: 'camera' | 'lidar'
  /** Fast treningstid, f.eks. 06:10–06:50. */
  trainingStart: string
  trainingEnd: string
  /** Løpeøkter per uke i tillegg til styrke (daysPerWeek = styrkeøkter). */
  runsPerWeek: number
  runTypes: RunType[]
  weekendTraining: boolean
  /** Brukerens egne endringer i ukeplanen, per ukedag (0 = mandag). */
  weekOverrides?: Partial<Record<number, { kind: DayKind; run?: RunType }>>
  /** Tall fra Apple-klokka / Helse-appen (skrives inn for hånd). */
  watch?: WatchData
  /** Start på nåværende treningsperiode (ISO-dato). */
  cycleStart?: string
  /** Kalorijustering fra vekttrenden (kcal per dag). */
  kcalOffset?: number
  /** Velg manualer, kettlebell og strikk fremfor kabelmaskin. */
  preferFreeWeights?: boolean
  /** Korreksjonsfaktorer for kameraskann, lært fra målebånd (f.eks. waist: 1.05). */
  calibration?: Partial<Record<'neck' | 'chest' | 'waist' | 'hip' | 'arm' | 'thigh', number>>
  /** Helsesjekk (PAR-Q+): svar per spørsmål. */
  health?: { answers: boolean[]; answeredAt: string }
}

export interface WatchData {
  maxHR?: number        // høyeste puls du har sett i en hard økt
  restingHR?: number
  vo2max?: number       // «Kondisjon» i Helse-appen
  activeKcal?: number   // snitt aktiv energi per dag
  steps?: number        // snitt skritt per dag
  exerciseMin?: number  // snitt treningsminutter per dag
  avgBedtime?: string   // «Gjennomsnittlig leggetid» fra Søvn i Helse, f.eks. 23:46
  updated?: string
}

/** Fyller inn nye felt for profiler laget i eldre versjoner. */
export function withDefaults(p: Profile): Profile {
  return {
    ...p,
    trainingStart: p.trainingStart ?? '06:10', trainingEnd: p.trainingEnd ?? '06:50', runsPerWeek: p.runsPerWeek ?? 2,
    runTypes: p.runTypes ?? ['intervals4x4', 'short45_20', 'tempo20'], weekendTraining: p.weekendTraining ?? true,
    weekOverrides: p.weekOverrides ?? {},
  }
}

/** Profilen slik motoren ser den — med valgt sted. Tilsvarer Swift `ProfileData`. */
export interface ProfileData {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  goal: Goal
  experience: Experience
  daysPerWeek: number
  sessionMinutes: number
  location: TrainingLocation
  limitations: Limitation[]
  targetBodyFat?: number
  physique: PhysiqueGoal
  postureGoals: PostureGoal[]
  watch?: WatchData
  kcalOffset?: number
  preferFreeWeights?: boolean
}

/** Samme feltnavn som Swift `ScanMeasurements` (JSON fra iOS-appen kan importeres direkte). */
export interface ScanMeasurements {
  measuredHeightCm?: number
  shoulderWidthCm?: number
  neckCm?: number
  chestCm?: number
  waistCm?: number
  hipCm?: number
  upperArmLeftCm?: number
  upperArmRightCm?: number
  thighLeftCm?: number
  thighRightCm?: number
  armLengthLeftCm?: number
  armLengthRightCm?: number
  legLengthLeftCm?: number
  legLengthRightCm?: number
  shoulderTiltDeg?: number
  hipTiltDeg?: number
  forwardHeadCm?: number
  roundedShouldersCm?: number
  thoracicAngleDeg?: number
  usedLiDAR?: boolean
  sampleCount?: number
}

export interface BodyScan {
  id: string
  date: string // ISO
  weightKg: number
  source: 'camera' | 'lidar' | 'manual'
  measurements: ScanMeasurements
  /** Rå kameramåling før kalibrering (brukes til å lære av målebåndet). */
  raw?: ScanMeasurements
}

export interface Exercise {
  id: string
  name: string
  pattern: MovementPattern
  primary: Muscle
  secondary: Muscle[]
  requires: EquipmentItem[]
  anyOf: EquipmentItem[]
  unilateral: boolean
  lengthenedBias: boolean
  avoidWith: Limitation[]
  cue: string
}

export interface SetLog { weightKg: number; reps: number; rir?: number }

export interface WorkoutEntry {
  id: string
  date: string
  dayName: string
  exerciseId: string
  sets: SetLog[]
  /** Løpeøkter: hvor tungt (1–10), puls, distanse, antall drag / minutter. */
  run?: { type: RunType; rpe: number; avgHR?: number; km?: number; reps?: number; minutes?: number }
}

export const COMPOUND: Set<MovementPattern> = new Set(['squat', 'hinge', 'singleLeg', 'horizontalPush', 'verticalPush', 'horizontalPull', 'verticalPull', 'carry'])

export function avg(a?: number, b?: number): number | undefined {
  if (a != null && b != null) return (a + b) / 2
  return a ?? b
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function kgText(v: number): string {
  return Number.isInteger(v) ? `${v} kg` : `${v.toFixed(1).replace('.', ',')} kg`
}
