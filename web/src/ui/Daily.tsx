import { useState } from 'react'
import { cycleInfo, kcalSuggestion, PARQ, readiness, todayKey, WARNING_SIGNS, weightTrend, type Checkin, type Readiness } from '../engine/daily'
import { Card, Icon, LineChart, nb, Tag } from './kit'
import { useApp } from './state'

const LEVEL: Record<Readiness, { label: string; tone: 'good' | 'warn' | 'bad' }> = {
  green: { label: 'Grønn — kjør planen', tone: 'good' },
  yellow: { label: 'Gul — litt mindre i dag', tone: 'warn' },
  red: { label: 'Rød — rolig dag', tone: 'bad' },
}

export function useToday() {
  const { data, profile } = useApp()
  const checkin = data.checkins.find((c) => c.date === todayKey())
  const r = checkin ? readiness(checkin, profile.watch?.restingHR) : undefined
  return { checkin, readiness: r }
}

function Scale({ label, low, high, value, onChange }: { label: string; low: string; high: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="scale" role="radiogroup" aria-label={label}>
      <div className="row between small"><strong>{label}</strong><span className="muted">{low} → {high}</span></div>
      <div className="scale-row">
        {[1, 2, 3, 4, 5].map((v) => <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{v}</button>)}
      </div>
    </div>
  )
}

export function CheckinCard() {
  const { saveCheckin, profile } = useApp()
  const { checkin, readiness: r } = useToday()
  const [edit, setEdit] = useState(false)
  const [c, setC] = useState<Checkin>(checkin ?? { date: todayKey(), sleep: 4, soreness: 4, energy: 4 })
  if (checkin && r && !edit) {
    return (
      <Card>
        <div className="row between"><strong>Dagsform</strong><Tag tone={LEVEL[r.level].tone}>{LEVEL[r.level].label}</Tag></div>
        {r.reasons.length > 0 && <p className="muted small">{r.reasons.join(' · ')}</p>}
        <button className="link small" onClick={() => setEdit(true)}>Endre</button>
      </Card>
    )
  }
  return (
    <Card>
      <h3>Hvordan er formen i dag?</h3>
      <p className="muted small">10 sekunder. PT-en justerer dagens økt etter svarene.</p>
      <Scale label="Søvn" low="dårlig" high="topp" value={c.sleep} onChange={(v) => setC({ ...c, sleep: v })} />
      <Scale label="Stølhet" low="veldig støl" high="ikke støl" value={c.soreness} onChange={(v) => setC({ ...c, soreness: v })} />
      <Scale label="Energi" low="tom" high="full" value={c.energy} onChange={(v) => setC({ ...c, energy: v })} />
      <label className="field row-field"><span>Hvilepuls i dag (valgfritt)</span>
        <input id="ck-hr" type="number" inputMode="numeric" placeholder={profile.watch?.restingHR ? String(profile.watch.restingHR) : '–'} value={c.restingHR ?? ''}
          onChange={(e) => setC({ ...c, restingHR: e.target.value === '' ? undefined : +e.target.value })} /></label>
      <button className="btn primary full" onClick={async () => { await saveCheckin({ ...c, date: todayKey() }); setEdit(false) }}>Lagre dagsform</button>
    </Card>
  )
}

export function WeightCard({ compact = false }: { compact?: boolean }) {
  const { data, profile, saveWeight, saveProfile } = useApp()
  const today = data.weights.find((w) => w.date === todayKey())
  const [kg, setKg] = useState<string>(today ? String(today.kg) : '')
  const trend = weightTrend(data.weights)
  const sug = kcalSuggestion(profile.goal, trend)
  const [applied, setApplied] = useState(false)
  return (
    <Card>
      <div className="row between"><h3>Vekt</h3>{trend.avg7 && <span className="num"><strong>{nb(trend.avg7)}</strong> <span className="muted small">kg snitt 7 dager</span></span>}</div>
      <div className="row gap">
        <input id="weight-today" className="grow input" type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" placeholder={`Vekt i dag (${nb(profile.weightKg)})`} value={kg} onChange={(e) => setKg(e.target.value)} />
        <button className="btn primary" disabled={!(+kg.replace(',', '.') > 20)} onClick={() => saveWeight({ date: todayKey(), kg: +kg.replace(',', '.') })}>{today ? 'Oppdater' : 'Lagre'}</button>
      </div>
      {!compact && trend.points.length > 1 && (
        <LineChart series={[{ name: 'Snitt 7 dager', points: trend.points.map((p) => ({ x: new Date(p.date).getTime(), y: p.avg })) },
          { name: 'Daglig', points: trend.points.map((p) => ({ x: new Date(p.date).getTime(), y: p.kg })) }]}
          xFormat={(x) => new Date(x).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })} yFormat={(y) => y.toFixed(1)} />
      )}
      {sug ? (
        <>
          <p className="small">{sug.message}</p>
          {sug.kcal !== 0 && !applied && (
            <button className="btn full" onClick={async () => { await saveProfile({ ...profile, kcalOffset: (profile.kcalOffset ?? 0) + sug.kcal }, false); setApplied(true) }}>
              Juster kaloriene {sug.kcal > 0 ? '+' : ''}{sug.kcal} kcal
            </button>
          )}
          {applied && <p className="good small"><Icon name="check" size={14} /> Kaloriene er justert.</p>}
        </>
      ) : <p className="muted small">Vei deg om morgenen etter toalettbesøk. Etter to uker regner PT-en ut trenden og justerer kaloriene.</p>}
      {(profile.kcalOffset ?? 0) !== 0 && <p className="muted small">Samlet justering: {profile.kcalOffset! > 0 ? '+' : ''}{profile.kcalOffset} kcal per dag. <button className="link" onClick={() => saveProfile({ ...profile, kcalOffset: 0 }, false)}>Nullstill</button></p>}
    </Card>
  )
}

export function useCycle() {
  const { profile, program } = useApp()
  return cycleInfo(profile.cycleStart, program?.mesocycle.length ?? 5)
}

export function CycleBanner() {
  const { program, newCycle, latest, profile } = useApp()
  const c = useCycle()
  if (!program) return null
  const week = program.mesocycle[Math.min(c.week, program.mesocycle.length) - 1]
  const newScan = latest && profile.cycleStart && latest.date > profile.cycleStart
  return (
    <Card className={c.finished ? 'callout' : ''}>
      <div className="row between"><strong>{c.finished ? 'Perioden er ferdig' : `Uke ${c.week} av ${c.length}${c.deload ? ' · lett uke' : ''}`}</strong>{week && !c.finished && <Tag tone={c.deload ? 'good' : 'accent'}>RIR {week.rir}</Tag>}</div>
      {!c.finished && week && <p className="muted small">{week.note}</p>}
      {(c.finished || newScan) && (
        <>
          <p className="small">{c.finished ? 'Bra jobba! Start ny periode — programmet bygges på nytt med siste skann og fremgangen din.' : 'Du har et nytt skann. Det tas med når neste periode starter — eller start ny periode nå.'}</p>
          <button className={`btn ${c.finished ? 'primary' : ''} full`} onClick={newCycle}>Start ny periode</button>
        </>
      )}
    </Card>
  )
}

export function HealthCheck() {
  const { profile, saveProfile } = useApp()
  const [answers, setAnswers] = useState<(boolean | null)[]>(PARQ.map(() => null))
  if (profile.health) {
    if (!profile.health.answers.some(Boolean)) return null
    return (
      <Card className="callout">
        <p className="small"><Icon name="alert" size={16} /> <strong>Snakk med lege før harde intervaller.</strong> Du svarte ja på minst ett spørsmål i helsesjekken. Rolig løp og styrke med kontrollerte vekter er normalt trygt i mellomtiden.</p>
        <p className="muted small">{WARNING_SIGNS}</p>
      </Card>
    )
  }
  const done = answers.every((a) => a !== null)
  return (
    <Card>
      <h3>Helsesjekk før vi kjører på</h3>
      <p className="muted small">Sju spørsmål (PAR-Q+). Harde intervaller med puls opp mot makspuls er trygt for de aller fleste — men ikke for alle.</p>
      <div className="stack-s">
        {PARQ.map((q, i) => (
          <div key={q} className="parq">
            <p className="small">{q}</p>
            <div className="segmented">
              {[false, true].map((v) => <button key={String(v)} className={answers[i] === v ? 'on' : ''} onClick={() => setAnswers(answers.map((a, k) => (k === i ? v : a)))}>{v ? 'Ja' : 'Nei'}</button>)}
            </div>
          </div>
        ))}
      </div>
      <button className="btn primary full" disabled={!done} onClick={() => saveProfile({ ...profile, health: { answers: answers as boolean[], answeredAt: new Date().toISOString() } }, false)}>Lagre</button>
    </Card>
  )
}
