/* exportExcel.js – erzeugt aus den Blatt-Daten (buildExportSheets) eine echte
 * .xlsx-Datei via SheetJS und lädt sie herunter. Lazy geladen (xlsx ist groß). */
import * as XLSX from 'xlsx'

const clean = s => String(s || 'Blatt').replace(/[\\/?*:[\]]/g, ' ').slice(0, 31) || 'Blatt'

export function exportSheets(sheets, filename) {
  const wb = XLSX.utils.book_new()
  const used = {}
  sheets.forEach(s => {
    let name = clean(s.name); let n = name; let i = 2
    while (used[n.toLowerCase()]) { n = clean(name.slice(0, 28) + ' ' + i); i++ }
    used[n.toLowerCase()] = 1
    const ws = XLSX.utils.aoa_to_sheet(s.rows || [[]])
    XLSX.utils.book_append_sheet(wb, ws, n)
  })
  XLSX.writeFile(wb, (filename || 'Arbeitspapier').replace(/[^\w.-]+/g, '_') + '.xlsx')
}
