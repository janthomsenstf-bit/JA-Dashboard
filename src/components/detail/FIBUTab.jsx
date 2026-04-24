import { useState } from 'react'
import { generateAufgaben, getStatus, buildTogglePatch, fmtDatum, isUeberfaellig } from '../../utils/aufgaben.js'
import SerieKonfigPanel from './SerieKonfigPanel.jsx'

const ACCENT = '#065f46'

const DEFAULT_FIBU_SERIE = {
  aktiv: false, startDatum: '', frequenz: 'monatlich', faelligTag: 10,
  endDatum: '', intervallTyp: 'monate', intervallWert: 1,
}

// ── Aufgaben-Karte ─────────────────────────────────────────────────────────────
function FibuAufgabeKarte({ task, eintrag, onToggle }) {
  const erledigt = eintrag?.erledigt ?? false
  const ueber    = !erledigt && isUeberfaellig(task.faellig)
  const heute    = new Date()
  const istAkt   = task.faellig && new Date(task.faellig).toDateString() === heute.toDateString()

  return (
    <div style={{
      border: `1px solid ${erledigt ? 'rgba(6,95,70,0.35)' : ueber ? 'rgba(239,68,68,0.4)' : istAkt ? `${ACCENT}55` : 'var(--border)'}`,
      borderRadius: '8px', padding: '10px 12px',
      background: erledigt ? 'rgba(6,95,70,0.05)' : ueber ? 'rgba(239,68,68,0.04)' : 'var(--surface)',
      transition: 'all 0.15s',
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
        <input type="checkbox" checked={erledigt} onChange={onToggle}
          style={{ width: '16px', height: '16px', accentColor: ACCENT, cursor: 'pointer', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: erledigt ? ACCENT : 'var(--text)', lineHeight: 1.3 }}>
            {task.label.replace(/^FIBU \/ Buchhaltung /, '')}
            {istAkt && !erledigt && (
              <span style={{ marginLeft: '6px', fontSize: '10px', background: `rgba(6,95,70,0.15)`, color: ACCENT, padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>Aktuell</span>
            )}
            {ueber && (
              <span style={{ marginLeft: '6px', fontSize: '10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>Offen</span>
            )}
          </div>
          {task.faellig && !erledigt && (
            <div style={{ fontSize: '11px', color: ueber ? '#ef4444' : 'var(--text-muted)', marginTop: '2px' }}>
              {ueber ? '⚠ Fällig: ' : '📅 Fällig: '}{fmtDatum(task.faellig)}
            </div>
          )}
          {erledigt && eintrag?.erledigtAm && (
            <div style={{ fontSize: '11px', color: ACCENT, marginTop: '2px' }}>✓ {fmtDatum(eintrag.erledigtAm)}</div>
          )}
        </div>
      </label>
    </div>
  )
}

// ── Notizen-Block ──────────────────────────────────────────────────────────────
function NotizenBlock({ eintraege, onAdd, onDelete }) {
  const [text, setText] = useState('')
  function add() {
    const t = text.trim(); if (!t) return
    onAdd({ id: 'fn' + Date.now().toString(36), text: t, datum: new Date().toISOString() })
    setText('')
  }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ background: ACCENT, color: '#fff', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📝</span>
        <span style={{ fontWeight: 700, fontSize: '13px' }}>Notizen – FIBU-relevante Sachverhalte</span>
        {eintraege.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '11px', background: 'rgba(255,255,255,0.25)', padding: '1px 8px', borderRadius: '10px' }}>
            {eintraege.length}
          </span>
        )}
      </div>
      <div style={{ padding: '10px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add() } }}
          placeholder="Notiz eingeben… (Enter zum Speichern)"
          rows={2}
          style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: '#fff', color: 'var(--text)', fontSize: '12px', resize: 'none', lineHeight: 1.5, boxSizing: 'border-box' }}
        />
        <button onClick={add} disabled={!text.trim()} style={{
          padding: '0 14px', borderRadius: '6px', border: 'none', alignSelf: 'stretch',
          background: text.trim() ? ACCENT : 'var(--border)', color: '#fff',
          fontSize: '18px', fontWeight: 700, cursor: text.trim() ? 'pointer' : 'not-allowed', flexShrink: 0,
        }}>+</button>
      </div>
      <div style={{ background: 'var(--surface)', maxHeight: '240px', overflowY: 'auto' }}>
        {eintraege.length === 0
          ? <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>Noch keine Notizen.</div>
          : [...eintraege].reverse().map(e => (
            <div key={e.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ color: ACCENT, fontSize: '15px', lineHeight: 1.4, flexShrink: 0 }}>›</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{e.text}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>📅 {fmtDatum(e.datum)}</div>
              </div>
              <button onClick={() => onDelete(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', padding: '2px', flexShrink: 0 }}
                onMouseEnter={ev => ev.currentTarget.style.color = '#ef4444'}
                onMouseLeave={ev => ev.currentTarget.style.color = 'var(--text-muted)'}
              >🗑</button>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────────
export default function FIBUTab({ client, onUpdate }) {
  const fibuNotizen = Array.isArray(client.fibuNotizen) ? client.fibuNotizen : []
  const fibuSerie   = client.fibuSerie ?? DEFAULT_FIBU_SERIE

  const fibuTasks    = generateAufgaben(client).filter(t => t.type === 'FIBU')
  const erledigtCnt  = fibuTasks.filter(t => getStatus(client, t.key).erledigt).length

  function toggle(key)        { onUpdate(buildTogglePatch(client, key)) }
  function setFibuSerie(s)    { onUpdate({ fibuSerie: s }) }
  function addNotiz(e)        { onUpdate({ fibuNotizen: [...fibuNotizen, e] }) }
  function delNotiz(id)       { onUpdate({ fibuNotizen: fibuNotizen.filter(n => n.id !== id) }) }

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Einstellungen ── */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ background: ACCENT, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '16px' }}>📒</span>
          <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Finanzbuchhaltung (FIBU)</span>
          {fibuTasks.length > 0 && (
            <span style={{ fontSize: '12px', background: erledigtCnt === fibuTasks.length ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)', padding: '2px 10px', borderRadius: '10px', fontWeight: 600 }}>
              {erledigtCnt} / {fibuTasks.length} erledigt
            </span>
          )}
        </div>

        {/* Toggle-Zeile */}
        <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={!!client.fibuAktiv} onChange={e => onUpdate({ fibuAktiv: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: ACCENT, cursor: 'pointer' }} />
            <span style={{ fontSize: '13px', fontWeight: client.fibuAktiv ? 600 : 400, color: client.fibuAktiv ? ACCENT : 'var(--text-secondary)' }}>
              📒 FIBU aktiv
            </span>
          </label>
          {client.fibuAktiv && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={!!client.fibuInUebersicht} onChange={e => onUpdate({ fibuInUebersicht: e.target.checked })}
                style={{ width: '16px', height: '16px', accentColor: '#0f766e', cursor: 'pointer' }} />
              <span style={{ fontSize: '13px', fontWeight: client.fibuInUebersicht ? 600 : 400, color: client.fibuInUebersicht ? '#0f766e' : 'var(--text-secondary)' }}>
                📋 In Aufgaben-Übersicht anzeigen
              </span>
            </label>
          )}
        </div>

        {/* Serien-Konfiguration */}
        {client.fibuAktiv && client.fibuInUebersicht && (
          <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <SerieKonfigPanel
              config={fibuSerie}
              onChange={setFibuSerie}
              accentColor={ACCENT}
              taskLabel="FIBU / Buchhaltung"
            />
          </div>
        )}

        {/* Fortschrittsbalken */}
        {fibuTasks.length > 0 && (
          <div style={{ padding: '6px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ height: '6px', background: 'var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(erledigtCnt / fibuTasks.length) * 100}%`, background: erledigtCnt === fibuTasks.length ? '#16a34a' : ACCENT, borderRadius: '10px', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        )}

        {/* Aufgaben-Karten */}
        <div style={{ padding: '12px 14px', background: 'var(--surface2)' }}>
          {!client.fibuAktiv ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '16px' }}>
              FIBU inaktiv. Checkbox oben aktivieren.
            </div>
          ) : !fibuSerie.aktiv ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '16px' }}>
              Serienaufgabe noch nicht konfiguriert.<br />
              <span style={{ fontSize: '11px' }}>„In Aufgaben-Übersicht anzeigen" aktivieren und Serienaufgabe einrichten.</span>
            </div>
          ) : fibuTasks.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '16px' }}>
              Kein Veranlagungsjahr hinterlegt oder Startdatum liegt in der Zukunft.
            </div>
          ) : (
            <>
              {[...new Set(fibuTasks.map(t => t.jahr))].map(jahr => {
                const yearTasks = fibuTasks.filter(t => t.jahr === jahr)
                const yErl      = yearTasks.filter(t => getStatus(client, t.key).erledigt).length
                return (
                  <div key={jahr} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: ACCENT }}>{jahr}</span>
                      <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>✓ {yErl} erledigt</span>
                      {yearTasks.length - yErl > 0 && <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>⬜ {yearTasks.length - yErl} offen</span>}
                      {yErl === yearTasks.length && <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>🎉 Vollständig</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '6px' }}>
                      {yearTasks.map(t => (
                        <FibuAufgabeKarte key={t.key} task={t} eintrag={getStatus(client, t.key)} onToggle={() => toggle(t.key)} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Notizen ── */}
      <NotizenBlock eintraege={fibuNotizen} onAdd={addNotiz} onDelete={delNotiz} />
    </div>
  )
}
