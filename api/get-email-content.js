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

// Anhänge <= 4 MB werden base64-inline zurückgegeben.
// Größere Anhänge erhalten tooLarge:true und werden über /api/download-attachment gestreamt.
const ATTACHMENT_INLINE_LIMIT = 4 * 1024 * 1024

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { uid, account = 'hostinger' } = req.query
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

    // Vollständige Rohdaten der E-Mail per UID laden
    let rawBuffer = null
    for await (const msg of client.fetch(String(uid), { source: true }, { uid: true })) {
      rawBuffer = msg.source
    }

    if (!rawBuffer) {
      await client.logout()
      return res.status(404).json({ error: 'E-Mail nicht gefunden (möglicherweise bereits gelöscht)' })
    }

    // Größen-Guard: > 25 MB → Vercel-Memory-Limit
    if (rawBuffer.length > 25 * 1024 * 1024) {
      await client.logout()
      return res.status(413).json({
        error:     'E-Mail zu groß für Inline-Anzeige',
        sizeBytes: rawBuffer.length,
      })
    }

    // MIME-Parsing mit mailparser
    const parsed = await simpleParser(rawBuffer)

    const attachments = (parsed.attachments ?? []).map(a => {
      if ((a.size ?? a.content?.length ?? 0) > ATTACHMENT_INLINE_LIMIT) {
        return {
          name:        a.filename || 'Anhang',
          contentType: a.contentType,
          size:        a.size ?? a.content?.length ?? 0,
          tooLarge:    true,
        }
      }
      return {
        name:        a.filename || 'Anhang',
        contentType: a.contentType,
        size:        a.size ?? a.content?.length ?? 0,
        data:        a.content?.toString('base64') ?? '',
      }
    })

    await client.logout()
    return res.status(200).json({
      text:        parsed.text  ?? null,
      html:        parsed.html  ?? null,
      from:        parsed.from?.value?.[0]?.address ?? null,
      to:          (parsed.to?.value ?? []).map(a => a.address).join(', ') || null,
      cc:          (parsed.cc?.value ?? []).map(a => a.address).join(', ') || null,
      attachments,
    })

  } catch (e) {
    console.error('[get-email-content]', e.message)
    try { await client.logout() } catch {}
    return res.status(500).json({ error: e.message })
  }
}
