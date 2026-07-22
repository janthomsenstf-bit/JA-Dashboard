/**
 * onedriveClient.js
 * Frontend-Wrapper für die OneDrive-Integration.
 *
 * - openAuthPopup()        → öffnet OAuth-Popup, wartet auf postMessage
 * - callApi(action, params, tokens, onTokenRefresh) → sendet Anfrage an /api/onedrive-api
 * - getMandantPath(client) → gibt Ordnerpfad für einen Mandanten zurück
 */

const POPUP_WIDTH  = 520
const POPUP_HEIGHT = 640

/**
 * Öffnet den Microsoft OAuth-Login-Popup.
 * Gibt die Tokens zurück wenn erfolgreich, wirft einen Fehler wenn nicht.
 */
export function openAuthPopup(authUrl = '/api/onedrive-callback') {
  return new Promise((resolve, reject) => {
    const left = Math.round(window.screenX + (window.outerWidth  - POPUP_WIDTH)  / 2)
    const top  = Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2)

    const popup = window.open(
      authUrl,
      'onedrive-auth',
      `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},toolbar=no,menubar=no,location=no`
    )

    if (!popup) {
      reject(new Error('Popup konnte nicht geöffnet werden. Bitte Popup-Blocker deaktivieren.'))
      return
    }

    let done = false

    function onMessage(event) {
      if (event.data?.type !== 'onedrive-auth') return
      done = true
      cleanup()
      if (event.data.success && event.data.tokens) {
        resolve(event.data.tokens)
      } else {
        reject(new Error(event.data.error_description ?? event.data.error ?? 'Anmeldung fehlgeschlagen'))
      }
    }

    // Fallback: Popup wurde manuell geschlossen
    const checkClosed = setInterval(() => {
      if (popup.closed && !done) {
        done = true
        cleanup()
        reject(new Error('Anmeldung abgebrochen'))
      }
    }, 500)

    function cleanup() {
      window.removeEventListener('message', onMessage)
      clearInterval(checkClosed)
    }

    window.addEventListener('message', onMessage)

    // Timeout nach 5 Minuten
    setTimeout(() => {
      if (!done) {
        done = true
        cleanup()
        try { popup.close() } catch {}
        reject(new Error('Timeout: Anmeldung nicht abgeschlossen'))
      }
    }, 5 * 60 * 1000)
  })
}

/**
 * Ruft /api/onedrive-api auf.
 * @param {string}   action       - Die gewünschte Aktion
 * @param {object}   params       - Weitere Parameter
 * @param {object}   tokens       - Aktuelle Tokens
 * @param {function} onTokenRefresh - Callback wenn Tokens refreshed wurden: (newTokens) => void
 * @returns {Promise<object>}     - Antwortdaten
 */
export async function callApi(action, params = {}, tokens, onTokenRefresh) {
  if (!tokens?.accessToken) throw new Error('Keine OneDrive-Verbindung. Bitte zuerst verbinden.')

  const res = await fetch('/api/onedrive-api', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action, tokens, ...params }),
  })

  // Antwort robust auswerten: Nicht jede Fehlerantwort ist JSON (z. B. 404 mit
  // leerem Körper, HTML-Fehlerseite eines Proxys, Zeitüberschreitung). Ohne
  // diese Prüfung entstünde die unverständliche Meldung
  // „JSON.parse: unexpected end of data".
  const rohtext = await res.text()
  let data
  try {
    data = rohtext ? JSON.parse(rohtext) : {}
  } catch {
    if (res.status === 404) {
      throw new Error('Die OneDrive-Schnittstelle ist unter dieser Adresse nicht erreichbar. In einer rein lokalen Vorschau fehlen die Server-Funktionen – bitte die veröffentlichte Version verwenden.')
    }
    throw new Error(`Unerwartete Antwort der OneDrive-Schnittstelle (HTTP ${res.status}).`)
  }
  if (res.status === 404 && !rohtext) {
    throw new Error('Die OneDrive-Schnittstelle ist unter dieser Adresse nicht erreichbar. In einer rein lokalen Vorschau fehlen die Server-Funktionen – bitte die veröffentlichte Version verwenden.')
  }

  // Tokens wurden server-seitig refreshed → Callback ausführen
  if (data.newTokens && onTokenRefresh) {
    onTokenRefresh(data.newTokens)
  }

  if (data.needsReauth) {
    throw Object.assign(new Error('OneDrive-Sitzung abgelaufen. Bitte erneut verbinden.'), { needsReauth: true })
  }

  if (!data.success) {
    throw new Error(data.error ?? (res.ok ? 'Unbekannter Fehler' : `Unbekannter Fehler (HTTP ${res.status}).`))
  }

  return data
}

/**
 * Erstellt den sicheren Ordnerpfad für einen Mandanten.
 * Wenn client.onedrivePfad gesetzt ist, wird dieser verwendet.
 * Ungültige Zeichen für OneDrive-Dateinamen werden entfernt.
 */
export function getMandantPath(client) {
  // Wenn ein benutzerdefinierter Pfad hinterlegt ist → diesen verwenden
  if (client.onedrivePfad && client.onedrivePfad.trim()) {
    const customPath = client.onedrivePfad.trim().replace(/^\/+|\/+$/g, '') // führende/trailing Slashes entfernen
    const parts = customPath.split('/').filter(Boolean)
    const folderName = parts[parts.length - 1] || 'Mandant'
    return {
      pathParts:  parts,
      folderPath: customPath,
      folderName,
      isCustom:   true,
    }
  }

  // Standard: automatisch aus Name + Mandantennummer
  // OneDrive erlaubt keine: " * : < > ? / \ |
  const safeName = (client.name ?? 'Unbekannt').replace(/["/\\*:<>?|]/g, '').trim()
  const nr = client.mandantennummer ?? ''
  const folderName = nr ? `${safeName} (${nr})` : safeName

  return {
    pathParts:  ['Jahresabschluss-Dashboard', 'Mandanten', folderName],
    folderPath: `Jahresabschluss-Dashboard/Mandanten/${folderName}`,
    folderName,
    isCustom:   false,
  }
}

/**
 * Sendet eine E-Mail über das Microsoft-Konto (Graph API).
 * Die Mail landet automatisch in Outlook "Gesendete Elemente".
 *
 * @param {object} params         - { to, subject, body, bodyType?, cc?, bcc?, attachments? }
 * @param {object} tokens         - Aktuelle OneDrive/Graph-Tokens
 * @param {function} onTokenRefresh - Callback wenn Tokens refreshed wurden
 * @returns {Promise<void>}
 */
export async function sendMailGraph(params, tokens, onTokenRefresh) {
  return callApi('sendMail', params, tokens, onTokenRefresh)
}

/**
 * Lädt eine Datei aus dem E-Mail-Anhang und gibt sie als Base64 zurück.
 * Wird für den Upload zu OneDrive benötigt.
 */
export async function fetchAttachmentAsBase64(attachmentUrl) {
  const res = await fetch(attachmentUrl)
  if (!res.ok) throw new Error(`Fehler beim Laden des Anhangs: ${res.status}`)
  const buffer = await res.arrayBuffer()
  const bytes  = new Uint8Array(buffer)
  let binary   = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/**
 * Formatiert eine Dateigröße human-readable.
 */
export function fmtFileSize(bytes) {
  if (!bytes || bytes === 0) return '–'
  if (bytes < 1024)          return `${bytes} B`
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
