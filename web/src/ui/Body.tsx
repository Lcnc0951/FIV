import { useState } from 'react'
import { analyzeMuscles, planPosture, type PostureDrill, type RegionScore } from '../engine/analyzer'
import { analyzeFat, DISTRIBUTION_LABEL, estimated1RM, FAT_CATEGORY_LABEL, planFatLoss } from '../engine/coach'
import { exercise, isCompound } from '../engine/library'
import { avg, PHYSIQUE_INFO } from '../engine/types'
import { Bar, Card, Icon, LineChart, Metric, nb, Tag, type Series } from './kit'
import { animationNamed, StickFigure } from './StickFigure'
import { sortedScans, useApp } from './state'

export function FatScale({ position }: { position: number }) {
  return (
    <div className="fatscale" aria-label="Fettprosent-skala">
      <div className="fatscale-track" />
      <div className="fatscale-dot" style={{ left: `calc(${(position * 100).toFixed(1)}% - 8px)` }} />
    </div>
  )
}

export function Body({ initial = 'fat' }: { initial?: string }) {
  const [tab, setTab] = useState(initial)
  const tabs = [['fat', 'Fett'], ['muscle', 'Muskler'], ['posture', 'Holdning'], ['progress', 'Fremgang']]
  return (
    <div className="stack">
      <header className="page-head"><h1>Kroppen din</h1></header>
      <div className="segmented" role="tablist">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'fat' && <Fat />}
      {tab === 'muscle' && <Muscles />}
      {tab === 'posture' && <Posture />}
      {tab === 'progress' && <Progress />}
    </div>
  )
}

const PILLAR_ICON: Record<string, string> = { flame: 'flame', dumbbell: 'dumbbell', food: 'food', walk: 'walk', heart: 'heart', moon: 'moon', glass: 'glass', info: 'info' }

function Fat() {
  const { profile, pd, latest, saveProfile } = useApp()
  const fat = analyzeFat(pd, latest?.measurements)
  const plan = planFatLoss(pd, fat, latest?.measurements.waistCm)
  const [lo, hi] = profile.sex === 'male' ? [8, 30] : [15, 38]
  const end = new Date(Date.now() + plan.weeks * 7 * 86_400_000)
  return (
    <>
      <Card>
        <div className="row between baseline">
          <div className="big-number xl">{nb(fat.bodyFatPercent)}<span> % fett</span></div>
          <Tag tone={fat.category <= 2 ? 'good' : fat.category === 3 ? 'warn' : 'bad'}>{FAT_CATEGORY_LABEL[fat.category]}</Tag>
        </div>
        <FatScale position={fat.scalePosition} />
        <div className="metrics">
          <Metric label="Fettmasse" value={nb(fat.fatMassKg)} unit="kg" />
          <Metric label="Fettfri masse" value={nb(fat.leanMassKg)} unit="kg" />
          <Metric label="Vekt" value={nb(profile.weightKg)} unit="kg" />
        </div>
        {fat.source === 'bmiEstimate' && <p className="warn small"><Icon name="alert" size={14} /> Grovt anslag fra BMI og alder. Skann kroppen for et mye bedre estimat.</p>}
      </Card>
      <Card>
        <h3>Hvor sitter fettet?</h3>
        <p>{DISTRIBUTION_LABEL[fat.distribution]}</p>
        <div className="metrics">
          <Metric label="Midje/hofte" value={nb(fat.waistToHip, 2)} />
          <Metric label="Midje/høyde" value={nb(fat.waistToHeight, 2)} />
          <Metric label="Midje" value={nb(latest?.measurements.waistCm, 0)} unit="cm" />
        </div>
        <p className="small"><strong>Bukfett (visceralt):</strong> {fat.visceralRisk}</p>
      </Card>
      <Card>
        <div className="row between"><h3>Ditt mål</h3><strong className="accent">{nb(plan.targetBodyFat, 0)} % fett</strong></div>
        <input id="fat-target" type="range" min={lo} max={hi} step={0.5} value={profile.targetBodyFat || plan.targetBodyFat}
          aria-label="Målfettprosent" onChange={(e) => saveProfile({ ...profile, targetBodyFat: +e.target.value }, false)} />
        {plan.needed ? (
          <>
            <div className="metrics">
              <Metric label="Fett å miste" value={nb(plan.fatToLoseKg)} unit="kg" />
              <Metric label="Målvekt" value={nb(plan.targetWeightKg)} unit="kg" />
              <Metric label="Tid" value={plan.weeks} unit="uker" />
            </div>
            <p className="small">Realistisk ved {end.toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' })} med ~{nb(plan.weeklyLossKg)} kg/uke.</p>
            <div className="metrics four">
              <Metric label="Kalorier" value={plan.targetKcal} />
              <Metric label="Underskudd" value={`−${plan.dailyDeficitKcal}`} />
              <Metric label="Protein" value={plan.proteinG} unit="g" />
              <Metric label="Skritt" value={plan.dailySteps.toLocaleString('nb-NO')} />
            </div>
            {profile.goal !== 'loseFat'
              ? <button className="btn primary full" onClick={() => saveProfile({ ...profile, goal: 'loseFat' })}>Gjør fettap til hovedmål og tilpass programmet</button>
              : <p className="good small"><Icon name="check" size={14} /> Programmet ditt er tilpasset fettap.</p>}
          </>
        ) : <p className="good small"><Icon name="check" size={14} /> Du er på eller under målet. Fokuser på å bygge muskler — da blir du også slankere.</p>}
      </Card>
      {plan.needed && plan.milestones.length > 1 && (
        <Card>
          <h3>Forventet utvikling</h3>
          <LineChart series={[{ name: 'Fett %', points: plan.milestones.map((m) => ({ x: m.week, y: m.bodyFatPercent })) }]}
            xFormat={(x) => `uke ${x.toFixed(0)}`} yFormat={(y) => `${y.toFixed(0)} %`} />
          <div className="milestones">{plan.milestones.map((m) => <span key={m.week}><strong>Uke {m.week}</strong> {nb(m.weightKg)} kg{m.waistCm ? ` · ${nb(m.waistCm, 0)} cm` : ''}</span>)}</div>
        </Card>
      )}
      <Card>
        <h3>Slik jobber vi bort fettet</h3>
        <div className="stack-s">
          {plan.pillars.map((p) => (
            <div key={p.title} className="pillar"><span className="pillar-icon"><Icon name={PILLAR_ICON[p.icon] ?? 'info'} /></span><div><strong>{p.title}</strong><p className="muted small">{p.detail}</p></div></div>
          ))}
        </div>
      </Card>
      <Card>
        <h3>Slik justerer vi underveis</h3>
        <p className="small">{plan.adjustmentRule}</p>
        <h3>Enkelt kosthold</h3>
        <p className="small">{plan.plateNote}</p>
      </Card>
      <p className="muted small">Estimater basert på skann og validerte formler — ikke medisinsk diagnose. Følg trenden, ikke enkeltmålinger.</p>
    </>
  )
}

function RegionRow({ r }: { r: RegionScore }) {
  const fmt = (v: number) => (r.percent ? `${v.toFixed(0)} %` : v.toLocaleString('nb-NO', { minimumFractionDigits: r.digits, maximumFractionDigits: r.digits }))
  return (
    <div className="region">
      <div className="row between"><strong>{r.name}</strong><span className="num">{fmt(r.value)} <span className="muted small">mål {fmt(r.target[0])}–{fmt(r.target[1])}</span></span></div>
      <Bar value={r.score} tone={r.score >= 85 ? 'good' : r.score >= 65 ? 'warn' : 'bad'} />
      <div className="row gap-s small"><span className={r.prioritize ? 'accent' : 'muted'}>{r.status}</span>{r.prioritize && <Tag>prioritert</Tag>}</div>
    </div>
  )
}

function Muscles() {
  const { profile, pd, latest } = useApp()
  const fat = analyzeFat(pd, latest?.measurements)
  const report = analyzeMuscles(pd, latest?.measurements, fat.bodyFatPercent)
  return (
    <>
      <Card>
        <div className="row between"><h3>{PHYSIQUE_INFO[profile.physique].label}</h3>{report.overallScore != null && <span className="big-number">{report.overallScore}<span>/100</span></span>}</div>
        <p>{report.summary}</p>
        <p className="muted small">Endre ønsket kroppsform under Profil.</p>
      </Card>
      {report.regions.length > 0 && <Card><h3>Proporsjoner mot målet</h3><div className="stack-s">{report.regions.map((r) => <RegionRow key={r.name} r={r} />)}</div></Card>}
      {report.symmetry.length > 0 && <Card><h3>Symmetri</h3><div className="stack-s">{report.symmetry.map((r) => <RegionRow key={r.name} r={r} />)}</div></Card>}
      <p className="muted small">Tallene er forhold mellom kroppsdeler fra skannet, justert for estimert fett. De sier noe om balanse og utvikling over tid — ikke eksakt muskelmasse.</p>
    </>
  )
}

export function DrillRow({ d }: { d: PostureDrill }) {
  const anim = d.animation ? animationNamed(d.animation) : undefined
  return (
    <div className="drill">
      <div className="thumb">{anim ? <StickFigure anim={anim} showPhase={false} size={72} /> : <Icon name="posture" size={30} />}</div>
      <div><strong>{d.name}</strong><div className="accent small strong">{d.dose}</div><p className="muted small">{d.cue}</p></div>
    </div>
  )
}

function Posture() {
  const { pd, latest } = useApp()
  const plan = planPosture(pd, latest?.measurements)
  return (
    <>
      <Card>
        <h3>Hva PT-en ser</h3>
        {!plan.issues.length && <p className="good"><Icon name="check" size={16} /> Ingen tydelige holdningsavvik i siste skann.</p>}
        <div className="stack-s">
          {plan.issues.map((i) => (
            <div key={i.title} className="finding">
              <span className="finding-icon sev-warn"><Icon name={i.fromScan ? 'scan' : 'user'} /></span>
              <div><div className="finding-title">{i.title} {i.measured && <span className="muted small num">{i.measured}</span>}</div><div className="muted small">{i.detail}</div></div>
            </div>
          ))}
        </div>
      </Card>
      {plan.drills.length > 0 && <Card><h3>Din holdningsrutine</h3><p className="muted small">{plan.frequency}</p><div className="stack-s">{plan.drills.map((d) => <DrillRow key={d.id} d={d} />)}</div></Card>}
      {plan.strengthFocus.length > 0 && <Card><h3>Lagt inn i treningsprogrammet</h3><ul className="small">{plan.strengthFocus.map((s) => <li key={s}>{s}</li>)}</ul></Card>}
      <Card><h3>Hverdagsvaner</h3><ul className="small">{plan.habits.map((h) => <li key={h}>{h}</li>)}</ul></Card>
      <p className="muted small">Holdning henger svakere sammen med smerte enn mange tror. Har du smerter, nummenhet eller utstråling: oppsøk fysioterapeut eller lege.</p>
    </>
  )
}

function Progress() {
  const { data, pd } = useApp()
  const scans = sortedScans(data.scans).reverse()
  const t = (iso: string) => new Date(iso).getTime()
  const fmt = (x: number) => new Date(x).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
  const series = (name: string, f: (s: (typeof scans)[number]) => number | undefined): Series =>
    ({ name, points: scans.flatMap((s) => { const v = f(s); return v == null ? [] : [{ x: t(s.date), y: v }] }) })
  const bf = series('Fett %', (s) => {
    const f = analyzeFat({ ...pd, weightKg: s.weightKg }, s.measurements)
    return f.source === 'scan' ? f.bodyFatPercent : undefined
  })
  const strength = new Map<string, Series>()
  for (const w of data.workouts) {
    const e = exercise(w.exerciseId)
    if (!e || !isCompound(e)) continue
    const best = Math.max(...w.sets.map(estimated1RM))
    if (!(best > 0)) continue
    if (!strength.has(e.name)) strength.set(e.name, { name: e.name, points: [] })
    strength.get(e.name)!.points.push({ x: t(w.date), y: best })
  }
  const top = [...strength.values()].sort((a, b) => b.points.length - a.points.length).slice(0, 3)
  return (
    <>
      {scans.length < 2 && <Card><p className="small">Skann deg minst to ganger (anbefalt hver 4. uke, samme tid på døgnet) for å se kurvene.</p></Card>}
      {scans.length > 0 && <Card><h3>Vekt</h3><LineChart series={[series('Vekt', (s) => s.weightKg)]} xFormat={fmt} yFormat={(y) => `${y.toFixed(0)} kg`} /></Card>}
      {bf.points.length > 0 && <Card><h3>Fettprosent</h3><LineChart series={[bf]} xFormat={fmt} yFormat={(y) => `${y.toFixed(0)} %`} /></Card>}
      {scans.length > 0 && <Card><h3>Midje</h3><LineChart series={[series('Midje', (s) => s.measurements.waistCm)]} xFormat={fmt} yFormat={(y) => `${y.toFixed(0)} cm`} /></Card>}
      {scans.length > 0 && <Card><h3>Armer & lår</h3><LineChart series={[
        series('Arm', (s) => avg(s.measurements.upperArmLeftCm, s.measurements.upperArmRightCm)),
        series('Lår', (s) => avg(s.measurements.thighLeftCm, s.measurements.thighRightCm)),
      ]} xFormat={fmt} yFormat={(y) => `${y.toFixed(0)}`} /></Card>}
      {top.length > 0 && <Card><h3>Estimert 1RM (kg)</h3><LineChart series={top} xFormat={fmt} /></Card>}
    </>
  )
}
