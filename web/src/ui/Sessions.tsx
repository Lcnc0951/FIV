// Gjennomførte økter: se, endre og slette. Løpeparametre og kommentar kan fylles inn i etterkant.
import { useState } from 'react'
import { exercise } from '../engine/library'
import { readNote } from '../engine/notes'
import type { SetLog, WorkoutEntry } from '../engine/types'
import { RUN_INFO } from '../engine/week'
import { Card, Icon, nb, Sheet } from './kit'
import { useApp } from './state'

export interface Session { key: string; date: string; title: string; entries: WorkoutEntry[]; run?: WorkoutEntry['run']; note?: string }

/** Styrkeøkter lagres som én oppføring per øvelse med samme tidspunkt og navn. */
export function groupSessions(workouts: WorkoutEntry[]): Session[] {
  const map = new Map<string, Session>()
  for (const w of workouts) {
    const key = w.run ? w.id : `${w.date}|${w.dayName}`
    const s = map.get(key) ?? { key, date: w.date, title: w.run ? RUN_INFO[w.run.type].label : w.dayName, entries: [], run: w.run, note: w.note }
    s.entries.push(w); s.note ??= w.note
    map.set(key, s)
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
}

const when = (iso: string) => new Date(iso).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })

function summary(s: Session): string {
  if (s.run) {
    const r = s.run
    return [r.reps && r.type !== 'tempo20' ? `${r.reps} drag` : '', r.minutes ? `${r.minutes} min` : '', r.km ? `${nb(r.km)} km` : '', r.avgHR ? `puls ${r.avgHR}` : '', `føltes ${r.rpe}/10`].filter(Boolean).join(' · ')
  }
  const sets = s.entries.reduce((n, e) => n + e.sets.length, 0)
  const min = s.entries[0]?.durationMin
  return `${s.entries.length} øvelser · ${sets} sett${min ? ` · ${min} min` : ''}`
}

export function SessionsCard() {
  const { data } = useApp()
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState<Session | null>(null)
  const sessions = groupSessions(data.workouts)
  if (!sessions.length) return null
  const shown = all ? sessions.slice(0, 30) : sessions.slice(0, 4)
  return (
    <Card>
      <h3>Gjennomførte økter</h3>
      <div className="list">
        {shown.map((s) => {
          const missing = s.run && !s.run.avgHR && !s.run.km && !s.note
          return (
            <button key={s.key} className="link-row session-row" onClick={() => setOpen(s)}>
              <span className="grow">
                <strong>{s.title}</strong> <span className="muted small">{when(s.date)}</span><br />
                <span className="small muted">{summary(s)}</span>
                {s.note && <><br /><span className="small">💬 {s.note}</span></>}
                {missing && <><br /><span className="small accent">Legg til puls, km eller kommentar</span></>}
              </span>
              <Icon name="chevron" />
            </button>
          )
        })}
      </div>
      {sessions.length > 4 && <button className="btn ghost small" onClick={() => setAll(!all)}>{all ? 'Vis færre' : `Vis alle (${sessions.length})`}</button>}
      <SessionEditor session={open} onClose={() => setOpen(null)} />
    </Card>
  )
}

const num = (v: string) => (v.trim() ? +v.replace(',', '.') : undefined)
const str = (v?: number) => (v == null ? '' : String(v).replace('.', ','))

export function SessionEditor({ session, onClose }: { session: Session | null; onClose: () => void }) {
  return (
    <Sheet open={!!session} onClose={onClose} title={session ? `${session.title} · ${when(session.date)}` : ''}>
      {session && <EditorBody key={session.key} s={session} onClose={onClose} />}
    </Sheet>
  )
}

function EditorBody({ s, onClose }: { s: Session; onClose: () => void }) {
  const { editSession } = useApp()
  const r = s.run
  const [rpe, setRpe] = useState(r?.rpe ?? 7)
  const [avgHR, setAvgHR] = useState(str(r?.avgHR))
  const [km, setKm] = useState(str(r?.km))
  const [reps, setReps] = useState(str(r?.reps))
  const [minutes, setMinutes] = useState(str(r?.minutes))
  const [date, setDate] = useState(s.date.slice(0, 10))
  const [duration, setDuration] = useState(str(s.entries[0]?.durationMin))
  const [note, setNote] = useState(s.note ?? '')
  const [sets, setSets] = useState<Record<string, SetLog[]>>(() => Object.fromEntries(s.entries.map((e) => [e.id, e.sets.map((x) => ({ ...x }))])))
  const [confirm, setConfirm] = useState(false)
  const reading = readNote(note)

  const newDate = () => {
    if (date === s.date.slice(0, 10)) return s.date
    const t = new Date(s.date); const [y, m, d] = date.split('-').map(Number); t.setFullYear(y, m - 1, d); return t.toISOString()
  }
  const save = async () => {
    const d = newDate()
    const text = note.trim() || undefined
    const entries: WorkoutEntry[] = s.entries.map((e) => (e.run
      ? { ...e, date: d, note: text, run: { ...e.run, rpe, avgHR: num(avgHR), km: num(km), reps: num(reps), minutes: num(minutes) } }
      : { ...e, date: d, note: text, durationMin: num(duration), sets: (sets[e.id] ?? []).filter((x) => x.reps > 0) }))
      .filter((e) => e.run || e.sets.length)
    await editSession(s.entries.map((e) => e.id), entries)
    onClose()
  }
  const remove = async () => { await editSession(s.entries.map((e) => e.id), []); onClose() }
  const setSet = (id: string, i: number, v: SetLog) => setSets({ ...sets, [id]: sets[id].map((x, k) => (k === i ? v : x)) })

  return (
    <div className="stack">
      {r ? (
        <>
          <label className="field"><span>Hvor tungt føltes det? <strong>{rpe}/10</strong></span>
            <input id="edit-rpe" type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(+e.target.value)} /></label>
          <div className="grid2">
            <label className="field"><span>Snittpuls</span><input id="edit-hr" className="input" type="text" inputMode="numeric" value={avgHR} onChange={(e) => setAvgHR(e.target.value)} /></label>
            <label className="field"><span>Km</span><input id="edit-km" className="input" type="text" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} /></label>
            {r.type !== 'tempo20' && r.type !== 'easy' && <label className="field"><span>Antall drag</span><input id="edit-reps" className="input" type="text" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} /></label>}
            <label className="field"><span>{r.type === 'tempo20' ? 'Minutter i terskelfart' : 'Minutter'}</span><input id="edit-min" className="input" type="text" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
          </div>
        </>
      ) : (
        s.entries.map((e) => (
          <div key={e.id} className="stack-s">
            <strong>{exercise(e.exerciseId)?.name ?? e.exerciseId}</strong>
            {(sets[e.id] ?? []).map((x, i) => (
              <div key={i} className="set-row">
                <span className="set-no">{i + 1}</span>
                <label><span className="sr">Vekt</span><input type="number" inputMode="decimal" step={0.5} value={x.weightKg} onChange={(ev) => setSet(e.id, i, { ...x, weightKg: +ev.target.value })} /> kg</label>
                <label><span className="sr">Reps</span><input type="number" inputMode="numeric" value={x.reps} onChange={(ev) => setSet(e.id, i, { ...x, reps: +ev.target.value })} /> reps</label>
                <button className="icon-btn" aria-label="Fjern sett" onClick={() => setSets({ ...sets, [e.id]: sets[e.id].filter((_, k) => k !== i) })}>×</button>
              </div>
            ))}
            <button className="btn small" onClick={() => setSets({ ...sets, [e.id]: [...(sets[e.id] ?? []), { ...(sets[e.id]?.at(-1) ?? { weightKg: 0, reps: 8, rir: 2 }) }] })}><Icon name="plus" size={14} /> Sett</button>
          </div>
        ))
      )}
      {!r && <label className="field"><span>Varighet (minutter)</span><input id="edit-duration" className="input" type="text" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} /></label>}
      <label className="field"><span>Dato</span><input id="edit-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label className="field"><span>Kommentar</span>
        <textarea id="edit-note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={r ? 'F.eks. «Tredemølle 12 km/t, 1 % stigning. Siste drag tungt.»' : 'F.eks. «Benken føltes lett, skulderen grei»'} /></label>
      {reading?.signal && (
        <p className="adjust small"><Icon name="info" size={14} /> {reading.signal === 'pain' ? 'Neste økt holder igjen, og PT-en tar hensyn til smerten.' : reading.signal === 'tooHard' ? 'Neste økt øker ikke belastningen.' : 'Neste økt kan øke litt.'}</p>
      )}
      <button className="btn primary big full" onClick={save}>Lagre endringer</button>
      {!confirm ? <button className="btn ghost full" onClick={() => setConfirm(true)}>Slett økta</button>
        : <button className="btn full bad" onClick={remove}>Bekreft: slett økta for godt</button>}
    </div>
  )
}
