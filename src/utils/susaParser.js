// ── susaParser.js ─────────────────────────────────────────────────────────────
// Parst eine Excel-Datei (SuSa / BWA) und liefert normalisierte Kontendaten.
import * as XLSX from 'xlsx'
import {
  detectKontenrahmen, detectGewinnermittlung,
  getBlockForKonto, getErwarteteSeiteFuerBlock,
} from './susaKontenConfig.js'

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function normalizeNum(val) {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return val
  const s = String(val).trim().replace(/\s/g, '')
  if (s.match(/^-?\d{1,3}(\.\d{3})*(,\d+)?$/)) return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  if (s.match(/^-?\d{1,3}(,\d{3})*(\.\d+)?$/)) return parseFloat(s.replace(/,/g, ''))
  const n = parseFloat(s.replace(',', '.'))
  return isNaN(n) ? null : n
}

function isKontoNr(val) {
  if (val === null || val === undefined || val === '') return false
  const s = String(val).trim()
  if (!/^\d{3,6}$/.test(s)) return false
  const n = parseInt(s, 10)
  return n >= 100 && n <= 99999
}

function isNumericValue(val) {
  if (typeof val === 'number') return Math.abs(val) > 0.001
  if (typeof val === 'string') {
    const n = normalizeNum(val)
    return n !== null && Math.abs(n) > 0.001
  }
  return false
}

function isSHIndicator(val) {
  const s = String(val ?? '').trim().toUpperCase()
  return s === 'S' || s === 'H' || s === 'SOLL' || s === 'HABEN'
}

function normalizeSH(val) {
  const s = String(val ?? '').trim().toUpperCase()
  if (s === 'S' || s === 'SOLL') return 'S'
  if (s === 'H' || s === 'HABEN') return 'H'
  return null
}

function isSummRow(row) {
  return row.some(c => {
    const t = String(c ?? '').toLowerCase()
    return t === 'summe' || t === 'gesamt' || t === 'total' || t === 'sum' ||
           t.startsWith('summe ') || t.startsWith('gesamt ')
  })
}

// ── Bestes Sheet finden ───────────────────────────────────────────────────────

function detectBestSheet(workbook) {
  let bestSheet = null, bestScore = 0
  for (const name of workbook.SheetNames) {
    const ws   = workbook.Sheets[name]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    let score  = 0
    for (const row of rows.slice(0, 200)) {
      for (const cell of row) { if (isKontoNr(cell)) score++ }
    }
    if (score > bestScore) { bestScore = score; bestSheet = ws }
  }
  return bestSheet
}

// ── Spalten-Erkennung ─────────────────────────────────────────────────────────

function detectColumns(rows) {
  const dataRows = rows.filter(r => r.some(isKontoNr)).slice(0, 40)
  if (dataRows.length === 0) return null

  const maxCols = Math.max(...dataRows.map(r => r.length), 0)
  const kontoSc = new Array(maxCols).fill(0)
  const numSc   = new Array(maxCols).fill(0)
  const textSc  = new Array(maxCols).fill(0)
  const shSc    = new Array(maxCols).fill(0)

  for (const row of dataRows) {
    for (let c = 0; c < row.length; c++) {
      const v = row[c]
      if (isKontoNr(v))         kontoSc[c]++
      else if (isNumericValue(v)) numSc[c]++
      else if (isSHIndicator(v)) shSc[c]++
      else if (typeof v === 'string' && v.trim().length > 3) textSc[c]++
    }
  }

  const kontoCol = kontoSc.indexOf(Math.max(...kontoSc))
  if (kontoSc[kontoCol] === 0) return null

  let bezCol = -1
  for (let c = 0; c < maxCols; c++) {
    if (c !== kontoCol && textSc[c] > 1) { bezCol = c; break }
  }

  const hasSHCol = Math.max(...shSc) >= dataRows.length * 0.3
  const shCol    = hasSHCol ? shSc.indexOf(Math.max(...shSc)) : -1

  const numCols = []
  for (let c = 0; c < maxCols; c++) {
    if (c !== kontoCol && c !== shCol && numSc[c] >= dataRows.length * 0.25) {
      numCols.push({ col: c, score: numSc[c] })
    }
  }
  numCols.sort((a, b) => b.score - a.score)

  let saldoSollCol = -1, saldoHabenCol = -1, saldoCol = -1

  if (numCols.length >= 4) {
    saldoSollCol  = numCols[numCols.length - 2].col
    saldoHabenCol = numCols[numCols.length - 1].col
  } else if (numCols.length === 2) {
    saldoSollCol  = numCols[0].col
    saldoHabenCol = numCols[1].col
  } else if (numCols.length === 3) {
    saldoCol = numCols[numCols.length - 1].col
  } else if (numCols.length === 1) {
    saldoCol = numCols[0].col
  }

  return { kontoCol, bezCol, saldoSollCol, saldoHabenCol, saldoCol, shCol }
}

// ── Haupt-Parser ──────────────────────────────────────────────────────────────

export async function parseSusaFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data     = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        resolve(parseSusaWorkbook(workbook, file.name))
      } catch (err) {
        reject(new Error('Fehler beim Parsen: ' + err.message))
      }
    }
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'))
    reader.readAsArrayBuffer(file)
  })
}

function parseSusaWorkbook(workbook, dateiname) {
  const sheet = detectBestSheet(workbook)
  if (!sheet) throw new Error('Kein geeignetes Tabellenblatt gefunden.')

  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  const colMap  = detectColumns(allRows)
  if (!colMap) throw new Error('Spaltenstruktur konnte nicht erkannt werden.')

  const raw = []

  for (const row of allRows) {
    if (!isKontoNr(row[colMap.kontoCol])) continue
    if (isSummRow(row)) continue

    const nrRaw       = String(row[colMap.kontoCol]).trim()
    const nr          = nrRaw.padStart(4, '0').replace(/^0+(\d{4,})$/, '$1')
    const bezeichnung = colMap.bezCol >= 0 ? String(row[colMap.bezCol] ?? '').trim() : ''

    let saldo = 0, seite = null

    if (colMap.saldoSollCol >= 0 && colMap.saldoHabenCol >= 0) {
      const s = Math.abs(normalizeNum(row[colMap.saldoSollCol]) ?? 0)
      const h = Math.abs(normalizeNum(row[colMap.saldoHabenCol]) ?? 0)
      if (s > h)    { saldo = s; seite = 'S' }
      else if (h > 0) { saldo = h; seite = 'H' }
    } else if (colMap.saldoCol >= 0) {
      const v = normalizeNum(row[colMap.saldoCol]) ?? 0
      saldo   = Math.abs(v)
      if (colMap.shCol >= 0) seite = normalizeSH(row[colMap.shCol])
      else seite = v >= 0 ? 'S' : 'H'
    }

    if (saldo < 0.01) continue
    raw.push({ nr, bezeichnung, saldo, seite })
  }

  if (raw.length === 0) throw new Error('Keine Konten mit Saldo > 0 gefunden.')

  const kontenrahmen     = detectKontenrahmen(raw)
  const gewinnermittlung = detectGewinnermittlung(raw, kontenrahmen)

  const konten = raw.map(k => {
    const { block, konfidenz } = getBlockForKonto(k.nr, kontenrahmen)
    const seite = k.seite ?? getErwarteteSeiteFuerBlock(block) ?? 'S'
    return {
      nr: k.nr, bezeichnung: k.bezeichnung, saldo: k.saldo, seite,
      block, blockManual: null, konfidenz,
      status: 'offen', notiz: '', rueckfragen: [], umbuchungen: [],
    }
  }).sort((a, b) => parseInt(a.nr) - parseInt(b.nr))

  return { konten, kontenrahmen, gewinnermittlung, dateiname }
}

// ── Import-Statistiken ────────────────────────────────────────────────────────

export function buildImportStats(parseResult) {
  const { konten, kontenrahmen, gewinnermittlung } = parseResult
  const blockCount = {}, unsicher = []
  let sicherN = 0
  for (const k of konten) {
    blockCount[k.block] = (blockCount[k.block] ?? 0) + 1
    if (k.konfidenz === 'unbekannt' || k.block === 'unsicher') unsicher.push(k)
    else sicherN++
  }
  return { total: konten.length, sicherN, unsicher, blockCount, kontenrahmen, gewinnermittlung }
}
