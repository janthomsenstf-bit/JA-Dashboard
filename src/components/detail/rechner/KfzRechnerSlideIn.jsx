import { useState, useMemo } from 'react'
import { newFahrzeug, berechneFahrzeug, getBlpRate, fmtEur, parseZ } from '../../../utils/rechnerConfig.js'

// ── Farb-Helfer ───────────────────────────────────────────────────────────────
const WARN_STYLE = {
  warn:   { bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.3)',  color: '#d97706' },
  fehler: { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.3)', color: '#dc2626' },
  info:   { bg: 'rgba(37,99,235,0.06)', border: 'rgba(37,99,235,0.2)', color: '#2563eb' },
}

// ── Eingabe-Helfer ────────────────────────────────────────────────────────────
function Inp({ label, value, onChange, einheit, placeholder, type = 'text', half, span2 }) {
  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '6px 9px',
    borderRadius: '6px', border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text)', fontSize: '12px',
  }
  return (
    <div style={{ gridColumn: span2 ? 'span 2' : half ? 'span 1' : 'span 1' }}>
      {label && <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>{label}{einheit ? ` (${einheit})` : ''}</label>}
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? (einheit ? '0' : '')} style={inputStyle} />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid var(--border)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function RadioGroup({ value, onChange, options, disabled }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => !disabled && onChange(opt.value)} disabled={disabled}
          style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: value === opt.value ? 700 : 400,
            cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.12s',
            border: `1px solid ${value === opt.value ? 'var(--accent)' : 'var(--border)'}`,
            background: value === opt.value ? 'rgba(37,99,235,0.1)' : 'transparent',
            color: value === opt.value ? 'var(--accent)' : 'var(--text-muted)',
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Fahrzeug-Formular ─────────────────────────────────────────────────────────
function KfzFahrzeugForm({ fz, onSave }) {
  function upd(changes) { onSave({ ...fz, ...changes }) }

  const ergebnis = useMemo(() => {
    try { return berechneFahrzeug(fz) } catch { return null }
  }, [fz])

  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }

  const showPhevFelder = fz.fahrzeugArt === 'phev'
  const showBevPhev    = fz.fahrzeugArt === 'bev' || fz.fahrzeugArt === 'phev'
  const showUst        = fz.methode === '1pct' && fz.nutzerTyp === 'unternehmer'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

      {/* ── Bezeichnung + Methode ── */}
      <Section title="Fahrzeug & Methode">
        <div style={{ ...grid2, marginBottom: '10px' }}>
          <Inp label="Bezeichnung" value={fz.bezeichnung} onChange={v => upd({ bezeichnung: v })} placeholder="z.B. BMW 5er" />
          {/* Nutzungsmonate – kompakt direkt daneben */}
          <div>
            <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
              Nutzungsmonate im Jahr <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(1–12)</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="number" min="1" max="12"
                value={fz.nutzungsMonate ?? '12'}
                onChange={e => {
                  const v = Math.min(Math.max(parseInt(e.target.value) || 1, 1), 12)
                  upd({ nutzungsMonate: String(v) })
                }}
                style={{ width: '60px', padding: '6px 9px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Monate</span>
              {(parseInt(fz.nutzungsMonate) || 12) < 12 && (
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'rgba(217,119,6,0.1)', color: '#d97706', border: '1px solid rgba(217,119,6,0.3)' }}>
                  unterjährig
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Berechnungsmethode</div>
          <RadioGroup value={fz.methode} onChange={v => upd({ methode: v })} options={[
            { value: '1pct',        label: '1%-Methode (Listenpreismethode)' },
            { value: 'fahrtenbuch', label: 'Fahrtenbuch' },
          ]} />
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Nutzertyp</div>
          <RadioGroup value={fz.nutzerTyp} onChange={v => upd({ nutzerTyp: v })} options={[
            { value: 'unternehmer',  label: 'Unternehmer (Nutzungsentnahme)' },
            { value: 'arbeitnehmer', label: 'Arbeitnehmer (Geldwerter Vorteil)' },
          ]} />
        </div>
      </Section>

      {/* ── Fahrzeugart ── */}
      <Section title="Fahrzeugart & technische Daten">
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Fahrzeugart</div>
          <RadioGroup value={fz.fahrzeugArt} onChange={v => upd({ fahrzeugArt: v })} options={[
            { value: 'verbrenner',      label: 'Verbrenner (1,0 %)' },
            { value: 'bev',             label: 'Elektro BEV (0,25/0,5 %)' },
            { value: 'phev',            label: 'Plug-in-Hybrid PHEV (0,5 %)' },
            { value: 'brennstoffzelle', label: 'Brennstoffzelle (0,25 %)' },
          ]} />
        </div>
        {/* Rate-Badge: immer sichtbar, unabhängig von BLP */}
        {fz.methode === '1pct' && ergebnis && (
          <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: 'rgba(217,119,6,0.1)', color: '#d97706', border: '1px solid rgba(217,119,6,0.3)' }}>
              Ansatz: {ergebnis.rateLabel}
            </span>
            {fz.fahrzeugArt === 'phev' && !parseZ(fz.co2GKm) && !parseZ(fz.elektrischeReichweite) && (
              <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600 }}>⚠️ CO₂/Reichweite fehlen → 1,0 % (ungünstigster Fall)</span>
            )}
            {fz.fahrzeugArt === 'phev' && ergebnis.rate === 0.005 && (
              <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>✓ Bedingungen erfüllt: 0,5 %</span>
            )}
          </div>
        )}
        {showBevPhev && (
          <div style={{ ...grid2, marginTop: '8px' }}>
            <Inp label="Erstzulassung (Jahr)" value={fz.erstzulassungJahr} onChange={v => upd({ erstzulassungJahr: v })} placeholder="2024" einheit="Jahr" />
            {showPhevFelder && <>
              <Inp label="CO₂-Wert WLTP" value={fz.co2GKm} onChange={v => upd({ co2GKm: v })} einheit="g/km" placeholder="z.B. 22" />
              <Inp label="El. Reichweite (EAER city)" value={fz.elektrischeReichweite} onChange={v => upd({ elektrischeReichweite: v })} einheit="km" placeholder="z.B. 68" />
            </>}
          </div>
        )}
      </Section>

      {/* ── 1%-Methode Felder ── */}
      {fz.methode === '1pct' && (
        <Section title="1%-Methode – Eingaben">
          <div style={{ ...grid2, marginBottom: '10px' }}>
            <Inp label="Bruttolistenpreis (BLP inkl. MwSt.)" value={fz.bruttolistenpreis} onChange={v => upd({ bruttolistenpreis: v })} einheit="€" placeholder="z.B. 48500" />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              {ergebnis && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '6px 8px', background: 'var(--surface2)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  BLP gerundet: <strong style={{ color: 'var(--text)' }}>{fmtEur(ergebnis.blpGer ?? 0)}</strong>
                  {ergebnis.rate != null && <> · Satz: <strong style={{ color: '#d97706' }}>{ergebnis.rateLabel}</strong></>}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Fahrten Wohnung – Arbeitsstätte (Pendler)</div>
            <div style={{ ...grid2 }}>
              <Inp label="Entfernung (einfach)" value={fz.pendlerKm} onChange={v => upd({ pendlerKm: v })} einheit="km" placeholder="0" />
              <div />
            </div>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Pendler-Methode</div>
            <RadioGroup value={fz.pendlerMethode} onChange={v => upd({ pendlerMethode: v })} options={[
              { value: 'pauschale',         label: '0,03%-Monatspauschale' },
              { value: 'einzelbewertung',   label: '0,002%-Einzelbewertung' },
            ]} />
          </div>
          {fz.pendlerMethode === 'einzelbewertung' && (
            <div style={grid2}>
              <Inp label="Tatsächliche Fahrten/Monat (max. 15)" value={fz.einzelbewertungTageProMonat} onChange={v => upd({ einzelbewertungTageProMonat: v })} einheit="Tage" placeholder="10" />
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', alignSelf: 'center', marginTop: '16px', lineHeight: 1.4 }}>
                Formel: 0,002 % × BLP × km × Tage/Jahr (max. 180/Jahr)
              </div>
            </div>
          )}
          {showUst && (
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id={`ust_${fz.id}`} checked={!!fz.ustPflichtig} onChange={e => upd({ ustPflichtig: e.target.checked })}
                style={{ width: '15px', height: '15px', accentColor: 'var(--accent)', cursor: 'pointer' }} />
              <label htmlFor={`ust_${fz.id}`} style={{ fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Vorsteuerabzugsberechtigt (→ USt-Anteil auf Privatnutzung)
              </label>
            </div>
          )}
        </Section>
      )}

      {/* ── Fahrtenbuch Felder ── */}
      {fz.methode === 'fahrtenbuch' && (
        <Section title="Fahrtenbuch – Jahreskosten">
          <div style={grid2}>
            <Inp label="AfA (Jahres-Abschreibung)" value={fz.afa} onChange={v => upd({ afa: v })} einheit="€" />
            <Inp label="Leasingrate (alternativ zu AfA)" value={fz.leasing} onChange={v => upd({ leasing: v })} einheit="€" />
            <Inp label="Kraftstoff / Energie" value={fz.kraftstoff} onChange={v => upd({ kraftstoff: v })} einheit="€" />
            <Inp label="Versicherung (gesamt)" value={fz.versicherung} onChange={v => upd({ versicherung: v })} einheit="€" />
            <Inp label="KFZ-Steuer" value={fz.kfzSteuer} onChange={v => upd({ kfzSteuer: v })} einheit="€" />
            <Inp label="Reparaturen / Wartung" value={fz.reparaturen} onChange={v => upd({ reparaturen: v })} einheit="€" />
            <Inp label="Sonstiges (Garage, Reifen…)" value={fz.sonstiges} onChange={v => upd({ sonstiges: v })} einheit="€" />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              {ergebnis && (
                <div style={{ fontSize: '11px', padding: '6px 8px', background: 'rgba(37,99,235,0.05)', borderRadius: '6px', border: '1px solid rgba(37,99,235,0.15)' }}>
                  Gesamtkosten: <strong style={{ color: 'var(--accent)' }}>{fmtEur(ergebnis.gesamtkosten ?? 0)}</strong>
                </div>
              )}
            </div>
          </div>
          {showBevPhev && (
            <div style={{ marginTop: '6px', fontSize: '10px', color: '#2563eb', background: 'rgba(37,99,235,0.05)', borderRadius: '6px', padding: '5px 8px', border: '1px solid rgba(37,99,235,0.15)' }}>
              ℹ️ AfA + Leasing werden für {fz.fahrzeugArt === 'bev' ? 'BEV' : 'PHEV'} anteilig ({fz.fahrzeugArt === 'bev' ? '25' : '50'} %) angesetzt.
            </div>
          )}
          <div style={{ ...grid2, marginTop: '10px' }}>
            <Inp label="Gesamt-km (Jahr)" value={fz.gesamtKm} onChange={v => upd({ gesamtKm: v })} einheit="km" />
            <Inp label="Privat-km" value={fz.privatKm} onChange={v => upd({ privatKm: v })} einheit="km" />
            <Inp label="Pendler-km (Wohnung–Arbeit, gesamt/Jahr)" value={fz.pendlerKmFb} onChange={v => upd({ pendlerKmFb: v })} einheit="km" />
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              {ergebnis && parseZ(fz.gesamtKm) > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '6px 8px', background: 'var(--surface2)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  Privatanteil: <strong style={{ color: '#d97706' }}>{ergebnis.privatAnteilPct?.toFixed(1)} %</strong>
                  {ergebnis.pendlerAnteilPct > 0 && <> · Pendler: <strong>{ergebnis.pendlerAnteilPct?.toFixed(1)} %</strong></>}
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ── Warnungen ── */}
      {ergebnis?.warnings?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
          {ergebnis.warnings.map((w, i) => {
            const ws = WARN_STYLE[w.typ] ?? WARN_STYLE.info
            return (
              <div key={i} style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '6px', border: `1px solid ${ws.border}`, background: ws.bg, color: ws.color }}>
                {w.typ === 'fehler' ? '🔴' : w.typ === 'warn' ? '⚠️' : 'ℹ️'} {w.text}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Ergebnisse ── */}
      {ergebnis && (
        <Section title="Ergebnisse">
          {fz.methode === '1pct' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* Monatswert-Aufschlüsselung */}
              <ErgebnisZeile label="Privatnutzung je Monat (1%-Wert)" wert={ergebnis.privatnutzungMonat} />
              {(ergebnis.pendlerMonat ?? 0) > 0 && (
                <ErgebnisZeile label={`Pendlerzuschlag je Monat (${fz.pendlerMethode === 'einzelbewertung' ? '0,002%-Einzelbewertung' : '0,03%-Pauschale'})`} wert={ergebnis.pendlerMonat} />
              )}
              {/* Monatssumme hervorgehoben */}
              <ErgebnisZeile label="Nutzungswert je Monat (gesamt)" wert={ergebnis.monatswert} hervorgehoben />
              {/* Trennlinie */}
              <div style={{ height: '1px', background: 'var(--border)', margin: '2px 0' }} />
              {/* Jahreswert = Monat × Nutzungsmonate */}
              <ErgebnisZeile
                label={ergebnis.unterjährig
                  ? `Jahreswert (${ergebnis.monate} Monate × Monatswert)`
                  : 'Jahreswert (12 Monate)'}
                wert={ergebnis.jahreswert}
                hervorgehoben
                gross
              />
              {(ergebnis.ustBetrag ?? 0) > 0 && (
                <ErgebnisZeile label="USt-Anteil (80 % × 19 %)" wert={ergebnis.ustBetrag} />
              )}
              {fz.nutzerTyp === 'arbeitnehmer' && parseZ(fz.pendlerKm) > 0 && (
                <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  ℹ️ Entfernungspauschale (AN-Abzug): 0,30 €/km × {fz.pendlerKm} km = {fmtEur(parseZ(fz.pendlerKm) * 0.30)}/Fahrt (separat geltend machen)
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <ErgebnisZeile label="Gesamtkosten (für Nutzungszeitraum)" wert={ergebnis.gesamtkosten} />
              <ErgebnisZeile label={`Nutzungswert privat (${ergebnis.privatAnteilPct?.toFixed(1)} %)`} wert={ergebnis.nutzungswertPrivat} hervorgehoben />
              {(ergebnis.nutzungswertPendler ?? 0) > 0 && (
                <ErgebnisZeile label={`Nutzungswert Pendler (${ergebnis.pendlerAnteilPct?.toFixed(1)} %)`} wert={ergebnis.nutzungswertPendler} />
              )}
              {/* Trennlinie */}
              <div style={{ height: '1px', background: 'var(--border)', margin: '2px 0' }} />
              <ErgebnisZeile label={`Nutzungswert je Monat (÷ ${ergebnis.monate})`} wert={ergebnis.monatswert} hervorgehoben />
              <ErgebnisZeile
                label={ergebnis.unterjährig
                  ? `Jahreswert gesamt (${ergebnis.monate} Monate)`
                  : 'Jahreswert gesamt'}
                wert={ergebnis.jahreswert}
                hervorgehoben
                gross
              />
            </div>
          )}
        </Section>
      )}
    </div>
  )
}

function ErgebnisZeile({ label, wert, hervorgehoben, gross }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: gross ? '8px 12px' : '5px 10px',
      borderRadius: '6px',
      background: gross ? 'rgba(217,119,6,0.08)' : hervorgehoben ? 'rgba(37,99,235,0.05)' : 'var(--surface2)',
      border: gross ? '1px solid rgba(217,119,6,0.3)' : hervorgehoben ? '1px solid rgba(37,99,235,0.15)' : '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: gross ? '16px' : '13px', fontWeight: gross ? 800 : 700, color: gross ? '#d97706' : hervorgehoben ? 'var(--accent)' : 'var(--text)' }}>
        {fmtEur(wert ?? 0)}
      </span>
    </div>
  )
}

// ── Fahrzeug-Tab-Leiste ───────────────────────────────────────────────────────
function FahrzeugTabs({ fahrzeuge, aktivId, onSelect, onAdd, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', padding: '10px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
      {fahrzeuge.map(fz => {
        let ergebnis = null
        try { ergebnis = berechneFahrzeug(fz) } catch {}
        const aktiv = aktivId === fz.id
        return (
          <div key={fz.id} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <button onClick={() => onSelect(fz.id)}
              style={{
                padding: '4px 12px', borderRadius: '6px 0 0 6px', fontSize: '11px', fontWeight: aktiv ? 700 : 400,
                cursor: 'pointer', transition: 'all 0.12s',
                border: `1px solid ${aktiv ? 'var(--accent)' : 'var(--border)'}`,
                borderRight: 'none',
                background: aktiv ? 'rgba(37,99,235,0.1)' : 'var(--surface)',
                color: aktiv ? 'var(--accent)' : 'var(--text)',
              }}>
              {fz.bezeichnung || 'Fahrzeug'}
              {ergebnis && (
                <span style={{ marginLeft: '6px', fontSize: '10px', color: aktiv ? 'var(--accent)' : '#d97706', fontWeight: 700 }}>
                  {fmtEur(ergebnis.monatswert)}/Mo · {fmtEur(ergebnis.jahreswert)}/Jahr
                  {ergebnis.unterjährig && <span style={{ marginLeft: '3px', opacity: 0.7 }}>({ergebnis.monate}M)</span>}
                </span>
              )}
            </button>
            <button onClick={() => onDelete(fz.id)} title="Fahrzeug löschen"
              style={{
                padding: '4px 6px', borderRadius: '0 6px 6px 0', fontSize: '10px',
                cursor: 'pointer', border: `1px solid ${aktiv ? 'var(--accent)' : 'var(--border)'}`,
                background: aktiv ? 'rgba(37,99,235,0.1)' : 'var(--surface)',
                color: fahrzeuge.length <= 1 ? 'var(--border)' : '#ef4444',
              }}
              disabled={fahrzeuge.length <= 1}>
              ✕
            </button>
          </div>
        )
      })}
      <button onClick={onAdd}
        style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
          border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
        + Fahrzeug
      </button>
    </div>
  )
}

// ── Gesamt-Zusammenfassung ────────────────────────────────────────────────────
function GesamtSummary({ fahrzeuge }) {
  const rows = useMemo(() => {
    return fahrzeuge.map(fz => {
      let ergebnis = null
      try { ergebnis = berechneFahrzeug(fz) } catch {}
      return { fz, ergebnis }
    })
  }, [fahrzeuge])

  const gesamt     = rows.reduce((s, r) => s + (r.ergebnis?.jahreswert ?? 0), 0)
  const gesamtMonat = rows.reduce((s, r) => s + (r.ergebnis?.monatswert ?? 0), 0)
  const gesamtUst  = rows.reduce((s, r) => s + (r.ergebnis?.ustBetrag ?? 0), 0)

  if (fahrzeuge.length === 0) return null

  return (
    <div style={{ borderTop: '2px solid var(--border)', padding: '12px 16px', background: 'var(--surface2)' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Gesamt alle Fahrzeuge</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
        {rows.map(({ fz, ergebnis }) => (
          <div key={fz.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', padding: '3px 0' }}>
            <span>
              {fz.bezeichnung || 'Fahrzeug'}
              {ergebnis?.unterjährig && <span style={{ marginLeft: '4px', fontSize: '10px', fontWeight: 700, color: '#d97706' }}>({ergebnis.monate}M)</span>}
              <span style={{ marginLeft: '4px', opacity: 0.6 }}>({ergebnis?.methode === '1pct' ? `1% · ${ergebnis?.rateLabel}` : 'Fahrtenbuch'})</span>
            </span>
            <span style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>{fmtEur(ergebnis?.monatswert ?? 0)}/Mo</span>
              <span style={{ fontWeight: 700, color: 'var(--text)', minWidth: '80px', textAlign: 'right' }}>{fmtEur(ergebnis?.jahreswert ?? 0)}/Jahr</span>
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
        <div style={{ padding: '8px 12px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ø Monatswert</div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>{fmtEur(gesamtMonat)}</div>
        </div>
        <div style={{ padding: '8px 12px', background: 'rgba(217,119,6,0.08)', borderRadius: '8px', border: '1px solid rgba(217,119,6,0.3)' }}>
          <div style={{ fontSize: '10px', color: '#d97706', marginBottom: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Jahreswert gesamt</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#d97706' }}>{fmtEur(gesamt)}</div>
        </div>
      </div>
      {gesamtUst > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', padding: '4px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>USt-Anteil gesamt</span>
          <span style={{ fontWeight: 600 }}>{fmtEur(gesamtUst)}</span>
        </div>
      )}
    </div>
  )
}

// ── Hauptkomponente: KfzRechnerSlideIn ───────────────────────────────────────
export default function KfzRechnerSlideIn({ instanz, onSave, onClose, onBefundUebernehmen }) {
  const fahrzeuge = instanz?.felder?.fahrzeuge ?? []
  const [aktivId, setAktivId] = useState(() => fahrzeuge[0]?.id ?? null)
  const [showBuchung, setShowBuchung] = useState(false)

  function saveFelder(changes) {
    onSave({ ...instanz, felder: { ...instanz.felder, ...changes } })
  }

  function saveFahrzeug(updated) {
    const next = fahrzeuge.map(fz => fz.id === updated.id ? updated : fz)
    saveFelder({ fahrzeuge: next })
  }

  function addFahrzeug() {
    const fz = newFahrzeug()
    saveFelder({ fahrzeuge: [...fahrzeuge, fz] })
    setAktivId(fz.id)
  }

  function deleteFahrzeug(id) {
    if (fahrzeuge.length <= 1) return
    const next = fahrzeuge.filter(fz => fz.id !== id)
    saveFelder({ fahrzeuge: next })
    if (aktivId === id) setAktivId(next[0]?.id ?? null)
  }

  const aktivFz    = fahrzeuge.find(fz => fz.id === aktivId) ?? fahrzeuge[0] ?? null
  const buchung    = instanz.buchungshinweise ?? {}
  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '6px 9px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }
  const labelStyle = { fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }

  function updBuchung(changes) {
    const updated = { ...buchung, ...changes }
    onSave({ ...instanz, buchungshinweise: updated })
    try {
      localStorage.setItem('kfz-buchungshinweise-defaults',
        JSON.stringify({ kontoSoll: updated.kontoSoll ?? '', kontoHaben: updated.kontoHaben ?? '', buchungstext: updated.buchungstext ?? '' }))
    } catch {}
  }

  const tpl = { label: 'Kfz-Nutzungsentnahme', befundTemplate: null }

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 900 }} />

      {/* Slide-in Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '580px', maxWidth: '95vw',
        background: 'var(--surface)', zIndex: 901,
        boxShadow: '-4px 0 24px rgba(15,23,42,0.15)',
        display: 'flex', flexDirection: 'column', overflowY: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '14px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                <span style={{ fontSize: '18px' }}>🚗</span>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>{instanz.name}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Kfz-Nutzungsentnahme · VJ {instanz.jahr} · {fahrzeuge.length} Fahrzeug{fahrzeuge.length !== 1 ? 'e' : ''}
              </div>
            </div>
            <button onClick={onClose}
              style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', flexShrink: 0 }}>
              ✕ Schließen
            </button>
          </div>
        </div>

        {/* ── Fahrzeug-Tabs ── */}
        <FahrzeugTabs
          fahrzeuge={fahrzeuge}
          aktivId={aktivFz?.id ?? null}
          onSelect={setAktivId}
          onAdd={addFahrzeug}
          onDelete={deleteFahrzeug}
        />

        {/* ── Scrollbarer Inhalt ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

          {fahrzeuge.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚗</div>
              <div style={{ fontSize: '13px', marginBottom: '14px' }}>Noch kein Fahrzeug angelegt</div>
              <button onClick={addFahrzeug}
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                + Erstes Fahrzeug anlegen
              </button>
            </div>
          ) : aktivFz ? (
            <KfzFahrzeugForm key={aktivFz.id} fz={aktivFz} onSave={saveFahrzeug} />
          ) : null}

          {/* ── Buchungshinweise ── */}
          {fahrzeuge.length > 0 && (
            <div style={{ borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden', marginTop: '8px', marginBottom: '14px' }}>
              <button onClick={() => setShowBuchung(b => !b)}
                style={{ width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface2)', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>🔖 Buchungshinweise</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{showBuchung ? '▲' : '▼'}</span>
              </button>
              {showBuchung && (
                <div style={{ padding: '10px 12px', background: 'var(--surface)', display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '8px' }}>
                  {[
                    { id: 'kontoSoll',    label: 'Konto Soll',   placeholder: '4670' },
                    { id: 'kontoHaben',   label: 'Konto Haben',  placeholder: '8920' },
                    { id: 'buchungstext', label: 'Buchungstext', placeholder: 'Kfz-Nutzungsentnahme' },
                  ].map(f => (
                    <div key={f.id}>
                      <label style={labelStyle}>{f.label}</label>
                      <input type="text" value={buchung[f.id] ?? ''} onChange={e => updBuchung({ [f.id]: e.target.value })}
                        placeholder={f.placeholder} style={inputStyle} />
                    </div>
                  ))}
                  <div style={{ gridColumn: 'span 3' }}>
                    <label style={labelStyle}>Weitere Hinweise (Freitext)</label>
                    <textarea value={buchung.hinweis ?? ''} onChange={e => updBuchung({ hinweis: e.target.value })}
                      placeholder="Weitere Hinweise zur Verbuchung…" rows={2}
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Befund ── */}
          {fahrzeuge.length > 0 && (
            <div style={{ padding: '12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>📋 Befund / Prüffeststellung</span>
                <button onClick={() => {
                  try {
                    const tplDef = { befundTemplate: (f, r) => {
                      const fzList = f.fahrzeuge ?? []
                      const gesamt = fzList.reduce((s, fz) => { try { return s + berechneFahrzeug(fz).jahreswert } catch { return s } }, 0)
                      const lines = [`Kfz-Nutzungsentnahme (${fzList.length} Fahrzeug${fzList.length !== 1 ? 'e' : ''}):`, '']
                      fzList.forEach(fz => {
                        try {
                          const res = berechneFahrzeug(fz)
                          const mLabel = res.methode === '1pct' ? `1%-Methode (${res.rateLabel})` : 'Fahrtenbuch'
                          lines.push(`  · ${fz.bezeichnung || 'Fahrzeug'}: ${fmtEur(res.jahreswert)} p.a. (${mLabel})`)
                          if (res.ustBetrag > 0) lines.push(`    USt-Anteil: ${fmtEur(res.ustBetrag)}`)
                        } catch {}
                      })
                      lines.push('', `Nutzungsentnahme gesamt: ${fmtEur(gesamt)} p.a.`)
                      return lines.join('\n')
                    }}
                    onSave({ ...instanz, befund: tplDef.befundTemplate(instanz.felder ?? {}) })
                  } catch {}
                }}
                  style={{ fontSize: '10px', padding: '3px 10px', borderRadius: '5px', border: '1px solid rgba(37,99,235,0.4)', background: 'rgba(37,99,235,0.07)', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>
                  ⚡ Auto-generieren
                </button>
              </div>
              <textarea value={instanz.befund ?? ''} onChange={e => onSave({ ...instanz, befund: e.target.value })}
                placeholder="Ergebnis-Zusammenfassung, Prüffeststellung…" rows={4}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              {onBefundUebernehmen && instanz.befund && (
                <button onClick={() => onBefundUebernehmen(instanz.befund)}
                  style={{ marginTop: '8px', padding: '5px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                    border: '1px solid rgba(22,163,74,0.4)', background: 'rgba(22,163,74,0.07)', color: '#16a34a' }}>
                  ↩ In Prüfpunkt-Notiz übernehmen
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Gesamt-Footer ── */}
        <GesamtSummary fahrzeuge={fahrzeuge} />
      </div>
    </>
  )
}
