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
 *
 * (Weitere Actions – createInvoice, getPdf, sendViaEmail, enshrine – folgen
 *  in den nächsten Stufen.)
 */

// Konsistent mit api/onedrive-api.js: raw body selbst lesen (unabhängig von Vercel-bodyParser)
export const config = { api: { bodyParser: false } }

const DEFAULT_BASE = 'https://my.sevdesk.de/api/v1'

// ── Raw body lesen ───────────────────────────────────────────────────────────
async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end',  () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

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

  let body
  try {
    const raw = await readRawBody(req)
    const str = raw.toString('utf-8')
    body = str ? JSON.parse(str) : {}
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid request body' })
  }

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
          fullname: user.fullname ?? [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
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

    return fail(400, `Unbekannte action: ${action}`)

  } catch (err) {
    console.error('[sevdesk-api]', err)
    return fail(500, String(err))
  }
}
