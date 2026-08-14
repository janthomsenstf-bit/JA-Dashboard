/**
 * /api/dokument-vorschlag  (Dokument-Vorschlagskarte, Weg A)
 *
 * Claude Code (lokal) verarbeitet den Posteingang und POSTet die Vorschläge
 * (gebündelt pro Mandant) hierher. Sie erscheinen im Spielbuch als Karten
 * (bot_inbox, intent 'dokument_ablage'). Der Nutzer gibt im Spielbuch frei;
 * Claude Code liest die Freigaben und führt das Verschieben lokal aus.
 *
 * POST  body { cards:[ {clientId, clientName, sicherheit, summary, dokumente:[
 *              {quelleRel, zielRel, neuerName, typ, erkannt} ]} ] }  → schreibt Karten
 * GET   ?freigaben=1   → liefert freigegebene Karten (zum Ausführen)
 * GET   ?ping=1        → Version
 * POST  ?erledigt  body {id}  → Karte als erledigt markieren
 *
 * Schutz optional über ?secret= (env DOKUMENT_VORSCHLAG_SECRET).
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wtvijpdfdfyagmiwwnlw.supabase.co'
const sb = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const VERSION = 'dok-v1'

const clean = v => String(v ?? '').trim()

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (process.env.DOKUMENT_VORSCHLAG_SECRET && req.query.secret !== process.env.DOKUMENT_VORSCHLAG_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (req.query.ping) return res.status(200).json({ version: VERSION })

  // ── #27 Posteingang-Jobs (Auslöser aus dem Dashboard → lokaler Worker) ──────────
  // Offene Verarbeitungs-Anfragen holen (für den lokalen Worker).
  if (req.method === 'GET' && req.query.jobs) {
    const { data, error } = await sb.from('bot_inbox').select('*')
      .eq('intent', 'posteingang_job').neq('status', 'verarbeitet')
      .order('created_at', { ascending: true }).limit(50)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ jobs: data || [] })
  }
  // Job in Bearbeitung nehmen (stand → 'in_arbeit').
  if (req.method === 'POST' && req.query.job_claim) {
    const id = req.body?.id
    if (!id) return res.status(400).json({ error: 'id fehlt' })
    const { data: row } = await sb.from('bot_inbox').select('draft').eq('id', id).single()
    const neuDraft = { ...(row?.draft || {}), stand: 'in_arbeit', startAm: new Date().toISOString() }
    const { error } = await sb.from('bot_inbox').update({ draft: neuDraft }).eq('id', id)
    return res.status(200).json({ ok: !error, error: error?.message || null })
  }
  // Job abschließen (status → 'verarbeitet', stand → 'fertig', Ergebnis-Zusammenfassung).
  if (req.method === 'POST' && req.query.job_done) {
    const { id, summary, count } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id fehlt' })
    const { data: row } = await sb.from('bot_inbox').select('draft').eq('id', id).single()
    const neuDraft = { ...(row?.draft || {}), stand: 'fertig', ergebnis: clean(summary) || null, anzahl: Number(count) || 0, fertigAm: new Date().toISOString() }
    const { error } = await sb.from('bot_inbox').update({ status: 'verarbeitet', draft: neuDraft, confirmed_at: new Date().toISOString() }).eq('id', id)
    return res.status(200).json({ ok: !error, error: error?.message || null })
  }

  // Freigaben lesen (für Claude Code): bestätigte Karten (stand 'freigegeben'), noch nicht ausgeführt.
  if (req.method === 'GET' && req.query.freigaben) {
    const { data, error } = await sb.from('bot_inbox').select('*')
      .eq('intent', 'dokument_ablage')
      .order('created_at', { ascending: true }).limit(100)
    if (error) return res.status(500).json({ error: error.message })
    const freigegeben = (data || []).filter(r => r.draft?.stand === 'freigegeben')
    return res.status(200).json({ karten: freigegeben })
  }

  // Karte als erledigt markieren (nach dem lokalen Verschieben): stand → 'erledigt'.
  if (req.method === 'POST' && req.query.erledigt) {
    const id = req.body?.id
    if (!id) return res.status(400).json({ error: 'id fehlt' })
    const { data: row } = await sb.from('bot_inbox').select('draft').eq('id', id).single()
    const neuDraft = { ...(row?.draft || {}), stand: 'erledigt' }
    const { error } = await sb.from('bot_inbox').update({ status: 'verarbeitet', draft: neuDraft, confirmed_at: new Date().toISOString() }).eq('id', id)
    return res.status(200).json({ ok: !error, error: error?.message || null })
  }

  // Vorschläge schreiben.
  if (req.method === 'POST') {
    const cards = req.body?.cards
    if (!Array.isArray(cards) || !cards.length) return res.status(400).json({ error: 'cards fehlt' })
    const rows = cards.map(c => {
      const dokumente = (c.dokumente || []).map((d, i) => ({
        id: 'd' + i,
        quelleRel: clean(d.quelleRel),
        zielRel: clean(d.zielRel),
        neuerName: clean(d.neuerName),
        typ: clean(d.typ),
        erkannt: clean(d.erkannt),
        freigabe: null,
      }))
      const key = 'dok:' + (c.clientId || 'x') + ':' + dokumente.map(d => d.neuerName).join('|').slice(0, 120)
      return {
        raw_text: clean(c.summary) || `${dokumente.length} Dokument(e)`,
        intent: 'dokument_ablage',
        client_id: c.clientId || null,
        client_name: c.clientName || null,
        draft: { _dokBundle: true, sicherheit: clean(c.sicherheit) || 'hoch', stand: 'vorgeschlagen', dokumente },
        status: 'neu',
        telegram_message_id: key,
      }
    })
    // Dubletten (gleicher key) überspringen
    const angelegt = []
    for (const row of rows) {
      const { data: exists } = await sb.from('bot_inbox').select('id').eq('telegram_message_id', row.telegram_message_id).limit(1)
      if (exists && exists.length) continue
      const { data, error } = await sb.from('bot_inbox').insert(row).select('id').single()
      if (!error && data) angelegt.push(data.id)
    }
    return res.status(200).json({ angelegt: angelegt.length, ids: angelegt })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
