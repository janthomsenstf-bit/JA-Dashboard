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
  { key: 'ki_empfehlungen', label: 'AI-Empfehlungen', icon: '🤖', farbe: '#0d9488', beschreibung: 'Automatisch erkannte Vorgänge mit vorgeschlagenen Aktionen – bestätigen und ausführen.' },
  { key: 'kommunikation',label: 'Kommunikation', icon: '✉️', farbe: '#16a34a', beschreibung: 'E-Mails, Vorlagen und der gesamte Schriftverkehr.' },
  { key: 'personen',     label: 'Personen',      icon: '👥', farbe: '#0891b2', beschreibung: 'Mandanten, Ansprechpartner und Kontakte.' },
  { key: 'auftraege',    label: 'Aufträge',      icon: '📑', farbe: '#2563eb', beschreibung: 'Alles mit Datum an einem Ort – Aufträge, Fristen, Aufgaben, Termine und Erinnerungen.' },
  { key: 'kalender',     label: 'Kalender',      icon: '📅', farbe: '#ca8a04', beschreibung: 'Termine im Monats- und Tagesblick.' },
  { key: 'honorare',     label: 'Honorare',      icon: '💰', farbe: '#15803d', beschreibung: 'Honorare, Budgets und offene Beträge.' },
  { key: 'ustreg',       label: 'USt-Registrierung', icon: '🏛', farbe: '#4338ca', beschreibung: 'Umsatzsteuerliche Registrierung ausländischer Unternehmen – Fälle, Formulare, Wissensdatenbank.' },
  { key: 'prozesse',     label: 'Prozesse',      icon: '⚙️', farbe: '#0f766e', beschreibung: 'Abläufe, Checklisten und wiederkehrende Aufgaben.' },
  { key: 'checklisten',  label: 'Checklisten',   icon: '✅', farbe: '#059669', beschreibung: 'Jahresabschluss-Checklisten – Übersicht, Bearbeitung und Mandanten-Zuordnung.' },
  { key: 'leistungspool',label: 'Leistungspool', icon: '🗂', farbe: '#9333ea', beschreibung: 'Katalog der Auftrags- und Leistungsarten – eigene anlegen, Vorschläge, Nutzungs-Überblick.' },
  { key: 'dokumente',    label: 'Dokumente',     icon: '📁', farbe: '#dc2626', beschreibung: 'Dateien, Ablage und Vorlagen.' },
]

export function bereichCfg(key) {
  return HAUPTBEREICHE.find(b => b.key === key) ?? HAUPTBEREICHE[0]
}

export default function HauptNavigation({ aktiv, onWechsel, onStart, cockpitAktiv = false }) {
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
      {/* Start / Cockpit – springt immer zur Übersichts-Startseite */}
      <button
        onClick={() => onStart?.()}
        title="Zur Startseite (Cockpit)"
        aria-current={cockpitAktiv ? 'page' : undefined}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '9px 14px', borderRadius: '10px', border: '1px solid',
          borderColor: cockpitAktiv ? '#2f6df055' : 'transparent',
          background: cockpitAktiv ? '#2f6df014' : 'transparent',
          color: cockpitAktiv ? '#2f6df0' : 'var(--text-muted)',
          fontSize: '13px', fontWeight: cockpitAktiv ? 700 : 500,
          cursor: 'pointer', whiteSpace: 'nowrap',
          transition: 'background 0.18s ease, color 0.18s ease, border-color 0.18s ease',
        }}
        onMouseEnter={e => { if (cockpitAktiv) return; e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text)' }}
        onMouseLeave={e => { if (cockpitAktiv) return; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
      >
        <span style={{ fontSize: '15px', lineHeight: 1 }} aria-hidden="true">🏠</span>
        Start
      </button>
      <span style={{ width: '1px', height: '22px', background: 'var(--border)', margin: '0 4px' }} aria-hidden="true" />

      {HAUPTBEREICHE.map(b => {
        // Auf der Cockpit-Startseite ist „Personen" nicht als aktiv markiert (Start übernimmt).
        const istAktiv = aktiv === b.key && !(b.key === 'personen' && cockpitAktiv)
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
