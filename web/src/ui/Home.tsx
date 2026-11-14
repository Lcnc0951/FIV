import { analyzeBody, analyzeMuscles, planPosture } from '../engine/analyzer'
import { analyzeFat, FAT_CATEGORY_LABEL, DISTRIBUTION_LABEL, nutrition, planFatLoss } from '../engine/coach'
import { totalSets, type WorkoutDay } from '../engine/generator'
import { DAILY_TIPS } from '../data/knowledge'
import { avg, PHYSIQUE_INFO } from '../engine/types'
import { Card, FindingRow, Icon, Metric, nb, dateNb } from './kit'
import { activeLocation, sortedScans, useApp } from './state'
import { FatScale } from './Body'

export function nextWorkout(days: WorkoutDay[] | undefined, lastDayName?: string): WorkoutDay | undefined {
  if (!days?.length) return undefined
  const i = lastDayName ? days.findIndex((d) => d.name === lastDayName) : -1
  return days[(i + 1) % days.length]
}

export function Home({ go, startWorkout }: { go: (tab: string, sub?: string) => void; startWorkout: (d: WorkoutDay) => void }) {
  const { profile, pd, data, latest, program } = useApp()
  const scans = sortedScans(data.scans)
  const analysis = analyzeBody(pd, scans[0]?.measurements, scans[1]?.measurements)
  const fat = analyzeFat(pd, latest?.measurements)
  const plan = planFatLoss(pd, fat, latest?.measurements.waistCm)
  const report = analyzeMuscles(pd, latest?.measurements, fat.bodyFatPercent)
  const posture = planPosture(pd, latest?.measurements)
  const n = nutrition(pd, fat.bodyFatPercent, profile.goal === 'loseFat' && plan.needed ? plan.targetKcal : undefined)
  const lastLog = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date))[0]
  const next = nextWorkout(program?.days, lastLog?.dayName)
  const tip = DAILY_TIPS[Math.floor(Date.now() / 86_400_000) % DAILY_TIPS.length]
  const m = latest?.measurements

  return (
    <div className="stack">
      <header className="page-head">
        <p className="eyebrow">{new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1>{profile.name ? `Hei, ${profile.name}` : 'Hei!'}</h1>
      </header>

      {next && (
        <Card className="hero-card" onClick={() => startWorkout(next)}>
          <div className="row between">
            <div>
              <p className="eyebrow accent">Neste økt · {activeLocation(profile).name}</p>
              <h2>{next.name}</h2>
              <p className="muted small">{next.exercises.length} øvelser · {totalSets(next)} sett · {next.focus}</p>
            </div>
            <span className="play"><Icon name="play" size={26} /></span>
          </div>
        </Card>
      )}

      {!latest && (
        <Card className="callout" onClick={() => go('scan')}>
          <div className="row gap"><Icon name="scan" size={28} /><div><strong>Ta ditt første kroppsskann</strong><p className="muted small">To bilder — forfra og fra siden. Da blir analysen og programmet målrettet mot kroppen din.</p></div></div>
        </Card>
      )}

      <div className="grid2">
        <Card onClick={() => go('body', 'fat')}>
          <p className="eyebrow">Fett</p>
          <div className="big-number">{nb(fat.bodyFatPercent, 0)}<span> %</span></div>
          <p className="small">{FAT_CATEGORY_LABEL[fat.category]}{fat.source === 'bmiEstimate' ? ' · grovt anslag' : ''}</p>
          <FatScale position={fat.scalePosition} />
          <p className="muted small">{plan.needed ? `−${nb(plan.fatToLoseKg)} kg fett · ca. ${plan.weeks} uker` : DISTRIBUTION_LABEL[fat.distribution]}</p>
        </Card>
        <Card onClick={() => go('body', 'muscle')}>
          <p className="eyebrow">Kroppsform</p>
          <div className="big-number">{report.overallScore ?? '–'}<span>/100</span></div>
          <p className="small">{PHYSIQUE_INFO[profile.physique].label}</p>
          <p className="muted small">{posture.issues.length ? `${posture.issues.length} holdningspunkt · ${posture.drills.length} øvelser` : 'Ingen holdningsavvik funnet'}</p>
        </Card>
      </div>

      <Card>
        <p className="tip"><Icon name="coach" /> {tip}</p>
      </Card>

      {m && latest && (
        <Card onClick={() => go('body', 'progress')}>
          <div className="row between"><h3>Siste skann</h3><span className="muted small">{dateNb(latest.date)}</span></div>
          <div className="metrics">
            <Metric label="Midje" value={nb(m.waistCm, 0)} unit="cm" />
            <Metric label="Bryst" value={nb(m.chestCm, 0)} unit="cm" />
            <Metric label="Hofte" value={nb(m.hipCm, 0)} unit="cm" />
            <Metric label="Arm" value={nb(avg(m.upperArmLeftCm, m.upperArmRightCm))} unit="cm" />
            <Metric label="Lår" value={nb(avg(m.thighLeftCm, m.thighRightCm))} unit="cm" />
            <Metric label="FFMI" value={nb(analysis.ffmi)} />
          </div>
        </Card>
      )}

      <Card>
        <h3>PT-vurdering</h3>
        <div className="stack-s">{analysis.findings.slice(0, 5).map((f) => <FindingRow key={f.title} f={f} />)}</div>
      </Card>

      <Card>
        <div className="row between"><h3>Ernæring i dag</h3><strong className="accent">{n.targetKcal} kcal</strong></div>
        <div className="metrics four">
          <Metric label="Protein" value={n.proteinG} unit="g" />
          <Metric label="Karbo" value={n.carbsG} unit="g" />
          <Metric label="Fett" value={n.fatG} unit="g" />
          <Metric label="Fiber" value={n.fiberG} unit="g" />
        </div>
        <p className="muted small">{n.note}</p>
        <details><summary>Tilskudd</summary><ul className="small">{n.supplements.map((s) => <li key={s}>{s}</li>)}</ul></details>
      </Card>

      {program && (
        <Card>
          <h3>Kondisjon denne uka</h3>
          <ul className="plain small">
            <li><Icon name="heart" size={16} /> {program.cardio.zone2Sessions} × {program.cardio.zone2Minutes} min sone 2 · puls {program.cardio.zone2HR[0]}–{program.cardio.zone2HR[1]}</li>
            {program.cardio.intervalSessions > 0 && <li><Icon name="flame" size={16} /> {program.cardio.intervalSessions} × 4×4-intervaller · puls {program.cardio.intervalHR[0]}–{program.cardio.intervalHR[1]}</li>}
            <li><Icon name="walk" size={16} /> {program.cardio.dailySteps.toLocaleString('nb-NO')} skritt per dag</li>
          </ul>
        </Card>
      )}
    </div>
  )
}
