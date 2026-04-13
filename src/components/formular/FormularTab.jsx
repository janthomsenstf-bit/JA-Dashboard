/**
 * FormularTab.jsx  –  Dashboard-Tab für Webformulare pro Mandant
 */
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabaseClient.js'
import FormularEditor, { DEFAULT_TEMPLATES } from './FormularEditor.jsx'

// ── Supabase-Setup SQL (für den Setup-Dialog) ─────────────────────────────────
const SETUP_SQL = `create table if not exists public.form_tokens (
  id             uuid primary key default gen_random_uuid(),
  token          uuid unique not null default gen_random_uuid(),
  user_id        uuid not null,
  mandant_id     text not null,
  mandant_name   text not null default '',
  kanzlei_email  text not null default '',
  formular_id    text not null default '',
  formular_name  text not null default '',
  formular_def   jsonb not null default '{}'::jsonb,
  erstellt_am    timestamptz default now(),
  ablauf_am      timestamptz default (now() + interval '30 days'),
  beantwortet_am timestamptz,
  daten          jsonb,
  dateien        jsonb default '[]'::jsonb
);

alter table public.form_tokens enable row level security;

create policy "service_role_all" on public.form_tokens
  using (true) with check (true);`

// ── Absender-E-Mail laden (für Benachrichtigung) ──────────────────────────────
function loadKanzleiEmail() {
  try {
    const raw = localStorage.getItem('kommunikation-absender')
    if (raw) {
      const list = JSON.parse(raw)
      return list.find(a => a.isDefault)?.email || list[0]?.email || ''
    }
  } catch {}
  return ''
}

function fmtDate(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  })
}

// ── Antwort-Daten anzeigen ────────────────────────────────────────────────────
function AntwortenModal({ token, onClose }) {
  const [loading, setLoading] = useState(true)
  const [data, setData]       = useState(null)
  const [error, setError]     = useState('')

  useEffect(() => {
    supabase.from('form_tokens')
      .select('daten, dateien, beantwortet_am, mandant_name, formular_name, formular_def')
      .eq('token', token)
      .single()
      .then(({ data: d, error: e }) => {
        if (e || !d) setError('Laden fehlgeschlagen')
        else setData(d)
        setLoading(false)
      })
  }, [token])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', width: '100%', maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>📋 Eingegangene Daten</div>
            {data && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{data.mandant_name} · {data.formular_name}</div>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Schließen</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Lädt…</div>}
          {error   && <div style={{ color: '#ef4444', fontSize: '13px' }}>⚠️ {error}</div>}
          {data && (
            <>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Eingegangen: {fmtDate(data.beantwortet_am)}
              </div>

              {/* Formular-Daten */}
              {data.daten && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Ausgefüllte Felder</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(data.formular_def?.felder ?? [])
                      .filter(f => f.typ !== 'section' && f.typ !== 'file' && data.daten[f.id] !== undefined)
                      .map(f => (
                        <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '8px', padding: '8px 10px', background: 'var(--bg)', borderRadius: '6px', fontSize: '13px' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{f.label}</span>
                          <span style={{ color: 'var(--text)', wordBreak: 'break-word' }}>
                            {typeof data.daten[f.id] === 'boolean'
                              ? (data.daten[f.id] ? '✅ Ja' : '❌ Nein')
                              : String(data.daten[f.id] ?? '–')}
                          </span>
                        </div>
                      ))
                    }
                    {/* Felder ohne Definition */}
                    {Object.entries(data.daten)
                      .filter(([k]) => !(data.formular_def?.felder ?? []).some(f => f.id === k))
                      .map(([k, v]) => (
                        <div key={k} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '8px', padding: '8px 10px', background: 'var(--bg)', borderRadius: '6px', fontSize: '13px' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{k}</span>
                          <span style={{ color: 'var(--text)', wordBreak: 'break-word' }}>{String(v ?? '–')}</span>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}

              {/* Dateien */}
              {Array.isArray(data.dateien) && data.dateien.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                    📎 Hochgeladene Dateien ({data.dateien.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {data.dateien.map((d, i) => {
                      const icon = d.contentType?.includes('pdf') ? '📄' : d.contentType?.includes('image') ? '🖼' : '📎'
                      const sizeKB = d.size ? (d.size / 1024).toFixed(0) + ' KB' : ''
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'var(--bg)', borderRadius: '6px', fontSize: '13px' }}>
                          <span style={{ fontSize: '18px' }}>{icon}</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.filename}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{sizeKB}</span>
                          {d.content && (
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: '11px', flexShrink: 0 }}
                              onClick={() => {
                                const link = document.createElement('a')
                                link.href = `data:${d.contentType};base64,${d.content}`
                                link.download = d.filename
                                link.click()
                              }}
                            >⬇ Download</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Neues Formular senden – Modal ─────────────────────────────────────────────
function NeuesFormularModal({ client, formVorlagen, authUser, onCreated, onClose, emailVorlagen, emailSignaturen }) {
  const allTemplates = [...DEFAULT_TEMPLATES, ...(formVorlagen ?? [])]
  const [selectedId,  setSelectedId]  = useState(allTemplates[0]?.id ?? '')
  const [ablaufTage,  setAblaufTage]  = useState(30)
  const [creating,    setCreating]    = useState(false)
  const [error,       setError]       = useState('')
  const [result,      setResult]      = useState(null)   // { token, url }
  const [copied,      setCopied]      = useState(false)
  const [mailOpen,    setMailOpen]    = useState(false)
  const [mailAn,      setMailAn]      = useState((client.kontakte ?? []).find(k => k.email)?.email ?? '')
  const [mailText,    setMailText]    = useState('')
  const [sending,     setSending]     = useState(false)
  const [sendOk,      setSendOk]      = useState(false)

  const chosen = allTemplates.find(t => t.id === selectedId)

  async function handleCreate() {
    if (!chosen) { setError('Kein Template ausgewählt'); return }
    setCreating(true); setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Nicht eingeloggt'); return }

      const ablaufAm = new Date()
      ablaufAm.setDate(ablaufAm.getDate() + ablaufTage)

      const { data, error: e } = await supabase.from('form_tokens').insert({
        user_id:       user.id,
        mandant_id:    client.id,
        mandant_name:  client.name,
        kanzlei_email: loadKanzleiEmail(),
        formular_id:   chosen.id,
        formular_name: chosen.name,
        formular_def:  { felder: chosen.felder, beschreibung: chosen.beschreibung },
        ablauf_am:     ablaufAm.toISOString(),
      }).select('token').single()

      if (e) { setError('Fehler: ' + e.message); return }
      const base = window.location.origin
      const url  = `${base}/formular/${data.token}`
      setResult({ token: data.token, url })
      setMailText(
        `Guten Tag,\n\nbitte füllen Sie das folgende Formular aus:\n\n${url}\n\nDer Link ist ${ablaufTage} Tage gültig.\n\nBei Fragen stehe ich Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen`
      )
    } catch (e) {
      setError('Unerwarteter Fehler: ' + e.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleSendMail() {
    if (!mailAn.trim()) return
    setSending(true)
    try {
      const absenderList = (() => {
        try { return JSON.parse(localStorage.getItem('kommunikation-absender') ?? '[]') } catch { return [] }
      })()
      const defaultVon = absenderList.find(a => a.isDefault)?.email || absenderList[0]?.email || ''
      const account    = absenderList.find(a => a.email === defaultVon)?.konto || 'hostinger'
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: mailAn, from: defaultVon,
          subject: `Formular: ${chosen?.name} – bitte ausfüllen`,
          text: mailText,
          account,
        }),
      })
      if (res.ok) { setSendOk(true); onCreated?.() }
      else { const d = await res.json(); setError('E-Mail-Fehler: ' + d.error) }
    } catch (e) {
      setError('E-Mail-Fehler: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', width: '100%', maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '14px' }}>📋 Formular-Link erstellen</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {!result ? (
            <>
              {/* Template-Auswahl */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Formular-Template</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {allTemplates.map(t => (
                    <label key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                      border: `2px solid ${selectedId === t.id ? 'var(--accent)' : 'var(--border)'}`,
                      background: selectedId === t.id ? 'var(--accent-dim)' : 'var(--bg)',
                      transition: 'all 0.15s',
                    }}>
                      <input type="radio" name="tmpl" value={t.id} checked={selectedId === t.id}
                        onChange={() => setSelectedId(t.id)} style={{ accentColor: 'var(--accent)' }} />
                      <span style={{ fontSize: '20px' }}>{t.icon}</span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{t.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {(t.felder ?? []).filter(f => f.typ !== 'section').length} Felder
                          {' · '}
                          {(t.felder ?? []).filter(f => f.typ !== 'section' && f.pflicht).length} Pflicht
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Ablauf */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Link gültig für</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[14, 30, 60].map(d => (
                    <button key={d}
                      className={`btn btn-sm ${ablaufTage === d ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setAblaufTage(d)}
                      style={{ flex: 1 }}
                    >{d} Tage</button>
                  ))}
                </div>
              </div>

              {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '10px' }}>⚠️ {error}</div>}

              <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !chosen}
                style={{ width: '100%', padding: '11px' }}>
                {creating ? '⏳ Wird erstellt…' : '🔗 Link erstellen'}
              </button>
            </>
          ) : (
            <>
              {/* Link erstellt */}
              <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a', marginBottom: '8px' }}>✅ Link erstellt!</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text)', wordBreak: 'break-all', marginBottom: '10px', background: 'var(--bg)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  {result.url}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }}
                    onClick={() => { copyToClipboard(result.url); setCopied(true); setTimeout(() => setCopied(false), 2500) }}>
                    {copied ? '✓ Kopiert!' : '📋 Link kopieren'}
                  </button>
                  <a href={result.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>
                    👁 Vorschau
                  </a>
                </div>
              </div>

              {/* E-Mail senden */}
              {!sendOk ? (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    📧 Link per E-Mail senden
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>An</label>
                    <input className="input" value={mailAn} onChange={e => setMailAn(e.target.value)}
                      style={{ fontSize: '12px', padding: '6px 8px' }} placeholder="mandant@beispiel.de" />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>E-Mail-Text</label>
                    <textarea className="input" value={mailText} onChange={e => setMailText(e.target.value)} rows={7}
                      style={{ fontSize: '12px', padding: '6px 8px', resize: 'vertical', fontFamily: 'var(--font-mono)' }} />
                  </div>
                  {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>⚠️ {error}</div>}
                  <button className="btn btn-primary" onClick={handleSendMail} disabled={sending || !mailAn.trim()}
                    style={{ width: '100%', padding: '10px' }}>
                    {sending ? '⏳ Wird gesendet…' : '📤 E-Mail senden'}
                  </button>
                </div>
              ) : (
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px', padding: '14px', textAlign: 'center', fontSize: '13px', color: '#16a34a' }}>
                  ✅ E-Mail wurde gesendet!
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ width: '100%' }}>
            {result ? 'Fertig' : 'Abbrechen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Haupt-Tab ─────────────────────────────────────────────────────────────────
export default function FormularTab({ client, onUpdate, formVorlagen = [], onUpdateFormVorlagen, emailVorlagen = [], emailSignaturen = [] }) {
  const [tokens,        setTokens]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [dbError,       setDbError]       = useState(false)
  const [setupOpen,     setSetupOpen]     = useState(false)
  const [neuesOpen,     setNeuesOpen]     = useState(false)
  const [editorVorlage, setEditorVorlage] = useState(null)  // null = geschlossen, obj = bearbeiten, 'neu' = neu
  const [antwortenToken, setAntwortenToken] = useState(null)
  const [copyState,     setCopyState]     = useState({})
  const [authUser,      setAuthUser]      = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setAuthUser(user))
  }, [])

  useEffect(() => {
    loadTokens()
  }, [client.id])

  async function loadTokens() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data, error } = await supabase
      .from('form_tokens')
      .select('token, formular_name, erstellt_am, ablauf_am, beantwortet_am, mandant_name')
      .eq('user_id', user.id)
      .eq('mandant_id', client.id)
      .order('erstellt_am', { ascending: false })

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        setDbError(true)
      }
    } else {
      setTokens(data ?? [])
    }
    setLoading(false)
  }

  function getStatus(t) {
    if (t.beantwortet_am)                    return { label: 'Beantwortet', color: '#16a34a', bg: 'rgba(22,163,74,0.1)', icon: '✅' }
    if (t.ablauf_am && new Date(t.ablauf_am) < new Date()) return { label: 'Abgelaufen', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', icon: '⌛' }
    return { label: 'Offen', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '⏳' }
  }

  async function handleDelete(token) {
    if (!window.confirm('Diesen Formular-Link wirklich löschen?')) return
    await supabase.from('form_tokens').delete().eq('token', token)
    setTokens(prev => prev.filter(t => t.token !== token))
  }

  const allTemplates = [...DEFAULT_TEMPLATES, ...(formVorlagen ?? [])]

  // ── Supabase-Setup noch nicht gemacht ──────────────────────────────────────
  if (dbError) return (
    <div style={{ padding: '24px', maxWidth: '680px' }}>
      <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', padding: '20px' }}>
        <div style={{ fontWeight: 700, fontSize: '14px', color: '#d97706', marginBottom: '8px' }}>⚙️ Einmalige Einrichtung erforderlich</div>
        <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.6, marginTop: 0 }}>
          Die Tabelle <code>form_tokens</code> muss einmalig in Supabase angelegt werden.<br />
          Gehe zu: <strong>Supabase → SQL Editor → New query</strong> und führe folgenden Code aus:
        </p>
        <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px', fontSize: '11px', overflowX: 'auto', color: 'var(--text)', lineHeight: 1.5 }}>
          {SETUP_SQL}
        </pre>
        <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '6px', fontSize: '12px', color: '#2563eb' }}>
          <strong>Zusätzlich:</strong> In Vercel → Settings → Environment Variables:<br />
          <code>SUPABASE_SERVICE_ROLE_KEY</code> = dein Service Role Key (Supabase → Project Settings → API)
        </div>
        <button className="btn btn-primary btn-sm" onClick={loadTokens} style={{ marginTop: '12px' }}>
          🔄 Nochmal prüfen
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ padding: '20px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>📋 Webformulare</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Formulare senden · Daten empfangen · Automatisch verarbeiten
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setEditorVorlage('neu')} style={{ fontSize: '12px' }}>
            ⚙️ Template-Editor
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setNeuesOpen(true)} style={{ fontSize: '12px' }}>
            ➕ Formular senden
          </button>
        </div>
      </div>

      {/* Templates-Übersicht */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Verfügbare Templates ({allTemplates.length})
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {allTemplates.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', fontSize: '12px', cursor: 'pointer' }}
              onClick={() => setEditorVorlage(t)}>
              <span>{t.icon}</span>
              <span>{t.name}</span>
              {formVorlagen.some(v => v.id === t.id) && (
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>✏️</span>
              )}
            </div>
          ))}
          <button
            onClick={() => setEditorVorlage('neu')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'none', border: '1px dashed var(--border)', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-muted)' }}>
            ➕ Neues Template
          </button>
        </div>
      </div>

      {/* Gesendete Formulare */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Gesendete Formulare ({tokens.length})
        </div>

        {loading && <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0' }}>Lädt…</div>}

        {!loading && tokens.length === 0 && (
          <div style={{ padding: '32px', border: '1px dashed var(--border)', borderRadius: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Noch keine Formulare gesendet.<br />
            <button className="btn btn-primary btn-sm" onClick={() => setNeuesOpen(true)} style={{ marginTop: '12px', fontSize: '12px' }}>
              ➕ Erstes Formular senden
            </button>
          </div>
        )}

        {tokens.length > 0 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
            {tokens.map((t, i) => {
              const status = getStatus(t)
              const url    = `${window.location.origin}/formular/${t.token}`
              const isCopied = copyState[t.token]
              return (
                <div key={t.token} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                  alignItems: 'center', gap: '12px',
                  padding: '12px 14px',
                  borderBottom: i < tokens.length - 1 ? '1px solid var(--border)' : 'none',
                  background: i % 2 === 0 ? 'var(--bg)' : 'var(--surface)',
                }}>
                  {/* Info */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{t.formular_name}</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '10px', background: status.bg, color: status.color }}>
                        {status.icon} {status.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Erstellt: {fmtDate(t.erstellt_am)}
                      {' · '}
                      Gültig bis: {fmtDate(t.ablauf_am)}
                      {t.beantwortet_am && ` · Beantwortet: ${fmtDate(t.beantwortet_am)}`}
                    </div>
                  </div>

                  {/* Aktionen */}
                  {t.beantwortet_am && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setAntwortenToken(t.token)} style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                      📋 Antwort ansehen
                    </button>
                  )}

                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '11px', whiteSpace: 'nowrap', color: isCopied ? '#16a34a' : undefined }}
                    onClick={() => { copyToClipboard(url); setCopyState(p => ({ ...p, [t.token]: true })); setTimeout(() => setCopyState(p => ({ ...p, [t.token]: false })), 2500) }}
                  >
                    {isCopied ? '✓ Kopiert' : '📋 Link'}
                  </button>

                  <button
                    onClick={() => handleDelete(t.token)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px', padding: '0 4px' }}
                    title="Löschen"
                  >🗑</button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Template-Editor (Fullscreen-Overlay) */}
      {editorVorlage !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
          <FormularEditor
            vorlage={editorVorlage === 'neu' ? null : editorVorlage}
            onSave={saved => {
              const isDef  = DEFAULT_TEMPLATES.some(t => t.id === saved.id)
              const newList = isDef
                ? [...(formVorlagen ?? []).filter(v => v.id !== saved.id), saved]
                : (formVorlagen ?? []).some(v => v.id === saved.id)
                  ? (formVorlagen ?? []).map(v => v.id === saved.id ? saved : v)
                  : [...(formVorlagen ?? []), saved]
              onUpdateFormVorlagen?.(newList)
              setEditorVorlage(null)
            }}
            onCancel={() => setEditorVorlage(null)}
          />
        </div>
      )}

      {/* Neues Formular senden */}
      {neuesOpen && (
        <NeuesFormularModal
          client={client}
          formVorlagen={formVorlagen}
          authUser={authUser}
          onCreated={() => { loadTokens() }}
          onClose={() => { setNeuesOpen(false); loadTokens() }}
          emailVorlagen={emailVorlagen}
          emailSignaturen={emailSignaturen}
        />
      )}

      {/* Antworten ansehen */}
      {antwortenToken && (
        <AntwortenModal token={antwortenToken} onClose={() => setAntwortenToken(null)} />
      )}
    </div>
  )
}
