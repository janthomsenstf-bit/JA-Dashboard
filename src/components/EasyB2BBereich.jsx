import { useState, useEffect } from 'react'
import { DashboardStoreProvider, useStore } from '@easyb2b/lib/store.tsx'

import Uebersicht     from '@easyb2b/seiten/Uebersicht.tsx'
import Anfragen       from '@easyb2b/seiten/Anfragen.tsx'
import Unternehmen    from '@easyb2b/seiten/Unternehmen.tsx'
import Projekte       from '@easyb2b/seiten/Projekte.tsx'
import Interessenten  from '@easyb2b/seiten/Interessenten.tsx'
import Kontakte       from '@easyb2b/seiten/Kontakte.tsx'
import Netzwerk       from '@easyb2b/seiten/Netzwerk.tsx'
import Events         from '@easyb2b/seiten/Events.tsx'
import Newsletter     from '@easyb2b/seiten/Newsletter.tsx'
import KiZentrale     from '@easyb2b/seiten/KiZentrale.tsx'
import Formulare      from '@easyb2b/seiten/Formulare.tsx'
import KulturWissen   from '@easyb2b/seiten/KulturWissen.tsx'
import SuccessStories from '@easyb2b/seiten/SuccessStories.tsx'

/**
 * Bereich „Easy-B2B" – Marktplatz, Suchanzeigen und Partnervermittlung.
 *
 * Das bisher eigenständige Easy-B2B-Dashboard (Next.js) ist hier als Modul
 * eingebunden. Die 13 Unterbereiche entsprechen den Seiten des Ursprungs-
 * projekts und wurden fachlich unverändert übernommen.
 *
 * Offen: Die Seiten bringen noch ihre eigene Farbwelt mit (feste Hex-Werte
 * statt der CSS-Variablen des Spielbuchs). Die Angleichung ist ein eigener
 * Schritt, damit sich Übernahme und Umgestaltung getrennt prüfen lassen.
 */

const FARBE  = '#f97316' // Farbwelt des Bereichs „Easy-B2B"
const AKZENT = '#ea580c' // Akzent für aktive Elemente

/** Die Unterbereiche in der Reihenfolge des Ursprungsdashboards. */
export const EB2B_BEREICHE = [
  { key: 'uebersicht',    label: 'Übersicht',       icon: '📊', seite: Uebersicht,     daten: 'gemischt' },
  { key: 'anfragen',      label: 'Anfragen',        icon: '📋', seite: Anfragen,       daten: 'neon'  },
  { key: 'unternehmen',   label: 'Unternehmen',     icon: '🏢', seite: Unternehmen,    daten: 'demo'  },
  { key: 'projekte',      label: 'Projekte',        icon: '🚀', seite: Projekte,       daten: 'neon'  },
  { key: 'interessenten', label: 'Interessenten',   icon: '👥', seite: Interessenten,  daten: 'neon'  },
  { key: 'kontakte',      label: 'Kontakte',        icon: '🤝', seite: Kontakte,       daten: 'demo'  },
  { key: 'netzwerk',      label: 'Netzwerk',        icon: '🕸', seite: Netzwerk,       daten: 'demo'  },
  { key: 'events',        label: 'Events',          icon: '🎤', seite: Events,         daten: 'demo'  },
  { key: 'newsletter',    label: 'Newsletter',      icon: '📰', seite: Newsletter,     daten: 'demo'  },
  { key: 'ki',            label: 'KI-Zentrale',     icon: '🤖', seite: KiZentrale,     daten: 'demo'  },
  { key: 'formulare',     label: 'Formulare',       icon: '📝', seite: Formulare,      daten: 'demo'  },
  { key: 'kultur',        label: 'Kultur & Wissen', icon: '📚', seite: KulturWissen,   daten: 'demo'  },
  { key: 'stories',       label: 'Success Stories', icon: '⭐', seite: SuccessStories, daten: 'demo'  },
]

/**
 * Der Bereich stellt die übernommene Datenschicht bereit, damit sie über
 * alle Unterbereiche hinweg erhalten bleibt – wie im Ursprungsdashboard,
 * wo sie im Layout lag.
 */
export default function EasyB2BBereich({ initialBereich = null, onInitialVerbraucht }) {
  return (
    <DashboardStoreProvider>
      <EasyB2BInhalt initialBereich={initialBereich} onInitialVerbraucht={onInitialVerbraucht} />
    </DashboardStoreProvider>
  )
}

function EasyB2BInhalt({ initialBereich, onInitialVerbraucht }) {
  const [bereich, setBereich] = useState(
    () => (initialBereich && EB2B_BEREICHE.some(b => b.key === initialBereich)) ? initialBereich : 'uebersicht',
  )

  // Aus der globalen Suche nachträglich vorgewählter Unterbereich.
  useEffect(() => {
    if (!initialBereich) return
    if (EB2B_BEREICHE.some(b => b.key === initialBereich)) setBereich(initialBereich)
    onInitialVerbraucht?.()
  }, [initialBereich])
  const aktiv = EB2B_BEREICHE.find(b => b.key === bereich) ?? EB2B_BEREICHE[0]
  const Seite = aktiv.seite

  const { dbLadenStatus } = useStore()

  // Nur melden, wenn wirklich etwas fehlt. Im Normalfall bleibt die Leiste
  // aus – ein dauerhaft grüner Haken wäre nur Lärm.
  const zeigeWarnung = dbLadenStatus === 'fehler' && aktiv.daten === 'neon'

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

      {/* Hinweis nur bei fehlender Datenbankverbindung auf einer Seite,
          die echte Daten erwartet. */}
      {zeigeWarnung && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '9px',
          padding: '9px 20px', flexShrink: 0,
          background: 'rgba(220,38,38,0.07)', borderBottom: '1px solid rgba(220,38,38,0.25)',
          fontSize: '12.5px', color: '#dc2626', lineHeight: 1.6,
        }}>
          <span aria-hidden="true">🔴</span>
          <span>
            Keine Verbindung zur Neon-Datenbank – dieser Bereich zeigt nur Demo-Daten.
            Fehlt auf Vercel die Umgebungsvariable <code style={{ fontFamily: 'var(--font-mono)' }}>DATABASE_URL</code>?
          </span>
        </div>
      )}

      {/* Übernommene Seite, unverändert dargestellt */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <Seite />
      </div>
    </div>
  )
}
