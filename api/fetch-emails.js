import { ImapFlow } from 'imapflow'

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
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const account = req.query.account || 'hostinger'
  const since   = req.query.since   || null   // ISO-Datum z.B. "2025-01-01"
  const limit   = parseInt(req.query.limit || '50')
  const folder  = req.query.folder  || 'INBOX'

  const cfg = ACCOUNTS[account]
  if (!cfg) return res.status(400).json({ error: `Unbekanntes Konto: ${account}` })
  if (!cfg.user || !cfg.pass) {
    return res.status(500).json({ error: `IMAP-Zugangsdaten für ${account} nicht konfiguriert (Vercel Env Vars prüfen)` })
  }

  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  })

  try {
    await client.connect()
    await client.mailboxOpen(folder)

    const searchCriteria = since
      ? { since: new Date(since) }
      : { since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // letzte 30 Tage

    const messages = []
    const uids = await client.search(searchCriteria)

    // Neueste zuerst, maximal `limit`
    const relevantUids = uids.slice(-limit).reverse()

    for await (const msg of client.fetch(relevantUids.join(','), {
      envelope: true,
      bodyStructure: true,
      source: false,
    })) {
      const env = msg.envelope
      const from = env.from?.[0]
      messages.push({
        uid:     msg.uid,
        account,
        datum:   env.date?.toISOString() ?? new Date().toISOString(),
        von:     from?.address ?? '',
        vonName: from?.name    ?? '',
        betreff: env.subject   ?? '(kein Betreff)',
        an:      (env.to ?? []).map(a => a.address).join(', '),
        cc:      (env.cc ?? []).map(a => a.address).join(', '),
      })
    }

    await client.logout()
    return res.status(200).json({ emails: messages })
  } catch (e) {
    console.error('[fetch-emails]', e.message)
    try { await client.logout() } catch {}
    return res.status(500).json({ error: e.message })
  }
}
