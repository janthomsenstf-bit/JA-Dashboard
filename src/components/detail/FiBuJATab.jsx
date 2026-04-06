import { useState } from 'react'
import { generateAufgaben, getStatus, buildTogglePatch, fmtDatum, isUeberfaellig, TYP_CONFIG } from '../../utils/aufgaben.js'

function NotizenBlock({ titel, icon, color, eintraege, onAdd, onDelete }) {
  const [text, setText] = useState('')
  function add() {
    const t = text.trim(); if (!t) return
    onAdd({ id: 'n' + Date.now().toString(36), text: t, datum: new Date().toISOString() })
    setText('')
  }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ background: color, color: '#fff', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '13px' }}>{titel}</span>
        {eintraege.length > 0 && <span style={{ marginLeft: 'auto', fontSize: '11px', background: 'rgba(255,255,255,0.25)', padding: '1px 8px', borderRadius: '10px' }}>{eintraege.length}</span>}
      </div>
      <div style={{ padding: '10px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
        <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();add()} }}
          placeholder="Hinweis eingeben… (Enter zum Speichern)" rows={2}
          style={{ flex:1, padding:'7px 10px', border:'1px solid var(--border)', borderRadius:'6px', background:'#fff', color:'var(--text)', fontSize:'12px', resize:'none', lineHeight:1.5, boxSizing:'border-box' }} />
        <button onClick={add} disabled={!text.trim()} style={{ padding:'0 14px', borderRadius:'6px', border:'none', alignSelf:'stretch', background:text.trim()?color:'var(--border)', color:'#fff', fontSize:'18px', fontWeight:700, cursor:text.trim()?'pointer':'not-allowed', flexShrink:0 }}>+</button>
      </div>
      <div style={{ background:'var(--surface)', maxHeight:'200px', overflowY:'auto' }}>
        {eintraege.length === 0
          ? <div style={{ padding:'14px', textAlign:'center', fontSize:'12px', color:'var(--text-muted)' }}>Noch keine Einträge.</div>
          : [...eintraege].reverse().map(e => (
            <div key={e.id} style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', display:'flex', gap:'8px', alignItems:'flex-start' }}>
              <span style={{ color, fontSize:'15px', lineHeight:1.4, flexShrink:0 }}>›</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'13px', color:'var(--text)', lineHeight:1.5, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{e.text}</div>
                <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>📅 {fmtDatum(e.datum)}</div>
              </div>
              <button onClick={() => onDelete(e.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'13px', padding:'2px', flexShrink:0 }}
                onMouseEnter={ev=>ev.currentTarget.style.color='#ef4444'} onMouseLeave={ev=>ev.currentTarget.style.color='var(--text-muted)'}>🗑</button>
            </div>
          ))
        }
      </div>
    </div>
  )
}

function AufgabeKarte({ task, eintrag, onToggle }) {
  const erledigt = eintrag?.erledigt ?? false
  const ueber    = !erledigt && isUeberfaellig(task.faellig)
  return (
    <div style={{ border:`1px solid ${erledigt?'rgba(22,163,74,0.3)':ueber?'rgba(239,68,68,0.4)':'var(--border)'}`, borderRadius:'8px', padding:'10px 12px', background:erledigt?'rgba(22,163,74,0.05)':ueber?'rgba(239,68,68,0.04)':'var(--surface)', transition:'all 0.15s' }}>
      <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', userSelect:'none' }}>
        <input type="checkbox" checked={erledigt} onChange={onToggle} style={{ width:'16px', height:'16px', accentColor:'#16a34a', cursor:'pointer', flexShrink:0 }} />
        <span style={{ fontWeight:600, fontSize:'13px', color:erledigt?'#16a34a':'var(--text)' }}>
          {task.label.replace(/^USt /, '')}
        </span>
      </label>
      {task.faellig && (
        <div style={{ marginTop:'5px', paddingLeft:'24px', fontSize:'11px', color:ueber&&!erledigt?'#ef4444':'var(--text-muted)', fontWeight:ueber&&!erledigt?600:400 }}>
          {ueber&&!erledigt?'⚠ Fällig: ':'📅 Fällig: '}{fmtDatum(task.faellig)}
        </div>
      )}
      {erledigt && eintrag?.erledigtAm && (
        <div style={{ marginTop:'3px', paddingLeft:'24px', fontSize:'11px', color:'#16a34a', fontWeight:600 }}>
          ✓ erledigt am {fmtDatum(eintrag.erledigtAm)}
        </div>
      )}
    </div>
  )
}

export default function FiBuJATab({ client, onUpdate }) {
  const data     = client.fibuJa   ?? {}
  const hinweise = data.hinweise   ?? []

  const ustTyp   = client.ustZahlerTyp ?? 'keine'
  const tasks    = generateAufgaben(client).filter(t => t.type === 'USt' || t.type === 'JA')
  const ustTasks = tasks.filter(t => t.type === 'USt')
  const jaTasks  = tasks.filter(t => t.type === 'JA')

  function toggle(key) {
    onUpdate(buildTogglePatch(client, key))
  }

  // ── Zahler-Typ direkt am Mandanten ändern ─────────────────────────────────
  function setZahlerTyp(typ) {
    onUpdate({ ustZahlerTyp: typ })
  }

  function addHinweis(e) { onUpdate({ fibuJa: { ...data, hinweise: [...hinweise, e] } }) }
  function delHinweis(id){ onUpdate({ fibuJa: { ...data, hinweise: hinweise.filter(h => h.id !== id) } }) }

  const ustErl = ustTasks.filter(t => getStatus(client, t.key).erledigt).length

  return (
    <div className="tab-content" style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

      {/* ── USt-Voranmeldungen ── */}
      <div style={{ border:'1px solid var(--border)', borderRadius:'8px', overflow:'hidden' }}>
        <div style={{ background:'#1e3a5f', color:'#fff', padding:'10px 14px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
          <span style={{ fontSize:'16px' }}>📊</span>
          <span style={{ fontWeight:700, fontSize:'13px', flex:1 }}>USt-Voranmeldungen</span>
          {ustTasks.length > 0 && (
            <span style={{ fontSize:'12px', background:ustErl===ustTasks.length?'rgba(22,163,74,0.4)':'rgba(255,255,255,0.15)', padding:'2px 10px', borderRadius:'10px', fontWeight:600 }}>
              {ustErl} / {ustTasks.length} erledigt
            </span>
          )}
        </div>

        {/* Zahler-Typ */}
        <div style={{ padding:'10px 14px', background:'var(--surface)', borderBottom:'1px solid var(--border)', display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:'12px', color:'var(--text-muted)', fontWeight:600 }}>Voranmeldezeitraum:</span>
          {[
            { key:'monatlich',    label:'📅 Monatlich'      },
            { key:'quartalsweise',label:'📆 Vierteljährlich' },
            { key:'jährlich',     label:'📋 Jährlich'        },
            { key:'keine',        label:'✗ Keine USt'        },
          ].map(t => (
            <button key={t.key} onClick={() => setZahlerTyp(t.key)} style={{
              padding:'5px 14px', borderRadius:'20px', fontSize:'12px', cursor:'pointer',
              border:`1.5px solid ${ustTyp===t.key?'#1e3a5f':'var(--border)'}`,
              background:ustTyp===t.key?'#1e3a5f':'var(--surface2)',
              color:ustTyp===t.key?'#fff':'var(--text-secondary)',
              fontWeight:ustTyp===t.key?700:400, transition:'all 0.15s',
            }}>{t.label}</button>
          ))}
          <div style={{ marginLeft:'auto', flexShrink:0 }}>
            <label style={{ display:'flex', alignItems:'center', gap:'7px', cursor:'pointer', userSelect:'none' }}>
              <input type="checkbox"
                checked={client.ustInUebersicht !== false}
                onChange={e => onUpdate({ ustInUebersicht: e.target.checked })}
                style={{ width:'15px', height:'15px', accentColor:'#0f766e', cursor:'pointer' }} />
              <span style={{ fontSize:'12px', fontWeight: client.ustInUebersicht !== false ? 600 : 400, color: client.ustInUebersicht !== false ? '#0f766e' : 'var(--text-muted)' }}>
                📋 In Aufgaben-Übersicht anzeigen
              </span>
            </label>
          </div>
        </div>

        {/* Grid */}
        <div style={{ padding:'12px 14px', background:'var(--surface2)' }}>
          {ustTyp === 'keine' ? (
            <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:'12px', padding:'16px' }}>
              Keine USt-Voranmeldungen für diesen Mandanten konfiguriert.
            </div>
          ) : ustTasks.length === 0 ? (
            <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:'12px', padding:'16px' }}>
              Kein Veranlagungsjahr hinterlegt – bitte im Mandanten „Bearbeiten" eintragen.
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${ustTyp==='quartalsweise'?2:ustTyp==='jährlich'?1:4}, 1fr)`, gap:'8px' }}>
              {ustTasks.map(t => (
                <AufgabeKarte key={t.key} task={t} eintrag={getStatus(client, t.key)} onToggle={() => toggle(t.key)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Jahresabschluss ── */}
      {jaTasks.length > 0 && (
        <div style={{ border:'1px solid var(--border)', borderRadius:'8px', overflow:'hidden' }}>
          <div style={{ background:'#0f766e', color:'#fff', padding:'8px 14px', fontWeight:700, fontSize:'13px', display:'flex', gap:'8px', alignItems:'center' }}>
            <span>📁 Jahresabschluss</span>
            <label style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'7px', cursor:'pointer', userSelect:'none', fontWeight:400 }}>
              <input type="checkbox"
                checked={client.jaInUebersicht !== false}
                onChange={e => onUpdate({ jaInUebersicht: e.target.checked })}
                style={{ width:'15px', height:'15px', accentColor:'#a7f3d0', cursor:'pointer' }} />
              <span style={{ fontSize:'12px', color: client.jaInUebersicht !== false ? '#a7f3d0' : 'rgba(255,255,255,0.45)' }}>
                📋 In Aufgaben-Übersicht anzeigen
              </span>
            </label>
          </div>
          <div style={{ padding:'10px', background:'var(--surface2)', display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {jaTasks.map(t => (
              <div key={t.key} style={{ flex:'1', minWidth:'200px' }}>
                <AufgabeKarte task={t} eintrag={getStatus(client, t.key)} onToggle={() => toggle(t.key)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hinweise Jahresabschluss ── */}
      <NotizenBlock
        titel="Hinweise zur Jahresabschluss-Erstellung"
        icon="📁"
        color="#1e3a5f"
        eintraege={hinweise}
        onAdd={addHinweis}
        onDelete={delHinweis}
      />
    </div>
  )
}
