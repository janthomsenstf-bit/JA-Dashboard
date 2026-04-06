import { useState } from 'react'

const ZEILEN = [
  { key: 'lohn',           label: 'Verbindlichkeiten Lohn / Gehalt' },
  { key: 'soziales',       label: 'Verbindlichkeiten soziale Sicherheiten' },
  { key: 'lohnsteuer',     label: 'Verbindlichkeiten Lohnsteuer' },
  { key: 'altvorsorge',    label: 'Betriebliche Altersvorsorge' },
  { key: 'vermoegensbild', label: 'Vermögensbildung' },
]

const BEHANDLUNGEN = ['', 'Passt – keine Maßnahme', 'Rückstellung bilden', 'Buchungskorrektur', 'Rückfrage Mandant']

function fmt(n) {
  if (isNaN(n) || !isFinite(n)) return '–'
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function ToolVerbindlichkeiten({ data = {}, onChange }) {
  const [rows, setRows] = useState(() =>
    Object.fromEntries(ZEILEN.map(z => [z.key, {
      betrag: data[z.key]?.betrag ?? '',
      zahlung: data[z.key]?.zahlung ?? '',
      behandlung: data[z.key]?.behandlung ?? '',
      notiz: data[z.key]?.notiz ?? '',
    }]))
  )
  const [expanded, setExpanded] = useState({})

  function updRow(key, field, val) {
    const next = { ...rows, [key]: { ...rows[key], [field]: val } }
    setRows(next)
    onChange?.(next)
  }

  const inpStyle = { width: '100%', boxSizing: 'border-box', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }

  return (
    <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        📋 Verbindlichkeiten-Abstimmung Lohn
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {['Position', 'Betrag laut Buch 31.12. (€)', 'Zahlung Folgejahr (€)', 'Differenz', 'Behandlung', ''].map(h => (
              <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '11px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ZEILEN.map(z => {
            const r = rows[z.key]
            const betrag  = parseFloat(r.betrag.replace(',', '.')) || 0
            const zahlung = parseFloat(r.zahlung.replace(',', '.')) || 0
            const diff    = zahlung - betrag
            const isExp   = expanded[z.key]
            return (
              <>
                <tr key={z.key} style={{ borderBottom: '1px solid var(--border)', background: isExp ? 'rgba(37,99,235,0.03)' : 'transparent' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{z.label}</td>
                  <td style={{ padding: '6px 8px' }}><input style={{ ...inpStyle, maxWidth: '120px' }} value={r.betrag} onChange={e => updRow(z.key, 'betrag', e.target.value)} placeholder="0,00" /></td>
                  <td style={{ padding: '6px 8px' }}><input style={{ ...inpStyle, maxWidth: '120px' }} value={r.zahlung} onChange={e => updRow(z.key, 'zahlung', e.target.value)} placeholder="0,00" /></td>
                  <td style={{ padding: '6px 8px', fontWeight: 700, color: Math.abs(diff) < 0.01 ? '#16a34a' : '#dc2626' }}>
                    {betrag > 0 || zahlung > 0 ? (Math.abs(diff) < 0.01 ? '✓' : fmt(diff)) : '–'}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <select style={{ ...inpStyle, maxWidth: '180px' }} value={r.behandlung} onChange={e => updRow(z.key, 'behandlung', e.target.value)}>
                      {BEHANDLUNGEN.map(b => <option key={b} value={b}>{b || '– auswählen –'}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    <button onClick={() => setExpanded(e => ({ ...e, [z.key]: !e[z.key] }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--text-muted)' }}>
                      {isExp ? '▲' : '▼'}
                    </button>
                  </td>
                </tr>
                {isExp && (
                  <tr key={z.key + '_notiz'} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td colSpan={6} style={{ padding: '6px 8px 10px' }}>
                      <input style={inpStyle} value={r.notiz} onChange={e => updRow(z.key, 'notiz', e.target.value)} placeholder="Notiz / Erläuterung…" />
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
