import { useState } from 'react'
import { PRESET_LABEL, PRESETS, type PresetKey } from '../engine/presets'
import { minutesBetween, RUN_INFO, type RunType } from '../engine/week'
import {
  EXPERIENCE_LABEL, GOAL_INFO, LIMITATION_LABEL, PHYSIQUE_INFO, POSTURE_GOAL_LABEL,
  type Experience, type Goal, type Limitation, type PhysiqueGoal, type PostureGoal, type Profile,
} from '../engine/types'

export const defaultProfile = (): Profile => {
  const gym = PRESETS.gym()
  return {
    name: '', sex: 'male', birthYear: 1990, heightCm: 180, weightKg: 80, goal: 'buildMuscle', experience: 'beginner',
    daysPerWeek: 3, sessionMinutes: 40, limitations: [], physique: 'balanced', postureGoals: [], targetBodyFat: 0,
    locations: [gym], activeLocationId: gym.id, scanMethod: 'camera',
    trainingStart: '06:10', trainingEnd: '06:50', runsPerWeek: 2,
    runTypes: ['intervals4x4', 'short45_20', 'tempo20'], weekendTraining: true, weekOverrides: {},
  }
}

function toggle<T>(list: T[], v: T, on: boolean): T[] { return on ? [...new Set([...list, v])] : list.filter((x) => x !== v) }

export type Section = 'body' | 'goal' | 'training' | 'all'

export function ProfileForm({ value, onChange, section = 'all', presets, onPresets }: {
  value: Profile; onChange: (p: Profile) => void; section?: Section
  presets?: PresetKey[]; onPresets?: (p: PresetKey[]) => void
}) {
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => onChange({ ...value, [k]: v })
  const year = new Date().getFullYear()
  const show = (s: Section) => section === 'all' || section === s
  return (
    <div className="form">
      {show('body') && (
        <fieldset>
          <legend>Kropp</legend>
          <label className="field"><span>Fornavn</span><input id="name" value={value.name} onChange={(e) => set('name', e.target.value)} autoComplete="given-name" /></label>
          <div className="segmented" role="radiogroup" aria-label="Kjønn">
            {(['male', 'female'] as const).map((s) => (
              <button key={s} role="radio" aria-checked={value.sex === s} className={value.sex === s ? 'on' : ''} onClick={() => set('sex', s)}>{s === 'male' ? 'Mann' : 'Kvinne'}</button>
            ))}
          </div>
          <div className="grid3">
            <label className="field"><span>Født</span><input id="born" type="number" inputMode="numeric" min={year - 90} max={year - 14} value={value.birthYear} onChange={(e) => set('birthYear', +e.target.value)} /></label>
            <label className="field"><span>Høyde (cm)</span><input id="height" type="number" inputMode="numeric" min={130} max={220} value={value.heightCm} onChange={(e) => set('heightCm', +e.target.value)} /></label>
            <label className="field"><span>Vekt (kg)</span><input id="weight" type="number" inputMode="decimal" step={0.1} min={35} max={250} value={value.weightKg} onChange={(e) => set('weightKg', +e.target.value)} /></label>
          </div>
          <p className="hint">Høyden brukes som målestokk når kameraet måler kroppen din — skriv den så nøyaktig du kan.</p>
        </fieldset>
      )}
      {show('goal') && (
        <>
          <fieldset>
            <legend>Hovedmål</legend>
            <div className="choices">
              {(Object.keys(GOAL_INFO) as Goal[]).map((g) => (
                <button key={g} className={`choice ${value.goal === g ? 'on' : ''}`} aria-pressed={value.goal === g} onClick={() => set('goal', g)}>
                  <strong>{GOAL_INFO[g].label}</strong><span>{GOAL_INFO[g].detail}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Ønsket kroppsform</legend>
            <div className="choices">
              {(Object.keys(PHYSIQUE_INFO) as PhysiqueGoal[]).map((g) => (
                <button key={g} className={`choice ${value.physique === g ? 'on' : ''}`} aria-pressed={value.physique === g} onClick={() => set('physique', g)}>
                  <strong>{PHYSIQUE_INFO[g].label}</strong><span>{PHYSIQUE_INFO[g].detail}</span>
                </button>
              ))}
            </div>
            <p className="hint">PT-en sammenligner proporsjonene dine fra skannet med denne formen og gir ekstra volum til det som mangler.</p>
          </fieldset>
          <fieldset>
            <legend>Holdning du vil forbedre (valgfritt)</legend>
            {(Object.keys(POSTURE_GOAL_LABEL) as PostureGoal[]).map((g) => (
              <label key={g} className="check"><input type="checkbox" checked={value.postureGoals.includes(g)} onChange={(e) => set('postureGoals', toggle(value.postureGoals, g, e.target.checked))} />{POSTURE_GOAL_LABEL[g]}</label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Erfaring</legend>
            <div className="segmented wrap" role="radiogroup" aria-label="Erfaring">
              {(Object.keys(EXPERIENCE_LABEL) as Experience[]).map((x) => (
                <button key={x} role="radio" aria-checked={value.experience === x} className={value.experience === x ? 'on' : ''} onClick={() => set('experience', x)}>{EXPERIENCE_LABEL[x]}</button>
              ))}
            </div>
          </fieldset>
        </>
      )}
      {show('training') && (
        <>
          <fieldset>
            <legend>Treningshverdag</legend>
            <div className="grid2">
              <label className="field"><span>Trener fra</span><input id="t-start" type="time" value={value.trainingStart} onChange={(e) => onChange({ ...value, trainingStart: e.target.value, sessionMinutes: minutesBetween(e.target.value, value.trainingEnd) })} /></label>
              <label className="field"><span>Til</span><input id="t-end" type="time" value={value.trainingEnd} onChange={(e) => onChange({ ...value, trainingEnd: e.target.value, sessionMinutes: minutesBetween(value.trainingStart, e.target.value) })} /></label>
            </div>
            <p className="hint">{value.sessionMinutes} minutter per økt. Programmet tilpasses tiden du har.</p>
            <Stepper label="Styrkeøkter per uke" value={value.daysPerWeek} min={1} max={6} onChange={(v) => set('daysPerWeek', v)} />
            <Stepper label="Løpeøkter per uke" value={value.runsPerWeek} min={0} max={4} onChange={(v) => set('runsPerWeek', v)} />
            <label className="check"><input type="checkbox" checked={value.weekendTraining} onChange={(e) => set('weekendTraining', e.target.checked)} />Jeg kan trene på lørdag også</label>
          </fieldset>
          {value.runsPerWeek > 0 && (
            <fieldset>
              <legend>Løpeøkter du liker</legend>
              {(Object.keys(RUN_INFO) as RunType[]).map((r) => (
                <label key={r} className="check"><input type="checkbox" checked={value.runTypes.includes(r)} onChange={(e) => set('runTypes', toggle(value.runTypes, r, e.target.checked))} />
                  <span><strong>{RUN_INFO[r].label}</strong><br /><span className="muted small">{RUN_INFO[r].summary}</span></span></label>
              ))}
              <p className="hint">PT-en legger løpeøktene på dager uten styrke og veksler mellom intervalltypene fra uke til uke.</p>
            </fieldset>
          )}
          {presets && onPresets && (
            <fieldset>
              <legend>Hvor trener du?</legend>
              {(Object.keys(PRESET_LABEL) as PresetKey[]).map((k) => (
                <label key={k} className="check"><input type="checkbox" checked={presets.includes(k)}
                  onChange={(e) => { const n = toggle(presets, k, e.target.checked); if (n.length) onPresets(n) }} />{PRESET_LABEL[k]}</label>
              ))}
              <p className="hint">Du får et eget program for hvert sted. Nøyaktig utstyr og manualvekter legger du inn under Profil → Utstyr.</p>
            </fieldset>
          )}
          <fieldset>
            <legend>Fra Apple-klokka (valgfritt)</legend>
            <p className="hint">Finn tallene i Helse-appen (År-visning). De gjør pulssoner, kalorier og skrittmål personlige.</p>
            <div className="grid2">
              {([
                ['vo2max', 'Kondisjon (VO₂maks)', 0.1],
                ['maxHR', 'Høyeste puls i hard økt', 1],
                ['activeKcal', 'Aktiv energi, kcal/dag', 1],
                ['steps', 'Skritt per dag', 100],
                ['restingHR', 'Hvilepuls', 1],
                ['exerciseMin', 'Treningsminutter/dag', 1],
              ] as const).map(([k, label, step]) => (
                <label key={k} className="field"><span>{label}</span>
                  <input id={`watch-${k}`} type="number" inputMode="decimal" step={step} value={value.watch?.[k] ?? ''} placeholder="–"
                    onChange={(e) => onChange({ ...value, watch: { ...value.watch, [k]: e.target.value === '' ? undefined : +e.target.value, updated: new Date().toISOString() } })} />
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Plager / skader</legend>
            {(Object.keys(LIMITATION_LABEL) as Limitation[]).map((l) => (
              <label key={l} className="check"><input type="checkbox" checked={value.limitations.includes(l)} onChange={(e) => set('limitations', toggle(value.limitations, l, e.target.checked))} />{LIMITATION_LABEL[l]}</label>
            ))}
            <p className="hint">Jeg bytter ut øvelser som ofte provoserer disse områdene. Ved akutte eller uforklarlige smerter: snakk med lege eller fysioterapeut.</p>
          </fieldset>
        </>
      )}
    </div>
  )
}

export function Stepper({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <span>{label}</span>
      <div>
        <button aria-label={`Færre ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - step))}>−</button>
        <output>{value}</output>
        <button aria-label={`Flere ${label.toLowerCase()}`} onClick={() => onChange(Math.min(max, value + step))}>+</button>
      </div>
    </div>
  )
}

export function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const [step, setStep] = useState(0)
  const [p, setP] = useState(defaultProfile)
  const [presets, setPresets] = useState<PresetKey[]>(['gym'])
  const finish = () => {
    const locs = presets.map((k) => PRESETS[k]())
    onDone({ ...p, locations: locs, activeLocationId: locs[0].id })
  }
  const sections: Section[] = ['body', 'goal', 'training']
  return (
    <div className="onboarding">
      {step === 0 ? (
        <div className="welcome">
          <div className="welcome-mark" aria-hidden="true"><Ring /></div>
          <h1>Din personlige trener</h1>
          <p>Jeg måler kroppen din med kameraet, finner hva du bør prioritere for kroppen du ønsker, og lager et treningsprogram basert på oppdatert forskning.</p>
          <p className="muted small">Bildene analyseres på telefonen din og lagres ikke.</p>
          <button className="btn primary big" onClick={() => setStep(1)}>Kom i gang</button>
        </div>
      ) : (
        <>
          <div className="steps" aria-label={`Steg ${step} av 3`}>{[1, 2, 3].map((i) => <span key={i} className={i <= step ? 'on' : ''} />)}</div>
          <ProfileForm value={p} onChange={setP} section={sections[step - 1]} presets={presets} onPresets={setPresets} />
          <div className="row gap">
            <button className="btn" onClick={() => setStep(step - 1)}>Tilbake</button>
            <button className="btn primary grow" onClick={() => (step < 3 ? setStep(step + 1) : finish())}>{step < 3 ? 'Neste' : 'Lag programmet mitt'}</button>
          </div>
        </>
      )}
    </div>
  )
}

/** Merket: en målering med tikk som på et målebånd. */
export function Ring() {
  return (
    <svg viewBox="0 0 120 120" width="120" height="120">
      <circle cx="60" cy="60" r="48" fill="none" stroke="var(--line)" strokeWidth="10" />
      <circle cx="60" cy="60" r="48" fill="none" stroke="var(--accent)" strokeWidth="10" strokeDasharray="210 400" strokeLinecap="round" transform="rotate(-90 60 60)" />
      {Array.from({ length: 24 }, (_, i) => (
        <line key={i} x1="60" y1={i % 6 ? 18 : 14} x2="60" y2="22" stroke="var(--fg)" strokeWidth={i % 6 ? 1 : 2} transform={`rotate(${i * 15} 60 60)`} />
      ))}
    </svg>
  )
}
