/**
 * /api/list-folders
 * Gibt alle IMAP-Ordner eines Kontos zurück.
 * GET /api/list-folders?account=hostinger
 */
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
  const cfg     = ACCOUNTS[account]
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
    const list = await client.list('', '*')
    await client.logout()

    const folders = list
      .filter(mb => !mb.flags?.has('\\Noselect'))
      .map(mb => ({
        path:       mb.path,
        name:       mb.name,
        specialUse: mb.specialUse ?? null,
      }))
      .sort((a, b) => {
        // INBOX immer oben
        if (a.path === 'INBOX') return -1
        if (b.path === 'INBOX') return 1
        return a.path.localeCompare(b.path)
      })

    return res.status(200).json({ folders })
  } catch (e) {
    console.error('[list-folders]', e.message)
    try { await client.logout() } catch {}
    return res.status(500).json({ error: e.message })
  }
}
