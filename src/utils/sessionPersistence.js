/**
 * sessionPersistence.js – Speichert den Navigations-Zustand des Dashboards
 *
 * Beim Minimieren, Tab-Wechsel oder Browser-Neustart wird der letzte
 * Arbeitsstand wiederhergestellt: Mandant, Tab, geöffneter Auftrag.
 *
 * Nutzt localStorage (überlebt Tab-Schließen + Browser-Restart).
 */

const SESSION_KEY = 'sda-session-state'

/**
 * Zustand speichern (leichtgewichtig, wird bei jeder Navigation aufgerufen)
 */
export function saveSessionState(state) {
  try {
    const payload = {
      selectedId:      state.selectedId      ?? null,
      detailInitialTab: state.detailInitialTab ?? 0,
      activeTab:       state.activeTab        ?? null,   // Tab innerhalb DetailView
      expandedAuftragId: state.expandedAuftragId ?? null,
      savedAt:         Date.now(),
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload))
  } catch { /* quota / privacy → ignorieren */ }
}

/**
 * Zustand laden – gibt null zurück wenn nichts vorhanden oder >24h alt
 */
export function loadSessionState() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const state = JSON.parse(raw)
    // Maximal 24 Stunden alten Zustand wiederherstellen
    if (Date.now() - (state.savedAt ?? 0) > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return state
  } catch {
    return null
  }
}

/**
 * Zustand löschen (z.B. bei Logout)
 */
export function clearSessionState() {
  try { localStorage.removeItem(SESSION_KEY) } catch {}
}

// ── JA-Compose Draft Persistenz ──────────────────────────────────────────────

const JA_DRAFT_PREFIX = 'sda-ja-draft_'

export function saveJAComposeDraft(clientId, auftragId, draft) {
  try {
    const key = `${JA_DRAFT_PREFIX}${clientId}_${auftragId}`
    localStorage.setItem(key, JSON.stringify({ ...draft, savedAt: Date.now() }))
  } catch {}
}

export function loadJAComposeDraft(clientId, auftragId) {
  try {
    const key = `${JA_DRAFT_PREFIX}${clientId}_${auftragId}`
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const draft = JSON.parse(raw)
    // Maximal 7 Tage alten Entwurf wiederherstellen
    if (Date.now() - (draft.savedAt ?? 0) > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(key)
      return null
    }
    return draft
  } catch {
    return null
  }
}

export function clearJAComposeDraft(clientId, auftragId) {
  try {
    localStorage.removeItem(`${JA_DRAFT_PREFIX}${clientId}_${auftragId}`)
  } catch {}
}

// ── Notiz-Diktat Draft Persistenz ────────────────────────────────────────────

const NOTIZ_DRAFT_PREFIX = 'sda-notiz-draft_'

export function saveNotizDraft(clientId, auftragId, text) {
  try {
    if (!text?.trim()) {
      localStorage.removeItem(`${NOTIZ_DRAFT_PREFIX}${clientId}_${auftragId}`)
      return
    }
    localStorage.setItem(`${NOTIZ_DRAFT_PREFIX}${clientId}_${auftragId}`, JSON.stringify({
      text, savedAt: Date.now(),
    }))
  } catch {}
}

export function loadNotizDraft(clientId, auftragId) {
  try {
    const raw = localStorage.getItem(`${NOTIZ_DRAFT_PREFIX}${clientId}_${auftragId}`)
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (Date.now() - (draft.savedAt ?? 0) > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(`${NOTIZ_DRAFT_PREFIX}${clientId}_${auftragId}`)
      return null
    }
    return draft.text ?? null
  } catch {
    return null
  }
}

export function clearNotizDraft(clientId, auftragId) {
  try { localStorage.removeItem(`${NOTIZ_DRAFT_PREFIX}${clientId}_${auftragId}`) } catch {}
}
