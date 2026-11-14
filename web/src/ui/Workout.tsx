import { useEffect, useState } from 'react'
import { suggest } from '../engine/coach'
import type { Prescription, WorkoutDay } from '../engine/generator'
import { exercise } from '../engine/library'
import { uid, type SetLog } from '../engine/types'
import { Card, Icon, nb, speak, Tag } from './kit'
import { ExerciseSheet } from './Program'
import { activeLocation, useApp } from './state'

export function Workout({ day: original, volumeFactor = 1, onClose }: { day: WorkoutDay; volumeFactor?: number; onClose: () => void }) {
  // Lett uke / dårlig dagsform: færre sett
  const day: WorkoutDay = volumeFactor >= 1 ? original : { ...original, exercises: original.exercises.map((p) => ({ ...p, sets: Math.max(1, Math.round(p.sets * volumeFactor)), rir: p.rir + (volumeFactor <= 0.5 ? 1 : 0) })) }
  const { data, profile, logWorkout } = useApp()
  const [logs, setLogs] = useState<Record<string, SetLog[]>>({})
  const [restUntil, setRestUntil] = useState<number | null>(null)
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
    setLogs({ ...logs, [p.id]: [...list, s] })
    if (list.length + 1 < p.sets) setRestUntil(Date.now() + p.restSeconds * 1000)
  }
  const update = (p: Prescription, i: number, s: SetLog) => setLogs({ ...logs, [p.id]: (logs[p.id] ?? []).map((x, k) => (k === i ? s : x)) })
  const remove = (p: Prescription, i: number) => setLogs({ ...logs, [p.id]: (logs[p.id] ?? []).filter((_, k) => k !== i) })

  const finish = async () => {
    const date = new Date().toISOString()
    await logWorkout(day.exercises.flatMap((p) => {
      const sets = (logs[p.id] ?? []).filter((s) => s.reps > 0)
      return sets.length ? [{ id: uid(), date, dayName: day.name, exerciseId: p.exerciseId, sets }] : []
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
      {volumeFactor < 1 && <p className="adjust small"><Icon name="info" size={14} /> Lettere økt i dag: {Math.round(volumeFactor * 100)} % av settene.</p>}
      {restUntil && (
        <div className="rest-bar" role="timer" aria-live="polite">
          <Icon name="timer" /> Pause <strong className="num">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</strong>
          <button className="btn small" onClick={() => setRestUntil(null)}>Hopp over</button>
        </div>
      )}
      {day.exercises.map((p) => {
        const e = exercise(p.exerciseId)
        if (!e) return null
        const sug = suggest(p, last(e.id), dumbbells)
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
      <button className="btn primary big full" disabled={!anyLogged} onClick={finish}>Fullfør økta</button>
      <ExerciseSheet p={info} onClose={() => setInfo(null)} allowSwap={false} />
    </div>
  )
}
