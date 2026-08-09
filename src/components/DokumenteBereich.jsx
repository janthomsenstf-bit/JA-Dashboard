import { useState, useMemo } from 'react'
import { OneDriveSection } from './detail/DokumenteTab.jsx'
import OneDriveOrdnerbaum from './OneDriveOrdnerbaum.jsx'
import PostServiceEinlesen from './dokumente/PostServiceEinlesen.jsx'

/**
 * Bereich „Dokumente" – zentrale Dokumentenverwaltung.
 *
 * Phase 1: Struktur + Integration der VORHANDENEN OneDrive-Anbindung.
 * Der komplette Datei-Browser (Navigation, Upload, Vorschau, Download,
 * Umbenennen, Löschen, Auswahl, Als-Anhang-senden) wird unverändert aus
 * `OneDriveSection` wiederverwendet – lediglich mit anderem Wurzelordner.
 *
 * Vorbereitet für KI: Analyse, Umbenennungs-Vorschläge, Einsortieren,
 * Dublettenprüfung, semantische Suche, Zusammenfassungen. Alle KI-Funktionen
 * arbeiten nach dem Prinzip „Vorschlag statt Automatik" – die Entscheidung
 * trifft immer der Nutzer.
 */

const FARBE = '#dc2626' // Farbwelt des Bereichs „Dokumente"

const QUELLEN = [
  { key: 'onedrive', label: 'OneDrive',     icon: '☁️', aktiv: true },
  { key: 'mandant',  label: 'Nach Mandant', icon: '👥', aktiv: true },
  { key: 'ki',       label: 'KI-Werkzeuge', icon: '🤖', aktiv: true },
]

// KI-Werkzeuge – Oberfläche vorbereitet, Ausführung folgt.
export const KI_WERKZEUGE = [
  { key: 'analyse',    icon: '🔍', titel: 'Dokumente analysieren',
    text: 'Ordner oder Verzeichnisse markieren und den Inhalt erfassen lassen – Dokumententyp, Datum, Beträge, Beteiligte.' },
  { key: 'umbenennen', icon: '✏️', titel: 'Umbenennen nach Regeln',
    text: 'Nach eigenen Regeln benennen, z. B. Datum_Mandant_Typ_Betrag. Es werden Vorschläge erzeugt, nichts wird automatisch umbenannt.',
    beispiel: '2026-07-15_Musterfirma_Eingangsrechnung_1.248,50EUR.pdf' },
  { key: 'sortieren',  icon: '🗂', titel: 'Einsortieren',
    text: 'Vorschläge zur Ablage nach Jahr, Mandant oder Dokumententyp (Rechnung, Vertrag, Bescheid, Kontoauszug, Lohnunterlagen).' },
  { key: 'dubletten',  icon: '👯', titel: 'Dublettenprüfung',
    text: 'Findet identische, nahezu identische und verschiedene Versionen desselben Dokuments – mit Vorschlag, was behalten werden sollte.' },
  { key: 'erkennung',  icon: '🏷', titel: 'Dokumentenerkennung',
    text: 'Erkennt inhaltlich, worum es sich handelt: Rechnung, Steuerbescheid, Vertrag, Mahnung, Kontoauszug, Lohnabrechnung, Schriftverkehr.' },
  { key: 'suche',      icon: '💡', titel: 'Intelligente Suche',
    text: 'Sucht in Inhalten statt nur in Dateinamen.',
    beispiel: '„Alle Umsatzsteuerbescheide 2025" · „Verträge mit Vodafone" · „Dokumente über 5.000 €"' },
  { key: 'zusammen',   icon: '📝', titel: 'Zusammenfassung',
    text: 'Fasst umfangreiche Dokumente zusammen und beantwortet Fragen dazu – etwa nach Fristen oder Zahlungsverpflichtungen.' },
  { key: 'ocr',        icon: '🔠', titel: 'Texterkennung (OCR)',
    text: 'Macht eingescannte Dokumente durchsuchbar, damit auch Papierunterlagen auffindbar sind.' },
]

export default function DokumenteBereich({
  clients = [],
  onedriveTokens,
  onUpdateOnedriveTokens,
  onOeffneMandant,       // (clientId, tab) => void
  onSendAsAttachment,
}) {
  const [quelle, setQuelle] = useState('onedrive')
  const [suche, setSuche]   = useState('')
  // Explorer: aktuell gewählter Ordner ('' = OneDrive-Stamm) + Mehrfachmarkierung
  const [ordner, setOrdner]       = useState('')
  const [markierte, setMarkierte] = useState([])
  const toggleMarkierung = pfad =>
    setMarkierte(m => (m.includes(pfad) ? m.filter(p => p !== pfad) : [...m, pfad]))

  // Nur Mandanten mit hinterlegtem OneDrive-Bezug bzw. nicht archiviert
  const mandanten = useMemo(() => {
    const q = suche.trim().toLowerCase()
    return clients
      .filter(c => !c.archiviert)
      .filter(c => !q || (c.name ?? '').toLowerCase().includes(q) || String(c.mandantennummer ?? '').includes(q))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [clients, suche])

  // Für die zentrale Ansicht: OneDrive-Wurzel statt Mandantenordner

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Kopf */}
      <div style={{ padding: '14px 20px 0', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <nav aria-label="Pfad" style={{ display: 'flex', gap: '7px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          <span>Spielbuch</span>
          <span style={{ opacity: 0.5 }}>›</span>
          <span style={{ color: FARBE, fontWeight: 700 }}>Dokumente</span>
        </nav>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {QUELLEN.map(q => {
            const ist = quelle === q.key
            return (
              <button
                key={q.key}
                onClick={() => setQuelle(q.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '7px',
                  padding: '9px 15px', border: 'none', background: 'transparent', cursor: 'pointer',
                  borderBottom: `2px solid ${ist ? FARBE : 'transparent'}`,
                  color: ist ? FARBE : 'var(--text-muted)',
                  fontWeight: ist ? 700 : 500, fontSize: '13px',
                  transition: 'color 0.16s, border-color 0.16s',
                }}
              >
                <span aria-hidden="true">{q.icon}</span>{q.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── OneDrive: Ordnerbaum links, Inhalt rechts (Explorer-Prinzip) ── */}
      {quelle === 'onedrive' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* Ordnerstruktur */}
          <div style={{
            width: '290px', flexShrink: 0, borderRight: '1px solid var(--border)',
            background: 'var(--surface)', display: 'flex', flexDirection: 'column', minHeight: 0,
          }}>
            <div style={{ padding: '11px 12px 0', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Ordnerstruktur
            </div>
            <OneDriveOrdnerbaum
              tokens={onedriveTokens}
              onUpdateTokens={onUpdateOnedriveTokens}
              ausgewaehlt={ordner}
              onAuswahl={pfad => setOrdner(pfad)}
              markierte={markierte}
              onMarkierung={toggleMarkierung}
            />
          </div>

          {/* Inhalt des gewählten Ordners */}
          <div style={{ flex: 1, overflowY: 'auto', minWidth: 0, minHeight: 0, padding: '16px 18px 40px' }}>
            {/* Brotkrumen des aktuellen Ordners */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
              marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)',
            }}>
              <button
                onClick={() => setOrdner('')}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: ordner === '' ? FARBE : 'var(--text-muted)', fontWeight: 700, fontSize: '12px' }}
              >☁️ OneDrive</button>
              {ordner.split('/').filter(Boolean).map((teil, i, alle) => {
                const zielPfad = alle.slice(0, i + 1).join('/')
                const letzter = i === alle.length - 1
                return (
                  <span key={zielPfad} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ opacity: 0.5 }}>›</span>
                    <button
                      onClick={() => setOrdner(zielPfad)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: letzter ? FARBE : 'var(--text-muted)', fontWeight: letzter ? 700 : 500, fontSize: '12px' }}
                    >{teil}</button>
                  </span>
                )
              })}
              {markierte.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: '11.5px', color: FARBE, fontWeight: 700 }}>
                  {markierte.length} Ordner für KI markiert
                </span>
              )}
            </div>

            {/* Bestehender Datei-Browser, Wurzel = gewählter Ordner */}
            <OneDriveSection
              key={ordner || '__stamm__'}
              client={{ id: '__zentral__', name: 'OneDrive' }}
              tokens={onedriveTokens}
              onUpdateTokens={onUpdateOnedriveTokens}
              onSendAsAttachment={onSendAsAttachment}
              onUpdate={() => {}}
              rootOverride={{
                pathParts: ordner.split('/').filter(Boolean),
                folderPath: ordner,
                folderName: ordner.split('/').filter(Boolean).slice(-1)[0] || 'OneDrive',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Nach Mandant ── */}
      {quelle === 'mandant' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '22px 24px 48px' }}>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '620px' }}>
            Die Dokumentenzuordnung je Mandant bleibt vollständig erhalten. Wähle
            einen Mandanten, um direkt in dessen Dokumentenablage zu springen.
          </p>

          <input
            value={suche}
            onChange={e => setSuche(e.target.value)}
            placeholder="🔍 Mandant suchen …"
            style={{
              width: '100%', maxWidth: '420px', padding: '10px 14px', marginBottom: '18px',
              borderRadius: '9px', border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', outline: 'none',
            }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
            {mandanten.map(c => (
              <button
                key={c.id}
                onClick={() => onOeffneMandant?.(c.id, 6)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left',
                  padding: '15px 16px', borderRadius: '11px', cursor: 'pointer',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  transition: 'border-color 0.15s, transform 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = FARBE + '55'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}
              >
                <span style={{
                  width: '38px', height: '38px', flexShrink: 0, borderRadius: '9px',
                  background: FARBE + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px',
                }} aria-hidden="true">📁</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: '13.5px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name || '(ohne Namen)'}
                  </span>
                  <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {c.onedrivePfad ? 'Individueller Pfad' : 'Standard-Ablage'}
                  </span>
                </span>
              </button>
            ))}
            {mandanten.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Keine Treffer.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── KI-Werkzeuge (vorbereitet) ── */}
      {quelle === 'ki' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '24px 26px 56px' }}>
          {/* Aktives Werkzeug: Post-Service Einlesen & Erkennen (Stufe 2) */}
          <PostServiceEinlesen
            clients={clients}
            tokens={onedriveTokens}
            onUpdateTokens={onUpdateOnedriveTokens}
          />

          <div style={{ maxWidth: '900px', marginTop: '34px' }}>
            <div style={{
              padding: '16px 18px', marginBottom: '22px', borderRadius: '11px',
              background: 'var(--surface)', border: `1px dashed ${FARBE}55`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '7px' }}>
                <span style={{ fontSize: '17px' }} aria-hidden="true">🤖</span>
                <strong style={{ fontSize: '14px', color: 'var(--text)' }}>Weitere geplante KI-Unterstützung</strong>
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: FARBE + '18', color: FARBE }}>
                  vorbereitet
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.7, color: 'var(--text-muted)' }}>
                Alle Werkzeuge arbeiten nach demselben Grundsatz:
                <strong style={{ color: 'var(--text)' }}> Die KI schlägt vor, du entscheidest.</strong>{' '}
                Nichts wird automatisch umbenannt, verschoben oder gelöscht.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '13px' }}>
              {KI_WERKZEUGE.map(w => (
                <div key={w.key} style={{
                  padding: '17px 18px', borderRadius: '11px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '17px' }} aria-hidden="true">{w.icon}</span>
                    <strong style={{ fontSize: '13.5px', color: 'var(--text)' }}>{w.titel}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.65, color: 'var(--text-muted)' }}>{w.text}</p>
                  {w.beispiel && (
                    <code style={{
                      display: 'block', marginTop: '9px', padding: '7px 9px', borderRadius: '7px',
                      background: 'var(--surface2)', fontSize: '11px', color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)', wordBreak: 'break-all',
                    }}>{w.beispiel}</code>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
