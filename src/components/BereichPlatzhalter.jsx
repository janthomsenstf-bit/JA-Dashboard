import { bereichCfg } from './HauptNavigation.jsx'

/**
 * Vorbereiteter, noch leerer Hauptbereich.
 * Phase 1: zeigt nur, dass der Bereich existiert und wofür er vorgesehen ist.
 * Die Inhalte werden im nächsten Schritt definiert.
 */
export default function BereichPlatzhalter({ bereich }) {
  const cfg = bereichCfg(bereich)

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '72px 24px',
    }}>
      <div style={{ maxWidth: '620px', width: '100%', textAlign: 'center' }}>

        {/* Bereichs-Signet in der Farbwelt des Bereichs */}
        <div style={{
          width: '72px', height: '72px', margin: '0 auto 28px',
          borderRadius: '18px',
          background: cfg.farbe + '14',
          border: `1px solid ${cfg.farbe}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px', lineHeight: 1,
        }}>
          <span aria-hidden="true">{cfg.icon}</span>
        </div>

        <p style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: cfg.farbe, margin: '0 0 12px',
        }}>
          Bereich
        </p>

        <h2 style={{
          fontSize: '30px', fontWeight: 700, color: 'var(--text)',
          margin: '0 0 16px', letterSpacing: '-0.02em',
        }}>
          {cfg.label}
        </h2>

        <p style={{
          fontSize: '15px', lineHeight: 1.7, color: 'var(--text-muted)',
          margin: '0 auto 36px', maxWidth: '460px',
        }}>
          {cfg.beschreibung}
        </p>

        <div style={{
          padding: '18px 22px',
          borderRadius: '12px',
          background: 'var(--surface)',
          border: '1px dashed var(--border)',
          fontSize: '13px',
          lineHeight: 1.6,
          color: 'var(--text-muted)',
          textAlign: 'left',
        }}>
          <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '4px' }}>
            Noch nicht eingerichtet
          </strong>
          Dieser Bereich ist angelegt und wartet auf Inhalte. Im nächsten Schritt
          legen wir gemeinsam fest, welche Funktionen hier einziehen.
        </div>

        <p style={{ marginTop: '28px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Der bisherige Arbeitsbereich ist unverändert unter{' '}
          <strong style={{ color: 'var(--text)' }}>📊 Spielbuch</strong> erreichbar.
        </p>
      </div>
    </div>
  )
}
