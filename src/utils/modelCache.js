const DB_NAME = 'glb-model-cache'
const STORE_NAME = 'models'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGet(db, key) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getCachedModelUrl(originalUrl) {
  try {
    const db = await openDB()
    const cached = await idbGet(db, originalUrl)
    if (cached) {
      return URL.createObjectURL(new Blob([cached], { type: 'model/gltf-binary' }))
    }

    const res = await fetch(originalUrl)
    const buffer = await res.arrayBuffer()
    await idbPut(db, originalUrl, buffer)

    return URL.createObjectURL(new Blob([buffer], { type: 'model/gltf-binary' }))
  } catch (e) {
    console.warn('Model cache failed, using network:', e)
    return originalUrl
  }
}
