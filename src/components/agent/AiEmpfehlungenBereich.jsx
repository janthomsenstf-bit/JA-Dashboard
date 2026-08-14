import { useMemo } from 'react'
import VorgangKarte from './VorgangKarte.jsx'
import { generiereVorgaenge } from '../../utils/vorgangGenerator.js'

/**
 * AiEmpfehlungenBereich – die eigene „AI-Empfehlungen"-Liste (BP 1, live).
 *
 * Erkennt aus den vorhandenen Daten Vorgänge (rein lesend) und zeigt sie als
 * einheitliche VorgangKarte mit CTAs + „Alle ausführen". Die Ausführung läuft über
 * den injizierten `dispatcher` (App-eigene Setter → sicher gespeichert).
 *
 * Props: clients, dispatcher, onOeffneMandant?
 */
export default function AiEmpfehlungenBereich({ clients = [], dispatcher, onOeffneMandant }) {
  const vorgaenge = useMemo(() => generiereVorgaenge(clients), [clients])
  const dringend = vorgaenge.filter(v => v.schwere === 'handlungsbedarf').length
  const nameOf = (id) => clients.find(c => c.id === id)?.name ?? null

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', minHeight: 0 }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '20px 16px 60px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
          <span style={{ fontSize: '22px' }} aria-hidden="true">🤖</span>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)' }}>AI-Empfehlungen</div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
              {vorgaenge.length} Vorgang{vorgaenge.length !== 1 ? 'e' : ''}{dringend ? ` · ${dringend} mit Handlungsbedarf` : ''}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '10px 0 18px', lineHeight: 1.55 }}>
          Automatisch erkannt aus deinen Daten (rein lesend). Aktionen legen erst nach deinem Klick etwas an;
          außenwirksame Schritte (z. B. Mail senden) bleiben deiner Freigabe vorbehalten.
        </div>

        {vorgaenge.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '8vh 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            <div style={{ fontSize: '30px', marginBottom: '8px' }} aria-hidden="true">✓</div>
            Nichts Offenes erkannt – alles im grünen Bereich.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {vorgaenge.map(v => (
              <div key={v.id}>
                <VorgangKarte vorgang={v} dispatcher={dispatcher} mandantName={nameOf(v.mandantId)} />
                {onOeffneMandant && v.mandantId && (
                  <button
                    onClick={() => onOeffneMandant(v.mandantId)}
                    style={{ marginTop: '5px', marginLeft: '2px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontSize: '11.5px' }}
                  >
                    → Mandant öffnen
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
