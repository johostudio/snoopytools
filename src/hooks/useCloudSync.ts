import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { DEFAULT_PROFILE, migrateAppData, type AppData } from '../domain'
import {
  cachedCloudUser,
  clearCloudSession,
  cloudConfigured,
  cloudPhotoExists,
  connectAccount,
  downloadCloudPhoto,
  getCloudState,
  getSession,
  hasCloudSession,
  isUnauthorized,
  pruneCloudPhotos,
  saveCloudState,
  uploadCloudPhoto,
  type CloudUser,
} from '../lib/cloudApi'
import { getPhoto, putPhoto } from '../lib/photoStore'

export type CloudSyncStatus = 'local' | 'sign-in' | 'syncing' | 'synced' | 'offline' | 'error'
function photoIdsFor(data: AppData) {
  return [...new Set([
    data.preferences.profile.photoId,
    ...data.birthdays.map((birthday) => birthday.photoId).filter((id): id is string => Boolean(id)),
    ...data.concerts.flatMap((concert) => concert.photoIds),
  ].filter((id): id is string => Boolean(id)))]
}

function photoSignatureFor(data: AppData) {
  return photoIdsFor(data).sort().join('\u0000')
}

function hasPersonalData(data: AppData) {
  return data.birthdays.length > 0
    || data.concerts.length > 0
    || data.notes.length > 0
    || data.routines.length > 0
    || data.quickTodos.length > 0
    || data.trackers.length > 0
    || data.flightHistory.length > 0
    || Boolean(data.lastFm.username.trim())
    || Object.values(data.lastFm.picks).some((period) => Object.values(period).some((entries) => entries.length > 0))
    || Boolean(data.moment.label.trim())
    || data.focusFlight.status !== 'idle'
    || data.preferences.profile.displayName !== DEFAULT_PROFILE.displayName
    || data.preferences.profile.subtitle !== DEFAULT_PROFILE.subtitle
    || Boolean(data.preferences.profile.photoId)
}

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback
  return error.message.trim() || fallback
}

function isOfflineFailure(error: unknown) {
  if (!navigator.onLine) return true
  if (!(error instanceof TypeError)) return false
  return /fetch|network|internet|load failed/i.test(error.message)
}

export function useCloudSync(data: AppData, setData: Dispatch<SetStateAction<AppData>>) {
  const configured = cloudConfigured()
  const cachedUser = configured && hasCloudSession() ? cachedCloudUser() : null
  const [user, setUser] = useState<CloudUser | null>(cachedUser)
  const [checkingSession, setCheckingSession] = useState(configured && hasCloudSession())
  const [status, setStatus] = useState<CloudSyncStatus>(configured ? (hasCloudSession() ? 'syncing' : 'sign-in') : 'local')
  const [message, setMessage] = useState(configured ? 'opening your private cloud' : 'saved on this device')
  const [connectionRevision, setConnectionRevision] = useState(0)
  const dataRef = useRef(data)
  const applyingRemoteRef = useRef(false)
  const initializedUserRef = useRef<string | null>(null)
  const uploadedIdsRef = useRef(new Set<string>())
  const photoSignatureRef = useRef<string | null>(null)

  // Sync status intentionally mirrors external session and network state.
  // oxlint-disable react/set-state-in-effect
  useEffect(() => {
    dataRef.current = data
  }, [data])

  const resetAuthentication = useCallback(() => {
    clearCloudSession()
    setUser(null)
    setCheckingSession(false)
    initializedUserRef.current = null
    uploadedIdsRef.current.clear()
    photoSignatureRef.current = null
    setStatus('sign-in')
    setMessage('connect this device once more')
  }, [])

  const handleFailure = useCallback((error: unknown, fallback: string) => {
    if (isUnauthorized(error)) {
      resetAuthentication()
      return
    }
    const offline = isOfflineFailure(error)
    setStatus(offline ? 'offline' : 'error')
    setMessage(offline ? 'saved locally; waiting for a connection' : errorMessage(error, fallback))
  }, [resetAuthentication])

  useEffect(() => {
    if (!configured) {
      setCheckingSession(false)
      setStatus('local')
      setMessage('saved on this device')
      return
    }
    if (!hasCloudSession()) {
      setCheckingSession(false)
      setUser(null)
      setStatus('sign-in')
      setMessage('connect once; the account is created automatically if needed')
      return
    }
    if (!navigator.onLine) {
      setCheckingSession(false)
      setStatus('offline')
      setMessage('saved locally; waiting for a connection')
      return
    }

    let active = true
    setCheckingSession(true)
    setStatus('syncing')
    setMessage('opening your private cloud')
    void getSession().then((sessionUser) => {
      if (!active) return
      setUser(sessionUser)
      setCheckingSession(false)
    }).catch((error: unknown) => {
      if (!active) return
      setCheckingSession(false)
      handleFailure(error, 'cloud session could not be opened')
    })
    return () => {
      active = false
    }
  }, [configured, connectionRevision, handleFailure])
  // oxlint-enable react/set-state-in-effect

  const downloadMissingPhotos = useCallback(async (remote: AppData) => {
    for (const id of photoIdsFor(remote)) {
      if (await getPhoto(id)) continue
      const photo = await downloadCloudPhoto(id)
      if (!photo) continue
      await putPhoto({ id, ...photo })
    }
  }, [])

  const uploadLocalPhotos = useCallback(async (next: AppData) => {
    for (const id of photoIdsFor(next)) {
      if (uploadedIdsRef.current.has(id)) continue
      if (await cloudPhotoExists(id)) {
        uploadedIdsRef.current.add(id)
        continue
      }
      const photo = await getPhoto(id)
      if (!photo) continue
      await uploadCloudPhoto(id, photo)
      uploadedIdsRef.current.add(id)
    }
  }, [])

  const applyRemote = useCallback(async (remoteValue: unknown) => {
    const remote = migrateAppData(remoteValue)
    await downloadMissingPhotos(remote)
    applyingRemoteRef.current = true
    dataRef.current = remote
    photoSignatureRef.current = photoSignatureFor(remote)
    setData(remote)
    return remote
  }, [downloadMissingPhotos, setData])

  const pushCloudState = useCallback(async (next: AppData) => {
    const photoIds = photoIdsFor(next)
    const signature = photoSignatureFor(next)
    const photosChanged = signature !== photoSignatureRef.current
    if (photosChanged) await uploadLocalPhotos(next)
    const result = await saveCloudState(next)
    if (!result.accepted && result.state) {
      await applyRemote(result.state.data)
      return result
    }
    if (photosChanged) {
      await pruneCloudPhotos(photoIds)
      photoSignatureRef.current = signature
    }
    return result
  }, [applyRemote, uploadLocalPhotos])

  useEffect(() => {
    if (!configured || checkingSession || !user || !navigator.onLine || initializedUserRef.current === user.id) return
    let active = true
    const reconcile = async () => {
      setStatus('syncing')
      setMessage('checking the latest copy')
      try {
        const cloudState = await getCloudState()
        if (!active) return
        if (cloudState) {
          const remote = migrateAppData(cloudState.data)
          const linkedUser = window.localStorage.getItem('snoopytools:cloudflare-linked-user')
          const remoteIsNewer = Date.parse(remote.updatedAt) >= Date.parse(dataRef.current.updatedAt)
          const localHasPersonalData = hasPersonalData(dataRef.current)
          const remoteHasPersonalData = hasPersonalData(remote)
          const shouldPullRemote = linkedUser === user.id
            ? remoteIsNewer
            : remoteHasPersonalData && (!localHasPersonalData || remoteIsNewer)
          if (shouldPullRemote) await applyRemote(remote)
          else await pushCloudState(dataRef.current)
        } else {
          await pushCloudState(dataRef.current)
        }
        if (!active) return
        window.localStorage.setItem('snoopytools:cloudflare-linked-user', user.id)
        initializedUserRef.current = user.id
        setStatus('synced')
        setMessage('available here and on your other signed-in devices')
      } catch (error) {
        if (active) handleFailure(error, 'cloud sync could not start')
      }
    }
    void reconcile()
    return () => {
      active = false
    }
  }, [applyRemote, checkingSession, configured, handleFailure, pushCloudState, user])

  useEffect(() => {
    if (!user || checkingSession || initializedUserRef.current !== user.id) return
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false
      return
    }

    const timer = window.setTimeout(async () => {
      if (!navigator.onLine) {
        setStatus('offline')
        setMessage('saved locally; changes will upload when you reconnect')
        return
      }
      try {
        setStatus('syncing')
        await pushCloudState(data)
        setStatus('synced')
        setMessage('available here and on your other signed-in devices')
      } catch (error) {
        handleFailure(error, 'changes are safe locally but not uploaded yet')
      }
    }, 1_200)
    return () => window.clearTimeout(timer)
  }, [checkingSession, data, handleFailure, pushCloudState, user])

  useEffect(() => {
    if (!user || checkingSession || initializedUserRef.current !== user.id) return
    let active = true
    let pulling = false
    const pullLatest = async () => {
      if (!active || pulling || !navigator.onLine || document.visibilityState === 'hidden') return
      pulling = true
      try {
        const cloudState = await getCloudState()
        if (!active || !cloudState) return
        const remote = migrateAppData(cloudState.data)
        if (JSON.stringify(remote) === JSON.stringify(dataRef.current)) return
        if (Date.parse(remote.updatedAt) <= Date.parse(dataRef.current.updatedAt)) return
        await applyRemote(remote)
        if (!active) return
        setStatus('synced')
        setMessage('updated from another device')
      } catch (error) {
        if (active) handleFailure(error, 'cloud refresh could not finish')
      } finally {
        pulling = false
      }
    }
    const timer = window.setInterval(() => void pullLatest(), 15_000)
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void pullLatest()
    }
    window.addEventListener('focus', pullLatest)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', pullLatest)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [applyRemote, checkingSession, handleFailure, user])

  useEffect(() => {
    const handleOffline = () => {
      setStatus('offline')
      setMessage('saved locally; changes will upload when you reconnect')
    }
    const handleOnline = () => {
      initializedUserRef.current = null
      setStatus('syncing')
      setMessage('connection restored; checking the latest copy')
      setConnectionRevision((revision) => revision + 1)
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  const connectWithPassword = async (email: string, password: string) => {
    setStatus('syncing')
    setMessage('connecting this device')
    try {
      const nextUser = await connectAccount(email.trim().toLowerCase(), password)
      initializedUserRef.current = null
      setUser(nextUser)
      setCheckingSession(false)
      setConnectionRevision((revision) => revision + 1)
    } catch (error) {
      setStatus('error')
      setMessage(errorMessage(error, 'this device could not connect. check the email and password.'))
      throw error
    }
  }

  return {
    configured,
    status,
    message,
    email: user?.email,
    authenticated: Boolean(user && hasCloudSession()),
    connectWithPassword,
  }
}
