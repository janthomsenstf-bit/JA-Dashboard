/**
 * sevdeskClient.js
 * Frontend-Wrapper für die sevDesk-Integration.
 *
 * Der API-Token liegt server-seitig (Env-Var SEVDESK_API_TOKEN) und wird
 * hier NIEMALS berührt. Das Frontend spricht ausschließlich mit dem Proxy
 * /api/sevdesk-api über callSevdesk(action, params).
 *
 * - callSevdesk(action, params) → sendet Anfrage an /api/sevdesk-api
 * - pingSevdesk()               → Verbindungstest (Token gültig? welches Konto?)
 */

/**
 * Ruft /api/sevdesk-api auf.
 * @param {string} action - Die gewünschte Aktion (z.B. 'ping')
 * @param {object} params - Weitere Parameter
 * @returns {Promise<object>} - Antwortdaten (bereits auf success geprüft)
 */
export async function callSevdesk(action, params = {}) {
  const res = await fetch('/api/sevdesk-api', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, ...params }),
  })

  // Antwort robust auswerten: nicht jede Fehlerantwort ist JSON (z. B. 404 mit
  // leerem Körper in einer rein lokalen Vorschau, wo die Server-Funktionen fehlen).
  const rohtext = await res.text()
  let data
  try {
    data = rohtext ? JSON.parse(rohtext) : {}
  } catch {
    if (res.status === 404) {
      throw new Error('Die sevDesk-Schnittstelle ist unter dieser Adresse nicht erreichbar. In einer rein lokalen Vorschau fehlen die Server-Funktionen – bitte die veröffentlichte (Preview-)Version verwenden.')
    }
    throw new Error(`Unerwartete Antwort der sevDesk-Schnittstelle (HTTP ${res.status}).`)
  }
  if (res.status === 404 && !rohtext) {
    throw new Error('Die sevDesk-Schnittstelle ist unter dieser Adresse nicht erreichbar. In einer rein lokalen Vorschau fehlen die Server-Funktionen – bitte die veröffentlichte (Preview-)Version verwenden.')
  }

  if (data.needsSetup) {
    throw Object.assign(
      new Error(data.error ?? 'sevDesk ist auf dem Server noch nicht eingerichtet (SEVDESK_API_TOKEN fehlt).'),
      { needsSetup: true }
    )
  }

  if (!data.success) {
    throw new Error(data.error ?? (res.ok ? 'Unbekannter Fehler' : `Unbekannter Fehler (HTTP ${res.status}).`))
  }

  return data
}

/**
 * Verbindungstest: prüft, ob der server-seitige Token gültig ist.
 * @returns {Promise<{connected: boolean, user: object|null}>}
 */
export async function pingSevdesk() {
  return callSevdesk('ping')
}
