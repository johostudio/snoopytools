import { useAuthActions } from '@convex-dev/auth/react'
import { useConvex, useConvexAuth, useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { DEFAULT_PROFILE, migrateAppData, type AppData } from '../domain'
import { getPhoto, putPhoto } from '../lib/photoStore'

export type CloudSyncStatus = 'local' | 'sign-in' | 'syncing' | 'synced' | 'offline' | 'error'
export type AuthFlow = 'signIn' | 'signUp'

function photoIdsFor(data: AppData) {
  return [...new Set([
    data.preferences.profile.photoId,
    ...data.birthdays.map((birthday) => birthday.photoId).filter((id): id is string => Boolean(id)),
    ...data.concerts.flatMap((concert) => concert.photoIds),
  ].filter((id): id is string => Boolean(id)))]
}

function hasPersonalData(data: AppData) {
  return data.birthdays.length > 0
    || data.concerts.length > 0
    || data.notes.length > 0
    || data.routines.length > 0
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
  const message = error.message.replace(/^\[CONVEX[^\]]*\]\s*/i, '').trim()
  return message || fallback
}

export function useCloudSync(data: AppData, setData: Dispatch<SetStateAction<AppData>>) {
  const configured = Boolean(import.meta.env.VITE_CONVEX_URL?.trim())
  const convex = useConvex()
  const { isLoading, isAuthenticated } = useConvexAuth()
  const { signIn, signOut: endAuthSession } = useAuthActions()
  const currentUser = useQuery(api.sync.currentUser, isAuthenticated ? {} : 'skip')
  const cloudState = useQuery(api.sync.getState, isAuthenticated ? {} : 'skip')
  const saveState = useMutation(api.sync.saveState)
  const generatePhotoUploadUrl = useMutation(api.sync.generatePhotoUploadUrl)
  const saveCloudPhoto = useMutation(api.sync.savePhoto)
  const pruneCloudPhotos = useMutation(api.sync.prunePhotos)
  const [status, setStatus] = useState<CloudSyncStatus>('syncing')
  const [message, setMessage] = useState('opening your private cloud')
  const [connectionRevision, setConnectionRevision] = useState(0)
  const dataRef = useRef(data)
  const applyingRemoteRef = useRef(false)
  const initializedUserRef = useRef<string | null>(null)
  const uploadedIdsRef = useRef(new Set<string>())
  const userId = currentUser?.id

  useEffect(() => {
    dataRef.current = data
  }, [data])

  const downloadMissingPhotos = useCallback(async (remote: AppData) => {
    for (const id of photoIdsFor(remote)) {
      if (await getPhoto(id)) continue
      const photo = await convex.query(api.sync.getPhoto, { clientId: id })
      if (!photo?.url) continue
      const response = await fetch(photo.url)
      if (!response.ok) throw new Error(`photo ${id} could not be downloaded`)
      const blob = await response.blob()
      await putPhoto({
        id,
        blob,
        name: photo.name,
        createdAt: photo.createdAt,
      })
    }
  }, [convex])

  const uploadLocalPhotos = useCallback(async (next: AppData) => {
    for (const id of photoIdsFor(next)) {
      if (uploadedIdsRef.current.has(id)) continue
      const existing = await convex.query(api.sync.getPhoto, { clientId: id })
      if (existing) {
        uploadedIdsRef.current.add(id)
        continue
      }
      const photo = await getPhoto(id)
      if (!photo) continue
      const uploadUrl = await generatePhotoUploadUrl()
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': photo.blob.type || 'application/octet-stream' },
        body: photo.blob,
      })
      if (!response.ok) throw new Error(`photo ${id} could not be uploaded`)
      const { storageId } = await response.json() as { storageId: string }
      await saveCloudPhoto({
        clientId: id,
        storageId: storageId as Id<'_storage'>,
        name: photo.name,
        contentType: photo.blob.type || undefined,
        createdAt: photo.createdAt,
      })
      uploadedIdsRef.current.add(id)
    }
  }, [convex, generatePhotoUploadUrl, saveCloudPhoto])

  const pushCloudState = useCallback(async (next: AppData) => {
    const photoIds = photoIdsFor(next)
    await uploadLocalPhotos(next)
    await saveState({ data: next, updatedAt: next.updatedAt })
    await pruneCloudPhotos({ activeClientIds: photoIds })
  }, [pruneCloudPhotos, saveState, uploadLocalPhotos])

  // Sync status intentionally mirrors the external Convex auth/query state.
  // oxlint-disable react/set-state-in-effect
  useEffect(() => {
    if (!configured) {
      setStatus('local')
      setMessage('saved on this device')
      return
    }
    if (isLoading) {
      setStatus('syncing')
      setMessage('opening your private cloud')
      return
    }
    if (!isAuthenticated) {
      initializedUserRef.current = null
      uploadedIdsRef.current.clear()
      setStatus('sign-in')
      setMessage('create an account once, then use the same login on each device')
      return
    }
    if (!userId || cloudState === undefined) {
      setStatus(navigator.onLine ? 'syncing' : 'offline')
      setMessage(navigator.onLine ? 'checking the latest copy' : 'saved locally; waiting for a connection')
      return
    }

    let active = true
    const reconcile = async () => {
      if (!navigator.onLine) {
        setStatus('offline')
        setMessage('saved locally; waiting for a connection')
        return
      }
      try {
        if (initializedUserRef.current !== userId) {
          setStatus('syncing')
          setMessage('checking the latest copy')
          if (cloudState) {
            const remote = migrateAppData(cloudState.data)
            const linkedUser = window.localStorage.getItem('snoopytools:cloud-user')
            const remoteIsNewer = Date.parse(remote.updatedAt) >= Date.parse(dataRef.current.updatedAt)
            const localHasPersonalData = hasPersonalData(dataRef.current)
            const remoteHasPersonalData = hasPersonalData(remote)
            const shouldPullRemote = linkedUser === userId
              ? remoteIsNewer
              : remoteHasPersonalData && (!localHasPersonalData || remoteIsNewer)
            if (shouldPullRemote) {
              await downloadMissingPhotos(remote)
              if (!active) return
              applyingRemoteRef.current = true
              dataRef.current = remote
              setData(remote)
            } else {
              await pushCloudState(dataRef.current)
            }
          } else {
            await pushCloudState(dataRef.current)
          }
          if (!active) return
          window.localStorage.setItem('snoopytools:cloud-user', userId)
          initializedUserRef.current = userId
          setStatus('synced')
          setMessage('available here and on your other signed-in devices')
          return
        }

        if (!cloudState) return
        const remote = migrateAppData(cloudState.data)
        if (JSON.stringify(remote) === JSON.stringify(dataRef.current)) {
          setStatus('synced')
          setMessage('available here and on your other signed-in devices')
          return
        }
        if (Date.parse(remote.updatedAt) < Date.parse(dataRef.current.updatedAt)) return
        await downloadMissingPhotos(remote)
        if (!active) return
        applyingRemoteRef.current = true
        dataRef.current = remote
        setData(remote)
        setStatus('synced')
        setMessage('updated from another device')
      } catch (error) {
        if (!active) return
        setStatus(navigator.onLine ? 'error' : 'offline')
        setMessage(errorMessage(error, 'cloud sync could not start'))
      }
    }

    void reconcile()
    return () => {
      active = false
    }
  }, [cloudState, configured, connectionRevision, downloadMissingPhotos, isAuthenticated, isLoading, pushCloudState, setData, userId])
  // oxlint-enable react/set-state-in-effect

  useEffect(() => {
    if (!isAuthenticated || !userId || initializedUserRef.current !== userId) return
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
      setStatus('syncing')
      setMessage('saving changes')
      try {
        await pushCloudState(data)
        setStatus('synced')
        setMessage('available here and on your other signed-in devices')
      } catch (error) {
        setStatus(navigator.onLine ? 'error' : 'offline')
        setMessage(errorMessage(error, 'changes are safe locally but not uploaded yet'))
      }
    }, 900)
    return () => window.clearTimeout(timer)
  }, [data, isAuthenticated, pushCloudState, userId])

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

  const signInWithPassword = async (email: string, password: string, flow: AuthFlow) => {
    setStatus('syncing')
    setMessage(flow === 'signUp' ? 'creating your private account' : 'signing in')
    const form = new FormData()
    form.set('email', email.trim().toLowerCase())
    form.set('password', password)
    form.set('flow', flow)
    try {
      await signIn('password', form)
    } catch (error) {
      setStatus('error')
      setMessage(flow === 'signUp'
        ? 'account could not be created. check the email and try again.'
        : 'email or password did not match. first time here? choose create account.')
      throw error
    }
  }

  const prepareAuth = (flow: AuthFlow) => {
    setStatus('sign-in')
    setMessage(flow === 'signUp'
      ? 'create this account once, then use it on every device'
      : 'use the account you already created')
  }

  const signOut = async () => {
    await endAuthSession()
    initializedUserRef.current = null
    uploadedIdsRef.current.clear()
    setStatus('sign-in')
    setMessage('signed out; local data stays on this device')
  }

  return {
    configured,
    status,
    message,
    email: currentUser?.email ?? undefined,
    authenticated: isAuthenticated,
    signInWithPassword,
    prepareAuth,
    signOut,
  }
}
