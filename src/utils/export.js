import { calculateProgress } from './progress.js'

function formatDate(d) {
  if (!d) return '–'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

function buildText(client, summary) {
  const pct = calculateProgress(client)
  const lines = []
  lines.push('='.repeat(60))
  lines.push(`MANDANTENAKTE – ${client.name}`)
  lines.push('='.repeat(60))
  lines.push(`Mandantennummer:   ${client.mandantennummer}`)
  lines.push(`Veranlagungsjahr:  ${client.veranlagungsjahr}`)
  lines.push(`Rechtsform:        ${client.rechtsform}`)
  lines.push(`Gewinnermittlung:  ${client.gewinnermittlung}`)
  lines.push(`Gesamtfortschritt: ${pct}%`)
  lines.push('')

  lines.push('── RÜCKFRAGEN ──────────────────────────────────────────────')
  if (client.rueckfragen.length === 0) {
    lines.push('(keine Rückfragen)')
  } else {
    client.rueckfragen.forEach((r, i) => {
      const status = r.beantwortet ? `beantwortet am ${formatDate(r.beantwortetAm)}` : 'offen'
      lines.push(`${i + 1}. [${r.beantwortet ? 'X' : ' '}] ${r.text}`)
      lines.push(`   Status: ${status}`)
    })
  }
  lines.push('')

  lines.push('── BEARBEITUNGSSCHRITTE ─────────────────────────────────────')
  lines.push(`StE an Mandanten gesendet:   ${formatDate(client.steGesendetDatum)}`)
  lines.push(`Unterschrift erhalten:       ${formatDate(client.unterschriftDatum)}`)
  lines.push(`FA-Übermittlung geplant:     ${formatDate(client.faGeplantDatum)}`)
  lines.push(`FA übermittelt:              ${client.faUebermittelt ? `Ja, am ${formatDate(client.faUebermitteltDatum)}` : 'Nein'}`)
  lines.push('')

  lines.push('── ERINNERUNGEN ─────────────────────────────────────────────')
  if (client.erinnerungen.length === 0) {
    lines.push('(keine Erinnerungen)')
  } else {
    client.erinnerungen.forEach(e => {
      lines.push(`[${formatDate(e.datum)}] ${e.text}`)
    })
  }
  lines.push('')

  lines.push('── NOTIZEN ──────────────────────────────────────────────────')
  lines.push(client.notizen || '(keine Notizen)')
  lines.push('')

  if (summary) {
    lines.push('── ZUSAMMENFASSUNG / HINWEISE FÜR FOLGEJAHR ─────────────────')
    lines.push(summary)
    lines.push('')
  }

  lines.push('='.repeat(60))
  lines.push(`Exportiert am: ${new Date().toLocaleDateString('de-DE')}`)
  lines.push('='.repeat(60))

  return lines.join('\n')
}

export function exportAsTXT(client, summary) {
  const content = buildText(client, summary)
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${client.mandantennummer}_${client.name.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_')}_${client.veranlagungsjahr}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportAsWord(client, summary) {
  const pct = calculateProgress(client)
  const rqRows = client.rueckfragen.map(r => `
    <tr>
      <td>${r.beantwortet ? '✔' : '○'}</td>
      <td>${r.text}</td>
      <td>${r.beantwortet ? `<span style="color:green">Beantwortet am ${formatDate(r.beantwortetAm)}</span>` : '<span style="color:red">Offen</span>'}</td>
    </tr>`).join('')
  const erRows = client.erinnerungen.map(e => `
    <tr><td>${formatDate(e.datum)}</td><td>${e.text}</td></tr>`).join('')

  const html = `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>Mandantenakte ${client.name}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #222; }
    h1 { font-size: 15pt; border-bottom: 2px solid #333; padding-bottom: 6px; }
    h2 { font-size: 12pt; border-bottom: 1px solid #ccc; margin-top: 18px; color: #444; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
    th { background: #f0f0f0; text-align: left; padding: 6px 8px; font-size: 10pt; }
    td { padding: 5px 8px; border-bottom: 1px solid #e0e0e0; font-size: 10pt; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 14px; }
    .meta-label { color: #666; font-size: 9pt; }
    .meta-value { font-weight: bold; }
    .progress-bar { height: 10px; background: #e0e0e0; border-radius: 5px; overflow: hidden; }
    .progress-fill { height: 100%; background: ${pct >= 100 ? '#22c55e' : pct >= 60 ? '#eab308' : pct >= 30 ? '#f97316' : '#ef4444'}; width: ${pct}%; }
  </style>
</head>
<body>
  <h1>Mandantenakte – ${client.name}</h1>
  <table>
    <tr><th>Mandantennummer</th><td class="mono">${client.mandantennummer}</td>
        <th>Veranlagungsjahr</th><td>${client.veranlagungsjahr}</td></tr>
    <tr><th>Rechtsform</th><td>${client.rechtsform}</td>
        <th>Gewinnermittlung</th><td>${client.gewinnermittlung}</td></tr>
    <tr><th>Gesamtfortschritt</th><td colspan="3">
      <div class="progress-bar"><div class="progress-fill"></div></div>
      <strong>${pct}%</strong>
    </td></tr>
  </table>

  <h2>Rückfragen</h2>
  ${client.rueckfragen.length === 0 ? '<p><em>Keine Rückfragen vorhanden.</em></p>' : `
  <table>
    <tr><th width="30">✔</th><th>Rückfrage</th><th>Status</th></tr>
    ${rqRows}
  </table>`}

  <h2>Bearbeitungsschritte</h2>
  <table>
    <tr><th>Schritt</th><th>Datum / Status</th></tr>
    <tr><td>StE an Mandanten gesendet</td><td>${formatDate(client.steGesendetDatum)}</td></tr>
    <tr><td>Unterschrift / VE erhalten</td><td>${formatDate(client.unterschriftDatum)}</td></tr>
    <tr><td>FA-Übermittlung geplant</td><td>${formatDate(client.faGeplantDatum)}</td></tr>
    <tr><td>FA übermittelt</td><td>${client.faUebermittelt ? `<strong style="color:green">Ja, am ${formatDate(client.faUebermitteltDatum)}</strong>` : '<span style="color:red">Nein</span>'}</td></tr>
  </table>

  <h2>Erinnerungen</h2>
  ${client.erinnerungen.length === 0 ? '<p><em>Keine Erinnerungen.</em></p>' : `
  <table>
    <tr><th>Datum</th><th>Text</th></tr>
    ${erRows}
  </table>`}

  <h2>Notizen</h2>
  <p style="white-space: pre-wrap">${client.notizen || '<em>Keine Notizen.</em>'}</p>

  ${summary ? `<h2>Zusammenfassung / Hinweise für Folgejahr</h2>
  <p style="white-space: pre-wrap; background: #f9f9f9; padding: 10px; border-left: 3px solid #4f8ef7">${summary}</p>` : ''}

  <p style="margin-top: 24px; color: #888; font-size: 9pt; border-top: 1px solid #ccc; padding-top: 8px">
    Exportiert am ${new Date().toLocaleDateString('de-DE')} | Jan's Spielbuch
  </p>
</body>
</html>`

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${client.mandantennummer}_${client.name.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_')}_${client.veranlagungsjahr}.doc`
  a.click()
  URL.revokeObjectURL(url)
}
