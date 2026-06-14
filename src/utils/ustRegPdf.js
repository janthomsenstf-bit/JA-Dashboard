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
  name:    'Steuerkanzlei Jan Thomsen',
  strasse: '',
  plzOrt:  '',
  telefon: '',
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

// Fixe Standardvorgaben des Formulars (überschreibbar über erfassungsdaten)
export const ANTRAG_DEFAULTS = {
  fa_betriebsart:      'Website-Verkäufe',
  fa_inland_besteht:   '-',
  fa_finanzamt_ertrag: 'Flensburg',
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
    ['9. Beginn der unternehmerischen Betätigung in Deutschland', g('taetigkeit_beginn')],
    ['10.1 Lieferung ohne Montage an Unternehmer mit ID-Nr.', g('fa_10_1')],
    ['10.2 Lieferung ohne Montage an Kunden ohne ID-Nr.', g('fa_10_2')],
    ['10.3 Ein- und Verkauf innerhalb Deutschlands', g('fa_10_3')],
    ['10.4 Innergemeinschaftliche steuerfreie Lieferungen (Einfuhr aus Drittland, Ausfuhr in anderes EU-Land)', g('fa_10_4')],
    ['11. Geht der Lieferung ein freiwilliges innergemeinschaftliches Verbringen voraus?', g('fa_11')],
    ['12. Lieferung mit Montage (Werklieferungen) oder reine sonstige Leistungen (z. B. Dienstleistungen) an:', g('fa_12')],
    ['13. Ausländische Subunternehmer beschäftigt, deren Steuer Sie nach § 13b (2) UStG schulden?', g('fa_13')],
    ['14. Wird eine Umsatzsteuer-Identifikationsnummer benötigt?', g('fa_14', ANTRAG_DEFAULTS.fa_14)],
    ['14.1 Wenn ja, wofür?', g('fa_14_1', ANTRAG_DEFAULTS.fa_14_1)],
    ['15.1 Höhe des Umsatzes (geschätzt) in Deutschland im laufenden Jahr in EUR', g('umsatz_geschaetzt')],
    ['15.2 Höhe des Umsatzes (geschätzt) in Deutschland im kommenden Jahr in EUR', g('umsatz_folgejahr')],
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

  // Unterschrift
  y += 12
  if (y > 285) { doc.addPage(); y = 30 }
  doc.setDrawColor(120); doc.setLineWidth(0.3)
  doc.line(L, y, R, y)
  y += 5
  doc.setFontSize(9).setTextColor(110)
  doc.text('Datum, Ort', L, y)
  doc.text('Unterschrift', R, y, { align: 'right' })
  doc.setTextColor(0)

  return doc
}

// ── 2) Vollmacht ──────────────────────────────────────────────────────────────
export function buildVollmacht(client, au) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const kanzlei = loadKanzlei()
  const ed = au?.erfassungsdaten ?? {}
  const g = (k, def = '') => safe(ed[k]) || def
  const L = 25, R = 185, W = R - L
  let y = 30

  doc.setFont('helvetica', 'bold').setFontSize(18)
  doc.text('Vollmacht', L, y)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(110)
  doc.text('zur Vertretung in steuerlichen Angelegenheiten', L, y + 7)
  doc.setTextColor(0)
  y += 22

  const firma  = g('firmenname') || safe(client?.name) || '—'
  const cvr    = g('cvr_nummer')
  const anschr = [g('adresse_strasse'), g('adresse_plz_ort'), g('adresse_land')].filter(Boolean).join(', ')
  const gf     = g('geschaeftsfuehrer_name')

  doc.setFont('helvetica', 'bold').setFontSize(10.5)
  doc.text('Vollmachtgeber', L, y); y += 6
  doc.setFont('helvetica', 'normal').setFontSize(10.5)
  const vgLines = doc.splitTextToSize(
    [firma, cvr ? `CVR-/Reg.-Nr.: ${cvr}` : '', anschr, gf ? `vertreten durch: ${gf}` : ''].filter(Boolean).join('\n'),
    W
  )
  doc.text(vgLines, L, y); y += vgLines.length * 5 + 8

  doc.setFont('helvetica', 'bold').setFontSize(10.5)
  doc.text('Bevollmächtigter', L, y); y += 6
  doc.setFont('helvetica', 'normal').setFontSize(10.5)
  const bvLines = doc.splitTextToSize(
    [kanzlei.name, kanzlei.strasse, kanzlei.plzOrt, kanzlei.email].filter(Boolean).join('\n'),
    W
  )
  doc.text(bvLines, L, y); y += bvLines.length * 5 + 10

  const text = `Der Bevollmächtigte wird hiermit bevollmächtigt, den Vollmachtgeber in allen steuerlichen Angelegenheiten gegenüber den Finanzbehörden zu vertreten. Die Vollmacht umfasst insbesondere die Beantragung der steuerlichen Erfassung und der umsatzsteuerlichen Registrierung in Deutschland, die Entgegennahme von Steuernummer und USt-IdNr., die Abgabe von Anträgen und Erklärungen sowie den gesamten damit verbundenen Schriftverkehr.`
  const tLines = doc.splitTextToSize(text, W)
  doc.text(tLines, L, y); y += tLines.length * 5 + 22

  doc.setDrawColor(120)
  doc.line(L, y, L + 70, y)
  doc.line(R - 70, y, R, y)
  y += 5
  doc.setFontSize(9).setTextColor(110)
  doc.text('Ort, Datum', L, y)
  doc.text(`Unterschrift${gf ? ' (' + gf + ')' : ''}`, R - 70, y)
  doc.setTextColor(0)

  return doc
}

// ── Ausgabe-Helfer ────────────────────────────────────────────────────────────
export function pdfFilename(art, au) {
  const firma = (((au && au.erfassungsdaten) || {}).firmenname || 'Mandant')
    .replace(/[^\wäöüÄÖÜß \-]/g, '').trim().replace(/\s+/g, '_')
  const label = art === 'vollmacht' ? 'Vollmacht' : 'Antrag_USt-Registrierung'
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
