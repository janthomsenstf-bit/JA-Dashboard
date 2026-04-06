import { useState } from 'react'

function fmtDatum(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
}

const BEREICHE = [
  { id: 'abschluss', icon: '📁', titel: 'Hinweise Abschluss',        color: '#1e3a5f', bg: 'rgba(30,58,95,0.06)'  },
  { id: 'fibu',      icon: '📒', titel: 'Hinweise Fibu',             color: '#0f766e', bg: 'rgba(15,118,110,0.06)' },
  { id: 'steuer',    icon: '📄', titel: 'Hinweise Steuererklärung',   color: '#6d28d9', bg: 'rgba(109,40,217,0.06)' },
]

function HinweisBereich({ bereich, eintraege, onAdd, onDelete }) {
  const [text, setText] = useState('')

  function add() {
    const t = text.trim()
    if (!t) return
    onAdd(bereich.id, { id: 'h' + Date.now().toString(36), text: t, datum: new Date().toISOString() })
    setText('')
  }

  return (
    <div style={{
      border: `1px solid ${bereich.color}33`,
      borderRadius: '8px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: bereich.color,
        color: '#fff',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ fontSize: '15px' }}>{bereich.icon}</span>
        <span style={{ fontWeight: 700, fontSize: '13px' }}>{bereich.titel}</span>
        {eintraege.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '11px', background: 'rgba(255,255,255,0.25)', padding: '1px 8px', borderRadius: '10px', fontWeight: 600 }}>
            {eintraege.length}
          </span>
        )}
      </div>

      {/* Eingabe */}
      <div style={{ padding: '10px', background: bereich.bg, borderBottom: `1px solid ${bereich.color}22`, display: 'flex', gap: '8px' }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add() } }}
          placeholder={`Hinweis für ${bereich.titel} eingeben…`}
          rows={2}
          style={{
            flex: 1, padding: '7px 10px', border: `1px solid ${bereich.color}44`,
            borderRadius: '6px', background: '#fff', color: 'var(--text)',
            fontSize: '12px', lineHeight: 1.5, resize: 'none', boxSizing: 'border-box',
          }}
        />
        <button
          onClick={add}
          disabled={!text.trim()}
          style={{
            padding: '0 14px', borderRadius: '6px', border: 'none',
            background: text.trim() ? bereich.color : 'var(--border)',
            color: '#fff', fontWeight: 700, fontSize: '18px', cursor: text.trim() ? 'pointer' : 'not-allowed',
            alignSelf: 'stretch', transition: 'background 0.15s', flexShrink: 0,
          }}
          title="Hinweis hinzufügen (Enter)"
        >+</button>
      </div>

      {/* Eintragliste */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--surface)' }}>
        {eintraege.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
            Noch keine Hinweise eingetragen.
          </div>
        ) : (
          [...eintraege].reverse().map(e => (
            <div key={e.id} style={{
              padding: '9px 12px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            }}>
              {/* Bullet */}
              <span style={{ color: bereich.color, fontSize: '16px', lineHeight: 1.4, flexShrink: 0, marginTop: '1px' }}>›</span>

              {/* Text + Datum */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {e.text}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  📅 {fmtDatum(e.datum)}
                </div>
              </div>

              {/* Löschen */}
              <button
                onClick={() => onDelete(bereich.id, e.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '14px', padding: '2px 4px',
                  borderRadius: '4px', flexShrink: 0, lineHeight: 1,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={ev => ev.currentTarget.style.color = '#ef4444'}
                onMouseLeave={ev => ev.currentTarget.style.color = 'var(--text-muted)'}
                title="Hinweis löschen"
              >🗑</button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function HinweiseTab({ client, onUpdate }) {
  const hinweise = client.hinweise ?? {}

  function getEintraege(bereichId) {
    return hinweise[bereichId] ?? []
  }

  function addHinweis(bereichId, eintrag) {
    onUpdate({
      hinweise: {
        ...hinweise,
        [bereichId]: [...getEintraege(bereichId), eintrag],
      },
    })
  }

  function deleteHinweis(bereichId, id) {
    onUpdate({
      hinweise: {
        ...hinweise,
        [bereichId]: getEintraege(bereichId).filter(e => e.id !== id),
      },
    })
  }

  return (
    <div className="tab-content" style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '14px',
      alignItems: 'start',
      height: '100%',
    }}>
      {BEREICHE.map(b => (
        <HinweisBereich
          key={b.id}
          bereich={b}
          eintraege={getEintraege(b.id)}
          onAdd={addHinweis}
          onDelete={deleteHinweis}
        />
      ))}
    </div>
  )
}
