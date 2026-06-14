/**
 * api/website-anfrage.js
 *
 * POST /api/website-anfrage  →  Empfängt Kontaktformular-Daten von etablering-tyskland.com
 *
 * Speichert Anfragen in Supabase-Tabelle `website_anfragen`.
 * Sendet Benachrichtigungs-E-Mail an die Kanzlei.
 *
 * Supabase-Setup (einmalig im SQL-Editor ausführen):
 * ─────────────────────────────────────────────────
 * create table if not exists public.website_anfragen (
 *   id          uuid primary key default gen_random_uuid(),
 *   name        text not null,
 *   firma       text,
 *   email       text not null,
 *   telefon     text,
 *   interesse   text not null,
 *   nachricht   text,
 *   land        text,
 *   erstellt_am timestamptz default now(),
 *   status      text default 'neu',
 *   mandant_id  text,
 *   notiz       text
 * );
 * alter table public.website_anfragen enable row level security;
 * create policy "service_role_all" on public.website_anfragen
 *   using (true) with check (true);
 *
 * Zusätzliche Spalten (nachträglich ergänzt):
 * alter table public.website_anfragen
 *   add column if not exists passkopie      jsonb,
 *   add column if not exists cvr_dokument   jsonb,
 *   add column if not exists formular_daten jsonb;
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wtvijpdfdfyagmiwwnlw.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0dmlqcGRmZGZ5YWdtaXd3bmx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDY2OTYsImV4cCI6MjA5MTAyMjY5Nn0.Kfcb-b9vJmEL6CCxPrxwlkqMM-mUcM_J355zMhp143g'

const ALLOWED_ORIGINS = [
  'https://etablering-tyskland.com',
  'https://www.etablering-tyskland.com',
  'http://localhost:3002',
]

function isAllowedOrigin(origin) {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  if (/^https:\/\/etablering-tyskland.*\.vercel\.app$/.test(origin)) return true
  return false
}

const NOTIFY_EMAIL = process.env.WEBSITE_NOTIFY_EMAIL || 'jan.thomsen.stf@gmail.com'

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

function corsHeaders(req, res) {
  const origin = req.headers.origin ?? ''
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  } else {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0])
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export default async function handler(req, res) {
  corsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, firma, email, telefon, interesse, nachricht, land, passkopie, cvr_dokument, formular_daten } = req.body ?? {}

  if (!name || !email || !interesse) {
    return res.status(400).json({ error: 'Name, E-Mail und Interesse sind Pflichtfelder.' })
  }

  const row = {
    name,
    firma: firma || null,
    email,
    telefon: telefon || null,
    interesse,
    nachricht: nachricht || null,
    land: land || null,
    status: 'neu',
  }
  if (passkopie && passkopie.filename) {
    row.passkopie = { filename: passkopie.filename, type: passkopie.type, data: passkopie.data }
  }
  if (cvr_dokument && cvr_dokument.filename) {
    row.cvr_dokument = { filename: cvr_dokument.filename, type: cvr_dokument.type, data: cvr_dokument.data }
  }
  if (formular_daten && typeof formular_daten === 'object') {
    row.formular_daten = formular_daten
  }

  // In Supabase speichern
  const { data, error } = await sb
    .from('website_anfragen')
    .insert(row)
    .select('id')
    .single()

  if (error) {
    console.error('[website-anfrage] Supabase-Fehler:', error.message)
    return res.status(500).json({ error: 'Speichern fehlgeschlagen.' })
  }

  // Benachrichtigungs-E-Mail an Kanzlei
  try {
    const baseUrl = process.env.VERCEL_URL
      ? 'https://' + process.env.VERCEL_URL
      : 'http://localhost:3000'

    const felder = [
      `Name: ${name}`,
      firma ? `Firma: ${firma}` : null,
      `E-Mail: ${email}`,
      telefon ? `Telefon: ${telefon}` : null,
      `Interesse: ${interesse}`,
      nachricht ? `\nNachricht:\n${nachricht}` : null,
      land ? `Land: ${land}` : null,
    ].filter(Boolean).join('\n')

    await fetch(`${baseUrl}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: NOTIFY_EMAIL,
        from: NOTIFY_EMAIL,
        subject: `🌐 Neue Website-Anfrage: ${interesse} – ${firma || name}`,
        text: `Neue Anfrage über etablering-tyskland.com\n${'─'.repeat(40)}\n\n${felder}\n\n${'─'.repeat(40)}\nAnfrage-ID: ${data.id}`,
        account: 'gmail',
      }),
    }).catch(() => {})
  } catch {}

  return res.status(200).json({ success: true, id: data.id })
}
