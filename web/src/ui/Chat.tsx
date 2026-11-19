// «Spør PT-en»: Claude svarer med dine data som kontekst (via Claude-artifactens sample-funksjon).
import { useEffect, useRef, useState } from 'react'
import { analyzeBody, planPosture } from '../engine/analyzer'
import { analyzeFat } from '../engine/coach'
import { cycleInfo, readiness, todayKey, weightTrend } from '../engine/daily'
import { exercise } from '../engine/library'
import { GOAL_INFO, LIMITATION_LABEL, PHYSIQUE_INFO, POSTURE_GOAL_LABEL } from '../engine/types'
import { planWeek, RUN_INFO, WEEKDAYS } from '../engine/week'
import { AREA_TEXT, detectPain, PAIN_RULES } from '../engine/pain'
import type { Limitation } from '../engine/types'
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
  const { profile, pd, data, program, pain } = useApp()
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
    const n = w.note ? ` — kommentar: «${w.note}»` : ''
    if (w.run) return `${d} ${RUN_INFO[w.run.type].label}: føltes ${w.run.rpe}/10${w.run.reps ? `, ${w.run.reps} drag` : ''}${w.run.minutes ? `, ${w.run.minutes} min` : ''}${w.run.avgHR ? `, snittpuls ${w.run.avgHR}` : ''}${w.run.km ? `, ${w.run.km} km` : ''}${n}`
    const e = exercise(w.exerciseId)
    return `${d} ${e?.name ?? w.exerciseId}: ${w.sets.map((s) => `${s.weightKg}kg×${s.reps}`).join(', ')}${n}`
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
    `Styrkeøktene nå: ${program?.days.map((d) => `${d.name}: ${d.exercises.map((x) => exercise(x.exerciseId)?.name ?? x.exerciseId).join(', ')}`).join(' | ') ?? 'ingen'}.`,
    `Helse: ${profile.sick && !profile.sick.recovered ? `SYK siden ${profile.sick.since.slice(0, 10)}${profile.sick.note ? ` («${profile.sick.note}»)` : ''}` : profile.sick?.recovered ? `var syk ${profile.sick.since.slice(0, 10)}–${profile.sick.recovered}, trapper opp igjen` : 'frisk'}. Sto over siste 14 dager: ${(profile.skips ?? []).filter((s) => Date.now() - new Date(s.date).getTime() < 14 * 864e5).map((s) => `${s.date} ${s.reason}${s.note ? ` («${s.note}»)` : ''}`).join('; ') || 'ingen'}.`,
    `Midlertidig tilpasset for plager: ${pain.areas.map((a) => `${AREA_TEXT[a]} til ${pain.until[a].slice(0, 10)}`).join(', ') || 'nei'}.`,
    `Siste økter:\n${recent.join('\n') || 'ingen logget ennå'}`,
  ].join('\n')
}

const RULES = (context: string) => `Du er en erfaren, varm og direkte personlig trener (PT) i appen FIV, med god kunnskap om idrettsskader og opptrening (som en PT som samarbeider tett med fysioterapeut). Svar alltid på norsk bokmål, kort og konkret (maks ca. 150 ord for vanlige spørsmål). Bygg på forskningsbasert praksis (progressiv overbelastning, RIR, 10–20 harde sett per muskel per uke, 4×4 og sone 2, protein 1,6–2,2 g/kg). Bruk dataene under om brukeren, og nevn øvelsene deres ved navn. Ta hensyn til brukerens kommentarer til siste økter. Foreslå konkrete endringer i dagens økt når det passer.

BRUKERENS DATA:
${context}`

const PAIN_GUIDE = `DETTE ER ET SPØRSMÅL OM SMERTE ELLER PLAGER. Svar grundig, men strukturert (maks ca. 350 ord), med korte overskrifter i denne rekkefølgen:
1. **Først: sjekk dette.** De viktigste faresignalene for akkurat dette området, og hva de skal gjøre (113 ved brystsmerter/trykk, tung pust, kaldsvette, utstråling til kjeve/arm, eller lammelser. Merk: smerte bak venstre skulderblad eller i venstre arm som kommer ved anstrengelse kan være hjertet. Lege ved nummenhet, kraftsvikt, nattsmerter, feber, hevelse etter fall eller vanskeligheter med vannlating).
2. **Hva det trolig er.** 2–3 sannsynlige årsaker i vanlig språk (ikke diagnose), hver med et enkelt selvtest-tegn de kan kjenne etter.
3. **Programmet ditt denne uka.** Hvilke av brukerens egne øvelser de skal kutte, hvilke som kan beholdes lettere, og hva som fortsatt er trygt (inkludert løping).
4. **Opptrening.** 2–3 øvelser med dosering (sett × reps/sekunder, hvor ofte), gjerne isometrisk først.
5. **Smerteregel og oppfølging.** Smerte ≤ 3/10 under trening er greit hvis det har roet seg neste dag. Når de bør gå til fysioterapeut eller lege.
Mangler det viktig informasjon (hvordan det startet, hvor lenge, hvilke bevegelser som gjør vondt), still 1–2 korte oppfølgingsspørsmål til slutt. Ikke still diagnoser, og vær ærlig om usikkerhet. Avslutt med at de kan trykke «Tilpass programmet» i appen.`

const SUGGESTIONS = [
  'Jeg sov dårlig, hva gjør jeg med dagens økt?',
  'Jeg har vondt bak venstre skulderblad, og det gjør vondt å løfte armen.',
  'Kneet verker litt etter løping. Hva bør jeg endre?',
  'Hva bør jeg spise før og etter 06:10-økta?',
  'Hvordan får jeg VO₂maks opp igjen i vinter?',
]

// Enkel formatering av PT-svar: overskrifter, lister og fet skrift (uten HTML-injeksjon)
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part)
}
export function Formatted({ text }: { text: string }) {
  const blocks: JSX.Element[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  const flush = () => {
    if (!list) return
    const items = list.items.map((x, i) => <li key={i}>{inline(x)}</li>)
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>)
    list = null
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    const bullet = line.match(/^[-*•]\s+(.*)/), num = line.match(/^\d+[.)]\s+(.*)/)
    if (bullet || num) {
      const ordered = !!num
      if (list && list.ordered !== ordered) flush()
      list ??= { ordered, items: [] }
      list.items.push((bullet ?? num)![1])
      continue
    }
    flush()
    if (!line) continue
    const h = line.match(/^#{1,4}\s+(.*)/)
    blocks.push(h ? <p key={blocks.length} className="bubble-h">{inline(h[1].replace(/\*\*/g, ''))}</p> : <p key={blocks.length}>{inline(line)}</p>)
  }
  flush()
  return <>{blocks}</>
}

export function Chat() {
  const context = useContextText()
  const [sample, setSample] = useState<any>(undefined)
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ctl = useRef<AbortController | null>(null)
  const [painArea, setPainArea] = useState<Limitation | undefined>()
  const { pain, setTempLimitation } = useApp()

  useEffect(() => {
    const claude = (window as any).claude
    if (!claude?.use) { setSample(null); return }
    let alive = true
    claude.use('sample').then((s: any) => alive && setSample(() => s ?? null), () => alive && setSample(null))
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
    // Smertespørsmål (også oppfølging i samme samtale) får grundigere svar fra en sterkere modell
    const found = detectPain(q)
    const painTalk = found.pain || !!painArea
    if (found.area) setPainArea(found.area)
    const rules = RULES(context) + (painTalk ? `\n\n${PAIN_GUIDE}` : '')
    const messages = [{ role: 'user', content: rules }, { role: 'assistant', content: 'Klar. Hva lurer du på?' }, ...history]
    try {
      const { text } = await sample(messages, {
        cache: false, signal: ctl.current.signal, ...(painTalk ? { modelTier: 'complex' } : {}),
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
        {turns.map((t, i) => <div key={i} className={`bubble ${t.role === 'user' ? 'me' : 'pt'}`}>{t.role === 'assistant' && t.content ? <Formatted text={t.content} /> : t.content || (busy ? 'Tenker …' : '')}</div>)}
      </div>
      {painArea && !busy && turns.at(-1)?.content && (
        pain.areas.includes(painArea)
          ? <p className="adjust small chat-action"><Icon name="check" size={14} /> Programmet er tilpasset for {AREA_TEXT[painArea]}. Se Program-fanen.</p>
          : <div className="adjust small chat-action stack-s">
              <span><strong>Tilpass programmet for {AREA_TEXT[painArea]} i 7 dager?</strong> Tar midlertidig ut {PAIN_RULES[painArea].patterns.length ? 'øvelser som belaster området' : 'tunge øvelser for ryggen'}, gjør resten lettere og legger inn daglig opptrening.</span>
              <button className="btn small primary" onClick={() => setTempLimitation(painArea, 7)}>Tilpass programmet</button>
            </div>
      )}
      {error && <p className="bad small">{error}</p>}
      <form className="row gap" onSubmit={(e) => { e.preventDefault(); ask(input) }}>
        <input id="chat-input" className="input grow" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Skriv et spørsmål …" disabled={!sample} />
        {busy ? <button type="button" className="btn" onClick={() => ctl.current?.abort()}>Stopp</button>
          : <button type="submit" className="btn primary" disabled={!sample || !input.trim()}>Spør</button>}
      </form>
    </Card>
  )
}
