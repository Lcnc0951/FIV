// Oversikt: uke for uke (med hver dag), og progresjonstabeller for styrke og løping.
import { useState } from 'react'
import { excusedDays, SKIP_LABEL } from '../engine/absence'
import { runProgress, strengthProgress, weekSummaries, type DaySummary, type SessionSummary, type WeekSummary } from '../engine/history'
import { Card, Icon, LineChart, nb, Tag } from './kit'
import { groupSessions, SessionEditor, type Session } from './Sessions'
import { useApp } from './state'

// Hele tall uten desimal, ellers én desimal
const num = (v: number) => nb(v, Number.isInteger(v) ? 0 : 1)
const dayName = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'short' })
const short = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
const kg = (n: number) => (n >= 1000 ? `${num(Math.round(n / 100) / 10)} tonn` : `${num(n)} kg`)
const one = (n?: number) => (n == null ? '–' : num(Math.round(n * 10) / 10))

function sessionLine(s: SessionSummary): string {
  if (s.kind === 'run' && s.run) {
    const r = s.run
    return [r.reps && r.type !== 'tempo20' ? `${r.reps} drag` : '', r.minutes ? `${r.minutes} min` : '', r.km ? `${num(r.km)} km` : '', r.avgHR ? `puls ${r.avgHR}` : '', `føltes ${r.rpe}/10`].filter(Boolean).join(' · ')
  }
  return [`${s.exercises?.length ?? 0} øvelser`, `${s.sets} sett`, s.volumeKg ? kg(s.volumeKg) : '', s.minutes ? `${s.minutes} min` : ''].filter(Boolean).join(' · ')
}

function DayRow({ d, open }: { d: DaySummary; open: (key: string) => void }) {
  const empty = !d.sessions.length
  return (
    <div className={`hist-day${empty ? ' empty' : ''}`}>
      <div className="row between wrap gap-s">
        <strong className="cap">{dayName(d.day)}</strong>
        <span className="row gap-s">
          {d.sick && <Tag tone="warn">syk</Tag>}
          {d.checkin && <span className="muted small" title="Søvn og energi fra innsjekken">😴 {d.checkin.sleep}/5 · ⚡ {d.checkin.energy}/5</span>}
        </span>
      </div>
      {d.sessions.map((s) => (
        <button key={s.key} className="hist-session" onClick={() => open(s.key)}>
          <span className={`hist-dot ${s.kind}`} />
          <span className="grow">
            <span className="small strong">{s.title}</span>{s.records.length > 0 && <> <Tag tone="good">🏆 rekord</Tag></>}<br />
            <span className="small muted">{sessionLine(s)}</span>
            {s.records.length > 0 && <><br /><span className="small good">Ny rekord: {s.records.join(', ')}</span></>}
            {s.note && <><br /><span className="small">💬 {s.note}</span></>}
          </span>
          <Icon name="chevron" size={16} />
        </button>
      ))}
      {empty && d.skip && <p className="small muted">Sto over: {SKIP_LABEL[d.skip.reason].toLowerCase()}{d.skip.note ? ` – ${d.skip.note}` : ''}</p>}
      {empty && !d.skip && !d.sick && <p className="small muted">Ingen økt</p>}
    </div>
  )
}

function WeekCard({ w, first, open }: { w: WeekSummary; first: boolean; open: (key: string) => void }) {
  const [expanded, setExpanded] = useState(first)
  const total = w.strength + w.runs
  return (
    <Card>
      <button className="hist-week-head" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span>
          <strong>{first ? 'Denne uka' : `Uke ${short(w.start)}–${short(w.end)}`}</strong><br />
          <span className="small muted">{total} {total === 1 ? 'økt' : 'økter'} · {w.strength} styrke · {w.runs} løp{w.sick ? ` · ${w.sick} syk` : ''}{w.skipped ? ` · ${w.skipped} stått over` : ''}</span>
        </span>
        <span className={`chev${expanded ? ' open' : ''}`}><Icon name="chevron" size={18} /></span>
      </button>
      <div className="hist-metrics">
        <div><b className="num">{w.sets}</b><span>sett</span></div>
        <div><b className="num">{w.volumeKg ? kg(w.volumeKg) : '–'}</b><span>løftet</span></div>
        <div><b className="num">{w.km ? num(w.km) : '–'}</b><span>km løpt</span></div>
        <div><b className="num">{w.avgRunRpe ? one(w.avgRunRpe) : '–'}</b><span>snitt tungt (løp)</span></div>
      </div>
      {w.records.length > 0 && <p className="small good">🏆 Nye rekorder: {w.records.join(', ')}</p>}
      {(w.avgSleep || w.avgEnergy) && <p className="small muted">Snitt innsjekk: søvn {one(w.avgSleep)}/5 · energi {one(w.avgEnergy)}/5</p>}
      {expanded && <div className="stack-s hist-days">{w.days.map((d) => <DayRow key={d.day} d={d} open={open} />)}</div>}
      {!expanded && <button className="link small" onClick={() => setExpanded(true)}>Vis dagene</button>}
    </Card>
  )
}

function StrengthTable() {
  const { data } = useApp()
  const rows = strengthProgress(data.workouts)
  const [sel, setSel] = useState<string | null>(null)
  if (!rows.length) return <Card><p className="small muted">Logg styrkeøkter, så vises progresjonen per øvelse her.</p></Card>
  const chosen = rows.find((r) => r.exerciseId === sel)
  return (
    <Card>
      <h3>Styrke</h3>
      <p className="muted small">Estimert 1RM: hva du teoretisk kunne løftet én gang, regnet fra beste sett. Trykk på en øvelse for detaljer.</p>
      <div className="table-wrap">
        <table className="table prog-table">
          <thead><tr><th>Øvelse</th><th className="num">Økter</th><th className="num">Første</th><th className="num">Nå</th><th className="num">Endring</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.exerciseId} className={r.exerciseId === sel ? 'on' : ''} onClick={() => setSel(r.exerciseId === sel ? null : r.exerciseId)}>
                <td>{r.name}</td><td className="num">{r.rows.length}</td><td className="num">{one(r.first)}</td><td className="num">{one(r.last)}</td>
                <td className={`num ${r.changePct > 0 ? 'good' : r.changePct < 0 ? 'bad' : 'muted'}`}>{r.rows.length > 1 ? `${r.changePct > 0 ? '+' : ''}${num(r.changePct)} %` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chosen && (
        <div className="stack-s">
          <h3>{chosen.name}</h3>
          {chosen.rows.length > 1 && <LineChart series={[{ name: 'Estimert 1RM', points: chosen.rows.map((r) => ({ x: new Date(r.date + 'T12:00').getTime(), y: r.e1rm })) }]}
            xFormat={(x) => short(new Date(x).toISOString().slice(0, 10))} yFormat={(y) => `${y.toFixed(0)} kg`} />}
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Dato</th><th>Beste sett</th><th className="num">1RM</th><th className="num">Sett</th><th className="num">Volum</th></tr></thead>
              <tbody>{[...chosen.rows].reverse().map((r, i) => (
                <tr key={i}><td>{short(r.date)}</td><td className="num">{num(r.best.weightKg)} × {r.best.reps}</td><td className="num">{one(r.e1rm)}</td><td className="num">{r.sets}</td><td className="num">{kg(r.volumeKg)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  )
}

function RunTables() {
  const { data } = useApp()
  const types = runProgress(data.workouts)
  if (!types.length) return <Card><p className="small muted">Logg løpeøkter, så vises progresjonen per type her.</p></Card>
  return (
    <>
      {types.map((t) => (
        <Card key={t.type}>
          <h3>{t.label}</h3>
          {t.rows.filter((r) => r.avgHR).length > 1 && <LineChart series={[{ name: 'Snittpuls', points: t.rows.flatMap((r) => (r.avgHR ? [{ x: new Date(r.date + 'T12:00').getTime(), y: r.avgHR }] : [])) }]}
            xFormat={(x) => short(new Date(x).toISOString().slice(0, 10))} yFormat={(y) => `${y.toFixed(0)}`} height={120} />}
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Dato</th>{t.type !== 'tempo20' && t.type !== 'easy' && <th className="num">Drag</th>}<th className="num">Min</th><th className="num">Km</th><th className="num">Puls</th><th className="num">Tungt</th></tr></thead>
              <tbody>{[...t.rows].reverse().map((r, i) => (
                <tr key={i} title={r.note}>
                  <td>{short(r.date)}{r.note ? ' 💬' : ''}</td>
                  {t.type !== 'tempo20' && t.type !== 'easy' && <td className="num">{r.reps ?? '–'}</td>}
                  <td className="num">{r.minutes ?? '–'}</td><td className="num">{r.km ? num(r.km) : '–'}</td><td className="num">{r.avgHR ?? '–'}</td>
                  <td className={`num ${r.rpe >= 9 ? 'bad' : r.rpe <= 6 ? 'good' : ''}`}>{r.rpe}/10</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="muted small">Fremgang: flere drag eller minutter, høyere fart, eller lavere puls og «tungt» på samme økt.</p>
        </Card>
      ))}
    </>
  )
}

export function History({ onBack }: { onBack: () => void }) {
  const { data, profile } = useApp()
  const [tab, setTab] = useState<'weeks' | 'progress'>('weeks')
  const [open, setOpen] = useState<Session | null>(null)
  const weeks = weekSummaries({ workouts: data.workouts, checkins: data.checkins, skips: profile.skips, sickDays: excusedDays([], profile.sick) })
  const openKey = (key: string) => setOpen(groupSessions(data.workouts).find((s) => s.key === key) ?? null)
  return (
    <div className="stack">
      <header className="page-head"><button className="btn ghost" onClick={onBack}><Icon name="back" /> Hjem</button><h1>Oversikt</h1></header>
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={tab === 'weeks'} className={tab === 'weeks' ? 'on' : ''} onClick={() => setTab('weeks')}>Uker og dager</button>
        <button role="tab" aria-selected={tab === 'progress'} className={tab === 'progress' ? 'on' : ''} onClick={() => setTab('progress')}>Progresjon</button>
      </div>
      {tab === 'weeks' && (data.workouts.length === 0
        ? <Card><p className="small muted">Ingen økter logget ennå. Når du fullfører en økt, dukker den opp her.</p></Card>
        : weeks.map((w, i) => <WeekCard key={w.start} w={w} first={i === 0} open={openKey} />))}
      {tab === 'progress' && <><StrengthTable /><RunTables /></>}
      <SessionEditor session={open} onClose={() => setOpen(null)} />
    </div>
  )
}
