// Kjører MediaPipe Pose Landmarker lokalt i nettleseren. Ingen bilder sendes noe sted.
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import type { Detection, Pt } from './measure'

let landmarker: Promise<PoseLandmarker> | null = null

function load(): Promise<PoseLandmarker> {
  landmarker ??= (async () => {
    const base = new URL('./mediapipe', document.baseURI).href
    void FilesetResolver // (vi setter filstiene selv under)
    // Laster-skriptet hentes fra egen server, ellers fra jsDelivr (tillatt i Claude-artifacts). Wasm og modell ligger alltid ved siden av appen.
    const filesets = [
      { wasmLoaderPath: `${base}/vision_wasm_internal.js`, wasmBinaryPath: `${base}/vision_wasm_internal.wasm` },
      { wasmLoaderPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm/vision_wasm_internal.js', wasmBinaryPath: `${base}/vision_wasm_internal.wasm` },
    ]
    const modelAssetBuffer = await loadModel(base)
    let lastError: unknown
    for (const fileset of filesets) {
      for (const delegate of ['GPU', 'CPU'] as const) {
        try {
          return await PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetBuffer, delegate },
            runningMode: 'IMAGE', numPoses: 1, outputSegmentationMasks: true,
          })
        } catch (e) { lastError = e }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Kunne ikke laste AI-modellen')
  })().catch((e) => { landmarker = null; throw e })
  return landmarker
}

/** Henter modellen: som vanlig fil, eller base64-tekst der vertsplattformen ikke serverer .task-filer. */
async function loadModel(base: string): Promise<Uint8Array> {
  try {
    const r = await fetch(`${base}/pose_landmarker_full.task`)
    if (r.ok) return new Uint8Array(await r.arrayBuffer())
  } catch { /* prøv tekstversjonen */ }
  const r = await fetch(`${base}/pose_landmarker_full.task.txt`)
  if (!r.ok) throw new Error('Fant ikke AI-modellen')
  const bin = atob((await r.text()).trim())
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Starter nedlasting av modellen i bakgrunnen (ca. 23 MB første gang). */
export function preloadPose() { load().catch(() => undefined) }

export async function detectPose(image: HTMLImageElement | HTMLCanvasElement): Promise<Detection | null> {
  const lm = await load()
  const width = image instanceof HTMLImageElement ? image.naturalWidth : image.width
  const height = image instanceof HTMLImageElement ? image.naturalHeight : image.height
  const result = lm.detect(image)
  try {
    const pose = result.landmarks[0]
    const maskObj = result.segmentationMasks?.[0]
    if (!pose || !maskObj) return null
    const landmarks: Pt[] = pose.map((p) => ({ x: p.x * width, y: p.y * height, v: p.visibility ?? 1 }))
    const raw = maskObj.getAsFloat32Array()
    // Masken kan ha annen oppløsning enn bildet — skaler til bildestørrelse
    let data = new Float32Array(raw)
    if (maskObj.width !== width || maskObj.height !== height) {
      data = new Float32Array(width * height)
      for (let y = 0; y < height; y++) {
        const sy = Math.min(maskObj.height - 1, Math.floor(y * maskObj.height / height))
        for (let x = 0; x < width; x++) data[y * width + x] = raw[sy * maskObj.width + Math.min(maskObj.width - 1, Math.floor(x * maskObj.width / width))]
      }
    }
    return { landmarks, mask: { width, height, data }, width, height }
  } finally {
    result.close()
  }
}

/** Skalerer ned store bilder (iPhone-bilder er 12–48 MP) for fart og minne. */
export async function loadImage(file: Blob, maxSide = 1280): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file)
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return c
}
