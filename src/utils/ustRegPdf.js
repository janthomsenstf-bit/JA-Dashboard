// ─────────────────────────────────────────────────────────────────────────────
// ustRegPdf.js — Erzeugt Anschreiben ans Finanzamt + Vollmacht für die
// umsatzsteuerliche Registrierung (USt-Reg. DE) aus den Antragsdaten eines
// Auftrags. Reine eigene Vorlagen (kein amtliches Formular), per jsPDF.
//
// Verwendung:
//   import { buildAnschreiben, buildVollmacht, downloadPdf, pdfToBase64, pdfFilename } from '...'
//   const doc = buildAnschreiben(client, au)
//   downloadPdf(doc, pdfFilename('anschreiben', au))
// ─────────────────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf'

// Kanzlei-Briefkopf — kann später über Einstellungen (localStorage) gepflegt werden.
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
function ed(au, key) {
  return ((au && au.erfassungsdaten) || {})[key] || ''
}

function fmtDateDE(iso) {
  const d = iso ? new Date(iso) : new Date()
  if (isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

function safe(s) {
  return (s == null ? '' : String(s)).trim()
}

// ── Anschreiben ans Finanzamt ─────────────────────────────────────────────────
export function buildAnschreiben(client, au) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const kanzlei = loadKanzlei()
  const L = 25            // linker Rand
  const R = 185          // rechter Rand (Textbreite ~160mm)
  const W = R - L
  let y = 22

  // ── Briefkopf Kanzlei (klein, oben rechts) ──
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(90)
  const kopf = [kanzlei.name, kanzlei.strasse, kanzlei.plzOrt, kanzlei.telefon ? 'Tel. ' + kanzlei.telefon : '', kanzlei.email].filter(Boolean)
  kopf.forEach((line, i) => doc.text(line, R, y + i * 4, { align: 'right' }))
  doc.setTextColor(0)

  // ── Empfänger ──
  y = 48
  doc.setFontSize(11)
  doc.text('Finanzamt', L, y)
  doc.setFontSize(9).setTextColor(120)
  doc.text('[zuständiges Finanzamt – bitte ergänzen]', L, y + 5)
  doc.setTextColor(0).setFontSize(11)

  // ── Datum ──
  doc.setFontSize(10)
  doc.text(`${safe(kanzlei.plzOrt).split(' ').slice(1).join(' ') || ''}${kanzlei.plzOrt ? ', den ' : 'Datum: '}${fmtDateDE()}`, R, y, { align: 'right' })

  // ── Betreff ──
  y = 76
  doc.setFont('helvetica', 'bold').setFontSize(11)
  const firma = safe(ed(au, 'firmenname')) || safe(client?.name) || '—'
  const betreff = `Steuerliche Erfassung / Umsatzsteuerliche Registrierung in Deutschland`
  doc.text(betreff, L, y)
  doc.setFont('helvetica', 'normal').setFontSize(10)
  doc.text(`Unternehmen: ${firma}${ed(au, 'cvr_nummer') ? '  ·  CVR/Reg.-Nr.: ' + safe(ed(au, 'cvr_nummer')) : ''}`, L, y + 6)

  // ── Anrede + Einleitung ──
  y += 18
  doc.setFontSize(10.5)
  const intro = `Sehr geehrte Damen und Herren,\n\nnamens und im Auftrag des oben genannten Unternehmens beantragen wir die steuerliche Erfassung sowie die Erteilung einer Steuernummer für umsatzsteuerliche Zwecke in Deutschland. Die maßgeblichen Angaben entnehmen Sie bitte der nachfolgenden Aufstellung.`
  const introLines = doc.splitTextToSize(intro, W)
  doc.text(introLines, L, y)
  y += introLines.length * 5 + 4

  // ── Datenblock ──
  const rows = [
    ['Unternehmen', [
      ['Firma', ed(au, 'firmenname')],
      ['CVR-/Handelsregister-Nr.', ed(au, 'cvr_nummer')],
      ['Anschrift', [ed(au, 'adresse_strasse'), ed(au, 'adresse_plz_ort'), ed(au, 'adresse_land')].filter(Boolean).join(', ')],
    ]],
    ['Geschäftsführer / Inhaber', [
      ['Name', ed(au, 'geschaeftsfuehrer_name')],
      ['Geburtsdatum', ed(au, 'geschaeftsfuehrer_geburtsdatum')],
      ['Privatanschrift', ed(au, 'geschaeftsfuehrer_adresse')],
    ]],
    ['Geschäftstätigkeit in Deutschland', [
      ['Tätigkeit', ed(au, 'taetigkeit_beschreibung')],
      ['Beginn der Tätigkeit', ed(au, 'taetigkeit_beginn')],
      ['Art der Umsätze', ed(au, 'umsatz_art')],
      ['Geschätzter Umsatz (1. Jahr)', ed(au, 'umsatz_geschaetzt')],
      ['Geschätzter Umsatz (Folgejahr)', ed(au, 'umsatz_folgejahr')],
      ['Lager / Büro in Deutschland', ed(au, 'lager_in_deutschland')],
      ['Bereits steuerlich registriert', ed(au, 'bereits_registriert')],
    ]],
    ['Bankverbindung', [
      ['IBAN', ed(au, 'bankverbindung_iban')],
    ]],
  ]

  const labelW = 58
  rows.forEach(([gruppe, felder]) => {
    const eff = felder.filter(([, v]) => safe(v))
    if (eff.length === 0) return
    if (y > 260) { doc.addPage(); y = 22 }
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(40)
    doc.text(gruppe, L, y)
    y += 5
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(0)
    eff.forEach(([label, val]) => {
      const valLines = doc.splitTextToSize(safe(val), W - labelW)
      if (y > 275) { doc.addPage(); y = 22 }
      doc.setTextColor(110)
      doc.text(label, L + 2, y)
      doc.setTextColor(0)
      doc.text(valLines, L + labelW, y)
      y += valLines.length * 5 + 1
    })
    y += 3
  })

  // ── Anlagen + Schluss ──
  if (y > 250) { doc.addPage(); y = 22 }
  y += 2
  doc.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(0)
  const schluss = `Eine auf uns lautende Vollmacht sowie eine Passkopie des Geschäftsführers und ein aktueller Registerauszug sind beigefügt. Für Rückfragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen`
  const schlussLines = doc.splitTextToSize(schluss, W)
  doc.text(schlussLines, L, y)
  y += schlussLines.length * 5 + 14
  doc.text(kanzlei.name, L, y)

  y += 10
  doc.setFontSize(9).setTextColor(110)
  doc.text('Anlagen: Vollmacht · Passkopie Geschäftsführer · CVR-Registerauszug', L, y)
  doc.setTextColor(0)

  return doc
}

// ── Vollmacht ─────────────────────────────────────────────────────────────────
export function buildVollmacht(client, au) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const kanzlei = loadKanzlei()
  const L = 25
  const R = 185
  const W = R - L
  let y = 30

  doc.setFont('helvetica', 'bold').setFontSize(18)
  doc.text('Vollmacht', L, y)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(110)
  doc.text('zur Vertretung in steuerlichen Angelegenheiten', L, y + 7)
  doc.setTextColor(0)
  y += 22

  // Vollmachtgeber
  const firma   = safe(ed(au, 'firmenname')) || safe(client?.name) || '—'
  const cvr     = safe(ed(au, 'cvr_nummer'))
  const anschr  = [ed(au, 'adresse_strasse'), ed(au, 'adresse_plz_ort'), ed(au, 'adresse_land')].filter(Boolean).join(', ')
  const gf      = safe(ed(au, 'geschaeftsfuehrer_name'))

  doc.setFont('helvetica', 'bold').setFontSize(10.5)
  doc.text('Vollmachtgeber', L, y); y += 6
  doc.setFont('helvetica', 'normal').setFontSize(10.5)
  const vgLines = doc.splitTextToSize(
    [firma, cvr ? `CVR-/Reg.-Nr.: ${cvr}` : '', anschr, gf ? `vertreten durch: ${gf}` : ''].filter(Boolean).join('\n'),
    W
  )
  doc.text(vgLines, L, y); y += vgLines.length * 5 + 8

  // Bevollmächtigter
  doc.setFont('helvetica', 'bold').setFontSize(10.5)
  doc.text('Bevollmächtigter', L, y); y += 6
  doc.setFont('helvetica', 'normal').setFontSize(10.5)
  const bvLines = doc.splitTextToSize(
    [kanzlei.name, kanzlei.strasse, kanzlei.plzOrt, kanzlei.email].filter(Boolean).join('\n'),
    W
  )
  doc.text(bvLines, L, y); y += bvLines.length * 5 + 10

  // Vollmachtstext
  const text = `Der Bevollmächtigte wird hiermit bevollmächtigt, den Vollmachtgeber in allen steuerlichen Angelegenheiten gegenüber den Finanzbehörden zu vertreten. Die Vollmacht umfasst insbesondere die Beantragung der steuerlichen Erfassung und der umsatzsteuerlichen Registrierung in Deutschland, die Entgegennahme von Steuernummer und USt-IdNr., die Abgabe von Anträgen und Erklärungen sowie den gesamten damit verbundenen Schriftverkehr.`
  const tLines = doc.splitTextToSize(text, W)
  doc.text(tLines, L, y); y += tLines.length * 5 + 22

  // Unterschrift
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
  const label = art === 'vollmacht' ? 'Vollmacht' : 'Anschreiben_Finanzamt'
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
