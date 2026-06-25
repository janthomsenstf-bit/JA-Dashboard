/**
 * LohnJahresmappe.jsx – Eigenständige Jahres-Arbeitsmappe für einen Lohn-EINZELAUFTRAG
 * (z. B. „Lohn 2026"). Rein additiv, vollständig am Auftrag gespeichert:
 *   au.jahr            – Jahr der Mappe
 *   au.startMonat      – ab welchem Monat (1–12, Default 1)
 *   au.monate          – { [m]: { erledigt, erledigtAm } }   (Monat abgerechnet)
 *   au.monatsHinweise  – { [m]: [ { id, text, erledigt, erledigtAm } ] }
 *   au.mitarbeiterAnweisungen – Dauer-Anweisungen (werden je Monat eingeblendet)
 *
 * Unabhängig vom Mandanten-Aufgaben-Motor → zeigt immer die Monate des Auftrags.
 * Props: { au, onUpdate }
 *
 * Für Lohn-SERIENaufträge wird stattdessen die vorhandene „Termine"-Liste genutzt;
 * die hier exportierte MonatHinweise-Komponente wird dort wiederverwendet.
 */
import { useState } from 'react'
import { MerkzettelDiktat } from './LohnMerkzettel.jsx'
import { zeitraumText } from './LohnStammdaten.jsx'

const ACCENT = '#7c3aed'
const MONAT_NAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

function newId() { return 'mh' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36) }

export function fmtDatumZeit(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const dat = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
  const zeit = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return `${dat}, ${zeit} Uhr`
}

// ── Hinweise/Unteraufgaben eines Monats (auch im Serienauftrag wiederverwendet) ─
export function MonatHinweise({ hinweise, onChange }) {
  const [text, setText] = useState('')

  function add(t) {
    const v = (t ?? text).trim()
    if (!v) return
    onChange([...hinweise, { id: newId(), text: v, erledigt: false, erledigtAm: null, eingegangenAm: new Date().toISOString() }])
    setText('')
  }
  function toggle(id) {
    onChange(hinweise.map(h => h.id !== id ? h : { ...h, erledigt: !h.erledigt, erledigtAm: !h.erledigt ? new Date().toISOString() : null }))
  }
  function del(id) {
    if (!window.confirm('Diesen Hinweis löschen?')) return
    onChange(hinweise.filter(h => h.id !== id))
  }
  function addFromDiktat(list) {
    const neu = list.map(e => ({
      id: newId(),
      text: (e.mitarbeiter ? e.mitarbeiter + ': ' : '') + e.hinweis,
      erledigt: false, erledigtAm: null, eingegangenAm: new Date().toISOString(),
    }))
    onChange([...hinweise, ...neu])
  }

  const offen    = hinweise.filter(h => !h.erledigt)
  const erledigt = hinweise.filter(h => h.erledigt)
  const inputS = { flex: 1, padding: '6px 9px', border: '1px solid var(--border)', borderRadius: '6px', background: '#fff', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box' }

  function Zeile({ h }) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 10px', borderRadius: '6px', background: h.erledigt ? 'rgba(22,163,74,0.05)' : 'var(--surface2)', border: `1px solid ${h.erledigt ? 'rgba(22,163,74,0.2)' : 'var(--border)'}` }}>
        <input type="checkbox" checked={h.erledigt} onChange={() => toggle(h.id)} style={{ accentColor: '#16a34a', cursor: 'pointer', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12.5px', color: h.erledigt ? 'var(--text-muted)' : 'var(--text)', textDecoration: h.erledigt ? 'line-through' : 'none', lineHeight: 1.45, wordBreak: 'break-word' }}>{h.text}</div>
          {h.erledigt && h.erledigtAm && (
            <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600, marginTop: '2px' }}>✓ erledigt am {fmtDatumZeit(h.erledigtAm)}</div>
          )}
        </div>
        <button onClick={() => del(h.id)} title="Löschen"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '0 2px', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>🗑</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', gap: '6px' }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Hinweis / Besonderheit… (Enter)" style={inputS} />
        <button onClick={() => add()} disabled={!text.trim()}
          style={{ padding: '0 13px', borderRadius: '6px', border: 'none', background: text.trim() ? ACCENT : 'var(--border)', color: '#fff', fontSize: '16px', fontWeight: 700, cursor: text.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}>+</button>
      </div>
      <MerkzettelDiktat onEntries={addFromDiktat} />
      {offen.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{offen.map(h => <Zeile key={h.id} h={h} />)}</div>}
      {erledigt.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>Erledigt ({erledigt.length})</div>
          {erledigt.map(h => <Zeile key={h.id} h={h} />)}
        </div>
      )}
      {hinweise.length === 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px' }}>Noch keine Hinweise für diesen Monat.</div>}
    </div>
  )
}

export default function LohnJahresmappe({ au, onUpdate }) {
  const jahr           = au.jahr || new Date().getFullYear()
  const startMonat     = au.startMonat || 1
  const monate         = au.monate ?? {}
  const monatsHinweise = au.monatsHinweise ?? {}
  const anweisungen    = au.mitarbeiterAnweisungen ?? []
  const [showSettings, setShowSettings] = useState(false)
  const [openMonat, setOpenMonat] = useState(() => {
    const h = new Date()
    return (h.getFullYear() === jahr) ? h.getMonth() + 1 : null
  })

  function toggleMonat(m) {
    const cur = monate[m] ?? { erledigt: false }
    onUpdate({ monate: { ...monate, [m]: cur.erledigt ? { erledigt: false, erledigtAm: null } : { erledigt: true, erledigtAm: new Date().toISOString() } } })
  }
  function setMonatHinweise(m, list) { onUpdate({ monatsHinweise: { ...monatsHinweise, [m]: list } }) }

  const months = []
  for (let m = startMonat; m <= 12; m++) months.push(m)
  const erledigtCount = months.filter(m => monate[m]?.erledigt).length

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Kopf */}
      <div style={{ background: ACCENT, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '16px' }}>📋</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Lohn-Jahresmappe {jahr}</span>
        <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.18)', padding: '2px 9px', borderRadius: '10px', fontWeight: 700 }}>
          {erledigtCount} / {months.length} Monate abgerechnet
        </span>
        <button onClick={() => setShowSettings(v => !v)} title="Start-Monat"
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '6px', padding: '3px 8px', fontSize: '12px', cursor: 'pointer' }}>⚙</button>
      </div>

      {/* Einstellungen: Start-Monat */}
      {showSettings && (
        <div style={{ padding: '10px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text)' }}>Lohnauftrag beginnt ab:</span>
          <select value={startMonat} onChange={e => onUpdate({ startMonat: parseInt(e.target.value) })}
            style={{ padding: '5px 9px', border: '1px solid var(--border)', borderRadius: '6px', background: '#fff', color: 'var(--text)', fontSize: '12px' }}>
            {MONAT_NAMEN.map((mn, i) => <option key={i + 1} value={i + 1}>{mn}</option>)}
          </select>
        </div>
      )}

      {/* Monate */}
      <div style={{ background: 'var(--surface)' }}>
        {months.map((m, i) => {
          const st       = monate[m] ?? { erledigt: false }
          const hinweise = monatsHinweise[m] ?? []
          const offenH   = hinweise.filter(h => !h.erledigt).length
          const dauer    = anweisungen.filter(d => (!d.vonMonat || m >= d.vonMonat) && (!d.bisMonat || m <= d.bisMonat))
          const open     = openMonat === m
          const heute    = new Date()
          const istAkt   = m === heute.getMonth() + 1 && jahr === heute.getFullYear()

          return (
            <div key={m} style={{ borderBottom: i < months.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', background: open ? 'var(--surface2)' : 'transparent' }}>
                <input type="checkbox" checked={!!st.erledigt} onChange={() => toggleMonat(m)} title="Monat als abgerechnet markieren"
                  style={{ width: '16px', height: '16px', accentColor: '#16a34a', cursor: 'pointer', flexShrink: 0 }} />
                <button onClick={() => setOpenMonat(open ? null : m)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: st.erledigt ? '#16a34a' : 'var(--text)' }}>{MONAT_NAMEN[m - 1]} {jahr}</span>
                  {istAkt && !st.erledigt && <span style={{ fontSize: '10px', background: 'rgba(124,58,237,0.15)', color: ACCENT, padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>Aktuell</span>}
                  {st.erledigt && st.erledigtAm && <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>✓ {fmtDatumZeit(st.erledigtAm)}</span>}
                  {offenH > 0 && <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700 }}>● {offenH}</span>}
                  {dauer.length > 0 && <span style={{ fontSize: '10px', color: ACCENT }}>🧷 {dauer.length}</span>}
                  <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '12px', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>▸</span>
                </button>
              </div>

              {open && (
                <div style={{ padding: '4px 14px 14px 14px', background: 'var(--surface2)' }}>
                  {dauer.length > 0 && (
                    <div style={{ marginBottom: '8px', padding: '7px 10px', borderRadius: '6px', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>🧷 Diesen Monat zu beachten</div>
                      {dauer.map(d => (
                        <div key={d.id} style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.5 }}>
                          • {d.mitarbeiter ? <b>{d.mitarbeiter}: </b> : ''}{d.anweisung} <span style={{ color: 'var(--text-muted)' }}>({zeitraumText(d.vonMonat, d.bisMonat)})</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <MonatHinweise hinweise={hinweise} onChange={list => setMonatHinweise(m, list)} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
