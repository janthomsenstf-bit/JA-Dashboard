import { useState } from 'react'

const METHODEN = ['1%-Methode', 'Fahrtenbuch', 'Keine Privatnutzung']
const NUTZER_TYPEN = ['Unternehmer', 'Arbeitnehmer', 'Poolfahrzeug']

function genId() { return 'fz' + Date.now().toString(36) + Math.random().toString(36).slice(2,5) }

const EMPTY = { kennzeichen: '', marke: '', bruttolistenpreis: '', kaufLeasing: 'Kauf', nutzer: '', nutzerTyp: 'Unternehmer', methode: '1%-Methode', aktiv: true }

export default function ToolFahrzeuge({ data = [], onChange }) {
  const [list, setList]     = useState(data)
  const [editing, setEditing] = useState(null)
  const [form, setForm]     = useState({ ...EMPTY })
  const [showAdd, setShowAdd] = useState(false)

  function upd(list2) { setList(list2); onChange?.(list2) }
  function setF(f, v) { setForm(p => ({ ...p, [f]: v })) }

  function save() {
    if (!form.kennzeichen.trim() && !form.marke.trim()) return
    let next
    if (editing) {
      next = list.map(f => f.id === editing ? { ...form, id: editing } : f)
    } else {
      next = [...list, { ...form, id: genId() }]
    }
    upd(next); setEditing(null); setForm({ ...EMPTY }); setShowAdd(false)
  }

  function edit(fz) { setForm({ ...fz }); setEditing(fz.id); setShowAdd(true) }
  function del(id)  { upd(list.filter(f => f.id !== id)) }
  function toggle(id, field) { upd(list.map(f => f.id === id ? { ...f, [field]: !f[field] } : f)) }

  const inpStyle = { width: '100%', boxSizing: 'border-box', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }
  const selStyle = { ...inpStyle }

  return (
    <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🚗 Fahrzeugübersicht</div>
        <button onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ ...EMPTY }) }}
          style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          {showAdd && !editing ? '✕ Abbrechen' : '+ Fahrzeug'}
        </button>
      </div>

      {/* Liste */}
      {list.length === 0 && !showAdd && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Keine Fahrzeuge erfasst</div>
      )}
      {list.map(fz => (
        <div key={fz.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '6px', background: fz.aktiv ? 'var(--surface2)' : 'rgba(100,116,139,0.05)', opacity: fz.aktiv ? 1 : 0.6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>{fz.kennzeichen || '–'} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{fz.marke}</span></div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {fz.kaufLeasing && <span>{fz.kaufLeasing}</span>}
              {fz.methode && <span>· {fz.methode}</span>}
              {fz.nutzerTyp && <span>· {fz.nutzerTyp}</span>}
              {fz.nutzer && <span>· {fz.nutzer}</span>}
              {fz.bruttolistenpreis && <span>· BLP: {fz.bruttolistenpreis} €</span>}
            </div>
          </div>
          <button onClick={() => toggle(fz.id, 'aktiv')} title={fz.aktiv ? 'Als verkauft markieren' : 'Als aktiv markieren'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.6, padding: '2px 4px' }}>
            {fz.aktiv ? '🟢' : '🔴'}
          </button>
          <button onClick={() => edit(fz)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)', padding: '2px 4px' }}>✏️</button>
          <button onClick={() => del(fz.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#ef4444', opacity: 0.5, padding: '2px 4px' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>🗑</button>
        </div>
      ))}

      {/* Add / Edit Form */}
      {showAdd && (
        <div style={{ padding: '12px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Kennzeichen</label><input style={inpStyle} value={form.kennzeichen} onChange={e => setF('kennzeichen', e.target.value)} placeholder="z.B. MH-AB 123" /></div>
            <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Marke / Modell</label><input style={inpStyle} value={form.marke} onChange={e => setF('marke', e.target.value)} placeholder="z.B. VW Golf" /></div>
            <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Bruttolistenpreis (€)</label><input style={inpStyle} value={form.bruttolistenpreis} onChange={e => setF('bruttolistenpreis', e.target.value)} placeholder="0,00" /></div>
            <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Kauf / Leasing</label>
              <select style={selStyle} value={form.kaufLeasing} onChange={e => setF('kaufLeasing', e.target.value)}>
                {['Kauf','Leasing'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Nutzer</label><input style={inpStyle} value={form.nutzer} onChange={e => setF('nutzer', e.target.value)} placeholder="Name" /></div>
            <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Nutzertyp</label>
              <select style={selStyle} value={form.nutzerTyp} onChange={e => setF('nutzerTyp', e.target.value)}>
                {NUTZER_TYPEN.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Methode</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {METHODEN.map(m => (
                  <button key={m} onClick={() => setF('methode', m)}
                    style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer', fontWeight: form.methode === m ? 700 : 400, border: `1px solid ${form.methode === m ? 'var(--accent)' : 'var(--border)'}`, background: form.methode === m ? 'var(--accent)' : 'transparent', color: form.methode === m ? '#fff' : 'var(--text-muted)' }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowAdd(false); setEditing(null); setForm({ ...EMPTY }) }}
              style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
              Abbrechen
            </button>
            <button onClick={save} style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              {editing ? '✓ Speichern' : '+ Hinzufügen'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
