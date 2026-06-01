/**
 * /api/onedrive-api
 * Zentraler Proxy für Microsoft Graph API Aufrufe.
 * Führt automatisches Token-Refresh durch.
 *
 * POST /api/onedrive-api
 * Body: { action, tokens, ...params }
 *
 * Actions:
 *   getUser          → GET /me
 *   listFolder       → GET /me/drive/root:/{path}:/children
 *   createFolder     → POST /me/drive/items/{parentId}/children  (oder root:/{path})
 *   ensurePath       → stellt sicher dass ein Ordnerpfad existiert (rekursiv)
 *   uploadSmall      → PUT /me/drive/root:/{path}:/content  (<= 4 MB)
 *   downloadUrl      → GET /me/drive/root:/{path}  → gibt @microsoft.graph.downloadUrl zurück
 *   deleteItem       → DELETE /me/drive/items/{itemId}
 *   listRootContents → GET /me/drive/root/children
 *   refreshToken     → gibt neue Tokens zurück (kein Graph-Call)
 */

// Vercel: Binary-Uploads brauchen raw body → bodyParser deaktivieren
export const config = { api: { bodyParser: false } }

const GRAPH = 'https://graph.microsoft.com/v1.0'
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

// ── Raw body lesen ───────────────────────────────────────────────────────────
async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end',  () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// ── Token refresh ────────────────────────────────────────────────────────────
async function refreshAccessToken(refreshToken) {
  const clientId     = process.env.ONEDRIVE_CLIENT_ID
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
      scope:         'Files.ReadWrite offline_access User.Read Mail.Read Mail.Send',
    }).toString(),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error_description ?? data.error ?? 'refresh_failed')

  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,  // Fallback: alten behalten
    expiresAt:    Date.now() + (data.expires_in ?? 3600) * 1000,
    scope:        data.scope,
    tokenType:    data.token_type ?? 'Bearer',
  }
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────
async function graphFetch(url, options, tokens) {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      ...(options?.headers ?? {}),
    },
  })
}

async function ensureFolderPath(tokens, pathParts) {
  // pathParts z.B. ['Jahresabschluss-Dashboard', 'Mandanten', 'Müller GmbH (1001)']
  // Erstellt fehlende Ordner rekursiv von der Wurzel aus
  let parentId = 'root'

  for (const part of pathParts) {
    // Existiert dieser Ordner schon?
    const checkRes = await graphFetch(
      `${GRAPH}/me/drive/${parentId === 'root' ? 'root' : `items/${parentId}`}/children?$filter=name eq '${encodeURIComponent(part).replace(/'/g, "''")}'&$select=id,name,folder`,
      { method: 'GET' },
      tokens
    )
    const checkData = await checkRes.json()
    const existing = checkData.value?.find(i => i.folder && i.name === part)

    if (existing) {
      parentId = existing.id
    } else {
      // Ordner anlegen
      const createRes = await graphFetch(
        `${GRAPH}/me/drive/${parentId === 'root' ? 'root' : `items/${parentId}`}/children`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: part, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' }),
        },
        tokens
      )
      const created = await createRes.json()
      if (!createRes.ok) throw new Error(`Ordner "${part}" konnte nicht erstellt werden: ${JSON.stringify(created)}`)
      parentId = created.id
    }
  }

  return parentId  // ID des letzten Ordners
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let body
  try {
    const raw = await readRawBody(req)
    const str = raw.toString('utf-8')
    body = JSON.parse(str)
  } catch {
    return res.status(400).json({ error: 'Invalid request body' })
  }

  const { action, tokens: inputTokens, ...params } = body

  if (!action) return res.status(400).json({ error: 'action fehlt' })
  if (!inputTokens?.accessToken) return res.status(401).json({ error: 'tokens fehlt' })

  // Auto-Refresh: Token < 60 Sekunden gültig
  let tokens = inputTokens
  let tokensRefreshed = false
  if (Date.now() > (tokens.expiresAt ?? 0) - 60_000) {
    if (!tokens.refreshToken) return res.status(401).json({ error: 'token_expired', needsReauth: true })
    try {
      tokens = await refreshAccessToken(tokens.refreshToken)
      tokensRefreshed = true
    } catch (err) {
      return res.status(401).json({ error: 'refresh_failed', message: String(err), needsReauth: true })
    }
  }

  // Antwort-Wrapper: immer aktuelle Tokens zurückgeben (falls refreshed)
  function ok(data) {
    return res.status(200).json({ success: true, ...(tokensRefreshed ? { newTokens: tokens } : {}), ...data })
  }
  function fail(statusCode, msg, extra = {}) {
    return res.status(statusCode).json({ success: false, error: msg, ...(tokensRefreshed ? { newTokens: tokens } : {}), ...extra })
  }

  try {
    // ── refreshToken ────────────────────────────────────────────────────────
    if (action === 'refreshToken') {
      return ok({ tokens })
    }

    // ── getUser ──────────────────────────────────────────────────────────────
    if (action === 'getUser') {
      const r = await graphFetch(`${GRAPH}/me?$select=displayName,mail,userPrincipalName`, {}, tokens)
      const d = await r.json()
      if (!r.ok) return fail(r.status, d.error?.message ?? 'getUser failed')
      return ok({ user: d })
    }

    // ── searchMails ──────────────────────────────────────────────────────────
    // Durchsucht ALLE Outlook-Ordner nach Mails von/an einer bestimmten Adresse.
    // Nutzt KQL-Suche der Graph API – findet auch Mails in Unterordnern.
    if (action === 'searchMails') {
      const { email, maxResults = 100 } = params
      if (!email) return fail(400, 'email parameter required')

      // KQL-Suche: from: ODER to: (damit auch gesendete Mails gefunden werden)
      const select = 'id,subject,from,toRecipients,receivedDateTime,sentDateTime,bodyPreview,hasAttachments,parentFolderId,isDraft,isRead'
      const topN   = Math.min(maxResults, 200)

      // Beide Richtungen: empfangen (FROM) und gesendet (TO)
      const [rFrom, rTo] = await Promise.all([
        graphFetch(`${GRAPH}/me/messages?$search="${encodeURIComponent('from:' + email)}"&$top=${topN}&$select=${select}`, {}, tokens),
        graphFetch(`${GRAPH}/me/messages?$search="${encodeURIComponent('to:' + email)}"&$top=${topN}&$select=${select}`, {}, tokens),
      ])

      const [dFrom, dTo] = await Promise.all([rFrom.json(), rTo.json()])

      if (!rFrom.ok && !rTo.ok) {
        const errMsg = dFrom.error?.message ?? dTo.error?.message ?? 'searchMails failed'
        return fail(rFrom.status, errMsg)
      }

      // Zusammenführen und Duplikate entfernen (gleiche id)
      const fromMsgs = rFrom.ok ? (dFrom.value ?? []) : []
      const toMsgs   = rTo.ok   ? (dTo.value   ?? []) : []
      const seenIds  = new Set()
      const allMsgs  = []
      for (const m of [...fromMsgs, ...toMsgs]) {
        if (!seenIds.has(m.id)) { seenIds.add(m.id); allMsgs.push(m) }
      }

      // Chronologisch absteigend sortieren
      allMsgs.sort((a, b) => {
        const da = new Date(a.receivedDateTime ?? a.sentDateTime ?? 0)
        const db = new Date(b.receivedDateTime ?? b.sentDateTime ?? 0)
        return db - da
      })

      return ok({ messages: allMsgs, total: allMsgs.length })
    }

    // ── getMailMessage ───────────────────────────────────────────────────────
    // Lädt vollständigen E-Mail-Inhalt (Body + Anhang-Metadaten) per Graph-ID.
    if (action === 'getMailMessage') {
      const { messageId } = params
      if (!messageId) return fail(400, 'messageId required')
      const select = 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,body,hasAttachments,attachments,parentFolderId'
      const r = await graphFetch(`${GRAPH}/me/messages/${encodeURIComponent(messageId)}?$select=${select}&$expand=attachments($select=id,name,contentType,size)`, {}, tokens)
      const d = await r.json()
      if (!r.ok) return fail(r.status, d.error?.message ?? 'getMailMessage failed')
      return ok({ message: d })
    }

    // ── getMailFolderName ────────────────────────────────────────────────────
    // Gibt den Anzeigenamen eines Mail-Ordners zurück (für Ergebnis-Anzeige).
    if (action === 'getMailFolderName') {
      const { folderId } = params
      if (!folderId) return fail(400, 'folderId required')
      const r = await graphFetch(`${GRAPH}/me/mailFolders/${encodeURIComponent(folderId)}?$select=id,displayName,parentFolderId`, {}, tokens)
      const d = await r.json()
      if (!r.ok) return ok({ name: 'Unbekannter Ordner' })  // Fehler still ignorieren
      return ok({ name: d.displayName ?? 'Unbekannter Ordner', parentFolderId: d.parentFolderId })
    }

    // ── listFolder ───────────────────────────────────────────────────────────
    if (action === 'listFolder') {
      const { folderPath } = params  // z.B. "Jahresabschluss-Dashboard/Mandanten/Müller GmbH (1001)"
      // Root-Ordner braucht eine andere URL als Unterordner
      const folderUrl = folderPath
        ? `${GRAPH}/me/drive/root:/${encodeURIComponent(folderPath).replace(/%2F/g, '/')}:/children`
        : `${GRAPH}/me/drive/root/children`
      const r = await graphFetch(`${folderUrl}?$orderby=name&$select=id,name,size,file,folder,lastModifiedDateTime,@microsoft.graph.downloadUrl`, {}, tokens)
      if (r.status === 404) return ok({ items: [] })
      const d = await r.json()
      if (!r.ok) return fail(r.status, d.error?.message ?? 'listFolder failed')
      return ok({ items: d.value ?? [] })
    }

    // ── ensurePath ───────────────────────────────────────────────────────────
    if (action === 'ensurePath') {
      const { pathParts } = params  // string[]
      const folderId = await ensureFolderPath(tokens, pathParts)
      return ok({ folderId })
    }

    // ── createFolder ─────────────────────────────────────────────────────────
    // Legt einen einzelnen Unterordner unter einem gegebenen Pfad an.
    if (action === 'createFolder') {
      const { parentPath, folderName: newName } = params
      let url
      if (parentPath) {
        const encoded = encodeURIComponent(parentPath).replace(/%2F/g, '/')
        url = `${GRAPH}/me/drive/root:/${encoded}:/children`
      } else {
        url = `${GRAPH}/me/drive/root/children`
      }
      const r = await graphFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' }),
      }, tokens)
      const d = await r.json()
      if (!r.ok) return fail(r.status, d.error?.message ?? 'createFolder failed')
      return ok({ folder: d })
    }

    // ── uploadSmall (<= 4 MB, Base64 encoded) ────────────────────────────────
    if (action === 'uploadSmall') {
      const { filePath, base64, contentType } = params
      // filePath z.B. "Jahresabschluss-Dashboard/Mandanten/Müller (1001)/rechnung.pdf"
      const encoded = encodeURIComponent(filePath).replace(/%2F/g, '/')
      const fileBuffer = Buffer.from(base64, 'base64')
      const r = await graphFetch(
        `${GRAPH}/me/drive/root:/${encoded}:/content`,
        {
          method: 'PUT',
          headers: { 'Content-Type': contentType ?? 'application/octet-stream' },
          body: fileBuffer,
        },
        tokens
      )
      const d = await r.json()
      if (!r.ok) return fail(r.status, d.error?.message ?? 'upload failed')
      return ok({ item: d })
    }

    // ── downloadUrl ──────────────────────────────────────────────────────────
    if (action === 'downloadUrl') {
      const { filePath } = params
      const encoded = encodeURIComponent(filePath).replace(/%2F/g, '/')
      const r = await graphFetch(`${GRAPH}/me/drive/root:/${encoded}`, {}, tokens)
      const d = await r.json()
      if (!r.ok) return fail(r.status, d.error?.message ?? 'downloadUrl failed')
      return ok({ downloadUrl: d['@microsoft.graph.downloadUrl'], item: d })
    }

    // ── deleteItem ───────────────────────────────────────────────────────────
    if (action === 'deleteItem') {
      const { itemId } = params
      const r = await graphFetch(`${GRAPH}/me/drive/items/${itemId}`, { method: 'DELETE' }, tokens)
      if (r.status === 204 || r.ok) return ok({})
      let d = {}; try { d = await r.json() } catch {}
      return fail(r.status, d.error?.message ?? 'delete failed')
    }

    // ── listRootContents ─────────────────────────────────────────────────────
    if (action === 'listRootContents') {
      const r = await graphFetch(`${GRAPH}/me/drive/root/children?$select=id,name,folder,size,lastModifiedDateTime`, {}, tokens)
      const d = await r.json()
      if (!r.ok) return fail(r.status, d.error?.message ?? 'listRoot failed')
      return ok({ items: d.value ?? [] })
    }

    // ── sendMail ─────────────────────────────────────────────────────────────
    // Sendet eine E-Mail über das Microsoft-Konto des Nutzers.
    // Die E-Mail wird automatisch in "Gesendete Elemente" (Sent Items) gespeichert.
    if (action === 'sendMail') {
      // params enthält alles außer action + tokens (aus dem Request-Body destructured)
      const { to, subject, body: mailBody, bodyType = 'text', cc, bcc, attachments = [] } = params

      if (!to || !subject || !mailBody) {
        return fail(400, 'sendMail: to, subject und body sind Pflicht')
      }

      // Empfänger-Adressen in Graph-Format umwandeln
      function toRecipients(addresses) {
        if (!addresses) return []
        return String(addresses).split(/[,;]/).map(a => a.trim()).filter(Boolean)
          .map(a => ({ emailAddress: { address: a } }))
      }

      // Anhänge in Graph-Format (Base64)
      const graphAttachments = (attachments ?? []).map(a => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name:          a.filename,
        contentType:   a.contentType ?? 'application/octet-stream',
        contentBytes:  a.content, // bereits Base64
      }))

      const message = {
        subject,
        body: {
          contentType: bodyType === 'html' ? 'html' : 'text',
          content:     mailBody,
        },
        toRecipients:  toRecipients(to),
        ...(cc  ? { ccRecipients:  toRecipients(cc)  } : {}),
        ...(bcc ? { bccRecipients: toRecipients(bcc) } : {}),
        ...(graphAttachments.length > 0 ? { attachments: graphAttachments } : {}),
      }

      const r = await graphFetch(`${GRAPH}/me/sendMail`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message, saveToSentItems: true }),
      }, tokens)

      // sendMail gibt 202 Accepted zurück (kein Body)
      if (r.status === 202 || r.status === 200) return ok({ messageId: null })

      // Fehlerfall
      let errMsg = `HTTP ${r.status}`
      try {
        const d = await r.json()
        errMsg = d.error?.message ?? errMsg
      } catch {}
      return fail(r.status, errMsg)
    }

    return fail(400, `Unbekannte action: ${action}`)

  } catch (err) {
    console.error('[onedrive-api]', err)
    return fail(500, String(err))
  }
}
