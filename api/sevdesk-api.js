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
 *   ping → GET /SevUser  (Verbindungstest: prüft, ob Token gültig ist)
 *
 * (Weitere Actions – findOrCreateContact, createInvoice, getPdf, sendViaEmail,
 *  enshrine – folgen in den nächsten Stufen.)
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

    return fail(400, `Unbekannte action: ${action}`)

  } catch (err) {
    console.error('[sevdesk-api]', err)
    return fail(500, String(err))
  }
}
