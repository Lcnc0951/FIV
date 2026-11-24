// Rullehjul med store tall, som på Apple Watch. Sveip opp/ned, trykk på et tall, eller bruk piltastene.
import { useEffect, useLayoutEffect, useRef } from 'react'

const ITEM = 56 // px per rad

export function Wheel({ values, value, onChange, format = String, label, unit }: {
  values: number[]; value: number; onChange: (v: number) => void; format?: (v: number) => string; label: string; unit?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const index = Math.max(0, values.indexOf(value))
  const fromScroll = useRef(false)

  // Startposisjon og eksterne endringer
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || fromScroll.current) { fromScroll.current = false; return }
    el.scrollTop = index * ITEM
  }, [index])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onScroll = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM)))
      if (values[i] !== value) { fromScroll.current = true; onChange(values[i]); navigator.vibrate?.(8) }
    }, 90)
  }
  const pick = (i: number) => {
    const el = ref.current
    el?.scrollTo({ top: i * ITEM, behavior: 'smooth' })
    if (values[i] !== value) { fromScroll.current = !!el; onChange(values[i]) }
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      pick(Math.min(values.length - 1, Math.max(0, index + (e.key === 'ArrowDown' ? 1 : -1))))
    }
  }

  return (
    <div className="wheel-col">
      <div className="wheel" role="spinbutton" tabIndex={0} aria-label={label} aria-valuenow={value} aria-valuetext={`${format(value)}${unit ? ` ${unit}` : ''}`}
        aria-valuemin={values[0]} aria-valuemax={values[values.length - 1]} onKeyDown={onKey}>
        <div className="wheel-band" aria-hidden />
        <div className="wheel-scroll" ref={ref} onScroll={onScroll}>
          <div style={{ height: ITEM * 2 }} />
          {values.map((v, i) => (
            <div key={v} className={`wheel-item${i === index ? ' on' : ''}`} style={{ height: ITEM }} onClick={() => pick(i)}>{format(v)}</div>
          ))}
          <div style={{ height: ITEM * 2 }} />
        </div>
      </div>
      {unit && <div className="wheel-unit">{unit}</div>}
    </div>
  )
}

export const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step)
export const pad2 = (n: number) => String(n).padStart(2, '0')

/** Minutter og sekunder på to hjul. */
export function DurationWheel({ seconds, onChange, maxMin = 60, secStep = 5, label }: { seconds: number; onChange: (s: number) => void; maxMin?: number; secStep?: number; label: string }) {
  const m = Math.floor(seconds / 60), s = Math.round((seconds % 60) / secStep) * secStep
  return (
    <div className="wheels">
      <Wheel label={`${label}, minutter`} values={range(0, maxMin)} value={Math.min(m, maxMin)} onChange={(v) => onChange(v * 60 + s)} unit="min" />
      <div className="wheel-colon">:</div>
      <Wheel label={`${label}, sekunder`} values={range(0, 60 - secStep, secStep)} value={s % 60} onChange={(v) => onChange(m * 60 + v)} format={pad2} unit="sek" />
    </div>
  )
}
