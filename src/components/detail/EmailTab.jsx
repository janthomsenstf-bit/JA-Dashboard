import { useState, useEffect } from 'react'

const TEMPLATES = [
  { key: 'rueckfragen',  label: 'Rückfragen' },
  { key: 'erinnerung',   label: 'Erinnerung' },
  { key: 'unterschrift', label: 'Unterschrift' },
  { key: 'uebermittlung', label: 'Übermittlung' },
]

function buildTemplate(key, client) {
  const vj   = client.veranlagungsjahr
  const name = client.name

  switch (key) {
    case 'rueckfragen': {
      const open = client.rueckfragen.filter(r => !r.beantwortet)
      const list = open.length > 0
        ? open.map((r, i) => `  ${i + 1}. ${r.text}`).join('\n')
        : '  (bitte ergänzen)'
      return `Sehr geehrte Damen und Herren,

im Rahmen der Erstellung Ihrer Steuererklärung für den Veranlagungszeitraum ${vj} benötigen wir noch folgende Unterlagen bzw. Informationen:

${list}

Wir bitten Sie, uns die entsprechenden Belege und Angaben baldmöglichst zukommen zu lassen, damit wir die Bearbeitung termingerecht abschließen können.

Bei Rückfragen stehen wir Ihnen selbstverständlich gerne zur Verfügung.

Mit freundlichen Grüßen`
    }

    case 'erinnerung':
      return `Sehr geehrte Damen und Herren,

wir erlauben uns, freundlich an unsere Anfrage vom [Datum] zu erinnern. Für die Erstellung Ihrer Steuererklärung ${vj} benötigen wir noch die ausstehenden Unterlagen.

Um eine fristgerechte Abgabe sicherstellen zu können, bitten wir Sie, uns die fehlenden Informationen bis spätestens [Datum eintragen] zu übermitteln.

Sollten Sie Fragen haben oder einen anderen Kommunikationsweg bevorzugen, zögern Sie bitte nicht, uns zu kontaktieren.

Mit freundlichen Grüßen`

    case 'unterschrift':
      return `Sehr geehrte Damen und Herren,

beiliegend übersenden wir Ihnen die fertiggestellte Steuererklärung für den Veranlagungszeitraum ${vj} zur Durchsicht und Unterzeichnung.

Wir bitten Sie, die beigefügte Vollständigkeitserklärung zu prüfen, zu unterschreiben und uns anschließend im Original zuzusenden bzw. einzuscannen und per E-Mail zu übermitteln.

Bitte bestätigen Sie kurz den Empfang dieser Nachricht.

Mit freundlichen Grüßen`

    case 'uebermittlung':
      return `Sehr geehrte Damen und Herren,

wir freuen uns, Ihnen mitteilen zu können, dass Ihre Steuererklärung für den Veranlagungszeitraum ${vj} heute elektronisch an das zuständige Finanzamt übermittelt wurde.

Sie werden den Steuerbescheid in den kommenden Wochen direkt vom Finanzamt erhalten. Bitte leiten Sie uns diesen zur Prüfung umgehend weiter.

Sollten Sie Fragen zum weiteren Verfahren haben, stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen`

    default:
      return ''
  }
}

export default function EmailTab({ client }) {
  const [activeTemplate, setActiveTemplate] = useState('rueckfragen')
  const [text, setText] = useState(() => buildTemplate('rueckfragen', client))
  const [copied, setCopied] = useState(false)

  // Rebuild template when client changes
  useEffect(() => {
    setText(buildTemplate(activeTemplate, client))
    setCopied(false)
  }, [client.id])

  function selectTemplate(key) {
    setActiveTemplate(key)
    setText(buildTemplate(key, client))
    setCopied(false)
  }

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleReset() {
    setText(buildTemplate(activeTemplate, client))
    setCopied(false)
  }

  return (
    <div className="tab-content">
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px',
        }}
      >
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          E-Mail-Vorlage
        </div>

        {/* Template selector */}
        <div className="email-template-tabs">
          {TEMPLATES.map(t => (
            <button
              key={t.key}
              className={`email-template-btn${activeTemplate === t.key ? ' active' : ''}`}
              onClick={() => selectTemplate(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Hint */}
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            background: 'var(--surface2)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            marginBottom: '12px',
          }}
        >
          💡 Vorlage ist vollständig bearbeitbar. Platzhalter in eckigen Klammern bitte anpassen.
          Alle E-Mails in höflicher Sie-Form ohne persönliche Anrede.
        </div>

        <textarea
          className="email-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
        />

        <div className="email-actions">
          <button className="btn btn-ghost btn-sm" onClick={handleReset}>
            ↺ Zurücksetzen
          </button>
          <button
            className={`btn btn-sm ${copied ? 'btn-success' : 'btn-primary'}`}
            onClick={handleCopy}
          >
            {copied ? '✓ Kopiert!' : '📋 In Zwischenablage'}
          </button>
        </div>
      </div>
    </div>
  )
}
