import { estimateFlightMinutes, findAirport } from './data/airports'

export type ToolView = 'today' | 'birthdays' | 'concerts' | 'sunset' | 'flight' | 'routines' | 'quick-todos' | 'moment' | 'notes' | 'trackers' | 'lastfm' | 'music-picks'
export type AppTheme = 'moss' | 'blue' | 'plum' | 'amber'
export type ListeningPeriod = 'week' | 'month' | 'year'
export type ListeningCategory = 'artists' | 'albums' | 'tracks'

export interface UserProfile {
  displayName: string
  subtitle: string
  photoId?: string
}

export const DEFAULT_PROFILE: UserProfile = {
  displayName: "snoopy's home;",
  subtitle: "'everything i've ever wanted' - tiffany day",
}

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

export interface QuickTodo {
  id: string
  text: string
  done: boolean
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
  sessionId?: string
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

export interface FlightHistoryEntry {
  id: string
  originCode: string
  destinationCode: string
  durationMinutes: number
  distanceKm: number
  intention: string
  arrivalMessage: string
  startedAt: string
  endedAt: string
  outcome: 'landed' | 'ended'
}

export interface LastFmEntry {
  id: string
  name: string
  artist?: string
  playcount: number
  url: string
  image?: string
  date?: string
  nowPlaying?: boolean
}

export interface LastFmSnapshot {
  period: ListeningPeriod
  fetchedAt: string
  user: {
    name: string
    realName?: string
    url: string
    image?: string
    playcount: number
    registeredAt?: string
  }
  recent: LastFmEntry[]
  artists: LastFmEntry[]
  albums: LastFmEntry[]
  tracks: LastFmEntry[]
}

export type LastFmPeriodPicks = Record<ListeningCategory, LastFmEntry[]>

export interface LastFmState {
  username: string
  snapshots: Partial<Record<ListeningPeriod, LastFmSnapshot>>
  picks: Record<ListeningPeriod, LastFmPeriodPicks>
}

function createEmptyPicks(): Record<ListeningPeriod, LastFmPeriodPicks> {
  return {
    week: { artists: [], albums: [], tracks: [] },
    month: { artists: [], albums: [], tracks: [] },
    year: { artists: [], albums: [], tracks: [] },
  }
}

export interface AppData {
  version: 9
  routines: Routine[]
  quickTodos: QuickTodo[]
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
  flightHistory: FlightHistoryEntry[]
  lastFm: LastFmState
  preferences: {
    theme: AppTheme
    profile: UserProfile
  }
  updatedAt: string
}

export function createInitialState(): AppData {
  const now = new Date()
  const future = new Date(now)
  future.setDate(future.getDate() + 24)
  future.setHours(9, 0, 0, 0)

  return {
    version: 9,
    routines: [],
    quickTodos: [],
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
      durationMinutes: estimateFlightMinutes(findAirport('YVR'), findAirport('KHN')),
      intention: '',
      arrivalMessage: '',
      status: 'idle',
    },
    flightHistory: [],
    lastFm: {
      username: '',
      snapshots: {},
      picks: createEmptyPicks(),
    },
    preferences: {
      theme: 'moss',
      profile: { ...DEFAULT_PROFILE },
    },
    updatedAt: now.toISOString(),
  }
}

export function migrateAppData(input: unknown): AppData {
  const defaults = createInitialState()
  if (!input || typeof input !== 'object') return defaults
  const candidate = input as Partial<AppData>
  const candidateVersion = Number((candidate as { version?: number }).version ?? 0)
  const legacy = candidateVersion < 4
  const omitLegacySeeds = <T extends { id: string }>(items: T[], seedIds: string[]) => (
    legacy ? items.filter((item) => !seedIds.includes(item.id)) : items
  )
  const routines = Array.isArray(candidate.routines) ? omitLegacySeeds(candidate.routines, ['morning-reset', 'leaving-home']) : defaults.routines
  const quickTodos = Array.isArray(candidate.quickTodos) ? candidate.quickTodos : defaults.quickTodos
  const notes = Array.isArray(candidate.notes) ? omitLegacySeeds(candidate.notes, ['first-note']) : defaults.notes
  const trackers = Array.isArray(candidate.trackers) ? omitLegacySeeds(candidate.trackers, ['water', 'outside', 'deep-work']) : defaults.trackers
  const birthdays = Array.isArray(candidate.birthdays) ? omitLegacySeeds(candidate.birthdays, ['birthday-maya', 'birthday-eli']) : defaults.birthdays
  const concerts = Array.isArray(candidate.concerts) ? omitLegacySeeds(candidate.concerts, ['concert-japanese-house']) : defaults.concerts
  const moment = candidate.moment && typeof candidate.moment === 'object' ? { ...defaults.moment, ...candidate.moment } : defaults.moment
  const focusFlight = candidate.focusFlight && typeof candidate.focusFlight === 'object' ? { ...defaults.focusFlight, ...candidate.focusFlight } : defaults.focusFlight
  const flightHistory = Array.isArray(candidate.flightHistory) ? candidate.flightHistory : defaults.flightHistory
  const candidateLastFm = candidate.lastFm && typeof candidate.lastFm === 'object' ? candidate.lastFm : undefined
  const lastFm: LastFmState = candidateLastFm
    ? {
        ...defaults.lastFm,
        ...candidateLastFm,
        snapshots: candidateLastFm.snapshots && typeof candidateLastFm.snapshots === 'object'
          ? candidateLastFm.snapshots
          : defaults.lastFm.snapshots,
        picks: {
          week: { ...defaults.lastFm.picks.week, ...candidateLastFm.picks?.week },
          month: { ...defaults.lastFm.picks.month, ...candidateLastFm.picks?.month },
          year: { ...defaults.lastFm.picks.year, ...candidateLastFm.picks?.year },
        },
      }
    : defaults.lastFm
  const candidatePreferences = candidate.preferences && typeof candidate.preferences === 'object'
    ? candidate.preferences
    : undefined
  const preferences = candidatePreferences
    ? {
        ...defaults.preferences,
        ...candidatePreferences,
        profile: candidatePreferences.profile && typeof candidatePreferences.profile === 'object'
          ? { ...DEFAULT_PROFILE, ...candidatePreferences.profile }
          : { ...DEFAULT_PROFILE },
      }
    : defaults.preferences

  if (legacy && moment.label === 'The next good thing') moment.label = ''
  if (legacy && focusFlight.intention === 'Finish one honest, uninterrupted block of study.') focusFlight.intention = ''
  if (legacy && focusFlight.arrivalMessage === 'You made it. Close the book, breathe, and notice what is clearer now.') focusFlight.arrivalMessage = ''
  if (legacy && focusFlight.originCode === 'YVR' && focusFlight.destinationCode === 'HND') focusFlight.destinationCode = 'KHN'
  if (candidateVersion < 5 && focusFlight.status === 'idle') {
    focusFlight.durationMinutes = estimateFlightMinutes(findAirport(focusFlight.originCode), findAirport(focusFlight.destinationCode))
  }

  return {
    ...defaults,
    ...candidate,
    version: 9,
    routines,
    quickTodos,
    notes,
    trackers,
    birthdays,
    concerts,
    moment,
    solar: candidate.solar && typeof candidate.solar === 'object' ? { ...defaults.solar, ...candidate.solar } : defaults.solar,
    focusFlight,
    flightHistory,
    lastFm,
    preferences,
  }
}
