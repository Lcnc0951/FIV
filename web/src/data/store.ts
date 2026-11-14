// Lagring: privat database per bruker når appen kjører som Claude-artifact, ellers nettleserens localStorage.
// Alle data er dine — ingen andre (heller ikke eieren av artifacten) kan lese dem.
import type { TrainingProgram } from '../engine/generator'
import { withDefaults, type BodyScan, type Profile, type WorkoutEntry } from '../engine/types'
import type { Checkin, WeightEntry } from '../engine/daily'

export interface AppData {
  profile?: Profile
  scans: BodyScan[]
  workouts: WorkoutEntry[]
  programs: Record<string, TrainingProgram> // per treningssted
  checkins: Checkin[]
  weights: WeightEntry[]
}

export interface Backend {
  kind: 'cloud' | 'local'
  load(): Promise<AppData>
  saveProfile(p: Profile): Promise<void>
  savePrograms(p: Record<string, TrainingProgram>): Promise<void>
  saveScan(s: BodyScan): Promise<void>
  deleteScan(id: string): Promise<void>
  saveWorkout(w: WorkoutEntry): Promise<void>
  saveCheckin(c: Checkin): Promise<void>
  saveWeight(w: WeightEntry): Promise<void>
}

const empty = (): AppData => ({ scans: [], workouts: [], programs: {}, checkins: [], weights: [] })
const KEY = 'fiv-data-v1'

class LocalBackend implements Backend {
  kind = 'local' as const
  private data: AppData = empty()
  async load() {
    try { this.data = { ...empty(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { this.data = empty() }
    return structuredClone(this.data)
  }
  private persist() { try { localStorage.setItem(KEY, JSON.stringify(this.data)) } catch { /* privat modus e.l. */ } }
  async saveProfile(p: Profile) { this.data.profile = p; this.persist() }
  async savePrograms(p: Record<string, TrainingProgram>) { this.data.programs = p; this.persist() }
  async saveScan(s: BodyScan) { this.data.scans = [...this.data.scans.filter((x) => x.id !== s.id), s]; this.persist() }
  async deleteScan(id: string) { this.data.scans = this.data.scans.filter((x) => x.id !== id); this.persist() }
  async saveWorkout(w: WorkoutEntry) { this.data.workouts.push(w); this.persist() }
  async saveCheckin(c: Checkin) { this.data.checkins = [...this.data.checkins.filter((x) => x.date !== c.date), c]; this.persist() }
  async saveWeight(w: WeightEntry) { this.data.weights = [...this.data.weights.filter((x) => x.date !== w.date), w]; this.persist() }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
class CloudBackend implements Backend {
  kind = 'cloud' as const
  private queue: Promise<unknown> = Promise.resolve()
  constructor(private db: any, private root: string) {}
  // Én skriving om gangen, i rekkefølge
  private write(fn: () => Promise<unknown>) { this.queue = this.queue.then(fn, fn); return this.queue.then(() => undefined) }
  async load(): Promise<AppData> {
    const [main, scans, workouts, checkins, weights] = await Promise.all([
      this.db.doc(this.root).get(),
      this.db.collection(`${this.root}/scans`).get(),
      this.db.collection(`${this.root}/workouts`).get(),
      this.db.collection(`${this.root}/checkins`).get(),
      this.db.collection(`${this.root}/weights`).get(),
    ])
    const m = main.exists ? main.data() : {}
    return {
      profile: m.profile, programs: m.programs ?? {},
      scans: scans.docs.map((d: any) => d.data() as BodyScan),
      workouts: workouts.docs.map((d: any) => d.data() as WorkoutEntry),
      checkins: checkins.docs.map((d: any) => d.data() as Checkin),
      weights: weights.docs.map((d: any) => d.data() as WeightEntry),
    }
  }
  private mainCache: Record<string, unknown> = {}
  private saveMain(patch: Record<string, unknown>) {
    this.mainCache = { ...this.mainCache, ...patch }
    const snapshot = JSON.parse(JSON.stringify(this.mainCache))
    return this.write(() => this.db.doc(this.root).set(snapshot))
  }
  primeMain(d: AppData) { this.mainCache = { profile: d.profile, programs: d.programs } }
  saveProfile(p: Profile) { return this.saveMain({ profile: p }) }
  savePrograms(p: Record<string, TrainingProgram>) { return this.saveMain({ programs: p }) }
  saveScan(s: BodyScan) { return this.write(() => this.db.doc(`${this.root}/scans/${s.id}`).set(JSON.parse(JSON.stringify(s)))) }
  deleteScan(id: string) { return this.write(() => this.db.doc(`${this.root}/scans/${id}`).delete()) }
  saveWorkout(w: WorkoutEntry) { return this.write(() => this.db.doc(`${this.root}/workouts/${w.id}`).set(JSON.parse(JSON.stringify(w)))) }
  saveCheckin(c: Checkin) { return this.write(() => this.db.doc(`${this.root}/checkins/${c.date}`).set(JSON.parse(JSON.stringify(c)))) }
  saveWeight(w: WeightEntry) { return this.write(() => this.db.doc(`${this.root}/weights/${w.date}`).set({ ...w })) }
}

/** Velger lagring. Skyen brukes bare når siden kjører i Claude og du er logget inn. */
export async function openStore(): Promise<{ backend: Backend; data: AppData }> {
  const claude = (window as any).claude
  if (claude?.use) {
    try {
      const timeout = new Promise<null>((r) => setTimeout(() => r(null), 6000))
      const [db, user] = await Promise.all([Promise.race([claude.use('db'), timeout]), Promise.race([claude.use('user'), timeout])])
      const id = db && user ? await user.id() : null
      if (db && id) {
        const cloud = new CloudBackend(db, `data/users/${id}/fiv`)
        const data = await Promise.race([cloud.load(), new Promise<null>((r) => setTimeout(() => r(null), 10000))])
        if (data) {
          // Flytt eventuelle lokale data opp første gang
          if (!data.profile) {
            const local = await new LocalBackend().load()
            if (local.profile) {
              await cloud.saveProfile(local.profile); await cloud.savePrograms(local.programs)
              for (const s of local.scans) await cloud.saveScan(s)
              for (const w of local.workouts) await cloud.saveWorkout(w)
              for (const c of local.checkins) await cloud.saveCheckin(c)
              for (const w of local.weights) await cloud.saveWeight(w)
              cloud.primeMain(local)
              return { backend: cloud, data: local }
            }
          }
          if (data.profile) data.profile = withDefaults(data.profile)
          cloud.primeMain(data)
          return { backend: cloud, data }
        }
      }
    } catch { /* faller tilbake til lokal lagring */ }
  }
  const local = new LocalBackend()
  const data = await local.load()
  if (data.profile) data.profile = withDefaults(data.profile)
  return { backend: local, data }
}
