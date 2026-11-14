import { useEffect, type ReactNode } from 'react'
import type { Finding } from '../engine/analyzer'

// Små strek-ikoner (24×24, stroke = currentColor)
const PATHS: Record<string, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  body: 'M12 5a2 2 0 1 0 0-.01M8 9h8l-1 5h-1l-1 7h-2l-1-7H9z',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M12 8a1.5 1.5 0 1 0 0-.01M10 11h4l-.5 3h-.5l-.5 3h-1l-.5-3h-.5z',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  coach: 'M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3zM10 22h4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  play: 'M8 5v14l11-7z',
  chevron: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  check: 'M5 12l5 5 9-10',
  alert: 'M12 3l10 18H2zM12 10v4M12 17h.01',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7h.01',
  flame: 'M12 2c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 4 4 0-3 0-5 0-8z',
  dumbbell: 'M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  walk: 'M13 4a1.5 1.5 0 1 0 0-.01M10 21l2-6 3 3v3M9 12l3-4 3 3 3 1M12 8l-1 4',
  moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  food: 'M6 3v8a2 2 0 0 0 4 0V3M8 11v10M16 3c-2 0-3 3-3 6s1 4 3 4v8',
  glass: 'M7 3h10l-1 8a4 4 0 0 1-8 0zM12 15v6M8 21h8',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  swap: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  lidar: 'M12 12h.01M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13',
  plus: 'M12 5v14M5 12h14',
  timer: 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 10v4l2 2M9 2h6',
  posture: 'M12 3a2 2 0 1 0 0 .01M12 7v6M9 21l3-8 3 8M8 10h8',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
}
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  )
}

export const Card = ({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) =>
  onClick ? <button className={`card card-button ${className}`} onClick={onClick}>{children}</button> : <section className={`card ${className}`}>{children}</section>

export const Metric = ({ label, value, unit }: { label: string; value?: string | number | null; unit?: string }) => (
  <div className="metric">
    <div className="metric-value">{value ?? '–'}{value != null && unit ? <span className="metric-unit"> {unit}</span> : null}</div>
    <div className="metric-label">{label}</div>
  </div>
)

export const Tag = ({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'good' | 'warn' | 'bad' | 'plain' }) =>
  <span className={`tag tag-${tone}`}>{children}</span>

export function Bar({ value, max = 100, tone }: { value: number; max?: number; tone?: 'good' | 'warn' | 'bad' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><div className={`bar-fill ${tone ? 'bar-' + tone : ''}`} style={{ width: `${pct}%` }} /></div>
}

const SEV = [{ icon: 'check', cls: 'good' }, { icon: 'info', cls: 'info' }, { icon: 'alert', cls: 'warn' }, { icon: 'alert', cls: 'bad' }] as const
export function FindingRow({ f }: { f: Finding }) {
  const s = SEV[f.severity]
  return (
    <div className="finding">
      <span className={`finding-icon sev-${s.cls}`}><Icon name={s.icon} /></span>
      <div>
        <div className="finding-title">{f.title}</div>
        <div className="muted small">{f.detail}</div>
        <div className="small strong">{f.action}</div>
      </div>
    </div>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button className="icon-btn" onClick={onClose} aria-label="Lukk"><Icon name="back" /></button>
          <h2>{title}</h2>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export interface Series { name: string; points: { x: number; y: number }[] }
/** Enkel linjegraf. x = tid (ms) eller uke. */
export function LineChart({ series, height = 160, xFormat, yFormat = (v) => v.toFixed(0) }: {
  series: Series[]; height?: number; xFormat: (x: number) => string; yFormat?: (y: number) => string
}) {
  const all = series.flatMap((s) => s.points)
  if (!all.length) return null
  const W = 320, H = height, padL = 34, padR = 10, padT = 14, padB = 22
  let x0 = Math.min(...all.map((p) => p.x)), x1 = Math.max(...all.map((p) => p.x))
  let y0 = Math.min(...all.map((p) => p.y)), y1 = Math.max(...all.map((p) => p.y))
  if (x0 === x1) { x0 -= 1; x1 += 1 }
  const pad = (y1 - y0) * 0.15 || 1; y0 -= pad; y1 += pad
  const X = (x: number) => padL + ((x - x0) / (x1 - x0)) * (W - padL - padR)
  const Y = (y: number) => padT + (1 - (y - y0) / (y1 - y0)) * (H - padT - padB)
  const ticks = [y0 + (y1 - y0) * 0.15, (y0 + y1) / 2, y1 - (y1 - y0) * 0.15]
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Graf">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={Y(t)} y2={Y(t)} className="grid" />
            <text x={padL - 4} y={Y(t) + 3} textAnchor="end" className="axis">{yFormat(t)}</text>
          </g>
        ))}
        <text x={padL} y={H - 6} className="axis">{xFormat(x0)}</text>
        <text x={W - padR} y={H - 6} textAnchor="end" className="axis">{xFormat(x1)}</text>
        {series.map((s, i) => {
          const pts = [...s.points].sort((a, b) => a.x - b.x)
          const d = pts.map((p, k) => `${k ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('')
          const last = pts[pts.length - 1]
          return (
            <g key={s.name} className={`series s${i}`}>
              <path d={d} fill="none" strokeWidth={2.2} />
              {pts.map((p) => <circle key={p.x} cx={X(p.x)} cy={Y(p.y)} r={2.6} />)}
              <circle cx={X(last.x)} cy={Y(last.y)} r={4.5} />
            </g>
          )
        })}
      </svg>
      {series.length > 1 && <div className="legend">{series.map((s, i) => <span key={s.name} className={`legend-item s${i}`}>{s.name}</span>)}</div>}
    </div>
  )
}

export const nb = (v: number | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? '–' : v.toLocaleString('nb-NO', { minimumFractionDigits: digits, maximumFractionDigits: digits }))
export const dateNb = (iso: string) => new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })

export function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'nb-NO'
    const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('nb') || x.lang.startsWith('no'))
    if (v) u.voice = v
    speechSynthesis.cancel(); speechSynthesis.speak(u)
  } catch { /* tale er valgfritt */ }
}
