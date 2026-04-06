// ── Checklisten-Typen (global, nicht mandantenbezogen) ─────────────────────
// Gespeichert in localStorage unter einem separaten Key

const KEY = 'spielbuch-checklisten-v1'

export function loadChecklistenTypen() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

export function saveChecklistenTypen(typen) {
  try {
    localStorage.setItem(KEY, JSON.stringify(typen))
  } catch { /* ignore */ }
}

export function genChecklistenId(prefix = 'ct') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}
