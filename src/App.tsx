import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type Dispatch,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SetStateAction,
  type TextareaHTMLAttributes,
} from 'react'
import * as SunCalc from 'suncalc'
import './App.css'
import { AIRPORTS, estimateFlightMinutes, findAirport, routeDistanceKm } from './data/airports'
import {
  createInitialState,
  migrateAppData,
  type AppTheme,
  type AppData,
  type Birthday,
  type Concert,
  type FlightHistoryEntry,
  type ToolView,
} from './domain'
import { usePersistentState } from './hooks/usePersistentState'
import { useCloudSync } from './hooks/useCloudSync'
import { addBirthdayToAppleCalendar, addConcertToAppleCalendar, shareOrDownload } from './lib/apple'
import { renderBirthdayCard, type CardStyle } from './lib/birthdayCard'
import { deletePhoto, getPhoto, savePhoto } from './lib/photoStore'

const FlightMap = lazy(() => import('./components/FlightMap').then((module) => ({ default: module.FlightMap })))
const LastFmBrowserView = lazy(() => import('./components/LastFmViews').then((module) => ({ default: module.LastFmBrowserView })))
const LastFmPicksView = lazy(() => import('./components/LastFmViews').then((module) => ({ default: module.LastFmPicksView })))

type DataSetter = Dispatch<SetStateAction<AppData>>

type BufferedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'> & {
  value: string | number
  onCommit: (value: string) => void
  commitDelay?: number
}

type BufferedTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'defaultValue' | 'onChange'> & {
  value: string
  onCommit: (value: string) => void
  commitDelay?: number
}

function useBufferedCommit<T extends HTMLInputElement | HTMLTextAreaElement>(
  value: string | number,
  onCommit: (value: string) => void,
  commitDelay: number,
) {
  const fieldRef = useRef<T>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const dirtyRef = useRef(false)
  const committedValueRef = useRef(String(value))
  const onCommitRef = useRef(onCommit)

  useEffect(() => {
    onCommitRef.current = onCommit
  }, [onCommit])

  const flush = useCallback(() => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)
    timerRef.current = undefined
    if (!dirtyRef.current || !fieldRef.current) return
    dirtyRef.current = false
    const next = fieldRef.current.value
    if (next === committedValueRef.current) return
    committedValueRef.current = next
    onCommitRef.current(next)
  }, [])

  useEffect(() => {
    const next = String(value)
    committedValueRef.current = next
    const field = fieldRef.current
    if (field && !dirtyRef.current && document.activeElement !== field && field.value !== next) field.value = next
  }, [value])

  useEffect(() => () => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)
    flush()
  }, [flush])

  const handleChange = () => {
    dirtyRef.current = true
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(flush, commitDelay)
  }

  const handleBlur = () => {
    flush()
    const field = fieldRef.current
    if (field && field.value !== committedValueRef.current) field.value = committedValueRef.current
  }

  return { fieldRef, handleChange, handleBlur }
}

const BufferedInput = memo(function BufferedInput({ value, onCommit, commitDelay = 800, onBlur, ...props }: BufferedInputProps) {
  const { fieldRef, handleChange, handleBlur } = useBufferedCommit<HTMLInputElement>(value, onCommit, commitDelay)
  return <input {...props} ref={fieldRef} defaultValue={String(value)} onChange={handleChange} onBlur={(event) => { handleBlur(); onBlur?.(event) }} />
})

const BufferedTextarea = memo(function BufferedTextarea({ value, onCommit, commitDelay = 800, onBlur, ...props }: BufferedTextareaProps) {
  const { fieldRef, handleChange, handleBlur } = useBufferedCommit<HTMLTextAreaElement>(value, onCommit, commitDelay)
  return <textarea {...props} ref={fieldRef} defaultValue={value} onChange={handleChange} onBlur={(event) => { handleBlur(); onBlur?.(event) }} />
})

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

interface DesktopInstallState {
  isDesktop: boolean
  canInstall: boolean
  installed: boolean
  install: () => Promise<void>
}

function standaloneDisplay() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || Boolean(iosNavigator.standalone)
}

function useDesktopInstall(): DesktopInstallState {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(standaloneDisplay)
  const isDesktop = !/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent)

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    const markInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', capturePrompt)
    window.addEventListener('appinstalled', markInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt)
      window.removeEventListener('appinstalled', markInstalled)
    }
  }, [])

  const install = async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setPromptEvent(null)
  }

  return { isDesktop, canInstall: Boolean(promptEvent), installed, install }
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}

function useLiveNow(refreshMs = 1_000, enabled = true) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    if (!enabled) return
    let timer: number | undefined
    const updateTimer = () => {
      if (timer !== undefined) window.clearInterval(timer)
      timer = undefined
      if (document.visibilityState === 'hidden') return
      setNow(new Date())
      timer = window.setInterval(() => setNow(new Date()), refreshMs)
    }
    updateTimer()
    document.addEventListener('visibilitychange', updateTimer)
    return () => {
      if (timer !== undefined) window.clearInterval(timer)
      document.removeEventListener('visibilitychange', updateTimer)
    }
  }, [enabled, refreshMs])

  return now
}

const NAV_ITEMS: { id: ToolView; label: string; number: string }[] = [
  { id: 'today', label: 'index', number: '00' },
  { id: 'birthdays', label: 'birthdays', number: '01' },
  { id: 'concerts', label: 'concerts', number: '02' },
  { id: 'sunset', label: 'sunset', number: '03' },
  { id: 'flight', label: 'flight', number: '04' },
  { id: 'routines', label: 'repeat', number: '05' },
  { id: 'quick-todos', label: 'to do', number: '06' },
  { id: 'moment', label: 'time', number: '07' },
  { id: 'notes', label: 'notes', number: '08' },
  { id: 'trackers', label: 'trackers', number: '09' },
  { id: 'lastfm', label: 'last.fm', number: '10' },
  { id: 'music-picks', label: 'bests', number: '11' },
]

const THEMES: { id: AppTheme; label: string }[] = [
  { id: 'moss', label: 'moss' },
  { id: 'blue', label: 'blue' },
  { id: 'plum', label: 'plum' },
  { id: 'amber', label: 'amber' },
]

const pad = (value: number) => String(value).padStart(2, '0')

function formatClock(date: Date | null | undefined) {
  if (!date || Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}

function formatTimer(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds))
  const hours = Math.floor(safeSeconds / 3_600)
  const minutes = Math.floor((safeSeconds % 3_600) / 60)
  const seconds = safeSeconds % 60
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

function formatFlightDuration(totalMinutes: number) {
  if (totalMinutes <= 0) return '—'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  return `${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
}

function createFlightHistoryEntry(
  flight: AppData['focusFlight'],
  outcome: FlightHistoryEntry['outcome'],
  endedAt: string,
) {
  if (!flight.startedAt) return null
  const origin = findAirport(flight.originCode)
  const destination = findAirport(flight.destinationCode)
  return {
    id: flight.sessionId ?? `legacy-${flight.startedAt}`,
    originCode: origin.code,
    destinationCode: destination.code,
    durationMinutes: flight.durationMinutes,
    distanceKm: Math.round(routeDistanceKm(origin, destination)),
    intention: flight.intention,
    arrivalMessage: flight.arrivalMessage,
    startedAt: flight.startedAt,
    endedAt,
    outcome,
  } satisfies FlightHistoryEntry
}

const AIRPORT_CLOCKS = [
  { code: 'YVR', city: 'Vancouver', timeZone: 'America/Vancouver' },
  { code: 'KHN', city: 'Nanchang', timeZone: 'Asia/Shanghai' },
  { code: 'YYZ', city: 'Toronto', timeZone: 'America/Toronto' },
  { code: 'SIN', city: 'Singapore', timeZone: 'Asia/Singapore' },
  { code: 'HEL', city: 'Helsinki', timeZone: 'Europe/Helsinki' },
  { code: 'LHR', city: 'London', timeZone: 'Europe/London' },
  { code: 'YEG', city: 'Edmonton', timeZone: 'America/Edmonton' },
  { code: 'MYY', city: 'Miri', timeZone: 'Asia/Kuching' },
  { code: 'ICN', city: 'Seoul', timeZone: 'Asia/Seoul' },
].map((clock) => ({
  ...clock,
  formatter: new Intl.DateTimeFormat('en-GB', {
    timeZone: clock.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }),
}))

const AirportClocks = memo(function AirportClocks() {
  const railHidden = useMediaQuery('(max-width: 899px)')
  const now = useLiveNow(1_000, !railHidden)
  if (railHidden) return null
  return (
    <div className="rail-clocks" aria-label="Airport clocks">
      {AIRPORT_CLOCKS.map((clock) => (
        <div className="rail-clock" key={clock.code}>
          <span className="airport-code">{clock.code}</span>
          <time dateTime={now.toISOString()}>
            {clock.formatter.format(now)}
          </time>
          <small>{clock.city}</small>
        </div>
      ))}
    </div>
  )
})

function formatBirthday(date: string) {
  const [, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(2024, month - 1, day))
}

function birthdayDistance(date: string) {
  const [, month, day] = date.split('-').map(Number)
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const next = new Date(today.getFullYear(), month - 1, day)
  if (next < start) next.setFullYear(next.getFullYear() + 1)
  return Math.round((next.getTime() - start.getTime()) / 86_400_000)
}

function differenceParts(target: string, now: Date) {
  const delta = new Date(target).getTime() - now.getTime()
  const totalSeconds = Math.max(0, Math.floor(Math.abs(delta) / 1000))
  return {
    delta,
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  }
}

function dateTimeInputValue(iso: string) {
  const date = new Date(iso)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function usePhotoUrl(photoId?: string) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!photoId) return
    let active = true
    let objectUrl: string | undefined
    getPhoto(photoId).then((photo) => {
      if (!active || !photo) return
      objectUrl = URL.createObjectURL(photo.blob)
      setUrl(objectUrl)
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photoId])
  return photoId ? url : undefined
}

function StoredImage({ photoId, alt, className = '' }: { photoId?: string; alt: string; className?: string }) {
  const url = usePhotoUrl(photoId)
  if (!url) return <div className={`photo-placeholder ${className}`} aria-label={`${alt} placeholder`}><span>写真</span></div>
  return <img className={className} src={url} alt={alt} />
}

function ProfileAvatar({ photoId, className = '' }: { photoId?: string; className?: string }) {
  const url = usePhotoUrl(photoId)
  return <img className={className} src={url ?? '/favicon.ico'} alt="" aria-hidden="true" />
}

function PhotoPicker({
  photoIds,
  multiple = false,
  onChange,
}: {
  photoIds: string[]
  multiple?: boolean
  onChange: (photoIds: string[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const addPhotos = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    setBusy(true)
    try {
      const ids = await Promise.all(files.map(savePhoto))
      onChange(multiple ? [...photoIds, ...ids] : ids.slice(0, 1))
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  const remove = async (id: string) => {
    await deletePhoto(id)
    onChange(photoIds.filter((photoId) => photoId !== id))
  }

  return (
    <div className="photo-picker">
      <div className="photo-strip">
        {photoIds.map((id, index) => (
          <figure className="photo-print" key={id}>
            <StoredImage photoId={id} alt={`Attachment ${index + 1}`} />
            <button type="button" onClick={() => remove(id)} aria-label={`Remove attachment ${index + 1}`}>×</button>
          </figure>
        ))}
        {(multiple || photoIds.length === 0) && (
          <button type="button" className="add-photo" onClick={() => inputRef.current?.click()}>
            <span>{busy ? '…' : '+'}</span>
            {busy ? 'ADDING' : 'ADD PHOTO'}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple={multiple} onChange={addPhotos} hidden />
    </div>
  )
}

function PageHeader({ index, japanese, title, children }: { index: string; japanese: string; title: string; children?: ReactNode }) {
  return (
    <header className="page-header reveal">
      <div>
        <span className="folio">PAGE {index}</span>
        <span className="jp-label">{japanese}</span>
      </div>
      <h1>{title}</h1>
      {children && <div className="page-header-actions">{children}</div>}
    </header>
  )
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`editor-field ${wide ? 'editor-field--wide' : ''}`}><span>{label}</span>{children}</label>
}

function PrimaryAction({ children, onClick, disabled = false }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="primary-action" onClick={onClick} disabled={disabled}>
      <span>{children}</span><i aria-hidden="true">›</i>
    </button>
  )
}

function OptionalCalendarAction({
  enabled,
  onEnabledChange,
  status,
  children,
}: {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  status?: string
  children: ReactNode
}) {
  return (
    <div className={`calendar-option ${enabled ? 'is-open' : ''}`}>
      <label className="calendar-option__toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} />
        <span><strong>also share to apple calendar</strong><small>optional · open the ios share sheet for calendar or mail</small></span>
      </label>
      {enabled && <div className="calendar-option__body">{children}</div>}
      {status && <output className="action-status">{status}</output>}
    </div>
  )
}

function SyncPanel({ sync, data, setData, desktopInstall, onClose }: { sync: ReturnType<typeof useCloudSync>; data: AppData; setData: DataSetter; desktopInstall: DesktopInstallState; onClose: () => void }) {
  const [email, setEmail] = useState(() => window.localStorage.getItem('snoopytools:last-email') ?? '')
  const [password, setPassword] = useState('')
  const [flow, setFlow] = useState<'signIn' | 'signUp'>('signIn')
  const [busy, setBusy] = useState(false)
  const selectFlow = (nextFlow: 'signIn' | 'signUp') => {
    setFlow(nextFlow)
    sync.prepareAuth(nextFlow)
  }
  const submitAccount = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim() || password.length < 8) return
    setBusy(true)
    try {
      await sync.signInWithPassword(email, password, flow)
      window.localStorage.setItem('snoopytools:last-email', email.trim().toLowerCase())
    } catch {
      // The sync message displays the private authentication error.
    } finally {
      setBusy(false)
    }
  }
  const updateProfile = (patch: Partial<AppData['preferences']['profile']>) => setData((current) => ({
    ...current,
    preferences: {
      ...current.preferences,
      profile: { ...current.preferences.profile, ...patch },
    },
    updatedAt: new Date().toISOString(),
  }))
  const updateTheme = (theme: AppTheme) => setData((current) => ({
    ...current,
    preferences: { ...current.preferences, theme },
    updatedAt: new Date().toISOString(),
  }))
  const profile = data.preferences.profile

  return (
    <aside className="sync-panel paper-texture" aria-label="sync settings">
      <button type="button" className="sync-panel__close" onClick={onClose} aria-label="close profile and sync settings">×</button>
      <span className="folio">profile + personal cloud / 同期</span>

      <section className="profile-editor" aria-labelledby="profile-editor-title">
        <div className="profile-editor__identity">
          <ProfileAvatar photoId={profile.photoId} />
          <div><span id="profile-editor-title">your profile</span><strong>{profile.displayName || "snoopy's home"}</strong></div>
        </div>
        <label><span>display name</span><BufferedInput value={profile.displayName} onCommit={(value) => updateProfile({ displayName: value })} placeholder="snoopy's home" /></label>
        <label><span>subtitle</span><BufferedInput value={profile.subtitle} onCommit={(value) => updateProfile({ subtitle: value })} placeholder="a small line about this place" /></label>
        <PhotoPicker photoIds={profile.photoId ? [profile.photoId] : []} onChange={(ids) => updateProfile({ photoId: ids[0] })} />
        <div className="profile-themes" aria-label="colour theme">
          <span>colour</span>
          <div>{THEMES.map((theme) => <button type="button" key={theme.id} className={data.preferences.theme === theme.id ? 'is-active' : ''} onClick={() => updateTheme(theme.id)} aria-label={`${theme.label} theme`}><i /></button>)}</div>
        </div>
      </section>

      {desktopInstall.isDesktop && (
        <section className={`desktop-install ${desktopInstall.installed ? 'is-installed' : ''}`} aria-label="pc app installation">
          <span>pc app / windows</span>
          <strong>{desktopInstall.installed ? 'installed on this pc' : 'snoopy’s home, in its own window.'}</strong>
          <p>{desktopInstall.installed ? 'this app uses the same offline archive and cloud sync.' : 'install the same archive as a desktop app. it keeps working offline and syncs with your phone.'}</p>
          {desktopInstall.canInstall && <button type="button" onClick={() => void desktopInstall.install()}>install pc app ↘</button>}
          {!desktopInstall.installed && !desktopInstall.canInstall && <small>open this page in edge or chrome, then choose install app from the address bar.</small>}
        </section>
      )}

      <div className={`sync-state sync-state--${sync.status}`}><i /><strong>{sync.authenticated ? 'saved on this device' : sync.status}</strong><span>{sync.authenticated ? 'this session stays saved on this device' : 'sign in once; this device will remember you'}</span></div>
      {(sync.status === 'error' || sync.status === 'offline') && <p className="sync-state-message">{sync.message}</p>}

      {!sync.configured && (
        <div className="sync-setup-note">
          <b>cloud connection needed</b>
          <span>deploy the cloudflare sync worker, then add its public url to the app environment.</span>
        </div>
      )}

      {sync.configured && !sync.authenticated && (
        <>
          <div className="sync-auth-mode" role="group" aria-label="account action">
            <button type="button" className={flow === 'signIn' ? 'is-active' : ''} aria-pressed={flow === 'signIn'} onClick={() => selectFlow('signIn')}>sign in</button>
            <button type="button" className={flow === 'signUp' ? 'is-active' : ''} aria-pressed={flow === 'signUp'} onClick={() => selectFlow('signUp')}>create account</button>
          </div>
          <form className="sync-email" onSubmit={submitAccount}>
            <label htmlFor="sync-email">private account</label>
            <div className="sync-email__field">
              <input id="sync-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email" required />
            </div>
            <div className="sync-email__field">
              <input name="password" type="password" autoComplete={flow === 'signUp' ? 'new-password' : 'current-password'} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="password · 8+ characters" required />
            </div>
            <button className="sync-email__submit" disabled={busy}>{busy ? 'working…' : flow === 'signIn' ? 'sign in' : 'create account'}</button>
          </form>
          <p className="sync-apple-note">your password is never stored here. cloudflare keeps a private renewable session on this device after the first sign-in.</p>
        </>
      )}

      {sync.authenticated && (
        <div className="sync-account">
          <span>signed in as</span>
          <strong>{sync.email ?? 'private account'}</strong>
        </div>
      )}

      <small>your offline copy stays in local storage and indexeddb. while signed in, the same archive is mirrored to private cloudflare storage.</small>
    </aside>
  )
}

function TodayView({ data, onNavigate }: { data: AppData; onNavigate: (view: ToolView) => void }) {
  const nextBirthday = [...data.birthdays].sort((a, b) => birthdayDistance(a.date) - birthdayDistance(b.date))[0]
  const nextConcert = [...data.concerts].sort((a, b) => a.dateTime.localeCompare(b.dateTime))[0]

  return (
    <div className="index-layout view-enter">
      <section className="index-photo reveal">
        <img src="/headphones-field.jpg" alt="Person listening through headphones in a green field" />
        <div className="definition-block">
          <span>snoopy's home</span>
          <p className="definition-chinese" lang="zh-Hans">史努比之家；保存在本机的个人工具。</p>
        </div>
      </section>

      <section className="manifesto-paper paper-texture reveal">
        <div className="manifesto-copy index-stats">
          <button type="button" className="index-stat" onClick={() => onNavigate('birthdays')}>
            <div><mark>{pad(data.birthdays.length)}</mark><b>birthdays</b></div>
            <small lang="zh-Hans">生日；日期、提醒、备注与贺卡。</small>
          </button>
          <button type="button" className="index-stat" onClick={() => onNavigate('concerts')}>
            <div><mark>{pad(data.concerts.length)}</mark><b>concerts</b></div>
            <small lang="zh-Hans">演唱会；场地、阵容、同行者与照片。</small>
          </button>
          <button type="button" className="index-stat" onClick={() => onNavigate('notes')}>
            <div><mark>{pad(data.notes.length)}</mark><b>notes</b></div>
            <small lang="zh-Hans">笔记；保存在本机的文字。</small>
          </button>
          <button type="button" className="index-stat" onClick={() => onNavigate('routines')}>
            <div><mark>{pad(data.routines.length)}</mark><b>lists</b></div>
            <small lang="zh-Hans">清单；可完成并重置的步骤。</small>
          </button>
        </div>
        <span className="archive-number">001</span>
      </section>

      <section className="index-cards reveal">
        <button className="archive-teaser birthday-teaser" onClick={() => onNavigate('birthdays')}>
          <span>UP NEXT / 誕生日</span>
          <strong>{nextBirthday?.name || 'no birthdays'}</strong>
          <p>{nextBirthday ? `${formatBirthday(nextBirthday.date)} · ${birthdayDistance(nextBirthday.date)} days` : '0 saved'}</p>
          <i>01</i>
        </button>
        <button className="archive-teaser concert-teaser" onClick={() => onNavigate('concerts')}>
          <span>CONCERT ARCHIVE / 音楽</span>
          <strong>{nextConcert?.artist || 'no concerts'}</strong>
          <p>{nextConcert ? `${nextConcert.venue || 'no venue'} · ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(nextConcert.dateTime))}` : '0 saved'}</p>
          <i>02</i>
        </button>
        <button className="archive-teaser solar-teaser" onClick={() => onNavigate('sunset')}>
          <span>GOLDEN HOUR / 日没</span>
          <strong>golden hour</strong>
          <p>{data.solar.locationName}</p>
          <i>03</i>
        </button>
        <button className="archive-teaser flight-teaser" onClick={() => onNavigate('flight')}>
          <span>FOCUS FLIGHT / 集中</span>
          <strong>{data.focusFlight.originCode} → {data.focusFlight.destinationCode}</strong>
          <p>{formatFlightDuration(data.focusFlight.durationMinutes)} estimated</p>
          <i>04</i>
        </button>
      </section>
    </div>
  )
}

function BirthdayCardStudio({ birthday, onClose }: { birthday: Birthday; onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [style, setStyle] = useState<CardStyle>('sage')
  const [status, setStatus] = useState('')
  const photoUrl = usePhotoUrl(birthday.photoId)

  const shareCard = async () => {
    setStatus('PREPARING…')
    try {
      const file = await renderBirthdayCard(birthday, message, style)
      const result = await shareOrDownload(file, `A birthday card for ${birthday.name}`, message)
      setStatus(result === 'shared' ? 'SHARE SHEET OPENED' : 'CARD DOWNLOADED')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus('SHARE CANCELLED')
      } else {
        setStatus('COULD NOT MAKE CARD')
      }
    }
  }

  return (
    <div className="card-studio view-enter">
      <header className="studio-header">
        <div><span>CARD STUDIO</span><small>カードを作る</small></div>
        <button onClick={onClose}>CLOSE ×</button>
      </header>
      <div className="studio-grid">
        <div className={`card-preview card-preview--${style}`}>
          {photoUrl && <img src={photoUrl} alt={`${birthday.name} birthday card`} />}
          <span>BIRTHDAY ARCHIVE / 誕生日</span>
          <div>
            <h2>{birthday.name}</h2>
            <mark>{message}</mark>
          </div>
          <small>SNOOPY'S HOME · CARD 001</small>
          <b>愛を込めて</b>
        </div>
        <div className="card-controls paper-texture">
          <span className="folio">PERSONAL EDITION 001</span>
          <h2>birthday<br />card.</h2>
          <Field label="MESSAGE" wide>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={6} />
          </Field>
          <div className="style-options" aria-label="Card paper colour">
            {(['sage', 'powder', 'paper'] as CardStyle[]).map((option) => (
              <button key={option} className={style === option ? 'is-active' : ''} onClick={() => setStyle(option)}>
                <i className={`swatch swatch--${option}`} />{option}
              </button>
            ))}
          </div>
          <PrimaryAction onClick={shareCard}>SHARE WITH APPLE</PrimaryAction>
          <p className="support-note">On iPhone this opens the native Share Sheet for Messages, Mail, AirDrop, and Photos.</p>
          {status && <output className="action-status">{status}</output>}
        </div>
      </div>
    </div>
  )
}

function BirthdaysView({ data, setData }: { data: AppData; setData: DataSetter }) {
  const [selectedId, setSelectedId] = useState(data.birthdays[0]?.id ?? '')
  const [cardMode, setCardMode] = useState(false)
  const [calendarEnabled, setCalendarEnabled] = useState(false)
  const [calendarStatus, setCalendarStatus] = useState('')
  const selected = data.birthdays.find((birthday) => birthday.id === selectedId) ?? data.birthdays[0]

  const update = (patch: Partial<Birthday>) => {
    if (!selected) return
    setData((current) => ({
      ...current,
      birthdays: current.birthdays.map((birthday) => birthday.id === selected.id ? { ...birthday, ...patch } : birthday),
      updatedAt: new Date().toISOString(),
    }))
  }

  const addBirthday = () => {
    const birthday: Birthday = {
      id: crypto.randomUUID(),
      name: '',
      date: new Date().toISOString().slice(0, 10),
      reminderDays: 7,
      notes: '',
      giftIdeas: '',
    }
    setData((current) => ({ ...current, birthdays: [...current.birthdays, birthday], updatedAt: new Date().toISOString() }))
    setSelectedId(birthday.id)
    setCardMode(false)
    setCalendarEnabled(false)
    setCalendarStatus('')
  }

  const shareCalendar = async () => {
    if (!selected) return
    setCalendarStatus('preparing…')
    try {
      const result = await addBirthdayToAppleCalendar(selected)
      setCalendarStatus(result === 'shared' ? 'share sheet opened' : 'calendar file downloaded')
    } catch (error) {
      setCalendarStatus(error instanceof DOMException && error.name === 'AbortError' ? 'share cancelled' : 'calendar file could not be made')
    }
  }

  if (selected && cardMode) return <BirthdayCardStudio birthday={selected} onClose={() => setCardMode(false)} />

  return (
    <div className="archive-view view-enter">
      <PageHeader index="771" japanese="大切な日を忘れない" title="Birthday archive">
        <button className="outline-action" onClick={addBirthday}>+ ADD PERSON</button>
      </PageHeader>

      <div className="archive-editor-layout">
        <aside className="archive-list birthday-list paper-texture reveal">
          <span className="list-caption">UPCOMING / {data.birthdays.length} PEOPLE</span>
          {data.birthdays
            .slice()
            .sort((a, b) => birthdayDistance(a.date) - birthdayDistance(b.date))
            .map((birthday, index) => (
              <button key={birthday.id} className={birthday.id === selected?.id ? 'is-active' : ''} onClick={() => { setSelectedId(birthday.id); setCardMode(false); setCalendarEnabled(false); setCalendarStatus('') }}>
                <span>{pad(index + 1)}</span>
                <div><strong>{birthday.name || 'untitled'}</strong><small>{formatBirthday(birthday.date)}</small></div>
                <em>{birthdayDistance(birthday.date)}d</em>
              </button>
            ))}
          <p className="margin-note">yearly calendar reminder</p>
        </aside>

        {selected && (
          <section className="editor-paper paper-texture reveal">
            <div className="editor-photo-column">
              <div className="portrait-frame">
                <StoredImage photoId={selected.photoId} alt={selected.name} />
                <span>PORTRAIT / 写真</span>
              </div>
              <PhotoPicker photoIds={selected.photoId ? [selected.photoId] : []} onChange={(ids) => update({ photoId: ids[0] })} />
              <div className="date-stamp"><b>{formatBirthday(selected.date)}</b><small>{birthdayDistance(selected.date)} DAYS AWAY</small></div>
            </div>

            <div className="editor-fields">
              <span className="folio">PERSONAL FILE / {selected.id.slice(-4).toUpperCase()}</span>
              <div className="field-grid">
                <Field label="NAME"><BufferedInput value={selected.name} onCommit={(value) => update({ name: value })} placeholder="name" /></Field>
                <Field label="BIRTHDAY"><input type="date" value={selected.date} onChange={(event) => update({ date: event.target.value })} /></Field>
                <Field label="IMPORTANT NOTES" wide><BufferedTextarea rows={5} value={selected.notes} onCommit={(value) => update({ notes: value })} /></Field>
                <Field label="GIFT + PLAN IDEAS" wide><BufferedTextarea rows={3} value={selected.giftIdeas} onCommit={(value) => update({ giftIdeas: value })} /></Field>
              </div>
              <div className="editor-actions">
                <OptionalCalendarAction enabled={calendarEnabled} onEnabledChange={(enabled) => { setCalendarEnabled(enabled); setCalendarStatus('') }} status={calendarStatus}>
                  <Field label="remind me">
                    <select value={selected.reminderDays} onChange={(event) => update({ reminderDays: Number(event.target.value) })}>
                      <option value={0}>on the day</option>
                      <option value={1}>1 day before</option>
                      <option value={3}>3 days before</option>
                      <option value={7}>1 week before</option>
                      <option value={14}>2 weeks before</option>
                      <option value={30}>1 month before</option>
                    </select>
                  </Field>
                  <PrimaryAction onClick={() => void shareCalendar()}>share calendar file / mail</PrimaryAction>
                </OptionalCalendarAction>
                <button className="paper-action" onClick={() => setCardMode(true)}>MAKE A BIRTHDAY CARD ↗</button>
              </div>
              <p className="support-note">the person is saved to your tracker automatically. calendar sharing is optional.</p>
            </div>
          </section>
        )}
        {!selected && <section className="empty-tool paper-texture"><span>0 birthdays</span><button onClick={addBirthday}>+ add person</button></section>}
      </div>
    </div>
  )
}

function ConcertsView({ data, setData }: { data: AppData; setData: DataSetter }) {
  const [selectedId, setSelectedId] = useState(data.concerts[0]?.id ?? '')
  const [calendarEnabled, setCalendarEnabled] = useState(false)
  const [calendarStatus, setCalendarStatus] = useState('')
  const selected = data.concerts.find((concert) => concert.id === selectedId) ?? data.concerts[0]

  const update = (patch: Partial<Concert>) => {
    if (!selected) return
    setData((current) => ({
      ...current,
      concerts: current.concerts.map((concert) => concert.id === selected.id ? { ...concert, ...patch } : concert),
      updatedAt: new Date().toISOString(),
    }))
  }

  const addConcert = () => {
    const now = new Date()
    now.setHours(20, 0, 0, 0)
    const concert: Concert = {
      id: crypto.randomUUID(),
      artist: '',
      dateTime: dateTimeInputValue(now.toISOString()),
      venue: '', city: '', companions: '', supportingArtists: '', notes: '', photoIds: [],
    }
    setData((current) => ({ ...current, concerts: [...current.concerts, concert], updatedAt: new Date().toISOString() }))
    setSelectedId(concert.id)
    setCalendarEnabled(false)
    setCalendarStatus('')
  }

  const shareCalendar = async () => {
    if (!selected) return
    setCalendarStatus('preparing…')
    try {
      const result = await addConcertToAppleCalendar(selected)
      setCalendarStatus(result === 'shared' ? 'share sheet opened' : 'calendar file downloaded')
    } catch (error) {
      setCalendarStatus(error instanceof DOMException && error.name === 'AbortError' ? 'share cancelled' : 'calendar file could not be made')
    }
  }

  return (
    <div className="archive-view concert-view view-enter">
      <PageHeader index="778" japanese="音楽と思い出の記録" title="Concert archive">
        <button className="outline-action" onClick={addConcert}>+ ADD CONCERT</button>
      </PageHeader>

      <div className="concert-layout">
        <aside className="concert-index reveal">
          <span>SHOW INDEX / 記録</span>
          {data.concerts.map((concert, index) => (
            <button key={concert.id} className={concert.id === selected?.id ? 'is-active' : ''} onClick={() => { setSelectedId(concert.id); setCalendarEnabled(false); setCalendarStatus('') }}>
              <em>{pad(index + 1)}</em>
              <div><strong>{concert.artist || 'untitled'}</strong><small>{concert.venue || 'no venue'}</small></div>
              <time>{new Intl.DateTimeFormat('en-US', { month: '2-digit', year: '2-digit' }).format(new Date(concert.dateTime))}</time>
            </button>
          ))}
        </aside>

        {selected && (
          <section className="concert-spread paper-texture reveal">
            <div className="concert-collage">
              {selected.photoIds.length ? (
                selected.photoIds.slice(0, 4).map((photoId, index) => <StoredImage key={photoId} photoId={photoId} alt={`${selected.artist} memory ${index + 1}`} className={`collage-photo collage-photo--${index + 1}`} />)
              ) : (
                <div className="empty-collage"><span>CONCERT<br />PHOTO</span><small>写真を追加</small></div>
              )}
              <span className="tape tape--one" /><span className="tape tape--two" />
              <b className="concert-page">page 778</b>
            </div>

            <div className="concert-editor">
              <span className="folio">LIVE ARCHIVE / {selected.id.slice(-4).toUpperCase()}</span>
              <h2>{selected.artist || 'untitled'}</h2>
              <div className="field-grid">
                <Field label="HEADLINER"><BufferedInput value={selected.artist} onCommit={(value) => update({ artist: value })} placeholder="artist" /></Field>
                <Field label="DATE + TIME"><input type="datetime-local" value={selected.dateTime} onChange={(event) => update({ dateTime: event.target.value })} /></Field>
                <Field label="VENUE"><BufferedInput value={selected.venue} onCommit={(value) => update({ venue: value })} /></Field>
                <Field label="CITY"><BufferedInput value={selected.city} onCommit={(value) => update({ city: value })} /></Field>
                <Field label="WHO I WENT WITH" wide><BufferedInput value={selected.companions} onCommit={(value) => update({ companions: value })} /></Field>
                <Field label="OPENERS + SIDE ARTISTS" wide><BufferedInput value={selected.supportingArtists} onCommit={(value) => update({ supportingArtists: value })} /></Field>
                <Field label="WHAT I WANT TO REMEMBER" wide><BufferedTextarea rows={4} value={selected.notes} onCommit={(value) => update({ notes: value })} /></Field>
              </div>
              <PhotoPicker photoIds={selected.photoIds} multiple onChange={(photoIds) => update({ photoIds })} />
              <OptionalCalendarAction enabled={calendarEnabled} onEnabledChange={(enabled) => { setCalendarEnabled(enabled); setCalendarStatus('') }} status={calendarStatus}>
                <PrimaryAction onClick={() => void shareCalendar()}>share calendar file / mail</PrimaryAction>
              </OptionalCalendarAction>
              <p className="support-note">the concert is saved to your tracker automatically. calendar sharing is optional.</p>
            </div>
          </section>
        )}
        {!selected && <section className="empty-tool paper-texture"><span>0 concerts</span><button onClick={addConcert}>+ add concert</button></section>}
      </div>
    </div>
  )
}

function GoldenHourView({ data, setData }: { data: AppData; setData: DataSetter }) {
  const [locationStatus, setLocationStatus] = useState('')
  const now = useLiveNow()
  const { latitude, longitude, locationName } = data.solar
  const utcOffset = -now.getTimezoneOffset()
  const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`
  const dayAnchor = useMemo(() => {
    const [year, month, day] = dayKey.split('-').map(Number)
    return new Date(year, month, day, 12)
  }, [dayKey])
  const times = useMemo(() => SunCalc.getTimes(dayAnchor, latitude, longitude, 0, utcOffset), [dayAnchor, latitude, longitude, utcOffset])
  const tomorrowTimes = useMemo(() => {
    const tomorrow = new Date(dayAnchor)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return SunCalc.getTimes(tomorrow, latitude, longitude, 0, utcOffset)
  }, [dayAnchor, latitude, longitude, utcOffset])
  const sunPosition = useMemo(() => SunCalc.getPosition(now, latitude, longitude), [latitude, longitude, now])
  const sunrise = times.sunrise
  const morningGoldenEnd = times.goldenHourEnd
  const eveningGoldenStart = times.goldenHour
  const sunset = times.sunset
  const nextEvent = [
    { label: 'SUNRISE', time: sunrise },
    { label: 'MORNING GOLDEN HOUR ENDS', time: morningGoldenEnd },
    { label: 'EVENING GOLDEN HOUR STARTS', time: eveningGoldenStart },
    { label: 'SUNSET', time: sunset },
  ].find((event) => event.time && event.time.getTime() > now.getTime()) ?? { label: 'TOMORROW’S SUNRISE', time: tomorrowTimes.sunrise }
  const secondsUntil = nextEvent.time ? (nextEvent.time.getTime() - now.getTime()) / 1_000 : 0
  const daylightProgress = sunrise && sunset
    ? Math.min(1, Math.max(0, (now.getTime() - sunrise.getTime()) / (sunset.getTime() - sunrise.getTime())))
    : .5
  const inEveningGoldenHour = Boolean(eveningGoldenStart && sunset && now >= eveningGoldenStart && now <= sunset)
  const inMorningGoldenHour = Boolean(sunrise && morningGoldenEnd && now >= sunrise && now <= morningGoldenEnd)

  const updateSolar = (patch: Partial<AppData['solar']>) => setData((current) => ({
    ...current,
    solar: { ...current.solar, ...patch, updatedAt: new Date().toISOString() },
    updatedAt: new Date().toISOString(),
  }))

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('LOCATION IS NOT AVAILABLE IN THIS BROWSER')
      return
    }
    setLocationStatus('LOCATING…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        updateSolar({
          latitude: Number(coords.latitude.toFixed(5)),
          longitude: Number(coords.longitude.toFixed(5)),
          locationName: `${coords.latitude.toFixed(3)}°, ${coords.longitude.toFixed(3)}°`,
        })
        setLocationStatus('CURRENT LOCATION SAVED')
      },
      () => setLocationStatus('LOCATION PERMISSION WAS NOT GRANTED'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 600_000 },
    )
  }

  return (
    <div className="simple-page solar-page view-enter">
      <PageHeader index="784" japanese="光の時間を覚えておく" title="Golden hour">
        <button className="outline-action" onClick={useCurrentLocation}>◎ USE MY LOCATION</button>
      </PageHeader>
      <div className="solar-layout">
        <section className="solar-poster paper-texture reveal">
          <span className="vertical-copy">SOLAR ARCHIVE / {latitude.toFixed(3)}°</span>
          <div className="solar-sky" aria-hidden="true">
            <i className="sun-disc" style={{ '--sun-progress': daylightProgress, '--sun-height': Math.min(1, Math.max(0, sunPosition.altitude / 60)) } as CSSProperties} />
            <span />
          </div>
          <div className="solar-now">
            <small>{inEveningGoldenHour || inMorningGoldenHour ? 'YOU ARE IN GOLDEN HOUR' : `${nextEvent.label} IN`}</small>
            <strong>{inEveningGoldenHour || inMorningGoldenHour ? 'right now' : formatTimer(secondsUntil)}</strong>
            <p>{locationName} · {new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(now)}</p>
          </div>
          <b className="archive-number">03</b>
        </section>

        <section className="solar-details paper-texture reveal">
          <span className="folio">TODAY’S LIGHT / 日没</span>
          <div className="solar-times">
            <article><span>01</span><small>SUNRISE</small><strong>{formatClock(sunrise)}</strong></article>
            <article><span>02</span><small>MORNING GOLDEN END</small><strong>{formatClock(morningGoldenEnd)}</strong></article>
            <article><span>03</span><small>EVENING GOLDEN START</small><strong>{formatClock(eveningGoldenStart)}</strong></article>
            <article><span>04</span><small>SUNSET</small><strong>{formatClock(sunset)}</strong></article>
          </div>
          <div className="solar-position">
            <span>THE SUN IS</span>
            <strong>{Math.abs(sunPosition.altitude).toFixed(1)}°</strong>
            <small>{sunPosition.altitude >= 0 ? 'above' : 'below'} the horizon</small>
          </div>
          <div className="solar-location-editor">
            <Field label="LOCATION NAME" wide><BufferedInput value={locationName} onCommit={(value) => updateSolar({ locationName: value })} /></Field>
            <Field label="LATITUDE"><BufferedInput type="number" step="0.0001" value={latitude} onCommit={(value) => value && updateSolar({ latitude: Number(value) })} /></Field>
            <Field label="LONGITUDE"><BufferedInput type="number" step="0.0001" value={longitude} onCommit={(value) => value && updateSolar({ longitude: Number(value) })} /></Field>
          </div>
          <p className="support-note">Calculated on this device. Times use your device timezone; location permission is only requested when you tap the button.</p>
          {locationStatus && <output className="action-status">{locationStatus}</output>}
        </section>
      </div>
    </div>
  )
}

function FocusFlightView({ data, setData }: { data: AppData; setData: DataSetter }) {
  const [error, setError] = useState('')
  const flight = data.focusFlight
  const now = useLiveNow(flight.status === 'flying' ? 1_000 : 30_000)
  const origin = findAirport(flight.originCode)
  const destination = findAirport(flight.destinationCode)
  const estimatedMinutes = estimateFlightMinutes(origin, destination)
  const distanceKm = Math.round(routeDistanceKm(origin, destination))
  const sessionMinutes = flight.status === 'idle' ? estimatedMinutes : flight.durationMinutes
  const totalSeconds = Math.max(1, sessionMinutes) * 60
  const remainingSeconds = flight.status === 'flying' && flight.endsAt
    ? Math.max(0, (new Date(flight.endsAt).getTime() - now.getTime()) / 1_000)
    : flight.status === 'paused'
      ? flight.pausedRemainingSeconds ?? totalSeconds
      : flight.status === 'arrived' ? 0 : totalSeconds
  const progress = flight.status === 'idle' ? 0 : Math.min(1, Math.max(0, 1 - remainingSeconds / totalSeconds))

  const updateFlight = (patch: Partial<AppData['focusFlight']>) => setData((current) => ({
    ...current,
    focusFlight: { ...current.focusFlight, ...patch },
    updatedAt: new Date().toISOString(),
  }))

  const updateRoute = (patch: Pick<Partial<AppData['focusFlight']>, 'originCode' | 'destinationCode'>) => {
    const nextOrigin = findAirport(patch.originCode ?? flight.originCode)
    const nextDestination = findAirport(patch.destinationCode ?? flight.destinationCode)
    updateFlight({
      ...patch,
      durationMinutes: estimateFlightMinutes(nextOrigin, nextDestination),
    })
    setError('')
  }

  const startFlight = () => {
    if (origin.code === destination.code) {
      setError('CHOOSE A DIFFERENT ARRIVAL AIRPORT')
      return
    }
    const durationMinutes = estimateFlightMinutes(origin, destination)
    // This runs only from a click, so taking the exact current time here is intentional.
    // oxlint-disable-next-line react/purity
    const startedAt = new Date()
    updateFlight({
      sessionId: crypto.randomUUID(),
      durationMinutes,
      status: 'flying',
      startedAt: startedAt.toISOString(),
      endsAt: new Date(startedAt.getTime() + durationMinutes * 60_000).toISOString(),
      pausedRemainingSeconds: undefined,
      landedAt: undefined,
    })
    setError('')
  }

  const pauseFlight = () => updateFlight({ status: 'paused', pausedRemainingSeconds: remainingSeconds, endsAt: undefined })
  const resumeFlight = () => updateFlight({ status: 'flying', endsAt: new Date(Date.now() + remainingSeconds * 1_000).toISOString() })
  const resetFlight = () => setData((current) => {
    const timestamp = new Date().toISOString()
    const shouldArchive = current.focusFlight.status === 'flying' || current.focusFlight.status === 'paused'
    const historyEntry = shouldArchive ? createFlightHistoryEntry(current.focusFlight, 'ended', timestamp) : null
    const alreadyStored = historyEntry && current.flightHistory.some((item) => item.id === historyEntry.id)
    return {
      ...current,
      focusFlight: {
        ...current.focusFlight,
        sessionId: undefined,
        durationMinutes: estimatedMinutes,
        status: 'idle',
        startedAt: undefined,
        endsAt: undefined,
        pausedRemainingSeconds: undefined,
        landedAt: undefined,
      },
      flightHistory: historyEntry && !alreadyStored ? [historyEntry, ...current.flightHistory] : current.flightHistory,
      updatedAt: timestamp,
    }
  })

  return (
    <div className="simple-page flight-page view-enter">
      <PageHeader index="785" japanese="集中するための空の旅" title="Focus flight">
        <span className={`flight-status flight-status--${flight.status}`}>{flight.status === 'idle' ? 'AT THE GATE' : flight.status.toUpperCase()}</span>
      </PageHeader>
      <div className="flight-layout">
        <section className="flight-map-shell reveal">
          <FlightMap origin={origin} destination={destination} progress={progress} />
          <div className="flight-route-card paper-texture">
            <div><small>DEPART</small><strong>{origin.code}</strong><span>{origin.city}</span></div>
            <i><b style={{ transform: `scaleX(${progress})` }} /></i>
            <div><small>ARRIVE</small><strong>{destination.code}</strong><span>{destination.city}</span></div>
          </div>
          <div className="flight-clock">
            <small>{flight.status === 'arrived' ? 'LANDED' : flight.status === 'paused' ? 'CABIN PAUSED' : flight.status === 'idle' ? 'BOARDING' : 'TIME REMAINING'}</small>
            <strong>{formatTimer(remainingSeconds)}</strong>
            <span>{Math.round(progress * 100)}% OF ROUTE</span>
          </div>
        </section>

        <section className="flight-console paper-texture reveal">
          {flight.status === 'idle' && (
            <>
              <span className="folio">BOARDING PASS / FF 104</span>
              <h2>focus<br />timer.</h2>
              <div className="flight-airports">
                <Field label="FROM">
                  <select value={flight.originCode} onChange={(event) => updateRoute({ originCode: event.target.value })}>
                    {AIRPORTS.map((airport) => <option key={airport.code} value={airport.code}>{airport.code} · {airport.city}, {airport.country}</option>)}
                  </select>
                </Field>
                <span>→</span>
                <Field label="TO">
                  <select value={flight.destinationCode} onChange={(event) => updateRoute({ destinationCode: event.target.value })}>
                    {AIRPORTS.map((airport) => <option key={airport.code} value={airport.code}>{airport.code} · {airport.city}, {airport.country}</option>)}
                  </select>
                </Field>
              </div>
              <div className="flight-estimate" aria-live="polite">
                <span>ESTIMATED FLIGHT TIME</span>
                <strong>{formatFlightDuration(estimatedMinutes)}</strong>
                <small>{distanceKm.toLocaleString('en-US')} KM · DIRECT GREAT-CIRCLE ESTIMATE</small>
              </div>
              <Field label="MESSAGE FOR TAKEOFF" wide><BufferedTextarea rows={3} value={flight.intention} onCommit={(value) => updateFlight({ intention: value })} placeholder="takeoff note" /></Field>
              <Field label="SEALED MESSAGE FOR ARRIVAL" wide><BufferedTextarea rows={4} value={flight.arrivalMessage} onCommit={(value) => updateFlight({ arrivalMessage: value })} placeholder="arrival note" /></Field>
              <PrimaryAction onClick={startFlight}>START FLIGHT</PrimaryAction>
              {error && <output className="action-status">{error}</output>}
            </>
          )}

          {(flight.status === 'flying' || flight.status === 'paused') && (
            <div className="in-flight-panel">
              <span className="folio">IN FLIGHT / SEAT 04A</span>
              <h2>{origin.code} → {destination.code}</h2>
              <div className="takeoff-message"><small>YOUR TAKEOFF MESSAGE</small><p>{flight.intention || '—'}</p></div>
              <div className="sealed-message"><span>SEALED UNTIL LANDING</span><b>到着後に開く</b></div>
              <div className="flight-actions">
                <PrimaryAction onClick={flight.status === 'paused' ? resumeFlight : pauseFlight}>{flight.status === 'paused' ? 'RESUME FLIGHT' : 'PAUSE IN CABIN'}</PrimaryAction>
                <button className="paper-action" onClick={resetFlight}>END SESSION ×</button>
              </div>
            </div>
          )}

          {flight.status === 'arrived' && (
            <div className="arrival-note">
              <span className="folio">SAFE LANDING / {destination.code}</span>
              <small>THE NOTE YOU LEFT FOR YOURSELF</small>
              <h2>{flight.arrivalMessage || '—'}</h2>
              <p>{formatFlightDuration(flight.durationMinutes)} estimated flight · landed {flight.landedAt ? formatClock(new Date(flight.landedAt)) : 'just now'} in {destination.city}</p>
              <PrimaryAction onClick={resetFlight}>NEW FLIGHT</PrimaryAction>
            </div>
          )}
        </section>
      </div>
      <section className="flight-history paper-texture reveal">
        <div className="flight-history__heading">
          <div><span>flight log / 飛行記録</span><h2>past flights.</h2></div>
          <b>{pad(data.flightHistory.length)}</b>
        </div>
        {data.flightHistory.length === 0 ? (
          <p className="flight-history__empty">completed and ended sessions will stay here.</p>
        ) : (
          <div className="flight-history__list">
            {data.flightHistory.map((entry, index) => (
              <article key={entry.id}>
                <span>{pad(index + 1)}</span>
                <strong>{entry.originCode} → {entry.destinationCode}</strong>
                <div>
                  <time dateTime={entry.endedAt}>{new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(entry.endedAt))}</time>
                  <small>{formatFlightDuration(entry.durationMinutes)} · {entry.distanceKm.toLocaleString('en-US')} km · {entry.outcome}</small>
                </div>
                <p>{entry.intention || entry.arrivalMessage || 'no note'}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function RoutinesView({ data, setData }: { data: AppData; setData: DataSetter }) {
  const [selectedId, setSelectedId] = useState(data.routines[0]?.id ?? '')
  const [newItem, setNewItem] = useState('')
  const routine = data.routines.find((item) => item.id === selectedId) ?? data.routines[0]
  const complete = routine?.items.filter((item) => item.done).length ?? 0

  const updateRoutine = (updater: (routine: AppData['routines'][number]) => AppData['routines'][number]) => {
    if (!routine) return
    setData((current) => ({ ...current, routines: current.routines.map((item) => item.id === routine.id ? updater(item) : item), updatedAt: new Date().toISOString() }))
  }

  const addRoutine = () => {
    const next = { id: crypto.randomUUID(), name: '', items: [] }
    setData((current) => ({ ...current, routines: [...current.routines, next], updatedAt: new Date().toISOString() }))
    setSelectedId(next.id)
  }

  const addItem = (event: FormEvent) => {
    event.preventDefault()
    if (!newItem.trim()) return
    updateRoutine((current) => ({ ...current, items: [...current.items, { id: crypto.randomUUID(), text: newItem.trim(), done: false }] }))
    setNewItem('')
  }

  return (
    <div className="simple-page view-enter">
      <PageHeader index="780" japanese="繰り返すためのリスト" title="Repeat lists"><button className="outline-action" onClick={addRoutine}>+ NEW LIST</button></PageHeader>
      <div className="simple-spread">
        <aside className="simple-tabs paper-texture">
          {data.routines.map((item, index) => <button key={item.id} className={item.id === routine?.id ? 'is-active' : ''} onClick={() => setSelectedId(item.id)}><span>{pad(index + 1)}</span>{item.name || 'untitled'}</button>)}
        </aside>
        {routine ? (
          <section className="routine-paper paper-texture">
            <div className="routine-title">
              <BufferedInput className="routine-name" value={routine.name} onCommit={(value) => updateRoutine((current) => ({ ...current, name: value }))} placeholder="untitled" />
              <strong>{complete}/{routine.items.length}</strong>
            </div>
            <div className="routine-lines">
              {routine.items.map((item, index) => (
                <label key={item.id} className={item.done ? 'is-done' : ''}>
                  <span>{pad(index + 1)}</span>
                  <input type="checkbox" checked={item.done} onChange={() => updateRoutine((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry) }))} />
                  <i />
                  <b>{item.text}</b>
                </label>
              ))}
            </div>
            <form className="paper-form" onSubmit={addItem}><input value={newItem} onChange={(event) => setNewItem(event.target.value)} placeholder="new item" /><button>ADD</button></form>
            <button className="underlined-action" onClick={() => updateRoutine((current) => ({ ...current, items: current.items.map((item) => ({ ...item, done: false })) }))}>RESET ↻</button>
          </section>
        ) : (
          <section className="empty-tool paper-texture"><span>0 lists</span><button onClick={addRoutine}>+ new list</button></section>
        )}
      </div>
    </div>
  )
}

function QuickTodosView({ data, setData }: { data: AppData; setData: DataSetter }) {
  const [draft, setDraft] = useState('')
  const draftRef = useRef<HTMLInputElement>(null)
  const doneCount = data.quickTodos.filter((item) => item.done).length

  const updateTodos = (updater: (items: AppData['quickTodos']) => AppData['quickTodos']) => {
    setData((current) => ({ ...current, quickTodos: updater(current.quickTodos), updatedAt: new Date().toISOString() }))
  }

  const commitDraft = (value: string) => {
    const text = value.trim()
    if (!text) return false
    updateTodos((items) => [{ id: crypto.randomUUID(), text, done: false }, ...items])
    setDraft('')
    window.requestAnimationFrame(() => draftRef.current?.focus())
    return true
  }

  const addTodo = (event: FormEvent) => {
    event.preventDefault()
    commitDraft(draftRef.current?.value ?? draft)
  }

  return (
    <div className="quick-todo-page view-enter">
      <PageHeader index="786" japanese="すぐやること" title="quick to do" />
      <section className="quick-todo-sheet paper-texture reveal">
        <header className="quick-todo-heading">
          <div><span>one running list / 快速清单</span><strong>{pad(data.quickTodos.length - doneCount)}</strong><small>open</small></div>
          <p>type. enter. next.</p>
        </header>

        <form className="quick-todo-capture" onSubmit={addTodo}>
          <span>{pad(data.quickTodos.length + 1)}</span>
          <input
            ref={draftRef}
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
              event.preventDefault()
              commitDraft(event.currentTarget.value)
            }}
            placeholder="write a task"
            aria-label="new quick task"
            enterKeyHint="enter"
          />
          <button type="submit" aria-label="add task">↵</button>
        </form>

        <div className="quick-todo-list" aria-live="polite">
          {data.quickTodos.map((item, index) => (
            <article key={item.id} className={item.done ? 'is-done' : ''}>
              <span>{pad(index + 1)}</span>
              <button type="button" className="quick-todo-check" aria-label={item.done ? `mark ${item.text} incomplete` : `mark ${item.text} complete`} onClick={() => updateTodos((items) => items.map((entry) => entry.id === item.id ? { ...entry, done: !entry.done } : entry))}><i /></button>
              <BufferedInput value={item.text} aria-label={`task ${index + 1}`} onCommit={(value) => updateTodos((items) => items.map((entry) => entry.id === item.id ? { ...entry, text: value } : entry))} onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                draftRef.current?.focus()
              }} />
              <button type="button" className="quick-todo-remove" aria-label={`remove ${item.text}`} onClick={() => updateTodos((items) => items.filter((entry) => entry.id !== item.id))}>×</button>
            </article>
          ))}
          {data.quickTodos.length === 0 && <p className="quick-todo-empty">the first line is waiting above.</p>}
        </div>

        <footer>
          <span>{doneCount}/{data.quickTodos.length} finished</span>
          {doneCount > 0 && <button type="button" onClick={() => updateTodos((items) => items.filter((item) => !item.done))}>clear finished</button>}
        </footer>
      </section>
    </div>
  )
}

function MomentView({ data, setData }: { data: AppData; setData: DataSetter }) {
  const now = useLiveNow()
  const diff = differenceParts(data.moment.targetAt, now)
  return (
    <div className="simple-page view-enter">
      <PageHeader index="781" japanese="ひとつの大切な瞬間" title="Point in time" />
      <section className="moment-poster paper-texture">
        <span className="vertical-copy">TIME ARCHIVE / VANCOUVER</span>
        <BufferedInput className="moment-name" value={data.moment.label} onCommit={(value) => setData((current) => ({ ...current, moment: { ...current.moment, label: value }, updatedAt: new Date().toISOString() }))} placeholder="event" />
        <div className="moment-count">
          <strong>{diff.days}</strong><span>days</span><strong>{pad(diff.hours)}</strong><span>hrs</span><strong>{pad(diff.minutes)}</strong><span>min</span><strong>{pad(diff.seconds)}</strong><span>sec</span>
        </div>
        <mark>{diff.delta >= 0 ? 'UNTIL' : 'SINCE'} / {new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(data.moment.targetAt)).toUpperCase()}</mark>
        <input type="datetime-local" value={dateTimeInputValue(data.moment.targetAt)} onChange={(event) => {
          const date = new Date(event.target.value)
          if (!Number.isNaN(date.getTime())) {
            setData((current) => ({ ...current, moment: { ...current.moment, targetAt: date.toISOString() }, updatedAt: new Date().toISOString() }))
          }
        }} />
        <b className="archive-number">004</b>
      </section>
    </div>
  )
}

function NotesView({ data, setData }: { data: AppData; setData: DataSetter }) {
  const [selectedId, setSelectedId] = useState(data.notes[0]?.id ?? '')
  const selected = data.notes.find((note) => note.id === selectedId) ?? data.notes[0]
  const addNote = () => {
    const note = { id: crypto.randomUUID(), title: '', body: '', updatedAt: new Date().toISOString() }
    setData((current) => ({ ...current, notes: [note, ...current.notes], updatedAt: note.updatedAt }))
    setSelectedId(note.id)
  }
  const update = (patch: Partial<AppData['notes'][number]>) => selected && setData((current) => {
    const updatedAt = new Date().toISOString()
    return { ...current, notes: current.notes.map((note) => note.id === selected.id ? { ...note, ...patch, updatedAt } : note), updatedAt }
  })

  return (
    <div className="simple-page view-enter">
      <PageHeader index="782" japanese="言葉を残しておく" title="Notes"><button className="outline-action" onClick={addNote}>+ NEW NOTE</button></PageHeader>
      <div className="notes-spread">
        <aside className="note-index">
          {data.notes.map((note, index) => <button key={note.id} className={note.id === selected?.id ? 'is-active' : ''} onClick={() => setSelectedId(note.id)}><span>{pad(index + 1)}</span><div>{note.title || 'untitled'}<small>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(note.updatedAt))}</small></div></button>)}
        </aside>
        {selected && <section className="note-paper paper-texture"><BufferedInput value={selected.title} onCommit={(value) => update({ title: value })} placeholder="untitled" /><BufferedTextarea value={selected.body} onCommit={(value) => update({ body: value })} /><span>AUTOSAVED LOCALLY / 自動保存</span></section>}
        {!selected && <section className="empty-tool paper-texture"><span>0 notes</span><button onClick={addNote}>+ new note</button></section>}
      </div>
    </div>
  )
}

function TrackersView({ data, setData }: { data: AppData; setData: DataSetter }) {
  const change = (id: string, amount: number) => setData((current) => ({ ...current, trackers: current.trackers.map((tracker) => tracker.id === id ? { ...tracker, value: Math.max(0, Math.min(tracker.target, Number((tracker.value + amount).toFixed(2)))) } : tracker), updatedAt: new Date().toISOString() }))
  const update = (id: string, patch: Partial<AppData['trackers'][number]>) => setData((current) => ({ ...current, trackers: current.trackers.map((tracker) => tracker.id === id ? { ...tracker, ...patch } : tracker), updatedAt: new Date().toISOString() }))
  const addTracker = () => setData((current) => ({ ...current, trackers: [...current.trackers, { id: crypto.randomUUID(), label: '', value: 0, target: 1, unit: '', step: 1 }], updatedAt: new Date().toISOString() }))
  return (
    <div className="simple-page view-enter">
      <PageHeader index="783" japanese="本当に大切なことだけ" title="Specific trackers"><button className="outline-action" onClick={addTracker}>+ NEW TRACKER</button></PageHeader>
      <section className="tracker-spread paper-texture">
        <p>{pad(data.trackers.length)} trackers</p>
        {data.trackers.map((tracker, index) => {
          const progress = Math.min(100, (tracker.value / tracker.target) * 100)
          return (
            <article key={tracker.id}>
              <span>{pad(index + 1)}</span>
              <div className="tracker-main">
                <BufferedInput className="tracker-name" value={tracker.label} onCommit={(value) => update(tracker.id, { label: value })} placeholder="name" />
                <i><b style={{ transform: `scaleX(${progress / 100})` }} /></i>
                <div className="tracker-settings">
                  <label>target <BufferedInput type="number" min="0.01" step="any" value={tracker.target} onCommit={(value) => update(tracker.id, { target: Math.max(.01, Number(value)) })} /></label>
                  <label>step <BufferedInput type="number" min="0.01" step="any" value={tracker.step} onCommit={(value) => update(tracker.id, { step: Math.max(.01, Number(value)) })} /></label>
                  <label>unit <BufferedInput value={tracker.unit} onCommit={(value) => update(tracker.id, { unit: value })} /></label>
                </div>
              </div>
              <em>{tracker.value} / {tracker.target} {tracker.unit}</em>
              <div className="tracker-buttons"><button onClick={() => change(tracker.id, -tracker.step)}>−</button><button onClick={() => change(tracker.id, tracker.step)}>＋</button></div>
            </article>
          )
        })}
      </section>
    </div>
  )
}

function App() {
  const [data, setData] = usePersistentState<AppData>('snoopytools:data:v1', createInitialState, migrateAppData)
  const [activeView, setActiveView] = useState<ToolView>('today')
  const [syncOpen, setSyncOpen] = useState(false)
  const sync = useCloudSync(data, setData)
  const desktopInstall = useDesktopInstall()

  useEffect(() => {
    if (data.focusFlight.status !== 'flying' || !data.focusFlight.endsAt) return
    const delay = Math.max(0, new Date(data.focusFlight.endsAt).getTime() - Date.now())
    const timer = window.setTimeout(() => {
      const tick = new Date()
      setData((current) => {
        if (current.focusFlight.status !== 'flying' || !current.focusFlight.endsAt || new Date(current.focusFlight.endsAt) > tick) return current
        const endedAt = tick.toISOString()
        const historyEntry = createFlightHistoryEntry(current.focusFlight, 'landed', endedAt)
        const alreadyStored = historyEntry && current.flightHistory.some((item) => item.id === historyEntry.id)
        return {
          ...current,
          focusFlight: { ...current.focusFlight, status: 'arrived', endsAt: undefined, pausedRemainingSeconds: 0, landedAt: endedAt },
          flightHistory: historyEntry && !alreadyStored ? [historyEntry, ...current.flightHistory] : current.flightHistory,
          updatedAt: endedAt,
        }
      })
    }, Math.min(delay + 50, 2_147_483_647))
    return () => window.clearTimeout(timer)
  }, [data.focusFlight.endsAt, data.focusFlight.status, setData])

  const activeIndex = useMemo(() => NAV_ITEMS.find((item) => item.id === activeView)?.number ?? '00', [activeView])
  const changeTheme = (theme: AppTheme) => setData((current) => ({
    ...current,
    preferences: { ...current.preferences, theme },
    updatedAt: new Date().toISOString(),
  }))

  return (
    <div className={`app-frame app-frame--${activeView}`} data-theme={data.preferences.theme}>
      <div className="global-grain" aria-hidden="true" />
      <header className="app-chrome">
        <button className="brand-lockup" onClick={() => setActiveView('today')}>
          <ProfileAvatar photoId={data.preferences.profile.photoId} />
          <span className="brand-copy"><strong>{data.preferences.profile.displayName || "snoopy's home"}</strong><small>{data.preferences.profile.subtitle}</small></span>
        </button>
        <nav aria-label="Main tools">
          {NAV_ITEMS.map((item) => <button key={item.id} className={activeView === item.id ? 'is-active' : ''} onClick={() => setActiveView(item.id)}><span>{item.number}</span>{item.label}</button>)}
        </nav>
        <div className="chrome-actions">
          <div className="theme-switcher" aria-label="colour theme">
            {THEMES.map((theme) => <button key={theme.id} className={data.preferences.theme === theme.id ? 'is-active' : ''} onClick={() => changeTheme(theme.id)} aria-label={`${theme.label} theme`} title={`${theme.label} theme`}><i /></button>)}
          </div>
          <button className={`chrome-status chrome-status--${sync.status}`} onClick={() => setSyncOpen((open) => !open)} aria-label="open profile and sync settings"><i /> {sync.status === 'sign-in' ? 'profile' : sync.status} <span>{activeIndex}/11</span></button>
        </div>
      </header>

      {syncOpen && <SyncPanel sync={sync} data={data} setData={setData} desktopInstall={desktopInstall} onClose={() => setSyncOpen(false)} />}

      <aside className="issue-rail">
        <span>snoopy's home</span>
        <AirportClocks />
        <b>{activeIndex}</b>
      </aside>

      <main className="app-content">
        <Suspense fallback={<div className="tool-loading" role="status">opening…</div>}>
          {activeView === 'today' && <TodayView data={data} onNavigate={setActiveView} />}
          {activeView === 'birthdays' && <BirthdaysView data={data} setData={setData} />}
          {activeView === 'concerts' && <ConcertsView data={data} setData={setData} />}
          {activeView === 'sunset' && <GoldenHourView data={data} setData={setData} />}
          {activeView === 'flight' && <FocusFlightView data={data} setData={setData} />}
          {activeView === 'routines' && <RoutinesView data={data} setData={setData} />}
          {activeView === 'quick-todos' && <QuickTodosView data={data} setData={setData} />}
          {activeView === 'moment' && <MomentView data={data} setData={setData} />}
          {activeView === 'notes' && <NotesView data={data} setData={setData} />}
          {activeView === 'trackers' && <TrackersView data={data} setData={setData} />}
          {activeView === 'lastfm' && <LastFmBrowserView data={data} setData={setData} onNavigate={setActiveView} authenticated={sync.authenticated} />}
          {activeView === 'music-picks' && <LastFmPicksView data={data} setData={setData} onNavigate={setActiveView} />}
        </Suspense>
      </main>

      <nav className="mobile-nav" aria-label="Mobile tools">
        {NAV_ITEMS.map((item) => <button key={item.id} className={activeView === item.id ? 'is-active' : ''} onClick={() => setActiveView(item.id)}><span>{item.number}</span>{item.label}</button>)}
      </nav>
    </div>
  )
}

export default App
