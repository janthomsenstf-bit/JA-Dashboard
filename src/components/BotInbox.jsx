import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../utils/supabaseClient.js'

// ── Konstanten ───────────────────────────────────────────────────────────────────
const POLL_INTERVAL = 30_000

const INTENT_CONFIG = {
  add_auftrag:  { label: 'Auftrag',       icon: '📋', color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  add_notiz:    { label: 'Notiz',          icon: '📝', color: '#f97316', bg: 'rgba(249,115,22,0.08)' },
  draft_email:  { label: 'E-Mail-Entwurf', icon: '✉️', color: '#0f766e', bg: 'rgba(15,118,110,0.08)' },
  unknown:      { label: 'Unbekannt',      icon: '❓', color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
}

const STATUS_TABS = [
  { key: 'neu',         label: 'Neu',          icon: '📩', color: '#2563eb' },
  { key: 'zugeordnet',  label: 'Zugeordnet',   icon: '👤', color: '#f97316' },
  { key: 'verarbeitet', label: 'Verarbeitet',  icon: '✅', color: '#16a34a' },
  { key: 'archiviert',  label: 'Archiv',       icon: '📦', color: '#64748b' },
]

const ACTION_OPTIONS = [
  { key: 'aufgabe',      label: 'Aufgabe erstellen',    icon: '📋', color: '#2563eb' },
  { key: 'notiz',        label: 'Notiz speichern',      icon: '📝', color: '#f97316' },
  { key: 'hinweis',      label: 'Hinweis hinzufügen',   icon: '💡', color: '#eab308' },
  { key: 'email',        label: 'E-Mail-Entwurf',       icon: '✉️', color: '#0f766e' },
  { key: 'erinnerung',   label: 'Erinnerung setzen',    icon: '🔔', color: '#8b5cf6' },
  { key: 'ignorieren',   label: 'Ignorieren/Archiv',    icon: '📦', color: '#64748b' },
]

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

// ── E-Mail-Inhalt (Zusammenfassung oben, Original ausklappbar) ────────────────────
function EmailContent({ item, expanded }) {
  const e = item.draft?._email || {}
  const [showOrig, setShowOrig] = useState(false)
  const tags = Array.isArray(e.tags) ? e.tags : []
  return (
    <div style={{ padding: '12px 18px', borderBottom: expanded ? '1px solid var(--border)' : 'none' }}>
      {/* Betreff + Absender-Zeile */}
      <div style={{ fontSize: '14px', fontWeight: 650, color: 'var(--text)', lineHeight: 1.35 }}>
        {e.subject || '(kein Betreff)'}
      </div>
      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
        {e.fromName ? `${e.fromName} · ` : ''}{e.from}{e.date ? ` · ${e.date}` : ''}{e.account ? ` · ${e.account}` : ''}
        {e.moeglicherSpam && <span style={{ color: '#f97316', fontWeight: 600 }}> · evtl. Werbung</span>}
      </div>
      {/* Tags */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
          {tags.map((t, i) => (
            <span key={i} style={{ fontSize: '10.5px', padding: '2px 8px', borderRadius: '20px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{t}</span>
          ))}
        </div>
      )}
      {/* Zusammenfassung */}
      <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(37,99,235,0.05)', borderLeft: '3px solid var(--accent)', fontSize: '13px', lineHeight: 1.5, color: 'var(--text)' }}>
        {e.summary || '—'}
      </div>
      {/* Original ein-/ausklappen */}
      <button onClick={() => setShowOrig(o => !o)} style={{ marginTop: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11.5px', padding: 0 }}>
        {showOrig ? '▲ Original ausblenden' : '▼ Original anzeigen'}
      </button>
      {showOrig && (
        <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', maxHeight: '240px', overflowY: 'auto', padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)' }}>
          {item.raw_text}
        </div>
      )}
    </div>
  )
}

// ── ClientSearchField ────────────────────────────────────────────────────────────
function ClientSearchField({ clients, value, onChange, placeholder }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [focusIdx, setFocusIdx] = useState(-1)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  // Ausgewählter Mandant
  const selected = useMemo(() => clients.find(c => c.id === value), [clients, value])

  // Suchresultate
  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase().trim()
    return clients
      .filter(c => !c.archiviert)
      .map(c => {
        const emails = (c.kontakte ?? []).map(k => k.email).filter(Boolean)
        let matchField = null
        let matchValue = ''

        if (c.name?.toLowerCase().includes(q)) {
          matchField = 'name'
          matchValue = c.name
        } else if (c.mandantennummer?.toLowerCase().includes(q)) {
          matchField = 'nummer'
          matchValue = `Nr. ${c.mandantennummer}`
        } else if (c.mandantennummer2?.toLowerCase().includes(q)) {
          matchField = 'nummer2'
          matchValue = `Nr.2 ${c.mandantennummer2}`
        } else if (c.mandantennummer3?.toLowerCase().includes(q)) {
          matchField = 'nummer3'
          matchValue = `Nr.3 ${c.mandantennummer3}`
        } else {
          const emailMatch = emails.find(e => e.toLowerCase().includes(q))
          if (emailMatch) {
            matchField = 'email'
            matchValue = emailMatch
          }
        }
        if (!matchField) return null
        return { ...c, matchField, matchValue }
      })
      .filter(Boolean)
      .slice(0, 8)
  }, [clients, query])

  // Klick außerhalb schließt Dropdown
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(client) {
    onChange(client.id)
    setQuery('')
    setOpen(false)
    setFocusIdx(-1)
  }

  function handleClear() {
    onChange(null)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function handleKeyDown(e) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && focusIdx >= 0) {
      e.preventDefault()
      handleSelect(results[focusIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // Wenn bereits ein Mandant ausgewählt: Chip anzeigen
  if (selected) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
        borderRadius: '10px', background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.18)',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
          👤 {selected.name}
        </span>
        {selected.mandantennummer && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            #{selected.mandantennummer}
          </span>
        )}
        <button onClick={handleClear} style={{
          marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: '14px', padding: '2px 4px', lineHeight: 1,
        }} title="Mandant ändern">✕</button>
      </div>
    )
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        className="input"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setFocusIdx(-1) }}
        onFocus={() => query.trim() && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Mandant suchen (Name, Nr., E-Mail)...'}
        style={{
          width: '100%', fontSize: '13px', padding: '8px 12px', borderRadius: '10px',
          boxSizing: 'border-box',
        }}
      />
      {/* Dropdown */}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          marginTop: '4px', maxHeight: '260px', overflowY: 'auto',
        }}>
          {results.map((c, i) => (
            <button
              key={c.id}
              onClick={() => handleSelect(c)}
              onMouseEnter={() => setFocusIdx(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: i === focusIdx ? 'rgba(37,99,235,0.08)' : 'transparent',
                borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  {c.matchField === 'name' && c.mandantennummer && `Nr. ${c.mandantennummer}`}
                  {c.matchField !== 'name' && (
                    <span style={{ color: 'var(--accent)' }}>{c.matchValue}</span>
                  )}
                </div>
              </div>
              <span style={{
                fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                background: 'rgba(37,99,235,0.08)', color: 'var(--accent)', whiteSpace: 'nowrap',
              }}>
                {c.matchField === 'email' ? '✉️' : c.matchField === 'name' ? '👤' : '🔢'}
              </span>
            </button>
          ))}
        </div>
      )}
      {/* Keine Ergebnisse */}
      {open && query.trim().length >= 2 && results.length === 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          marginTop: '4px', padding: '14px 16px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Kein Mandant gefunden für „{query}"
          </div>
        </div>
      )}
    </div>
  )
}

// ── ActionSelector ───────────────────────────────────────────────────────────────
function ActionSelector({ selectedAction, onSelect }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px',
      padding: '2px',
    }}>
      {ACTION_OPTIONS.map(opt => {
        const active = selectedAction === opt.key
        return (
          <button
            key={opt.key}
            onClick={() => onSelect(opt.key)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              padding: '10px 6px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              background: active ? opt.color + '18' : 'var(--surface2)',
              outline: active ? `2px solid ${opt.color}` : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: '18px' }}>{opt.icon}</span>
            <span style={{
              fontSize: '10px', fontWeight: 600, textAlign: 'center', lineHeight: 1.2,
              color: active ? opt.color : 'var(--text-muted)',
            }}>
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── ActionForm: Aufgabe erstellen ────────────────────────────────────────────────
function AufgabeForm({ draft, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={labelStyle}>Bezeichnung</label>
      <input className="input" value={draft.bezeichnung || ''} onChange={e => onChange({ ...draft, bezeichnung: e.target.value })}
        placeholder="z.B. Jahresabschluss 2025 erstellen" style={inputStyle} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle}>Kategorie</label>
          <select className="input" value={draft.typ || 'freitext'} onChange={e => onChange({ ...draft, typ: e.target.value })} style={inputStyle}>
            {['fibu','lohn','ust','jahresabschluss','est','beratung','freitext'].map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Frist (optional)</label>
          <input type="date" className="input" value={draft.frist || ''} onChange={e => onChange({ ...draft, frist: e.target.value })} style={inputStyle} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <label style={labelStyle}>Jahr</label>
          <input type="number" className="input" value={draft.jahr || ''} onChange={e => onChange({ ...draft, jahr: e.target.value ? Number(e.target.value) : null })}
            placeholder="z.B. 2025" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Monat</label>
          <input type="number" className="input" min={1} max={12} value={draft.monat || ''} onChange={e => onChange({ ...draft, monat: e.target.value ? Number(e.target.value) : null })}
            placeholder="1-12" style={inputStyle} />
        </div>
      </div>
      <label style={labelStyle}>Notiz</label>
      <textarea className="input" value={draft.notiz || ''} onChange={e => onChange({ ...draft, notiz: e.target.value })}
        placeholder="Zusatzinformationen..." style={{ ...inputStyle, minHeight: '50px', resize: 'vertical' }} />
    </div>
  )
}

// ── ActionForm: Notiz speichern ──────────────────────────────────────────────────
function NotizForm({ draft, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={labelStyle}>Bereich</label>
      <select className="input" value={draft.bereich || 'allgemein'} onChange={e => onChange({ ...draft, bereich: e.target.value })} style={inputStyle}>
        <option value="allgemein">Allgemein</option>
        <option value="lohn">Lohn</option>
        <option value="fibu">FiBu</option>
        <option value="abschluss">Abschluss</option>
        <option value="beratung">Beratung</option>
      </select>
      <label style={labelStyle}>Notiztext</label>
      <textarea className="input" value={draft.text || ''} onChange={e => onChange({ ...draft, text: e.target.value })}
        placeholder="Notiz eingeben..." style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} />
      <label style={labelStyle}>Kontext (optional)</label>
      <input className="input" value={draft.kontext || ''} onChange={e => onChange({ ...draft, kontext: e.target.value })}
        placeholder="z.B. Juli 2026, Lohnabrechnung" style={inputStyle} />
    </div>
  )
}

// ── ActionForm: Hinweis ──────────────────────────────────────────────────────────
function HinweisForm({ draft, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={labelStyle}>Bereich</label>
      <select className="input" value={draft.bereich || 'allgemein'} onChange={e => onChange({ ...draft, bereich: e.target.value })} style={inputStyle}>
        <option value="allgemein">Stand der Arbeit</option>
        <option value="lohn">Lohn</option>
        <option value="fibu">FiBu</option>
        <option value="abschluss">Abschluss</option>
      </select>
      <label style={labelStyle}>Hinweistext</label>
      <textarea className="input" value={draft.text || ''} onChange={e => onChange({ ...draft, text: e.target.value })}
        placeholder="Hinweis eingeben..." style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} />
    </div>
  )
}

// ── ActionForm: E-Mail-Entwurf ───────────────────────────────────────────────────
function EmailForm({ draft, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={labelStyle}>Betreff</label>
      <input className="input" value={draft.betreff || ''} onChange={e => onChange({ ...draft, betreff: e.target.value })}
        placeholder="E-Mail-Betreff" style={inputStyle} />
      <label style={labelStyle}>E-Mail-Text</label>
      <textarea className="input" value={draft.text || ''} onChange={e => onChange({ ...draft, text: e.target.value })}
        placeholder="E-Mail-Text..." style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
      <label style={labelStyle}>Empfänger</label>
      <input className="input" value={draft.empfaenger || ''} onChange={e => onChange({ ...draft, empfaenger: e.target.value })}
        placeholder="E-Mail-Adresse (optional)" style={inputStyle} />
    </div>
  )
}

// ── ActionForm: Erinnerung setzen ────────────────────────────────────────────────
function ErinnerungForm({ draft, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={labelStyle}>Datum</label>
      <input type="date" className="input" value={draft.datum || ''} onChange={e => onChange({ ...draft, datum: e.target.value })} style={inputStyle} />
      <label style={labelStyle}>Erinnerungstext</label>
      <textarea className="input" value={draft.text || ''} onChange={e => onChange({ ...draft, text: e.target.value })}
        placeholder="Woran erinnern..." style={{ ...inputStyle, minHeight: '50px', resize: 'vertical' }} />
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────────
const labelStyle = { fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.03em' }
const inputStyle = { fontSize: '13px', padding: '8px 12px', borderRadius: '8px' }

// ── Haupt-Komponente ─────────────────────────────────────────────────────────────
export default function BotInbox({ clients, onUpdateClient, onNavigateToClient }) {
  const [items,        setItems]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [toast,        setToast]        = useState('')
  const [activeTab,    setActiveTab]    = useState('neu')
  const [counts,       setCounts]       = useState({ neu: 0, zugeordnet: 0, verarbeitet: 0, archiviert: 0 })
  const pollRef = useRef(null)

  // Per-item state: zugewiesener Mandant, gewählte Aktion, Formulardaten
  const [assignedClients, setAssignedClients] = useState({})   // { itemId: clientId }
  const [selectedActions, setSelectedActions] = useState({})   // { itemId: actionKey }
  const [actionDrafts,    setActionDrafts]    = useState({})   // { itemId: draftObj }
  const [expandedId,      setExpandedId]      = useState(null) // welche Karte ist ausgeklappt

  // ── Laden ──────────────────────────────────
  const loadItems = useCallback(async () => {
    // Items für aktiven Tab laden
    const { data, error } = await supabase
      .from('bot_inbox')
      .select('*')
      .eq('status', activeTab)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) setItems(data)
    setLoading(false)

    // Counts für alle Tabs
    for (const tab of STATUS_TABS) {
      const { count, error: cErr } = await supabase
        .from('bot_inbox')
        .select('id', { count: 'exact', head: true })
        .eq('status', tab.key)
      if (!cErr && typeof count === 'number') {
        setCounts(prev => ({ ...prev, [tab.key]: count }))
      }
    }
  }, [activeTab])

  useEffect(() => {
    setLoading(true)
    loadItems()
    pollRef.current = setInterval(loadItems, POLL_INTERVAL)
    return () => clearInterval(pollRef.current)
  }, [loadItems])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  // ── Mandant zuweisen (Status → zugeordnet) ────────────────────────
  async function assignClient(item, clientId) {
    if (!clientId) return
    setAssignedClients(prev => ({ ...prev, [item.id]: clientId }))

    // In Supabase Status auf "zugeordnet" + client_id speichern
    const client = clients.find(c => c.id === clientId)
    await supabase
      .from('bot_inbox')
      .update({
        status: 'zugeordnet',
        client_id: clientId,
        client_name: client?.name || item.client_name,
      })
      .eq('id', item.id)

    // Setze eine Default-Aktion basierend auf dem erkannten Intent
    const defaultAction = {
      add_auftrag: 'aufgabe',
      add_notiz: 'notiz',
      draft_email: 'email',
      unknown: 'notiz',
    }[item.intent] || 'notiz'

    setSelectedActions(prev => ({ ...prev, [item.id]: defaultAction }))

    // Default-Draft aus dem Intent-Draft übernehmen
    setActionDrafts(prev => ({ ...prev, [item.id]: { ...item.draft } }))

    // Wenn wir im "neu" Tab sind: Item aktualisieren und expandieren
    if (activeTab === 'neu') {
      setItems(prev => prev.map(i => i.id === item.id
        ? { ...i, status: 'zugeordnet', client_id: clientId, client_name: client?.name || i.client_name }
        : i
      ))
    }
    setExpandedId(item.id)
    setCounts(prev => ({
      ...prev,
      neu: Math.max(0, prev.neu - (item.status === 'neu' ? 1 : 0)),
      zugeordnet: prev.zugeordnet + (item.status === 'neu' ? 1 : 0),
    }))
  }

  // ── Aktion ausführen (Status → verarbeitet) ────────────────────────
  async function executeAction(item) {
    const clientId = assignedClients[item.id] || item.client_id
    const action = selectedActions[item.id]
    const draft = actionDrafts[item.id] || item.draft || {}

    if (!clientId) {
      showToast('Bitte zuerst einen Mandanten zuordnen')
      return
    }
    if (!action) {
      showToast('Bitte eine Aktion auswählen')
      return
    }

    const client = clients.find(c => c.id === clientId)
    if (!client && action !== 'ignorieren') {
      showToast('Mandant nicht gefunden')
      return
    }

    try {
      switch (action) {
        case 'aufgabe': {
          const newAuftrag = {
            id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            typ: draft.typ || 'freitext',
            bezeichnung: draft.bezeichnung || 'Neuer Auftrag (Bot)',
            jahr: draft.jahr || null,
            monat: draft.monat || null,
            frist: draft.frist || null,
            status: 'offen',
            istSerie: false,
            notiz: draft.notiz || '',
            hinweise: [],
            erstelltAm: new Date().toISOString(),
          }
          onUpdateClient(clientId, {
            auftraege: [...(client.auftraege ?? []), newAuftrag],
          })
          showToast(`✓ Aufgabe "${draft.bezeichnung || 'Neuer Auftrag'}" erstellt`)
          break
        }
        case 'notiz': {
          const ts = new Date()
          const tsStr = `${ts.getDate().toString().padStart(2, '0')}.${(ts.getMonth() + 1).toString().padStart(2, '0')}.${ts.getFullYear()}`

          if (draft.bereich === 'lohn' || draft.bereich === 'fibu') {
            const notizen = Array.isArray(client.fibuNotizen) ? client.fibuNotizen : []
            onUpdateClient(clientId, {
              fibuNotizen: [...notizen, {
                id: 'fn' + Date.now().toString(36),
                text: `[${tsStr} – Bot] ${draft.text || item.raw_text}${draft.kontext ? ' (' + draft.kontext + ')' : ''}`,
                datum: ts.toISOString(),
              }],
            })
          } else {
            const existing = client.notizen ?? ''
            const addition = `\n\n[${tsStr} – Telegram Bot]\n${draft.text || item.raw_text}${draft.kontext ? '\nKontext: ' + draft.kontext : ''}`
            onUpdateClient(clientId, { notizen: existing + addition })
          }
          showToast(`✓ Notiz gespeichert (${draft.bereich || 'allgemein'})`)
          break
        }
        case 'hinweis': {
          const hinweise = client.standDerArbeit?.hinweise ?? []
          const ts = new Date()
          const tsStr = `${ts.getDate().toString().padStart(2, '0')}.${(ts.getMonth() + 1).toString().padStart(2, '0')}.${ts.getFullYear()}`
          const newHinweis = {
            id: 'h' + Date.now().toString(36),
            text: `[${tsStr} – Bot] ${draft.text || item.raw_text}`,
            datum: ts.toISOString(),
            erledigt: false,
          }
          onUpdateClient(clientId, {
            standDerArbeit: {
              ...client.standDerArbeit,
              hinweise: [...hinweise, newHinweis],
            },
          })
          showToast('✓ Hinweis hinzugefügt')
          break
        }
        case 'email': {
          if (onNavigateToClient) {
            onNavigateToClient(clientId, 6, {
              prefillEmail: {
                betreff: draft.betreff || '',
                text: draft.text || '',
                empfaenger: draft.empfaenger || '',
              },
            })
          }
          showToast('✓ E-Mail-Entwurf geöffnet')
          break
        }
        case 'erinnerung': {
          if (!draft.datum) {
            showToast('Bitte ein Datum für die Erinnerung wählen')
            return
          }
          const erinnerungen = client.erinnerungen ?? []
          onUpdateClient(clientId, {
            erinnerungen: [...erinnerungen, {
              id: 'er' + Date.now(),
              datum: draft.datum,
              text: (draft.text || item.raw_text).trim(),
            }],
          })
          showToast('✓ Erinnerung gesetzt')
          break
        }
        case 'ignorieren': {
          await supabase
            .from('bot_inbox')
            .update({ status: 'archiviert' })
            .eq('id', item.id)
          setItems(prev => prev.filter(i => i.id !== item.id))
          setCounts(prev => ({
            ...prev,
            [item.status === 'neu' ? 'neu' : 'zugeordnet']: Math.max(0, prev[item.status === 'neu' ? 'neu' : 'zugeordnet'] - 1),
            archiviert: prev.archiviert + 1,
          }))
          showToast('📦 Eintrag archiviert')
          return // skip the standard verarbeitet-update below
        }
      }

      // Status auf verarbeitet
      await supabase
        .from('bot_inbox')
        .update({ status: 'verarbeitet', confirmed_at: new Date().toISOString() })
        .eq('id', item.id)

      setItems(prev => prev.filter(i => i.id !== item.id))
      setExpandedId(null)
      setCounts(prev => ({
        ...prev,
        [item.status === 'neu' ? 'neu' : 'zugeordnet']: Math.max(0, prev[item.status === 'neu' ? 'neu' : 'zugeordnet'] - 1),
        verarbeitet: prev.verarbeitet + 1,
      }))
    } catch (err) {
      showToast(`Fehler: ${err.message}`)
    }
  }

  // ── Schnell-Ignorieren (aus jedem Status) ──────────────────────────
  async function handleArchive(item) {
    await supabase
      .from('bot_inbox')
      .update({ status: 'archiviert' })
      .eq('id', item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
    setCounts(prev => ({
      ...prev,
      [activeTab]: Math.max(0, prev[activeTab] - 1),
      archiviert: prev.archiviert + 1,
    }))
    showToast('📦 Archiviert')
  }

  // ── Render ─────────────────────────────────
  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <span style={{ fontSize: '24px' }}>🤖</span>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>Bot-Inbox</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Telegram-Nachrichten verarbeiten
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

      {/* Status-Tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '20px', padding: '4px',
        background: 'var(--surface2)', borderRadius: '12px',
      }}>
        {STATUS_TABS.map(tab => {
          const active = activeTab === tab.key
          const count = counts[tab.key] || 0
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: '8px 6px', border: 'none', cursor: 'pointer',
                borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                background: active ? 'var(--surface)' : 'transparent',
                color: active ? tab.color : 'var(--text-muted)',
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '13px' }}>{tab.icon}</span>
              <span>{tab.label}</span>
              {count > 0 && (
                <span style={{
                  minWidth: '18px', height: '18px', lineHeight: '18px', textAlign: 'center',
                  borderRadius: '9px', fontSize: '10px', fontWeight: 700,
                  background: active ? tab.color + '18' : 'rgba(0,0,0,0.06)',
                  color: active ? tab.color : 'var(--text-muted)',
                  padding: '0 5px',
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          padding: '10px 16px', marginBottom: '16px', borderRadius: '10px',
          background: toast.startsWith('✓') ? 'rgba(22,163,74,0.08)' : toast.startsWith('Fehler') ? 'rgba(220,38,38,0.08)' : 'rgba(37,99,235,0.08)',
          color: toast.startsWith('✓') ? '#16a34a' : toast.startsWith('Fehler') ? '#dc2626' : 'var(--text)',
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
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>
            {activeTab === 'neu' ? '📭' : activeTab === 'verarbeitet' ? '✅' : activeTab === 'archiviert' ? '📦' : '👤'}
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
            {activeTab === 'neu' ? 'Keine neuen Einträge' :
             activeTab === 'zugeordnet' ? 'Keine zugeordneten Einträge' :
             activeTab === 'verarbeitet' ? 'Keine verarbeiteten Einträge' :
             'Archiv ist leer'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {activeTab === 'neu' && 'Sende eine Nachricht über Telegram, um loszulegen.'}
          </div>
        </div>
      )}

      {/* Einträge */}
      {items.map(item => {
        const cfg = INTENT_CONFIG[item.intent] || INTENT_CONFIG.unknown
        const isExpanded = expandedId === item.id
        const hasClient = !!(assignedClients[item.id] || item.client_id)
        const currentAction = selectedActions[item.id]
        const currentDraft = actionDrafts[item.id] || item.draft || {}
        const isReadonly = activeTab === 'verarbeitet' || activeTab === 'archiviert'

        return (
          <div key={item.id} style={{
            marginBottom: '12px', borderRadius: '14px', overflow: 'hidden',
            border: `1px solid ${isExpanded ? cfg.color + '40' : cfg.color + '20'}`,
            background: 'var(--surface)',
            boxShadow: isExpanded ? `0 4px 16px rgba(0,0,0,0.1)` : '0 2px 8px rgba(0,0,0,0.06)',
            transition: 'all 0.2s',
          }}>
            {/* Karten-Header */}
            <div
              onClick={() => !isReadonly && setExpandedId(isExpanded ? null : item.id)}
              style={{
                padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px',
                borderBottom: '1px solid var(--border)',
                background: cfg.bg,
                cursor: isReadonly ? 'default' : 'pointer',
              }}
            >
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                background: cfg.color + '18', color: cfg.color,
              }}>
                {cfg.icon} {cfg.label}
              </span>
              {(item.client_name || assignedClients[item.id]) && (
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                  👤 {item.client_name || clients.find(c => c.id === assignedClients[item.id])?.name || ''}
                </span>
              )}
              {!item.client_name && !assignedClients[item.id] && item.intent !== 'unknown' && (
                <span style={{ fontSize: '12px', color: '#f97316', fontWeight: 600 }}>
                  ⚠ Mandant nicht erkannt
                </span>
              )}
              {/* Status-Badge für verarbeitet/archiviert */}
              {(activeTab === 'verarbeitet' || activeTab === 'archiviert') && (
                <span style={{
                  fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                  background: activeTab === 'verarbeitet' ? 'rgba(22,163,74,0.1)' : 'rgba(100,116,139,0.1)',
                  color: activeTab === 'verarbeitet' ? '#16a34a' : '#64748b',
                }}>
                  {activeTab === 'verarbeitet' ? '✅ Erledigt' : '📦 Archiviert'}
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {fmtTime(item.created_at)}
              </span>
              {!isReadonly && (
                <span style={{ fontSize: '14px', color: 'var(--text-muted)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  ▼
                </span>
              )}
            </div>

            {/* Inhalt: E-Mail-Ansicht (Zusammenfassung/Original) oder Telegram-Rohtext */}
            {item.draft?._email ? (
              <EmailContent item={item} expanded={isExpanded} />
            ) : (
              <div style={{ padding: '12px 18px', borderBottom: isExpanded ? '1px solid var(--border)' : 'none' }}>
                <div style={{
                  fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic',
                  padding: '8px 12px', borderRadius: '8px', background: 'rgba(0,0,0,0.03)',
                  borderLeft: `3px solid ${cfg.color}40`, lineHeight: 1.5,
                }}>
                  „{item.raw_text}"
                </div>
                {/* KI-Vorschlag Zusammenfassung */}
                {!isExpanded && item.draft && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', padding: '0 2px' }}>
                    → {draftPreview(item.intent, item.draft)}
                  </div>
                )}
              </div>
            )}

            {/* ── Erweiterter Bereich (nur wenn expanded + nicht readonly) ── */}
            {isExpanded && !isReadonly && (
              <div style={{ padding: '16px 18px' }}>

                {/* Schritt 1: Mandant zuordnen */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    ① Mandant zuordnen
                  </div>
                  <ClientSearchField
                    clients={clients}
                    value={assignedClients[item.id] || item.client_id}
                    onChange={cId => {
                      if (cId) {
                        assignClient(item, cId)
                      } else {
                        setAssignedClients(prev => { const next = { ...prev }; delete next[item.id]; return next })
                      }
                    }}
                  />
                </div>

                {/* Schritt 2: Aktion wählen (nur wenn Mandant zugeordnet) */}
                {hasClient && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      ② Aktion wählen
                    </div>
                    <ActionSelector
                      selectedAction={currentAction}
                      onSelect={key => {
                        setSelectedActions(prev => ({ ...prev, [item.id]: key }))
                        // Draft initialisieren basierend auf Aktion
                        if (key === 'aufgabe') {
                          setActionDrafts(prev => ({ ...prev, [item.id]: {
                            bezeichnung: item.draft?.bezeichnung || '',
                            typ: item.draft?.typ || 'freitext',
                            jahr: item.draft?.jahr || null,
                            monat: item.draft?.monat || null,
                            frist: '',
                            notiz: item.draft?.notiz || item.raw_text || '',
                          }}))
                        } else if (key === 'notiz') {
                          setActionDrafts(prev => ({ ...prev, [item.id]: {
                            bereich: item.draft?.bereich || 'allgemein',
                            text: item.draft?.text || item.raw_text || '',
                            kontext: item.draft?.kontext || '',
                          }}))
                        } else if (key === 'hinweis') {
                          setActionDrafts(prev => ({ ...prev, [item.id]: {
                            bereich: 'allgemein',
                            text: item.draft?.text || item.raw_text || '',
                          }}))
                        } else if (key === 'email') {
                          setActionDrafts(prev => ({ ...prev, [item.id]: {
                            betreff: item.draft?.betreff || '',
                            text: item.draft?.text || item.raw_text || '',
                            empfaenger: item.draft?.empfaenger || '',
                          }}))
                        } else if (key === 'erinnerung') {
                          // Standarddatum: morgen
                          const morgen = new Date()
                          morgen.setDate(morgen.getDate() + 1)
                          const morgenStr = morgen.toISOString().split('T')[0]
                          setActionDrafts(prev => ({ ...prev, [item.id]: {
                            datum: morgenStr,
                            text: item.raw_text || '',
                          }}))
                        }
                      }}
                    />
                  </div>
                )}

                {/* Schritt 3: Formular (je nach Aktion) */}
                {hasClient && currentAction && currentAction !== 'ignorieren' && (
                  <div style={{
                    marginBottom: '16px', padding: '14px', borderRadius: '12px',
                    background: 'rgba(37,99,235,0.03)', border: '1px solid rgba(37,99,235,0.1)',
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      ③ Details bearbeiten
                    </div>
                    {currentAction === 'aufgabe' && (
                      <AufgabeForm draft={currentDraft} onChange={d => setActionDrafts(prev => ({ ...prev, [item.id]: d }))} />
                    )}
                    {currentAction === 'notiz' && (
                      <NotizForm draft={currentDraft} onChange={d => setActionDrafts(prev => ({ ...prev, [item.id]: d }))} />
                    )}
                    {currentAction === 'hinweis' && (
                      <HinweisForm draft={currentDraft} onChange={d => setActionDrafts(prev => ({ ...prev, [item.id]: d }))} />
                    )}
                    {currentAction === 'email' && (
                      <EmailForm draft={currentDraft} onChange={d => setActionDrafts(prev => ({ ...prev, [item.id]: d }))} />
                    )}
                    {currentAction === 'erinnerung' && (
                      <ErinnerungForm draft={currentDraft} onChange={d => setActionDrafts(prev => ({ ...prev, [item.id]: d }))} />
                    )}
                  </div>
                )}

                {/* Aktionsleiste */}
                {hasClient && currentAction && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={() => executeAction(item)}
                      style={{
                        padding: '9px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: 'rgba(22,163,74,0.12)', color: '#16a34a',
                        fontWeight: 700, fontSize: '13px',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      ✓ {currentAction === 'ignorieren' ? 'Archivieren' : 'Ausführen'}
                    </button>
                    <button
                      onClick={() => handleArchive(item)}
                      style={{
                        padding: '9px 16px', borderRadius: '10px', border: '1px solid var(--border)',
                        background: 'transparent', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: '12px',
                      }}
                    >
                      📦 Archivieren
                    </button>
                    <button
                      onClick={() => { setExpandedId(null); setSelectedActions(prev => { const n = {...prev}; delete n[item.id]; return n }) }}
                      style={{
                        marginLeft: 'auto', padding: '9px 16px', borderRadius: '10px', border: '1px solid var(--border)',
                        background: 'transparent', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: '12px',
                      }}
                    >
                      Einklappen
                    </button>
                  </div>
                )}

                {/* Wenn noch keine Aktion gewählt: Schnell-Archivieren */}
                {!hasClient && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleArchive(item)} style={{
                      padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--border)',
                      background: 'transparent', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: '12px',
                    }}>
                      📦 Ignorieren / Archivieren
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Kompakte Aktionsleiste (nicht expanded, nicht readonly) */}
            {!isExpanded && !isReadonly && (
              <div style={{
                padding: '8px 18px', display: 'flex', gap: '8px', alignItems: 'center',
              }}>
                <button onClick={() => setExpandedId(item.id)} style={{
                  padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  background: 'rgba(37,99,235,0.08)', color: 'var(--accent)',
                  fontWeight: 600, fontSize: '12px',
                }}>
                  Bearbeiten →
                </button>
                <button onClick={() => handleArchive(item)} style={{
                  padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)',
                  background: 'transparent', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '11px',
                }}>
                  📦
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
    // Zähle "neu" + "zugeordnet" (beides erfordert Aktion)
    const { count: neuCount, error: e1 } = await supabase
      .from('bot_inbox')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'neu')

    const { count: zugCount, error: e2 } = await supabase
      .from('bot_inbox')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'zugeordnet')

    const total = ((!e1 && typeof neuCount === 'number') ? neuCount : 0)
               + ((!e2 && typeof zugCount === 'number') ? zugCount : 0)
    setCount(total)
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
