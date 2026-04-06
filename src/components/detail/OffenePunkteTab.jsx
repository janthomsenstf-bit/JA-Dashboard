import * as XLSX from 'xlsx'

// ─── Export-Hilfsfunktionen ───────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '–'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

function today() {
  return new Date().toLocaleDateString('de-DE')
}

function printStyles() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #222; padding: 20px; }
    h1 { font-size: 14pt; color: #1a3260; border-bottom: 2px solid #1a3260; padding-bottom: 6px; margin-bottom: 4px; }
    h2 { font-size: 11pt; color: #333; margin: 16px 0 6px; }
    .meta { font-size: 9pt; color: #555; margin-bottom: 16px; }
    .meta span { margin-right: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th { background: #e8edf5; text-align: left; padding: 6px 8px; font-size: 9pt; border: 1px solid #ccc; }
    td { padding: 5px 8px; border: 1px solid #ddd; font-size: 9.5pt; vertical-align: top; }
    .status-open   { color: #c0392b; font-weight: 600; }
    .status-done   { color: #27ae60; }
    .status-overdue { color: #e67e22; font-weight: 600; }
    .footer { margin-top: 24px; font-size: 8pt; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
    @media print { body { padding: 0; } }
  `
}

function openPrintWindow(html, title) {
  const win = window.open('', '_blank', 'width=850,height=700')
  if (!win) { alert('Bitte Pop-up-Blocker für diese Seite deaktivieren.'); return }
  win.document.write(`<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><title>${title}</title>
<style>${printStyles()}</style></head>
<body>${html}
<div class="footer">Erstellt am ${today()} · Jan's Spielbuch · Alle Angaben ohne Gewähr</div>
<script>window.onload = () => window.print()</script>
</body></html>`)
  win.document.close()
}

const STEP_LABELS = [
  ['inBearbeitung',            'In Bearbeitung',                                 (c) => !!c.inBearbeitung],
  ['rueckfragenSendungen',     'Rückfragen an Mandant gesendet',                 (c) => Array.isArray(c.rueckfragenSendungen) ? c.rueckfragenSendungen.some(Boolean) : !!c.rueckfragenGesendetDatum],
  ['abschlussFertig',          'Abschluss fertig',                               (c) => !!c.abschlussFertig],
  ['steGesendetDatum',         'Abschluss an Mandant zur Unterschrift gesendet', (c) => !!c.steGesendetDatum],
  ['faUebermittelt',           'Abschluss an Finanzamt gesendet',                (c) => !!c.faUebermittelt],
]

function exportPDF(client) {
  const openRQ     = client.rueckfragen.filter(r => !r.beantwortet)
  const todayStr   = new Date().toISOString().slice(0, 10)
  const overdueEr  = (client.erinnerungen || []).filter(e => e.datum < todayStr)
  const openSteps  = STEP_LABELS.filter(([, , done]) => !done(client))

  const rqRows = openRQ.length
    ? openRQ.map(r => `<tr><td class="status-open">offen</td><td>${r.text}</td><td>${r.buchungskonto || '–'}</td></tr>`).join('')
    : '<tr><td colspan="3" style="color:#888">Keine offenen Rückfragen</td></tr>'

  const stepRows = openSteps.length
    ? openSteps.map(([, label]) => `<tr><td class="status-open">ausstehend</td><td>${label}</td></tr>`).join('')
    : '<tr><td colspan="2" style="color:#888">Alle Schritte abgeschlossen ✓</td></tr>'

  const erRows = overdueEr.length
    ? overdueEr.map(e => `<tr><td class="status-overdue">${fmtDate(e.datum)}</td><td>${e.text}</td></tr>`).join('')
    : '<tr><td colspan="2" style="color:#888">Keine fälligen Erinnerungen</td></tr>'

  const html = `
    <h1>Offene Punkte</h1>
    <div class="meta">
      <span>Mandant: <strong>${client.name}</strong></span>
      <span>Nr. ${client.mandantennummer}</span>
      <span>VJ ${client.veranlagungsjahr}</span>
      <span>Stand: ${today()}</span>
    </div>

    <h2>Offene Rückfragen (${openRQ.length})</h2>
    <table><thead><tr><th>Status</th><th>Rückfrage</th><th>Gesendet am</th></tr></thead>
    <tbody>${rqRows}</tbody></table>

    <h2>Ausstehende Bearbeitungsschritte (${openSteps.length})</h2>
    <table><thead><tr><th>Status</th><th>Schritt</th></tr></thead>
    <tbody>${stepRows}</tbody></table>

    <h2>Fällige Erinnerungen (${overdueEr.length})</h2>
    <table><thead><tr><th>Datum</th><th>Erinnerung</th></tr></thead>
    <tbody>${erRows}</tbody></table>
  `
  openPrintWindow(html, `Offene Punkte – ${client.name}`)
}

function exportExcel(client) {
  const todayStr   = new Date().toISOString().slice(0, 10)
  const openRQ     = client.rueckfragen.filter(r => !r.beantwortet)
  const overdueEr  = (client.erinnerungen || []).filter(e => e.datum < todayStr)
  const openSteps  = STEP_LABELS.filter(([, , done]) => !done(client))

  const rows = [
    ['Offene Punkte'],
    [`Mandant: ${client.name}`, '', `Nr.: ${client.mandantennummer}`, '', `VJ: ${client.veranlagungsjahr}`],
    [`Stand: ${today()}`],
    [],
    ['OFFENE RÜCKFRAGEN', `${openRQ.length} offen`],
    ['Status', 'Rückfrage', 'Buchungskonto'],
    ...openRQ.map(r => ['offen', r.text, r.buchungskonto || '–']),
    ...(openRQ.length === 0 ? [['–', 'Keine offenen Rückfragen', '']] : []),
    [],
    ['AUSSTEHENDE BEARBEITUNGSSCHRITTE', `${openSteps.length} ausstehend`],
    ['Status', 'Schritt'],
    ...openSteps.map(([, label]) => ['ausstehend', label]),
    ...(openSteps.length === 0 ? [['–', 'Alle Schritte abgeschlossen ✓']] : []),
    [],
    ['FÄLLIGE ERINNERUNGEN', `${overdueEr.length} fällig`],
    ['Datum', 'Erinnerung'],
    ...overdueEr.map(e => [fmtDate(e.datum), e.text]),
    ...(overdueEr.length === 0 ? [['–', 'Keine fälligen Erinnerungen']] : []),
    [],
    ['Erstellt am', today()],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 20 }, { wch: 60 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Offene Punkte')
  XLSX.writeFile(wb, `OffenePunkte_${client.mandantennummer}_${client.veranlagungsjahr}.xlsx`)
}

// ─── Komponente ───────────────────────────────────────────────────────────────
export default function OffenePunkteTab({
  client,
  onUpdate,
  onToggleRueckfrage,
  onDeleteRueckfrage,
  onUpdateRueckfrageDate,
  onUpdateRueckfrageBuchungskonto,
}) {
  const todayStr  = new Date().toISOString().slice(0, 10)
  const openRQ    = client.rueckfragen.filter(r => !r.beantwortet)
  const doneRQ    = client.rueckfragen.filter(r => r.beantwortet)
  const overdueEr = (client.erinnerungen || []).filter(e => e.datum < todayStr)
  const openSteps = STEP_LABELS.filter(([, , done]) => !done(client))
  const totalOpen = openRQ.length + openSteps.length + overdueEr.length

  return (
    <div className="tab-content">

      {/* Header mit Export-Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>
            Offene Punkte
            {totalOpen > 0 && (
              <span style={{
                marginLeft: '8px', background: 'var(--red-dim)', color: '#fca5a5',
                borderRadius: '20px', padding: '2px 9px', fontSize: '12px',
              }}>
                {totalOpen} offen
              </span>
            )}
            {totalOpen === 0 && (
              <span style={{
                marginLeft: '8px', background: 'var(--green-dim)', color: '#86efac',
                borderRadius: '20px', padding: '2px 9px', fontSize: '12px',
              }}>
                alles erledigt ✓
              </span>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
            Stand: {new Date().toLocaleDateString('de-DE')} · Mandant {client.mandantennummer} · VJ {client.veranlagungsjahr}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => exportPDF(client)}>📄 PDF</button>
          <button className="btn btn-ghost btn-sm" onClick={() => exportExcel(client)}>📊 Excel</button>
        </div>
      </div>

      {/* ── Offene Rückfragen ─────────────────────────────────────────────────── */}
      <div className="section-card">
        <div className="section-card-title">
          <span>Offene Rückfragen</span>
          {openRQ.length > 0
            ? <span className="badge badge-red">{openRQ.length} offen</span>
            : <span className="badge badge-green">alle beantwortet</span>
          }
        </div>

        {openRQ.length === 0 && (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '4px 0 8px' }}>
            Keine offenen Rückfragen ✓
          </div>
        )}

        {openRQ.map(rq => (
          <div key={rq.id} className="rueckfrage-item">
            <div className="rueckfrage-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="rueckfrage-text">{rq.text}</span>
                {rq.buchungskonto && (
                  <span className="rq-konto-badge">Kto. {rq.buchungskonto}</span>
                )}
              </div>
              <div className="rueckfrage-meta" style={{ marginTop: '5px', gap: '10px' }}>
                {/* Buchungskonto bearbeitbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Buchungskonto:</span>
                  <input
                    type="text"
                    placeholder="z. B. 1000"
                    value={rq.buchungskonto ?? ''}
                    onChange={e => onUpdateRueckfrageBuchungskonto(rq.id, e.target.value)}
                    style={{ width: '90px', padding: '2px 6px', fontSize: '11px' }}
                  />
                </div>
                {/* Erledigt-Checkbox */}
                <label className="rq-erledigt-label">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={e => onToggleRueckfrage(rq.id, e.target.checked)}
                  />
                  <span>Erledigt</span>
                </label>
              </div>
            </div>
            <button
              className="rueckfrage-delete"
              onClick={() => onDeleteRueckfrage(rq.id)}
              title="Rückfrage löschen"
            >✕</button>
          </div>
        ))}

        {/* 4 Sendedaten */}
        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
            Rückfragen gesendet am
          </div>
          {(client.rueckfragenSendungen ?? ['', '', '', '']).map((d, i) => (
            <div key={i} className="rq-sendung-row" style={{ marginBottom: '5px' }}>
              <span className="rq-sendung-label">{i + 1}.</span>
              <input
                type="date"
                style={{ maxWidth: '160px' }}
                value={d || ''}
                onChange={e => {
                  const arr = [...(client.rueckfragenSendungen ?? ['', '', '', ''])]
                  arr[i] = e.target.value || ''
                  onUpdate({ rueckfragenSendungen: arr })
                }}
              />
              {d && <span className="badge badge-orange" style={{ fontSize: '10px' }}>gesendet {fmtDate(d)}</span>}
            </div>
          ))}
        </div>

        {/* Beantwortete Rückfragen (eingeklappt) */}
        {doneRQ.length > 0 && (
          <details style={{ marginTop: '12px' }}>
            <summary style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
              {doneRQ.length} beantwortete Rückfragen anzeigen
            </summary>
            <div style={{ marginTop: '6px', opacity: 0.65 }}>
              {doneRQ.map(rq => (
                <div key={rq.id} className="rueckfrage-item">
                  <input
                    type="checkbox"
                    className="rueckfrage-check"
                    checked={true}
                    onChange={e => onToggleRueckfrage(rq.id, e.target.checked)}
                  />
                  <div className="rueckfrage-body">
                    <span className="rueckfrage-text answered">{rq.text}</span>
                    <div className="rueckfrage-meta">
                      <span className="badge badge-green">beantwortet</span>
                      {rq.beantwortetAm && (
                        <input
                          type="date"
                          value={rq.beantwortetAm || ''}
                          onChange={e => onUpdateRueckfrageDate(rq.id, e.target.value)}
                          style={{ width: '130px', padding: '2px 6px', fontSize: '11px' }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {/* ── Ausstehende Bearbeitungsschritte ─────────────────────────────────── */}
      <div className="section-card">
        <div className="section-card-title">
          <span>Ausstehende Bearbeitungsschritte</span>
          {openSteps.length > 0
            ? <span className="badge badge-red">{openSteps.length} offen</span>
            : <span className="badge badge-green">alle abgeschlossen ✓</span>
          }
        </div>

        {openSteps.length === 0 && (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '4px 0 8px' }}>
            Alle Bearbeitungsschritte abgeschlossen ✓
          </div>
        )}

        {openSteps.map(([key, label]) => (
          <div key={key} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 0', borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--orange)', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', flex: 1 }}>{label}</span>
            <span className="badge badge-orange">ausstehend</span>
          </div>
        ))}

        {openSteps.length === 0 && null}
      </div>

      {/* ── Fällige Erinnerungen ──────────────────────────────────────────────── */}
      <div className="section-card">
        <div className="section-card-title">
          <span>Fällige Erinnerungen</span>
          {overdueEr.length > 0
            ? <span className="badge badge-red">{overdueEr.length} fällig</span>
            : <span className="badge badge-green">keine fälligen</span>
          }
        </div>

        {overdueEr.length === 0 && (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '4px 0 8px' }}>
            Keine fälligen Erinnerungen ✓
          </div>
        )}

        {[...overdueEr].sort((a, b) => a.datum.localeCompare(b.datum)).map(er => (
          <div key={er.id} className="erinnerung-item">
            <span className="erinnerung-date mono overdue">
              {er.datum.split('-').reverse().join('.')} ⚠
            </span>
            <span className="erinnerung-text" style={{ color: 'var(--red)' }}>
              {er.text}
            </span>
          </div>
        ))}
      </div>

    </div>
  )
}
