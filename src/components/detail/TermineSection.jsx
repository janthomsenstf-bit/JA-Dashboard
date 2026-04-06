import { useState } from 'react'
import TerminModal from '../TerminModal.jsx'

const ART_CONFIG = {
  online:     { label: 'Online-Termin', icon: '💻', color: '#3b82f6', bg: '#dbeafe' },
  frist:      { label: 'Frist / FA',    icon: '⚠️', color: '#dc2626', bg: '#fee2e2' },
  erinnerung: { label: 'Erinnerung',    icon: '📝', color: '#d97706', bg: '#fef3c7' },
  versenden:  { label: 'JA versenden',  icon: '📬', color: '#16a34a', bg: '#dcfce7' },
}

function fmtDatum(ymd, uhrzeit) {
  if (!ymd) return ''
  const [y, mo, d] = ymd.split('-')
  const base = `${d}.${mo}.${y}`
  return uhrzeit ? `${base} ${uhrzeit}` : base
}

function toYMD(d) {
  return d.toISOString().slice(0, 10)
}

export default function TermineSection({ client, termine, onAdd, onUpdate, onDelete }) {
  const [showModal, setShowModal] = useState(false)

  const clientTermine = (termine ?? [])
    .filter(t => t.mandantId === client.id)
    .sort((a, b) => a.datum.localeCompare(b.datum) || (a.uhrzeit || '').localeCompare(b.uhrzeit || ''))

  const todayStr = toYMD(new Date())
  const today    = new Date(); today.setHours(0, 0, 0, 0)

  const overdueCount = clientTermine.filter(t => {
    const d = new Date(t.datum); d.setHours(0, 0, 0, 0)
    return !t.erledigt && d < today
  }).length

  function handleSave(formData) {
    onAdd({
      ...formData,
      id:        'trm_' + Date.now().toString(36),
      erledigt:  false,
      createdAt: new Date().toISOString(),
    })
    setShowModal(false)
  }

  function handleDelete(id) {
    if (window.confirm('Termin wirklich löschen?')) onDelete(id)
  }

  return (
    <div className="termine-section">
      {/* Header */}
      <div className="termine-section-header" style={{ cursor: 'default' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>📅 Termine &amp; Fristen</span>
          {clientTermine.length > 0 && (
            <span className="badge badge-blue" style={{ fontSize: '11px' }}>{clientTermine.length}</span>
          )}
          {overdueCount > 0 && (
            <span className="badge" style={{ fontSize: '11px', background: 'var(--red-dim)', color: 'var(--red)' }}>
              ⚠️ {overdueCount} überfällig
            </span>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(true)} style={{ fontSize: '12px' }}>
          ＋ Termin hinzufügen
        </button>
      </div>

      <div className="termine-section-body">
          {clientTermine.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' }}>
              Keine Termine für diesen Mandanten.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {clientTermine.map(t => {
                const cfg       = ART_CONFIG[t.art] ?? ART_CONFIG.erinnerung
                const tDate     = new Date(t.datum); tDate.setHours(0, 0, 0, 0)
                const isToday   = t.datum === todayStr
                const isOverdue = !t.erledigt && tDate < today

                return (
                  <div
                    key={t.id}
                    style={{
                      display:        'flex',
                      alignItems:     'center',
                      gap:            '8px',
                      padding:        '6px 8px',
                      borderRadius:   '8px',
                      background:     isOverdue ? '#fff5f5' : isToday ? '#f0f7ff' : 'var(--surface)',
                      border:         `1px solid ${isOverdue ? 'var(--red-dim)' : 'var(--border)'}`,
                      opacity:        t.erledigt ? 0.5 : 1,
                    }}
                  >
                    {/* Art-Icon */}
                    <div
                      style={{
                        width:        '28px',
                        height:       '28px',
                        borderRadius: '8px',
                        background:   cfg.bg,
                        display:      'flex',
                        alignItems:   'center',
                        justifyContent: 'center',
                        fontSize:     '13px',
                        flexShrink:   0,
                      }}
                      title={cfg.label}
                    >
                      {cfg.icon}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {isOverdue && <span style={{ color: 'var(--red)', marginRight: '4px' }}>⚠️</span>}
                        {isToday && (
                          <span style={{
                            background: 'var(--accent)', color: '#fff',
                            fontSize: '9px', padding: '1px 5px', borderRadius: '4px',
                            marginRight: '4px', fontWeight: 700,
                          }}>
                            HEUTE
                          </span>
                        )}
                        {fmtDatum(t.datum, t.uhrzeit)}
                        <span style={{ marginLeft: '6px', color: cfg.color, fontWeight: 600 }}>
                          {cfg.label}
                        </span>
                      </div>
                      {t.beschreibung && (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.beschreibung}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                      <input
                        type="checkbox"
                        checked={!!t.erledigt}
                        onChange={e => onUpdate(t.id, { erledigt: e.target.checked })}
                        title="Erledigt"
                        style={{ cursor: 'pointer', accentColor: 'var(--green)' }}
                      />
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(t.id)}
                        title="Löschen"
                        style={{ fontSize: '11px', padding: '2px 6px', color: 'var(--red)' }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      {showModal && (
        <TerminModal
          termin={null}
          clients={[]}
          prefillMandantId={client.id}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
