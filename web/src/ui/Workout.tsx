import { useEffect, useState } from 'react'
import { suggest } from '../engine/coach'
import type { Prescription, WorkoutDay } from '../engine/generator'
import { exercise } from '../engine/library'
import { estimateMinutes, supersets } from '../engine/extras'
import { uid, type SetLog } from '../engine/types'
import { Card, Icon, nb, speak, Tag } from './kit'
import { ExerciseSheet } from './Program'
import { activeLocation, useApp } from './state'
import { quote, readNote } from '../engine/notes'
import { AREA_TEXT } from '../engine/pain'

export function Workout({ day: original, volumeFactor = 1, onClose }: { day: WorkoutDay; volumeFactor?: number; onClose: () => void }) {
  // Lett uke / dårlig dagsform: færre sett
  const day: WorkoutDay = volumeFactor >= 1 ? original : { ...original, exercises: original.exercises.map((p) => ({ ...p, sets: Math.max(1, Math.round(p.sets * volumeFactor)), rir: p.rir + (volumeFactor <= 0.5 ? 1 : 0) })) }
  const { data, profile, logWorkout, pain, setTempLimitation } = useApp()
  const [note, setNote] = useState('')
  // Stoppeklokke: brukeren trykker selv start og stopp
  const [clock, setClock] = useState<{ base: number; startedAt: number | null }>({ base: 0, startedAt: null })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!clock.startedAt) return
    const t = setInterval(() => setTick(Date.now()), 500)
    return () => clearInterval(t)
  }, [clock.startedAt])
  void tick
  const elapsedMs = clock.base + (clock.startedAt ? Date.now() - clock.startedAt : 0)
  const toggleClock = () => setClock((c) => (c.startedAt ? { base: c.base + Date.now() - c.startedAt, startedAt: null } : { ...c, startedAt: Date.now() }))
  const clockText = (ms: number) => { const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}` }
  // Kommentaren fra forrige gang samme økt ble gjort
  const prev = [...data.workouts].filter((w) => !w.run && w.dayName === original.name && w.note).sort((a, b) => b.date.localeCompare(a.date))[0]
  const lastNote = readNote(prev?.note)
  const [logs, setLogs] = useState<Record<string, SetLog[]>>({})
  const [restUntil, setRestUntil] = useState<number | null>(null)
  const [restLabel, setRestLabel] = useState('Pause')
  const groups = supersets(day, profile.sessionMinutes)
  const savedMin = Math.max(0, estimateMinutes(day.exercises.map((x) => ({ label: '', items: [x], restSeconds: x.restSeconds }))) - estimateMinutes(groups))
  const groupOf = (id: string) => groups.find((g) => g.items.some((x) => x.id === id))!
  const [now, setNow] = useState(Date.now())
  const [info, setInfo] = useState<Prescription | null>(null)
  const dumbbells = activeLocation(profile).equipment.includes('dumbbells') ? activeLocation(profile).dumbbellWeights : []

  useEffect(() => {
    if (!restUntil) return
    const t = setInterval(() => {
      setNow(Date.now())
      if (Date.now() >= restUntil) { setRestUntil(null); speak('Pausen er over. Neste sett.'); navigator.vibrate?.(300) }
    }, 250)
    return () => clearInterval(t)
  }, [restUntil])

  const last = (exerciseId: string) => [...data.workouts].filter((w) => w.exerciseId === exerciseId).sort((a, b) => b.date.localeCompare(a.date))[0]?.sets ?? []

  const add = (p: Prescription, s: SetLog) => {
    const list = logs[p.id] ?? []
    const count = list.length + 1
    setLogs({ ...logs, [p.id]: [...list, s] })
    const g = groupOf(p.id)
    const partner = g.items.find((x) => x.id !== p.id)
    if (partner && (logs[partner.id]?.length ?? 0) < Math.min(count, partner.sets)) {
      // Supersett: rett over til den andre øvelsen
      setRestLabel(`Bytt til ${exercise(partner.exerciseId)?.name ?? 'neste øvelse'}`)
      setRestUntil(Date.now() + 20_000)
    } else if (count < Math.max(...g.items.map((x) => x.sets))) {
      setRestLabel(partner ? 'Pause etter begge' : 'Pause')
      setRestUntil(Date.now() + g.restSeconds * 1000)
    }
  }
  const update = (p: Prescription, i: number, s: SetLog) => setLogs({ ...logs, [p.id]: (logs[p.id] ?? []).map((x, k) => (k === i ? s : x)) })
  const remove = (p: Prescription, i: number) => setLogs({ ...logs, [p.id]: (logs[p.id] ?? []).filter((_, k) => k !== i) })

  const finish = async () => {
    const date = new Date().toISOString()
    await logWorkout(day.exercises.flatMap((p) => {
      const sets = (logs[p.id] ?? []).filter((s) => s.reps > 0)
      return sets.length ? [{ id: uid(), date, dayName: day.name, exerciseId: p.exerciseId, sets, note: note.trim() || undefined, durationMin: elapsedMs >= 60_000 ? Math.round(elapsedMs / 60_000) : undefined }] : []
    }))
    speak('Bra jobba! Økta er lagret.')
    onClose()
  }
  const anyLogged = Object.values(logs).some((l) => l.length)
  const left = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0

  return (
    <div className="stack">
      <header className="page-head row between">
        <button className="btn ghost" onClick={onClose}><Icon name="back" /> Avslutt</button>
        <h1 className="h2">{day.name}</h1>
      </header>
      <div className={`stopwatch${clock.startedAt ? ' on' : ''}`}>
        <div><span className="muted small">Økttid</span><div className="stopwatch-time num">{clockText(elapsedMs)}</div></div>
        <button className={`btn ${clock.startedAt ? '' : 'primary'}`} onClick={toggleClock}>{clock.startedAt ? 'Stopp' : elapsedMs > 0 ? 'Fortsett' : 'Start'}</button>
      </div>
      {lastNote && (
        <div className="adjust small stack-s">
          <span><Icon name="info" size={14} /> <strong>Notat fra sist:</strong> {quote(lastNote.text)}</span>
          <span className="muted">{lastNote.signal === 'pain' ? 'Vektene holdes som sist i dag.' : lastNote.signal === 'tooHard' ? 'Vektene holdes som sist i dag, ingen økning.' : lastNote.signal === 'tooEasy' ? 'Føltes lett: gå gjerne opp i vekt der du når toppen av rep-spennet.' : 'Ta hensyn til dette i dag.'}</span>
          {lastNote.signal === 'pain' && lastNote.area && !pain.areas.includes(lastNote.area) && (
            <button className="btn small" onClick={() => setTempLimitation(lastNote.area!, 7)}>Tilpass programmet for {AREA_TEXT[lastNote.area]} i 7 dager</button>
          )}
        </div>
      )}
      {volumeFactor < 1 && <p className="adjust small"><Icon name="info" size={14} /> Lettere økt i dag: {Math.round(volumeFactor * 100)} % av settene.</p>}
      {restUntil && (
        <div className="rest-bar" role="timer" aria-live="polite">
          <Icon name="timer" /> {restLabel === 'Pause' ? 'Pause før neste sett' : restLabel} <strong className="num">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</strong>
          <button className="btn small" onClick={() => setRestUntil(null)}>Hopp over</button>
        </div>
      )}
      {groups.length < day.exercises.length && (
        <p className="adjust small"><Icon name="info" size={14} /> Supersett: ta ett sett av hver øvelse i paret, så pause. Sparer ca. {savedMin} min.</p>
      )}
      {groups.map((g) => (
      <div key={g.label} className={g.items.length > 1 ? 'superset' : 'stack'}>
      {g.items.length > 1 && <div className="superset-head"><strong>Supersett {g.label}</strong><span className="muted small">veksle mellom øvelsene · {Math.round(g.restSeconds / 15) * 15} sek pause etter begge</span></div>}
      {g.items.map((p) => {
        const e = exercise(p.exerciseId)
        if (!e) return null
        const sug = suggest(p, last(e.id), dumbbells)
        const top = Math.max(0, ...last(e.id).map((x) => x.weightKg))
        if (lastNote?.signal && lastNote.signal !== 'tooEasy' && sug.weightKg && sug.weightKg > top && top > 0) {
          // Notatet sa at forrige økt var tung eller gjorde vondt: ikke øk vekten i dag
          sug.weightKg = top; sug.targetReps = Math.min(sug.targetReps, p.repsMax)
          sug.message = lastNote.signal === 'pain' ? 'Samme vekt som sist på grunn av notatet ditt. Stopp hvis smerten går over 3/10.' : 'Samme vekt som sist, siden forrige økt føltes tung. Sikt på bedre kvalitet.'
        }
        const sets = logs[p.id] ?? []
        const template: SetLog = sets[sets.length - 1] ?? { weightKg: sug.weightKg ?? 0, reps: sug.targetReps, rir: p.rir }
        return (
          <Card key={p.id}>
            <div className="row between">
              <div><div className="row gap-s wrap"><h3>{e.name}</h3>{e.unilateral && <Tag>ettsidig</Tag>}</div>
                <p className="small num">Mål: {p.sets} × {p.repsMin}–{p.repsMax} · RIR {p.rir}</p></div>
              <button className="icon-btn" onClick={() => setInfo(p)} aria-label={`Vis ${e.name}`}><Icon name="play" /></button>
            </div>
            {sug.weightKg ? <p className="accent strong">Forslag: {nb(sug.weightKg)} kg × {sug.targetReps}</p> : null}
            <p className="muted small">{sug.message}</p>
            {p.note && <p className="small strong">{p.note}</p>}
            <div className="sets">
              {sets.map((s, i) => (
                <div key={i} className="set-row">
                  <span className="set-no">{i + 1}</span>
                  <label><span className="sr">Vekt</span><input id={`w-${p.id}-${i}`} type="number" inputMode="decimal" step={0.5} value={s.weightKg} onChange={(ev) => update(p, i, { ...s, weightKg: +ev.target.value })} /> kg</label>
                  <label><span className="sr">Reps</span><input id={`r-${p.id}-${i}`} type="number" inputMode="numeric" value={s.reps} onChange={(ev) => update(p, i, { ...s, reps: +ev.target.value })} /> reps</label>
                  <select aria-label="Reps i reserve" value={s.rir ?? 2} onChange={(ev) => update(p, i, { ...s, rir: +ev.target.value })}>
                    {[0, 1, 2, 3, 4, 5].map((r) => <option key={r} value={r}>RIR {r}</option>)}
                  </select>
                  <button className="icon-btn" aria-label="Fjern sett" onClick={() => remove(p, i)}>×</button>
                </div>
              ))}
            </div>
            <button className="btn full" onClick={() => add(p, { ...template })}><Icon name="plus" /> {sets.length ? 'Samme som forrige sett' : 'Logg første sett'}</button>
          </Card>
        )
      })}
      </div>
      ))}
      <Card>
        <label className="field"><span>Kommentar til økta (valgfritt)</span>
          <textarea id="workout-note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="F.eks. «Benken føltes lett» eller «vondt i skulderen på skulderpress»" /></label>
        <p className="muted small">Brukes når neste økt lages, og PT-en ser den.</p>
      </Card>
      <button className="btn primary big full" disabled={!anyLogged} onClick={finish}>Fullfør økta</button>
      <ExerciseSheet p={info} onClose={() => setInfo(null)} allowSwap={false} />
    </div>
  )
}
