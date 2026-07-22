import { useState, useMemo } from 'react'

/**
 * Bereich „Personen" – erste Ebene.
 *
 * Enthält zunächst ausschließlich die bestehende Mandantenverwaltung.
 * Die Kategorien sind bereits angelegt, damit später weitere Personengruppen
 * (Interessenten, Kooperationspartner, Behörden …) ergänzt werden können.
 *
 * Rein anzeigend: liest nur aus `clients`, verändert nichts.
 */

const FARBE = '#0891b2' // Farbwelt des Bereichs „Personen"

export const PERSONEN_KATEGORIEN = [
  { key: 'mandanten',   label: 'Mandanten',         icon: '📁', aktiv: true },
  { key: 'interessent', label: 'Interessenten',     icon: '💡', aktiv: false },
  { key: 'kooperation', label: 'Kooperationspartner', icon: '🤝', aktiv: false },
  { key: 'kontakte',    label: 'Kontakte',          icon: '👤', aktiv: false },
  { key: 'behoerden',   label: 'Behörden',          icon: '🏛', aktiv: false },
  { key: 'netzwerke',   label: 'Netzwerke',         icon: '🌐', aktiv: false },
]

// ── Ableitungen aus vorhandenen Daten (nichts wird gespeichert) ───────────────

/** Letzte erkennbare Aktivität: neuester Zeitpunkt aus E-Mails und Auftragsverlauf. */
function letzteAktivitaet(c) {
  const dates = []
  const push = d => { if (d) dates.push(d) }
  ;(c.kommunikation?.events ?? []).forEach(e => push(e.erstelltAm ?? e.gesendetAm))
  ;(c.auftraege ?? []).forEach(a => {
    push(a.erstelltAm); push(a.erledigtAm)
    ;(a.verlauf ?? []).forEach(v => push(v.erstelltAm ?? v.datum))
  })
  ;(c.rueckfragenSendungen ?? []).forEach(s => push(s.datum ?? s.gesendetAm))
  if (!dates.length) return null
  return dates.reduce((max, d) => (new Date(d) > new Date(max) ? d : max))
}

function offeneRueckfragen(c) {
  return (c.rueckfragen ?? []).filter(r => !r.erledigt && !r.beantwortet).length
}

function statusVon(c) {
  if (c.archiviert)      return { label: 'Archiviert',   farbe: '#64748b' }
  const offen = offeneRueckfragen(c)
  if (offen > 0)         return { label: `${offen} offene Rückfrage${offen !== 1 ? 'n' : ''}`, farbe: '#f97316' }
  if (c.faUebermittelt)  return { label: 'Beim Finanzamt', farbe: '#16a34a' }
  if (c.abschlussFertig) return { label: 'Abschluss fertig', farbe: '#16a34a' }
  if (c.inBearbeitung)   return { label: 'In Bearbeitung', farbe: '#2563eb' }
  return { label: 'Aktiv', farbe: '#64748b' }
}

function fmtDatum(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '–'
  const heute = new Date(); heute.setHours(0, 0, 0, 0)
  const tage = Math.floor((heute - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  if (tage === 0) return 'heute'
  if (tage === 1) return 'gestern'
  if (tage < 7)   return `vor ${tage} Tagen`
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

function ansprechpartner(c) {
  const k = c.kontakte ?? []
  if (!k.length) return null
  const erster = k.find(x => (x.name ?? '').trim()) ?? k[0]
  return { name: (erster.name ?? '').trim() || '—', rolle: erster.rolle ?? '', weitere: k.length - 1 }
}

function offeneAuftraege(c) {
  return (c.auftraege ?? []).filter(a => a.status !== 'erledigt').length
}

// ── Bereich ───────────────────────────────────────────────────────────────────
export default function PersonenBereich({ clients = [], onOpen, onNeu }) {
  const [kategorie, setKategorie] = useState('mandanten')
  const [suche, setSuche]         = useState('')
  const [zeigeArchiv, setZeigeArchiv] = useState(false)
  const [ansicht, setAnsicht]     = useState(() => {
    try { return localStorage.getItem('personen-ansicht') || 'tabelle' } catch { return 'tabelle' }
  })
  const setzeAnsicht = a => { setAnsicht(a); try { localStorage.setItem('personen-ansicht', a) } catch {} }

  const liste = useMemo(() => {
    const q = suche.trim().toLowerCase()
    return clients
      .filter(c => (zeigeArchiv ? true : !c.archiviert))
      .filter(c => {
        if (!q) return true
        return (c.name ?? '').toLowerCase().includes(q)
          || String(c.mandantennummer ?? '').toLowerCase().includes(q)
          || (c.rechtsform ?? '').toLowerCase().includes(q)
          || (c.kontakte ?? []).some(k => (k.name ?? '').toLowerCase().includes(q))
      })
      .map(c => ({ c, aktivitaet: letzteAktivitaet(c) }))
      .sort((a, b) => {
        if (!a.aktivitaet && !b.aktivitaet) return (a.c.name ?? '').localeCompare(b.c.name ?? '')
        if (!a.aktivitaet) return 1
        if (!b.aktivitaet) return -1
        return new Date(b.aktivitaet) - new Date(a.aktivitaet)
      })
  }, [clients, suche, zeigeArchiv])

  const gesamtAktiv = clients.filter(c => !c.archiviert).length
  const kat = PERSONEN_KATEGORIEN.find(k => k.key === kategorie)

  const thStyle = {
    textAlign: 'left', padding: '10px 14px', fontSize: '11px', fontWeight: 700,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 28px 56px' }}>

        {/* Brotkrumen */}
        <nav aria-label="Pfad" style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px' }}>
          <span>Spielbuch</span>
          <span style={{ opacity: 0.5 }}>›</span>
          <span style={{ color: FARBE, fontWeight: 700 }}>Personen</span>
          <span style={{ opacity: 0.5 }}>›</span>
          <span style={{ color: 'var(--text)' }}>{kat?.label ?? 'Mandanten'}</span>
        </nav>

        {/* Kopf */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '12px', flexShrink: 0,
            background: FARBE + '14', border: `1px solid ${FARBE}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
          }} aria-hidden="true">👥</div>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <h2 style={{ margin: 0, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
              Personen
            </h2>
            <p style={{ margin: '5px 0 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Zentrale Verwaltung aller Kontakte. Aktuell: {gesamtAktiv} aktive Mandant{gesamtAktiv !== 1 ? 'en' : ''}.
            </p>
          </div>
          {onNeu && (
            <button
              onClick={onNeu}
              style={{
                padding: '10px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                background: FARBE, color: '#fff', fontSize: '13px', fontWeight: 700,
                whiteSpace: 'nowrap', transition: 'filter 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.93)')}
              onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
            >
              + Neuer Mandant
            </button>
          )}
        </div>

        {/* Kategorien – vorbereitet für weitere Personengruppen */}
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {PERSONEN_KATEGORIEN.map(k => {
            const ist = kategorie === k.key
            return (
              <button
                key={k.key}
                onClick={() => k.aktiv && setKategorie(k.key)}
                disabled={!k.aktiv}
                title={k.aktiv ? k.label : `${k.label} – wird später ergänzt`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '7px',
                  padding: '8px 14px', borderRadius: '20px', fontSize: '12.5px',
                  fontWeight: ist ? 700 : 500,
                  border: `1px solid ${ist ? FARBE + '55' : 'var(--border)'}`,
                  background: ist ? FARBE + '14' : 'var(--surface)',
                  color: ist ? FARBE : k.aktiv ? 'var(--text-muted)' : 'var(--text-muted)',
                  opacity: k.aktiv ? 1 : 0.45,
                  cursor: k.aktiv ? 'pointer' : 'not-allowed',
                  transition: 'background 0.18s, color 0.18s, border-color 0.18s',
                }}
              >
                <span aria-hidden="true">{k.icon}</span>
                {k.label}
                {k.aktiv && k.key === 'mandanten' && (
                  <span style={{ fontSize: '11px', opacity: 0.75 }}>{gesamtAktiv}</span>
                )}
                {!k.aktiv && <span style={{ fontSize: '10px', opacity: 0.8 }}>bald</span>}
              </button>
            )
          })}
        </div>

        {/* Werkzeugleiste */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
          <input
            value={suche}
            onChange={e => setSuche(e.target.value)}
            placeholder="🔍 Name, Nummer, Ansprechpartner …"
            style={{
              flex: '1 1 280px', maxWidth: '420px', padding: '10px 14px',
              borderRadius: '9px', border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: '9px', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            {[['tabelle', '☰ Tabelle'], ['karten', '▦ Karten']].map(([k, l]) => (
              <button key={k} onClick={() => setzeAnsicht(k)}
                style={{
                  padding: '6px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  fontSize: '12px', fontWeight: ansicht === k ? 700 : 500,
                  background: ansicht === k ? 'var(--surface)' : 'transparent',
                  color: ansicht === k ? 'var(--text)' : 'var(--text-muted)',
                  transition: 'background 0.15s, color 0.15s',
                }}>{l}</button>
            ))}
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={zeigeArchiv} onChange={e => setZeigeArchiv(e.target.checked)} style={{ cursor: 'pointer', accentColor: FARBE }} />
            Archivierte anzeigen
          </label>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
            {liste.length} von {clients.length}
          </span>
        </div>

        {/* Leerzustand */}
        {liste.length === 0 && (
          <div style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
            <div style={{ fontSize: '30px', marginBottom: '10px' }}>🔍</div>
            {suche ? 'Keine Treffer für diese Suche.' : 'Noch keine Mandanten vorhanden.'}
          </div>
        )}

        {/* Tabelle */}
        {liste.length > 0 && ansicht === 'tabelle' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Mandant</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Ansprechpartner</th>
                  <th style={thStyle}>Offene Aufträge</th>
                  <th style={thStyle}>Letzte Aktivität</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Schnellaktionen</th>
                </tr>
              </thead>
              <tbody>
                {liste.map(({ c, aktivitaet }, i) => {
                  const st = statusVon(c)
                  const ap = ansprechpartner(c)
                  const offen = offeneAuftraege(c)
                  return (
                    <tr key={c.id}
                      style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', transition: 'background 0.12s', cursor: 'pointer' }}
                      onClick={() => onOpen?.(c.id)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '13px 14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '2px' }}>{c.name || '(ohne Namen)'}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {[c.mandantennummer, c.rechtsform].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </td>
                      <td style={{ padding: '13px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px',
                          background: st.farbe + '18', color: st.farbe, border: `1px solid ${st.farbe}44`,
                        }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '13px 14px', color: ap ? 'var(--text)' : 'var(--text-muted)' }}>
                        {ap ? (
                          <>
                            {ap.name}
                            {ap.rolle && <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}> · {ap.rolle}</span>}
                            {ap.weitere > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}> +{ap.weitere}</span>}
                          </>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '13px 14px', color: offen > 0 ? 'var(--text)' : 'var(--text-muted)', fontWeight: offen > 0 ? 700 : 400 }}>
                        {offen > 0 ? offen : '–'}
                      </td>
                      <td style={{ padding: '13px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {fmtDatum(aktivitaet)}
                      </td>
                      <td style={{ padding: '13px 14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <SchnellAktion titel="Aufträge"    icon="📋" onClick={() => onOpen?.(c.id, 1)} />
                          <SchnellAktion titel="Nachrichten" icon="✉️" onClick={() => onOpen?.(c.id, 5)} />
                          <SchnellAktion titel="Dokumente"   icon="📁" onClick={() => onOpen?.(c.id, 6)} />
                          <button
                            onClick={() => onOpen?.(c.id)}
                            style={{
                              marginLeft: '4px', padding: '6px 12px', borderRadius: '7px', cursor: 'pointer',
                              border: `1px solid ${FARBE}55`, background: FARBE + '12', color: FARBE,
                              fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
                            }}
                          >Öffnen</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Karten */}
        {liste.length > 0 && ansicht === 'karten' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {liste.map(({ c, aktivitaet }) => {
              const st = statusVon(c)
              const ap = ansprechpartner(c)
              const offen = offeneAuftraege(c)
              return (
                <div key={c.id}
                  onClick={() => onOpen?.(c.id)}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
                    padding: '18px', cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = FARBE + '66'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name || '(ohne Namen)'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {[c.mandantennummer, c.rechtsform].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '10.5px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', whiteSpace: 'nowrap',
                      background: st.farbe + '18', color: st.farbe, border: `1px solid ${st.farbe}44`,
                    }}>{st.label}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    <div>👤 {ap ? `${ap.name}${ap.weitere > 0 ? ` +${ap.weitere}` : ''}` : 'Kein Ansprechpartner'}</div>
                    <div>📋 {offen > 0 ? `${offen} offene Aufträge` : 'Keine offenen Aufträge'}</div>
                    <div>🕐 {fmtDatum(aktivitaet)}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                    <SchnellAktion titel="Aufträge"    icon="📋" onClick={() => onOpen?.(c.id, 1)} />
                    <SchnellAktion titel="Nachrichten" icon="✉️" onClick={() => onOpen?.(c.id, 5)} />
                    <SchnellAktion titel="Dokumente"   icon="📁" onClick={() => onOpen?.(c.id, 6)} />
                    <button
                      onClick={() => onOpen?.(c.id)}
                      style={{
                        marginLeft: 'auto', padding: '6px 12px', borderRadius: '7px', cursor: 'pointer',
                        border: `1px solid ${FARBE}55`, background: FARBE + '12', color: FARBE,
                        fontSize: '12px', fontWeight: 700,
                      }}
                    >Öffnen</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function SchnellAktion({ titel, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      title={titel}
      aria-label={titel}
      style={{
        padding: '6px 9px', borderRadius: '7px', cursor: 'pointer',
        border: '1px solid var(--border)', background: 'var(--surface)',
        fontSize: '13px', lineHeight: 1, transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = FARBE + '55' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  )
}
