/**
 * api/formular.js
 *
 * GET  /api/formular?token=UUID   → Formulardefinition + Status laden
 * POST /api/formular              → Formular absenden (daten + dateien)
 *
 * Supabase-Setup (einmalig im SQL-Editor ausführen):
 * ─────────────────────────────────────────────────
 * create table if not exists public.form_tokens (
 *   id             uuid primary key default gen_random_uuid(),
 *   token          uuid unique not null default gen_random_uuid(),
 *   user_id        uuid not null,
 *   mandant_id     text not null,
 *   mandant_name   text not null default '',
 *   kanzlei_email  text not null default '',
 *   formular_id    text not null default '',
 *   formular_name  text not null default '',
 *   formular_def   jsonb not null default '{}'::jsonb,
 *   erstellt_am    timestamptz default now(),
 *   ablauf_am      timestamptz default (now() + interval '30 days'),
 *   beantwortet_am timestamptz,
 *   daten          jsonb,
 *   dateien        jsonb default '[]'::jsonb
 * );
 * alter table public.form_tokens enable row level security;
 * create policy "service_role_all" on public.form_tokens
 *   using (true) with check (true);
 *
 * Vercel Environment Variable:
 * SUPABASE_SERVICE_ROLE_KEY = <dein Service Role Key aus Supabase → Project Settings → API>
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = 'https://wtvijpdfdfyagmiwwnlw.supabase.co'
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0dmlqcGRmZGZ5YWdtaXd3bmx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDY2OTYsImV4cCI6MjA5MTAyMjY5Nn0.Kfcb-b9vJmEL6CCxPrxwlkqMM-mUcM_J355zMhp143g'

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

function ok(res, data, status = 200) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  return res.status(status).json(data)
}
function fail(res, msg, status = 400) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  return res.status(status).json({ error: msg })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── GET: Formular laden ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const token = req.query.token
    if (!token) return fail(res, 'Token fehlt')

    const { data, error } = await sb
      .from('form_tokens')
      .select('token, mandant_name, formular_name, formular_def, ablauf_am, beantwortet_am')
      .eq('token', token)
      .single()

    if (error || !data) return fail(res, 'Formular nicht gefunden oder Link ungültig', 404)

    const now = new Date()
    if (data.ablauf_am && new Date(data.ablauf_am) < now) {
      return fail(res, 'Dieser Link ist abgelaufen.', 410)
    }

    return ok(res, {
      mandantName:   data.mandant_name,
      formularName:  data.formular_name,
      formularDef:   data.formular_def,
      beantwortet:   !!data.beantwortet_am,
      ablaufAm:      data.ablauf_am,
    })
  }

  // ── POST: Formular absenden ────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { token, daten, dateien = [] } = req.body ?? {}
    if (!token) return fail(res, 'Token fehlt')
    if (!daten || typeof daten !== 'object') return fail(res, 'Daten fehlen')

    // Token prüfen
    const { data: row, error: fetchErr } = await sb
      .from('form_tokens')
      .select('id, ablauf_am, beantwortet_am, kanzlei_email, mandant_name, formular_name')
      .eq('token', token)
      .single()

    if (fetchErr || !row) return fail(res, 'Token ungültig', 404)
    if (row.beantwortet_am) return fail(res, 'Dieses Formular wurde bereits ausgefüllt.', 409)
    if (row.ablauf_am && new Date(row.ablauf_am) < new Date()) {
      return fail(res, 'Dieser Link ist abgelaufen.', 410)
    }

    // Dateien: nur Metadaten speichern (content wird base64 gespeichert, max ~8MB total)
    const dateiMeta = (dateien ?? []).map(d => ({
      filename:    d.filename,
      contentType: d.contentType,
      size:        d.size,
      content:     d.content,  // base64
      uploadedAt:  new Date().toISOString(),
    }))

    // Token aktualisieren
    const { error: updateErr } = await sb
      .from('form_tokens')
      .update({
        daten,
        dateien:       dateiMeta,
        beantwortet_am: new Date().toISOString(),
      })
      .eq('token', token)

    if (updateErr) return fail(res, 'Speichern fehlgeschlagen: ' + updateErr.message, 500)

    // Benachrichtigungs-E-Mail (optional, nur wenn kanzlei_email gesetzt)
    if (row.kanzlei_email) {
      try {
        const felder = Object.entries(daten)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')
        await fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: row.kanzlei_email,
            from: row.kanzlei_email,
            subject: `📋 Formular ausgefüllt: ${row.formular_name} – ${row.mandant_name}`,
            text: `${row.mandant_name} hat das Formular „${row.formular_name}" ausgefüllt.\n\n${felder}\n\n${dateien.length > 0 ? `${dateien.length} Datei(en) hochgeladen.` : ''}`,
            account: 'hostinger',
          }),
        }).catch(() => {})
      } catch {}
    }

    return ok(res, { success: true })
  }

  return fail(res, 'Method not allowed', 405)
}
