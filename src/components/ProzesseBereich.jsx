import { useState, useMemo } from 'react'
import { AUFTRAGS_TYP_CFG } from './detail/AuftraegeTab.jsx'

/**
 * Bereich „Prozesse" – Wissens- und Prozesszentrale der Kanzlei.
 *
 * Phase 1: Struktur, Darstellung und Anbindung des VORHANDENEN Bestands.
 * Die bereits gepflegten Checklisten-Typen (`checklistenTypen`) sind der Kern
 * der Prozessbibliothek und werden hier rein lesend eingebunden – gepflegt
 * werden sie weiterhin über den bestehenden Checklisten-Editor.
 *
 * Vorbereitet für: Bausteine je Prozess, Versionierung mit Änderungsverlauf,
 * Übernahme-Regeln für laufende Aufträge und KI-gestützte Änderungsvorschläge.
 * Grundsatz durchgängig: Die KI schlägt vor, der Mensch entscheidet.
 */

const FARBE = '#0f766e' // Farbwelt des Bereichs „Prozesse"

const ANSICHTEN = [
  { key: 'bibliothek', label: 'Prozessbibliothek', icon: '📚' },
  { key: 'bausteine',  label: 'Bausteine',         icon: '🧩' },
  { key: 'ki',         label: 'KI-Beobachtung',    icon: '🛰' },
  { key: 'freigaben',  label: 'Freigaben',         icon: '✅' },
]

/**
 * Leistungen der Kanzlei. Der Schlüssel entspricht dem Auftragstyp, damit ein
 * Auftrag später automatisch auf „seinen" Standardprozess verweisen kann.
 */
export const LEISTUNGEN = [
  { key: 'jahresabschluss', name: 'Jahresabschluss',       kategorie: 'Abschluss',   icon: '📁' },
  { key: 'est',             name: 'Einkommensteuer',       kategorie: 'Erklärungen', icon: '🧑‍💼' },
  { key: 'fibu',            name: 'Finanzbuchhaltung',     kategorie: 'Laufend',     icon: '📒' },
  { key: 'lohn',            name: 'Lohnbuchhaltung',       kategorie: 'Laufend',     icon: '💼' },
  { key: 'ust',             name: 'Umsatzsteuer',          kategorie: 'Erklärungen', icon: '🧾' },
  { key: 'beratung',        name: 'Beratung',              kategorie: 'Beratung',    icon: '🧠' },
  { key: 'gruendung',       name: 'Gründung',              kategorie: 'Etablering',  icon: '🏢' },
  { key: 'erfassung',       name: 'Deutschlandeintritt',   kategorie: 'Etablering',  icon: '🇩🇪' },
]

/** Bausteine, aus denen ein Prozess bestehen kann. */
export const BAUSTEIN_ARTEN = [
  { key: 'checklisten',  label: 'Checklisten',         icon: '☑️', beschreibung: 'Prüfpunkte, die Schritt für Schritt abgearbeitet werden.' },
  { key: 'aufgaben',     label: 'Aufgaben',            icon: '📋', beschreibung: 'Arbeitsschritte, die als Auftrag entstehen.' },
  { key: 'unterlagen',   label: 'Benötigte Unterlagen',icon: '📥', beschreibung: 'Was vom Mandanten angefordert werden muss.' },
  { key: 'rueckfragen',  label: 'Rückfragen',          icon: '❓', beschreibung: 'Standard-Rückfragen zum Thema.' },
  { key: 'pruefschritte',label: 'Prüfschritte',        icon: '🔍', beschreibung: 'Qualitätskontrolle und Abschlussprüfung.' },
  { key: 'fristen',      label: 'Fristen',             icon: '⏰', beschreibung: 'Termine und gesetzliche Abgabefristen.' },
  { key: 'dokumente',    label: 'Dokumentenvorlagen',  icon: '📄', beschreibung: 'Vorlagen, die zum Prozess gehören.' },
  { key: 'emails',       label: 'E-Mail-Vorlagen',     icon: '✉️', beschreibung: 'Textbausteine für die Mandantenkommunikation.' },
  { key: 'hinweise',     label: 'Hinweise',            icon: '💡', beschreibung: 'Fachliche Hinweise und Besonderheiten.' },
  { key: 'arbeitshilfen',label: 'Arbeitshilfen & Links', icon: '🔗', beschreibung: 'Rechner, Tabellen, externe Quellen.' },
]

/** Quellen, die eine KI später beobachten soll. */
const KI_QUELLEN = [
  { icon: '⚖️', titel: 'Gesetzesänderungen',      text: 'Steueränderungsgesetze, Jahressteuergesetz, geänderte Paragrafen.' },
  { icon: '🏛', titel: 'BMF-Schreiben',            text: 'Verwaltungsanweisungen und Anwendungserlasse.' },
  { icon: '📜', titel: 'Rechtsprechung',           text: 'BFH-Urteile und Entscheidungen der Finanzgerichte.' },
  { icon: '🖥', titel: 'Fachanwendungen',          text: 'Änderungen in DATEV, Agenda und anderen Programmen.' },
]

/** Regeln, wie eine Prozessänderung auf Aufträge wirkt. */
export const UEBERNAHME_REGELN = [
  { key: 'neue',        label: 'Nur für neue Aufträge',      icon: '🆕', text: 'Laufende Aufträge bleiben unverändert auf ihrer Version.' },
  { key: 'bestaetigen', label: 'Nur nach Bestätigung',       icon: '✋', text: 'Je Auftrag wird gefragt, ob die Änderung übernommen wird.', empfohlen: true },
  { key: 'alle',        label: 'Auch in laufende Aufträge',  icon: '🔄', text: 'Die Änderung wirkt sofort auf alle offenen Aufträge.' },
]

export default function ProzesseBereich({
  clients = [],
  checklistenTypen = [],
  onOeffneChecklistenEditor,
}) {
  const [ansicht, setAnsicht]   = useState('bibliothek')
  const [gewaehlt, setGewaehlt] = useState(null)
  const [suche, setSuche]       = useState('')

  // Wie oft wird eine Leistung tatsächlich genutzt? (rein lesend)
  const nutzung = useMemo(() => {
    const zaehler = {}
    clients.filter(c => !c.archiviert).forEach(c => {
      ;(c.auftraege ?? []).forEach(a => {
        if (!a.typ) return
        zaehler[a.typ] = (zaehler[a.typ] ?? 0) + 1
      })
    })
    return zaehler
  }, [clients])

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase()
    if (!q) return LEISTUNGEN
    return LEISTUNGEN.filter(l => l.name.toLowerCase().includes(q) || l.kategorie.toLowerCase().includes(q))
  }, [suche])

  const kategorien = useMemo(() => {
    const map = new Map()
    gefiltert.forEach(l => {
      if (!map.has(l.kategorie)) map.set(l.kategorie, [])
      map.get(l.kategorie).push(l)
    })
    return [...map.entries()]
  }, [gefiltert])

  const prozess = LEISTUNGEN.find(l => l.key === gewaehlt) ?? null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Kopf */}
      <div style={{ padding: '14px 20px 0', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <nav aria-label="Pfad" style={{ display: 'flex', gap: '7px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          <span>Spielbuch</span><span style={{ opacity: 0.5 }}>›</span>
          <span style={{ color: FARBE, fontWeight: 700 }}>Prozesse</span>
          {prozess && ansicht === 'bibliothek' && (
            <>
              <span style={{ opacity: 0.5 }}>›</span>
              <span style={{ color: 'var(--text)' }}>{prozess.name}</span>
            </>
          )}
        </nav>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {ANSICHTEN.map(a => {
            const ist = ansicht === a.key
            return (
              <button key={a.key} onClick={() => { setAnsicht(a.key); setGewaehlt(null) }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '7px',
                  padding: '9px 15px', border: 'none', background: 'transparent', cursor: 'pointer',
                  borderBottom: `2px solid ${ist ? FARBE : 'transparent'}`,
                  color: ist ? FARBE : 'var(--text-muted)',
                  fontWeight: ist ? 700 : 500, fontSize: '13px',
                  transition: 'color 0.16s, border-color 0.16s',
                }}>
                <span aria-hidden="true">{a.icon}</span>{a.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Prozessbibliothek ── */}
      {ansicht === 'bibliothek' && !prozess && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '24px 26px 56px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
              Prozessbibliothek
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '660px' }}>
              Jede Leistung wird hier <strong style={{ color: 'var(--text)' }}>einmal</strong> definiert.
              Aufträge bei Mandanten verweisen künftig auf diesen zentralen Prozess,
              statt ihn jedes Mal neu aufzubauen.
            </p>

            <input
              value={suche}
              onChange={e => setSuche(e.target.value)}
              placeholder="🔍 Prozess oder Kategorie suchen …"
              style={{
                width: '100%', maxWidth: '420px', padding: '10px 14px', marginBottom: '22px',
                borderRadius: '9px', border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', outline: 'none',
              }}
            />

            {kategorien.map(([kat, items]) => (
              <div key={kat} style={{ marginBottom: '26px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '11px' }}>
                  {kat}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '13px' }}>
                  {items.map(l => {
                    const anzahl = nutzung[l.key] ?? 0
                    return (
                      <div key={l.key}
                        onClick={() => setGewaehlt(l.key)}
                        style={{
                          padding: '17px 18px', borderRadius: '12px', cursor: 'pointer',
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          transition: 'border-color 0.15s, transform 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = FARBE + '66'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '10px' }}>
                          <span style={{
                            width: '36px', height: '36px', flexShrink: 0, borderRadius: '9px',
                            background: FARBE + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px',
                          }} aria-hidden="true">{l.icon}</span>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>{l.name}</span>
                            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                              Version 1.0 · Entwurf
                            </span>
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '14px', paddingTop: '11px', borderTop: '1px solid var(--border)', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          <span>{anzahl > 0 ? `${anzahl} Auftr${anzahl === 1 ? 'ag' : 'äge'}` : 'noch nicht genutzt'}</span>
                          <span style={{ marginLeft: 'auto', color: FARBE, fontWeight: 700 }}>öffnen →</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Einzelner Prozess ── */}
      {ansicht === 'bibliothek' && prozess && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '22px 26px 56px' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <button onClick={() => setGewaehlt(null)}
              style={{ marginBottom: '16px', padding: '5px 12px', borderRadius: '7px', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-muted)', fontSize: '11.5px', fontWeight: 600 }}>
              ← Zur Bibliothek
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '13px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{
                width: '44px', height: '44px', borderRadius: '11px', flexShrink: 0,
                background: FARBE + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '21px',
              }} aria-hidden="true">{prozess.icon}</span>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>{prozess.name}</h2>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '10px', background: FARBE + '18', color: FARBE }}>
                Version 1.0
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {(nutzung[prozess.key] ?? 0)} Aufträge nutzen diese Leistung
              </span>
            </div>

            <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '640px' }}>
              Standardprozess für alle Aufträge dieser Leistung. Änderungen hier
              wirken über die Übernahme-Regel auf neue und laufende Aufträge.
            </p>

            {/* Bausteine des Prozesses */}
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>Bausteine</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '11px', marginBottom: '30px' }}>
              {BAUSTEIN_ARTEN.map(b => {
                // Checklisten sind real vorhanden – die übrigen Bausteine folgen
                const echt = b.key === 'checklisten'
                const anzahl = echt ? checklistenTypen.length : 0
                return (
                  <div key={b.key} style={{
                    padding: '14px 15px', borderRadius: '10px',
                    background: 'var(--surface)',
                    border: `1px ${echt ? 'solid' : 'dashed'} var(--border)`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '15px' }} aria-hidden="true">{b.icon}</span>
                      <strong style={{ fontSize: '13px', color: 'var(--text)' }}>{b.label}</strong>
                      {echt
                        ? <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: FARBE }}>{anzahl}</span>
                        : <span style={{ marginLeft: 'auto', fontSize: '9.5px', color: 'var(--text-muted)' }}>bald</span>}
                    </div>
                    <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.55, color: 'var(--text-muted)' }}>{b.beschreibung}</p>
                  </div>
                )
              })}
            </div>

            {/* Übernahme-Regel */}
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
              Wenn dieser Prozess geändert wird
            </h3>
            <p style={{ margin: '0 0 13px', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '620px' }}>
              Diese Regel entscheidet, was mit bereits laufenden Aufträgen geschieht.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '11px', marginBottom: '30px' }}>
              {UEBERNAHME_REGELN.map(r => (
                <div key={r.key} style={{
                  padding: '14px 15px', borderRadius: '10px',
                  background: r.empfohlen ? FARBE + '0d' : 'var(--surface)',
                  border: `1px ${r.empfohlen ? 'solid' : 'dashed'} ${r.empfohlen ? FARBE + '44' : 'var(--border)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                    <span aria-hidden="true">{r.icon}</span>
                    <strong style={{ fontSize: '12.5px', color: 'var(--text)' }}>{r.label}</strong>
                    {r.empfohlen && (
                      <span style={{ marginLeft: 'auto', fontSize: '9.5px', fontWeight: 700, padding: '1px 7px', borderRadius: '9px', background: FARBE + '20', color: FARBE }}>
                        empfohlen
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.55, color: 'var(--text-muted)' }}>{r.text}</p>
                </div>
              ))}
            </div>

            {/* Versionen */}
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>Versionen &amp; Änderungsverlauf</h3>
            <div style={{ padding: '16px 18px', borderRadius: '11px', background: 'var(--surface)', border: '1px dashed var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '9px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '10px', background: FARBE + '18', color: FARBE }}>1.0</span>
                <span style={{ fontSize: '12.5px', color: 'var(--text)' }}>Ausgangsstand</span>
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>aktuell</span>
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Jede Änderung erzeugt künftig eine neue Version mit Datum, Anlass
                und Änderungstext. So bleibt nachvollziehbar, nach welchem Stand
                ein Auftrag bearbeitet wurde.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Bausteine (zentraler Bestand) ── */}
      {ansicht === 'bausteine' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '24px 26px 56px' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>Bausteine</h2>
            <p style={{ margin: '0 0 22px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '640px' }}>
              Bausteine werden zentral gepflegt und in beliebig vielen Prozessen
              wiederverwendet. Vorhanden sind bereits deine Checklisten.
            </p>

            <div style={{ padding: '18px 20px', borderRadius: '12px', background: 'var(--surface)', border: `1px solid ${FARBE}44`, marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '18px' }} aria-hidden="true">☑️</span>
                <strong style={{ fontSize: '14.5px', color: 'var(--text)' }}>Checklisten</strong>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: FARBE + '18', color: FARBE }}>
                  {checklistenTypen.length} vorhanden
                </span>
                {onOeffneChecklistenEditor && (
                  <button onClick={onOeffneChecklistenEditor}
                    style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: FARBE, color: '#fff', fontSize: '12.5px', fontWeight: 700 }}>
                    Checklisten bearbeiten
                  </button>
                )}
              </div>
              {checklistenTypen.length === 0 ? (
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Noch keine Checklisten angelegt.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {checklistenTypen.map(t => {
                    const punkte = (t.items ?? []).filter(i => i.type !== 'section').length
                    const abschnitte = (t.items ?? []).filter(i => i.type === 'section').length
                    return (
                      <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', gap: '11px',
                        padding: '10px 12px', borderRadius: '8px', background: 'var(--surface2)',
                      }}>
                        <span aria-hidden="true">📋</span>
                        <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{t.name || '(ohne Namen)'}</span>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {abschnitte > 0 && `${abschnitte} Abschnitte · `}{punkte} Prüfpunkte
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '11px' }}>
              {BAUSTEIN_ARTEN.filter(b => b.key !== 'checklisten').map(b => (
                <div key={b.key} style={{
                  padding: '14px 15px', borderRadius: '10px',
                  background: 'var(--surface)', border: '1px dashed var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '15px' }} aria-hidden="true">{b.icon}</span>
                    <strong style={{ fontSize: '13px', color: 'var(--text)' }}>{b.label}</strong>
                    <span style={{ marginLeft: 'auto', fontSize: '9.5px', color: 'var(--text-muted)' }}>bald</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.55, color: 'var(--text-muted)' }}>{b.beschreibung}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── KI-Beobachtung ── */}
      {ansicht === 'ki' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '24px 26px 56px' }}>
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>KI-Beobachtung</h2>
            <p style={{ margin: '0 0 22px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '640px' }}>
              Fachliche Entwicklungen sollen künftig laufend beobachtet und auf
              ihre Auswirkung auf deine Prozesse geprüft werden.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px', marginBottom: '26px' }}>
              {KI_QUELLEN.map(q => (
                <div key={q.titel} style={{ padding: '15px 16px', borderRadius: '11px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '16px' }} aria-hidden="true">{q.icon}</span>
                    <strong style={{ fontSize: '13px', color: 'var(--text)' }}>{q.titel}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.6, color: 'var(--text-muted)' }}>{q.text}</p>
                </div>
              ))}
            </div>

            {/* Ablauf */}
            <div style={{ padding: '20px 22px', borderRadius: '12px', background: 'var(--surface)', border: `1px dashed ${FARBE}55` }}>
              <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text)', marginBottom: '14px' }}>
                So läuft es ab
              </strong>
              {[
                ['1', 'Beobachten',  'Die KI verfolgt Änderungen aus den obigen Quellen.'],
                ['2', 'Bewerten',    'Sie prüft, welche deiner Prozesse betroffen sein könnten.'],
                ['3', 'Vorschlagen', 'Sie formuliert eine konkrete Änderung – z. B. „nach Schritt 14 diesen Prüfschritt ergänzen".'],
                ['4', 'Entscheiden', 'Du prüfst den Vorschlag und gibst ihn frei oder verwirfst ihn.'],
                ['5', 'Ausrollen',   'Erst nach Freigabe wird der Prozess geändert – mit deiner Übernahme-Regel.'],
              ].map(([nr, titel, text], i, alle) => (
                <div key={nr} style={{ display: 'flex', gap: '13px', paddingBottom: i === alle.length - 1 ? 0 : '14px' }}>
                  <span style={{
                    width: '24px', height: '24px', flexShrink: 0, borderRadius: '50%',
                    background: FARBE + '18', color: FARBE, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 800,
                  }}>{nr}</span>
                  <span>
                    <strong style={{ display: 'block', fontSize: '12.5px', color: 'var(--text)', marginBottom: '2px' }}>{titel}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>{text}</span>
                  </span>
                </div>
              ))}
              <p style={{ margin: '16px 0 0', paddingTop: '14px', borderTop: '1px solid var(--border)', fontSize: '12.5px', color: 'var(--text)', lineHeight: 1.7 }}>
                <strong>Die KI ändert nie selbst einen Prozess.</strong> Sie bereitet vor –
                die Entscheidung bleibt bei dir.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Freigaben ── */}
      {ansicht === 'freigaben' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '24px 26px 56px' }}>
          <div style={{ maxWidth: '820px', margin: '0 auto' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>Freigaben</h2>
            <p style={{ margin: '0 0 22px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '640px' }}>
              Hier sammeln sich Änderungsvorschläge, die auf deine Entscheidung warten.
            </p>
            <div style={{ padding: '48px 24px', borderRadius: '12px', background: 'var(--surface)', border: '1px dashed var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }} aria-hidden="true">✅</div>
              <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text)', marginBottom: '7px' }}>
                Keine offenen Vorschläge
              </strong>
              <p style={{ margin: '0 auto', maxWidth: '420px', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                Sobald die KI-Beobachtung aktiv ist, erscheinen Änderungsvorschläge
                an dieser Stelle – jeweils mit Anlass, betroffenem Prozess und der
                Wahl, ob die Änderung nur für neue oder auch für laufende Aufträge gilt.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
