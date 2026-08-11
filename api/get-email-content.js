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

  const {
    uid, account = 'hostinger', folder = 'INBOX', messageId = '',
    subject = '', from = '', date = '',
  } = req.query
  if (!uid && !messageId && !subject) {
    return res.status(400).json({ error: 'Parameter uid, messageId oder subject fehlt' })
  }

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

  const wantedMsgId = String(messageId || '').replace(/^<|>$/g, '').trim()

  // Betreff für die Fallback-Suche: gängige Präfixe (Re:/AW:/Fwd:/WG:) entfernen,
  // damit die Substring-Suche auch greift, wenn ein Präfix dazukam/wegfiel.
  const subjCore = String(subject || '')
    .replace(/^\s*((re|aw|fwd?|wg|antw|sv|vs)\s*(\[\d+\])?\s*:\s*)+/i, '')
    .trim()
  const fromAddr = String(from || '').trim()
  const dateObj  = date ? new Date(date) : null
  const dateOk   = dateObj && !isNaN(dateObj.getTime())

  try {
    await client.connect()

    let rawBuffer   = null
    let foundFolder = null

    // 1) Schnellpfad: per UID im angegebenen Ordner (Standard INBOX). Sicher – UID ist pro Ordner eindeutig.
    if (uid) {
      try {
        await client.mailboxOpen(folder)
        for await (const msg of client.fetch(String(uid), { source: true }, { uid: true })) rawBuffer = msg.source
        if (rawBuffer) foundFolder = folder
      } catch { /* Ordner nicht öffenbar → weiter zur ordnerübergreifenden Suche */ }
    }

    // Alle Ordner des Kontos ermitteln (inkl. Gesendet/Papierkorb/Archiv/Unterordner),
    // wahrscheinlichste zuerst. Wird für Message-ID- UND Betreff/Absender-Suche genutzt.
    let allPaths = []
    if (!rawBuffer && (wantedMsgId || (subjCore && subjCore.length >= 4))) {
      let boxes = []
      try { boxes = await client.list() } catch {}
      const rank = p => /sent|gesend|papierkorb|trash|deleted|junk|spam|archiv/i.test(p) ? 0 : 1
      allPaths = boxes
        .map(b => b.path)
        .filter(p => p && !/\bnoselect\b/i.test(p))
        .sort((a, b) => rank(a) - rank(b))
        .slice(0, 40)
    }

    // Datumsfenster (±4 Tage) für die Betreff/Absender-Suche – grenzt Treffer ein.
    let sinceD = null, beforeD = null
    if (dateOk) {
      sinceD  = new Date(dateObj.getTime() - 4 * 24 * 60 * 60 * 1000)
      beforeD = new Date(dateObj.getTime() + 4 * 24 * 60 * 60 * 1000)
    }

    // 2) + 3) Ordnerübergreifend suchen: pro Ordner erst per Message-ID (global eindeutig →
    //     nie eine falsche Mail), sonst per Betreff + Absender + Datumsfenster (für Altmails
    //     ohne Message-ID). So werden auch verschobene/gesendete/gelöschte Mails gefunden.
    if (!rawBuffer && allPaths.length) {
      for (const p of allPaths) {
        try {
          await client.mailboxOpen(p)

          // a) Präzise per Message-ID
          if (wantedMsgId) {
            const ids = await client.search({ header: { 'message-id': wantedMsgId } }, { uid: true })
            if (ids && ids.length) {
              for await (const msg of client.fetch(ids[ids.length - 1], { source: true }, { uid: true })) rawBuffer = msg.source
              if (rawBuffer) { foundFolder = p; break }
            }
          }

          // b) Fallback per Betreff (+ Absender + Datumsfenster) – IMAP verknüpft alle Kriterien mit UND
          if (subjCore && subjCore.length >= 4) {
            const crit = { header: { subject: subjCore } }
            if (fromAddr) crit.from = fromAddr
            if (sinceD)   crit.since  = sinceD
            if (beforeD)  crit.before = beforeD
            const ids = await client.search(crit, { uid: true })
            if (ids && ids.length) {
              for await (const msg of client.fetch(ids[ids.length - 1], { source: true }, { uid: true })) rawBuffer = msg.source
              if (rawBuffer) { foundFolder = p; break }
            }
          }
        } catch { /* dieser Ordner nicht durchsuchbar → nächster */ }
      }
    }

    if (!rawBuffer) {
      await client.logout()
      return res.status(404).json({ error: 'E-Mail in keinem Ordner gefunden (evtl. endgültig gelöscht)' })
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
      folder:      foundFolder,
      text:        parsed.text  ?? null,
      html:        parsed.html  ?? null,
      from:        parsed.from?.value?.[0]?.address ?? null,
      to:          (parsed.to?.value ?? []).map(a => a.address).join(', ') || null,
      cc:          (parsed.cc?.value ?? []).map(a => a.address).join(', ') || null,
      messageId:   parsed.messageId ?? null,
      attachments,
    })

  } catch (e) {
    console.error('[get-email-content]', e.message)
    try { await client.logout() } catch {}
    return res.status(500).json({ error: e.message })
  }
}
