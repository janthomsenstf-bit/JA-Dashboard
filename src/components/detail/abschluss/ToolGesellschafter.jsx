import { useState } from 'react'

function genId() { return 'gs' + Date.now().toString(36) + Math.random().toString(36).slice(2,5) }

const EMPTY = { name: '', beteiligung: '', funktion: '', naeheverhaeltnis: '', bemerkung: '' }

function fmt(n) {
  if (isNaN(n) || !isFinite(n)) return '–'
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function ToolGesellschafter({ data = [], zinsrechner = {}, ugRuecklage = {}, onChangeList, onChangeZins, onChangeUg }) {
  const [list, setList]     = useState(data)
  const [form, setForm]     = useState({ ...EMPTY })
  const [editing, setEditing] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [zins, setZins]     = useState({ forderung: zinsrechner.forderung ?? '', zinssatz: zinsrechner.zinssatz ?? '' })
  const [ug, setUg]         = useState({ jahresueberschuss: ugRuecklage.jahresueberschuss ?? '', verlustvortrag: ugRuecklage.verlustvortrag ?? '' })

  function updList(l) { setList(l); onChangeList?.(l) }
  function setF(f, v) { setForm(p => ({ ...p, [f]: v })) }
  function updZins(f, v) { const n = { ...zins, [f]: v }; setZins(n); onChangeZins?.(n) }
  function updUg(f, v)   { const n = { ...ug, [f]: v };   setUg(n);   onChangeUg?.(n) }

  function save() {
    if (!form.name.trim()) return
    const entry = { ...form, id: editing ?? genId() }
    updList(editing ? list.map(g => g.id === editing ? entry : g) : [...list, entry])
    setEditing(null); setForm({ ...EMPTY }); setShowAdd(false)
  }

  const inpStyle = { width: '100%', boxSizing: 'border-box', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }
  const total    = list.reduce((s, g) => s + (parseFloat(g.beteiligung) || 0), 0)

  const ford   = parseFloat(zins.forderung.replace(',', '.')) || 0
  const zsatz  = parseFloat(zins.zinssatz.replace(',', '.')) || 0
  const zinsBet = ford * zsatz / 100

  const jue    = parseFloat(ug.jahresueberschuss.replace(',', '.')) || 0
  const vlv    = parseFloat(ug.verlustvortrag.replace(',', '.')) || 0
  const ugBasis= Math.max(0, jue - vlv)
  const ugRückl = ugBasis * 0.25

  const section = { padding: '12px 14px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '10px' }

  return (
    <div>
      {/* Gesellschafter-Tabelle */}
      <div style={section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>👥 Gesellschafterübersicht</div>
          <button onClick={() => { setShowAdd(!showAdd); setEditing(null); setForm({ ...EMPTY }) }}
            style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
            {showAdd && !editing ? '✕' : '+ Gesellschafter'}
          </button>
        </div>

        {list.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '8px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                {['Name', 'Beteiligung %', 'Funktion', 'Näheverhältnis', 'Bemerkung', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '5px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '11px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(g => (
                <tr key={g.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{g.name}</td>
                  <td style={{ padding: '6px 8px' }}>{g.beteiligung ? `${g.beteiligung} %` : '–'}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{g.funktion || '–'}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{g.naeheverhaeltnis || '–'}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--text-muted)', fontSize: '11px' }}>{g.bemerkung || '–'}</td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => { setForm({ ...g }); setEditing(g.id); setShowAdd(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)', marginRight: '4px' }}>✏️</button>
                    <button onClick={() => updList(list.filter(x => x.id !== g.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#ef4444', opacity: 0.5 }}
                      onMouseEnter={e => e.currentTarget.style.opacity='1'} onMouseLeave={e => e.currentTarget.style.opacity='0.5'}>🗑</button>
                  </td>
                </tr>
              ))}
              {list.length > 0 && (
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                  <td style={{ padding: '6px 8px' }}>Gesamt</td>
                  <td style={{ padding: '6px 8px', color: Math.abs(total - 100) < 0.01 ? '#16a34a' : '#dc2626' }}>{total.toFixed(2)} %</td>
                  <td colSpan={4}></td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {list.length === 0 && !showAdd && <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Keine Gesellschafter erfasst</div>}

        {showAdd && (
          <div style={{ padding: '10px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Name *</label><input style={inpStyle} value={form.name} onChange={e => setF('name', e.target.value)} /></div>
              <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Beteiligung (%)</label><input style={inpStyle} value={form.beteiligung} onChange={e => setF('beteiligung', e.target.value)} placeholder="0" /></div>
              <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Funktion</label><input style={inpStyle} value={form.funktion} onChange={e => setF('funktion', e.target.value)} placeholder="z.B. Geschäftsführer" /></div>
              <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Näheverhältnis</label><input style={inpStyle} value={form.naeheverhaeltnis} onChange={e => setF('naeheverhaeltnis', e.target.value)} placeholder="z.B. Ehegatte" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Bemerkung</label><input style={inpStyle} value={form.bemerkung} onChange={e => setF('bemerkung', e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowAdd(false); setEditing(null); setForm({ ...EMPTY }) }} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={save} style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{editing ? '✓ Speichern' : '+ Hinzufügen'}</button>
            </div>
          </div>
        )}
      </div>

      {/* Zinsrechner */}
      <div style={section}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💸 Zinsrechner Forderungen ggü. Gesellschaftern</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Forderungsbetrag (€)</label><input style={inpStyle} value={zins.forderung} onChange={e => updZins('forderung', e.target.value)} placeholder="0,00" /></div>
          <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Zinssatz (%)</label><input style={inpStyle} value={zins.zinssatz} onChange={e => updZins('zinssatz', e.target.value)} placeholder="0,00" /></div>
        </div>
        {ford > 0 && zsatz > 0 && (
          <div style={{ padding: '8px 12px', background: 'var(--surface2)', borderRadius: '6px', fontSize: '12px' }}>
            Zinsbetrag (p.a.): <strong style={{ color: 'var(--accent)' }}>{fmt(zinsBet)}</strong>
          </div>
        )}
      </div>

      {/* UG-Rücklagenrechner */}
      <div style={section}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🏦 UG-Rücklagenrechner</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Jahresüberschuss (€)</label><input style={inpStyle} value={ug.jahresueberschuss} onChange={e => updUg('jahresueberschuss', e.target.value)} placeholder="0,00" /></div>
          <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Verlustvortrag (€)</label><input style={inpStyle} value={ug.verlustvortrag} onChange={e => updUg('verlustvortrag', e.target.value)} placeholder="0,00" /></div>
        </div>
        {jue > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', background: 'var(--surface2)', borderRadius: '6px', fontSize: '12px' }}>
              <span>Bemessungsgrundlage</span><strong>{fmt(ugBasis)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 10px', background: 'rgba(37,99,235,0.07)', borderRadius: '6px', fontSize: '12px' }}>
              <span>Gesetzliche Rücklage (25 %)</span><strong style={{ color: '#2563eb' }}>{fmt(ugRückl)}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
