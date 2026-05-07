import nodemailer  from 'nodemailer'
import { ImapFlow } from 'imapflow'

// ── SMTP-Konfiguration ────────────────────────────────────────────────────────
const SMTP_ACCOUNTS = {
  hostinger: {
    host: process.env.SMTP_HOSTINGER_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_HOSTINGER_PORT || '465'),
    user: process.env.SMTP_HOSTINGER_USER,
    pass: process.env.SMTP_HOSTINGER_PASS,
  },
  strato: {
    host: process.env.SMTP_STRATO_HOST || 'smtp.strato.de',
    port: parseInt(process.env.SMTP_STRATO_PORT || '465'),
    user: process.env.SMTP_STRATO_USER,
    pass: process.env.SMTP_STRATO_PASS,
  },
}

// ── IMAP-Konfiguration (für Sent-Ordner-Append) ───────────────────────────────
// Nutzt IMAP_*-Vars falls vorhanden, sonst SMTP_*-Vars (meist gleiche Zugangsdaten)
const IMAP_ACCOUNTS = {
  hostinger: {
    host: process.env.IMAP_HOSTINGER_HOST || 'imap.hostinger.com',
    port: parseInt(process.env.IMAP_HOSTINGER_PORT || '993'),
    user: process.env.IMAP_HOSTINGER_USER || process.env.SMTP_HOSTINGER_USER,
    pass: process.env.IMAP_HOSTINGER_PASS || process.env.SMTP_HOSTINGER_PASS,
  },
  strato: {
    host: process.env.IMAP_STRATO_HOST || 'imap.strato.de',
    port: parseInt(process.env.IMAP_STRATO_PORT || '993'),
    user: process.env.IMAP_STRATO_USER || process.env.SMTP_STRATO_USER,
    pass: process.env.IMAP_STRATO_PASS || process.env.SMTP_STRATO_PASS,
  },
}

// ── Raw-MIME-Nachricht bauen (für IMAP append) ────────────────────────────────
async function buildRawMessage(mailOptions) {
  const streamTransport = nodemailer.createTransport({ streamTransport: true, newline: 'unix' })
  const { message } = await streamTransport.sendMail(mailOptions)
  const chunks = []
  for await (const chunk of message) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

// ── Gesendete Mail in Sent-Ordner kopieren ────────────────────────────────────
async function appendToSentFolder(imapCfg, rawMessage) {
  const client = new ImapFlow({
    host:   imapCfg.host,
    port:   imapCfg.port,
    secure: true,
    auth:   { user: imapCfg.user, pass: imapCfg.pass },
    logger: false,
  })

  await client.connect()
  try {
    // 1. Alle Ordner listen + Special-Use-Flag prüfen
    let sentPath = null
    const list = await client.list('', '*')
    for (const mb of list) {
      const su = (mb.specialUse ?? '').toLowerCase()
      if (su === '\\sent' || su === 'sent') {
        sentPath = mb.path
        break
      }
    }

    // 2. Fallback: bekannte Ordnernamen durchprobieren (Hostinger: INBOX.Sent)
    if (!sentPath) {
      const candidates = [
        'INBOX.Sent', 'Sent', 'Sent Items', 'Gesendete Elemente',
        'Gesendet', 'INBOX.Gesendet', 'Sent Messages',
      ]
      for (const name of candidates) {
        try {
          await client.status(name, { messages: true })
          sentPath = name
          break
        } catch { /* nächsten versuchen */ }
      }
    }

    // 3. Letzter Versuch: irgendeinen Ordner mit "sent"/"gesendet" im Pfad finden
    if (!sentPath) {
      const fallback = list.find(mb =>
        mb.path.toLowerCase().includes('sent') ||
        mb.path.toLowerCase().includes('gesendet')
      )
      if (fallback) sentPath = fallback.path
    }

    if (sentPath) {
      await client.append(sentPath, rawMessage, ['\\Seen'])
      console.log(`[send-email] Kopie in "${sentPath}" abgelegt.`)
    } else {
      console.warn('[send-email] Kein Sent-Ordner gefunden — Kopie nicht gespeichert.')
    }
  } finally {
    await client.logout().catch(() => {})
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  const { to, from, subject, text, html, cc, bcc, account = 'hostinger', attachments = [] } = req.body ?? {}

  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ error: 'Fehlende Pflichtfelder: to, subject, text' })
  }

  const smtpCfg = SMTP_ACCOUNTS[account]
  if (!smtpCfg) return res.status(400).json({ error: `Unbekanntes Konto: ${account}` })
  if (!smtpCfg.user || !smtpCfg.pass) {
    return res.status(500).json({ error: `SMTP-Zugangsdaten für ${account} nicht konfiguriert` })
  }

  // Anhänge aufbereiten
  const parsedAttachments = Array.isArray(attachments)
    ? attachments.map(a => ({
        filename:    a.filename,
        content:     Buffer.from(a.content, 'base64'),
        contentType: a.contentType || 'application/octet-stream',
      }))
    : []

  // ── From-Adresse prüfen: SMTP-Server erlaubt nur Versand von authentifizierter Adresse ──
  // Falls abweichende Absenderadresse angegeben, als Reply-To setzen (Antworten landen trotzdem dort)
  function extractEmail(addr) {
    if (!addr) return ''
    const m = addr.match(/<([^>]+)>/)
    return (m ? m[1] : addr).toLowerCase().trim()
  }
  const desiredFrom  = from || smtpCfg.user
  const desiredEmail = extractEmail(desiredFrom)
  const smtpEmail    = (smtpCfg.user ?? '').toLowerCase().trim()
  const effectiveFrom = desiredEmail === smtpEmail ? desiredFrom : smtpCfg.user
  const replyTo       = desiredEmail !== smtpEmail ? desiredFrom : undefined

  const mailOptions = {
    from:    effectiveFrom,
    replyTo: replyTo,
    to,
    cc:      cc  || undefined,
    bcc:     bcc || undefined,
    subject,
    text:    text || undefined,
    html:    html || undefined,
    attachments: parsedAttachments,
  }

  try {
    // ── 1. E-Mail via SMTP senden ──
    const transporter = nodemailer.createTransport({
      host:   smtpCfg.host,
      port:   smtpCfg.port,
      secure: smtpCfg.port === 465,
      auth:   { user: smtpCfg.user, pass: smtpCfg.pass },
    })
    const info = await transporter.sendMail(mailOptions)
    const messageId = info.messageId ?? null

    // ── 2. Kopie in Sent-Ordner per IMAP ablegen (blocking, mit Ergebnis) ──
    let sentFolderOk  = false
    let sentFolderErr = null
    const imapCfg = IMAP_ACCOUNTS[account]
    if (imapCfg?.user && imapCfg?.pass) {
      try {
        const raw = await buildRawMessage(mailOptions)
        await appendToSentFolder(imapCfg, raw)
        sentFolderOk = true
      } catch (e) {
        sentFolderErr = e.message
        console.warn('[send-email] Sent-Ordner append fehlgeschlagen:', e.message)
      }
    }

    return res.status(200).json({ success: true, messageId, sentFolderOk, sentFolderErr })
  } catch (e) {
    console.error('[send-email]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
