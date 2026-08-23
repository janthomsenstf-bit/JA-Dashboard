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
const REV = 6

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const {
    uid, account = 'hostinger', folder = 'INBOX', messageId = '',
    subject = '', from = '', date = '', hint = '', debug = '',
  } = req.query
  if (!uid && !messageId && !subject) {
    return res.status(400).json({ error: 'Parameter uid, messageId oder subject fehlt' })
  }

  // account=auto: Konto anhand der Absenderadresse bestimmen. Nötig für Mails,
  // die im Dashboard verfasst wurden – die haben kein sourceAccount.
  const adrDomain = a => String(a || '').toLowerCase().split('@')[1] || ''
  let accountKey = account
  if (account === 'auto') {
    const ziel = String(from || '').toLowerCase().match(/[\w.+-]+@[\w.-]+/)?.[0] || ''
    accountKey =
      Object.keys(ACCOUNTS).find(k => (ACCOUNTS[k].user || '').toLowerCase() === ziel) ||
      Object.keys(ACCOUNTS).find(k => ACCOUNTS[k].user && adrDomain(ACCOUNTS[k].user) === adrDomain(ziel)) ||
      ''
    if (!accountKey) {
      return res.status(400).json({
        error: `Kein IMAP-Konto für ${ziel || '(keine Absenderadresse)'} hinterlegt`,
        konten: Object.keys(ACCOUNTS).filter(k => ACCOUNTS[k].user),
      })
    }
  }

  const cfg = ACCOUNTS[accountKey]
  if (!cfg) return res.status(400).json({ error: `Unbekanntes Konto: ${account}` })
  if (!cfg.user || !cfg.pass) {
    return res.status(500).json({ error: `IMAP-Zugangsdaten für ${accountKey} nicht konfiguriert` })
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
  const dateObj  = date ? new Date(date) : null
  const dateOk   = dateObj && !isNaN(dateObj.getTime())
  const canSearchSubject = subjCore.length >= 4

  // Mandantenname als Ordner-Hinweis. Rechtsformen und kurze Füllwörter raus,
  // damit „Mobile Gate Security A/S" auf den Ordner „…Mandanten.Mobile Gate
  // Security AS" zeigt. Wird nur zum Sortieren benutzt, filtert nichts weg.
  const hintTokens = String(hint || '')
    .toLowerCase()
    .replace(/[^\wäöüß\s-]+/g, ' ')
    .split(/[\s-]+/)
    .filter(t => t.length >= 4 && !/^(gmbh|ugmbh|haftungsbeschr|mbh|kgaa|gbr|ohne|und|der|die|das)$/.test(t))

  const trace = []                       // Diagnose – landet im Response nur bei ?debug=1
  const t0 = Date.now()
  const DEADLINE_MS = 45000              // Zeitbudget, damit kein Gateway-Timeout entsteht
  const outOfTime = () => (Date.now() - t0) > DEADLINE_MS

  try {
    await client.connect()

    let rawBuffer   = null
    let foundFolder = null
    let foundVia    = null

    // Gegenprobe, BEVOR ein Treffer übernommen wird.
    //
    // Ein Betreff allein beweist nichts: „Post – Bank" existiert mehrfach in
    // verschiedenen Postfächern. Ohne diese Prüfung lieferte die Betreff-Stufe
    // eine wildfremde Mail zurück – und das Frontend schrieb deren Text und
    // Anhänge in den Mandanten-Eintrag. Also: erst Briefkopf holen, prüfen,
    // dann erst den Inhalt.
    function passtZurAnfrage(env) {
      if (!env) return true                                  // nichts zum Prüfen da
      const mid = String(env.messageId || '').replace(/^<|>$/g, '')
      if (wantedMsgId) return mid === wantedMsgId            // exakt oder gar nicht
      if (!fromAddr && !dateOk) return true                  // keine Prüfkriterien vorhanden
      const adr = list => (list || []).map(x => String(x.address || '').toLowerCase())
      const beteiligte = [...adr(env.from), ...adr(env.sender), ...adr(env.replyTo), ...adr(env.to), ...adr(env.cc)]
      if (fromAddr && beteiligte.includes(fromAddr)) return true
      if (dateOk && env.date) return Math.abs(new Date(env.date).getTime() - dateObj.getTime()) <= 8 * 864e5
      return false
    }

    // Passende Mail zu einer Suchbedingung im aktuell geöffneten Ordner holen.
    async function tryFetch(crit, label, path) {
      if (rawBuffer || outOfTime()) return
      let ids = []
      try {
        ids = await client.search(crit, { uid: true })
      } catch (e) { trace.push({ path, label, error: e.message }); return }
      if (!ids || !ids.length) { trace.push({ path, label, hits: 0 }); return }

      let verworfen = 0
      for (const u of ids.slice(-5).reverse()) {             // neueste zuerst, höchstens 5
        if (outOfTime()) break
        let env = null
        try {
          for await (const m of client.fetch(String(u), { envelope: true }, { uid: true })) env = m.envelope
        } catch { /* Briefkopf nicht lesbar → Kandidat überspringen */ continue }
        if (!passtZurAnfrage(env)) { verworfen++; continue }
        for await (const m of client.fetch(String(u), { source: true }, { uid: true })) rawBuffer = m.source
        if (rawBuffer) { foundFolder = path; foundVia = label; break }
      }
      trace.push({ path, label, hits: ids.length, ...(verworfen ? { verworfen } : {}) })
    }

    // 1) Schnellpfad: per UID im Herkunftsordner. UIDs sind nur INNERHALB eines
    //    Ordners eindeutig – deshalb zählt der mitgelieferte Ordner, nicht pauschal INBOX.
    if (uid) {
      const cand = [folder, 'INBOX'].filter((v, i, a) => v && a.indexOf(v) === i)
      for (const p of cand) {
        try {
          await client.mailboxOpen(p, { readOnly: true })
          // Auch hier erst den Briefkopf prüfen: Eine veraltete UID kann in einem
          // anderen Ordner längst einer ganz anderen Mail gehören.
          let env = null
          for await (const m of client.fetch(String(uid), { envelope: true }, { uid: true })) env = m.envelope
          if (!env) { trace.push({ path: p, label: 'uid', hits: 0 }); continue }
          if (!passtZurAnfrage(env)) { trace.push({ path: p, label: 'uid', hits: 1, verworfen: 1 }); continue }
          for await (const m of client.fetch(String(uid), { source: true }, { uid: true })) rawBuffer = m.source
          if (rawBuffer) { foundFolder = p; foundVia = 'uid'; break }
        } catch (e) { trace.push({ path: p, label: 'uid', error: e.message }) }
      }
    }

    // Ordnerliste (inkl. Gesendet/Papierkorb/Archiv/Unterordner) in sinnvoller Reihenfolge:
    // Herkunftsordner → INBOX → Ordner mit Mandantennamen → Sent/Trash → Rest → Archiv → Junk.
    //
    // Die Reihenfolge ist entscheidend, nicht kosmetisch: das Strato-Konto hat 232
    // Ordner. Ein Blindscan läuft ins Zeitbudget, bevor er den Mandantenordner
    // erreicht. Mit dem Namenshinweis wird derselbe Fund aus ~48s Timeout zu ~5s.
    let allPaths = []
    if (!rawBuffer && (wantedMsgId || canSearchSubject)) {
      let boxes = []
      try { boxes = await client.list() } catch (e) { trace.push({ label: 'list', error: e.message }) }
      // Wie viele Wörter des Mandantennamens stecken im Ordnerpfad?
      const hintScore = (p) => {
        if (!hintTokens.length) return 0
        const lower = p.toLowerCase()
        return hintTokens.filter(t => lower.includes(t)).length
      }
      const rank = (p) => {
        if (p === folder)                                    return 0
        if (/^inbox$/i.test(p))                              return 1
        if (hintScore(p) > 0)                                return 2
        if (/sent|gesend|papierkorb|trash|deleted/i.test(p)) return 3
        if (/archiv/i.test(p))                               return 5
        if (/junk|spam/i.test(p))                            return 6
        return 4
      }
      allPaths = boxes
        .filter(b => b.path && !(b.flags && typeof b.flags.has === 'function' && b.flags.has('\\Noselect')))
        .map(b => b.path)
        // innerhalb gleicher Stufe: mehr Namenstreffer zuerst
        .sort((a, b) => rank(a) - rank(b) || hintScore(b) - hintScore(a) || a.localeCompare(b))
      trace.push({ label: 'folders', count: allPaths.length, hint: hintTokens.join(' ') || null })
    }

    // Datumsfenster (±7 Tage) – grenzt die Betreff-Suche ein, ohne an
    // Zeitzonen- oder Ablageverschiebungen zu scheitern.
    let sinceD = null, beforeD = null
    if (dateOk) {
      sinceD  = new Date(dateObj.getTime() - 7 * 864e5)
      beforeD = new Date(dateObj.getTime() + 7 * 864e5)
    }

    // 2) Ordnerübergreifend suchen, pro Ordner in absteigender Präzision:
    //    a) Message-ID (global eindeutig – trifft nie die falsche Mail)
    //    b) Betreff + Absender + Datumsfenster
    //    c) Betreff + Absender       (Datum in der Ablage verschoben)
    //    d) Betreff                  (Absender im Header anders geschrieben)
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
          // Datumsfenster MUSS über sentSince/sentBefore laufen, nicht über
          // since/before: Letztere schreibt imapflow still auf YOUNGER/OLDER um,
          // sobald der Server die WITHIN-Extension kann, und rechnet dabei relativ
          // zu "jetzt". Ein Fensterende in der Zukunft – bei frischen Mails immer –
          // wird auf 0 geklemmt → `OLDER 0` → null Treffer.
          // sentSince/sentBefore gehen direkt als SENTSINCE/SENTBEFORE raus und
          // filtern über den Date:-Header, der zu unserem gesendetAm passt.
          const base = { subject: subjCore }
          if (sinceD)  base.sentSince  = sinceD
          if (beforeD) base.sentBefore = beforeD
          if (fromAddr && sinceD) await tryFetch({ ...base, from: fromAddr }, 'subject+from+date', p)
          if (fromAddr)           await tryFetch({ subject: subjCore, from: fromAddr }, 'subject+from', p)
          await tryFetch({ subject: subjCore }, 'subject', p)
        }
      }
    }

    if (!rawBuffer) {
      await client.logout()
      return res.status(404).json({
        // Timeout und "nicht da" sind zwei verschiedene Dinge – vorher stand in
        // beiden Fällen "evtl. endgültig gelöscht", was in die Irre führt.
        error: outOfTime()
          ? `Zeitlimit erreicht – ${allPaths.length} Ordner konnten nicht alle durchsucht werden. Die Mail ist vermutlich noch da, nur weiter hinten.`
          : 'E-Mail in keinem Ordner gefunden (evtl. endgültig gelöscht)',
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
      account:     accountKey,   // bei account=auto: welches Konto es wirklich war
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
