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

// Bei ?debug=1 mitgeliefert – so ist erkennbar, ob ein Deploy schon live ist.
// Bei inhaltlichen Änderungen an der Suchlogik hochzählen.
const REV = 3

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const {
    uid, account = 'hostinger', folder = 'INBOX', messageId = '',
    subject = '', from = '', date = '', debug = '',
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
  // damit die Suche auch greift, wenn ein Präfix dazukam oder wegfiel.
  const subjCore = String(subject || '')
    .replace(/^\s*((re|aw|fwd?|wg|antw|sv|vs)\s*(\[\d+\])?\s*:\s*)+/i, '')
    .trim()
  // Nur die nackte Mailadresse (ohne "Name <...>") – sonst matcht IMAP FROM schlecht.
  const fromAddr = (String(from || '').match(/[\w.+-]+@[\w.-]+/) || [''])[0].toLowerCase()
  const canSearchSubject = subjCore.length >= 4

  const trace = []                       // Diagnose – landet im Response nur bei ?debug=1
  const t0 = Date.now()
  const DEADLINE_MS = 45000              // Zeitbudget, damit kein Gateway-Timeout entsteht
  const outOfTime = () => (Date.now() - t0) > DEADLINE_MS

  try {
    await client.connect()

    let rawBuffer   = null
    let foundFolder = null
    let foundVia    = null

    // Neueste Mail zu einer Suchbedingung im aktuell geöffneten Ordner holen.
    async function tryFetch(crit, label, path) {
      if (rawBuffer || outOfTime()) return
      let ids = []
      try {
        ids = await client.search(crit, { uid: true })
      } catch (e) { trace.push({ path, label, error: e.message }); return }
      if (!ids || !ids.length) { trace.push({ path, label, hits: 0 }); return }
      trace.push({ path, label, hits: ids.length })
      for await (const msg of client.fetch(ids[ids.length - 1], { source: true }, { uid: true })) {
        rawBuffer = msg.source
      }
      if (rawBuffer) { foundFolder = path; foundVia = label }
    }

    // 1) Schnellpfad: per UID im Herkunftsordner. UIDs sind nur INNERHALB eines
    //    Ordners eindeutig – deshalb zählt der mitgelieferte Ordner, nicht pauschal INBOX.
    if (uid) {
      const cand = [folder, 'INBOX'].filter((v, i, a) => v && a.indexOf(v) === i)
      for (const p of cand) {
        try {
          await client.mailboxOpen(p, { readOnly: true })
          for await (const msg of client.fetch(String(uid), { source: true }, { uid: true })) rawBuffer = msg.source
          if (rawBuffer) { foundFolder = p; foundVia = 'uid'; break }
          trace.push({ path: p, label: 'uid', hits: 0 })
        } catch (e) { trace.push({ path: p, label: 'uid', error: e.message }) }
      }
    }

    // Ordnerliste (inkl. Gesendet/Papierkorb/Archiv/Unterordner) in sinnvoller Reihenfolge:
    // Herkunftsordner → INBOX → Sent/Trash → normale Mandantenordner → Archiv → Junk.
    let allPaths = []
    if (!rawBuffer && (wantedMsgId || canSearchSubject)) {
      let boxes = []
      try { boxes = await client.list() } catch (e) { trace.push({ label: 'list', error: e.message }) }
      const rank = (p) => {
        if (p === folder)                                    return 0
        if (/^inbox$/i.test(p))                              return 1
        if (/sent|gesend|papierkorb|trash|deleted/i.test(p)) return 2
        if (/archiv/i.test(p))                               return 5
        if (/junk|spam/i.test(p))                            return 6
        return 3
      }
      allPaths = boxes
        .filter(b => b.path && !(b.flags && typeof b.flags.has === 'function' && b.flags.has('\\Noselect')))
        .map(b => b.path)
        .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
      trace.push({ label: 'folders', count: allPaths.length })
    }

    // 2) Ordnerübergreifend suchen, pro Ordner in absteigender Präzision:
    //    a) Message-ID (global eindeutig – trifft nie die falsche Mail)
    //    b) Betreff + Absender + Datumsfenster
    //    c) Betreff + Datumsfenster  (Absender im Header anders geschrieben)
    //    d) Betreff                  (Datum in der Ablage verschoben)
    //
    //    Wichtig: `subject:` = IMAP SUBJECT und sucht im dekodierten Envelope.
    //    Das frühere `header: { subject }` = HEADER SUBJECT sucht im rohen,
    //    MIME-kodierten Header und findet Betreffs mit Umlauten oder mit
    //    Zeilenumbruch (Header-Folding) nicht – deshalb schlug der Fallback fehl.
    if (!rawBuffer && allPaths.length) {
      for (const p of allPaths) {
        if (rawBuffer || outOfTime()) break
        try { await client.mailboxOpen(p, { readOnly: true }) }
        catch (e) { trace.push({ path: p, label: 'open', error: e.message }); continue }

        if (wantedMsgId) await tryFetch({ header: { 'message-id': wantedMsgId } }, 'message-id', p)
        if (!rawBuffer && canSearchSubject) {
          // Bewusst OHNE Datumsfenster. Weder `since`/`before` noch
          // `sentSince`/`sentBefore` haben hier Treffer geliefert (im Trace jeweils
          // 0 Treffer, während dieselbe Suche ohne Datum die Mail fand). Ein Filter,
          // der die gesuchte Mail wegwirft, ist schlimmer als gar kein Filter –
          // Betreff + Absender grenzen bereits gut genug ein, und die Message-ID
          // oben ist ohnehin der exakte Weg.
          if (fromAddr) await tryFetch({ subject: subjCore, from: fromAddr }, 'subject+from', p)
          await tryFetch({ subject: subjCore }, 'subject', p)
        }
      }
    }

    if (!rawBuffer) {
      await client.logout()
      return res.status(404).json({
        error:   'E-Mail in keinem Ordner gefunden (evtl. endgültig gelöscht)',
        gesucht: { uid: uid || null, folder, account, messageId: wantedMsgId || null, subject: subjCore || null, from: fromAddr || null },
        timeout: outOfTime(),
        ...(debug ? { rev: REV, trace, ms: Date.now() - t0 } : {}),
      })
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
      foundVia,
      text:        parsed.text  ?? null,
      html:        parsed.html  ?? null,
      from:        parsed.from?.value?.[0]?.address ?? null,
      to:          (parsed.to?.value ?? []).map(a => a.address).join(', ') || null,
      cc:          (parsed.cc?.value ?? []).map(a => a.address).join(', ') || null,
      messageId:   parsed.messageId ?? null,
      attachments,
      ...(debug ? { rev: REV, trace, ms: Date.now() - t0 } : {}),
    })

  } catch (e) {
    console.error('[get-email-content]', e.message)
    try { await client.logout() } catch {}
    return res.status(500).json({ error: e.message, ...(debug ? { trace } : {}) })
  }
}
