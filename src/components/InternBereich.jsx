import { useState } from 'react'

/**
 * Bereich „Intern" – Innovations- und Agentenzentrale.
 *
 * Bewusst NICHT mandantenbezogen: hier entstehen Ideen, Konzepte und Agenten,
 * bevor sie – ausgereift – in Prozesse, Homepages oder Produkte übernommen werden.
 *
 * Phase 1: Struktur und Erweiterbarkeit. Rein lesend/darstellend – es werden
 * keine Agenten ausgeführt, keine Daten geschrieben, nichts verändert.
 *
 * Leitprinzip für alle Agenten: Sie beobachten und schlagen vor.
 * Ausführen und Entscheiden bleibt beim Menschen.
 */

const FARBE = '#64748b' // Farbwelt des Bereichs „Intern"
const AKZENT = '#0891b2' // Akzent für aktive Elemente

const BEREICHE = [
  { key: 'agenten',      label: 'Agentenzentrale',  icon: '🤖' },
  { key: 'ideen',        label: 'Ideenlabor',       icon: '💡' },
  { key: 'konzepte',     label: 'Konzeptwerkstatt', icon: '🧱' },
  { key: 'recherche',    label: 'Recherche',        icon: '🔭' },
  { key: 'wissen',       label: 'Wissensbasis',     icon: '📚' },
  { key: 'experimente',  label: 'Experimente',      icon: '🧪' },
  { key: 'optimierung',  label: 'Optimierung',      icon: '📈' },
]

// ── Agenten-Katalog (geplant – noch keiner aktiv) ────────────────────────────
export const AGENTEN_KATEGORIEN = [
  {
    key: 'qualitaet', label: 'Qualität & Compliance', icon: '🛡', farbe: '#dc2626',
    hinweis: 'Prüfen die eigenen Systeme. Melden Auffälligkeiten – ändern nie selbst.',
    agenten: [
      { name: 'DSGVO-Prüfung',        aufgabe: 'Prüft Datenflüsse, Speicherorte und Löschfristen auf Datenschutzkonformität.' },
      { name: 'Rechtskonformität',    aufgabe: 'Gleicht Vorlagen und Abläufe mit berufsrechtlichen Anforderungen ab.' },
      { name: 'Prozessqualität',      aufgabe: 'Findet Lücken und Widersprüche in den Standardprozessen.' },
      { name: 'Dokumentationsqualität', aufgabe: 'Prüft, ob Arbeitsschritte nachvollziehbar dokumentiert sind.' },
      { name: 'Sicherheitsprüfung',   aufgabe: 'Achtet auf Zugänge, Berechtigungen und offene Schnittstellen.' },
    ],
  },
  {
    key: 'recherche', label: 'Recherche', icon: '🔭', farbe: '#2563eb',
    hinweis: 'Beobachten externe Quellen nach Zeitplan und fassen Ergebnisse zusammen.',
    agenten: [
      { name: 'Steuerrecht',      aufgabe: 'Gesetzesänderungen, BMF-Schreiben, BFH-Rechtsprechung.' },
      { name: 'KI-Entwicklungen', aufgabe: 'Neue Modelle, Claude, ChatGPT, MCP- und Agenten-Systeme.' },
      { name: 'Fachanwendungen',  aufgabe: 'Änderungen in DATEV, Agenda und Microsoft-Diensten.' },
      { name: 'Digitalisierung',  aufgabe: 'Automatisierung und Werkzeuge für Kanzleien.' },
    ],
  },
  {
    key: 'optimierung', label: 'Optimierung', icon: '📈', farbe: '#16a34a',
    hinweis: 'Suchen nach Verbesserungspotenzial in der eigenen Arbeitsweise.',
    agenten: [
      { name: 'Prozess-Optimierer', aufgabe: 'Erkennt wiederkehrende Handgriffe, die sich automatisieren ließen.' },
      { name: 'Zeitfresser-Analyse', aufgabe: 'Wertet aus, wo überdurchschnittlich viel Zeit gebunden wird.' },
    ],
  },
  {
    key: 'kreativ', label: 'Kreativ', icon: '✨', farbe: '#7c3aed',
    hinweis: 'Unterstützen beim Entwickeln neuer Formate und Inhalte.',
    agenten: [
      { name: 'Ideengeber',       aufgabe: 'Entwickelt Vorschläge für Dienstleistungen und Veranstaltungsformate.' },
      { name: 'Text & Konzept',   aufgabe: 'Erstellt Entwürfe für Homepage-Inhalte und Workshop-Konzepte.' },
    ],
  },
]

/** Pflichtangaben, ohne die kein Agent betrieben werden sollte. */
export const AGENT_STECKBRIEF = [
  { key: 'verantwortlich', label: 'Verantwortlich',   icon: '👤', text: 'Wer trägt die Verantwortung für diesen Agenten?' },
  { key: 'quellen',        label: 'Datenquellen',     icon: '🔌', text: 'Auf welche Daten und Systeme greift er zu?' },
  { key: 'berechtigungen', label: 'Berechtigungen',   icon: '🔑', text: 'Nur lesen – oder auch schreiben? Möglichst eng fassen.' },
  { key: 'aktionen',       label: 'Erlaubte Aktionen',icon: '⚙️', text: 'Was darf er tun? Was ausdrücklich nicht?' },
  { key: 'intervall',      label: 'Zeitplan',         icon: '⏱', text: 'Wie oft läuft er? Wann zuletzt, wann als Nächstes?' },
  { key: 'freigabe',       label: 'Freigabepflicht',  icon: '✋', text: 'Welche Ergebnisse brauchen eine Bestätigung?' },
  { key: 'protokoll',      label: 'Protokoll',        icon: '📜', text: 'Jeder Lauf und jede Änderung wird festgehalten.' },
]

/** Der Weg einer Idee bis in den produktiven Betrieb. */
const REIFEGRADE = [
  { key: 'einfall',  label: 'Einfall',      icon: '💡', text: 'Spontaner Gedanke, unsortiert festgehalten.' },
  { key: 'konzept',  label: 'Konzept',      icon: '🧱', text: 'Ausgearbeitet: Ziel, Nutzen, Aufwand.' },
  { key: 'test',     label: 'Experiment',   icon: '🧪', text: 'Im Kleinen ausprobiert, bevor es groß wird.' },
  { key: 'uebernahme', label: 'Übernahme',  icon: '🚀', text: 'Wandert in Prozesse, Homepages oder Produkte.' },
]

const IDEEN_KATEGORIEN = ['Geschäftsmodell', 'Dienstleistung', 'Produkt', 'Automatisierung', 'Veranstaltung', 'Marketing', 'Vision']
const KONZEPT_ARTEN = ['Homepage-Idee', 'Neue Dienstleistung', 'Workshop-Konzept', 'Veranstaltungsformat', 'Marketingidee', 'Automatisierung', 'KI-Strategie']
const EXPERIMENT_ARTEN = ['Testagent', 'Neuer Prompt', 'Workflow', 'Automatisierung', 'MCP-Anbindung', 'Integration']

export default function InternBereich() {
  const [bereich, setBereich] = useState('agenten')
  const [kategorie, setKategorie] = useState(null)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Kopf */}
      <div style={{ padding: '14px 20px 0', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <nav aria-label="Pfad" style={{ display: 'flex', gap: '7px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          <span>Spielbuch</span><span style={{ opacity: 0.5 }}>›</span>
          <span style={{ color: FARBE, fontWeight: 700 }}>Intern</span>
        </nav>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {BEREICHE.map(b => {
            const ist = bereich === b.key
            return (
              <button key={b.key} onClick={() => { setBereich(b.key); setKategorie(null) }}
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

          {/* ── Agentenzentrale ── */}
          {bereich === 'agenten' && (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                Agentenzentrale
              </h2>
              <p style={{ margin: '0 0 22px', fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '660px' }}>
                Kontrollzentrum für alle KI-Agenten: anlegen, konfigurieren, überwachen
                und Ergebnisse prüfen.
              </p>

              {/* Grundsatz – bewusst prominent */}
              <div style={{
                padding: '17px 19px', borderRadius: '12px', marginBottom: '24px',
                background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.28)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '7px' }}>
                  <span style={{ fontSize: '17px' }} aria-hidden="true">🛡</span>
                  <strong style={{ fontSize: '14px', color: 'var(--text)' }}>Grundsatz</strong>
                </div>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.7, color: 'var(--text-muted)' }}>
                  Agenten <strong style={{ color: 'var(--text)' }}>beobachten und schlagen vor</strong>.
                  Sie ändern keine Prozesse, versenden nichts und löschen nichts.
                  Jede Auswirkung auf echte Daten braucht deine ausdrückliche Freigabe.
                  Kein Agent geht ohne vollständigen Steckbrief in Betrieb.
                </p>
              </div>

              {/* Status */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                padding: '14px 17px', borderRadius: '11px', marginBottom: '26px',
                background: 'var(--surface)', border: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: '17px' }} aria-hidden="true">⚪</span>
                <span style={{ fontSize: '13px', color: 'var(--text)' }}>
                  <strong>Noch kein Agent aktiv.</strong>{' '}
                  <span style={{ color: 'var(--text-muted)' }}>
                    Unten steht der geplante Bestand – noch läuft nichts.
                  </span>
                </span>
              </div>

              {/* Steckbrief */}
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
                Steckbrief je Agent
              </h3>
              <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '640px' }}>
                Diese Angaben sind verpflichtend – sie machen nachvollziehbar, was ein
                Agent darf und wer dafür geradesteht.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '11px', marginBottom: '30px' }}>
                {AGENT_STECKBRIEF.map(f => (
                  <div key={f.key} style={{
                    padding: '13px 15px', borderRadius: '10px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                      <span aria-hidden="true">{f.icon}</span>
                      <strong style={{ fontSize: '12.5px', color: 'var(--text)' }}>{f.label}</strong>
                    </div>
                    <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.55, color: 'var(--text-muted)' }}>{f.text}</p>
                  </div>
                ))}
              </div>

              {/* Geplanter Bestand */}
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: '0 0 14px' }}>
                Geplanter Bestand
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {AGENTEN_KATEGORIEN.map(k => (
                  <div key={k.key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                      padding: '13px 16px', borderBottom: '1px solid var(--border)',
                      background: k.farbe + '0a',
                    }}>
                      <span style={{ fontSize: '16px' }} aria-hidden="true">{k.icon}</span>
                      <strong style={{ fontSize: '13.5px', color: 'var(--text)' }}>{k.label}</strong>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: k.farbe + '18', color: k.farbe }}>
                        {k.agenten.length} geplant
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', flex: 1, minWidth: '200px' }}>{k.hinweis}</span>
                    </div>
                    {k.agenten.map((a, i) => (
                      <div key={a.name} style={{
                        display: 'flex', alignItems: 'flex-start', gap: '12px',
                        padding: '12px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                      }}>
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '5px',
                          background: 'var(--border)', border: '1px solid var(--text-muted)',
                        }} title="noch nicht aktiv" />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{a.name}</span>
                          <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.5 }}>{a.aufgabe}</span>
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginTop: '3px' }}>geplant</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Ideenlabor ── */}
          {bereich === 'ideen' && (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>Ideenlabor</h2>
              <p style={{ margin: '0 0 24px', fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '660px' }}>
                Raum für spontane Gedanken. Nichts muss fertig sein, nichts muss
                sofort umgesetzt werden.
              </p>

              {/* Der Weg einer Idee */}
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '0 0 12px' }}>
                Vom Einfall zur Umsetzung
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '11px', marginBottom: '28px' }}>
                {REIFEGRADE.map((r, i) => (
                  <div key={r.key} style={{
                    padding: '15px 16px', borderRadius: '11px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    position: 'relative',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '16px' }} aria-hidden="true">{r.icon}</span>
                      <strong style={{ fontSize: '13px', color: 'var(--text)' }}>{r.label}</strong>
                      <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)' }}>{i + 1}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.55, color: 'var(--text-muted)' }}>{r.text}</p>
                  </div>
                ))}
              </div>

              <Vorbereitet
                titel="Ideen erfassen"
                text="Hier entsteht die Erfassung: Titel, freier Gedanke, Kategorie und Reifegrad – mit Suche und der Möglichkeit, eine Idee später in ein Konzept zu überführen."
                marken={IDEEN_KATEGORIEN}
              />
            </>
          )}

          {/* ── Konzeptwerkstatt ── */}
          {bereich === 'konzepte' && (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>Konzeptwerkstatt</h2>
              <p style={{ margin: '0 0 24px', fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '660px' }}>
                Für alles, was mehr als eine Notiz braucht: ausgearbeitete Konzepte
                mit Ziel, Nutzen und Aufwand.
              </p>
              <Vorbereitet
                titel="Konzepte entwickeln"
                text="Vorgesehen: Gliederung, Notizen, Anhänge, Verknüpfung zur Ursprungsidee und ein Status von Entwurf bis Umsetzungsreif."
                marken={KONZEPT_ARTEN}
              />
            </>
          )}

          {/* ── Recherche ── */}
          {bereich === 'recherche' && (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>Recherche</h2>
              <p style={{ margin: '0 0 24px', fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '660px' }}>
                Agenten, die nach Zeitplan Quellen beobachten und ihre Ergebnisse
                gebündelt bereitstellen.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                {AGENTEN_KATEGORIEN.find(k => k.key === 'recherche').agenten.map(a => (
                  <div key={a.name} style={{ padding: '15px 16px', borderRadius: '11px', background: 'var(--surface)', border: '1px dashed var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span aria-hidden="true">🔭</span>
                      <strong style={{ fontSize: '13px', color: 'var(--text)' }}>{a.name}</strong>
                      <span style={{ marginLeft: 'auto', fontSize: '9.5px', color: 'var(--text-muted)' }}>geplant</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.55, color: 'var(--text-muted)' }}>{a.aufgabe}</p>
                  </div>
                ))}
              </div>
              <Vorbereitet
                titel="Zeitplan und Ergebnisse"
                text="Je Agent: Intervall, letzter und nächster Lauf, beobachtete Quellen sowie die Ergebnisse als kurze Zusammenfassung mit Quellenangabe."
              />
            </>
          )}

          {/* ── Wissensbasis ── */}
          {bereich === 'wissen' && (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>Wissensbasis</h2>
              <p style={{ margin: '0 0 24px', fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '660px' }}>
                Alles, was recherchiert wurde – dauerhaft auffindbar statt in
                Notizen verstreut.
              </p>
              <Vorbereitet
                titel="Gesammeltes Wissen"
                text="Vorgesehen: Zusammenfassung, Quelle mit Datum, Bewertung der Relevanz, eigene Notizen und eine Volltextsuche über alles."
                marken={['Zusammenfassungen', 'Quellen', 'Empfehlungen', 'Bewertungen', 'Eigene Notizen']}
              />
            </>
          )}

          {/* ── Experimente ── */}
          {bereich === 'experimente' && (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>Experimente</h2>
              <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '660px' }}>
                Ausdrücklich zum Ausprobieren. Was hier läuft, darf unfertig sein
                und scheitern.
              </p>
              <div style={{
                padding: '15px 17px', borderRadius: '11px', marginBottom: '22px',
                background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.28)',
                fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.7,
              }}>
                <strong style={{ color: 'var(--text)' }}>Getrennt vom Echtbetrieb.</strong>{' '}
                Experimente arbeiten nicht auf Mandantendaten. Was sich bewährt,
                wandert bewusst und geprüft in den produktiven Bereich – nicht umgekehrt.
              </div>
              <Vorbereitet
                titel="Versuchsaufbau"
                text="Je Experiment: Ziel, Aufbau, Beobachtung und Ergebnis – am Ende die Entscheidung: verwerfen oder übernehmen."
                marken={EXPERIMENT_ARTEN}
              />
            </>
          )}

          {/* ── Optimierung ── */}
          {bereich === 'optimierung' && (
            <>
              <h2 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>Optimierung</h2>
              <p style={{ margin: '0 0 24px', fontSize: '13.5px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '660px' }}>
                Sammelstelle für Verbesserungsvorschläge – aus eigener Beobachtung
                oder von Agenten.
              </p>
              <div style={{ padding: '48px 24px', borderRadius: '12px', background: 'var(--surface)', border: '1px dashed var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }} aria-hidden="true">📈</div>
                <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text)', marginBottom: '7px' }}>
                  Keine offenen Vorschläge
                </strong>
                <p style={{ margin: '0 auto', maxWidth: '460px', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  Sobald Qualitäts- und Optimierungsagenten aktiv sind, sammeln sich
                  hier ihre Befunde – jeweils mit Anlass, betroffenem Bereich und
                  einem konkreten Vorschlag. Übernommen wird nur, was du freigibst.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Vorbereitet({ titel, text, marken }) {
  return (
    <div style={{ padding: '19px 21px', borderRadius: '12px', background: 'var(--surface)', border: `1px dashed ${AKZENT}55` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{titel}</strong>
        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: AKZENT + '18', color: AKZENT }}>
          vorbereitet
        </span>
      </div>
      <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.7, color: 'var(--text-muted)' }}>{text}</p>
      {marken && (
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginTop: '14px' }}>
          {marken.map(m => (
            <span key={m} style={{
              fontSize: '11.5px', padding: '5px 11px', borderRadius: '20px',
              background: 'var(--surface2)', color: 'var(--text-muted)', border: '1px solid var(--border)',
            }}>{m}</span>
          ))}
        </div>
      )}
    </div>
  )
}
