import { useState } from 'react'

function genId() { return 'dl' + Date.now().toString(36) + Math.random().toString(36).slice(2,5) }

const DIFF_URSACHEN = ['', 'Tilgung nicht gebucht', 'Zinsen fehlen', 'Teilzahlung offen', 'Buchungsfehler', 'Sonstiges']
const EMPTY = { konto: '', geber: '', saldoBuch: '', saldoVertrag: '', ursache: '', notiz: '', betrieblich: true, vertrag: false, zinssatzPlausibel: false }

function fmt(n) {
  if (isNaN(n) || !isFinite(n) || n === 0) return '–'
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function ToolDarlehen({ data = [], onChange }) {
  const [list, setList]     = useState(data)
  const [editing, setEditing] = useState(null)
  const [form, setForm]     = useState({ ...EMPTY })
  const [showAdd, setShowAdd] = useState(false)

  function upd(l) { setList(l); onChange?.(l) }
  function setF(f, v) { setForm(p => ({ ...p, [f]: v })) }

  function save() {
    if (!form.geber.trim() && !form.konto.trim()) return
    const entry = { ...form, id: editing ?? genId() }
    upd(editing ? list.map(d => d.id === editing ? entry : d) : [...list, entry])
    setEditing(null); setForm({ ...EMPTY }); setShowAdd(false)
  }

  const inpStyle = { width: '100%', boxSizing: 'border-box', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }

  return (
    <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏦 Darlehen</div>
        <button onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ ...EMPTY }) }}
          style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          {showAdd && !editing ? '✕ Abbrechen' : '+ Darlehen'}
        </button>
      </div>

      {list.length === 0 && !showAdd && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Keine Darlehen erfasst</div>
      )}

      {list.map(dl => {
        const buch    = parseFloat(dl.saldoBuch?.replace(',', '.')) || 0
        const vertrag = parseFloat(dl.saldoVertrag?.replace(',', '.')) || 0
        const diff    = buch - vertrag
        return (
          <div key={dl.id} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '6px', background: 'var(--surface2)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>
                  {dl.geber || '–'}
                  {dl.konto && <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px' }}>Kto. {dl.konto}</span>}
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  {buch > 0 && <span>Buch: {fmt(buch)}</span>}
                  {vertrag > 0 && <span>Vertrag/Bank: {fmt(vertrag)}</span>}
                  {(buch > 0 || vertrag > 0) && <span style={{ color: Math.abs(diff) < 0.01 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                    Diff: {Math.abs(diff) < 0.01 ? '✓' : fmt(diff)}
                  </span>}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '11px', flexWrap: 'wrap' }}>
                  {dl.betrieblich && <span style={{ color: '#16a34a' }}>✓ Betrieblich</span>}
                  {dl.vertrag && <span style={{ color: '#2563eb' }}>✓ Vertrag vorhanden</span>}
                  {dl.zinssatzPlausibel && <span style={{ color: '#7c3aed' }}>✓ Zinssatz plausibel</span>}
                </div>
                {dl.notiz && <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '4px' }}>{dl.notiz}</div>}
              </div>
              <button onClick={() => { setForm({ ...dl }); setEditing(dl.id); setShowAdd(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)', padding: '2px 4px' }}>✏️</button>
              <button onClick={() => upd(list.filter(d => d.id !== dl.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#ef4444', opacity: 0.5, padding: '2px 4px' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}>🗑</button>
            </div>
          </div>
        )
      })}

      {showAdd && (
        <div style={{ padding: '12px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Kontonummer</label><input style={inpStyle} value={form.konto} onChange={e => setF('konto', e.target.value)} placeholder="z.B. 3310" /></div>
            <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Darlehensgeber</label><input style={inpStyle} value={form.geber} onChange={e => setF('geber', e.target.value)} placeholder="z.B. Sparkasse" /></div>
            <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Saldo laut Buchhaltung (€)</label><input style={inpStyle} value={form.saldoBuch} onChange={e => setF('saldoBuch', e.target.value)} placeholder="0,00" /></div>
            <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Saldo laut Vertrag / Bank (€)</label><input style={inpStyle} value={form.saldoVertrag} onChange={e => setF('saldoVertrag', e.target.value)} placeholder="0,00" /></div>
            <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Ursache der Differenz</label>
              <select style={inpStyle} value={form.ursache} onChange={e => setF('ursache', e.target.value)}>
                {DIFF_URSACHEN.map(o => <option key={o} value={o}>{o || '– auswählen –'}</option>)}
              </select>
            </div>
            <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Notiz</label><input style={inpStyle} value={form.notiz} onChange={e => setF('notiz', e.target.value)} placeholder="Anmerkung…" /></div>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {[['betrieblich','Betriebliche Veranlassung geprüft'],['vertrag','Vertrag vorhanden'],['zinssatzPlausibel','Zinssatz plausibel']].map(([k,l]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form[k]} onChange={e => setF(k, e.target.checked)} /> {l}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <button onClick={() => { setShowAdd(false); setEditing(null); setForm({ ...EMPTY }) }}
              style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>Abbrechen</button>
            <button onClick={save} style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              {editing ? '✓ Speichern' : '+ Hinzufügen'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
