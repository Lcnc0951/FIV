// App-tilstand: profil, skann, program og logg — og koblingen til PT-motoren.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppData, Backend } from '../data/store'
import type { Checkin, WeightEntry } from '../engine/daily'
import { analyzeBody, planPosture } from '../engine/analyzer'
import { generateProgram, prescription, type TrainingProgram } from '../engine/generator'
import { exercise } from '../engine/library'
import type { BodyScan, Profile, ProfileData, TrainingLocation, WorkoutEntry } from '../engine/types'

export function profileData(p: Profile, loc?: TrainingLocation): ProfileData {
  const location = loc ?? activeLocation(p)
  return {
    sex: p.sex, age: new Date().getFullYear() - p.birthYear, heightCm: p.heightCm, weightKg: p.weightKg, goal: p.goal,
    experience: p.experience, daysPerWeek: p.daysPerWeek, sessionMinutes: p.sessionMinutes, location, limitations: p.limitations,
    targetBodyFat: p.targetBodyFat || undefined, physique: p.physique, postureGoals: p.postureGoals, watch: p.watch, kcalOffset: p.kcalOffset, preferFreeWeights: p.preferFreeWeights,
  }
}
export const activeLocation = (p: Profile) => p.locations.find((l) => l.id === p.activeLocationId) ?? p.locations[0]
export const sortedScans = (scans: BodyScan[]) => [...scans].sort((a, b) => b.date.localeCompare(a.date))

interface Ctx {
  data: AppData
  backend: Backend
  profile: Profile
  pd: ProfileData
  latest?: BodyScan
  program?: TrainingProgram
  saveProfile(p: Profile, regenerate?: boolean): Promise<void>
  addScan(s: BodyScan): Promise<void>
  updateScan(s: BodyScan): Promise<void>
  deleteScan(id: string): Promise<void>
  regenerate(locationId?: string): Promise<void>
  swap(prescriptionId: string, exerciseId: string): Promise<void>
  logWorkout(entries: WorkoutEntry[]): Promise<void>
  saveCheckin(c: Checkin): Promise<void>
  saveWeight(w: WeightEntry): Promise<void>
  /** Starter ny treningsperiode: nytt program med siste skann og profil. */
  newCycle(): Promise<void>
}

const AppCtx = createContext<Ctx | null>(null)
export const useApp = () => useContext(AppCtx)!

function buildPrograms(profile: Profile, scans: BodyScan[], only?: string): Record<string, TrainingProgram> {
  const s = sortedScans(scans)
  const out: Record<string, TrainingProgram> = {}
  for (const loc of profile.locations) {
    if (only && loc.id !== only) continue
    const pd = profileData(profile, loc)
    const a = analyzeBody(pd, s[0]?.measurements, s[1]?.measurements)
    out[loc.id] = generateProgram(pd, a, planPosture(pd, s[0]?.measurements).drills)
  }
  return out
}

export function AppProvider({ initial, backend, children }: { initial: AppData & { profile: Profile }; backend: Backend; children: ReactNode }) {
  const [data, setData] = useState<AppData & { profile: Profile }>(initial)

  // Profiler fra før periodeplanen fantes: start perioden nå (én gang)
  useEffect(() => {
    if (!data.profile.cycleStart) {
      const profile = { ...data.profile, cycleStart: new Date().toISOString() }
      setData((d) => ({ ...d, profile }))
      backend.saveProfile(profile).catch(() => undefined)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const commitPrograms = useCallback(async (programs: Record<string, TrainingProgram>) => {
    setData((d) => ({ ...d, programs })); await backend.savePrograms(programs)
  }, [backend])

  // Nytt program = ny treningsperiode
  const saveProfile = useCallback(async (p: Profile, regen = true) => {
    const profile = regen ? { ...p, cycleStart: new Date().toISOString() } : p
    setData((d) => ({ ...d, profile }))
    await backend.saveProfile(profile)
    if (regen) await commitPrograms(buildPrograms(profile, data.scans))
  }, [backend, commitPrograms, data.scans])

  // Nye skann endrer ikke programmet midt i en periode — de tas med ved neste periode
  const addScan = useCallback(async (s: BodyScan) => {
    const scans = [...data.scans, s]
    const noProgram = !Object.keys(data.programs).length || !data.profile.cycleStart
    const profile = { ...data.profile, weightKg: s.weightKg, ...(noProgram ? { cycleStart: new Date().toISOString() } : {}) }
    setData((d) => ({ ...d, scans, profile }))
    await backend.saveScan(s); await backend.saveProfile(profile)
    if (noProgram) await commitPrograms(buildPrograms(profile, scans))
  }, [backend, commitPrograms, data.profile, data.programs, data.scans])

  const updateScan = useCallback(async (s: BodyScan) => {
    const scans = data.scans.map((x) => (x.id === s.id ? s : x))
    setData((d) => ({ ...d, scans })); await backend.saveScan(s)
  }, [backend, data.scans])

  const newCycle = useCallback(async () => {
    const profile = { ...data.profile, cycleStart: new Date().toISOString() }
    setData((d) => ({ ...d, profile }))
    await backend.saveProfile(profile)
    await commitPrograms(buildPrograms(profile, data.scans))
  }, [backend, commitPrograms, data.profile, data.scans])

  const saveCheckin = useCallback(async (c: Checkin) => {
    setData((d) => ({ ...d, checkins: [...d.checkins.filter((x) => x.date !== c.date), c] }))
    await backend.saveCheckin(c)
    if (c.restingHR && c.restingHR > 30) {
      // Hvilepulsen fra innsjekken brukes også som klokketall hvis det mangler
      if (!data.profile.watch?.restingHR) {
        const profile = { ...data.profile, watch: { ...data.profile.watch, restingHR: c.restingHR } }
        setData((d) => ({ ...d, profile })); await backend.saveProfile(profile)
      }
    }
  }, [backend, data.profile])

  const saveWeight = useCallback(async (w: WeightEntry) => {
    const profile = { ...data.profile, weightKg: w.kg }
    setData((d) => ({ ...d, weights: [...d.weights.filter((x) => x.date !== w.date), w], profile }))
    await backend.saveWeight(w); await backend.saveProfile(profile)
  }, [backend, data.profile])

  const deleteScan = useCallback(async (id: string) => {
    setData((d) => ({ ...d, scans: d.scans.filter((x) => x.id !== id) })); await backend.deleteScan(id)
  }, [backend])

  const regenerate = useCallback(async (locationId?: string) => {
    if (!data.profile.cycleStart) {
      const profile = { ...data.profile, cycleStart: new Date().toISOString() }
      setData((d) => ({ ...d, profile })); await backend.saveProfile(profile)
    }
    await commitPrograms({ ...data.programs, ...buildPrograms(data.profile, data.scans, locationId) })
  }, [backend, commitPrograms, data.profile, data.programs, data.scans])

  const swap = useCallback(async (pid: string, exerciseId: string) => {
    const loc = activeLocation(data.profile)
    const prog = data.programs[loc.id]
    const e = exercise(exerciseId)
    if (!prog || !e) return
    const pd = profileData(data.profile, loc)
    const s = sortedScans(data.scans)
    const a = analyzeBody(pd, s[0]?.measurements, s[1]?.measurements)
    const next: TrainingProgram = structuredClone(prog)
    for (const d of next.days) d.exercises = d.exercises.map((x) => (x.id === pid ? { ...prescription(e, x.sets, pd, a), id: x.id } : x))
    await commitPrograms({ ...data.programs, [loc.id]: next })
  }, [commitPrograms, data.profile, data.programs, data.scans])

  const logWorkout = useCallback(async (entries: WorkoutEntry[]) => {
    setData((d) => ({ ...d, workouts: [...d.workouts, ...entries] }))
    for (const w of entries) await backend.saveWorkout(w)
  }, [backend])

  const value = useMemo<Ctx>(() => {
    const s = sortedScans(data.scans)
    const loc = activeLocation(data.profile)
    return {
      data, backend, profile: data.profile, pd: profileData(data.profile), latest: s[0], program: data.programs[loc.id],
      saveProfile, addScan, updateScan, deleteScan, regenerate, swap, logWorkout, saveCheckin, saveWeight, newCycle,
    }
  }, [data, backend, saveProfile, addScan, updateScan, deleteScan, regenerate, swap, logWorkout, saveCheckin, saveWeight, newCycle])

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export { buildPrograms }
