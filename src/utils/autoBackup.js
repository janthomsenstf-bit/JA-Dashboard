/**
 * autoBackup.js
 * Automatische Datensicherung in einen vom User gewählten Ordner.
 * Nutzt die File System Access API (Chrome/Edge) und IndexedDB für den
 * dauerhaften Handle-Speicher.
 */

const DB_NAME  = 'spielbuch-backup-settings'
const DB_VER   = 1
const STORE    = 'settings'
const KEY_DIR  = 'backupDirHandle'

// ── IndexedDB öffnen ──────────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE)
    req.onsuccess       = e => resolve(e.target.result)
    req.onerror         = ()  => reject(req.error)
  })
}

async function idbPut(key, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = resolve
    tx.onerror    = () => reject(tx.error)
  })
}

async function idbGet(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror   = () => reject(req.error)
  })
}

async function idbDel(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = resolve
    tx.onerror    = () => reject(tx.error)
  })
}

// ── Public: Ordner wählen ─────────────────────────────────────────────────────
export const isSupported = typeof window !== 'undefined' && !!window.showDirectoryPicker

export async function pickBackupDir() {
  if (!isSupported) throw new Error('Nicht unterstützt – bitte Chrome oder Edge verwenden.')
  const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'spielbuch-backup' })
  await idbPut(KEY_DIR, handle)
  return handle
}

export async function loadBackupDir() {
  return await idbGet(KEY_DIR)
}

export async function clearBackupDir() {
  await idbDel(KEY_DIR)
}

// ── Berechtigung prüfen / anfragen ────────────────────────────────────────────
export async function ensurePermission(dirHandle) {
  if (!dirHandle) return false
  let perm = await dirHandle.queryPermission({ mode: 'readwrite' })
  if (perm === 'granted') return true
  perm = await dirHandle.requestPermission({ mode: 'readwrite' })
  return perm === 'granted'
}

// ── Sicherung schreiben ───────────────────────────────────────────────────────
export async function writeBackup(dirHandle, clients) {
  const ok = await ensurePermission(dirHandle)
  if (!ok) throw new Error('Keine Schreibberechtigung für den gewählten Ordner.')

  const now      = new Date()
  const stamp    = now.toISOString().slice(0, 19).replace(/:/g, '-')
  const filename = `spielbuch-backup-${stamp}.json`
  const json     = JSON.stringify(clients, null, 2)

  const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
  const writable   = await fileHandle.createWritable()
  await writable.write(json)
  await writable.close()

  return filename
}

// ── Alte Backups aufräumen (nur die letzten N behalten) ───────────────────────
export async function pruneOldBackups(dirHandle, keepCount = 20) {
  try {
    const files = []
    for await (const [name] of dirHandle.entries()) {
      if (name.startsWith('spielbuch-backup-') && name.endsWith('.json')) {
        files.push(name)
      }
    }
    files.sort()
    const toDelete = files.slice(0, Math.max(0, files.length - keepCount))
    for (const name of toDelete) {
      await dirHandle.removeEntry(name)
    }
  } catch { /* ignore cleanup errors */ }
}
