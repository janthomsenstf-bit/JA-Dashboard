import { useState } from 'react'

// ── Konfiguration (auch von AuftragKontextPanel genutzt) ──────────────────────
export const AUFTRAGS_TYP_CFG = {
  jahresabschluss: { label: 'Jahresabschluss', icon: '📁', color: '#2563eb', bg: 'rgba(37,99,235,0.08)',  border: 'rgba(37,99,235,0.25)' },
  fibu:            { label: 'Buchhaltung/FIBU', icon: '📒', color: '#0891b2', bg: 'rgba(8,145,178,0.08)', border: 'rgba(8,145,178,0.25)' },
  lohn:            { label: 'Lohn',             icon: '💼', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)' },
  beratung:        { label: 'Beratung',          icon: '🧠', color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.25)' },
  ust:             { label: 'Umsatzsteuer',      icon: '🧾', color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)' },
  freitext:        { label: 'Eigener Auftrag',   icon: '📝', color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.25)' },
}

export const AUFTRAGS_STATUS_CFG = {
  offen:          { label: 'Offen',          icon: '○', color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.3)' },
  in_bearbeitung: { label: 'In Bearbeitung', icon: '◑', color: '#2563eb', bg: 'rgba(37,99,235,0.09)',  border: 'rgba(37,99,235,0.3)' },
  erledigt:       { label: 'Erledigt',       icon: '●', color: '#16a34a', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.3)' },
}

const MONATE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
const STATUS_ORDER = ['offen', 'in_bearbeitung', 'erledigt']

const SERIE_RHYTHMUS = [
  { key: 'monatlich',      label: 'Monatlich (12×)',      monate: [1,2,3,4,5,6,7,8,9,10,11,12] },
  { key: 'quartalsweise',  label: 'Quartalsweise (4×)',   monate: [3,6,9,12] },
  { key: 'halbjaehrlich',  label: 'Halbjährlich (2×)',    monate: [6,12] },
  { key: 'jaehrlich',      label: 'Jährlich (1×)',        monate: [12] },
]

// ── Frist-Defaults pro Auftragstyp ────────────────────────────────────────────
const FRIST_DEFAULTS = {
  lohn:            { modus: 'gleicher',   tag: 22 },  // 22. des Leistungsmonats
  fibu:            { modus: 'folgemonat', tag: 10 },  // 10. des Folgemonats
  ust:             { modus: 'folgemonat', tag: 10 },  // 10. des Folgemonats
  jahresabschluss: { modus: 'kein',       tag: 1  },
  beratung:        { modus: 'kein',       tag: 1  },
  freitext:        { modus: 'kein',       tag: 1  },
}

/**
 * Berechnet das Frist-Datum für einen Serienauftrag.
 * @param {number} ljahr   – Leistungsjahr
 * @param {number} lmonat  – Leistungsmonat (1-12)
 * @param {string} modus   – 'kein' | 'gleicher' | 'folgemonat' | 'tage'
 * @param {number} tag     – Tag im Monat (für gleicher/folgemonat)
 * @param {number} tage    – Anzahl Tage nach Monatsende (für 'tage')
 * @returns {string} ISO-Datum 'YYYY-MM-DD' oder ''
 */
function calcFrist(ljahr, lmonat, modus, tag, tage) {
  if (modus === 'kein') return ''

  if (modus === 'tage') {
    // X Tage nach letztem Tag des Leistungsmonats
    const lastDay = new Date(ljahr, lmonat, 0)      // day-0 trick = letzter Tag des Monats
    lastDay.setDate(lastDay.getDate() + (tage || 0))
    return lastDay.toISOString().slice(0, 10)
  }

  // 'gleicher' oder 'folgemonat'
  let fJahr = ljahr
  let fMonat = lmonat
  if (modus === 'folgemonat') {
    fMonat++
    if (fMonat > 12) { fMonat = 1; fJahr++ }
  }
  const maxDay = new Date(fJahr, fMonat, 0).getDate()
  const d      = Math.min(Math.max(1, tag || 1), maxDay)
  return `${fJahr}-${String(fMonat).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ── Factories ─────────────────────────────────────────────────────────────────
function mkAuftrag(typ = 'freitext') {
  return {
    id:          'au_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    typ,
    bezeichnung: '',
    jahr:        new Date().getFullYear(),
    monat:       null,
    frist:       '',
    status:      'offen',
    notiz:       '',
    hinweise:    [],
    erstelltAm:  new Date().toISOString(),
    erledigtAm:  null,
  }
}

function mkHinweis(text) {
  return {
    id:        'h_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
    text,
    erledigt:  false,
    createdAt: new Date().toISOString(),
  }
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function fmtFrist(iso) {
  if (!iso) return null
  const d     = new Date(iso + 'T12:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff  = Math.ceil((d - today) / (1000 * 60 * 60 * 24))
  const ds    = `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
  if (diff < 0)   return { text: `${ds} (${Math.abs(diff)}d überfällig)`, color: '#ef4444' }
  if (diff === 0) return { text: `${ds} (heute)`,  color: '#f97316' }
  if (diff <= 7)  return { text: `${ds} (${diff}d)`, color: '#f97316' }
  if (diff <= 30) return { text: `${ds} (${diff}d)`, color: '#eab308' }
  return { text: ds, color: 'var(--text-muted)' }
}

// ── Auftrag-Karte ─────────────────────────────────────────────────────────────
function AuftragCard({ au, expanded, onExpand, onUpdate, onDelete }) {
  const typCfg    = AUFTRAGS_TYP_CFG[au.typ]     ?? AUFTRAGS_TYP_CFG.freitext
  const statusCfg = AUFTRAGS_STATUS_CFG[au.status] ?? AUFTRAGS_STATUS_CFG.offen
  const frist     = fmtFrist(au.frist)
  const hinweise  = au.hinweise ?? []
  const offeneH   = hinweise.filter(h => !h.erledigt).length

  const [newH, setNewH] = useState('')

  function cycleStatus(e) {
    e.stopPropagation()
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(au.status) + 1) % STATUS_ORDER.length]
    onUpdate({ status: next, erledigtAm: next === 'erledigt' ? new Date().toISOString() : null })
  }

  function addHinweis() {
    const t = newH.trim(); if (!t) return
    onUpdate({ hinweise: [...hinweise, mkHinweis(t)] })
    setNewH('')
  }

  function toggleHinweis(id) {
    onUpdate({ hinweise: hinweise.map(h => h.id === id ? { ...h, erledigt: !h.erledigt } : h) })
  }

  function deleteHinweis(id) {
    onUpdate({ hinweise: hinweise.filter(h => h.id !== id) })
  }

  const titel = au.bezeichnung || `${typCfg.label}${au.monat ? ' ' + MONATE[au.monat - 1] : ''} ${au.jahr}`

  return (
    <div style={{
      border: `1px solid ${expanded ? typCfg.color + '55' : 'var(--border)'}`,
      borderRadius: '10px', background: 'var(--surface)', overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      {/* ── Kopfzeile ── */}
      <div
        onClick={() => onExpand(expanded ? null : au.id)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 14px', cursor: 'pointer',
          background: expanded ? typCfg.bg : 'transparent',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '16px', flexShrink: 0 }}>{typCfg.icon}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: au.status === 'erledigt' ? 'var(--text-muted)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: au.status === 'erledigt' ? 'line-through' : 'none' }}>
            {titel}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '3px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: typCfg.color, fontWeight: 600, background: typCfg.bg, padding: '1px 6px', borderRadius: '8px', border: `1px solid ${typCfg.border}` }}>
              {typCfg.label}
            </span>
            {au.monat
              ? <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{MONATE[au.monat - 1]} {au.jahr}</span>
              : au.jahr && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{au.jahr}</span>
            }
            {frist && <span style={{ fontSize: '10px', fontWeight: 600, color: frist.color }}>⏰ {frist.text}</span>}
            {offeneH > 0 && (
              <span style={{ fontSize: '10px', color: '#f97316', fontWeight: 600 }}>
                · {offeneH} Hinweis{offeneH !== 1 ? 'e' : ''} offen
              </span>
            )}
          </div>
        </div>

        <button onClick={cycleStatus} title="Status wechseln (Klick wechselt weiter)"
          style={{
            fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
            border: `1px solid ${statusCfg.border}`, background: statusCfg.bg, color: statusCfg.color,
            cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
          }}>
          {statusCfg.icon} {statusCfg.label}
        </button>

        <span style={{ color: 'var(--text-muted)', fontSize: '10px', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* ── Detail-Bereich ── */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${typCfg.color}33`, padding: '14px 16px' }}>

          {/* Felder */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px', marginBottom: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Bezeichnung</span>
              <input value={au.bezeichnung} onChange={e => onUpdate({ bezeichnung: e.target.value })}
                placeholder="z. B. Lohn Juni 2026"
                style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Typ</span>
              <select value={au.typ} onChange={e => onUpdate({ typ: e.target.value })} style={inputStyle}>
                {Object.entries(AUFTRAGS_TYP_CFG).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Jahr</span>
              <input type="number" value={au.jahr} min="2020" max="2035"
                onChange={e => onUpdate({ jahr: parseInt(e.target.value) || au.jahr })}
                style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Monat</span>
              <select value={au.monat ?? ''} onChange={e => onUpdate({ monat: e.target.value ? parseInt(e.target.value) : null })} style={inputStyle}>
                <option value="">— keiner —</option>
                {MONATE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Interne Frist</span>
              <input type="date" value={au.frist} onChange={e => onUpdate({ frist: e.target.value })} style={inputStyle} />
            </label>
          </div>

          {/* Notiz */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
            <span style={labelStyle}>Notiz / Kontext</span>
            <textarea value={au.notiz} rows={2}
              onChange={e => onUpdate({ notiz: e.target.value })}
              placeholder="Interne Anmerkungen zum Auftrag…"
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </label>

          {/* Hinweise */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
              Hinweise &amp; Unteraufträge
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <input value={newH} onChange={e => setNewH(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addHinweis()}
                placeholder="Hinweis eingeben… (Enter)"
                style={{ ...inputStyle, flex: 1 }} />
              <button onClick={addHinweis}
                style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: typCfg.color, color: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>
                +
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {hinweise.length === 0
                ? <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 0' }}>Noch keine Hinweise.</div>
                : hinweise.map(h => (
                  <div key={h.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 10px', borderRadius: '6px',
                    background: h.erledigt ? 'rgba(22,163,74,0.04)' : 'var(--surface2)',
                    border: `1px solid ${h.erledigt ? 'rgba(22,163,74,0.2)' : 'var(--border)'}`,
                  }}>
                    <input type="checkbox" checked={h.erledigt} onChange={() => toggleHinweis(h.id)}
                      style={{ accentColor: typCfg.color, cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '12px', color: h.erledigt ? 'var(--text-muted)' : 'var(--text)', textDecoration: h.erledigt ? 'line-through' : 'none' }}>
                      {h.text}
                    </span>
                    <button onClick={() => deleteHinweis(h.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '0 2px', flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                      ✕
                    </button>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <button onClick={onDelete}
              style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' }}>
              🗑 Auftrag löschen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared Styles ─────────────────────────────────────────────────────────────
const labelStyle = { fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const inputStyle  = { padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', width: '100%', boxSizing: 'border-box' }

// ── Serie-Panel ───────────────────────────────────────────────────────────────
const FRIST_MODI = [
  { key: 'kein',       label: 'Keine Frist'           },
  { key: 'gleicher',   label: 'Gleicher Monat'         },
  { key: 'folgemonat', label: 'Folgemonat'             },
  { key: 'tage',       label: 'X Tage nach Monatsende' },
]

function SeriePanel({ onCreate, onClose }) {
  const initDef = FRIST_DEFAULTS.lohn   // lohn ist default-Typ
  const [typ,        setTyp]        = useState('lohn')
  const [jahr,       setJahr]       = useState(new Date().getFullYear())
  const [rhythmus,   setRhythmus]   = useState('monatlich')
  const [fristModus, setFristModus] = useState(initDef.modus)
  const [fristTag,   setFristTag]   = useState(initDef.tag)
  const [fristTage,  setFristTage]  = useState(10)

  // Smarte Defaults beim Typ-Wechsel
  function handleTypChange(newTyp) {
    setTyp(newTyp)
    const def = FRIST_DEFAULTS[newTyp]
    if (def) { setFristModus(def.modus); setFristTag(def.tag) }
  }

  const monate  = SERIE_RHYTHMUS.find(r => r.key === rhythmus)?.monate ?? []
  const vorschau = monate.map(monat => ({
    monat,
    frist: calcFrist(jahr, monat, fristModus, fristTag, fristTage),
  }))

  function handleCreate() {
    onCreate(typ, jahr, monate, { modus: fristModus, tag: fristTag, tage: fristTage })
  }

  const fmtPreviewFrist = iso => {
    if (!iso) return '—'
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  const smallInputStyle = { ...inputStyle, width: '62px', flex: 'none', padding: '5px 8px' }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--accent)',
      borderRadius: '10px',
      padding: '14px 16px',
      marginBottom: '12px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontWeight: 700, fontSize: '13px' }}>📅 Serie erstellen</span>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px' }}>✕</button>
      </div>

      {/* Zeile 1: Typ / Jahr / Rhythmus */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: '10px', marginBottom: '12px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Typ</span>
          <select value={typ} onChange={e => handleTypChange(e.target.value)} style={inputStyle}>
            {Object.entries(AUFTRAGS_TYP_CFG).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Jahr</span>
          <input type="number" value={jahr} min="2020" max="2035"
            onChange={e => setJahr(parseInt(e.target.value) || jahr)}
            style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Rhythmus</span>
          <select value={rhythmus} onChange={e => setRhythmus(e.target.value)} style={inputStyle}>
            {SERIE_RHYTHMUS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </label>
      </div>

      {/* Zeile 2: Fristlogik */}
      <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
        <div style={{ ...labelStyle, display: 'block', marginBottom: '8px' }}>Fristlogik</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {FRIST_MODI.map(o => (
            <button
              key={o.key}
              type="button"
              onClick={() => setFristModus(o.key)}
              style={{
                padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
                border: `1px solid ${fristModus === o.key ? 'var(--accent)' : 'var(--border)'}`,
                background: fristModus === o.key ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: fristModus === o.key ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: fristModus === o.key ? 700 : 400,
              }}
            >
              {o.label}
            </button>
          ))}

          {/* Tag-Eingabe für gleicher / folgemonat */}
          {(fristModus === 'gleicher' || fristModus === 'folgemonat') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tag:</span>
              <input
                type="number" min={1} max={28} value={fristTag}
                onChange={e => setFristTag(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                style={smallInputStyle}
              />
            </div>
          )}

          {/* Tage-Eingabe für 'tage' */}
          {fristModus === 'tage' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '4px' }}>
              <input
                type="number" min={0} max={90} value={fristTage}
                onChange={e => setFristTage(Math.max(0, parseInt(e.target.value) || 0))}
                style={smallInputStyle}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tage nach Monatsende</span>
            </div>
          )}
        </div>

        {/* Beschreibung des gewählten Modus */}
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
          {fristModus === 'kein'       && 'Es wird kein Fälligkeitsdatum gesetzt.'}
          {fristModus === 'gleicher'   && `Frist = ${fristTag}. des Leistungsmonats (z. B. Lohn: 22. des gleichen Monats)`}
          {fristModus === 'folgemonat' && `Frist = ${fristTag}. des Folgemonats (z. B. FIBU/USt: 10. des Folgemonats)`}
          {fristModus === 'tage'       && `Frist = ${fristTage} Tag${fristTage !== 1 ? 'e' : ''} nach dem letzten Tag des Leistungsmonats`}
        </div>
      </div>

      {/* Vorschau */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ ...labelStyle, display: 'block', marginBottom: '6px' }}>
          Vorschau – {monate.length} Aufträge
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px' }}>
          {vorschau.map(({ monat, frist }) => (
            <div key={monat} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '5px 10px', background: 'var(--surface2)', borderRadius: '6px',
              border: '1px solid var(--border)', fontSize: '11px',
            }}>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                {MONATE[monat - 1]} {jahr}
              </span>
              <span style={{ color: frist ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'monospace', fontSize: '10px' }}>
                {frist ? `→ ${fmtPreviewFrist(frist)}` : '→ —'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onClose}
          style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
          Abbrechen
        </button>
        <button onClick={handleCreate}
          style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
          ✓ {monate.length} Aufträge anlegen
        </button>
      </div>
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function AuftraegeTab({ client, onUpdate }) {
  const auftraege = client.auftraege ?? []

  const [filterStatus, setFilterStatus] = useState('aktiv')  // aktiv = offen + in_bearbeitung
  const [filterTyp,    setFilterTyp]    = useState('alle')
  const [expandedId,   setExpandedId]   = useState(null)
  const [quickTyp,     setQuickTyp]     = useState('lohn')   // für Quick-Create
  const [showSerie,    setShowSerie]    = useState(false)     // Serie-Panel

  function save(list) { onUpdate({ auftraege: list }) }

  function createAuftrag() {
    const au = mkAuftrag(quickTyp)
    save([au, ...auftraege])
    setExpandedId(au.id)
    setFilterStatus('aktiv')
    setFilterTyp('alle')
  }

  function createSerie(typ, jahr, monate, fristKonfig = { modus: 'kein', tag: 1, tage: 0 }) {
    const newAuftraege = monate.map(monat => ({
      ...mkAuftrag(typ),
      id:   'au_' + Date.now().toString(36) + monat + Math.random().toString(36).slice(2, 4),
      jahr,
      monat,
      frist: calcFrist(jahr, monat, fristKonfig.modus, fristKonfig.tag, fristKonfig.tage),
    }))
    save([...newAuftraege, ...auftraege])
    setShowSerie(false)
    setFilterStatus('aktiv')
    setFilterTyp('alle')
  }

  function updateAuftrag(id, patch) {
    save(auftraege.map(a => a.id === id ? { ...a, ...patch } : a))
  }

  function deleteAuftrag(id) {
    if (!window.confirm('Auftrag wirklich löschen?')) return
    save(auftraege.filter(a => a.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const filtered = auftraege
    .filter(a => {
      if (filterStatus === 'aktiv')         return a.status !== 'erledigt'
      if (filterStatus === 'alle')          return true
      return a.status === filterStatus
    })
    .filter(a => filterTyp === 'alle' || a.typ === filterTyp)

  const counts = {
    aktiv:          auftraege.filter(a => a.status !== 'erledigt').length,
    alle:           auftraege.length,
    offen:          auftraege.filter(a => a.status === 'offen').length,
    in_bearbeitung: auftraege.filter(a => a.status === 'in_bearbeitung').length,
    erledigt:       auftraege.filter(a => a.status === 'erledigt').length,
  }

  return (
    <div style={{ padding: '20px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>📋 Aufträge</h2>
        {auftraege.length > 0 && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '1px 9px' }}>
            {counts.aktiv} aktiv · {counts.erledigt} erledigt
          </span>
        )}

        {/* Quick-Create */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={quickTyp} onChange={e => setQuickTyp(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', cursor: 'pointer' }}>
            {Object.entries(AUFTRAGS_TYP_CFG).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
          <button onClick={createAuftrag}
            style={{ padding: '7px 16px', borderRadius: '7px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Neuer Auftrag
          </button>
          <button onClick={() => setShowSerie(v => !v)}
            title="Mehrere Aufträge als Serie anlegen"
            style={{ padding: '7px 12px', borderRadius: '7px', border: `1px solid ${showSerie ? 'var(--accent)' : 'var(--border)'}`, background: showSerie ? 'rgba(59,130,246,0.1)' : 'var(--surface2)', color: showSerie ? 'var(--accent)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            📅 Serie
          </button>
        </div>
      </div>

      {/* ── Serie-Panel ── */}
      {showSerie && (
        <SeriePanel onCreate={createSerie} onClose={() => setShowSerie(false)} />
      )}

      {/* ── Status-Filter ── */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {[
          { key: 'aktiv',          label: `Aktiv (${counts.aktiv})` },
          { key: 'offen',          label: `Offen (${counts.offen})` },
          { key: 'in_bearbeitung', label: `In Bearbeitung (${counts.in_bearbeitung})` },
          { key: 'erledigt',       label: `Erledigt (${counts.erledigt})` },
          { key: 'alle',           label: `Alle (${counts.alle})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterStatus(f.key)}
            style={{
              padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--border)',
              background: filterStatus === f.key ? 'var(--accent)' : 'var(--surface2)',
              color: filterStatus === f.key ? '#fff' : 'var(--text-muted)',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Typ-Filter ── */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => setFilterTyp('alle')}
          style={{ padding: '3px 10px', borderRadius: '20px', border: '1px solid var(--border)', background: filterTyp === 'alle' ? 'var(--surface2)' : 'transparent', color: filterTyp === 'alle' ? 'var(--text)' : 'var(--text-muted)', fontSize: '10px', cursor: 'pointer' }}>
          Alle Typen
        </button>
        {Object.entries(AUFTRAGS_TYP_CFG).map(([k, v]) => {
          const cnt = auftraege.filter(a => a.typ === k).length
          if (cnt === 0) return null
          return (
            <button key={k} onClick={() => setFilterTyp(k === filterTyp ? 'alle' : k)}
              style={{
                padding: '3px 10px', borderRadius: '20px',
                border: `1px solid ${k === filterTyp ? v.color + '66' : 'var(--border)'}`,
                background: k === filterTyp ? v.bg : 'transparent',
                color: k === filterTyp ? v.color : 'var(--text-muted)',
                fontSize: '10px', cursor: 'pointer', fontWeight: k === filterTyp ? 700 : 400,
              }}>
              {v.icon} {v.label} ({cnt})
            </button>
          )
        })}
      </div>

      {/* ── Liste ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
          {auftraege.length === 0 ? (
            <>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>Noch keine Aufträge</div>
              <div style={{ fontSize: '12px' }}>Typ auswählen und „+ Neuer Auftrag" klicken</div>
            </>
          ) : (
            <div style={{ fontSize: '13px' }}>Keine Aufträge für diesen Filter.</div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(au => (
            <AuftragCard
              key={au.id}
              au={au}
              expanded={expandedId === au.id}
              onExpand={setExpandedId}
              onUpdate={patch => updateAuftrag(au.id, patch)}
              onDelete={() => deleteAuftrag(au.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
