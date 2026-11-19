// «Står over i dag» og syk-modus på dagens kort.
import { useState } from 'react'
import { dayKey, healthPhase, SKIP_LABEL, type SkipEntry, type SkipReason } from '../engine/absence'
import { detectPain, AREA_TEXT } from '../engine/pain'
import { Icon, Sheet } from './kit'
import { useApp } from './state'

export function useHealth() {
  const { profile, data } = useApp()
  const today = dayKey(new Date())
  const phase = healthPhase(profile.sick)
  const skippedToday = profile.skips?.find((s) => s.date === today)
  // Siste gang brukeren sto over (før i dag), hvis ingen økt er gjort siden
  const prev = [...(profile.skips ?? [])].filter((s) => s.date < today).sort((a, b) => b.date.localeCompare(a.date))[0]
  const trainedSince = prev && data.workouts.some((w) => w.date.slice(0, 10) > prev.date)
  return { phase, skippedToday, lastSkip: trainedSince ? undefined : prev }
}

export function SkipButton() {
  const { profile, saveProfile, setTempLimitation, pain } = useApp()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<SkipReason>('sick')
  const [note, setNote] = useState('')
  const area = detectPain(note).area
  const save = async () => {
    const today = dayKey(new Date())
    const entry: SkipEntry = { date: today, reason, note: note.trim() || undefined }
    const skips = [...(profile.skips ?? []).filter((s) => s.date !== today), entry].slice(-60)
    const sick = reason === 'sick' ? { since: today, note: entry.note } : profile.sick
    await saveProfile({ ...profile, skips, sick }, false)
    if (reason === 'injury' && area && !pain.areas.includes(area)) await setTempLimitation(area, 7)
    setOpen(false)
  }
  return (
    <>
      <button className="btn ghost full" onClick={() => setOpen(true)}>Står over i dag</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Står over i dag">
        <div className="stack-s">
          {(Object.keys(SKIP_LABEL) as SkipReason[]).map((r) => (
            <button key={r} className={`choice ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}><strong>{SKIP_LABEL[r]}</strong></button>
          ))}
          <label className="field"><span>Hvorfor? (valgfritt)</span>
            <textarea id="skip-note" className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={reason === 'sick' ? 'F.eks. «Hovne mandler, tett nese og vondt i hodet»' : reason === 'injury' ? 'F.eks. «Vondt bak venstre skulderblad»' : 'F.eks. «Sov bare 5 timer»'} /></label>
          <p className="adjust small"><Icon name="info" size={14} /> {
            reason === 'sick' ? 'Syk-modus: planen settes på pause og ringene teller ikke de syke dagene. Trykk «Jeg er frisk» når du er bedre, så trapper vi gradvis opp igjen.'
            : reason === 'injury' ? `Dagen teller ikke mot ringene.${area ? ` Programmet tilpasses for ${AREA_TEXT[area]} i 7 dager.` : ' Skriv hvor det gjør vondt, så tilpasses programmet.'}`
            : reason === 'tired' ? 'Neste økt blir litt lettere, så bygger vi videre.'
            : 'Planen går videre som normalt. Dagen teller som ikke gjennomført.'}</p>
          <button className="btn primary big full" onClick={save}>Lagre</button>
        </div>
      </Sheet>
    </>
  )
}

/** Vises i stedet for dagens økt mens brukeren er syk. */
export function SickCard() {
  const { profile, saveProfile } = useApp()
  const { phase } = useHealth()
  const [confirm, setConfirm] = useState(false)
  if (phase.phase !== 'sick') return null
  const recover = () => saveProfile({ ...profile, sick: { ...profile.sick!, recovered: dayKey(new Date()) } }, false)
  const undo = () => saveProfile({ ...profile, sick: undefined, skips: (profile.skips ?? []).filter((s) => !(s.reason === 'sick' && s.date >= profile.sick!.since.slice(0, 10))) }, false)
  return (
    <div className="stack-s">
      <h2>Syk-modus · dag {phase.day}</h2>
      {phase.note && <p className="small">💬 {phase.note}</p>}
      <p className="small"><strong>Hvil.</strong> Med slapphet, feber, hovne mandler eller muskelverk trener du ikke. Bare tett nese og ingen feber: en rolig gåtur er ok.</p>
      <ul className="small">
        <li>Drikk mye, sov godt og spis selv om matlysten er dårlig.</li>
        <li>Frisk = feberfri i 24–48 timer og ikke lenger slapp. Hvilepulsen bør være tilbake på normalen{profile.watch?.restingHR ? ` (ca. ${profile.watch.restingHR})` : ''}.</li>
        <li>Kontakt lege ved høy feber i mer enn 2–3 dager, vondt å svelge, ensidig hovne mandler eller tung pust. Ring 113 ved brystsmerter eller uregelmessig puls.</li>
      </ul>
      <p className="muted small">Ringene og rekken av fullførte uker teller ikke de syke dagene.</p>
      <button className="btn primary big full" onClick={recover}><Icon name="check" /> Jeg er frisk igjen</button>
      {!confirm ? <button className="link small" onClick={() => setConfirm(true)}>Ble det feil? Avslutt syk-modus</button>
        : <button className="btn small ghost" onClick={undo}>Bekreft: fjern sykdomsperioden</button>}
    </div>
  )
}
