/*
 * Eigenständige Jahresabschluss-Checklisten (Übersicht).
 * Getrennte Top-Level-Sammlung mit eigenem Cloud-Key – additiv, berührt weder
 * das clients-Schema noch die globalen Checklisten-Typen (spielbuch-checklisten-v1).
 * Jede Checkliste: { id, titel, mandantId, gewinnermittlung, status, jaChecklisteV2, erstelltAm, geaendertAm }
 */

export const CHECKLISTEN_UEBERSICHT_KEY = 'spielbuch-checklisten-uebersicht-v1'

export function loadChecklistenUebersicht() {
  try {
    const raw = localStorage.getItem(CHECKLISTEN_UEBERSICHT_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

export function saveChecklistenUebersicht(list) {
  try { localStorage.setItem(CHECKLISTEN_UEBERSICHT_KEY, JSON.stringify(list || [])) } catch {}
}

export function genChecklisteId() {
  return 'chk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
