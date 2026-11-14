// Lagring: privat database per bruker når appen kjører som Claude-artifact, ellers nettleserens localStorage.
// Alle data er dine — ingen andre (heller ikke eieren av artifacten) kan lese dem.
import type { TrainingProgram } from '../engine/generator'
import type { BodyScan, Profile, WorkoutEntry } from '../engine/types'

export interface AppData {
  profile?: Profile
  scans: BodyScan[]
  workouts: WorkoutEntry[]
  programs: Record<string, TrainingProgram> // per treningssted
}

export interface Backend {
  kind: 'cloud' | 'local'
  load(): Promise<AppData>
  saveProfile(p: Profile): Promise<void>
  savePrograms(p: Record<string, TrainingProgram>): Promise<void>
  saveScan(s: BodyScan): Promise<void>
  deleteScan(id: string): Promise<void>
  saveWorkout(w: WorkoutEntry): Promise<void>
}

const empty = (): AppData => ({ scans: [], workouts: [], programs: {} })
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
}

/* eslint-disable @typescript-eslint/no-explicit-any */
class CloudBackend implements Backend {
  kind = 'cloud' as const
  private queue: Promise<unknown> = Promise.resolve()
  constructor(private db: any, private root: string) {}
  // Én skriving om gangen, i rekkefølge
  private write(fn: () => Promise<unknown>) { this.queue = this.queue.then(fn, fn); return this.queue.then(() => undefined) }
  async load(): Promise<AppData> {
    const [main, scans, workouts] = await Promise.all([
      this.db.doc(this.root).get(),
      this.db.collection(`${this.root}/scans`).get(),
      this.db.collection(`${this.root}/workouts`).get(),
    ])
    const m = main.exists ? main.data() : {}
    return {
      profile: m.profile, programs: m.programs ?? {},
      scans: scans.docs.map((d: any) => d.data() as BodyScan),
      workouts: workouts.docs.map((d: any) => d.data() as WorkoutEntry),
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
              cloud.primeMain(local)
              return { backend: cloud, data: local }
            }
          }
          cloud.primeMain(data)
          return { backend: cloud, data }
        }
      }
    } catch { /* faller tilbake til lokal lagring */ }
  }
  const local = new LocalBackend()
  return { backend: local, data: await local.load() }
}
