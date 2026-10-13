import { ConvexError, v } from 'convex/values'
import { action } from './_generated/server'

declare const process: { env: Record<string, string | undefined> }

type LastFmImage = { '#text'?: string; size?: string }
type LastFmRecord = Record<string, unknown>

function list<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function imageFrom(value: unknown) {
  const images = list(value as LastFmImage[] | LastFmImage | undefined)
  return [...images].reverse().find((image) => image['#text'])?.['#text'] || undefined
}

function textFrom(value: unknown) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    if ('#text' in value) return String((value as { '#text'?: unknown })['#text'] ?? '')
    if ('name' in value) return String((value as { name?: unknown }).name ?? '')
  }
  return ''
}

function entryId(kind: string, name: string, artist = '') {
  return `${kind}:${artist}:${name}`.toLocaleLowerCase().replace(/\s+/g, '-')
}

function normalizeEntry(kind: string, item: LastFmRecord) {
  const name = String(item.name ?? '')
  const artist = textFrom(item.artist)
  const date = item.date && typeof item.date === 'object'
    ? String((item.date as { uts?: unknown }).uts ?? '')
    : undefined
  const attributes = item['@attr'] && typeof item['@attr'] === 'object'
    ? item['@attr'] as { nowplaying?: unknown }
    : undefined
  return {
    id: entryId(kind, name, artist),
    name,
    artist: artist || undefined,
    playcount: Number(item.playcount ?? 0),
    url: String(item.url ?? ''),
    image: imageFrom(item.image),
    date: date || undefined,
    nowPlaying: attributes?.nowplaying === 'true' || undefined,
  }
}

export const getDashboard = action({
  args: {
    username: v.string(),
    period: v.union(v.literal('week'), v.literal('month'), v.literal('year')),
  },
  handler: async (ctx, { username, period }) => {
    try {
      if (!(await ctx.auth.getUserIdentity())) throw new ConvexError('sign in once from the profile menu before connecting last.fm.')
      const apiKey = process.env.LASTFM_API_KEY
      if (!apiKey) throw new ConvexError('last.fm needs its api key added to convex before the first connection.')

      const cleanUsername = username.trim()
      if (!cleanUsername) throw new ConvexError('enter a last.fm username first.')
      const apiPeriod = period === 'week' ? '7day' : period === 'month' ? '1month' : '12month'

      const call = async (method: string, extra: Record<string, string> = {}) => {
        const params = new URLSearchParams({
          method,
          user: cleanUsername,
          api_key: apiKey,
          format: 'json',
          ...extra,
        })
        const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, {
          headers: { 'User-Agent': "SnoopysHome/1.0 (personal listening archive)" },
        })
        if (!response.ok) throw new ConvexError(`last.fm returned ${response.status}. try again in a moment.`)
        const payload = await response.json() as LastFmRecord
        if (payload.error) throw new ConvexError(String(payload.message ?? 'last.fm could not load this account.'))
        return payload
      }

      const [profilePayload, recentPayload, artistPayload, albumPayload, trackPayload] = await Promise.all([
        call('user.getinfo'),
        call('user.getrecenttracks', { limit: '40', extended: '1' }),
        call('user.gettopartists', { period: apiPeriod, limit: '15' }),
        call('user.gettopalbums', { period: apiPeriod, limit: '15' }),
        call('user.gettoptracks', { period: apiPeriod, limit: '15' }),
      ])

      const user = profilePayload.user as LastFmRecord
      const registered = user.registered && typeof user.registered === 'object'
        ? String((user.registered as { unixtime?: unknown })?.unixtime ?? '')
        : ''
      const recentTracks = (recentPayload.recenttracks as LastFmRecord | undefined)?.track
      const topArtists = (artistPayload.topartists as LastFmRecord | undefined)?.artist
      const topAlbums = (albumPayload.topalbums as LastFmRecord | undefined)?.album
      const topTracks = (trackPayload.toptracks as LastFmRecord | undefined)?.track

      return {
        period,
        fetchedAt: new Date().toISOString(),
        user: {
          name: String(user.name ?? cleanUsername),
          realName: String(user.realname ?? '') || undefined,
          url: String(user.url ?? `https://www.last.fm/user/${encodeURIComponent(cleanUsername)}`),
          image: imageFrom(user.image),
          playcount: Number(user.playcount ?? 0),
          registeredAt: registered || undefined,
        },
        recent: list(recentTracks as LastFmRecord[] | LastFmRecord | undefined).map((item) => normalizeEntry('recent', item)),
        artists: list(topArtists as LastFmRecord[] | LastFmRecord | undefined).map((item) => normalizeEntry('artist', item)),
        albums: list(topAlbums as LastFmRecord[] | LastFmRecord | undefined).map((item) => normalizeEntry('album', item)),
        tracks: list(topTracks as LastFmRecord[] | LastFmRecord | undefined).map((item) => normalizeEntry('track', item)),
      }
    } catch (error) {
      if (error instanceof ConvexError) throw error
      throw new ConvexError(error instanceof Error ? error.message.toLowerCase() : 'last.fm could not be reached.')
    }
  },
})
