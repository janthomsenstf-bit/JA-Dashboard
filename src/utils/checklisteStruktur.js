// ── Verwaltung der benutzerdefinierten Checklisten-Struktur ──────────────────
// Die Struktur (Blöcke + Prüfpunkte) kann global angepasst werden.
// Gespeichert in localStorage, unabhängig von Mandantendaten.

import { CHECKLISTE_BLOCKS } from './checklisteConfig.js'

const STORAGE_KEY = 'checkliste-struktur-v1'

export function loadStruktur() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return null
}

export function saveStruktur(struktur) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(struktur))
}

export function getEffectiveStruktur() {
  return loadStruktur() ?? JSON.parse(JSON.stringify(CHECKLISTE_BLOCKS))
}

export function resetStruktur() {
  localStorage.removeItem(STORAGE_KEY)
}

// Neue Block-ID generieren
export function genBlockId() {
  return 'custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

// Neue Punkt-ID generieren
export function genPunktId() {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

// Prüft ob ein Block von System-Konfiguration stammt
export function isSystemBlock(block) {
  return !block.isCustom
}
