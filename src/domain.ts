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
  version: 3
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
    version: 3,
    routines: [
      {
        id: 'morning-reset',
        name: 'Morning reset',
        items: [
          { id: 'water', text: 'Drink a full glass of water', done: true },
          { id: 'outside', text: 'Step outside for five minutes', done: true },
          { id: 'priority', text: 'Write the one priority', done: false },
          { id: 'phone', text: 'Keep phone away until breakfast', done: false },
        ],
      },
      {
        id: 'leaving-home',
        name: 'Leaving home',
        items: [
          { id: 'keys', text: 'Keys', done: false },
          { id: 'wallet', text: 'Wallet', done: false },
          { id: 'headphones', text: 'Headphones', done: false },
          { id: 'water-bottle', text: 'Water bottle', done: false },
        ],
      },
    ],
    moment: {
      label: 'The next good thing',
      targetAt: future.toISOString(),
    },
    notes: [
      {
        id: 'first-note',
        title: 'A place to remember',
        body: 'Keep this light. Lists for what repeats, one moment that matters, and notes without a filing system.',
        updatedAt: now.toISOString(),
      },
    ],
    trackers: [
      { id: 'water', label: 'Water before coffee', value: 1, target: 2, unit: 'glasses', step: 1 },
      { id: 'outside', label: 'Time outside', value: 12, target: 30, unit: 'min', step: 5 },
      { id: 'deep-work', label: 'Undistracted work', value: 0.75, target: 2, unit: 'hr', step: 0.25 },
    ],
    birthdays: [
      {
        id: 'birthday-maya',
        name: 'Maya',
        date: '1999-11-24',
        reminderDays: 7,
        notes: 'Loves handwritten things, little bakeries, and anything blue.',
        giftIdeas: 'A photo book · silver charm · dinner somewhere quiet',
      },
      {
        id: 'birthday-eli',
        name: 'Eli',
        date: '2000-12-08',
        reminderDays: 14,
        notes: 'Always calls on the day. Prefers plans over objects.',
        giftIdeas: 'Concert tickets · make a playlist',
      },
    ],
    concerts: [
      {
        id: 'concert-japanese-house',
        artist: 'The Japanese House',
        dateTime: '2026-11-14T20:00',
        venue: 'The Orpheum',
        city: 'Vancouver, BC',
        companions: 'Maya, Noah',
        supportingArtists: 'Skullcrusher',
        notes: 'Balcony left. The encore felt endless in the best way.',
        photoIds: [],
      },
    ],
    solar: {
      latitude: 49.2827,
      longitude: -123.1207,
      locationName: 'Vancouver, BC',
    },
    focusFlight: {
      originCode: 'YVR',
      destinationCode: 'HND',
      durationMinutes: 50,
      intention: 'Finish one honest, uninterrupted block of study.',
      arrivalMessage: 'You made it. Close the book, breathe, and notice what is clearer now.',
      status: 'idle',
    },
    updatedAt: now.toISOString(),
  }
}

export function migrateAppData(input: unknown): AppData {
  const defaults = createInitialState()
  if (!input || typeof input !== 'object') return defaults
  const candidate = input as Partial<AppData>

  return {
    ...defaults,
    ...candidate,
    version: 3,
    routines: Array.isArray(candidate.routines) ? candidate.routines : defaults.routines,
    notes: Array.isArray(candidate.notes) ? candidate.notes : defaults.notes,
    trackers: Array.isArray(candidate.trackers) ? candidate.trackers : defaults.trackers,
    birthdays: Array.isArray(candidate.birthdays) ? candidate.birthdays : defaults.birthdays,
    concerts: Array.isArray(candidate.concerts) ? candidate.concerts : defaults.concerts,
    moment: candidate.moment && typeof candidate.moment === 'object' ? { ...defaults.moment, ...candidate.moment } : defaults.moment,
    solar: candidate.solar && typeof candidate.solar === 'object' ? { ...defaults.solar, ...candidate.solar } : defaults.solar,
    focusFlight: candidate.focusFlight && typeof candidate.focusFlight === 'object' ? { ...defaults.focusFlight, ...candidate.focusFlight } : defaults.focusFlight,
  }
}
