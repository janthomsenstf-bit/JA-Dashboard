/**
 * LohnStammdaten.jsx – Dauerhafte / zeitraumbezogene Lohn-Stammdaten am Lohn-Auftrag.
 *
 * Rein additiv, gespeichert am Auftrag:
 *   au.mitarbeiterAnweisungen = [{ id, mitarbeiter, anweisung, vonMonat, bisMonat }]
 *   au.lohnVereinbarungen     = [{ id, text }]
 *
 * Props: { au, onUpdate }
 */
import { useState } from 'react'

const ACCENT = '#7c3aed'
export const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

function newId() { return 'st' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36) }

export function zeitraumText(von, bis) {
  if (!von && !bis) return 'dauerhaft'
  if (von && bis)   return `${MONATE_KURZ[von - 1]}–${MONATE_KURZ[bis - 1]}`
  if (von)          return `ab ${MONATE_KURZ[von - 1]}`
  return `bis ${MONATE_KURZ[bis - 1]}`
}

const VEREINBARUNG_PRESETS = [
  'Auswertungen immer per Mail an den Mandanten',
  'Auswertungen nur über Stotax Select',
  'Lohnabrechnungen an Mitarbeiter direkt',
]

const inputS = { padding: '6px 9px', border: '1px solid var(--border)', borderRadius: '6px', background: '#fff', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box' }
const labelS = { fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px', display: 'block' }

export default function LohnStammdaten({ au, onUpdate }) {
  const mitarbeiter = Array.isArray(au.mitarbeiterAnweisungen) ? au.mitarbeiterAnweisungen : []
  const vereinb     = Array.isArray(au.lohnVereinbarungen) ? au.lohnVereinbarungen : []

  const [maName, setMaName] = useState('')
  const [maText, setMaText] = useState('')
  const [maVon,  setMaVon]  = useState('')
  const [maBis,  setMaBis]  = useState('')
  const [vbText, setVbText] = useState('')
  const [open,   setOpen]   = useState(true)

  function setMA(list) { onUpdate({ mitarbeiterAnweisungen: list }) }
  function setVB(list) { onUpdate({ lohnVereinbarungen: list }) }

  function addMa() {
    const a = maText.trim()
    if (!a) return
    setMA([...mitarbeiter, {
      id: newId(),
      mitarbeiter: maName.trim(),
      anweisung: a,
      vonMonat: maVon ? parseInt(maVon) : null,
      bisMonat: maBis ? parseInt(maBis) : null,
    }])
    setMaName(''); setMaText(''); setMaVon(''); setMaBis('')
  }
  function delMa(id) { setMA(mitarbeiter.filter(x => x.id !== id)) }

  function addVb(t) {
    const v = (t ?? vbText).trim()
    if (!v) return
    setVB([...vereinb, { id: newId(), text: v }])
    setVbText('')
  }
  function delVb(id) { setVB(vereinb.filter(x => x.id !== id)) }

  const monatOpts = [<option key="" value="">—</option>, ...MONATE_KURZ.map((mn, i) => <option key={i + 1} value={i + 1}>{mn}</option>)]

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Kopf */}
      <button onClick={() => setOpen(v => !v)}
        style={{ width: '100%', textAlign: 'left', background: ACCENT, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', border: 'none', cursor: 'pointer' }}>
        <span style={{ fontSize: '15px' }}>🧷</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Lohn-Stammdaten &amp; Dauer-Anweisungen</span>
        {(mitarbeiter.length + vereinb.length) > 0 && (
          <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.18)', padding: '2px 9px', borderRadius: '10px', fontWeight: 700 }}>{mitarbeiter.length + vereinb.length}</span>
        )}
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▸</span>
      </button>

      {open && (
        <div style={{ background: 'var(--surface)' }}>
          {/* ── Mitarbeiter-bezogen ── */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>👤 Mitarbeiter-bezogen</div>

            {/* Eingabe */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: mitarbeiter.length ? '10px' : 0 }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <input value={maName} onChange={e => setMaName(e.target.value)} placeholder="Mitarbeiter (Name)" style={{ ...inputS, flex: '1 1 160px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>von</span>
                  <select value={maVon} onChange={e => setMaVon(e.target.value)} style={{ ...inputS, width: '64px' }}>{monatOpts}</select>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>bis</span>
                  <select value={maBis} onChange={e => setMaBis(e.target.value)} style={{ ...inputS, width: '64px' }}>{monatOpts}</select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input value={maText} onChange={e => setMaText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addMa()}
                  placeholder="Anweisung, z. B. +500 € Bonus monatlich" style={{ ...inputS, flex: 1 }} />
                <button onClick={addMa} disabled={!maText.trim()}
                  style={{ padding: '0 13px', borderRadius: '6px', border: 'none', background: maText.trim() ? ACCENT : 'var(--border)', color: '#fff', fontSize: '16px', fontWeight: 700, cursor: maText.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}>+</button>
              </div>
            </div>

            {/* Liste */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {mitarbeiter.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '7px 10px', borderRadius: '6px', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {d.mitarbeiter
                        ? <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)' }}>👤 {d.mitarbeiter}</span>
                        : <span style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-muted)' }}>(ohne Name)</span>}
                      <span style={{ fontSize: '10px', fontWeight: 700, color: ACCENT, background: 'rgba(124,58,237,0.1)', borderRadius: '8px', padding: '1px 7px' }}>📅 {zeitraumText(d.vonMonat, d.bisMonat)}</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text)', marginTop: '2px', wordBreak: 'break-word' }}>{d.anweisung}</div>
                  </div>
                  <button onClick={() => delMa(d.id)} title="Löschen"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '0 2px', flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>🗑</button>
                </div>
              ))}
              {mitarbeiter.length === 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Noch keine Mitarbeiter-Anweisungen.</div>}
            </div>
          </div>

          {/* ── Allgemeine Vereinbarungen ── */}
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>📋 Allgemeine Lohn-Vereinbarungen</div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
              <input value={vbText} onChange={e => setVbText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addVb()}
                placeholder="z. B. Auswertungen immer per Mail…" style={{ ...inputS, flex: 1 }} />
              <button onClick={() => addVb()} disabled={!vbText.trim()}
                style={{ padding: '0 13px', borderRadius: '6px', border: 'none', background: vbText.trim() ? ACCENT : 'var(--border)', color: '#fff', fontSize: '16px', fontWeight: 700, cursor: vbText.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}>+</button>
            </div>

            {/* Schnellauswahl */}
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: vereinb.length ? '10px' : 0 }}>
              {VEREINBARUNG_PRESETS.map(p => (
                <button key={p} onClick={() => addVb(p)}
                  style={{ padding: '3px 9px', borderRadius: '20px', fontSize: '10px', cursor: 'pointer', border: '1px dashed var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>+ {p}</button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {vereinb.map(v => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '7px 10px', borderRadius: '6px', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <span style={{ color: ACCENT, fontSize: '14px', lineHeight: 1.3, flexShrink: 0 }}>›</span>
                  <span style={{ flex: 1, fontSize: '12.5px', color: 'var(--text)', wordBreak: 'break-word' }}>{v.text}</span>
                  <button onClick={() => delVb(v.id)} title="Löschen"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '0 2px', flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>🗑</button>
                </div>
              ))}
              {vereinb.length === 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Noch keine Vereinbarungen.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
