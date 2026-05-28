import { getMandantStatus, calculateProgress, MANDANT_STATUS_CONFIG } from '../../utils/progress.js'
import { getLastEmail, getOpenRueckfragen, getLastAnlagen, getUpcomingDeadlines, fmtDate } from '../../utils/search.js'
import StrukturPanel from './StrukturPanel.jsx'

function truncate(str, max) {
  const s = String(str ?? '')
  return s.length > max ? s.slice(0, max) + '…' : s
}

function daysSince(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

const EVENT_CFG = {
  rueckfragen:    { label: 'Rückfragen gesendet',                        icon: '📤', color: '#2563eb' },
  erinnerung:     { label: 'Erinnerung gesendet',                        icon: '🔔', color: '#f97316' },
  antwort:        { label: 'Antwort erhalten',                            icon: '💬', color: '#16a34a' },
  vollstaendigkeit:{ label: 'Vollständigkeitserklärung erhalten',         icon: '📋', color: '#0f766e' },
  telefonat:      { label: 'Telefonat / Persönlich',                      icon: '📞', color: '#7c3aed' },
  email:          { label: 'E-Mail gesendet',                             icon: '📧', color: '#0891b2' },
  unterschrift:   { label: 'Steuererklärung zur Unterschrift gesendet',   icon: '✍️', color: '#0f766e' },
  notiz:          { label: 'Interne Notiz',                               icon: '🧠', color: '#64748b' },
  fa_gesendet:    { label: 'Steuererklärung ans Finanzamt geschickt',     icon: '🏛', color: '#0891b2' },
  rechnung_gestellt:{ label: 'Rechnung geschrieben',                      icon: '🧾', color: '#16a34a' },
}

function VerlaufPanel({ client, onNavigateToTab }) {
  const events    = [...(client.kommunikation?.events ?? [])].sort((a, b) => new Date(b.datum) - new Date(a.datum))
  const allRF     = client.rueckfragen ?? []
  const openRF    = allRF.filter(r => !r.beantwortet)
  const latest    = events[0] ?? null
  const latestCfg = latest ? (EVENT_CFG[latest.typ] ?? { label: latest.typ, icon: '●', color: 'var(--text-muted)' }) : null
  const shown     = events.slice(0, 6)
  const hasMore   = events.length > 6

  if (events.length === 0 && allRF.length === 0) return null

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px 18px',
      marginTop: '14px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
          📊 Verlauf &amp; Aktivitäten
        </span>
        {events.length > 0 && (
          <span style={{
            fontSize: '11px', fontWeight: 700, padding: '1px 8px',
            borderRadius: '20px', background: 'var(--surface2)',
            color: 'var(--text-muted)', border: '1px solid var(--border)',
          }}>
            {events.length} Einträge
          </span>
        )}
        <button
          onClick={() => onNavigateToTab(2)}
          style={{
            marginLeft: 'auto', fontSize: '11px', color: 'var(--accent)',
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px',
          }}
        >
          → Status-Reiter
        </button>
      </div>

      {/* Status-Badges: letztes Event + offene RQ */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
        {latestCfg && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
            background: latestCfg.color + '18', color: latestCfg.color,
            border: `1px solid ${latestCfg.color}44`,
          }}>
            {latestCfg.icon} {latestCfg.label}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '4px' }}>
              · {fmtDate(latest.datum)}
            </span>
          </span>
        )}
        {openRF.length > 0 ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
            background: 'rgba(239,68,68,0.07)', color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.25)',
          }}>
            ⏳ {openRF.length} offene Rückfrage{openRF.length !== 1 ? 'n' : ''}
          </span>
        ) : allRF.length > 0 ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
            background: 'rgba(22,163,74,0.07)', color: '#16a34a',
            border: '1px solid rgba(22,163,74,0.25)',
          }}>
            ✓ Alle Rückfragen beantwortet
          </span>
        ) : null}
      </div>

      {/* Kompakte Timeline */}
      {shown.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: hasMore || openRF.length > 0 ? '12px' : 0 }}>
          {shown.map((ev, i) => {
            const cfg = EVENT_CFG[ev.typ] ?? { label: ev.typ, icon: '●', color: 'var(--text-muted)' }
            const age = daysSince(ev.datum)
            return (
              <div key={ev.id ?? i} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '5px 6px', borderRadius: '6px',
                background: i % 2 === 0 ? 'transparent' : 'var(--surface2)',
              }}>
                <span style={{ fontSize: '13px', flexShrink: 0 }}>{cfg.icon}</span>
                <span style={{
                  fontSize: '11px', fontWeight: 600, color: cfg.color,
                  minWidth: '130px', flexShrink: 0,
                }}>
                  {cfg.label}
                </span>
                {ev.notiz && (
                  <span style={{
                    fontSize: '11px', color: 'var(--text-secondary)',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {truncate(ev.notiz, 60)}
                  </span>
                )}
                <span style={{
                  fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: 'auto',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {fmtDate(ev.datum)}{age !== null && age <= 7 ? ` (${age === 0 ? 'heute' : age === 1 ? 'gestern' : `vor ${age}d`})` : ''}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* "Mehr anzeigen"-Link */}
      {hasMore && (
        <button
          onClick={() => onNavigateToTab(2)}
          style={{
            fontSize: '11px', color: 'var(--accent)', background: 'none',
            border: 'none', cursor: 'pointer', padding: '0 6px 10px', display: 'block',
          }}
        >
          + {events.length - 6} weitere Einträge → Status-Reiter
        </button>
      )}

      {/* Offene Rückfragen (max 3) */}
      {openRF.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
            Offene Rückfragen
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {openRF.slice(0, 3).map((rq, i) => (
              <div key={rq.id ?? i} style={{
                fontSize: '11px', color: 'var(--text-secondary)',
                padding: '4px 8px',
                background: 'rgba(239,68,68,0.04)',
                border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: '5px',
              }}>
                <span style={{ color: '#ef4444', fontWeight: 700, marginRight: '5px' }}>{i + 1}.</span>
                {truncate(rq.text, 90)}
              </div>
            ))}
            {openRF.length > 3 && (
              <button
                onClick={() => onNavigateToTab(1)}
                style={{
                  fontSize: '11px', color: 'var(--accent)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: '2px 8px', textAlign: 'left',
                }}
              >
                + {openRF.length - 3} weitere → Auftrags-Reiter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
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

// Tab-Indices:
// 0 Dashboard, 1 Stammdaten, 2 Historie,
// 3 Abschluss, 4 Lohn, 5 Beratung, 6 Kommunikation, 7 Dokumente, 8 ESt, 9 USt,
// 10 Formulare, 11 SuSa, 12 FIBU, 13 Aufträge, 14 Honorare

export default function UebersichtTab({ client, onNavigateToTab, onUpdate }) {
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
        <Tile title="Letzte Kommunikation" onClick={() => onNavigateToTab(6)}>
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
        <Tile title="Letzte Anhänge" onClick={() => onNavigateToTab(6)}>
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
        <Tile title="Notizen" onClick={() => onNavigateToTab(5)}>
          {client.notizen ? (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
              {truncate(client.notizen, 160)}
            </p>
          ) : (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Keine Notizen</span>
          )}
        </Tile>

      </div>

      {/* ── Verlauf & Aktivitäten ── */}
      <VerlaufPanel client={client} onNavigateToTab={onNavigateToTab} />

      {/* ── Steuerliche Strukturübersicht ── */}
      <div style={{ marginTop: '20px' }}>
        <StrukturPanel client={client} onUpdate={onUpdate} />
      </div>
    </div>
  )
}
