import { useMemo } from 'react'
import StatusBadge from '../shared/StatusBadge.jsx'
import { getOpenRueckfragen, getLastIncomingEmail, getUpcomingDeadlines, fmtDate } from '../../utils/search.js'

// ── Hilfs-Komponenten ─────────────────────────────────────────────────────────

function Widget({ icon, title, count, children, emptyText }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '12px 16px', background: 'var(--surface2)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '15px' }}>{icon}</span>
        <span style={{ fontSize: '13px', fontWeight: 700, flex: 1 }}>{title}</span>
        {count > 0 && (
          <span style={{
            fontSize: '11px', fontWeight: 700, padding: '1px 8px', borderRadius: '20px',
            background: 'var(--accent-dim)', color: 'var(--accent)',
          }}>
            {count}
          </span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        {count === 0
          ? <div style={{ padding: '16px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>{emptyText}</div>
          : children
        }
      </div>
    </div>
  )
}

function ClientRow({ client, meta, onSelect }) {
  return (
    <div
      onClick={() => onSelect(client.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 16px', cursor: 'pointer', fontSize: '12px',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '1px' }}>{client.name}</div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{meta}</div>
      </div>
      <StatusBadge client={client} size="sm" />
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function DashboardHome({ clients, onSelectClient }) {
  const activeClients = useMemo(() => clients.filter(c => !c.archiviert), [clients])

  // Widget 1: Offene Kommunikation (unbeantwortete eingehende E-Mails)
  const offeneKomm = useMemo(() => {
    return activeClients
      .filter(c => {
        const events = c.kommunikation?.events ?? []
        return events.some(e => e.typ === 'eingehend')
      })
      .map(c => ({ client: c, lastIncoming: getLastIncomingEmail(c) }))
      .filter(x => x.lastIncoming)
      .sort((a, b) => new Date(b.lastIncoming.erstelltAm) - new Date(a.lastIncoming.erstelltAm))
  }, [activeClients])

  // Widget 2: Offene Rückfragen
  const offeneRQ = useMemo(() => {
    return activeClients
      .map(c => ({ client: c, count: getOpenRueckfragen(c).length }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [activeClients])

  // Widget 3: Anstehende Fristen (60 Tage)
  const fristen = useMemo(() => {
    return activeClients
      .flatMap(c => getUpcomingDeadlines(c, 60).map(d => ({ ...d, client: c })))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [activeClients])

  return (
    <div style={{
      padding: '24px', overflowY: 'auto', height: '100%',
      display: 'flex', flexDirection: 'column', gap: '20px',
    }}>
      {/* Begrüßungs-Header */}
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800 }}>
          Guten Tag 👋
        </h2>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
          {activeClients.length} aktive Mandate
          {offeneRQ.length > 0 && ` · ${offeneRQ.reduce((s, x) => s + x.count, 0)} offene Rückfragen`}
          {offeneKomm.length > 0 && ` · ${offeneKomm.length} Mandanten mit eingegangenen E-Mails`}
        </p>
      </div>

      {/* Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>

        <Widget
          icon="✉️"
          title="Eingegangene E-Mails"
          count={offeneKomm.length}
          emptyText="Keine eingegangenen E-Mails"
        >
          {offeneKomm.slice(0, 7).map(({ client, lastIncoming }) => (
            <ClientRow
              key={client.id}
              client={client}
              onSelect={onSelectClient}
              meta={`${fmtDate(lastIncoming.erstelltAm)} · ${lastIncoming.betreff?.slice(0, 40) ?? '–'}`}
            />
          ))}
          {offeneKomm.length > 7 && (
            <div style={{ padding: '8px 16px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
              + {offeneKomm.length - 7} weitere
            </div>
          )}
        </Widget>

        <Widget
          icon="❓"
          title="Offene Rückfragen"
          count={offeneRQ.length}
          emptyText="Keine offenen Rückfragen"
        >
          {offeneRQ.slice(0, 7).map(({ client, count }) => (
            <ClientRow
              key={client.id}
              client={client}
              onSelect={onSelectClient}
              meta={`${count} Frage${count > 1 ? 'n' : ''} offen`}
            />
          ))}
          {offeneRQ.length > 7 && (
            <div style={{ padding: '8px 16px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
              + {offeneRQ.length - 7} weitere
            </div>
          )}
        </Widget>

        <Widget
          icon="📅"
          title="Anstehende Fristen (60 Tage)"
          count={fristen.length}
          emptyText="Keine Fristen in den nächsten 60 Tagen"
        >
          {fristen.slice(0, 7).map((item, i) => (
            <ClientRow
              key={i}
              client={item.client}
              onSelect={onSelectClient}
              meta={`${item.label}: ${fmtDate(item.date)}`}
            />
          ))}
          {fristen.length > 7 && (
            <div style={{ padding: '8px 16px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
              + {fristen.length - 7} weitere
            </div>
          )}
        </Widget>

      </div>
    </div>
  )
}
