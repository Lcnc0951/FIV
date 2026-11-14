import { describe, expect, it } from 'vitest'
import { analyzeFront, analyzeSide, combine, LM, type Detection, type Pt } from './measure'

// Tegner en syntetisk kroppssilhuett med kjente mål. 900 px kropp = 180 cm → 0,2 cm per piksel.
function paint(w: number, h: number, shapes: ((x: number, y: number) => boolean)[]): Uint8Array {
  const d = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (shapes.some((s) => s(x, y))) d[y * w + x] = 255
  return d
}
const circle = (cx: number, cy: number, r: number) => (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r
const rect = (x0: number, y0: number, x1: number, y1: number) => (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1
const seg = (a: Pt, b: Pt, r: number) => (x: number, y: number) => {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)))
  return (x - a.x - t * dx) ** 2 + (y - a.y - t * dy) ** 2 <= r * r
}

function landmarks(map: Partial<Record<keyof typeof LM, Pt>>): Pt[] {
  const out: Pt[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, v: 0 }))
  for (const [k, p] of Object.entries(map)) out[LM[k as keyof typeof LM]] = { ...p!, v: 0.99 }
  return out
}

function frontBody(): Detection {
  const W = 400, H = 1000
  const L = landmarks({
    nose: { x: 200, y: 110 }, leftEar: { x: 230, y: 100 }, rightEar: { x: 170, y: 100 },
    leftShoulder: { x: 260, y: 250 }, rightShoulder: { x: 140, y: 250 },
    leftElbow: { x: 310, y: 390 }, rightElbow: { x: 90, y: 390 }, leftWrist: { x: 350, y: 520 }, rightWrist: { x: 50, y: 520 },
    leftHip: { x: 225, y: 500 }, rightHip: { x: 175, y: 500 }, leftKnee: { x: 240, y: 720 }, rightKnee: { x: 160, y: 720 },
    leftAnkle: { x: 250, y: 930 }, rightAnkle: { x: 150, y: 930 }, leftHeel: { x: 250, y: 950 }, rightHeel: { x: 150, y: 950 },
    leftFoot: { x: 255, y: 950 }, rightFoot: { x: 145, y: 950 },
  })
  const data = paint(W, H, [
    circle(200, 100, 50), rect(185, 140, 215, 245), rect(150, 230, 250, 520),
    seg(L[LM.leftShoulder], L[LM.leftElbow], 20), seg(L[LM.leftElbow], L[LM.leftWrist], 15),
    seg(L[LM.rightShoulder], L[LM.rightElbow], 20), seg(L[LM.rightElbow], L[LM.rightWrist], 15),
    seg(L[LM.leftHip], L[LM.leftKnee], 28), seg(L[LM.leftKnee], L[LM.leftHeel], 20),
    seg(L[LM.rightHip], L[LM.rightKnee], 28), seg(L[LM.rightKnee], L[LM.rightHeel], 20),
  ])
  return { landmarks: L, mask: { width: W, height: H, data }, width: W, height: H }
}

function sideBody(): Detection {
  const W = 400, H = 1000
  const L = landmarks({
    nose: { x: 240, y: 110 }, leftEar: { x: 205, y: 100 }, rightEar: { x: 205, y: 100 },
    leftShoulder: { x: 195, y: 250 }, rightShoulder: { x: 197, y: 250 },
    leftElbow: { x: 195, y: 390 }, rightElbow: { x: 197, y: 390 }, leftWrist: { x: 200, y: 520 }, rightWrist: { x: 200, y: 520 },
    leftHip: { x: 200, y: 500 }, rightHip: { x: 202, y: 500 }, leftKnee: { x: 205, y: 720 }, rightKnee: { x: 205, y: 720 },
    leftAnkle: { x: 200, y: 930 }, rightAnkle: { x: 200, y: 930 }, leftHeel: { x: 195, y: 950 }, rightHeel: { x: 195, y: 950 },
    leftFoot: { x: 230, y: 950 }, rightFoot: { x: 230, y: 950 },
  })
  const data = paint(W, H, [
    circle(205, 100, 50), rect(185, 140, 220, 245), rect(160, 230, 240, 520),
    seg(L[LM.leftHip], L[LM.leftKnee], 30), seg(L[LM.leftKnee], L[LM.leftHeel], 20),
  ])
  return { landmarks: L, mask: { width: W, height: H, data }, width: W, height: H }
}

describe('kameraskanning', () => {
  it('måler forfra med riktig målestokk', () => {
    const r = analyzeFront(frontBody(), 180)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.scale).toBeCloseTo(0.2, 2)
    expect(r.widthsCm.waist).toBeCloseTo(20.2, 0) // 101 px
    expect(r.widthsCm.neck).toBeCloseTo(6.2, 0)
    expect(r.widthsCm.thighL).toBeGreaterThan(10)
    expect(Math.abs(r.extras.shoulderTilt)).toBeLessThan(0.5)
  })
  it('måler fra siden og slår sammen til omkretser', () => {
    const f = analyzeFront(frontBody(), 180), s = analyzeSide(sideBody(), 180)
    expect(f.ok && s.ok).toBe(true)
    if (!f.ok || !s.ok) return
    expect(s.widthsCm.waist).toBeCloseTo(16.2, 0) // 81 px
    const m = combine(f, s)
    // Ellipse 20,2 × 16,2 cm ≈ 57 cm
    expect(m.waistCm!).toBeGreaterThan(55); expect(m.waistCm!).toBeLessThan(59)
    expect(m.forwardHeadCm!).toBeCloseTo(2, 0)
  })
  it('avviser sidebilde som forfra-bilde', () => {
    const r = analyzeFront(sideBody(), 180)
    expect(r.ok).toBe(false)
  })
})
