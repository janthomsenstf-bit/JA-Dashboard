/**
 * /api/sevdesk-api
 * Zentraler Proxy für die sevDesk REST-API (System of Record für Rechnungen).
 *
 * Der API-Token liegt AUSSCHLIESSLICH server-seitig als Env-Var `SEVDESK_API_TOKEN`
 * und wird niemals ans Frontend gegeben. Das Frontend ruft nur callSevdesk(action, params).
 *
 * sevDesk-Auth: Header `Authorization: <token>` (kein "Bearer"-Präfix).
 * Basis-URL überschreibbar via `SEVDESK_API_BASE` (Default: https://my.sevdesk.de/api/v1).
 *
 * POST /api/sevdesk-api
 * Body: { action, ...params }
 *
 * Actions:
 *   ping              → GET /SevUser  (Verbindungstest: prüft, ob Token gültig ist)
 *   findContacts      → Kontaktsuche (Substring über Name/Kundennr.)
 *   getContactDetails → Kontakt inkl. Anschrift + E-Mail laden
 *   createContact     → neuen Kontakt (Organisation) anlegen
 *   createInvoice     → Rechnung als ENTWURF anlegen (POST /Invoice/Factory/saveInvoice)
 *   getPdf            → (Vorschau-)PDF einer Rechnung als Base64
 *   sendViaEmail      → Rechnung per E-Mail an Mandant senden (finalisiert + Nummer)
 *   enshrine          → Rechnung festschreiben (GoBD, unveränderlich)
 */

const DEFAULT_BASE = 'https://my.sevdesk.de/api/v1'

// ── sevDesk-Fetch ────────────────────────────────────────────────────────────
// Zentraler Aufrufer: hängt Token + Base-URL an. `path` beginnt mit "/".
async function sevdeskFetch(path, options, token) {
  const base = (process.env.SEVDESK_API_BASE || DEFAULT_BASE).replace(/\/+$/, '')
  return fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: token,
      Accept: 'application/json',
      ...(options?.headers ?? {}),
    },
  })
}

// ── Rechnung neu lesen (finale Nummer/Status/Summen) ─────────────────────────
async function readInvoiceSummary(invoiceId, token) {
  const r = await sevdeskFetch(`/Invoice/${encodeURIComponent(invoiceId)}`, { method: 'GET' }, token)
  const d = await r.json().catch(() => ({}))
  const inv = Array.isArray(d.objects) ? d.objects[0] : d.objects
  if (!inv) return null
  return {
    id:            inv.id,
    invoiceNumber: inv.invoiceNumber || null,
    status:        inv.status ?? null,
    sumNet:        Number(inv.sumNet)   || null,
    sumGross:      Number(inv.sumGross) || null,
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  // Token muss server-seitig gesetzt sein
  const token = process.env.SEVDESK_API_TOKEN
  if (!token) {
    return res.status(500).json({
      success: false,
      error: 'SEVDESK_API_TOKEN ist auf dem Server nicht gesetzt. Bitte als Umgebungsvariable in Vercel hinterlegen.',
      needsSetup: true,
    })
  }

  // Vercel parst den JSON-Body automatisch (req.body). Nur falls er als String
  // ankommt, selbst parsen. KEIN eigenes Stream-Lesen – der Body-Stream ist von
  // Vercel bereits konsumiert, ein erneutes Lesen würde hängen (Timeout/HTTP 500).
  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return res.status(400).json({ success: false, error: 'Invalid request body' }) }
  }
  body = body ?? {}

  const { action, ...params } = body
  if (!action) return res.status(400).json({ success: false, error: 'action fehlt' })

  function ok(data)   { return res.status(200).json({ success: true, ...data }) }
  function fail(code, msg, extra = {}) { return res.status(code).json({ success: false, error: msg, ...extra }) }

  // sevDesk-Fehler verständlich aufbereiten
  function sevError(r, d, fallback) {
    if (r.status === 401) return 'sevDesk lehnt den API-Token ab (401). Bitte SEVDESK_API_TOKEN prüfen.'
    return d?.error?.message ?? d?.message ?? fallback ?? `sevDesk-Fehler (HTTP ${r.status})`
  }

  try {
    // ── ping (Verbindungstest) ────────────────────────────────────────────────
    // GET /SevUser liefert den/die angemeldeten Benutzer des sevDesk-Kontos.
    // Erfolg = Token gültig; wir geben Name + Firma zur Anzeige zurück.
    if (action === 'ping') {
      const r = await sevdeskFetch('/SevUser', { method: 'GET' }, token)
      let d = {}; try { d = await r.json() } catch {}
      if (!r.ok) return fail(r.status, sevError(r, d, 'Verbindungstest fehlgeschlagen'))

      const user = Array.isArray(d.objects) ? d.objects[0] : null
      return ok({
        connected: true,
        user: user ? {
          id:       user.id,
          fullname: user.fullname ?? ([user.firstName, user.lastName].filter(Boolean).join(' ') || null),
          email:    user.email ?? null,
        } : null,
      })
    }

    // ── findContacts (Kontaktsuche) ───────────────────────────────────────────
    // sevDesk bietet keine robuste Volltext-Namenssuche per Query-Param, daher
    // laden wir eine begrenzte Kontaktliste und filtern hier nach Substring
    // (Name bei Organisationen bzw. Vor-/Nachname bei Personen, oder Kundennr.).
    if (action === 'findContacts') {
      const { query = '', limit = 500 } = params
      const cap = Math.min(Number(limit) || 500, 1000)
      const r = await sevdeskFetch(`/Contact?depth=1&limit=${cap}`, { method: 'GET' }, token)
      let d = {}; try { d = await r.json() } catch {}
      if (!r.ok) return fail(r.status, sevError(r, d, 'Kontaktsuche fehlgeschlagen'))

      const list = (Array.isArray(d.objects) ? d.objects : []).map(c => ({
        id:             c.id,
        name:           (c.name && c.name.trim()) ? c.name.trim() : [c.surename, c.familyname].filter(Boolean).join(' ').trim(),
        customerNumber: c.customerNumber ?? null,
      })).filter(c => c.name || c.customerNumber)

      const q = String(query).trim().toLowerCase()
      const filtered = q
        ? list.filter(c => (c.name || '').toLowerCase().includes(q) || String(c.customerNumber || '').toLowerCase().includes(q))
        : list

      return ok({ contacts: filtered.slice(0, 50), total: filtered.length })
    }

    // ── getContactDetails (Kontakt inkl. Anschrift + E-Mail) ──────────────────
    if (action === 'getContactDetails') {
      const { contactId } = params
      if (!contactId) return fail(400, 'contactId fehlt')
      const id = encodeURIComponent(contactId)

      const [rc, ra, rw] = await Promise.all([
        sevdeskFetch(`/Contact/${id}?depth=1`, { method: 'GET' }, token),
        sevdeskFetch(`/Contact/${id}/getContactAddresses`, { method: 'GET' }, token),
        sevdeskFetch(`/Contact/${id}/getCommunicationWays`, { method: 'GET' }, token),
      ])
      const [dc, da, dw] = await Promise.all([
        rc.json().catch(() => ({})), ra.json().catch(() => ({})), rw.json().catch(() => ({})),
      ])
      if (!rc.ok) return fail(rc.status, sevError(rc, dc, 'Kontakt konnte nicht geladen werden'))

      const c    = Array.isArray(dc.objects) ? dc.objects[0] : dc.objects
      const addr = (Array.isArray(da.objects) ? da.objects[0] : null) || {}
      const ways = Array.isArray(dw.objects) ? dw.objects : []
      const email = ways.find(w => String(w.type).toUpperCase() === 'EMAIL')?.value ?? ''
      const land  = addr.country?.code || addr.country?.name || ''

      return ok({
        contact: {
          id:             c?.id ?? contactId,
          name:           (c?.name && c.name.trim()) ? c.name.trim() : [c?.surename, c?.familyname].filter(Boolean).join(' ').trim(),
          customerNumber: c?.customerNumber ?? null,
          address: {
            strasse: addr.street ?? '',
            plz:     addr.zip    ?? '',
            ort:     addr.city   ?? '',
            land:    land || 'Deutschland',
          },
          email,
          ustId:        c?.vatNumber ?? '',   // USt-IdNr.
          steuernummer: c?.taxNumber ?? '',   // Steuernummer
        },
      })
    }

    // ── createContact (neue Organisation anlegen) ─────────────────────────────
    // Beim Anlegen ist eine Kontakt-Kategorie Pflicht; diese ist kontospezifisch,
    // daher ermitteln wir sie zur Laufzeit (bevorzugt „Kunde", sonst die erste).
    if (action === 'createContact') {
      const { name, customerNumber } = params
      const nm = String(name ?? '').trim()
      if (!nm) return fail(400, 'name fehlt')

      const rcat = await sevdeskFetch(`/Category?objectType=Contact&limit=100`, { method: 'GET' }, token)
      const dcat = await rcat.json().catch(() => ({}))
      if (!rcat.ok) return fail(rcat.status, sevError(rcat, dcat, 'Kontakt-Kategorien konnten nicht geladen werden'))
      const cats = Array.isArray(dcat.objects) ? dcat.objects : []
      const cat  = cats.find(x => /kunde|customer/i.test(x.name || x.translationCode || '')) || cats[0]
      if (!cat) return fail(400, 'Keine Kontakt-Kategorie im sevDesk-Konto gefunden.')

      const bodyObj = {
        name: nm,
        category: { id: cat.id, objectName: 'Category' },
        ...(customerNumber ? { customerNumber: String(customerNumber) } : {}),
      }
      const r = await sevdeskFetch('/Contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj),
      }, token)
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return fail(r.status, sevError(r, d, 'Kontakt konnte nicht angelegt werden'))

      const created = Array.isArray(d.objects) ? d.objects[0] : d.objects
      return ok({ contact: { id: created?.id, name: created?.name ?? nm, customerNumber: created?.customerNumber ?? null } })
    }

    // ── createInvoice (Rechnung als ENTWURF) ──────────────────────────────────
    // Legt eine Rechnung mit Positionen in EINEM Call an (Factory saveInvoice),
    // Status 100 = Entwurf → KEIN Versand, KEINE Nummer/Festschreibung.
    // Steuer-Default: Regelbesteuerung (taxRule 1); USt-Satz je Position wählbar.
    // Fachliche Korrektheit (Bezeichnung/Beträge/Steuerfall) bleibt beim Nutzer.
    if (action === 'createInvoice') {
      const {
        contactId,
        invoiceDate,                 // 'YYYY-MM-DD'
        positions = [],
        address,                     // mehrzeilige Empfängeranschrift (optional)
        headText = '',
        footText = '',
        timeToPay = 14,
      } = params

      if (!contactId)          return fail(400, 'contactId fehlt (bitte zuerst einen sevDesk-Kontakt verknüpfen).')
      if (!positions.length)   return fail(400, 'Mindestens eine Rechnungsposition ist nötig.')

      // Rechnungsersteller (contactPerson) ist Pflicht → aktuellen SevUser holen
      const ru = await sevdeskFetch('/SevUser', { method: 'GET' }, token)
      const du = await ru.json().catch(() => ({}))
      if (!ru.ok) return fail(ru.status, sevError(ru, du, 'SevUser konnte nicht geladen werden'))
      const sevUser = Array.isArray(du.objects) ? du.objects[0] : du.objects
      if (!sevUser?.id) return fail(400, 'Kein SevUser (Rechnungsersteller) im Konto gefunden.')

      const datum = /^\d{4}-\d{2}-\d{2}$/.test(String(invoiceDate || '')) ? invoiceDate : new Date().toISOString().slice(0, 10)
      const ersterSatz = Number(positions[0]?.taxRate) || 0

      const invoice = {
        objectName:    'Invoice',
        mapAll:        true,
        invoiceType:   'RE',
        contact:       { id: contactId, objectName: 'Contact' },
        contactPerson: { id: sevUser.id, objectName: 'SevUser' },
        invoiceDate:   datum,
        deliveryDate:  datum,
        status:        100,               // Entwurf
        header:        'Rechnung',
        headText:      headText || '',
        footText:      footText || '',
        timeToPay:     Number(timeToPay) || 0,
        discount:      0,
        currency:      'EUR',
        taxRate:       ersterSatz,        // veraltet, teils erwartet
        taxRule:       { id: 1, objectName: 'TaxRule' },  // Regelbesteuerung
        taxText:       ersterSatz ? `Umsatzsteuer ${ersterSatz}%` : 'Steuerfrei',
        taxType:       'default',
        ...(address ? { address: String(address) } : {}),
        addressCountry: { id: 1, objectName: 'StaticCountry' },  // 1 = Deutschland
      }

      const invoicePosArray = positions.map(p => ({
        objectName: 'InvoicePos',
        mapAll:     true,
        quantity:   Number(p.quantity) || 1,
        price:      Number(p.price)    || 0,          // Nettopreis je Einheit
        name:       String(p.name ?? '').trim() || 'Leistung',
        text:       String(p.text ?? ''),
        unity:      { id: 1, objectName: 'Unity' },   // 1 = Stück
        taxRate:    Number(p.taxRate) || 0,
      }))

      const r = await sevdeskFetch('/Invoice/Factory/saveInvoice', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        // sevDesk-Factory erwartet die Positionen unter 'invoicePosSave' (NICHT invoicePosArray),
        // sonst: „The given document must have at least one position".
        body:    JSON.stringify({
          invoice,
          invoicePosSave:   invoicePosArray,
          invoicePosDelete: null,
          takeDefaultAddress: address ? false : true,
        }),
      }, token)
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return fail(r.status, sevError(r, d, 'Rechnungsentwurf konnte nicht angelegt werden'))

      const obj = d.objects ?? {}
      const inv = obj.invoice ?? (obj.id ? obj : null)
      if (!inv?.id) return fail(500, 'sevDesk hat keine Rechnungs-ID zurückgegeben.', { raw: d })

      return ok({
        invoice: {
          id:            inv.id,
          invoiceNumber: inv.invoiceNumber || null,
          status:        inv.status ?? 100,
          sumNet:        Number(inv.sumNet)   || null,
          sumTax:        Number(inv.sumTax)   || null,
          sumGross:      Number(inv.sumGross) || null,
        },
      })
    }

    // ── getPdf (Vorschau-PDF als Base64) ──────────────────────────────────────
    if (action === 'getPdf') {
      const { invoiceId } = params
      if (!invoiceId) return fail(400, 'invoiceId fehlt')
      const r = await sevdeskFetch(`/Invoice/${encodeURIComponent(invoiceId)}/getPdf?download=false&preventSendBy=true`, { method: 'GET' }, token)
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return fail(r.status, sevError(r, d, 'PDF konnte nicht erzeugt werden'))
      const o = d.objects ?? {}
      const base64 = o.base64 ?? o.content ?? null
      if (!base64) return fail(500, 'sevDesk hat kein PDF zurückgegeben.', { raw: d })
      return ok({ filename: o.filename ?? 'rechnung.pdf', mimetype: o.mimetype ?? 'application/pdf', base64 })
    }

    // ── sendViaEmail (Versand an Mandant) ─────────────────────────────────────
    // Versendet die Rechnung per E-Mail über sevDesk; dabei wird die Rechnung
    // finalisiert (Nummer aus dem Nummernkreis, Status „offen/versendet").
    if (action === 'sendViaEmail') {
      const { invoiceId, toEmail, subject, text, copy = false } = params
      if (!invoiceId) return fail(400, 'invoiceId fehlt')
      if (!toEmail)   return fail(400, 'Empfänger-E-Mail fehlt')

      const r = await sevdeskFetch(`/Invoice/${encodeURIComponent(invoiceId)}/sendViaEmail`, {
        method:  'POST',   // sevDesk erwartet POST (nicht PUT) für sendViaEmail
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ toEmail, subject: subject || 'Ihre Rechnung', text: text || '', copy: !!copy }),
      }, token)
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return fail(r.status, sevError(r, d, 'Versand fehlgeschlagen'))

      const invoice = await readInvoiceSummary(invoiceId, token)
      return ok({ sent: true, invoice })
    }

    // ── enshrine (Festschreiben / GoBD) ───────────────────────────────────────
    // Macht die Rechnung revisionssicher/unveränderlich. Best-effort nach Versand.
    if (action === 'enshrine') {
      const { invoiceId } = params
      if (!invoiceId) return fail(400, 'invoiceId fehlt')
      const r = await sevdeskFetch(`/Invoice/${encodeURIComponent(invoiceId)}/enshrine`, { method: 'PUT' }, token)
      if (!r.ok && r.status !== 201) {
        const d = await r.json().catch(() => ({}))
        return fail(r.status, sevError(r, d, 'Festschreiben fehlgeschlagen'))
      }
      const invoice = await readInvoiceSummary(invoiceId, token)
      return ok({ enshrined: true, invoice })
    }

    return fail(400, `Unbekannte action: ${action}`)

  } catch (err) {
    console.error('[sevdesk-api]', err)
    return fail(500, String(err))
  }
}
