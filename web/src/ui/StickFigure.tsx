// Animert øvelsesfigur. Leser samme ExerciseAnimations.json som iOS-appen.
import { useEffect, useMemo, useRef } from 'react'
import raw from '../data/animations.json'
import type { Muscle } from '../engine/types'

type Pose = Record<string, number>
interface Prop { type: string; [k: string]: number | string }
interface Anim { view: 'side' | 'front'; anchor: { type: string; x?: number; y?: number }; props: Prop[]; a: Pose; b: Pose; up: number; down: number }

const DATA = raw as unknown as { animations: Record<string, Record<string, unknown>>; exercises: Record<string, string> }
const SHARED = ['thigh', 'shin', 'foot', 'upper', 'fore']
const merge = (base: Pose, add?: Pose) => {
  const p = { ...base }
  for (const [k, v] of Object.entries(add ?? {})) if (SHARED.includes(k)) { p[k + 'L'] = v; p[k + 'R'] = v }
  for (const [k, v] of Object.entries(add ?? {})) if (!SHARED.includes(k)) p[k] = v
  return p
}
const cache = new Map<string, Anim>()
export function animationNamed(name: string): Anim | undefined {
  if (cache.has(name)) return cache.get(name)
  const r = DATA.animations[name] as Record<string, unknown> | undefined
  if (!r) return undefined
  const front = r.view === 'front'
  let d: Pose = { trunk: 0, thighL: 0, thighR: 0, shinL: 0, shinR: 0, footL: 90, footR: 90, upperL: 0, upperR: 0, foreL: 0, foreR: 0 }
  if (front) d = { ...d, thighL: -4, thighR: 4, shinL: -2, shinR: 2 }
  const base = merge(d, r.base as Pose)
  const tempo = (r.tempo as number[]) ?? [1, 2]
  const anim: Anim = { view: front ? 'front' : 'side', anchor: r.anchor as Anim['anchor'], props: (r.props as Prop[]) ?? [],
    a: merge(base, r.a as Pose), b: merge(base, r.b as Pose), up: tempo[0], down: tempo[1] ?? 2 }
  cache.set(name, anim)
  return anim
}
export const animationFor = (exerciseId: string) => (DATA.exercises[exerciseId] ? animationNamed(DATA.exercises[exerciseId]) : undefined)

const SEG = { trunk: 0.52, neck: 0.07, head: 0.1, thigh: 0.46, shin: 0.44, foot: 0.14, upper: 0.3, fore: 0.28 }
type P = { x: number; y: number }
function joints(an: Anim, p: Pose): Record<string, P> {
  const rad = (d: number) => (d * Math.PI) / 180
  const limb = (o: P, a: number, l: number): P => ({ x: o.x + l * Math.sin(rad(a)), y: o.y - l * Math.cos(rad(a)) })
  const front = an.view === 'front'
  const t = rad(p.trunk), tv = { x: Math.sin(t), y: Math.cos(t) }
  const neck = { x: tv.x * SEG.trunk, y: tv.y * SEG.trunk }
  const j: Record<string, P> = { hip: { x: 0, y: 0 }, neck, head: { x: neck.x + tv.x * (SEG.neck + SEG.head), y: neck.y + tv.y * (SEG.neck + SEG.head) } }
  for (const [s, off] of [['L', -1], ['R', 1]] as const) {
    const hip = { x: front ? off * 0.1 : 0, y: 0 }, sh = { x: neck.x + (front ? off * 0.19 : 0), y: neck.y }
    const knee = limb(hip, p['thigh' + s], SEG.thigh), ankle = limb(knee, p['shin' + s], SEG.shin)
    const toe = front ? { x: ankle.x + off * 0.07, y: ankle.y } : limb(ankle, p['foot' + s], SEG.foot)
    const elbow = limb(sh, p['upper' + s], SEG.upper), wrist = limb(elbow, p['fore' + s], SEG.fore)
    Object.assign(j, { ['hip' + s]: hip, ['sh' + s]: sh, ['knee' + s]: knee, ['ankle' + s]: ankle, ['toe' + s]: toe, ['elbow' + s]: elbow, ['wrist' + s]: wrist })
  }
  let dx = 0, dy = 0
  const a = an.anchor
  if (a.type === 'hip') { dx = a.x ?? 0; dy = a.y ?? 0 }
  else if (a.type === 'hands') { dx = -j.wristL.x; dy = (a.y ?? 2) - j.wristL.y }
  else if (a.type === 'ankleL') { dx = (a.x ?? 0) - j.ankleL.x; dy = (a.y ?? 0) - j.ankleL.y }
  else {
    let minY = Math.min(...Object.entries(j).filter(([k]) => k !== 'head').map(([, v]) => v.y))
    minY = Math.min(minY, j.head.y - SEG.head)
    dy = -minY
  }
  for (const k in j) j[k] = { x: j[k].x + dx, y: j[k].y + dy }
  return j
}

const lerpPose = (a: Pose, b: Pose, t: number) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k] + ((b[k] ?? a[k]) - a[k]) * t]))

export function StickFigure({ anim, highlight, showPhase = true, size = 220 }: { anim: Anim; highlight?: Muscle; showPhase?: boolean; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const label = useRef<HTMLDivElement>(null)
  const bounds = useMemo(() => {
    const pts = [...Object.values(joints(anim, anim.a)), ...Object.values(joints(anim, anim.b)), { x: 0, y: 0 }]
    for (const pr of anim.props) for (const [xk, yk] of [['x1', 'y'], ['x2', 'y'], ['x', 'y'], ['x1', 'y1'], ['x2', 'y2']])
      if (typeof pr[xk] === 'number') pts.push({ x: pr[xk] as number, y: (pr[yk] as number) ?? 0 })
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
    return { minX: Math.min(...xs) - 0.25, maxX: Math.max(...xs) + 0.25, minY: Math.min(...ys) - 0.1, maxY: Math.max(...ys) + 0.25 }
  }, [anim])

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const draw = (now: number) => {
      const dpr = devicePixelRatio || 1
      const W = c.clientWidth, H = c.clientHeight
      if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const hold1 = 0.5, hold2 = 0.35, cycle = hold1 + anim.up + hold2 + anim.down
      const x = (now / 1000) % cycle
      const ease = (v: number) => v * v * (3 - 2 * v)
      let t: number, text: string
      if (reduce) { t = 0.5; text = '' }
      else if (x < hold1) { t = 0; text = 'Start' }
      else if (x < hold1 + anim.up) { t = ease((x - hold1) / anim.up); text = `Løft · ${anim.up.toLocaleString('nb-NO')} sek` }
      else if (x < hold1 + anim.up + hold2) { t = 1; text = 'Klem' }
      else { t = 1 - ease((x - hold1 - anim.up - hold2) / anim.down); text = `Senk kontrollert · ${anim.down.toLocaleString('nb-NO')} sek` }
      if (label.current && label.current.textContent !== text) label.current.textContent = text

      const bw = bounds.maxX - bounds.minX, bh = bounds.maxY - bounds.minY
      const s = Math.min(W / bw, H / bh), ox = (W - bw * s) / 2, oy = (H - bh * s) / 2
      const P = (p: P) => [ox + (p.x - bounds.minX) * s, oy + (bounds.maxY - p.y) * s] as const
      const css = getComputedStyle(c)
      const fg = css.getPropertyValue('--fg').trim() || '#222', muted = css.getPropertyValue('--muted').trim() || '#999'
      const accent = css.getPropertyValue('--accent').trim() || '#e5531a'
      const w = Math.max(3, 0.065 * s)
      const line = (a: P, b: P, color: string, width: number, alpha = 1) => {
        ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(...P(a)); ctx.lineTo(...P(b)); ctx.stroke(); ctx.globalAlpha = 1
      }
      const dot = (p: P, r: number, color: string, alpha = 1, stroke = false) => {
        const [cx, cy] = P(p); ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
        if (stroke) { ctx.strokeStyle = color; ctx.lineWidth = w * 0.45; ctx.stroke() } else { ctx.fillStyle = color; ctx.fill() }
        ctx.globalAlpha = 1
      }
      const j = joints(anim, lerpPose(anim.a, anim.b, t))
      line({ x: bounds.minX, y: 0 }, { x: bounds.maxX, y: 0 }, muted, 1.5, 0.5)
      for (const pr of anim.props) {
        const n = (k: string) => pr[k] as number
        if (pr.type === 'bench' || pr.type === 'seat' || pr.type === 'box') {
          const [x0, y0] = P({ x: n('x1'), y: n('y') }), [x1, y1] = P({ x: n('x2'), y: 0 })
          ctx.fillStyle = muted; ctx.globalAlpha = 0.35
          ctx.fillRect(x0, y0, x1 - x0, pr.type === 'seat' ? w * 0.8 : y1 - y0); ctx.globalAlpha = 1
        } else if (pr.type === 'line') line({ x: n('x1'), y: n('y1') }, { x: n('x2'), y: n('y2') }, muted, w * 0.8, 0.5)
        else if (pr.type === 'cable') line(j.wristL, { x: n('x'), y: n('y') }, '#2f9e5b', 1.5, 0.8)
        else if (pr.type === 'barbell') { if (anim.view === 'front') line(j.wristL, j.wristR, fg, w * 0.5); dot(j.wristL, 0.16 * s, fg, 0.8, true) }
        else if (pr.type === 'dumbbell' || pr.type === 'kettlebell') { const r = (pr.type === 'kettlebell' ? 0.075 : 0.055) * s; dot(j.wristR, r, fg, 0.3); dot(j.wristL, r, fg, 0.9) }
        else if (pr.type === 'barAtHands') { line({ x: j.wristL.x - 0.3, y: j.wristL.y }, { x: j.wristL.x + 0.3, y: j.wristL.y }, muted, 2, 0.6); dot(j.wristL, 0.035 * s, muted) }
        else if (pr.type === 'plateAtFeet') {
          const d = { x: j.ankleL.x - j.hip.x, y: j.ankleL.y - j.hip.y }, l = Math.hypot(d.x, d.y) || 1
          const nn = { x: (-d.y / l) * 0.25, y: (d.x / l) * 0.25 }
          line({ x: j.ankleL.x + nn.x, y: j.ankleL.y + nn.y }, { x: j.ankleL.x - nn.x, y: j.ankleL.y - nn.y }, muted, w * 0.7, 0.7)
        }
      }
      const segs: [string, string, Muscle[]][] = [['hip', 'knee', ['quads', 'hamstrings', 'glutes']], ['knee', 'ankle', ['calves']], ['ankle', 'toe', ['calves']], ['sh', 'elbow', ['biceps', 'triceps', 'sideDelts']], ['elbow', 'wrist', []]]
      const col = (m: Muscle[]) => (highlight && m.includes(highlight) ? accent : fg)
      const far = anim.view === 'front' ? 1 : 0.28
      for (const [a, b, m] of segs) line(j[a + 'R'], j[b + 'R'], col(m), w, far)
      const trunkM: Muscle[] = ['chest', 'lats', 'upperBack', 'abs']
      line(j.hip, j.neck, col(trunkM), w * 1.5)
      if (anim.view === 'front') { line(j.shL, j.shR, col(trunkM), w); line(j.hipL, j.hipR, fg, w) }
      for (const [a, b, m] of segs) line(j[a + 'L'], j[b + 'L'], col(m), w)
      dot(j.head, SEG.head * s, fg)
      if (!reduce) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [anim, bounds, highlight])

  return (
    <div className="figure" style={{ height: size }}>
      <canvas ref={canvas} aria-label="Animasjon som viser hvordan øvelsen utføres" role="img" />
      {showPhase && <div ref={label} className="figure-phase" />}
    </div>
  )
}
