import { useState } from 'react'
import { SCHWERE, beschreibeAktion } from '../../utils/vorgang.js'
import { STUFEN } from '../../utils/aktionskatalog.js'

/**
 * VorgangKarte – die EINHEITLICHE AI-Empfehlungskarte (BP 1).
 *
 * Stellt jeden „Vorgang" immer gleich dar:
 *   Feststellung → AI-Einschätzung → Empfehlung → vorgeschlagene Aktionen → „Alle ausführen".
 *
 * UI-unabhängig einsetzbar (Nachrichten-Reiter, eigene Zentrale, …). Bekommt einen
 * fertigen `dispatcher` (siehe aktionDispatcher.js) hereingereicht – die Karte weiß
 * nichts über App-State, sie ruft nur dispatcher.fuehreAus / fuehreAlleAus.
 *
 * Props:
 *   vorgang     – das Vorgang-Objekt (vorgang.js)
 *   dispatcher  – { fuehreAus(aktion), fuehreAlleAus(aktionen) }
 *   mandantName – optionaler Anzeigename (falls nicht im Vorgang)
 *   onErledigt  – optional: (vorgangId) => void, nach „Alle ausführen"
 */
export default function VorgangKarte({ vorgang, dispatcher, mandantName, onErledigt }) {
  const [laeuft,   setLaeuft]   = useState(false)
  const [erledigt, setErledigt] = useState(new Set())   // ausgeführte Aktions-Indizes
  const [quittung, setQuittung] = useState('')

  if (!vorgang) return null
  const sch = SCHWERE[vorgang.schwere] ?? SCHWERE.hinweis

  async function eineAktion(aktion, idx) {
    if (laeuft || erledigt.has(idx)) return
    setLaeuft(true)
    const r = await dispatcher.fuehreAus(aktion)
    setLaeuft(false)
    if (r.status === 'ausgefuehrt') setErledigt(prev => new Set(prev).add(idx))
    setQuittung(r.text || '')
    setTimeout(() => setQuittung(''), 4000)
  }

  async function alleAusfuehren() {
    if (laeuft) return
    setLaeuft(true)
    const res = await dispatcher.fuehreAlleAus(vorgang.aktionen)
    setLaeuft(false)
    const neu = new Set(erledigt)
    res.ergebnisse.forEach((r, i) => { if (r.status === 'ausgefuehrt') neu.add(i) })
    setErledigt(neu)
    const teile = []
    if (res.ausgefuehrt) teile.push(`${res.ausgefuehrt} ausgeführt`)
    if (res.vorbereitet) teile.push(`${res.vorbereitet} wartet auf Freigabe`)
    if (res.fehler)      teile.push(`${res.fehler} offen`)
    setQuittung('✓ ' + (teile.join(' · ') || 'nichts zu tun'))
    onErledigt?.(vorgang.id)
  }

  const abschnitt = (titel, text, farbe) => text ? (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ fontSize: '10.5px', fontWeight: 700, color: farbe ?? 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{titel}</div>
      <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  ) : null

  const alleErledigt = vorgang.aktionen.length > 0 && vorgang.aktionen.every((_, i) => erledigt.has(i))

  return (
    <div style={{
      border: '1px solid var(--border)', borderLeft: `4px solid ${sch.farbe}`,
      borderRadius: 'var(--radius)', background: 'var(--surface)', overflow: 'hidden',
      boxShadow: 'var(--shadow)',
    }}>
      {/* Kopf */}
      <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '9px' }}>
        <span aria-hidden="true">{sch.punkt}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{vorgang.titel}</div>
          {(mandantName || vorgang.quelle) && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {mandantName ? mandantName : ''}{mandantName && vorgang.quelle ? ' · ' : ''}{vorgang.quelle ? `Quelle: ${vorgang.quelle.typ}` : ''}
            </div>
          )}
        </div>
        <span style={{ fontSize: '10px', fontWeight: 700, color: sch.farbe }}>{sch.label}</span>
      </div>

      {/* Körper */}
      <div style={{ padding: '12px 14px' }}>
        {abschnitt('Feststellung', vorgang.feststellung)}
        {abschnitt('AI-Einschätzung', vorgang.einschaetzung)}
        {abschnitt('Empfehlung', vorgang.empfehlung, 'var(--accent)')}
      </div>

      {/* Aktionen */}
      {vorgang.aktionen.length > 0 && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '9px' }}>
            {vorgang.aktionen.map((a, i) => {
              const b = beschreibeAktion(a)
              const fertig = erledigt.has(i)
              const istFreigabe = b.stufe === 'freigeben'
              return (
                <button
                  key={i}
                  onClick={() => eineAktion(a, i)}
                  disabled={laeuft || fertig}
                  title={`${b.detail || b.label}${istFreigabe ? ' · braucht deine Freigabe' : ''}${b.implementiert === false ? ' · noch nicht angebunden' : ''}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '6px 11px', borderRadius: '999px', fontSize: '12px', cursor: (laeuft || fertig) ? 'default' : 'pointer',
                    border: '1px solid', borderColor: fertig ? 'var(--green)' : istFreigabe ? 'var(--red)' : 'var(--border2)',
                    background: fertig ? 'var(--green-dim)' : 'var(--surface)',
                    color: fertig ? 'var(--green)' : istFreigabe ? 'var(--red)' : 'var(--text)',
                    opacity: laeuft && !fertig ? 0.6 : 1,
                  }}
                >
                  <span aria-hidden="true">{fertig ? '✓' : b.icon}</span>
                  {b.label}
                  {istFreigabe && !fertig && <span style={{ fontSize: '9px', color: STUFEN.freigeben.farbe }}>Freigabe</span>}
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={alleAusfuehren}
              disabled={laeuft || alleErledigt}
              style={{
                background: alleErledigt ? 'var(--surface)' : 'var(--accent)', color: alleErledigt ? 'var(--text-muted)' : '#fff',
                border: '1px solid var(--accent)', padding: '8px 15px', borderRadius: 'var(--radius-sm)',
                fontSize: '12.5px', fontWeight: 700, cursor: (laeuft || alleErledigt) ? 'default' : 'pointer',
                opacity: laeuft ? 0.6 : 1,
              }}
            >
              {alleErledigt ? '✓ Erledigt' : '✨ Alle empfohlenen ausführen'}
            </button>
            {quittung && <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{quittung}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
