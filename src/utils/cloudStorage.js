/**
 * cloudStorage.js
 * Drop-in Ersatz für localStorage – speichert in Supabase user_data.
 * Jeder localStorage-Key wird als eine Zeile (user_id + key + value JSONB) gespeichert.
 */
import { supabase } from './supabaseClient.js'

const SNAPSHOT_MAX = 30
const debounceTimers = new Map()

// ── Hilfsfunktion: aktuellen User holen ──────────────────────────────────────
async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ── Alle Keys für den aktuellen User laden ───────────────────────────────────
export async function cloudLoadAll() {
  const user = await getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('user_data')
    .select('key, value')
    .eq('user_id', user.id)
  if (error || !data) return null
  return Object.fromEntries(data.map(r => [r.key, r.value]))
}

// ── Einzelnen Key sofort speichern (kein Debounce) ───────────────────────────
export async function cloudSaveNow(key, value) {
  const user = await getUser()
  if (!user) return
  await supabase.from('user_data').upsert(
    { user_id: user.id, key, value, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,key' },
  )
}

// ── Einzelnen Key mit 1,5s Debounce speichern ────────────────────────────────
export function cloudSave(key, value) {
  if (debounceTimers.has(key)) clearTimeout(debounceTimers.get(key))
  debounceTimers.set(key, setTimeout(() => {
    cloudSaveNow(key, value).catch(e => console.error('[cloud] save error', e))
    debounceTimers.delete(key)
  }, 1500))
}

// ── Snapshot anlegen (max. 10 behalten) ──────────────────────────────────────
export async function cloudSnapshot(key, value) {
  const user = await getUser()
  if (!user) return
  await supabase.from('data_snapshots').insert({ user_id: user.id, key, value })
  // Alte löschen, wenn mehr als SNAPSHOT_MAX
  const { data } = await supabase
    .from('data_snapshots')
    .select('id')
    .eq('user_id', user.id)
    .eq('key', key)
    .order('created_at', { ascending: false })
  if (data && data.length > SNAPSHOT_MAX) {
    const ids = data.slice(SNAPSHOT_MAX).map(r => r.id)
    await supabase.from('data_snapshots').delete().in('id', ids)
  }
}

// ── Snapshots auflisten ───────────────────────────────────────────────────────
export async function cloudListSnapshots(key) {
  const user = await getUser()
  if (!user) return []
  const { data } = await supabase
    .from('data_snapshots')
    .select('id, created_at')
    .eq('user_id', user.id)
    .eq('key', key)
    .order('created_at', { ascending: false })
    .limit(SNAPSHOT_MAX)
  return data ?? []
}

// ── Snapshots inkl. Inhalt laden (für das Daten-Rettung-Panel) ───────────────
export async function cloudListSnapshotsWithValues(key) {
  const user = await getUser()
  if (!user) return []
  const { data } = await supabase
    .from('data_snapshots')
    .select('id, created_at, value')
    .eq('user_id', user.id)
    .eq('key', key)
    .order('created_at', { ascending: false })
    .limit(SNAPSHOT_MAX)
  return data ?? []
}

// ── Snapshot-Wert laden ───────────────────────────────────────────────────────
export async function cloudRestoreSnapshot(snapshotId) {
  const user = await getUser()
  if (!user) return null
  const { data } = await supabase
    .from('data_snapshots')
    .select('value')
    .eq('id', snapshotId)
    .eq('user_id', user.id)
    .single()
  return data?.value ?? null
}

// ── Alle lokalen localStorage-Keys in die Cloud migrieren ────────────────────
export async function migrateLocalStorageToCloud(keys) {
  const user = await getUser()
  if (!user) return
  const rows = []
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) continue
      const value = JSON.parse(raw)
      rows.push({ user_id: user.id, key, value, updated_at: new Date().toISOString() })
    } catch {}
  }
  if (rows.length === 0) return
  await supabase.from('user_data').upsert(rows, { onConflict: 'user_id,key' })
}
