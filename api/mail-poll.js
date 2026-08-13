/**
 * /api/mail-poll  —  Mail-zu-bot_inbox-Feeder (Pilot, Aufgabe #15)
 *
 * Holt neue Mails EINES Kontos, lässt Claude klassifizieren
 * (Spam? / Mandant / Zusammenfassung + Tags / Handlungsvorschlag),
 * gleicht den Absender deterministisch gegen die Mandanten-E-Mails ab
 * und schreibt neue Einträge in bot_inbox (serverseitig, Service-Key).
 *
 * Aufruf (GET):  /api/mail-poll?account=strato&days=5&limit=15[&secret=...]
 * Schreibt NUR vor (Status 'neu') — nichts wird gesendet/gelöscht.
 *
 * Env (Vercel): IMAP_STRATO_* / IMAP_HOSTINGER_*, SUPABASE_SERVICE_ROLE_KEY,
 *               ANTHROPIC_API_KEY, optional MAIL_POLL_SECRET.
 */
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wtvijpdfdfyagmiwwnlw.supabase.co'
const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Modell bewusst als Konstante — kann später auf ein stärkeres gehoben werden.
const CLAUDE_MODEL = process.env.MAIL_POLL_MODEL || 'claude-sonnet-4-6'
const FEEDER_VERSION = 'v9-spam'

const IMAP_ACCOUNTS = {
  strato:    { host: process.env.IMAP_STRATO_HOST    || 'imap.strato.de',    port: 993, user: process.env.IMAP_STRATO_USER,    pass: process.env.IMAP_STRATO_PASS },
  hostinger: { host: process.env.IMAP_HOSTINGER_HOST || 'imap.hostinger.com', port: 993, user: process.env.IMAP_HOSTINGER_USER, pass: process.env.IMAP_HOSTINGER_PASS },
}

const FREEMAIL = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'gmx.de', 'gmx.net', 'web.de', 't-online.de', 'yahoo.com', 'icloud.com'])

// ── Mandanten laden (inkl. Kontakt-Mails für den Abgleich) ───────────────────────
async function loadClients() {
  const { data, error } = await sb.from('user_data').select('value').eq('key', 'spielbuch-data-v2').limit(1).single()
  if (error || !data?.value) return []
  const clients = Array.isArray(data.value) ? data.value : []
  return clients.filter(c => !c.archiviert).map(c => ({
    id: c.id,
    name: c.name,
    mandantennummer: c.mandantennummer || '',
    emails: (c.kontakte ?? []).map(k => k.email).filter(Boolean),
  }))
}

// Gelernte Spam-Liste (Absender + Domains) aus user_data 'mail-spam-v1'.
async function loadSpamList() {
  const { data } = await sb.from('user_data').select('value').eq('key', 'mail-spam-v1').limit(1).single()
  const v = data?.value
  const arr = Array.isArray(v) ? v : (Array.isArray(v?.eintraege) ? v.eintraege : [])
  return new Set(arr.map(x => String(x).toLowerCase().trim()).filter(Boolean))
}

// Deterministischer Treffer über die exakte Absender-Adresse (harter Anker).
function clientByExactEmail(clients, sender) {
  const s = (sender || '').toLowerCase().trim()
  if (!s) return null
  return clients.find(c => c.emails.some(e => e.toLowerCase() === s)) || null
}

// Name -> Client (füllt die ID nach, wenn Claude nur den Namen liefert).
const normName = s => String(s || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '')
function clientByName(clients, name) {
  const n = normName(name)
  if (!n) return null
  return clients.find(c => { const cn = normName(c.name); return cn && (cn === n || cn.includes(n) || n.includes(cn)) }) || null
}

// ── Claude ───────────────────────────────────────────────────────────────────────
async function callClaude(system, user, model = CLAUDE_MODEL) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 3000, system, messages: [{ role: 'user', content: user }] }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Claude API ${res.status}`)
  return data.content?.[0]?.text ?? ''
}

const SYSTEM_PROMPT = `Du bist der E-Mail-Assistent eines Steuerberaters. Du bekommst EINE eingegangene E-Mail
(Absender, Betreff, Textauszug) und eine Liste seiner Mandanten. Gib AUSSCHLIESSLICH ein JSON-Objekt zurück:

{
  "spam": true|false,                     // eindeutige Werbung/Phishing/Massenmail
  "spam_sicher": true|false,              // nur true, wenn zweifelsfrei Spam
  "client_id": "<id oder null>",          // zuständiger Mandant, sonst null
  "client_name": "<Name oder null>",
  "summary": "<1-3 knappe deutsche Sätze: worum geht es, was ist zu tun>",
  "tags": ["<3-6 kurze Schlagworte, klein, z.B. rechnung, frist, lohn, rueckfrage>"],
  "intent": "add_auftrag|add_notiz|draft_email|unknown",
  "draft": { ...je nach intent... }
}

intent-Regeln:
- add_auftrag: es ist eine Aufgabe abzuleiten (z.B. "brauche BA-Bescheinigung für Mitarbeiter Max, Juli").
  draft: { "bezeichnung": "...", "typ": "fibu|lohn|ust|jahresabschluss|est|beratung|freitext", "jahr": null, "monat": null, "notiz": "..." }
- add_notiz: reine Information/Ablage, keine Aufgabe.
  draft: { "bereich": "lohn|fibu|allgemein", "text": "...", "kontext": "..." }
- draft_email: eine Antwort ist nötig; entwirf sie kurz und geschäftlich.
  draft: { "betreff": "Re: ...", "text": "<Antwortentwurf>", "empfaenger": "<Absender-Adresse>" }
- unknown: unklar. draft: {}

Mandantenzuordnung: Ordne nur zu, wenn du sicher bist (Absender-Adresse, Firmen-/Personenname oder Aktenbezug passt zu einem Eintrag der Liste). Wenn du ihn findest, gib IMMER client_id UND client_name exakt aus der Liste zurück (nie nur eines von beiden). Der Mandant kann auch im Text genannt sein, nicht nur beim Absender. Im Zweifel beide auf null. Erfinde nichts.
Halte summary und draft.text knapp, damit die Antwort vollständig ins JSON passt.
Antworte NUR mit dem JSON, kein Text drumherum, kein Markdown.`

// ── Handler ────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Schutz: sobald MAIL_POLL_SECRET gesetzt ist, brauchen die teuren/gefaehrlichen Modi
  // (Abruf, ?reset=, ?rawtest=) das Secret. Ausgenommen nur die ungefaehrlichen Modi
  // ?ping (Versions-Ping) und ?spamadd (Spam-Lernen; wird vom eingeloggten Frontend aufgerufen,
  // das das Secret nicht sicher halten kann – spamadd fuegt nur der Spam-Liste hinzu).
  const oeffentlicherModus = req.query.ping || req.query.spamadd
  if (process.env.MAIL_POLL_SECRET && !oeffentlicherModus && req.query.secret !== process.env.MAIL_POLL_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Billiger Versions-Ping (kein IMAP/Claude) – für Deploy-Erkennung.
  if (req.query.ping) return res.status(200).json({ feederVersion: FEEDER_VERSION })

  // Roh-Test: trivialer Claude-Aufruf, zeigt die KOMPLETTE API-Antwort (Diagnose).
  // Optional ?model=... zum Vergleich verschiedener Modelle.
  if (req.query.rawtest) {
    const m = req.query.model || CLAUDE_MODEL
    let r, data
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: m, max_tokens: 200, system: 'Antworte nur mit JSON.', messages: [{ role: 'user', content: 'Gib exakt zurueck: {"ok":true}' }] }),
      })
      data = await r.json()
    } catch (e) { return res.status(200).json({ model: m, fetchError: e.message, keySet: !!process.env.ANTHROPIC_API_KEY }) }
    return res.status(200).json({
      model: m, keySet: !!process.env.ANTHROPIC_API_KEY, httpStatus: r.status,
      stop_reason: data.stop_reason ?? null, contentTypes: (data.content || []).map(c => c.type),
      textLen: (data.content?.[0]?.text || '').length, text: (data.content?.[0]?.text || '').slice(0, 120),
      usage: data.usage ?? null, apiError: data.error ?? null,
    })
  }

  // Aufräumen: löscht NUR die E-Mail-Test-Einträge (telegram_message_id 'email:%'),
  // Telegram-Einträge bleiben unberührt. Für einen sauberen Neustart.
  if (req.query.reset === 'email') {
    const { error, count } = await sb.from('bot_inbox').delete({ count: 'exact' }).like('telegram_message_id', 'email:%')
    return res.status(200).json({ reset: 'email', geloescht: count ?? null, error: error?.message || null })
  }

  // Spam lernen: Absender/Domain zur Spam-Liste (user_data 'mail-spam-v1') hinzufügen.
  if (req.query.spamadd) {
    const addr = String(req.query.spamadd).toLowerCase().trim()
    if (!addr) return res.status(400).json({ error: 'spamadd leer' })
    const { data: cur } = await sb.from('user_data').select('value').eq('key', 'mail-spam-v1').limit(1).single()
    const liste = Array.isArray(cur?.value) ? cur.value.slice() : []
    if (!liste.map(x => String(x).toLowerCase()).includes(addr)) liste.push(addr)
    // user_id von der bestehenden Mandanten-Zeile übernehmen (Single-User-Setup)
    const { data: base } = await sb.from('user_data').select('user_id').eq('key', 'spielbuch-data-v2').limit(1).single()
    const userId = base?.user_id
    if (!userId) return res.status(500).json({ error: 'user_id nicht ermittelbar' })
    const { error } = await sb.from('user_data').upsert({ user_id: userId, key: 'mail-spam-v1', value: liste }, { onConflict: 'user_id,key' })
    return res.status(200).json({ spamadd: addr, anzahl: liste.length, error: error?.message || null })
  }

  const account = req.query.account || 'strato'
  const days    = parseInt(req.query.days  || '5')
  const limit   = parseInt(req.query.limit || '15')
  const dry     = req.query.dry === '1'   // Testmodus: klassifizieren, aber NICHT speichern / nicht deduplizieren
  const reqModel = req.query.model || CLAUDE_MODEL   // Modell pro Aufruf überschreibbar (Test)
  const cfg = IMAP_ACCOUNTS[account]
  if (!cfg)               return res.status(400).json({ error: `Unbekanntes Konto: ${account}` })
  if (!cfg.user || !cfg.pass) return res.status(500).json({ error: `IMAP-Zugangsdaten für ${account} fehlen (Vercel Env)` })

  const clients = await loadClients()
  const spamSet = await loadSpamList()
  const clientListStr = clients.length
    ? clients.map(c => `- ${c.name} (ID: ${c.id}, Nr: ${c.mandantennummer}${c.emails.length ? ', Mails: ' + c.emails.join(';') : ''})`).join('\n')
    : '(keine Mandanten)'

  const imap = new ImapFlow({ host: cfg.host, port: cfg.port, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false })
  const ergebnis = { konto: account, gesehen: 0, uebersprungen_dublette: 0, spam: 0, angelegt: 0, fehler: 0, fallback: 0, debug: null, eintraege: [], proben: [] }

  try {
    await imap.connect()
    await imap.mailboxOpen('INBOX')
    const uids = await imap.search({ since: new Date(Date.now() - days * 864e5) })
    const relevant = uids.slice(-limit).reverse()

    for (const uid of relevant) {
      ergebnis.gesehen++
      try {
        const msg = await imap.fetchOne(uid, { envelope: true, source: true })
        const env = msg.envelope
        const messageId = env.messageId || `uid:${account}:${uid}`
        const dedupeKey = `email:${messageId}`

        // Dublettenschutz: schon in bot_inbox? (im Testmodus übersprungen)
        if (!dry) {
          const { data: exists } = await sb.from('bot_inbox').select('id').eq('telegram_message_id', dedupeKey).limit(1)
          if (exists && exists.length) { ergebnis.uebersprungen_dublette++; continue }
        }

        // Gelernter Spam: bekannter Absender/Domain → überspringen (spart auch KI-Tokens)
        const sender0 = (env.from?.[0]?.address || '').toLowerCase()
        const dom0 = sender0.split('@')[1] || ''
        if (spamSet.has(sender0) || (dom0 && spamSet.has(dom0))) { ergebnis.spam++; continue }

        const parsed = await simpleParser(msg.source)
        const sender = env.from?.[0]?.address || ''
        const betreff = env.subject || '(kein Betreff)'
        const datum = env.date?.toISOString() || new Date().toISOString()
        const body = (parsed.text || parsed.subject || '').replace(/\s+/g, ' ').trim().slice(0, 2500)
        // Echte Dokument-Anhänge (keine Inline-Signaturbildchen): Name/Größe für die Anzeige + spätere Übergabe.
        const anhaenge = (parsed.attachments || [])
          .filter(a => a.filename && !a.related && (a.size || 0) > 8000)
          .map(a => ({ filename: a.filename, size: a.size || 0, contentType: a.contentType || '' }))

        const userPrompt = `Absender: ${env.from?.[0]?.name || ''} <${sender}>\nBetreff: ${betreff}\nDatum: ${datum}\n\nText:\n${body}\n\nMandantenliste:\n${clientListStr}`
        let cl, clFehler = null
        try {
          let raw = await callClaude(SYSTEM_PROMPT, userPrompt, reqModel)
          const rawLen = (raw || '').length
          const a = raw.indexOf('{'), b = raw.lastIndexOf('}')
          if (a < 0 || b <= a) throw new Error(`keine JSON-Klammern (rawLen=${rawLen})`)
          try {
            cl = JSON.parse(raw.slice(a, b + 1))
          } catch (pe) {
            // Zweiter Versuch: einmal neu anfragen (transiente leere/abgeschnittene Antwort)
            raw = await callClaude(SYSTEM_PROMPT, userPrompt, reqModel)
            const a2 = raw.indexOf('{'), b2 = raw.lastIndexOf('}')
            cl = JSON.parse(raw.slice(a2, b2 + 1))
          }
        } catch (e) {
          clFehler = e.message
          cl = { spam: false, spam_sicher: false, client_id: null, client_name: null, summary: betreff, tags: [], intent: 'unknown', draft: {} }
        }
        if (clFehler) { ergebnis.fallback++; if (!ergebnis.debug) ergebnis.debug = clFehler }
        if (dry) { ergebnis.proben.push({ von: sender, betreff, clFehler, klass: cl }); continue }

        // Eindeutiger Spam -> nicht in die Inbox schreiben (Pilot: nur zählen)
        if (cl.spam && cl.spam_sicher) { ergebnis.spam++; continue }

        // Deterministischer Mandanten-Abgleich über die exakte Absenderadresse (schlägt Claude-Rateversuch)
        const hard = clientByExactEmail(clients, sender)
        let clientId   = hard?.id   || cl.client_id   || null
        let clientName = hard?.name || cl.client_name || null
        if (!clientId && clientName) {
          const byName = clientByName(clients, clientName)
          if (byName) { clientId = byName.id; clientName = byName.name }
        }

        const tags = Array.isArray(cl.tags) ? cl.tags.slice(0, 6) : []
        // Struktur: raw_text = Original; draft = Aktionsfelder (oben, für executeAction) + _email-Metadaten.
        const draftObj = {
          ...(cl.draft || {}),
          _email: {
            summary: cl.summary || betreff,
            tags,
            from: sender,
            fromName: env.from?.[0]?.name || '',
            subject: betreff,
            date: datum.slice(0, 10),
            account,
            uid,
            messageId,          // stabile Referenz zum Wiederfinden (uid ist positionsabhaengig)
            anhaenge,
            moeglicherSpam: !!(cl.spam && !cl.spam_sicher),
          },
        }
        const { error: insErr } = await sb.from('bot_inbox').insert({
          raw_text: body.slice(0, 4000),
          intent: cl.intent || 'unknown',
          client_id: clientId,
          client_name: clientName,
          draft: draftObj,
          status: 'neu',
          telegram_message_id: dedupeKey,
        })
        if (insErr) { ergebnis.fehler++; continue }
        ergebnis.angelegt++
        ergebnis.eintraege.push({ von: sender, betreff, mandant: clientName, intent: cl.intent, tags })
      } catch (e) {
        ergebnis.fehler++
      }
    }

    await imap.logout()
    return res.status(200).json({ ok: true, ...ergebnis })
  } catch (e) {
    try { await imap.logout() } catch {}
    return res.status(500).json({ error: e.message, ...ergebnis })
  }
}
