// Ukeringer: styrke, kondisjon og restitusjon fylles mot ukas plan. Alle tre lukket = uka er gjennomført.
import { useState } from 'react'
import { mondayOf, RECOVERY_GOAL, weekRings, type Ring, type WeekRings } from '../engine/extras'
import { WEEKDAYS } from '../engine/week'
import { Card } from './kit'
import { useApp } from './state'
import { useWeek } from './Week'
import { excusedDays } from '../engine/absence'

const COLOR: Record<Ring['key'], string> = { strength: 'var(--ring-strength)', run: 'var(--ring-run)', recovery: 'var(--ring-recovery)' }
const UNIT: Record<Ring['key'], string> = { strength: 'økter', run: 'økter', recovery: 'gode netter' }

export function RingSvg({ rings, size = 150, stroke }: { rings: Ring[]; size?: number; stroke?: number }) {
  const w = stroke ?? size * 0.11
  const gap = w * 0.18
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label={rings.map((r) => `${r.label} ${r.done} av ${r.goal}`).join(', ')} className="rings">
      {rings.map((r, i) => {
        const rad = size / 2 - w / 2 - i * (w + gap)
        const c = 2 * Math.PI * rad
        // Over 100 % vises som en ekstra runde, slik som på klokka
        const over = r.goal ? Math.min(r.done / r.goal, 2) : 1
        return (
          <g key={r.key} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={COLOR[r.key]} strokeOpacity={0.18} strokeWidth={w} />
            {over > 0 && <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={COLOR[r.key]} strokeWidth={w} strokeLinecap="round"
              strokeDasharray={`${Math.min(over, 1) * c} ${c}`} className="ring-arc" />}
            {over > 1 && <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={COLOR[r.key]} strokeWidth={w} strokeLinecap="round"
              strokeDasharray={`${(over - 1) * c} ${c}`} style={{ filter: 'brightness(1.25)' }} />}
          </g>
        )
      })}
    </svg>
  )
}

function status(r: Ring, complete: boolean): string {
  if (r.pct >= 1) return 'Lukket ✓'
  if (complete) return `${r.goal - r.done} manglet`
  if (r.done >= r.expected) return 'I rute'
  return `${r.expected - r.done} bak planen`
}

export function WeekRingsCard() {
  const { data, profile } = useApp()
  const { days } = useWeek()
  const [showWeek, setShowWeek] = useState<number>(0)
  const now = new Date()
  const dates = [...data.workouts.map((w) => w.date), ...data.checkins.map((c) => c.date + 'T00:00'), ...(profile.cycleStart ? [profile.cycleStart] : [])]
    .map((x) => new Date(x).getTime()).filter(Number.isFinite)
  const since = dates.length ? new Date(Math.min(...dates)) : now
  const thisMonday = mondayOf(now)
  const excused = excusedDays(profile.skips, profile.sick, now)
  const weekAt = (back: number): WeekRings => {
    const ws = new Date(thisMonday); ws.setDate(ws.getDate() - 7 * back)
    return weekRings({ days, workouts: data.workouts, checkins: data.checkins, weekStart: ws, now, since, excused })
  }
  const history = [3, 2, 1, 0].filter((b) => { const ws = new Date(thisMonday); ws.setDate(ws.getDate() - 7 * b); ws.setDate(ws.getDate() + 7); return ws > since })
  const w = weekAt(showWeek)
  let streak = 0
  for (let b = 1; b < 52; b++) {
    const ws = new Date(thisMonday); ws.setDate(ws.getDate() - 7 * b)
    if (new Date(ws.getTime() + 7 * 864e5) <= since) break
    const wb = weekAt(b)
    if (wb.closed && wb.rings[0].goal + wb.rings[1].goal === 0) continue // hele uka syk: pause, bryter ikke rekken
    if (wb.closed) streak++; else break
  }
  const title = showWeek === 0 ? 'Uka di' : showWeek === 1 ? 'Forrige uke' : `${showWeek} uker siden`

  return (
    <Card className={`rings-card${w.closed ? ' closed' : ''}`}>
      <div className="row between"><h3>{title}</h3>{streak > 0 && <span className="streak">🔥 {streak} {streak === 1 ? 'uke' : 'uker'} på rad</span>}</div>
      <div className="rings-main">
        <RingSvg rings={w.rings} size={150} />
        <div className="rings-legend">
          {w.rings.map((r) => (
            <div key={r.key} className="ring-row">
              <span className="ring-label" style={{ color: COLOR[r.key] }}>{r.label}</span>
              <span className="ring-value num">{r.done}<span className="muted">/{r.goal}</span> <span className="muted small">{UNIT[r.key]}</span></span>
              <span className={`small ${r.pct >= 1 ? 'good' : r.done < r.expected ? 'warn' : 'muted'}`}>{status(r, w.complete)}</span>
            </div>
          ))}
        </div>
      </div>
      {w.excusedDays > 0 && <p className="muted small">{w.excusedDays} {w.excusedDays === 1 ? 'dag' : 'dager'} syk eller skadet denne uka. De teller ikke mot målene.</p>}
      {w.closed && <p className="rings-done">{showWeek === 0 ? 'Alle ringene er lukket. Uka er gjennomført! 🎉' : 'Uka ble gjennomført 🎉'}</p>}
      <div className="day-dots" aria-label="Ukas dager">
        {w.days.map((d) => (
          <div key={d.weekday} className={`day-dot ${d.did ?? d.kind} ${d.did ? 'done' : d.past && d.kind !== 'rest' && !d.beforeStart && !d.excused ? 'missed' : ''}${d.beforeStart ? ' before' : ''}${d.excused && !d.did ? ' excused' : ''}`}
            title={d.did ? 'Gjennomført' : d.excused ? 'Syk / skadet' : d.kind === 'rest' ? 'Hvile' : d.beforeStart ? 'Før du startet' : 'Planlagt'}>
            <span className="dot" /><span className="tiny">{WEEKDAYS[d.weekday].slice(0, 2)}</span>
          </div>
        ))}
      </div>
      {history.length > 1 && (
        <div className="ring-history">
          {history.map((b) => (
            <button key={b} className={b === showWeek ? 'on' : ''} onClick={() => setShowWeek(b)} aria-label={b === 0 ? 'Denne uka' : `${b} uker siden`}>
              <RingSvg rings={weekAt(b).rings} size={44} />
              <span className="tiny">{b === 0 ? 'Nå' : `−${b}`}</span>
            </button>
          ))}
        </div>
      )}
      <p className="muted tiny">Styrke og kondisjon fylles mot øktene i ukeplanen. Restitusjon fylles med netter med god søvn fra innsjekken ({RECOVERY_GOAL} av 7).</p>
    </Card>
  )
}
