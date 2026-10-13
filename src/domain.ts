export type ToolView = 'today' | 'birthdays' | 'concerts' | 'sunset' | 'flight' | 'routines' | 'moment' | 'notes' | 'trackers'

export interface RoutineItem {
  id: string
  text: string
  done: boolean
}

export interface Routine {
  id: string
  name: string
  items: RoutineItem[]
}

export interface Note {
  id: string
  title: string
  body: string
  updatedAt: string
}

export interface Tracker {
  id: string
  label: string
  value: number
  target: number
  unit: string
  step: number
}

export interface Birthday {
  id: string
  name: string
  date: string
  reminderDays: number
  notes: string
  giftIdeas: string
  photoId?: string
}

export interface Concert {
  id: string
  artist: string
  dateTime: string
  venue: string
  city: string
  companions: string
  supportingArtists: string
  notes: string
  photoIds: string[]
}

export interface SolarSettings {
  latitude: number
  longitude: number
  locationName: string
  updatedAt?: string
}

export type FlightStatus = 'idle' | 'flying' | 'paused' | 'arrived'

export interface FocusFlight {
  originCode: string
  destinationCode: string
  durationMinutes: number
  intention: string
  arrivalMessage: string
  status: FlightStatus
  startedAt?: string
  endsAt?: string
  pausedRemainingSeconds?: number
  landedAt?: string
}

export interface AppData {
  version: 4
  routines: Routine[]
  moment: {
    label: string
    targetAt: string
  }
  notes: Note[]
  trackers: Tracker[]
  birthdays: Birthday[]
  concerts: Concert[]
  solar: SolarSettings
  focusFlight: FocusFlight
  updatedAt: string
}

export function createInitialState(): AppData {
  const now = new Date()
  const future = new Date(now)
  future.setDate(future.getDate() + 24)
  future.setHours(9, 0, 0, 0)

  return {
    version: 4,
    routines: [],
    moment: { label: '', targetAt: future.toISOString() },
    notes: [],
    trackers: [],
    birthdays: [],
    concerts: [],
    solar: {
      latitude: 49.2827,
      longitude: -123.1207,
      locationName: 'Vancouver, BC',
    },
    focusFlight: {
      originCode: 'YVR',
      destinationCode: 'KHN',
      durationMinutes: 50,
      intention: '',
      arrivalMessage: '',
      status: 'idle',
    },
    updatedAt: now.toISOString(),
  }
}

export function migrateAppData(input: unknown): AppData {
  const defaults = createInitialState()
  if (!input || typeof input !== 'object') return defaults
  const candidate = input as Partial<AppData>
  const legacy = Number((candidate as { version?: number }).version ?? 0) < 4
  const omitLegacySeeds = <T extends { id: string }>(items: T[], seedIds: string[]) => (
    legacy ? items.filter((item) => !seedIds.includes(item.id)) : items
  )
  const routines = Array.isArray(candidate.routines) ? omitLegacySeeds(candidate.routines, ['morning-reset', 'leaving-home']) : defaults.routines
  const notes = Array.isArray(candidate.notes) ? omitLegacySeeds(candidate.notes, ['first-note']) : defaults.notes
  const trackers = Array.isArray(candidate.trackers) ? omitLegacySeeds(candidate.trackers, ['water', 'outside', 'deep-work']) : defaults.trackers
  const birthdays = Array.isArray(candidate.birthdays) ? omitLegacySeeds(candidate.birthdays, ['birthday-maya', 'birthday-eli']) : defaults.birthdays
  const concerts = Array.isArray(candidate.concerts) ? omitLegacySeeds(candidate.concerts, ['concert-japanese-house']) : defaults.concerts
  const moment = candidate.moment && typeof candidate.moment === 'object' ? { ...defaults.moment, ...candidate.moment } : defaults.moment
  const focusFlight = candidate.focusFlight && typeof candidate.focusFlight === 'object' ? { ...defaults.focusFlight, ...candidate.focusFlight } : defaults.focusFlight

  if (legacy && moment.label === 'The next good thing') moment.label = ''
  if (legacy && focusFlight.intention === 'Finish one honest, uninterrupted block of study.') focusFlight.intention = ''
  if (legacy && focusFlight.arrivalMessage === 'You made it. Close the book, breathe, and notice what is clearer now.') focusFlight.arrivalMessage = ''
  if (legacy && focusFlight.originCode === 'YVR' && focusFlight.destinationCode === 'HND') focusFlight.destinationCode = 'KHN'

  return {
    ...defaults,
    ...candidate,
    version: 4,
    routines,
    notes,
    trackers,
    birthdays,
    concerts,
    moment,
    solar: candidate.solar && typeof candidate.solar === 'object' ? { ...defaults.solar, ...candidate.solar } : defaults.solar,
    focusFlight,
  }
}
