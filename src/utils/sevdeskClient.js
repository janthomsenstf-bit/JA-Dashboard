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

/**
 * Kontaktsuche (Substring über Name/Kundennr.).
 * @param {string} query
 * @returns {Promise<{contacts: Array, total: number}>}
 */
export async function findSevdeskContacts(query) {
  return callSevdesk('findContacts', { query })
}

/**
 * Kontaktdetails inkl. Anschrift + E-Mail laden.
 * @param {string|number} contactId
 * @returns {Promise<{contact: object}>}
 */
export async function getSevdeskContactDetails(contactId) {
  return callSevdesk('getContactDetails', { contactId })
}

/**
 * Neuen Kontakt (Organisation) in sevDesk anlegen.
 * @param {string} name
 * @param {string} [customerNumber]
 * @returns {Promise<{contact: object}>}
 */
export async function createSevdeskContact(name, customerNumber) {
  return callSevdesk('createContact', { name, customerNumber })
}

/**
 * Rechnung als ENTWURF in sevDesk anlegen (kein Versand, keine Nummer).
 * @param {object} data - { contactId, invoiceDate, positions:[{name,quantity,price,taxRate,text?}], address?, headText?, footText?, timeToPay? }
 * @returns {Promise<{invoice: object}>}
 */
export async function createSevdeskInvoice(data) {
  return callSevdesk('createInvoice', data)
}

/**
 * (Vorschau-)PDF einer Rechnung als Base64 laden.
 * @param {string|number} invoiceId
 * @returns {Promise<{filename: string, mimetype: string, base64: string}>}
 */
export async function getSevdeskInvoicePdf(invoiceId) {
  return callSevdesk('getPdf', { invoiceId })
}

/**
 * Rechnung per E-Mail an den Mandanten senden (finalisiert + vergibt Nummer).
 * @param {object} data - { invoiceId, toEmail, subject, text, copy? }
 * @returns {Promise<{sent: boolean, invoice: object}>}
 */
export async function sendSevdeskInvoiceEmail(data) {
  return callSevdesk('sendViaEmail', data)
}

/**
 * Rechnung festschreiben (GoBD, unveränderlich).
 * @param {string|number} invoiceId
 * @returns {Promise<{enshrined: boolean, invoice: object}>}
 */
export async function enshrineSevdeskInvoice(invoiceId) {
  return callSevdesk('enshrine', { invoiceId })
}

/**
 * Zahlungsstatus mehrerer Rechnungen aus sevDesk abgleichen.
 * @param {Array<string|number>} ids - sevDesk-Rechnungs-IDs
 * @returns {Promise<{statuses: Array}>} - je Rechnung { id, status, paidAmount, payDate, invoiceDate, timeToPay, sumGross, invoiceNumber }
 */
export async function getSevdeskInvoiceStatuses(ids) {
  return callSevdesk('getInvoiceStatuses', { ids })
}
