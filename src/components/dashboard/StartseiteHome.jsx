import { useMemo } from 'react'
import StatusBadge from '../shared/StatusBadge.jsx'
import { getOpenRueckfragen, getUpcomingDeadlines, fmtDate } from '../../utils/search.js'

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function isEmailOpen(incomingEvent, allEvents) {
  if (incomingEvent.erledigtAm) return false
  const t = new Date(incomingEvent.erstelltAm).getTime()
  return !allEvents.some(
    e => e.typ !== 'eingehend' && e.status === 'gesendet' && new Date(e.erstelltAm).getTime() > t
  )
}

function isSehrNeu(iso) {
  return Date.now() - new Date(iso).getTime() < 2 * 60 * 60 * 1000
}

function relTime(iso) {
  if (!iso) return '–'
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1)   return 'gerade eben'
  if (min < 60)  return `vor ${min} Min`
  const h = Math.floor(min / 60)
  if (h < 24)    return `vor ${h} Std`
  const d = Math.floor(h / 24)
  if (d === 1)   return 'gestern'
  if (d < 7)     return `vor ${d} Tagen`
  return fmtDate(iso)
}

function truncate(str, max) {
  const s = String(str ?? '').replace(/\n/g, ' ')
  return s.length > max ? s.slice(0, max) + '…' : s
}

function isToday(iso) {
  if (!iso) return false
  const d = new Date(iso)
  const n = new Date()
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
}

// ── E-Mail-Karte ──────────────────────────────────────────────────────────────

function EmailCard({ client, event, onOpen, onErledigt }) {
  const sehrNeu = isSehrNeu(event.erstelltAm)

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${sehrNeu ? 'rgba(37,99,235,0.35)' : 'var(--border)'}`,
      borderLeft: `3px solid ${sehrNeu ? 'var(--accent)' : 'var(--border2)'}`,
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: '6px',
      boxShadow: sehrNeu ? '0 0 0 3px rgba(37,99,235,0.06)' : 'none',
      transition: 'box-shadow 0.15s',
    }}>
      {/* Kopfzeile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {sehrNeu && (
          <span style={{
            fontSize: '9px', fontWeight: 800, padding: '2px 7px', borderRadius: '99px',
            background: 'var(--accent)', color: '#fff', letterSpacing: '0.08em',
            textTransform: 'uppercase', flexShrink: 0,
          }}>
            ● NEU
          </span>
        )}
        <span style={{ fontSize: '13px', fontWeight: 700, flex: 1, minWidth: 0 }}>
          {client.name}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
          {relTime(event.erstelltAm)}
        </span>
      </div>

      {/* Absender */}
      {event.absender && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Von: {event.absender}
        </div>
      )}

      {/* Betreff */}
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
        {truncate(event.betreff || '(kein Betreff)', 80)}
      </div>

      {/* Vorschautext */}
      {event.text && (
        <div style={{
          fontSize: '11px', color: 'var(--text-secondary)',
          lineHeight: '1.5',
          padding: '6px 10px',
          background: 'var(--surface2)',
          borderRadius: 'var(--radius-sm)',
          borderLeft: '2px solid var(--border2)',
        }}>
          „{truncate(event.text, 120)}"
        </div>
      )}

      {/* Aktions-Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={onOpen}
          style={{ fontSize: '11px' }}
        >
          ✉️ Öffnen &amp; antworten
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={onErledigt}
          style={{ fontSize: '11px', color: 'var(--green)' }}
        >
          ✓ Als erledigt markieren
        </button>
        <StatusBadge client={client} size="sm" />
      </div>
    </div>
  )
}

// ── Kompakt-Widget (Rückfragen / Fristen) ─────────────────────────────────────

function KompaktWidget({ icon, title, count, children, emptyText }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden', flex: 1, minWidth: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '10px 14px', background: 'var(--surface2)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span>{icon}</span>
        <span style={{ fontSize: '12px', fontWeight: 700, flex: 1 }}>{title}</span>
        {count > 0 && (
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '20px',
            background: 'var(--accent-dim)', color: 'var(--accent)',
          }}>
            {count}
          </span>
        )}
      </div>
      <div>
        {count === 0
          ? <div style={{ padding: '12px 14px', fontSize: '11px', color: 'var(--text-muted)' }}>{emptyText}</div>
          : children
        }
      </div>
    </div>
  )
}

function KompaktRow({ label, meta, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 14px', cursor: 'pointer', fontSize: '12px',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ flex: 1, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>{meta}</span>
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function StartseiteHome({ clients, onSelectClient, onSelectClientAtKomm, onUpdateClient }) {
  const activeClients = useMemo(() => clients.filter(c => !c.archiviert), [clients])

  // Alle offenen eingehenden E-Mails (Mandant + Event)
  const offeneEmails = useMemo(() => {
    const result = []
    for (const c of activeClients) {
      const events = c.kommunikation?.events ?? []
      for (const e of events) {
        if (e.typ === 'eingehend' && isEmailOpen(e, events)) {
          result.push({ client: c, event: e })
        }
      }
    }
    return result.sort((a, b) => new Date(b.event.erstelltAm) - new Date(a.event.erstelltAm))
  }, [activeClients])

  // Statistik
  const stats = useMemo(() => {
    const mandantenMitEmail = new Set(offeneEmails.map(x => x.client.id)).size
    const heuteCount = offeneEmails.filter(x => isToday(x.event.erstelltAm)).length
    return { total: offeneEmails.length, mandanten: mandantenMitEmail, heute: heuteCount }
  }, [offeneEmails])

  // Offene Rückfragen
  const offeneRQ = useMemo(() =>
    activeClients
      .map(c => ({ client: c, count: getOpenRueckfragen(c).length }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count)
  , [activeClients])

  // Fristen (30 Tage)
  const fristen = useMemo(() =>
    activeClients
      .flatMap(c => getUpcomingDeadlines(c, 30).map(d => ({ ...d, client: c })))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  , [activeClients])

  function handleErledigt(client, event) {
    const komm   = client.kommunikation ?? { events: [] }
    const events = (komm.events ?? []).map(e =>
      e.id === event.id ? { ...e, erledigtAm: new Date().toISOString() } : e
    )
    onUpdateClient(client.id, { kommunikation: { ...komm, events } })
  }

  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Titel + Stats ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>🏠 Cockpit</h2>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {activeClients.length} aktive Mandate
          </span>
        </div>

        {/* Stat-Chips */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { icon: '📧', label: 'Neue Nachrichten', value: stats.total, color: stats.total > 0 ? 'var(--accent)' : 'var(--text-muted)', bg: stats.total > 0 ? 'var(--accent-dim)' : 'var(--surface2)' },
            { icon: '👥', label: 'Mandanten', value: stats.mandanten, color: 'var(--text-secondary)', bg: 'var(--surface2)' },
            { icon: '📅', label: 'Heute eingegangen', value: stats.heute, color: stats.heute > 0 ? 'var(--green)' : 'var(--text-muted)', bg: stats.heute > 0 ? 'rgba(22,163,74,0.08)' : 'var(--surface2)' },
          ].map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '20px',
              background: s.bg, border: '1px solid var(--border)',
              fontSize: '12px',
            }}>
              <span>{s.icon}</span>
              <span style={{ fontWeight: 800, color: s.color }}>{s.value}</span>
              <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Offene E-Mails ── */}
      <div>
        <div style={{
          fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px',
        }}>
          📥 Offene E-Mails
          {offeneEmails.length > 0 && (
            <span style={{
              marginLeft: '8px', fontSize: '10px', padding: '1px 7px', borderRadius: '99px',
              background: 'var(--accent)', color: '#fff', fontWeight: 700,
            }}>
              {offeneEmails.length}
            </span>
          )}
        </div>

        {offeneEmails.length === 0 ? (
          <div style={{
            padding: '28px', textAlign: 'center', borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '13px',
          }}>
            ✓ Keine offenen E-Mails — alles erledigt
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {offeneEmails.map(({ client, event }) => (
              <EmailCard
                key={`${client.id}-${event.id}`}
                client={client}
                event={event}
                onOpen={() => onSelectClientAtKomm(client.id)}
                onErledigt={() => handleErledigt(client, event)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Kompakt-Widgets: Rückfragen + Fristen ── */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>

        <KompaktWidget icon="❓" title="Offene Rückfragen" count={offeneRQ.length} emptyText="Keine offenen Rückfragen">
          {offeneRQ.slice(0, 6).map(({ client, count }) => (
            <KompaktRow
              key={client.id}
              label={client.name}
              meta={`${count} offen`}
              onClick={() => onSelectClient(client.id)}
            />
          ))}
          {offeneRQ.length > 6 && (
            <div style={{ padding: '6px 14px', fontSize: '10px', color: 'var(--text-muted)' }}>
              + {offeneRQ.length - 6} weitere
            </div>
          )}
        </KompaktWidget>

        <KompaktWidget icon="📅" title="Fristen (30 Tage)" count={fristen.length} emptyText="Keine Fristen in den nächsten 30 Tagen">
          {fristen.slice(0, 6).map((item, i) => (
            <KompaktRow
              key={i}
              label={item.client.name}
              meta={`${item.label}: ${fmtDate(item.date)}`}
              onClick={() => onSelectClient(item.client.id)}
            />
          ))}
          {fristen.length > 6 && (
            <div style={{ padding: '6px 14px', fontSize: '10px', color: 'var(--text-muted)' }}>
              + {fristen.length - 6} weitere
            </div>
          )}
        </KompaktWidget>

      </div>
    </div>
  )
}
