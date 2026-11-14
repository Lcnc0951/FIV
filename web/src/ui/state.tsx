// App-tilstand: profil, skann, program og logg — og koblingen til PT-motoren.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AppData, Backend } from '../data/store'
import { analyzeBody, planPosture } from '../engine/analyzer'
import { generateProgram, prescription, type TrainingProgram } from '../engine/generator'
import { exercise } from '../engine/library'
import type { BodyScan, Profile, ProfileData, TrainingLocation, WorkoutEntry } from '../engine/types'

export function profileData(p: Profile, loc?: TrainingLocation): ProfileData {
  const location = loc ?? activeLocation(p)
  return {
    sex: p.sex, age: new Date().getFullYear() - p.birthYear, heightCm: p.heightCm, weightKg: p.weightKg, goal: p.goal,
    experience: p.experience, daysPerWeek: p.daysPerWeek, sessionMinutes: p.sessionMinutes, location, limitations: p.limitations,
    targetBodyFat: p.targetBodyFat || undefined, physique: p.physique, postureGoals: p.postureGoals, watch: p.watch,
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

  const commitPrograms = useCallback(async (programs: Record<string, TrainingProgram>) => {
    setData((d) => ({ ...d, programs })); await backend.savePrograms(programs)
  }, [backend])

  const saveProfile = useCallback(async (p: Profile, regen = true) => {
    setData((d) => ({ ...d, profile: p }))
    await backend.saveProfile(p)
    if (regen) await commitPrograms(buildPrograms(p, data.scans))
  }, [backend, commitPrograms, data.scans])

  const addScan = useCallback(async (s: BodyScan) => {
    const scans = [...data.scans, s]
    const profile = { ...data.profile, weightKg: s.weightKg }
    setData((d) => ({ ...d, scans, profile }))
    await backend.saveScan(s); await backend.saveProfile(profile)
    await commitPrograms(buildPrograms(profile, scans))
  }, [backend, commitPrograms, data.profile, data.scans])

  const updateScan = useCallback(async (s: BodyScan) => {
    const scans = data.scans.map((x) => (x.id === s.id ? s : x))
    setData((d) => ({ ...d, scans })); await backend.saveScan(s)
    await commitPrograms(buildPrograms(data.profile, scans))
  }, [backend, commitPrograms, data.profile, data.scans])

  const deleteScan = useCallback(async (id: string) => {
    setData((d) => ({ ...d, scans: d.scans.filter((x) => x.id !== id) })); await backend.deleteScan(id)
  }, [backend])

  const regenerate = useCallback(async (locationId?: string) => {
    await commitPrograms({ ...data.programs, ...buildPrograms(data.profile, data.scans, locationId) })
  }, [commitPrograms, data.profile, data.programs, data.scans])

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
      saveProfile, addScan, updateScan, deleteScan, regenerate, swap, logWorkout,
    }
  }, [data, backend, saveProfile, addScan, updateScan, deleteScan, regenerate, swap, logWorkout])

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export { buildPrograms }
