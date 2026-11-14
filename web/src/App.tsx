import { useEffect, useState } from 'react'
import { openStore, type AppData, type Backend } from './data/store'
import type { WorkoutDay } from './engine/generator'
import type { Profile } from './engine/types'
import { Body } from './ui/Body'
import { Home } from './ui/Home'
import { Icon } from './ui/kit'
import { Coach, ProfileView } from './ui/More'
import { Program } from './ui/Program'
import { Onboarding, Ring } from './ui/ProfileForm'
import { Scan } from './ui/Scan'
import { AppProvider, buildPrograms } from './ui/state'
import { Workout } from './ui/Workout'

const TABS = [
  ['home', 'Hjem', 'home'], ['body', 'Kropp', 'body'], ['scan', 'Skann', 'scan'], ['program', 'Program', 'list'], ['pt', 'PT', 'coach'],
] as const
type Tab = (typeof TABS)[number][0] | 'profil'

function readHash(): Tab {
  const h = location.hash.replace('#', '')
  return (TABS.some((t) => t[0] === h) || h === 'profil' ? h : 'home') as Tab
}

export default function App() {
  const [store, setStore] = useState<{ backend: Backend; data: AppData } | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { openStore().then(setStore, (e) => setError(String(e))) }, [])

  if (error) return <div className="center-screen"><p>Kunne ikke starte: {error}</p></div>
  if (!store) return <div className="center-screen"><Ring /><p className="muted">Laster …</p></div>
  if (!store.data.profile) {
    return (
      <main className="app">
        <Onboarding onDone={async (p: Profile) => {
          const programs = buildPrograms(p, store.data.scans)
          await store.backend.saveProfile(p); await store.backend.savePrograms(programs)
          setStore({ ...store, data: { ...store.data, profile: p, programs } })
          location.hash = 'scan'
        }} />
      </main>
    )
  }
  return (
    <AppProvider initial={store.data as AppData & { profile: Profile }} backend={store.backend}>
      <Shell />
    </AppProvider>
  )
}

function Shell() {
  const [tab, setTab] = useState<Tab>(readHash)
  const [sub, setSub] = useState<string | undefined>()
  const [workout, setWorkout] = useState<WorkoutDay | null>(null)
  useEffect(() => {
    const on = () => setTab(readHash())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  const go = (t: string, s?: string) => { setSub(s); location.hash = t; setTab(t as Tab); scrollTo(0, 0) }

  if (workout) return <main className="app"><Workout day={workout} onClose={() => { setWorkout(null); scrollTo(0, 0) }} /></main>

  return (
    <>
      <main className="app">
        {tab === 'home' && (
          <button className="profile-btn icon-btn" onClick={() => go('profil')} aria-label="Profil og innstillinger"><Icon name="user" size={22} /></button>
        )}
        {tab === 'home' && <Home go={go} startWorkout={setWorkout} />}
        {tab === 'body' && <Body key={sub} initial={sub} />}
        {tab === 'scan' && <Scan />}
        {tab === 'program' && <Program startWorkout={setWorkout} />}
        {tab === 'pt' && <Coach />}
        {tab === 'profil' && <ProfileView onBack={() => go('home')} />}
      </main>
      <nav className="tabbar" aria-label="Hovedmeny">
        {TABS.map(([k, label, icon]) => (
          <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}>
            <Icon name={icon} size={22} /><span>{label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
