import { useState, useMemo } from 'react'
import { RECHNER_TEMPLATES, parseZ, fmtEur, newInstanz, newZeile, berechneFahrzeug, newFahrzeug } from '../../../utils/rechnerConfig.js'
import KfzRechnerSlideIn from './KfzRechnerSlideIn.jsx'

// ── Farbkodierung Ergebnisse ─────────────────────────────────────────────────
const FARBE = {
  gruen:  { color: '#16a34a', bg: 'rgba(22,163,74,0.1)',   border: 'rgba(22,163,74,0.3)'  },
  rot:    { color: '#dc2626', bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.25)' },
  orange: { color: '#d97706', bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.25)' },
  default:{ color: 'var(--text)', bg: 'var(--surface2)', border: 'var(--border)' },
}
function farbe(f) { return FARBE[f] ?? FARBE.default }

// ── Ergebnis-Panel ────────────────────────────────────────────────────────────
function ErgebnisPanel({ ergebnisse }) {
  if (!ergebnisse || ergebnisse.length === 0) return null
  const hauptErgebnisse = ergebnisse.filter(e => e.hervorgehoben)
  const nebenErgebnisse = ergebnisse.filter(e => !e.hervorgehoben)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Hauptergebnisse: groß */}
      {hauptErgebnisse.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(hauptErgebnisse.length, 2)}, 1fr)`, gap: '8px' }}>
          {hauptErgebnisse.map(e => {
            const f = farbe(e.farbe)
            return (
              <div key={e.id} style={{ padding: '10px 14px', borderRadius: '8px', background: f.bg, border: `1px solid ${f.border}`, textAlign: 'center' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: f.color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>{e.label}</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: f.color }}>
                  {typeof e.wert === 'number' ? (e.einheit === '€' ? fmtEur(e.wert) : e.wert.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + (e.einheit ? ' ' + e.einheit : '')) : e.wert}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {/* Nebenergebnisse: kompakt */}
      {nebenErgebnisse.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {nebenErgebnisse.map(e => (
            <div key={e.id} style={{ padding: '4px 10px', borderRadius: '6px', background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)' }}>
              {e.label}: <strong style={{ color: 'var(--text)' }}>
                {typeof e.wert === 'number' ? (e.einheit === '€' ? fmtEur(e.wert) : e.wert.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + (e.einheit ? ' ' + e.einheit : '')) : (e.wert ?? '–')}
              </strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── RAP Zeilen-Tabelle ────────────────────────────────────────────────────────
function RapZeilenTabelle({ zeilen, tpl, onChangeZeilen }) {
  const zFelder = tpl.zeilenFelder ?? []

  function updZeile(idx, id, val) {
    const next = zeilen.map((z, i) => i === idx ? { ...z, [id]: val } : z)
    onChangeZeilen(next)
  }
  function addZeile() { onChangeZeilen([...zeilen, newZeile(tpl)]) }
  function delZeile(idx) { if (zeilen.length > 1) onChangeZeilen(zeilen.filter((_, i) => i !== idx)) }

  // Berechne RAP pro Zeile für Anzeige
  function rapZeile(z) {
    const betrag = parseZ(z.betrag), tGes = parseZ(z.tageGesamt), tFolge = parseZ(z.tageFolgejahr)
    return tGes > 0 ? betrag * tFolge / tGes : 0
  }

  const inputS = { padding: '4px 6px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '11px', width: '100%', boxSizing: 'border-box' }

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', width: '28px' }}>#</th>
              {zFelder.map(f => (
                <th key={f.id} style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                  {f.label}{f.einheit ? ` (${f.einheit})` : ''}
                </th>
              ))}
              <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#d97706', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>RAP (€)</th>
              <th style={{ width: '28px', borderBottom: '1px solid var(--border)' }}></th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z, idx) => (
              <tr key={z.id ?? idx} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '4px 8px', color: 'var(--text-muted)', fontSize: '10px' }}>{idx + 1}</td>
                {zFelder.map(f => (
                  <td key={f.id} style={{ padding: '3px 6px' }}>
                    <input type={f.typ === 'text' ? 'text' : 'text'} value={z[f.id] ?? ''} onChange={e => updZeile(idx, f.id, e.target.value)}
                      placeholder={f.placeholder ?? ''} style={inputS} />
                  </td>
                ))}
                <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: '#d97706' }}>
                  {fmtEur(rapZeile(z))}
                </td>
                <td style={{ padding: '3px 4px' }}>
                  {zeilen.length > 1 && (
                    <button onClick={() => delZeile(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '12px', opacity: 0.6, padding: '2px' }}
                      onMouseEnter={e => e.currentTarget.style.opacity='1'} onMouseLeave={e => e.currentTarget.style.opacity='0.6'}>🗑</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'rgba(217,119,6,0.06)' }}>
              <td colSpan={zFelder.length + 1} style={{ padding: '5px 8px', fontWeight: 700, fontSize: '11px', color: '#d97706' }}>Gesamt</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 800, fontSize: '12px', color: '#d97706' }}>
                {fmtEur(zeilen.reduce((s, z) => s + rapZeile(z), 0))}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button onClick={addZeile} style={{ marginTop: '6px', padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(37,99,235,0.35)', background: 'rgba(37,99,235,0.07)', color: '#2563eb', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
        + Zeile hinzufügen
      </button>
    </div>
  )
}

// ── Einzelner Rechner-Editor ──────────────────────────────────────────────────
function RechnerEditor({ instanz, onSave, onDelete }) {
  const tpl = RECHNER_TEMPLATES[instanz.templateKey]
  if (!tpl) return <div style={{ padding: '20px', color: 'var(--text-muted)' }}>Vorlage nicht gefunden: {instanz.templateKey}</div>

  const [editName, setEditName] = useState(false)
  const [showBuchung, setShowBuchung] = useState(false)

  const felder  = instanz.felder ?? {}
  const buchung = instanz.buchungshinweise ?? {}
  const ergebnis = useMemo(() => {
    try { return tpl.berechnung(felder) } catch { return [] }
  }, [felder, instanz.templateKey])

  function updFelder(changes) { onSave({ ...instanz, felder: { ...felder, ...changes } }) }
  function updBuchung(changes) { onSave({ ...instanz, buchungshinweise: { ...buchung, ...changes } }) }

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }
  const labelStyle = { fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* ── Kopfzeile ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 14px', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: '24px', flexShrink: 0, marginTop: '2px' }}>{tpl.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editName ? (
            <input autoFocus value={instanz.name} onChange={e => onSave({ ...instanz, name: e.target.value })}
              onBlur={() => setEditName(false)} onKeyDown={e => e.key === 'Enter' && setEditName(false)}
              style={{ ...inputStyle, fontSize: '14px', fontWeight: 700, padding: '4px 8px', marginBottom: '4px' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', cursor: 'text' }} onClick={() => setEditName(true)}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{instanz.name}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>✏️</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '5px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', fontWeight: 600 }}>{tpl.label}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>VJ {instanz.jahr}</span>
            {instanz.blockId && <span style={{ fontSize: '10px', color: '#7c3aed', background: 'rgba(124,58,237,0.08)', padding: '0 6px', borderRadius: '5px' }}>📋 Block: {instanz.blockId}</span>}
            {instanz.punktId && <span style={{ fontSize: '10px', color: '#7c3aed', background: 'rgba(124,58,237,0.08)', padding: '0 6px', borderRadius: '5px' }}>📌 Punkt: {instanz.punktId}</span>}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '3px' }}>{tpl.beschreibung}</div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <div>
            <label style={{ ...labelStyle, marginBottom: '2px' }}>Jahr</label>
            <input type="text" value={instanz.jahr} onChange={e => onSave({ ...instanz, jahr: e.target.value })}
              style={{ width: '70px', padding: '5px 7px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '11px' }} />
          </div>
          <button onClick={onDelete} title="Berechnung löschen"
            style={{ alignSelf: 'flex-end', padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(239,68,68,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background='rgba(239,68,68,0.06)'}>🗑</button>
        </div>
      </div>

      {/* ── Eingaben ── */}
      <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>📥 Eingaben</div>
        {tpl.multiRow ? (
          <RapZeilenTabelle
            zeilen={felder.zeilen ?? []}
            tpl={tpl}
            onChangeZeilen={zeilen => updFelder({ zeilen })}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {(tpl.felder ?? []).map(f => (
              <div key={f.id} style={{ gridColumn: f.typ === 'text' && !f.einheit ? 'span 2' : 'span 1' }}>
                <label style={labelStyle}>{f.label}{f.einheit ? ` (${f.einheit})` : ''}</label>
                <input
                  type="text"
                  value={felder[f.id] ?? ''}
                  onChange={e => updFelder({ [f.id]: e.target.value })}
                  placeholder={f.placeholder ?? (f.typ === 'zahl' ? '0,00' : '')}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Ergebnisse ── */}
      {ergebnis.length > 0 && (
        <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>📊 Ergebnisse</div>
          <ErgebnisPanel ergebnisse={ergebnis} />
        </div>
      )}

      {/* ── Buchungshinweise ── */}
      <div style={{ borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <button onClick={() => setShowBuchung(b => !b)}
          style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface2)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>🔖 Buchungshinweise</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{showBuchung ? '▲' : '▼'}</span>
        </button>
        {showBuchung && (
          <div style={{ padding: '12px 14px', background: 'var(--surface)', display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '8px' }}>
            {[
              { id: 'kontoSoll',    label: 'Konto Soll',   placeholder: 'z.B. 4650' },
              { id: 'kontoHaben',   label: 'Konto Haben',  placeholder: 'z.B. 1600' },
              { id: 'buchungstext', label: 'Buchungstext', placeholder: 'Buchungstext…' },
            ].map(f => (
              <div key={f.id}>
                <label style={labelStyle}>{f.label}</label>
                <input type="text" value={buchung[f.id] ?? ''} onChange={e => updBuchung({ [f.id]: e.target.value })}
                  placeholder={f.placeholder} style={inputStyle} />
              </div>
            ))}
            <div style={{ gridColumn: 'span 3' }}>
              <label style={labelStyle}>📝 Buchungshinweis (Freitext)</label>
              <textarea value={buchung.hinweis ?? ''} onChange={e => updBuchung({ hinweis: e.target.value })}
                placeholder="Weitere Hinweise zur Verbuchung…" rows={2}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Befund ── */}
      <div style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: '10px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📋 Befund / Ergebnistext</span>
          {tpl.befundTemplate && (
            <button
              onClick={() => { try { onSave({ ...instanz, befund: tpl.befundTemplate(felder, ergebnis) }) } catch {} }}
              style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '5px', border: '1px solid rgba(37,99,235,0.4)', background: 'rgba(37,99,235,0.07)', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>
              ⚡ Auto-generieren
            </button>
          )}
        </div>
        <textarea value={instanz.befund ?? ''} onChange={e => onSave({ ...instanz, befund: e.target.value })}
          placeholder="Ergebnis-Zusammenfassung, Prüffeststellung…" rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
      </div>

    </div>
  )
}

// ── Instanz-Karte (Sidebar-Liste) ─────────────────────────────────────────────
function InstanzKarte({ instanz, active, onClick }) {
  const tpl = RECHNER_TEMPLATES[instanz.templateKey] ?? { label: instanz.templateKey, icon: '🔢' }
  const ergebnis = useMemo(() => { try { return tpl.berechnung?.(instanz.felder ?? {}) ?? [] } catch { return [] } }, [instanz.felder, instanz.templateKey])
  const hauptWert = ergebnis.find(e => e.hervorgehoben)

  // Spezial-Rendering für kfzNutzung: Fahrzeug-Tabelle
  if (instanz.templateKey === 'kfzNutzung') {
    const fahrzeuge = instanz.felder?.fahrzeuge ?? []
    const gesamt    = fahrzeuge.reduce((s, fz) => { try { return s + berechneFahrzeug(fz).jahreswert } catch { return s } }, 0)
    return (
      <div onClick={onClick} style={{
        padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px', transition: 'all 0.12s',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'rgba(37,99,235,0.07)' : 'var(--surface2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '14px', flexShrink: 0 }}>🚗</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {instanz.name}
          </span>
        </div>
        {fahrzeuge.map(fz => {
          let erg = null; try { erg = berechneFahrzeug(fz) } catch {}
          return (
            <div key={fz.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--text-muted)', padding: '1px 2px' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>
                {fz.bezeichnung || 'Fahrzeug'}
                {erg?.unterjährig && <span style={{ marginLeft: '3px', color: '#d97706', fontWeight: 700 }}>({erg.monate}M)</span>}
              </span>
              <span style={{ flexShrink: 0, textAlign: 'right' }}>
                <span style={{ color: 'var(--text-muted)' }}>{fmtEur(erg?.monatswert ?? 0)}/Mo </span>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmtEur(erg?.jahreswert ?? 0)}</span>
              </span>
            </div>
          )
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid var(--border)', fontSize: '11px', fontWeight: 700 }}>
          <span style={{ color: 'var(--text-muted)' }}>Gesamt</span>
          <span style={{ color: '#d97706' }}>{fmtEur(gesamt)}</span>
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClick} style={{
      padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px', transition: 'all 0.12s',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      background: active ? 'rgba(37,99,235,0.07)' : 'var(--surface2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
        <span style={{ fontSize: '14px', flexShrink: 0 }}>{tpl.icon}</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: active ? 'var(--accent)' : 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {instanz.name}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>VJ {instanz.jahr}</span>
        {hauptWert && (
          <span style={{ fontSize: '10px', fontWeight: 700, color: farbe(hauptWert.farbe).color }}>
            {hauptWert.einheit === '€' ? fmtEur(hauptWert.wert) : hauptWert.wert?.toLocaleString?.('de-DE') ?? '–'} {hauptWert.einheit !== '€' ? hauptWert.einheit : ''}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────
function exportRechner(client, rechner) {
  const year = client.veranlagungsjahr ?? ''
  const lines = []
  lines.push(`BERECHNUNGEN – ${client.name} – VJ ${year}`)
  lines.push(`Exportiert: ${new Date().toLocaleDateString('de-DE')}`)
  lines.push('='.repeat(70))
  lines.push('')

  if (rechner.length === 0) { lines.push('(keine Berechnungen vorhanden)') }

  rechner.forEach((inst, i) => {
    const tpl = RECHNER_TEMPLATES[inst.templateKey]
    lines.push(`${i+1}. ${tpl?.icon ?? '🔢'} ${inst.name} [${tpl?.label ?? inst.templateKey}] – VJ ${inst.jahr}`)
    lines.push('─'.repeat(50))
    // Eingaben
    if (tpl?.multiRow) {
      const zeilen = inst.felder?.zeilen ?? []
      zeilen.forEach((z, zi) => {
        const fields = (tpl.zeilenFelder ?? []).map(f => `${f.label}: ${z[f.id] ?? ''}`).join(' | ')
        lines.push(`  Zeile ${zi+1}: ${fields}`)
      })
    } else {
      (tpl?.felder ?? []).forEach(f => {
        if (inst.felder?.[f.id]) lines.push(`  ${f.label}: ${inst.felder[f.id]}${f.einheit ? ' ' + f.einheit : ''}`)
      })
    }
    // Ergebnisse
    try {
      const erg = tpl?.berechnung?.(inst.felder ?? {}) ?? []
      erg.forEach(e => {
        const val = e.einheit === '€' ? fmtEur(e.wert) : (e.wert?.toLocaleString?.('de-DE') ?? String(e.wert)) + (e.einheit ? ' ' + e.einheit : '')
        lines.push(`  → ${e.label}: ${val}${e.hervorgehoben ? ' ✓' : ''}`)
      })
    } catch {}
    // Buchungshinweise
    const bh = inst.buchungshinweise ?? {}
    if (bh.kontoSoll || bh.kontoHaben) lines.push(`  Buchung: ${bh.kontoSoll ?? '?'} / ${bh.kontoHaben ?? '?'} – ${bh.buchungstext ?? ''}`)
    // Befund
    if (inst.befund) lines.push(`  Befund: ${inst.befund}`)
    lines.push('')
  })

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `Berechnungen_${(client.mandantennummer || client.name).replace(/[^a-zA-Z0-9]/g,'_')}_${year}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Haupt-Tab ─────────────────────────────────────────────────────────────────
export default function RechnerTab({ client, onUpdate }) {
  const rechner = client.rechner ?? []
  const [selectedId, setSelectedId]     = useState(null)
  const [kfzSlideInId, setKfzSlideInId] = useState(null)   // für KFZ-SlideIn aus RechnerTab

  function saveRechner(newList) { onUpdate({ rechner: newList }) }

  function createInstanz(templateKey) {
    const inst = newInstanz(templateKey, client)
    // kfzNutzung: erstes Fahrzeug gleich mitanlegen + SlideIn öffnen
    if (templateKey === 'kfzNutzung') {
      inst.felder = { fahrzeuge: [newFahrzeug()] }
      try {
        const saved = JSON.parse(localStorage.getItem('kfz-buchungshinweise-defaults'))
        if (saved) inst.buchungshinweise = { ...inst.buchungshinweise, ...saved }
      } catch {}
      saveRechner([...rechner, inst])
      setKfzSlideInId(inst.id)
      return
    }
    saveRechner([...rechner, inst])
    setSelectedId(inst.id)
  }

  function updateInstanz(updated) {
    saveRechner(rechner.map(r => r.id === updated.id ? updated : r))
  }

  function deleteInstanz(id) {
    saveRechner(rechner.filter(r => r.id !== id))
    setSelectedId(null)
    setKfzSlideInId(null)
  }

  function handleKarteClick(inst) {
    if (inst.templateKey === 'kfzNutzung') {
      setKfzSlideInId(inst.id)
    } else {
      setSelectedId(inst.id)
    }
  }

  const selected      = rechner.find(r => r.id === selectedId) ?? null
  const kfzSlideInInst = rechner.find(r => r.id === kfzSlideInId) ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%' }}>

      {/* KFZ-Slide-in aus RechnerTab */}
      {kfzSlideInInst && (
        <KfzRechnerSlideIn
          instanz={kfzSlideInInst}
          onSave={updateInstanz}
          onClose={() => setKfzSlideInId(null)}
        />
      )}

      {/* ── Header ── */}
      <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ fontSize: '20px' }}>🔢</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Berechnungen</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{client.name} · VJ {client.veranlagungsjahr} · {rechner.length} Berechnung{rechner.length !== 1 ? 'en' : ''}</div>
          </div>
          <button onClick={() => exportRechner(client, rechner)}
            style={{ fontSize: '11px', padding: '5px 12px', borderRadius: '20px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
            📄 Exportieren
          </button>
          <button onClick={() => createInstanz('kfzNutzung')}
            style={{ fontSize: '12px', fontWeight: 700, padding: '6px 14px', borderRadius: '20px', border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer' }}>
            + Neue Berechnung
          </button>
        </div>
      </div>

      {/* ── Hauptbereich ── */}
      {rechner.length === 0 ? (
        /* Leer-Zustand */
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚗</div>
          <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>Noch keine Berechnungen</div>
          <div style={{ fontSize: '12px', marginBottom: '20px' }}>Erste Kfz-Nutzungsentnahme für diesen Mandanten anlegen.</div>
          <button onClick={() => createInstanz('kfzNutzung')}
            style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            + Erste Berechnung anlegen
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '10px', alignItems: 'flex-start' }}>
          {/* Sidebar */}
          <div style={{ padding: '10px', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', padding: '0 2px' }}>
              {rechner.length} Berechnungen
            </div>
            {rechner.map(inst => (
              <InstanzKarte key={inst.id} instanz={inst} active={selectedId === inst.id || kfzSlideInId === inst.id} onClick={() => handleKarteClick(inst)} />
            ))}
            <button onClick={() => createInstanz('kfzNutzung')}
              style={{ width: '100%', marginTop: '6px', padding: '6px', borderRadius: '7px', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}>
              + Neue Berechnung
            </button>
          </div>

          {/* Editor */}
          <div>
            {selected ? (
              <RechnerEditor
                key={selected.id}
                instanz={selected}
                onSave={updateInstanz}
                onDelete={() => deleteInstanz(selected.id)}
              />
            ) : (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>👈</div>
                <div style={{ fontSize: '13px' }}>Wählen Sie eine Berechnung aus der Liste</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
