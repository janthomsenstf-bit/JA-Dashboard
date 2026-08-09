/**
 * dokProtokoll.js – Verarbeitungsprotokoll je Datei-ID (Stufe 6)
 *
 * Hält fest, welche Eingangsdatei bereits abgelegt und/oder deren Mandant
 * benachrichtigt wurde – damit KEIN Dokument versehentlich doppelt verarbeitet
 * wird (feste Regel 9). Persistenz in localStorage.
 *
 * Datenschutz (feste Regel 9): es werden KEINE Mandantendaten im Klartext
 * gespeichert – nur die OneDrive-itemId, interne clientId, Flags und Zeitstempel.
 *
 * Der Kern (markiere/eintrag/statusText) ist pur und Node-testbar; nur laden/
 * speichern greifen auf localStorage zu.
 */

const KEY = 'sda-postservice-protokoll'

export function ladeProtokoll() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') } catch { return {} }
}

export function speichereProtokoll(protokoll) {
  try { localStorage.setItem(KEY, JSON.stringify(protokoll)) } catch { /* Speicher voll/gesperrt – ignorieren */ }
}

/**
 * Markiert eine itemId im Protokoll (merge). Vorhandene Flags bleiben erhalten,
 * z. B. wird aus „abgelegt" durch späteres Senden „abgelegt + gesendet".
 * @param {object} protokoll
 * @param {string} itemId
 * @param {{ abgelegt?, gesendet?, ts?, clientId? }} patch
 * @returns {object} neues Protokoll-Objekt
 */
export function markiere(protokoll, itemId, patch = {}) {
  if (!itemId) return protokoll
  const alt = protokoll[itemId] ?? {}
  return {
    ...protokoll,
    [itemId]: {
      ...alt,
      ...patch,
      abgelegt: alt.abgelegt || patch.abgelegt || false,
      gesendet: alt.gesendet || patch.gesendet || false,
    },
  }
}

/** Protokolleintrag zu einer itemId oder null. */
export function eintrag(protokoll, itemId) {
  return protokoll?.[itemId] ?? null
}

/** Lesbarer Status-Text für einen Eintrag (oder '' wenn keiner). */
export function statusText(info) {
  if (!info) return ''
  const teile = []
  if (info.abgelegt) teile.push('abgelegt')
  if (info.gesendet) teile.push('gesendet')
  if (teile.length === 0) return ''
  let wann = ''
  if (info.ts) {
    const d = new Date(info.ts)
    if (!isNaN(d)) wann = ` am ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
  }
  const s = teile.join(' + ')
  return s.charAt(0).toUpperCase() + s.slice(1) + wann
}
