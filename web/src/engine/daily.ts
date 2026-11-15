// Daglig tilpasning: dagsform, vekttrend, løpeprogresjon, treningsperiode og helsesjekk.
import type { Goal, WatchData } from './types'
import { RUN_INFO, type DayPlan, type RunType } from './week'

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ---------------- Dagsform ----------------

export interface Checkin {
  date: string; sleep: number; soreness: number; energy: number; restingHR?: number
  /** Søvnscore fra Apple Watch (0–100). Overstyrer egen vurdering av søvn. */
  sleepScore?: number
  /** «Vitale tegn» i Helse-appen viste avvik i natt. */
  vitalsOutlier?: boolean
}

/** Apples søvnscore til skala 1–5 (Svært høy/Høy/OK/Lav/Svært lav). */
export const sleepFromScore = (s: number) => (s >= 90 ? 5 : s >= 81 ? 4 : s >= 61 ? 3 : s >= 41 ? 2 : 1)
export type Readiness = 'green' | 'yellow' | 'red'

/** 1–5 der 5 er best (stølhet: 5 = ikke støl). Hvilepuls 5+ over normalen trekker ned (Plews 2013). */
export function readiness(c: Checkin, normalRestingHR?: number): { level: Readiness; score: number; reasons: string[] } {
  const sleep = c.sleepScore != null ? sleepFromScore(c.sleepScore) : c.sleep
  let score = (sleep + c.soreness + c.energy) / 3
  const reasons: string[] = []
  if (sleep <= 2) reasons.push(c.sleepScore != null ? `søvnscore ${c.sleepScore}` : 'lite søvn')
  if (c.soreness <= 2) reasons.push('støl')
  if (c.energy <= 2) reasons.push('lite energi')
  if (c.restingHR && normalRestingHR && c.restingHR - normalRestingHR >= 5) {
    score -= c.restingHR - normalRestingHR >= 8 ? 1.2 : 0.6
    reasons.push(`hvilepuls ${c.restingHR - normalRestingHR} over normalen`)
  }
  if (c.vitalsOutlier) { score -= 0.7; reasons.push('avvik i vitale tegn') }
  const level: Readiness = score >= 3.5 ? 'green' : score >= 2.5 ? 'yellow' : 'red'
  return { level, score: Math.round(score * 10) / 10, reasons }
}

export interface Adjusted { day: DayPlan; volumeFactor: number; runScale: number; message: string }

/** Justerer dagens økt etter dagsform og om det er lett uke. */
export function adjustDay(day: DayPlan, level: Readiness | undefined, deload: boolean): Adjusted {
  let out: DayPlan = { ...day }
  let volumeFactor = 1, runScale = 1
  const msgs: string[] = []
  if (deload) {
    volumeFactor = 0.5
    if (out.run && RUN_INFO[out.run].hard) { runScale = 0.6; msgs.push('Lett uke: færre intervalldrag og halvparten av styrkesettene.') }
    else msgs.push('Lett uke: halvparten av settene, samme vekter.')
  }
  if (level === 'yellow') {
    if (out.kind === 'strength') { volumeFactor = Math.min(volumeFactor, 0.75); msgs.push('Dagsform gul: ett sett mindre per øvelse, hold 2 reps i reserve.') }
    if (out.run && RUN_INFO[out.run].hard) { runScale = Math.min(runScale, 0.75); msgs.push('Dagsform gul: færre drag i dag. Kvalitet foran mengde.') }
  }
  if (level === 'red') {
    if (out.kind === 'strength') { volumeFactor = Math.min(volumeFactor, 0.5); msgs.push('Dagsform rød: lett styrkeøkt med halve settene — eller bytt til en rolig gåtur.') }
    if (out.run && out.kind !== 'rest') { out = { ...out, run: 'easy' }; msgs.push('Dagsform rød: intervallene byttes med rolig løp eller gåtur. Kroppen trenger hvile mer enn en hard økt i dag.') }
  }
  return { day: out, volumeFactor, runScale, message: msgs.join(' ') }
}

// ---------------- Vekt ----------------

export interface WeightEntry { date: string; kg: number }
export interface WeightTrend { avg7?: number; prevAvg7?: number; weeklyChangePct?: number; points: { date: string; kg: number; avg: number }[] }

export function weightTrend(entries: WeightEntry[]): WeightTrend {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const t = (d: string) => new Date(d + 'T12:00:00').getTime()
  const points = sorted.map((e) => {
    const win = sorted.filter((x) => t(x.date) <= t(e.date) && t(x.date) > t(e.date) - 7 * 86_400_000)
    return { date: e.date, kg: e.kg, avg: win.reduce((s, x) => s + x.kg, 0) / win.length }
  })
  if (!sorted.length) return { points }
  const last = t(sorted[sorted.length - 1].date)
  const inWin = (from: number, to: number) => sorted.filter((x) => t(x.date) > from && t(x.date) <= to)
  const w1 = inWin(last - 7 * 86_400_000, last), w0 = inWin(last - 14 * 86_400_000, last - 7 * 86_400_000)
  const avg = (l: WeightEntry[]) => (l.length ? l.reduce((s, x) => s + x.kg, 0) / l.length : undefined)
  const avg7 = avg(w1), prevAvg7 = w0.length >= 3 ? avg(w0) : undefined
  return { avg7, prevAvg7, weeklyChangePct: avg7 && prevAvg7 ? ((avg7 - prevAvg7) / prevAvg7) * 100 : undefined, points }
}

/** Foreslår kaloriendring ut fra ukesnittet (Helms 2014). Positivt = spis mer. */
export function kcalSuggestion(goal: Goal, trend: WeightTrend): { kcal: number; message: string } | null {
  const pct = trend.weeklyChangePct
  if (pct == null) return null
  const f = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')} %`
  if (goal === 'loseFat') {
    if (pct > -0.25) return { kcal: -150, message: `Ukesnittet endret seg ${f(pct)} — for lite for fettap. Trekk fra 150 kcal per dag (eller +2 000 skritt).` }
    if (pct < -1.0) return { kcal: +150, message: `Ned ${f(pct)} på en uke — raskere enn anbefalt. Spis 150 kcal mer for å skåne musklene.` }
    return { kcal: 0, message: `Ned ${f(pct)} siste uke — perfekt tempo. Fortsett.` }
  }
  if (goal === 'buildMuscle') {
    if (pct < 0.05) return { kcal: +150, message: `Vekten står stille (${f(pct)}). Spis 150 kcal mer for å bygge muskler.` }
    if (pct > 0.25) return { kcal: -100, message: `Opp ${f(pct)} på en uke — litt raskt, mer blir fett. Trekk fra 100 kcal.` }
    return { kcal: 0, message: `Opp ${f(pct)} — fint tempo for muskelvekst.` }
  }
  if (Math.abs(pct) > 0.5) return { kcal: pct > 0 ? -100 : +100, message: `Vekten endret seg ${f(pct)} siste uke. Juster ${pct > 0 ? 'ned' : 'opp'} 100 kcal for å holde den stabil.` }
  return { kcal: 0, message: `Stabil vekt (${f(pct)}). Bra.` }
}

// ---------------- Løpeprogresjon ----------------

export interface RunLog { type: RunType; date: string; rpe: number; avgHR?: number; km?: number; reps?: number; minutes?: number; speed?: number }
export interface RunParams { reps: number; minutes: number; note: string }

const BASE: Record<RunType, RunParams> = {
  intervals4x4: { reps: 4, minutes: 4, note: '' },
  short45_20: { reps: 10, minutes: 0, note: '' },
  tempo20: { reps: 1, minutes: 20, note: '' },
  easy: { reps: 1, minutes: 30, note: '' },
}

/** Neste økt ut fra forrige av samme type. RPE = hvor tungt det føltes (1–10). */
export function nextRun(type: RunType, history: RunLog[]): RunParams {
  const last = [...history].filter((h) => h.type === type).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!last) return { ...BASE[type], note: type === 'short45_20' ? 'Første gang: 10 drag. Vi bygger opp mot 15.' : 'Første gang i appen — finn en fart du klarer å holde jevnt.' }
  const easy = last.rpe <= 7, hard = last.rpe >= 9
  switch (type) {
    case 'short45_20': {
      const prev = last.reps ?? 10
      if (easy && prev < 15) return { reps: prev + 1, minutes: 0, note: `Forrige gang føltes ${last.rpe}/10 — ett drag mer i dag (${prev + 1}).` }
      if (easy) return { reps: 15, minutes: 0, note: '15 drag sitter. Øk farten litt i dragene (ca. 0,5 km/t), eller ta en litt brattere bakke.' }
      if (hard) return { reps: Math.max(8, prev - 1), minutes: 0, note: 'Forrige gang var veldig tung — ett drag mindre, og hold kvaliteten.' }
      return { reps: prev, minutes: 0, note: 'Samme antall drag som sist — prøv å holde samme fart gjennom alle.' }
    }
    case 'intervals4x4':
      if (easy) return { reps: 4, minutes: 4, note: `Forrige 4×4 føltes ${last.rpe}/10${last.avgHR ? ` (snittpuls ${last.avgHR})` : ''}. Øk farten 0,3–0,5 km/t eller 1 % stigning i dragene.` }
      if (hard) return { reps: 4, minutes: 4, note: 'Forrige gang var nær maks. Samme fart i dag — målet er at fjerde drag er like raskt som første.' }
      return { reps: 4, minutes: 4, note: 'Samme fart som sist. Når det føles 7/10 eller lettere, øker vi.' }
    case 'tempo20': {
      const prev = last.minutes ?? 20
      if (easy && prev < 30) return { reps: 1, minutes: Math.min(30, prev + 5), note: `Terskel føltes ${last.rpe}/10 — ${Math.min(30, prev + 5)} minutter i dag. Over 30 min øker vi farten i stedet.` }
      if (easy) return { reps: 1, minutes: 30, note: '30 min sitter. Øk farten litt (5–10 sek per km).' }
      return { reps: 1, minutes: prev, note: 'Samme lengde som sist. Jevn, kontrollert fart.' }
    }
    default:
      return { reps: 1, minutes: 30, note: 'Rolig — du skal kunne prate hele veien.' }
  }
}

// ---------------- Treningsperiode ----------------

export interface CycleInfo { week: number; length: number; deload: boolean; finished: boolean; daysLeft: number }

export function cycleInfo(cycleStart: string | undefined, length: number, now = new Date()): CycleInfo {
  const start = cycleStart ? new Date(cycleStart) : now
  const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000))
  const week = Math.floor(days / 7) + 1
  return { week: Math.min(week, length), length, deload: week === length, finished: week > length, daysLeft: Math.max(0, length * 7 - days) }
}

// ---------------- Helsesjekk (PAR-Q+, generelle spørsmål) ----------------

export const PARQ = [
  'Har en lege noen gang sagt at du har en hjertesykdom eller høyt blodtrykk?',
  'Kjenner du smerter i brystet i hvile, i hverdagen eller når du er fysisk aktiv?',
  'Har du mistet balansen på grunn av svimmelhet, eller besvimt, det siste året?',
  'Har du fått diagnose på en annen kronisk sykdom (utenom hjertesykdom og høyt blodtrykk)?',
  'Bruker du fast medisin for en kronisk sykdom?',
  'Har du nå (eller de siste 12 månedene) et problem med skjelett, ledd eller muskler som kan forverres av mer aktivitet?',
  'Har en lege sagt at du bare bør trene under medisinsk oppfølging?',
]

export const WARNING_SIGNS = 'Stopp og kontakt lege ved brystsmerter, trykk i brystet, uvanlig tung pust, svimmelhet eller hjertebank under trening. Ring 113 ved akutte brystsmerter.'

// ---------------- Klokkedata fra Apple-snarvei ----------------

const KEYS: [keyof WatchData, RegExp][] = [
  ['vo2max', /vo2|vo₂|kondisjon/i],
  ['restingHR', /hvile|resting/i],
  ['maxHR', /maks|max/i],
  ['activeKcal', /aktiv|active|kcal|energi/i],
  ['steps', /skritt|steps/i],
  ['exerciseMin', /trening|exercise|minutt/i],
]
const BEDTIME = /leggetid|bedtime/i

/** Leser tekst limt inn fra en Snarvei, f.eks. «Kondisjon: 39,2\nHvilepuls: 52\nSkritt: 8764», eller JSON. */
export function parseWatchText(text: string): WatchData {
  const out: WatchData = {}
  try {
    const j = JSON.parse(text)
    for (const [k] of KEYS) if (typeof j[k] === 'number') (out as Record<string, number>)[k] = j[k]
    if (Object.keys(out).length) return { ...out, updated: new Date().toISOString() }
  } catch { /* ikke JSON — les linjer */ }
  for (const line of text.split(/\n|;/)) {
    const bt = line.match(/(\d{1,2})[:.](\d{2})/)
    if (BEDTIME.test(line) && bt) { out.avgBedtime = `${bt[1].padStart(2, '0')}:${bt[2]}`; continue }
    const m = line.match(/^(.*?)[:=\s]+(-?\d[\d\s]*(?:[.,]\d+)?)/)
    if (!m) continue
    const value = Number(m[2].replace(/\s/g, '').replace(',', '.'))
    const key = KEYS.find(([, re]) => re.test(m[1]))?.[0]
    if (key && Number.isFinite(value) && out[key] == null) (out as Record<string, number>)[key] = value
  }
  return Object.keys(out).length ? { ...out, updated: new Date().toISOString() } : out
}

// ---------------- Søvn ----------------

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const toTime = (m: number) => { const x = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}` }

/** Når du må legge deg for å få `hours` søvn før økta (25 min fra vekking til start, 15 min å sovne). */
export function bedtimeFor(trainingStart: string, hours = 7): { wake: string; bed: string } {
  const wake = toMin(trainingStart) - 25
  return { wake: toTime(wake), bed: toTime(wake - hours * 60 - 15) }
}

/** Søvn du faktisk får med vanlig leggetid før en treningsmorgen. */
export function sleepAvailable(trainingStart: string, usualBedtime: string): number {
  const wake = toMin(trainingStart) - 25
  let bed = toMin(usualBedtime)
  if (bed > wake) bed -= 1440
  return Math.round(((wake - bed - 15) / 60) * 10) / 10
}
