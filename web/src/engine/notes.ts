// Tolker brukerens kommentar til en økt, så neste økt kan tilpasses.
import { detectPain } from './pain'
import type { Limitation } from './types'

export type NoteSignal = 'pain' | 'tooHard' | 'tooEasy'
export interface NoteReading { signal?: NoteSignal; area?: Limitation; text: string }

const HARD = /for tung|for hard|veldig tung|tungt|sliten|slitsom|utslitt|klarte ikke|ga opp|måtte stoppe|stoppet|kvalm|svimmel|tom for|stum|sprengt|orket ikke|gikk tom/i
const EASY = /for lett|lett(?!ere)|kunne tatt mer|mer i meg|overskudd|enkelt|lite krevende|kjedelig|ikke sliten/i

export function readNote(note?: string): NoteReading | undefined {
  const text = note?.trim()
  if (!text) return undefined
  const pain = detectPain(text)
  if (pain.pain) return { signal: 'pain', area: pain.area, text }
  // «ikke for tungt» / «ikke lett» snus
  const neg = /ikke (så |for )?(tung|hard|lett)/i.test(text)
  if (HARD.test(text) && !/ikke (så |for )?(tung|hard)/i.test(text)) return { signal: 'tooHard', text }
  if (EASY.test(text) && !/ikke (så |for )?lett/i.test(text)) return { signal: 'tooEasy', text }
  if (neg && /ikke (så |for )?(tung|hard)/i.test(text)) return { signal: 'tooEasy', text }
  return { text }
}

export const quote = (t: string) => `«${t.length > 90 ? t.slice(0, 87) + '…' : t}»`
