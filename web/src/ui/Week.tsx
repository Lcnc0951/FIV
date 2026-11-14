import { useEffect, useMemo, useRef, useState } from 'react'
import { totalSets, type WorkoutDay } from '../engine/generator'
import {
  MORNING_TIPS, motivation, music, planWeek, RUN_INFO, runSegments, totalSeconds, weekdayIndex, weekWarnings,
  WEEKDAYS, WEEKDAYS_SHORT, type DayKind, type DayPlan, type RunType, type Segment,
} from '../engine/week'
import { uid } from '../engine/types'
import { effectiveMaxHR } from '../engine/composition'
import { Card, Icon, Sheet, speak, Tag } from './kit'
import { useApp } from './state'

export type StartSession = { kind: 'strength'; day: WorkoutDay } | { kind: 'run'; run: RunType }

export function useWeek() {
  const { profile, program, data } = useApp()
  const days = useMemo(() => planWeek(profile, program?.days.length ?? profile.daysPerWeek), [profile, program])
  // Hvilke dager denne uka er gjennomført
  const done = useMemo(() => {
    const now = new Date()
    const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - weekdayIndex(now))
    const set = new Set<number>()
    for (const w of data.workouts) {
      const d = new Date(w.date)
      if (d >= monday) set.add(weekdayIndex(d))
    }
    return set
  }, [data.workouts])
  const strengthDay = (d: DayPlan) => (d.kind === 'strength' && program?.days.length ? program.days[(d.strengthIndex ?? 0) % program.days.length] : undefined)
  return { days, done, strengthDay, today: weekdayIndex(new Date()) }
}

export function dayTitle(d: DayPlan, s?: WorkoutDay): string {
  if (d.kind === 'strength') return s ? `Styrke · ${s.name}` : 'Styrke'
  if (d.kind === 'rest') return 'Hvile'
  return (d.kind === 'optional' ? 'Valgfritt · ' : '') + (d.run ? RUN_INFO[d.run].label : 'Løp')
}
const dayIcon = (d: DayPlan) => (d.kind === 'strength' ? 'dumbbell' : d.kind === 'rest' ? 'moon' : 'walk')

export function WeekStrip({ onPick }: { onPick?: (i: number) => void }) {
  const { days, done, today } = useWeek()
  return (
    <div className="weekstrip" role="list" aria-label="Uka di">
      {days.map((d) => (
        <button key={d.weekday} role="listitem" className={`wday k-${d.kind} ${d.weekday === today ? 'today' : ''}`} onClick={() => onPick?.(d.weekday)}
          aria-label={`${WEEKDAYS[d.weekday]}: ${dayTitle(d)}${done.has(d.weekday) ? ', fullført' : ''}`}>
          <span className="wday-name">{WEEKDAYS_SHORT[d.weekday]}</span>
          <span className="wday-icon">{done.has(d.weekday) ? <Icon name="check" size={18} /> : <Icon name={dayIcon(d)} size={18} />}</span>
          <span className="wday-label">{d.kind === 'strength' ? String.fromCharCode(65 + (d.strengthIndex ?? 0)) : d.run && d.kind !== 'rest' ? RUN_INFO[d.run].short : '–'}</span>
        </button>
      ))}
    </div>
  )
}

export function TodayCard({ start }: { start: (s: StartSession) => void }) {
  const { profile } = useApp()
  const { days, done, strengthDay, today } = useWeek()
  const [shown, setShown] = useState(today)
  const d = days[shown]
  const s = strengthDay(d)
  const m = music(d)
  const isToday = shown === today
  const tip = MORNING_TIPS[Math.floor(Date.now() / 86_400_000) % MORNING_TIPS.length]
  return (
    <Card className="today">
      <div className="row between">
        <p className="eyebrow accent">{isToday ? 'I dag' : WEEKDAYS[shown]} · {profile.trainingStart}–{profile.trainingEnd}</p>
        {done.has(shown) && <Tag tone="good">fullført</Tag>}
      </div>
      <h2>{dayTitle(d, s)}</h2>
      <p className="quote">«{motivation(d, new Date(Date.now() + (shown - today) * 86_400_000))}»</p>
      {d.kind === 'strength' && s && <p className="muted small">{s.exercises.length} øvelser · {totalSets(s)} sett · {s.focus}</p>}
      {d.run && d.kind !== 'rest' && <p className="muted small">{RUN_INFO[d.run].summary}</p>}
      {d.note && <p className="muted small">{d.note}</p>}
      {d.kind === 'rest' && <p className="muted small">Gå en tur, tøy litt og sov godt. Holdningsrutinen passer fint i dag.</p>}
      {m && (
        <div className="music">
          <div className="row gap-s"><Icon name="music" size={18} /><strong>{m.mood}</strong><span className="muted small">{m.bpm}</span></div>
          <div className="row gap-s wrap">
            {m.playlists.map((p) => <a key={p.url} className="pl" href={p.url} target="_blank" rel="noopener noreferrer">{p.name}<span>{p.by}</span></a>)}
          </div>
        </div>
      )}
      {d.kind === 'strength' && s && <button className="btn primary big full" onClick={() => start({ kind: 'strength', day: s })}><Icon name="play" /> Start styrkeøkta</button>}
      {d.run && d.kind !== 'rest' && <button className="btn primary big full" onClick={() => start({ kind: 'run', run: d.run! })}><Icon name="timer" /> Start intervalltimer</button>}
      {isToday && d.kind !== 'rest' && <p className="hint">{tip}</p>}
      <WeekStrip onPick={setShown} />
    </Card>
  )
}

const KIND_OPTIONS: { kind: DayKind; run?: RunType; label: string }[] = [
  { kind: 'strength', label: 'Styrke' },
  { kind: 'run', run: 'intervals4x4', label: RUN_INFO.intervals4x4.label },
  { kind: 'run', run: 'short45_20', label: RUN_INFO.short45_20.label },
  { kind: 'run', run: 'tempo20', label: RUN_INFO.tempo20.label },
  { kind: 'run', run: 'easy', label: RUN_INFO.easy.label },
  { kind: 'rest', label: 'Hvile' },
]

export function WeekEditor() {
  const { profile, saveProfile } = useApp()
  const { days, strengthDay } = useWeek()
  const [edit, setEdit] = useState<number | null>(null)
  const warnings = weekWarnings(days)
  const setDay = (i: number, o: { kind: DayKind; run?: RunType } | null) => {
    const overrides = { ...(profile.weekOverrides ?? {}) }
    if (o) overrides[i] = o; else delete overrides[i]
    saveProfile({ ...profile, weekOverrides: overrides }, false)
    setEdit(null)
  }
  const hasOverrides = Object.keys(profile.weekOverrides ?? {}).length > 0
  return (
    <Card>
      <div className="row between"><h3>Uka di · {profile.trainingStart}–{profile.trainingEnd}</h3>
        {hasOverrides && <button className="link small" onClick={() => saveProfile({ ...profile, weekOverrides: {} }, false)}>Tilbakestill</button>}</div>
      <div className="list">
        {days.map((d) => (
          <button key={d.weekday} className="list-row" onClick={() => setEdit(d.weekday)}>
            <span className="row gap"><span className={`dot k-${d.kind}`}><Icon name={dayIcon(d)} size={16} /></span>
              <span><strong>{WEEKDAYS[d.weekday]}</strong><br /><span className="muted small">{dayTitle(d, strengthDay(d))}</span></span></span>
            <span className="muted small">Endre <Icon name="chevron" size={14} /></span>
          </button>
        ))}
      </div>
      {warnings.map((w) => <p key={w} className="warn small"><Icon name="alert" size={14} /> {w}</p>)}
      <p className="hint">Styrke ligger med en dag imellom, og harde intervaller ligger aldri to dager på rad. Første løpeøkt veksler mellom 4×4 og 45/20 fra uke til uke.</p>
      <Sheet open={edit != null} onClose={() => setEdit(null)} title={edit != null ? WEEKDAYS[edit] : ''}>
        {edit != null && (
          <div className="stack-s">
            {KIND_OPTIONS.map((o) => (
              <button key={o.label} className={`choice ${days[edit].kind === o.kind && (o.kind !== 'run' || days[edit].run === o.run) ? 'on' : ''}`} onClick={() => setDay(edit, { kind: o.kind, run: o.run })}>
                <strong>{o.label}</strong>{o.run && <span>{RUN_INFO[o.run].summary}</span>}
              </button>
            ))}
            {profile.weekOverrides?.[edit] && <button className="btn ghost full" onClick={() => setDay(edit, null)}>Bruk PT-ens forslag</button>}
          </div>
        )}
      </Sheet>
    </Card>
  )
}

/** Intervalltimer med tale og pip — løp med telefonen i lomma. */
export function RunTimer({ run, onClose }: { run: RunType; onClose: () => void }) {
  const { profile, logWorkout } = useApp()
  const segs = useMemo(() => runSegments(run, profile.sessionMinutes), [run, profile.sessionMinutes])
  const total = totalSeconds(segs)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const startedAt = useRef<number | null>(null)
  const base = useRef(0)
  const lastSeg = useRef(-1)
  const audio = useRef<AudioContext | null>(null)
  const wake = useRef<{ release: () => Promise<void> } | null>(null)

  const beep = (freq = 880, ms = 160) => {
    try {
      const ctx = audio.current ??= new AudioContext()
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.value = freq; g.gain.value = 0.15
      o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + ms / 1000)
    } catch { /* lyd er valgfritt */ }
  }

  let acc = 0, idx = segs.length - 1
  for (let i = 0; i < segs.length; i++) { if (elapsed < acc + segs[i].seconds) { idx = i; break } acc += segs[i].seconds }
  const seg = segs[idx]
  const left = Math.max(0, Math.ceil(acc + seg.seconds - elapsed))
  const finished = elapsed >= total

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setElapsed(base.current + (Date.now() - (startedAt.current ?? Date.now())) / 1000), 200)
    return () => clearInterval(t)
  }, [running])

  useEffect(() => {
    if (!running) return
    if (finished) {
      setRunning(false); speak('Ferdig! Sterkt jobba. Husk nedtøying og protein til frokost.'); beep(660, 500)
      return
    }
    if (idx !== lastSeg.current) {
      lastSeg.current = idx
      const s = segs[idx]
      const txt = s.intensity === 'hard' ? `${s.label}. Kjør!` : s.intensity === 'pause' ? 'Pause. Pust rolig.' : s.intensity === 'moderat' ? 'Terskel. Finn rytmen.' : s.label
      speak(txt); beep(s.intensity === 'hard' ? 990 : 660, 220)
    }
    if (left <= 3 && left >= 1 && seg.seconds >= 20) beep(left === 1 ? 990 : 770, 90)
  }, [idx, left, running, finished]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async () => {
    if (running) { base.current = elapsed; setRunning(false); wake.current?.release().catch(() => undefined); return }
    startedAt.current = Date.now(); base.current = elapsed; setRunning(true)
    try { wake.current = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen') } catch { /* valgfritt */ }
  }
  useEffect(() => () => { wake.current?.release().catch(() => undefined) }, [])

  const save = async () => {
    await logWorkout([{ id: uid(), date: new Date().toISOString(), dayName: RUN_INFO[run].label, exerciseId: `run:${run}`, sets: [] }])
    onClose()
  }
  const hr = effectiveMaxHR(new Date().getFullYear() - profile.birthYear, profile.watch?.maxHR)
  const zone = (i: Segment['intensity']) => i === 'hard' ? `${Math.floor(hr * 0.85)}–${Math.floor(hr * 0.95)}` : i === 'moderat' ? `${Math.floor(hr * 0.8)}–${Math.floor(hr * 0.87)}` : `${Math.floor(hr * 0.6)}–${Math.floor(hr * 0.72)}`
  const hardDone = segs.slice(0, idx).filter((s) => s.intensity === 'hard').length
  const hardTotal = segs.filter((s) => s.intensity === 'hard').length
  return (
    <div className="stack">
      <header className="page-head row between"><button className="btn ghost" onClick={onClose}><Icon name="back" /> Avslutt</button><h1 className="h2">{RUN_INFO[run].short}</h1></header>
      <div className={`timer i-${finished ? 'done' : seg.intensity}`} aria-live="polite">
        <div className="timer-label">{finished ? 'Ferdig!' : seg.label}</div>
        <div className="timer-clock">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</div>
        {!finished && <div className="timer-hr">Puls {zone(seg.intensity)}</div>}
        <div className="timer-sub">{finished ? `${Math.round(total / 60)} minutter fullført` : idx + 1 < segs.length ? `Neste: ${segs[idx + 1].label}` : 'Siste del'}</div>
      </div>
      <div className="bar"><div className="bar-fill" style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }} /></div>
      {hardTotal > 0 && <p className="center small muted">{hardDone} av {hardTotal} drag gjort · totalt {Math.round(total / 60)} min</p>}
      {!finished
        ? <button className="btn primary big full" onClick={toggle}>{running ? 'Pause' : elapsed > 0 ? 'Fortsett' : 'Start'}</button>
        : <button className="btn primary big full" onClick={save}>Lagre økta</button>}
      <Card>
        <p className="small"><strong>Slik:</strong> {RUN_INFO[run].summary}</p>
        <p className="small muted">{RUN_INFO[run].why}</p>
        <p className="small muted">Telefonen sier fra ved hvert skifte, så du kan ha den i lomma. Har du pulsklokke: harde drag 85–95 % av makspuls.</p>
      </Card>
    </div>
  )
}
