/*
 * susaReader.js – liest eine SuSa/Kontenabstimmliste (.xlsx/.xls/.csv) und liefert
 * Zeilen [{ konto, bez, saldo, vj }]. Nutzt die vorhandene xlsx-Bibliothek.
 * Spaltenerkennung wie im Prototyp: Header-Zeile mit „Konto"; Wertspalten „Saldo 20xx"
 * → höchstes Jahr = Saldo, zweithöchstes = Vorjahr. Fallback B/C/D.
 */
import * as XLSX from 'xlsx'
import { parseKontenText } from './registry.js'

const isKonto = v => /^\d{2,8}$/.test(String(v == null ? '' : v).trim())
const fmt = v => { if (v == null || v === '') return ''; const n = +String(v).replace(',', '.'); return isNaN(n) ? String(v).trim() : String(Math.round(n * 100) / 100).replace('.', ',') }

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

export function rowsFromWorkbook(wb) {
  const ws = bestSheet(wb); if (!ws) return []
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  // Header-Zeile mit „Konto" finden
  let hdrIdx = -1
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    if (rows[i].some(v => /^konto/i.test(String(v || '').trim()))) { hdrIdx = i; break }
  }
  let kCol = -1, bCol = -1, sCol = -1, vCol = -1
  if (hdrIdx >= 0) {
    const hdr = rows[hdrIdx]; const years = []
    hdr.forEach((cell, c) => { const h = String(cell || '').toLowerCase().trim()
      if (/^konto/.test(h) && kCol < 0) kCol = c
      else if (/beschrift|bezeichn|kontenname|kontobezeichnung/.test(h) && bCol < 0) bCol = c
      const ym = h.match(/(20\d\d)/); if (ym && /saldo|betrag|wert/.test(h)) years.push({ c, year: +ym[1] }) })
    years.sort((a, b) => b.year - a.year)
    if (years[0]) sCol = years[0].c; if (years[1]) vCol = years[1].c
  }
  if (kCol < 0) kCol = 1; if (bCol < 0) bCol = 2; if (sCol < 0) sCol = 3
  const out = []
  const start = hdrIdx >= 0 ? hdrIdx + 1 : 0
  for (let i = start; i < rows.length; i++) {
    const r = rows[i]; const konto = String(r[kCol] == null ? '' : r[kCol]).trim()
    if (!isKonto(konto)) continue
    out.push({ konto, bez: String(r[bCol] == null ? '' : r[bCol]).trim(), saldo: fmt(r[sCol]), vj: vCol >= 0 ? fmt(r[vCol]) : '' })
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
