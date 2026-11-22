import { analyzeBody, analyzeMuscles, planPosture } from '../engine/analyzer'
import { analyzeFat, FAT_CATEGORY_LABEL, DISTRIBUTION_LABEL, nutrition, planFatLoss } from '../engine/coach'
import type { WorkoutDay } from '../engine/generator'
import { DAILY_TIPS } from '../data/knowledge'
import { assessFitness, effectiveMaxHR } from '../engine/composition'
import { avg, PHYSIQUE_INFO } from '../engine/types'
import { Card, FindingRow, Icon, Metric, nb, dateNb } from './kit'
import { TodayCard, type StartSession } from './Week'
import { CheckinCard, HealthCheck, SleepCard, WeightCard } from './Daily'
import { ReportCard } from './Report'
import { sortedScans, useApp } from './state'
import { FatScale } from './Body'
import { PainBanner } from './Pain'
import { WeekRingsCard } from './Rings'
import { SessionsCard } from './Sessions'
import { MobilityTodayCard } from './Mobility'

export function nextWorkout(days: WorkoutDay[] | undefined, lastDayName?: string): WorkoutDay | undefined {
  if (!days?.length) return undefined
  const i = lastDayName ? days.findIndex((d) => d.name === lastDayName) : -1
  return days[(i + 1) % days.length]
}

export function Home({ go, start }: { go: (tab: string, sub?: string) => void; start: (s: StartSession) => void }) {
  const { profile, pd, data, latest, program } = useApp()
  const scans = sortedScans(data.scans)
  const analysis = analyzeBody(pd, scans[0]?.measurements, scans[1]?.measurements)
  const fat = analyzeFat(pd, latest?.measurements)
  const plan = planFatLoss(pd, fat, latest?.measurements.waistCm)
  const report = analyzeMuscles(pd, latest?.measurements, fat.bodyFatPercent)
  const posture = planPosture(pd, latest?.measurements)
  const n = nutrition(pd, fat.bodyFatPercent, profile.goal === 'loseFat' && plan.needed ? plan.targetKcal : undefined)
  const tip = DAILY_TIPS[Math.floor(Date.now() / 86_400_000) % DAILY_TIPS.length]
  const m = latest?.measurements

  return (
    <div className="stack">
      <header className="page-head">
        <p className="eyebrow">{new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1>{profile.name ? `Hei, ${profile.name}` : 'Hei!'}</h1>
      </header>

      <WeekRingsCard />
      <HealthCheck />
      <CheckinCard />
      <PainBanner compact />
      <MobilityTodayCard open={() => go('body', 'plager')} />
      <TodayCard start={start} />
      <ReportCard />
      <SessionsCard />
      <WeightCard compact />
      <SleepCard />

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

      {profile.watch?.vo2max ? (() => {
        const f = assessFitness(profile.watch!.vo2max!, pd.age, pd.sex)
        const hr = effectiveMaxHR(pd.age, profile.watch?.maxHR)
        return (
          <Card>
            <div className="row between"><h3>Kondisjon</h3><span className="tag tag-good">{f.label}</span></div>
            <div className="metrics">
              <Metric label="VO₂maks" value={nb(f.vo2max)} />
              <Metric label="Kondisjonsalder" value={f.fitnessAge} unit="år" />
              <Metric label="Mål om 12 uker" value={nb(f.goal12w)} />
            </div>
            <p className="small">Du er ca. {f.percentOfAverage} % av medianen for din alder (grovt anslag, klokka har ±3–5 i usikkerhet). Hver +3,5 i VO₂maks er forbundet med ca. 13 % lavere risiko for tidlig død (Kodama 2009).</p>
            <p className="muted small">Pulssoner med makspuls {hr}: sone 2 {Math.floor(hr * 0.6)}–{Math.floor(hr * 0.7)} · 4×4-drag {Math.floor(hr * 0.85)}–{Math.floor(hr * 0.95)}. Klokka oppdaterer VO₂maks bare fra utendørs løp/gå med GPS — ta minst én tur ute i uka.</p>
          </Card>
        )
      })() : (
        <Card onClick={() => go('profil')}>
          <p className="small"><Icon name="heart" size={16} /> <strong>Har du Apple Watch?</strong> Legg inn kondisjon, makspuls, aktiv energi og skritt under Profil, så blir pulssoner og kalorier personlige.</p>
        </Card>
      )}

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
        <p className="muted small">{n.note}{n.fromWatch ? ` Vedlikehold ${n.maintenanceKcal} kcal er regnet ut fra klokkas aktive energi.` : ''}</p>
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
