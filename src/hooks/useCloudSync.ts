import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { Session } from '@supabase/supabase-js'
import { migrateAppData, type AppData } from '../domain'
import { getPhoto, putPhoto } from '../lib/photoStore'
import { cloudConfigured, PHOTO_BUCKET, supabase } from '../lib/supabase'

export type CloudSyncStatus = 'local' | 'sign-in' | 'syncing' | 'synced' | 'offline' | 'error'

interface CloudStateRow {
  data: unknown
  updated_at: string
}

function photoIdsFor(data: AppData) {
  return [...new Set([
    ...data.birthdays.map((birthday) => birthday.photoId).filter((id): id is string => Boolean(id)),
    ...data.concerts.flatMap((concert) => concert.photoIds),
  ])]
}

function hasPersonalData(data: AppData) {
  return data.birthdays.length > 0
    || data.concerts.length > 0
    || data.notes.length > 0
    || data.routines.length > 0
    || data.trackers.length > 0
    || data.flightHistory.length > 0
    || Boolean(data.moment.label.trim())
    || data.focusFlight.status !== 'idle'
}

async function downloadMissingPhotos(data: AppData, userId: string) {
  if (!supabase) return
  for (const id of photoIdsFor(data)) {
    if (await getPhoto(id)) continue
    const { data: blob, error } = await supabase.storage.from(PHOTO_BUCKET).download(`${userId}/${id}`)
    if (error) throw error
    if (!blob) throw new Error(`photo ${id} could not be downloaded`)
    await putPhoto({ id, blob, name: id, createdAt: new Date().toISOString() })
  }
}

async function uploadLocalPhotos(data: AppData, userId: string, uploadedIds: Set<string>) {
  if (!supabase) return
  for (const id of photoIdsFor(data)) {
    if (uploadedIds.has(id)) continue
    const photo = await getPhoto(id)
    if (!photo) continue
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(`${userId}/${id}`, photo.blob, {
      contentType: photo.blob.type || undefined,
      cacheControl: '31536000',
      upsert: true,
    })
    if (error) throw error
    uploadedIds.add(id)
  }
}

async function pushCloudState(data: AppData, userId: string, uploadedIds: Set<string>) {
  if (!supabase) return
  await uploadLocalPhotos(data, userId, uploadedIds)
  const { error } = await supabase.from('app_state').upsert({
    user_id: userId,
    data,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) throw error
}

export function useCloudSync(data: AppData, setData: Dispatch<SetStateAction<AppData>>) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<CloudSyncStatus>(cloudConfigured ? 'sign-in' : 'local')
  const [message, setMessage] = useState(cloudConfigured ? '' : 'add supabase keys to enable cross-device sync')
  const [connectionRevision, setConnectionRevision] = useState(0)
  const dataRef = useRef(data)
  const applyingRemoteRef = useRef(false)
  const initializedUserRef = useRef<string | null>(null)
  const uploadedIdsRef = useRef(new Set<string>())
  const sessionUserId = session?.user.id

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data: result }) => {
      if (active) setSession(result.session)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      if (!nextSession) {
        setStatus('sign-in')
        setMessage('sign in once to keep every device together')
      }
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const client = supabase
    if (!client) return
    if (!sessionUserId) {
      initializedUserRef.current = null
      uploadedIdsRef.current.clear()
      return
    }

    let active = true
    let channel: ReturnType<typeof client.channel> | undefined

    const applyRemote = async (row: CloudStateRow) => {
      const remote = migrateAppData(row.data)
      if (JSON.stringify(remote) === JSON.stringify(dataRef.current)) return
      await downloadMissingPhotos(remote, sessionUserId)
      if (!active) return
      applyingRemoteRef.current = true
      dataRef.current = remote
      setData(remote)
    }

    const initialise = async () => {
      setStatus(navigator.onLine ? 'syncing' : 'offline')
      setMessage(navigator.onLine ? 'checking the latest copy' : 'saved locally; waiting for a connection')
      if (!navigator.onLine) return

      try {
        const { data: row, error } = await client
          .from('app_state')
          .select('data, updated_at')
          .eq('user_id', sessionUserId)
          .maybeSingle()
        if (error) throw error

        const linkedUser = window.localStorage.getItem('snoopytools:cloud-user')
        if (row) {
          const remote = migrateAppData((row as CloudStateRow).data)
          const remoteIsNewer = Date.parse(remote.updatedAt) >= Date.parse(dataRef.current.updatedAt)
          const localHasPersonalData = hasPersonalData(dataRef.current)
          const remoteHasPersonalData = hasPersonalData(remote)
          const shouldPullRemote = linkedUser === sessionUserId
            ? remoteIsNewer
            : remoteHasPersonalData && (!localHasPersonalData || remoteIsNewer)
          if (shouldPullRemote) await applyRemote(row as CloudStateRow)
          else await pushCloudState(dataRef.current, sessionUserId, uploadedIdsRef.current)
        } else {
          await pushCloudState(dataRef.current, sessionUserId, uploadedIdsRef.current)
        }

        if (!active) return
        window.localStorage.setItem('snoopytools:cloud-user', sessionUserId)
        initializedUserRef.current = sessionUserId
        setStatus('synced')
        setMessage('available here and on your other signed-in devices')

        channel = client
          .channel(`app-state:${sessionUserId}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'app_state',
            filter: `user_id=eq.${sessionUserId}`,
          }, async (payload) => {
            const row = payload.new as unknown as CloudStateRow
            if (!row?.data) return
            try {
              await applyRemote(row)
              if (active) {
                setStatus('synced')
                setMessage('updated from another device')
              }
            } catch (error) {
              if (active) {
                setStatus('error')
                setMessage(error instanceof Error ? error.message : 'could not apply the cloud update')
              }
            }
          })
          .subscribe()
      } catch (error) {
        if (!active) return
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'cloud sync could not start')
      }
    }

    void initialise()
    return () => {
      active = false
      if (channel) void client.removeChannel(channel)
    }
  }, [connectionRevision, sessionUserId, setData])

  useEffect(() => {
    const userId = session?.user.id
    if (!supabase || !userId || initializedUserRef.current !== userId) return
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
        await pushCloudState(data, userId, uploadedIdsRef.current)
        setStatus('synced')
        setMessage('available here and on your other signed-in devices')
      } catch (error) {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'changes are safe locally but not uploaded yet')
      }
    }, 900)
    return () => window.clearTimeout(timer)
  }, [data, session?.user.id])

  useEffect(() => {
    const handleOffline = () => {
      setStatus('offline')
      setMessage('saved locally; changes will upload when you reconnect')
    }
    const handleOnline = () => {
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

  const signInWithApple = async () => {
    if (!supabase) return
    setStatus('syncing')
    setMessage('opening apple sign in')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setStatus('error')
      setMessage(error.message)
    }
  }

  const sendMagicLink = async (email: string) => {
    if (!supabase) return
    setStatus('syncing')
    setMessage('sending a private sign-in link')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }
    setStatus('sign-in')
    setMessage('check your email, then open the link on this device')
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    initializedUserRef.current = null
    setStatus('sign-in')
    setMessage('signed out; local data stays on this device')
  }

  return {
    configured: cloudConfigured,
    status,
    message,
    email: session?.user.email,
    signInWithApple,
    sendMagicLink,
    signOut,
  }
}
