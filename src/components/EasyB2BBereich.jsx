import { useState } from 'react'

/**
 * Bereich „Easy-B2B" – Marktplatz, Suchanzeigen und Partnervermittlung.
 *
 * Dieses Modul übernimmt das bisher eigenständige Easy-B2B-Dashboard
 * (Next.js) in das Spielbuch. Der Umzug erfolgt seitenweise; dieses Gerüst
 * bildet die Navigation und zeigt für jeden Unterbereich, ob er bereits
 * übernommen wurde.
 *
 * Phase 1: nur Struktur. Es werden keine Daten geladen, geschrieben oder
 * verändert. Das Ursprungsprojekt bleibt unangetastet bestehen.
 */

const FARBE  = '#f97316' // Farbwelt des Bereichs „Easy-B2B"
const AKZENT = '#ea580c' // Akzent für aktive Elemente

/**
 * Die 13 Unterbereiche des bestehenden Easy-B2B-Dashboards, in der dortigen
 * Reihenfolge. `quelle` und `zeilen` dokumentieren die Herkunft, `daten` die
 * Datenlage – beides bleibt während des Umzugs die Arbeitsgrundlage.
 */
export const EB2B_BEREICHE = [
  { key: 'uebersicht',  label: 'Übersicht',       icon: '📊', quelle: 'dashboard/page.tsx',            zeilen: 168,  daten: 'store' },
  { key: 'anfragen',    label: 'Anfragen',        icon: '📋', quelle: 'dashboard/anfragen/page.tsx',   zeilen: 938,  daten: 'neon'  },
  { key: 'unternehmen', label: 'Unternehmen',     icon: '🏢', quelle: 'dashboard/unternehmen/page.tsx',zeilen: 483,  daten: 'mock'  },
  { key: 'projekte',    label: 'Projekte',        icon: '🚀', quelle: 'dashboard/projekte/page.tsx',   zeilen: 2126, daten: 'neon'  },
  { key: 'interessenten',label: 'Interessenten',  icon: '👥', quelle: 'dashboard/interessenten/page.tsx',zeilen: 595,daten: 'neon'  },
  { key: 'kontakte',    label: 'Kontakte',        icon: '🤝', quelle: 'dashboard/kontakte/page.tsx',   zeilen: 434,  daten: 'mock'  },
  { key: 'netzwerk',    label: 'Netzwerk',        icon: '🕸', quelle: 'dashboard/netzwerk/page.tsx',   zeilen: 682,  daten: 'mock'  },
  { key: 'events',      label: 'Events',          icon: '🎤', quelle: 'dashboard/events/page.tsx',     zeilen: 579,  daten: 'mock'  },
  { key: 'newsletter',  label: 'Newsletter',      icon: '📰', quelle: 'dashboard/newsletter/page.tsx', zeilen: 427,  daten: 'mock'  },
  { key: 'ki',          label: 'KI-Zentrale',     icon: '🤖', quelle: 'dashboard/ki-zentrale/page.tsx',zeilen: 745,  daten: 'mock'  },
  { key: 'formulare',   label: 'Formulare',       icon: '📝', quelle: 'dashboard/formulare/page.tsx',  zeilen: 988,  daten: 'mock'  },
  { key: 'kultur',      label: 'Kultur & Wissen', icon: '📚', quelle: 'dashboard/kultur-wissen/page.tsx',zeilen: 388,daten: 'mock'  },
  { key: 'stories',     label: 'Success Stories', icon: '⭐', quelle: 'dashboard/success-stories/page.tsx',zeilen: 518,daten: 'mock' },
]

/** Woher die Daten eines Unterbereichs stammen – ehrlich benannt. */
const DATENLAGE = {
  neon:  { label: 'Neon-Datenbank', icon: '🗄', farbe: '#16a34a',
           text: 'Liest aus der bestehenden Neon-Datenbank. Bleibt beim Umzug unverändert angebunden.' },
  mock:  { label: 'Beispieldaten',  icon: '⚠️', farbe: '#d97706',
           text: 'Arbeitet mit Beispieldaten im Arbeitsspeicher. Änderungen überleben kein Neuladen – schon heute im Ursprungsprojekt.' },
  store: { label: 'Gemischt',       icon: '◐', farbe: '#2563eb',
           text: 'Zeigt Kennzahlen aus beiden Quellen zusammengefasst.' },
}

export default function EasyB2BBereich() {
  const [bereich, setBereich] = useState('uebersicht')
  const aktiv = EB2B_BEREICHE.find(b => b.key === bereich) ?? EB2B_BEREICHE[0]
  const lage  = DATENLAGE[aktiv.daten]

  const gesamtZeilen = EB2B_BEREICHE.reduce((s, b) => s + b.zeilen, 0)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Kopf */}
      <div style={{ padding: '14px 20px 0', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <nav aria-label="Pfad" style={{ display: 'flex', gap: '7px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          <span>Spielbuch</span><span style={{ opacity: 0.5 }}>›</span>
          <span style={{ color: FARBE, fontWeight: 700 }}>Easy-B2B</span>
        </nav>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {EB2B_BEREICHE.map(b => {
            const ist = bereich === b.key
            return (
              <button key={b.key} onClick={() => setBereich(b.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '7px',
                  padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer',
                  borderBottom: `2px solid ${ist ? AKZENT : 'transparent'}`,
                  color: ist ? AKZENT : 'var(--text-muted)',
                  fontWeight: ist ? 700 : 500, fontSize: '13px',
                  transition: 'color 0.16s, border-color 0.16s',
                }}>
                <span aria-hidden="true">{b.icon}</span>{b.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '24px 26px 56px' }}>
        <div style={{ maxWidth: '1060px', margin: '0 auto' }}>

          <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            {aktiv.label}
          </h2>
          <p style={{ margin: '0 0 22px', fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '660px' }}>
            Dieser Unterbereich wird aus dem bestehenden Easy-B2B-Dashboard übernommen.
            Die Oberfläche folgt danach der Gestaltung des Spielbuchs, die Fachlichkeit bleibt unverändert.
          </p>

          {/* Stand der Übernahme */}
          <div style={{
            padding: '17px 19px', borderRadius: '12px', marginBottom: '20px',
            background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.28)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '7px' }}>
              <span style={{ fontSize: '17px' }} aria-hidden="true">🚚</span>
              <strong style={{ fontSize: '14px', color: 'var(--text)' }}>Noch nicht übernommen</strong>
            </div>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.7, color: 'var(--text-muted)' }}>
              Herkunft: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)' }}>{aktiv.quelle}</code>{' '}
              · {aktiv.zeilen.toLocaleString('de-DE')} Zeilen.
              Bis zur Übernahme bleibt das Ursprungsprojekt die maßgebliche Fassung –
              es wird nicht verändert und dient als Rückfallebene.
            </p>
          </div>

          {/* Datenlage */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '12px',
            padding: '14px 17px', borderRadius: '11px', marginBottom: '26px',
            background: 'var(--surface)', border: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '17px', lineHeight: 1.4 }} aria-hidden="true">{lage.icon}</span>
            <span style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.7 }}>
              <strong style={{ color: lage.farbe }}>{lage.label}.</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>{lage.text}</span>
            </span>
          </div>

          {/* Gesamtübersicht */}
          <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
            Umfang des Umzugs
          </h3>
          <div style={{
            border: '1px solid var(--border)', borderRadius: '11px',
            background: 'var(--surface)', overflow: 'hidden', marginBottom: '14px',
          }}>
            {EB2B_BEREICHE.map((b, i) => {
              const l = DATENLAGE[b.daten]
              return (
                <button key={b.key} onClick={() => setBereich(b.key)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '11px',
                    padding: '11px 15px', border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: b.key === bereich ? 'var(--surface2)' : 'transparent',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  }}>
                  <span aria-hidden="true" style={{ fontSize: '15px' }}>{b.icon}</span>
                  <span style={{ flex: 1, fontSize: '13px', color: 'var(--text)', fontWeight: b.key === bereich ? 700 : 500 }}>
                    {b.label}
                  </span>
                  <span title={l.label} style={{ fontSize: '12px', color: l.farbe }} aria-label={l.label}>
                    {l.icon}
                  </span>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: '58px', textAlign: 'right' }}>
                    {b.zeilen.toLocaleString('de-DE')}
                  </span>
                </button>
              )
            })}
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
            {EB2B_BEREICHE.length} Unterbereiche, zusammen {gesamtZeilen.toLocaleString('de-DE')} Zeilen.
            Sie werden einzeln übernommen – nach jedem Schritt ist der Bereich lauffähig.
          </p>

        </div>
      </div>
    </div>
  )
}
