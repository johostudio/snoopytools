import type { Birthday, Concert } from '../domain'

function escapeIcs(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function calendarDate(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
}

function floatingDateTime(value: string) {
  return value.replace(/[-:]/g, '').replace('T', 'T') + '00'
}

function nextBirthdayDate(birthday: Birthday) {
  const [, month, day] = birthday.date.split('-').map(Number)
  const today = new Date()
  const next = new Date(today.getFullYear(), month - 1, day)
  next.setHours(0, 0, 0, 0)
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) next.setFullYear(next.getFullYear() + 1)
  return next
}

function saveFile(file: File) {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export async function addBirthdayToAppleCalendar(birthday: Birthday) {
  const next = nextBirthdayDate(birthday)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    "PRODID:-//Snoopy's Home//Birthday Archive//EN",
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:birthday-${birthday.id}@snoopyshome.local`,
    `DTSTAMP:${stamp()}`,
    `DTSTART;VALUE=DATE:${calendarDate(next)}`,
    `SUMMARY:${escapeIcs(`${birthday.name}'s birthday`)}`,
    `DESCRIPTION:${escapeIcs([birthday.notes, birthday.giftIdeas && `Gift ideas: ${birthday.giftIdeas}`].filter(Boolean).join('\n'))}`,
    'RRULE:FREQ=YEARLY',
    'BEGIN:VALARM',
    `TRIGGER:-P${birthday.reminderDays}D`,
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(`${birthday.name}'s birthday is coming up`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const file = new File(
    [lines.join('\r\n')],
    `${birthday.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'birthday'}-birthday.ics`,
    { type: 'text/calendar' },
  )
  return shareOrDownload(file, `${birthday.name || 'birthday'} calendar reminder`, 'add this yearly birthday reminder to your calendar, or send it by mail.')
}

export async function addConcertToAppleCalendar(concert: Concert) {
  const start = new Date(concert.dateTime)
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1_000)
  const endValue = `${end.getFullYear()}${String(end.getMonth() + 1).padStart(2, '0')}${String(end.getDate()).padStart(2, '0')}T${String(end.getHours()).padStart(2, '0')}${String(end.getMinutes()).padStart(2, '0')}00`
  const description = [
    concert.supportingArtists && `Openers + side artists: ${concert.supportingArtists}`,
    concert.companions && `Went with: ${concert.companions}`,
    concert.notes,
  ].filter(Boolean).join('\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    "PRODID:-//Snoopy's Home//Concert Archive//EN",
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:concert-${concert.id}@snoopyshome.local`,
    `DTSTAMP:${stamp()}`,
    `DTSTART:${floatingDateTime(concert.dateTime)}`,
    `DTEND:${endValue}`,
    `SUMMARY:${escapeIcs(concert.artist)}`,
    `LOCATION:${escapeIcs([concert.venue, concert.city].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(`${concert.artist} is tomorrow`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const file = new File(
    [lines.join('\r\n')],
    `${concert.artist.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'concert'}.ics`,
    { type: 'text/calendar' },
  )
  return shareOrDownload(file, `${concert.artist || 'concert'} calendar event`, 'add this concert to your calendar, or send it by mail.')
}

export async function shareOrDownload(file: File, title: string, text: string) {
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title, text })
    return 'shared' as const
  }
  saveFile(file)
  return 'downloaded' as const
}
