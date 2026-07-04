// ─────────────────────────────────────────────────────────────────────────────
// leistungsnachweisPdf.js — Erzeugt einen Leistungsnachweis (Zeiterfassung) als
// PDF: Datum | Dauer | Tätigkeit + Gesamtsumme. Kann als Anlage zur Rechnung
// dienen. Nutzt jsPDF (manuelle Tabelle, keine Zusatz-Abhängigkeit).
// ─────────────────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf'

const KANZLEI_FALLBACK = {
  name: 'Jan Thomsen',
  strasse: 'Hauptstraße 24a',
  plzOrt: '24986 Mittelangeln',
}

function loadKanzlei() {
  try {
    const raw = localStorage.getItem('kanzlei-profil')
    if (raw) return { ...KANZLEI_FALLBACK, ...JSON.parse(raw) }
  } catch {}
  return KANZLEI_FALLBACK
}

function deDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(s || '')
}

function std(min) {
  return ((min || 0) / 60).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function eur(v) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v || 0)
}

export function downloadPdf(doc, filename) {
  doc.save(filename)
}

export function leistungsnachweisFilename(client) {
  const n = String(client?.name || client?.firma || 'Mandant').replace(/[^\w\-]+/g, '_').slice(0, 40)
  return `Leistungsnachweis_${n}.pdf`
}

export function zeitUebersichtFilename(client) {
  const n = String(client?.name || client?.firma || 'Mandant').replace(/[^\w\-]+/g, '_').slice(0, 40)
  return `Zeituebersicht_${n}.pdf`
}

export function buildLeistungsnachweis(client, eintraege, { satz = 0 } = {}) {
  const k = loadKanzlei()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const M = 20
  let y = M

  // Kanzlei-Kopf
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(String(k.name || ''), M, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  if (k.strasse) { y += 5; doc.text(String(k.strasse), M, y) }
  if (k.plzOrt) { y += 4; doc.text(String(k.plzOrt), M, y) }

  // Titel
  y += 14
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Leistungsnachweis', M, y)
  y += 7
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  const mandant = client?.name || client?.firma || ''
  if (mandant) { doc.text('Mandant: ' + mandant, M, y); y += 6 }

  // Tabellenkopf
  const cDat = M, cArt = M + 24, cTxt = M + 46
  const xStd = 158, xBet = pageW - M
  const txtW = xStd - 12 - cTxt
  y += 4
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('Datum', cDat, y); doc.text('Art', cArt, y); doc.text('Leistung', cTxt, y)
  doc.text('Std', xStd, y, { align: 'right' }); doc.text('Betrag', xBet, y, { align: 'right' })
  y += 2; doc.setLineWidth(0.2); doc.line(M, y, pageW - M, y); y += 5
  doc.setFont('helvetica', 'normal')

  const rows = [...eintraege].sort((a, b) => String(a.datum).localeCompare(String(b.datum)))
  let totalMin = 0, totalBetrag = 0
  rows.forEach(e => {
    const isP = e.art === 'pauschale'
    const betr = isP ? (e.pauschalBetrag || 0) : ((e.dauerMin || 0) / 60) * satz
    totalBetrag += betr
    if (!isP) totalMin += e.dauerMin || 0
    const txt = doc.splitTextToSize(String(e.beschreibung || ''), txtW)
    if (y > 270) { doc.addPage(); y = M }
    doc.text(deDate(e.datum), cDat, y)
    doc.text(isP ? 'Pauschale' : 'Stunden', cArt, y)
    doc.text(txt, cTxt, y)
    doc.text(isP ? '–' : std(e.dauerMin), xStd, y, { align: 'right' })
    doc.text(eur(betr), xBet, y, { align: 'right' })
    y += Math.max(5, txt.length * 4.6)
  })

  // Summe
  y += 2; doc.line(M, y, pageW - M, y); y += 7
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('Gesamt', cDat, y)
  doc.text(std(totalMin), xStd, y, { align: 'right' })
  doc.text(eur(totalBetrag), xBet, y, { align: 'right' })
  if (satz > 0) {
    y += 6
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.text('Stundensatz für Zeithonorare: ' + eur(satz), cTxt, y)
  }
  y += 8
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
  doc.text('Summe (netto): ' + eur(totalBetrag), xBet, y, { align: 'right' })

  // Fuß
  y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text('Erstellt am ' + deDate(new Date().toISOString().slice(0, 10)), M, y)

  return doc
}

// ─────────────────────────────────────────────────────────────────────────────
// buildZeitUebersicht — Vollständige Übersicht ALLER erfassten Zeiten (offen +
// abgerechnet) mit Status-Spalte und Teil-/Gesamtsummen. Rein lesend – verändert
// keine Daten. Ergänzt (ersetzt nicht) den Leistungsnachweis der offenen Zeiten.
// ─────────────────────────────────────────────────────────────────────────────
export function buildZeitUebersicht(client, eintraege, { satz = 0 } = {}) {
  const k = loadKanzlei()
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const M = 20
  let y = M

  // Kanzlei-Kopf
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(String(k.name || ''), M, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  if (k.strasse) { y += 5; doc.text(String(k.strasse), M, y) }
  if (k.plzOrt) { y += 4; doc.text(String(k.plzOrt), M, y) }

  // Titel
  y += 14
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('Zeitübersicht', M, y)
  y += 7
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
  const mandant = client?.name || client?.firma || ''
  if (mandant) { doc.text('Mandant: ' + mandant, M, y); y += 6 }

  // Tabellenkopf
  const cDat = M, cArt = M + 22, cTxt = M + 42
  const xStd = 132, xBet = 166, xStat = pageW - M
  const txtW = xStd - 10 - cTxt
  y += 4
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('Datum', cDat, y); doc.text('Art', cArt, y); doc.text('Leistung', cTxt, y)
  doc.text('Std', xStd, y, { align: 'right' })
  doc.text('Betrag', xBet, y, { align: 'right' })
  doc.text('Status', xStat, y, { align: 'right' })
  y += 2; doc.setLineWidth(0.2); doc.line(M, y, pageW - M, y); y += 5
  doc.setFont('helvetica', 'normal')

  const rows = [...eintraege].sort((a, b) => String(a.datum).localeCompare(String(b.datum)))
  let totalMin = 0, totalBetrag = 0
  let offenMin = 0, offenBetrag = 0, abgerMin = 0, abgerBetrag = 0
  rows.forEach(e => {
    const isP = e.art === 'pauschale'
    const betr = isP ? (e.pauschalBetrag || 0) : ((e.dauerMin || 0) / 60) * satz
    const abg = e.status === 'abgerechnet'
    totalBetrag += betr
    if (!isP) totalMin += e.dauerMin || 0
    if (abg) { abgerBetrag += betr; if (!isP) abgerMin += e.dauerMin || 0 }
    else { offenBetrag += betr; if (!isP) offenMin += e.dauerMin || 0 }
    const txt = doc.splitTextToSize(String(e.beschreibung || ''), txtW)
    if (y > 270) { doc.addPage(); y = M }
    doc.text(deDate(e.datum), cDat, y)
    doc.text(isP ? 'Pauschale' : 'Stunden', cArt, y)
    doc.text(txt, cTxt, y)
    doc.text(isP ? '–' : std(e.dauerMin), xStd, y, { align: 'right' })
    doc.text(eur(betr), xBet, y, { align: 'right' })
    doc.text(abg ? 'abger.' : 'offen', xStat, y, { align: 'right' })
    y += Math.max(5, txt.length * 4.6)
  })

  if (rows.length === 0) {
    doc.setFont('helvetica', 'italic'); doc.text('Keine Zeiteinträge erfasst.', cDat, y)
    doc.setFont('helvetica', 'normal'); y += 6
  }

  // Summen (Teilsummen offen/abgerechnet + Gesamt)
  y += 2; doc.line(M, y, pageW - M, y); y += 7
  const sumLine = (label, min, betrag, bold, size) => {
    if (y > 275) { doc.addPage(); y = M }
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size)
    doc.text(label, cDat, y)
    doc.text(std(min), xStd, y, { align: 'right' })
    doc.text(eur(betrag), xBet, y, { align: 'right' })
    y += 5.5
  }
  sumLine('Offen', offenMin, offenBetrag, false, 9)
  sumLine('Abgerechnet', abgerMin, abgerBetrag, false, 9)
  y += 1
  sumLine('Gesamt', totalMin, totalBetrag, true, 10)

  if (satz > 0) {
    y += 2
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.text('Stundensatz für Zeithonorare: ' + eur(satz), cTxt, y)
  }

  // Fuß
  y += 12
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
  doc.text('Erstellt am ' + deDate(new Date().toISOString().slice(0, 10)), M, y)

  return doc
}
