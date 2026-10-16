interface Env {
  DB: D1Database
  MEDIA: R2Bucket
  APP_ORIGINS: string
  LASTFM_API_KEY?: string
}

interface UserRow {
  id: string
  email: string
  password_hash: string
  password_salt: string
  password_iterations: number
  created_at: string
}

interface PublicUser {
  id: string
  email: string
}

interface AuthenticatedUser extends PublicUser {
  session_id: string
}

interface StateRow {
  object_key: string
  updated_at: string
  size_bytes: number
}

interface PhotoRow {
  client_id: string
  object_key: string
  name: string
  content_type: string | null
  created_at: string
  size_bytes: number
}

interface LastFmImage {
  '#text'?: string
  size?: string
}

type LastFmRecord = Record<string, unknown>

// Cloudflare Workers' Web Crypto runtime caps PBKDF2 at 100,000 iterations.
const PASSWORD_ITERATIONS = 100_000
// Installed devices renew this rolling session whenever the app opens.
const SESSION_LIFETIME_MS = 10 * 365 * 24 * 60 * 60 * 1_000
const MAX_STATE_BYTES = 25 * 1024 * 1024
const MAX_PHOTO_BYTES = 100 * 1024 * 1024

class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function randomToken(bytes = 32) {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToBase64(new Uint8Array(digest))
}

async function passwordHash(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt.buffer as ArrayBuffer, iterations },
    key,
    256,
  )
  return new Uint8Array(bits)
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') throw new ApiError(400, 'enter a valid email address.')
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'enter a valid email address.')
  return email
}

function validatePassword(value: unknown) {
  if (typeof value !== 'string' || value.length < 8) throw new ApiError(400, 'password must be at least eight characters.')
  if (value.length > 256) throw new ApiError(400, 'password is too long.')
  return value
}

function allowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get('Origin')
  if (!origin) return null
  const allowed = env.APP_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean)
  return allowed.includes(origin) ? origin : false
}

function withHeaders(response: Response, origin: string | null) {
  const next = new Response(response.body, response)
  if (origin) {
    next.headers.set('Access-Control-Allow-Origin', origin)
    next.headers.append('Vary', 'Origin')
    next.headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type, ETag, X-Photo-Created-At, X-Photo-Name')
  }
  next.headers.set('Cache-Control', 'no-store')
  next.headers.set('X-Content-Type-Options', 'nosniff')
  next.headers.set('Referrer-Policy', 'no-referrer')
  return next
}

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
}

async function jsonBody<T>(request: Request) {
  try {
    return await request.json() as T
  } catch {
    throw new ApiError(400, 'the request body is not valid json.')
  }
}

function routeMethod(request: Request, expected: string) {
  if (request.method !== expected) throw new ApiError(405, 'method not allowed.')
}

async function createSession(env: Env, user: PublicUser) {
  const token = randomToken()
  const now = new Date()
  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
  ).bind(
    crypto.randomUUID(),
    user.id,
    await sha256(token),
    now.toISOString(),
    new Date(now.getTime() + SESSION_LIFETIME_MS).toISOString(),
  ).run()
  return { token, user }
}

async function requireUser(request: Request, env: Env): Promise<AuthenticatedUser> {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) throw new ApiError(401, 'sign in to use cloud sync.')
  const token = authorization.slice(7).trim()
  if (!token) throw new ApiError(401, 'sign in to use cloud sync.')
  const row = await env.DB.prepare(
    `SELECT users.id, users.email, sessions.id AS session_id
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
  ).bind(await sha256(token), new Date().toISOString()).first<AuthenticatedUser>()
  if (!row) throw new ApiError(401, 'this saved session has expired. connect this device once more.')
  return row
}

async function signUp(request: Request, env: Env) {
  routeMethod(request, 'POST')
  const body = await jsonBody<{ email?: unknown; password?: unknown }>(request)
  const email = normalizeEmail(body.email)
  const password = validatePassword(body.password)
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: string }>()
  if (existing) throw new ApiError(409, 'an account already exists for this email. choose sign in.')

  const id = crypto.randomUUID()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await passwordHash(password, salt, PASSWORD_ITERATIONS)
  await env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, password_salt, password_iterations, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(id, email, bytesToBase64(hash), bytesToBase64(salt), PASSWORD_ITERATIONS, new Date().toISOString()).run()
  return json(await createSession(env, { id, email }), 201)
}

async function signIn(request: Request, env: Env) {
  routeMethod(request, 'POST')
  const body = await jsonBody<{ email?: unknown; password?: unknown }>(request)
  const email = normalizeEmail(body.email)
  const password = validatePassword(body.password)
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>()
  if (!user) throw new ApiError(401, 'email or password did not match.')
  const candidate = await passwordHash(password, base64ToBytes(user.password_salt), user.password_iterations)
  if (!equalBytes(candidate, base64ToBytes(user.password_hash))) throw new ApiError(401, 'email or password did not match.')
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run()
  return json(await createSession(env, { id: user.id, email: user.email }))
}

async function connect(request: Request, env: Env) {
  routeMethod(request, 'POST')
  const body = await jsonBody<{ email?: unknown; password?: unknown }>(request)
  const email = normalizeEmail(body.email)
  const password = validatePassword(body.password)
  const existing = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>()

  if (existing) {
    const candidate = await passwordHash(password, base64ToBytes(existing.password_salt), existing.password_iterations)
    if (!equalBytes(candidate, base64ToBytes(existing.password_hash))) throw new ApiError(401, 'email or password did not match.')
    await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run()
    return json(await createSession(env, { id: existing.id, email: existing.email }))
  }

  const id = crypto.randomUUID()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await passwordHash(password, salt, PASSWORD_ITERATIONS)
  await env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, password_salt, password_iterations, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(id, email, bytesToBase64(hash), bytesToBase64(salt), PASSWORD_ITERATIONS, new Date().toISOString()).run()
  return json(await createSession(env, { id, email }), 201)
}

async function session(request: Request, env: Env) {
  routeMethod(request, 'GET')
  const user = await requireUser(request, env)
  await env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').bind(
    new Date(Date.now() + SESSION_LIFETIME_MS).toISOString(),
    user.session_id,
  ).run()
  return json({ user: { id: user.id, email: user.email } })
}

async function readState(env: Env, userId: string, row?: StateRow | null) {
  const stateRow = row ?? await env.DB.prepare(
    'SELECT object_key, updated_at, size_bytes FROM app_states WHERE user_id = ?',
  ).bind(userId).first<StateRow>()
  if (!stateRow) return null
  const object = await env.MEDIA.get(stateRow.object_key)
  if (!object?.body) throw new ApiError(503, 'the cloud archive is temporarily unavailable.')
  try {
    return { data: JSON.parse(await object.text()) as unknown, updatedAt: stateRow.updated_at }
  } catch {
    throw new ApiError(500, 'the cloud archive could not be read.')
  }
}

async function getState(request: Request, env: Env) {
  routeMethod(request, 'GET')
  const user = await requireUser(request, env)
  return json({ state: await readState(env, user.id) })
}

async function putState(request: Request, env: Env) {
  routeMethod(request, 'PUT')
  const user = await requireUser(request, env)
  const body = await jsonBody<{ data?: unknown; updatedAt?: unknown }>(request)
  if (!body.data || typeof body.data !== 'object') throw new ApiError(400, 'archive data is missing.')
  if (typeof body.updatedAt !== 'string' || !Number.isFinite(Date.parse(body.updatedAt))) throw new ApiError(400, 'archive timestamp is invalid.')

  const serialized = JSON.stringify(body.data)
  const size = new TextEncoder().encode(serialized).byteLength
  if (size > MAX_STATE_BYTES) throw new ApiError(413, 'the structured archive is larger than 25 mb.')

  const previous = await env.DB.prepare(
    'SELECT object_key, updated_at, size_bytes FROM app_states WHERE user_id = ?',
  ).bind(user.id).first<StateRow>()
  const objectKey = `states/${user.id}/${body.updatedAt.replace(/[^0-9A-Za-z]/g, '-')}-${crypto.randomUUID()}.json`
  await env.MEDIA.put(objectKey, serialized, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { updatedAt: body.updatedAt },
  })

  try {
    await env.DB.prepare(
      `INSERT INTO app_states (user_id, object_key, updated_at, size_bytes)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         object_key = excluded.object_key,
         updated_at = excluded.updated_at,
         size_bytes = excluded.size_bytes
       WHERE excluded.updated_at >= app_states.updated_at`,
    ).bind(user.id, objectKey, body.updatedAt, size).run()
  } catch (error) {
    await env.MEDIA.delete(objectKey)
    throw error
  }

  const current = await env.DB.prepare(
    'SELECT object_key, updated_at, size_bytes FROM app_states WHERE user_id = ?',
  ).bind(user.id).first<StateRow>()
  const accepted = current?.object_key === objectKey
  if (accepted) {
    if (previous?.object_key && previous.object_key !== objectKey) await env.MEDIA.delete(previous.object_key)
    return json({ accepted: true, state: { data: body.data, updatedAt: body.updatedAt } })
  }

  await env.MEDIA.delete(objectKey)
  return json({ accepted: false, state: await readState(env, user.id, current) }, 409)
}

function photoIdFrom(pathname: string) {
  const encoded = pathname.slice('/v1/photos/'.length)
  if (!encoded || encoded.includes('/')) throw new ApiError(400, 'photo id is missing.')
  let clientId = ''
  try {
    clientId = decodeURIComponent(encoded)
  } catch {
    throw new ApiError(400, 'photo id is invalid.')
  }
  if (!clientId || clientId.length > 200) throw new ApiError(400, 'photo id is invalid.')
  return clientId
}

async function photo(request: Request, env: Env, pathname: string) {
  const user = await requireUser(request, env)
  const clientId = photoIdFrom(pathname)
  const row = await env.DB.prepare(
    'SELECT client_id, object_key, name, content_type, created_at, size_bytes FROM photos WHERE user_id = ? AND client_id = ?',
  ).bind(user.id, clientId).first<PhotoRow>()

  if (request.method === 'HEAD') {
    if (!row || !(await env.MEDIA.head(row.object_key))) return new Response(null, { status: 404 })
    return new Response(null, {
      status: 200,
      headers: {
        'Content-Type': row.content_type || 'application/octet-stream',
        'Content-Length': String(row.size_bytes),
        'X-Photo-Name': encodeURIComponent(row.name),
        'X-Photo-Created-At': row.created_at,
      },
    })
  }

  if (request.method === 'GET') {
    if (!row) throw new ApiError(404, 'photo not found.')
    const object = await env.MEDIA.get(row.object_key)
    if (!object?.body) throw new ApiError(404, 'photo not found.')
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('Content-Type', row.content_type || headers.get('Content-Type') || 'application/octet-stream')
    headers.set('Content-Length', String(row.size_bytes || object.size))
    headers.set('ETag', object.httpEtag)
    headers.set('X-Photo-Name', encodeURIComponent(row.name))
    headers.set('X-Photo-Created-At', row.created_at)
    return new Response(object.body, { headers })
  }

  if (request.method === 'PUT') {
    if (!request.body) throw new ApiError(400, 'photo body is missing.')
    const declaredSize = Number(request.headers.get('Content-Length') ?? 0)
    if (Number.isFinite(declaredSize) && declaredSize > MAX_PHOTO_BYTES) throw new ApiError(413, 'photos must be smaller than 100 mb.')
    const contentType = request.headers.get('Content-Type') || 'application/octet-stream'
    const encodedName = request.headers.get('X-Photo-Name') || 'photo'
    let name = 'photo'
    try {
      name = decodeURIComponent(encodedName).slice(0, 500) || 'photo'
    } catch {
      name = 'photo'
    }
    const createdAtHeader = request.headers.get('X-Photo-Created-At')
    const createdAt = createdAtHeader && Number.isFinite(Date.parse(createdAtHeader)) ? createdAtHeader : new Date().toISOString()
    const objectKey = `photos/${user.id}/${encodeURIComponent(clientId)}`
    const stored = await env.MEDIA.put(objectKey, request.body, {
      httpMetadata: { contentType },
      customMetadata: { clientId, name, createdAt },
    })
    if (!stored) throw new ApiError(503, 'photo upload could not be completed.')
    await env.DB.prepare(
      `INSERT INTO photos (user_id, client_id, object_key, name, content_type, created_at, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, client_id) DO UPDATE SET
         object_key = excluded.object_key,
         name = excluded.name,
         content_type = excluded.content_type,
         created_at = excluded.created_at,
         size_bytes = excluded.size_bytes`,
    ).bind(user.id, clientId, objectKey, name, contentType, createdAt, stored.size).run()
    return json({ uploaded: true, clientId }, 201)
  }

  throw new ApiError(405, 'method not allowed.')
}

async function prunePhotos(request: Request, env: Env) {
  routeMethod(request, 'POST')
  const user = await requireUser(request, env)
  const body = await jsonBody<{ activeClientIds?: unknown }>(request)
  if (!Array.isArray(body.activeClientIds) || body.activeClientIds.some((id) => typeof id !== 'string')) {
    throw new ApiError(400, 'active photo ids are invalid.')
  }
  const active = new Set(body.activeClientIds as string[])
  const rows = await env.DB.prepare(
    'SELECT client_id, object_key, name, content_type, created_at, size_bytes FROM photos WHERE user_id = ? LIMIT 500',
  ).bind(user.id).all<PhotoRow>()
  const inactive = rows.results.filter((row) => !active.has(row.client_id))
  const batch = inactive.slice(0, 30)
  if (batch.length) {
    await env.MEDIA.delete(batch.map((row) => row.object_key))
    await env.DB.batch(batch.map((row) => env.DB.prepare(
      'DELETE FROM photos WHERE user_id = ? AND client_id = ?',
    ).bind(user.id, row.client_id)))
  }
  return json({ deleted: batch.length, remaining: inactive.length > batch.length })
}

function list<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function lastFmImage(value: unknown) {
  const images = list(value as LastFmImage[] | LastFmImage | undefined)
  return [...images].reverse().find((image) => image['#text'])?.['#text'] || undefined
}

function lastFmText(value: unknown) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    if ('#text' in value) return String((value as { '#text'?: unknown })['#text'] ?? '')
    if ('name' in value) return String((value as { name?: unknown }).name ?? '')
  }
  return ''
}

function lastFmEntryId(kind: string, name: string, artist = '') {
  return `${kind}:${artist}:${name}`.toLocaleLowerCase().replace(/\s+/g, '-')
}

function normalizeLastFmEntry(kind: string, item: LastFmRecord) {
  const name = String(item.name ?? '')
  const artist = lastFmText(item.artist)
  const date = item.date && typeof item.date === 'object'
    ? String((item.date as { uts?: unknown }).uts ?? '')
    : undefined
  const attributes = item['@attr'] && typeof item['@attr'] === 'object'
    ? item['@attr'] as { nowplaying?: unknown }
    : undefined
  return {
    id: lastFmEntryId(kind, name, artist),
    name,
    artist: artist || undefined,
    playcount: Number(item.playcount ?? 0),
    url: String(item.url ?? ''),
    image: lastFmImage(item.image),
    date: date || undefined,
    nowPlaying: attributes?.nowplaying === 'true' || undefined,
  }
}

async function lastFmDashboard(request: Request, env: Env, url: URL) {
  routeMethod(request, 'GET')
  await requireUser(request, env)
  if (!env.LASTFM_API_KEY) throw new ApiError(503, 'last.fm needs its api key added to cloudflare.')
  const username = (url.searchParams.get('username') ?? '').trim()
  const period = url.searchParams.get('period')
  if (!username) throw new ApiError(400, 'enter a last.fm username first.')
  if (period !== 'week' && period !== 'month' && period !== 'year') throw new ApiError(400, 'last.fm period is invalid.')
  const apiPeriod = period === 'week' ? '7day' : period === 'month' ? '1month' : '12month'

  const call = async (method: string, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({
      method,
      user: username,
      api_key: env.LASTFM_API_KEY!,
      format: 'json',
      ...extra,
    })
    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, {
      headers: { 'User-Agent': "SnoopysHome/1.0 (personal listening archive)" },
    })
    if (!response.ok) throw new ApiError(502, `last.fm returned ${response.status}. try again in a moment.`)
    const payload = await response.json() as LastFmRecord
    if (payload.error) throw new ApiError(502, String(payload.message ?? 'last.fm could not load this account.'))
    return payload
  }

  const [profilePayload, recentPayload, artistPayload, albumPayload, trackPayload] = await Promise.all([
    call('user.getinfo'),
    call('user.getrecenttracks', { limit: '40', extended: '1' }),
    call('user.gettopartists', { period: apiPeriod, limit: '15' }),
    call('user.gettopalbums', { period: apiPeriod, limit: '15' }),
    call('user.gettoptracks', { period: apiPeriod, limit: '15' }),
  ])

  const lastFmUser = profilePayload.user as LastFmRecord
  const registered = lastFmUser.registered && typeof lastFmUser.registered === 'object'
    ? String((lastFmUser.registered as { unixtime?: unknown }).unixtime ?? '')
    : ''
  return json({
    period,
    fetchedAt: new Date().toISOString(),
    user: {
      name: String(lastFmUser.name ?? username),
      realName: String(lastFmUser.realname ?? '') || undefined,
      url: String(lastFmUser.url ?? `https://www.last.fm/user/${encodeURIComponent(username)}`),
      image: lastFmImage(lastFmUser.image),
      playcount: Number(lastFmUser.playcount ?? 0),
      registeredAt: registered || undefined,
    },
    recent: list((recentPayload.recenttracks as LastFmRecord | undefined)?.track as LastFmRecord[] | LastFmRecord | undefined).map((item) => normalizeLastFmEntry('recent', item)),
    artists: list((artistPayload.topartists as LastFmRecord | undefined)?.artist as LastFmRecord[] | LastFmRecord | undefined).map((item) => normalizeLastFmEntry('artist', item)),
    albums: list((albumPayload.topalbums as LastFmRecord | undefined)?.album as LastFmRecord[] | LastFmRecord | undefined).map((item) => normalizeLastFmEntry('album', item)),
    tracks: list((trackPayload.toptracks as LastFmRecord | undefined)?.track as LastFmRecord[] | LastFmRecord | undefined).map((item) => normalizeLastFmEntry('track', item)),
  })
}

async function handle(request: Request, env: Env) {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'

  if (path === '/health') {
    routeMethod(request, 'GET')
    return json({ ok: true, service: 'snoopy-home-sync' })
  }
  if (path === '/v1/auth/signup') return signUp(request, env)
  if (path === '/v1/auth/signin') return signIn(request, env)
  if (path === '/v1/auth/connect') return connect(request, env)
  if (path === '/v1/auth/session') return session(request, env)
  if (path === '/v1/state') return request.method === 'GET' ? getState(request, env) : putState(request, env)
  if (path === '/v1/photos/prune') return prunePhotos(request, env)
  if (path.startsWith('/v1/photos/')) return photo(request, env, path)
  if (path === '/v1/lastfm/dashboard') return lastFmDashboard(request, env, url)
  throw new ApiError(404, 'route not found.')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = allowedOrigin(request, env)
    if (origin === false) return json({ error: 'this site is not allowed to use the sync service.' }, 403)
    if (request.method === 'OPTIONS') {
      return withHeaders(new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Photo-Created-At, X-Photo-Name',
          'Access-Control-Max-Age': '86400',
        },
      }), origin)
    }

    try {
      return withHeaders(await handle(request, env), origin)
    } catch (error) {
      if (error instanceof ApiError) return withHeaders(json({ error: error.message }, error.status), origin)
      console.error(error)
      return withHeaders(json({ error: 'the sync service hit an unexpected error.' }, 500), origin)
    }
  },
} satisfies ExportedHandler<Env>
