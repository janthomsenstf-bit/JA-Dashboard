/**
 * /api/telegram-webhook
 *
 * Empfängt Telegram-Updates, erkennt Intent via Claude API,
 * speichert Entwurf in bot_inbox (Supabase), bestätigt an Telegram.
 *
 * Umgebungsvariablen (in Vercel setzen):
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_ALLOWED_USER_ID
 *   TELEGRAM_WEBHOOK_SECRET
 *   SUPABASE_URL              (oder hart-codiert, s.u.)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 */

import { createClient } from '@supabase/supabase-js'

// ── Supabase ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wtvijpdfdfyagmiwwnlw.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// ── Telegram-Helfer ──────────────────────────────────────────────────────────────
const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN
const ALLOWED_ID = process.env.TELEGRAM_ALLOWED_USER_ID
const SECRET     = process.env.TELEGRAM_WEBHOOK_SECRET

async function sendTelegramMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

// ── Claude API ──────────────────────────────────────────────────────────────────
async function callClaude(systemPrompt, userMessage) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || `Claude API ${res.status}`)
  return data.content?.[0]?.text ?? ''
}

// ── Intent-System-Prompt ────────────────────────────────────────────────────────
const INTENT_SYSTEM_PROMPT = `Du bist ein Assistent für einen Steuerberater. Du erhältst eine Sprachnachricht oder Texteingabe
und eine Liste seiner Mandanten. Deine Aufgabe: Erkenne den Intent und gib ausschließlich ein
JSON-Objekt zurück (kein Text davor oder danach).

Mögliche Intents:
- add_auftrag: Neue Aufgabe/Auftrag für einen Mandanten
- add_notiz: Hinweis/Notiz für einen Mandanten (z.B. Lohn-Tab, allgemein)
- draft_email: E-Mail-Entwurf für einen Mandanten
- unknown: Intent unklar

JSON-Struktur je nach Intent:

add_auftrag:
{
  "intent": "add_auftrag",
  "client_id": "<id oder null>",
  "client_name": "<erkannter Name>",
  "draft": {
    "bezeichnung": "<Aufgabentitel>",
    "typ": "<fibu|lohn|ust|jahresabschluss|est|beratung|freitext>",
    "jahr": null,
    "monat": null,
    "notiz": "<optionale Zusatzinfo>"
  }
}

add_notiz:
{
  "intent": "add_notiz",
  "client_id": "<id oder null>",
  "client_name": "<erkannter Name>",
  "draft": {
    "bereich": "<lohn|fibu|allgemein>",
    "text": "<Notiztext>",
    "kontext": "<optionaler Kontext z.B. 'Juli 2026'>"
  }
}

draft_email:
{
  "intent": "draft_email",
  "client_id": "<id oder null>",
  "client_name": "<erkannter Name>",
  "draft": {
    "betreff": "<Betreff>",
    "text": "<E-Mail-Text>",
    "empfaenger": "<E-Mail-Adresse falls erkannt, sonst null>"
  }
}

unknown:
{
  "intent": "unknown",
  "client_id": null,
  "client_name": null,
  "draft": { "raw": "<Originaltext>" }
}

Antworte NUR mit dem JSON-Objekt. Kein Markdown, kein Text drumherum.`

// ── Mandantenliste aus Supabase laden ────────────────────────────────────────────
async function loadClientList() {
  // Clients werden als JSON-Blob in user_data gespeichert (key = 'spielbuch-data-v2')
  const { data, error } = await sb
    .from('user_data')
    .select('value')
    .eq('key', 'spielbuch-data-v2')
    .limit(1)
    .single()

  if (error || !data?.value) return []

  const clients = Array.isArray(data.value) ? data.value : []
  // Nur ID + Name + Mandantennummer extrahieren (nicht das volle Objekt)
  return clients
    .filter(c => !c.archiviert)
    .map(c => ({
      id: c.id,
      name: c.name,
      mandantennummer: c.mandantennummer || '',
      mandantennummer2: c.mandantennummer2 || '',
      mandantennummer3: c.mandantennummer3 || '',
    }))
}

// ── Intent-Beschreibung für Telegram-Antwort ────────────────────────────────────
function intentDescription(parsed) {
  switch (parsed.intent) {
    case 'add_auftrag':
      return `Auftrag: ${parsed.draft?.bezeichnung || '(unbenannt)'}`
    case 'add_notiz':
      return `Notiz (${parsed.draft?.bereich || 'allgemein'}): ${(parsed.draft?.text || '').slice(0, 60)}`
    case 'draft_email':
      return `E-Mail-Entwurf: ${parsed.draft?.betreff || '(kein Betreff)'}`
    default:
      return 'Konnte den Intent nicht erkennen'
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Nur POST erlaubt
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Webhook-Secret prüfen (Telegram sendet es als X-Telegram-Bot-Api-Secret-Token Header)
  if (SECRET) {
    const headerSecret = req.headers['x-telegram-bot-api-secret-token']
    if (headerSecret !== SECRET) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  }

  const update = req.body
  if (!update?.message) {
    return res.status(200).json({ ok: true, skipped: 'no message' })
  }

  const msg    = update.message
  const userId = String(msg.from?.id ?? '')
  const chatId = msg.chat?.id
  const text   = msg.text ?? ''

  // Nur erlaubter User
  if (ALLOWED_ID && userId !== ALLOWED_ID) {
    return res.status(200).json({ ok: true, skipped: 'unauthorized user' })
  }

  // Kein Text? (z.B. Bild, Sticker, etc.) → ignorieren
  if (!text.trim()) {
    if (chatId) await sendTelegramMessage(chatId, '⚠️ Bitte Text senden. Sprachnachrichten werden noch nicht unterstützt.')
    return res.status(200).json({ ok: true, skipped: 'no text' })
  }

  try {
    // 1. Mandantenliste laden
    const clientList = await loadClientList()
    const clientListStr = clientList.length > 0
      ? clientList.map(c => `- ${c.name} (ID: ${c.id}, Nr: ${c.mandantennummer})`).join('\n')
      : '(keine Mandanten vorhanden)'

    // 2. Claude API aufrufen
    const userPrompt = `Nachricht des Steuerberaters:\n"${text}"\n\nMandantenliste:\n${clientListStr}`
    const rawResult = await callClaude(INTENT_SYSTEM_PROMPT, userPrompt)

    // 3. JSON parsen
    let parsed
    try {
      // Versuche das JSON zu extrahieren (Claude antwortet manchmal mit Backticks)
      const jsonStr = rawResult.replace(/```json?\s*/g, '').replace(/```/g, '').trim()
      parsed = JSON.parse(jsonStr)
    } catch {
      parsed = { intent: 'unknown', client_id: null, client_name: null, draft: { raw: text } }
    }

    // 4. In bot_inbox speichern
    const { error: insertError } = await sb.from('bot_inbox').insert({
      raw_text: text,
      intent: parsed.intent,
      client_id: parsed.client_id || null,
      client_name: parsed.client_name || null,
      draft: parsed.draft || {},
      status: 'neu',
      telegram_message_id: String(msg.message_id ?? ''),
    })

    if (insertError) {
      console.error('Supabase insert error:', insertError)
      if (chatId) await sendTelegramMessage(chatId, '⚠️ Fehler beim Speichern. Bitte erneut versuchen.')
      return res.status(500).json({ error: insertError.message })
    }

    // 5. Bestätigung an Telegram
    if (chatId) {
      if (parsed.intent === 'unknown') {
        await sendTelegramMessage(chatId, '❓ Konnte das nicht einordnen. Liegt trotzdem in deiner Inbox.')
      } else {
        const desc = intentDescription(parsed)
        const mandant = parsed.client_name || '(kein Mandant erkannt)'
        await sendTelegramMessage(chatId,
          `✅ Verstanden: ${desc} für <b>${mandant}</b>.\nWarte auf deine Bestätigung im Dashboard.`)
      }
    }

    return res.status(200).json({ ok: true, intent: parsed.intent })
  } catch (err) {
    console.error('Webhook error:', err)
    if (chatId) await sendTelegramMessage(chatId, `⚠️ Verarbeitungsfehler: ${err.message}`)
    return res.status(500).json({ error: err.message })
  }
}
