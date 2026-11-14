// Ukeplan: fordeler styrke- og løpeøkter på ukedagene, med intervalltimer, motivasjon og musikk.
// Prinsipper (samtidig trening): maks 2 harde løpeøkter i uka, ikke to harde økter samme morgen,
// styrke spredt med en dags mellomrom (Schumann 2022; Wilson 2012), og variasjon i intervalltype (Rønnestad 2020).
import type { Profile } from './types'

export type RunType = 'intervals4x4' | 'short45_20' | 'tempo20' | 'easy'
export type DayKind = 'strength' | 'run' | 'optional' | 'rest'

export interface Segment { label: string; seconds: number; intensity: 'rolig' | 'moderat' | 'hard' | 'pause' }

export const RUN_INFO: Record<RunType, { label: string; short: string; hard: boolean; summary: string; why: string }> = {
  intervals4x4: {
    label: '4×4 intervaller', short: '4×4', hard: true,
    summary: '10 min oppvarming · 4 × 4 min hardt (85–95 % av makspuls) med 3 min rolig jogg · 5 min ned',
    why: 'Den norske metoden fra NTNU — en av de mest effektive måtene å øke VO₂maks på.',
  },
  short45_20: {
    label: '45/20 korte intervaller', short: '45/20', hard: true,
    summary: '10 min oppvarming · 12 × 45 sek hardt / 20 sek pause · 5 min ned',
    why: 'Korte drag med kort pause gir mye tid nær maks oksygenopptak (Rønnestad 2020). Fin variasjon fra 4×4.',
  },
  tempo20: {
    label: '20 min terskelløp', short: 'Terskel', hard: false,
    summary: '5 min oppvarming · 20 min jevnt «komfortabelt hardt» (du kan si korte setninger) · 5 min ned',
    why: 'Hever terskelen — farten du kan holde lenge. Moderat belastning, lett å kombinere med styrke.',
  },
  easy: {
    label: 'Rolig løp (sone 2)', short: 'Rolig', hard: false,
    summary: '30–40 min så rolig at du kan prate i hele setninger',
    why: 'Bygger aerob base og fettforbrenning uten å stjele restitusjon fra styrketreningen.',
  },
}

/** `reps`/`minutes` fra løpeprogresjonen, `scale` < 1 ved dårlig dagsform eller lett uke. */
export function runSegments(type: RunType, totalMinutes = 40, params?: { reps?: number; minutes?: number }, scale = 1): Segment[] {
  const s: Segment[] = []
  const scaled = (n: number, min: number) => Math.max(min, Math.round(n * scale))
  switch (type) {
    case 'intervals4x4': {
      const reps = scaled(params?.reps ?? 4, 2)
      s.push({ label: 'Oppvarming', seconds: 600, intensity: 'rolig' })
      for (let i = 1; i <= reps; i++) {
        s.push({ label: `Drag ${i} av ${reps}`, seconds: 240, intensity: 'hard' })
        if (i < reps) s.push({ label: 'Rolig jogg', seconds: 180, intensity: 'pause' })
      }
      s.push({ label: 'Nedjogg', seconds: 300, intensity: 'rolig' })
      break
    }
    case 'short45_20': {
      const reps = scaled(params?.reps ?? 12, 6)
      s.push({ label: 'Oppvarming', seconds: 600, intensity: 'rolig' })
      for (let i = 1; i <= reps; i++) {
        s.push({ label: `Drag ${i} av ${reps}`, seconds: 45, intensity: 'hard' })
        if (i < reps) s.push({ label: 'Pause', seconds: 20, intensity: 'pause' })
      }
      s.push({ label: 'Nedjogg', seconds: 300, intensity: 'rolig' })
      break
    }
    case 'tempo20': {
      const min = scaled(params?.minutes ?? 20, 12)
      s.push({ label: 'Oppvarming', seconds: 300, intensity: 'rolig' }, { label: 'Terskel', seconds: min * 60, intensity: 'moderat' }, { label: 'Nedjogg', seconds: 300, intensity: 'rolig' })
      break
    }
    case 'easy':
      s.push({ label: 'Rolig løp', seconds: Math.max(20, Math.min(45, totalMinutes - 5)) * 60, intensity: 'rolig' })
      break
  }
  return s
}

export const totalSeconds = (segs: Segment[]) => segs.reduce((a, b) => a + b.seconds, 0)

export interface DayPlan {
  weekday: number // 0 = mandag
  kind: DayKind
  strengthIndex?: number
  run?: RunType
  note?: string
}

export const WEEKDAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
export const WEEKDAYS_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']

/** ISO-ukenummer (brukes til å veksle mellom 4×4 og 45/20). */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - y.getTime()) / 86_400_000 + 1) / 7)
}
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7

const STRENGTH_DAYS: Record<number, number[]> = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] }
const RUN_DAY_ORDER = [1, 3, 5, 2, 4, 6]

/** Lager ukeplanen. Brukerens egne endringer (weekOverrides) vinner alltid. */
export function planWeek(p: Profile, strengthDays: number, date = new Date()): DayPlan[] {
  const days: DayPlan[] = WEEKDAYS.map((_, i) => ({ weekday: i, kind: 'rest' }))
  const allowed = new Set([0, 1, 2, 3, 4, ...(p.weekendTraining ? [5] : [])])
  const strength = (STRENGTH_DAYS[Math.min(6, Math.max(1, strengthDays))] ?? [0, 2, 4]).filter((d) => allowed.has(d))
  strength.forEach((d, i) => { days[d] = { weekday: d, kind: 'strength', strengthIndex: i } })

  const prefs = p.runTypes.length ? p.runTypes : (['intervals4x4', 'tempo20'] as RunType[])
  const hardTypes = prefs.filter((t) => RUN_INFO[t].hard)
  const softTypes = prefs.filter((t) => !RUN_INFO[t].hard)
  const week = isoWeek(date)
  const runDays = RUN_DAY_ORDER.filter((d) => allowed.has(d) && days[d].kind === 'rest').slice(0, p.runsPerWeek)
  runDays.sort((a, b) => a - b).forEach((d, i) => {
    // Første løpeøkt i uka er hard (veksler mellom favoritt-intervallene uke for uke), neste er moderat
    let run: RunType
    if (i === 0 && hardTypes.length) run = hardTypes[week % hardTypes.length]
    else if (i === 1 && softTypes.length) run = softTypes[0]
    else if (i === 1 && hardTypes.length > 1) run = hardTypes[(week + 1) % hardTypes.length]
    else run = softTypes[i % Math.max(1, softTypes.length)] ?? 'easy'
    days[d] = { weekday: d, kind: 'run', run }
  })
  // Valgfri helgeøkt hvis lørdag er ledig
  if (p.weekendTraining && days[5].kind === 'rest') days[5] = { weekday: 5, kind: 'optional', run: 'easy', note: 'Valgfritt: rolig tur eller løp 30–45 min, gjerne ute i dagslys.' }

  for (const [k, o] of Object.entries(p.weekOverrides ?? {})) {
    const i = Number(k)
    if (o && days[i]) days[i] = { ...o, weekday: i }
  }
  // Nummerer styrkeøktene i rekkefølge (A, B, C …) etter eventuelle endringer
  let n = 0
  for (const d of days) if (d.kind === 'strength') d.strengthIndex = n++
  return days
}

/** Advarsler hvis brukeren har laget en uheldig uke. */
export function weekWarnings(days: DayPlan[]): string[] {
  const w: string[] = []
  const hard = days.filter((d) => d.kind === 'run' && d.run && RUN_INFO[d.run].hard)
  if (hard.length > 2) w.push('Mer enn to harde intervalløkter i uka gir sjelden mer fremgang, men mer tretthet. Gjør én av dem rolig.')
  for (let i = 0; i < 6; i++) {
    const a = days[i], b = days[i + 1]
    if (a.run && b.run && RUN_INFO[a.run].hard && RUN_INFO[b.run].hard) w.push(`${WEEKDAYS[i]} og ${WEEKDAYS[i + 1].toLowerCase()} er begge harde intervaller. Legg en rolig dag imellom.`)
  }
  if (days.every((d) => d.kind !== 'rest')) w.push('Ingen hviledag. Én dag uten trening gir bedre fremgang de andre dagene.')
  return w
}

// ---------------- Motivasjon ----------------

const LINES: Record<'strength' | 'hard' | 'tempo' | 'easy' | 'rest', string[]> = {
  strength: [
    'Kl. 06:10 mens andre sover, bygger du en sterkere versjon av deg selv.',
    'Ett rep til enn sist. Det er hele hemmeligheten.',
    'Musklene husker ikke hvor trøtt du var — bare at du møtte opp.',
    'Tunge løft, rolig hode. Kontroller nedfasen.',
    'Konsistens slår intensitet. Du er her igjen — det er seieren.',
    'Styrke er den beste pensjonsforsikringen du kan kjøpe. Innbetaling i dag.',
    'Ikke tenk på hele økta. Tenk på neste sett.',
    'Du trener ikke for å bli sliten. Du trener for å bli bedre.',
  ],
  hard: [
    'Fire drag. Fire små kamper. Du vinner alle.',
    'Det skal svi. Det er der VO₂maks vokser.',
    'Ubehaget varer i minutter. Formen varer i måneder.',
    'Siste drag er det som teller mest — gi litt mer der.',
    'Hjertet ditt blir sterkere for hvert drag. Bokstavelig talt.',
    'Kort pause, kort minne. Neste drag starter nå.',
    'Mørk vintermorgen, lys fremtid. Gå på.',
  ],
  tempo: [
    'Komfortabelt hardt. Finn rytmen og bli i den.',
    'Pust jevnt, tell steg. 20 minutter er kortere enn du tror.',
    'I dag løper du ikke fort — du løper smart.',
    'Terskelen flyttes ett steg av gangen. Dette er ett av dem.',
  ],
  easy: [
    'Rolig er riktig. Du skal kunne prate hele veien.',
    'I dag bygger du motoren. Ingen stress.',
    'Nyt morgenen. Formen kommer av de rolige turene også.',
  ],
  rest: [
    'Hvile er trening. Musklene vokser i dag.',
    'Sov godt, spis protein, gå en tur. Kroppen gjør resten.',
    'Fri i dag. Neste økt blir bedre av det.',
  ],
}

export function motivation(day: DayPlan, date = new Date()): string {
  const key = day.kind === 'strength' ? 'strength' : day.kind === 'rest' ? 'rest'
    : day.run && RUN_INFO[day.run].hard ? 'hard' : day.run === 'tempo20' ? 'tempo' : 'easy'
  const list = LINES[key]
  const seed = Math.floor(date.getTime() / 86_400_000)
  return list[seed % list.length]
}

// ---------------- Musikk (Spotify) ----------------

export interface Playlist { name: string; by: string; url: string }
export interface MusicPick { mood: string; bpm: string; playlists: Playlist[] }

// Spillelister funnet via Spotify-søk (offentlige lister). Lenkene åpner Spotify.
const PL = {
  intervall: { name: 'Energisk Intervalltrening 4x4', by: 'Spotify', url: 'https://open.spotify.com/playlist/03X6wdMOLNtsztFwx8kCMS' },
  hiit: { name: 'HIIT intervals 30/15, 40/20, Tabata', by: 'Helena Pines', url: 'https://open.spotify.com/playlist/4cIgfK4d7sB7nq1cQiBqsO' },
  tabata: { name: 'Tabata 40/20', by: 'Noel', url: 'https://open.spotify.com/playlist/25je3IwxSOjK1NUcMeeYGX' },
  styrke: { name: 'Styrketrening Gym Motivasjon', by: 'Spotify', url: 'https://open.spotify.com/playlist/2uuDbJqzRKPc2Nfn59PP9E' },
  lop160: { name: 'Løping 160-180 bpm', by: 'Tina Høgevold', url: 'https://open.spotify.com/playlist/117yotp0p5w6QxQtZ5Y0SC' },
  lopecoach: { name: 'Løpemusikk 2026', by: 'Lopecoach.no', url: 'https://open.spotify.com/playlist/2YcbFxSOomj64ERVtZixFg' },
  rolig: { name: 'Running 150-160 BPM', by: 'Manji', url: 'https://open.spotify.com/playlist/4a0BOxyBbcZD6g5mdlVy8u' },
  bpm180: { name: 'Idas løpeliste 180 BPM', by: 'Ida Marie Fottland', url: 'https://open.spotify.com/playlist/7ochW2wKRMpAss7ZiLjPsR' },
}

export function music(day: DayPlan): MusicPick | null {
  if (day.kind === 'rest') return null
  if (day.kind === 'strength') return { mood: 'Tung og fokusert — hip hop, rock og elektronisk', bpm: '120–140 BPM', playlists: [PL.styrke, PL.lopecoach] }
  switch (day.run) {
    case 'intervals4x4': return { mood: 'Høy energi som bygger seg opp gjennom hvert drag', bpm: '165–180 BPM', playlists: [PL.intervall, PL.bpm180] }
    case 'short45_20': return { mood: 'Eksplosivt — korte, harde drag', bpm: '170–180 BPM', playlists: [PL.hiit, PL.tabata] }
    case 'tempo20': return { mood: 'Jevnt driv i stabil rytme', bpm: '160–175 BPM', playlists: [PL.lop160, PL.lopecoach] }
    default: return { mood: 'Rolig og behagelig', bpm: '150–160 BPM', playlists: [PL.rolig, PL.lop160] }
  }
}

// ---------------- Morgentrening ----------------

export const MORNING_TIPS = [
  'Før økta: et glass vann og gjerne en banan eller kaffe 20–30 min før. 40 minutter går fint fastende også.',
  'Etter økta: frokost med 30–40 g protein innen et par timer — skyr, egg, cottage cheese eller proteinshake.',
  'Vintermorgen: 2–3 min ekstra oppvarming. Kalde muskler er svakere og mer utsatt for strekk.',
  'Legg frem klærne kvelden før. Færre valg kl. 06 = større sjanse for at du drar.',
  'Legg deg før kl. 22:30 for 7–8 timers søvn før en 06:10-økt.',
]

/** Minutter mellom to klokkeslett «hh:mm». */
export function minutesBetween(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number), [bh, bm] = b.split(':').map(Number)
  const d = bh * 60 + bm - (ah * 60 + am)
  return Number.isFinite(d) && d > 0 ? d : 60
}
