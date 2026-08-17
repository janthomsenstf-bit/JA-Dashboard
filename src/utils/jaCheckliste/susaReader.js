/*
 * susaReader.js – liest eine SuSa/Kontenabstimmliste (.xlsx/.xls/.csv) und liefert
 * Zeilen [{ konto, bez, saldo, vj }]. Nutzt die vorhandene xlsx-Bibliothek.
 *
 * Zwei Eigenheiten des Stotax-Exports, die hier abgefangen werden:
 *
 * 1. Es tragen viele Spalten eine Jahreszahl — neben „Saldo Dez 2024" auch
 *    „Monatswert Dez 2024 S/H" und „EB-Wert 2024". Als Saldenspalten zählen
 *    deshalb nur Überschriften, die mit „Saldo" beginnen; Monats-, EB- und
 *    Abweichungsspalten sind ausgeschlossen, und je Jahr zählt nur die erste
 *    Spalte. (Vorher wurde als Vorjahr der Monatswert Dezember des LAUFENDEN
 *    Jahres gewählt — jede Vorjahresabweichung war damit falsch.)
 *
 * 2. Beträge stehen immer POSITIV; die Richtung steht in eigenen Spalten S / H
 *    direkt hinter der Wertspalte. Ohne sie kommt jedes Habenkonto mit falschem
 *    Vorzeichen an (Erlöse positiv). Soll bleibt positiv, Haben wird negativ.
 *
 * Formate ohne S-/H-Spalten (eigene Exporte, CSV) laufen unverändert durch.
 */
import * as XLSX from 'xlsx'
import { parseKontenText } from './registry.js'

const isKonto = v => /^\d{2,8}$/.test(String(v == null ? '' : v).trim())

/* Zahl aus Zelle. Deutsches Format nur, wenn ein Komma vorkommt — sonst würde
   der Punkt in 10577995.49 als Tausenderpunkt verschwinden. Wie registry.num(). */
const zahl = v => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return isFinite(v) ? v : null
  let t = String(v).trim().replace(/[\s€]/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(t)
  return isFinite(n) ? n : null
}

const fmt = v => {
  if (v == null || v === '') return ''
  const n = zahl(v)
  if (n == null) return String(v).trim()
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

function bestSheet(wb) {
  let best = null, score = -1
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    let s = 0
    for (const r of rows.slice(0, 300)) for (const c of r) if (isKonto(c)) s++
    if (s > score) { score = s; best = ws }
  }
  return best
}

/*
 * Richtungsspalten hinter einer Wertspalte erkennen. Zwei verbreitete Formen:
 *   „Saldo Dez 2024" | „S" | „H"   → zwei getrennte Spalten
 *   „Saldo Dez 2024" | „S/H"       → eine gemeinsame Spalte
 * Rückgabe: { soll, haben } | { gemeinsam } | null (Format ohne Richtungsspalten).
 */
function findeRichtungsspalten(hdr, c) {
  const t = i => String(hdr[i] == null ? '' : hdr[i]).trim().toLowerCase()
  if (/^s\s*\/?-?\s*h$/.test(t(c + 1))) return { gemeinsam: c + 1 }
  if (t(c + 1) === 's' && t(c + 2) === 'h') return { soll: c + 1, haben: c + 2 }
  if (t(c + 1) === 's') return { soll: c + 1 }
  if (t(c + 1) === 'h') return { haben: c + 1 }
  return null
}

/* Betrag mit Vorzeichen: Soll positiv, Haben negativ. */
function wertMitRichtung(row, c, richtung) {
  const n = zahl(row[c])
  if (n == null) return ''
  if (!richtung) return fmt(n)
  const lies = i => String(row[i] == null ? '' : row[i]).trim().toUpperCase()
  let haben = false
  if (richtung.gemeinsam != null) {
    haben = lies(richtung.gemeinsam) === 'H'
  } else {
    const s = richtung.soll != null ? lies(richtung.soll) : ''
    const h = richtung.haben != null ? lies(richtung.haben) : ''
    haben = h === 'H' || (h !== '' && s === '')
  }
  return fmt(haben ? -Math.abs(n) : Math.abs(n))
}

export function rowsFromWorkbook(wb) {
  const ws = bestSheet(wb); if (!ws) return []
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  // Header-Zeile mit „Konto" finden
  let hdrIdx = -1
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    if (rows[i].some(v => /^konto/i.test(String(v || '').trim()))) { hdrIdx = i; break }
  }

  let kCol = -1, bCol = -1, sCol = -1, vCol = -1
  let sRicht = null, vRicht = null

  if (hdrIdx >= 0) {
    const hdr = rows[hdrIdx]
    const saldoSpalten = []

    hdr.forEach((cell, c) => {
      const h = String(cell || '').toLowerCase().trim()
      if (/^konto/.test(h) && kCol < 0) kCol = c
      else if (/beschrift|bezeichn|kontenname|kontobezeichnung/.test(h) && bCol < 0) bCol = c

      const ym = h.match(/(20\d\d)/)
      if (!ym) return
      if (!/^saldo\b/.test(h)) return
      if (/abw|monatswert|eb-?\s*wert|vortrag/.test(h)) return
      saldoSpalten.push({ c, year: +ym[1] })
    })

    // Fallback für fremde Exporte ohne „Saldo <Jahr>"-Überschrift:
    // wie bisher jede Wertspalte mit Jahreszahl zulassen (ohne Abweichungsspalten).
    if (!saldoSpalten.length) {
      hdr.forEach((cell, c) => {
        const h = String(cell || '').toLowerCase().trim()
        const ym = h.match(/(20\d\d)/)
        if (ym && /saldo|betrag|wert/.test(h) && !/abw/.test(h)) saldoSpalten.push({ c, year: +ym[1] })
      })
    }

    // Je Jahr nur die erste Spalte; absteigend sortiert ist das neueste der Saldo.
    saldoSpalten.sort((a, b) => b.year - a.year || a.c - b.c)
    const jeJahr = []
    for (const s of saldoSpalten) if (!jeJahr.some(x => x.year === s.year)) jeJahr.push(s)

    if (jeJahr[0]) { sCol = jeJahr[0].c; sRicht = findeRichtungsspalten(hdr, sCol) }
    if (jeJahr[1]) { vCol = jeJahr[1].c; vRicht = findeRichtungsspalten(hdr, vCol) }
  }

  if (kCol < 0) kCol = 1
  if (bCol < 0) bCol = 2
  if (sCol < 0) sCol = 3

  const out = []
  const start = hdrIdx >= 0 ? hdrIdx + 1 : 0
  for (let i = start; i < rows.length; i++) {
    const r = rows[i]
    const konto = String(r[kCol] == null ? '' : r[kCol]).trim()
    if (!isKonto(konto)) continue
    out.push({
      konto,
      bez: String(r[bCol] == null ? '' : r[bCol]).trim(),
      saldo: wertMitRichtung(r, sCol, sRicht),
      vj: vCol >= 0 ? wertMitRichtung(r, vCol, vRicht) : '',
    })
  }
  return out
}

export async function readSusaFile(file) {
  if (/\.(csv|txt)$/i.test(file.name)) {
    const text = await file.text()
    return parseKontenText(text)
  }
  const buf = new Uint8Array(await file.arrayBuffer())
  const wb = XLSX.read(buf, { type: 'array' })
  return rowsFromWorkbook(wb)
}
