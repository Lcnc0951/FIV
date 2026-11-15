import { useState } from 'react'
import { mondayOf, weeklyReport } from '../engine/extras'
import { Card, Icon, nb, Tag } from './kit'
import { useApp } from './state'
import { useWeek } from './Week'

/** Ukesrapport: «uka så langt», og søndag/mandag en full rapport for uka som gikk. */
export function ReportCard() {
  const { data, profile } = useApp()
  const { days } = useWeek()
  const now = new Date()
  // Når begynte brukeren? Tidligste av logg, innsjekk, vekt, skann og treningsperiode.
  const dates = [...data.workouts.map((w) => w.date), ...data.checkins.map((c) => c.date + 'T00:00'), ...data.weights.map((w) => w.date + 'T00:00'),
    ...data.scans.map((x) => x.date), ...(profile.cycleStart ? [profile.cycleStart] : [])].map((x) => new Date(x).getTime()).filter(Number.isFinite)
  const since = dates.length ? new Date(Math.min(...dates)) : now
  const thisMonday = mondayOf(now)
  const hasLastWeek = since < thisMonday
  const [last, setLast] = useState(now.getDay() === 1 && hasLastWeek) // mandag: vis forrige uke
  const start = new Date(thisMonday)
  if (last) start.setDate(start.getDate() - 7)
  const r = weeklyReport({ days, workouts: data.workouts, checkins: data.checkins, weights: data.weights, goal: profile.goal, restingHR: profile.watch?.restingHR, weekStart: start, now, since })
  const title = r.complete ? 'Ukesrapport' : now.getDay() === 0 ? 'Ukesrapport' : 'Uka så langt'
  const range = `${new Date(r.from).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}–${new Date(r.to).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}`
  return (
    <Card className="report">
      <div className="row between">
        <h3>{title}</h3>
        <div className="segmented small-seg">
          <button className={!last ? 'on' : ''} onClick={() => setLast(false)}>Denne</button>
          <button className={last ? 'on' : ''} disabled={!hasLastWeek} onClick={() => setLast(true)}>Forrige</button>
        </div>
      </div>
      <p className="muted small">{range}{r.streak > 0 ? ` · ${r.streak} ${r.streak === 1 ? 'uke' : 'uker'} på rad med plan fullført` : ''}</p>
      <p className="report-headline">{r.headline}</p>
      <div className="metrics four">
        <div className="metric"><div className="metric-value">{r.done}<span className="metric-unit">/{r.planned}</span></div><div className="metric-label">Økter</div></div>
        <div className="metric"><div className="metric-value">{r.strengthDone}</div><div className="metric-label">Styrke</div></div>
        <div className="metric"><div className="metric-value">{r.runsDone}</div><div className="metric-label">Løp</div></div>
        <div className="metric"><div className="metric-value">{r.weightChangeKg != null ? `${r.weightChangeKg > 0 ? '+' : ''}${nb(r.weightChangeKg)}` : '–'}</div><div className="metric-label">Vekt, kg</div></div>
      </div>
      {r.records.length > 0 && (
        <div className="row gap-s wrap">{r.records.map((x) => <Tag key={x.name} tone="good">Rekord: {x.name} ~{x.e1rm} kg</Tag>)}</div>
      )}
      {r.runNotes.length > 0 && <p className="small muted">{r.runNotes.join(' · ')}</p>}
      {r.checkins > 0 && (
        <p className="small muted">Dagsform {r.checkins} dager{r.red ? ` · ${r.red} røde` : ''}{r.yellow ? ` · ${r.yellow} gule` : ''}{r.sleepAvg != null ? ` · søvn ${nb(r.sleepAvg)}/5` : ''}{r.shortNights ? ` · ${r.shortNights} korte netter` : ''}</p>
      )}
      <p className="pt-note"><Icon name="coach" size={16} /> <span>{r.focus}</span></p>
    </Card>
  )
}
