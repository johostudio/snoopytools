import type { AppData, LastFmSnapshot, ListeningPeriod } from '../domain'

const TOKEN_KEY = 'snoopytools:cloudflare-token:v1'
const USER_KEY = 'snoopytools:cloudflare-user:v1'
const configuredUrl = import.meta.env.VITE_SYNC_API_URL?.trim().replace(/\/+$/, '') ?? ''

export interface CloudUser {
  id: string
  email: string
}

export interface CloudState {
  data: unknown
  updatedAt: string
}

interface SessionResponse {
  token: string
  user: CloudUser
}

interface StateResponse {
  state: CloudState | null
}

interface SaveStateResponse extends StateResponse {
  accepted: boolean
}

export class CloudApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function cloudConfigured() {
  return Boolean(configuredUrl)
}

export function hasCloudSession() {
  return Boolean(window.localStorage.getItem(TOKEN_KEY))
}

export function cachedCloudUser(): CloudUser | null {
  try {
    const value = window.localStorage.getItem(USER_KEY)
    if (!value) return null
    const user = JSON.parse(value) as Partial<CloudUser>
    return typeof user.id === 'string' && typeof user.email === 'string' ? { id: user.id, email: user.email } : null
  } catch {
    return null
  }
}

export function clearCloudSession() {
  window.localStorage.removeItem(TOKEN_KEY)
  window.localStorage.removeItem(USER_KEY)
}

function storeSession(session: SessionResponse) {
  window.localStorage.setItem(TOKEN_KEY, session.token)
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user))
}

async function preserveDeviceStorage() {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // The saved session still works when persistent-storage requests are unsupported.
  }
}

function apiUrl(path: string) {
  if (!configuredUrl) throw new CloudApiError(503, 'cloud sync is not configured yet.')
  return `${configuredUrl}${path}`
}

async function errorFrom(response: Response) {
  try {
    const body = await response.json() as { error?: unknown }
    if (typeof body.error === 'string' && body.error.trim()) return body.error
  } catch {
    // Use the HTTP fallback below when an upstream response is not JSON.
  }
  return `cloud sync returned ${response.status}.`
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const token = window.localStorage.getItem(TOKEN_KEY)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(apiUrl(path), { ...init, headers })
  return response
}

async function jsonRequest<T>(path: string, init: RequestInit = {}) {
  const response = await apiFetch(path, init)
  if (!response.ok) throw new CloudApiError(response.status, await errorFrom(response))
  return await response.json() as T
}

export async function connectAccount(email: string, password: string) {
  const session = await jsonRequest<SessionResponse>('/v1/auth/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  storeSession(session)
  void preserveDeviceStorage()
  return session.user
}

export async function getSession() {
  const response = await jsonRequest<{ user: CloudUser }>('/v1/auth/session')
  window.localStorage.setItem(USER_KEY, JSON.stringify(response.user))
  return response.user
}

export async function getCloudState() {
  return (await jsonRequest<StateResponse>('/v1/state')).state
}

export async function saveCloudState(data: AppData): Promise<SaveStateResponse> {
  const response = await apiFetch('/v1/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, updatedAt: data.updatedAt }),
  })
  if (response.status === 409) return await response.json() as SaveStateResponse
  if (!response.ok) throw new CloudApiError(response.status, await errorFrom(response))
  return await response.json() as SaveStateResponse
}

function photoPath(clientId: string) {
  return `/v1/photos/${encodeURIComponent(clientId)}`
}

export async function cloudPhotoExists(clientId: string) {
  const response = await apiFetch(photoPath(clientId), { method: 'HEAD' })
  if (response.status === 404) return false
  if (!response.ok) throw new CloudApiError(response.status, await errorFrom(response))
  return true
}

export async function downloadCloudPhoto(clientId: string) {
  const response = await apiFetch(photoPath(clientId))
  if (response.status === 404) return null
  if (!response.ok) throw new CloudApiError(response.status, await errorFrom(response))
  const encodedName = response.headers.get('X-Photo-Name') ?? 'photo'
  let name = 'photo'
  try {
    name = decodeURIComponent(encodedName)
  } catch {
    name = 'photo'
  }
  return {
    blob: await response.blob(),
    name,
    createdAt: response.headers.get('X-Photo-Created-At') ?? new Date().toISOString(),
  }
}

export async function uploadCloudPhoto(clientId: string, photo: { blob: Blob; name: string; createdAt: string }) {
  const response = await apiFetch(photoPath(clientId), {
    method: 'PUT',
    headers: {
      'Content-Type': photo.blob.type || 'application/octet-stream',
      'X-Photo-Name': encodeURIComponent(photo.name),
      'X-Photo-Created-At': photo.createdAt,
    },
    body: photo.blob,
  })
  if (!response.ok) throw new CloudApiError(response.status, await errorFrom(response))
}

export async function pruneCloudPhotos(activeClientIds: string[]) {
  let remaining = true
  let passes = 0
  while (remaining && passes < 20) {
    const result = await jsonRequest<{ deleted: number; remaining: boolean }>('/v1/photos/prune', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeClientIds }),
    })
    remaining = result.remaining
    passes += 1
  }
}

export async function getLastFmDashboard(username: string, period: ListeningPeriod) {
  const params = new URLSearchParams({ username, period })
  return await jsonRequest<LastFmSnapshot>(`/v1/lastfm/dashboard?${params}`)
}

export function isUnauthorized(error: unknown) {
  return error instanceof CloudApiError && error.status === 401
}
