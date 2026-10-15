import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

export function usePersistentState<T>(
  key: string,
  createDefault: () => T,
  migrate: (value: unknown) => T = (value) => value as T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored ? migrate(JSON.parse(stored)) : createDefault()
    } catch {
      return createDefault()
    }
  })
  const channelRef = useRef<BroadcastChannel | null>(null)
  const serializedRef = useRef(JSON.stringify(value))
  const valueRef = useRef(value)
  const dirtyRef = useRef(true)
  const flushRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return

      try {
        const current = valueRef.current
        const serialized = JSON.stringify(current)
        if (serialized !== serializedRef.current || window.localStorage.getItem(key) !== serialized) {
          window.localStorage.setItem(key, serialized)
          serializedRef.current = serialized
          channelRef.current?.postMessage(current)
        }
        dirtyRef.current = false
      } catch {
        // Keep the in-memory copy. A later edit or page-hide event will retry.
      }
    }

    flushRef.current = flush
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      flush()
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [key])

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return
    const channel = new BroadcastChannel(key)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<unknown>) => {
      try {
        const migrated = migrate(event.data)
        const next = JSON.stringify(migrated)
        if (next !== serializedRef.current) {
          serializedRef.current = next
          valueRef.current = migrated
          dirtyRef.current = false
          setValue(migrated)
        }
      } catch {
        // Ignore malformed state from another tab and keep the valid local copy.
      }
    }
    return () => {
      if (channelRef.current === channel) channelRef.current = null
      channel.close()
    }
  }, [key, migrate])

  useEffect(() => {
    valueRef.current = value
    dirtyRef.current = true
    const timer = window.setTimeout(() => flushRef.current(), 240)
    return () => window.clearTimeout(timer)
  }, [key, value])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue || event.newValue === serializedRef.current) return
      try {
        const migrated = migrate(JSON.parse(event.newValue))
        serializedRef.current = event.newValue
        valueRef.current = migrated
        dirtyRef.current = false
        setValue(migrated)
      } catch {
        // Ignore malformed state from another tab and keep the valid local copy.
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [key, migrate])

  return [value, setValue]
}
