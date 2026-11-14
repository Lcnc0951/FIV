// Skannemetoder. Kamera (AI) er aktiv nå. LiDAR ligger klar og aktiveres når iPhone-appen finnes.
import type { ScanMeasurements } from '../engine/types'

export type ScanMethod = 'camera' | 'lidar'

export interface LidarStatus { available: boolean; reason: string }

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LiDAR via iPhone-appen. Når FIV-appen (Swift, i repoet under FIV/) åpner nettappen i en WebView,
 * eksponerer den `window.webkit.messageHandlers.fivLidar`. Da kan nettappen be om et ekte LiDAR-skann.
 * I vanlig Safari finnes ikke dette — da kan et skann eksporteres fra appen som JSON og importeres her.
 */
export function lidarStatus(): LidarStatus {
  const bridge = (window as any).webkit?.messageHandlers?.fivLidar
  if (bridge) return { available: true, reason: 'iPhone-appen med LiDAR er tilkoblet.' }
  return { available: false, reason: 'LiDAR krever FIV-appen på iPhone Pro. Safari slipper ikke nettsider til dybdesensoren.' }
}

/** Ber iPhone-appen om et LiDAR-skann. Appen svarer med window.fivLidarResult(json). */
export function requestLidarScan(heightCm: number): Promise<ScanMeasurements> {
  return new Promise((resolve, reject) => {
    const bridge = (window as any).webkit?.messageHandlers?.fivLidar
    if (!bridge) return reject(new Error(lidarStatus().reason))
    const timer = setTimeout(() => reject(new Error('Fikk ikke svar fra iPhone-appen.')), 5 * 60_000)
    ;(window as any).fivLidarResult = (json: string) => {
      clearTimeout(timer)
      try { resolve(parseLidarJson(json)) } catch (e) { reject(e) }
    }
    bridge.postMessage({ action: 'scan', heightCm })
  })
}

const FIELDS: (keyof ScanMeasurements)[] = [
  'measuredHeightCm', 'shoulderWidthCm', 'neckCm', 'chestCm', 'waistCm', 'hipCm', 'upperArmLeftCm', 'upperArmRightCm',
  'thighLeftCm', 'thighRightCm', 'armLengthLeftCm', 'armLengthRightCm', 'legLengthLeftCm', 'legLengthRightCm',
  'shoulderTiltDeg', 'hipTiltDeg', 'forwardHeadCm', 'roundedShouldersCm', 'thoracicAngleDeg',
]

/** Leser et skann eksportert fra iOS-appen (samme feltnavn som Swift `ScanMeasurements`). */
export function parseLidarJson(text: string): ScanMeasurements {
  const raw = JSON.parse(text)
  const src = raw.measurements ?? raw
  const out: ScanMeasurements = { usedLiDAR: true, sampleCount: Number(src.sampleCount) || undefined }
  for (const f of FIELDS) {
    const v = src[f]
    if (typeof v === 'number' && Number.isFinite(v)) (out as any)[f] = v
  }
  if (out.waistCm == null) throw new Error('Fant ikke midjemål i filen. Er det et FIV-skann?')
  return out
}
