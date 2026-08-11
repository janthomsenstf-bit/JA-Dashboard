/**
 * Hauptnavigation („Spielbuch") – oberstes Menüband der Anwendung.
 *
 * Phase 1: Reine Navigationsstruktur. Jeder Bereich hat eine eigene Farbwelt,
 * damit sofort erkennbar ist, wo man sich befindet. Die Inhalte der neuen
 * Bereiche folgen in einem späteren Schritt.
 *
 * Rein additiv: Der bestehende Arbeitsbereich bleibt unter „Spielbuch"
 * unverändert erhalten.
 */

export const HAUPTBEREICHE = [
  { key: 'agent',        label: 'Co-Trainer',    icon: '🧭', farbe: '#0d9488', beschreibung: 'Dein sprechender Assistent – frag das Spielbuch per Text oder Sprache und lege eigene Skills an.' },
  { key: 'spielbuch',    label: 'Spielbuch',     icon: '📊', farbe: '#2563eb', beschreibung: 'Mandanten, Aufträge, Jahresabschlüsse – der bisherige Arbeitsbereich.' },
  { key: 'homepages',    label: 'Homepages',     icon: '🌐', farbe: '#3b82f6', beschreibung: 'Websites, Inhalte und Anfragen aus dem Netz.' },
  { key: 'kommunikation',label: 'Kommunikation', icon: '✉️', farbe: '#16a34a', beschreibung: 'E-Mails, Vorlagen und der gesamte Schriftverkehr.' },
  { key: 'personen',     label: 'Personen',      icon: '👥', farbe: '#0891b2', beschreibung: 'Mandanten, Ansprechpartner und Kontakte.' },
  { key: 'easyb2b',      label: 'Easy-B2B',      icon: '🤝', farbe: '#f97316', beschreibung: 'Marktplatz, Suchanzeigen und Partnervermittlung.' },
  { key: 'ustreg',       label: 'USt-Registrierung', icon: '🏛', farbe: '#4338ca', beschreibung: 'Umsatzsteuerliche Registrierung ausländischer Unternehmen – Fälle, Formulare, Wissensdatenbank.' },
  { key: 'uebersichten', label: 'Übersichten',   icon: '📈', farbe: '#7c3aed', beschreibung: 'Auswertungen, Kennzahlen und Berichte.' },
  { key: 'prozesse',     label: 'Prozesse',      icon: '⚙️', farbe: '#0f766e', beschreibung: 'Abläufe, Checklisten und wiederkehrende Aufgaben.' },
  { key: 'checklisten',  label: 'Checklisten',   icon: '✅', farbe: '#059669', beschreibung: 'Jahresabschluss-Checklisten – Übersicht, Bearbeitung und Mandanten-Zuordnung.' },
  { key: 'dokumente',    label: 'Dokumente',     icon: '📁', farbe: '#dc2626', beschreibung: 'Dateien, Ablage und Vorlagen.' },
  { key: 'lernplattform',label: 'Lernplattform', icon: '🎓', farbe: '#ca8a04', beschreibung: 'Wissen, Schulungen und Nachschlagewerke.' },
  { key: 'intern',       label: 'Intern',        icon: '🔒', farbe: '#64748b', beschreibung: 'Einstellungen, Verwaltung und interne Notizen.' },
]

export function bereichCfg(key) {
  return HAUPTBEREICHE.find(b => b.key === key) ?? HAUPTBEREICHE[0]
}

export default function HauptNavigation({ aktiv, onWechsel }) {
  return (
    <nav
      aria-label="Hauptnavigation"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexWrap: 'wrap',
        padding: '8px 16px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {HAUPTBEREICHE.map(b => {
        const istAktiv = aktiv === b.key
        return (
          <button
            key={b.key}
            onClick={() => onWechsel(b.key)}
            title={b.beschreibung}
            aria-current={istAktiv ? 'page' : undefined}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 14px',
              borderRadius: '10px',
              border: '1px solid',
              borderColor: istAktiv ? b.farbe + '55' : 'transparent',
              background: istAktiv ? b.farbe + '14' : 'transparent',
              color: istAktiv ? b.farbe : 'var(--text-muted)',
              fontSize: '13px',
              fontWeight: istAktiv ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 0.18s ease, color 0.18s ease, border-color 0.18s ease',
            }}
            onMouseEnter={e => {
              if (istAktiv) return
              e.currentTarget.style.background = 'var(--surface2)'
              e.currentTarget.style.color = 'var(--text)'
            }}
            onMouseLeave={e => {
              if (istAktiv) return
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            <span style={{ fontSize: '15px', lineHeight: 1 }} aria-hidden="true">{b.icon}</span>
            {b.label}
          </button>
        )
      })}
    </nav>
  )
}
