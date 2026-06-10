/**
 * /api/download-attachment
 * Lädt einen einzelnen E-Mail-Anhang direkt per IMAP und streamt ihn
 * als Datei-Download – ohne Vercel Response-Limit (kein JSON-Wrapper).
 *
 * GET /api/download-attachment?uid=123&account=hostinger&name=Rechnung.pdf
 *
 * Unterstützt Anhänge bis ~25 MB (Vercel Streaming-Limit).
 */
import { ImapFlow }    from 'imapflow'
import { simpleParser } from 'mailparser'

const ACCOUNTS = {
  hostinger: {
    host: process.env.IMAP_HOSTINGER_HOST || 'imap.hostinger.com',
    port: parseInt(process.env.IMAP_HOSTINGER_PORT || '993'),
    user: process.env.IMAP_HOSTINGER_USER,
    pass: process.env.IMAP_HOSTINGER_PASS,
  },
  strato: {
    host: process.env.IMAP_STRATO_HOST || 'imap.strato.de',
    port: parseInt(process.env.IMAP_STRATO_PORT || '993'),
    user: process.env.IMAP_STRATO_USER,
    pass: process.env.IMAP_STRATO_PASS,
  },
  gmail: {
    host: process.env.IMAP_GMAIL_HOST || 'imap.gmail.com',
    port: parseInt(process.env.IMAP_GMAIL_PORT || '993'),
    user: process.env.IMAP_GMAIL_USER,
    pass: process.env.IMAP_GMAIL_PASS,
  },
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { uid, account = 'hostinger', name } = req.query
  if (!uid) return res.status(400).json({ error: 'Parameter uid fehlt' })

  const cfg = ACCOUNTS[account]
  if (!cfg) return res.status(400).json({ error: `Unbekanntes Konto: ${account}` })
  if (!cfg.user || !cfg.pass) {
    return res.status(500).json({ error: `IMAP-Zugangsdaten für ${account} nicht konfiguriert` })
  }

  const client = new ImapFlow({
    host:   cfg.host,
    port:   cfg.port,
    secure: true,
    auth:   { user: cfg.user, pass: cfg.pass },
    logger: false,
  })

  try {
    await client.connect()
    await client.mailboxOpen('INBOX')

    let rawBuffer = null
    for await (const msg of client.fetch(String(uid), { source: true }, { uid: true })) {
      rawBuffer = msg.source
    }

    if (!rawBuffer) {
      await client.logout()
      return res.status(404).json({ error: 'E-Mail nicht gefunden' })
    }

    const parsed = await simpleParser(rawBuffer)

    // Gesuchten Anhang per Name finden
    const target = name
      ? parsed.attachments?.find(a => (a.filename ?? '') === decodeURIComponent(name))
      : parsed.attachments?.[0]

    await client.logout()

    if (!target?.content) {
      return res.status(404).json({ error: `Anhang "${name}" nicht gefunden` })
    }

    const filename    = target.filename || 'anhang'
    const contentType = target.contentType || 'application/octet-stream'
    const safeFilename = encodeURIComponent(filename)

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${safeFilename}`)
    res.setHeader('Content-Length', target.content.length)
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).end(target.content)

  } catch (e) {
    console.error('[download-attachment]', e.message)
    try { await client.logout() } catch {}
    return res.status(500).json({ error: e.message })
  }
}
