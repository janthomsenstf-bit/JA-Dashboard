import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import HauptNavigation from './src/components/HauptNavigation.jsx'
import BereichPlatzhalter from './src/components/BereichPlatzhalter.jsx'
import PersonenBereich from './src/components/PersonenBereich.jsx'
import KommunikationBereich from './src/components/KommunikationBereich.jsx'
import DokumenteBereich from './src/components/DokumenteBereich.jsx'
import HomepagesBereich from './src/components/HomepagesBereich.jsx'
import UebersichtenBereich from './src/components/UebersichtenBereich.jsx'
import ProzesseBereich from './src/components/ProzesseBereich.jsx'
import InternBereich from './src/components/InternBereich.jsx'

const DEMO_ONEDRIVE = {
  '': ['Mandanten', 'Etablering-Tyskland', 'Easy-B2B', 'Intern', 'Vorlagen'],
  'Mandanten': ['Nordisk Moebler ApS', 'Jysk Handel A/S', 'Baltic Logistik GmbH'],
  'Mandanten/Nordisk Moebler ApS': ['2026', '2025', 'Vertraege'],
  'Mandanten/Nordisk Moebler ApS/2026': ['Buchhaltung', 'Jahresabschluss', 'Lohn'],
  'Mandanten/Nordisk Moebler ApS/2026/Buchhaltung': [],
  'Mandanten/Jysk Handel A/S': ['2026'],
  'Etablering-Tyskland': ['Homepage', 'Bilder', 'Texte'],
  'Etablering-Tyskland/Homepage': [],
  'Easy-B2B': ['Suchanzeigen'],
  'Intern': ['Vorlagen', 'Buchhaltung'],
  'Vorlagen': [],
}

// fetch abfangen – nur fuer die Vorschau
const echtesFetch = window.fetch.bind(window)
window.fetch = async (url, opts) => {
  if (String(url).includes('/api/onedrive-api')) {
    const body = JSON.parse(opts?.body || '{}')
    if (body.action === 'listFolder') {
      const pfad = body.folderPath || ''
      const namen = DEMO_ONEDRIVE[pfad] || []
      const items = namen.map((n, i) => ({
        id: pfad + '/' + n + i, name: n, folder: { childCount: (DEMO_ONEDRIVE[pfad ? pfad + '/' + n : n] || []).length },
      }))
      if (pfad === 'Mandanten/Nordisk Moebler ApS/2026/Buchhaltung') {
        items.push(
          { id: 'f1', name: 'ER_2026-07-15_Musterfirma.pdf', size: 184320, file: { mimeType: 'application/pdf' }, lastModifiedDateTime: new Date().toISOString() },
          { id: 'f2', name: 'Kontoauszug_Juni.pdf', size: 92160, file: { mimeType: 'application/pdf' }, lastModifiedDateTime: new Date().toISOString() },
        )
      }
      return new Response(JSON.stringify({ success: true, items }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return echtesFetch(url, opts)
}

const TAB_NAV_DEMO = [
  { icon: "👤", short: "Mandant" },
  { icon: "📋", short: "Aufträge" },
  { icon: "📁", short: "Jahresabschluss" },
  { icon: "💼", short: "Lohn" },
  { icon: "🏠", short: "Immobilien" },
  { icon: "✉️", short: "Nachrichten" },
  { icon: "📂", short: "Dokumente" },
  { icon: "💰", short: "Honorare" },
  { icon: "🧠", short: "Beratung" },
  { icon: "📊", short: "Historie" },
]

const heute = new Date()
const vorTagen = n => new Date(heute.getTime() - n * 86400000).toISOString()

// Demo-Mandanten (keine echten Daten)
const DEMO_CHECKLISTEN = [
  { id: 'ct1', name: 'Jahresabschluss EUER', items: [
    { id: 's1', type: 'section', text: 'Vorbereitung' },
    { id: 'i1', type: 'item', text: 'Kontenabstimmung' },
    { id: 'i2', type: 'item', text: 'Abgrenzungen pruefen' },
    { id: 's2', type: 'section', text: 'Abschluss' },
    { id: 'i3', type: 'item', text: 'Anlagenverzeichnis' },
  ] },
  { id: 'ct2', name: 'Reisekosten', items: [
    { id: 'i4', type: 'item', text: 'Fahrtenbuch pruefen' },
    { id: 'i5', type: 'item', text: 'Verpflegungsmehraufwand' },
  ] },
  { id: 'ct3', name: 'Lohn – monatlich', items: [
    { id: 'i6', type: 'item', text: 'Stammdaten pruefen' },
    { id: 'i7', type: 'item', text: 'Meldungen uebermitteln' },
  ] },
]

const DEMO_TERMINE = [
  { id: 't1', datum: new Date(Date.now() + 1 * 86400000).toISOString().slice(0,10), uhrzeit: '10:00', titel: 'Erstgespraech Jysk Handel', mandantId: 'c2' },
  { id: 't2', datum: new Date(Date.now() + 4 * 86400000).toISOString().slice(0,10), uhrzeit: '14:30', titel: 'Jahresabschluss-Besprechung', mandantId: 'c1' },
]

const DEMO = [
  {
    id: 'c1', name: 'Nordisk Møbler ApS', mandantennummer: '10234', rechtsform: 'ApS',
    inBearbeitung: true, kontakte: [{ name: 'Mette Sørensen', rolle: 'Geschäftsführung' }, { name: 'Lars Holm', rolle: 'Buchhaltung' }],
    auftraege: [{ id: 'a1', status: 'offen', bezeichnung: 'Jahresabschluss 2025', frist: new Date(Date.now()+2*86400000).toISOString().slice(0,10), erstelltAm: vorTagen(2) }, { id: 'a2', status: 'offen', bezeichnung: 'USt-Voranmeldung', eilig: true, eiligBis: new Date(Date.now()-1*86400000).toISOString().slice(0,10), erstelltAm: vorTagen(9), honorar: { betrag: '1.200' } }],
    kommunikation: { events: [
      { id: 'e1', typ: 'eingehend', status: 'gesendet', betreff: 'Fehlende Belege Q2 - Rueckfrage', absender: 'mette@nordisk-mobler.dk', erstelltAm: vorTagen(0), text: 'Hej Jan,\n\nvi mangler stadig nogle bilag for Q2. Kan du sende en oversigt?\n\nVenlig hilsen\nMette' },
      { id: 'e1b', typ: 'ausgehend', status: 'gesendet', betreff: 'AW: Fehlende Belege Q2', empfaenger: 'mette@nordisk-mobler.dk', erstelltAm: vorTagen(3) },
      { id: 'e1c', typ: 'ausgehend', status: 'entwurf', betreff: 'Entwurf: Zusammenstellung Belege', empfaenger: 'mette@nordisk-mobler.dk', erstelltAm: vorTagen(1) },
    ] },
  },
  {
    id: 'c2', name: 'Jysk Handel A/S', mandantennummer: '10188', rechtsform: 'A/S',
    rueckfragen: [{ id: 'r1', erledigt: false, beantwortet: false }, { id: 'r2', erledigt: false, beantwortet: false }, { id: 'r3', erledigt: true }],
    kontakte: [{ name: 'Anders Kjær', rolle: 'Inhaber' }],
    auftraege: [{ id: 'a3', status: 'offen', bezeichnung: 'Lohnabrechnung Juli', frist: new Date().toISOString().slice(0,10), erstelltAm: vorTagen(20), honorar: { betrag: '450' } }],
    kommunikation: { events: [
      { id: 'e2', typ: 'eingehend', status: 'gesendet', betreff: 'Umsatzsteuer - kurze Rueckfrage', absender: 'anders@jyskhandel.dk', erstelltAm: vorTagen(1), text: 'Hallo Jan, kurze Frage zur USt-Registrierung in Deutschland.' },
    ] },
  },
  {
    id: 'c3', name: 'Baltic Logistik GmbH', mandantennummer: '10301', rechtsform: 'GmbH',
    faUebermittelt: true, kontakte: [{ name: 'Thomas Kruse', rolle: 'Prokurist' }],
    auftraege: [{ id: 'a4', status: 'erledigt', erledigtAm: vorTagen(5) }],
    kommunikation: { events: [
      { id: 'e3', typ: 'ausgehend', status: 'gesendet', betreff: 'Terminbestaetigung Donnerstag', empfaenger: 'kruse@baltic-log.de', erstelltAm: vorTagen(5) },
    ] },
  },
  {
    id: 'c4', name: 'Fjord Consulting IVS', mandantennummer: '10412', rechtsform: 'IVS',
    abschlussFertig: true, kontakte: [],
    auftraege: [], kommunikation: { events: [{ id: 'e4', erstelltAm: vorTagen(34) }] },
  },
  {
    id: 'c5', name: 'Kystens Fisk ApS', mandantennummer: '10095', rechtsform: 'ApS',
    kontakte: [{ name: 'Ida Poulsen', rolle: 'Verwaltung' }],
    auftraege: [{ id: 'a5', status: 'offen', erstelltAm: vorTagen(70) }],
    kommunikation: { events: [] },
  },
  {
    id: 'c6', name: 'Alt Byg A/S (alt)', mandantennummer: '09980', rechtsform: 'A/S',
    archiviert: true, kontakte: [{ name: 'Peter Dahl', rolle: '' }],
    auftraege: [], kommunikation: { events: [{ id: 'e6', erstelltAm: vorTagen(300) }] },
  },
]

function Platzhalter({ titel, icon }) {
  return (
    <div style={{ padding: "56px 24px", textAlign: "center" }}>
      <div style={{ fontSize: "34px", marginBottom: "16px" }}>{icon}</div>
      <h3 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", margin: "0 0 10px" }}>{titel}</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "13.5px", lineHeight: 1.7, maxWidth: "420px", margin: "0 auto" }}>
        Hier erscheint in der echten Anwendung die bestehende Ansicht – unveraendert.
      </p>
    </div>
  )
}

function Demo() {
  const [bereich, setBereich] = useState('personen')
  const [offen, setOffen] = useState(null)
  const [reiter, setReiter] = useState(0)

  const klient = DEMO.find(c => c.id === offen)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 16px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="var(--accent-dim)" />
          <path d="M7 8h14M7 14h10M7 20h12" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <h1 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text)' }}>Jan's Spielbuch</h1>
        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Spielbuch</span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          Vorschau · Demo-Daten
        </span>
      </header>

      <HauptNavigation aktiv={bereich} onWechsel={k => { setBereich(k); if (k === 'personen') setOffen(null) }} />

      {bereich === 'personen' && !klient && (
        <PersonenBereich clients={DEMO} onOpen={id => setOffen(id)} onNeu={() => alert('Öffnet in der echten App das Anlege-Fenster.')} />
      )}

      {bereich === 'personen' && klient && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap',
            padding: '9px 16px', fontSize: '12px', color: 'var(--text-muted)',
            background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          }}>
            <span>Spielbuch</span><span style={{ opacity: .5 }}>›</span>
            <button onClick={() => setOffen(null)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#0891b2', fontWeight: 700, fontSize: '12px' }}>Personen</button>
            <span style={{ opacity: .5 }}>›</span>
            <button onClick={() => setOffen(null)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px' }}>Mandantenübersicht</button>
            <span style={{ opacity: .5 }}>›</span>
            <span style={{ color: 'var(--text)', fontWeight: 700 }}>{klient.name}</span>
            <button onClick={() => setOffen(null)} style={{ marginLeft: 'auto', padding: '4px 11px', borderRadius: '7px', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-muted)', fontSize: '11.5px', fontWeight: 600 }}>← Zur Übersicht</button>
          </div>
          {/* Mandanten-Kopfzeile */}
          <div style={{ padding: '16px 22px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text)' }}>{klient.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
              {klient.mandantennummer} · {klient.rechtsform}
            </div>
          </div>

          {/* Body: Navigation links + Arbeitsbereich rechts */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
            <nav className="tab-nav-left" aria-label="Mandanten-Bereiche">
              <div className="tab-nav-heading">Mandant</div>
              {TAB_NAV_DEMO.map((tab, i) => (
                <button key={i} className={`tab-nav-btn${reiter === i ? ' active' : ''}`} onClick={() => setReiter(i)}>
                  <span className="tab-nav-icon">{tab.icon}</span>
                  <span className="tab-nav-label">{tab.short}</span>
                </button>
              ))}
            </nav>

            <div style={{ flex: 1, overflowY: 'auto', minWidth: 0, padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ maxWidth: '560px', margin: '0 auto' }}>
                <div style={{ fontSize: '34px', marginBottom: '18px' }}>{TAB_NAV_DEMO[reiter].icon}</div>
                <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 12px', color: 'var(--text)' }}>
                  {TAB_NAV_DEMO[reiter].short}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.7 }}>
                  Hier erscheint in der echten Anwendung der Bereich
                  „{TAB_NAV_DEMO[reiter].short}" – <strong style={{ color: 'var(--text)' }}>unverändert</strong>.
                  Beachte den deutlich größeren Arbeitsbereich.
                </p>
                <div style={{ marginTop: '22px', padding: '16px 20px', borderRadius: '12px', background: 'var(--surface)', border: '1px dashed var(--border)', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'left' }}>
                  In dieser isolierten Vorschau sind die Inhalte nur angedeutet,
                  damit keine Verbindung zu echten Mandantendaten besteht.
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {bereich === 'kommunikation' && (
        <KommunikationBereich
          clients={DEMO}
          unbekannteEmails={[{ uid: '1', account: 'buero', betreff: 'Angebot Steuerberatung?', von: 'info@unbekannt-gmbh.de', an: 'jan@kanzlei.de', datum: vorTagen(2) }]}
          onOeffneMandant={(id) => { setBereich('personen'); setOffen(id) }}
          slotWebsiteAnfragen={<Platzhalter titel="Website-Anfragen" icon="🌐" />}
          slotBotInbox={<Platzhalter titel="Bot-Inbox" icon="🤖" />}
          onPosteingangOeffnen={() => alert('Oeffnet in der echten App den Zuordnungs-Dialog.')}
        />
      )}

      {bereich === 'dokumente' && (
        <DokumenteBereich
          clients={DEMO}
          onedriveTokens={{ accessToken: 'demo' }}
          onUpdateOnedriveTokens={() => {}}
          onOeffneMandant={(id) => { setBereich('personen'); setOffen(id) }}
        />
      )}

      {bereich === 'intern' && <InternBereich />}

      {bereich === 'prozesse' && (
        <ProzesseBereich
          clients={DEMO}
          checklistenTypen={DEMO_CHECKLISTEN}
          onOeffneChecklistenEditor={() => alert('Oeffnet in der echten App den Checklisten-Editor.')}
        />
      )}

      {bereich === 'uebersichten' && (
        <UebersichtenBereich
          clients={DEMO}
          termine={DEMO_TERMINE}
          onOeffneMandant={(id) => { setBereich('personen'); setOffen(id) }}
          slotAufgaben={<Platzhalter titel="Aufgaben-Uebersicht" icon="📋" />}
          slotKalender={<Platzhalter titel="Kalender" icon="📅" />}
          slotHonorare={<Platzhalter titel="Honorar-Uebersicht" icon="💰" />}
        />
      )}

      {bereich === 'homepages' && (
        <HomepagesBereich onOeffneAnfragen={() => setBereich('kommunikation')} />
      )}

      {bereich !== 'personen' && bereich !== 'spielbuch' && bereich !== 'kommunikation' && bereich !== 'dokumente' && bereich !== 'homepages' && bereich !== 'uebersichten' && bereich !== 'prozesse' && bereich !== 'intern' && <BereichPlatzhalter bereich={bereich} />}

      {bereich === 'spielbuch' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '56px 24px', textAlign: 'center' }}>
          <div style={{ maxWidth: '560px', margin: '0 auto' }}>
            <div style={{ fontSize: '34px', marginBottom: '18px' }}>📊</div>
            <h2 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 12px', color: 'var(--text)' }}>Spielbuch</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.7 }}>
              Der bisherige Arbeitsbereich mit Aufgaben-Übersicht, Honoraren,
              Website-Anfragen und Zeiterfassung – unverändert erhalten.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<Demo />)
