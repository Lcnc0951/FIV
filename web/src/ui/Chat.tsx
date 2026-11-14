// «Spør PT-en»: Claude svarer med dine data som kontekst (via Claude-artifactens sample-funksjon).
import { useEffect, useRef, useState } from 'react'
import { analyzeBody, planPosture } from '../engine/analyzer'
import { analyzeFat } from '../engine/coach'
import { cycleInfo, readiness, todayKey, weightTrend } from '../engine/daily'
import { exercise } from '../engine/library'
import { GOAL_INFO, LIMITATION_LABEL, PHYSIQUE_INFO, POSTURE_GOAL_LABEL } from '../engine/types'
import { planWeek, RUN_INFO, WEEKDAYS } from '../engine/week'
import { Card, Icon } from './kit'
import { sortedScans, useApp } from './state'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Turn = { role: 'user' | 'assistant'; content: string }

const ERRORS: Record<string, string> = {
  not_granted: 'Du har ikke gitt siden lov til å spørre Claude. Du kan endre det i artifactens tillatelser.',
  rate_limited: 'Litt mange spørsmål på kort tid. Vent et øyeblikk og prøv igjen.',
  cancelled: '',
}

function useContextText(): string {
  const { profile, pd, data, program } = useApp()
  const scans = sortedScans(data.scans)
  const m = scans[0]?.measurements
  const a = analyzeBody(pd, m, scans[1]?.measurements)
  const fat = analyzeFat(pd, m)
  const posture = planPosture(pd, m)
  const week = planWeek(profile, program?.days.length ?? profile.daysPerWeek)
  const ck = data.checkins.find((c) => c.date === todayKey())
  const r = ck ? readiness(ck, profile.watch?.restingHR) : undefined
  const wt = weightTrend(data.weights)
  const cycle = cycleInfo(profile.cycleStart, program?.mesocycle.length ?? 5)
  const recent = [...data.workouts].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 12).map((w) => {
    const d = w.date.slice(0, 10)
    if (w.run) return `${d} ${RUN_INFO[w.run.type].label}: føltes ${w.run.rpe}/10${w.run.avgHR ? `, snittpuls ${w.run.avgHR}` : ''}${w.run.km ? `, ${w.run.km} km` : ''}`
    const e = exercise(w.exerciseId)
    return `${d} ${e?.name ?? w.exerciseId}: ${w.sets.map((s) => `${s.weightKg}kg×${s.reps}`).join(', ')}`
  })
  return [
    `Dato: ${new Date().toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
    `Person: ${pd.sex === 'male' ? 'mann' : 'kvinne'}, ${pd.age} år, ${pd.heightCm} cm, ${pd.weightKg} kg. Erfaring: ${pd.experience}.`,
    `Mål: ${GOAL_INFO[pd.goal].label}. Ønsket kroppsform: ${PHYSIQUE_INFO[pd.physique].label}. Holdningsmål: ${pd.postureGoals.map((g) => POSTURE_GOAL_LABEL[g]).join(', ') || 'ingen'}.`,
    `Plager: ${pd.limitations.map((l) => LIMITATION_LABEL[l]).join(', ') || 'ingen oppgitt'}. Helsesjekk: ${profile.health ? (profile.health.answers.some(Boolean) ? 'svarte JA på minst ett PAR-Q-spørsmål' : 'alle nei') : 'ikke besvart'}.`,
    `Trener ${profile.trainingStart}–${profile.trainingEnd}. Sted nå: ${pd.location.name}. Uke: ${week.map((d) => `${WEEKDAYS[d.weekday]}: ${d.kind === 'strength' ? 'styrke' : d.kind === 'rest' ? 'hvile' : RUN_INFO[d.run!].label}`).join('; ')}.`,
    `Treningsperiode: uke ${cycle.week} av ${cycle.length}${cycle.deload ? ' (lett uke)' : ''}.`,
    `Fett: ${fat.bodyFatPercent.toFixed(1)} % (${fat.source === 'scan' ? 'fra skann' : 'grovt BMI-anslag'}), fordeling: ${fat.distribution}. FFMI: ${a.ffmi?.toFixed(1) ?? 'ukjent'}.`,
    m ? `Siste skann ${scans[0].date.slice(0, 10)}: midje ${m.waistCm}, bryst ${m.chestCm}, hofte ${m.hipCm}, arm V/H ${m.upperArmLeftCm}/${m.upperArmRightCm}, lår V/H ${m.thighLeftCm}/${m.thighRightCm} cm. Hode foran skulder ${m.forwardHeadCm ?? '–'} cm.` : 'Ingen skann ennå.',
    `PT-funn: ${a.findings.slice(0, 5).map((f) => f.title).join('; ')}. Holdningspunkter: ${posture.issues.map((i) => i.title).join(', ') || 'ingen'}.`,
    `Klokke: VO2maks ${profile.watch?.vo2max ?? '–'}, makspuls sett ${profile.watch?.maxHR ?? '–'}, hvilepuls ${profile.watch?.restingHR ?? '–'}, skritt/dag ${profile.watch?.steps ?? '–'}, aktiv energi ${profile.watch?.activeKcal ?? '–'} kcal.`,
    `Dagsform i dag: ${r ? `${r.level} (${r.reasons.join(', ') || 'ok'})` : 'ikke registrert'}. Vekt 7-dagers snitt: ${wt.avg7?.toFixed(1) ?? '–'} kg, endring siste uke: ${wt.weeklyChangePct?.toFixed(2) ?? '–'} %.`,
    `Siste økter:\n${recent.join('\n') || 'ingen logget ennå'}`,
  ].join('\n')
}

const RULES = (context: string) => `Du er en erfaren, varm og direkte personlig trener (PT) i appen FIV. Svar alltid på norsk bokmål, kort og konkret (maks ca. 150 ord med mindre brukeren ber om mer). Bygg på forskningsbasert praksis (progressiv overbelastning, RIR, 10–20 harde sett per muskel per uke, 4×4 og sone 2, protein 1,6–2,2 g/kg). Bruk dataene under om brukeren. Ikke still diagnoser. Ved brystsmerter, besvimelse, uvanlig tung pust, nummenhet eller akutt skade: si tydelig at de skal stoppe og kontakte lege (113 ved akutte brystsmerter). Ved vedvarende smerter: anbefal fysioterapeut. Foreslå konkrete endringer i dagens økt når det passer.

BRUKERENS DATA:
${context}

Svar nå på brukerens spørsmål.`

const SUGGESTIONS = [
  'Jeg sov dårlig, hva gjør jeg med dagens økt?',
  'Kneet verker litt etter løping. Hva bør jeg endre?',
  'Hva bør jeg spise før og etter 06:10-økta?',
  'Hvordan får jeg VO₂maks opp igjen i vinter?',
]

export function Chat() {
  const context = useContextText()
  const [sample, setSample] = useState<any>(undefined)
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ctl = useRef<AbortController | null>(null)

  useEffect(() => {
    const claude = (window as any).claude
    if (!claude?.use) { setSample(null); return }
    let alive = true
    claude.use('sample').then((s: any) => alive && setSample(s ?? null), () => alive && setSample(null))
    return () => { alive = false; ctl.current?.abort() }
  }, [])

  if (sample === null) {
    return <Card><p className="small muted"><Icon name="coach" size={16} /> «Spør PT-en» er tilgjengelig når appen åpnes i Claude.</p></Card>
  }

  const ask = async (q: string) => {
    if (!sample || !q.trim() || busy) return
    setError(''); setInput(''); setBusy(true)
    const history: Turn[] = [...turns, { role: 'user', content: q.trim() }]
    setTurns([...history, { role: 'assistant', content: '' }])
    ctl.current = new AbortController()
    const messages = [{ role: 'user', content: RULES(context) }, { role: 'assistant', content: 'Klar. Hva lurer du på?' }, ...history]
    try {
      const { text } = await sample(messages, {
        cache: false, signal: ctl.current.signal,
        onText: ({ text }: { text: string }) => setTurns([...history, { role: 'assistant', content: text }]),
      })
      setTurns([...history, { role: 'assistant', content: text }])
    } catch (e: any) {
      setTurns(history.slice(0, -1))
      setInput(q)
      setError(ERRORS[e?.code] ?? 'Fikk ikke svar nå. Prøv igjen om litt.')
    } finally { setBusy(false) }
  }

  return (
    <Card>
      <h3>Spør PT-en</h3>
      <p className="muted small">Claude svarer med skann, plan, dagsform og logg som bakgrunn.</p>
      {turns.length === 0 && (
        <div className="chips">{SUGGESTIONS.map((s) => <button key={s} disabled={!sample} onClick={() => ask(s)}>{s}</button>)}</div>
      )}
      <div className="chat" aria-live="polite">
        {turns.map((t, i) => <div key={i} className={`bubble ${t.role === 'user' ? 'me' : 'pt'}`}>{t.content || (busy ? 'Tenker …' : '')}</div>)}
      </div>
      {error && <p className="bad small">{error}</p>}
      <form className="row gap" onSubmit={(e) => { e.preventDefault(); ask(input) }}>
        <input id="chat-input" className="input grow" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Skriv et spørsmål …" disabled={!sample} />
        {busy ? <button type="button" className="btn" onClick={() => ctl.current?.abort()}>Stopp</button>
          : <button type="submit" className="btn primary" disabled={!sample || !input.trim()}>Spør</button>}
      </form>
    </Card>
  )
}
