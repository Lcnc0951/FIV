import { useEffect, useRef, useState } from 'react'
import { analyzeBody } from '../engine/analyzer'
import { uid, type BodyScan, type ScanMeasurements } from '../engine/types'
import { analyzeFront, analyzeSide, combine, LM, type Detection, type ViewError, type ViewResult } from '../scan/measure'
import { detectPose, loadImage, preloadPose } from '../scan/pose'
import { lidarStatus, parseLidarJson, requestLidarScan } from '../scan/providers'
import { Card, dateNb, FindingRow, Icon, nb, speak, Tag } from './kit'
import { applyCalibration, CAL_LABEL, learnCalibration, type CalKey } from '../engine/extras'

export const calText = (cal: Partial<Record<CalKey, number>>) =>
  (Object.entries(cal) as [CalKey, number][]).map(([k, f]) => `${CAL_LABEL[k].toLowerCase()} ${f >= 1 ? '+' : ''}${((f - 1) * 100).toFixed(1).replace('.', ',')} %`).join(' · ')
import { sortedScans, useApp } from './state'

type View = 'front' | 'side'
interface Capture { canvas: HTMLCanvasElement; det: Detection | null; result: ViewResult | ViewError }

const FIELDS: [keyof ScanMeasurements, string, string][] = [
  ['neckCm', 'Hals', 'cm'], ['chestCm', 'Bryst', 'cm'], ['waistCm', 'Midje', 'cm'], ['hipCm', 'Hofte', 'cm'],
  ['upperArmLeftCm', 'Overarm venstre', 'cm'], ['upperArmRightCm', 'Overarm høyre', 'cm'],
  ['thighLeftCm', 'Lår venstre', 'cm'], ['thighRightCm', 'Lår høyre', 'cm'],
]
const POSTURE: [keyof ScanMeasurements, string, string][] = [
  ['shoulderTiltDeg', 'Skulderskjevhet', '°'], ['hipTiltDeg', 'Bekkenskjevhet', '°'], ['forwardHeadCm', 'Hode foran skulder', 'cm'],
  ['roundedShouldersCm', 'Skuldre foran rygg', 'cm'], ['thoracicAngleDeg', 'Øvre rygg-kurve', '°'], ['shoulderWidthCm', 'Skulderbredde (ledd)', 'cm'],
]

export function Scan() {
  const { profile, data, saveProfile } = useApp()
  const [mode, setMode] = useState<'start' | 'camera' | 'review'>('start')
  const [weight, setWeight] = useState(profile.weightKg)
  const [result, setResult] = useState<{ m: ScanMeasurements; source: BodyScan['source']; raw?: ScanMeasurements } | null>(null)
  const [editing, setEditing] = useState<BodyScan | null>(null)
  useEffect(() => { preloadPose() }, [])

  if (mode === 'camera') return <CameraFlow onCancel={() => setMode('start')} onDone={(raw) => { setResult({ m: applyCalibration(raw, profile.calibration), raw, source: 'camera' }); setMode('review') }} />
  if (mode === 'review' && (result || editing)) {
    return <Review weight={weight} initial={editing?.measurements ?? result!.m} raw={editing?.raw ?? result?.raw} source={editing?.source ?? result!.source} existing={editing ?? undefined}
      onDone={() => { setMode('start'); setResult(null); setEditing(null) }} />
  }
  return (
    <div className="stack">
      <header className="page-head"><h1>Kroppsskann</h1><p className="muted">To bilder — forfra og fra siden. AI finner kroppen og måler omkretser med høyden din ({profile.heightCm} cm) som målestokk.</p></header>
      <Card>
        <h3>Før du starter</h3>
        <ul className="checklist">
          <li><Icon name="user" size={16} /> Tettsittende klær (eller treningstøy). Løse klær gir for store mål.</li>
          <li><Icon name="camera" size={16} /> Telefonen stående i hoftehøyde, 2,5–3 m unna, hele kroppen i bildet.</li>
          <li><Icon name="body" size={16} /> Forfra: armene litt ut (A-stilling), føttene i skulderbredde.</li>
          <li><Icon name="swap" size={16} /> Fra siden: snu deg en kvart runde, armene rett ned.</li>
          <li><Icon name="info" size={16} /> Godt lys og rolig bakgrunn. Bruk selvutløser, eller få hjelp av noen.</li>
        </ul>
      </Card>
      <Card>
        <label className="field"><span>Dagens vekt (kg)</span><input id="scan-weight" type="number" inputMode="decimal" step={0.1} value={weight} onChange={(e) => setWeight(+e.target.value)} /></label>
        <button className="btn primary big full" onClick={() => setMode('camera')}><Icon name="scan" /> Start skanning</button>
        <button className="btn ghost full" onClick={() => { setResult({ m: {}, source: 'manual' }); setMode('review') }}>Skriv inn mål med målebånd i stedet</button>
      </Card>
      {Object.keys(profile.calibration ?? {}).length > 0 && (
        <Card>
          <div className="row between"><strong>Kalibrering mot målebånd</strong><button className="link small" onClick={() => saveProfile({ ...profile, calibration: {} }, false)}>Nullstill</button></div>
          <p className="small muted">Kameraskann rettes automatisk: {calText(profile.calibration!)}.</p>
        </Card>
      )}
      <LidarCard weight={weight} onResult={(m) => { setResult({ m, source: 'lidar' }); setMode('review') }} enabled={profile.scanMethod === 'lidar'} />
      {data.scans.length > 0 && (
        <Card>
          <h3>Tidligere skann</h3>
          <div className="list">
            {sortedScans(data.scans).map((s) => (
              <button key={s.id} className="list-row" onClick={() => { setEditing(s); setWeight(s.weightKg); setMode('review') }}>
                <span>{dateNb(s.date)} <Tag tone="plain">{s.source === 'lidar' ? 'LiDAR' : s.source === 'manual' ? 'Målebånd' : 'Kamera'}</Tag></span>
                <span className="muted">Midje {nb(s.measurements.waistCm, 0)} cm <Icon name="chevron" size={16} /></span>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function LidarCard({ weight, onResult, enabled }: { weight: number; onResult: (m: ScanMeasurements) => void; enabled: boolean }) {
  const { profile } = useApp()
  const status = lidarStatus()
  const [err, setErr] = useState('')
  const file = useRef<HTMLInputElement>(null)
  void weight
  if (!enabled) {
    return (
      <Card className="locked">
        <div className="row gap"><Icon name="lidar" size={26} /><div><strong>LiDAR-skanning</strong> <Tag tone="plain">ikke aktivert</Tag>
          <p className="muted small">Ekte 3D-dybde med iPhone Pro. Ligger klar — aktiveres under Profil → Skannemetode når FIV-appen for iPhone er installert.</p></div></div>
      </Card>
    )
  }
  return (
    <Card>
      <div className="row gap"><Icon name="lidar" size={26} /><div><strong>LiDAR-skanning</strong> <Tag tone={status.available ? 'good' : 'warn'}>{status.available ? 'klar' : 'venter på iPhone-appen'}</Tag>
        <p className="muted small">{status.reason}</p></div></div>
      {status.available && <button className="btn primary full" onClick={() => requestLidarScan(profile.heightCm).then(onResult, (e) => setErr(String(e.message ?? e)))}>Start LiDAR-skann</button>}
      <button className="btn full" onClick={() => file.current?.click()}><Icon name="upload" /> Importer skann fra iPhone-appen (JSON)</button>
      <input ref={file} type="file" accept="application/json,.json,text/plain,.txt" hidden onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return
        try { onResult(parseLidarJson(await f.text())) } catch (x) { setErr((x as Error).message) }
        e.target.value = ''
      }} />
      {err && <p className="bad small">{err}</p>}
    </Card>
  )
}

function CameraFlow({ onCancel, onDone }: { onCancel: () => void; onDone: (m: ScanMeasurements) => void }) {
  const { profile } = useApp()
  const [view, setView] = useState<View>('front')
  const [caps, setCaps] = useState<Partial<Record<View, Capture>>>({})
  const [busy, setBusy] = useState('')
  const [live, setLive] = useState(false)

  const process = async (canvas: HTMLCanvasElement) => {
    setBusy('Analyserer kroppen … (første gang lastes AI-modellen, ca. 20 MB)')
    try {
      const det = await detectPose(canvas)
      const result: ViewResult | ViewError = !det ? { ok: false, error: 'Fant ingen person i bildet. Sørg for at hele kroppen er synlig og godt opplyst.' }
        : view === 'front' ? analyzeFront(det, profile.heightCm) : analyzeSide(det, profile.heightCm)
      setCaps((c) => ({ ...c, [view]: { canvas, det, result } }))
      speak(result.ok ? (view === 'front' ? 'Bra. Nå fra siden.' : 'Ferdig. Bra jobba!') : result.error)
    } catch (e) {
      setCaps((c) => ({ ...c, [view]: { canvas, det: null, result: { ok: false, error: `AI-modellen kunne ikke kjøre her (${(e as Error).message}). Skriv inn mål med målebånd i stedet.` } } }))
    } finally { setBusy('') }
  }

  const cap = caps[view]
  const both = caps.front?.result.ok && caps.side?.result.ok
  return (
    <div className="stack">
      <header className="page-head row between">
        <button className="btn ghost" onClick={onCancel}><Icon name="back" /> Avbryt</button>
        <div className="steps"><span className="on" /><span className={view === 'side' || both ? 'on' : ''} /></div>
      </header>
      <h1>{view === 'front' ? '1 av 2 · Forfra' : '2 av 2 · Fra siden'}</h1>
      <p className="muted">{view === 'front'
        ? 'Stå rett mot kameraet, armene litt ut fra kroppen (A-stilling), føttene i skulderbredde.'
        : 'Snu deg en kvart runde. Stå rett med armene ned langs siden, se rett frem.'}</p>

      {live && !cap ? <LiveCamera view={view} onCapture={(c) => { setLive(false); process(c) }} onFail={() => setLive(false)} /> : null}

      {!live && !cap && (
        <Card>
          <div className="capture-options">
            <label className="btn primary big full file-btn">
              <Icon name="camera" /> Ta bilde
              <input type="file" accept="image/*" capture="environment" hidden onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = ''
                if (f) process(await loadImage(f))
              }} />
            </label>
            <label className="btn full file-btn">
              <Icon name="upload" /> Velg fra bilder
              <input type="file" accept="image/*" hidden onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = ''
                if (f) process(await loadImage(f))
              }} />
            </label>
            {'mediaDevices' in navigator && <button className="btn ghost full" onClick={() => setLive(true)}><Icon name="timer" /> Live-kamera med nedtelling og tale</button>}
          </div>
          <p className="hint">Tips: Ta bildene med selvutløser i Kamera-appen (bakkamera), og velg dem fra bilder her. Bildene analyseres bare på telefonen.</p>
        </Card>
      )}

      {busy && <Card><div className="row gap"><span className="spinner" /> {busy}</div></Card>}

      {cap && (
        <Card>
          <Overlay cap={cap} />
          {cap.result.ok
            ? <p className="good"><Icon name="check" size={16} /> {view === 'front' ? 'Forfra-bildet er målt.' : 'Sidebildet er målt.'}</p>
            : <p className="bad"><Icon name="alert" size={16} /> {cap.result.error}</p>}
          <div className="row gap">
            <button className="btn" onClick={() => setCaps((c) => ({ ...c, [view]: undefined }))}>Ta nytt bilde</button>
            {cap.result.ok && view === 'front' && <button className="btn primary grow" onClick={() => setView('side')}>Neste: fra siden</button>}
            {both && view === 'side' && <button className="btn primary grow" onClick={() => onDone(combine(caps.front!.result as ViewResult, caps.side!.result as ViewResult))}>Se resultatet</button>}
          </div>
          {view === 'side' && <button className="btn ghost full" onClick={() => setView('front')}>Tilbake til forfra-bildet</button>}
        </Card>
      )}
    </div>
  )
}

function LiveCamera({ view, onCapture, onFail }: { view: View; onCapture: (c: HTMLCanvasElement) => void; onFail: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [count, setCount] = useState<number | null>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('environment')
  const [error, setError] = useState('')
  useEffect(() => {
    let stream: MediaStream | null = null
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, height: { ideal: 1920 } }, audio: false })
      .then((s) => { stream = s; if (video.current) { video.current.srcObject = s; video.current.play().catch(() => undefined) } })
      .catch(() => setError('Kameraet er ikke tilgjengelig her. Bruk «Ta bilde» eller «Velg fra bilder» i stedet.'))
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [facing])
  useEffect(() => {
    if (count == null) return
    if (count === 0) {
      const v = video.current!
      const c = document.createElement('canvas')
      const s = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight))
      c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s)
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
      speak('Bilde tatt.')
      onCapture(c)
      return
    }
    if (count === 10) speak(view === 'front' ? 'Gå på plass. Stå rett mot telefonen med armene litt ut.' : 'Snu deg en kvart runde, armene ned.')
    if (count === 3) speak('Stå helt stille.')
    const t = setTimeout(() => setCount(count - 1), 1000)
    return () => clearTimeout(t)
  }, [count, onCapture, view])
  if (error) return <Card><p className="bad">{error}</p><button className="btn" onClick={onFail}>OK</button></Card>
  return (
    <Card className="live">
      <div className="live-frame">
        <video ref={video} playsInline muted className={facing === 'user' ? 'mirror' : ''} />
        <div className="live-guide" aria-hidden="true" />
        {count != null && <div className="countdown">{count}</div>}
      </div>
      <div className="row gap">
        <button className="btn" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}><Icon name="swap" /> Bytt kamera</button>
        <button className="btn primary grow" disabled={count != null} onClick={() => setCount(10)}>Start nedtelling (10 s)</button>
      </div>
    </Card>
  )
}

function Overlay({ cap }: { cap: Capture }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!, src = cap.canvas
    c.width = src.width; c.height = src.height
    const ctx = c.getContext('2d')!
    ctx.drawImage(src, 0, 0)
    const s = src.width / 400
    if (cap.det) {
      ctx.fillStyle = 'rgba(229,83,26,0.18)'
      const m = cap.det.mask
      const img = ctx.getImageData(0, 0, c.width, c.height)
      for (let i = 0; i < m.width * m.height; i++) {
        const v = m.data instanceof Uint8Array ? m.data[i] / 255 : m.data[i]
        if (v > 0.5) { img.data[i * 4] = img.data[i * 4] * 0.7 + 229 * 0.3; img.data[i * 4 + 1] *= 0.8; img.data[i * 4 + 2] *= 0.75 }
      }
      ctx.putImageData(img, 0, 0)
      const L = cap.det.landmarks
      const bones = [[LM.leftShoulder, LM.rightShoulder], [LM.leftShoulder, LM.leftElbow], [LM.leftElbow, LM.leftWrist], [LM.rightShoulder, LM.rightElbow], [LM.rightElbow, LM.rightWrist],
        [LM.leftShoulder, LM.leftHip], [LM.rightShoulder, LM.rightHip], [LM.leftHip, LM.rightHip], [LM.leftHip, LM.leftKnee], [LM.leftKnee, LM.leftAnkle], [LM.rightHip, LM.rightKnee], [LM.rightKnee, LM.rightAnkle]]
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2 * s
      for (const [a, b] of bones) { ctx.beginPath(); ctx.moveTo(L[a].x, L[a].y); ctx.lineTo(L[b].x, L[b].y); ctx.stroke() }
    }
    if (cap.result.ok) {
      ctx.strokeStyle = '#ffb000'; ctx.fillStyle = '#ffb000'; ctx.lineWidth = 3 * s; ctx.font = `${12 * s}px system-ui`
      for (const l of cap.result.lines) {
        ctx.beginPath(); ctx.moveTo(l.a.x, l.a.y); ctx.lineTo(l.b.x, l.b.y); ctx.stroke()
        ctx.fillText(l.label, Math.max(l.a.x, l.b.x) + 6 * s, (l.a.y + l.b.y) / 2 + 4 * s)
      }
    }
  }, [cap])
  return <canvas ref={ref} className="overlay" aria-label="Bildet med målinger tegnet inn" />
}

function Review({ initial, raw, source, weight, existing, onDone }: { initial: ScanMeasurements; raw?: ScanMeasurements; source: BodyScan['source']; weight: number; existing?: BodyScan; onDone: () => void }) {
  const { addScan, updateScan, deleteScan, pd, profile, saveProfile } = useApp()
  const [m, setM] = useState<ScanMeasurements>(initial)
  const [w, setW] = useState(weight)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const a = analyzeBody({ ...pd, weightKg: w }, m)
  const save = async () => {
    const s: BodyScan = existing ? { ...existing, measurements: m, weightKg: w } : { id: uid(), date: new Date().toISOString(), weightKg: w, source, measurements: m, raw }
    await (existing ? updateScan(s) : addScan(s))
    // Lær av målebåndet: rettede tall gir korreksjon for neste kameraskann
    if (raw && source === 'camera') {
      const { cal, learned } = learnCalibration(raw, m, profile.calibration)
      if (learned.length) await saveProfile({ ...profile, weightKg: w, calibration: cal }, false)
    }
    onDone()
  }
  const num = (k: keyof ScanMeasurements, label: string, unit: string) => (
    <label key={k} className="field row-field"><span>{label}</span>
      <span className="row gap-s"><input id={`m-${k}`} type="number" inputMode="decimal" step={0.1} value={(m[k] as number | undefined) ?? ''} placeholder="–"
        onChange={(e) => setM({ ...m, [k]: e.target.value === '' ? undefined : +e.target.value })} /><span className="muted small unit">{unit}</span></span>
    </label>
  )
  return (
    <div className="stack">
      <header className="page-head"><button className="btn ghost" onClick={onDone}><Icon name="back" /> Tilbake</button>
        <h1>{existing ? `Skann ${dateNb(existing.date)}` : source === 'manual' ? 'Mål med målebånd' : 'Resultat'}</h1>
        {source === 'camera' && <p className="muted small">Har du målebånd? Mål midje, hals og gjerne hofte, og skriv inn tallene. Appen lærer av det og retter alle senere kameraskann automatisk.</p>}
        {source === 'camera' && Object.keys(profile.calibration ?? {}).length > 0 && <p className="small"><Icon name="check" size={14} /> Kalibrert mot målebånd: {calText(profile.calibration!)}</p>}
        {source === 'lidar' && <p className="muted small">Kontroller tallene fra LiDAR-skannet før du lagrer.</p>}
      </header>
      <Card>
        <h3>Kroppssammensetning</h3>
        <div className="metrics">
          <div className="metric"><div className="metric-value">{nb(a.bodyFatPercent)}<span className="metric-unit"> %</span></div><div className="metric-label">Fett (Navy)</div></div>
          <div className="metric"><div className="metric-value">{nb(a.leanMassKg)}<span className="metric-unit"> kg</span></div><div className="metric-label">Fettfri masse</div></div>
          <div className="metric"><div className="metric-value">{nb(a.ffmi)}</div><div className="metric-label">FFMI</div></div>
        </div>
      </Card>
      <Card>
        <h3>Omkretser</h3>
        <label className="field row-field"><span>Vekt</span><span className="row gap-s"><input id="m-weight" type="number" step={0.1} inputMode="decimal" value={w} onChange={(e) => setW(+e.target.value)} /><span className="muted small unit">kg</span></span></label>
        {FIELDS.map(([k, l, u]) => num(k, l, u))}
      </Card>
      {source !== 'manual' && <Card><h3>Holdning & proporsjoner</h3>{POSTURE.map(([k, l, u]) => num(k, l, u))}</Card>}
      <Card><h3>PT-vurdering</h3><div className="stack-s">{a.findings.map((f) => <FindingRow key={f.title} f={f} />)}</div></Card>
      <button className="btn primary big full" disabled={m.waistCm == null} onClick={save}>{existing ? 'Lagre endringer' : 'Lagre skann og oppdater programmet'}</button>
      {m.waistCm == null && <p className="muted small center">Midjemål trengs for å lagre.</p>}
      {existing && (confirmDelete
        ? <div className="row gap"><button className="btn" onClick={() => setConfirmDelete(false)}>Avbryt</button><button className="btn danger grow" onClick={async () => { await deleteScan(existing.id); onDone() }}>Ja, slett skannet</button></div>
        : <button className="btn ghost full" onClick={() => setConfirmDelete(true)}>Slett skann</button>)}
      <p className="muted small">Kameraskann er et estimat (typisk noen cm på omkretser). Følg trenden over flere skann tatt under like forhold.</p>
    </div>
  )
}
