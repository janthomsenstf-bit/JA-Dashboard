import { useState } from 'react'

function NumInput({ label, value, onChange, placeholder = '0,00' }) {
  return (
    <div>
      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px',
          border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }} />
    </div>
  )
}

function ResultRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border)', marginTop: '6px' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  )
}

function fmt(n) {
  if (isNaN(n) || !isFinite(n)) return '–'
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// ── PWB-Rechner ───────────────────────────────────────────────────────────────
export function PwbRechner({ data = {}, onChange }) {
  const [d, setD] = useState({ forderungen: data.forderungen ?? '', zweifelh: data.zweifelh ?? '', ausfallquote: data.ausfallquote ?? '1' })
  function upd(f, v) { const n = { ...d, [f]: v }; setD(n); onChange?.(n) }

  const ford   = parseFloat(d.forderungen.replace(',', '.')) || 0
  const zweif  = parseFloat(d.zweifelh.replace(',', '.')) || 0
  const quote  = parseFloat(d.ausfallquote.replace(',', '.')) || 0
  const basis  = Math.max(0, ford - zweif)
  const pwb    = basis * quote / 100

  return (
    <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '10px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📊 PWB-Rechner</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <NumInput label="Gesamtforderungen (€)"     value={d.forderungen}  onChange={v => upd('forderungen', v)} />
        <NumInput label="Zweifelhafte Forderungen (€)" value={d.zweifelh}  onChange={v => upd('zweifelh', v)} />
        <NumInput label="Ausfallquote (%)"           value={d.ausfallquote} onChange={v => upd('ausfallquote', v)} placeholder="1" />
      </div>
      {ford > 0 && <>
        <ResultRow label="Bemessungsgrundlage" value={fmt(basis)} />
        <ResultRow label="PWB-Betrag" value={fmt(pwb)} color="#2563eb" />
      </>}
    </div>
  )
}

// ── RAP-Rechner ───────────────────────────────────────────────────────────────
export function RapRechner({ title, data = {}, onChange }) {
  const [d, setD] = useState({ betrag: data.betrag ?? '', monate: data.monate ?? '', monateFolgejahr: data.monateFolgejahr ?? '' })
  function upd(f, v) { const n = { ...d, [f]: v }; setD(n); onChange?.(n) }

  const betrag  = parseFloat(d.betrag.replace(',', '.')) || 0
  const monate  = parseFloat(d.monate.replace(',', '.')) || 0
  const folgej  = parseFloat(d.monateFolgejahr.replace(',', '.')) || 0
  const rap     = monate > 0 ? betrag / monate * folgej : 0

  return (
    <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '10px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <NumInput label="Gesamtbetrag (€)"        value={d.betrag}          onChange={v => upd('betrag', v)} />
        <NumInput label="Gesamtzeitraum (Monate)" value={d.monate}          onChange={v => upd('monate', v)} placeholder="12" />
        <NumInput label="Davon Folgejahr (Monate)"value={d.monateFolgejahr} onChange={v => upd('monateFolgejahr', v)} />
      </div>
      {betrag > 0 && <ResultRow label="RAP-Betrag" value={fmt(rap)} color="#2563eb" />}
    </div>
  )
}

// ── Fremdwährungsrechner ──────────────────────────────────────────────────────
export function FremdwaehrungRechner({ data = {}, onChange }) {
  const [d, setD] = useState({ betrag: data.betrag ?? '', altKurs: data.altKurs ?? '', stichtagKurs: data.stichtagKurs ?? '' })
  function upd(f, v) { const n = { ...d, [f]: v }; setD(n); onChange?.(n) }

  const betrag   = parseFloat(d.betrag.replace(',', '.')) || 0
  const altKurs  = parseFloat(d.altKurs.replace(',', '.')) || 0
  const stichKurs= parseFloat(d.stichtagKurs.replace(',', '.')) || 0
  const wertAlt  = altKurs > 0 ? betrag / altKurs : 0
  const wertStich= stichKurs > 0 ? betrag / stichKurs : 0
  const diff     = wertStich - wertAlt

  return (
    <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💱 Fremdwährungsrechner</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <NumInput label="Betrag (Fremdwährung)"   value={d.betrag}      onChange={v => upd('betrag', v)} />
        <NumInput label="Kurs bei Zugang"         value={d.altKurs}     onChange={v => upd('altKurs', v)} placeholder="1,0000" />
        <NumInput label="Kurs am Stichtag"        value={d.stichtagKurs}onChange={v => upd('stichtagKurs', v)} placeholder="1,0000" />
      </div>
      {betrag > 0 && altKurs > 0 && stichKurs > 0 && <>
        <ResultRow label="Wert bei Zugang (€)"   value={fmt(wertAlt)} />
        <ResultRow label="Wert am Stichtag (€)"  value={fmt(wertStich)} />
        <ResultRow label="Differenz"             value={(diff >= 0 ? '+' : '') + fmt(diff)} color={diff >= 0 ? '#16a34a' : '#dc2626'} />
      </>}
    </div>
  )
}
