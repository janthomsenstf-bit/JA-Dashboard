import { useState, useMemo, useCallback, useEffect } from 'react'
import { AUFTRAGS_TYP_CFG, AUFTRAGS_STATUS_CFG, JA_WORKFLOW_STATUS, generateSerieInstanzen, intervallLabel } from './detail/AuftraegeTab.jsx'
import { generateAufgaben, generateManuelleAufgaben, getStatus as getAufgabeStatus, buildTogglePatch } from '../utils/aufgaben.js'

// Automatisch generierte Fristen (aus Stammdaten) → Auftrags-Typen der Übersicht.
// JA fehlt bewusst (im Auftrags-System reicher abgebildet – sonst Doppelung).
const GEN_TYP_MAP = { USt: 'ust', Lohn: 'lohn', LohnSV: 'lohn', FIBU: 'fibu', Zusatz: 'freitext' }
// Zeitfenster (Tage), in dem generierte Fristen im Radar/Eilig mitzählen.
const GEN_WINDOW_BACK = 60
const GEN_WINDOW_FWD  = 90
// Ersatz-Mandant für manuelle Aufgaben ohne Mandantenbezug (Kanzlei-Todos).
const KANZLEI_CLIENT = { id: '__kanzlei__', name: 'Ohne Mandant (Kanzlei)', mandatstyp: 'intern', mandantennummer: '' }

const CUR_MONAT = new Date().getMonth() + 1
const CUR_JAHR  = new Date().getFullYear()

const MONAT_KURZ   = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
const WOCHENTAG    = ['So','Mo','Di','Mi','Do','Fr','Sa']
const WOCHENTAG_L  = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag']
const STATUS_ORDER = ['offen','in_bearbeitung','erledigt']

// Persistente Filter der Übersicht – reine Anzeige-Einstellungen, gerätelokal.
// Die reine Auftragsansicht und die Gesamtansicht merken sich ihre Einstellungen
// getrennt (eigener Schlüssel) – sonst verstellen sich die beiden Reiter
// gegenseitig Monat und Filter.
const TODO_FILTER_KEY = 'sda-todo-filters-v1'
function filterKeyFuer(modus) {
  return modus === 'auftraege' ? TODO_FILTER_KEY + '-auftraege' : TODO_FILTER_KEY
}
function loadTodoFilters(key = TODO_FILTER_KEY) {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) || {}
  } catch {}
  return {}
}

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

// Wann wurde der Eintrag angelegt? Automatisch erzeugte Fristen haben kein
// Anlagedatum – sie entstehen bei jeder Berechnung neu.
function erstelltAmVon(au) {
  if (au._generiert) return null
  const iso = au.erstelltAm ?? au.createdAt ?? null
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

function fmtErstellt(au) {
  const d = erstelltAmVon(au)
  return d ? `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}` : null
}

function tageSeitErstellt(au) {
  const d = erstelltAmVon(au)
  if (!d) return null
  d.setHours(0,0,0,0)
  const heute = new Date(); heute.setHours(0,0,0,0)
  return Math.max(0, Math.round((heute - d) / 86400000))
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

// ISO-Zeitstempel → lokales yyyy-mm-dd (verhindert Zeitzonen-Verschiebung um 1 Tag)
function isoToLocalYMD(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ── Dringlichkeit ──────────────────────────────────────────────────────────────
// Ein Auftrag bekommt einen Dringlichkeits-Score. Höher = dringender.
// Reihenfolge: überfällig > 🔥 eilig (Fertigstellung überfällig) > nachfassen >
//              🔥 eilig (markiert) > Frist ≤ 7 Tage > Priorität hoch > Frist ≤ 30 Tage > normal.
// Ab so vielen Tagen Wartezeit gilt ein JA-Auftrag als „nachzufassen".
const NACHFASS_TAGE = 14
const WARTE_STATUS  = { warte_rueckmeldung: 'Rückmeldung', warte_unterschrift: 'Unterschrift' }

// Ampel-/Level-Farben (zentral, damit Tabellen & Mandantensicht identisch aussehen)
const URGENCY_COLOR = {
  overfaellig: '#ef4444',
  nachfassen:  '#f59e0b',
  eilig:       '#ef4444',
  frist_bald:  '#f97316',
  prio_hoch:   '#eab308',
  frist_monat: '#eab308',
  normal:      'var(--text-muted)',
  erledigt:    '#16a34a',
}

function computeUrgency(au) {
  if (au.status === 'erledigt') return { level: 'erledigt', score: 0, reason: 'erledigt' }

  // Monatssicht: mitgenommene überfällige Aufgaben tragen ihre Überfälligkeit selbst
  if (au._carryForward && au._carryDays > 0) {
    return { level: 'overfaellig', score: 5000 + au._carryDays, days: au._carryDays,
      reason: `überfällig seit ${au._carryDays} Tag${au._carryDays !== 1 ? 'en' : ''}` }
  }

  const heute = new Date(); heute.setHours(0, 0, 0, 0)
  const exact = getExactDate(au)   // yyyy-mm-dd oder null
  let daysUntil = null, overdueDays = 0
  if (exact) {
    const d = new Date(exact + 'T00:00:00')
    const diff = Math.round((d - heute) / 86400000)
    if (diff < 0) overdueDays = -diff; else daysUntil = diff
  }

  // 1) Fälligkeitsdatum überfällig
  if (overdueDays > 0) {
    return { level: 'overfaellig', score: 5000 + overdueDays, days: overdueDays,
      reason: `überfällig seit ${overdueDays} Tag${overdueDays !== 1 ? 'en' : ''}` }
  }
  // 2) 🔥 Eilig mit abgelaufener Fertigstellungsfrist
  if (au.eilig && au.eiligBis) {
    const ebDiff = Math.round((new Date(au.eiligBis + 'T00:00:00') - heute) / 86400000)
    if (ebDiff < 0) return { level: 'overfaellig', score: 5000 + Math.abs(ebDiff), days: Math.abs(ebDiff),
      reason: `🔥 Fertigstellung ${Math.abs(ebDiff)} Tag${Math.abs(ebDiff) !== 1 ? 'e' : ''} überfällig` }
  }
  // 3) Nachfassen (JA wartet zu lange auf Rückmeldung/Unterschrift)
  if (WARTE_STATUS[au.jaWorkflowStatus] && au.jaWorkflowStatusDatum) {
    const w = daysSince(au.jaWorkflowStatusDatum)
    if (w >= NACHFASS_TAGE) return { level: 'nachfassen', score: 3500 + w, days: w,
      reason: `wartet ${w} Tage auf ${WARTE_STATUS[au.jaWorkflowStatus]}` }
  }
  // 4) Manuell als eilig markiert
  if (au.eilig) return { level: 'eilig', score: 3000,
    reason: au.eiligBis ? `🔥 eilig · bis ${fmtDE(new Date(au.eiligBis + 'T00:00:00'), { day:'2-digit', month:'2-digit' })}` : '🔥 eilig markiert' }
  // 5) Frist ≤ 7 Tage
  if (daysUntil !== null && daysUntil <= 7) return { level: 'frist_bald', score: 2500 + (7 - daysUntil), days: daysUntil,
    reason: daysUntil === 0 ? 'heute fällig' : `fällig in ${daysUntil} Tag${daysUntil !== 1 ? 'en' : ''}` }
  // 6) Priorität hoch
  if (au.prioritaet === 'hoch') return { level: 'prio_hoch', score: 2000, reason: 'Priorität hoch' }
  // 7) Frist ≤ 30 Tage
  if (daysUntil !== null && daysUntil <= 30) return { level: 'frist_monat', score: 1000 + (30 - daysUntil), days: daysUntil,
    reason: `fällig in ${daysUntil} Tagen` }
  // 8) Ohne besondere Dringlichkeit
  return { level: 'normal', score: 100, reason: '' }
}

// Sortiert Aufträge dringlichkeitsabsteigend (stabil per Frist als Tiebreak)
function sortByUrgency(list) {
  return [...list].sort((a, b) => {
    const d = computeUrgency(b).score - computeUrgency(a).score
    if (d !== 0) return d
    return (getExactDate(a) || a.frist || '9999').localeCompare(getExactDate(b) || b.frist || '9999')
  })
}

// Generierte Fristen zählen nur im aktuellen Zeitfenster fürs Radar/Eilig mit.
// Echte Aufträge sind bewusst angelegt → immer relevant.
function istRadarRelevant(au) {
  if (!au._generiert) return true
  if (!au.frist) return false
  const heute = new Date(); heute.setHours(0, 0, 0, 0)
  const diff = Math.round((new Date(au.frist + 'T00:00:00') - heute) / 86400000)
  return diff >= -GEN_WINDOW_BACK && diff <= GEN_WINDOW_FWD
}

// ── Gemeinsame Tabellenzeile ───────────────────────────────────────────────────
const thStyle = { padding:'8px 12px', textAlign:'left', fontWeight:600, color:'var(--text-muted)', fontSize:'11px', borderBottom:'2px solid var(--border)' }

// Was beim Ziehen mitgegeben wird – die Merkliste speichert nur diesen Verweis.
export const MERK_MIME = 'application/x-spielbuch-eintrag'
function merkNutzlast(au) {
  return JSON.stringify({ id: au.id, clientId: au.client?.id ?? null })
}

function AuftragRow({ au, idx, onSelectClient, onCycleStatus, onToggleDone, onNavigateToAuftrag, overdueDays, onVergessen }) {
  const typCfg    = AUFTRAGS_TYP_CFG[au.typ]      ?? AUFTRAGS_TYP_CFG.freitext
  const statusCfg = AUFTRAGS_STATUS_CFG[au.status] ?? AUFTRAGS_STATUS_CFG.offen
  const frist     = fmtFrist(au.frist)
  const erledigt  = au.status === 'erledigt'
  const bezeichnung = au.bezeichnung || null
  const istJA       = au.typ === 'jahresabschluss'
  const vzJahr      = istJA ? (au.abschlussJahr ?? au.jahr ?? null) : null   // Veranlagungsjahr
  const zeitraum    = au.monat ? `${MONAT_KURZ[au.monat-1]} ${au.jahr}` : au.jahr ? String(au.jahr) : '—'
  const dp          = getDisplayPeriod(au)
  const fristAbweicht = !au.istSerie && au.frist && au.monat && (dp.monat !== au.monat || dp.jahr !== au.jahr)
  const angelegtAm  = fmtErstellt(au)
  const alterTage   = tageSeitErstellt(au)

  return (
    <tr
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData(MERK_MIME, merkNutzlast(au)); e.dataTransfer.setData('text/plain', au.bezeichnung || '') }}
      title={'Auf den Reiter „Meine Liste" ziehen, um den Eintrag vorzumerken'}
      style={{
      background: erledigt ? 'transparent' : frist?.overfaellig ? 'rgba(239,68,68,0.03)' : idx % 2 === 0 ? 'var(--surface)' : 'transparent',
      borderBottom: '1px solid var(--border)', opacity: erledigt ? 0.55 : 1, transition: 'background 0.1s',
    }}>
      {onVergessen && (
        <td style={{ padding:'8px 4px 8px 10px', width:'28px' }}>
          <button onClick={() => onVergessen(au.id)} title={'Aus „Meine Liste" nehmen (der Eintrag selbst bleibt bestehen)'}
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'13px', padding:'2px 4px', lineHeight:1 }}>✕</button>
        </td>
      )}
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
        <button onClick={() => (au._generiert || au._manuell) ? onSelectClient(au.client.id) : onNavigateToAuftrag?.(au.client.id, au.id)}
          title={au._generiert ? '→ Mandant öffnen (auto-Frist)' : au._manuell ? '→ Mandant öffnen (manuelle Aufgabe)' : `→ ${typCfg.label} öffnen`}
          style={{ fontSize:'11px', fontWeight:700, padding:'2px 8px', borderRadius:'10px', background:typCfg.bg, color:typCfg.color, border:`1px solid ${typCfg.border}`, whiteSpace:'nowrap', cursor:'pointer', transition:'filter 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.92)'}
          onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
          {typCfg.icon} {au._manuell ? 'Aufgabe' : typCfg.label}
          {au._generiert && <span title="automatisch aus Stammdaten erzeugte Frist" style={{ fontWeight:700, opacity:0.75 }}> · auto</span>}
        </button>
      </td>
      <td style={{ padding:'8px 12px', maxWidth:'260px' }}>
        <div style={{ fontWeight: bezeichnung ? 500 : 400, color: bezeichnung ? 'var(--text)' : 'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'5px', textDecoration: erledigt ? 'line-through' : 'none' }}>
          {au.istSerie && (
            <span title={`Serienauftrag – ${au.serieLabel}`} style={{ fontSize:'10px', color:'rgba(99,102,241,0.85)', background:'rgba(99,102,241,0.08)', padding:'1px 5px', borderRadius:'6px', border:'1px solid rgba(99,102,241,0.2)', flexShrink:0, fontWeight:700 }}>
              🔁 {au.serieLabel}
            </span>
          )}
          {vzJahr && (
            <span title="Veranlagungsjahr" style={{ fontSize:'10px', fontWeight:700, color:'#2563eb', background:'rgba(37,99,235,0.1)', border:'1px solid rgba(37,99,235,0.25)', padding:'1px 6px', borderRadius:'6px', flexShrink:0 }}>
              VZ {vzJahr}
            </span>
          )}
          {!erledigt && au.eilig && (
            <span title={au.eiligBis ? `Fertigstellung bis ${au.eiligBis}` : 'Als eilig markiert'} style={{ fontSize:'10px', fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', padding:'1px 6px', borderRadius:'6px', flexShrink:0 }}>
              🔥 Eilig
            </span>
          )}
          {!erledigt && !au.eilig && au.prioritaet === 'hoch' && (
            <span title="Priorität hoch" style={{ fontSize:'10px', fontWeight:700, color:'#d97706', background:'rgba(217,119,6,0.1)', border:'1px solid rgba(217,119,6,0.3)', padding:'1px 6px', borderRadius:'6px', flexShrink:0 }}>
              ▲ Hoch
            </span>
          )}
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{bezeichnung ?? (istJA ? typCfg.label : `${typCfg.label} ${zeitraum}`)}</span>
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
        {/* Woher kommt der Eintrag – hilft bei Altlasten, die lange mitwandern. */}
        {angelegtAm && (
          <div style={{ fontSize:'10px', color:'var(--text-muted)', marginTop:'2px' }}>
            angelegt am {angelegtAm}
            {alterTage != null && alterTage >= 14 && ` · ${alterTage} T alt`}
          </div>
        )}
      </td>
      <td style={{ padding:'8px 12px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <input type="checkbox" checked={erledigt}
            onChange={e => onToggleDone(au, e.target.checked)}
            title={erledigt ? 'Als offen markieren' : 'Als erledigt markieren'}
            style={{ width:'16px', height:'16px', accentColor:'#16a34a', cursor:'pointer', flexShrink:0 }} />
          <button onClick={() => onCycleStatus(au)} title="Status wechseln"
            style={{ fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'20px', border:`1px solid ${statusCfg.border}`, background:statusCfg.bg, color:statusCfg.color, cursor:'pointer', whiteSpace:'nowrap' }}>
            {statusCfg.icon} {statusCfg.label}
            {erledigt && au.erledigtAm && (
              <span title={new Date(au.erledigtAm).toLocaleString('de-DE')} style={{ fontWeight:400, opacity:0.7, marginLeft:'5px', fontSize:'10px' }}>
                {new Date(au.erledigtAm).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'2-digit' })}
              </span>
            )}
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Monats-Tabelle ────────────────────────────────────────────────────────────
function MonthTable({ gefiltert, alleAuftraege, onSelectClient, onCycleStatus, onToggleDone, onNavigateToAuftrag }) {
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
            {sortByUrgency(gefiltert).map((au, idx) => (
              <AuftragRow key={au.id} au={au} idx={idx} onSelectClient={onSelectClient} onCycleStatus={onCycleStatus} onToggleDone={onToggleDone} onNavigateToAuftrag={onNavigateToAuftrag}
                overdueDays={au._carryForward ? au._carryDays : undefined} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Eilig-Ansicht ─────────────────────────────────────────────────────────────
// Zeigt alle als „eilig" markierten Aufträge, sortiert nach Fristdatum (eiligBis).
function EiligTable({ items, onSelectClient, onCycleStatus, onToggleDone, onNavigateToAuftrag }) {
  return (
    <div style={{ flex:1, overflowY:'auto', background:'var(--bg)' }}>
      {items.length === 0 ? (
        <div style={{ padding:'48px', textAlign:'center', color:'var(--text-muted)', fontSize:'14px' }}>
          Keine eiligen Aufträge. Markiere einen Jahresabschluss-Auftrag in den Stammdaten mit „🔥 Eilig".
        </div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
          <thead>
            <tr style={{ background:'var(--surface)', position:'sticky', top:0, zIndex:1 }}>
              <th style={thStyle}>Mandant</th>
              <th style={thStyle}>Typ</th>
              <th style={thStyle}>Bezeichnung</th>
              <th style={thStyle}>Zeitraum</th>
              <th style={thStyle}>Fertigstellung bis</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((au, idx) => (
              <AuftragRow key={au.id} au={au} idx={idx} onSelectClient={onSelectClient} onCycleStatus={onCycleStatus}
                onToggleDone={onToggleDone} onNavigateToAuftrag={onNavigateToAuftrag} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Suchtreffer-Ansicht ───────────────────────────────────────────────────────
// Ergebnis der Mandantensuche: alle Einträge des gesuchten Mandanten, ohne
// Zeitraumgrenze. Nutzt dieselbe Zeile wie die übrigen Tabellen – damit sind
// „Typ → Auftrag öffnen" und „Mandant → Mandant öffnen" automatisch identisch.
function SuchTable({ items, suche, onSelectClient, onCycleStatus, onToggleDone, onNavigateToAuftrag }) {
  return (
    <div style={{ flex:1, overflowY:'auto', background:'var(--bg)' }}>
      {items.length === 0 ? (
        <div style={{ padding:'48px', textAlign:'center', color:'var(--text-muted)', fontSize:'14px' }}>
          Kein Mandant mit „{suche}" gefunden – oder er hat keinen Eintrag, der zu den Filtern oben passt.
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
            {items.map((au, idx) => (
              <AuftragRow key={au.id} au={au} idx={idx} onSelectClient={onSelectClient} onCycleStatus={onCycleStatus}
                onToggleDone={onToggleDone} onNavigateToAuftrag={onNavigateToAuftrag} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Merkliste „Meine Liste" ───────────────────────────────────────────────────
// Zeigt ausschließlich die vorgemerkten Einträge – unabhängig von Monat und
// Filtern. Gemerkt wird nur ein Verweis; „✕" nimmt aus der Liste, nie aus den Daten.
function MerkTable({ items, verwaist, onSelectClient, onCycleStatus, onToggleDone, onNavigateToAuftrag, onVergessen }) {
  return (
    <div style={{ flex:1, overflowY:'auto', background:'var(--bg)' }}>
      {items.length === 0 ? (
        <div style={{ padding:'56px 24px', textAlign:'center', color:'var(--text-muted)', fontSize:'13.5px', lineHeight:1.8 }}>
          <div style={{ fontSize:'30px', marginBottom:'8px' }}>📌</div>
          <strong style={{ color:'var(--text)', display:'block', fontSize:'14px', marginBottom:'4px' }}>Deine Liste ist noch leer</strong>
          Zieh im Reiter „Aufträge" eine Zeile auf den Reiter <strong>📋 Meine Liste</strong> –<br />
          dann steht sie hier, unabhängig von Monat und Filtern.
        </div>
      ) : (
        <>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
            <thead>
              <tr style={{ background:'var(--surface)', position:'sticky', top:0, zIndex:1 }}>
                <th style={{ ...thStyle, width:'28px' }} />
                <th style={thStyle}>Mandant</th>
                <th style={thStyle}>Typ</th>
                <th style={thStyle}>Bezeichnung</th>
                <th style={thStyle}>Zeitraum</th>
                <th style={thStyle}>Frist</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((au, idx) => (
                <AuftragRow key={au.id} au={au} idx={idx} onSelectClient={onSelectClient} onCycleStatus={onCycleStatus}
                  onToggleDone={onToggleDone} onNavigateToAuftrag={onNavigateToAuftrag} onVergessen={onVergessen} />
              ))}
            </tbody>
          </table>
          {verwaist.length > 0 && (
            <div style={{ padding:'10px 16px', fontSize:'11.5px', color:'var(--text-muted)', borderTop:'1px solid var(--border)' }}>
              {verwaist.length} vorgemerkte{verwaist.length === 1 ? 'r' : ''} Eintrag{verwaist.length === 1 ? '' : 'e'} ist nicht mehr auffindbar
              (gelöscht oder Mandant archiviert).{' '}
              <button onClick={() => verwaist.forEach(m => onVergessen(m.id))}
                style={{ background:'none', border:'none', padding:0, color:'var(--accent)', fontSize:'11.5px', fontWeight:600, cursor:'pointer' }}>
                aus der Liste entfernen
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Mandanten-Ansicht ─────────────────────────────────────────────────────────
// Ein verdichteter Eintrag pro Mandant: Ampel = dringlichster Punkt, Klartext-Zeile
// und Zähler-Badges. Sortiert nach Dringlichkeit – „wo brennt was".
function Pill({ color, children }) {
  const muted = color === 'var(--text-muted)'
  return (
    <span style={{ fontSize:'11px', fontWeight:600, padding:'2px 8px', borderRadius:'20px', whiteSpace:'nowrap',
      color, background:'var(--surface)', border:`1px solid ${muted ? 'var(--border)' : color + '55'}` }}>
      {children}
    </span>
  )
}

function MandantenView({ rows, onSelectClient }) {
  if (rows.length === 0) {
    return <div style={{ padding:'48px', textAlign:'center', color:'var(--text-muted)', fontSize:'14px' }}>Keine aktiven Mandate für diesen Filter.</div>
  }
  return (
    <div style={{ flex:1, overflowY:'auto', background:'var(--bg)' }}>
      {rows.map(r => {
        const au     = r.top?.au
        const typCfg = au ? (AUFTRAGS_TYP_CFG[au.typ] ?? AUFTRAGS_TYP_CFG.freitext) : null
        const label  = au ? (au.bezeichnung || typCfg.label) : null
        const reason = r.top?.u.reason
        return (
          <div key={r.client.id} onClick={() => onSelectClient(r.client.id)}
            style={{ display:'flex', alignItems:'center', gap:'12px', padding:'11px 16px', borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background 0.1s',
              background: r.level === 'overfaellig' ? 'rgba(239,68,68,0.04)' : 'transparent' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
            onMouseLeave={e => e.currentTarget.style.background = r.level === 'overfaellig' ? 'rgba(239,68,68,0.04)' : 'transparent'}>
            <span title={r.level === 'overfaellig' ? 'überfällig' : r.level === 'leer' ? 'nichts offen' : 'Handlungsbedarf'}
              style={{ width:'10px', height:'10px', borderRadius:'50%', background:r.ampel, flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <span style={{ fontWeight:600, fontSize:'13px', color:'var(--accent)' }}>{r.client.name}</span>
                {(r.client.mandatstyp ?? 'extern') === 'intern' && (
                  <span style={{ fontSize:'9px', fontWeight:700, padding:'1px 5px', borderRadius:'8px', background:'rgba(124,58,237,0.1)', color:'#7c3aed', border:'1px solid rgba(124,58,237,0.25)' }}>INTERN</span>
                )}
                {r.client.mandantennummer && <span style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'monospace' }}>{r.client.mandantennummer}</span>}
              </div>
              <div style={{ fontSize:'12px', marginTop:'1px', color: r.level === 'leer' ? '#16a34a' : (URGENCY_COLOR[r.level] ?? 'var(--text-muted)'), overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {r.level === 'leer' ? 'Alles erledigt · nichts offen' : `${typCfg.icon} ${label}${reason ? ' · ' + reason : ''}`}
              </div>
            </div>
            <div style={{ display:'flex', gap:'5px', flexShrink:0, alignItems:'center' }}>
              {r.overfaellig > 0 && <Pill color="#ef4444">{r.overfaellig} überfällig</Pill>}
              {r.nachfassen  > 0 && <Pill color="#f59e0b">{r.nachfassen} nachfassen</Pill>}
              {r.bald        > 0 && <Pill color="#f97316">{r.bald} ≤ 7 Tage</Pill>}
              {r.offen       > 0 && <Pill color="var(--text-muted)">{r.offen} offen</Pill>}
            </div>
            <span style={{ color:'var(--text-muted)', fontSize:'16px', flexShrink:0 }}>›</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Wochen-Ansicht ────────────────────────────────────────────────────────────
// Die Tagesspalten sind Ablageflächen: Karten lassen sich mit der Maus auf einen
// anderen Tag ziehen (siehe verschiebeAufTag in der Hauptkomponente).
function WeekView({ weekDays, onSelectClient, onCycleStatus, onQuickCreate, onNavigateToAuftrag, istVerschiebbar, verschiebeGrund, onVerschieben }) {
  const heute = new Date(); heute.setHours(0,0,0,0)
  const [gezogen, setGezogen] = useState(null)   // Karte, die gerade am Mauszeiger hängt
  const [zielTag, setZielTag] = useState(null)   // Spalte, über der sie schwebt

  function ablegen(date) {
    if (gezogen) onVerschieben?.(gezogen, date)
    setGezogen(null); setZielTag(null)
  }

  return (
    <div style={{ flex:1, display:'flex', overflowX:'auto', overflowY:'hidden', background:'var(--bg)' }}>
      {weekDays.map(({ date, items }, i) => {
        const istHeute    = isSameDay(date, heute)
        const istWE       = date.getDay() === 0 || date.getDay() === 6
        const isVergangen = date < heute && !istHeute
        const istZiel     = zielTag === i && gezogen
        return (
          <div key={i}
            onDragOver={e => { if (gezogen) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setZielTag(i) } }}
            onDragLeave={() => setZielTag(z => z === i ? null : z)}
            onDrop={e => { e.preventDefault(); ablegen(date) }}
            style={{
            flex: istWE ? '0 0 110px' : '1 1 0', minWidth: istWE ? '110px' : '150px',
            borderRight: i < 6 ? '1px solid var(--border)' : 'none',
            display:'flex', flexDirection:'column', overflow:'hidden',
            outline: istZiel ? '2px dashed #3b82f6' : 'none', outlineOffset:'-2px',
            background: istZiel ? 'rgba(59,130,246,0.10)'
                      : istHeute ? 'rgba(59,130,246,0.03)' : istWE ? 'rgba(0,0,0,0.12)' : 'transparent',
            transition:'background 0.12s',
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
                <WeekCard key={au.id} au={au} onSelectClient={onSelectClient} onCycleStatus={onCycleStatus} onNavigateToAuftrag={onNavigateToAuftrag}
                  ziehbar={istVerschiebbar?.(au) ?? false}
                  grund={verschiebeGrund?.(au) ?? ''}
                  wirdGezogen={gezogen?.id === au.id}
                  onZiehStart={() => setGezogen(au)}
                  onZiehEnde={() => { setGezogen(null); setZielTag(null) }} />
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

function WeekCard({ au, onSelectClient, onCycleStatus, onNavigateToAuftrag, ziehbar = false, grund = '', wirdGezogen = false, onZiehStart, onZiehEnde }) {
  const typCfg    = AUFTRAGS_TYP_CFG[au.typ]      ?? AUFTRAGS_TYP_CFG.freitext
  const statusCfg = AUFTRAGS_STATUS_CFG[au.status] ?? AUFTRAGS_STATUS_CFG.offen
  const erledigt  = au.status === 'erledigt'
  const heute     = new Date(); heute.setHours(0,0,0,0)
  const exact     = getExactDate(au)
  const isOverdue = !erledigt && exact && new Date(exact + 'T00:00:00') < heute
  const overdueDays = isOverdue ? daysSince(exact) : 0
  return (
    <div
      draggable={ziehbar}
      onDragStart={e => { if (!ziehbar) { e.preventDefault(); return } e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', au.id); onZiehStart?.() }}
      onDragEnd={() => onZiehEnde?.()}
      title={[
        isOverdue ? `Seit ${overdueDays} Tag${overdueDays !== 1 ? 'en' : ''} offen` : null,
        fmtErstellt(au) ? `angelegt am ${fmtErstellt(au)}` : null,
        ziehbar ? 'Zum Verschieben auf einen anderen Tag ziehen' : grund,
      ].filter(Boolean).join(' · ')}
      style={{
      padding:'5px 7px', borderRadius:'6px', marginBottom:'3px',
      border:`1px solid ${isOverdue ? 'rgba(239,68,68,0.4)' : typCfg.border}`,
      borderLeft: isOverdue ? '3px solid #ef4444' : `1px solid ${typCfg.border}`,
      background: erledigt ? 'rgba(22,163,74,0.04)' : isOverdue ? 'rgba(239,68,68,0.05)' : typCfg.bg,
      opacity: wirdGezogen ? 0.4 : erledigt ? 0.6 : 1,
      cursor: ziehbar ? 'grab' : 'default',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'2px' }}>
        <button onClick={() => (au._generiert || au._manuell) ? onSelectClient(au.client.id) : onNavigateToAuftrag?.(au.client.id, au.id)} title={(au._generiert || au._manuell) ? '→ Mandant öffnen' : `→ ${typCfg.label} öffnen`}
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
function DayTable({ items, date, onSelectClient, onCycleStatus, onToggleDone, onQuickCreate, onNavigateToAuftrag }) {
  const heute = new Date(); heute.setHours(0,0,0,0)
  const istHeute    = isSameDay(date, heute)
  const carryItems  = sortByUrgency(items.filter(a => a._carryForward))
  const todayItems  = sortByUrgency(items.filter(a => !a._carryForward))

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
              onSelectClient={onSelectClient} onCycleStatus={onCycleStatus} onToggleDone={onToggleDone}
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

// ── Neuer-Auftrag-Modal (Auftrag ODER mandantenübergreifende Aufgabe) ───────────
function todayISOLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function NewAuftragModal({ clients, onClose, onCreate, onCreateAufgabe }) {
  const [modus,       setModus]       = useState('auftrag')   // 'auftrag' | 'aufgabe'
  const [query,       setQuery]       = useState('')
  const [clientId,    setClientId]    = useState('')
  const [typ,         setTyp]         = useState('fibu')
  const [bezeichnung, setBezeichnung] = useState('')
  const [frist,       setFrist]       = useState('')
  const [istSerie,    setIstSerie]    = useState(false)
  const [prioritaet,  setPrioritaet]  = useState('normal')
  const [beschreibung, setBeschreibung] = useState('')
  const [status,      setStatus]      = useState('offen')

  const istAufgabe = modus === 'aufgabe'
  const selected = clients.find(c => c.id === clientId)
  const matches = (query.trim().length >= 1 && !selected)
    ? clients.filter(c => (c.name || '').toLowerCase().includes(query.toLowerCase()) || String(c.mandantennummer || '').includes(query.trim())).slice(0, 8)
    : []

  // Auftrag braucht einen Mandanten; Aufgabe nur einen Titel (Mandant optional).
  const canSubmit = istAufgabe ? bezeichnung.trim().length > 0 : !!clientId

  function submit() {
    if (!canSubmit) return
    if (istAufgabe) {
      const datum = frist || todayISOLocal()
      const tag   = Math.min(28, Math.max(1, parseInt(datum.slice(8, 10), 10) || 1))
      if (istSerie) {
        onCreateAufgabe?.({
          typ: 'serie', titel: bezeichnung.trim(), beschreibung: beschreibung.trim(),
          mandantId: clientId || null, startDatum: datum, endDatum: '',
          faelligTag: tag, frequenz: 'monatlich', intervallTyp: 'monate', intervallWert: 1,
          erledigtInstanzen: {},
        })
      } else {
        onCreateAufgabe?.({
          typ: 'einmal', titel: bezeichnung.trim(), beschreibung: beschreibung.trim(),
          mandantId: clientId || null, faellig: datum, erledigt: false, erledigtAm: null,
        })
      }
    } else {
      onCreate({ clientId, typ, bezeichnung: bezeichnung.trim(), frist, istSerie, prioritaet, beschreibung: beschreibung.trim(), status })
    }
  }

  const modusBtn = (m, label) => ({
    flex: 1, padding: '7px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
    border: 'none', transition: 'background 0.15s',
    background: modus === m ? 'var(--accent)' : 'transparent',
    color: modus === m ? '#fff' : 'var(--text-muted)',
  })

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'12px', padding:'22px', width:'min(480px, 94vw)', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 60px rgba(0,0,0,0.4)', border:'1px solid var(--border)' }}>
        <div style={{ fontWeight:700, fontSize:'15px', marginBottom:'14px' }}>{istAufgabe ? '📌 Neue Aufgabe' : '➕ Neuer Auftrag'}</div>

        {/* Modus-Umschalter */}
        <div style={{ display:'flex', gap:'3px', background:'var(--surface2)', borderRadius:'9px', padding:'3px', border:'1px solid var(--border)', marginBottom:'16px' }}>
          <button onClick={() => setModus('auftrag')} style={modusBtn('auftrag', '📋 Auftrag')}>📋 Auftrag</button>
          <button onClick={() => setModus('aufgabe')} style={modusBtn('aufgabe', '📌 Aufgabe')}>📌 Aufgabe</button>
        </div>
        <div style={{ fontSize:'11px', color:'var(--text-muted)', marginBottom:'14px', marginTop:'-6px' }}>
          {istAufgabe
            ? 'Mandantenübergreifende Aufgabe – Mandant optional (ohne = Kanzlei-Todo).'
            : 'Auftrag für einen bestimmten Mandanten (Jahresabschluss, FIBU, Lohn …).'}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {/* Mandantensuche */}
          <div>
            <span style={modalLabelStyle}>{istAufgabe ? 'Mandant (optional)' : 'Mandant'}</span>
            {selected ? (
              <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', borderRadius:'7px', border:'1px solid var(--accent)', background:'var(--surface2)' }}>
                <span style={{ fontSize:'13px', fontWeight:600, flex:1 }}>{selected.name}{selected.mandantennummer ? ` (${selected.mandantennummer})` : ''}</span>
                <button onClick={() => { setClientId(''); setQuery('') }} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'12px' }}>ändern</button>
              </div>
            ) : (
              <>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder={istAufgabe ? 'leer lassen für Kanzlei-Todo…' : 'Name eintippen… z. B. Müller GmbH'} style={modalInputStyle} autoFocus={!istAufgabe} />
                {matches.length > 0 && (
                  <div style={{ marginTop:'4px', border:'1px solid var(--border)', borderRadius:'7px', overflow:'hidden', maxHeight:'190px', overflowY:'auto' }}>
                    {matches.map(c => (
                      <button key={c.id} onClick={() => { setClientId(c.id); setQuery('') }}
                        style={{ display:'block', width:'100%', textAlign:'left', padding:'7px 10px', border:'none', borderBottom:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:'13px', cursor:'pointer' }}>
                        {c.name}{c.mandantennummer ? <span style={{ color:'var(--text-muted)', fontSize:'11px' }}> · {c.mandantennummer}</span> : null}
                      </button>
                    ))}
                  </div>
                )}
                {!istAufgabe && query.trim() && matches.length === 0 && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>Kein Mandant gefunden.</div>}
              </>
            )}
          </div>

          {/* Auftragstyp + Status – nur im Auftrag-Modus */}
          {!istAufgabe && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <label><span style={modalLabelStyle}>Auftragstyp</span>
                <select value={typ} onChange={e => setTyp(e.target.value)} style={modalInputStyle}>
                  {Object.entries(AUFTRAGS_TYP_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </label>
              <label><span style={modalLabelStyle}>Status</span>
                <select value={status} onChange={e => setStatus(e.target.value)} style={modalInputStyle}>
                  {Object.entries(AUFTRAGS_STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
            </div>
          )}

          {/* Frist (+ Priorität nur im Auftrag-Modus) */}
          {istAufgabe ? (
            <label><span style={modalLabelStyle}>{istSerie ? 'Start / fällig am' : 'Fällig am'}</span>
              <input type="date" value={frist} onChange={e => setFrist(e.target.value)} style={modalInputStyle} />
            </label>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <label><span style={modalLabelStyle}>Interne Frist</span>
                <input type="date" value={frist} onChange={e => setFrist(e.target.value)} style={modalInputStyle} />
              </label>
              <label><span style={modalLabelStyle}>Priorität</span>
                <select value={prioritaet} onChange={e => setPrioritaet(e.target.value)} style={modalInputStyle}>
                  <option value="niedrig">Niedrig</option>
                  <option value="normal">Normal</option>
                  <option value="hoch">Hoch</option>
                </select>
              </label>
            </div>
          )}

          <label><span style={modalLabelStyle}>{istAufgabe ? 'Titel' : 'Bezeichnung'}</span>
            <input value={bezeichnung} onChange={e => setBezeichnung(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canSubmit && submit()}
              placeholder={istAufgabe ? 'z. B. Kanzlei-Meeting vorbereiten' : 'z. B. Buchhaltung Mai 2026'}
              style={modalInputStyle} autoFocus={istAufgabe} />
          </label>

          <label><span style={modalLabelStyle}>Beschreibung (optional)</span>
            <textarea value={beschreibung} onChange={e => setBeschreibung(e.target.value)} rows={2} placeholder="Notiz…" style={{ ...modalInputStyle, resize:'vertical' }} />
          </label>

          <label style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer' }}>
            <input type="checkbox" checked={istSerie} onChange={e => setIstSerie(e.target.checked)} style={{ width:'15px', height:'15px', accentColor:'var(--accent)', cursor:'pointer' }} />
            <span style={{ fontSize:'13px', color:'var(--text)' }}>{istAufgabe ? 'Wiederkehrend (monatlich)' : 'Serienauftrag (monatlich wiederkehrend)'}</span>
          </label>
          {istSerie && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'-4px' }}>
            {istAufgabe ? 'Erzeugt monatliche Instanzen ab dem gewählten Datum.' : 'Startet ab der internen Frist (bzw. aktuellem Monat). Details später im Mandanten-Reiter „Aufträge" anpassbar.'}
          </div>}
        </div>

        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'20px' }}>
          <button onClick={onClose} style={{ padding:'7px 14px', borderRadius:'7px', border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:'13px', cursor:'pointer' }}>Abbrechen</button>
          <button onClick={submit} disabled={!canSubmit}
            style={{ padding:'7px 18px', borderRadius:'7px', border:'none', background: canSubmit ? 'var(--accent)' : 'var(--border)', color: canSubmit ? '#fff' : 'var(--text-muted)', fontWeight:700, fontSize:'13px', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
            {istAufgabe ? '✓ Aufgabe anlegen' : '✓ Auftrag anlegen'}
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
export default function GlobalTodoView({ clients, aufgabenListe = [], onUpdateAufgabe, onAddAufgabe, onUpdateClient, onSelectClient, onNavigateToAuftrag, modus = 'alle', merkliste = [], onVergessen }) {
  // modus 'auftraege' → Auftragsübersicht (Quellen-Filter startet auf „Aufträge")
  // modus 'merkliste' → nur die vorgemerkten Einträge, ohne Zeitraumgrenze
  // modus 'alle'      → alles zusammen
  const nurAuftraege  = modus === 'auftraege'
  const istMerkliste  = modus === 'merkliste'
  const speicherKey   = filterKeyFuer(modus)
  const aktiveClients = useMemo(() => clients.filter(c => !c.archiviert), [clients])
  const saved = useMemo(() => loadTodoFilters(speicherKey), [speicherKey])

  // ── Ansicht & Navigation (letzte Ansicht wiederhergestellt) ───────────────
  const [viewMode,      setViewMode]      = useState(saved.viewMode ?? 'monat')
  const [navDate,       setNavDate]       = useState(() => saved.navDate ? new Date(saved.navDate) : new Date())
  const [quickCreateDay, setQuickCreateDay] = useState(null)
  const [showNew,        setShowNew]        = useState(false)
  // Mandantensuche – bewusst NICHT gespeichert: eine Suche soll nicht über
  // Sitzungen hinweg kleben und den Blick auf den Monat verstellen.
  const [suche,          setSuche]          = useState('')

  // ── Filter (letzte Auswahl wiederhergestellt) ─────────────────────────────
  const [filterJahr,       setFilterJahr]       = useState(saved.filterJahr ?? CUR_JAHR)
  const [filterMonat,      setFilterMonat]      = useState(saved.filterMonat !== undefined ? saved.filterMonat : CUR_MONAT)
  const [filterTyp,        setFilterTyp]        = useState(saved.filterTyp ?? 'alle')
  const [filterStatus,     setFilterStatus]     = useState(saved.filterStatus ?? 'aktiv')
  const [filterMandatstyp, setFilterMandatstyp] = useState(saved.filterMandatstyp ?? 'alle')
  const [filterQuelle,     setFilterQuelle]     = useState(nurAuftraege ? 'auftraege' : (saved.filterQuelle ?? 'alle'))

  // Letzte Ansicht automatisch merken (gerätelokal, nur Anzeige-Einstellungen)
  useEffect(() => {
    try {
      localStorage.setItem(speicherKey, JSON.stringify({
        viewMode,
        navDate: (navDate instanceof Date && !isNaN(navDate)) ? navDate.toISOString() : null,
        filterJahr, filterMonat, filterTyp, filterStatus, filterMandatstyp, filterQuelle,
      }))
    } catch {}
  }, [speicherKey, viewMode, navDate, filterJahr, filterMonat, filterTyp, filterStatus, filterMandatstyp, filterQuelle])

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
      // ── Automatisch generierte Fristen (USt/Lohn/SV/FIBU/Zusatz) ────────────
      for (const t of generateAufgaben(client)) {
        const mappedTyp = GEN_TYP_MAP[t.type]
        if (!mappedTyp) continue                       // JA & Unbekanntes auslassen
        const st = getAufgabeStatus(client, t.key)
        result.push({
          id:          `gen_${client.id}_${t.key}`,
          _generiert:  true,
          _genKey:     t.key,
          typ:         mappedTyp,
          bezeichnung: t.label,
          jahr:        t.jahr,
          monat:       t.monat,
          quartal:     t.quartal,
          frist:       isoToLocalYMD(t.faellig),
          status:      st.erledigt ? 'erledigt' : 'offen',
          erledigtAm:  st.erledigtAm ?? null,
          istSerie:    false,
          client,
        })
      }
    }
    // ── Globale manuelle Aufgaben (mandantenübergreifend, Serien für Jahresfenster) ─
    const clientById = new Map(aktiveClients.map(c => [c.id, c]))
    const manuellJahre = [CUR_JAHR - 1, CUR_JAHR, CUR_JAHR + 1]
    const gesehen = new Map()
    for (const y of manuellJahre) {
      for (const t of generateManuelleAufgaben(aufgabenListe, y)) {
        if (!gesehen.has(t.key)) gesehen.set(t.key, t)
      }
    }
    for (const t of gesehen.values()) {
      const client = (t.mandantId && clientById.get(t.mandantId)) || KANZLEI_CLIENT
      result.push({
        id:           `man_${t.key}`,
        _manuell:     true,
        _manuellId:   t.aufgabeId,
        _serieInstanz: t.serieInstanz ?? null,
        typ:          'freitext',
        bezeichnung:  t.label,
        notiz:        t.beschreibung || '',
        jahr:         t.jahr,
        monat:        t.monat,
        quartal:      t.quartal,
        frist:        isoToLocalYMD(t.faellig),
        status:       t.erledigt ? 'erledigt' : 'offen',
        erledigtAm:   t.erledigtAm ?? null,
        erstelltAm:   t.erstelltAm ?? null,
        istSerie:     false,
        client,
      })
    }
    return result
  }, [aktiveClients, aufgabenListe])

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
    if (filterQuelle === 'auftraege' && (au._generiert || au._manuell)) return false
    if (filterQuelle === 'fristen'   && !au._generiert) return false
    if (filterQuelle === 'manuell'   && !au._manuell)   return false
    return passesStatus(au)
  }, [filterTyp, filterMandatstyp, filterQuelle, passesStatus])

  // ── Mandantensuche ────────────────────────────────────────────────────────
  // Sucht über Mandantenname und Mandantennummer und zeigt ALLE Einträge dieses
  // Mandanten – bewusst OHNE Monats-/Jahresgrenze, sonst findet man den Auftrag
  // nur, wenn man zufällig im richtigen Monat steht. Typ-, Quellen- und
  // Statusfilter gelten weiter, damit die Knöpfe oben nicht wirkungslos wirken.
  const sucheAktiv = suche.trim().length >= 2
  const suchTreffer = useMemo(() => {
    if (!sucheAktiv) return null
    const q = suche.trim().toLowerCase()
    const passt = (c) => String(c.name ?? '').toLowerCase().includes(q)
                      || String(c.mandantennummer ?? '').toLowerCase().includes(q)
    return sortByUrgency(alleAuftraege.filter(au => passt(au.client) && passesCommon(au)))
  }, [sucheAktiv, suche, alleAuftraege, passesCommon])

  // Wie viele Mandanten stecken hinter den Treffern? (für die Ergebniszeile)
  const suchMandanten = useMemo(() => {
    if (!suchTreffer) return 0
    return new Set(suchTreffer.map(au => au.client.id)).size
  }, [suchTreffer])

  // ── Merkliste auflösen ────────────────────────────────────────────────────
  // Gemerkt ist nur ein Verweis. Was sich nicht mehr auflösen lässt (gelöscht,
  // Mandant archiviert), wird nicht still verschluckt, sondern unten benannt.
  const merkItems = useMemo(() => {
    if (!istMerkliste) return []
    const nachId = new Map(alleAuftraege.map(au => [au.id, au]))
    return sortByUrgency(merkliste.map(m => nachId.get(m.id)).filter(Boolean))
  }, [istMerkliste, merkliste, alleAuftraege])

  const merkVerwaist = useMemo(() => {
    if (!istMerkliste) return []
    const vorhanden = new Set(alleAuftraege.map(au => au.id))
    return merkliste.filter(m => !vorhanden.has(m.id))
  }, [istMerkliste, merkliste, alleAuftraege])

  // ── Monatssicht: gefilterte Aufträge (inkl. mitgenommene überfällige) ─────
  const gefiltert = useMemo(() => {
    if (viewMode !== 'monat') return []
    const curVal = CUR_JAHR * 12 + CUR_MONAT
    const selVal = filterMonat !== null ? filterJahr * 12 + filterMonat : null
    const result = []
    for (const au of alleAuftraege) {
      if (!passesCommon(au)) continue
      const dp = getDisplayPeriod(au)
      const inSelected = dp.jahr === filterJahr && (filterMonat === null || dp.monat === null || dp.monat === filterMonat)
      if (inSelected) { result.push(au); continue }
      // Carry-forward: nicht erledigte, heute überfällige Aufgaben bleiben im aktuellen/zukünftigen Monat sichtbar
      if (selVal !== null && selVal >= curVal && au.status !== 'erledigt' && !au._generiert && dp.monat != null && dp.jahr != null) {
        const itemVal = dp.jahr * 12 + dp.monat
        if (itemVal < curVal) {
          const ref = au.frist ? new Date(au.frist + 'T12:00:00') : new Date(dp.jahr, dp.monat, 0, 12)
          const carryDays = Math.max(0, Math.floor((Date.now() - ref.getTime()) / 86400000))
          result.push({ ...au, _carryForward: true, _carryDays: carryDays, _carryFromDate: au.frist ?? null })
        }
      }
    }
    return result
  }, [alleAuftraege, viewMode, filterJahr, filterMonat, passesCommon])

  // ── Wochensicht: 7 Tage mit Items ─────────────────────────────────────────
  const weekDays = useMemo(() => {
    if (viewMode !== 'woche') return null
    const ws = getWeekStart(navDate)
    const we = new Date(ws); we.setDate(ws.getDate() + 6); we.setHours(0,0,0,0)
    const heute = new Date(); heute.setHours(0,0,0,0)
    const weekCurrentOrFuture = we >= heute
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws); d.setDate(ws.getDate() + i)
      return { date: d, items: [] }
    })
    // Mitgenommene Überfällige landen am heutigen Tag (falls in dieser Woche), sonst am Wochenanfang
    let carryIdx = days.findIndex(d => isSameDay(d.date, heute))
    if (carryIdx < 0) carryIdx = 0
    for (const au of alleAuftraege) {
      if (!passesCommon(au)) continue
      const exact = getExactDate(au)
      if (!exact) continue
      const exactDate = new Date(exact + 'T00:00:00')
      const idx = days.findIndex(d => isSameDay(d.date, exactDate))
      if (idx >= 0) { days[idx].items.push(au); continue }
      // Carry-forward: nicht erledigte, heute überfällige Aufgaben in aktueller/zukünftiger Woche zeigen
      if (weekCurrentOrFuture && exactDate < heute && au.status !== 'erledigt' && !au._generiert) {
        days[carryIdx].items.push({ ...au, _carryForward: true, _carryDays: Math.floor((heute - exactDate) / 86400000), _carryFromDate: exact })
      }
    }
    for (const d of days) d.items = sortByUrgency(d.items)
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
      } else if (isCurrentOrFuture && exactDate < navDay && au.status !== 'erledigt' && !au._generiert) {
        result.push({ ...au,
          _carryForward: true,
          _carryDays:    Math.floor((navDay - exactDate) / 86400000),
          _carryFromDate: exact,
        })
      }
    }
    return result
  }, [alleAuftraege, viewMode, navDate, passesCommon])

  // ── Eilig-Ansicht: automatisch alles Dringliche – manuell „eilig", überfällig,
  //    Frist ≤ 7 Tage und Nachfass-Fälle – dringlichkeitssortiert ────────────────
  const eiligItems = useMemo(() => {
    if (viewMode !== 'eilig') return []
    const DRINGLICH = new Set(['overfaellig', 'nachfassen', 'eilig', 'frist_bald'])
    return alleAuftraege
      .filter(au => passesCommon(au) && istRadarRelevant(au))
      .map(au => ({ au, u: computeUrgency(au) }))
      .filter(({ au, u }) => au.eilig || DRINGLICH.has(u.level))
      .sort((a, b) => b.u.score - a.u.score)
      .map(({ au }) => ({ ...au, frist: au.eiligBis || au.frist }))   // Frist-Spalte zeigt „Fertigstellung bis"
  }, [alleAuftraege, viewMode, passesCommon])

  // ── Mandanten-Ansicht: ein verdichteter Eintrag pro Mandant, nach Dringlichkeit ─
  const mandantenItems = useMemo(() => {
    if (viewMode !== 'mandanten') return []
    // Nur Typ- & Mandatstyp-Filter greifen; Status ignorieren – wir zeigen offene Arbeit.
    const passOhneStatus = (au) => {
      if (filterTyp !== 'alle' && au.typ !== filterTyp) return false
      if (filterMandatstyp !== 'alle' && (au.client.mandatstyp ?? 'extern') !== filterMandatstyp) return false
      if (filterQuelle === 'auftraege' && (au._generiert || au._manuell)) return false
      if (filterQuelle === 'fristen'   && !au._generiert) return false
      if (filterQuelle === 'manuell'   && !au._manuell)   return false
      if (!istRadarRelevant(au)) return false
      return au.status !== 'erledigt'
    }
    const byClient = new Map()
    for (const au of alleAuftraege) {
      if (!passOhneStatus(au)) continue
      const cid = au.client.id
      if (!byClient.has(cid)) byClient.set(cid, { client: au.client, items: [] })
      byClient.get(cid).items.push({ au, u: computeUrgency(au) })
    }
    // Auch aktive Mandanten ganz ohne offene Aufträge aufnehmen (grün)
    for (const c of aktiveClients) {
      if (filterMandatstyp !== 'alle' && (c.mandatstyp ?? 'extern') !== filterMandatstyp) continue
      if (!byClient.has(c.id)) byClient.set(c.id, { client: c, items: [] })
    }
    const rows = [...byClient.values()].map(({ client, items }) => {
      const top = items.reduce((best, cur) => (cur.u.score > (best?.u.score ?? -1) ? cur : best), null)
      const level = top?.u.level ?? 'leer'
      const ampel = level === 'leer' ? '#16a34a'
        : level === 'overfaellig' ? '#ef4444'
        : (top.u.score >= 2000 ? '#f59e0b' : 'var(--text-muted)')   // gelb ab eilig/nachfassen/frist_bald/prio_hoch
      return {
        client,
        top,
        level,
        ampel,
        score: top?.u.score ?? -1,
        offen:       items.length,
        overfaellig: items.filter(i => i.u.level === 'overfaellig').length,
        nachfassen:  items.filter(i => i.u.level === 'nachfassen').length,
        bald:        items.filter(i => i.u.level === 'frist_bald').length,
        eilig:       items.filter(i => i.au.eilig).length,
      }
    })
    return rows.sort((a, b) => b.score - a.score || a.client.name.localeCompare(b.client.name))
  }, [alleAuftraege, aktiveClients, viewMode, filterTyp, filterMandatstyp, filterQuelle])

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
    } else if (viewMode === 'eilig') {
      basis = alleAuftraege.filter(au => {
        if (!au.eilig) return false
        if (filterTyp !== 'alle' && au.typ !== filterTyp) return false
        if (filterMandatstyp !== 'alle' && (au.client.mandatstyp ?? 'extern') !== filterMandatstyp) return false
        return true
      })
    } else {
      basis = []
    }
    // Quellen-Filter auch in den Kennzahlen berücksichtigen
    if (filterQuelle === 'auftraege') basis = basis.filter(au => !au._generiert && !au._manuell)
    else if (filterQuelle === 'fristen') basis = basis.filter(au => au._generiert)
    else if (filterQuelle === 'manuell') basis = basis.filter(au => au._manuell)
    const heute = new Date()
    const ueberfaellig = basis.filter(au => {
      if (au.status === 'erledigt') return false
      const d = (viewMode === 'eilig' ? au.eiligBis : null) ?? getExactDate(au) ?? au.frist
      if (!d) return false
      return new Date(d + 'T12:00:00') < heute
    }).length
    return {
      offen:       basis.filter(a => a.status === 'offen').length,
      in_bearb:    basis.filter(a => a.status === 'in_bearbeitung').length,
      erledigt:    basis.filter(a => a.status === 'erledigt').length,
      ueberfaellig,
    }
  }, [alleAuftraege, viewMode, navDate, filterJahr, filterMonat, filterTyp, filterMandatstyp, filterQuelle, weekDays])

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

  function resetFilters() {
    const t = new Date()
    setViewMode('monat'); setNavDate(t)
    setFilterJahr(t.getFullYear()); setFilterMonat(t.getMonth() + 1)
    setFilterTyp('alle'); setFilterStatus('aktiv'); setFilterMandatstyp('alle')
    setFilterQuelle(nurAuftraege ? 'auftraege' : 'alle')
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
    // filterMonat === null heißt „Alle" – sonst stünde hier „undefined 2026"
    if (viewMode === 'monat') return filterMonat === null ? `Ganzes Jahr ${filterJahr}` : `${MONAT_KURZ[filterMonat-1]} ${filterJahr}`
    if (viewMode === 'woche') {
      const ws = getWeekStart(navDate)
      const we = new Date(ws); we.setDate(ws.getDate() + 6)
      return `KW ${getKW(ws)} · ${fmtDE(ws, {day:'2-digit',month:'2-digit'})} – ${fmtDE(we, {day:'2-digit',month:'2-digit',year:'numeric'})}`
    }
    return fmtDE(navDate, { weekday:'long', day:'2-digit', month:'2-digit', year:'numeric' })
  }, [viewMode, filterMonat, filterJahr, navDate])

  // ── Status umschalten ─────────────────────────────────────────────────────
  // Globale manuelle Aufgabe als erledigt/offen setzen (Einmal & Serieninstanz).
  function toggleManuell(au, done) {
    if (!onUpdateAufgabe || !au._manuellId) return
    const src = aufgabenListe.find(a => a.id === au._manuellId)
    if (!src) return
    const stamp = done ? new Date().toISOString() : null
    if (au._serieInstanz) {
      onUpdateAufgabe(au._manuellId, { erledigtInstanzen: { ...(src.erledigtInstanzen ?? {}), [au._serieInstanz]: { erledigt: done, erledigtAm: stamp } } })
    } else {
      onUpdateAufgabe(au._manuellId, { erledigt: done, erledigtAm: stamp })
    }
  }

  // ── Per Maus auf einen anderen Tag ziehen ─────────────────────────────────
  // Verschiebbar ist nur, was ein eigenes Datum trägt:
  //  · echte Einzelaufträge      → Feld `frist`
  //  · einmalige manuelle Aufgaben → Feld `faellig`
  // NICHT verschiebbar: automatisch erzeugte Fristen (die stehen im Gesetz
  // bzw. in den Stammdaten) und Serieninstanzen (ihr Termin folgt der Serie).
  function istVerschiebbar(au) {
    if (au._generiert) return false
    if (au.istSerie) return false
    if (au._manuell && au._serieInstanz) return false
    return true
  }

  function verschiebeGrund(au) {
    if (au._generiert) return 'Automatische Frist – ergibt sich aus den Stammdaten und lässt sich nicht verschieben'
    if (au.istSerie || au._serieInstanz) return 'Serientermin – bitte in der Serie selbst ändern'
    return ''
  }

  // Ändert bewusst NUR das Datum. Zeitraum (jahr/monat) bleibt unangetastet:
  // bei Jahresabschlüssen hängt daran das Veranlagungsjahr.
  function verschiebeAufTag(au, datum) {
    if (!au || !istVerschiebbar(au)) return
    const ymd = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}-${String(datum.getDate()).padStart(2, '0')}`
    if (getExactDate(au) === ymd) return          // schon dort – nichts tun
    if (au._manuell) {
      onUpdateAufgabe?.(au._manuellId, { faellig: `${ymd}T12:00:00` })
      return
    }
    const upd = (au.client.auftraege ?? []).map(a => a.id === au.id ? { ...a, frist: ymd } : a)
    onUpdateClient(au.client.id, { auftraege: upd })
  }

  function cycleStatus(au) {
    // Generierte Fristen kennen nur erledigt/offen → einfaches Umschalten.
    if (au._generiert) {
      onUpdateClient(au.client.id, buildTogglePatch(au.client, au._genKey))
      return
    }
    // Globale manuelle Aufgaben: nur erledigt/offen umschalten.
    if (au._manuell) { toggleManuell(au, au.status !== 'erledigt'); return }
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

  // ── Direkt erledigt/offen schalten ────────────────────────────────────────
  function markDone(au, done) {
    // Generierte Fristen: nur umschalten, wenn sich der Zustand ändert.
    if (au._generiert) {
      if (getAufgabeStatus(au.client, au._genKey).erledigt !== done) {
        onUpdateClient(au.client.id, buildTogglePatch(au.client, au._genKey))
      }
      return
    }
    // Globale manuelle Aufgaben.
    if (au._manuell) { toggleManuell(au, done); return }
    const status = done ? 'erledigt' : 'offen'
    const stamp  = done ? new Date().toISOString() : null
    if (au.istSerie && au.serieId && au.serieKey) {
      const upd = (au.client.auftraege ?? []).map(a =>
        a.id !== au.serieId ? a : { ...a, instanzen: { ...(a.instanzen ?? {}), [au.serieKey]: { status, erledigtAm: stamp } } })
      onUpdateClient(au.client.id, { auftraege: upd })
    } else {
      const upd = (au.client.auftraege ?? []).map(a =>
        a.id === au.id ? { ...a, status, erledigtAm: stamp } : a)
      onUpdateClient(au.client.id, { auftraege: upd })
    }
  }

  // ── Auftrag aus der Übersicht anlegen ─────────────────────────────────────
  function createAuftrag({ clientId, typ, bezeichnung, frist, istSerie, prioritaet, beschreibung, status }) {
    const client = aktiveClients.find(c => c.id === clientId)
    if (!client) return
    const now = new Date().toISOString()
    let newAu
    if (istSerie) {
      const start = frist || `${CUR_JAHR}-${String(CUR_MONAT).padStart(2, '0')}-01`
      newAu = {
        id: 'au_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        typ, bezeichnung,
        istSerie: true,
        serie: { startDatum: start, intervallTyp: 'monate', intervallWert: 1, endTyp: 'kein', endDatum: '', endAnzahl: 12 },
        instanzen: {},
        notiz: beschreibung || '',
        prioritaet: prioritaet || 'normal',
        erstelltAm: now,
      }
    } else {
      const d = frist ? new Date(frist + 'T12:00:00') : null
      newAu = {
        id: 'au_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        typ, bezeichnung,
        jahr:  d ? d.getFullYear() : CUR_JAHR,
        monat: d ? d.getMonth() + 1 : null,
        frist: frist || '',
        status: status || 'offen',
        notiz: beschreibung || '',
        hinweise: [], verlauf: [],
        prioritaet: prioritaet || 'normal',
        erstelltAm: now,
        erledigtAm: status === 'erledigt' ? now : null,
        ...(typ === 'jahresabschluss' ? {
          abschlussJahr: CUR_JAHR - 1,
          jaWorkflowStatus: 'neu',
          jaWorkflowStatusDatum: now.slice(0, 10),
          honorar: { typ: 'pauschale', betrag: '', notiz: '' },
        } : {}),
      }
    }
    onUpdateClient(clientId, { auftraege: [...(client.auftraege ?? []), newAu] })
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
    if (istMerkliste) return `${merkItems.length} vorgemerkt`
    if (viewMode === 'monat') return `${gefiltert.length} Einträge angezeigt`
    if (viewMode === 'woche') return `${weekDays?.flatMap(d => d.items).length ?? 0} Einträge diese Woche`
    if (viewMode === 'tag') {
      const carry = dayItems?.filter(a => a._carryForward).length ?? 0
      const total = dayItems?.length ?? 0
      if (carry > 0) return `${total} Einträge · davon ${carry} mitgenommen`
      return `${total} Einträge`
    }
    if (viewMode === 'eilig') return `${eiligItems.length} dringliche Aufträge`
    if (viewMode === 'mandanten') {
      const bedarf = mandantenItems.filter(r => r.offen > 0).length
      return `${mandantenItems.length} Mandate · ${bedarf} mit Handlungsbedarf`
    }
    return ''
  }, [viewMode, gefiltert.length, weekDays, dayItems, eiligItems.length, mandantenItems])

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
          <span style={{ fontSize:'20px' }}>{istMerkliste ? '📌' : nurAuftraege ? '📑' : '📋'}</span>
          <div>
            <div style={{ fontWeight:800, fontSize:'15px' }}>
              {istMerkliste ? 'Meine Liste' : nurAuftraege ? 'Auftrags-Übersicht' : 'Aufgaben & Fristen'}
            </div>
            <div style={{ fontSize:'10px', opacity:0.55 }}>
              {istMerkliste
                ? `${merkItems.length} vorgemerkt · unabhängig von Monat und Filtern`
                : nurAuftraege ? 'Alle Mandate · nur echte Aufträge' : 'Alle Mandate · Aufträge, Fristen und Aufgaben'}
            </div>
          </div>

          {/* Ansicht-Umschalter – in der Merkliste ohne Bedeutung (kein Zeitraum) */}
          <div style={{ display: istMerkliste ? 'none' : 'flex', background:'rgba(255,255,255,0.07)', borderRadius:'8px', padding:'2px', border:'1px solid rgba(255,255,255,0.12)', marginLeft:'4px' }}>
            {[['mandanten','🏢 Mandanten'],['monat','📅 Monat'],['woche','📆 Woche'],['tag','🗓 Tag'],['eilig','🔥 Eilig']].map(([m,l]) => (
              <button key={m} onClick={() => switchView(m)} style={{
                padding:'4px 11px', borderRadius:'6px', fontSize:'11px', fontWeight:600, cursor:'pointer', border:'none',
                background: viewMode === m ? (m === 'eilig' ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.2)') : 'transparent',
                color: viewMode === m ? '#fff' : (m === 'eilig' ? 'rgba(248,113,113,0.85)' : 'rgba(255,255,255,0.45)'),
                transition:'background 0.15s',
              }}>{l}</button>
            ))}
          </div>

          {/* Mandantensuche – findet Aufträge unabhängig vom eingestellten Monat */}
          <div style={{ position:'relative', display:'flex', alignItems:'center', marginLeft:'4px' }}>
            <span style={{ position:'absolute', left:'9px', fontSize:'12px', opacity:0.6, pointerEvents:'none' }} aria-hidden="true">🔎</span>
            <input
              value={suche}
              onChange={e => setSuche(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setSuche('') }}
              placeholder="Mandant suchen …"
              aria-label="Mandant suchen"
              style={{
                padding:'6px 26px 6px 27px', width:'190px', borderRadius:'8px', fontSize:'12px',
                border:`1px solid ${sucheAktiv ? '#22d3ee' : 'rgba(255,255,255,0.2)'}`,
                background:'rgba(255,255,255,0.08)', color:'#fff',
              }}
            />
            {suche && (
              <button onClick={() => setSuche('')} title="Suche zurücksetzen"
                style={{ position:'absolute', right:'6px', background:'none', border:'none', color:'rgba(255,255,255,0.55)', cursor:'pointer', fontSize:'13px', lineHeight:1, padding:'2px' }}>×</button>
            )}
          </div>

          {/* Neuer Auftrag */}
          <button onClick={() => setShowNew(true)}
            style={{ padding:'7px 14px', borderRadius:'8px', border:'none', background:'#0891b2', color:'#fff', fontWeight:700, fontSize:'12px', cursor:'pointer', whiteSpace:'nowrap', marginLeft:'4px' }}>
            ➕ Neuer Auftrag
          </button>

          {/* Stat-Badges */}
          {viewMode === 'mandanten' ? (
            <div style={{ marginLeft:'auto', display:'flex', gap:'7px', alignItems:'center', flexWrap:'wrap' }}>
              <StatBadge label="Mit Bedarf" count={mandantenItems.filter(r => r.offen > 0).length} color="#60a5fa" bg="rgba(96,165,250,0.12)" />
              <StatBadge label="Überfällig" count={mandantenItems.reduce((s, r) => s + r.overfaellig, 0)} color="#f87171" bg="rgba(248,113,113,0.12)" />
              <StatBadge label="Nachfassen" count={mandantenItems.reduce((s, r) => s + r.nachfassen, 0)} color="#fbbf24" bg="rgba(251,191,36,0.12)" />
              <StatBadge label="Sauber"     count={mandantenItems.filter(r => r.offen === 0).length} color="#4ade80" bg="rgba(74,222,128,0.12)" />
            </div>
          ) : viewMode === 'eilig' ? (
            <div style={{ marginLeft:'auto', display:'flex', gap:'7px', alignItems:'center', flexWrap:'wrap' }}>
              <StatBadge label="Dringlich" count={eiligItems.length} color="#f87171" bg="rgba(248,113,113,0.12)" />
              <StatBadge label="Offen"     count={eiligItems.filter(a => a.status === 'offen').length} color="#60a5fa" bg="rgba(96,165,250,0.12)" />
              <StatBadge label="Bearb."    count={eiligItems.filter(a => a.status === 'in_bearbeitung').length} color="#a78bfa" bg="rgba(167,139,250,0.12)" />
            </div>
          ) : (
            <div style={{ marginLeft:'auto', display:'flex', gap:'7px', alignItems:'center', flexWrap:'wrap' }}>
              <StatBadge label="Offen"    count={stats.offen}    color="#60a5fa" bg="rgba(96,165,250,0.12)" />
              <StatBadge label="Bearb."   count={stats.in_bearb} color="#a78bfa" bg="rgba(167,139,250,0.12)" />
              <StatBadge label="Erledigt" count={stats.erledigt} color="#4ade80" bg="rgba(74,222,128,0.12)" />
              {stats.ueberfaellig > 0 && (
                <StatBadge label="Überfällig" count={stats.ueberfaellig} color="#f87171" bg="rgba(248,113,113,0.12)" />
              )}
            </div>
          )}
        </div>

        {/* Zeile 2: Navigation + Filter – in der Merkliste komplett aus,
            dort gilt bewusst nur die eigene Auswahl. */}
        <div style={{ display: istMerkliste ? 'none' : 'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>

          {/* Zeitraum-Navigation (im Eilig-/Mandanten-Modus ausgeblendet) */}
          {viewMode !== 'eilig' && viewMode !== 'mandanten' && (
            <>
              <button onClick={goPrev} title="Zurück"
                style={{ ...inputStyle, padding:'4px 11px', fontWeight:800, fontSize:'14px', lineHeight:1 }}>‹</button>
              <button onClick={goToday}
                style={{ ...inputStyle, padding:'4px 10px', fontSize:'11px', fontWeight:600 }}>Heute</button>
              <button onClick={goNext} title="Vor"
                style={{ ...inputStyle, padding:'4px 11px', fontWeight:800, fontSize:'14px', lineHeight:1 }}>›</button>
              <span style={{ fontSize:'12px', fontWeight:700, color:'rgba(255,255,255,0.9)', whiteSpace:'nowrap', minWidth:'175px' }}>{navLabel}</span>
            </>
          )}
          {viewMode === 'eilig' && (
            <span style={{ fontSize:'12px', fontWeight:700, color:'rgba(248,113,113,0.95)', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'6px' }}>
              🔥 Dringliches · überfällig, Frist ≤ 7 Tage, nachfassen &amp; eilig
            </span>
          )}
          {viewMode === 'mandanten' && (
            <span style={{ fontSize:'12px', fontWeight:700, color:'rgba(255,255,255,0.9)', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'6px' }}>
              🏢 Ein Eintrag pro Mandant · nach Dringlichkeit sortiert
            </span>
          )}

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
          {(viewMode === 'woche' || viewMode === 'tag') && (
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

          {divider}

          {/* Quellen-Filter: eigene Aufträge · auto-Fristen · manuelle Aufgaben.
              Startet in dieser Ansicht auf „Aufträge", bleibt aber umschaltbar –
              sonst wären Fristen und Aufgaben nirgends mehr erreichbar. */}
          {[['alle','🗂 Alle Quellen'],['auftraege','📋 Aufträge'],['fristen','📅 Fristen (auto)'],['manuell','📌 Aufgaben']].map(([k,l]) => (
            <button key={k} onClick={() => setFilterQuelle(k)} style={btnFilter(filterQuelle === k, '#22d3ee')}>{l}</button>
          ))}

          {divider}
          <button onClick={resetFilters} title="Alle Filter auf Standard zurücksetzen (aktueller Monat, alle Typen, aktiv, alle Quellen)"
            style={{ ...inputStyle, fontSize:'11px', fontWeight:600 }}>↺ Zurücksetzen</button>
        </div>
      </div>

      {/* ── Ergebniszeile der Mandantensuche ── */}
      {sucheAktiv && (
        <div style={{
          display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap', flexShrink:0,
          padding:'8px 16px', background:'rgba(34,211,238,0.08)', borderBottom:'1px solid var(--border)',
          fontSize:'12px', color:'var(--text)',
        }}>
          <strong>🔎 Suchtreffer für „{suche.trim()}"</strong>
          <span style={{ color:'var(--text-muted)' }}>
            {suchTreffer.length} Eintr{suchTreffer.length === 1 ? 'ag' : 'äge'}
            {suchMandanten > 0 && ` bei ${suchMandanten} Mandant${suchMandanten === 1 ? 'en' : 'en'}`}
            {' '}· alle Zeiträume (Monatsfilter ausgesetzt)
          </span>
          <button onClick={() => setSuche('')}
            style={{ marginLeft:'auto', padding:'3px 10px', borderRadius:'20px', border:'1px solid var(--border2)', background:'var(--surface)', color:'var(--text)', fontSize:'11.5px', fontWeight:600, cursor:'pointer' }}>
            ✕ Suche beenden
          </button>
        </div>
      )}

      {/* ── Inhalt ── */}
      {istMerkliste ? (
        <MerkTable items={merkItems} verwaist={merkVerwaist} onSelectClient={onSelectClient}
          onCycleStatus={cycleStatus} onToggleDone={markDone} onNavigateToAuftrag={onNavigateToAuftrag}
          onVergessen={onVergessen} />
      ) : sucheAktiv ? (
        <SuchTable items={suchTreffer} suche={suche.trim()} onSelectClient={onSelectClient}
          onCycleStatus={cycleStatus} onToggleDone={markDone} onNavigateToAuftrag={onNavigateToAuftrag} />
      ) : (
        <>
          {viewMode === 'mandanten' && (
            <MandantenView rows={mandantenItems} onSelectClient={onSelectClient} />
          )}
          {viewMode === 'monat' && (
            <MonthTable gefiltert={gefiltert} alleAuftraege={alleAuftraege} onSelectClient={onSelectClient} onCycleStatus={cycleStatus} onToggleDone={markDone} onNavigateToAuftrag={onNavigateToAuftrag} />
          )}
          {viewMode === 'woche' && weekDays && (
            <WeekView weekDays={weekDays} onSelectClient={onSelectClient} onCycleStatus={cycleStatus} onQuickCreate={setQuickCreateDay} onNavigateToAuftrag={onNavigateToAuftrag}
              istVerschiebbar={istVerschiebbar} verschiebeGrund={verschiebeGrund} onVerschieben={verschiebeAufTag} />
          )}
          {viewMode === 'tag' && dayItems && (
            <DayTable items={dayItems} date={navDate} onSelectClient={onSelectClient} onCycleStatus={cycleStatus} onToggleDone={markDone} onQuickCreate={setQuickCreateDay} onNavigateToAuftrag={onNavigateToAuftrag} />
          )}
          {viewMode === 'eilig' && (
            <EiligTable items={eiligItems} onSelectClient={onSelectClient} onCycleStatus={cycleStatus} onToggleDone={markDone} onNavigateToAuftrag={onNavigateToAuftrag} />
          )}
        </>
      )}

      {/* ── Footer ── */}
      <div style={{ padding:'6px 16px', background:'var(--surface)', borderTop:'1px solid var(--border)', fontSize:'11px', color:'var(--text-muted)', display:'flex', gap:'16px', alignItems:'center', flexShrink:0 }}>
        <span>{footerInfo}</span>
        <span>{aktiveClients.length} Mandate aktiv</span>
        <span>{alleAuftraege.filter(a => !a.istSerie && !a._generiert && !a._manuell).length} Aufträge · {alleAuftraege.filter(a => a.istSerie).length} Serien · {alleAuftraege.filter(a => a._generiert).length} auto-Fristen · {alleAuftraege.filter(a => a._manuell).length} Aufgaben</span>
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

      {/* ── Neuer-Auftrag-Modal ── */}
      {showNew && (
        <NewAuftragModal
          clients={aktiveClients}
          onClose={() => setShowNew(false)}
          onCreate={(data) => { createAuftrag(data); setShowNew(false) }}
          onCreateAufgabe={(data) => { onAddAufgabe?.(data); setShowNew(false) }}
        />
      )}
    </div>
  )
}
