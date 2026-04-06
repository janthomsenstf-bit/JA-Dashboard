const VORLAGEN_KEY = 'spielbuch-vorlagen-v1'

export function loadVorlagen() {
  try {
    const raw = localStorage.getItem(VORLAGEN_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveVorlagen(vorlagen) {
  try {
    localStorage.setItem(VORLAGEN_KEY, JSON.stringify(vorlagen))
  } catch { /* ignore */ }
}

export function genVorlagenId() {
  return 'vrl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}
