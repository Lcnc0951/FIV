import { useState } from 'react'
import { totalSets, type Prescription, type WorkoutDay } from '../engine/generator'
import { alternatives, equipmentText, exercise, isCompound } from '../engine/library'
import { MUSCLE_LABEL, MUSCLES, type Exercise } from '../engine/types'
import { DrillRow } from './Body'
import { WeekEditor } from './Week'
import { CycleBanner } from './Daily'
import { Bar, Card, Icon, Sheet, Tag } from './kit'
import { animationFor, StickFigure } from './StickFigure'
import { activeLocation, useApp } from './state'

export const restText = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function Program({ startWorkout }: { startWorkout: (d: WorkoutDay) => void }) {
  const { profile, program, saveProfile, regenerate } = useApp()
  const [day, setDay] = useState<string | null>(null)
  const loc = activeLocation(profile)
  const current = program?.days.find((d) => d.id === day)
  if (current && program) return <DayView day={current} warmup={program.warmup} onBack={() => setDay(null)} startWorkout={startWorkout} />
  return (
    <div className="stack">
      <header className="page-head row between"><h1>Program</h1><button className="btn ghost" onClick={() => regenerate(loc.id)}>Bytt øvelser</button></header>
      {profile.locations.length > 1 && (
        <div className="segmented wrap" role="radiogroup" aria-label="Treningssted">
          {profile.locations.map((l) => (
            <button key={l.id} role="radio" aria-checked={l.id === loc.id} className={l.id === loc.id ? 'on' : ''}
              onClick={() => saveProfile({ ...profile, activeLocationId: l.id }, false)}>{l.name}</button>
          ))}
        </div>
      )}
      <CycleBanner />
      <WeekEditor />
      {!program ? (
        <Card><p>Ingen program for {loc.name} ennå.</p><button className="btn primary" onClick={() => regenerate(loc.id)}>Lag program</button></Card>
      ) : (
        <>
          <Card><h2>{program.title}</h2><p className="muted small">{program.summary}</p></Card>
          <div className="stack-s">
            {program.days.map((d) => (
              <Card key={d.id} onClick={() => setDay(d.id)}>
                <div className="row between"><div><h3>{d.name}</h3><p className="muted small">{d.focus} · {d.exercises.length} øvelser · {totalSets(d)} sett</p></div><Icon name="chevron" /></div>
              </Card>
            ))}
          </div>
          {program.postureRoutine.length > 0 && (
            <Card><h3>Holdningsrutine · ca. 10 min</h3><p className="muted small">Som oppvarming før hver økt, eller daglig hjemme.</p>
              <div className="stack-s">{program.postureRoutine.map((d) => <DrillRow key={d.id} d={d} />)}</div></Card>
          )}
          <Card>
            <h3>Ukentlig volum (harde sett)</h3>
            <div className="stack-s">
              {MUSCLES.map((m) => {
                const done = program.weeklySets[m] ?? 0, target = program.targetSets[m] ?? 0
                return (
                  <div key={m} className="volume-row">
                    <div className="row between small"><span>{MUSCLE_LABEL[m]}</span><span className="num muted">{done.toFixed(1).replace('.', ',')} / {target}</span></div>
                    <Bar value={done} max={Math.max(target, 1) * 1.3} tone={done >= target * 0.9 ? 'good' : 'warn'} />
                  </div>
                )
              })}
            </div>
          </Card>
          <Card>
            <h3>Periodisering</h3>
            <table className="table"><tbody>{program.mesocycle.map((w) => <tr key={w.number}><th>Uke {w.number}</th><td className="num">RIR {w.rir}</td><td className="muted small">{w.note}</td></tr>)}</tbody></table>
          </Card>
          <Card>
            <h3>Kondisjon</h3>
            <p className="small">Sone 2: {program.cardio.zone2Sessions} × {program.cardio.zone2Minutes} min, puls {program.cardio.zone2HR[0]}–{program.cardio.zone2HR[1]}</p>
            {program.cardio.intervalSessions > 0 && <p className="small">{program.cardio.intervalDescription} Puls {program.cardio.intervalHR[0]}–{program.cardio.intervalHR[1]}.</p>}
            <p className="small">Skritt: {program.cardio.dailySteps.toLocaleString('nb-NO')} per dag</p>
          </Card>
          <Card><h3>PT-notater</h3><ul className="small">{program.focusNotes.map((n) => <li key={n}>{n}</li>)}</ul></Card>
        </>
      )}
    </div>
  )
}

function DayView({ day, warmup, onBack, startWorkout }: { day: WorkoutDay; warmup: string[]; onBack: () => void; startWorkout: (d: WorkoutDay) => void }) {
  const [open, setOpen] = useState<Prescription | null>(null)
  return (
    <div className="stack">
      <header className="page-head"><button className="btn ghost" onClick={onBack}><Icon name="back" /> Program</button><h1>{day.name}</h1><p className="muted">{day.focus}</p></header>
      <Card><h3>Oppvarming</h3><ul className="small">{warmup.map((w) => <li key={w}>{w}</li>)}</ul></Card>
      <div className="stack-s">
        {day.exercises.map((p) => <ExerciseRow key={p.id} p={p} onClick={() => setOpen(p)} />)}
      </div>
      <button className="btn primary big full" onClick={() => startWorkout(day)}><Icon name="play" /> Start økta</button>
      <ExerciseSheet p={open} onClose={() => setOpen(null)} />
    </div>
  )
}

export function ExerciseRow({ p, onClick }: { p: Prescription; onClick: () => void }) {
  const e = exercise(p.exerciseId)
  if (!e) return null
  const anim = animationFor(e.id)
  return (
    <Card onClick={onClick} className="exercise-row">
      <div className="thumb">{anim && <StickFigure anim={anim} highlight={e.primary} showPhase={false} size={72} />}</div>
      <div className="grow">
        <div className="row gap-s wrap"><strong>{e.name}</strong>{e.unilateral && <Tag>ettsidig</Tag>}</div>
        <div className="num small">{p.sets} × {p.repsMin}–{p.repsMax} · RIR {p.rir} · pause {restText(p.restSeconds)}</div>
        {p.note && <div className="accent small">{p.note}</div>}
      </div>
    </Card>
  )
}

export function ExerciseSheet({ p, onClose, allowSwap = true }: { p: Prescription | null; onClose: () => void; allowSwap?: boolean }) {
  const { profile, swap } = useApp()
  const e = p ? exercise(p.exerciseId) : undefined
  return (
    <Sheet open={!!e} onClose={onClose} title={e?.name ?? ''}>
      {e && p && <ExerciseDetail e={e} p={p} alts={allowSwap ? alternatives(e, activeLocation(profile), profile.limitations).slice(0, 6) : []}
        onSwap={(alt) => { swap(p.id, alt.id); onClose() }} />}
    </Sheet>
  )
}

function ExerciseDetail({ e, p, alts, onSwap }: { e: Exercise; p: Prescription; alts: Exercise[]; onSwap: (e: Exercise) => void }) {
  const anim = animationFor(e.id)
  const [preview, setPreview] = useState<Exercise | null>(null)
  const shown = preview ?? e
  const shownAnim = preview ? animationFor(preview.id) : anim
  return (
    <div className="stack">
      <div className="media">{shownAnim ? <StickFigure key={shown.id} anim={shownAnim} highlight={shown.primary} size={240} /> : <Icon name="dumbbell" size={60} />}</div>
      {preview && <p className="muted small center">Viser {preview.name} · <button className="link" onClick={() => setPreview(null)}>tilbake til {e.name}</button></p>}
      <div className="row gap-s wrap">
        {e.unilateral && <Tag>ettsidig</Tag>}{e.lengthenedBias && <Tag>strekk-fokus</Tag>}<Tag tone="plain">{isCompound(e) ? 'basisøvelse' : 'isolasjon'}</Tag>
      </div>
      <p className="muted small"><Icon name="dumbbell" size={14} /> {equipmentText(e)}</p>
      <div className="metrics four">
        <div className="metric"><div className="metric-value">{p.sets}</div><div className="metric-label">Sett</div></div>
        <div className="metric"><div className="metric-value">{p.repsMin}–{p.repsMax}</div><div className="metric-label">Reps</div></div>
        <div className="metric"><div className="metric-value">{p.rir}</div><div className="metric-label">RIR</div></div>
        <div className="metric"><div className="metric-value">{restText(p.restSeconds)}</div><div className="metric-label">Pause</div></div>
      </div>
      <div>
        <h3>Muskler</h3>
        <div className="row gap-s wrap"><Tag>{MUSCLE_LABEL[e.primary]}</Tag>{e.secondary.map((m) => <Tag key={m} tone="plain">{MUSCLE_LABEL[m]}</Tag>)}</div>
      </div>
      <div><h3>Slik gjør du det</h3><p>{e.cue}</p>{p.note && <p className="accent small strong">{p.note}</p>}
        <p className="muted small">RIR = reps i reserve: hvor mange reps du kunne tatt til. Siste sett skal være tungt.</p></div>
      {alts.length > 0 && (
        <div>
          <h3>Bytt øvelse</h3>
          <p className="muted small">Apparatet opptatt eller passer ikke? Disse trener det samme med utstyret ditt.</p>
          <div className="list">
            {alts.map((a) => (
              <div key={a.id} className="list-row">
                <button className="link-row" onClick={() => setPreview(a)}><strong>{a.name}</strong><span className="muted small">{MUSCLE_LABEL[a.primary]} · {equipmentText(a)}</span></button>
                <button className="btn small" onClick={() => onSwap(a)}>Bytt</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
