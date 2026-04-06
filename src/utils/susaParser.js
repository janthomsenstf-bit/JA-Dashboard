/**
 * susaParser.js
 * Parst SUSA-Dateien (Excel .xlsx / CSV) und liefert ein normiertes Konten-Array.
 *
 * Unterstützte Spalten (Fuzzy-Matching, case-insensitiv):
 *  Kontonummer : "Konto-Nr.", "Konto", "KtoNr", "Kontonummer"
 *  Bezeichnung : "Bezeichnung", "Kontobezeichnung", "Kto. Bez."
 *  Saldo       : "Saldo", "Endsaldo", "Betrag"
 *  SH-Kz.      : "SH", "S/H", "SHKz", "Soll/Haben"
 *  Soll-Saldo  : "Soll-Saldo", "Soll Saldo", "Soll"
 *  Haben-Saldo : "Haben-Saldo", "Haben Saldo", "Haben"
 */
import * as XLSX from 'xlsx'

// ── Helpers ───────────────────────────────────────────────────────────────────
function norm(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findCol(headers, keywords) {
  const normed = headers.map(norm)
  for (const kw of keywords) {
    const idx = normed.findIndex(h => h.includes(kw))
    if (idx >= 0) return idx
  }
  return -1
}

function parseDE(str) {
  // Parses German-formatted numbers: "15.000,50" → 15000.50 / "15000.50" → 15000.50
  const s = String(str ?? '').trim().replace(/[^0-9,.-]/g, '')
  if (!s) return 0
  // German: punkt = thousands-sep, komma = decimal
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  return parseFloat(s) || 0
}

// ── Saldo-Zelle mit eingebettetem S/H-Kennzeichen parsen ──────────────────────
// Versteht: "1.000,00 H", "1.000,00H", "H 1.000,00", "S1000", "1000", "-1000"
// Gibt { value: number (absolut), embeddedSH: 'S'|'H'|null } zurück
function parseSaldoSH(cellValue) {
  const raw = String(cellValue ?? '').trim().toUpperCase()
  let embeddedSH = null
  let numStr = raw

  // Suffix: "1.000,00 H" oder "1000S"
  const suffixMatch = raw.match(/^([+-]?[\d.,\s]+)\s*([SH])$/)
  if (suffixMatch) {
    embeddedSH = suffixMatch[2]
    numStr = suffixMatch[1].trim()
  } else {
    // Prefix: "H 1.000,00" oder "S1000"
    const prefixMatch = raw.match(/^([SH])\s*([+-]?[\d.,].*)$/)
    if (prefixMatch) {
      embeddedSH = prefixMatch[1]
      numStr = prefixMatch[2]
    }
  }

  return { value: parseDE(numStr), embeddedSH }
}

// ── CSV → rows ────────────────────────────────────────────────────────────────
function csvToRows(text) {
  const lines = text.split(/\r?\n/)
  const delim = lines[0].includes(';') ? ';' : ','
  return lines.map(line =>
    line.split(delim).map(c => c.replace(/^"|"$/g, '').trim())
  )
}

// ── rows → konten array ───────────────────────────────────────────────────────
function rowsToKonten(rows) {
  // Find header row: first row with "konto" keyword
  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const joined = rows[i].join(' ').toLowerCase()
    if (joined.includes('konto') || (joined.includes('nr') && (joined.includes('saldo') || joined.includes('bezeich')))) {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) headerIdx = 0

  const headers = rows[headerIdx].map(h => String(h ?? ''))

  const cKonto      = findCol(headers, ['kontonr', 'kontonummer', 'ktonr', 'konto', 'nr'])
  const cBez        = findCol(headers, ['bezeichnung', 'kontobezeichnung', 'ktobezeichnung', 'ktobez', 'name'])
  const cSaldo      = findCol(headers, ['endsaldo', 'saldo', 'betrag'])
  const cSH         = findCol(headers, ['sh', 'shkz', 'sollhaben'])
  const cSollSaldo  = findCol(headers, ['sollsaldo', 'sollumsatz'])
  const cHabenSaldo = findCol(headers, ['habensaldo', 'habenumsatz'])
  // Fallback: "Soll" and "Haben" as separate columns
  const cSoll       = cSollSaldo >= 0 ? cSollSaldo : findCol(headers, ['soll'])
  const cHaben      = cHabenSaldo >= 0 ? cHabenSaldo : findCol(headers, ['haben'])

  const konten = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row.some(c => String(c ?? '').trim())) continue

    // Kontonummer
    const raw_konto = cKonto >= 0 ? row[cKonto] : row[0]
    const kontonr = String(raw_konto ?? '').trim().replace(/^0+(?=\d{3,})/, '') // strip leading zeros >3 digits
    if (!kontonr || !/^\d{3,}/.test(kontonr)) continue // Skip rows without account numbers

    // Bezeichnung
    const bezeichnung = cBez >= 0 ? String(row[cBez] ?? '').trim() : ''

    // Saldo + S/H-Kennzeichen
    let saldo = 0
    let shkz  = 'S'

    if (cSaldo >= 0) {
      // Saldo-Zelle parsen: erkennt eingebettetes S/H ("1.000,00 H") und Vorzeichen
      const { value, embeddedSH } = parseSaldoSH(row[cSaldo])
      saldo = Math.abs(value)
      // Priorität: 1) separate S/H-Spalte, 2) eingebettetes S/H im Saldo-Feld, 3) Vorzeichen der Zahl
      if (cSH >= 0) {
        const sh = String(row[cSH] ?? '').trim().toUpperCase()
        shkz = sh.startsWith('H') ? 'H' : 'S'
      } else if (embeddedSH) {
        shkz = embeddedSH  // aus Saldo-Zelle extrahiert (z. B. "1.000,00 H")
      } else {
        shkz = value < 0 ? 'H' : 'S'  // negatives Vorzeichen = Haben
      }
    } else if (cSoll >= 0 || cHaben >= 0) {
      const s = cSoll  >= 0 ? parseDE(row[cSoll])  : 0
      const h = cHaben >= 0 ? parseDE(row[cHaben]) : 0
      const diff = s - h
      saldo = Math.abs(diff)
      shkz  = diff >= 0 ? 'S' : 'H'
    }

    // Skip zero-saldo accounts silently (user can toggle)
    konten.push({
      kontonr,
      bezeichnung,
      saldo,
      shkz,
      bereich:    '',          // classified later
      status:     'ungeprueft',
      notiz:      '',
      umbuchung:  '',
    })
  }

  return konten
}

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * parseSUSAFile(file: File) → Promise<{konten, error}>
 * Parst eine SUSA-Datei (Excel oder CSV) und liefert das normierte Konten-Array.
 */
export function parseSUSAFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        let rows
        const isCSV = file.name.toLowerCase().endsWith('.csv')

        if (isCSV) {
          rows = csvToRows(e.target.result)
        } else {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        }

        const konten = rowsToKonten(rows)

        if (konten.length === 0) {
          resolve({ konten: [], error: 'Keine Konten gefunden. Bitte prüfen Sie das Dateiformat.' })
          return
        }

        resolve({ konten, error: null })
      } catch (err) {
        resolve({ konten: [], error: 'Fehler beim Einlesen: ' + err.message })
      }
    }

    reader.onerror = () => resolve({ konten: [], error: 'Datei konnte nicht gelesen werden.' })

    if (file.name.toLowerCase().endsWith('.csv')) {
      reader.readAsText(file, 'latin1')  // DATEV uses ISO-8859-1
    } else {
      reader.readAsArrayBuffer(file)
    }
  })
}
