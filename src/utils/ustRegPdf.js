// ─────────────────────────────────────────────────────────────────────────────
// ustRegPdf.js — Erzeugt für die USt-Registrierung DE zwei Dokumente aus den
// Antragsdaten eines Auftrags (auftrag.erfassungsdaten), per jsPDF:
//   1) buildAntragFinanzamt() — den 15-Punkte-Fragebogen „Antrag umsatzsteuer-
//      liche Registrierung", der ausgefüllt ans Finanzamt geht (eigene Vorlage,
//      kein Briefkopf — nachgebildet aus der Kanzlei-Vorlage).
//   2) buildVollmacht() — Vollmacht zur steuerlichen Vertretung.
//
// Verwendung:
//   const doc = buildAntragFinanzamt(client, au); downloadPdf(doc, pdfFilename('antrag', au))
// ─────────────────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf'

// Kanzlei (nur für Vollmacht als Bevollmächtigter) — via Einstellungen pflegbar.
const KANZLEI_FALLBACK = {
  name:    'Jan Thomsen',
  strasse: 'Hauptstraße 24a',
  plzOrt:  '24986 Mittelangeln',
  telefon: '046342019750',
  email:   'jan.thomsen.stf@gmail.com',
}

export function loadKanzlei() {
  try {
    const raw = localStorage.getItem('kanzlei-profil')
    if (raw) return { ...KANZLEI_FALLBACK, ...JSON.parse(raw) }
  } catch {}
  return KANZLEI_FALLBACK
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function safe(s) { return (s == null ? '' : String(s)).trim() }

function fmtDateDE(iso) {
  const d = iso ? new Date(iso) : new Date()
  if (isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

// ISO-Datum (YYYY-MM-DD) → DD.MM.YYYY, sonst unverändert
function deDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(safe(s))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : safe(s)
}

const MONATE_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']

// Monat+Jahr (YYYY-MM) → "März 2026", sonst unverändert
function fmtMonthYear(s) {
  const m = /^(\d{4})-(\d{2})$/.exec(safe(s))
  if (m) { const i = parseInt(m[2], 10) - 1; return `${MONATE_DE[i] || m[2]} ${m[1]}` }
  return safe(s)
}

// Hängt " €" an, falls noch kein €/EUR enthalten
function withEuro(s) {
  const v = safe(s)
  if (!v) return ''
  return /€|eur/i.test(v) ? v : `${v} €`
}

// Fixe Standardvorgaben des Formulars (überschreibbar über erfassungsdaten)
export const ANTRAG_DEFAULTS = {
  fa_betriebsart:      'Website-Verkäufe',
  fa_inland_besteht:   '-',
  fa_finanzamt_ertrag: 'Flensburg',
  fa_10_1:             'Nein',
  fa_10_2:             'Ja',
  fa_10_3:             'Ja',
  fa_10_4:             'Nein',
  fa_11:               'Nein',
  fa_12:               'Nein',
  fa_13:               'Nein',
  fa_14:               'Ja',
  fa_14_1:             'Für die Registrierung bei Onlinemarktplätzen',
}

// ── 1) Antrag umsatzsteuerliche Registrierung (Fragebogen ans Finanzamt) ──────
export function buildAntragFinanzamt(client, au) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ed  = au?.erfassungsdaten ?? {}
  const g   = (k, def = '') => safe(ed[k]) || def

  const L = 18, R = 192
  const qW = 104                 // Spalte „Frage"
  const aW = (R - L) - qW        // Spalte „Antwort"
  let y = 20

  doc.setFont('helvetica', 'bold').setFontSize(14)
  doc.text('Antrag umsatzsteuerliche Registrierung', L, y)
  y += 3
  doc.setDrawColor(150); doc.setLineWidth(0.4); doc.line(L, y, R, y)
  y += 7

  const gfZeile = [
    g('geschaeftsfuehrer_name'),
    g('geschaeftsfuehrer_adresse'),
    g('geschaeftsfuehrer_geburtsdatum') ? 'geb. ' + deDate(g('geschaeftsfuehrer_geburtsdatum')) : '',
  ].filter(Boolean).join(', ')

  const rows = [
    ['1. Name und Anschrift der Firma', [g('firmenname'), g('cvr_nummer') ? 'CVR/Reg.-Nr.: ' + g('cvr_nummer') : ''].filter(Boolean).join('\n')],
    ['2. Unternehmens Adresse', [g('adresse_strasse'), g('adresse_plz_ort'), g('adresse_land')].filter(Boolean).join(', ')],
    ['3. Name, Anschrift und Geburtsdatum des Geschäftsführers', gfZeile],
    ['4. Telefon', g('ansprechpartner_telefon')],
    ['5. E-Mail-Adresse', g('ansprechpartner_email')],
    ['6. Art des Betriebes oder der beruflichen Tätigkeit', g('fa_betriebsart', ANTRAG_DEFAULTS.fa_betriebsart)],
    ['7. Im Inland besteht ein/eine', g('fa_inland_besteht', ANTRAG_DEFAULTS.fa_inland_besteht)],
    ['8. Finanzamt, wo die Firma ertragsteuerlich geführt wird (z. B. bei Geschäftssitz/Anlage)', g('fa_finanzamt_ertrag', ANTRAG_DEFAULTS.fa_finanzamt_ertrag)],
    ['9. Beginn der unternehmerischen Betätigung in Deutschland', fmtMonthYear(g('taetigkeit_beginn'))],
    ['10.1 Lieferung ohne Montage an Unternehmer mit ID-Nr.', g('fa_10_1', ANTRAG_DEFAULTS.fa_10_1)],
    ['10.2 Lieferung ohne Montage an Kunden ohne ID-Nr.', g('fa_10_2', ANTRAG_DEFAULTS.fa_10_2)],
    ['10.3 Ein- und Verkauf innerhalb Deutschlands', g('fa_10_3', ANTRAG_DEFAULTS.fa_10_3)],
    ['10.4 Innergemeinschaftliche steuerfreie Lieferungen (Einfuhr aus Drittland, Ausfuhr in anderes EU-Land)', g('fa_10_4', ANTRAG_DEFAULTS.fa_10_4)],
    ['11. Geht der Lieferung ein freiwilliges innergemeinschaftliches Verbringen voraus?', g('fa_11', ANTRAG_DEFAULTS.fa_11)],
    ['12. Lieferung mit Montage (Werklieferungen) oder reine sonstige Leistungen (z. B. Dienstleistungen) an:', g('fa_12', ANTRAG_DEFAULTS.fa_12)],
    ['13. Ausländische Subunternehmer beschäftigt, deren Steuer Sie nach § 13b (2) UStG schulden?', g('fa_13', ANTRAG_DEFAULTS.fa_13)],
    ['14. Wird eine Umsatzsteuer-Identifikationsnummer benötigt?', g('fa_14', ANTRAG_DEFAULTS.fa_14)],
    ['14.1 Wenn ja, wofür?', g('fa_14_1', ANTRAG_DEFAULTS.fa_14_1)],
    ['15.1 Höhe des Umsatzes (geschätzt) in Deutschland im laufenden Jahr in EUR', withEuro(g('umsatz_geschaetzt'))],
    ['15.2 Höhe des Umsatzes (geschätzt) in Deutschland im kommenden Jahr in EUR', withEuro(g('umsatz_folgejahr'))],
  ]

  const padX = 2.5, padY = 1.9, lh = 4.0
  doc.setFontSize(8.5)
  rows.forEach(([q, a]) => {
    doc.setFont('helvetica', 'bold')
    const qLines = doc.splitTextToSize(q, qW - 2 * padX)
    doc.setFont('helvetica', 'normal')
    const aLines = doc.splitTextToSize(String(a || ''), aW - 2 * padX)
    const rowH = Math.max(qLines.length, aLines.length) * lh + 2 * padY

    if (y + rowH > 284) { doc.addPage(); y = 20 }

    doc.setDrawColor(205); doc.setLineWidth(0.2)
    doc.rect(L, y, qW, rowH)
    doc.rect(L + qW, y, aW, rowH)

    doc.setFont('helvetica', 'bold').setTextColor(30)
    doc.text(qLines, L + padX, y + padY + 3)
    doc.setFont('helvetica', 'normal').setTextColor(0)
    doc.text(aLines, L + qW + padX, y + padY + 3)

    y += rowH
  })

  // ── Unterschrift (unten am Dokument, hervorgehoben) ──
  const gf = g('geschaeftsfuehrer_name')
  let sigY = Math.max(y + 18, 272)
  if (sigY > 282) { doc.addPage(); sigY = 40 }
  doc.setDrawColor(40); doc.setLineWidth(0.6)
  doc.line(L, sigY, L + 75, sigY)
  doc.line(R - 82, sigY, R, sigY)
  doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(0)
  doc.text('Datum, Ort', L, sigY + 5.5)
  doc.text(`Unterschrift${gf ? ' – ' + gf : ''}`, R - 82, sigY + 5.5)
  doc.setFont('helvetica', 'normal')

  return doc
}

// Zuständiges Finanzamt (für ausländische Unternehmer i. d. R. Flensburg)
const FINANZAMT = {
  name:    'Finanzamt Flensburg',
  strasse: 'Duburger Straße 58-64',
  plzOrt:  '24939 Flensburg',
}

// ── 2) Empfangsvollmacht nach § 123 AO ────────────────────────────────────────
export function buildVollmacht(client, au) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const kanzlei = loadKanzlei()
  const ed = au?.erfassungsdaten ?? {}
  const g = (k, def = '') => safe(ed[k]) || def
  const L = 20, R = 190, MID = 105
  let y = 22

  const firma  = g('firmenname') || safe(client?.name) || ''
  const anschr = [g('adresse_strasse'), g('adresse_plz_ort'), g('adresse_land')].filter(Boolean).join(', ')
  const steuernr = g('steuernummer') || safe(client?.steuernummer)
  const gf     = g('geschaeftsfuehrer_name')

  // ── Kopf: links Finanzamt, rechts Antragsteller ──
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(0)
  doc.text('An das', L, y)
  doc.setFont('helvetica', 'bold')
  doc.text(FINANZAMT.name, L, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.text(FINANZAMT.strasse, L, y + 10)
  doc.text(FINANZAMT.plzOrt, L, y + 15)
  doc.text('(Tyskland / Germany)', L, y + 20)

  const rx = MID + 6, vx = rx + 26
  doc.text('Name:', rx, y)
  doc.text(firma, vx, y, { maxWidth: R - vx })
  doc.text('Anschrift:', rx, y + 6)
  doc.text(doc.splitTextToSize(anschr, R - vx), vx, y + 6)
  doc.text('Steuernummer:', rx, y + 18)
  doc.text(steuernr, vx, y + 18)
  doc.setFontSize(7).setTextColor(110)
  doc.text('(soweit schon vergeben)', rx, y + 22)
  doc.setFontSize(10).setTextColor(0)

  // ── Titel ──
  y += 38
  doc.setFont('helvetica', 'bold').setFontSize(12)
  doc.text('Benennung eines Empfangsbevollmächtigten nach § 123 AO', MID, y, { align: 'center' })
  doc.setFont('helvetica', 'normal').setFontSize(10)
  y += 10

  // ── Einleitungstext ──
  const intro = `Wir bitten Sie, unter Hinweis auf § 123 Abgabenordnung, um die Benennung eines inländischen (in Deutschland ansässigen) Empfangsbevollmächtigten, der ermächtigt ist, alle Schriftstücke in Steuerangelegenheiten zu empfangen, die für Sie bestimmt sind. Unterlassen Sie dies, so gilt ein an Sie ins Ausland gerichtetes Schriftstück einen Monat nach Aufgabe zur Post als zugegangen. Den Nachweis über einen verspäteten bzw. Nichtzugang haben Sie zu führen.`
  const introLines = doc.splitTextToSize(intro, R - L)
  doc.text(introLines, L, y, { align: 'justify', maxWidth: R - L })
  y += introLines.length * 5 + 6

  doc.setFont('helvetica', 'bold')
  doc.text('Zutreffendes bitte ankreuzen und ggf. ausfüllen!', MID, y, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  y += 10

  // ── Option 1 (angekreuzt): Empfangsbevollmächtigter ──
  doc.setDrawColor(0); doc.setLineWidth(0.3)
  doc.rect(L, y - 3.5, 4, 4)
  doc.setFont('helvetica', 'bold').setFontSize(11)
  doc.text('X', L + 0.7, y - 0.4)
  doc.setFont('helvetica', 'normal').setFontSize(10)
  doc.text('Ich benenne folgenden Empfangsbevollmächtigten:', L + 7, y)
  y += 8

  const bx = L + 60, lvx = bx + 24
  const bvFelder = [
    ['Name', kanzlei.name],
    ['Anschrift', [kanzlei.strasse, kanzlei.plzOrt].filter(Boolean).join(', ')],
    ['Telefon', kanzlei.telefon],
  ]
  bvFelder.forEach(([label, val]) => {
    doc.setTextColor(90); doc.text(label, bx, y)
    doc.setTextColor(0)
    doc.text(safe(val), lvx, y)
    doc.setDrawColor(180); doc.setLineWidth(0.2)
    doc.line(lvx, y + 1.5, R, y + 1.5)
    y += 8
  })
  y += 4

  // ── Option 2 (nicht angekreuzt) ──
  doc.setDrawColor(0); doc.setLineWidth(0.3)
  doc.rect(L, y - 3.5, 4, 4)
  doc.text('Ich benenne keinen inländischen Empfangsbevollmächtigten.', L + 7, y)
  y += 7
  doc.setFontSize(8.5).setTextColor(80)
  const opt2 = `Ein an mich ins Ausland gerichtetes Schriftstück gilt einen Monat nach Postaufgabe als bekanntgegeben. Den Nachweis über einen verspäteten bzw. Nichtzugang habe ich zu führen.`
  const opt2Lines = doc.splitTextToSize(opt2, R - L - 7)
  doc.text(opt2Lines, L + 7, y)
  doc.setFontSize(10).setTextColor(0)
  y += opt2Lines.length * 4.5 + 24

  // ── Unterschrift ──
  if (y > 270) y = 270
  doc.setDrawColor(120); doc.setLineWidth(0.3)
  doc.line(L, y, L + 70, y)
  doc.line(R - 75, y, R, y)
  y += 5
  doc.setFontSize(9).setTextColor(110)
  doc.text('Ort, Datum', L, y)
  doc.text('Unterschrift des gesetzlichen Vertreters', R, y, { align: 'right' })
  if (gf) doc.text(`(${gf})`, R, y + 4, { align: 'right' })
  doc.setTextColor(0)

  return doc
}

// ── 3) Einwilligung unverschlüsselte E-Mail (§ 87a AO) ────────────────────────
// variant: 'jur' (Körperschaft) | 'nat' (natürliche Person)
export function buildEinwilligung(client, au, variant = 'jur') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const ed = au?.erfassungsdaten ?? {}
  const g = (k, d = '') => safe(ed[k]) || d
  const isJur = variant !== 'nat'
  const L = 20, R = 190, W = R - L
  let y = 16

  function field(label, value) {
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(0)
    doc.text(label, L, y)
    const vx = L + 44
    doc.text(safe(value), vx, y)
    doc.setDrawColor(150); doc.setLineWidth(0.2); doc.line(vx, y + 1.3, R, y + 1.3)
    y += 8
  }
  function checkbox(text, checked) {
    doc.setDrawColor(0); doc.setLineWidth(0.3)
    doc.rect(L, y - 3.2, 3.6, 3.6)
    if (checked) { doc.setFont('helvetica', 'bold').setFontSize(10); doc.text('X', L + 0.5, y - 0.4) }
    doc.setFont('helvetica', 'normal').setFontSize(9)
    const lines = doc.splitTextToSize(text, W - 7)
    doc.text(lines, L + 6, y)
    y += lines.length * 4.3 + 3
  }
  function para(text, size = 9, gap = 3) {
    doc.setFont('helvetica', 'normal').setFontSize(size).setTextColor(0)
    const lines = doc.splitTextToSize(text, W)
    doc.text(lines, L, y)
    y += lines.length * (size * 0.46) + gap
  }
  function pageFooter(n) {
    doc.setFontSize(7.5).setTextColor(120)
    doc.text('Einwilligung gemäß § 87a Absatz 1 Satz 4 AO', L, 287)
    doc.text(`Seite ${n} von 2`, R, 287, { align: 'right' })
    doc.text('Nr. 605/244 (01.25) OFD NRW - St 31', L, 291)
    doc.setTextColor(0)
  }

  // ── Titel ──
  doc.setFont('helvetica', 'bold').setFontSize(11)
  doc.text(doc.splitTextToSize('Einwilligung in den Versand unverschlüsselter E-Mails durch Finanzbehörden', W), 105, y, { align: 'center' })
  y += 9
  doc.setFontSize(9.5)
  doc.text('gemäß § 87a Abs. 1 Satz 4 Halbsatz 2 der Abgabenordnung (AO)', 105, y, { align: 'center' })
  y += 5
  doc.text(isJur ? '- für Körperschaften -' : '- für Bürgerinnen und Bürger -', 105, y, { align: 'center' })
  y += 8
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(60)
  doc.text('Bitte beachten Sie unbedingt die Hinweise auf der zweiten Seite dieses Formulars.', 105, y, { align: 'center' })
  y += 4
  doc.text('Füllen Sie die Felder bitte leserlich aus. Kreuzen Sie bitte Zutreffendes an.', 105, y, { align: 'center' })
  y += 9
  doc.setTextColor(0)

  const anschrift = [g('adresse_strasse'), g('adresse_plz_ort'), g('adresse_land')].filter(Boolean).join(', ')
  const email = g('ansprechpartner_email')
  const gf = g('geschaeftsfuehrer_name')

  if (isJur) {
    field('Firma:', g('firmenname'))
    field('Anschrift:', anschrift)
    field('Steuernummer:', g('steuernummer'))
    y += 2
    doc.setFont('helvetica', 'bold').setFontSize(9.5)
    doc.text('Gesetzlich vertreten durch', L, y); y += 6
    field('Name, Vorname:', gf)
    field('Geburtsdatum:', deDate(g('geschaeftsfuehrer_geburtsdatum')))
    field('Anschrift:', g('geschaeftsfuehrer_adresse'))
    y += 1
    checkbox('Die gesetzliche Vertretung und deren Umfang sind dem zuständigen Finanzamt bereits bekannt.', false)
    checkbox('Ein Nachweis der gesetzlichen Vertretung liegt bei.', false)
    y += 1
    para('Als gesetzlicher Vertreter der o. g. Firma bitte ich Sie, den zukünftigen Informationsaustausch über folgende E-Mail-Adresse zu führen:', 9, 4)
    field('E-Mail-Adresse:', email)
    checkbox('Es handelt sich um die E-Mail-Adresse der/des steuerlichen Bevollmächtigten der o. g. Firma', false)
  } else {
    doc.setFont('helvetica', 'normal').setFontSize(9.5)
    doc.text(FINANZAMT.name, L, y); y += 4.5
    doc.text(FINANZAMT.strasse, L, y); y += 4.5
    doc.text(FINANZAMT.plzOrt, L, y); y += 8
    field('Name, Vorname:', gf || g('firmenname'))
    field('Anschrift:', anschrift)
    field('Steuernummer:', g('steuernummer'))
    field('Geburtsdatum:', deDate(g('geschaeftsfuehrer_geburtsdatum')))
    field('Identifikationsnummer:', g('idnr'))
    y += 1
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(60)
    doc.text('Bei nicht geschäftsfähigen bzw. beschränkt geschäftsfähigen natürlichen Personen:', L, y); y += 6
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold').setFontSize(9.5)
    doc.text('Gesetzlich vertreten durch', L, y); y += 6
    field('Name, Vorname:', '')
    field('Geburtsdatum:', '')
    field('Anschrift:', '')
    y += 1
    checkbox('Die gesetzliche Vertretung und deren Umfang sind dem zuständigen Finanzamt bereits bekannt.', false)
    checkbox('Ein Nachweis der gesetzlichen Vertretung und – im Fall einer Betreuung – ihre Reichweite liegt bei.', false)
    y += 1
    para('Bitte führen Sie den zukünftigen Informationsaustausch über folgende E-Mail-Adresse:', 9, 4)
    field('E-Mail-Adresse:', email)
    checkbox('Es handelt sich um die E-Mail-Adresse meiner Vertreterin/meines Vertreters bzw. meiner/meines Bevollmächtigten.', false)
  }
  y += 1
  para('Die Überwachung des E-Mail-Postfachs auf Mitteilungen des Finanzamtes liegt in meiner Verantwortung.', 9)
  pageFooter(1)

  // ── Seite 2: Wichtige Hinweise ──
  doc.addPage(); y = 16
  doc.setFont('helvetica', 'bold').setFontSize(11)
  doc.text('Wichtige Hinweise', L, y); y += 7
  para('Das Finanzamt darf nur dann unverschlüsselte E-Mails mit geschützten Daten versenden, wenn die betroffene Person ausdrücklich in die unverschlüsselte Datenübermittlung eingewilligt und einer mit diesem Kommunikationsweg möglicherweise verbundenen Offenbarung ihrer steuerlichen Verhältnisse zugestimmt hat (§ 30 Absatz 4 Nr. 3 und § 87a Absatz 1 Satz 4 Halbsatz 2 AO, Artikel 6 Absatz 1 der Datenschutz-Grundverordnung – DSGVO –).')
  para('Möchten Sie, dass das Finanzamt Ihnen oder der von Ihnen bevollmächtigten Person unverschlüsselte E-Mails übersendet, unterschreiben Sie bitte eigenhändig den vollständig ausgefüllten Vordruck und senden ihn per Post an das Finanzamt. Sie können ihn auch einscannen und die pdf-Datei als Anhang an Ihr zuständiges Finanzamt schicken. Jede Person, deren Daten unverschlüsselt übermittelt werden sollen, muss zuvor eine eigene schriftliche Einwilligungserklärung nach diesem Muster abgeben (insbesondere zusammenveranlagte Personen).')
  para('Diese Einwilligung begründet keinen Anspruch auf unverschlüsselte Kommunikation per E-Mail. Das Finanzamt behält sich vor, auf andere Weise mit Ihnen zu kommunizieren (z. B. per Post). Insbesondere ist die Bekanntgabe von Steuerbescheiden mittels unverschlüsselter E-Mail nicht zulässig.')
  para('Steuererklärungen können nicht per E-Mail an das Finanzamt übermittelt werden. Hierfür steht Ihnen das Portal ELSTER zur Verfügung.')
  y += 2
  para('In Kenntnis aller Hinweise willige ich darin ein, dass das Finanzamt mir oder der von mir bevollmächtigten Person geschützte Daten per unverschlüsselter E-Mail übermitteln darf. Die Einwilligung erstreckt sich auf', 9, 4)
  checkbox('die gesamte elektronisch zulässige Kommunikation  oder', true)
  checkbox('nur auf', false)
  doc.setDrawColor(150); doc.setLineWidth(0.2); doc.line(L + 6, y, R, y); y += 4
  doc.setFontSize(7.5).setTextColor(120)
  doc.text('(Beispiele: Betriebsprüfung, Lohnsteuer-Außenprüfung, Umsatzsteuer-Sonderprüfung)', L + 6, y); y += 6
  doc.setTextColor(0)
  para(`Mir ist bekannt, dass eine unverschlüsselte elektronische Kommunikation nicht sicher ist und eventuell durch Dritte eingesehen und manipuliert werden kann. Die Möglichkeit, dass dadurch meine steuerlichen Sachverhalte${isJur ? ' der von mir vertretenen Firma' : ''} unbefugten Dritten bekannt werden, nehme ich in Kauf.`)
  para('Diese Einwilligung kann ich jederzeit schriftlich (Brief, Fax), per E-Mail oder durch persönlichen Vortrag im Finanzamt widerrufen. Der Widerruf wird erst ab dem Zeitpunkt wirksam, in dem er dem Finanzamt zugeht.')

  // Unterschrift
  y = Math.max(y + 16, 255)
  doc.setDrawColor(40); doc.setLineWidth(0.5)
  doc.line(L, y, L + 70, y)
  doc.line(R - 75, y, R, y)
  y += 5
  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(0)
  doc.text('(Ort, Datum)', L, y)
  doc.text(`Unterschrift${gf ? ' – ' + gf : ''}`, R - 75, y)
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(120)
  y += 5
  doc.text(isJur
    ? 'Bei Körperschaften ist die Einwilligung vom gesetzlichen Vertreter zu unterschreiben.'
    : 'Bei nicht/beschränkt geschäftsfähigen Personen ist die Einwilligung vom gesetzlichen Vertreter zu unterschreiben.', L, y)
  doc.setTextColor(0)
  pageFooter(2)

  return doc
}

// ── Zentraler Dispatcher: art → Dokument ──────────────────────────────────────
export function buildDoc(art, client, au) {
  switch (art) {
    case 'vollmacht':       return buildVollmacht(client, au)
    case 'einwilligung_jur': return buildEinwilligung(client, au, 'jur')
    case 'einwilligung_nat': return buildEinwilligung(client, au, 'nat')
    default:                return buildAntragFinanzamt(client, au)
  }
}

// ── Ausgabe-Helfer ────────────────────────────────────────────────────────────
export function pdfFilename(art, au) {
  const firma = (((au && au.erfassungsdaten) || {}).firmenname || 'Mandant')
    .replace(/[^\wäöüÄÖÜß \-]/g, '').trim().replace(/\s+/g, '_')
  const label = art === 'vollmacht' ? 'Empfangsvollmacht'
    : art === 'einwilligung_jur' ? 'Einwilligung_E-Mail_juristisch'
    : art === 'einwilligung_nat' ? 'Einwilligung_E-Mail_natuerlich'
    : 'Antrag_USt-Registrierung'
  return `${label}_${firma}.pdf`
}

export function downloadPdf(doc, filename) {
  doc.save(filename)
}

// base64 (ohne data:-Präfix) — für E-Mail-Anhänge im anlagen-Format
export function pdfToBase64(doc) {
  const uri = doc.output('datauristring')
  return uri.split(',')[1] || ''
}
