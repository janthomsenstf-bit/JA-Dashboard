import { useState } from 'react'

export default function ToolBewirtung({ data = {}, onChange }) {
  const [d, setD] = useState({
    gesamt: data.gesamt ?? '', personen: data.personen ?? '',
    mitarbeiter: data.mitarbeiter ?? '', partner: data.partner ?? '',
    anlassDok: data.anlassDok ?? false, teilnehmerDok: data.teilnehmerDok ?? false,
    belegVollst: data.belegVollst ?? false,
  })

  function upd(field, val) {
    const next = { ...d, [field]: val }
    setD(next)
    onChange?.(next)
  }

  const gesamt    = parseFloat(d.gesamt.replace(',', '.')) || 0
  const abziehbar = gesamt * 0.7
  const nichtAbz  = gesamt * 0.3

  const inp = (field, placeholder) => (
    <input type="text" value={d[field]} onChange={e => upd(field, e.target.value)}
      placeholder={placeholder}
      style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px',
        border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }} />
  )

  const cell = { padding: '6px 10px', fontSize: '12px', borderBottom: '1px solid var(--border)' }

  return (
    <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        🍽️ Bewirtungsrechner
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Gesamtbetrag (€)</label>{inp('gesamt', '0,00')}</div>
        <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Anzahl Personen gesamt</label>{inp('personen', '0')}</div>
        <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>davon Mitarbeiter</label>{inp('mitarbeiter', '0')}</div>
        <div><label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>davon Geschäftspartner</label>{inp('partner', '0')}</div>
      </div>
      {gesamt > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', fontSize: '12px' }}>
          <tbody>
            <tr><td style={cell}>Abziehbarer Anteil (70 %)</td><td style={{ ...cell, fontWeight: 700, color: '#16a34a', textAlign: 'right' }}>{abziehbar.toFixed(2)} €</td></tr>
            <tr><td style={cell}>Nicht abziehbarer Anteil (30 %)</td><td style={{ ...cell, fontWeight: 700, color: '#dc2626', textAlign: 'right' }}>{nichtAbz.toFixed(2)} €</td></tr>
          </tbody>
        </table>
      )}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {[['anlassDok', 'Anlass dokumentiert?'], ['teilnehmerDok', 'Teilnehmer dokumentiert?'], ['belegVollst', 'Beleg vollständig?']].map(([k, l]) => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!d[k]} onChange={e => upd(k, e.target.checked)} />
            {d[k] ? '✅' : '❌'} {l}
          </label>
        ))}
      </div>
    </div>
  )
}
