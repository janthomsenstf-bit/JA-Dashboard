import * as XLSX from 'xlsx'
import {
  calcKFZ1Prozent, calcKFZFahrtenbuch,
  calcVMASingle, calcFahrtkosten, calcReisekostenGesamt,
  fmtEur, fmtPct,
} from './rechnerData.js'
import { MODULE } from './jaCheckliste/registry.js'

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────────
const KFZ_TYP_LABELS = {
  verbrenner:  'Verbrenner – 1,0%',
  hybrid_05:   'Plug-in Hybrid – 0,5%',
  elektro_025: 'Elektro ≤ 70.000 € – 0,25%',
  elektro_05:  'Elektro > 70.000 € – 0,5%',
}

const ART_LABELS = {
  unter8:    'Eintägig < 8h',
  eintaegig: 'Eintägig 8–24h',
  volltag:   'Volltag (24h)',
  anreise:   'Anreisetag',
  abreise:   'Abreisetag',
}

function fmtDate(d) {
  if (!d) return '–'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

function today() {
  return new Date().toLocaleDateString('de-DE')
}

// ─── Gemeinsames Print-CSS ────────────────────────────────────────────────────────
function printStyles() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #222; padding: 20px; }
    h1 { font-size: 14pt; color: #1a3260; border-bottom: 2px solid #1a3260; padding-bottom: 6px; margin-bottom: 4px; }
    h2 { font-size: 11pt; color: #333; margin: 16px 0 8px; }
    .meta { font-size: 9pt; color: #555; margin-bottom: 16px; }
    .meta span { margin-right: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th { background: #e8edf5; text-align: left; padding: 6px 8px; font-size: 9pt; border: 1px solid #ccc; }
    td { padding: 5px 8px; border: 1px solid #ddd; font-size: 9.5pt; }
    .label { color: #555; width: 55%; }
    .value { font-weight: 500; text-align: right; }
    .total td { font-weight: 700; background: #f0f4fb; font-size: 10.5pt; border-top: 2px solid #1a3260; }
    .section-title { background: #f5f7fc; font-weight: 600; color: #1a3260; }
    .muted { color: #888; }
    .footer { margin-top: 24px; font-size: 8pt; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  `
}

function openPrintWindow(html, title) {
  const win = window.open('', '_blank', 'width=850,height=700')
  if (!win) { alert('Bitte Pop-up-Blocker für diese Seite deaktivieren.'); return }
  win.document.write(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>${printStyles()}</style>
</head>
<body>
  ${html}
  <div class="footer">
    Erstellt am ${today()} · Jan's Spielbuch · Alle Angaben ohne Gewähr · Keine Rechtsberatung
  </div>
  <script>window.onload = () => window.print()</script>
</body>
</html>`)
  win.document.close()
}

// ─── KFZ ─────────────────────────────────────────────────────────────────────────
export function exportKFZPrint(item, client) {
  const is1pct = item.methode === '1prozent'
  const res1   = is1pct ? calcKFZ1Prozent(item) : null
  const resFb  = !is1pct ? calcKFZFahrtenbuch(item) : null

  const eingaben = is1pct ? `
    <tr><td class="label">Fahrzeugbezeichnung</td><td class="value">${item.bezeichnung || '–'}</td></tr>
    <tr><td class="label">Fahrzeugtyp</td><td class="value">${KFZ_TYP_LABELS[item.fahrzeugtyp] || '–'}</td></tr>
    <tr><td class="label">Bruttolistenpreis (inkl. MwSt.)</td><td class="value">${fmtEur(item.bruttolistenpreis)}</td></tr>
    <tr><td class="label">Besteuerungssatz</td><td class="value">${fmtPct(res1?.satzProzent)}</td></tr>
    <tr><td class="label">Nutzungsmonate</td><td class="value">${item.monate}</td></tr>
    ${item.pendler ? `<tr><td class="label">Entfernung Wohnung–Arbeitsstätte</td><td class="value">${item.entfernungKm} km</td></tr>` : ''}
  ` : `
    <tr><td class="label">Fahrzeugbezeichnung</td><td class="value">${item.bezeichnung || '–'}</td></tr>
    <tr><td class="label">Gesamt-km</td><td class="value">${Number(item.gesamtkm).toLocaleString('de-DE')} km</td></tr>
    <tr><td class="label">Privat-km (inkl. Wohnung–Arbeit)</td><td class="value">${Number(item.privatkm).toLocaleString('de-DE')} km</td></tr>
    <tr><td class="label">Gesamtkosten Fahrzeug p.a.</td><td class="value">${fmtEur(item.gesamtkosten)}</td></tr>
  `

  const ergebnis = is1pct ? `
    <tr><td class="label">Privatanteil pro Monat</td><td class="value">${fmtEur(res1.privatMonatlich)}</td></tr>
    <tr><td class="label">Privatanteil p.a. (× ${item.monate} Monate)</td><td class="value">${fmtEur(res1.privatJaehrlich)}</td></tr>
    ${item.pendler && res1.pendelJaehrlich > 0 ? `
    <tr><td class="label">Pendelanteil pro Monat (0,03%)</td><td class="value">${fmtEur(res1.pendelMonatlich)}</td></tr>
    <tr><td class="label">Pendelanteil p.a.</td><td class="value">${fmtEur(res1.pendelJaehrlich)}</td></tr>` : ''}
    <tr class="total"><td>Geldwerter Vorteil gesamt p.a.</td><td class="value">${fmtEur(res1.gesamt)}</td></tr>
  ` : `
    <tr><td class="label">Privatquote</td><td class="value">${fmtPct(resFb.privatquote)}</td></tr>
    <tr><td class="label">Betriebliche Quote</td><td class="value">${fmtPct(resFb.betriebsquote)}</td></tr>
    <tr><td class="label">Betriebliche Kosten (abzugsfähig)</td><td class="value">${fmtEur(resFb.betriebskosten)}</td></tr>
    <tr class="total"><td>Privater Kostenanteil (geldwerter Vorteil)</td><td class="value">${fmtEur(resFb.privatkosten)}</td></tr>
  `

  const html = `
    <h1>Steuerliche Berechnung</h1>
    <h2>Privatnutzung Kraftfahrzeug – ${is1pct ? '1%-Methode' : 'Fahrtenbuchmethode'}</h2>
    <div class="meta">
      <span>Mandant: <strong>${client.name}</strong></span>
      <span>Nr. ${client.mandantennummer}</span>
      <span>VJ ${client.veranlagungsjahr}</span>
      <span>Datum: ${fmtDate(item.datum)}</span>
    </div>
    <h2>Eingaben</h2>
    <table><tbody>${eingaben}</tbody></table>
    <h2>Ergebnis</h2>
    <table><tbody>${ergebnis}</tbody></table>
    ${item.notiz ? `<p style="font-size:9pt;color:#555;margin-top:8px"><strong>Notiz:</strong> ${item.notiz}</p>` : ''}
  `
  openPrintWindow(html, `KFZ-Berechnung ${client.name}`)
}

export function exportKFZExcel(item, client) {
  const is1pct = item.methode === '1prozent'
  const res1   = is1pct ? calcKFZ1Prozent(item) : null
  const resFb  = !is1pct ? calcKFZFahrtenbuch(item) : null

  const header = [
    [`Privatnutzung Kraftfahrzeug – ${is1pct ? '1%-Methode' : 'Fahrtenbuch'}`],
    [`Mandant: ${client.name}`, '', `Nr.: ${client.mandantennummer}`, '', `VJ: ${client.veranlagungsjahr}`],
    [`Datum: ${fmtDate(item.datum)}`],
    [],
    ['EINGABEN', ''],
    ['Bezeichnung', item.bezeichnung || '–'],
  ]

  if (is1pct) {
    header.push(
      ['Fahrzeugtyp', KFZ_TYP_LABELS[item.fahrzeugtyp] || '–'],
      ['Bruttolistenpreis (€)', Number(item.bruttolistenpreis) || 0],
      ['Besteuerungssatz (%)', res1?.satzProzent ?? 0],
      ['Nutzungsmonate', Number(item.monate)],
    )
    if (item.pendler) header.push(['Entfernung Wohnung–Arbeit (km)', Number(item.entfernungKm)])
    header.push(
      [],
      ['ERGEBNIS', ''],
      ['Privatanteil/Monat (€)', res1?.privatMonatlich ?? 0],
      ['Privatanteil p.a. (€)', res1?.privatJaehrlich ?? 0],
    )
    if (item.pendler && res1?.pendelJaehrlich > 0) {
      header.push(
        ['Pendelanteil/Monat (€)', res1.pendelMonatlich],
        ['Pendelanteil p.a. (€)', res1.pendelJaehrlich],
      )
    }
    header.push(['Geldwerter Vorteil gesamt p.a. (€)', res1?.gesamt ?? 0])
  } else {
    header.push(
      ['Gesamt-km', Number(item.gesamtkm) || 0],
      ['Privat-km', Number(item.privatkm) || 0],
      ['Gesamtkosten Fahrzeug p.a. (€)', Number(item.gesamtkosten) || 0],
      [],
      ['ERGEBNIS', ''],
      ['Privatquote (%)', resFb?.privatquote ?? 0],
      ['Betriebliche Quote (%)', resFb?.betriebsquote ?? 0],
      ['Betriebliche Kosten (€)', resFb?.betriebskosten ?? 0],
      ['Privater Kostenanteil / GWV p.a. (€)', resFb?.privatkosten ?? 0],
    )
  }

  if (item.notiz) header.push([], ['Notiz', item.notiz])
  header.push([], ['Erstellt am', today()], ['Alle Angaben ohne Gewähr', ''])

  const ws = XLSX.utils.aoa_to_sheet(header)
  ws['!cols'] = [{ wch: 40 }, { wch: 20 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'KFZ-Berechnung')
  XLSX.writeFile(wb, `KFZ_${client.mandantennummer}_${client.veranlagungsjahr}.xlsx`)
}

// ─── Arbeitszimmer ───────────────────────────────────────────────────────────────
// ─── Arbeitszimmer ───────────────────────────────────────────────────────────
// Zahlen kommen aus dem Registry-Modul, nicht aus einer zweiten Rechnung.
// Dadurch stimmen Ausdruck und Dashboard zwangsläufig überein.
function azErgebnis(item) {
  const M = MODULE.arbeitszimmer
  const w = item.werte || {}
  return { M, w, r: M.rechnen(w, {}), felder: typeof M.felder === 'function' ? M.felder({}, w) : (M.felder || []) }
}

function azEingabeZeilen(felder, w) {
  return felder
    .filter(f => f.k !== 'notiz' && (w[f.k] ?? f.def ?? '') !== '')
    .map(f => {
      let v = w[f.k] ?? f.def
      if (f.t === 'select' && f.opt) { const t = f.opt.find(o => o[0] === v); v = t ? t[1] : v }
      else if (f.t === 'num') v = fmtEur(v)
      return [f.l, v]
    })
}

export function exportAZPrint(item, client) {
  const { w, r, felder } = azErgebnis(item)
  const eingaben = azEingabeZeilen(felder, w)
    .map(([l, v]) => `<tr><td class="label">${l}</td><td class="value">${v}</td></tr>`).join('')
  const ergebnis = (r.ergebnisse || [])
    .map(e => `<tr${e.stark ? ' class="total"' : ''}><td class="label${e.stark ? '' : ' muted'}">${e.l}</td><td class="value">${e.v == null ? '' : fmtEur(e.v)}</td></tr>`).join('')
    + `<tr class="total"><td>${r.total?.l || 'Abzugsfähiger Betrag'}</td><td class="value">${fmtEur(r.total?.v ?? 0)}</td></tr>`
  const buchungen = (r.buchungen || [])
    .map(b => `<tr><td class="label muted">${b.s} ${b.st} an ${b.h} ${b.ht}</td><td class="value">${fmtEur(b.betr)}</td></tr>`).join('')
  const hinweise = (r.hinweise || []).map(h => `<li>${h}</li>`).join('')

  const html = `
    <h1>Steuerliche Berechnung</h1>
    <h2>Häusliches Arbeitszimmer</h2>
    <div class="meta">
      <span>Mandant: <strong>${client.name}</strong></span>
      <span>Nr. ${client.mandantennummer}</span>
      <span>VJ ${client.veranlagungsjahr}</span>
      <span>Datum: ${fmtDate(item.datum)}</span>
    </div>
    <h2>Eingaben</h2>
    <table><tbody>${eingaben}</tbody></table>
    <h2>Ergebnis</h2>
    <table><tbody>${ergebnis}</tbody></table>
    ${buchungen ? `<h2>Buchungsvorschlag</h2><table><tbody>${buchungen}</tbody></table>` : ''}
    ${hinweise ? `<h2>Hinweise</h2><ul style="font-size:9pt;color:#555">${hinweise}</ul>` : ''}
    ${item.notiz ? `<p style="font-size:9pt;color:#555;margin-top:8px"><strong>Notiz:</strong> ${item.notiz}</p>` : ''}
  `
  openPrintWindow(html, `Arbeitszimmer ${client.name}`)
}

export function exportAZExcel(item, client) {
  const { w, r, felder } = azErgebnis(item)
  const rows = [
    ['Häusliches Arbeitszimmer'],
    [`Mandant: ${client.name}`, '', `Nr.: ${client.mandantennummer}`, '', `VJ: ${client.veranlagungsjahr}`],
    [`Datum: ${fmtDate(item.datum)}`],
    [],
    ['EINGABEN', ''],
    ['Bezeichnung', item.bezeichnung || '–'],
    ...azEingabeZeilen(felder, w),
    [],
    ['ERGEBNIS', ''],
    ...(r.ergebnisse || []).filter(e => e.v != null).map(e => [e.l, e.v]),
    [r.total?.l || 'Abzugsfähiger Betrag', r.total?.v ?? 0],
  ]
  if ((r.buchungen || []).length) {
    rows.push([], ['BUCHUNGSVORSCHLAG', ''])
    r.buchungen.forEach(b => rows.push([`${b.s} ${b.st} an ${b.h} ${b.ht}`, b.betr]))
  }
  if ((r.hinweise || []).length) {
    rows.push([], ['HINWEISE', ''])
    r.hinweise.forEach(h => rows.push([h, '']))
  }
  if (item.notiz) rows.push([], ['Notiz', item.notiz])
  rows.push([], ['Erstellt am', today()], ['Alle Angaben ohne Gewähr', ''])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 40 }, { wch: 20 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Arbeitszimmer')
  XLSX.writeFile(wb, `Arbeitszimmer_${client.mandantennummer}_${client.veranlagungsjahr}.xlsx`)
}

// ─── Reisekosten ─────────────────────────────────────────────────────────────────
export function exportReisePrint(item, client) {
  const totals = calcReisekostenGesamt(item.reisen)
  const gesamtKm = item.reisen.reduce((s, r) => s + (Number(r.km) || 0), 0)

  const rows = item.reisen.map(r => {
    const vma   = calcVMASingle({ land: r.land, abwesenheitsart: r.abwesenheitsart })
    const fahrt = calcFahrtkosten(r.km)
    const sonst = Number(r.sonstiges) || 0
    return `
      <tr>
        <td>${fmtDate(r.reisedatum)}</td>
        <td>${r.land}</td>
        <td>${ART_LABELS[r.abwesenheitsart] || r.abwesenheitsart}</td>
        <td style="text-align:right">${fmtEur(vma)}</td>
        <td style="text-align:right">${Number(r.km) || 0} km</td>
        <td style="text-align:right">${fmtEur(fahrt)}</td>
        <td style="text-align:right">${fmtEur(sonst)}</td>
        <td style="text-align:right"><strong>${fmtEur(vma + fahrt + sonst)}</strong></td>
      </tr>`
  }).join('')

  const html = `
    <h1>Steuerliche Berechnung</h1>
    <h2>Reisekostenabrechnung</h2>
    <div class="meta">
      <span>Mandant: <strong>${client.name}</strong></span>
      <span>Nr. ${client.mandantennummer}</span>
      <span>VJ ${client.veranlagungsjahr}</span>
    </div>
    <p style="margin-bottom:10px;font-weight:500">${item.bezeichnung || ''}</p>
    <table>
      <thead>
        <tr>
          <th>Datum</th><th>Reiseziel / Land</th><th>Abwesenheitsart</th>
          <th>VMA</th><th>km</th><th>Fahrtkosten</th><th>Sonstiges</th><th>Summe</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr class="total">
          <td colspan="3"><strong>Gesamt</strong></td>
          <td style="text-align:right"><strong>${fmtEur(totals.vma)}</strong></td>
          <td style="text-align:right"><strong>${gesamtKm} km</strong></td>
          <td style="text-align:right"><strong>${fmtEur(totals.fahrt)}</strong></td>
          <td style="text-align:right"><strong>${fmtEur(totals.sonstiges)}</strong></td>
          <td style="text-align:right"><strong>${fmtEur(totals.gesamt)}</strong></td>
        </tr>
      </tfoot>
    </table>
    <table style="margin-top:10px;width:300px;margin-left:auto">
      <tr><td class="label">Verpflegungsmehraufwand</td><td class="value">${fmtEur(totals.vma)}</td></tr>
      <tr><td class="label">Fahrtkosten (${gesamtKm} km × 0,30 €)</td><td class="value">${fmtEur(totals.fahrt)}</td></tr>
      <tr><td class="label">Sonstige Kosten</td><td class="value">${fmtEur(totals.sonstiges)}</td></tr>
      <tr class="total"><td>Erstattungsbetrag gesamt</td><td class="value">${fmtEur(totals.gesamt)}</td></tr>
    </table>
    ${item.notiz ? `<p style="font-size:9pt;color:#555;margin-top:10px"><strong>Notiz:</strong> ${item.notiz}</p>` : ''}
    <p style="font-size:8.5pt;color:#666;margin-top:14px">
      VMA-Pauschalen: Inland gem. § 9 Abs. 4a EStG · Ausland gem. BMF-Schreiben ${new Date().getFullYear()} ·
      Fahrtkosten 0,30 €/km gem. § 9 Abs. 1 Nr. 4a EStG
    </p>
  `
  openPrintWindow(html, `Reisekosten ${client.name}`)
}

export function exportReiseExcel(item, client) {
  const totals  = calcReisekostenGesamt(item.reisen)
  const gesamtKm = item.reisen.reduce((s, r) => s + (Number(r.km) || 0), 0)

  const rows = [
    ['Reisekostenabrechnung'],
    [`Mandant: ${client.name}`, '', `Nr.: ${client.mandantennummer}`, '', `VJ: ${client.veranlagungsjahr}`],
    [`Bezeichnung: ${item.bezeichnung || '–'}`],
    [],
    ['Datum', 'Reiseziel / Land', 'Abwesenheitsart', 'VMA (€)', 'km', 'Fahrtkosten (€)', 'Sonstiges (€)', 'Summe (€)'],
  ]

  for (const r of item.reisen) {
    const vma   = calcVMASingle({ land: r.land, abwesenheitsart: r.abwesenheitsart })
    const fahrt = calcFahrtkosten(r.km)
    const sonst = Number(r.sonstiges) || 0
    rows.push([
      fmtDate(r.reisedatum),
      r.land,
      ART_LABELS[r.abwesenheitsart] || r.abwesenheitsart,
      vma,
      Number(r.km) || 0,
      fahrt,
      sonst,
      vma + fahrt + sonst,
    ])
  }

  rows.push(
    ['GESAMT', '', '', totals.vma, gesamtKm, totals.fahrt, totals.sonstiges, totals.gesamt],
    [],
    ['Verpflegungsmehraufwand (€)', totals.vma],
    [`Fahrtkosten (${gesamtKm} km × 0,30 €)`, totals.fahrt],
    ['Sonstige Kosten (€)', totals.sonstiges],
    ['Erstattungsbetrag gesamt (€)', totals.gesamt],
  )

  if (item.notiz) rows.push([], ['Notiz', item.notiz])
  rows.push([], ['Erstellt am', today()], ['BMF-Pauschalen, alle Angaben ohne Gewähr', ''])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Reisekosten')
  XLSX.writeFile(wb, `Reisekosten_${client.mandantennummer}_${client.veranlagungsjahr}.xlsx`)
}
