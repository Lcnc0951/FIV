// Oppsett før løpeøkta: trykk på en del og rull med store tall.
import { useState } from 'react'
import { RUN_INFO, segmentsFromSetup, totalSeconds, type IntervalSetup, type RunType } from '../engine/week'
import { Icon, Sheet } from './kit'
import { DurationWheel, range, Wheel } from './Wheel'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
type Field = keyof IntervalSetup

export function IntervalEditor({ run, setup, suggested, onChange }: { run: RunType; setup: IntervalSetup; suggested: IntervalSetup; onChange: (s: IntervalSetup) => void }) {
  const [edit, setEdit] = useState<Field | null>(null)
  const [lastWarm, setLastWarm] = useState(setup.warmupSec || suggested.warmupSec || 600)
  const hard = RUN_INFO[run].hard
  const workLabel = run === 'tempo20' ? 'Terskel' : run === 'easy' ? 'Løp' : 'Hardt'
  const rows: { key: Field; label: string; value: string; show: boolean; tone?: string }[] = [
    { key: 'warmupSec', label: 'Oppvarming', value: setup.warmupSec ? mmss(setup.warmupSec) : 'Hoppes over', show: true, tone: 'rolig' },
    { key: 'reps', label: 'Antall drag', value: `${setup.reps}`, show: hard },
    { key: 'workSec', label: workLabel, value: mmss(setup.workSec), show: true, tone: hard ? 'hard' : run === 'tempo20' ? 'moderat' : 'rolig' },
    { key: 'restSec', label: setup.restSec < 60 ? 'Pause' : 'Rolig jogg', value: setup.restSec ? mmss(setup.restSec) : 'Ingen', show: hard && setup.reps > 1, tone: 'pause' },
    { key: 'cooldownSec', label: 'Nedjogg', value: setup.cooldownSec ? mmss(setup.cooldownSec) : 'Ingen', show: true, tone: 'rolig' },
  ]
  const warmed = setup.warmupSec === 0
  const toggleWarm = () => {
    if (warmed) onChange({ ...setup, warmupSec: lastWarm })
    else { setLastWarm(setup.warmupSec); onChange({ ...setup, warmupSec: 0 }) }
  }
  const total = totalSeconds(segmentsFromSetup(run, setup))
  const changed = JSON.stringify(setup) !== JSON.stringify(suggested)
  const set = (k: Field, v: number) => onChange({ ...setup, [k]: v })
  const title = rows.find((r) => r.key === edit)?.label ?? ''

  return (
    <div className="interval-editor">
      <div className="row between wrap gap-s">
        <h3>Tilpass økta</h3>
        <span className="muted small num">Totalt {Math.round(total / 60)} min</span>
      </div>
      <button className={`warm-toggle${warmed ? ' on' : ''}`} onClick={toggleWarm} aria-pressed={warmed}>
        <Icon name={warmed ? 'check' : 'timer'} size={18} /> {warmed ? 'Har varmet opp: starter rett på dragene' : 'Jeg har varmet opp, start rett på dragene'}
      </button>
      <div className="iv-rows">
        {rows.filter((r) => r.show).map((r) => (
          <button key={r.key} className={`iv-row t-${r.tone ?? 'plain'}`} onClick={() => setEdit(r.key)}>
            <span className="iv-label">{r.label}</span>
            <span className="iv-value num">{r.value}</span>
          </button>
        ))}
      </div>
      <p className="muted small">Trykk på en del for å endre. Tidene huskes til neste gang, antall drag styres av progresjonen.</p>
      {changed && <button className="link small" onClick={() => onChange(suggested)}>Tilbake til PT-ens forslag</button>}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={title}>
        {edit && (
          <div className="stack">
            {edit === 'reps'
              ? <div className="wheels"><Wheel label="Antall drag" values={range(1, 30)} value={setup.reps} onChange={(v) => set('reps', v)} unit="drag" /></div>
              : <DurationWheel label={title} seconds={setup[edit]} onChange={(v) => set(edit, v)} maxMin={edit === 'workSec' ? 60 : 30} secStep={5} />}
            {edit === 'workSec' && hard && (
              <div className="chips center-chips">
                {[[240, '4 min'], [180, '3 min'], [120, '2 min'], [60, '1 min'], [45, '45 sek'], [30, '30 sek']].map(([v, l]) => (
                  <button key={v} className={setup.workSec === v ? 'on' : ''} onClick={() => set('workSec', v as number)}>{l}</button>
                ))}
              </div>
            )}
            {edit === 'restSec' && (
              <div className="chips center-chips">
                {[[180, '3 min'], [120, '2 min'], [90, '1:30'], [60, '1 min'], [30, '30 sek'], [20, '20 sek'], [15, '15 sek']].map(([v, l]) => (
                  <button key={v} className={setup.restSec === v ? 'on' : ''} onClick={() => set('restSec', v as number)}>{l}</button>
                ))}
              </div>
            )}
            <button className="btn primary big full" onClick={() => setEdit(null)}>Ferdig</button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
