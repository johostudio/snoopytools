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
const pendingRenderablePhotos = new Map<string, Promise<Blob>>()
let dngConversionQueue: Promise<unknown> = Promise.resolve()

const JPEG_START = [0xff, 0xd8, 0xff] as const
const JPEG_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3,
  0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb,
  0xcd, 0xce, 0xcf,
])

function isPossibleHeic(blob: Blob, name: string) {
  const type = blob.type.toLowerCase()
  return /\.(heic|heif)$/i.test(name)
    || type.includes('heic')
    || type.includes('heif')
    || !type
    || type === 'application/octet-stream'
}

function isPossibleDng(blob: Blob, name: string) {
  const type = blob.type.toLowerCase()
  return /\.dng$/i.test(name)
    || type.includes('dng')
    || type === 'image/x-adobe-dng'
}

function jpegName(name: string) {
  const base = name.replace(/\.(dng|heic|heif)$/i, '') || 'photo'
  return `${base}.jpg`
}

function jpegDimensions(bytes: Uint8Array, start: number) {
  let offset = start + 2
  while (offset + 8 < bytes.length) {
    while (bytes[offset] === 0xff) offset += 1
    const marker = bytes[offset]
    offset += 1
    if (marker === 0xda || marker === 0xd9) break
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue
    if (offset + 1 >= bytes.length) break
    const length = bytes[offset] * 256 + bytes[offset + 1]
    if (length < 2 || offset + length > bytes.length) break
    if (JPEG_FRAME_MARKERS.has(marker) && length >= 7) {
      return {
        height: bytes[offset + 3] * 256 + bytes[offset + 4],
        width: bytes[offset + 5] * 256 + bytes[offset + 6],
      }
    }
    offset += length
  }
  return null
}

function jpegEnd(bytes: Uint8Array, start: number) {
  for (let offset = start + 3; offset + 1 < bytes.length; offset += 1) {
    if (bytes[offset] === 0xff && bytes[offset + 1] === 0xd9) return offset + 2
  }
  return -1
}

async function extractDngPreviewNow(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bestStart = -1
  let bestPixels = 0

  for (let offset = 0; offset + 8 < bytes.length; offset += 1) {
    if (bytes[offset] !== JPEG_START[0]
      || bytes[offset + 1] !== JPEG_START[1]
      || bytes[offset + 2] !== JPEG_START[2]) continue
    const dimensions = jpegDimensions(bytes, offset)
    const pixels = dimensions ? dimensions.width * dimensions.height : 0
    if (pixels > bestPixels) {
      bestStart = offset
      bestPixels = pixels
    }
  }

  if (bestStart < 0) throw new Error('this raw photo does not contain a browser-compatible preview.')
  const end = jpegEnd(bytes, bestStart)
  if (end < 0) throw new Error('this raw photo preview is incomplete.')
  return blob.slice(bestStart, end, 'image/jpeg')
}

async function extractDngPreview(blob: Blob, name: string) {
  if (!isPossibleDng(blob, name)) return null
  const conversion = dngConversionQueue.then(() => extractDngPreviewNow(blob))
  dngConversionQueue = conversion.catch(() => undefined)
  return await conversion
}

async function convertHeic(blob: Blob, name: string) {
  if (!isPossibleHeic(blob, name)) return null
  const source = blob instanceof File ? blob : new File([blob], name, { type: blob.type })
  const { heicTo, isHeic } = await import('heic-to/csp')
  if (!(await isHeic(source))) return null
  return await heicTo({ blob: source, type: 'image/jpeg', quality: 0.9 })
}

async function compatiblePhotoFile(file: File) {
  const converted = await extractDngPreview(file, file.name) ?? await convertHeic(file, file.name)
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
  pendingRenderablePhotos.delete(photo.id)
  await runTransaction('readwrite', (store) => store.put(photo))
}

export async function renderablePhotoBlob(photo: StoredPhoto) {
  const cached = renderablePhotoCache.get(photo.id)
  if (cached) return cached
  const pending = pendingRenderablePhotos.get(photo.id)
  if (pending) return await pending

  const preparation = (async () => {
    const converted = await extractDngPreview(photo.blob, photo.name) ?? await convertHeic(photo.blob, photo.name)
    const blob = converted ?? photo.blob
    if (converted) {
      await runTransaction('readwrite', (store) => store.put({
        ...photo,
        blob: converted,
        name: jpegName(photo.name),
      }))
    }
    renderablePhotoCache.set(photo.id, blob)
    return blob
  })()
  pendingRenderablePhotos.set(photo.id, preparation)
  try {
    return await preparation
  } finally {
    pendingRenderablePhotos.delete(photo.id)
  }
}

export async function deletePhoto(id: string) {
  renderablePhotoCache.delete(id)
  pendingRenderablePhotos.delete(id)
  await runTransaction('readwrite', (store) => store.delete(id))
}
