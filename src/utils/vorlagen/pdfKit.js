// ─────────────────────────────────────────────────────────────────────────────
// pdfKit.js — Gemeinsame Zeichen-Helfer für Mandanten-Vorlagen (Vollmachten,
// Einwilligungen, Anträge). Alle Vorlagen nutzen dieselben Helfer, damit
// Schrift, Kästen und Abstände über alle Formulare hinweg gleich aussehen.
//
// Einheiten: Millimeter, DIN A4 (210 × 297). Schrift: Helvetica (≙ Arial der
// amtlichen Vordrucke). Die Standardwerte (Schriftgrade, Zeilen- und
// Zeilenhöhen) sind aus den Original-Vordrucken ausgemessen – Vorlagen können
// sie pro Aufruf überschreiben.
// ─────────────────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf'

// Seitenraster wie in den amtlichen Vordrucken (OFD-Formulare)
export const PAGE = {
  L:  23,      // linker Rand (Kästen/Tabellen)
  R:  198,     // rechter Rand (Kästen/Tabellen)
  TEXT_R: 194, // rechter Rand für Fließtext
  CX: 110.5,   // optische Mitte des Satzspiegels
}

// Grundschriftgrade des Vordrucks
export const SCHRIFT = { text: 12, klein: 8, fuss: 7.1, titel: 13 }
export const ZEILE = { text: 4.9, titel: 5.3 }

export function neuesDokument() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setFont('helvetica', 'normal').setFontSize(SCHRIFT.text).setTextColor(0)
  return doc
}

export const txt = v => (v == null ? '' : String(v)).trim()

/** ISO (YYYY-MM-DD) → DD.MM.YYYY; alles andere unverändert zurück. */
export function deDatum(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(txt(v))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : txt(v)
}

export function heuteDE() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

/** Zentrierter Titelblock (mehrere Zeilen), fett. @returns Grundlinie der letzten Zeile */
export function titel(doc, zeilen, y, { size = SCHRIFT.titel, lh = ZEILE.titel } = {}) {
  const z = zeilen.filter(Boolean)
  doc.setFont('helvetica', 'bold').setFontSize(size).setTextColor(0)
  z.forEach((t, i) => doc.text(t, PAGE.CX, y + i * lh, { align: 'center' }))
  doc.setFont('helvetica', 'normal').setFontSize(SCHRIFT.text)
  return y + (z.length - 1) * lh
}

/** Kasten mit zentriertem, fettem Hinweistext (wie „Bitte beachten Sie …"). */
export function hinweisKasten(doc, zeilen, y, { size = SCHRIFT.text, lh = 5.6, padY = 0.7 } = {}) {
  const h = zeilen.length * lh + 2 * padY + 1.4
  doc.setDrawColor(0).setLineWidth(0.4).rect(PAGE.L, y, PAGE.R - PAGE.L, h)
  doc.setFont('helvetica', 'bold').setFontSize(size).setTextColor(0)
  zeilen.forEach((t, i) => doc.text(t, PAGE.CX, y + padY + 4.0 + i * lh, { align: 'center' }))
  doc.setFont('helvetica', 'normal').setFontSize(SCHRIFT.text)
  return y + h
}

/**
 * Adressfeld-Kasten (z. B. für das zuständige Finanzamt). Ohne `zeilen` bleibt
 * er leer und wird von Hand ausgefüllt.
 */
export function leerKasten(doc, y, { breite = 110, hoehe = 24, zeilen = [], size = SCHRIFT.text, lh = 5.6 } = {}) {
  doc.setDrawColor(0).setLineWidth(0.4).rect(PAGE.L, y, breite, hoehe)
  const gefuellt = zeilen.map(txt).filter(Boolean)
  if (gefuellt.length) {
    doc.setFont('helvetica', 'normal').setFontSize(size).setTextColor(0)
    gefuellt.slice(0, 4).forEach((z, i) => doc.text(z, PAGE.L + 3, y + 7 + i * lh, { maxWidth: breite - 6 }))
    doc.setFontSize(SCHRIFT.text)
  }
  return y + hoehe
}

/**
 * Beschriftete Tabelle: [['Firma:', 'Muster GmbH'], …]
 * Eine Zeile mit nur einem Eintrag wird als durchgehende Kopfzeile gezeichnet.
 * @returns Unterkante der Tabelle
 */
export function feldTabelle(doc, zeilen, y, {
  labelBreite = 59.7, zeilenHoehe = 6.45, size = SCHRIFT.text, padX = 1.2, basisAbstand = 1.75,
} = {}) {
  const W = PAGE.R - PAGE.L
  doc.setDrawColor(0).setLineWidth(0.3).setFontSize(size)
  zeilen.forEach(([label, wert]) => {
    doc.rect(PAGE.L, y, W, zeilenHoehe)
    const basis = y + zeilenHoehe - basisAbstand
    doc.setTextColor(0).text(txt(label), PAGE.L + padX, basis)
    if (wert !== undefined) {
      doc.line(PAGE.L + labelBreite, y, PAGE.L + labelBreite, y + zeilenHoehe)
      const w = txt(wert)
      if (w) {
        const platz = W - labelBreite - 2 * padX
        let ausgabe = w
        while (doc.getTextWidth(ausgabe) > platz && ausgabe.length > 4) ausgabe = ausgabe.slice(0, -2)
        doc.text(ausgabe, PAGE.L + labelBreite + padX, basis)
      }
    }
    y += zeilenHoehe
  })
  doc.setFontSize(SCHRIFT.text)
  return y
}

/**
 * Ankreuzfeld mit umbrechendem Text rechts daneben.
 * @returns Grundlinie unterhalb der letzten Textzeile
 */
export function ankreuzZeile(doc, text, y, {
  gesetzt = false, size = SCHRIFT.text, lh = ZEILE.text, einzug = 0,
  boxGroesse = 4.9, textEinzug = 10, rechts = PAGE.R,
} = {}) {
  const x = PAGE.L + einzug
  doc.setDrawColor(0).setLineWidth(0.4).rect(x, y - boxGroesse + 1.2, boxGroesse, boxGroesse)
  if (gesetzt) {
    doc.setFont('helvetica', 'bold').setFontSize(size)
    doc.text('X', x + 0.8, y)
    doc.setFont('helvetica', 'normal')
  }
  doc.setFontSize(size).setTextColor(0)
  const zeilen = doc.splitTextToSize(text, rechts - (x + textEinzug))
  doc.text(zeilen, x + textEinzug, y)
  doc.setFontSize(SCHRIFT.text)
  return y + (zeilen.length - 1) * lh
}

/** Fließtext-Absatz. @returns Grundlinie der letzten Zeile */
export function absatz(doc, text, y, {
  size = SCHRIFT.text, lh = ZEILE.text, links = PAGE.L, rechts = PAGE.TEXT_R, fett = false,
} = {}) {
  doc.setFont('helvetica', fett ? 'bold' : 'normal').setFontSize(size).setTextColor(0)
  const zeilen = doc.splitTextToSize(text, rechts - links)
  doc.text(zeilen, links, y)
  doc.setFont('helvetica', 'normal').setFontSize(SCHRIFT.text)
  return y + (zeilen.length - 1) * lh
}

/**
 * Umrandeter Textkasten mit Überschrift und mehreren Absätzen
 * (Block „Wichtige Hinweise" der amtlichen Vordrucke).
 * @returns Unterkante des Kastens
 */
export function textKasten(doc, { ueberschrift = '', absaetze = [] }, y, {
  size = SCHRIFT.text, lh = ZEILE.text, padX = 1.2, padOben = 4.0, padUnten = 2.9,
  textBreite = 172, absatzAbstand = 2.4,
} = {}) {
  doc.setFontSize(size)
  doc.setFont('helvetica', 'bold')
  const kopf = ueberschrift ? doc.splitTextToSize(ueberschrift, textBreite) : []
  doc.setFont('helvetica', 'normal')
  const bloecke = absaetze.map(a => doc.splitTextToSize(a, textBreite))
  const alle = [...(kopf.length ? [kopf] : []), ...bloecke]

  const hoehe = padOben + padUnten
    + alle.reduce((s, b) => s + b.length * lh, 0)
    + Math.max(0, alle.length - 1) * absatzAbstand
    - lh + 1.5

  doc.setDrawColor(0).setLineWidth(0.4).rect(PAGE.L, y, PAGE.R - PAGE.L, hoehe)

  let ty = y + padOben
  alle.forEach((b, i) => {
    doc.setFont('helvetica', i === 0 && kopf.length ? 'bold' : 'normal')
    doc.text(b, PAGE.L + padX, ty)
    ty += b.length * lh + absatzAbstand
  })
  doc.setFont('helvetica', 'normal').setFontSize(SCHRIFT.text)
  return y + hoehe
}

/** Ausfülllinie mit optionaler Beschriftung darunter. */
export function linie(doc, y, { von = PAGE.L, bis = PAGE.TEXT_R, label = '', size = SCHRIFT.text, staerke = 0.4 } = {}) {
  doc.setDrawColor(0).setLineWidth(staerke).line(von, y, bis, y)
  if (label) {
    doc.setFontSize(size).setTextColor(0)
    doc.text(label, von, y + 5.4)
    doc.setFontSize(SCHRIFT.text)
  }
  return y
}

/** Zwei Unterschriftslinien nebeneinander (Ort/Datum links, Unterschrift rechts). */
export function unterschriftsZeile(doc, y, {
  linksLabel = '(Ort, Datum)', rechtsLabel = 'Unterschrift', zusatz = '',
  linksBis = 83, rechtsVon = 97, rechtsBis = PAGE.TEXT_R, size = SCHRIFT.text,
} = {}) {
  doc.setDrawColor(0).setLineWidth(0.4)
  doc.line(PAGE.L, y, linksBis, y)
  doc.line(rechtsVon, y, rechtsBis, y)
  doc.setFontSize(size).setTextColor(0)
  doc.text(linksLabel, PAGE.L, y + 5.4)
  doc.text(rechtsLabel, rechtsVon + 1, y + 5.4)
  if (zusatz) {
    doc.setFontSize(SCHRIFT.klein).setTextColor(110)
    doc.text(zusatz, rechtsVon + 1, y + 9.6)
    doc.setTextColor(0)
  }
  doc.setFontSize(SCHRIFT.text)
  return y + (zusatz ? 10 : 6)
}

/** Fußzeile im Stil der amtlichen Vordrucke (links Quelle, rechts Seitenangabe). */
export function fusszeile(doc, { links = [], rechts = '' } = {}) {
  doc.setFont('helvetica', 'normal').setFontSize(SCHRIFT.fuss).setTextColor(0)
  links.forEach((z, i) => doc.text(z, PAGE.L, 286.6 + i * 2.9))
  if (rechts) doc.text(rechts, PAGE.TEXT_R, 289.5, { align: 'right' })
  doc.setFontSize(SCHRIFT.text)
}

/** Dateiname säubern (Buchstaben inkl. ä/ö/ü/ø/æ/å bleiben, Sonderzeichen raus). */
export function dateinameSauber(s) {
  return txt(s).replace(/[^\p{L}\p{N} _-]/gu, '').trim().replace(/\s+/g, '_') || 'Mandant'
}

export { jsPDF }
