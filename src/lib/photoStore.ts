const DATABASE_NAME = 'snoopytools-media'
const STORE_NAME = 'photos'
const DATABASE_VERSION = 1

export interface StoredPhoto {
  id: string
  blob: Blob
  name: string
  createdAt: string
}

let databasePromise: Promise<IDBDatabase> | null = null

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  return databasePromise
}

async function runTransaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const request = action(transaction.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.onerror = () => reject(transaction.error)
  })
}

export async function savePhoto(file: File) {
  const photo: StoredPhoto = {
    id: crypto.randomUUID(),
    blob: file,
    name: file.name,
    createdAt: new Date().toISOString(),
  }
  await runTransaction('readwrite', (store) => store.put(photo))
  return photo.id
}

export async function getPhoto(id: string) {
  return runTransaction<StoredPhoto | undefined>('readonly', (store) => store.get(id))
}

export async function putPhoto(photo: StoredPhoto) {
  await runTransaction('readwrite', (store) => store.put(photo))
}

export async function deletePhoto(id: string) {
  await runTransaction('readwrite', (store) => store.delete(id))
}
