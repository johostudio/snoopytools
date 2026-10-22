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
const renderablePhotoCache = new Map<string, Blob>()

function isPossibleHeic(blob: Blob, name: string) {
  const type = blob.type.toLowerCase()
  return /\.(heic|heif)$/i.test(name)
    || type.includes('heic')
    || type.includes('heif')
    || !type
    || type === 'application/octet-stream'
}

function jpegName(name: string) {
  const base = name.replace(/\.(heic|heif)$/i, '') || 'photo'
  return `${base}.jpg`
}

async function convertHeic(blob: Blob, name: string) {
  if (!isPossibleHeic(blob, name)) return null
  const source = blob instanceof File ? blob : new File([blob], name, { type: blob.type })
  const { heicTo, isHeic } = await import('heic-to/csp')
  if (!(await isHeic(source))) return null
  return await heicTo({ blob: source, type: 'image/jpeg', quality: 0.9 })
}

async function compatiblePhotoFile(file: File) {
  const converted = await convertHeic(file, file.name)
  if (!converted) return file
  return new File([converted], jpegName(file.name), {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  })
}

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
  const compatibleFile = await compatiblePhotoFile(file)
  const photo: StoredPhoto = {
    id: crypto.randomUUID(),
    blob: compatibleFile,
    name: compatibleFile.name,
    createdAt: new Date().toISOString(),
  }
  await runTransaction('readwrite', (store) => store.put(photo))
  return photo.id
}

export async function getPhoto(id: string) {
  return runTransaction<StoredPhoto | undefined>('readonly', (store) => store.get(id))
}

export async function putPhoto(photo: StoredPhoto) {
  renderablePhotoCache.delete(photo.id)
  await runTransaction('readwrite', (store) => store.put(photo))
}

export async function renderablePhotoBlob(photo: StoredPhoto) {
  const cached = renderablePhotoCache.get(photo.id)
  if (cached) return cached
  const converted = await convertHeic(photo.blob, photo.name)
  const blob = converted ?? photo.blob
  if (converted) renderablePhotoCache.set(photo.id, converted)
  return blob
}

export async function deletePhoto(id: string) {
  renderablePhotoCache.delete(id)
  await runTransaction('readwrite', (store) => store.delete(id))
}
