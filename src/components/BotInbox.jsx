import { useState, useEffect, useRef } from 'react'
import { supabase } from '../utils/supabaseClient.js'

// ── Konstanten ───────────────────────────────────────────────────────────────────
const POLL_INTERVAL = 30_000 // 30 Sekunden

const INTENT_CONFIG = {
  add_auftrag:  { label: 'Auftrag',       icon: '📋', color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  add_notiz:    { label: 'Notiz',          icon: '📝', color: '#f97316', bg: 'rgba(249,115,22,0.08)' },
  draft_email:  { label: 'E-Mail-Entwurf', icon: '✉️', color: '#0f766e', bg: 'rgba(15,118,110,0.08)' },
  unknown:      { label: 'Unbekannt',      icon: '❓', color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
}

// ── Zeitformatierung ─────────────────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  if (isToday) return `heute ${time}`
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `gestern ${time}`
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}. ${time}`
}

// ── Entwurf-Vorschau ─────────────────────────────────────────────────────────────
function draftPreview(intent, draft) {
  if (!draft) return ''
  switch (intent) {
    case 'add_auftrag':
      return `${draft.typ || 'freitext'}-Auftrag: ${draft.bezeichnung || ''} ${draft.notiz ? `(${draft.notiz})` : ''}`
    case 'add_notiz':
      return `${draft.bereich || 'allgemein'}: ${draft.text || ''} ${draft.kontext ? `[${draft.kontext}]` : ''}`
    case 'draft_email':
      return `Betreff: ${draft.betreff || '(leer)'}`
    default:
      return draft.raw || ''
  }
}

// ── Haupt-Komponente ─────────────────────────────────────────────────────────────
export default function BotInbox({ clients, onUpdateClient, onNavigateToClient }) {
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [editId,    setEditId]    = useState(null)
  const [editDraft, setEditDraft] = useState(null)
  const [toast,     setToast]     = useState('')
  const pollRef = useRef(null)

  // ── Mandant-Dropdown für unerkannte Mandanten ──
  const [manualClientMap, setManualClientMap] = useState({}) // { itemId: clientId }

  // ── Laden ──────────────────────────────────────
  async function loadItems() {
    const { data, error } = await supabase
      .from('bot_inbox')
      .select('*')
      .eq('status', 'neu')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) setItems(data)
    setLoading(false)
  }

  useEffect(() => {
    loadItems()
    pollRef.current = setInterval(loadItems, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── Bestätigen ─────────────────────────────────
  async function handleConfirm(item) {
    const draft = editId === item.id && editDraft ? editDraft : item.draft
    const clientId = item.client_id || manualClientMap[item.id]

    if (!clientId && item.intent !== 'unknown') {
      showToast('Bitte zuerst einen Mandanten auswählen')
      return
    }

    const client = clients.find(c => c.id === clientId)

    try {
      switch (item.intent) {
        case 'add_auftrag': {
          if (!client) break
          const newAuftrag = {
            id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            typ: draft.typ || 'freitext',
            bezeichnung: draft.bezeichnung || 'Neuer Auftrag',
            jahr: draft.jahr || null,
            monat: draft.monat || null,
            frist: null,
            status: 'offen',
            istSerie: false,
            notiz: draft.notiz || '',
            hinweise: [],
            erstelltAm: new Date().toISOString(),
          }
          onUpdateClient(clientId, {
            auftraege: [...(client.auftraege ?? []), newAuftrag],
          })
          break
        }
        case 'add_notiz': {
          if (!client) break
          const timestamp = new Date()
          const ts = `${timestamp.getDate().toString().padStart(2, '0')}.${(timestamp.getMonth() + 1).toString().padStart(2, '0')}.${timestamp.getFullYear()}`
          if (draft.bereich === 'lohn') {
            const notizen = Array.isArray(client.fibuNotizen) ? client.fibuNotizen : []
            onUpdateClient(clientId, {
              fibuNotizen: [...notizen, { id: 'fn' + Date.now().toString(36), text: `[${ts} – Bot] ${draft.text}${draft.kontext ? ' (' + draft.kontext + ')' : ''}`, datum: timestamp.toISOString() }],
            })
          } else {
            const existing = client.notizen ?? ''
            const addition = `\n\n[${ts} – Telegram Bot]\n${draft.text}${draft.kontext ? '\nKontext: ' + draft.kontext : ''}`
            onUpdateClient(clientId, { notizen: existing + addition })
          }
          break
        }
        case 'draft_email': {
          // Navigiere zu Nachrichten-Tab mit vorbefülltem Editor
          if (clientId && onNavigateToClient) {
            onNavigateToClient(clientId, 6, {
              prefillEmail: {
                betreff: draft.betreff || '',
                text: draft.text || '',
                empfaenger: draft.empfaenger || '',
              },
            })
          }
          break
        }
        case 'unknown':
        default:
          // Nur als bestätigt markieren
          break
      }

      // Status in Supabase aktualisieren
      await supabase
        .from('bot_inbox')
        .update({ status: 'bestaetigt', confirmed_at: new Date().toISOString() })
        .eq('id', item.id)

      setItems(prev => prev.filter(i => i.id !== item.id))
      setEditId(null)
      setEditDraft(null)
      showToast(`✓ ${INTENT_CONFIG[item.intent]?.label || 'Eintrag'} übernommen`)
    } catch (err) {
      showToast(`Fehler: ${err.message}`)
    }
  }

  // ── Verwerfen ──────────────────────────────────
  async function handleDismiss(item) {
    await supabase
      .from('bot_inbox')
      .update({ status: 'verworfen' })
      .eq('id', item.id)

    setItems(prev => prev.filter(i => i.id !== item.id))
    showToast('Eintrag verworfen')
  }

  // ── Bearbeiten ─────────────────────────────────
  function startEdit(item) {
    setEditId(item.id)
    setEditDraft({ ...item.draft })
  }

  function cancelEdit() {
    setEditId(null)
    setEditDraft(null)
  }

  // ── Render ─────────────────────────────────────
  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <span style={{ fontSize: '24px' }}>🤖</span>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>Bot-Inbox</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Telegram-Nachrichten zur Bestätigung · {items.length} offen
          </div>
        </div>
        <button onClick={loadItems} style={{
          marginLeft: 'auto', background: 'none', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '6px 14px', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: '12px',
        }}>
          🔄 Aktualisieren
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          padding: '10px 16px', marginBottom: '16px', borderRadius: '10px',
          background: toast.startsWith('✓') ? 'rgba(22,163,74,0.08)' : toast.startsWith('Fehler') ? 'rgba(220,38,38,0.08)' : 'rgba(37,99,235,0.08)',
          color: toast.startsWith('✓') ? '#16a34a' : toast.startsWith('Fehler') ? '#dc2626' : 'var(--accent)',
          fontSize: '13px', fontWeight: 600,
        }}>
          {toast}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
          ⏳ Lade Bot-Inbox…
        </div>
      )}

      {/* Leer */}
      {!loading && items.length === 0 && (
        <div style={{
          padding: '48px 24px', textAlign: 'center', borderRadius: '16px',
          background: 'var(--surface2)', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>Keine offenen Einträge</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Sende eine Nachricht über Telegram, um loszulegen.
          </div>
        </div>
      )}

      {/* Einträge */}
      {items.map(item => {
        const cfg = INTENT_CONFIG[item.intent] || INTENT_CONFIG.unknown
        const isEditing = editId === item.id
        const needsClient = !item.client_id && item.intent !== 'unknown'
        const selectedClient = manualClientMap[item.id]

        return (
          <div key={item.id} style={{
            marginBottom: '12px', borderRadius: '14px', overflow: 'hidden',
            border: `1px solid ${cfg.color}25`,
            background: 'var(--surface)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            {/* Karten-Header */}
            <div style={{
              padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px',
              borderBottom: '1px solid var(--border)',
              background: cfg.bg,
            }}>
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                background: cfg.color + '18', color: cfg.color,
              }}>
                {cfg.icon} {cfg.label}
              </span>
              {item.client_name && (
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                  {item.client_name}
                </span>
              )}
              {!item.client_name && item.intent !== 'unknown' && (
                <span style={{ fontSize: '12px', color: '#f97316', fontWeight: 600 }}>
                  ⚠ Mandant nicht erkannt
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {fmtTime(item.created_at)}
              </span>
            </div>

            {/* Inhalt */}
            <div style={{ padding: '14px 18px' }}>
              {/* Original-Nachricht */}
              <div style={{
                fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic',
                padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.03)',
                borderLeft: '3px solid var(--border)', marginBottom: '10px', lineHeight: 1.5,
              }}>
                „{item.raw_text}"
              </div>

              {/* Entwurfs-Vorschau oder Editor */}
              {isEditing ? (
                <div style={{
                  padding: '12px', borderRadius: '10px', background: 'rgba(37,99,235,0.04)',
                  border: '1px solid rgba(37,99,235,0.15)', marginBottom: '10px',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', marginBottom: '8px' }}>
                    ✏️ Entwurf bearbeiten
                  </div>
                  {item.intent === 'add_auftrag' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input className="input" value={editDraft.bezeichnung || ''} onChange={e => setEditDraft(d => ({ ...d, bezeichnung: e.target.value }))}
                        placeholder="Bezeichnung" style={{ fontSize: '12px', padding: '7px 10px', borderRadius: '8px' }} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                        <select className="input" value={editDraft.typ || 'freitext'} onChange={e => setEditDraft(d => ({ ...d, typ: e.target.value }))}
                          style={{ fontSize: '12px', padding: '7px 8px', borderRadius: '8px' }}>
                          {['fibu','lohn','ust','jahresabschluss','est','beratung','freitext'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input type="number" className="input" value={editDraft.jahr || ''} onChange={e => setEditDraft(d => ({ ...d, jahr: e.target.value ? Number(e.target.value) : null }))}
                          placeholder="Jahr" style={{ fontSize: '12px', padding: '7px 8px', borderRadius: '8px' }} />
                        <input type="number" className="input" min={1} max={12} value={editDraft.monat || ''} onChange={e => setEditDraft(d => ({ ...d, monat: e.target.value ? Number(e.target.value) : null }))}
                          placeholder="Monat" style={{ fontSize: '12px', padding: '7px 8px', borderRadius: '8px' }} />
                      </div>
                      <input className="input" value={editDraft.notiz || ''} onChange={e => setEditDraft(d => ({ ...d, notiz: e.target.value }))}
                        placeholder="Notiz" style={{ fontSize: '12px', padding: '7px 10px', borderRadius: '8px' }} />
                    </div>
                  )}
                  {item.intent === 'add_notiz' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <select className="input" value={editDraft.bereich || 'allgemein'} onChange={e => setEditDraft(d => ({ ...d, bereich: e.target.value }))}
                        style={{ fontSize: '12px', padding: '7px 8px', borderRadius: '8px' }}>
                        <option value="allgemein">Allgemein</option>
                        <option value="lohn">Lohn</option>
                        <option value="fibu">FiBu</option>
                      </select>
                      <textarea className="input" value={editDraft.text || ''} onChange={e => setEditDraft(d => ({ ...d, text: e.target.value }))}
                        placeholder="Notiztext" style={{ fontSize: '12px', padding: '7px 10px', borderRadius: '8px', minHeight: '60px', resize: 'vertical' }} />
                    </div>
                  )}
                  {item.intent === 'draft_email' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <input className="input" value={editDraft.betreff || ''} onChange={e => setEditDraft(d => ({ ...d, betreff: e.target.value }))}
                        placeholder="Betreff" style={{ fontSize: '12px', padding: '7px 10px', borderRadius: '8px' }} />
                      <textarea className="input" value={editDraft.text || ''} onChange={e => setEditDraft(d => ({ ...d, text: e.target.value }))}
                        placeholder="E-Mail-Text" style={{ fontSize: '12px', padding: '7px 10px', borderRadius: '8px', minHeight: '80px', resize: 'vertical' }} />
                      <input className="input" value={editDraft.empfaenger || ''} onChange={e => setEditDraft(d => ({ ...d, empfaenger: e.target.value }))}
                        placeholder="Empfänger (optional)" style={{ fontSize: '12px', padding: '7px 10px', borderRadius: '8px' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleConfirm(item)} style={{ fontSize: '12px', borderRadius: '8px' }}>
                      ✓ Übernehmen
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={cancelEdit} style={{ fontSize: '12px', borderRadius: '8px' }}>
                      Abbrechen
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  fontSize: '13px', color: 'var(--text)', lineHeight: 1.5,
                  padding: '6px 0',
                }}>
                  → {draftPreview(item.intent, item.draft)}
                </div>
              )}

              {/* Mandant-Dropdown bei unerkanntem Mandant */}
              {needsClient && !isEditing && (
                <div style={{
                  marginTop: '8px', padding: '8px 12px', borderRadius: '8px',
                  background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#f97316', whiteSpace: 'nowrap' }}>Mandant zuordnen:</span>
                  <select className="input" value={selectedClient || ''} onChange={e => setManualClientMap(m => ({ ...m, [item.id]: e.target.value }))}
                    style={{ flex: 1, fontSize: '12px', padding: '5px 8px', borderRadius: '8px' }}>
                    <option value="">— bitte wählen —</option>
                    {clients.filter(c => !c.archiviert).map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.mandantennummer})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Aktionsleiste */}
            {!isEditing && (
              <div style={{
                padding: '10px 18px', borderTop: '1px solid var(--border)',
                display: 'flex', gap: '8px', alignItems: 'center',
              }}>
                <button onClick={() => handleConfirm(item)}
                  disabled={needsClient && !selectedClient}
                  style={{
                    padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: (needsClient && !selectedClient) ? 'var(--surface2)' : 'rgba(22,163,74,0.12)',
                    color: (needsClient && !selectedClient) ? 'var(--text-muted)' : '#16a34a',
                    fontWeight: 600, fontSize: '12px',
                    opacity: (needsClient && !selectedClient) ? 0.5 : 1,
                  }}>
                  ✓ Übernehmen
                </button>
                <button onClick={() => handleDismiss(item)} style={{
                  padding: '7px 16px', borderRadius: '8px', border: '1px solid var(--border)',
                  background: 'transparent', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '12px',
                }}>
                  ✕ Verwerfen
                </button>
                <button onClick={() => startEdit(item)} style={{
                  padding: '7px 16px', borderRadius: '8px', border: '1px solid var(--border)',
                  background: 'transparent', cursor: 'pointer',
                  color: 'var(--text)', fontSize: '12px',
                }}>
                  ✏ Bearbeiten
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Badge-Komponente (für Sidebar) ───────────────────────────────────────────────
export function BotInboxBadge({ onClick, active }) {
  const [count, setCount] = useState(0)
  const pollRef = useRef(null)

  async function fetchCount() {
    const { count: n, error } = await supabase
      .from('bot_inbox')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'neu')

    if (!error && typeof n === 'number') setCount(n)
  }

  useEffect(() => {
    fetchCount()
    pollRef.current = setInterval(fetchCount, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [])

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
        textAlign: 'left', fontWeight: 600, fontSize: '13px',
        display: 'flex', alignItems: 'center', gap: '8px',
        background: active ? '#7c3aed' : 'var(--surface2)',
        color: active ? '#fff' : 'var(--text)',
        transition: 'all 0.15s', position: 'relative',
      }}
    >
      🤖 Bot-Inbox
      {count > 0 && (
        <span style={{
          marginLeft: 'auto', minWidth: '20px', height: '20px', lineHeight: '20px',
          textAlign: 'center', borderRadius: '10px',
          background: active ? 'rgba(255,255,255,0.3)' : '#ef4444',
          color: '#fff', fontSize: '11px', fontWeight: 700,
          padding: '0 6px',
        }}>
          {count}
        </span>
      )}
    </button>
  )
}
