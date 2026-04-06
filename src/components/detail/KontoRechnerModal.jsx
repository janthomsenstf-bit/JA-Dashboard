import { useState } from 'react'
import { KFZRechner, ArbeitszimmerRechner, ReisekostenRechner } from './RechnerTab.jsx'

const SUB_TABS = [
  { key: 'kfz',           label: '🚗 KFZ-Nutzung' },
  { key: 'arbeitszimmer', label: '🏠 Arbeitszimmer' },
  { key: 'reisekosten',   label: '✈️ Reisekosten' },
]

export default function KontoRechnerModal({ item, state, client, onUpdateState, onClose }) {
  const [subTab, setSubTab] = useState('kfz')

  const b = state.berechnungen ?? { kfz: [], arbeitszimmer: [], reisekosten: [] }

  function saveRechItem(type, rechItem) {
    const arr = b[type] ?? []
    const exists = arr.find(x => x.id === rechItem.id)
    const next = exists
      ? arr.map(x => x.id === rechItem.id ? rechItem : x)
      : [...arr, rechItem]
    onUpdateState({ berechnungen: { ...b, [type]: next } })
  }

  function deleteRechItem(type, id) {
    onUpdateState({ berechnungen: { ...b, [type]: (b[type] ?? []).filter(x => x.id !== id) } })
  }

  const totalCount = (b.kfz?.length ?? 0) + (b.arbeitszimmer?.length ?? 0) + (b.reisekosten?.length ?? 0)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box konto-rechner-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
              🧮 Rechner
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {item.text}
              {totalCount > 0 && (
                <span style={{ marginLeft: '8px', color: 'var(--accent)', fontWeight: 600 }}>
                  {totalCount} Berechnung{totalCount !== 1 ? 'en' : ''} gespeichert
                </span>
              )}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="konto-rechner-body">
          {/* Sub-tab navigation */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {SUB_TABS.map(t => {
              const count = b[t.key]?.length ?? 0
              return (
                <button
                  key={t.key}
                  className={`email-template-btn${subTab === t.key ? ' active' : ''}`}
                  onClick={() => setSubTab(t.key)}
                  style={{ fontSize: '13px', padding: '7px 16px' }}
                >
                  {t.label}
                  {count > 0 && (
                    <span style={{
                      marginLeft: '6px', background: subTab === t.key ? 'rgba(255,255,255,0.3)' : 'var(--accent-dim)',
                      color: subTab === t.key ? 'inherit' : 'var(--accent)',
                      borderRadius: '10px', fontSize: '11px', padding: '0 5px', fontWeight: 700,
                    }}>{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Disclaimer */}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '7px 12px', marginBottom: '14px', lineHeight: 1.6 }}>
            ℹ️ Berechnungen für VZ <strong style={{ color: 'var(--text-secondary)' }}>{client.veranlagungsjahr}</strong> · Alle Ergebnisse ohne Gewähr.
          </div>

          {subTab === 'kfz' && (
            <KFZRechner
              saved={b.kfz ?? []}
              onSave={item => saveRechItem('kfz', item)}
              onDelete={id => deleteRechItem('kfz', id)}
              client={client}
            />
          )}
          {subTab === 'arbeitszimmer' && (
            <ArbeitszimmerRechner
              saved={b.arbeitszimmer ?? []}
              onSave={item => saveRechItem('arbeitszimmer', item)}
              onDelete={id => deleteRechItem('arbeitszimmer', id)}
              client={client}
            />
          )}
          {subTab === 'reisekosten' && (
            <ReisekostenRechner
              saved={b.reisekosten ?? []}
              onSave={item => saveRechItem('reisekosten', item)}
              onDelete={id => deleteRechItem('reisekosten', id)}
              client={client}
            />
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  )
}
