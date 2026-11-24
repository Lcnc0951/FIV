import { useEffect, useMemo, useRef, useState } from 'react'
import { totalSets, type WorkoutDay } from '../engine/generator'
import {
  MORNING_TIPS, motivation, music, planWeek, RUN_INFO, runSegments, totalSeconds, setupFromSegments, segmentsFromSetup, mergeSetup, weekdayIndex, weekWarnings,
  WEEKDAYS, WEEKDAYS_SHORT, type DayKind, type DayPlan, type RunType, type Segment, type IntervalSetup,
} from '../engine/week'
import { uid } from '../engine/types'
import { effectiveMaxHR } from '../engine/composition'
import { Card, Icon, Sheet, speak, Tag } from './kit'
import { useApp } from './state'
import { adjustForHealth, SKIP_LABEL } from '../engine/absence'
import { IntervalEditor } from './IntervalEditor'
import { SickCard, SkipButton, useHealth } from './Skip'
import { adjustDay, nextRun, WARNING_SIGNS, type RunLog } from '../engine/daily'
import { useCycle, useToday } from './Daily'

export type StartSession =
  | { kind: 'strength'; day: WorkoutDay; volumeFactor?: number }
  | { kind: 'run'; run: RunType; reps?: number; minutes?: number; scale?: number; note?: string; skipWarmup?: boolean }

/** Logg over løpeøkter (for progresjon). */
export function useRunLogs(): RunLog[] {
  const { data } = useApp()
  return data.workouts.filter((w) => w.run).map((w) => ({ ...w.run!, date: w.date, note: w.note }))
}

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
  const { profile, saveProfile } = useApp()
  const health = useHealth()
  const { days, done, strengthDay, today } = useWeek()
  const { readiness: r } = useToday()
  const cycle = useCycle()
  const runLogs = useRunLogs()
  const [shown, setShown] = useState(today)
  const isToday = shown === today
  const baseAdj = adjustDay(days[shown], isToday ? r?.level : undefined, cycle.deload && !cycle.finished)
  const adj = isToday ? adjustForHealth(baseAdj, health.phase, health.lastSkip) : baseAdj
  const sickToday = isToday && health.phase.phase === 'sick'
  const skipped = isToday && !sickToday ? health.skippedToday : undefined
  const d = adj.day
  const s = strengthDay(d)
  const m = music(d)
  const runParams = d.run && d.kind !== 'rest' ? nextRun(d.run, runLogs) : undefined
  const tip = MORNING_TIPS[Math.floor(Date.now() / 86_400_000) % MORNING_TIPS.length]
  const setsShown = s ? s.exercises.reduce((n, p) => n + Math.max(1, Math.round(p.sets * adj.volumeFactor)), 0) : 0
  if (sickToday) return <Card className="today"><SickCard /><WeekStrip onPick={setShown} /></Card>
  return (
    <Card className="today">
      <div className="row between">
        <p className="eyebrow accent">{isToday ? 'I dag' : WEEKDAYS[shown]} · {profile.trainingStart}–{profile.trainingEnd}</p>
        {done.has(shown) && <Tag tone="good">fullført</Tag>}
      </div>
      <h2>{dayTitle(d, s)}</h2>
      <p className="quote">«{motivation(d, new Date(Date.now() + (shown - today) * 86_400_000))}»</p>
      {adj.message && <p className="adjust small"><Icon name="info" size={14} /> {adj.message}</p>}
      {d.kind === 'strength' && s && <p className="muted small">{s.exercises.length} øvelser · {setsShown} sett · {s.focus}</p>}
      {d.run && d.kind !== 'rest' && <p className="muted small">{RUN_INFO[d.run].summary}</p>}
      {runParams?.note && <p className="small"><strong>Progresjon:</strong> {runParams.note}</p>}
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
      {d.kind === 'strength' && s && <button className="btn primary big full" onClick={() => start({ kind: 'strength', day: s, volumeFactor: adj.volumeFactor })}><Icon name="play" /> Start styrkeøkta</button>}
      {d.run && d.kind !== 'rest' && (() => {
        const go = (skipWarmup = false) => start({ kind: 'run', run: d.run!, reps: runParams?.reps, minutes: runParams?.minutes, scale: adj.runScale, note: runParams?.note, skipWarmup })
        return (
          <>
            <button className="btn primary big full" onClick={() => go()}><Icon name="timer" /> {RUN_INFO[d.run!].hard ? 'Start intervalltimer' : 'Start løpetimer'}</button>
            {d.run !== 'easy' && (
              <div className="grid2">
                <button className="btn" onClick={() => go(true)}>⏭ Start uten oppvarming</button>
                <button className="btn" onClick={() => go()}>⚙︎ Tilpass tider før start</button>
              </div>
            )}
          </>
        )
      })()}
      {skipped && (
        <div className="adjust small stack-s">
          <span><Icon name="info" size={14} /> <strong>Du står over i dag:</strong> {SKIP_LABEL[skipped.reason].toLowerCase()}{skipped.note ? ` – ${skipped.note}` : ''}</span>
          <button className="link small" onClick={() => saveProfile({ ...profile, skips: (profile.skips ?? []).filter((x) => x !== skipped) }, false)}>Angre, jeg trener likevel</button>
        </div>
      )}
      {isToday && !skipped && d.kind !== 'rest' && !done.has(shown) && <SkipButton />}
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
export function RunTimer({ session, onClose }: { session: Extract<StartSession, { kind: 'run' }>; onClose: () => void }) {
  const run = session.run
  const { profile, logWorkout, saveProfile } = useApp()
  // PT-ens forslag (progresjon + dagsform), med brukerens egne tider lagt over
  const suggested = useMemo(() => setupFromSegments(runSegments(run, profile.sessionMinutes, { reps: session.reps, minutes: session.minutes }, session.scale ?? 1)), [run, profile.sessionMinutes, session])
  const saved = profile.runSetups?.[run]
  const [setup, setSetup] = useState<IntervalSetup>(() => { const s = mergeSetup(suggested, saved); return session.skipWarmup ? { ...s, warmupSec: 0 } : s })
  const segs = useMemo(() => segmentsFromSetup(run, setup), [run, setup])
  const [rpe, setRpe] = useState(7)
  const [avgHR, setAvgHR] = useState('')
  const [km, setKm] = useState('')
  const [note, setNote] = useState('')
  const doneRef = useRef<HTMLDivElement>(null)
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
  const finished = elapsed >= total
  const left = finished ? 0 : Math.max(0, Math.ceil(acc + seg.seconds - elapsed))

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
    if (!running && elapsed === 0) {
      // Husk egne tider (ikke antall drag, og ikke «har varmet opp» for én dag)
      const keep: Partial<IntervalSetup> = { workSec: setup.workSec, restSec: setup.restSec, cooldownSec: setup.cooldownSec, ...(setup.warmupSec > 0 ? { warmupSec: setup.warmupSec } : saved?.warmupSec ? { warmupSec: saved.warmupSec } : {}) }
      const same = (Object.keys(keep) as (keyof IntervalSetup)[]).every((k) => keep[k] === suggested[k])
      if (!same || saved) saveProfile({ ...profile, runSetups: { ...profile.runSetups, [run]: same ? undefined : keep } }, false)
    }
    if (running) { base.current = elapsed; setRunning(false); wake.current?.release().catch(() => undefined); return }
    startedAt.current = Date.now(); base.current = elapsed; setRunning(true)
    try { wake.current = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen') } catch { /* valgfritt */ }
  }
  useEffect(() => () => { wake.current?.release().catch(() => undefined) }, [])

  const [stopped, setStopped] = useState(false)
  const showLog = finished || stopped
  useEffect(() => { if (showLog) setTimeout(() => doneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300) }, [showLog])
  const save = async () => {
    const hardReps = segs.filter((x) => x.intensity === 'hard').length
    const tempoMin = Math.round((segs.find((x) => x.intensity === 'moderat')?.seconds ?? 0) / 60)
    await logWorkout([{ id: uid(), date: new Date().toISOString(), dayName: RUN_INFO[run].label, exerciseId: `run:${run}`, sets: [],
      note: note.trim() || undefined,
      run: { type: run, rpe, avgHR: avgHR ? +avgHR : undefined, km: km ? +km.replace(',', '.') : undefined, reps: (stopped ? hardDone : hardReps) || undefined, minutes: (stopped ? Math.round(elapsed / 60) : tempoMin) || undefined } }])
    onClose()
  }
  const hr = effectiveMaxHR(new Date().getFullYear() - profile.birthYear, profile.watch?.maxHR)
  const zone = (i: Segment['intensity']) => i === 'hard' ? `${Math.floor(hr * 0.85)}–${Math.floor(hr * 0.95)}` : i === 'moderat' ? `${Math.floor(hr * 0.8)}–${Math.floor(hr * 0.87)}` : `${Math.floor(hr * 0.6)}–${Math.floor(hr * 0.72)}`
  const hardDone = segs.slice(0, idx).filter((s) => s.intensity === 'hard').length
  // Hopp til neste del (f.eks. ferdig oppvarmet)
  const skip = () => {
    const to = acc + seg.seconds
    base.current = to; startedAt.current = Date.now(); setElapsed(to)
  }
  const notStarted = elapsed === 0 && !running
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
      {!showLog
        ? <>
            <button className="btn primary big full" onClick={toggle}>{running ? 'Pause' : elapsed > 0 ? 'Fortsett' : 'Start'}</button>
            {!notStarted && idx + 1 < segs.length && <button className="btn full" onClick={skip}>{seg.label === 'Oppvarming' ? 'Ferdig oppvarmet, start dragene ⏭' : `Hopp til neste: ${segs[idx + 1].label} ⏭`}</button>}
            {elapsed >= 60 && <button className="btn ghost full" onClick={() => { if (running) toggle(); setStopped(true) }}>Avslutt tidlig og logg økta</button>}
            {notStarted && <IntervalEditor run={run} setup={setup} suggested={suggested} onChange={setSetup} />}
          </>
        : (
          <div ref={doneRef}><Card>
            <h3>Hvordan gikk det?</h3>
            {stopped && !finished && <p className="muted small">Avsluttet etter {Math.round(elapsed / 60)} min og {hardDone} drag.</p>}
            <label className="field"><span>Hvor tungt føltes det? <strong>{rpe}/10</strong> {rpe <= 6 ? '(lett)' : rpe <= 8 ? '(passe hardt)' : '(maks)'}</span>
              <input id="rpe" type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(+e.target.value)} /></label>
            <div className="grid2">
              <label className="field"><span>Snittpuls (valgfritt)</span><input id="run-hr" type="number" inputMode="numeric" value={avgHR} onChange={(e) => setAvgHR(e.target.value)} /></label>
              <label className="field"><span>Km (valgfritt)</span><input id="run-km" type="text" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} /></label>
            </div>
            <label className="field"><span>Kommentar (valgfritt)</span>
              <textarea id="run-note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="F.eks. «Tredemølle 12 km/t i dragene, siste drag var tungt» eller «litt vondt i leggen»" /></label>
            <p className="muted small">Neste økt av samme type tilpasses etter hvor tungt det føltes og det du skriver her. Du kan endre alt senere under «Gjennomførte økter» på Hjem.</p>
            <button className="btn primary big full" onClick={save}>Lagre økta</button>
          </Card></div>
        )}
      <Card>
        <p className="small"><strong>Dagens økt:</strong> {hardTotal > 0 ? `${segs.filter((x) => x.intensity === 'hard').length} drag · ` : ''}{Math.round(total / 60)} min totalt{(session.scale ?? 1) < 1 ? ' (redusert etter dagsform/lett uke)' : ''}.</p>
        <p className="small muted">{RUN_INFO[run].summary}</p>
        <p className="small muted">{RUN_INFO[run].why}</p>
        {session.note && <p className="small"><strong>Progresjon:</strong> {session.note}</p>}
        <p className="small muted">Telefonen sier fra ved hvert skifte, så du kan ha den i lomma. Har du pulsklokke: harde drag 85–95 % av makspuls.</p>
        <p className="small muted">{WARNING_SIGNS}</p>
      </Card>
    </div>
  )
}
