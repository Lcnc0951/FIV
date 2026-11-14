// Gjør MediaPipe-landemerker + personmaske om til kroppsmål i cm.
// Målestokk: brukerens høyde (cm) delt på kroppens høyde i piksler.
import { ellipseCircumference } from '../engine/composition'
import type { ScanMeasurements } from '../engine/types'

export interface Pt { x: number; y: number; v?: number } // piksler, v = synlighet 0–1
export interface Mask { width: number; height: number; data: Float32Array | Uint8Array } // 0–1 eller 0–255
export interface Detection { landmarks: Pt[]; mask: Mask; width: number; height: number }

/** MediaPipe Pose-indekser */
export const LM = {
  nose: 0, leftEar: 7, rightEar: 8, leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16, leftHip: 23, rightHip: 24, leftKnee: 25, rightKnee: 26,
  leftAnkle: 27, rightAnkle: 28, leftHeel: 29, rightHeel: 30, leftFoot: 31, rightFoot: 32,
} as const

export interface Line { a: Pt; b: Pt; label: string }
export interface ViewResult { ok: true; widthsCm: Record<string, number>; extras: Record<string, number>; lines: Line[]; scale: number }
export interface ViewError { ok: false; error: string }

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

function isPerson(m: Mask, x: number, y: number): boolean {
  const xi = Math.round(x), yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= m.width || yi >= m.height) return false
  const v = m.data[yi * m.width + xi]
  return m.data instanceof Uint8Array ? v > 127 : v > 0.5
}

/** Silhuettens bredde (px) gjennom punktet p, vinkelrett på aksen a→b. */
export function silhouetteWidth(m: Mask, p: Pt, axisFrom: Pt, axisTo: Pt): { width: number; e1: Pt; e2: Pt } | null {
  const dx = axisTo.x - axisFrom.x, dy = axisTo.y - axisFrom.y
  const len = Math.hypot(dx, dy)
  if (len < 1 || !isPerson(m, p.x, p.y)) return null
  const perp = { x: -dy / len, y: dx / len }
  const walk = (sign: number): Pt | null => {
    let last = p, misses = 0
    const maxSteps = Math.max(m.width, m.height)
    for (let i = 1; i < maxSteps; i++) {
      const q = { x: p.x + perp.x * sign * i, y: p.y + perp.y * sign * i }
      if (q.x < 1 || q.y < 1 || q.x > m.width - 2 || q.y > m.height - 2) return null // traff kanten
      if (isPerson(m, q.x, q.y)) { last = q; misses = 0 } else if (++misses > 2) return last
    }
    return null
  }
  const e1 = walk(1), e2 = walk(-1)
  if (!e1 || !e2) return null
  return { width: dist(e1, e2) + 1, e1, e2 }
}

/** Kroppens høyde i piksler: øverste maskepiksel over hodet til laveste hæl/tå. */
function bodyPixelHeight(d: Detection): { top: number; bottom: number } | null {
  const L = d.landmarks
  const feet = [L[LM.leftHeel], L[LM.rightHeel], L[LM.leftFoot], L[LM.rightFoot], L[LM.leftAnkle], L[LM.rightAnkle]]
  const bottom = Math.max(...feet.map((p) => p.y))
  const nose = L[LM.nose]
  // Finn toppen av hodet i masken rundt nesens x
  let top = nose.y
  const span = Math.max(4, Math.round(dist(L[LM.leftShoulder], L[LM.rightShoulder]) * 0.25) || 12)
  for (let y = Math.round(nose.y); y >= 0; y--) {
    let any = false
    for (let x = Math.round(nose.x - span); x <= nose.x + span; x += 2) if (isPerson(d.mask, x, y)) { any = true; break }
    if (any) top = y; else if (nose.y - y > 4) break
  }
  if (bottom - top < d.height * 0.3) return null
  return { top, bottom }
}

function visible(d: Detection, idx: number[], min = 0.5) {
  return idx.every((i) => (d.landmarks[i]?.v ?? 1) >= min)
}

export function analyzeFront(d: Detection, heightCm: number): ViewResult | ViewError {
  const L = d.landmarks
  if (!visible(d, [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip])) return { ok: false, error: 'Fant ikke skuldre og hofter. Stå rett mot kameraet med hele kroppen synlig.' }
  if (!visible(d, [LM.leftAnkle, LM.rightAnkle], 0.3)) return { ok: false, error: 'Føttene må være med i bildet.' }
  const h = bodyPixelHeight(d)
  if (!h) return { ok: false, error: 'Kroppen er for liten i bildet. Gå nærmere, men behold hele kroppen i bildet.' }
  const scale = heightCm / (h.bottom - h.top) // cm per piksel
  const ls = L[LM.leftShoulder], rs = L[LM.rightShoulder], lh = L[LM.leftHip], rh = L[LM.rightHip]
  if (dist(ls, rs) * scale < 22) return { ok: false, error: 'Dette ser ut som et bilde fra siden. Første bilde skal tas forfra.' }
  const S = mid(ls, rs), H = mid(lh, rh)
  const widths: Record<string, number> = {}, lines: Line[] = []
  const measure = (key: string, label: string, p: Pt, a: Pt, b: Pt) => {
    const r = silhouetteWidth(d.mask, p, a, b)
    if (r) { widths[key] = r.width * scale; lines.push({ a: r.e1, b: r.e2, label }) }
  }
  measure('neck', 'Hals', lerp(S, L[LM.nose], 0.45), S, L[LM.nose])
  measure('chest', 'Bryst', lerp(H, S, 0.67), H, S)
  measure('waist', 'Midje', lerp(H, S, 0.27), H, S)
  measure('hip', 'Hofte', lerp(H, S, -0.05), H, S)
  measure('armL', 'Arm V', lerp(ls, L[LM.leftElbow], 0.5), ls, L[LM.leftElbow])
  measure('armR', 'Arm H', lerp(rs, L[LM.rightElbow], 0.5), rs, L[LM.rightElbow])
  measure('thighL', 'Lår V', lerp(lh, L[LM.leftKnee], 0.35), lh, L[LM.leftKnee])
  measure('thighR', 'Lår H', lerp(rh, L[LM.rightKnee], 0.35), rh, L[LM.rightKnee])

  const tilt = (l: Pt, r: Pt) => Math.atan2(r.y - l.y, Math.abs(l.x - r.x)) * 180 / Math.PI // + = venstre høyest
  const extras: Record<string, number> = {
    shoulderTilt: tilt(ls, rs), hipTilt: tilt(lh, rh), shoulderWidth: dist(ls, rs) * scale,
    measuredHeight: heightCm,
    armLenL: (dist(ls, L[LM.leftElbow]) + dist(L[LM.leftElbow], L[LM.leftWrist])) * scale,
    armLenR: (dist(rs, L[LM.rightElbow]) + dist(L[LM.rightElbow], L[LM.rightWrist])) * scale,
    legLenL: (dist(lh, L[LM.leftKnee]) + dist(L[LM.leftKnee], L[LM.leftAnkle])) * scale,
    legLenR: (dist(rh, L[LM.rightKnee]) + dist(L[LM.rightKnee], L[LM.rightAnkle])) * scale,
  }
  // A-stilling kreves for armmål: armen må ikke ligge inntil kroppen
  const armGap = Math.min(Math.abs(L[LM.leftWrist].x - lh.x), Math.abs(L[LM.rightWrist].x - rh.x)) * scale
  if (armGap < 12) { delete widths.armL; delete widths.armR; delete widths.waist; delete widths.chest; delete widths.hip }
  if (widths.waist == null) return { ok: false, error: 'Fikk ikke målt midjen. Løft armene litt ut fra kroppen (A-stilling) og ta bildet på nytt.' }
  return { ok: true, widthsCm: widths, extras, lines, scale }
}

export function analyzeSide(d: Detection, heightCm: number): ViewResult | ViewError {
  const L = d.landmarks
  // Fra siden ser vi best den ene siden — bruk den mest synlige
  const leftVis = (L[LM.leftShoulder].v ?? 1) + (L[LM.leftHip].v ?? 1)
  const rightVis = (L[LM.rightShoulder].v ?? 1) + (L[LM.rightHip].v ?? 1)
  const s = leftVis >= rightVis ? 'left' : 'right'
  const sh = L[s === 'left' ? LM.leftShoulder : LM.rightShoulder], hip = L[s === 'left' ? LM.leftHip : LM.rightHip]
  const ear = L[s === 'left' ? LM.leftEar : LM.rightEar]
  if ((sh.v ?? 1) < 0.4 || (hip.v ?? 1) < 0.4) return { ok: false, error: 'Fant ikke skulder og hofte. Stå sidelengs med hele kroppen i bildet.' }
  const h = bodyPixelHeight(d)
  if (!h) return { ok: false, error: 'Kroppen er for liten i bildet.' }
  const scale = heightCm / (h.bottom - h.top)
  if (dist(L[LM.leftShoulder], L[LM.rightShoulder]) * scale > 18) return { ok: false, error: 'Dette ser ut som et bilde forfra. Snu deg en kvart runde, så kameraet ser deg fra siden.' }
  // Hvilken vei vender personen? Nesen peker fremover.
  const facing = Math.sign(L[LM.nose].x - ear.x) || 1
  const S = mid(L[LM.leftShoulder], L[LM.rightShoulder]), H = mid(L[LM.leftHip], L[LM.rightHip])
  const widths: Record<string, number> = {}, lines: Line[] = []
  const edges: Record<string, { e1: Pt; e2: Pt }> = {}
  const measure = (key: string, label: string, p: Pt, a: Pt, b: Pt) => {
    const r = silhouetteWidth(d.mask, p, a, b)
    if (r) { widths[key] = r.width * scale; lines.push({ a: r.e1, b: r.e2, label }); edges[key] = r }
  }
  measure('neck', 'Hals', lerp(S, L[LM.nose], 0.45), S, L[LM.nose])
  measure('chest', 'Bryst', lerp(H, S, 0.67), H, S)
  measure('waist', 'Midje', lerp(H, S, 0.27), H, S)
  measure('hip', 'Hofte', lerp(H, S, -0.05), H, S)

  const extras: Record<string, number> = {}
  // Hode foran skulder: øret foran skulderleddet langs blikkretningen
  if ((ear.v ?? 1) > 0.4) extras.forwardHead = Math.max(0, (ear.x - sh.x) * facing * scale)
  // Skuldre foran midtlinjen av overkroppen (på brysthøyde)
  if (edges.chest) {
    const center = (edges.chest.e1.x + edges.chest.e2.x) / 2
    extras.roundedShoulders = (sh.x - center) * facing * scale
  }
  // Øvre rygg-kurve fra ryggens kontur: vinkel mellom nedre og øvre del av ryggen
  const backEdge = (t: number): Pt | null => {
    const p = lerp(H, S, t)
    const r = silhouetteWidth(d.mask, p, H, S)
    if (!r) return null
    return (r.e1.x - r.e2.x) * facing < 0 ? r.e1 : r.e2 // kanten bak (motsatt blikket)
  }
  const pts = (from: number, to: number) => {
    const out: Pt[] = []
    for (let t = from; t <= to + 1e-9; t += 0.05) { const p = backEdge(t); if (p) out.push(p) }
    return out
  }
  const slope = (ps: Pt[]) => { // vinkel fra loddlinjen, + = lener fremover
    if (ps.length < 3) return null
    const a = ps[0], b = ps[ps.length - 1]
    return Math.atan2((b.x - a.x) * facing, a.y - b.y) * 180 / Math.PI
  }
  const lower = slope(pts(0.35, 0.65)), upper = slope(pts(0.7, 1.0))
  if (lower != null && upper != null) extras.thoracic = upper - lower
  if (widths.waist == null) return { ok: false, error: 'Fikk ikke målt midjen fra siden. La armene henge litt foran eller bak kroppen og prøv igjen.' }
  return { ok: true, widthsCm: widths, extras, lines, scale }
}

const r1 = (v?: number) => (v == null || !Number.isFinite(v) ? undefined : Math.round(v * 10) / 10)

/** Slår sammen forfra og fra siden til samme format som iOS-appens LiDAR-skann. */
export function combine(front: ViewResult, side: ViewResult): ScanMeasurements {
  const w = front.widthsCm, dpt = side.widthsCm, e = front.extras, s = side.extras
  const ell = (k: string) => (w[k] != null && dpt[k] != null ? ellipseCircumference(w[k], dpt[k]) : undefined)
  return {
    measuredHeightCm: r1(e.measuredHeight), shoulderWidthCm: r1(e.shoulderWidth),
    neckCm: r1(ell('neck')), chestCm: r1(ell('chest')), waistCm: r1(ell('waist')), hipCm: r1(ell('hip')),
    upperArmLeftCm: r1(w.armL != null ? w.armL * Math.PI : undefined), upperArmRightCm: r1(w.armR != null ? w.armR * Math.PI : undefined),
    thighLeftCm: r1(w.thighL != null ? w.thighL * Math.PI : undefined), thighRightCm: r1(w.thighR != null ? w.thighR * Math.PI : undefined),
    armLengthLeftCm: r1(e.armLenL), armLengthRightCm: r1(e.armLenR), legLengthLeftCm: r1(e.legLenL), legLengthRightCm: r1(e.legLenR),
    shoulderTiltDeg: r1(e.shoulderTilt), hipTiltDeg: r1(e.hipTilt),
    forwardHeadCm: r1(s.forwardHead), roundedShouldersCm: r1(s.roundedShoulders), thoracicAngleDeg: r1(s.thoracic),
    usedLiDAR: false, sampleCount: 2,
  }
}
