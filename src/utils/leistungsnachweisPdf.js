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
