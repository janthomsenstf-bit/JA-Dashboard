import { useState, useMemo, useCallback } from 'react'
import { AUFTRAGS_TYP_CFG, AUFTRAGS_STATUS_CFG, generateSerieInstanzen, intervallLabel } from './detail/AuftraegeTab.jsx'

const CUR_MONAT = new Date().getMonth() + 1
const CUR_JAHR  = new Date().getFullYear()

const MONAT_KURZ   = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
const WOCHENTAG    = ['So','Mo','Di','Mi','Do','Fr','Sa']
const WOCHENTAG_L  = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag']
const STATUS_ORDER = ['offen','in_bearbeitung','erledigt']

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function fmtFrist(iso) {
  if (!iso) return null
  const d     = new Date(iso + 'T12:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const diff  = Math.ceil((d - today) / (1000*60*60*24))
  const ds    = `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
  if (diff < 0)   return { text: `${ds} (${Math.abs(diff)}d überfällig)`, color: '#ef4444', overfaellig: true }
  if (diff === 0) return { text: `${ds} (heute)`,    color: '#f97316', overfaellig: false }
  if (diff <= 7)  return { text: `${ds} (${diff}d)`, color: '#f97316', overfaellig: false }
  if (diff <= 30) return { text: `${ds} (${diff}d)`, color: '#eab308', overfaellig: false }
  return { text: ds, color: 'var(--text-muted)', overfaellig: false }
}

// Monatssicht: Frist-Monat bevorzugt vor Leistungsmonat
function getDisplayPeriod(au) {
  if (au.frist) {
    const d = new Date(au.frist + 'T12:00:00')
    if (!isNaN(d.getTime())) return { monat: d.getMonth()+1, jahr: d.getFullYear() }
  }
  return { monat: au.monat, jahr: au.jahr }
}

// Wochen-/Tagessicht: exaktes Datum (frist oder serieKey)
function getExactDate(au) {
  if (au.istSerie && au.serieKey) return au.serieKey
  if (au.frist) return au.frist
  return null
}

function getWeekStart(date) {
  const d = new Date(date); d.setHours(0,0,0,0)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))  // Montag
  return d
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

// Anzahl Tage, seit die Aufgabe überfällig ist (0 = heute/zukunft)
function daysSince(dateStr) {
  const heute = new Date(); heute.setHours(0,0,0,0)
  const d = new Date(dateStr + 'T00:00:00')
  if (d >= heute) return 0
  return Math.floor((heute - d) / 86400000)
}

function getKW(date) {
  const d = new Date(date); d.setHours(0,0,0,0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

function fmtDE(date, opts) {
  return date.toLocaleDateString('de-DE', opts)
}

// ── Gemeinsame Tabellenzeile ───────────────────────────────────────────────────
const thStyle = { padding:'8px 12px', textAlign:'left', fontWeight:600, color:'var(--text-muted)', fontSize:'11px', borderBottom:'2px solid var(--border)' }

function AuftragRow({ au, idx, onSelectClient, onCycleStatus, onNavigateToAuftrag, overdueDays }) {
  const typCfg    = AUFTRAGS_TYP_CFG[au.typ]      ?? AUFTRAGS_TYP_CFG.freitext
  const statusCfg = AUFTRAGS_STATUS_CFG[au.status] ?? AUFTRAGS_STATUS_CFG.offen
  const frist     = fmtFrist(au.frist)
  const erledigt  = au.status === 'erledigt'
  const bezeichnung = au.bezeichnung || null
  const zeitraum    = au.monat ? `${MONAT_KURZ[au.monat-1]} ${au.jahr}` : au.jahr ? String(au.jahr) : '—'
  const dp          = getDisplayPeriod(au)
  const fristAbweicht = !au.istSerie && au.frist && au.monat && (dp.monat !== au.monat || dp.jahr !== au.jahr)

  return (
    <tr style={{
      background: erledigt ? 'transparent' : frist?.overfaellig ? 'rgba(239,68,68,0.03)' : idx % 2 === 0 ? 'var(--surface)' : 'transparent',
      borderBottom: '1px solid var(--border)', opacity: erledigt ? 0.55 : 1, transition: 'background 0.1s',
    }}>
      <td style={{ padding:'8px 12px' }}>
        <button onClick={() => onSelectClient(au.client.id)}
          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--accent)', fontWeight:600, fontSize:'13px', padding:0, textAlign:'left' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
            {au.client.name}
            {(au.client.mandatstyp ?? 'extern') === 'intern' && (
              <span style={{ fontSize:'9px', fontWeight:700, padding:'1px 5px', borderRadius:'8px', background:'rgba(124,58,237,0.1)', color:'#7c3aed', border:'1px solid rgba(124,58,237,0.25)', flexShrink:0 }}>INTERN</span>
            )}
          </div>
          {au.client.mandantennummer && (
            <div style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'monospace', fontWeight:400 }}>{au.client.mandantennummer}</div>
          )}
        </button>
      </td>
      <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>
        <button onClick={() => onNavigateToAuftrag?.(au.client.id, au.id)} title={`→ ${typCfg.label} öffnen`}
          style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'10px', background:typCfg.bg, color:typCfg.color, border:`1px solid ${typCfg.border}`, whiteSpace:'nowrap', cursor:'pointer', transition:'filter 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.92)'}
          onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
          {typCfg.icon} {typCfg.label}
        </button>
      </td>
      <td style={{ padding:'8px 12px', maxWidth:'260px' }}>
        <div style={{ fontWeight: bezeichnung ? 500 : 400, color: bezeichnung ? 'var(--text)' : 'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'5px', textDecoration: erledigt ? 'line-through' : 'none' }}>
          {au.istSerie && (
            <span title={`Serienauftrag – ${au.serieLabel}`} style={{ fontSize:'10px', color:'rgba(99,102,241,0.85)', background:'rgba(99,102,241,0.08)', padding:'1px 5px', borderRadius:'6px', border:'1px solid rgba(99,102,241,0.2)', flexShrink:0, fontWeight:700 }}>
              🔁 {au.serieLabel}
            </span>
          )}
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{bezeichnung ?? `${typCfg.label} ${zeitraum}`}</span>
        </div>
        {au.emailRef && (
          <div style={{ fontSize:'10px', marginTop:'2px', display:'flex', alignItems:'center', gap:'4px' }}>
            <span style={{ padding:'1px 6px', borderRadius:'8px', background:'rgba(22,163,74,0.08)', color:'#16a34a', fontWeight:600, border:'1px solid rgba(22,163,74,0.15)' }}>📧 E-Mail</span>
            <span style={{ color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{au.emailRef.absender}</span>
          </div>
        )}
        {au.notiz && !au.emailRef && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'1px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{au.notiz}</div>}
        {au.typ === 'jahresabschluss' && au.jaCheckliste && (() => {
          const items = [
            { key: 'est', col1: true }, { key: 'gewst', col1: true }, { key: 'kst', col1: true },
            { key: 'ust', col1: true }, { key: 'ebilanz', col1: true }, { key: 'offenlegung', col1: true },
            { key: 'rechnung', col1: false },
          ]
          const total = items.reduce((n, it) => n + (it.col1 ? 1 : 0) + 1, 0)
          const done = items.reduce((n, it) => {
            const d = au.jaCheckliste[it.key] ?? {}
            return n + (it.col1 && d.mandantDatum ? 1 : 0) + (d.faDatum ? 1 : 0)
          }, 0)
          if (done === 0) return null
          const pct = Math.round((done / total) * 100)
          return (
            <div style={{ display:'flex', alignItems:'center', gap:'5px', marginTop:'3px' }}>
              <div style={{ flex:1, maxWidth:'80px', height:'3px', borderRadius:'2px', background:'var(--surface2)', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, borderRadius:'2px', background: pct === 100 ? '#16a34a' : '#2563eb' }} />
              </div>
              <span style={{ fontSize:'9px', fontWeight:700, color: pct === 100 ? '#16a34a' : '#2563eb' }}>
                {pct === 100 ? '✓ Checkliste' : `${done}/${total}`}
              </span>
            </div>
          )
        })()}
      </td>
      <td style={{ padding:'8px 12px', whiteSpace:'nowrap', fontSize:'12px' }}>
        <span style={{ color:'var(--text-muted)', fontFamily:'monospace' }}>{zeitraum}</span>
        {fristAbweicht && (
          <div style={{ fontSize:'9px', color:'var(--accent)', marginTop:'1px', fontFamily:'monospace' }}>
            → fällig {MONAT_KURZ[dp.monat-1]}{dp.jahr !== au.jahr ? ` ${dp.jahr}` : ''}
          </div>
        )}
      </td>
      <td style={{ padding:'8px 12px', whiteSpace:'nowrap', fontSize:'12px' }}>
        {overdueDays != null ? (
          <div>
            <span style={{ color:'#ef4444', fontWeight:700 }}>⚠ seit {overdueDays} Tag{overdueDays !== 1 ? 'en' : ''} offen</span>
            {au._carryFromDate && (
              <div style={{ fontSize:'10px', fontWeight:400, color:'var(--text-muted)', marginTop:'1px' }}>
                Frist: {fmtDE(new Date(au._carryFromDate + 'T00:00:00'), { day:'2-digit', month:'2-digit', year:'2-digit' })}
              </div>
            )}
          </div>
        ) : frist ? (
          <span style={{ color:frist.color, fontWeight:frist.overfaellig ? 700 : 400 }}>{frist.overfaellig ? '⚠ ' : ''}{frist.text}</span>
        ) : (
          <span style={{ color:'var(--text-muted)' }}>–</span>
        )}
      </td>
      <td style={{ padding:'8px 12px' }}>
        <button onClick={() => onCycleStatus(au)} title="Status wechseln"
          style={{ fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'20px', border:`1px solid ${statusCfg.border}`, background:statusCfg.bg, color:statusCfg.color, cursor:'pointer', whiteSpace:'nowrap' }}>
          {statusCfg.icon} {statusCfg.label}
          {erledigt && au.erledigtAm && (
            <span style={{ fontWeight:400, opacity:0.7, marginLeft:'5px', fontSize:'10px' }}>
              {new Date(au.erledigtAm).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit' })}
            </span>
          )}
        </button>
      </td>
    </tr>
  )
}

// ── Monats-Tabelle ────────────────────────────────────────────────────────────
function MonthTable({ gefiltert, alleAuftraege, onSelectClient, onCycleStatus, onNavigateToAuftrag }) {
  return (
    <div style={{ flex:1, overflowY:'auto', background:'var(--bg)' }}>
      {gefiltert.length === 0 ? (
        <div style={{ padding:'48px', textAlign:'center', color:'var(--text-muted)', fontSize:'14px' }}>
          {alleAuftraege.length === 0
            ? 'Noch keine Aufträge vorhanden. Aufträge werden pro Mandant im Reiter „Aufträge" angelegt.'
            : 'Keine Aufträge für diesen Filter.'}
        </div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
          <thead>
            <tr style={{ background:'var(--surface)', position:'sticky', top:0, zIndex:1 }}>
              <th style={thStyle}>Mandant</th>
              <th style={thStyle}>Typ</th>
              <th style={thStyle}>Bezeichnung</th>
              <th style={thStyle}>Zeitraum</th>
              <th style={thStyle}>Frist</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {gefiltert.map((au, idx) => (
              <AuftragRow key={au.id} au={au} idx={idx} onSelectClient={onSelectClient} onCycleStatus={onCycleStatus} onNavigateToAuftrag={onNavigateToAuftrag} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Wochen-Ansicht ────────────────────────────────────────────────────────────
function WeekView({ weekDays, onSelectClient, onCycleStatus, onQuickCreate, onNavigateToAuftrag }) {
  const heute = new Date(); heute.setHours(0,0,0,0)

  return (
    <div style={{ flex:1, display:'flex', overflowX:'auto', overflowY:'hidden', background:'var(--bg)' }}>
      {weekDays.map(({ date, items }, i) => {
        const istHeute    = isSameDay(date, heute)
        const istWE       = date.getDay() === 0 || date.getDay() === 6
        const isVergangen = date < heute && !istHeute
        return (
          <div key={i} style={{
            flex: istWE ? '0 0 110px' : '1 1 0', minWidth: istWE ? '110px' : '150px',
            borderRight: i < 6 ? '1px solid var(--border)' : 'none',
            display:'flex', flexDirection:'column', overflow:'hidden',
            background: istHeute ? 'rgba(59,130,246,0.03)' : istWE ? 'rgba(0,0,0,0.12)' : 'transparent',
          }}>
            {/* Tag-Header */}
            <div style={{
              padding:'8px 10px 6px', borderBottom:`2px solid ${istHeute ? '#3b82f6' : 'var(--border)'}`,
              background: istHeute ? 'rgba(59,130,246,0.1)' : 'var(--surface)',
              flexShrink:0,
            }}>
              <div style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', color: istHeute ? '#3b82f6' : istWE ? 'var(--text-muted)' : 'var(--text-muted)' }}>
                {WOCHENTAG[date.getDay()]}
              </div>
              <div style={{ fontSize:'22px', fontWeight:800, lineHeight:1.1, color: istHeute ? '#3b82f6' : isVergangen ? 'var(--text-muted)' : 'var(--text)' }}>
                {date.getDate()}
              </div>
              <div style={{ fontSize:'10px', color:'var(--text-muted)' }}>{MONAT_KURZ[date.getMonth()]}</div>
              {items.length > 0 && (
                <div style={{ fontSize:'10px', marginTop:'3px', color: istHeute ? '#3b82f6' : 'var(--text-muted)', fontWeight:600 }}>
                  {items.filter(a => a.status !== 'erledigt').length} aktiv
                </div>
              )}
            </div>

            {/* Items */}
            <div style={{ flex:1, overflowY:'auto', padding:'5px 5px 8px' }}>
              {items.map(au => (
                <WeekCard key={au.id} au={au} onSelectClient={onSelectClient} onCycleStatus={onCycleStatus} onNavigateToAuftrag={onNavigateToAuftrag} />
              ))}
              <button onClick={() => onQuickCreate(date)}
                style={{ width:'100%', padding:'4px', border:'1px dashed var(--border)', borderRadius:'6px', background:'transparent', color:'var(--text-muted)', fontSize:'11px', cursor:'pointer', marginTop: items.length > 0 ? '4px' : 0 }}>
                + Auftrag
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WeekCard({ au, onSelectClient, onCycleStatus, onNavigateToAuftrag }) {
  const typCfg    = AUFTRAGS_TYP_CFG[au.typ]      ?? AUFTRAGS_TYP_CFG.freitext
  const statusCfg = AUFTRAGS_STATUS_CFG[au.status] ?? AUFTRAGS_STATUS_CFG.offen
  const erledigt  = au.status === 'erledigt'
  const heute     = new Date(); heute.setHours(0,0,0,0)
  const exact     = getExactDate(au)
  const isOverdue = !erledigt && exact && new Date(exact + 'T00:00:00') < heute
  const overdueDays = isOverdue ? daysSince(exact) : 0
  return (
    <div style={{
      padding:'5px 7px', borderRadius:'6px', marginBottom:'3px',
      border:`1px solid ${isOverdue ? 'rgba(239,68,68,0.4)' : typCfg.border}`,
      borderLeft: isOverdue ? '3px solid #ef4444' : `1px solid ${typCfg.border}`,
      background: erledigt ? 'rgba(22,163,74,0.04)' : isOverdue ? 'rgba(239,68,68,0.05)' : typCfg.bg,
      opacity: erledigt ? 0.6 : 1,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'2px' }}>
        <button onClick={() => onNavigateToAuftrag?.(au.client.id, au.id)} title={`→ ${typCfg.label} öffnen`}
          style={{ fontSize:'11px', background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:1 }}>{typCfg.icon}</button>
        {au.istSerie && <span style={{ fontSize:'9px', color:'rgba(99,102,241,0.8)', fontWeight:700 }}>🔁</span>}
        {isOverdue && <span style={{ fontSize:'9px', color:'#ef4444', fontWeight:700 }}>⚠{overdueDays}d</span>}
        <button onClick={() => onCycleStatus(au)} title="Status wechseln"
          style={{ marginLeft:'auto', fontSize:'9px', fontWeight:700, padding:'1px 5px', borderRadius:'10px', border:`1px solid ${statusCfg.border}`, background:statusCfg.bg, color:statusCfg.color, cursor:'pointer', flexShrink:0 }}>
          {statusCfg.icon}
        </button>
      </div>
      <div style={{ fontSize:'11px', fontWeight:500, color: erledigt ? 'var(--text-muted)' : isOverdue ? '#dc2626' : 'var(--text)', textDecoration: erledigt ? 'line-through' : 'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {au.bezeichnung || typCfg.label}
      </div>
      <button onClick={() => onSelectClient(au.client.id)}
        style={{ fontSize:'10px', color:'var(--accent)', background:'none', border:'none', cursor:'pointer', padding:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%', display:'block', textAlign:'left' }}>
        {au.client.name}
      </button>
    </div>
  )
}

// ── Tages-Ansicht ─────────────────────────────────────────────────────────────
function DayTable({ items, date, onSelectClient, onCycleStatus, onQuickCreate, onNavigateToAuftrag }) {
  const heute = new Date(); heute.setHours(0,0,0,0)
  const istHeute    = isSameDay(date, heute)
  const carryItems  = items.filter(a => a._carryForward)
  const todayItems  = items.filter(a => !a._carryForward)

  function TableSection({ rows, startIdx = 0 }) {
    return (
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
        <thead>
          <tr style={{ background:'var(--surface)', position:'sticky', top:0, zIndex:1 }}>
            <th style={thStyle}>Mandant</th>
            <th style={thStyle}>Typ</th>
            <th style={thStyle}>Bezeichnung</th>
            <th style={thStyle}>Zeitraum</th>
            <th style={thStyle}>Frist</th>
            <th style={thStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((au, idx) => (
            <AuftragRow key={au.id} au={au} idx={startIdx + idx}
              onSelectClient={onSelectClient} onCycleStatus={onCycleStatus}
              onNavigateToAuftrag={onNavigateToAuftrag}
              overdueDays={au._carryForward ? au._carryDays : undefined} />
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <div style={{ flex:1, overflowY:'auto', background:'var(--bg)' }}>
      {/* Tages-Header */}
      <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--surface)', display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>KW {getKW(date)}</span>
        <span style={{ fontSize:'12px', fontWeight:600, color:'var(--text)' }}>
          {WOCHENTAG_L[date.getDay()]}, {fmtDE(date, { day:'2-digit', month:'long', year:'numeric' })}
          {istHeute && <span style={{ marginLeft:'6px', fontSize:'11px', color:'#3b82f6', fontWeight:700 }}>● Heute</span>}
        </span>
        {carryItems.length > 0 && (
          <span style={{ fontSize:'11px', fontWeight:700, padding:'2px 9px', borderRadius:'20px', background:'rgba(239,68,68,0.12)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)' }}>
            ⚠ {carryItems.length} mitgenommen
          </span>
        )}
        <button onClick={() => onQuickCreate(date)}
          style={{ marginLeft:'auto', padding:'5px 12px', borderRadius:'7px', border:'1px dashed var(--border)', background:'transparent', color:'var(--accent)', fontSize:'12px', cursor:'pointer' }}>
          + Auftrag für diesen Tag
        </button>
      </div>

      {items.length === 0 ? (
        <div style={{ padding:'48px', textAlign:'center', color:'var(--text-muted)', fontSize:'14px' }}>
          Keine Aufträge für diesen Tag.
          <div style={{ fontSize:'11px', marginTop:'8px', opacity:0.7, maxWidth:'380px', margin:'8px auto 0' }}>
            Aufträge erscheinen hier, wenn ihr Frist-Datum auf diesen Tag gesetzt ist, oder wenn ein Serienauftrag für diesen Tag generiert wird.
          </div>
        </div>
      ) : (
        <>
          {/* Sektion: Mitgenommene überfällige Aufgaben */}
          {carryItems.length > 0 && (
            <div>
              <div style={{ padding:'8px 16px 6px', background:'rgba(239,68,68,0.06)', borderBottom:'1px solid rgba(239,68,68,0.15)', display:'flex', alignItems:'center', gap:'7px' }}>
                <span style={{ fontSize:'13px' }}>📌</span>
                <span style={{ fontSize:'12px', fontWeight:700, color:'#ef4444' }}>Mitgenommene Aufgaben ({carryItems.length})</span>
                <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>– offen seit einem früheren Tag</span>
              </div>
              <div style={{ background:'rgba(239,68,68,0.015)' }}>
                <TableSection rows={carryItems} startIdx={0} />
              </div>
            </div>
          )}

          {/* Sektion: Heute fällige Aufgaben */}
          {todayItems.length > 0 && (
            <div>
              {carryItems.length > 0 && (
                <div style={{ padding:'8px 16px 6px', background:'rgba(59,130,246,0.05)', borderBottom:'1px solid rgba(59,130,246,0.12)', borderTop:'2px solid var(--border)', display:'flex', alignItems:'center', gap:'7px' }}>
                  <span style={{ fontSize:'13px' }}>📅</span>
                  <span style={{ fontSize:'12px', fontWeight:700, color:'#60a5fa' }}>Heute fällig ({todayItems.length})</span>
                </div>
              )}
              <TableSection rows={todayItems} startIdx={carryItems.length} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Schnell-Anlegen-Modal ─────────────────────────────────────────────────────
const modalLabelStyle = { fontSize:'11px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'4px' }
const modalInputStyle = { padding:'7px 10px', borderRadius:'7px', border:'1px solid var(--border)', background:'var(--surface2)', color:'var(--text)', fontSize:'13px', width:'100%', boxSizing:'border-box' }

function QuickCreateModal({ day, clients, onClose, onCreate }) {
  const [clientId,    setClientId]    = useState(clients[0]?.id ?? '')
  const [typ,         setTyp]         = useState('freitext')
  const [bezeichnung, setBezeichnung] = useState('')

  const dayStr = fmtDE(day, { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' })

  function handleSubmit() {
    if (!clientId) return
    onCreate(clientId, typ, bezeichnung.trim())
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'12px', padding:'22px', width:'min(440px, 92vw)', boxShadow:'0 24px 60px rgba(0,0,0,0.4)', border:'1px solid var(--border)' }}>
        <div style={{ fontWeight:700, fontSize:'14px', marginBottom:'4px' }}>➕ Auftrag anlegen</div>
        <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'18px' }}>für {dayStr}</div>

        <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'18px' }}>
          <label>
            <span style={modalLabelStyle}>Mandant</span>
            <select value={clientId} onChange={e => setClientId(e.target.value)} style={modalInputStyle}>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.mandantennummer ? ` (${c.mandantennummer})` : ''}</option>
              ))}
            </select>
          </label>
          <label>
            <span style={modalLabelStyle}>Typ</span>
            <select value={typ} onChange={e => setTyp(e.target.value)} style={modalInputStyle}>
              {Object.entries(AUFTRAGS_TYP_CFG).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </label>
          <label>
            <span style={modalLabelStyle}>Bezeichnung (optional)</span>
            <input value={bezeichnung} onChange={e => setBezeichnung(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="Kurze Beschreibung…" style={modalInputStyle} autoFocus />
          </label>
        </div>

        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          <button onClick={onClose}
            style={{ padding:'7px 14px', borderRadius:'7px', border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:'13px', cursor:'pointer' }}>
            Abbrechen
          </button>
          <button onClick={handleSubmit} disabled={!clientId}
            style={{ padding:'7px 18px', borderRadius:'7px', border:'none', background: clientId ? 'var(--accent)' : 'var(--border)', color: clientId ? '#fff' : 'var(--text-muted)', fontWeight:700, fontSize:'13px', cursor: clientId ? 'pointer' : 'not-allowed' }}>
            ✓ Anlegen
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Statistik-Badge ────────────────────────────────────────────────────────────
function StatBadge({ label, count, color, bg }) {
  return (
    <div style={{ textAlign:'center', padding:'8px 14px', borderRadius:'8px', border:`1px solid ${color}44`, background:bg, minWidth:'80px' }}>
      <div style={{ fontSize:'22px', fontWeight:800, color }}>{count}</div>
      <div style={{ fontSize:'11px', color, opacity:0.85, marginTop:'2px' }}>{label}</div>
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function GlobalTodoView({ clients, onUpdateClient, onSelectClient, onNavigateToAuftrag }) {
  const aktiveClients = useMemo(() => clients.filter(c => !c.archiviert), [clients])

  // ── Ansicht & Navigation ──────────────────────────────────────────────────
  const [viewMode,      setViewMode]      = useState('monat')
  const [navDate,       setNavDate]       = useState(() => new Date())
  const [quickCreateDay, setQuickCreateDay] = useState(null)

  // ── Filter ────────────────────────────────────────────────────────────────
  const [filterJahr,       setFilterJahr]       = useState(CUR_JAHR)
  const [filterMonat,      setFilterMonat]      = useState(CUR_MONAT)
  const [filterTyp,        setFilterTyp]        = useState('alle')
  const [filterStatus,     setFilterStatus]     = useState('aktiv')
  const [filterMandatstyp, setFilterMandatstyp] = useState('alle')

  // ── Alle Aufträge (Serien expandiert) ─────────────────────────────────────
  const alleAuftraege = useMemo(() => {
    const result = []
    for (const client of aktiveClients) {
      for (const au of (client.auftraege ?? [])) {
        if (au.istSerie) {
          for (const inst of generateSerieInstanzen(au)) {
            result.push({
              id: `${au.id}_${inst.key}`, serieId: au.id, serieKey: inst.key,
              istSerie: true, typ: au.typ, bezeichnung: au.bezeichnung, notiz: au.notiz,
              jahr: inst.datum.getFullYear(), monat: inst.datum.getMonth() + 1,
              frist: null, status: inst.status, erledigtAm: inst.erledigtAm,
              serieLabel: intervallLabel(au.serie), client,
            })
          }
        } else {
          result.push({ ...au, client })
        }
      }
    }
    return result
  }, [aktiveClients])

  // ── Verfügbare Jahre ──────────────────────────────────────────────────────
  const verfuegbareJahre = useMemo(() => {
    const jahre = new Set([CUR_JAHR, CUR_JAHR + 1])
    for (const au of alleAuftraege) {
      if (au.jahr) jahre.add(au.jahr)
      const dp = getDisplayPeriod(au)
      if (dp.jahr) jahre.add(dp.jahr)
    }
    return [...jahre].sort((a, b) => b - a)
  }, [alleAuftraege])

  // ── Gemeinsamer Status-Filter ─────────────────────────────────────────────
  const passesStatus = useCallback((au) => {
    if (filterStatus === 'aktiv'          && au.status === 'erledigt')       return false
    if (filterStatus === 'offen'          && au.status !== 'offen')          return false
    if (filterStatus === 'in_bearbeitung' && au.status !== 'in_bearbeitung') return false
    if (filterStatus === 'erledigt'       && au.status !== 'erledigt')       return false
    return true
  }, [filterStatus])

  const passesCommon = useCallback((au) => {
    if (filterTyp !== 'alle' && au.typ !== filterTyp) return false
    if (filterMandatstyp !== 'alle' && (au.client.mandatstyp ?? 'extern') !== filterMandatstyp) return false
    return passesStatus(au)
  }, [filterTyp, filterMandatstyp, passesStatus])

  // ── Monatssicht: gefilterte Aufträge ──────────────────────────────────────
  const gefiltert = useMemo(() => {
    if (viewMode !== 'monat') return []
    return alleAuftraege.filter(au => {
      const dp = getDisplayPeriod(au)
      if (dp.jahr !== filterJahr) return false
      if (filterMonat !== null && dp.monat !== null && dp.monat !== filterMonat) return false
      return passesCommon(au)
    })
  }, [alleAuftraege, viewMode, filterJahr, filterMonat, passesCommon])

  // ── Wochensicht: 7 Tage mit Items ─────────────────────────────────────────
  const weekDays = useMemo(() => {
    if (viewMode !== 'woche') return null
    const ws = getWeekStart(navDate)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws); d.setDate(ws.getDate() + i)
      return { date: d, items: [] }
    })
    for (const au of alleAuftraege) {
      if (!passesCommon(au)) continue
      const exact = getExactDate(au)
      if (!exact) continue
      const exactDate = new Date(exact + 'T00:00:00')
      const idx = days.findIndex(d => isSameDay(d.date, exactDate))
      if (idx >= 0) days[idx].items.push(au)
    }
    return days
  }, [alleAuftraege, viewMode, navDate, passesCommon])

  // ── Tagessicht: Items für einen Tag (inkl. mitgenommene überfällige) ──────
  const dayItems = useMemo(() => {
    if (viewMode !== 'tag') return null
    const heute = new Date(); heute.setHours(0,0,0,0)
    const navDay = new Date(navDate); navDay.setHours(0,0,0,0)
    const isCurrentOrFuture = navDay >= heute
    const result = []
    for (const au of alleAuftraege) {
      if (!passesCommon(au)) continue
      const exact = getExactDate(au)
      if (!exact) continue
      const exactDate = new Date(exact + 'T00:00:00')
      if (isSameDay(exactDate, navDate)) {
        result.push(au)
      } else if (isCurrentOrFuture && exactDate < navDay && au.status !== 'erledigt') {
        result.push({ ...au,
          _carryForward: true,
          _carryDays:    Math.floor((navDay - exactDate) / 86400000),
          _carryFromDate: exact,
        })
      }
    }
    return result
  }, [alleAuftraege, viewMode, navDate, passesCommon])

  // ── Statistiken (status-unabhängig für korrekte Übersicht) ────────────────
  const stats = useMemo(() => {
    let basis
    if (viewMode === 'monat') {
      basis = alleAuftraege.filter(au => {
        const dp = getDisplayPeriod(au)
        if (dp.jahr !== filterJahr) return false
        if (filterMonat !== null && dp.monat !== null && dp.monat !== filterMonat) return false
        if (filterTyp !== 'alle' && au.typ !== filterTyp) return false
        if (filterMandatstyp !== 'alle' && (au.client.mandatstyp ?? 'extern') !== filterMandatstyp) return false
        return true
      })
    } else if (viewMode === 'woche' && weekDays) {
      basis = weekDays.flatMap(d => d.items)
      // weekDays already has passesCommon applied, but without status filter
      // Re-collect without status filter for stats:
      const ws = getWeekStart(navDate)
      basis = alleAuftraege.filter(au => {
        const exact = getExactDate(au)
        if (!exact) return false
        const offset = Math.floor((new Date(exact + 'T00:00:00') - ws) / 86400000)
        if (offset < 0 || offset > 6) return false
        if (filterTyp !== 'alle' && au.typ !== filterTyp) return false
        if (filterMandatstyp !== 'alle' && (au.client.mandatstyp ?? 'extern') !== filterMandatstyp) return false
        return true
      })
    } else if (viewMode === 'tag') {
      const heute2 = new Date(); heute2.setHours(0,0,0,0)
      const navDay2 = new Date(navDate); navDay2.setHours(0,0,0,0)
      const isCurrentOrFuture2 = navDay2 >= heute2
      basis = alleAuftraege.filter(au => {
        const exact = getExactDate(au)
        if (!exact) return false
        const exactDate = new Date(exact + 'T00:00:00')
        const isToday  = isSameDay(exactDate, navDate)
        const isCarry  = isCurrentOrFuture2 && exactDate < navDay2 && au.status !== 'erledigt'
        if (!isToday && !isCarry) return false
        if (filterTyp !== 'alle' && au.typ !== filterTyp) return false
        if (filterMandatstyp !== 'alle' && (au.client.mandatstyp ?? 'extern') !== filterMandatstyp) return false
        return true
      })
    } else {
      basis = []
    }
    const heute = new Date()
    const ueberfaellig = basis.filter(au => {
      if (au.status === 'erledigt') return false
      const d = getExactDate(au) ?? au.frist
      if (!d) return false
      return new Date(d + 'T12:00:00') < heute
    }).length
    return {
      offen:       basis.filter(a => a.status === 'offen').length,
      in_bearb:    basis.filter(a => a.status === 'in_bearbeitung').length,
      erledigt:    basis.filter(a => a.status === 'erledigt').length,
      ueberfaellig,
    }
  }, [alleAuftraege, viewMode, navDate, filterJahr, filterMonat, filterTyp, filterMandatstyp, weekDays])

  // ── Navigation ────────────────────────────────────────────────────────────
  function switchView(mode) {
    if (mode !== 'monat' && viewMode === 'monat') {
      setNavDate(new Date(filterJahr, filterMonat - 1, 1))
    } else if (mode === 'monat' && viewMode !== 'monat') {
      setFilterJahr(navDate.getFullYear())
      setFilterMonat(navDate.getMonth() + 1)
    }
    setViewMode(mode)
  }

  function goToday() {
    const today = new Date()
    setNavDate(today)
    setFilterJahr(today.getFullYear())
    setFilterMonat(today.getMonth() + 1)
  }

  function goPrev() {
    if (viewMode === 'monat') {
      let m = filterMonat - 1, y = filterJahr
      if (m < 1) { m = 12; y-- }
      setFilterMonat(m); setFilterJahr(y)
      setNavDate(new Date(y, m-1, 1))
    } else if (viewMode === 'woche') {
      const d = new Date(navDate); d.setDate(d.getDate() - 7); setNavDate(d)
    } else {
      const d = new Date(navDate); d.setDate(d.getDate() - 1); setNavDate(d)
    }
  }

  function goNext() {
    if (viewMode === 'monat') {
      let m = filterMonat + 1, y = filterJahr
      if (m > 12) { m = 1; y++ }
      setFilterMonat(m); setFilterJahr(y)
      setNavDate(new Date(y, m-1, 1))
    } else if (viewMode === 'woche') {
      const d = new Date(navDate); d.setDate(d.getDate() + 7); setNavDate(d)
    } else {
      const d = new Date(navDate); d.setDate(d.getDate() + 1); setNavDate(d)
    }
  }

  // Navigation-Label
  const navLabel = useMemo(() => {
    if (viewMode === 'monat') return `${MONAT_KURZ[filterMonat-1]} ${filterJahr}`
    if (viewMode === 'woche') {
      const ws = getWeekStart(navDate)
      const we = new Date(ws); we.setDate(ws.getDate() + 6)
      return `KW ${getKW(ws)} · ${fmtDE(ws, {day:'2-digit',month:'2-digit'})} – ${fmtDE(we, {day:'2-digit',month:'2-digit',year:'numeric'})}`
    }
    return fmtDE(navDate, { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' })
  }, [viewMode, filterMonat, filterJahr, navDate])

  // ── Status umschalten ─────────────────────────────────────────────────────
  function cycleStatus(au) {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(au.status) + 1) % STATUS_ORDER.length]
    if (au.istSerie && au.serieId && au.serieKey) {
      const upd = (au.client.auftraege ?? []).map(a => {
        if (a.id !== au.serieId) return a
        return { ...a, instanzen: { ...(a.instanzen ?? {}), [au.serieKey]: { status: next, erledigtAm: next === 'erledigt' ? new Date().toISOString() : null } } }
      })
      onUpdateClient(au.client.id, { auftraege: upd })
    } else {
      const upd = (au.client.auftraege ?? []).map(a =>
        a.id === au.id ? { ...a, status: next, erledigtAm: next === 'erledigt' ? new Date().toISOString() : null } : a
      )
      onUpdateClient(au.client.id, { auftraege: upd })
    }
  }

  // ── Schnell-Anlegen ───────────────────────────────────────────────────────
  function handleQuickCreate(clientId, typ, bezeichnung) {
    const client = aktiveClients.find(c => c.id === clientId)
    if (!client || !quickCreateDay) return
    const frist = quickCreateDay.toISOString().slice(0, 10)
    const newAu = {
      id:          'au_' + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
      typ,
      bezeichnung,
      jahr:        quickCreateDay.getFullYear(),
      monat:       quickCreateDay.getMonth() + 1,
      frist,
      status:      'offen',
      notiz:       '',
      hinweise:    [],
      erstelltAm:  new Date().toISOString(),
      erledigtAm:  null,
    }
    onUpdateClient(clientId, { auftraege: [...(client.auftraege ?? []), newAu] })
    setQuickCreateDay(null)
  }

  // ── Footer-Info ───────────────────────────────────────────────────────────
  const footerInfo = useMemo(() => {
    if (viewMode === 'monat') return `${gefiltert.length} Einträge angezeigt`
    if (viewMode === 'woche') return `${weekDays?.flatMap(d => d.items).length ?? 0} Einträge diese Woche`
    if (viewMode === 'tag') {
      const carry = dayItems?.filter(a => a._carryForward).length ?? 0
      const total = dayItems?.length ?? 0
      if (carry > 0) return `${total} Einträge · davon ${carry} mitgenommen`
      return `${total} Einträge`
    }
    return ''
  }, [viewMode, gefiltert.length, weekDays, dayItems])

  // ── Styles ────────────────────────────────────────────────────────────────
  const btnFilter = (active, accentColor) => ({
    padding:'4px 10px', borderRadius:'20px', fontSize:'11px', cursor:'pointer',
    border:`1px solid ${active ? accentColor : 'rgba(255,255,255,0.2)'}`,
    background: active ? `${accentColor}33` : 'transparent',
    color: active ? accentColor : 'rgba(255,255,255,0.6)',
    fontWeight: active ? 700 : 400,
  })
  const inputStyle = { padding:'5px 10px', border:'1px solid rgba(255,255,255,0.2)', borderRadius:'6px', background:'rgba(255,255,255,0.08)', color:'#fff', fontSize:'12px', cursor:'pointer' }
  const divider = <div style={{ height:'20px', width:'1px', background:'rgba(255,255,255,0.15)', flexShrink:0 }} />

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding:'12px 16px 10px', background:'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color:'#fff', flexShrink:0 }}>

        {/* Zeile 1: Titel + View-Mode + Stats */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px', flexWrap:'wrap' }}>
          <span style={{ fontSize:'20px' }}>📋</span>
          <div>
            <div style={{ fontWeight:800, fontSize:'15px' }}>Auftrags-Übersicht</div>
            <div style={{ fontSize:'10px', opacity:0.55 }}>Alle Mandate</div>
          </div>

          {/* Ansicht-Umschalter */}
          <div style={{ display:'flex', background:'rgba(255,255,255,0.07)', borderRadius:'8px', padding:'2px', border:'1px solid rgba(255,255,255,0.12)', marginLeft:'4px' }}>
            {[['monat','📅 Monat'],['woche','📆 Woche'],['tag','🗓 Tag']].map(([m,l]) => (
              <button key={m} onClick={() => switchView(m)} style={{
                padding:'4px 11px', borderRadius:'6px', fontSize:'11px', fontWeight:600, cursor:'pointer', border:'none',
                background: viewMode === m ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: viewMode === m ? '#fff' : 'rgba(255,255,255,0.45)',
                transition:'background 0.15s',
              }}>{l}</button>
            ))}
          </div>

          {/* Stat-Badges */}
          <div style={{ marginLeft:'auto', display:'flex', gap:'7px', alignItems:'center', flexWrap:'wrap' }}>
            <StatBadge label="Offen"    count={stats.offen}    color="#60a5fa" bg="rgba(96,165,250,0.12)" />
            <StatBadge label="Bearb."   count={stats.in_bearb} color="#a78bfa" bg="rgba(167,139,250,0.12)" />
            <StatBadge label="Erledigt" count={stats.erledigt} color="#4ade80" bg="rgba(74,222,128,0.12)" />
            {stats.ueberfaellig > 0 && (
              <StatBadge label="Überfällig" count={stats.ueberfaellig} color="#f87171" bg="rgba(248,113,113,0.12)" />
            )}
          </div>
        </div>

        {/* Zeile 2: Navigation + Filter */}
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>

          {/* Zeitraum-Navigation */}
          <button onClick={goPrev} title="Zurück"
            style={{ ...inputStyle, padding:'4px 11px', fontWeight:800, fontSize:'14px', lineHeight:1 }}>‹</button>
          <button onClick={goToday}
            style={{ ...inputStyle, padding:'4px 10px', fontSize:'11px', fontWeight:600 }}>Heute</button>
          <button onClick={goNext} title="Vor"
            style={{ ...inputStyle, padding:'4px 11px', fontWeight:800, fontSize:'14px', lineHeight:1 }}>›</button>
          <span style={{ fontSize:'12px', fontWeight:700, color:'rgba(255,255,255,0.9)', whiteSpace:'nowrap', minWidth:'175px' }}>{navLabel}</span>

          {/* Monatssicht: Jahr-Dropdown + Monats-Chips */}
          {viewMode === 'monat' && (
            <>
              <select value={filterJahr} onChange={e => setFilterJahr(Number(e.target.value))} style={{ ...inputStyle, fontWeight:600 }}>
                {verfuegbareJahre.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <div style={{ display:'flex', gap:'3px', flexWrap:'wrap' }}>
                <button onClick={() => setFilterMonat(null)} style={btnFilter(filterMonat === null, '#60a5fa')}>Alle</button>
                {MONAT_KURZ.map((m, i) => (
                  <button key={i} onClick={() => setFilterMonat(filterMonat === i+1 ? null : i+1)}
                    style={{
                      ...btnFilter(filterMonat === i+1, '#60a5fa'),
                      padding:'3px 7px',
                      outline: i+1 === CUR_MONAT && filterJahr === CUR_JAHR ? '1px solid rgba(255,255,255,0.25)' : 'none',
                    }}>{m}</button>
                ))}
              </div>
            </>
          )}

          {/* Wochen-/Tagessicht: Datepicker */}
          {viewMode !== 'monat' && (
            <input type="date" value={navDate.toISOString().slice(0,10)}
              onChange={e => e.target.value && setNavDate(new Date(e.target.value + 'T00:00:00'))}
              style={{ ...inputStyle, colorScheme:'dark' }} />
          )}

          {divider}

          {/* Typ-Filter */}
          <button onClick={() => setFilterTyp('alle')} style={btnFilter(filterTyp === 'alle', '#a78bfa')}>Alle Typen</button>
          {Object.entries(AUFTRAGS_TYP_CFG).map(([k,v]) => (
            <button key={k} onClick={() => setFilterTyp(filterTyp === k ? 'alle' : k)} style={btnFilter(filterTyp === k, '#a78bfa')}>{v.icon} {v.label}</button>
          ))}

          {divider}

          {/* Status-Filter */}
          {[['aktiv','Aktiv'],['offen','○ Offen'],['in_bearbeitung','◑ In Bearb.'],['erledigt','● Erledigt'],['alle','Alle']].map(([k,l]) => (
            <button key={k} onClick={() => setFilterStatus(k)} style={btnFilter(filterStatus === k, '#4ade80')}>{l}</button>
          ))}

          {divider}

          {/* Mandatstyp-Filter */}
          {[['alle','👥 Alle'],['extern','🏢 Extern'],['intern','🏠 Intern']].map(([k,l]) => (
            <button key={k} onClick={() => setFilterMandatstyp(k)} style={btnFilter(filterMandatstyp === k, '#f59e0b')}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── Inhalt ── */}
      {viewMode === 'monat' && (
        <MonthTable gefiltert={gefiltert} alleAuftraege={alleAuftraege} onSelectClient={onSelectClient} onCycleStatus={cycleStatus} onNavigateToAuftrag={onNavigateToAuftrag} />
      )}
      {viewMode === 'woche' && weekDays && (
        <WeekView weekDays={weekDays} onSelectClient={onSelectClient} onCycleStatus={cycleStatus} onQuickCreate={setQuickCreateDay} onNavigateToAuftrag={onNavigateToAuftrag} />
      )}
      {viewMode === 'tag' && dayItems && (
        <DayTable items={dayItems} date={navDate} onSelectClient={onSelectClient} onCycleStatus={cycleStatus} onQuickCreate={setQuickCreateDay} onNavigateToAuftrag={onNavigateToAuftrag} />
      )}

      {/* ── Footer ── */}
      <div style={{ padding:'6px 16px', background:'var(--surface)', borderTop:'1px solid var(--border)', fontSize:'11px', color:'var(--text-muted)', display:'flex', gap:'16px', alignItems:'center', flexShrink:0 }}>
        <span>{footerInfo}</span>
        <span>{aktiveClients.length} Mandate aktiv</span>
        <span>{alleAuftraege.filter(a => !a.istSerie).length} Einzelaufträge · {alleAuftraege.filter(a => a.istSerie).length} Serieninstanzen</span>
        <span style={{ marginLeft:'auto' }}>Tipp: Klick auf Mandantenname öffnet die Detail-Ansicht · Klick auf Status wechselt ihn</span>
      </div>

      {/* ── Schnell-Anlegen-Modal ── */}
      {quickCreateDay && (
        <QuickCreateModal
          day={quickCreateDay}
          clients={aktiveClients}
          onClose={() => setQuickCreateDay(null)}
          onCreate={handleQuickCreate}
        />
      )}
    </div>
  )
}
