// Kropp → Plager: beskriv plager og stivhet med egne ord, få daglig rutine i nivåer og et tilpasset styrkeprogram.
import { useMemo, useState } from 'react'
import { dayKey } from '../engine/absence'
import { exercise } from '../engine/library'
import {
  LIMIT_LABEL, parseMobility, planMobility, REGION_LABEL, suggestLevel,
  type Level, type MobDrill, type MobilityLimit, type MobilityProfile, type Region,
} from '../engine/mobility'
import { Card, Icon, Tag } from './kit'
import { animationNamed, StickFigure } from './StickFigure'
import { useApp } from './state'

const LEVEL_TEXT: Record<Level, string> = { 1: 'Nivå 1 · demp og løsne', 2: 'Nivå 2 · bevegelse og lett styrke', 3: 'Nivå 3 · tilbake til full bevegelse' }
const painWord = (p: number) => (p <= 2 ? 'lite' : p <= 5 ? 'moderat' : 'mye')

function MobRow({ d }: { d: MobDrill }) {
  const anim = d.animation ? animationNamed(d.animation) : undefined
  return (
    <div className="drill">
      <div className="thumb">{anim ? <StickFigure anim={anim} showPhase={false} size={72} /> : <Icon name="posture" size={30} />}</div>
      <div>
        <div className="row gap-s wrap"><strong>{d.name}</strong><Tag tone="plain">nivå {d.level}</Tag></div>
        <div className="accent small strong">{d.dose}</div>
        <p className="small">{d.cue}</p>
        <p className="muted small">{d.why}</p>
      </div>
    </div>
  )
}

function Editor({ initial, onDone }: { initial?: MobilityProfile; onDone: () => void }) {
  const { profile, saveProfile } = useApp()
  const [text, setText] = useState(initial?.text ?? '')
  const [pain, setPain] = useState(initial?.pain ?? 5)
  const parsed = useMemo(() => parseMobility(text), [text])
  const [regions, setRegions] = useState<Region[] | null>(initial?.regions ?? null)
  const [limits, setLimits] = useState<MobilityLimit[] | null>(initial?.limits ?? null)
  // Det appen forstod fra teksten, til brukeren endrer selv
  const r = regions ?? parsed.regions
  const l = limits ?? parsed.limits
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const save = async () => {
    const m: MobilityProfile = {
      text: text.trim(), pain, regions: r, limits: l,
      level: initial && !initial.resolved ? initial.level : pain >= 6 ? 1 : pain >= 3 ? 1 : 2,
      since: initial && !initial.resolved ? initial.since : new Date().toISOString(),
    }
    await saveProfile({ ...profile, mobility: m }, false)
    onDone()
  }
  return (
    <Card>
      <h3>Beskriv plagene med egne ord</h3>
      <p className="muted small">Hvor det gjør vondt, hva som er stivt, og hva du ikke klarer. Appen lager en daglig rutine og tilpasser styrkeøktene.</p>
      <label className="field"><span className="sr">Beskrivelse</span>
        <textarea id="mob-text" className="input" rows={5} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="F.eks. «Veldig stiv i kroppen. Klarer ikke å stå på alle fire og peke armen mot taket. Vondt i muskelen oppå skulderbladet, og det verker i skulderen på benkpress.»" /></label>
      <label className="field"><span>Hvor vondt er det nå? <strong>{pain}/10</strong> ({painWord(pain)})</span>
        <input id="mob-pain" type="range" min={0} max={10} value={pain} onChange={(e) => setPain(+e.target.value)} /></label>
      {(text.trim().length > 5 || r.length > 0) && (
        <>
          <p className="small"><strong>Dette forstod jeg</strong> <span className="muted">(trykk for å endre)</span></p>
          <div className="chips">
            {(Object.keys(REGION_LABEL) as Region[]).map((x) => (
              <button key={x} className={r.includes(x) ? 'on' : ''} aria-pressed={r.includes(x)} onClick={() => setRegions(toggle(r, x))}>{REGION_LABEL[x]}</button>
            ))}
          </div>
          <div className="stack-s">
            {(Object.keys(LIMIT_LABEL) as MobilityLimit[]).map((x) => (
              <label key={x} className="check"><input type="checkbox" checked={l.includes(x)} onChange={() => setLimits(toggle(l, x))} />{LIMIT_LABEL[x]}</label>
            ))}
          </div>
        </>
      )}
      <button className="btn primary big full" disabled={!r.length} onClick={save}>{initial && !initial.resolved ? 'Oppdater planen' : 'Lag plan'}</button>
      {initial && !initial.resolved && <button className="btn ghost full" onClick={onDone}>Avbryt</button>}
    </Card>
  )
}

export function MobilityView() {
  const { profile, saveProfile, pain, program } = useApp()
  const m = profile.mobility
  const [editing, setEditing] = useState(false)
  const [todayPain, setTodayPain] = useState(m?.pain ?? 3)
  if (!m || m.resolved || editing) {
    return (
      <>
        {m?.resolved && !editing && <p className="good small"><Icon name="check" size={14} /> Forrige plage ble markert som borte {m.resolved.slice(0, 10)}.</p>}
        <Editor initial={m} onDone={() => setEditing(false)} />
      </>
    )
  }
  const plan = planMobility(m)
  const logs = profile.mobilityLog ?? []
  const today = dayKey(new Date())
  const doneToday = logs.some((x) => x.date === today && x.done)
  const next = suggestLevel(m, logs)
  const recent = [...logs].sort((a, b) => a.date.localeCompare(b.date)).slice(-10)
  const changedEx = program?.days.flatMap((d) => d.exercises).filter((x) => x.note && /Skånsom|baksiden av skuldrene|Erstatter/.test(x.note)) ?? []
  const uniq = [...new Map(changedEx.map((x) => [x.exerciseId, x])).values()]
  const logToday = async () => {
    const mobilityLog = [...logs.filter((x) => x.date !== today), { date: today, pain: todayPain, done: true }].slice(-90)
    await saveProfile({ ...profile, mobilityLog, mobility: { ...m, pain: todayPain } }, false)
  }
  const setLevel = (level: Level) => saveProfile({ ...profile, mobility: { ...m, level } }, false)

  return (
    <>
      <Card>
        <div className="row between wrap gap-s"><h3>Plagene dine</h3><button className="link small" onClick={() => setEditing(true)}>Endre</button></div>
        {m.text && <p className="small">💬 {m.text}</p>}
        <div className="row gap-s wrap">{m.regions.map((r) => <Tag key={r}>{REGION_LABEL[r]}</Tag>)}{m.limits.map((x) => <Tag key={x} tone="plain">{LIMIT_LABEL[x]}</Tag>)}</div>
        <p className="muted small">Smerte nå: {m.pain}/10 · {LEVEL_TEXT[m.pain >= 6 ? 1 : m.level]}{m.pain >= 6 && m.level > 1 ? ' (nivå 1 mens det verker mye)' : ''}</p>
      </Card>

      <Card>
        <div className="row between wrap gap-s"><h3>Daglig rutine · ca. {plan.minutes} min</h3>{doneToday && <Tag tone="good">gjort i dag</Tag>}</div>
        <p className="muted small">Gjør den hver dag, gjerne morgen eller kveld. De tre første er også oppvarming før styrkeøktene.</p>
        <div className="stack-s">{plan.daily.map((d) => <MobRow key={d.id} d={d} />)}</div>
        <div className="log-today">
          <label className="field"><span>Hvor vondt var det i dag? <strong>{todayPain}/10</strong></span>
            <input id="mob-today" type="range" min={0} max={10} value={todayPain} onChange={(e) => setTodayPain(+e.target.value)} /></label>
          <button className="btn primary full" onClick={logToday}><Icon name="check" /> {doneToday ? 'Oppdater dagens logg' : 'Gjort i dag'}</button>
        </div>
        {recent.length > 1 && (
          <div className="pain-trend" aria-label="Smerte siste dager">
            {recent.map((x) => <div key={x.date} className="pain-bar" style={{ height: `${8 + x.pain * 5}px` }} title={`${x.date}: ${x.pain}/10`}><span className="tiny">{x.pain}</span></div>)}
          </div>
        )}
        {next && (
          <div className="adjust small stack-s">
            <span><Icon name="info" size={14} /> {next.reason}</span>
            <button className="btn small" onClick={() => setLevel(next.level)}>Gå til nivå {next.level}</button>
          </div>
        )}
        {!next && m.level < 3 && <button className="link small" onClick={() => setLevel((m.level + 1) as Level)}>Føles det lett? Gå til nivå {m.level + 1}</button>}
        {m.level > 1 && <button className="link small" onClick={() => setLevel((m.level - 1) as Level)}>For tungt? Gå ned til nivå {m.level - 1}</button>}
      </Card>

      {plan.goal && (
        <Card>
          <h3>Målet</h3>
          <p className="muted small">Denne klarer du kanskje ikke nå. Den kommer inn på nivå 3, når kroppen er klar.</p>
          <MobRow d={plan.goal} />
        </Card>
      )}

      <Card>
        <h3>Styrkeprogrammet ditt er tilpasset</h3>
        <ul className="small">
          {plan.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
        {uniq.length > 0 && <>
          <p className="small"><strong>Byttet eller lagt til:</strong></p>
          <ul className="small">{uniq.map((x) => <li key={x.exerciseId}><strong>{exercise(x.exerciseId)?.name}</strong>: {x.note}</li>)}</ul>
        </>}
        {pain.removed.length > 0 && <p className="muted small">Tatt ut til det er bedre: {pain.removed.map((id) => exercise(id)?.name ?? id).join(', ')}.</p>}
        {plan.avoid.length > 0 && <p className="muted small">Unngå foreløpig: {plan.avoid.join(' · ')}.</p>}
      </Card>

      <Card>
        <p className="small">Ikke bedre etter 2–3 uker, nattsmerter, nummenhet eller prikking ned i armen: kontakt fysioterapeut eller lege.</p>
        <button className="btn full" onClick={() => saveProfile({ ...profile, mobility: { ...m, resolved: new Date().toISOString() } }, false)}>Plagene er borte, tilbake til vanlig program</button>
      </Card>
    </>
  )
}

/** Kort på Hjem: dagens mobilitetsrutine. */
export function MobilityTodayCard({ open }: { open: () => void }) {
  const { profile } = useApp()
  const m = profile.mobility
  if (!m || m.resolved) return null
  const plan = planMobility(m)
  const done = (profile.mobilityLog ?? []).some((x) => x.date === dayKey(new Date()) && x.done)
  return (
    <Card onClick={open}>
      <div className="row between"><div><h3>Mobilitet i dag · {plan.minutes} min</h3>
        <p className="muted small">{plan.daily.slice(0, 3).map((d) => d.name).join(' · ')} …</p></div>
        {done ? <Tag tone="good">gjort</Tag> : <Icon name="chevron" />}</div>
    </Card>
  )
}
