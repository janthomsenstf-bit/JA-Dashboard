/**
 * /api/ai-aktion  – Die „Vordertür" des AI-Mitarbeiters für den MCP (BP 5).
 *
 * Von außen (MCP-Server / Cowork / Handy) werden hier VORGÄNGE gemeldet. Sie landen
 * – genau wie die Dokument-Vorschläge – in `bot_inbox` (intent 'ai_aktion') und
 * erscheinen im Spielbuch zur Bestätigung. Ausgeführt werden die Aktionen dann in
 * der App über die App-eigenen Setter (sichere Speicherung). NICHTS wird hier direkt
 * an Mandantendaten geschrieben.
 *
 * SICHERHEIT: Secret ist PFLICHT. Ohne konfiguriertes AI_AKTION_SECRET ist der
 * Endpunkt inaktiv (503). So ist er auch öffentlich erreichbar ungefährlich.
 *
 * POST  ?secret=…  body { vorgang:{ titel, schwere?, mandantId?, mandantName?,
 *          feststellung?, einschaetzung?, empfehlung?, aktionen:[{id,parameter}] } }
 *        → schreibt einen Vorgang (Status 'neu')
 * GET   ?secret=…&freigaben=1  → im Spielbuch freigegebene Vorgänge (zum Ausführen)
 * POST  ?secret=…&erledigt     body { id }  → Vorgang als erledigt markieren
 * GET   ?secret=…&ping=1       → Version
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wtvijpdfdfyagmiwwnlw.supabase.co'
const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const VERSION = 'ai-aktion-v1'
const clean = v => String(v ?? '').trim()

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Secret ist Pflicht (safe-by-default).
  const SECRET = process.env.AI_AKTION_SECRET
  if (!SECRET) return res.status(503).json({ error: 'AI-Aktion-Endpunkt nicht konfiguriert (AI_AKTION_SECRET fehlt).' })
  if (req.query.secret !== SECRET) return res.status(403).json({ error: 'Forbidden' })

  if (req.query.ping) return res.status(200).json({ version: VERSION })

  // Freigegebene Vorgänge lesen (für die Ausführung).
  if (req.method === 'GET' && req.query.freigaben) {
    const { data, error } = await sb.from('bot_inbox').select('*')
      .eq('intent', 'ai_aktion')
      .order('created_at', { ascending: true }).limit(100)
    if (error) return res.status(500).json({ error: error.message })
    const freigegeben = (data || []).filter(r => r.draft?.stand === 'freigegeben')
    return res.status(200).json({ vorgaenge: freigegeben })
  }

  // Vorgang als erledigt markieren.
  if (req.method === 'POST' && req.query.erledigt) {
    const id = req.body?.id
    if (!id) return res.status(400).json({ error: 'id fehlt' })
    const { data: row } = await sb.from('bot_inbox').select('draft').eq('id', id).single()
    const neuDraft = { ...(row?.draft || {}), stand: 'erledigt' }
    const { error } = await sb.from('bot_inbox').update({ status: 'verarbeitet', draft: neuDraft, confirmed_at: new Date().toISOString() }).eq('id', id)
    return res.status(200).json({ ok: !error, error: error?.message || null })
  }

  // Vorgang melden.
  if (req.method === 'POST') {
    const v = req.body?.vorgang
    if (!v || !clean(v.titel)) return res.status(400).json({ error: 'vorgang.titel fehlt' })
    const aktionen = (Array.isArray(v.aktionen) ? v.aktionen : [])
      .filter(a => a && clean(a.id))
      .map(a => ({ id: clean(a.id), parameter: a.parameter && typeof a.parameter === 'object' ? a.parameter : {} }))

    const key = 'ai:' + (v.mandantId || 'x') + ':' + clean(v.titel).slice(0, 100) + ':' + aktionen.map(a => a.id).join(',')
    const { data: exists } = await sb.from('bot_inbox').select('id').eq('telegram_message_id', key).limit(1)
    if (exists && exists.length) return res.status(200).json({ angelegt: 0, grund: 'dublette', id: exists[0].id })

    const row = {
      raw_text: clean(v.titel),
      intent: 'ai_aktion',
      client_id: v.mandantId || null,
      client_name: v.mandantName || null,
      draft: {
        _aiVorgang: true,
        stand: 'vorgeschlagen',
        schwere: clean(v.schwere) || 'hinweis',
        feststellung: clean(v.feststellung),
        einschaetzung: clean(v.einschaetzung),
        empfehlung: clean(v.empfehlung),
        aktionen,
        quelle: v.quelle || { typ: 'mcp' },
      },
      status: 'neu',
      telegram_message_id: key,
    }
    const { data, error } = await sb.from('bot_inbox').insert(row).select('id').single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ angelegt: 1, id: data.id })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
