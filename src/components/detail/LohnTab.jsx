import { useState } from 'react'
import { generateAufgaben, getStatus, buildTogglePatch, fmtDatum } from '../../utils/aufgaben.js'
import SerieKonfigPanel from './SerieKonfigPanel.jsx'
import AuftragKontextPanel from './AuftragKontextPanel.jsx'

const ACCENT = '#7c3aed'

function MonatsKarte({ task, eintrag, onToggle }) {
  const erledigt    = eintrag?.erledigt ?? false
  const heute       = new Date()
  const taskMonat   = task.monat
  const taskJahr    = task.jahr
  const istAktuell  = taskMonat === (heute.getMonth()+1) && taskJahr === heute.getFullYear()
  const istVergangen = (taskJahr < heute.getFullYear()) || (taskJahr === heute.getFullYear() && taskMonat < (heute.getMonth()+1))
  const offen       = !erledigt && istVergangen

  return (
    <div style={{ border:`1px solid ${erledigt?'rgba(124,58,237,0.3)':offen?'rgba(239,68,68,0.35)':istAktuell?'rgba(124,58,237,0.35)':'var(--border)'}`, borderRadius:'8px', padding:'10px 12px', background:erledigt?'rgba(124,58,237,0.05)':offen?'rgba(239,68,68,0.03)':istAktuell?'rgba(124,58,237,0.04)':'var(--surface)', transition:'all 0.15s' }}>
      <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', userSelect:'none' }}>
        <input type="checkbox" checked={erledigt} onChange={onToggle} style={{ width:'16px', height:'16px', accentColor:ACCENT, cursor:'pointer', flexShrink:0 }} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'13px', fontWeight:600, color:erledigt?ACCENT:'var(--text)', lineHeight:1.3 }}>
            {task.label.replace(/^Lohn /, '')}
            {istAktuell && !erledigt && <span style={{ marginLeft:'6px', fontSize:'10px', background:'rgba(124,58,237,0.15)', color:ACCENT, padding:'1px 6px', borderRadius:'8px', fontWeight:700 }}>Aktuell</span>}
            {offen && <span style={{ marginLeft:'6px', fontSize:'10px', background:'rgba(239,68,68,0.1)', color:'#ef4444', padding:'1px 6px', borderRadius:'8px', fontWeight:700 }}>Offen</span>}
          </div>
          {erledigt && eintrag?.erledigtAm && (
            <div style={{ fontSize:'11px', color:ACCENT, marginTop:'2px' }}>✓ {fmtDatum(eintrag.erledigtAm)}</div>
          )}
        </div>
      </label>
    </div>
  )
}

function NotizenBlock({ eintraege, onAdd, onDelete }) {
  const [text, setText] = useState('')
  function add() {
    const t = text.trim(); if (!t) return
    onAdd({ id:'ln'+Date.now().toString(36), text:t, datum:new Date().toISOString() })
    setText('')
  }
  return (
    <div style={{ border:'1px solid var(--border)', borderRadius:'8px', overflow:'hidden' }}>
      <div style={{ background:ACCENT, color:'#fff', padding:'8px 14px', display:'flex', alignItems:'center', gap:'8px' }}>
        <span>📝</span>
        <span style={{ fontWeight:700, fontSize:'13px' }}>Notizen – Lohnrelevante Sachverhalte</span>
        {eintraege.length > 0 && <span style={{ marginLeft:'auto', fontSize:'11px', background:'rgba(255,255,255,0.25)', padding:'1px 8px', borderRadius:'10px' }}>{eintraege.length}</span>}
      </div>
      <div style={{ padding:'10px', background:'var(--surface2)', borderBottom:'1px solid var(--border)', display:'flex', gap:'8px' }}>
        <textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();add()}}}
          placeholder="Notiz eingeben… (Enter zum Speichern)" rows={2}
          style={{ flex:1, padding:'7px 10px', border:'1px solid var(--border)', borderRadius:'6px', background:'#fff', color:'var(--text)', fontSize:'12px', resize:'none', lineHeight:1.5, boxSizing:'border-box' }} />
        <button onClick={add} disabled={!text.trim()} style={{ padding:'0 14px', borderRadius:'6px', border:'none', alignSelf:'stretch', background:text.trim()?ACCENT:'var(--border)', color:'#fff', fontSize:'18px', fontWeight:700, cursor:text.trim()?'pointer':'not-allowed', flexShrink:0 }}>+</button>
      </div>
      <div style={{ background:'var(--surface)', maxHeight:'240px', overflowY:'auto' }}>
        {eintraege.length === 0
          ? <div style={{ padding:'16px', textAlign:'center', fontSize:'12px', color:'var(--text-muted)' }}>Noch keine Notizen.</div>
          : [...eintraege].reverse().map(e => (
            <div key={e.id} style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', display:'flex', gap:'8px', alignItems:'flex-start' }}>
              <span style={{ color:ACCENT, fontSize:'15px', lineHeight:1.4, flexShrink:0 }}>›</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'13px', color:'var(--text)', lineHeight:1.5, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{e.text}</div>
                <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>📅 {fmtDatum(e.datum)}</div>
              </div>
              <button onClick={()=>onDelete(e.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'13px', padding:'2px', flexShrink:0 }}
                onMouseEnter={ev=>ev.currentTarget.style.color='#ef4444'} onMouseLeave={ev=>ev.currentTarget.style.color='var(--text-muted)'}>🗑</button>
            </div>
          ))
        }
      </div>
    </div>
  )
}

export default function LohnTab({ client, onUpdate }) {
  const data    = client.lohn ?? {}
  const notizen = data.notizen ?? []

  const lohnTasks = generateAufgaben(client).filter(t => t.type === 'Lohn')

  const DEFAULT_LOHN_SERIE = { aktiv: false, startDatum: '', frequenz: 'monatlich', faelligTag: 22, endDatum: '', intervallTyp: 'monate', intervallWert: 1 }
  const lohnSerie = client.lohnSerie ?? DEFAULT_LOHN_SERIE

  function toggle(key) { onUpdate(buildTogglePatch(client, key)) }
  function setLohnAktiv(aktiv) { onUpdate({ lohnAktiv: aktiv }) }
  function addNotiz(e)  { onUpdate({ lohn: { ...data, notizen: [...notizen, e] } }) }
  function delNotiz(id) { onUpdate({ lohn: { ...data, notizen: notizen.filter(n => n.id !== id) } }) }
  function setLohnSerie(s) { onUpdate({ lohnSerie: s }) }

  const erledigtCount = lohnTasks.filter(t => getStatus(client, t.key).erledigt).length

  return (
    <div className="tab-content" style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

      {/* ── Offene Lohn-Aufträge ── */}
      <AuftragKontextPanel
        client={client}
        typen={['lohn']}
        onUpdate={onUpdate}
        auftraegeTabIndex={14}
      />

      {/* ── Lohnabrechnung ── */}
      <div style={{ border:'1px solid var(--border)', borderRadius:'8px', overflow:'hidden' }}>
        <div style={{ background:ACCENT, color:'#fff', padding:'10px 14px', display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{ fontSize:'16px' }}>💼</span>
          <span style={{ fontWeight:700, fontSize:'13px', flex:1 }}>Lohnabrechnung</span>
          {lohnTasks.length > 0 && (
            <span style={{ fontSize:'12px', background:erledigtCount===lohnTasks.length?'rgba(255,255,255,0.35)':'rgba(255,255,255,0.15)', padding:'2px 10px', borderRadius:'10px', fontWeight:600 }}>
              {erledigtCount} / {lohnTasks.length} abgerechnet
            </span>
          )}
        </div>

        {/* Toggle-Zeile */}
        <div style={{ padding:'10px 14px', background:'var(--surface)', borderBottom:'1px solid var(--border)', display:'flex', gap:'20px', alignItems:'center', flexWrap:'wrap' }}>
          {/* Lohn aktiv */}
          <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', userSelect:'none' }}>
            <input type="checkbox" checked={!!client.lohnAktiv} onChange={e => setLohnAktiv(e.target.checked)}
              style={{ width:'16px', height:'16px', accentColor:ACCENT, cursor:'pointer' }} />
            <span style={{ fontSize:'13px', fontWeight: client.lohnAktiv ? 600 : 400, color: client.lohnAktiv ? ACCENT : 'var(--text-secondary)' }}>
              💼 Lohnabrechnung aktiv
            </span>
          </label>
          {/* In Übersicht anzeigen – nur wenn Lohn aktiv */}
          {client.lohnAktiv && (
            <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', userSelect:'none' }}>
              <input type="checkbox"
                checked={!!client.lohnInUebersicht}
                onChange={e => onUpdate({ lohnInUebersicht: e.target.checked })}
                style={{ width:'16px', height:'16px', accentColor:'#0f766e', cursor:'pointer' }} />
              <span style={{ fontSize:'13px', fontWeight: client.lohnInUebersicht ? 600 : 400, color: client.lohnInUebersicht ? '#0f766e' : 'var(--text-secondary)' }}>
                📋 In Aufgaben-Übersicht anzeigen
              </span>
            </label>
          )}
        </div>

        {/* Serien-Konfiguration – erscheint wenn beide Haken gesetzt */}
        {client.lohnAktiv && client.lohnInUebersicht && (
          <div style={{ padding:'10px 14px', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
            <SerieKonfigPanel
              config={lohnSerie}
              onChange={setLohnSerie}
              accentColor={ACCENT}
              taskLabel="Lohnabrechnung"
            />
          </div>
        )}

        {/* Fortschrittsbalken */}
        {lohnTasks.length > 0 && (
          <div style={{ padding:'6px 14px', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
            <div style={{ height:'6px', background:'var(--border)', borderRadius:'10px', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${(erledigtCount/lohnTasks.length)*100}%`, background:erledigtCount===lohnTasks.length?'#16a34a':ACCENT, borderRadius:'10px', transition:'width 0.4s ease' }} />
            </div>
          </div>
        )}

        {/* Monatsübersicht */}
        <div style={{ padding:'12px 14px', background:'var(--surface2)' }}>
          {!client.lohnAktiv ? (
            <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:'12px', padding:'16px' }}>
              Lohnabrechnung inaktiv. Checkbox oben aktivieren.
            </div>
          ) : lohnTasks.length === 0 ? (
            <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:'12px', padding:'16px' }}>
              Kein Veranlagungsjahr hinterlegt.
            </div>
          ) : (
            <>
              {/* Gruppen nach Jahr */}
              {[...new Set(lohnTasks.map(t => t.jahr))].map(jahr => {
                const yearTasks = lohnTasks.filter(t => t.jahr === jahr)
                const yErl = yearTasks.filter(t => getStatus(client, t.key).erledigt).length
                const yOffen = yearTasks.length - yErl
                return (
                  <div key={jahr} style={{ marginBottom:'12px' }}>
                    {/* Jahres-Header */}
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                      <span style={{ fontSize:'12px', fontWeight:700, color:ACCENT }}>{jahr}</span>
                      <span style={{ fontSize:'11px', color:'#16a34a', fontWeight:600 }}>✓ {yErl} erledigt</span>
                      {yOffen > 0 && <span style={{ fontSize:'11px', color:'#ef4444', fontWeight:600 }}>⬜ {yOffen} offen</span>}
                      {yErl === yearTasks.length && <span style={{ fontSize:'11px', color:'#16a34a', fontWeight:700 }}>🎉 Vollständig</span>}
                    </div>
                    {/* Monats-Grid – 6 Spalten für kompakte Ansicht */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:'6px' }}>
                      {yearTasks.map(t => {
                        const st       = getStatus(client, t.key)
                        const erledigt = st.erledigt
                        const heute    = new Date()
                        const istVerg  = (t.jahr < heute.getFullYear()) || (t.jahr === heute.getFullYear() && t.monat < heute.getMonth() + 1)
                        const istAkt   = t.monat === heute.getMonth() + 1 && t.jahr === heute.getFullYear()
                        const offen    = !erledigt && istVerg
                        const monatName = ['Jan','Feb','Mrz','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][t.monat - 1]
                        return (
                          <label key={t.key} style={{
                            display:'flex', flexDirection:'column', alignItems:'center', gap:'4px',
                            padding:'8px 6px', borderRadius:'8px', cursor:'pointer', userSelect:'none',
                            border:`1.5px solid ${erledigt?'rgba(22,163,74,0.35)':offen?'rgba(239,68,68,0.4)':istAkt?`${ACCENT}55`:'var(--border)'}`,
                            background:erledigt?'rgba(22,163,74,0.07)':offen?'rgba(239,68,68,0.04)':istAkt?`rgba(124,58,237,0.05)`:'var(--surface)',
                            transition:'all 0.15s',
                          }}>
                            {/* Monat */}
                            <span style={{ fontSize:'12px', fontWeight:700, color:erledigt?'#16a34a':offen?'#ef4444':istAkt?ACCENT:'var(--text)' }}>
                              {monatName}
                            </span>
                            {/* Checkbox */}
                            <input type="checkbox" checked={erledigt} onChange={() => toggle(t.key)}
                              style={{ width:'15px', height:'15px', accentColor:erledigt?'#16a34a':ACCENT, cursor:'pointer' }} />
                            {/* Datum oder Status */}
                            {erledigt && st.erledigtAm ? (
                              <span style={{ fontSize:'9px', color:'#16a34a', fontWeight:600, textAlign:'center', lineHeight:1.2 }}>
                                {fmtDatum(st.erledigtAm).slice(0,5)}
                              </span>
                            ) : offen ? (
                              <span style={{ fontSize:'9px', color:'#ef4444', fontWeight:700 }}>OFFEN</span>
                            ) : istAkt ? (
                              <span style={{ fontSize:'9px', color:ACCENT, fontWeight:700 }}>JETZT</span>
                            ) : (
                              <span style={{ fontSize:'9px', color:'var(--text-muted)' }}>–</span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Notizen ── */}
      <NotizenBlock eintraege={notizen} onAdd={addNotiz} onDelete={delNotiz} />
    </div>
  )
}
