import { useEffect, useRef, useState } from 'react'
import type { ScanMeasurements } from '../engine/types'
import { loadMeshFile, type LoadedMesh } from '../scan/mesh/files'
import { analyzeMesh, type MeshAnalysis, type MeshPreview, type UpAxis } from '../scan/mesh/measure'
import { Card, Icon, nb, Tag } from './kit'
import { useApp } from './state'

const ROWS: [keyof ScanMeasurements, string][] = [
  ['measuredHeightCm', 'Høyde'], ['neckCm', 'Hals'], ['chestCm', 'Bryst'], ['waistCm', 'Midje'], ['hipCm', 'Hofte'],
  ['upperArmLeftCm', 'Overarm venstre'], ['upperArmRightCm', 'Overarm høyre'], ['thighLeftCm', 'Lår venstre'], ['thighRightCm', 'Lår høyre'],
]

/** Leser en 3D-fil fra en LiDAR-skanneapp og måler kroppen på modellen. */
export function MeshImport({ file, onCancel, onUse }: { file: File; onCancel: () => void; onUse: (m: ScanMeasurements) => void }) {
  const { profile } = useApp()
  const [loaded, setLoaded] = useState<LoadedMesh | null>(null)
  const [up, setUp] = useState<UpAxis>('auto')
  const [result, setResult] = useState<MeshAnalysis | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('Leser filen …')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const l = await loadMeshFile(file.name, await file.arrayBuffer())
        if (!cancelled) setLoaded(l)
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setBusy('') }
      }
    })()
    return () => { cancelled = true }
  }, [file])

  useEffect(() => {
    if (!loaded) return
    setBusy('Måler kroppen på 3D-modellen …')
    setError('')
    // La skjermen oppdatere seg før den tunge beregningen
    const t = setTimeout(() => {
      try { setResult(analyzeMesh(loaded.mesh, { sex: profile.sex, up, profileHeightCm: profile.heightCm })) }
      catch (e) { setResult(null); setError((e as Error).message) }
      finally { setBusy('') }
    }, 30)
    return () => clearTimeout(t)
  }, [loaded, up, profile.sex, profile.heightCm])

  const triangles = loaded ? loaded.mesh.indices.length / 3 : 0
  const points = loaded ? loaded.mesh.positions.length / 3 : 0

  return (
    <div className="stack">
      <header className="page-head">
        <button className="btn ghost" onClick={onCancel}><Icon name="back" /> Tilbake</button>
        <h1>3D-skann</h1>
        <p className="muted small">{file.name}{loaded && <> · {loaded.format} · {triangles > 0 ? `${triangles.toLocaleString('nb-NO')} trekanter` : `${points.toLocaleString('nb-NO')} punkter`}</>}</p>
      </header>

      {busy && <Card><p className="row gap"><span className="spinner" aria-hidden /> {busy}</p></Card>}

      {error && (
        <Card>
          <p className="bad"><Icon name="alert" size={16} /> {error}</p>
          {loaded && <UpPicker up={up} setUp={setUp} />}
        </Card>
      )}

      {result && !busy && (
        <>
          <Card>
            <div className="row between"><h3>Slik ble kroppen målt</h3><Tag tone="good">LiDAR 3D</Tag></div>
            <PreviewCanvas preview={result.preview} />
            <p className="hint">Sett forfra. Strekene viser hvor omkretsene er målt. Ligger de feil, prøv en annen opp-retning nedenfor.</p>
          </Card>
          {result.warnings.length > 0 && (
            <Card>{result.warnings.map((w) => <p key={w} className="warn small"><Icon name="alert" size={14} /> {w}</p>)}</Card>
          )}
          <Card>
            <h3>Målene</h3>
            {ROWS.map(([k, label]) => (
              <div key={k} className="row between row-field"><span>{label}</span><strong>{result.measurements[k] != null ? `${nb(result.measurements[k] as number, 1)} cm` : '–'}</strong></div>
            ))}
            <p className="hint">Modellen er i {result.unit === 'm' ? 'meter' : result.unit === 'cm' ? 'centimeter' : 'millimeter'}, opp-akse {result.up.toUpperCase()}. Du kan rette tallene på neste side.</p>
            <UpPicker up={up} setUp={setUp} />
            <button className="btn primary big full" onClick={() => onUse(result.measurements)} disabled={result.measurements.waistCm == null}>
              <Icon name="check" /> Bruk målene
            </button>
          </Card>
        </>
      )}
    </div>
  )
}

function UpPicker({ up, setUp }: { up: UpAxis; setUp: (u: UpAxis) => void }) {
  return (
    <label className="field"><span>Opp-retning i modellen</span>
      <select value={up} onChange={(e) => setUp(e.target.value as UpAxis)}>
        <option value="auto">Automatisk</option>
        <option value="y">Y opp (vanlig for iPhone-apper)</option>
        <option value="z">Z opp (vanlig for STL og 3D-printing)</option>
        <option value="x">X opp</option>
      </select>
    </label>
  )
}

function PreviewCanvas({ preview }: { preview: MeshPreview }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const css = getComputedStyle(document.documentElement)
    const fg = css.getPropertyValue('--muted').trim() || '#888'
    const accent = css.getPropertyValue('--accent').trim() || '#e5553b'
    const bg = css.getPropertyValue('--card').trim() || '#fff'
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth || 300, h = 380
    canvas.width = w * dpr; canvas.height = h * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)
    const H = preview.heightM + 0.05
    const s = (h - 20) / H
    const X = (x: number) => w / 2 - x * s // sett forfra: personens høyre side er til venstre i bildet
    const Y = (y: number) => h - 10 - y * s
    ctx.fillStyle = fg
    ctx.globalAlpha = 0.35
    const p = preview.points
    for (let i = 0; i < p.length; i += 2) ctx.fillRect(X(p[i]) - 0.75, Y(p[i + 1]) - 0.75, 1.5, 1.5)
    ctx.globalAlpha = 1
    ctx.strokeStyle = accent; ctx.fillStyle = accent; ctx.lineWidth = 2
    ctx.font = '600 11px system-ui, sans-serif'
    for (const l of preview.lines) { ctx.beginPath(); ctx.moveTo(X(l.x1), Y(l.h)); ctx.lineTo(X(l.x2), Y(l.h)); ctx.stroke() }
    ctx.lineWidth = 4; ctx.strokeStyle = bg; ctx.lineJoin = 'round'
    for (const l of preview.lines) {
      const a = X(l.x1), b = X(l.x2), mid = (a + b) / 2
      let x: number, y = Y(l.h) + 4
      if (l.label === 'Bryst') { ctx.textAlign = 'center'; x = mid; y = Y(l.h) - 6 } // armene ligger på begge sider
      else if (l.label.startsWith('Arm') || l.label.startsWith('Lår')) {
        const right = mid > w / 2
        ctx.textAlign = right ? 'left' : 'right'; x = right ? Math.max(a, b) + 6 : Math.min(a, b) - 6
      } else { ctx.textAlign = 'right'; x = Math.min(a, b) - 6 }
      ctx.strokeText(l.label, x, y)
      ctx.fillText(l.label, x, y)
    }
  }, [preview])
  return <canvas ref={ref} style={{ width: '100%', height: 380, display: 'block' }} aria-label="3D-modellen sett forfra med målestreker" />
}
