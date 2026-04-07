import StatusBadge      from '../shared/StatusBadge.jsx'
import { getLastEmail, getOpenRueckfragen, fmtDate } from '../../utils/search.js'

function truncate(str, max) {
  const s = String(str ?? '')
  return s.length > max ? s.slice(0, max) + '…' : s
}

export default function SearchResultCard({ result, isActive, onSelect, onEmailAction }) {
  const { client, matches } = result
  const lastEmail    = getLastEmail(client)
  const openRF       = getOpenRueckfragen(client)

  return (
    <div
      style={{
        padding:      '10px 14px',
        borderBottom: '1px solid var(--border)',
        cursor:       'pointer',
        background:   isActive ? 'var(--surface2)' : 'transparent',
        transition:   'background 0.1s',
      }}
      onClick={onSelect}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface2)' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Kopfzeile: Name + Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, flex: 1, minWidth: 0 }}>
          {client.name}
        </span>
        {client.mandantennummer && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {client.mandantennummer}
          </span>
        )}
        <StatusBadge client={client} size="sm" />
      </div>

      {/* Treffer-Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
        {matches.slice(0, 3).map((m, i) => (
          <span key={i} style={{
            display:      'inline-flex', alignItems: 'center', gap: '4px',
            padding:      '1px 7px', borderRadius: '10px', fontSize: '10px',
            background:   'var(--surface2)', border: '1px solid var(--border)',
          }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{m.label}:</span>
            <span style={{ color: 'var(--text-secondary)' }}>{truncate(m.value, 38)}</span>
          </span>
        ))}
      </div>

      {/* Meta-Zeile + Aktionen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {openRF.length > 0 && (
          <span style={{
            fontSize: '10px', padding: '1px 6px', borderRadius: '10px',
            background: 'rgba(217,119,6,0.1)', color: 'var(--yellow)', border: '1px solid rgba(217,119,6,0.25)',
            fontWeight: 600,
          }}>
            ❓ {openRF.length} offen
          </span>
        )}
        {lastEmail && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            ✉️ {fmtDate(lastEmail.erstelltAm)} · {truncate(lastEmail.betreff, 32)}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
          <button
            className="btn btn-primary btn-sm"
            onClick={onSelect}
            style={{ fontSize: '10px', padding: '3px 10px' }}
          >
            Öffnen
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onEmailAction}
            style={{ fontSize: '10px', padding: '3px 10px' }}
          >
            ✉️ E-Mail
          </button>
        </div>
      </div>
    </div>
  )
}
