import { useState } from 'react'
import { getFACountdown } from '../../utils/progress.js'
import { getAutoHints } from '../../utils/aiResponses.js'

export default function OverviewTab({
  client,
  onUpdate,
  onAddRueckfrage,
  onToggleRueckfrage,
  onDeleteRueckfrage,
  onUpdateRueckfrageDate,
  onUpdateRueckfrageAntwort,
  onUpdateRueckfrageBuchungskonto,
  onAddErinnerung,
  onDeleteErinnerung,
}) {
  const [newRQ, setNewRQ]         = useState('')
  const [newErDate, setNewErDate] = useState('')
  const [newErText, setNewErText] = useState('')

  function handleAddRQ() {
    if (!newRQ.trim()) return
    onAddRueckfrage(newRQ)
    setNewRQ('')
  }

  function handleAddErinnerung() {
    if (!newErDate || !newErText.trim()) return
    onAddErinnerung(newErDate, newErText)
    setNewErDate('')
    setNewErText('')
  }

  function setSendung(idx, val) {
    const arr = [...(client.rueckfragenSendungen ?? ['', '', '', ''])]
    arr[idx] = val
    onUpdate({ rueckfragenSendungen: arr })
  }

  const faCountdown = client.faGeplantDatum && !client.faUebermittelt
    ? getFACountdown(client.faGeplantDatum)
    : null
  const today = new Date().toISOString().slice(0, 10)
  const hints = getAutoHints(client)

  function isOverdue(datum) { return datum < today }

  const openRQ = client.rueckfragen.filter(r => !r.beantwortet)
  const doneRQ = client.rueckfragen.filter(r => r.beantwortet)
  const sendungen = client.rueckfragenSendungen ?? ['', '', '', '']

  return (
    <div className="tab-content">

      {/* ── Rückfragen (ganz oben, prominent) ─────────────────────────────────── */}
      <div className="section-card">
        <div className="section-card-title">
          <span>Rückfragen</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {openRQ.length > 0 && (
              <span className="badge badge-red">{openRQ.length} offen</span>
            )}
            {doneRQ.length > 0 && (
              <span className="badge badge-green">{doneRQ.length} beantwortet</span>
            )}
            {client.rueckfragen.length === 0 && (
              <span className="badge badge-muted">keine</span>
            )}
          </div>
        </div>

        {/* ── Offene Rückfragen ── */}
        {openRQ.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
              Offen ({openRQ.length})
            </div>
            {openRQ.map(rq => (
              <div key={rq.id} className="rq-card rq-open">
                {/* Zeile 1: Fragetext + Löschen */}
                <div className="rq-card-header">
                  <span className="rueckfrage-text">{rq.text}</span>
                  <button className="rueckfrage-delete" onClick={() => onDeleteRueckfrage(rq.id)} title="Löschen">✕</button>
                </div>

                {/* Zeile 2: Buchungskonto */}
                <div className="rq-konto-row">
                  <span className="rq-konto-label">Buchungskonto:</span>
                  <input
                    type="text"
                    className="rq-konto-input"
                    placeholder="z. B. 1000"
                    value={rq.buchungskonto ?? ''}
                    onChange={e => onUpdateRueckfrageBuchungskonto(rq.id, e.target.value)}
                  />
                </div>

                {/* Zeile 3: Antwort */}
                <div className="rq-answer-row">
                  <span className="rq-answer-label">Antwort des Mandanten:</span>
                  <textarea
                    className="rq-answer-input"
                    placeholder="Antwort hier eintragen…"
                    value={rq.antwort ?? ''}
                    onChange={e => onUpdateRueckfrageAntwort(rq.id, e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Zeile 4: Erledigt-Checkbox */}
                <div className="rq-card-footer">
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
            ))}
          </div>
        )}

        {/* ── Beantwortete Rückfragen ── */}
        {doneRQ.length > 0 && (
          <details>
            <summary style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', paddingBottom: '8px' }}>
              ▶ {doneRQ.length} beantwortete Rückfragen anzeigen
            </summary>
            <div style={{ marginTop: '6px' }}>
              {doneRQ.map(rq => (
                <div key={rq.id} className="rq-card rq-done">
                  <div className="rq-card-header">
                    <span className="rueckfrage-text answered">{rq.text}</span>
                    {rq.buchungskonto && (
                      <span className="rq-konto-badge">Kto. {rq.buchungskonto}</span>
                    )}
                    <span className="badge badge-green" style={{ flexShrink: 0 }}>✓ Erledigt</span>
                    <input
                      type="date"
                      value={rq.beantwortetAm || ''}
                      onChange={e => onUpdateRueckfrageDate(rq.id, e.target.value)}
                      style={{ width: '130px', padding: '2px 6px', fontSize: '11px', flexShrink: 0 }}
                    />
                    <button className="rueckfrage-delete" onClick={() => onDeleteRueckfrage(rq.id)} title="Löschen">✕</button>
                  </div>
                  {rq.antwort && (
                    <div className="rq-answer-row rq-answer-done">
                      <span className="rq-answer-label">Antwort:</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{rq.antwort}</span>
                    </div>
                  )}
                  {/* Rückgängig machen */}
                  <div className="rq-card-footer">
                    <label className="rq-erledigt-label rq-erledigt-done">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={e => onToggleRueckfrage(rq.id, e.target.checked)}
                      />
                      <span>Erledigt</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {client.rueckfragen.length === 0 && (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', paddingBottom: '6px' }}>
            Keine Rückfragen vorhanden.
          </div>
        )}

        {/* Neue Rückfrage */}
        <div className="add-input-row" style={{ marginTop: '10px' }}>
          <input
            type="text"
            placeholder="Neue Rückfrage eingeben…"
            value={newRQ}
            onChange={e => setNewRQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddRQ()}
          />
          <button className="btn btn-ghost btn-sm" onClick={handleAddRQ}>+ Hinzufügen</button>
        </div>
      </div>

      {/* ── Bearbeitungsschritte ───────────────────────────────────────────────── */}
      <div className="section-card">
        <div className="section-card-title">Bearbeitungsschritte</div>

        {/* 1. Daten erfasst */}
        <div className="step-item">
          <div className="step-left">
            <div className="step-dot done" />
            <span className="step-label">Daten und Auftrag erfasst</span>
          </div>
          <div className="step-right">
            <span className="badge badge-green">✓</span>
          </div>
        </div>

        {/* 2. In Bearbeitung */}
        <div className="step-item">
          <div className="step-left">
            <div className={`step-dot ${client.inBearbeitung ? 'done' : 'pending'}`} />
            <span className="step-label">In Bearbeitung</span>
          </div>
          <div className="step-right">
            <input type="checkbox" checked={!!client.inBearbeitung} onChange={e => onUpdate({ inBearbeitung: e.target.checked })} />
            {client.inBearbeitung
              ? <span className="badge badge-yellow">aktiv</span>
              : <span className="badge badge-muted">ausstehend</span>
            }
          </div>
        </div>

        {/* 3. Rückfragen gesendet – 4 Datumsfelder */}
        <div className="step-item step-rq-block">
          <div className="step-left">
            <div className={`step-dot ${sendungen.some(Boolean) ? 'done' : 'pending'}`} />
            <span className="step-label">Rückfragen an Mandant gesendet</span>
          </div>
          <div className="step-right step-rq-dates">
            {sendungen.map((d, i) => (
              <div key={i} className="rq-sendung-row">
                <span className="rq-sendung-label">{i + 1}.</span>
                <input
                  type="date"
                  className="step-date-input"
                  value={d || ''}
                  onChange={e => setSendung(i, e.target.value || '')}
                  title={`Übermittlung ${i + 1}`}
                />
                {d && <span className="badge badge-orange" style={{ fontSize: '10px' }}>gesendet</span>}
              </div>
            ))}
          </div>
        </div>

        {/* 4. Abschluss fertig */}
        <div className="step-item">
          <div className="step-left">
            <div className={`step-dot ${client.abschlussFertig ? 'done' : 'pending'}`} />
            <span className="step-label">Abschluss fertig</span>
          </div>
          <div className="step-right">
            <input
              type="checkbox"
              checked={!!client.abschlussFertig}
              onChange={e => onUpdate({
                abschlussFertig: e.target.checked,
                abschlussFertigDatum: e.target.checked
                  ? (client.abschlussFertigDatum || new Date().toISOString().slice(0, 10))
                  : null,
              })}
            />
            {client.abschlussFertig
              ? <span className="badge badge-green">✓</span>
              : <span className="badge badge-muted">ausstehend</span>
            }
            {client.abschlussFertig && (
              <input type="date" className="step-date-input" value={client.abschlussFertigDatum || ''}
                onChange={e => onUpdate({ abschlussFertigDatum: e.target.value || null })} />
            )}
          </div>
        </div>

        {/* 5. An Mandant */}
        <div className="step-item">
          <div className="step-left">
            <div className={`step-dot ${client.steGesendetDatum ? 'done' : 'pending'}`} />
            <span className="step-label">Abschluss an Mandant zur Unterschrift gesendet</span>
          </div>
          <div className="step-right">
            {client.steGesendetDatum ? <span className="badge badge-green">✓</span> : <span className="badge badge-muted">ausstehend</span>}
            <input type="date" className="step-date-input" value={client.steGesendetDatum || ''}
              onChange={e => onUpdate({ steGesendetDatum: e.target.value || null })} />
          </div>
        </div>

        {/* 5.5 Unterschrift */}
        <div className="step-item" style={{ opacity: 0.75 }}>
          <div className="step-left">
            <div className={`step-dot ${client.unterschriftDatum ? 'done' : 'pending'}`} />
            <span className="step-label" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Unterschrift / VE erhalten</span>
          </div>
          <div className="step-right">
            {client.unterschriftDatum ? <span className="badge badge-green">✓</span> : <span className="badge badge-muted">ausstehend</span>}
            <input type="date" className="step-date-input" value={client.unterschriftDatum || ''}
              onChange={e => onUpdate({ unterschriftDatum: e.target.value || null })} />
          </div>
        </div>

        {/* 6. An FA */}
        <div className="step-item">
          <div className="step-left">
            <div className={`step-dot ${client.faUebermittelt ? 'done' : 'pending'}`} />
            <span className="step-label">Abschluss an Finanzamt gesendet</span>
          </div>
          <div className="step-right">
            <input
              type="checkbox"
              checked={!!client.faUebermittelt}
              onChange={e => onUpdate({
                faUebermittelt: e.target.checked,
                faUebermitteltDatum: e.target.checked
                  ? (client.faUebermitteltDatum || new Date().toISOString().slice(0, 10))
                  : null,
              })}
            />
            {client.faUebermittelt ? <span className="badge badge-green">✓</span> : <span className="badge badge-muted">ausstehend</span>}
            {client.faUebermittelt && (
              <input type="date" className="step-date-input" value={client.faUebermitteltDatum || ''}
                onChange={e => onUpdate({ faUebermitteltDatum: e.target.value || null })} />
            )}
          </div>
        </div>

        {/* FA-Termin */}
        <div className="step-item" style={{ opacity: 0.75 }}>
          <div className="step-left">
            <div className={`step-dot ${client.faGeplantDatum ? (faCountdown?.type === 'overdue' ? 'active' : 'done') : 'pending'}`} />
            <span className="step-label" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Geplanter FA-Termin</span>
          </div>
          <div className="step-right">
            {faCountdown && <span className={`countdown ${faCountdown.type}`}>{faCountdown.label}</span>}
            {!faCountdown && !client.faGeplantDatum && <span className="badge badge-muted">nicht geplant</span>}
            <input type="date" className="step-date-input" value={client.faGeplantDatum || ''}
              onChange={e => onUpdate({ faGeplantDatum: e.target.value || null })} />
          </div>
        </div>
      </div>

      {/* ── Erinnerungen ──────────────────────────────────────────────────────── */}
      <div className="section-card">
        <div className="section-card-title">
          <span>Erinnerungen</span>
          {client.erinnerungen.filter(e => isOverdue(e.datum)).length > 0 && (
            <span className="badge badge-red">{client.erinnerungen.filter(e => isOverdue(e.datum)).length} fällig</span>
          )}
        </div>

        {client.erinnerungen.length === 0 && (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', paddingBottom: '8px' }}>Keine Erinnerungen.</div>
        )}

        {[...client.erinnerungen]
          .sort((a, b) => a.datum.localeCompare(b.datum))
          .map(er => (
          <div key={er.id} className="erinnerung-item">
            <span className={`erinnerung-date mono${isOverdue(er.datum) ? ' overdue' : ''}`}>
              {er.datum.split('-').reverse().join('.')}{isOverdue(er.datum) && ' ⚠'}
            </span>
            <span className="erinnerung-text" style={isOverdue(er.datum) ? { color: 'var(--red)' } : {}}>
              {er.text}
            </span>
            <button className="btn-icon" onClick={() => onDeleteErinnerung(er.id)} title="Löschen">✕</button>
          </div>
        ))}

        <div className="add-erinnerung-row">
          <input type="date" value={newErDate} min={today} onChange={e => setNewErDate(e.target.value)} />
          <input
            type="text"
            placeholder="Erinnerungstext…"
            value={newErText}
            onChange={e => setNewErText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddErinnerung()}
          />
          <button className="btn btn-ghost btn-sm" onClick={handleAddErinnerung}>+</button>
        </div>
      </div>

      {/* ── KI-Hinweise ────────────────────────────────────────────────────────── */}
      <div className="section-card">
        <div className="section-card-title">KI-Hinweise</div>
        <div className="ki-hints">
          {hints.map((h, i) => (
            <div key={i} className="ki-hint">
              <span className="ki-hint-icon">{h.icon}</span>
              <span>{h.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
