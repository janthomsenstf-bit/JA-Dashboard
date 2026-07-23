import { useState } from 'react'

/**
 * Bereich „USt-Registrierung" – interne Verwaltungs- und Wissenszentrale für
 * die umsatzsteuerliche Registrierung ausländischer Unternehmen in Deutschland.
 *
 * Zwei Ebenen:
 *   1. FÄLLE – der operative Workflow (Lead → Willkommens-Mail → Daten →
 *      Unterschrift → Freigabe → Versand ans Finanzamt → Nachfassen → fertig).
 *      Das ist der sichtbare Prozess / das Produkt.
 *   2. WISSENSDATENBANK – das Gehirn dahinter (Finanzämter, Länder,
 *      Anforderungen, Formulare). Datenbankgestützt, nie im Code fest;
 *      jede Information trägt eine HERKUNFT + Datum + Bearbeiter.
 *
 * WICHTIG – Vorschau-Stand: alles hier sind BEISPIELDATEN zum Reagieren auf
 * den Prozess und das Datenmodell. In der echten Fassung: eigene
 * Supabase-Tabellen (additiv), Anbindung an bestehende Spielbuch-Bereiche
 * (Personen, Dokumente, Kommunikation) und Brevo für die E-Mails. Es wird
 * nichts geschrieben oder verändert.
 */

const FARBE  = '#4338ca' // Farbwelt „USt-Registrierung" (Indigo)
const AKZENT = '#4f46e5'
const HEUTE  = '2026-07-23'

const HAUPTNAV = [
  { key: 'faelle',   label: 'Fälle',            icon: '📁' },
  { key: 'anfrage',  label: 'Anfrageformular',  icon: '📝' },
  { key: 'abmeldung',label: 'Abmeldung',        icon: '🚪' },
  { key: 'wissen',   label: 'Wissensdatenbank', icon: '📚' },
]

// ── Herkunft/Qualität jeder Information ──────────────────────────────────────
const HERKUNFT = {
  gesetz:     { label: 'Gesetz / Verordnung',      kurz: 'Gesetz',    farbe: '#15803d', bg: 'rgba(21,128,61,0.10)' },
  bmf:        { label: 'BMF-Schreiben',            kurz: 'BMF',       farbe: '#059669', bg: 'rgba(5,150,105,0.10)' },
  fa_website: { label: 'Finanzamt-Website',        kurz: 'FA-Web',    farbe: '#2563eb', bg: 'rgba(37,99,235,0.10)' },
  fa_schrift: { label: 'Schriftliche Auskunft FA', kurz: 'FA-Brief',  farbe: '#0891b2', bg: 'rgba(8,145,178,0.10)' },
  fa_telefon: { label: 'Telefonische Auskunft',    kurz: 'FA-Tel.',   farbe: '#d97706', bg: 'rgba(217,119,6,0.10)' },
  erfahrung:  { label: 'Interne Erfahrung',        kurz: 'Erfahrung', farbe: '#64748b', bg: 'rgba(100,116,139,0.10)' },
}

const WISSEN_BEREICHE = [
  { key: 'finanzaemter', label: 'Finanzämter',   icon: '🏛' },
  { key: 'laender',      label: 'Länder',        icon: '🌍' },
  { key: 'anforderungen',label: 'Anforderungen', icon: '📑' },
  { key: 'formulare',    label: 'Formulare',     icon: '📄' },
  { key: 'lernen',       label: 'Rückfragen & Pflege', icon: '🧠' },
]

// ── BEISPIELDATEN: Wissensdatenbank ──────────────────────────────────────────
const LAENDER = [
  { id: 'dk', name: 'Dänemark',            iso: 'DK', flagge: '🇩🇰', eu: true,  sprache: 'Dänisch' },
  { id: 'nl', name: 'Niederlande',         iso: 'NL', flagge: '🇳🇱', eu: true,  sprache: 'Niederländisch' },
  { id: 'fr', name: 'Frankreich',          iso: 'FR', flagge: '🇫🇷', eu: true,  sprache: 'Französisch' },
  { id: 'gb', name: 'Vereinigtes Königreich', iso: 'GB', flagge: '🇬🇧', eu: false, sprache: 'Englisch' },
  { id: 'us', name: 'Vereinigte Staaten',  iso: 'US', flagge: '🇺🇸', eu: false, sprache: 'Englisch' },
]
const land = (id) => LAENDER.find(l => l.id === id) ?? { name: id, flagge: '' }

const q = (herkunft, datum, bearbeiter) => ({ herkunft, datum, bearbeiter })

const FINANZAEMTER = [
  {
    id: 'fa-flensburg', name: 'Finanzamt Flensburg', bundesland: 'Schleswig-Holstein', letztePruefung: '2026-03-14',
    zustaendigkeit: { laender: ['dk'], grundlage: '§ 21 AO i. V. m. UStZustV (Anlage – Dänemark)', quelle: q('gesetz', '2026-01-10', 'JT') },
    kontakt: { anschrift: 'Duburger Straße 58–64, 24939 Flensburg', telefon: '+49 461 813-0', email: 'poststelle@fa-flensburg.landsh.de', kontaktformular: 'elster.de → Kontakt', elster: 'Zuständig für dänische Unternehmen', quelle: q('fa_website', '2026-03-14', 'JT') },
    bearbeitung: { zeit: '4–6 Wochen (Erst­registrierung)', quelle: q('erfahrung', '2026-02-20', 'JT') },
    sepa: { glaeubigerId: 'DE68ZZZ00000123456', quelle: q('fa_website', '2026-03-14', 'JT') },
    besonderheiten: [
      { text: 'Handelsregisterauszug wird beglaubigt übersetzt verlangt.', quelle: q('fa_schrift', '2025-11-02', 'JT') },
      { text: 'Fragebogen bevorzugt über ELSTER, Papier nur ausnahmsweise.', quelle: q('fa_telefon', '2026-01-18', 'JT') },
    ],
    rueckfragen: [
      { text: 'Nachweis der tatsächlichen wirtschaftlichen Tätigkeit', haeufigkeit: 7 },
      { text: 'Übersetzung des Handelsregisterauszugs fehlt', haeufigkeit: 5 },
      { text: 'Empfangsvollmacht nicht im Original', haeufigkeit: 3 },
    ],
  },
  {
    id: 'fa-kleve', name: 'Finanzamt Kleve', bundesland: 'Nordrhein-Westfalen', letztePruefung: '2025-09-01',
    zustaendigkeit: { laender: ['nl'], grundlage: '§ 21 AO i. V. m. UStZustV (Anlage – Niederlande)', quelle: q('gesetz', '2025-09-01', 'JT') },
    kontakt: { anschrift: 'Emmericher Straße 182, 47533 Kleve', telefon: '+49 2821 803-0', email: 'poststelle@fa-kleve.nrw.de', kontaktformular: 'elster.de → Kontakt', elster: 'Zuständig für niederländische Unternehmen', quelle: q('fa_website', '2025-09-01', 'JT') },
    bearbeitung: { zeit: '6–8 Wochen', quelle: q('erfahrung', '2025-09-01', 'JT') },
    sepa: { glaeubigerId: 'DE44ZZZ00000765432', quelle: q('fa_schrift', '2025-09-01', 'JT') },
    besonderheiten: [{ text: 'Reagiert schnell auf ELSTER-Nachrichten.', quelle: q('erfahrung', '2025-09-01', 'JT') }],
    rueckfragen: [{ text: 'Angabe der voraussichtlichen Umsätze fehlt', haeufigkeit: 4 }],
  },
  {
    id: 'fa-hannover-nord', name: 'Finanzamt Hannover-Nord', bundesland: 'Niedersachsen', letztePruefung: '2024-06-11',
    zustaendigkeit: { laender: ['gb'], grundlage: '§ 21 AO i. V. m. UStZustV (Anlage – Vereinigtes Königreich)', quelle: q('gesetz', '2024-06-11', 'JT') },
    kontakt: { anschrift: 'Vahrenwalder Straße 206, 30165 Hannover', telefon: '+49 511 6790-0', email: 'poststelle@fa-h-nord.niedersachsen.de', kontaktformular: 'elster.de → Kontakt', elster: 'Zuständig für britische Unternehmen (Drittland seit Brexit)', quelle: q('fa_website', '2024-06-11', 'JT') },
    bearbeitung: { zeit: '8–12 Wochen', quelle: q('erfahrung', '2024-06-11', 'JT') },
    sepa: { glaeubigerId: 'DE81ZZZ00000998877', quelle: q('fa_website', '2024-06-11', 'JT') },
    besonderheiten: [{ text: 'Seit Brexit häufig Nachweis einer Betriebsstätte / Fiskalvertretung gefragt.', quelle: q('fa_telefon', '2024-06-11', 'JT') }],
    rueckfragen: [{ text: 'Nachweis Sitz und Geschäftsleitung im Drittland', haeufigkeit: 6 }],
  },
]
const faVon = (id) => FINANZAEMTER.find(f => f.id === id) ?? FINANZAEMTER[0]

const ANFORDERUNGEN = [
  {
    id: 'reg-eu-lager', name: 'EU-Online-Händler mit Lager in Deutschland',
    bedingungen: [
      { feld: 'Herkunftsland', wert: 'EU-Mitgliedstaat' },
      { feld: 'Tätigkeit', wert: 'Online-Handel (B2C)' },
      { feld: 'Lager in DE', wert: 'ja' },
    ],
    formulare: ['Fragebogen zur umsatzsteuerlichen Erfassung', 'Anlage: Angaben zum Lager'],
    pflichtunterlagen: ['Handelsregisterauszug (beglaubigt übersetzt)', 'Ausweis Geschäftsführer', 'USt-ID Heimatland', 'Lagervertrag'],
    optionaleUnterlagen: ['Bankbestätigung', 'Gesellschaftsvertrag'],
    vollmachten: ['Empfangsvollmacht', 'Steuerberater-Vollmacht'],
  },
]

const FORMULARE = [
  { id: 'f1', name: 'Fragebogen zur umsatzsteuerlichen Erfassung', typ: 'Hauptfragebogen', sprachen: ['DE'] },
  { id: 'f2', name: 'Anlage: Angaben zum Lager',                    typ: 'Einlageblatt',   sprachen: ['DE'] },
  { id: 'f3', name: 'Empfangsvollmacht',                            typ: 'Vollmacht',      sprachen: ['DE', 'EN', 'DA'] },
  { id: 'f4', name: 'Begleitschreiben an das Finanzamt',            typ: 'Anschreiben',    sprachen: ['DE'] },
  { id: 'f5', name: 'Anlagenverzeichnis',                           typ: 'Checkliste',     sprachen: ['DE'] },
]

// ── BEISPIELDATEN: Fälle (Workflow) ──────────────────────────────────────────
const STUFEN = [
  { key: 'anfrage',      label: 'Anfrage (Lead)' },
  { key: 'willkommen',   label: 'Willkommens-Mail' },
  { key: 'elster',       label: 'ELSTER-Zertifikat organisiert' },
  { key: 'daten',        label: 'Daten & Unterlagen' },
  { key: 'unterschrift', label: 'Unterschrift' },
  { key: 'freigabe',     label: 'Interne Freigabe' },
  { key: 'beim_fa',      label: 'Ans Finanzamt gesendet' },
  { key: 'steuernummer', label: 'Steuernummer erhalten' },
  { key: 'betreuung',    label: 'Laufende Voranmeldung' },
]
const stufeIndex = (key) => STUFEN.findIndex(s => s.key === key)

// Tage zwischen zwei ISO-Daten (grob, nur Anzeige)
function tageSeit(datum) {
  const d = (s) => { const [j, m, t] = s.split('-').map(Number); return Date.UTC(j, m - 1, t) }
  return Math.round((d(HEUTE) - d(datum)) / 86400000)
}

const FAELLE = [
  {
    id: 'c-nordisk', firma: 'Nordisk Byg ApS', land: 'dk', rechtsform: 'ApS',
    ansprechpartner: 'Lars Jensen', email: 'lars@nordisk-byg.dk',
    eingang: '2026-06-05', finanzamt: 'fa-flensburg', stufe: 'beim_fa',
    lead: { taetigkeit: 'Online-Handel (B2C)', lagerInDe: true, marktplatz: true, umsatzErwartet: '250.000 €' },
    unterschrift: { status: 'unterschrieben', am: '2026-06-11', weg: 'digital' },
    faVersand: '2026-06-12', faWeg: 'ELSTER', faZeit: '09:14',
    unterlagen: [
      { name: 'Handelsregisterauszug (übersetzt)', da: true },
      { name: 'Ausweis Geschäftsführer', da: true },
      { name: 'USt-ID Heimatland', da: true },
      { name: 'Lagervertrag', da: true },
      { name: 'Empfangsvollmacht (unterschrieben)', da: true },
    ],
    historie: [
      { am: '2026-06-05 10:22', was: 'Anfrage über Homepage-Formular eingegangen' },
      { am: '2026-06-05 10:23', was: 'Automatische Willkommens-Mail versendet (Brevo)' },
      { am: '2026-06-10 14:05', was: 'Mandant hat Unterlagen hochgeladen' },
      { am: '2026-06-11 09:40', was: 'Antragsformular digital unterschrieben' },
      { am: '2026-06-12 09:14', was: 'An Finanzamt Flensburg gesendet (ELSTER)' },
    ],
    stammdaten: {
      anschrift: 'Havnegade 12, 6400 Sønderborg, Dänemark', ustIdHeimat: 'DK 31 42 56 78',
      gegruendet: '2018', telefon: '+45 74 42 10 00', bank: 'Danske Bank · DK50 3000 1234 5678',
      gf: { geburtsdatum: '12.04.1980', anschrift: 'Storegade 5, 6200 Aabenraa, Dänemark' },
      iban: 'DK50 3000 1234 5678', bic: 'DABADKKK',
      notizen: 'Empfehlung über bestehenden Mandanten. Zügiger Zahler. Ansprechpartner spricht Deutsch.',
    },
    dokumente: [
      { name: 'Handelsregisterauszug_uebersetzt.pdf', kat: 'mandant',  datum: '2026-06-10', groesse: '1,2 MB' },
      { name: 'Ausweis_Geschaeftsfuehrer.pdf',         kat: 'mandant',  datum: '2026-06-10', groesse: '0,4 MB' },
      { name: 'USt-ID_Bescheinigung_DK.pdf',           kat: 'mandant',  datum: '2026-06-10', groesse: '0,2 MB' },
      { name: 'Lagervertrag.pdf',                      kat: 'mandant',  datum: '2026-06-10', groesse: '0,8 MB' },
      { name: 'Fragebogen_USt-Erfassung.pdf',          kat: 'erzeugt',  datum: '2026-06-11', groesse: '0,3 MB' },
      { name: 'Empfangsvollmacht_signiert.pdf',        kat: 'erzeugt',  datum: '2026-06-11', groesse: '0,2 MB' },
      { name: 'Begleitschreiben_FA-Flensburg.pdf',     kat: 'gesendet', datum: '2026-06-12', groesse: '0,1 MB' },
    ],
    rechnung: { nummer: 'RE-2026-0042', leistung: 'Umsatzsteuerliche Registrierung Deutschland', betrag: '890,00 €', status: 'bezahlt', datum: '2026-06-12' },
  },
  {
    id: 'c-moller', firma: 'Møller Handel A/S', land: 'dk', rechtsform: 'A/S',
    ansprechpartner: 'Sofie Møller', email: 'sm@moller-handel.dk',
    eingang: '2026-07-08', finanzamt: 'fa-flensburg', stufe: 'daten',
    lead: { taetigkeit: 'Online-Handel (B2C)', lagerInDe: true, marktplatz: false, umsatzErwartet: '90.000 €' },
    unterschrift: { status: 'ausstehend', am: null, weg: null },
    faVersand: null,
    unterlagen: [
      { name: 'Handelsregisterauszug (übersetzt)', da: true },
      { name: 'Ausweis Geschäftsführer', da: true },
      { name: 'USt-ID Heimatland', da: true },
      { name: 'Lagervertrag', da: false },
      { name: 'Empfangsvollmacht (unterschrieben)', da: false },
    ],
    historie: [
      { am: '2026-07-08 16:40', was: 'Anfrage über Homepage-Formular eingegangen' },
      { am: '2026-07-08 16:41', was: 'Automatische Willkommens-Mail versendet (Brevo)' },
      { am: '2026-07-15 11:12', was: 'Teil-Unterlagen hochgeladen – Lagervertrag fehlt' },
    ],
    stammdaten: {
      anschrift: 'Vestergade 8, 5000 Odense, Dänemark', ustIdHeimat: 'DK 28 90 11 22',
      gegruendet: '2021', telefon: '+45 66 12 00 00', bank: 'Nordea · DK73 2000 8765 4321',
      gf: { geburtsdatum: '03.09.1985', anschrift: 'Kongensgade 40, 5000 Odense, Dänemark' },
      iban: 'DK73 2000 8765 4321', bic: 'NDEADKKK',
      notizen: 'Reagiert eher langsam. Lagervertrag bereits zweimal angefragt.',
    },
    dokumente: [
      { name: 'Handelsregisterauszug_uebersetzt.pdf', kat: 'mandant', datum: '2026-07-15', groesse: '1,1 MB' },
      { name: 'Ausweis_Geschaeftsfuehrer.pdf',         kat: 'mandant', datum: '2026-07-15', groesse: '0,4 MB' },
      { name: 'USt-ID_Bescheinigung_DK.pdf',           kat: 'mandant', datum: '2026-07-15', groesse: '0,2 MB' },
    ],
    rechnung: { nummer: 'RE-2026-0051', leistung: 'Umsatzsteuerliche Registrierung Deutschland', betrag: '890,00 €', status: 'erstellt', datum: '2026-07-09' },
  },
  {
    id: 'c-dutchtools', firma: 'Dutch Tools BV', land: 'nl', rechtsform: 'BV',
    ansprechpartner: 'Jeroen Bakker', email: 'j.bakker@dutchtools.nl',
    eingang: '2026-07-20', finanzamt: 'fa-kleve', stufe: 'willkommen',
    lead: { taetigkeit: 'Online-Handel (B2C)', lagerInDe: false, marktplatz: true, umsatzErwartet: '120.000 €' },
    unterschrift: { status: 'ausstehend', am: null, weg: null },
    faVersand: null,
    unterlagen: [],
    historie: [
      { am: '2026-07-20 08:30', was: 'Anfrage über Homepage-Formular eingegangen' },
      { am: '2026-07-20 08:31', was: 'Automatische Willkommens-Mail versendet (Brevo)' },
    ],
    stammdaten: {
      anschrift: 'Keizersgracht 120, 1015 Amsterdam, Niederlande', ustIdHeimat: 'NL 8012 3456 7 B01',
      gegruendet: '2019', telefon: '+31 20 123 4567', bank: 'ING · NL91 INGB 0708 1234 56',
      gf: { geburtsdatum: '20.11.1978', anschrift: 'Prinsengracht 55, 1015 Amsterdam, Niederlande' },
      iban: 'NL91 INGB 0708 1234 56', bic: 'INGBNL2A',
      notizen: 'Über Google gefunden. Marktplatz-Verkäufer (Amazon). Noch keine Unterlagen.',
    },
    dokumente: [],
    rechnung: { nummer: null, leistung: 'Umsatzsteuerliche Registrierung Deutschland', betrag: '890,00 €', status: 'offen', datum: null },
  },
  {
    id: 'c-kystvind', firma: 'Kystvind ApS', land: 'dk', rechtsform: 'ApS',
    ansprechpartner: 'Anders Holm', email: 'anders@kystvind.dk',
    eingang: '2026-02-10', finanzamt: 'fa-flensburg', stufe: 'betreuung',
    lead: { taetigkeit: 'Online-Handel (B2C)', lagerInDe: true, marktplatz: true, umsatzErwartet: '400.000 €' },
    unterschrift: { status: 'unterschrieben', am: '2026-02-20', weg: 'digital' },
    faVersand: '2026-02-21', faWeg: 'ELSTER', faZeit: '10:30',
    // Nach Erteilung der Steuernummer erfasst → laufende Voranmeldung
    steuerlich: { steuernummer: '15/845/12345', beginn: '01.03.2026', turnus: 'monatlich', beauftragt: true, elsterZertifikat: 'aktiv' },
    unterlagen: [
      { name: 'Handelsregisterauszug_uebersetzt.pdf', kat: 'mandant', datum: '2026-02-15', groesse: '1,0 MB' },
      { name: 'Ausweis_Geschaeftsfuehrer.pdf',         kat: 'mandant', datum: '2026-02-15', groesse: '0,4 MB' },
      { name: 'Steuernummer_Bescheid_FA-Flensburg.pdf', kat: 'gesendet', datum: '2026-04-02', groesse: '0,2 MB' },
    ],
    stammdaten: {
      anschrift: 'Havnevej 3, 6100 Haderslev, Dänemark', ustIdHeimat: 'DK 40 55 66 77',
      gegruendet: '2020', telefon: '+45 74 52 30 00', bank: 'Sydbank · DK21 7000 5544 3322',
      gf: { geburtsdatum: '27.07.1982', anschrift: 'Slotsgade 9, 6100 Haderslev, Dänemark' },
      iban: 'DK21 7000 5544 3322', bic: 'SYBKDK22',
      notizen: 'Registrierung abgeschlossen. Monatliche Voranmeldung – uns beauftragt.',
    },
    dokumente: [
      { name: 'Fragebogen_USt-Erfassung.pdf', kat: 'erzeugt', datum: '2026-02-19', groesse: '0,3 MB' },
      { name: 'Steuernummer_Bescheid.pdf',    kat: 'gesendet', datum: '2026-04-02', groesse: '0,2 MB' },
    ],
    rechnung: { nummer: 'RE-2026-0009', leistung: 'Umsatzsteuerliche Registrierung Deutschland', betrag: '890,00 €', status: 'bezahlt', datum: '2026-02-21' },
    historie: [
      { am: '2026-02-10 09:15', was: 'Anfrage über Homepage-Formular eingegangen' },
      { am: '2026-02-21 10:30', was: 'An Finanzamt Flensburg gesendet (ELSTER)' },
      { am: '2026-04-02 11:00', was: 'Steuernummer 15/845/12345 erhalten (über Empfangsvollmacht)' },
      { am: '2026-04-02 11:20', was: 'Laufende Voranmeldungs-Betreuung gestartet (monatlich)' },
    ],
  },
]

// ── kleine Bausteine ─────────────────────────────────────────────────────────
function HerkunftBadge({ quelle }) {
  const h = HERKUNFT[quelle?.herkunft] ?? HERKUNFT.erfahrung
  return (
    <span title={`${h.label} · ${quelle?.datum ?? '—'} · ${quelle?.bearbeiter ?? '—'}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '1px 7px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 600, color: h.farbe, background: h.bg, border: `1px solid ${h.farbe}33`, whiteSpace: 'nowrap' }}>
      {h.kurz}{quelle?.datum ? ` · ${quelle.datum.slice(0, 7)}` : ''}
    </span>
  )
}

function Feldgruppe({ titel, quelle, children }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: '11px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '9px' }}>
        <strong style={{ fontSize: '12px', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{titel}</strong>
        {quelle && <HerkunftBadge quelle={quelle} />}
      </div>
      {children}
    </div>
  )
}

const STUFE_KURZ = {
  anfrage: 'Anfrage', willkommen: 'Willkommen', elster: 'ELSTER', daten: 'Unterlagen', unterschrift: 'Unterschrift',
  freigabe: 'Freigabe', beim_fa: 'Beim Finanzamt', steuernummer: 'Steuernr.', betreuung: 'Voranmeldung',
}

// Fristen-Logik der laufenden Voranmeldung
const TURNUS = {
  monatlich:     { label: 'monatlich',     erinnerung: 'jeden Monat', frist: '10. des Folgemonats', naechste: '10.08.2026' },
  quartalsweise: { label: 'quartalsweise', erinnerung: '4× im Jahr',  frist: '10. nach Quartalsende', naechste: '10.10.2026' },
  jaehrlich:     { label: 'jährlich',      erinnerung: '1× im Jahr',  frist: '31.07. des Folgejahres', naechste: '31.07.2027' },
}

// Dokument-Herkunft im Fall
const DOK_KAT = {
  mandant:  { label: 'Vom Mandanten',        farbe: '#2563eb', icon: '⬆' },
  erzeugt:  { label: 'Vom System erzeugt',   farbe: '#7c3aed', icon: '⚙' },
  gesendet: { label: 'An Finanzamt gesendet', farbe: '#16a34a', icon: '📤' },
}

const RECHNUNG_STATUS = {
  offen:    { label: 'Noch nicht erstellt', farbe: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  erstellt: { label: 'Erstellt',            farbe: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
  bezahlt:  { label: 'Bezahlt',             farbe: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
}

const FALL_TABS = [
  { key: 'verlauf',    label: 'Verlauf' },
  { key: 'stammdaten', label: 'Stammdaten' },
  { key: 'dokumente',  label: 'Dokumente' },
  { key: 'formular',   label: 'Formular' },
  { key: 'rechnung',   label: 'Rechnung' },
]

// Feste Kanzleidaten – der benannte inländische Empfangsbevollmächtigte (§ 123 AO)
const KANZLEI = {
  name: 'Jan Thomsen', firma: 'Jan Thomsen Steuerberatung',
  anschrift: 'Hauptstraße 24a, 24986 Mittelangeln', telefon: '04634 2019750',
}

// Woher ein Formularfeld gefüllt wird (Auto-Ausfüllung des Fragebogens)
const QUELLE_FORM = {
  stammdaten: { label: 'Stammdaten',      farbe: '#2563eb' },
  lead:       { label: 'Formular-Angabe', farbe: '#4f46e5' },
  wissen:     { label: 'Wissensdatenbank', farbe: '#16a34a' },
  kanzlei:    { label: 'Kanzlei',         farbe: '#64748b' },
  offen:      { label: 'noch offen',      farbe: '#dc2626' },
}

/**
 * Bildet die Mandantendaten auf die Felder des BMF-Fragebogens FsEAusUN (2026)
 * ab. Im echten System befüllt genau diese Zuordnung das amtliche PDF.
 * Jedes Feld weiß, WOHER sein Wert kommt (Auto-Ausfüllung + Nachweisbarkeit).
 */
function formularAbschnitte(fall) {
  const s = fall.stammdaten
  const istKoerperschaft = ['ApS', 'A/S', 'BV', 'GmbH', 'Ltd', 'AG', 'SARL', 'S.A.'].includes(fall.rechtsform)
  const f = (label, wert, quelle) => ({ label, wert: wert ?? '—', quelle: wert ? quelle : 'offen' })
  return {
    einlageblaetter: [
      istKoerperschaft && 'Einlageblatt Körperschaften/Gesellschaften (FsEEBlKoeGes)',
      fall.lead.marktplatz && 'Einlageblatt Internet-Handel (FsEEBlInternet)',
    ].filter(Boolean),
    abschnitte: [
      { titel: '1.1 Angaben zum Unternehmen', felder: [
        f('Firma (lt. Handelsregister)', fall.firma, 'stammdaten'),
        f('Rechtsform', fall.rechtsform, 'stammdaten'),
        f('Sitz der Gesellschaft', s.anschrift, 'stammdaten'),
      ]},
      { titel: '1.2 Körperschaft / Gesellschaft', felder: [
        f('Im Ausland ansässige Körperschaft/Gesellschaft', istKoerperschaft ? 'Ja → Einlageblatt beifügen' : 'Nein', 'wissen'),
      ]},
      { titel: '1.3 Kommunikation', felder: [
        f('Telefon', s.telefon, 'stammdaten'),
        f('E-Mail', fall.email, 'stammdaten'),
      ]},
      { titel: '1.4 Art der Tätigkeit in Deutschland', felder: [
        f('Genaue Bezeichnung', fall.lead.taetigkeit, 'lead'),
      ]},
      { titel: '1.6 Empfangsbevollmächtigte(r) in Deutschland', felder: [
        f('Empfangsbevollmächtigter', `${KANZLEI.firma}, ${KANZLEI.anschrift}`, 'kanzlei'),
      ]},
      { titel: '1.7 Bankverbindung für Steuererstattungen', felder: [
        f('IBAN / Geldinstitut', s.bank, 'stammdaten'),
        f('Kontoinhaber(in)', fall.firma, 'stammdaten'),
      ]},
      { titel: '1.11 Steuerliche Registrierung im Ausland', felder: [
        f('USt-IdNr. (Heimatstaat)', s.ustIdHeimat, 'stammdaten'),
        f('Ansässigkeitsbescheinigung', fall.dokumente.length ? 'beigefügt' : null, 'stammdaten'),
      ]},
      { titel: '2. Art der Umsätze', felder: [
        f('Warenlieferungen', 'Ja', 'lead'),
        f('Abnehmer', fall.lead.taetigkeit.includes('B2C') ? 'Privatpersonen' : 'Unternehmer', 'lead'),
        f('Steuerbarkeit', fall.lead.lagerInDe ? 'Inländische Warenbewegung / Fernverkauf § 3c UStG' : 'Fernverkauf § 3c UStG', 'lead'),
        f('Warenlager in Deutschland', fall.lead.lagerInDe ? 'Ja (Lagervertrag beigefügt)' : 'Nein', 'lead'),
      ]},
      { titel: '3. Anmeldung & USt-IdNr.', felder: [
        f('Summe der Umsätze im Inland (geschätzt)', fall.lead.umsatzErwartet, 'lead'),
        f('USt-IdNr. benötigt', 'Ja (innergemeinschaftlicher Verkehr)', 'wissen'),
      ]},
    ],
  }
}

// ═════════════════════════ HAUPTKOMPONENTE ═══════════════════════════════════
export default function UstRegistrierungBereich() {
  const [ebene, setEbene] = useState('faelle')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Kopf */}
      <div style={{ padding: '14px 20px 0', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <nav aria-label="Pfad" style={{ display: 'flex', gap: '7px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          <span>Spielbuch</span><span style={{ opacity: 0.5 }}>›</span>
          <span style={{ color: FARBE, fontWeight: 700 }}>USt-Registrierung</span>
        </nav>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {HAUPTNAV.map(b => {
            const ist = ebene === b.key
            return (
              <button key={b.key} onClick={() => setEbene(b.key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: `2px solid ${ist ? AKZENT : 'transparent'}`, color: ist ? AKZENT : 'var(--text-muted)', fontWeight: ist ? 700 : 500, fontSize: '13px', transition: 'color 0.16s, border-color 0.16s' }}>
                <span aria-hidden="true">{b.icon}</span>{b.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '20px 24px 56px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {ebene === 'faelle'    && <FaelleAnsicht />}
          {ebene === 'anfrage'   && <AnfrageAnsicht />}
          {ebene === 'abmeldung' && <AbmeldungAnsicht />}
          {ebene === 'wissen'    && <WissensAnsicht />}
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════ FÄLLE (Workflow) ═════════════════════════════════
function FaelleAnsicht() {
  const [fallId, setFallId] = useState(FAELLE[0].id)
  const [tab, setTab] = useState('verlauf')
  const fall = FAELLE.find(f => f.id === fallId) ?? FAELLE[0]
  const fa = faVon(fall.finanzamt)
  const aktStufe = stufeIndex(fall.stufe)
  const l = land(fall.land)
  const anf = ANFORDERUNGEN[0] // im echten System: passend zur Fall-Konstellation ermittelt
  const wartetTage = fall.faVersand ? tageSeit(fall.faVersand) : null
  const nachfassFaellig = wartetTage != null && wartetTage >= 28

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '18px', alignItems: 'start' }}>
      {/* Fall-Liste */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', overflow: 'hidden' }}>
        <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
          {FAELLE.length} laufende Fälle
        </div>
        {FAELLE.map((f, i) => {
          const aktiv = f.id === fallId
          const w = f.faVersand ? tageSeit(f.faVersand) : null
          const faellig = w != null && w >= 28
          return (
            <button key={f.id} onClick={() => setFallId(f.id)}
              style={{ width: '100%', textAlign: 'left', display: 'block', cursor: 'pointer', padding: '11px 14px', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: aktiv ? 'var(--surface2)' : 'transparent', borderLeft: `3px solid ${aktiv ? AKZENT : 'transparent'}` }}>
              <div style={{ fontSize: '13px', fontWeight: aktiv ? 700 : 600, color: 'var(--text)' }}>{land(f.land).flagge} {f.firma}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{STUFE_KURZ[f.stufe]} · {faVon(f.finanzamt).name}</div>
              {faellig && <div style={{ fontSize: '10.5px', marginTop: '4px', color: '#dc2626', fontWeight: 600 }}>⏰ Nachfass fällig ({w} Tage)</div>}
            </button>
          )
        })}
      </div>

      {/* Fall-Detail = die Prozessreise */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Kopf */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{l.flagge} {fall.firma}</h2>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
              {l.name} · {fall.rechtsform} · {fall.ansprechpartner} · {fall.email}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
            Zuständig<br /><strong style={{ color: FARBE }}>{fa.name}</strong>
            <div style={{ fontSize: '10px' }}>aus Wissensdatenbank</div>
          </div>
        </div>

        {/* Nachfass-Alarm */}
        {nachfassFaellig && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 16px', borderRadius: '11px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.3)' }}>
            <div style={{ fontSize: '12.5px', color: '#b91c1c', lineHeight: 1.5 }}>
              <strong>⏰ Nachfassen fällig.</strong> Vor {wartetTage} Tagen ans {fa.name} gesendet – über der üblichen Bearbeitungszeit ({fa.bearbeitung.zeit}).
            </div>
            <button style={{ flexShrink: 0, padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
              Nachfrage vorbereiten →
            </button>
          </div>
        )}

        {/* Innere Reiter der Fallakte */}
        <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid var(--border)' }}>
          {FALL_TABS.map(t => {
            const ist = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ padding: '8px 14px', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: `2px solid ${ist ? AKZENT : 'transparent'}`, color: ist ? AKZENT : 'var(--text-muted)', fontWeight: ist ? 700 : 500, fontSize: '13px' }}>
                {t.label}
                {t.key === 'dokumente' && fall.dokumente.length > 0 && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>{fall.dokumente.length}</span>}
              </button>
            )
          })}
        </div>

        {tab === 'verlauf' && (<>
        {/* Prozesskette */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '18px 20px' }}>
          {STUFEN.map((s, i) => {
            const zustand = i < aktStufe ? 'fertig' : i === aktStufe ? 'aktuell' : 'offen'
            const farbe = zustand === 'fertig' ? '#16a34a' : zustand === 'aktuell' ? AKZENT : 'var(--border2)'
            return (
              <div key={s.key} style={{ display: 'flex', gap: '14px' }}>
                {/* Achse */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: zustand === 'offen' ? 'transparent' : farbe, border: `2px solid ${farbe}`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                    {zustand === 'fertig' ? '✓' : zustand === 'aktuell' ? '●' : ''}
                  </div>
                  {i < STUFEN.length - 1 && <div style={{ width: '2px', flex: 1, minHeight: '18px', background: i < aktStufe ? '#16a34a' : 'var(--border)' }} />}
                </div>
                {/* Inhalt je Stufe */}
                <div style={{ paddingBottom: '16px', flex: 1 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: zustand === 'aktuell' ? 700 : 600, color: zustand === 'offen' ? 'var(--text-muted)' : 'var(--text)' }}>
                    {s.label}{zustand === 'aktuell' && <span style={{ marginLeft: '8px', fontSize: '11px', color: AKZENT }}>● aktuell</span>}
                  </div>
                  <StufenInhalt stufe={s.key} fall={fall} fa={fa} anf={anf} wartetTage={wartetTage} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Historie */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '16px 18px' }}>
          <strong style={{ fontSize: '12px', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Historie</strong>
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {fall.historie.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', fontSize: '12.5px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', minWidth: '112px' }}>{h.am}</span>
                <span style={{ color: 'var(--text)' }}>{h.was}</span>
              </div>
            ))}
          </div>
        </div>
        </>)}

        {tab === 'stammdaten' && <StammdatenView fall={fall} />}
        {tab === 'dokumente'  && <DokumenteView fall={fall} />}
        {tab === 'formular'   && <FormularView fall={fall} />}
        {tab === 'rechnung'   && <RechnungView fall={fall} />}
      </div>
    </div>
  )
}

// ── Fallakte: Stammdaten (als Kontakt) ──────────────────────────────────────
function StammdatenView({ fall }) {
  const s = fall.stammdaten
  const [notiz, setNotiz] = useState(s.notizen)
  const felder = [
    ['Firma', fall.firma], ['Rechtsform', fall.rechtsform], ['Land', land(fall.land).name],
    ['Anschrift', s.anschrift], ['USt-ID (Heimat)', s.ustIdHeimat], ['Gegründet', s.gegruendet],
    ['Ansprechpartner', fall.ansprechpartner], ['E-Mail', fall.email], ['Telefon', s.telefon],
    ['Bankverbindung', s.bank],
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <strong style={{ fontSize: '12px', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Stammdaten (als Kontakt angelegt)</strong>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>↔ Bereich „Personen"</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 22px' }}>
          {felder.map(([k, v]) => (
            <div key={k} style={{ fontSize: '12.5px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{k}</div>
              <div style={{ color: 'var(--text)', fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '16px 18px' }}>
        <strong style={{ fontSize: '12px', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Interne Notizen</strong>
        <textarea value={notiz} onChange={e => setNotiz(e.target.value)}
          style={{ marginTop: '10px', width: '100%', minHeight: '90px', resize: 'vertical', padding: '10px 12px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }} />
        <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>Nur intern sichtbar. (Vorschau – wird noch nicht gespeichert.)</div>
      </div>

      {/* Steuerliche Daten (nach Erteilung der Steuernummer) */}
      <SteuerlicheDaten fall={fall} />
    </div>
  )
}

// ── Steuerliche Daten + Fristen der laufenden Voranmeldung ──────────────────
function SteuerlicheDaten({ fall }) {
  const st = fall.steuerlich
  const tn = st ? TURNUS[st.turnus] : null
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <strong style={{ fontSize: '12px', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Steuerliche Daten (nach Registrierung)</strong>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>↔ Fristen · Erinnerungen</span>
      </div>
      {!st ? (
        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Wird erfasst, sobald das Finanzamt die Steuernummer erteilt hat. Felder: Steuernummer · Beginn der USt-Erfassung · Voranmeldungszeitraum (monatlich / quartalsweise).</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 22px', marginBottom: '14px' }}>
            {[['Steuernummer (DE)', st.steuernummer], ['Beginn USt-Erfassung', st.beginn], ['Voranmeldungszeitraum', tn.label], ['ELSTER-Zertifikat', st.elsterZertifikat === 'aktiv' ? '🔐 aktiv' : 'offen']].map(([k, v]) => (
              <div key={k} style={{ fontSize: '12.5px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{k}</div>
                <div style={{ color: 'var(--text)', fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span>⏰</span><strong style={{ fontSize: '12px', color: '#b45309' }}>Fristen & Erinnerung – USt-Voranmeldung</strong>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text)', lineHeight: 1.7 }}>
              Turnus <strong>{tn.label}</strong> · Abgabefrist {tn.frist} · <strong>nächste Frist {tn.naechste}</strong>.<br />
              📧 Automatische Erinnerung an den Mandanten <strong>{tn.erinnerung}</strong>: „Denkt an eure Umsatzsteuer-Voranmeldung."
              {st.beauftragt
                ? <span style={{ color: '#16a34a', fontWeight: 600 }}> · ✓ hat uns mit der Voranmeldung beauftragt</span>
                : <span style={{ color: 'var(--text-muted)' }}> · Erinnerung enthält Angebot: „Sollen wir das für euch übernehmen?"</span>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Fallakte: Dokumente ─────────────────────────────────────────────────────
function DokumenteView({ fall }) {
  if (!fall.dokumente.length) return (
    <div style={{ border: '1px dashed var(--border2)', borderRadius: '12px', padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
      Noch keine Dokumente. Der Mandant lädt sie über das Kundenportal hoch.
    </div>
  )
  const gruppen = ['mandant', 'erzeugt', 'gesendet'].map(k => [k, fall.dokumente.filter(d => d.kat === k)]).filter(([, arr]) => arr.length)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {gruppen.map(([kat, docs]) => {
        const c = DOK_KAT[kat]
        return (
          <div key={kat} style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: c.farbe }}>{c.icon}</span>
              <strong style={{ fontSize: '12px', color: c.farbe, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{c.label}</strong>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>· {docs.length}</span>
            </div>
            {docs.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 15px', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <span aria-hidden="true">📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>{d.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{d.datum} · {d.groesse}</div>
                </div>
                <button style={{ flexShrink: 0, padding: '5px 12px', borderRadius: '7px', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Ansehen</button>
              </div>
            ))}
          </div>
        )
      })}
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Im echten System: Ablage im Bereich „Dokumente" (OneDrive); „Ansehen" öffnet die Datei.</div>
    </div>
  )
}

// ── Fallakte: Formulare (Auswahl der auto-ausgefüllten Dokumente) ───────────
const FORM_DOKUMENTE = [
  { key: 'fragebogen',        label: 'Fragebogen (FsEAusUN)' },
  { key: 'empfangsvollmacht', label: 'Empfangsvollmacht (§ 123 AO)' },
  { key: 'einwilligung',      label: 'Einwilligung Mailversand (§ 87a AO)' },
  { key: 'sepa',              label: 'SEPA-Lastschriftmandat' },
]

function FormularView({ fall }) {
  const [dok, setDok] = useState('fragebogen')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {FORM_DOKUMENTE.map(d => {
          const ist = dok === d.key
          return (
            <button key={d.key} onClick={() => setDok(d.key)}
              style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${ist ? AKZENT : 'var(--border)'}`, background: ist ? 'rgba(79,70,229,0.08)' : 'var(--surface)', color: ist ? AKZENT : 'var(--text)', fontSize: '12.5px', fontWeight: ist ? 700 : 500, cursor: 'pointer' }}>
              📄 {d.label}
            </button>
          )
        })}
      </div>
      {dok === 'fragebogen' && <FragebogenView fall={fall} />}
      {dok === 'empfangsvollmacht' && <EmpfangsvollmachtView fall={fall} />}
      {dok === 'einwilligung' && <EinwilligungView fall={fall} />}
      {dok === 'sepa' && <SepaMandatView fall={fall} />}
    </div>
  )
}

// ── SEPA-Lastschriftmandat (Gläubiger = Finanzamt, Zahler = Mandant) ─────────
function SepaMandatView({ fall }) {
  const s = fall.stammdaten
  const fa = faVon(fall.finanzamt)
  const unterschrieben = fall.unterschrift.status === 'unterschrieben'
  const badge = (quelle) => {
    const qu = QUELLE_FORM[quelle]
    return <span style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: qu.farbe }}><span style={{ width: '7px', height: '7px', borderRadius: '2px', background: qu.farbe, display: 'inline-block' }} />{qu.label}</span>
  }
  const Zeile = ({ label, wert, quelle }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '10px', padding: '5px 0', fontSize: '12.5px', alignItems: 'baseline' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: wert ? 'var(--text)' : '#dc2626', fontWeight: 500 }}>{wert || '— (noch offen)'}{badge(wert ? quelle : 'offen')}</span>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '20px 22px', maxWidth: '760px' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>SEPA-Lastschriftmandat</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }}>Teilnahme am SEPA-Basislastschriftverfahren (Steuerzahlungen)</div>
        </div>

        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', margin: '4px 0' }}>Zahlungsempfänger (Gläubiger)</div>
        <Zeile label="Finanzamt" wert={fa.name} quelle="wissen" />
        <Zeile label="Anschrift" wert={fa.kontakt.anschrift} quelle="wissen" />
        <Zeile label="Gläubiger-Identifikationsnr." wert={fa.sepa?.glaeubigerId} quelle="wissen" />
        <Zeile label="Mandatsreferenz (Steuernummer)" wert={null} />

        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', margin: '12px 0 4px' }}>Zahlungspflichtiger (Kontoinhaber)</div>
        <Zeile label="Name" wert={fall.firma} quelle="stammdaten" />
        <Zeile label="Anschrift" wert={s.anschrift} quelle="stammdaten" />
        <Zeile label="IBAN" wert={s.iban} quelle="stammdaten" />
        <Zeile label="BIC" wert={s.bic} quelle="stammdaten" />

        <div style={{ marginTop: '14px', padding: '11px 14px', borderRadius: '9px', background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          Ich ermächtige das oben genannte Finanzamt, Zahlungen von meinem Konto mittels
          SEPA-Basislastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an, die vom
          Finanzamt auf mein Konto gezogenen Lastschriften einzulösen.
        </div>

        <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}><div style={{ borderBottom: '1px solid var(--border2)', paddingBottom: '4px', color: 'var(--text-muted)', fontSize: '12px' }}>{unterschrieben ? fall.unterschrift.am : 'Ort, Datum'}</div></div>
          <div style={{ flex: 1 }}>
            <div style={{ borderBottom: '1px solid var(--border2)', paddingBottom: '4px', color: 'var(--text)', fontSize: '12.5px' }}>{unterschrieben ? `✍ ${fall.ansprechpartner}` : fall.ansprechpartner}</div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '3px' }}>Unterschrift Kontoinhaber / gesetzlicher Vertreter</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 16px', borderRadius: '11px', background: unterschrieben ? 'rgba(22,163,74,0.05)' : 'rgba(79,70,229,0.05)', border: `1px solid ${unterschrieben ? 'rgba(22,163,74,0.28)' : 'rgba(79,70,229,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12.5px', color: 'var(--text)' }}>
          {unterschrieben ? `✓ Unterschrieben von ${fall.ansprechpartner} am ${fall.unterschrift.am}.` : 'SEPA-Mandat erzeugen und zur digitalen Unterschrift senden.'}
        </span>
        {!unterschrieben && <button style={{ padding: '8px 15px', borderRadius: '8px', border: 'none', background: FARBE, color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Erzeugen & zur Unterschrift →</button>}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Hinweis: Gläubiger-ID und Mandatsvorlage sind je Finanzamt eigen – sie kommen aus dem Finanzamt-Profil der Wissensdatenbank.</div>
    </div>
  )
}

// ── Einwilligung Mailversand § 87a AO (auto-ausgefüllt) ─────────────────────
function EinwilligungView({ fall }) {
  const s = fall.stammdaten
  const gf = s.gf ?? {}
  const unterschrieben = fall.unterschrift.status === 'unterschrieben'
  const istKoerperschaft = ['ApS', 'A/S', 'BV', 'GmbH', 'Ltd', 'AG', 'SARL', 'S.A.'].includes(fall.rechtsform)
  const badge = (quelle) => {
    const qu = QUELLE_FORM[quelle]
    return <span style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: qu.farbe }}><span style={{ width: '7px', height: '7px', borderRadius: '2px', background: qu.farbe, display: 'inline-block' }} />{qu.label}</span>
  }
  const Zeile = ({ label, wert, quelle }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: '10px', padding: '5px 0', fontSize: '12.5px', alignItems: 'baseline' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: wert ? 'var(--text)' : '#dc2626', fontWeight: 500 }}>{wert || '— (noch offen)'}{badge(wert ? quelle : 'offen')}</span>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '20px 22px', maxWidth: '760px' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>Einwilligung in den Versand unverschlüsselter E-Mails durch Finanzbehörden</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }}>§ 87a Abs. 1 Satz 4 Halbsatz 2 AO · {istKoerperschaft ? 'für Körperschaften' : 'für Bürgerinnen und Bürger'}</div>
        </div>

        <Zeile label="Firma" wert={fall.firma} quelle="stammdaten" />
        <Zeile label="Anschrift" wert={s.anschrift} quelle="stammdaten" />
        <Zeile label="Steuernummer" wert={null} />
        <div style={{ margin: '10px 0 4px', fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>Gesetzlich vertreten durch</div>
        <Zeile label="Name, Vorname" wert={fall.ansprechpartner} quelle="stammdaten" />
        <Zeile label="Geburtsdatum" wert={gf.geburtsdatum} quelle="stammdaten" />
        <Zeile label="Anschrift" wert={gf.anschrift} quelle="stammdaten" />

        <div style={{ margin: '14px 0 6px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Der zukünftige Informationsaustausch soll über folgende E-Mail-Adresse geführt werden:
        </div>
        <Zeile label="E-Mail-Adresse" wert={fall.email} quelle="stammdaten" />
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', paddingTop: '4px' }}>☑ Es handelt sich um die E-Mail-Adresse des steuerlichen Bevollmächtigten.</div>

        <div style={{ marginTop: '14px', padding: '11px 14px', borderRadius: '9px', background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: '12.5px', color: 'var(--text)' }}>
          ☑ Die Einwilligung erstreckt sich auf die <strong>gesamte</strong> elektronisch zulässige Kommunikation.
        </div>

        {/* Unterschrift */}
        <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}><div style={{ borderBottom: '1px solid var(--border2)', paddingBottom: '4px', color: 'var(--text-muted)', fontSize: '12px' }}>{unterschrieben ? fall.unterschrift.am : 'Ort, Datum'}</div></div>
          <div style={{ flex: 1 }}>
            <div style={{ borderBottom: '1px solid var(--border2)', paddingBottom: '4px', color: 'var(--text)', fontSize: '12.5px' }}>{unterschrieben ? `✍ ${fall.ansprechpartner}` : fall.ansprechpartner}</div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '3px' }}>Unterschrift {istKoerperschaft ? 'gesetzlicher Vertreter' : 'der betroffenen Person'}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 16px', borderRadius: '11px', background: unterschrieben ? 'rgba(22,163,74,0.05)' : 'rgba(79,70,229,0.05)', border: `1px solid ${unterschrieben ? 'rgba(22,163,74,0.28)' : 'rgba(79,70,229,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12.5px', color: 'var(--text)' }}>
          {unterschrieben ? `✓ Unterschrieben von ${fall.ansprechpartner} am ${fall.unterschrift.am}.` : 'Einwilligung erzeugen und zur digitalen Unterschrift senden.'}
        </span>
        {!unterschrieben && <button style={{ padding: '8px 15px', borderRadius: '8px', border: 'none', background: FARBE, color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Erzeugen & zur Unterschrift →</button>}
      </div>
    </div>
  )
}

// ── Empfangsvollmacht nach § 123 AO (auto-ausgefüllt) ───────────────────────
function EmpfangsvollmachtView({ fall }) {
  const s = fall.stammdaten
  const fa = faVon(fall.finanzamt)
  const unterschrieben = fall.unterschrift.status === 'unterschrieben'
  const badge = (quelle) => {
    const qu = QUELLE_FORM[quelle]
    return <span style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: qu.farbe }}><span style={{ width: '7px', height: '7px', borderRadius: '2px', background: qu.farbe, display: 'inline-block' }} />{qu.label}</span>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Dokument */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '20px 22px', maxWidth: '760px' }}>
        {/* Kopf: Adressat + Mandant */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '18px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>An das {badge('wissen')}</div>
            <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600, marginTop: '3px' }}>{fa.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{fa.kontakt.anschrift}</div>
          </div>
          <div style={{ fontSize: '12.5px' }}>
            <div><span style={{ color: 'var(--text-muted)' }}>Name:</span> <strong>{fall.firma}</strong>{badge('stammdaten')}</div>
            <div style={{ marginTop: '3px' }}><span style={{ color: 'var(--text-muted)' }}>Anschrift:</span> {s.anschrift}</div>
            <div style={{ marginTop: '3px' }}><span style={{ color: 'var(--text-muted)' }}>Steuernummer:</span> <span style={{ color: '#dc2626' }}>— (soweit vergeben)</span></div>
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '6px 0 12px' }}>
          Benennung eines Empfangsbevollmächtigten nach § 123 AO
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.7, margin: '0 0 16px' }}>
          Wir bitten Sie, unter Hinweis auf § 123 Abgabenordnung, um die Benennung eines inländischen
          (in Deutschland ansässigen) Empfangsbevollmächtigten, der ermächtigt ist, alle Schriftstücke in
          Steuerangelegenheiten zu empfangen, die für Sie bestimmt sind. …
        </p>

        {/* Benannter Empfangsbevollmächtigter */}
        <div style={{ padding: '13px 16px', borderRadius: '10px', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>
            ☑ Ich benenne folgenden Empfangsbevollmächtigten:{badge('kanzlei')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '4px 10px', fontSize: '12.5px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Name</span><span style={{ color: 'var(--text)' }}>{KANZLEI.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>Anschrift</span><span style={{ color: 'var(--text)' }}>{KANZLEI.anschrift}</span>
            <span style={{ color: 'var(--text-muted)' }}>Telefon</span><span style={{ color: 'var(--text)' }}>{KANZLEI.telefon}</span>
          </div>
        </div>

        {/* Unterschrift */}
        <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ borderBottom: '1px solid var(--border2)', paddingBottom: '4px', color: 'var(--text-muted)', fontSize: '12px' }}>{unterschrieben ? `${fall.unterschrift.am}` : 'Ort, Datum'}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ borderBottom: '1px solid var(--border2)', paddingBottom: '4px', color: 'var(--text)', fontSize: '12.5px' }}>
              {unterschrieben ? `✍ ${fall.ansprechpartner}` : fall.ansprechpartner}{badge('stammdaten')}
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '3px' }}>Unterschrift Geschäftsführer (gesetzlicher Vertreter)</div>
          </div>
        </div>
      </div>

      {/* Status + Aktion */}
      <div style={{ padding: '14px 16px', borderRadius: '11px', background: unterschrieben ? 'rgba(22,163,74,0.05)' : 'rgba(79,70,229,0.05)', border: `1px solid ${unterschrieben ? 'rgba(22,163,74,0.28)' : 'rgba(79,70,229,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12.5px', color: 'var(--text)' }}>
          {unterschrieben ? `✓ Digital unterschrieben von ${fall.ansprechpartner} am ${fall.unterschrift.am}.` : 'Empfangsvollmacht erzeugen und zur digitalen Unterschrift senden.'}
        </span>
        {!unterschrieben && <button style={{ padding: '8px 15px', borderRadius: '8px', border: 'none', background: FARBE, color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Erzeugen & zur Unterschrift →</button>}
      </div>
    </div>
  )
}

// ── Fallakte: Fragebogen (auto-ausgefüllter BMF-Fragebogen) ─────────────────
function FragebogenView({ fall }) {
  const { abschnitte, einlageblaetter } = formularAbschnitte(fall)
  const unterschrieben = fall.unterschrift.status === 'unterschrieben'
  const offen = abschnitte.flatMap(a => a.felder).filter(f => f.quelle === 'offen').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Kopf */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Fragebogen zur umsatzsteuerlichen Erfassung</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>BMF-Vordruck FsEAusUN · gültig ab 2026 · automatisch aus den Falldaten befüllt</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 11px', borderRadius: '20px', color: unterschrieben ? '#16a34a' : '#d97706', background: unterschrieben ? 'rgba(22,163,74,0.12)' : 'rgba(217,119,6,0.12)' }}>
            {unterschrieben ? '✓ Unterschrieben' : 'Entwurf'}
          </span>
        </div>
      </div>

      {/* Legende Quellen */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
        {Object.entries(QUELLE_FORM).map(([k, v]) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: v.farbe, display: 'inline-block' }} />{v.label}
          </span>
        ))}
      </div>

      {offen > 0 && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', fontSize: '12.5px', color: '#b91c1c' }}>
          {offen} Feld{offen > 1 ? 'er' : ''} noch offen – vor dem Erzeugen des Formulars zu erfassen.
        </div>
      )}

      {/* Formularabschnitte */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', overflow: 'hidden' }}>
        {abschnitte.map((a, ai) => (
          <div key={ai} style={{ borderTop: ai === 0 ? 'none' : '1px solid var(--border)' }}>
            <div style={{ padding: '9px 16px', background: 'var(--surface2)', fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{a.titel}</div>
            {a.felder.map((fld, fi) => {
              const qu = QUELLE_FORM[fld.quelle]
              return (
                <div key={fi} style={{ display: 'grid', gridTemplateColumns: '260px 1fr 130px', gap: '12px', alignItems: 'center', padding: '9px 16px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{fld.label}</span>
                  <span style={{ fontSize: '13px', color: fld.quelle === 'offen' ? '#dc2626' : 'var(--text)', fontWeight: 500 }}>{fld.wert}</span>
                  <span style={{ justifySelf: 'end', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: qu.farbe }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: qu.farbe, display: 'inline-block' }} />{qu.label}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Einlageblätter */}
      {einlageblaetter.length > 0 && (
        <div style={{ padding: '13px 16px', borderRadius: '11px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '7px' }}>Zusätzlich beizufügende Einlageblätter</div>
          {einlageblaetter.map((e, i) => <div key={i} style={{ fontSize: '12.5px', color: 'var(--text)' }}>📄 {e}</div>)}
        </div>
      )}

      {/* Unterschrift */}
      <div style={{ padding: '16px 18px', borderRadius: '12px', background: unterschrieben ? 'rgba(22,163,74,0.05)' : 'rgba(79,70,229,0.05)', border: `1px solid ${unterschrieben ? 'rgba(22,163,74,0.28)' : 'rgba(79,70,229,0.25)'}` }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Unterschrift des vertretungsberechtigten Geschäftsführers</div>
        {unterschrieben ? (
          <div style={{ fontSize: '13px', color: 'var(--text)' }}>✍ Digital unterschrieben von <strong>{fall.ansprechpartner}</strong> am {fall.unterschrift.am}.</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Formular erzeugen und an {fall.ansprechpartner} zur digitalen Unterschrift senden.</span>
            <button disabled={offen > 0} style={{ padding: '8px 15px', borderRadius: '8px', border: 'none', background: offen > 0 ? 'var(--border2)' : FARBE, color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: offen > 0 ? 'not-allowed' : 'pointer' }}>
              Formular erzeugen & zur Unterschrift senden →
            </button>
          </div>
        )}
      </div>

      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Im echten System: befüllt das amtliche BMF-PDF (weiße Felder) und startet die E-Signatur.</div>
    </div>
  )
}

// ── Fallakte: Rechnung ──────────────────────────────────────────────────────
function RechnungView({ fall }) {
  const r = fall.rechnung
  const st = RECHNUNG_STATUS[r.status] ?? RECHNUNG_STATUS.offen
  const erstellt = r.status !== 'offen'
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '18px 20px', maxWidth: '520px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <strong style={{ fontSize: '15px', color: 'var(--text)' }}>Rechnung</strong>
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: st.farbe, background: st.bg, padding: '3px 11px', borderRadius: '20px' }}>{st.label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Nummer</span><span style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{r.nummer ?? '—'}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Leistung</span><span style={{ color: 'var(--text)' }}>{r.leistung}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Datum</span><span style={{ color: 'var(--text)' }}>{r.datum ?? '—'}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}><span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Betrag</span><span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '15px' }}>{r.betrag}</span></div>
      </div>
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <button style={{ padding: '8px 15px', borderRadius: '8px', border: 'none', background: FARBE, color: '#fff', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
          {erstellt ? 'Rechnung ansehen' : 'Rechnung erzeugen'}
        </button>
        {erstellt && <button style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>Per E-Mail senden</button>}
      </div>
      <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>Im echten System: erzeugt ein PDF und legt es beim Fall + im Dokumentenbereich ab.</div>
    </div>
  )
}

// Inhalt je Prozessstufe (nur befüllt, wo es etwas zu zeigen gibt)
function StufenInhalt({ stufe, fall, fa, anf, wartetTage }) {
  const box = { marginTop: '7px', padding: '10px 12px', borderRadius: '9px', background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: '12.5px', color: 'var(--text)', lineHeight: 1.6 }

  if (stufe === 'anfrage') return (
    <div style={box}>
      Über das Homepage-Formular. Angaben des Interessenten:{' '}
      <strong>{land(fall.land).name}</strong>, {fall.rechtsform}, {fall.lead.taetigkeit},{' '}
      Lager in DE: {fall.lead.lagerInDe ? 'ja' : 'nein'}, Marktplatz: {fall.lead.marktplatz ? 'ja' : 'nein'},{' '}
      erwarteter Umsatz {fall.lead.umsatzErwartet}. <span style={{ color: 'var(--text-muted)' }}>Eingang {fall.eingang}.</span>
    </div>
  )

  if (stufe === 'elster') return (
    <div style={box}>
      🔐 <strong>ELSTER-Zertifikat</strong> für das Unternehmen beantragt – Voraussetzung für die spätere
      Umsatzsteuer-Voranmeldung. Bewusst früh gestartet (Aktivierungscode kommt per Post).
    </div>
  )

  if (stufe === 'betreuung' && fall.steuerlich) {
    const tn = TURNUS[fall.steuerlich.turnus]
    return (
      <div style={{ ...box, background: 'rgba(22,163,74,0.05)', borderColor: 'rgba(22,163,74,0.28)' }}>
        Steuernummer <strong>{fall.steuerlich.steuernummer}</strong> erhalten · USt-Erfassung ab {fall.steuerlich.beginn}.
        Voranmeldung <strong>{tn.label}</strong> → automatische Erinnerung {tn.erinnerung} (nächste Frist {tn.naechste}).
        {fall.steuerlich.beauftragt && <span style={{ color: '#16a34a', fontWeight: 600 }}> · ✓ mit Voranmeldung beauftragt</span>}
      </div>
    )
  }

  if (stufe === 'willkommen') return (
    <div style={{ ...box, background: 'rgba(79,70,229,0.05)', borderColor: 'rgba(79,70,229,0.25)' }}>
      <div style={{ fontSize: '11px', color: AKZENT, fontWeight: 700, marginBottom: '5px' }}>✉ Automatische Willkommens-Mail (Brevo)</div>
      „Willkommen – schön, dass du dich für eine USt-Registrierung interessierst!
      <strong> Von dir wissen wir bereits:</strong> {land(fall.land).name}, {fall.rechtsform}, {fall.lead.taetigkeit}
      {fall.lead.lagerInDe ? ', Lager in Deutschland' : ''}.
      <strong> Für die Registrierung beim {fa.name} brauchen wir noch:</strong>{' '}
      {anf.pflichtunterlagen.join(', ')}." <span style={{ color: 'var(--text-muted)' }}>— Inhalt aus der Wissensdatenbank abgeleitet.</span>
    </div>
  )

  if (stufe === 'daten') {
    if (!fall.unterlagen.length) return <div style={{ ...box, color: 'var(--text-muted)' }}>Wartet auf Upload der Unterlagen.</div>
    return (
      <div style={box}>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>Unterlagen-Checkliste (aus Anforderungen)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {fall.unterlagen.map((u, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: u.da ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{u.da ? '✓' : '✗'}</span>
              <span style={{ color: u.da ? 'var(--text)' : '#dc2626' }}>{u.name}{!u.da && ' — fehlt'}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (stufe === 'unterschrift') {
    if (fall.unterschrift.status === 'unterschrieben') return (
      <div style={box}>✍ Antragsformular <strong>digital unterschrieben</strong> am {fall.unterschrift.am}.</div>
    )
    return <div style={{ ...box, color: 'var(--text-muted)' }}>Antragsformular zur digitalen Unterschrift bereitstellen (E-Signatur – noch zu integrieren).</div>
  }

  if (stufe === 'beim_fa' && fall.faVersand) return (
    <div style={box}>
      Gesendet an <strong>{fa.name}</strong> über {fall.faWeg}.{' '}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>Zeitstempel {fall.faVersand} {fall.faZeit}</span>.
      {wartetTage != null && <span style={{ color: wartetTage >= 28 ? '#dc2626' : 'var(--text-muted)' }}> Seit {wartetTage} Tagen in Bearbeitung.</span>}
    </div>
  )

  return null
}

// ═════════════════════════ ANFRAGEFORMULAR (öffentliche Anmeldung) ══════════
const faFuerLand = (id) => FINANZAEMTER.find(f => f.zustaendigkeit.laender.includes(id)) ?? FINANZAEMTER[0]

function AnfrageAnsicht() {
  const [f, setF] = useState({
    firma: 'Havblik Handel ApS', land: 'dk', rechtsform: 'ApS',
    ansprechpartner: 'Freja Holm', email: 'freja@havblik.dk',
    taetigkeit: 'Online-Handel (B2C)', lagerInDe: true, umsatzErwartet: '180.000 €',
    optEmpfangsvollmacht: true, optEmailEinwilligung: true, optPortal: true, dsgvo: false,
  })
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }))
  const toggle = (k) => (e) => setF(s => ({ ...s, [k]: e.target.checked }))
  const l = land(f.land)
  const fa = faFuerLand(f.land)
  const anf = ANFORDERUNGEN[0]

  const inp = { width: '100%', padding: '8px 11px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl = { fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }
  const Feld = ({ label, children }) => (<div><label style={lbl}>{label}</label>{children}</div>)
  const Check = ({ k, children }) => (
    <label style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text)', lineHeight: 1.5 }}>
      <input type="checkbox" checked={f[k]} onChange={toggle(k)} style={{ marginTop: '2px', accentColor: FARBE }} />
      <span>{children}</span>
    </label>
  )

  return (
    <div>
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>Anfrage: Umsatzsteuerliche Registrierung in Deutschland</h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '720px' }}>
          Das öffentliche Erstkontakt-Formular. Der Mandant wählt gleich seine Optionen; rechts siehst du die <strong>automatische Willkommens-Mail</strong> live,
          inkl. Hinweis auf die zurück benötigte Einwilligung/Beauftragung.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Formular */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', color: FARBE }}>Anfrage-Formular</div>
          <Feld label="Unternehmen"><input style={inp} value={f.firma} onChange={set('firma')} /></Feld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Feld label="Land">
              <select style={inp} value={f.land} onChange={set('land')}>{LAENDER.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            </Feld>
            <Feld label="Rechtsform"><input style={inp} value={f.rechtsform} onChange={set('rechtsform')} /></Feld>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Feld label="Ansprechpartner"><input style={inp} value={f.ansprechpartner} onChange={set('ansprechpartner')} /></Feld>
            <Feld label="E-Mail"><input style={inp} value={f.email} onChange={set('email')} /></Feld>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <Feld label="Art der Tätigkeit"><input style={inp} value={f.taetigkeit} onChange={set('taetigkeit')} /></Feld>
            <Feld label="Erwarteter Umsatz"><input style={inp} value={f.umsatzErwartet} onChange={set('umsatzErwartet')} /></Feld>
          </div>
          <Check k="lagerInDe">Wir haben ein Lager / eine Betriebsstätte in Deutschland</Check>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '13px', marginTop: '3px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Optionen (beschleunigen den Prozess)</div>
            <Check k="optEmpfangsvollmacht"><strong>Empfangsvollmacht (Zustellvollmacht) erteilen</strong> – die Steuernummer kommt dann direkt zu uns und in der Regel schneller.</Check>
            <Check k="optEmailEinwilligung"><strong>Einwilligung zur E-Mail-Kommunikation</strong> mit dem Finanzamt (§ 87a AO) gleich mit erteilen.</Check>
            <Check k="optPortal"><strong>Zugang zum Online-Portal</strong> einrichten (Status, Dokumente, Nachrichten).</Check>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '13px', marginTop: '3px' }}>
            <Check k="dsgvo">
              <span><strong style={{ color: f.dsgvo ? 'var(--text)' : '#dc2626' }}>Einwilligung &amp; Beauftragung (erforderlich):</strong> Ich beauftrage euch mit meiner USt-Registrierung. Meine Daten werden ausschließlich dafür verarbeitet, ans Finanzamt weitergeleitet und nach Abschluss innerhalb von 14 Tagen gelöscht. Ich habe die Datenschutzhinweise gelesen.</span>
            </Check>
          </div>

          <button disabled={!f.dsgvo} style={{ marginTop: '4px', alignSelf: 'flex-start', padding: '9px 18px', borderRadius: '8px', border: 'none', background: f.dsgvo ? FARBE : 'var(--border2)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: f.dsgvo ? 'pointer' : 'not-allowed' }}>
            Anfrage absenden →
          </button>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ohne die Einwilligung kann nicht abgesendet werden. Zustimmung wird mit Zeitstempel beim Fall gespeichert.</div>
        </div>

        {/* Live-Vorschau Willkommens-Mail */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '22px 24px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>Automatische Willkommens-Mail (Live-Vorschau · Brevo)</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Betreff: Willkommen – deine USt-Registrierung in Deutschland</div>
          <div style={{ marginTop: '14px', fontSize: '12.5px', color: 'var(--text)', lineHeight: 1.8 }}>
            Hallo {f.ansprechpartner || 'und willkommen'},<br /><br />
            schön, dass du dich für eine umsatzsteuerliche Registrierung in Deutschland interessierst!<br /><br />
            <strong>Von dir wissen wir bereits:</strong> {l.name}, {f.rechtsform}, {f.taetigkeit}{f.lagerInDe ? ', Lager in Deutschland' : ''}, erwarteter Umsatz {f.umsatzErwartet}.<br /><br />
            <strong>Für die Registrierung beim {fa.name} brauchen wir noch:</strong> {anf.pflichtunterlagen.join(', ')}.

            {(f.optEmpfangsvollmacht || f.optEmailEinwilligung || f.optPortal) && (
              <><br /><br /><strong>Deine gewählten Optionen:</strong>
                {f.optEmpfangsvollmacht && <div>✓ Empfangsvollmacht erteilt – so bekommen wir die Steuernummer direkt und es geht schneller.</div>}
                {f.optEmailEinwilligung && <div>✓ Einwilligung E-Mail-Kommunikation (§ 87a AO) – legen wir gleich mit bei.</div>}
                {f.optPortal && <div>✓ Zugang zum Online-Portal – die Zugangsdaten kommen separat.</div>}
              </>
            )}
          </div>

          {/* Einwilligungs-Hinweis – prominent */}
          <div style={{ marginTop: '16px', padding: '13px 15px', borderRadius: '10px', background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.28)', fontSize: '12.5px', color: 'var(--text)', lineHeight: 1.7 }}>
            <strong>📄 Damit wir starten können</strong> brauchen wir deine unterschriebene <strong>Einwilligung &amp; Beauftragung</strong> zurück. Kurz gesagt: Wir verarbeiten deine Daten
            <strong> ausschließlich</strong> für diese Registrierung, leiten sie an das Finanzamt weiter und <strong>löschen sie innerhalb von 14 Tagen</strong> nach Abschluss.
            Das Dokument findest du im Anhang – bitte einmal bestätigen und zurücksenden, dann geht's los.
          </div>

          <div style={{ marginTop: '14px', fontSize: '12.5px', color: 'var(--text)' }}>
            Viele Grüße<br />{KANZLEI.name}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════ ABMELDUNG (Webformular) ══════════════════════════
const ABM_GRUENDE = [
  { key: 'eingestellt',    label: 'Geschäftstätigkeit in Deutschland eingestellt',        satz: 'die steuerbare Tätigkeit in Deutschland eingestellt hat' },
  { key: 'kein_lager',     label: 'Kein Lager / keine Betriebsstätte mehr in Deutschland', satz: 'kein Lager und keine Betriebsstätte mehr in Deutschland unterhält' },
  { key: 'keine_umsaetze', label: 'Keine steuerbaren Umsätze mehr in Deutschland',         satz: 'keine in Deutschland steuerbaren Umsätze mehr ausführt' },
  { key: 'oss',            label: 'Wechsel zum OSS-Verfahren (One-Stop-Shop)',             satz: 'ihre Fernverkäufe künftig über das OSS-Verfahren erklärt' },
  { key: 'aufgabe',        label: 'Geschäftsaufgabe / Liquidation',                        satz: 'den Geschäftsbetrieb aufgegeben hat' },
]

function AbmeldungAnsicht() {
  const [f, setF] = useState({
    firma: 'Nordkap Trading ApS', steuernummer: '15/123/45678', finanzamt: 'fa-flensburg',
    grund: 'eingestellt', datum: '31.12.2026', ansprechpartner: 'Mette Sørensen',
    email: 'mette@nordkap.dk', letzteVa: 'Dezember 2026', bemerkung: '',
  })
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }))
  const fa = faVon(f.finanzamt)
  const grundSatz = ABM_GRUENDE.find(g => g.key === f.grund)?.satz ?? ''

  const inp = { width: '100%', padding: '8px 11px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl = { fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }
  const Feld = ({ label, children }) => (<div><label style={lbl}>{label}</label>{children}</div>)

  return (
    <div>
      <div style={{ marginBottom: '18px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>Abmeldung der umsatzsteuerlichen Registrierung</h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '720px' }}>
          Einfaches Formular für Mandanten, die ihre deutsche USt-Registrierung beenden möchten.
          Es gibt kein amtliches Formular – aus den Angaben wird automatisch das <strong>Anschreiben ans Finanzamt</strong> erzeugt
          (rechts als Live-Vorschau), das anschließend unterschrieben und versendet wird.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Webformular */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', color: FARBE }}>Abmelde-Formular</div>
          <Feld label="Unternehmen"><input style={inp} value={f.firma} onChange={set('firma')} /></Feld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Feld label="Deutsche Steuernummer"><input style={inp} value={f.steuernummer} onChange={set('steuernummer')} /></Feld>
            <Feld label="Zuständiges Finanzamt">
              <select style={inp} value={f.finanzamt} onChange={set('finanzamt')}>
                {FINANZAEMTER.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </Feld>
          </div>
          <Feld label="Grund der Abmeldung">
            <select style={inp} value={f.grund} onChange={set('grund')}>
              {ABM_GRUENDE.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </Feld>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Feld label="Wirksam zum"><input style={inp} value={f.datum} onChange={set('datum')} placeholder="TT.MM.JJJJ" /></Feld>
            <Feld label="Letzte USt-Voranmeldung"><input style={inp} value={f.letzteVa} onChange={set('letzteVa')} /></Feld>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Feld label="Ansprechpartner"><input style={inp} value={f.ansprechpartner} onChange={set('ansprechpartner')} /></Feld>
            <Feld label="E-Mail (für Bestätigung)"><input style={inp} value={f.email} onChange={set('email')} /></Feld>
          </div>
          <Feld label="Bemerkung (optional)"><textarea style={{ ...inp, minHeight: '64px', resize: 'vertical' }} value={f.bemerkung} onChange={set('bemerkung')} /></Feld>
          <button style={{ marginTop: '4px', alignSelf: 'flex-start', padding: '9px 18px', borderRadius: '8px', border: 'none', background: FARBE, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            Abmeldung anfordern & Anschreiben erzeugen →
          </button>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Im echten System: legt einen Abmelde-Fall an und startet dieselbe Kette (Anschreiben → Unterschrift → Versand ans Finanzamt → Bestätigung).</div>
        </div>

        {/* Live-Vorschau Anschreiben */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '22px 24px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>Automatisch erzeugtes Anschreiben (Live-Vorschau)</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{KANZLEI.firma} · {KANZLEI.anschrift}</div>
          <div style={{ marginTop: '16px', fontSize: '12.5px', color: 'var(--text)' }}>
            An das {fa.name}<br />{fa.kontakt.anschrift}
          </div>
          <div style={{ margin: '16px 0 12px', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
            Abmeldung der umsatzsteuerlichen Erfassung – {f.firma}, Steuernummer {f.steuernummer}
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text)', lineHeight: 1.8 }}>
            Sehr geehrte Damen und Herren,<br /><br />
            im Namen und Auftrag der <strong>{f.firma}</strong> teilen wir mit, dass das Unternehmen {grundSatz} – mit Wirkung zum <strong>{f.datum}</strong>.
            Wir bitten daher um <strong>Löschung der umsatzsteuerlichen Registrierung</strong> (Steuernummer {f.steuernummer}).
            Die letzte Umsatzsteuer-Voranmeldung ({f.letzteVa}) wird fristgerecht abgegeben.
            {f.bemerkung ? <> <br /><br />Ergänzend: {f.bemerkung}</> : null}
            <br /><br />Als Empfangsbevollmächtigter stehen wir für Rückfragen zur Verfügung.<br /><br />
            Mit freundlichen Grüßen<br />{KANZLEI.name}, {KANZLEI.firma}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════ WISSENSDATENBANK ═════════════════════════════════
function WissensAnsicht() {
  const [bereich, setBereich] = useState('finanzaemter')
  const [faId, setFaId] = useState(FINANZAEMTER[0].id)
  const fa = FINANZAEMTER.find(f => f.id === faId) ?? FINANZAEMTER[0]

  const monateHer = (datum) => { const [j, m] = datum.split('-').map(Number); return (2026 - j) * 12 + (7 - m) }

  return (
    <div>
      {/* Sub-Navigation */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '2px' }}>
        {WISSEN_BEREICHE.map(b => {
          const ist = bereich === b.key
          return (
            <button key={b.key} onClick={() => setBereich(b.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', border: 'none', background: ist ? 'rgba(79,70,229,0.09)' : 'transparent', borderRadius: '8px', cursor: 'pointer', color: ist ? AKZENT : 'var(--text-muted)', fontWeight: ist ? 700 : 500, fontSize: '12.5px' }}>
              <span aria-hidden="true">{b.icon}</span>{b.label}
            </button>
          )
        })}
      </div>

      {/* Vorschau-Hinweis */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', marginBottom: '18px', padding: '11px 15px', borderRadius: '11px', background: 'rgba(67,56,202,0.05)', border: '1px solid rgba(67,56,202,0.22)' }}>
        <span aria-hidden="true">🧪</span>
        <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>Das Gehirn hinter den Fällen.</strong>{' '}
          Steuert, welches Finanzamt zuständig ist und welche Unterlagen ein Fall braucht.
          Jede Information trägt ihre <em>Herkunft</em> (farbige Badges). Datenbankgestützt, nie im Code.
        </span>
      </div>

      {/* FINANZÄMTER */}
      {bereich === 'finanzaemter' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '18px', alignItems: 'start' }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>{FINANZAEMTER.length} Finanzämter</div>
            {FINANZAEMTER.map((f, i) => {
              const aktiv = f.id === faId; const alt = monateHer(f.letztePruefung)
              return (
                <button key={f.id} onClick={() => setFaId(f.id)}
                  style={{ width: '100%', textAlign: 'left', display: 'block', cursor: 'pointer', padding: '11px 14px', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: aktiv ? 'var(--surface2)' : 'transparent', borderLeft: `3px solid ${aktiv ? AKZENT : 'transparent'}` }}>
                  <div style={{ fontSize: '13px', fontWeight: aktiv ? 700 : 600, color: 'var(--text)' }}>{f.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{f.bundesland} · {f.zustaendigkeit.laender.map(id => land(id).name).join(', ')}</div>
                  <div style={{ fontSize: '10.5px', marginTop: '4px', color: alt > 12 ? '#d97706' : '#16a34a' }}>{alt > 12 ? `⚠ Prüfung ${Math.floor(alt / 12)} J. her` : '● geprüft ' + f.letztePruefung}</div>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div><h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{fa.name}</h2><div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '3px' }}>{fa.bundesland}</div></div>
              <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>Letzte Prüfung<br /><strong style={{ color: 'var(--text)' }}>{fa.letztePruefung}</strong></div>
            </div>
            <Feldgruppe titel="Zuständigkeit" quelle={fa.zustaendigkeit.quelle}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {fa.zustaendigkeit.laender.map(id => <span key={id} style={{ padding: '2px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: FARBE, background: 'rgba(67,56,202,0.09)' }}>{land(id).flagge} {land(id).name}</span>)}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{fa.zustaendigkeit.grundlage}</div>
            </Feldgruppe>
            <Feldgruppe titel="Kontakt & ELSTER" quelle={fa.kontakt.quelle}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 18px', fontSize: '12.5px' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>Anschrift:</span> {fa.kontakt.anschrift}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>Telefon:</span> {fa.kontakt.telefon}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>E-Mail:</span> {fa.kontakt.email}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>Kontaktformular:</span> {fa.kontakt.kontaktformular}</div>
                <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--text-muted)' }}>ELSTER-Hinweis:</span> {fa.kontakt.elster}</div>
              </div>
            </Feldgruppe>
            <Feldgruppe titel="Bearbeitungszeit" quelle={fa.bearbeitung.quelle}><div style={{ fontSize: '13px', color: 'var(--text)' }}>{fa.bearbeitung.zeit}</div></Feldgruppe>
            <Feldgruppe titel="SEPA / Zahlungsverkehr" quelle={fa.sepa?.quelle}>
              <div style={{ fontSize: '12.5px' }}><span style={{ color: 'var(--text-muted)' }}>Gläubiger-Identifikationsnummer:</span> <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{fa.sepa?.glaeubigerId ?? '—'}</span></div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px' }}>Je Finanzamt eigene Gläubiger-ID – speist das SEPA-Lastschriftmandat.</div>
            </Feldgruppe>
            <Feldgruppe titel="Besonderheiten">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {fa.besonderheiten.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--text)', lineHeight: 1.5 }}>• {b.text}</span><HerkunftBadge quelle={b.quelle} />
                  </div>
                ))}
              </div>
            </Feldgruppe>
            <div style={{ padding: '14px 16px', borderRadius: '11px', background: 'rgba(217,119,6,0.05)', border: '1px solid rgba(217,119,6,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px' }}><span aria-hidden="true">🧠</span><strong style={{ fontSize: '12px', letterSpacing: '0.02em', textTransform: 'uppercase', color: '#b45309' }}>Bekannte Rückfragen (lernend)</strong></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {fa.rueckfragen.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--text)' }}>{r.text}</span>
                    <span title={`${r.haeufigkeit}× aufgetreten`} style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', background: 'rgba(217,119,6,0.12)', padding: '1px 8px', borderRadius: '20px' }}>{r.haeufigkeit}×</span>
                  </div>
                ))}
                {fa.rueckfragen.some(r => r.haeufigkeit >= 5) && <div style={{ marginTop: '4px', fontSize: '11.5px', color: '#b45309', fontStyle: 'italic' }}>💡 Vorschlag: häufige Rückfragen künftig direkt bei Antragstellung anfordern.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LÄNDER */}
      {bereich === 'laender' && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.4fr', gap: '10px', padding: '11px 16px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <span>Land</span><span>ISO</span><span>EU / Drittland</span><span>Sprache</span>
          </div>
          {LAENDER.map((l, i) => (
            <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.4fr', gap: '10px', padding: '11px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--border)', fontSize: '13px', color: 'var(--text)' }}>
              <span style={{ fontWeight: 600 }}>{l.flagge} {l.name}</span><span style={{ fontFamily: 'var(--font-mono)' }}>{l.iso}</span>
              <span style={{ color: l.eu ? '#16a34a' : '#d97706' }}>{l.eu ? 'EU' : 'Drittland'}</span><span style={{ color: 'var(--text-muted)' }}>{l.sprache}</span>
            </div>
          ))}
        </div>
      )}

      {/* ANFORDERUNGEN */}
      {bereich === 'anforderungen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7 }}>Regelbasiert: Aus den Antworten ergibt sich, welche Formulare und Unterlagen nötig sind. Ein Beispiel-Regelsatz:</p>
          {ANFORDERUNGEN.map(a => (
            <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '16px 18px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{a.name}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '16px' }}>
                {a.bedingungen.map((b, i) => <span key={i} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '7px', background: 'rgba(67,56,202,0.08)', color: FARBE, fontWeight: 600 }}>{b.feld}: {b.wert}</span>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                {[['📄 Formulare', a.formulare], ['📎 Pflicht-Unterlagen', a.pflichtunterlagen], ['➕ Optionale Unterlagen', a.optionaleUnterlagen], ['✍ Vollmachten', a.vollmachten]].map(([t, items]) => (
                  <div key={t}>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>{t}</div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--text)', lineHeight: 1.7 }}>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FORMULARE */}
      {bereich === 'formulare' && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.2fr 1fr', gap: '10px', padding: '11px 16px', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            <span>Formular</span><span>Typ</span><span>Sprachen</span>
          </div>
          {FORMULARE.map((f, i) => (
            <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '2.4fr 1.2fr 1fr', gap: '10px', padding: '11px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--border)', fontSize: '13px', color: 'var(--text)' }}>
              <span style={{ fontWeight: 600 }}>{f.name}</span><span style={{ color: 'var(--text-muted)' }}>{f.typ}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>{f.sprachen.join(' · ')}</span>
            </div>
          ))}
        </div>
      )}

      {/* LERNEN */}
      {bereich === 'lernen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ padding: '16px 18px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>🧠 Lernender Pflegeprozess</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7 }}>Jede Finanzamts-Rückfrage wird erfasst. Wiederkehrende Muster schlägt das System vor, künftig direkt anzufordern. Nach deiner Freigabe wird die Information Bestandteil der Wissensdatenbank.</p>
          </div>
          <div style={{ padding: '16px 18px', borderRadius: '12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>📅 Jährliche Aktualisierung</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7 }}>Pro Finanzamt eine Erinnerung: einmal jährlich eine standardisierte Anfrage vorbereiten (Anforderungen, Formulare, Kommunikationswege, Ansprechpartner).</p>
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {FINANZAEMTER.map(f => { const alt = monateHer(f.letztePruefung); return (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '12.5px' }}>
                  <span style={{ color: 'var(--text)' }}>{f.name}</span>
                  <span style={{ color: alt > 12 ? '#d97706' : '#16a34a', fontWeight: 600 }}>{alt > 12 ? `⚠ Prüfung überfällig (${f.letztePruefung})` : `✓ aktuell (${f.letztePruefung})`}</span>
                </div>
              ) })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
