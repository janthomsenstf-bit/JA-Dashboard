import { useState, useMemo } from 'react'

/**
 * Bereich „Kommunikation" – zentrale Kommunikationszentrale.
 *
 * Phase 1: Struktur, Darstellung und Integration der VORHANDENEN Daten.
 * Es werden ausschließlich bestehende Events (client.kommunikation.events)
 * und nicht zugeordnete E-Mails gelesen und zusammengeführt – nichts wird
 * geschrieben, verändert oder gelöscht.
 *
 * Vorbereitet für: KI-Zusammenfassungen, Priorisierung, Antwortentwürfe
 * (Freigabe-Workflow) und weitere Kanäle (WhatsApp).
 */

const FARBE = '#16a34a' // Farbwelt des Bereichs „Kommunikation"

// Kanäle der Kommunikationszentrale
const KANAELE = [
  { key: 'email',    label: 'E-Mail',           icon: '✉️', aktiv: true },
  { key: 'website',  label: 'Website-Anfragen', icon: '🌐', aktiv: true },
  { key: 'bot',      label: 'Bot-Inbox',        icon: '🤖', aktiv: true },
  { key: 'whatsapp', label: 'WhatsApp',         icon: '💬', aktiv: false },
]

// KI-Schnellaktionen über einer geöffneten E-Mail.
// Oberfläche vorbereitet – Ausführung folgt in einem späteren Schritt.
export const KI_AKTIONEN = [
  { key: 'zusammenfassen', label: 'Zusammenfassen',   icon: '📝' },
  { key: 'antwort',        label: 'Antwort formulieren', icon: '💬' },
  { key: 'dk',             label: 'Auf Dänisch',      icon: '🇩🇰' },
  { key: 'de',             label: 'Auf Deutsch',      icon: '🇩🇪' },
  { key: 'freundlich',     label: 'Freundlicher',     icon: '🙂' },
  { key: 'kuerzer',        label: 'Kürzer',           icon: '✂️' },
  { key: 'aufgabe',        label: 'Als Aufgabe',      icon: '📋' },
  { key: 'zuordnen',       label: 'Mandant zuordnen', icon: '🔗' },
]

const ORDNER = [
  { key: 'uebersicht',   label: 'Übersicht',         icon: '📊' },
  { key: 'posteingang',  label: 'Posteingang',       icon: '📥' },
  { key: 'unbeantwortet',label: 'Unbeantwortet',     icon: '⏳' },
  { key: 'vorbereitet',  label: 'Vorbereitet (KI)',  icon: '🤖' },
  { key: 'entwuerfe',    label: 'Entwürfe',          icon: '✏️' },
  { key: 'gesendet',     label: 'Gesendet',          icon: '📤' },
  { key: 'nichtZugeordnet', label: 'Nicht zugeordnet', icon: '❓' },
  { key: 'archiv',       label: 'Archiv',            icon: '🗄' },
]

// ── Helfer ────────────────────────────────────────────────────────────────────
function zeit(e) { return e.erstelltAm ?? e.gesendetAm ?? null }

function fmtZeit(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '–'
  const heute = new Date(); heute.setHours(0, 0, 0, 0)
  const tag = new Date(d); tag.setHours(0, 0, 0, 0)
  const diff = Math.round((heute - tag) / 86400000)
  const uhr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (diff === 0) return uhr
  if (diff === 1) return `gestern ${uhr}`
  if (diff < 7)   return `vor ${diff} Tagen`
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

function istHeute(iso) {
  if (!iso) return false
  const d = new Date(iso); const h = new Date()
  return d.getFullYear() === h.getFullYear() && d.getMonth() === h.getMonth() && d.getDate() === h.getDate()
}

/**
 * Alle Events aller Mandanten zusammenführen (rein lesend).
 * Ergänzt jedes Event um den Mandantenbezug.
 */
function alleNachrichten(clients) {
  const out = []
  clients.forEach(c => {
    ;(c.kommunikation?.events ?? []).forEach(ev => {
      out.push({ ...ev, _clientId: c.id, _clientName: c.name, _archiviert: !!c.archiviert })
    })
  })
  return out.sort((a, b) => new Date(zeit(b) ?? 0) - new Date(zeit(a) ?? 0))
}

/**
 * Eingehende E-Mail gilt als unbeantwortet, wenn danach keine ausgehende
 * Nachricht an denselben Mandanten existiert.
 */
function unbeantwortete(nachrichten) {
  const letzteAusgehend = new Map()
  nachrichten.forEach(n => {
    if (n.typ !== 'ausgehend') return
    const t = new Date(zeit(n) ?? 0).getTime()
    if (!letzteAusgehend.has(n._clientId) || t > letzteAusgehend.get(n._clientId)) {
      letzteAusgehend.set(n._clientId, t)
    }
  })
  return nachrichten.filter(n => {
    if (n.typ !== 'eingehend') return false
    const t = new Date(zeit(n) ?? 0).getTime()
    return t > (letzteAusgehend.get(n._clientId) ?? 0)
  })
}

// ── Bereich ───────────────────────────────────────────────────────────────────
export default function KommunikationBereich({
  clients = [],
  unbekannteEmails = [],
  onOeffneMandant,          // (clientId, tab) => void
  onPosteingangOeffnen,     // öffnet den bestehenden Zuordnungs-Dialog
  slotWebsiteAnfragen,      // bestehende Website-Anfragen-Ansicht
  slotBotInbox,             // bestehende Bot-Inbox
}) {
  const [kanal, setKanal]     = useState('email')
  const [ordner, setOrdner]   = useState('uebersicht')
  const [suche, setSuche]     = useState('')
  const [offen, setOffen]     = useState(null)

  const nachrichten = useMemo(() => alleNachrichten(clients), [clients])

  const gruppen = useMemo(() => {
    const aktive = nachrichten.filter(n => !n._archiviert)
    return {
      posteingang:   aktive.filter(n => n.typ === 'eingehend'),
      gesendet:      aktive.filter(n => n.typ === 'ausgehend' && n.status === 'gesendet'),
      entwuerfe:     aktive.filter(n => n.status === 'entwurf'),
      vorbereitet:   aktive.filter(n => n.status === 'vorbereitet'), // KI-Entwürfe (später)
      unbeantwortet: unbeantwortete(aktive),
      archiv:        nachrichten.filter(n => n._archiviert),
      heute:         aktive.filter(n => n.typ === 'eingehend' && istHeute(zeit(n))),
    }
  }, [nachrichten])

  const liste = useMemo(() => {
    let l
    if (ordner === 'nichtZugeordnet') {
      l = unbekannteEmails.map(e => ({
        id: `u_${e.account}_${e.uid}`, typ: 'eingehend', betreff: e.betreff,
        absender: e.von, empfaenger: e.an, erstelltAm: e.datum, status: 'gesendet',
        _unbekannt: true, _raw: e,
      }))
    } else {
      l = gruppen[ordner] ?? []
    }
    const q = suche.trim().toLowerCase()
    if (!q) return l
    return l.filter(n =>
      (n.betreff ?? '').toLowerCase().includes(q) ||
      (n.absender ?? '').toLowerCase().includes(q) ||
      (n.empfaenger ?? '').toLowerCase().includes(q) ||
      (n._clientName ?? '').toLowerCase().includes(q)
    )
  }, [ordner, gruppen, unbekannteEmails, suche])

  const zaehler = {
    posteingang: gruppen.posteingang.length,
    unbeantwortet: gruppen.unbeantwortet.length,
    vorbereitet: gruppen.vorbereitet.length,
    entwuerfe: gruppen.entwuerfe.length,
    gesendet: gruppen.gesendet.length,
    nichtZugeordnet: unbekannteEmails.length,
    archiv: gruppen.archiv.length,
  }

  const gewaehlt = liste.find(n => n.id === offen) ?? null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Kopf: Brotkrumen + Kanäle */}
      <div style={{ padding: '14px 20px 0', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <nav aria-label="Pfad" style={{ display: 'flex', gap: '7px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          <span>Spielbuch</span>
          <span style={{ opacity: 0.5 }}>›</span>
          <span style={{ color: FARBE, fontWeight: 700 }}>Kommunikation</span>
        </nav>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
          {KANAELE.map(k => {
            const ist = kanal === k.key
            return (
              <button
                key={k.key}
                onClick={() => k.aktiv && setKanal(k.key)}
                disabled={!k.aktiv}
                title={k.aktiv ? k.label : `${k.label} – Integration folgt`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '7px',
                  padding: '9px 15px', border: 'none', background: 'transparent', cursor: k.aktiv ? 'pointer' : 'not-allowed',
                  borderBottom: `2px solid ${ist ? FARBE : 'transparent'}`,
                  color: ist ? FARBE : 'var(--text-muted)',
                  fontWeight: ist ? 700 : 500, fontSize: '13px', opacity: k.aktiv ? 1 : 0.5,
                  transition: 'color 0.16s, border-color 0.16s',
                }}
              >
                <span aria-hidden="true">{k.icon}</span>{k.label}
                {!k.aktiv && <span style={{ fontSize: '10px' }}>bald</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Website-Anfragen – bestehende Ansicht, unverändert */}
      {kanal === 'website' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {slotWebsiteAnfragen ?? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Website-Anfragen sind hier nicht verfügbar.
            </div>
          )}
        </div>
      )}

      {/* Bot-Inbox – bestehende Ansicht, unverändert */}
      {kanal === 'bot' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {slotBotInbox ?? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Bot-Inbox ist hier nicht verfügbar.
            </div>
          )}
        </div>
      )}

      {/* WhatsApp-Platzhalter */}
      {kanal === 'whatsapp' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
          <div style={{ maxWidth: '460px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '18px' }}>💬</div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '0 0 10px' }}>WhatsApp</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.7, margin: 0 }}>
              Der Kanal ist angelegt. Die Anbindung erfolgt in einem späteren Schritt –
              Nachrichten laufen dann in derselben Zentrale zusammen wie die E-Mails.
            </p>
          </div>
        </div>
      )}

      {/* E-Mail-Zentrale */}
      {kanal === 'email' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* Ordner links */}
          <nav aria-label="Ordner" style={{
            width: '212px', flexShrink: 0, borderRight: '1px solid var(--border)',
            background: 'var(--surface)', padding: '14px 10px', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: '2px',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0 10px 8px' }}>
              E-Mail
            </div>
            {ORDNER.map(o => {
              const ist = ordner === o.key
              const n = zaehler[o.key]
              return (
                <button
                  key={o.key}
                  onClick={() => { setOrdner(o.key); setOffen(null) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 12px',
                    border: 'none', borderRadius: '9px', cursor: 'pointer', textAlign: 'left', width: '100%',
                    background: ist ? FARBE + '14' : 'transparent',
                    color: ist ? FARBE : 'var(--text-muted)',
                    fontWeight: ist ? 700 : 500, fontSize: '13px',
                    transition: 'background 0.16s, color 0.16s',
                  }}
                  onMouseEnter={e => { if (!ist) { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' } }}
                  onMouseLeave={e => { if (!ist) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' } }}
                >
                  <span style={{ width: '18px', textAlign: 'center' }} aria-hidden="true">{o.icon}</span>
                  <span style={{ flex: 1 }}>{o.label}</span>
                  {n > 0 && (
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '1px 7px', borderRadius: '10px', background: ist ? FARBE + '22' : 'var(--surface2)', color: ist ? FARBE : 'var(--text-muted)' }}>
                      {n}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Übersicht */}
          {ordner === 'uebersicht' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '26px 28px 56px' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                Guten Tag
              </h2>
              <p style={{ margin: '0 0 24px', fontSize: '13.5px', color: 'var(--text-muted)' }}>
                Was heute deine Aufmerksamkeit braucht.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '30px' }}>
                <Kennzahl titel="Heute eingegangen" wert={gruppen.heute.length} farbe="#2563eb" icon="📨" onClick={() => setOrdner('posteingang')} />
                <Kennzahl titel="Unbeantwortet"     wert={zaehler.unbeantwortet} farbe="#f97316" icon="⏳" onClick={() => setOrdner('unbeantwortet')} />
                <Kennzahl titel="Nicht zugeordnet"  wert={zaehler.nichtZugeordnet} farbe="#dc2626" icon="❓" onClick={() => setOrdner('nichtZugeordnet')} />
                <Kennzahl titel="Entwürfe"          wert={zaehler.entwuerfe} farbe="#7c3aed" icon="✏️" onClick={() => setOrdner('entwuerfe')} />
              </div>

              {/* KI-Bereich – vorbereitet */}
              <div style={{
                padding: '18px 20px', borderRadius: '12px', marginBottom: '30px',
                background: 'var(--surface)', border: `1px dashed ${FARBE}55`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '17px' }} aria-hidden="true">🤖</span>
                  <strong style={{ fontSize: '14px', color: 'var(--text)' }}>KI-Vorschläge</strong>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: FARBE + '18', color: FARBE }}>
                    vorbereitet
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.7, color: 'var(--text-muted)' }}>
                  Hier erscheinen künftig automatische Zusammenfassungen, eine
                  Priorisierung eingehender E-Mails und fertige Antwortentwürfe.
                  <strong style={{ color: 'var(--text)' }}> Versendet wird nichts automatisch</strong> –
                  jeder Entwurf landet unter „Vorbereitet (KI)" und geht erst nach
                  deiner ausdrücklichen Freigabe raus.
                </p>
              </div>

              {/* Neueste */}
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>Neueste E-Mails</h3>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                {gruppen.posteingang.slice(0, 8).map((n, i) => (
                  <Zeile key={n.id} n={n} erste={i === 0} onClick={() => { setOrdner('posteingang'); setOffen(n.id) }} onMandant={onOeffneMandant} />
                ))}
                {gruppen.posteingang.length === 0 && (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Noch keine E-Mails vorhanden.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Liste + Lesebereich */}
          {ordner !== 'uebersicht' && (
            <>
              <div style={{ width: '380px', flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', minHeight: 0 }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    value={suche}
                    onChange={e => setSuche(e.target.value)}
                    placeholder="🔍 Betreff, Absender, Mandant …"
                    style={{ flex: 1, padding: '8px 11px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12.5px', outline: 'none' }}
                  />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                  {liste.length === 0 && (
                    <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.7 }}>
                      {ordner === 'vorbereitet'
                        ? 'Noch keine KI-Entwürfe. Sobald die KI-Unterstützung aktiv ist, sammeln sich hier Antwortvorschläge zur Freigabe.'
                        : suche ? 'Keine Treffer.' : 'Keine Nachrichten in diesem Ordner.'}
                    </div>
                  )}
                  {liste.map((n, i) => (
                    <Zeile key={n.id} n={n} erste={i === 0} aktiv={offen === n.id}
                      onClick={() => setOffen(n.id)} onMandant={onOeffneMandant} />
                  ))}
                </div>
                <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  {liste.length} Nachricht{liste.length !== 1 ? 'en' : ''}
                </div>
              </div>

              {/* Lesebereich */}
              <div style={{ flex: 1, overflowY: 'auto', minWidth: 0, background: 'var(--bg)' }}>
                {!gewaehlt && (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Wähle links eine Nachricht.
                  </div>
                )}
                {gewaehlt && (
                  <div>
                    {/* KI-Aktionsleiste – vorbereitet */}
                    <div style={{
                      position: 'sticky', top: 0, zIndex: 1,
                      display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center',
                      padding: '11px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
                    }}>
                      {KI_AKTIONEN.map(a => (
                        <button
                          key={a.key}
                          disabled
                          title={`${a.label} – folgt mit der KI-Unterstützung`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '6px 11px', borderRadius: '8px', fontSize: '12px',
                            border: '1px solid var(--border)', background: 'var(--surface2)',
                            color: 'var(--text-muted)', cursor: 'not-allowed', opacity: 0.65,
                          }}
                        >
                          <span aria-hidden="true">{a.icon}</span>{a.label}
                        </button>
                      ))}
                      <span style={{ marginLeft: 'auto', fontSize: '10.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        KI-Aktionen folgen
                      </span>
                    </div>

                    <div style={{ padding: '22px 26px' }}>
                      <h3 style={{ margin: '0 0 12px', fontSize: '19px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>
                        {gewaehlt.betreff || '(kein Betreff)'}
                      </h3>
                      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '18px' }}>
                        <span>{gewaehlt.typ === 'eingehend' ? '📥 Von' : '📤 An'}: <strong style={{ color: 'var(--text)' }}>{gewaehlt.absender || gewaehlt.empfaenger || '—'}</strong></span>
                        <span>{fmtZeit(zeit(gewaehlt))}</span>
                      </div>

                      {/* Mandantenbezug */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                        padding: '11px 14px', borderRadius: '10px', marginBottom: '20px',
                        background: gewaehlt._unbekannt ? 'rgba(220,38,38,0.06)' : FARBE + '10',
                        border: `1px solid ${gewaehlt._unbekannt ? 'rgba(220,38,38,0.3)' : FARBE + '33'}`,
                      }}>
                        {gewaehlt._unbekannt ? (
                          <>
                            <span style={{ fontSize: '12.5px', color: '#dc2626', fontWeight: 600 }}>
                              ❓ Noch keinem Mandanten zugeordnet
                            </span>
                            {onPosteingangOeffnen && (
                              <button onClick={onPosteingangOeffnen}
                                style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: '7px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                                Jetzt zuordnen
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Mandant:</span>
                            <strong style={{ fontSize: '13px', color: 'var(--text)' }}>{gewaehlt._clientName}</strong>
                            {onOeffneMandant && (
                              <button onClick={() => onOeffneMandant(gewaehlt._clientId, 5)}
                                style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: '7px', border: `1px solid ${FARBE}55`, background: FARBE + '14', color: FARBE, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                                Beim Mandanten öffnen →
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Inhalt */}
                      <div style={{ fontSize: '13.5px', lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                        {gewaehlt.text
                          ? gewaehlt.text
                          : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Der Nachrichtentext ist hier nicht zwischengespeichert.
                              Über „Beim Mandanten öffnen" siehst du die vollständige
                              Nachricht in der bestehenden Kommunikationsansicht.
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Bausteine ─────────────────────────────────────────────────────────────────
function Kennzahl({ titel, wert, farbe, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px', textAlign: 'left',
        padding: '16px 18px', borderRadius: '12px', cursor: 'pointer',
        background: 'var(--surface)', border: '1px solid var(--border)',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = farbe + '66'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}
    >
      <span style={{
        width: '40px', height: '40px', flexShrink: 0, borderRadius: '10px',
        background: farbe + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
      }} aria-hidden="true">{icon}</span>
      <span>
        <span style={{ display: 'block', fontSize: '24px', fontWeight: 800, color: wert > 0 ? farbe : 'var(--text-muted)', lineHeight: 1.1 }}>{wert}</span>
        <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>{titel}</span>
      </span>
    </button>
  )
}

function Zeile({ n, erste, aktiv, onClick, onMandant }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 15px', cursor: 'pointer',
        borderTop: erste ? 'none' : '1px solid var(--border)',
        background: aktiv ? 'rgba(22,163,74,0.08)' : 'transparent',
        borderLeft: `3px solid ${aktiv ? FARBE : 'transparent'}`,
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!aktiv) e.currentTarget.style.background = 'var(--surface2)' }}
      onMouseLeave={e => { if (!aktiv) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '3px' }}>
        <span style={{ fontSize: '11px' }} aria-hidden="true">{n.typ === 'eingehend' ? '📥' : '📤'}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {n.absender || n.empfaenger || '—'}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtZeit(zeit(n))}</span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
        {n.betreff || '(kein Betreff)'}
      </div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {n._unbekannt ? (
          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 7px', borderRadius: '10px', background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
            nicht zugeordnet
          </span>
        ) : (
          <span
            onClick={e => { e.stopPropagation(); onMandant?.(n._clientId, 5) }}
            title="Beim Mandanten öffnen"
            style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 7px', borderRadius: '10px', background: 'var(--surface2)', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            {n._clientName || '—'}
          </span>
        )}
        {n.status === 'entwurf' && (
          <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 7px', borderRadius: '10px', background: 'rgba(124,58,237,0.1)', color: '#7c3aed' }}>
            Entwurf
          </span>
        )}
      </div>
    </div>
  )
}
