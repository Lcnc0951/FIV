import { describe, expect, it } from 'vitest'
import { parseLidarJson } from './providers'

describe('parseLidarJson', () => {
  it('leser filen fra FIV LiDAR-appen (measurements inni en konvolutt)', () => {
    const file = JSON.stringify({
      format: 'fiv-scan', version: 1, app: 'FIV LiDAR', date: '2026-11-19T16:40:12Z', weightKg: 82.4,
      measurements: { waistCm: 86.2, hipCm: 99.1, neckCm: 38.5, shoulderTiltDeg: -1.2, usedLiDAR: true, sampleCount: 60 },
    })
    const m = parseLidarJson(file)
    expect(m.waistCm).toBe(86.2)
    expect(m.hipCm).toBe(99.1)
    expect(m.shoulderTiltDeg).toBe(-1.2)
    expect(m.usedLiDAR).toBe(true)
    expect(m.sampleCount).toBe(60)
  })

  it('leser også bare målene (eksport fra FIV-appen)', () => {
    expect(parseLidarJson('{"waistCm": 80}').waistCm).toBe(80)
  })

  it('avviser filer uten midjemål', () => {
    expect(() => parseLidarJson('{"measurements": {}}')).toThrow()
  })
})
