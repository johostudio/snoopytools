import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import type { AppData, LastFmEntry, LastFmSnapshot, ListeningCategory, ListeningPeriod, ToolView } from '../domain'
import { getLastFmDashboard } from '../lib/cloudApi'

type DataSetter = Dispatch<SetStateAction<AppData>>

const PERIODS: { id: ListeningPeriod; label: string; note: string }[] = [
  { id: 'week', label: 'week', note: 'last 7 days' },
  { id: 'month', label: 'month', note: 'last month' },
  { id: 'year', label: 'year', note: 'last 12 months' },
]

const CATEGORIES: { id: ListeningCategory; label: string; singular: string }[] = [
  { id: 'artists', label: 'artists', singular: 'artist' },
  { id: 'albums', label: 'albums', singular: 'album' },
  { id: 'tracks', label: 'tracks', singular: 'track' },
]

function cleanError(error: unknown) {
  if (!(error instanceof Error)) return 'last.fm could not be reached.'
  return error.message.trim()
}

function number(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function fetchedLabel(value?: string) {
  if (!value) return 'not loaded yet'
  return `updated ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))}`
}

function recentDate(entry: LastFmEntry) {
  if (entry.nowPlaying) return 'playing now'
  if (!entry.date) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(Number(entry.date) * 1_000))
}

function PeriodTabs({ value, onChange }: { value: ListeningPeriod; onChange: (period: ListeningPeriod) => void }) {
  return (
    <div className="listening-periods" role="tablist" aria-label="listening period">
      {PERIODS.map((period) => (
        <button type="button" role="tab" aria-selected={value === period.id} className={value === period.id ? 'is-active' : ''} key={period.id} onClick={() => onChange(period.id)}>
          <strong>{period.label}</strong><small>{period.note}</small>
        </button>
      ))}
    </div>
  )
}

function Artwork({ entry, index }: { entry: LastFmEntry; index: number }) {
  if (entry.image) return <img src={entry.image} alt="" loading="lazy" />
  return <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
}

function ListeningRows({ entries, category }: { entries: LastFmEntry[]; category: ListeningCategory | 'recent' }) {
  return (
    <div className="listening-rows">
      {entries.map((entry, index) => (
        <a href={entry.url || undefined} target="_blank" rel="noreferrer" key={`${entry.id}-${index}`}>
          <Artwork entry={entry} index={index} />
          <em>{String(index + 1).padStart(2, '0')}</em>
          <div><strong>{entry.name || 'untitled'}</strong>{entry.artist && <small>{entry.artist}</small>}</div>
          <b>{category === 'recent' ? recentDate(entry) : `${number(entry.playcount)} plays`}</b>
        </a>
      ))}
      {!entries.length && <p className="listening-empty">nothing cached for this section yet.</p>}
    </div>
  )
}

function ListeningHeader({ index, title, action }: { index: string; title: string; action?: ReactNode }) {
  return (
    <header className="page-header listening-page-header reveal">
      <div><span className="folio">page {index}</span><span className="jp-label">音楽の記録</span></div>
      <h1>{title}</h1>
      {action && <div className="page-header-actions">{action}</div>}
    </header>
  )
}

function saveSnapshot(setData: DataSetter, username: string, snapshot: LastFmSnapshot) {
  setData((current) => ({
    ...current,
    lastFm: {
      ...current.lastFm,
      username,
      snapshots: { ...current.lastFm.snapshots, [snapshot.period]: snapshot },
    },
    updatedAt: new Date().toISOString(),
  }))
}

export function LastFmBrowserView({ data, setData, onNavigate, authenticated }: { data: AppData; setData: DataSetter; onNavigate: (view: ToolView) => void; authenticated: boolean }) {
  const usernameRef = useRef<HTMLInputElement>(null)
  const [period, setPeriod] = useState<ListeningPeriod>('week')
  const [section, setSection] = useState<ListeningCategory | 'recent'>('recent')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const autoLoadedRef = useRef(new Set<string>())
  const snapshot = data.lastFm.snapshots[period]

  const load = useCallback(async (automatic = false) => {
    const cleanUsername = (automatic ? data.lastFm.username : usernameRef.current?.value ?? data.lastFm.username).trim()
    if (!cleanUsername) {
      if (!automatic) setMessage('enter your last.fm username first.')
      return
    }
    setBusy(true)
    if (!automatic) setMessage('')
    try {
      const result = await getLastFmDashboard(cleanUsername, period)
      saveSnapshot(setData, cleanUsername, result)
      if (!automatic) setMessage('listening archive updated.')
    } catch (error) {
      if (!automatic || !snapshot) setMessage(cleanError(error))
    } finally {
      setBusy(false)
    }
  }, [data.lastFm.username, period, setData, snapshot])

  useEffect(() => {
    const input = usernameRef.current
    if (input && document.activeElement !== input && input.value !== data.lastFm.username) input.value = data.lastFm.username
  }, [data.lastFm.username])

  useEffect(() => {
    const username = data.lastFm.username.trim()
    if (!username || !authenticated || !navigator.onLine) return
    const key = `${username.toLowerCase()}:${period}`
    if (autoLoadedRef.current.has(key)) return
    const fetchedAt = snapshot?.fetchedAt ? Date.parse(snapshot.fetchedAt) : 0
    const isFresh = Number.isFinite(fetchedAt) && Date.now() - fetchedAt < 15 * 60 * 1_000
    if (isFresh) return
    autoLoadedRef.current.add(key)
    // oxlint-disable-next-line react/set-state-in-effect -- refreshes the external Last.fm cache after a saved connection becomes stale.
    void load(true)
  }, [authenticated, data.lastFm.username, load, period, snapshot?.fetchedAt])

  const entries = section === 'recent' ? snapshot?.recent ?? [] : snapshot?.[section] ?? []
  const topArtist = snapshot?.artists[0]
  const topAlbum = snapshot?.albums[0]
  const topTrack = snapshot?.tracks[0]

  return (
    <div className="listening-view view-enter">
      <ListeningHeader index="791" title="last.fm browser" action={<button className="outline-action" onClick={() => onNavigate('music-picks')}>open bests ↗</button>} />

      <section className="lastfm-connect paper-texture reveal">
        <div>
          <span className="folio">connection / last.fm</span>
          <strong>{snapshot?.user.realName || snapshot?.user.name || 'your listening archive'}</strong>
          <small>{snapshot ? `${number(snapshot.user.playcount)} all-time scrobbles · ${fetchedLabel(snapshot.fetchedAt)}` : 'public read-only stats · cached after each refresh'}</small>
        </div>
        <label><span>username</span><input ref={usernameRef} defaultValue={data.lastFm.username} placeholder="last.fm username" autoCapitalize="none" autoCorrect="off" /></label>
        <button type="button" className="listening-refresh" onClick={() => void load(false)} disabled={busy}>{busy ? 'loading…' : snapshot ? 'refresh stats' : 'connect archive'}</button>
        {message && <output>{message}</output>}
      </section>

      <PeriodTabs value={period} onChange={(next) => { setPeriod(next); setMessage('') }} />

      {snapshot ? (
        <>
          <section className="listening-masthead reveal">
            <a href={snapshot.user.url} target="_blank" rel="noreferrer" className="listener-card paper-texture">
              {snapshot.user.image ? <img src={snapshot.user.image} alt="" /> : <span>{snapshot.user.name.slice(0, 1)}</span>}
              <div><small>listener / 聴く人</small><strong>{snapshot.user.name}</strong><em>view last.fm ↗</em></div>
            </a>
            <div className="listening-highlights">
              {[['artist', topArtist], ['album', topAlbum], ['track', topTrack]].map(([label, entry]) => (
                <article key={label as string}><span>top {label as string}</span><strong>{(entry as LastFmEntry | undefined)?.name || '—'}</strong><small>{(entry as LastFmEntry | undefined)?.artist || `${number((entry as LastFmEntry | undefined)?.playcount ?? 0)} plays`}</small></article>
              ))}
            </div>
          </section>

          <section className="listening-browser paper-texture reveal">
            <nav aria-label="listening data">
              {(['recent', 'artists', 'albums', 'tracks'] as const).map((item) => <button type="button" key={item} className={section === item ? 'is-active' : ''} onClick={() => setSection(item)}>{item}<span>{item === 'recent' ? snapshot.recent.length : snapshot[item].length}</span></button>)}
            </nav>
            <div className="listening-browser__heading"><span>{section} / {period}</span><small>{section === 'recent' ? 'latest scrobbles' : 'top 15 by play count'}</small></div>
            <ListeningRows entries={entries} category={section} />
          </section>
        </>
      ) : null}
    </div>
  )
}

export function LastFmPicksView({ data, setData, onNavigate }: { data: AppData; setData: DataSetter; onNavigate: (view: ToolView) => void }) {
  const [period, setPeriod] = useState<ListeningPeriod>('week')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const snapshot = data.lastFm.snapshots[period]
  const periodPicks = data.lastFm.picks[period]

  const pickedCount = useMemo(() => Object.values(periodPicks).reduce((sum, entries) => sum + entries.length, 0), [periodPicks])

  const refresh = async () => {
    if (!data.lastFm.username) {
      onNavigate('lastfm')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const result = await getLastFmDashboard(data.lastFm.username, period)
      saveSnapshot(setData, data.lastFm.username, result)
      setMessage('top 15 updated.')
    } catch (error) {
      setMessage(cleanError(error))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (category: ListeningCategory, entry: LastFmEntry) => {
    const current = data.lastFm.picks[period][category]
    const selected = current.some((item) => item.id === entry.id)
    if (!selected && current.length >= 3) {
      setMessage(`three ${category} are already selected. remove one first.`)
      return
    }
    const next = selected ? current.filter((item) => item.id !== entry.id) : [...current, entry]
    setData((state) => ({
      ...state,
      lastFm: {
        ...state.lastFm,
        picks: {
          ...state.lastFm.picks,
          [period]: { ...state.lastFm.picks[period], [category]: next },
        },
      },
      updatedAt: new Date().toISOString(),
    }))
    setMessage('')
  }

  return (
    <div className="listening-view picks-view view-enter">
      <ListeningHeader index="792" title="bests" action={<button className="outline-action" onClick={() => onNavigate('lastfm')}>listening browser ↗</button>} />
      <PeriodTabs value={period} onChange={(next) => { setPeriod(next); setMessage('') }} />

      <section className="picks-cover paper-texture reveal">
        <div className="picks-cover__title"><span>{period} edition / 私の音楽</span><strong>nine things<br />i kept.</strong><small>{pickedCount}/9 selected · {fetchedLabel(snapshot?.fetchedAt)}</small></div>
        <div className="picks-display">
          {CATEGORIES.map((category) => (
            <div key={category.id}>
              <span>03 / {category.label}</span>
              {[0, 1, 2].map((index) => {
                const entry = periodPicks[category.id][index]
                return <article key={index}>{entry ? <><Artwork entry={entry} index={index} /><div><strong>{entry.name}</strong><small>{entry.artist || `${number(entry.playcount)} plays`}</small></div></> : <em>{String(index + 1).padStart(2, '0')}</em>}</article>
              })}
            </div>
          ))}
        </div>
      </section>

      {!snapshot ? (
        <section className="listening-blank paper-texture"><span>top 15 / {period}</span><strong>load the choices<br />for this period.</strong><p>last.fm provides your fifteen most-played artists, albums, and tracks. choose three from each.</p><button type="button" className="listening-refresh" onClick={() => void refresh()} disabled={busy}>{busy ? 'loading…' : data.lastFm.username ? 'load top 15' : 'connect last.fm first'}</button>{message && <output>{message}</output>}</section>
      ) : (
        <section className="pick-categories">
          <div className="pick-actions"><span>choose exactly three from each top 15.</span><button type="button" onClick={() => void refresh()} disabled={busy}>{busy ? 'refreshing…' : 'refresh top 15'}</button></div>
          {message && <output className="pick-message">{message}</output>}
          {CATEGORIES.map((category) => (
            <article className="pick-category paper-texture" key={category.id}>
              <header><div><span>top 15 / {category.label}</span><strong>{periodPicks[category.id].length}/3 kept</strong></div><small>{PERIODS.find((item) => item.id === period)?.note}</small></header>
              <div className="pick-options">
                {snapshot[category.id].map((entry, index) => {
                  const selected = periodPicks[category.id].some((item) => item.id === entry.id)
                  return (
                    <button type="button" key={entry.id} className={selected ? 'is-selected' : ''} aria-pressed={selected} onClick={() => toggle(category.id, entry)}>
                      <Artwork entry={entry} index={index} />
                      <em>{String(index + 1).padStart(2, '0')}</em>
                      <div><strong>{entry.name}</strong><small>{entry.artist || category.singular}</small></div>
                      <b>{number(entry.playcount)}</b>
                      <i>{selected ? 'kept' : '+'}</i>
                    </button>
                  )
                })}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
