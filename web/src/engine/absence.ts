// Står over en økt: syk, skadet, opptatt eller sliten. Syk-modus pauser planen og trapper gradvis opp igjen.
import type { Adjusted } from './daily'
import { readNote, type NoteReading } from './notes'
import type { DayPlan } from './week'
import { RUN_INFO } from './week'

export type SkipReason = 'sick' | 'injury' | 'tired' | 'busy' | 'other'
export interface SkipEntry { date: string; reason: SkipReason; note?: string }
/** Sykdomsperiode. `recovered` settes når brukeren trykker «Jeg er frisk». */
export interface SickPeriod { since: string; recovered?: string; note?: string }

export const SKIP_LABEL: Record<SkipReason, string> = {
  sick: 'Syk / forkjølet', injury: 'Skadet / vondt', tired: 'Sliten / sov dårlig', busy: 'Ikke tid', other: 'Annet',
}

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const days = (a: string, b: Date) => Math.floor((new Date(dayKey(b) + 'T12:00').getTime() - new Date(a.slice(0, 10) + 'T12:00').getTime()) / 86_400_000)

export type HealthPhase =
  | { phase: 'sick'; day: number; note?: string }
  | { phase: 'return'; step: 1 | 2; daysLeft: number; sickDays: number }
  | { phase: 'normal' }

/**
 * Tilbake etter sykdom: dag 1–2 (eller lenger etter lang sykdom) halv belastning uten harde intervaller,
 * så noen dager med 75 %, deretter normal drift.
 */
export function healthPhase(sick: SickPeriod | undefined, now = new Date()): HealthPhase {
  if (!sick) return { phase: 'normal' }
  if (!sick.recovered) return { phase: 'sick', day: days(sick.since, now) + 1, note: sick.note }
  const sickDays = Math.max(1, days(sick.since, new Date(sick.recovered + 'T12:00')))
  const len1 = sickDays >= 7 ? 3 : 2, len2 = sickDays >= 7 ? 4 : 2
  const since = days(sick.recovered, now)
  if (since < len1) return { phase: 'return', step: 1, daysLeft: len1 + len2 - since, sickDays }
  if (since < len1 + len2) return { phase: 'return', step: 2, daysLeft: len1 + len2 - since, sickDays }
  return { phase: 'normal' }
}

/** Justerer dagens økt etter helsefasen og en eventuell kommentar fra forrige dag brukeren sto over. */
export function adjustForHealth(a: Adjusted, h: HealthPhase, lastSkip?: SkipEntry): Adjusted {
  let { day, volumeFactor, runScale } = a
  const msgs = a.message ? [a.message] : []
  const easyRun = (d: DayPlan): DayPlan => (d.run && RUN_INFO[d.run].hard ? { ...d, run: 'easy' } : d)
  if (h.phase === 'return') {
    if (h.step === 1) {
      volumeFactor = Math.min(volumeFactor, 0.5); day = easyRun(day); runScale = Math.min(runScale, 0.6)
      msgs.push(`Tilbake etter sykdom: rolig start med halv belastning og ingen harde intervaller. Normal drift om ${h.daysLeft} dager hvis kroppen svarer bra.`)
    } else {
      volumeFactor = Math.min(volumeFactor, 0.75); runScale = Math.min(runScale, 0.75)
      msgs.push(`Nesten tilbake: 75 % av økta. Normal drift om ${h.daysLeft} ${h.daysLeft === 1 ? 'dag' : 'dager'}.`)
    }
    msgs.push('Kjenner du deg slapp, med høy hvilepuls eller feber igjen: stopp og hvil.')
  }
  const n: NoteReading | undefined = lastSkip ? readNote(lastSkip.note) : undefined
  if (lastSkip && h.phase === 'normal') {
    if (lastSkip.reason === 'tired' || n?.signal === 'tooHard') { volumeFactor = Math.min(volumeFactor, 0.8); msgs.push('Du sto over sist fordi du var sliten. Litt lettere i dag, så bygger vi videre.') }
    if (lastSkip.reason === 'busy') msgs.push('Du sto over sist på grunn av tid. Planen går videre som normalt.')
  }
  return { day, volumeFactor, runScale, message: msgs.join(' ') }
}

/** Dager som ikke skal telle mot ukeringene (syk eller skadet). */
export function excusedDays(skips: SkipEntry[] = [], sick?: SickPeriod, now = new Date()): Set<string> {
  const out = new Set(skips.filter((s) => s.reason === 'sick' || s.reason === 'injury').map((s) => s.date))
  if (sick) {
    const last = sick.recovered ? sick.recovered : dayKey(now)
    for (let d = new Date(sick.since.slice(0, 10) + 'T12:00'); dayKey(d) <= last; d.setDate(d.getDate() + 1)) {
      if (sick.recovered && dayKey(d) === sick.recovered) break // friskmeldingsdagen kan trenes
      out.add(dayKey(d))
    }
  }
  return out
}
