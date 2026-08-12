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
const CLAUDE_MODEL = process.env.MAIL_POLL_MODEL || 'claude-sonnet-5'
const FEEDER_VERSION = 'v2-namematch'

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
async function callClaude(system, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 3000, system, messages: [{ role: 'user', content: user }] }),
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

  if (process.env.MAIL_POLL_SECRET && req.query.secret !== process.env.MAIL_POLL_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Billiger Versions-Ping (kein IMAP/Claude) – für Deploy-Erkennung.
  if (req.query.ping) return res.status(200).json({ feederVersion: FEEDER_VERSION })

  const account = req.query.account || 'strato'
  const days    = parseInt(req.query.days  || '5')
  const limit   = parseInt(req.query.limit || '15')
  const dry     = req.query.dry === '1'   // Testmodus: klassifizieren, aber NICHT speichern / nicht deduplizieren
  const cfg = IMAP_ACCOUNTS[account]
  if (!cfg)               return res.status(400).json({ error: `Unbekanntes Konto: ${account}` })
  if (!cfg.user || !cfg.pass) return res.status(500).json({ error: `IMAP-Zugangsdaten für ${account} fehlen (Vercel Env)` })

  const clients = await loadClients()
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

        const parsed = await simpleParser(msg.source)
        const sender = env.from?.[0]?.address || ''
        const betreff = env.subject || '(kein Betreff)'
        const datum = env.date?.toISOString() || new Date().toISOString()
        const body = (parsed.text || parsed.subject || '').replace(/\s+/g, ' ').trim().slice(0, 2500)

        const userPrompt = `Absender: ${env.from?.[0]?.name || ''} <${sender}>\nBetreff: ${betreff}\nDatum: ${datum}\n\nText:\n${body}\n\nMandantenliste:\n${clientListStr}`
        let cl, clFehler = null
        try {
          const raw = await callClaude(SYSTEM_PROMPT, userPrompt)
          cl = JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim())
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

        const dom = sender.split('@')[1]?.toLowerCase() || ''
        const tags = Array.isArray(cl.tags) ? cl.tags.slice(0, 6) : []
        const kurzDatum = datum.slice(0, 10)
        const raw_text =
          `📧 ${env.from?.[0]?.name || sender} — ${betreff}  (${kurzDatum})\n` +
          (tags.length ? `🏷 ${tags.join(' · ')}\n` : '') +
          (hard ? `👤 Absender exakt zugeordnet: ${hard.name}\n` : '') +
          (cl.spam && !cl.spam_sicher ? `⚠️ evtl. Werbung${!FREEMAIL.has(dom) ? '' : ''}\n` : '') +
          `\n📝 ${cl.summary || betreff}\n\n— Original —\n${body.slice(0, 900)}`

        const { error: insErr } = await sb.from('bot_inbox').insert({
          raw_text,
          intent: cl.intent || 'unknown',
          client_id: clientId,
          client_name: clientName,
          draft: cl.draft || {},
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
