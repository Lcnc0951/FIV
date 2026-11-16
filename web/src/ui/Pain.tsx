// Viser midlertidig tilpasning for plager: hva er tatt ut, opptrening og når det gjelder til.
import { exercise } from '../engine/library'
import { AREA_TEXT, PAIN_RULES } from '../engine/pain'
import type { Limitation } from '../engine/types'
import { Card, Icon } from './kit'
import { useApp } from './state'

const dateText = (iso: string) => new Date(iso).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })

export function PainBanner({ compact = false }: { compact?: boolean }) {
  const { pain, clearTempLimitation, setTempLimitation } = useApp()
  if (!pain.areas.length) return null
  const removed = pain.removed.map((id) => exercise(id)?.name ?? id)
  return (
    <Card className="pain-card">
      {pain.areas.map((a: Limitation) => (
        <div key={a} className="stack-s">
          <div className="row between wrap gap-s">
            <h3><Icon name="info" size={16} /> Tilpasset for {AREA_TEXT[a]}</h3>
            <span className="muted small">til {dateText(pain.until[a])}</span>
          </div>
          {!compact && (
            <>
              <p className="small"><strong>Daglig opptrening:</strong></p>
              <ul className="small">{PAIN_RULES[a].rehab.map((r) => <li key={r}>{r}</li>)}</ul>
              {PAIN_RULES[a].run && <p className="small">{PAIN_RULES[a].run}</p>}
            </>
          )}
          <div className="row gap-s wrap">
            <button className="btn small" onClick={() => clearTempLimitation(a)}>Bedre nå, vanlig program</button>
            <button className="btn small ghost" onClick={() => setTempLimitation(a, 7)}>Forleng 7 dager</button>
          </div>
        </div>
      ))}
      {removed.length > 0 && <p className="muted small">Tatt ut midlertidig: {removed.join(', ')}.</p>}
      <p className="muted small">Smerte opp til 3/10 under øvelser er ok hvis det har roet seg dagen etter. Ikke bedre etter 1–2 uker: kontakt fysioterapeut.</p>
    </Card>
  )
}
