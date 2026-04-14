/**
 * StrukturPanel.jsx – Steuerliche Strukturübersicht
 * Zeigt Personen, Einkunftsarten, Beteiligungen und Unternehmen visuell an.
 * Keine externe Library – reines React + inline CSS.
 */
import { useState } from 'react'

// ── Einkunftsarten-Katalog ────────────────────────────────────────────────────
const EINKUNFTSARTEN = {
  anlageN:        { label: 'Nichtselbständige Arbeit',     kurz: 'Anlage N',   icon: '💼', farbe: '#3b82f6' },
  selbstaendig:   { label: 'Selbständige Tätigkeit',       kurz: '§ 18',       icon: '🧑‍💼', farbe: '#8b5cf6' },
  gewerbebetrieb: { label: 'Gewerbebetrieb',               kurz: '§ 15',       icon: '🏭', farbe: '#f59e0b' },
  anlageV:        { label: 'Vermietung & Verpachtung',     kurz: 'Anlage V',   icon: '🏠', farbe: '#10b981' },
  anlageKap:      { label: 'Kapitalvermögen',              kurz: 'Anlage KAP', icon: '📈', farbe: '#06b6d4' },
  anlageR:        { label: 'Renten / Altersvorsorge',      kurz: 'Anlage R',   icon: '🏖', farbe: '#64748b' },
  sonstige:       { label: 'Sonstige Einkünfte',           kurz: '§ 22',       icon: '➕', farbe: '#6b7280' },
  landForst:      { label: 'Land- und Forstwirtschaft',    kurz: '§ 13',       icon: '🌾', farbe: '#84cc16' },
  ausland:        { label: 'Auslandseinkünfte',            kurz: 'Ausland',    icon: '🌍', farbe: '#ec4899' },
  sonderausgaben: { label: 'Sonderausgaben',               kurz: 'SA',         icon: '🧾', farbe: '#94a3b8' },
  agb:            { label: 'Außergewöhnliche Belastungen', kurz: 'AgB',        icon: '⚕️', farbe: '#f87171' },
}

const ROLLEN = {
  hauptperson: { label: 'Hauptperson', icon: '👤', farbe: '#1e40af' },
  ehegatte:    { label: 'Ehegatte / Lebenspartner', icon: '👥', farbe: '#7c3aed' },
  kind:        { label: 'Kind', icon: '👶', farbe: '#047857' },
  sonstig:     { label: 'Sonstige Person', icon: '👤', farbe: '#6b7280' },
}

const VERANLAGUNG = {
  zusammen: { label: 'Zusammenveranlagung', icon: '👫', farbe: '#2563eb' },
  getrennt:  { label: 'Getrennte Veranlagung', icon: '↔️', farbe: '#d97706' },
  einzeln:   { label: 'Einzelveranlagung', icon: '👤', farbe: '#6b7280' },
}

const UNTERNEHMENS_TYPEN = ['GmbH', 'AG', 'KG', 'GmbH & Co. KG', 'GbR', 'UG', 'OHG', 'Einzelunternehmen', 'Sonstig']

function genId() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }

// ── EinkunftsChip ─────────────────────────────────────────────────────────────
function EinkunftsChip({ id, onClick, active }) {
  const e = EINKUNFTSARTEN[id]
  if (!e) return null
  return (
    <span
      onClick={onClick}
      title={e.label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '3px 8px', borderRadius: '14px', fontSize: '11px', fontWeight: 600,
        cursor: onClick ? 'pointer' : 'default',
        background: active !== false ? e.farbe + '20' : 'var(--surface2)',
        color:      active !== false ? e.farbe : 'var(--text-muted)',
        border:     `1px solid ${active !== false ? e.farbe + '50' : 'var(--border)'}`,
        transition: 'all 0.1s',
        userSelect: 'none',
      }}
    >
      {e.icon} {e.kurz}
    </span>
  )
}

// ── ChipPicker: Multi-Select für Einkunftsarten ───────────────────────────────
function ChipPicker({ selected, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
      {Object.keys(EINKUNFTSARTEN).map(key => {
        const isOn = selected.includes(key)
        const e    = EINKUNFTSARTEN[key]
        return (
          <span
            key={key}
            onClick={() => onChange(isOn ? selected.filter(k => k !== key) : [...selected, key])}
            title={e.label}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '4px 9px', borderRadius: '14px', fontSize: '11px', fontWeight: 600,
              cursor: 'pointer', userSelect: 'none',
              background: isOn ? e.farbe + '20' : 'var(--surface)',
              color:      isOn ? e.farbe : 'var(--text-muted)',
              border:     `1px solid ${isOn ? e.farbe + '50' : 'var(--border)'}`,
              transition: 'all 0.1s',
            }}
          >
            {e.icon} {e.kurz}
          </span>
        )
      })}
    </div>
  )
}

// ── Personen-Editor-Zeile ─────────────────────────────────────────────────────
function PersonForm({ person, onChange, onDelete }) {
  const [open, setOpen] = useState(true)
  const rolleInfo = ROLLEN[person.rolle] ?? ROLLEN.sonstig
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'var(--surface)', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: '16px' }}>{rolleInfo.icon}</span>
        <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
          {person.name || <span style={{ color: 'var(--text-muted)' }}>– Name –</span>}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{rolleInfo.label}</span>
        <button onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px', padding: '0 2px', lineHeight: 1 }}>🗑</button>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '12px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Name</label>
              <input className="input" value={person.name} onChange={e => onChange({ name: e.target.value })}
                style={{ fontSize: '12px', padding: '5px 8px' }} placeholder="z. B. Max Mustermann" />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Rolle</label>
              <select className="input" value={person.rolle} onChange={e => onChange({ rolle: e.target.value })}
                style={{ fontSize: '12px', padding: '5px 8px' }}>
                {Object.entries(ROLLEN).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '5px' }}>Einkunftsarten</label>
            <ChipPicker selected={person.einkunftsarten} onChange={ea => onChange({ einkunftsarten: ea })} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Notiz</label>
            <input className="input" value={person.notiz ?? ''} onChange={e => onChange({ notiz: e.target.value })}
              style={{ fontSize: '12px', padding: '5px 8px' }} placeholder="Optional: Besonderheiten, Hinweise…" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Unternehmens-Editor-Zeile ─────────────────────────────────────────────────
function UnternehmenForm({ unternehmen, personen, onChange, onDelete }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', background: 'var(--surface)', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: '16px' }}>🏢</span>
        <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
          {unternehmen.name || <span style={{ color: 'var(--text-muted)' }}>– Name –</span>}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{unternehmen.typ}</span>
        <button onClick={e => { e.stopPropagation(); onDelete() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px', padding: '0 2px', lineHeight: 1 }}>🗑</button>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '12px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Name</label>
              <input className="input" value={unternehmen.name} onChange={e => onChange({ name: e.target.value })}
                style={{ fontSize: '12px', padding: '5px 8px' }} placeholder="z. B. Muster GmbH" />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Rechtsform</label>
              <select className="input" value={unternehmen.typ} onChange={e => onChange({ typ: e.target.value })}
                style={{ fontSize: '12px', padding: '5px 8px' }}>
                {UNTERNEHMENS_TYPEN.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {/* Beteiligungen */}
          {personen.length > 0 && (
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Beteiligungen (%)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {personen.map(p => {
                  const bet = (unternehmen.beteiligungen ?? []).find(b => b.personId === p.id)
                  const anteil = bet?.anteil ?? ''
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                      <span style={{ flex: 1, color: 'var(--text)' }}>{p.name || '(unbenannt)'}</span>
                      <input
                        type="number" min={0} max={100} step={0.01}
                        className="input"
                        value={anteil}
                        onChange={e => {
                          const val = e.target.value
                          const neuBet = [...(unternehmen.beteiligungen ?? []).filter(b => b.personId !== p.id)]
                          if (val !== '') neuBet.push({ personId: p.id, anteil: parseFloat(val) })
                          onChange({ beteiligungen: neuBet })
                        }}
                        placeholder="0"
                        style={{ width: '80px', fontSize: '12px', padding: '4px 7px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                      />
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Notiz</label>
            <input className="input" value={unternehmen.notiz ?? ''} onChange={e => onChange({ notiz: e.target.value })}
              style={{ fontSize: '12px', padding: '5px 8px' }} placeholder="Optional: Besonderheiten, Themen…" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Bearbeiten-Modal ──────────────────────────────────────────────────────────
function BearbeitenModal({ struktur, onSave, onClose }) {
  const [veranlagung, setVeranlagung] = useState(struktur.veranlagung ?? 'einzeln')
  const [personen,    setPersonen]    = useState(struktur.personen    ?? [])
  const [unternehmen, setUnternehmen] = useState(struktur.unternehmen ?? [])
  const [gemeinsam,   setGemeinsam]   = useState(struktur.gemeinsam   ?? [])

  function addPerson() {
    setPersonen(prev => [...prev, { id: genId(), rolle: prev.length === 0 ? 'hauptperson' : 'ehegatte', name: '', einkunftsarten: [], notiz: '' }])
  }
  function updatePerson(id, patch) {
    setPersonen(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }
  function deletePerson(id) {
    setPersonen(prev => prev.filter(p => p.id !== id))
    // Beteiligungen aus Unternehmen entfernen
    setUnternehmen(prev => prev.map(u => ({ ...u, beteiligungen: (u.beteiligungen ?? []).filter(b => b.personId !== id) })))
  }

  function addUnternehmen() {
    setUnternehmen(prev => [...prev, { id: genId(), typ: 'GmbH', name: '', beteiligungen: [], notiz: '' }])
  }
  function updateUnternehmen(id, patch) {
    setUnternehmen(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u))
  }

  function handleSave() {
    onSave({ veranlagung, personen, unternehmen, gemeinsam })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '14px', width: '100%', maxWidth: '680px', border: '1px solid var(--border)', boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>🏗 Steuerliche Struktur bearbeiten</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Abbrechen</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>💾 Speichern</button>
          </div>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Veranlagungsart */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Veranlagungsart
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {Object.entries(VERANLAGUNG).map(([k, v]) => (
                <button key={k}
                  className={`btn btn-sm ${veranlagung === k ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setVeranlagung(k)}
                  style={{ fontSize: '12px' }}
                >
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Personen */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Personen ({personen.length})
              </div>
              <button className="btn btn-ghost btn-sm" onClick={addPerson} style={{ fontSize: '11px' }}>➕ Person</button>
            </div>
            {personen.length === 0 && (
              <div style={{ padding: '16px', border: '1px dashed var(--border)', borderRadius: '8px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                Noch keine Personen – „➕ Person" klicken
              </div>
            )}
            {personen.map(p => (
              <PersonForm key={p.id} person={p}
                onChange={patch => updatePerson(p.id, patch)}
                onDelete={() => deletePerson(p.id)} />
            ))}
          </div>

          {/* Gemeinsame Einkunftsarten (nur bei ≥2 Personen) */}
          {personen.length >= 2 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Gemeinsame Positionen (z. B. gemeinsame Vermietung, Sonderausgaben)
              </div>
              <ChipPicker selected={gemeinsam} onChange={setGemeinsam} />
            </div>
          )}

          {/* Unternehmen / Beteiligungen */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Unternehmen / Beteiligungen ({unternehmen.length})
              </div>
              <button className="btn btn-ghost btn-sm" onClick={addUnternehmen} style={{ fontSize: '11px' }}>➕ Unternehmen</button>
            </div>
            {unternehmen.length === 0 && (
              <div style={{ padding: '16px', border: '1px dashed var(--border)', borderRadius: '8px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                Keine Beteiligungen – „➕ Unternehmen" klicken
              </div>
            )}
            {unternehmen.map(u => (
              <UnternehmenForm key={u.id} unternehmen={u} personen={personen}
                onChange={patch => updateUnternehmen(u.id, patch)}
                onDelete={() => setUnternehmen(prev => prev.filter(x => x.id !== u.id))} />
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Personen-Karte (Ansicht) ──────────────────────────────────────────────────
function PersonKarte({ person }) {
  const rolleInfo = ROLLEN[person.rolle] ?? ROLLEN.sonstig
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px',
      borderTop: `3px solid ${rolleInfo.farbe}`,
    }}>
      {/* Name + Rolle */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
          <span style={{ fontSize: '18px' }}>{rolleInfo.icon}</span>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
            {person.name || <span style={{ color: 'var(--text-muted)' }}>Unbenannte Person</span>}
          </span>
        </div>
        <span style={{
          fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '10px',
          background: rolleInfo.farbe + '18', color: rolleInfo.farbe,
          border: `1px solid ${rolleInfo.farbe}30`,
        }}>
          {rolleInfo.label}
        </span>
      </div>

      {/* Einkunftsarten */}
      {person.einkunftsarten?.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {person.einkunftsarten.map(id => <EinkunftsChip key={id} id={id} />)}
        </div>
      ) : (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Keine Einkunftsarten</span>
      )}

      {/* Notiz */}
      {person.notiz && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '8px', lineHeight: 1.5 }}>
          {person.notiz}
        </div>
      )}
    </div>
  )
}

// ── Unternehmens-Karte (Ansicht) ──────────────────────────────────────────────
function UnternehmenKarte({ unternehmen, personen }) {
  const bets = (unternehmen.beteiligungen ?? []).filter(b => b.anteil > 0)
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px',
      borderTop: '3px solid #f59e0b',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '20px' }}>🏢</span>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
            {unternehmen.name || <span style={{ color: 'var(--text-muted)' }}>Unbenanntes Unternehmen</span>}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{unternehmen.typ}</span>
        </div>
      </div>

      {/* Beteiligungen */}
      {bets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {bets.map(b => {
            const p = personen.find(x => x.id === b.personId)
            if (!p) return null
            const rolleInfo = ROLLEN[p.rolle] ?? ROLLEN.sonstig
            return (
              <div key={b.personId} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span style={{ color: rolleInfo.farbe }}>{rolleInfo.icon}</span>
                <span style={{ flex: 1, color: 'var(--text)' }}>{p.name || '(unbenannt)'}</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{b.anteil} %</span>
              </div>
            )
          })}
          {/* Summen-Check */}
          {(() => {
            const sum = bets.reduce((a, b) => a + (b.anteil || 0), 0)
            if (Math.abs(sum - 100) > 0.01 && sum > 0) {
              return <div style={{ fontSize: '10px', color: '#d97706', marginTop: '2px' }}>⚠ Gesamt: {sum.toFixed(1)} %</div>
            }
            return null
          })()}
        </div>
      )}

      {/* Notiz */}
      {unternehmen.notiz && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '8px', lineHeight: 1.5 }}>
          {unternehmen.notiz}
        </div>
      )}
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function StrukturPanel({ client, onUpdate }) {
  const [modalOffen, setModalOffen] = useState(false)

  const struktur = client.struktur ?? null

  function handleSave(neuStruktur) {
    onUpdate({ struktur: neuStruktur })
    setModalOffen(false)
  }

  function handleNeu() {
    setModalOffen(true)
  }

  const veranlagungInfo = struktur ? (VERANLAGUNG[struktur.veranlagung] ?? VERANLAGUNG.einzeln) : null

  return (
    <>
      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>

        {/* Sektion-Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--surface)',
          borderBottom: struktur ? '1px solid var(--border)' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>🏗</span>
            <div>
              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>Steuerliche Struktur</span>
              {veranlagungInfo && (
                <span style={{
                  marginLeft: '8px', fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '10px',
                  background: veranlagungInfo.farbe + '18', color: veranlagungInfo.farbe,
                  border: `1px solid ${veranlagungInfo.farbe}30`,
                }}>
                  {veranlagungInfo.icon} {veranlagungInfo.label}
                </span>
              )}
            </div>
          </div>

          <button className="btn btn-ghost btn-sm" onClick={() => setModalOffen(true)} style={{ fontSize: '11px' }}>
            {struktur ? '✏️ Bearbeiten' : '➕ Struktur anlegen'}
          </button>
        </div>

        {/* Inhalt */}
        {!struktur ? (
          <div style={{ padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏗</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Noch keine Struktur angelegt</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Erfasse Personen, Einkunftsarten und Beteiligungen für eine schnelle visuelle Übersicht.
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleNeu} style={{ fontSize: '12px' }}>
              ➕ Struktur anlegen
            </button>
          </div>
        ) : (
          <div style={{ padding: '16px' }}>

            {/* ── Personen ── */}
            {struktur.personen?.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Personen
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                  {struktur.personen.map(p => <PersonKarte key={p.id} person={p} />)}
                </div>
              </div>
            )}

            {/* ── Gemeinsame Positionen ── */}
            {struktur.personen?.length >= 2 && struktur.gemeinsam?.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Gemeinsam
                </div>
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
                  padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '5px',
                  borderTop: '3px solid #0891b2',
                }}>
                  {struktur.gemeinsam.map(id => <EinkunftsChip key={id} id={id} />)}
                </div>
              </div>
            )}

            {/* ── Unternehmen ── */}
            {struktur.unternehmen?.length > 0 && (
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Unternehmen & Beteiligungen
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
                  {struktur.unternehmen.map(u => (
                    <UnternehmenKarte key={u.id} unternehmen={u} personen={struktur.personen ?? []} />
                  ))}
                </div>
              </div>
            )}

            {/* Leer-Hinweis wenn alles leer */}
            {!struktur.personen?.length && !struktur.unternehmen?.length && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
                Struktur angelegt, aber noch keine Personen oder Unternehmen. ✏️ Bearbeiten klicken.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bearbeiten-Modal */}
      {modalOffen && (
        <BearbeitenModal
          struktur={struktur ?? { veranlagung: 'einzeln', personen: [], unternehmen: [], gemeinsam: [] }}
          onSave={handleSave}
          onClose={() => setModalOffen(false)}
        />
      )}
    </>
  )
}
