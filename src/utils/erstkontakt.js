/**
 * erstkontakt.js – Grundlage für den Erstkontaktbogen (Interessenten-Aufnahme).
 *
 * Enthält: Feldschema der Ankreuz-Blöcke, die Visitenkarten-Stammdaten (Moin Fibu),
 * die vCard-Erzeugung und die Ableitung der Unterlagen-Checkliste aus den Kreuzchen.
 * Bewusst ohne React – damit Formular, Mailversand und KI dieselbe Quelle nutzen.
 */

import qrcode from 'qrcode-generator'

/**
 * QR-Code der Visitenkarte als Bild-Datenadresse.
 * Der Gegenüber scannt ihn mit der Kamera und hat den Kontakt sofort im Handy –
 * ohne seine E-Mail-Adresse herausgeben zu müssen. Funktioniert ohne Netz.
 */
export function visitenkarteQr(zellgroesse = 6, rand = 2) {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']   // Umlaute (Hauptstraße) korrekt
  const q = qrcode(0, 'M')      // Version automatisch, mittlere Fehlerkorrektur
  q.addData(vCardText())
  q.make()
  return q.createDataURL(zellgroesse, rand)
}

// ── Visitenkarte: Stammdaten aus dem Impressum von moin-fibu.de ───────────────
export const VISITENKARTE = {
  vorname:  'Jan',
  nachname: 'Thomsen',
  name:     'Jan Thomsen',
  titel:    'Steuerberater',
  firma:    'Moin Fibu',
  claim:    'Digitale Buchhaltung',
  strasse:  'Hauptstraße 24a',
  plz:      '24986',
  ort:      'Mittelangeln',
  land:     'Deutschland',
  telefon:  '04634 2019750',
  email:    'jan@moin-fibu.de',
  web:      'https://www.moin-fibu.de',
  ustIdNr:  'DE348381738',
}

/** vCard 3.0 als Text – von Handy/Outlook direkt als Kontakt importierbar. */
export function vCardText(v = VISITENKARTE) {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${v.nachname};${v.vorname};;;`,
    `FN:${v.name}`,
    `ORG:${v.firma}`,
    `TITLE:${v.titel}`,
    `TEL;TYPE=WORK,VOICE:${v.telefon}`,
    `EMAIL;TYPE=WORK:${v.email}`,
    `URL:${v.web}`,
    `ADR;TYPE=WORK:;;${v.strasse};${v.ort};;${v.plz};${v.land}`,
    'END:VCARD',
  ].join('\r\n')
}

/** UTF-8-sicheres Base64 (für den Mailanhang). */
export function toBase64(text) {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  bytes.forEach(b => { bin += String.fromCharCode(b) })
  return btoa(bin)
}

// ── Ankreuz-Blöcke ────────────────────────────────────────────────────────────
export const EINKUNFTSARTEN = [
  { key: 'eink_gewerbe',   label: 'Gewerbebetrieb' },
  { key: 'eink_selbst',    label: 'Selbständige Arbeit' },
  { key: 'eink_lufo',      label: 'Land- und Forstwirtschaft' },
  { key: 'eink_nichtselb', label: 'Nichtselbständige Arbeit' },
  { key: 'eink_kapital',   label: 'Kapitalvermögen' },
  { key: 'eink_vuv',       label: 'Vermietung und Verpachtung' },
  { key: 'eink_sonstige',  label: 'Sonstige Einkünfte' },
]

export const BETRIEB_MERKMALE = [
  { key: 'b_mitarbeiter', label: 'Mitarbeiter (Lohn)' },
  { key: 'b_kasse',       label: 'Bargeschäfte / Kasse', warn: true },
  { key: 'b_tse',         label: 'TSE vorhanden' },
  { key: 'b_lager',       label: 'Warenlager / Inventur' },
]

export const UST_MERKMALE = [
  { key: 'u_klein',      label: 'Kleinunternehmer § 19' },
  { key: 'u_regel',      label: 'Regelbesteuerung' },
  { key: 'u_ist',        label: 'Ist-Versteuerung gewünscht' },
  { key: 'u_dauerfrist', label: 'Dauerfristverlängerung' },
  { key: 'u_ausland',    label: 'Auslandsumsätze / OSS' },
]

export const VORGESCHICHTE = [
  { key: 'v_mahnung',    label: 'Mahnungen / Schätzung', warn: true },
  { key: 'v_bp',         label: 'Betriebsprüfung läuft', warn: true },
  { key: 'v_kollegen',   label: 'Kollegenanfrage nötig' },
  { key: 'v_vollmacht',  label: 'Vollmacht erteilen' },
]

export const LEISTUNGEN = [
  { key: 'l_fibu',     label: 'Finanzbuchhaltung', auftragsTyp: 'fibu' },
  { key: 'l_lohn',     label: 'Lohnabrechnung',    auftragsTyp: 'lohn' },
  { key: 'l_ja',       label: 'Jahresabschluss',   auftragsTyp: 'jahresabschluss' },
  { key: 'l_est',      label: 'Einkommensteuer',   auftragsTyp: 'beratung' },
  { key: 'l_ustva',    label: 'USt-Voranmeldungen', auftragsTyp: 'ust' },
  { key: 'l_beratung', label: 'Beratung / Gestaltung', auftragsTyp: 'beratung' },
]

/** Leerer Bogen – ein Ort für alle Felder. */
export function leererBogen() {
  return {
    id: 'ik_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    erfasstAm: new Date().toISOString(),
    status: 'offen',
    clientId: null,
    felder: {
      name: '', ansprechpartner: '', rechtsform: 'GmbH', telefon: '', email: '', anschrift: '',
      steuernummer: '', steuerId: '', ustIdNr: '', finanzamt: '',
      taetigkeit: '', beginn: '', gewinnermittlung: 'noch offen',
      vorberater: '', wechselgrund: '', rueckstaende: '',
      vorsystem: '', bank: '', belegweg: 'digital (Upload / Mail)',
      honorar: '', mandatsvertrag: 'noch nicht',
      notizen: '', naechsterSchritt: '', bisWann: '',
    },
    haken: {},
    vermerk: null,
  }
}

// ── Ableitungen ───────────────────────────────────────────────────────────────

/** Hinweise, die sich aus den Kreuzchen zwingend ergeben (fachliche Stolpersteine). */
export function hinweise(haken = {}) {
  const out = []
  if (haken.b_kasse && !haken.b_tse) {
    out.push({ ton: 'warn', text: 'Kasse ohne TSE angekreuzt – Kassenführung und TSE-Pflicht ansprechen.' })
  }
  if (haken.u_ausland) {
    out.push({ ton: 'info', text: 'Auslandsumsätze / OSS – innergemeinschaftlicher Erwerb und Registrierungspflichten prüfen.' })
  }
  if (haken.u_klein && haken.u_regel) {
    out.push({ ton: 'warn', text: 'Kleinunternehmer und Regelbesteuerung gleichzeitig angekreuzt – bitte klären.' })
  }
  if (haken.v_mahnung || haken.v_bp) {
    out.push({ ton: 'warn', text: 'Rückstände bzw. laufende Prüfung – Fristen sofort erfassen, das ist meist eilig.' })
  }
  if (haken.b_mitarbeiter && !haken.l_lohn) {
    out.push({ ton: 'info', text: 'Mitarbeiter vorhanden, aber Lohnabrechnung nicht gewünscht – Zuständigkeit klären.' })
  }
  return out
}

/** Unterlagen-Checkliste für die Nachfass-Mail – aus Einkunftsarten und Leistungen. */
export function unterlagenListe(bogen) {
  const h = bogen?.haken ?? {}
  const f = bogen?.felder ?? {}
  const l = []
  if (h.l_fibu || h.l_ustva) {
    l.push(f.bank ? `Kontoauszüge ${f.bank} (laufendes Jahr)` : 'Kontoauszüge des laufenden Jahres')
    if (f.vorsystem) l.push(`Zugang zu ${f.vorsystem}`)
  }
  if (h.b_kasse)        l.push('Kassenbuch / Kassenberichte, Angaben zur Kasse (TSE)')
  if (h.l_lohn)         l.push('Personalstammblätter und Arbeitsverträge der Mitarbeiter')
  if (h.l_ja)           l.push('Letzter Jahresabschluss und Summen- und Saldenliste')
  if (h.eink_vuv)       l.push('Mietverträge und Nebenkostenabrechnungen der Objekte')
  if (h.eink_kapital)   l.push('Erträgnisaufstellungen der Banken')
  if (h.eink_nichtselb) l.push('Lohnsteuerbescheinigung(en)')
  if (h.l_est)          l.push('Letzter Einkommensteuerbescheid')
  if (h.u_ausland)      l.push('Übersicht der Auslandsumsätze (Länder, Beträge)')
  if (h.v_vollmacht)    l.push('Unterschriebene Vollmacht (liegt bei)')
  if (h.v_kollegen && f.vorberater) l.push(`Freigabe zur Kollegenanfrage bei ${f.vorberater}`)
  if (!l.length) l.push('Unterlagen nach Absprache')
  return l
}

/** Bogen als Fließtext – Grundlage für den KI-Aktenvermerk. */
export function bogenAlsText(bogen) {
  const f = bogen?.felder ?? {}
  const h = bogen?.haken ?? {}
  const an = (liste) => liste.filter(x => h[x.key]).map(x => x.label).join(', ') || '–'
  const z = (label, wert) => wert ? `${label}: ${wert}` : null
  return [
    z('Name/Firma', f.name),
    z('Ansprechpartner', f.ansprechpartner),
    z('Rechtsform', f.rechtsform),
    z('Anschrift', f.anschrift),
    z('Telefon', f.telefon),
    z('E-Mail', f.email),
    z('Steuernummer', f.steuernummer),
    z('Steuer-ID', f.steuerId),
    z('USt-IdNr.', f.ustIdNr),
    z('Finanzamt', f.finanzamt),
    z('Tätigkeit', f.taetigkeit),
    z('Beginn', f.beginn),
    z('Gewinnermittlung', f.gewinnermittlung),
    `Einkunftsarten: ${an(EINKUNFTSARTEN)}`,
    `Betrieb: ${an(BETRIEB_MERKMALE)}`,
    `Umsatzsteuer: ${an(UST_MERKMALE)}`,
    `Vorgeschichte: ${an(VORGESCHICHTE)}`,
    z('Bisheriger Berater', f.vorberater),
    z('Wechselgrund', f.wechselgrund),
    z('Rückstände/offene Jahre', f.rueckstaende),
    z('Vorsystem', f.vorsystem),
    z('Bank', f.bank),
    z('Belegübergabe', f.belegweg),
    `Gewünschte Leistungen: ${an(LEISTUNGEN)}`,
    z('Honorarrahmen', f.honorar),
    z('Mandatsvertrag', f.mandatsvertrag),
    z('Notizen', f.notizen),
    z('Nächster Schritt', f.naechsterSchritt),
    z('Bis wann', f.bisWann),
  ].filter(Boolean).join('\n')
}

/** Kurzer Titel für Listen. */
export function bogenTitel(bogen) {
  return (bogen?.felder?.name || '').trim() || 'Neuer Erstkontakt'
}
