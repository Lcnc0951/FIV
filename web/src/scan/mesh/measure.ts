// Måler kroppen på en 3D-modell (mesh eller punktsky) fra en LiDAR-skanneapp.
// Prinsipp: finn gulvet og personen, ta vannrette snitt gjennom kroppen i kjente høyder
// (andel av kroppshøyden) og mål omkretsen av snittet slik et stramt målebånd gjør (konveks omkrets).
// Overarmene måles vinkelrett på armens retning, så en arm som peker skrått ut ikke gir for stort mål.
import type { ScanMeasurements, Sex } from '../../engine/types'
import type { Mesh } from './files'

export type UpAxis = 'auto' | 'x' | 'y' | 'z'
export interface MeshOptions { sex: Sex; up?: UpAxis; profileHeightCm?: number }

export interface PreviewLine { label: string; h: number; x1: number; x2: number }
export interface MeshPreview {
  /** par av (sideveis posisjon, høyde over gulvet) i meter, sett forfra */
  points: Float32Array
  lines: PreviewLine[]
  heightM: number
}
export interface MeshAnalysis {
  measurements: ScanMeasurements
  heightCm: number
  unit: 'm' | 'cm' | 'mm'
  up: 'x' | 'y' | 'z'
  sidesKnown: boolean
  isPointCloud: boolean
  warnings: string[]
  preview: MeshPreview
}

type V2 = [number, number]
interface Cluster { pts: V2[]; cx: number; cy: number; perimeter: number; hull: V2[] }

const AXES = ['x', 'y', 'z'] as const
const BIN = 0.01 // 1 cm

export function analyzeMesh(mesh: Mesh, opts: MeshOptions): MeshAnalysis {
  if (opts.up && opts.up !== 'auto') return analyzeWithUp(mesh, opts, AXES.indexOf(opts.up), false)
  // Prøv den mest sannsynlige opp-aksen først, så de andre. Velg den der vi finner en stående person.
  const { positions, indices } = mesh
  const ext = extents(positions)
  const first = pickUp(positions, indices, ext)
  let lastError: unknown
  for (const k of [first, 1, 2, 0].filter((v, i, a) => a.indexOf(v) === i)) {
    try {
      const r = analyzeWithUp(mesh, opts, k, true)
      if (r.measurements.waistCm != null) return r
      lastError ??= new Error('Fant ikke midjen i modellen.')
    } catch (e) { lastError = e }
  }
  throw lastError
}

function extents(positions: Float32Array): number[] {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i + 2 < positions.length; i += 3) for (let k = 0; k < 3; k++) {
    const v = positions[i + k]
    if (Number.isFinite(v)) { if (v < lo[k]) lo[k] = v; if (v > hi[k]) hi[k] = v }
  }
  return [0, 1, 2].map((k) => hi[k] - lo[k])
}

function analyzeWithUp(mesh: Mesh, opts: MeshOptions, upIdx: number, autoFlip: boolean): MeshAnalysis {
  const { positions, indices } = mesh
  const n = Math.floor(positions.length / 3)
  const nTri = Math.floor(indices.length / 3)
  const isPointCloud = nTri === 0
  const warnings: string[] = []

  // 1. Enheter ut fra størrelsen på modellen
  const E = Math.max(...extents(positions))
  const unit: MeshAnalysis['unit'] = E <= 30 ? 'm' : E <= 1000 ? 'cm' : 'mm'
  const scale = unit === 'm' ? 1 : unit === 'cm' ? 0.01 : 0.001

  // 2. Akser: h langs opp-aksen
  const e1 = (upIdx + 1) % 3, e2 = (upIdx + 2) % 3
  let sign = 1
  const A = new Float32Array(n), B = new Float32Array(n), Hh = new Float32Array(n)
  const fill = () => {
    for (let i = 0; i < n; i++) {
      // (a, b, h) er alltid et høyrehendt system
      A[i] = positions[i * 3 + e1] * scale * sign
      B[i] = positions[i * 3 + e2] * scale
      Hh[i] = positions[i * 3 + upIdx] * scale * sign
    }
  }
  fill()

  // 3. Gulvet: laveste høyde med mye vannrett flate
  const triNormalH = (t: number): { area: number; h: number; c: number } => {
    const i0 = indices[t * 3], i1 = indices[t * 3 + 1], i2 = indices[t * 3 + 2]
    const ux = A[i1] - A[i0], uy = B[i1] - B[i0], uz = Hh[i1] - Hh[i0]
    const vx = A[i2] - A[i0], vy = B[i2] - B[i0], vz = Hh[i2] - Hh[i0]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz)
    return { area: len / 2, h: len > 0 ? Math.abs(nz) / len : 0, c: (Hh[i0] + Hh[i1] + Hh[i2]) / 3 }
  }
  const floorFrom = (): number | null => {
    if (isPointCloud) return null
    let hmin = Infinity, hmax = -Infinity
    for (let i = 0; i < n; i++) { if (Hh[i] < hmin) hmin = Hh[i]; if (Hh[i] > hmax) hmax = Hh[i] }
    const bins = new Float64Array(Math.ceil((hmax - hmin) / BIN) + 2)
    for (let t = 0; t < nTri; t++) {
      const { area, h, c } = triNormalH(t)
      if (h > 0.9) bins[Math.floor((c - hmin) / BIN)] += area
    }
    let best = -1
    for (let b = 0; b < bins.length; b++) if (bins[b] > 0.03) { best = b; break }
    if (best < 0) return null
    // Gulvet ligger øverst i modellen → den står på hodet
    if (autoFlip) {
      let top = -1
      for (let b = bins.length - 1; b >= 0; b--) if (bins[b] > 0.03) { top = b; break }
      const total = bins.reduce((s, v) => s + v, 0)
      const upper = bins.slice(Math.floor(bins.length / 2)).reduce((s, v) => s + v, 0)
      if (top >= 0 && upper > total * 0.6 && bins[top] > bins[best] * 2) return NaN
    }
    let peak = best
    for (let b = best; b < Math.min(bins.length, best + 5); b++) if (bins[b] > bins[peak]) peak = b
    return hmin + (peak + 0.5) * BIN
  }
  let floor = floorFrom()
  if (Number.isNaN(floor)) { sign = -1; fill(); floor = floorFrom() }
  if (floor == null || Number.isNaN(floor)) floor = percentile(Hh, 0.002)

  // 4. Personen: midten av kroppen og høyden
  let c: V2 = medianAB(A, B, Hh, (i) => Hh[i] > floor! + 0.5 && Hh[i] < floor! + 1.3)
  if (!Number.isFinite(c[0])) throw new Error('Fant ingen person i modellen.')
  const c0 = c
  c = medianAB(A, B, Hh, (i) => Hh[i] > floor! + 0.5 && Hh[i] < floor! + 1.3 && Math.hypot(A[i] - c0[0], B[i] - c0[1]) < 0.5)
  const tops: number[] = []
  for (let i = 0; i < n; i++) if (Hh[i] > floor + 0.3 && Math.hypot(A[i] - c[0], B[i] - c[1]) < 0.3) tops.push(Hh[i])
  tops.sort((x, y) => x - y)
  const H = (tops[Math.floor(tops.length * 0.999)] ?? floor) - floor
  if (!(H >= 1.0 && H <= 2.3)) {
    throw new Error(`Fant ingen hel, stående person i modellen (fant ${Math.round(H * 100)} cm). Skann hele kroppen fra hode til føtter, og beskjær bort omgivelsene i skanneappen.`)
  }
  const at = (x: number) => floor! + x * H

  // 5. Behold bare det som hører til personen, sortert i 1 cm-lag
  const nBins = Math.ceil((H + 0.1) / BIN) + 1
  const bins: number[][] = Array.from({ length: nBins }, () => [])
  const binOf = (h: number) => Math.floor((h - floor!) / BIN)
  const near = (i: number) => Math.hypot(A[i] - c[0], B[i] - c[1]) < 0.85
  if (isPointCloud) {
    for (let i = 0; i < n; i++) {
      const b = binOf(Hh[i])
      if (Hh[i] > floor + 0.012 && b >= 0 && b < nBins && near(i)) bins[b].push(i)
    }
  } else {
    for (let t = 0; t < nTri; t++) {
      const i0 = indices[t * 3], i1 = indices[t * 3 + 1], i2 = indices[t * 3 + 2]
      const mn = Math.min(Hh[i0], Hh[i1], Hh[i2]), mx = Math.max(Hh[i0], Hh[i1], Hh[i2])
      if (mx < floor + 0.012 || !near(i0)) continue // bare gulvet selv fjernes
      for (let b = Math.max(0, binOf(mn)); b <= Math.min(nBins - 1, binOf(mx)); b++) bins[b].push(t)
    }
  }

  const sliceH = (y: number): V2[] => {
    const b = binOf(y)
    if (b < 0 || b >= nBins) return []
    const out: V2[] = []
    if (isPointCloud) {
      for (let k = Math.max(0, b - 1); k <= Math.min(nBins - 1, b + 1); k++) {
        for (const i of bins[k]) if (Math.abs(Hh[i] - y) < 0.005) out.push([A[i], B[i]])
      }
      return out
    }
    for (const t of bins[b]) {
      const v = [indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]]
      const seg: V2[] = []
      for (let e = 0; e < 3; e++) {
        const i = v[e], j = v[(e + 1) % 3]
        const di = Hh[i] - y, dj = Hh[j] - y
        if ((di < 0 && dj >= 0) || (di >= 0 && dj < 0)) {
          const s = di / (di - dj)
          seg.push([A[i] + (A[j] - A[i]) * s, B[i] + (B[j] - B[i]) * s])
        }
      }
      addSegment(out, seg)
    }
    return out
  }

  /** Snitt med et vilkårlig plan (punkt o, normal d). Gir punkter i planets eget 2D-system med o i origo. */
  const slicePlane = (o: [number, number, number], d: [number, number, number]): V2[] => {
    const helper: [number, number, number] = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
    const s = normalize(cross(d, helper)), t = cross(d, s)
    const out: V2[] = []
    const proj = (a: number, b: number, h: number): V2 => {
      const x = a - o[0], y = b - o[1], z = h - o[2]
      return [x * s[0] + y * s[1] + z * s[2], x * t[0] + y * t[1] + z * t[2]]
    }
    const dist = (i: number) => (A[i] - o[0]) * d[0] + (B[i] - o[1]) * d[1] + (Hh[i] - o[2]) * d[2]
    const seen = new Set<number>()
    for (let b = Math.max(0, binOf(o[2] - 0.3)); b <= Math.min(nBins - 1, binOf(o[2] + 0.3)); b++) {
      for (const t of bins[b]) {
        if (seen.has(t)) continue
        seen.add(t)
        if (isPointCloud) { if (Math.abs(dist(t)) < 0.005) out.push(proj(A[t], B[t], Hh[t])); continue }
        const v = [indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]]
        const ds = v.map(dist)
        const seg: V2[] = []
        for (let e = 0; e < 3; e++) {
          const di = ds[e], dj = ds[(e + 1) % 3]
          if ((di < 0 && dj >= 0) || (di >= 0 && dj < 0)) {
            const i = v[e], j = v[(e + 1) % 3], k = di / (di - dj)
            seg.push(proj(A[i] + (A[j] - A[i]) * k, B[i] + (B[j] - B[i]) * k, Hh[i] + (Hh[j] - Hh[i]) * k))
          }
        }
        addSegment(out, seg)
      }
    }
    return out
  }

  const eps = isPointCloud ? 0.03 : 0.02
  const clustersAt = (y: number) => clusterPoints(sliceH(y), eps)
  const nearestTo = (cl: Cluster[], p: V2, minPerim = 0.2) =>
    cl.filter((k) => k.perimeter >= minPerim).sort((x, y) => Math.hypot(x.cx - p[0], x.cy - p[1]) - Math.hypot(y.cx - p[0], y.cy - p[1]))[0] ?? null
  const torso = (y: number) => nearestTo(clustersAt(y), c)

  // 6. Hvilken vei personen står: føttene stikker frem foran anklene
  const meanOf = (pts: V2[]): V2 | null => pts.length ? [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length] : null
  const within = (pts: V2[], r: number) => pts.filter((p) => Math.hypot(p[0] - c[0], p[1] - c[1]) < r)
  const foot = meanOf(within(sliceH(floor + 0.03), 0.45)), ankle = meanOf(within(sliceH(floor + 0.11), 0.45))
  let forward: V2 = [1, 0]
  let sidesKnown = false
  if (foot && ankle && Math.hypot(foot[0] - ankle[0], foot[1] - ankle[1]) > 0.02) {
    const v: V2 = [foot[0] - ankle[0], foot[1] - ankle[1]]
    const l = Math.hypot(v[0], v[1])
    forward = [v[0] / l, v[1] / l]
    sidesKnown = true
  } else {
    // Bruk overkroppens bredeste retning som side-til-side
    const waistPts = torso(at(0.62))?.pts
    if (waistPts) { const major = principal(waistPts); forward = [-major[1], major[0]] }
    warnings.push('Fant ikke hvilken vei du står. Venstre og høyre kan være byttet om.')
  }
  const right: V2 = [forward[1], -forward[0]] // forover × opp
  const lat = (p: V2) => (p[0] - c[0]) * right[0] + (p[1] - c[1]) * right[1]
  const latRange = (k: Cluster): [number, number] => { const ls = k.hull.map(lat); return [Math.min(...ls), Math.max(...ls)] }

  const m: ScanMeasurements = { usedLiDAR: true }
  const lines: PreviewLine[] = []
  let samples = 0
  const record = (label: string, y: number, k: Cluster | null) => { if (k) { const [x1, x2] = latRange(k); lines.push({ label, h: y - floor!, x1, x2 }) } }
  const range = (x0: number, x1: number, step = 0.005) => { const out: number[] = []; for (let y = at(x0); y <= at(x1) + 1e-9; y += step) out.push(y); return out }
  const best = (ys: number[], pick: 'min' | 'max' | 'median', lo: number, hi: number) => {
    const found = ys.map((y) => ({ y, k: torso(y) })).filter((r) => r.k && r.k.perimeter >= lo && r.k.perimeter <= hi) as { y: number; k: Cluster }[]
    samples += found.length
    if (!found.length) return null
    found.sort((a, b) => a.k.perimeter - b.k.perimeter)
    return pick === 'min' ? found[0] : pick === 'max' ? found[found.length - 1] : found[Math.floor(found.length / 2)]
  }

  // 7. Omkretser på overkroppen
  const neck = best(range(0.80, 0.87), 'min', 0.24, 0.6)
  const chest = best(range(0.71, 0.73), 'median', 0.6, 1.8)
  const waist = opts.sex === 'female' ? best(range(0.60, 0.67), 'min', 0.5, 1.8) : best(range(0.59, 0.61), 'median', 0.5, 1.8)
  const hip = best(range(0.47, 0.56), 'max', 0.6, 1.9)
  if (neck) { m.neckCm = cm(neck.k.perimeter); record('Hals', neck.y, neck.k) }
  if (chest) { m.chestCm = cm(chest.k.perimeter); record('Bryst', chest.y, chest.k) }
  if (waist) { m.waistCm = cm(waist.k.perimeter); record('Midje', waist.y, waist.k) }
  if (hip) { m.hipCm = cm(hip.k.perimeter); record('Hofte', hip.y, hip.k) }

  // 8. Skrittet: øverste høyde der beina er to separate snitt
  let crotch: number | null = null
  for (let y = at(0.56); y >= at(0.38); y -= 0.005) {
    const legs = clustersAt(y).filter((k) => k.perimeter > 0.25 && Math.abs(lat([k.cx, k.cy])) < 0.25)
    if (legs.some((k) => lat([k.cx, k.cy]) > 0.02) && legs.some((k) => lat([k.cx, k.cy]) < -0.02)) { crotch = y; break }
  }
  if (crotch == null) warnings.push('Lårene henger sammen i modellen. Stå med føttene litt fra hverandre neste gang.')
  const crotchY = crotch ?? at(0.47)

  // 9. Lår: største omkrets like under skrittet, hver side for seg
  const thigh = { left: null as { y: number; k: Cluster } | null, right: null as { y: number; k: Cluster } | null }
  for (let y = crotchY - 0.06 * H; y <= crotchY - 0.012 * H; y += 0.005) {
    let legs = clustersAt(y).filter((k) => k.perimeter > 0.2 && Math.abs(lat([k.cx, k.cy])) < 0.25)
    if (legs.length === 1) {
      // Lårene henger sammen: del i midten
      const pts = legs[0].pts
      legs = [pts.filter((p) => lat(p) > 0), pts.filter((p) => lat(p) <= 0)].map(makeCluster).filter((k): k is Cluster => !!k)
    }
    for (const k of legs) {
      if (k.perimeter < 0.28 || k.perimeter > 0.95) continue
      const side = lat([k.cx, k.cy]) > 0 ? 'right' : 'left'
      if (!thigh[side] || k.perimeter > thigh[side]!.k.perimeter) thigh[side] = { y, k }
      samples++
    }
  }
  if (thigh.left) { m.thighLeftCm = cm(thigh.left.k.perimeter); record('Lår V', thigh.left.y, thigh.left.k) }
  if (thigh.right) { m.thighRightCm = cm(thigh.right.k.perimeter); record('Lår H', thigh.right.y, thigh.right.k) }

  // 10. Overarmer: følg armen nedover, mål vinkelrett på den
  const armTrack: Record<'left' | 'right', [number, number, number][]> = { left: [], right: [] }
  for (const y of range(0.64, 0.79, 0.01)) {
    const cl = clustersAt(y)
    const body = nearestTo(cl, c)
    for (const k of cl) {
      if (k === body || k.perimeter < 0.12 || k.perimeter > 0.55) continue
      const l = lat([k.cx, k.cy])
      if (Math.abs(l) < 0.12) continue
      const side = l > 0 ? 'right' : 'left'
      const prev = armTrack[side].find((p) => Math.abs(p[2] - y) < 1e-6)
      if (!prev) armTrack[side].push([k.cx, k.cy, y])
    }
  }
  for (const side of ['left', 'right'] as const) {
    const tr = armTrack[side]
    if (tr.length < 5) continue
    const ym = tr.reduce((s, p) => s + p[2], 0) / tr.length
    const fit = (k: 0 | 1) => {
      const mean = tr.reduce((s, p) => s + p[k], 0) / tr.length
      let num = 0, den = 0
      for (const p of tr) { num += (p[2] - ym) * (p[k] - mean); den += (p[2] - ym) ** 2 }
      return { mean, slope: den > 0 ? num / den : 0 }
    }
    const fa = fit(0), fb = fit(1)
    const d = normalize([fa.slope, fb.slope, 1])
    if (d[2] < 0.5) continue // mer enn 60° fra loddrett: usikkert
    const y72 = at(0.72)
    const o: [number, number, number] = [fa.mean + fa.slope * (y72 - ym), fb.mean + fb.slope * (y72 - ym), y72]
    const arm = nearestTo(clusterPoints(slicePlane(o, d), eps), [0, 0], 0.15)
    if (!arm || arm.perimeter > 0.6 || Math.hypot(arm.cx, arm.cy) > 0.08) continue
    samples++
    const value = cm(arm.perimeter)
    if (side === 'left') m.upperArmLeftCm = value; else m.upperArmRightCm = value
    const l = lat([o[0], o[1]]), r = arm.perimeter / Math.PI / 2
    lines.push({ label: side === 'left' ? 'Arm V' : 'Arm H', h: y72 - floor, x1: l - r, x2: l + r })
  }
  if (m.upperArmLeftCm == null || m.upperArmRightCm == null) warnings.push('Fant ikke begge overarmene. Hold armene litt ut fra kroppen (A-stilling).')

  m.measuredHeightCm = cm(H)
  m.sampleCount = samples
  if (m.waistCm == null) warnings.push('Fant ikke midjen. Sjekk at hele overkroppen er med i skannet.')
  if (opts.profileHeightCm && Math.abs(H * 100 - opts.profileHeightCm) > 4) {
    warnings.push(`Høyden i modellen er ${Math.round(H * 100)} cm, mens profilen sier ${opts.profileHeightCm} cm. Sjekk at skannet har riktig skala.`)
  }
  if (isPointCloud) warnings.push('Filen er en punktsky. En 3D-modell (mesh) gir sikrere mål.')

  // Forhåndsvisning forfra: omrisset fra et snitt per centimeter
  const prev: number[] = []
  for (let y = floor + 0.01; y < floor + H; y += 0.01) {
    const pts = within(sliceH(y), 0.85)
    const stride = Math.max(1, Math.floor(pts.length / 160))
    for (let i = 0; i < pts.length; i += stride) prev.push(lat(pts[i]), y - floor)
  }

  return {
    measurements: m, heightCm: cm(H), unit, up: AXES[upIdx], sidesKnown, isPointCloud, warnings,
    preview: { points: new Float32Array(prev), lines, heightM: H },
  }
}

// MARK: Hjelpere

/** Legger til snittlinjen gjennom én trekant, med ekstra punkter så lange linjer ikke blir hull i snittet. */
function addSegment(out: V2[], seg: V2[]) {
  if (seg.length < 2) { if (seg.length) out.push(seg[0]); return }
  const [p, q] = seg
  const len = Math.hypot(q[0] - p[0], q[1] - p[1])
  if (len < 0.006) { out.push(p, q); return }
  const steps = Math.min(40, Math.ceil(len / 0.006))
  for (let k = 0; k <= steps; k++) { const t = steps ? k / steps : 0; out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]) }
}

const cm = (meters: number) => Math.round(meters * 1000) / 10

function pickUp(pos: Float32Array, idx: Uint32Array, ext: number[]): number {
  for (let k = 0; k < 3; k++) if (ext[k] > 1.35 * ext[(k + 1) % 3] && ext[k] > 1.35 * ext[(k + 2) % 3]) return k
  if (idx.length === 0) return 1
  const area = [0, 0, 0]
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const i0 = idx[t] * 3, i1 = idx[t + 1] * 3, i2 = idx[t + 2] * 3
    const u = [pos[i1] - pos[i0], pos[i1 + 1] - pos[i0 + 1], pos[i1 + 2] - pos[i0 + 2]]
    const v = [pos[i2] - pos[i0], pos[i2 + 1] - pos[i0 + 1], pos[i2 + 2] - pos[i0 + 2]]
    const nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const len = Math.hypot(nn[0], nn[1], nn[2])
    if (len === 0) continue
    for (let k = 0; k < 3; k++) if (Math.abs(nn[k]) / len > 0.95) area[k] += len / 2
  }
  const k = area.indexOf(Math.max(...area))
  return area[k] > 0 ? k : 1
}

function percentile(arr: Float32Array, q: number): number {
  const step = Math.max(1, Math.floor(arr.length / 200000))
  const s: number[] = []
  for (let i = 0; i < arr.length; i += step) if (Number.isFinite(arr[i])) s.push(arr[i])
  s.sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(s.length * q))]
}

function medianAB(A: Float32Array, B: Float32Array, H: Float32Array, keep: (i: number) => boolean): V2 {
  const step = Math.max(1, Math.floor(H.length / 200000))
  const as: number[] = [], bs: number[] = []
  for (let i = 0; i < H.length; i += step) if (keep(i)) { as.push(A[i]); bs.push(B[i]) }
  if (!as.length) return [NaN, NaN]
  as.sort((x, y) => x - y); bs.sort((x, y) => x - y)
  return [as[as.length >> 1], bs[bs.length >> 1]]
}

const cross = (a: number[], b: number[]): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const normalize = (v: number[]): [number, number, number] => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }

/** Hovedretning (største spredning) for et sett 2D-punkter. */
function principal(pts: V2[]): V2 {
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length
  let sxx = 0, syy = 0, sxy = 0
  for (const [x, y] of pts) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my) }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy)
  return [Math.cos(angle), Math.sin(angle)]
}

/** Grupperer punkter som ligger nærmere enn eps hverandre (armer, bein og overkropp blir egne grupper). */
export function clusterPoints(input: V2[], eps: number): Cluster[] {
  // Tette skann gir mange nesten like punkter: behold ett per 4 mm-rute (påvirker omkretsen < 1 mm)
  const seen = new Set<number>()
  const pts: V2[] = []
  for (const p of input) {
    const k = (Math.floor(p[0] / 0.004) + 32768) * 65536 + (Math.floor(p[1] / 0.004) + 32768)
    if (!seen.has(k)) { seen.add(k); pts.push(p) }
  }
  const grid = new Map<number, number[]>()
  const key = (gx: number, gy: number) => (gx + 32768) * 65536 + (gy + 32768)
  pts.forEach((p, i) => { const k = key(Math.floor(p[0] / eps), Math.floor(p[1] / eps)); const l = grid.get(k); if (l) l.push(i); else grid.set(k, [i]) })
  const label = new Int32Array(pts.length).fill(-1)
  const out: Cluster[] = []
  for (let s = 0; s < pts.length; s++) {
    if (label[s] >= 0) continue
    const id = out.length
    const members: V2[] = []
    const queue = [s]
    label[s] = id
    while (queue.length) {
      const i = queue.pop()!
      const [x, y] = pts[i]
      members.push(pts[i])
      const gx = Math.floor(x / eps), gy = Math.floor(y / eps)
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const cell = grid.get(key(gx + dx, gy + dy))
        if (!cell) continue
        for (const j of cell) {
          if (label[j] >= 0) continue
          if (Math.hypot(pts[j][0] - x, pts[j][1] - y) <= eps) { label[j] = id; queue.push(j) }
        }
      }
    }
    const k = makeCluster(members)
    out.push(k ?? { pts: members, cx: 0, cy: 0, perimeter: 0, hull: [] })
  }
  return out.filter((k) => k.pts.length >= 6 && k.perimeter >= 0.04)
}

function makeCluster(pts: V2[]): Cluster | null {
  if (pts.length < 3) return null
  const hull = convexHull(pts)
  let perimeter = 0
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length]
    perimeter += Math.hypot(a[0] - b[0], a[1] - b[1])
  }
  const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length, cy = hull.reduce((s, p) => s + p[1], 0) / hull.length
  return { pts, cx, cy, perimeter, hull }
}

export function convexHull(points: V2[]): V2[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const crossZ = (o: V2, a: V2, b: V2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: V2[] = [], upper: V2[] = []
  for (const q of p) { while (lower.length >= 2 && crossZ(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q) }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && crossZ(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q) }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}
