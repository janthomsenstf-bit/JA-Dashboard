/**
 * /api/mail-to-posteingang  (#18)
 *
 * Holt benannte Anhänge einer Mail per IMAP und lädt sie mit den OneDrive-
 * Sitzungs-Tokens des Nutzers in den Ordner "13. Posteingang" hoch — damit sie
 * der posteingang-verarbeiten-Skill einsortieren kann. Nichts wird gelöscht.
 *
 * POST { account, uid, filenames:[], tokens, targetFolder? }
 * → { success, hochgeladen:[{name,id}], uebersprungen:[{name,grund}], newTokens? }
 */
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'

const GRAPH = 'https://graph.microsoft.com/v1.0'
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

const IMAP_ACCOUNTS = {
  strato:    { host: process.env.IMAP_STRATO_HOST    || 'imap.strato.de',     port: 993, user: process.env.IMAP_STRATO_USER,    pass: process.env.IMAP_STRATO_PASS },
  hostinger: { host: process.env.IMAP_HOSTINGER_HOST || 'imap.hostinger.com', port: 993, user: process.env.IMAP_HOSTINGER_USER, pass: process.env.IMAP_HOSTINGER_PASS },
  gmail:     { host: process.env.IMAP_GMAIL_HOST     || 'imap.gmail.com',     port: 993, user: process.env.IMAP_GMAIL_USER,     pass: process.env.IMAP_GMAIL_PASS },
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.ONEDRIVE_CLIENT_ID,
      client_secret: process.env.ONEDRIVE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'Files.ReadWrite offline_access User.Read Mail.Send Mail.Read',
    }).toString(),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error_description ?? data.error ?? 'refresh_failed')
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? refreshToken, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000, tokenType: data.token_type ?? 'Bearer' }
}

const encPath = p => p.split('/').map(encodeURIComponent).join('/')

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { account = 'strato', uid, filenames, tokens: inputTokens, targetFolder = '13. Posteingang' } = req.body || {}
  if (!uid) return res.status(400).json({ error: 'uid fehlt' })
  if (!Array.isArray(filenames) || !filenames.length) return res.status(400).json({ error: 'filenames fehlt' })
  if (!inputTokens?.accessToken) return res.status(401).json({ error: 'tokens fehlen', needsReauth: true })

  const cfg = IMAP_ACCOUNTS[account]
  if (!cfg?.user || !cfg?.pass) return res.status(500).json({ error: `IMAP-Zugangsdaten für ${account} fehlen` })

  // Token ggf. erneuern
  let tokens = inputTokens, refreshed = false
  if (Date.now() > (tokens.expiresAt ?? 0) - 60_000) {
    if (!tokens.refreshToken) return res.status(401).json({ error: 'token_expired', needsReauth: true })
    try { tokens = await refreshAccessToken(tokens.refreshToken); refreshed = true }
    catch (e) { return res.status(401).json({ error: 'refresh_failed', message: String(e), needsReauth: true }) }
  }
  const newTokensField = refreshed ? { newTokens: tokens } : {}

  const imap = new ImapFlow({ host: cfg.host, port: cfg.port, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false })
  const hochgeladen = [], uebersprungen = []
  try {
    await imap.connect()
    await imap.mailboxOpen('INBOX')
    const msg = await imap.fetchOne(String(uid), { source: true }, { uid: true })
    if (!msg?.source) { await imap.logout(); return res.status(404).json({ error: 'E-Mail nicht gefunden', ...newTokensField }) }
    const parsed = await simpleParser(msg.source)
    await imap.logout()

    for (const fn of filenames) {
      const att = parsed.attachments?.find(a => (a.filename ?? '') === fn)
      if (!att?.content) { uebersprungen.push({ name: fn, grund: 'nicht gefunden' }); continue }
      const url = `${GRAPH}/me/drive/root:/${encPath(`${targetFolder}/${fn}`)}:/content?@microsoft.graph.conflictBehavior=rename`
      const r = await fetch(url, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokens.accessToken}`, 'Content-Type': att.contentType || 'application/octet-stream' },
        body: att.content,
      })
      if (r.ok) { const d = await r.json(); hochgeladen.push({ name: d.name || fn, id: d.id }) }
      else { const t = await r.text(); uebersprungen.push({ name: fn, grund: `Graph ${r.status}: ${t.slice(0, 120)}` }) }
    }
    return res.status(200).json({ success: true, hochgeladen, uebersprungen, ...newTokensField })
  } catch (e) {
    try { await imap.logout() } catch {}
    return res.status(500).json({ error: e.message, hochgeladen, uebersprungen, ...newTokensField })
  }
}
