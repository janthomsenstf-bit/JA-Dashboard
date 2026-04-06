import { useState } from 'react'

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  )
}

function TextIn({ value, onChange, placeholder = '' }) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px',
        border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }} />
  )
}

function ChipToggle({ value, options, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer', fontWeight: value === o.value ? 700 : 400,
            border: `1px solid ${value === o.value ? 'var(--accent)' : 'var(--border)'}`,
            background: value === o.value ? 'var(--accent)' : 'transparent',
            color: value === o.value ? '#fff' : 'var(--text-muted)' }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function fmt(n) {
  if (isNaN(n) || !isFinite(n)) return '–'
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export default function ToolUst({ data = {}, onChange }) {
  const [d, setD] = useState({
    sollIst:      data.sollIst ?? 'soll',
    eurBilanz:    data.eurBilanz ?? 'bilanz',
    dauerfrist:   data.dauerfrist ?? false,
    ustBuch:      data.ustBuch ?? '',
    ustFA:        data.ustFA ?? '',
    zahllastDez:  data.zahllastDez ?? '',
    zahlungsdatum:data.zahlungsdatum ?? '',
  })

  function upd(f, v) { const n = { ...d, [f]: v }; setD(n); onChange?.(n) }

  const buch    = parseFloat(d.ustBuch.replace(',', '.')) || 0
  const fa      = parseFloat(d.ustFA.replace(',', '.')) || 0
  const zahllast= parseFloat(d.zahllastDez.replace(',', '.')) || 0
  const diff    = buch - fa
  const isEUR   = d.eurBilanz === 'eur'

  // § 11 EStG Relevanz (nur bei EÜR)
  const para11   = isEUR && d.zahlungsdatum
  const refDate  = d.zahlungsdatum ? new Date(d.zahlungsdatum) : null
  const jahresend = refDate ? new Date(refDate.getFullYear(), 11, 31) : null
  const in10Tagen = jahresend ? new Date(jahresend.getFullYear() + 1, 0, 10) : null
  const istAltesPeriod = refDate && in10Tagen ? refDate <= in10Tagen : false

  const section = { padding: '12px 14px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '10px' }
  const resultBg = { padding: '8px 12px', borderRadius: '6px', marginTop: '8px', fontSize: '12px' }

  return (
    <div>
      <div style={section}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>⚙️ Konfiguration</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Field label="Besteuerungsart">
            <ChipToggle value={d.sollIst} onChange={v => upd('sollIst', v)}
              options={[{ value: 'soll', label: 'Soll-Versteuerung' }, { value: 'ist', label: 'Ist-Versteuerung' }]} />
          </Field>
          <Field label="Gewinnermittlung">
            <ChipToggle value={d.eurBilanz} onChange={v => upd('eurBilanz', v)}
              options={[{ value: 'bilanz', label: 'Bilanz' }, { value: 'eur', label: 'EÜR' }]} />
          </Field>
        </div>
        <div style={{ marginTop: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={d.dauerfrist} onChange={e => upd('dauerfrist', e.target.checked)} />
            Dauerfristverlängerung
          </label>
        </div>
      </div>

      <div style={section}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📊 Abstimmung USt</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <Field label="USt laut Buchhaltung (€)"><TextIn value={d.ustBuch} onChange={v => upd('ustBuch', v)} placeholder="0,00" /></Field>
          <Field label="USt laut Steuerkonto / FA (€)"><TextIn value={d.ustFA} onChange={v => upd('ustFA', v)} placeholder="0,00" /></Field>
          <Field label="USt-Zahllast Dez. / Q4 (€)"><TextIn value={d.zahllastDez} onChange={v => upd('zahllastDez', v)} placeholder="0,00" /></Field>
          <Field label="Zahlungsdatum"><input type="date" value={d.zahlungsdatum} onChange={e => upd('zahlungsdatum', e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }} /></Field>
        </div>
        {(buch !== 0 || fa !== 0) && (
          <div style={{ ...resultBg, background: Math.abs(diff) < 0.01 ? 'rgba(22,163,74,0.07)' : 'rgba(220,38,38,0.07)', border: `1px solid ${Math.abs(diff) < 0.01 ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}` }}>
            <div style={{ fontWeight: 700, color: Math.abs(diff) < 0.01 ? '#16a34a' : '#dc2626' }}>
              {Math.abs(diff) < 0.01 ? '✅ Buchhaltung und FA stimmen überein' : `⚠️ Differenz: ${fmt(diff)}`}
            </div>
            {zahllast > 0 && <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
              USt-Zahllast Dez./Q4: {fmt(zahllast)}
              {d.zahlungsdatum && <> · Zahlung: {new Date(d.zahlungsdatum + 'T12:00:00').toLocaleDateString('de-DE')}</>}
            </div>}
            {isEUR && zahllast > 0 && (
              <div style={{ marginTop: '6px', padding: '6px 10px', background: 'rgba(37,99,235,0.07)', borderRadius: '6px', border: '1px solid rgba(37,99,235,0.2)', fontSize: '11px', color: '#2563eb' }}>
                <strong>§ 11 EStG:</strong> Bei EÜR: Zahllast December/Q4 gehört zum alten Jahr, wenn Zahlung bis 10. Januar.
                {d.zahlungsdatum && <> → Zahlung {istAltesPeriod ? 'fällt in alte Periode (bis 10.01.)' : 'fällt in neue Periode (nach 10.01.)'}</>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
