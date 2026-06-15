// ─────────────────────────────────────────────────────────────────────────────
// gruendungPdf.js — Erzeugt das "Gründungsdatenblatt" für UG- und GmbH-Gründungen
// aus den Auftragsdaten (auftrag.erfassungsdaten), per jsPDF.
// Gleiches Muster wie geschaeftsadressePdf.js / vorratsgesellPdf.js, eigenständig.
// WICHTIG: Reines Vorbereitungs-/Datenblatt — ersetzt KEINE notarielle Beurkundung.
// ─────────────────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf'
import { loadKanzlei } from './ustRegPdf.js'   // nur Briefkopf-Daten wiederverwenden

function safe(s) { return (s == null ? '' : String(s)).trim() }

function deDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(safe(s))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : safe(s)
}

const RECHTSFORM_LABEL = {
  ug:   'UG (haftungsbeschränkt)',
  gmbh: 'GmbH',
}

// Rechtsform aus erfassungsdaten oder – als Fallback – aus dem Auftragstyp ableiten
export function gruendungRechtsform(au) {
  const ed = au?.erfassungsdaten ?? {}
  return safe(ed.g_rechtsform) || (au?.typ === 'gmbh_gruendung' ? 'gmbh' : 'ug')
}

export function buildGruendungsdatenblatt(client, au) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const kanzlei = loadKanzlei()
  const ed = au?.erfassungsdaten ?? {}
  const g = (k, d = '') => safe(ed[k]) || d
  const L = 22, R = 188, W = R - L
  let y = 22

  const rf = gruendungRechtsform(au)
  const rfLabel = RECHTSFORM_LABEL[rf] || rf

  // ── Titel ──
  doc.setFont('helvetica', 'bold').setFontSize(15)
  doc.text(`Gründungsdatenblatt ${rfLabel}`, L, y)
  y += 4
  doc.setDrawColor(150); doc.setLineWidth(0.4); doc.line(L, y, R, y)
  y += 8

  // ── Hinweis-Box (Vorbereitung, ersetzt keine Beurkundung) ──
  doc.setFillColor(255, 247, 230); doc.setDrawColor(217, 119, 6)
  doc.roundedRect(L, y, W, 14, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(140, 70, 0)
  doc.text('Hinweis: Dieses Datenblatt dient ausschließlich der Vorbereitung und Zusammen-', L + 4, y + 5.5)
  doc.text('stellung der Gründungsdaten. Es ersetzt KEINE notarielle Beurkundung.', L + 4, y + 10)
  doc.setTextColor(0)
  y += 22

  function para(text, size = 10, gap = 4, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(0)
    const lines = doc.splitTextToSize(text, W)
    if (y + lines.length * (size * 0.48) > 282) { doc.addPage(); y = 22 }
    doc.text(lines, L, y)
    y += lines.length * (size * 0.48) + gap
  }
  function heading(t) {
    if (y > 270) { doc.addPage(); y = 22 }
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(20)
    doc.text(t, L, y); y += 6
    doc.setTextColor(0)
  }
  function rows(pairs) {
    para(pairs.map(([k, v]) => `${k}: ${v || '—'}`).join('\n'))
  }

  // ── Gesellschaft ──
  heading('1  Gesellschaft')
  rows([
    ['Gewünschter Firmenname', g('g_firmenname')],
    ['Rechtsform', rfLabel],
    ['Sitz', g('g_sitz')],
    ['Geschäftsadresse', g('g_geschaeftsadresse')],
    ['Unternehmensgegenstand', g('g_gegenstand')],
    ['Geschäftsjahr', g('g_geschaeftsjahr')],
  ])

  // ── Gesellschafter ──
  heading('2  Gesellschafter')
  rows([
    ['Name / Firma', g('gs_name')],
    ['Adresse', g('gs_adresse')],
    ['Beteiligung', g('gs_beteiligung') ? g('gs_beteiligung') + ' %' : ''],
    ['Kapitalanteil', g('gs_kapitalanteil')],
    ['E-Mail', g('gs_email')],
  ])
  if (g('gs_weitere')) para(`Weitere Gesellschafter:\n${g('gs_weitere')}`)

  // ── Geschäftsführer ──
  heading('3  Geschäftsführer')
  rows([
    ['Name', g('gf_name')],
    ['Adresse', g('gf_adresse')],
    ['Geburtsdatum', deDate(g('gf_geburtsdatum'))],
    ['E-Mail', g('gf_email')],
    ['Staatsangehörigkeit', g('gf_staat')],
    ['Einzelvertretungsberechtigt', g('gf_einzelvertretung') === 'ja' ? 'ja' : g('gf_einzelvertretung') === 'nein' ? 'nein' : ''],
  ])
  if (g('gf_weitere')) para(`Weitere Geschäftsführer:\n${g('gf_weitere')}`)

  // ── Kapital ──
  heading('4  Kapital')
  rows([
    ['Stammkapital', g('k_stammkapital')],
    ['Einzahlung', g('k_einzahlung')],
    ['Bankkonto', g('k_bankkonto') === 'vorhanden' ? 'vorhanden' : g('k_bankkonto') === 'geplant' ? 'geplant' : ''],
  ])
  if (rf === 'ug') {
    para('Hinweis UG: freies Stammkapital ab 1 €, ausschließlich Bareinlage; gesetzliche Thesaurierungspflicht (25 % des Jahresüberschusses in die Rücklage, bis 25.000 € erreicht sind).', 9, 4)
  } else {
    para('Hinweis GmbH: Stammkapital 25.000 €; bei der Handelsregisteranmeldung müssen mindestens 12.500 € eingezahlt sein.', 9, 4)
  }

  // ── Notar / Ablauf ──
  heading('5  Notar / Ablauf')
  rows([
    ['Notar', g('n_notar')],
    ['Notartermin', deDate(g('n_notartermin'))],
    ['Handelsregister (Amtsgericht)', g('n_handelsregister')],
    ['Steuerliche Erfassung', g('n_steuerl_erfassung')],
    ['Geschäftskonto', g('n_geschaeftskonto')],
  ])

  // ── Fußzeile ──
  if (y > 270) { doc.addPage(); y = 22 }
  y += 6
  doc.setDrawColor(180); doc.setLineWidth(0.3); doc.line(L, y, R, y); y += 5
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(110)
  doc.text(`Erstellt von ${[kanzlei.name, kanzlei.strasse, kanzlei.plzOrt].filter(Boolean).join(', ')}`, L, y)
  doc.setTextColor(0)

  return doc
}

export function gruendungFilename(au) {
  const rf = gruendungRechtsform(au) === 'gmbh' ? 'GmbH' : 'UG'
  const firma = (((au && au.erfassungsdaten) || {}).g_firmenname || 'Gruendung')
    .replace(/[^\wäöüÄÖÜß \-]/g, '').trim().replace(/\s+/g, '_')
  return `Gruendungsdatenblatt_${rf}_${firma}.pdf`
}
