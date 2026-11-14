import { useState } from 'react'
import { ARTICLES, DAILY_TIPS } from '../data/knowledge'
import { locationSummary } from '../engine/generator'
import { PRESET_LABEL, PRESETS, type PresetKey } from '../engine/presets'
import { EQUIPMENT_INFO, EQUIPMENT_ITEMS, type EquipmentItem, type Profile, type TrainingLocation } from '../engine/types'
import { lidarStatus } from '../scan/providers'
import { Card, Icon, Sheet, Tag } from './kit'
import { ProfileForm } from './ProfileForm'
import { useApp } from './state'

export function Coach() {
  const [open, setOpen] = useState<string | null>(null)
  const art = ARTICLES.find((a) => a.id === open)
  const cats = [...new Set(ARTICLES.map((a) => a.category))]
  return (
    <div className="stack">
      <header className="page-head"><h1>Din PT</h1></header>
      <Card><p className="eyebrow">Dagens tips</p><p>{DAILY_TIPS[Math.floor(Date.now() / 86_400_000) % DAILY_TIPS.length]}</p></Card>
      {cats.map((c) => (
        <section key={c} className="stack-s">
          <h2 className="section-title">{c}</h2>
          {ARTICLES.filter((a) => a.category === c).map((a) => (
            <Card key={a.id} onClick={() => setOpen(a.id)}>
              <div className="row between"><div><strong>{a.title}</strong><p className="muted small">{a.summary}</p></div><Icon name="chevron" /></div>
            </Card>
          ))}
        </section>
      ))}
      <p className="muted small">FIV gir generelle treningsråd basert på forskning og er ikke medisinsk rådgivning. Har du sykdom, skader eller er gravid — snakk med lege eller fysioterapeut før du starter.</p>
      <Sheet open={!!art} onClose={() => setOpen(null)} title={art?.title ?? ''}>
        {art && (
          <article className="article">
            <p className="eyebrow accent">{art.category}</p>
            <p className="lead">{art.summary}</p>
            {art.body.map((b) => <p key={b}>{b}</p>)}
            <h3>Kilder</h3>
            <ul className="small muted">{art.sources.map((s) => <li key={s}>{s}</li>)}</ul>
          </article>
        )}
      </Sheet>
    </div>
  )
}

export function ProfileView({ onBack }: { onBack: () => void }) {
  const { profile, saveProfile, backend, data } = useApp()
  const [draft, setDraft] = useState<Profile>(profile)
  const [loc, setLoc] = useState<string | null>(null)
  const [copied, setCopied] = useState('')
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile)
  const lidar = lidarStatus()
  const editing = draft.locations.find((l) => l.id === loc)
  const setLocation = (l: TrainingLocation) => setDraft({ ...draft, locations: draft.locations.map((x) => (x.id === l.id ? l : x)) })
  const addLocation = (k: PresetKey) => { const l = PRESETS[k](); setDraft({ ...draft, locations: [...draft.locations, l] }); setLoc(l.id) }
  const backup = async () => {
    const text = JSON.stringify({ app: 'FIV', version: 1, exported: new Date().toISOString(), ...data })
    try { await navigator.clipboard.writeText(text); setCopied('Sikkerhetskopien er kopiert. Lim den inn i et notat eller en e-post til deg selv.') }
    catch { setCopied('Kunne ikke kopiere automatisk på denne enheten.') }
  }
  return (
    <div className="stack">
      <header className="page-head"><button className="btn ghost" onClick={onBack}><Icon name="back" /> Tilbake</button><h1>Profil</h1></header>
      <ProfileForm value={draft} onChange={setDraft} />
      <fieldset>
        <legend>Utstyr & treningssteder</legend>
        <div className="list">
          {draft.locations.map((l) => (
            <button key={l.id} className="list-row" onClick={() => setLoc(l.id)}>
              <span><strong>{l.name}</strong> {l.id === draft.activeLocationId && <Tag>aktiv</Tag>}<br /><span className="muted small">{locationSummary(l)}</span></span>
              <Icon name="chevron" size={16} />
            </button>
          ))}
        </div>
        <label className="field"><span>Legg til sted</span>
          <select id="add-location" value="" onChange={(e) => e.target.value && addLocation(e.target.value as PresetKey)}>
            <option value="">Velg mal …</option>
            {(Object.keys(PRESET_LABEL) as PresetKey[]).map((k) => <option key={k} value={k}>{PRESET_LABEL[k]}</option>)}
          </select>
        </label>
      </fieldset>
      <fieldset>
        <legend>Skannemetode</legend>
        <label className="check"><input type="radio" name="scan" checked={draft.scanMethod === 'camera'} onChange={() => setDraft({ ...draft, scanMethod: 'camera' })} />Kamera + AI (fungerer nå i nettleseren)</label>
        <label className="check"><input type="radio" name="scan" checked={draft.scanMethod === 'lidar'} onChange={() => setDraft({ ...draft, scanMethod: 'lidar' })} />LiDAR via FIV-appen for iPhone Pro</label>
        <p className="hint">{draft.scanMethod === 'lidar' ? lidar.reason + ' Du kan likevel importere skann eksportert fra appen.' : 'LiDAR gir ekte 3D-dybde og mer presise mål. Aktiver når iPhone-appen er klar.'}</p>
      </fieldset>
      <button className="btn primary big full sticky-save" disabled={!dirty} onClick={() => saveProfile(draft)}>{dirty ? 'Lagre og oppdater programmene' : 'Lagret'}</button>
      <fieldset>
        <legend>Data</legend>
        <p className="small">{backend.kind === 'cloud' ? 'Dataene dine lagres privat på kontoen din og følger deg mellom enheter.' : 'Dataene dine lagres bare i denne nettleseren.'}</p>
        <button className="btn full" onClick={backup}>Kopier sikkerhetskopi</button>
        {copied && <p className="small muted">{copied}</p>}
      </fieldset>
      <Sheet open={!!editing} onClose={() => setLoc(null)} title={editing?.name ?? ''}>
        {editing && <LocationEditor loc={editing} onChange={setLocation} canDelete={draft.locations.length > 1}
          isActive={editing.id === draft.activeLocationId}
          onActivate={() => setDraft({ ...draft, activeLocationId: editing.id })}
          onDelete={() => { const rest = draft.locations.filter((l) => l.id !== editing.id); setDraft({ ...draft, locations: rest, activeLocationId: draft.activeLocationId === editing.id ? rest[0].id : draft.activeLocationId }); setLoc(null) }} />}
      </Sheet>
    </div>
  )
}

const DB_OPTIONS = [1, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10, 12, 12.5, 14, 15, 16, 17.5, 18, 20, 22, 22.5, 24, 25, 26, 27.5, 28, 30, 32, 34, 35, 36, 38, 40, 42, 44, 45, 46, 48, 50]
const KB_OPTIONS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48]

function LocationEditor({ loc, onChange, onDelete, canDelete, isActive, onActivate }: {
  loc: TrainingLocation; onChange: (l: TrainingLocation) => void; onDelete: () => void; canDelete: boolean; isActive: boolean; onActivate: () => void
}) {
  const has = (i: EquipmentItem) => loc.equipment.includes(i)
  const toggle = (i: EquipmentItem, on: boolean) => {
    const equipment = on ? [...loc.equipment, i] : loc.equipment.filter((x) => x !== i)
    const next = { ...loc, equipment }
    if (on && i === 'dumbbells' && !loc.dumbbellWeights.length) next.dumbbellWeights = [2, 4, 6, 8, 10, 12.5, 15, 17.5, 20]
    if (on && i === 'kettlebell' && !loc.kettlebellWeights.length) next.kettlebellWeights = [8, 12, 16]
    onChange(next)
  }
  const cats = [...new Set(EQUIPMENT_ITEMS.map((i) => EQUIPMENT_INFO[i].category))]
  const weights = (opts: number[], sel: number[], key: 'dumbbellWeights' | 'kettlebellWeights') => (
    <div className="weight-grid">
      {opts.map((w) => {
        const on = sel.includes(w)
        return <button key={w} aria-pressed={on} className={on ? 'on' : ''} onClick={() => onChange({ ...loc, [key]: on ? sel.filter((x) => x !== w) : [...sel, w].sort((a, b) => a - b) })}>{String(w).replace('.', ',')}</button>
      })}
    </div>
  )
  return (
    <div className="stack">
      <label className="field"><span>Navn</span><input id="loc-name" value={loc.name} onChange={(e) => onChange({ ...loc, name: e.target.value })} /></label>
      {!isActive && <button className="btn full" onClick={onActivate}>Tren her nå</button>}
      <label className="field"><span>Fyll ut fra mal</span>
        <select id="loc-preset" value="" onChange={(e) => { if (!e.target.value) return; const p = PRESETS[e.target.value as PresetKey](); onChange({ ...loc, equipment: p.equipment, dumbbellWeights: p.dumbbellWeights, kettlebellWeights: p.kettlebellWeights, barbellMaxKg: p.barbellMaxKg }) }}>
          <option value="">Velg …</option>
          {(Object.keys(PRESET_LABEL) as PresetKey[]).map((k) => <option key={k} value={k}>{PRESET_LABEL[k]}</option>)}
        </select>
      </label>
      {cats.map((c) => (
        <fieldset key={c}><legend>{c}</legend>
          {EQUIPMENT_ITEMS.filter((i) => EQUIPMENT_INFO[i].category === c).map((i) => (
            <label key={i} className="check"><input type="checkbox" checked={has(i)} onChange={(e) => toggle(i, e.target.checked)} />{EQUIPMENT_INFO[i].label}</label>
          ))}
        </fieldset>
      ))}
      {has('dumbbells') && <fieldset><legend>Manualer du har (kg per stk)</legend>{weights(DB_OPTIONS, loc.dumbbellWeights, 'dumbbellWeights')}
        <p className="hint">Justerbare manualer? Velg alle trinnene de kan stilles til. PT-en foreslår bare vekter du faktisk har.</p></fieldset>}
      {has('kettlebell') && <fieldset><legend>Kettlebells (kg)</legend>{weights(KB_OPTIONS, loc.kettlebellWeights, 'kettlebellWeights')}</fieldset>}
      {canDelete && <button className="btn ghost full" onClick={onDelete}>Fjern dette stedet</button>}
      <p className="muted small">Trykk «Lagre og oppdater programmene» når du er ferdig.</p>
    </div>
  )
}
