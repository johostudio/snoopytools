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

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return
    const channel = new BroadcastChannel(key)
    channelRef.current = channel
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const migrated = migrate(event.data)
      const next = JSON.stringify(migrated)
      if (next !== serializedRef.current) {
        serializedRef.current = next
        setValue(migrated)
      }
    }
    return () => channel.close()
  }, [key, migrate])

  useEffect(() => {
    const serialized = JSON.stringify(value)
    if (serialized === serializedRef.current && window.localStorage.getItem(key) === serialized) return
    serializedRef.current = serialized
    window.localStorage.setItem(key, serialized)
    channelRef.current?.postMessage(value)
  }, [key, value])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key || !event.newValue || event.newValue === serializedRef.current) return
      try {
        serializedRef.current = event.newValue
        setValue(migrate(JSON.parse(event.newValue)))
      } catch {
        // Ignore malformed state from another tab and keep the valid local copy.
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [key, migrate])

  return [value, setValue]
}
