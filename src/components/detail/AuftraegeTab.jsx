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

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function AuftraegeTab({ client, onUpdate }) {
  const auftraege = client.auftraege ?? []

  const [filterStatus, setFilterStatus] = useState('aktiv')  // aktiv = offen + in_bearbeitung
  const [filterTyp,    setFilterTyp]    = useState('alle')
  const [expandedId,   setExpandedId]   = useState(null)
  const [quickTyp,     setQuickTyp]     = useState('lohn')   // für Quick-Create

  function save(list) { onUpdate({ auftraege: list }) }

  function createAuftrag() {
    const au = mkAuftrag(quickTyp)
    save([au, ...auftraege])
    setExpandedId(au.id)
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
        </div>
      </div>

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
