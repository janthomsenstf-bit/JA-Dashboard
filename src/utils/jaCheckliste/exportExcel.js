/* exportExcel.js – erzeugt aus den Blatt-Daten (buildExportSheets) eine
 * formatierte .xlsx-Datei via ExcelJS und laedt sie herunter.
 * Lazy geladen (ExcelJS ist gross, wird nur beim Export gebraucht).
 *
 * Erwartetes Blattformat siehe buildExportSheets in registry.js:
 *   { name, title, sub, cols:[{w,fmt,wrap,align}], freeze, filter, landscape,
 *     rows:[ {t:'head'|'row'|'sub'|'kv'|'total'|'hint'|'kpi'|'spacer', c:[...] } ] }
 * Zellen sind primitiv oder { v, fmt, link, tone, bold }.
 */
import ExcelJS from 'exceljs/dist/exceljs.min.js'

// ── Farben & Formate ─────────────────────────────────────────────────────────
const C = {
  kopf: '1F4E79', kopfText: 'FFFFFF',
  band: 'F2F6FA', linie: 'D6DCE4', abschnitt: 'E8EDF3',
  hinweis: 'FFF8E1', hinweisLinie: 'E0C97F',
}
const TONE = {
  ok:     { fill: 'DCEFD9', text: '1D6F42' },
  offen:  { fill: 'FDF2D0', text: '8A5A00' },
  arbeit: { fill: 'DEEAF6', text: '1F4E79' },
  rueck:  { fill: 'FBE2D5', text: 'A9490F' },
  korr:   { fill: 'FADBD8', text: '9C0006' },
  neutral:{ fill: 'EDEFF2', text: '44464A' },
}
const FMT = {
  eur:  '#,##0.00\\ "€";-#,##0.00\\ "€"',
  eurS: '+#,##0.00\\ "€";-#,##0.00\\ "€";"—"',   // Abweichung, mit Vorzeichen
  int:  '#,##0;-#,##0;"—"',
  pct:  '0.0\\ "%";-0.0\\ "%";"—"',
  text: '@',
}
const STATUS_TONE = { Erledigt: 'ok', Offen: 'offen', 'In Arbeit': 'arbeit', 'Rückfrage': 'rueck', Korrekturbedarf: 'korr' }

const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + argb } })
const rand = (argb, seiten) => { const b = {}, s = { style: 'thin', color: { argb: 'FF' + argb } }
  ;(seiten || ['top', 'left', 'bottom', 'right']).forEach(k => { b[k] = s }); return b }

const clean = s => (String(s == null || s === '' ? 'Blatt' : s).replace(/[\\/?*:[\]']/g, '-').slice(0, 31).trim() || 'Blatt')

// ── ein Blatt schreiben ──────────────────────────────────────────────────────
function schreibeBlatt(ws, s, kopfzeile) {
  const cols = s.cols || []
  const breite = Math.max(cols.length, ...(s.rows || []).map(r => (r.c || []).length), 1)
  ws.columns = Array.from({ length: breite }, (_, i) => ({ width: (cols[i] && cols[i].w) || 14 }))

  let kopfZeilenNr = 0   // Zeile des Tabellenkopfs (fuer Wiederholung im Druck)
  let datenIdx = 0       // fuer die Zebrastreifen

  // Blattueberschrift
  if (s.title) {
    const r = ws.addRow([s.title])
    ws.mergeCells(r.number, 1, r.number, breite)
    r.height = 24
    const c = r.getCell(1)
    c.fill = fill(C.kopf); c.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF' + C.kopfText } }
    c.alignment = { vertical: 'middle', indent: 1 }
    if (s.sub) {
      const r2 = ws.addRow([s.sub])
      ws.mergeCells(r2.number, 1, r2.number, breite)
      r2.height = 17
      const c2 = r2.getCell(1)
      c2.fill = fill(C.abschnitt); c2.font = { name: 'Calibri', size: 10, color: { argb: 'FF44464A' } }
      c2.alignment = { vertical: 'middle', indent: 1 }
    }
    ws.addRow([])
  }

  ;(s.rows || []).forEach(r => {
    const typ = r.t || 'row'
    const zellen = r.c || []

    if (typ === 'spacer') { ws.addRow([]).height = 6; return }

    if (typ === 'kpi') {
      const row = ws.addRow([]); row.height = 34
      let sp = 1
      zellen.forEach(k => {
        const t = TONE[k.tone] || TONE.neutral
        const c = row.getCell(sp)
        c.value = { richText: [
          { text: k.l + '\n', font: { name: 'Calibri', size: 9, color: { argb: 'FF' + t.text } } },
          { text: String(k.v), font: { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF' + t.text } } },
        ] }
        c.fill = fill(t.fill); c.border = rand(C.linie)
        c.alignment = { vertical: 'middle', wrapText: true, indent: 1 }
        ws.mergeCells(row.number, sp, row.number, sp + 1)
        sp += 2
      })
      return
    }

    if (typ === 'hint') {
      const txt = zellen.map(x => (x && x.v != null ? x.v : x)).filter(x => x != null && x !== '').join(' ')
      const row = ws.addRow([txt])
      ws.mergeCells(row.number, 1, row.number, breite)
      const c = row.getCell(1)
      c.fill = fill(C.hinweis); c.border = rand(C.hinweisLinie, ['left'])
      c.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF5C4A12' } }
      c.alignment = { vertical: 'top', wrapText: true, indent: 1 }
      const proZeile = Math.max(60, ws.columns.reduce((a, x) => a + (x.width || 0), 0) - 4)
      row.height = Math.min(90, 13 * Math.max(1, Math.ceil(txt.length / proZeile)))
      return
    }

    if (typ === 'sub') {
      const row = ws.addRow([zellen[0] == null ? '' : zellen[0]])
      ws.mergeCells(row.number, 1, row.number, breite)
      row.height = 19
      const c = row.getCell(1)
      c.fill = fill(C.abschnitt); c.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF1F4E79' } }
      c.alignment = { vertical: 'middle', indent: 1 }
      c.border = rand(C.linie, ['bottom'])
      datenIdx = 0
      return
    }

    if (typ === 'head') {
      const row = ws.addRow(zellen.map(x => (x && x.v !== undefined ? x.v : x)))
      row.height = 26; kopfZeilenNr = row.number; datenIdx = 0
      row.eachCell({ includeEmpty: true }, (c, i) => {
        if (i > breite) return
        c.fill = fill(C.kopf)
        c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF' + C.kopfText } }
        c.alignment = { vertical: 'middle', wrapText: true, horizontal: (cols[i - 1] && cols[i - 1].align) || 'left', indent: 1 }
        c.border = rand(C.linie)
      })
      return
    }

    // kv | row | total
    const roh = x => (x && typeof x === 'object' && 'v' in x ? x.v : x)
    // Breite Blaetter: die Beschriftung eines kv-Paares bekommt mehrere Spalten,
    // sonst schneiden lange Pruefschritt-Texte an der schmalen Spalte B ab.
    let kvSpan = 0
    let werte = zellen.map(roh)
    if ((typ === 'kv' || typ === 'total') && breite > 2 && zellen.length === 2) {
      kvSpan = Math.max(1, Math.min(breite - 1, 3))
      werte = new Array(breite).fill(null)
      werte[0] = roh(zellen[0]); werte[kvSpan] = roh(zellen[1])
    }
    const row = ws.addRow(werte)
    if (kvSpan) {
      if (kvSpan > 1) ws.mergeCells(row.number, 1, row.number, kvSpan)
      if (kvSpan + 1 < breite) ws.mergeCells(row.number, kvSpan + 1, row.number, breite)
    }
    const zebra = typ === 'row' && (datenIdx++ % 2 === 1)
    row.eachCell({ includeEmpty: true }, (c, i) => {
      if (i > breite) return
      const spec = kvSpan ? (i === 1 ? { wrap: true } : { align: 'left' }) : (cols[i - 1] || {})
      const zelle = kvSpan ? (i === 1 ? zellen[0] : (i === kvSpan + 1 ? zellen[1] : null)) : zellen[i - 1]
      const obj = zelle && typeof zelle === 'object' && !Array.isArray(zelle) ? zelle : {}
      const fmt = obj.fmt || spec.fmt

      c.font = { name: 'Calibri', size: 10, bold: !!obj.bold || typ === 'total' || (typ === 'kv' && i === (kvSpan ? kvSpan + 1 : 2)) }
      c.alignment = {
        vertical: 'top',
        wrapText: !!(spec.wrap || obj.wrap),
        horizontal: spec.align || (fmt && fmt !== 'text' ? 'right' : 'left'),
        indent: 1,
      }
      if (fmt && FMT[fmt] && typeof c.value === 'number') {
        c.numFmt = FMT[fmt]
        if (fmt === 'eur' || fmt === 'eurS') c.value = Math.round(c.value * 100) / 100
        if (fmt === 'pct') c.value = Math.round(c.value * 10) / 10
      }

      if (typ === 'kv' && i === 1) c.font = { name: 'Calibri', size: 10, color: { argb: 'FF5A5E66' } }
      if (kvSpan && i > 1 && i !== kvSpan + 1) { c.border = rand(C.linie, ['bottom']); return }

      // Statusspalte einfaerben
      const tone = obj.tone || (fmt === 'status' ? STATUS_TONE[String(c.value)] : null)
      if (tone && TONE[tone]) {
        c.fill = fill(TONE[tone].fill)
        c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF' + TONE[tone].text } }
        c.alignment = { vertical: 'middle', horizontal: 'center' }
      } else if (zebra) c.fill = fill(C.band)

      if (obj.link) c.value = { text: String(obj.v), hyperlink: obj.link }
      if (obj.link) c.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F4E79' }, underline: true }

      if (typ === 'total') c.border = rand(C.linie, ['top', 'bottom'])
      else c.border = rand(C.linie, ['bottom'])
    })
    if (typ === 'total') row.height = 20
  })

  // Fixieren, Filter, Druck
  const fix = s.freeze === true ? kopfZeilenNr : s.freeze
  if (fix) ws.views = [{ state: 'frozen', ySplit: fix }]
  if (s.filter && kopfZeilenNr) {
    const letzte = ws.rowCount
    if (letzte > kopfZeilenNr) ws.autoFilter = { from: { row: kopfZeilenNr, column: 1 }, to: { row: letzte, column: breite } }
  }
  ws.pageSetup = {
    orientation: s.landscape ? 'landscape' : 'portrait',
    fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    paperSize: 9, horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.2, footer: 0.3 },
  }
  if (kopfZeilenNr) ws.pageSetup.printTitlesRow = kopfZeilenNr + ':' + kopfZeilenNr
  ws.headerFooter = {
    oddFooter: '&L&9' + (kopfzeile || '').replace(/&/g, '&&') + '&R&9Seite &P von &N',
  }
}

// ── Alt-Format (reine Zeilen-Arrays) auf das Zeilenformat heben ──────────────
// Der Auftragsexport in GlobalTodoView liefert weiter schlichte Arrays; die
// bekommen hier automatisch Kopfzeile, Spaltenbreiten und Zahlenformate.
const EUR_KOPF = /betrag|saldo|summe|vorjahr|abweichung|zins|restschuld|tilgung|kosten|preis|wert|entnahme|buchwert|umsatz|erlös/i
function normalisiere(s) {
  if (!Array.isArray(s.rows) || !s.rows.length || !Array.isArray(s.rows[0])) return s
  const aoa = s.rows
  const kopf = aoa[0].map(x => (x == null ? '' : String(x)))
  const daten = aoa.slice(1)
  const breite = Math.max(...aoa.map(r => r.length))
  const cols = Array.from({ length: breite }, (_, i) => {
    const werte = daten.map(r => r[i])
    const zahlig = werte.some(v => typeof v === 'number') && werte.every(v => v == null || v === '' || typeof v === 'number')
    const laenge = Math.max(String(kopf[i] || '').length, ...werte.map(v => String(v == null ? '' : v).length), 6)
    if (zahlig) return { w: Math.min(18, Math.max(11, laenge + 3)), fmt: EUR_KOPF.test(kopf[i] || '') ? 'eur' : 'int', align: 'right' }
    return { w: Math.min(46, laenge + 3), wrap: laenge > 34 }
  })
  return { ...s, cols, freeze: true, filter: true, landscape: breite > 6,
    rows: [{ t: 'head', c: kopf }].concat(daten.map(r => ({ t: 'row', c: r }))) }
}

// ── Einstieg ─────────────────────────────────────────────────────────────────
export async function exportSheets(sheets, filename, meta) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'JA-Dashboard'
  wb.created = new Date()

  meta = meta || sheets._meta || {}
  const kopfzeile = [(meta && meta.mandant) || '', (meta && meta.mandantennr) || '', (meta && meta.wj) ? 'WJ ' + meta.wj : '']
    .filter(Boolean).join(' · ')

  const used = {}
  sheets.forEach(s => {
    let name = clean(s.name); let n = name; let i = 2
    while (used[n.toLowerCase()]) { n = clean(name.slice(0, 27) + ' ' + i); i++ }
    used[n.toLowerCase()] = 1
    s._blatt = n
    const ws = wb.addWorksheet(n, { properties: { defaultRowHeight: 15 } })
    schreibeBlatt(ws, normalisiere(s), kopfzeile)
  })

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (filename || 'Arbeitspapier').replace(/[^\w.-]+/g, '_') + '.xlsx'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
