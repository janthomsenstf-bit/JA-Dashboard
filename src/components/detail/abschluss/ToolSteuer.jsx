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

function fmt(n) {
  if (isNaN(n) || !isFinite(n)) return '–'
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function SteuerBlock({ title, icon, data = {}, onChange, extraFields = null }) {
  const [d, setD] = useState({
    bescheid: data.bescheid ?? '', buch: data.buch ?? '',
    ursache: data.ursache ?? '', behandlung: data.behandlung ?? '',
    offene: data.offene ?? '', zahlungsdatum: data.zahlungsdatum ?? '',
    ...Object.fromEntries(Object.entries(data).filter(([k]) => !['bescheid','buch','ursache','behandlung','offene','zahlungsdatum'].includes(k))),
  })
  function upd(f, v) { const n = { ...d, [f]: v }; setD(n); onChange?.(n) }

  const bescheid = parseFloat(d.bescheid.replace(',', '.')) || 0
  const buch     = parseFloat(d.buch.replace(',', '.')) || 0
  const diff     = bescheid - buch

  return (
    <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '10px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {icon} {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <Field label={`${title} laut Bescheid (€)`}><TextIn value={d.bescheid} onChange={v => upd('bescheid', v)} placeholder="0,00" /></Field>
        <Field label={`${title} laut Buchhaltung (€)`}><TextIn value={d.buch} onChange={v => upd('buch', v)} placeholder="0,00" /></Field>
      </div>
      {(bescheid !== 0 || buch !== 0) && (
        <div style={{ padding: '8px 12px', borderRadius: '6px', marginBottom: '8px',
          background: Math.abs(diff) < 0.01 ? 'rgba(22,163,74,0.07)' : 'rgba(217,119,6,0.07)',
          border: `1px solid ${Math.abs(diff) < 0.01 ? 'rgba(22,163,74,0.3)' : 'rgba(217,119,6,0.3)'}` }}>
          <span style={{ fontWeight: 700, color: Math.abs(diff) < 0.01 ? '#16a34a' : '#d97706', fontSize: '12px' }}>
            {Math.abs(diff) < 0.01 ? '✅ Bescheid und Buchhaltung stimmen überein' : `⚠️ Differenz: ${fmt(diff)}`}
          </span>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <Field label="Ursache der Differenz">
          <select value={d.ursache} onChange={e => upd('ursache', e.target.value)}
            style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }}>
            <option value="">– auswählen –</option>
            <option value="vorauszahlung">Differenz aus Vorauszahlungen</option>
            <option value="nachzahlung">Nachzahlung / Rückstand</option>
            <option value="erstattung">Erstattung ausstehend</option>
            <option value="buchungsfehler">Buchungsfehler</option>
            <option value="sonstige">Sonstige Ursache</option>
          </select>
        </Field>
        <Field label="Behandlung">
          <select value={d.behandlung} onChange={e => upd('behandlung', e.target.value)}
            style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }}>
            <option value="">– auswählen –</option>
            <option value="forderung">Buchung als Forderung</option>
            <option value="verbindlichkeit">Buchung als Verbindlichkeit</option>
            <option value="rueckstellung">Buchung als Rückstellung</option>
            <option value="korrektur">Buchungskorrektur notwendig</option>
          </select>
        </Field>
        <Field label="Offene Steuer zum Jahresende (€)"><TextIn value={d.offene} onChange={v => upd('offene', v)} placeholder="0,00" /></Field>
        <Field label="Zahlungsdatum">
          <input type="date" value={d.zahlungsdatum} onChange={e => upd('zahlungsdatum', e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }} />
        </Field>
      </div>
      {extraFields?.(d, upd)}
    </div>
  )
}

export function ToolGewSt({ data, onChange }) {
  return <SteuerBlock title="Gewerbesteuer" icon="🏭" data={data} onChange={onChange} />
}

export function ToolKSt({ data, onChange }) {
  return (
    <SteuerBlock title="Körperschaftsteuer" icon="🏛️" data={data} onChange={onChange}
      extraFields={(d, upd) => (
        <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!d.soli} onChange={e => upd('soli', e.target.checked)} />
            Solidaritätszuschlag berücksichtigen
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!d.kest} onChange={e => upd('kest', e.target.checked)} />
            Kapitalertragsteuer berücksichtigen
          </label>
        </div>
      )} />
  )
}
