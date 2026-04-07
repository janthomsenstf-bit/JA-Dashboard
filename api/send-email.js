import nodemailer from 'nodemailer'

const ACCOUNTS = {
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { to, from, subject, text, html, cc, bcc, account = 'hostinger' } = req.body ?? {}

  if (!to || !subject || (!text && !html)) {
    return res.status(400).json({ error: 'Fehlende Pflichtfelder: to, subject, text' })
  }

  const cfg = ACCOUNTS[account]
  if (!cfg) return res.status(400).json({ error: `Unbekanntes Konto: ${account}` })
  if (!cfg.user || !cfg.pass) {
    return res.status(500).json({ error: `SMTP-Zugangsdaten für ${account} nicht konfiguriert (Vercel Env Vars prüfen)` })
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    })

    await transporter.sendMail({
      from: from || cfg.user,
      to,
      cc:  cc  || undefined,
      bcc: bcc || undefined,
      subject,
      text: text || undefined,
      html: html || undefined,
    })

    return res.status(200).json({ success: true })
  } catch (e) {
    console.error('[send-email]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
