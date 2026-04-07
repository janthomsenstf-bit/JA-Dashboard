import { getMandantStatus, calculateProgress, MANDANT_STATUS_CONFIG } from '../../utils/progress.js'
import { getLastEmail, getOpenRueckfragen, getLastAnlagen, getUpcomingDeadlines, fmtDate } from '../../utils/search.js'

function truncate(str, max) {
  const s = String(str ?? '')
  return s.length > max ? s.slice(0, max) + '…' : s
}

function Tile({ title, color, warn, ok, onClick, children }) {
  const borderColor = warn ? 'var(--yellow)' : ok ? 'var(--green)' : 'var(--border)'
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)', border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-lg)', padding: '16px', cursor: 'pointer',
        transition: 'box-shadow 0.15s, border-color 0.12s',
        display: 'flex', flexDirection: 'column', gap: '6px',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.borderColor = 'var(--border2)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = borderColor }}
    >
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {title}
      </div>
      {children}
      <div style={{ marginTop: 'auto', fontSize: '10px', color: 'var(--accent)', opacity: 0.7 }}>
        → Tab öffnen
      </div>
    </div>
  )
}

// Tab-Indices nach dem Einfügen von Übersicht als Tab 0:
// 0 Übersicht, 1 Auftrag, 2 Status & Arbeit, 3 Aufgaben,
// 4 Abschluss, 5 Lohn, 6 Beratung, 7 Rechner, 8 Kommunikation

export default function UebersichtTab({ client, onNavigateToTab }) {
  const status    = getMandantStatus(client)
  const progress  = calculateProgress(client)
  const cfg       = MANDANT_STATUS_CONFIG[status] ?? MANDANT_STATUS_CONFIG['in_bearbeitung']
  const openRF    = getOpenRueckfragen(client)
  const lastEmail = getLastEmail(client)
  const anlagen   = getLastAnlagen(client, 4)
  const fristen   = getUpcomingDeadlines(client, 90)

  return (
    <div style={{ padding: '20px', overflowY: 'auto' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '14px',
      }}>

        {/* Kachel 1: Status + Fortschritt */}
        <Tile title="Status & Fortschritt" ok={status === 'erledigt'} onClick={() => onNavigateToTab(2)}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
            background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
            alignSelf: 'flex-start',
          }}>
            {cfg.icon} {cfg.label}
          </span>
          <div style={{ height: '5px', background: 'var(--surface2)', borderRadius: '99px', overflow: 'hidden', margin: '4px 0 2px' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? 'var(--green)' : 'var(--accent)', borderRadius: '99px', transition: 'width 0.4s' }} />
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{progress}% abgeschlossen</span>
        </Tile>

        {/* Kachel 2: Offene Rückfragen */}
        <Tile title="Offene Rückfragen" warn={openRF.length > 0} ok={openRF.length === 0} onClick={() => onNavigateToTab(1)}>
          {openRF.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 600 }}>✓ Alle beantwortet</span>
          ) : (
            <>
              <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--red)', lineHeight: 1 }}>{openRF.length}</span>
              <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none' }}>
                {openRF.slice(0, 3).map((rq, i) => (
                  <li key={i} style={{
                    fontSize: '11px', color: 'var(--text-secondary)',
                    padding: '3px 0', borderBottom: '1px solid var(--border)',
                  }}>
                    {truncate(rq.text, 55)}
                  </li>
                ))}
                {openRF.length > 3 && (
                  <li style={{ fontSize: '10px', color: 'var(--text-muted)', paddingTop: '3px' }}>
                    + {openRF.length - 3} weitere
                  </li>
                )}
              </ul>
            </>
          )}
        </Tile>

        {/* Kachel 3: Letzte E-Mail */}
        <Tile title="Letzte Kommunikation" onClick={() => onNavigateToTab(8)}>
          {lastEmail ? (
            <>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmtDate(lastEmail.erstelltAm)}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.4 }}>{truncate(lastEmail.betreff, 55)}</div>
              <span style={{
                fontSize: '10px', padding: '1px 7px', borderRadius: '10px', alignSelf: 'flex-start',
                background: 'var(--surface2)', color: 'var(--text-muted)', border: '1px solid var(--border)',
              }}>
                {lastEmail.typ === 'eingehend' ? '📨 Eingehend' : '📤 Gesendet'}
              </span>
            </>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Noch keine E-Mails</span>
          )}
        </Tile>

        {/* Kachel 4: Anstehende Fristen */}
        <Tile title="Fristen (90 Tage)" warn={fristen.length > 0} onClick={() => onNavigateToTab(2)}>
          {fristen.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Keine anstehenden Fristen</span>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {fristen.map((f, i) => (
                <li key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: '11px', padding: '4px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{f.label}</span>
                  <span style={{ fontWeight: 600, color: 'var(--yellow)', fontFamily: 'var(--font-mono)' }}>{fmtDate(f.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Tile>

        {/* Kachel 5: Letzte Anhänge */}
        <Tile title="Letzte Anhänge" onClick={() => onNavigateToTab(8)}>
          {anlagen.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Keine Anhänge vorhanden</span>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {anlagen.map((a, i) => (
                <li key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '11px', padding: '3px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <span>{a.richtung === 'eingehend' ? '📥' : '📤'}</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name}
                  </span>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{fmtDate(a.datum)}</span>
                </li>
              ))}
            </ul>
          )}
        </Tile>

        {/* Kachel 6: Notizen */}
        <Tile title="Notizen" onClick={() => onNavigateToTab(6)}>
          {client.notizen ? (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
              {truncate(client.notizen, 160)}
            </p>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Keine Notizen</span>
          )}
        </Tile>

      </div>
    </div>
  )
}
