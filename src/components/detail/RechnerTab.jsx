import { useState } from 'react'
import {
  calcKFZ1Prozent, calcKFZFahrtenbuch,
  calcVMASingle, calcFahrtkosten, calcReisekostenGesamt,
  LAENDER_LISTE, fmtEur, fmtPct,
} from '../../utils/rechnerData.js'
import {
  exportKFZPrint, exportKFZExcel,
  exportAZPrint, exportAZExcel,
  exportReisePrint, exportReiseExcel,
} from '../../utils/rechnerExport.js'
import { MODULE } from '../../utils/jaCheckliste/registry.js'

export function genId() { return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }

// ─── Kleine Hilfskomponenten ─────────────────────────────────────────────────────
export function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{hint}</div>}
    </div>
  )
}

export function FieldRow({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${children.length ?? 2}, 1fr)`, gap: '10px' }}>{children}</div>
}

export function ResultBox({ title, rows, total, totalLabel = 'Gesamt' }) {
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px', marginTop: '12px' }}>
      {title && <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '10px' }}>{title}</div>}
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0', borderBottom: '1px solid var(--border)', color: r.muted ? 'var(--text-muted)' : 'var(--text)' }}>
          <span>{r.label}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{r.value}</span>
        </div>
      ))}
      {total !== undefined && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700, marginTop: '8px', color: 'var(--accent)' }}>
          <span>{totalLabel}</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtEur(total)}</span>
        </div>
      )}
    </div>
  )
}

export function ExportButtons({ onPDF, onExcel }) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
      <button className="btn btn-ghost btn-sm" onClick={onPDF}>📄 PDF</button>
      <button className="btn btn-ghost btn-sm" onClick={onExcel}>📊 Excel</button>
    </div>
  )
}

export function SavedCard({ item, onDelete, onSelect, selected, onExportPDF, onExportExcel }) {
  return (
    <div
      onClick={() => onSelect(item.id)}
      style={{
        padding: '9px 12px', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
        background: selected ? 'var(--accent-dim)' : 'var(--surface2)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'var(--transition)',
      }}
    >
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>{item.bezeichnung || '(ohne Bezeichnung)'}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {item.ergebnis !== undefined ? fmtEur(item.ergebnis) : ''}
          {item.datum ? ` · ${item.datum.split('-').reverse().join('.')}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {onExportPDF && (
          <button className="btn-icon" onClick={e => { e.stopPropagation(); onExportPDF() }} title="Als PDF drucken" style={{ fontSize: '14px' }}>📄</button>
        )}
        {onExportExcel && (
          <button className="btn-icon" onClick={e => { e.stopPropagation(); onExportExcel() }} title="Als Excel exportieren" style={{ fontSize: '14px' }}>📊</button>
        )}
        <button
          className="btn-icon"
          onClick={e => { e.stopPropagation(); onDelete(item.id) }}
          title="Löschen"
          style={{ color: 'var(--text-muted)', marginLeft: '4px' }}
        >✕</button>
      </div>
    </div>
  )
}

// ─── KFZ Rechner ─────────────────────────────────────────────────────────────────
export function KFZRechner({ saved, onSave, onDelete, client }) {
  const empty = {
    id: null, bezeichnung: '', datum: new Date().toISOString().slice(0, 10),
    methode: '1prozent', fahrzeugtyp: 'verbrenner',
    bruttolistenpreis: '', entfernungKm: '', monate: 12, pendler: false,
    gesamtkm: '', privatkm: '', gesamtkosten: '', notiz: '',
  }
  const [form, setForm]       = useState(empty)
  const [selectedId, setSelectId] = useState(null)
  const [showForm, setShowForm]   = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function loadSaved(id) {
    const item = saved.find(s => s.id === id)
    if (!item) return
    setForm({ ...item })
    setSelectId(id)
    setShowForm(true)
  }

  function handleNew() {
    setForm(empty)
    setSelectId(null)
    setShowForm(true)
  }

  function handleSave() {
    const res = form.methode === '1prozent'
      ? calcKFZ1Prozent(form)
      : calcKFZFahrtenbuch(form)
    const ergebnis = form.methode === '1prozent' ? res.gesamt : res.privatkosten
    const entry = { ...form, id: form.id ?? genId(), ergebnis }
    onSave(entry)
    setSelectId(entry.id)
  }

  const res1pct = form.methode === '1prozent' ? calcKFZ1Prozent(form) : null
  const resFb   = form.methode === 'fahrtenbuch' ? calcKFZFahrtenbuch(form) : null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {saved.length} gespeicherte Berechnung{saved.length !== 1 ? 'en' : ''}
        </span>
        <button className="btn btn-primary btn-sm" onClick={handleNew}>+ Neue Berechnung</button>
      </div>

      {saved.map(s => (
        <SavedCard key={s.id} item={s} onDelete={onDelete} onSelect={loadSaved} selected={s.id === selectedId}
          onExportPDF={() => exportKFZPrint(s, client)}
          onExportExcel={() => exportKFZExcel(s, client)}
        />
      ))}

      {showForm && (
        <div className="section-card" style={{ marginTop: '12px' }}>
          <div className="section-card-title" style={{ marginBottom: '14px' }}>
            {form.id ? 'Berechnung bearbeiten' : 'Neue KFZ-Berechnung'}
          </div>

          <FieldRow>
            <Field label="Bezeichnung (z.B. BMW 3er)">
              <input value={form.bezeichnung} onChange={e => set('bezeichnung', e.target.value)} placeholder="Fahrzeugbezeichnung" />
            </Field>
            <Field label="Datum">
              <input type="date" value={form.datum} onChange={e => set('datum', e.target.value)} />
            </Field>
          </FieldRow>

          {/* Methode */}
          <Field label="Ermittlungsmethode">
            <div style={{ display: 'flex', gap: '8px' }}>
              {[{ v: '1prozent', l: '1%-Methode' }, { v: 'fahrtenbuch', l: 'Fahrtenbuch' }].map(o => (
                <button
                  key={o.v}
                  className={`email-template-btn${form.methode === o.v ? ' active' : ''}`}
                  onClick={() => set('methode', o.v)}
                >{o.l}</button>
              ))}
            </div>
          </Field>

          {form.methode === '1prozent' && (
            <>
              <Field label="Fahrzeugtyp">
                <select value={form.fahrzeugtyp} onChange={e => set('fahrzeugtyp', e.target.value)}>
                  <option value="verbrenner">Verbrenner – 1,0%</option>
                  <option value="hybrid_05">Plug-in Hybrid – 0,5% (≥60km Reichweite / ≤50g CO₂)</option>
                  <option value="elektro_025">Elektro – 0,25% (BLP ≤ 70.000 €)</option>
                  <option value="elektro_05">Elektro – 0,5% (BLP &gt; 70.000 €)</option>
                </select>
              </Field>

              <FieldRow>
                <Field label="Bruttolistenpreis (€)" hint="Kaufpreis inkl. MwSt., Sonderausstattung">
                  <input type="number" value={form.bruttolistenpreis} onChange={e => set('bruttolistenpreis', e.target.value)} placeholder="z.B. 45000" />
                </Field>
                <Field label="Nutzungsmonate">
                  <input type="number" min="1" max="12" value={form.monate} onChange={e => set('monate', e.target.value)} />
                </Field>
              </FieldRow>

              <Field label="">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.pendler} onChange={e => set('pendler', e.target.checked)} style={{ width: 'auto' }} />
                  <span style={{ fontSize: '13px' }}>0,03%-Regelung (Pendlerpauschale) anwenden</span>
                </label>
              </Field>

              {form.pendler && (
                <Field label="Entfernung Wohnung – Arbeitsstätte (km)">
                  <input type="number" value={form.entfernungKm} onChange={e => set('entfernungKm', e.target.value)} placeholder="z.B. 25" style={{ maxWidth: '160px' }} />
                </Field>
              )}

              {res1pct && (
                <>
                  <ResultBox
                    title="Ergebnis 1%-Methode"
                    rows={[
                      { label: `Privatanteil/Monat (${fmtPct(res1pct.satzProzent)} × BLP)`, value: fmtEur(res1pct.privatMonatlich) },
                      { label: `Privatanteil p.a. (× ${form.monate} Monate)`, value: fmtEur(res1pct.privatJaehrlich) },
                      ...(form.pendler && res1pct.pendelJaehrlich > 0 ? [
                        { label: `Pendelanteil/Monat (0,03% × ${form.entfernungKm} km)`, value: fmtEur(res1pct.pendelMonatlich) },
                        { label: `Pendelanteil p.a.`, value: fmtEur(res1pct.pendelJaehrlich) },
                      ] : []),
                    ]}
                    total={res1pct.gesamt}
                    totalLabel="Geldwerter Vorteil p.a."
                  />
                  <ExportButtons onPDF={() => exportKFZPrint(form, client)} onExcel={() => exportKFZExcel(form, client)} />
                </>
              )}
            </>
          )}

          {form.methode === 'fahrtenbuch' && (
            <>
              <FieldRow>
                <Field label="Gesamt-km (Jahresfahrleistung)">
                  <input type="number" value={form.gesamtkm} onChange={e => set('gesamtkm', e.target.value)} placeholder="z.B. 30000" />
                </Field>
                <Field label="Privat-km (inkl. Wohnung–Arbeit)">
                  <input type="number" value={form.privatkm} onChange={e => set('privatkm', e.target.value)} placeholder="z.B. 8000" />
                </Field>
              </FieldRow>
              <Field label="Gesamtkosten Fahrzeug p.a. (€)" hint="Kraftstoff, Versicherung, Steuer, Wartung, AfA, Finanzierungszinsen">
                <input type="number" value={form.gesamtkosten} onChange={e => set('gesamtkosten', e.target.value)} placeholder="z.B. 12000" />
              </Field>

              {resFb && Number(form.gesamtkm) > 0 && (
                <>
                  <ResultBox
                    title="Ergebnis Fahrtenbuch"
                    rows={[
                      { label: 'Gesamt-km', value: `${Number(form.gesamtkm).toLocaleString('de-DE')} km` },
                      { label: 'Privat-km', value: `${Number(form.privatkm).toLocaleString('de-DE')} km` },
                      { label: 'Privatquote', value: fmtPct(resFb.privatquote) },
                      { label: 'Betriebliche Quote', value: fmtPct(resFb.betriebsquote) },
                      { label: 'Betriebliche Kosten (abzugsfähig)', value: fmtEur(resFb.betriebskosten), muted: false },
                    ]}
                    total={resFb.privatkosten}
                    totalLabel="Privater Kostenanteil (geldwerter Vorteil)"
                  />
                  <ExportButtons onPDF={() => exportKFZPrint(form, client)} onExcel={() => exportKFZExcel(form, client)} />
                </>
              )}
            </>
          )}

          <Field label="Notiz">
            <input value={form.notiz} onChange={e => set('notiz', e.target.value)} placeholder="Interne Anmerkung (optional)" />
          </Field>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Abbrechen</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>💾 Speichern</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Arbeitszimmer Rechner ───────────────────────────────────────────────────────
// Rendert das Registry-Modul `arbeitszimmer` aus jaCheckliste/registry.js. Damit
// gibt es die Fachlogik nur einmal: Kostenarten, Jahres- und Tagespauschale,
// Miete/Eigentum, Konten und Buchungssätze kommen aus dem Modul, nicht aus einer
// zweiten Rechnung. Der frühere eigene Rechner (calcArbeitszimmerPauschale /
// calcArbeitszimmerKosten) ist damit abgelöst.
const AZ_MOD = MODULE.arbeitszimmer

function AZFeld({ f, wert, onChange }) {
  const gemein = { value: wert ?? '', onChange: e => onChange(f.k, e.target.value) }
  if (f.t === 'select') return (
    <select {...gemein}>{(f.opt || []).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
  )
  if (f.t === 'area') return <textarea rows={2} {...gemein} />
  if (f.t === 'date') return <input type="date" {...gemein} />
  if (f.t === 'num') return <input type="number" step="0.01" {...gemein} />
  return <input {...gemein} />
}

export function ArbeitszimmerRechner({ saved, onSave, onDelete, client }) {
  const empty = {
    id: null, bezeichnung: '', datum: new Date().toISOString().slice(0, 10),
    werte: { skr: '03', objekt: 'miete', nutzung: 'mittelpunkt', ansatz: 'auto', monate: '12' },
  }
  const [form, setForm] = useState(empty)
  const [selectedId, setSelectId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const werte = form.werte || {}
  const setW = (k, v) => setForm(f => ({ ...f, werte: { ...(f.werte || {}), [k]: v } }))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function loadSaved(id) {
    const item = saved.find(s => s.id === id)
    if (!item) return
    // Alte Einträge aus dem früheren Rechner haben kein `werte`-Objekt.
    setForm({ ...empty, ...item, werte: item.werte || { ...empty.werte } })
    setSelectId(id); setShowForm(true)
  }
  function handleNew() { setForm({ ...empty, werte: { ...empty.werte } }); setSelectId(null); setShowForm(true) }
  function handleSave() {
    const r = AZ_MOD.rechnen(werte, {})
    onSave({ ...form, id: form.id ?? genId(), ergebnis: r.total?.v ?? 0 })
    setSelectId(form.id ?? null)
  }

  const felder = typeof AZ_MOD.felder === 'function' ? AZ_MOD.felder({}, werte) : (AZ_MOD.felder || [])
  const erg = AZ_MOD.rechnen(werte, {})
  const hatEingabe = felder.some(f => f.t === 'num' && Number(werte[f.k]) > 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {saved.length} gespeicherte Berechnung{saved.length !== 1 ? 'en' : ''}
        </span>
        <button className="btn btn-primary btn-sm" onClick={handleNew}>+ Neue Berechnung</button>
      </div>

      {saved.map(s => (
        <SavedCard key={s.id} item={s} onDelete={onDelete} onSelect={loadSaved} selected={s.id === selectedId}
          onExportPDF={() => exportAZPrint(s, client)}
          onExportExcel={() => exportAZExcel(s, client)}
        />
      ))}

      {showForm && (
        <div className="section-card" style={{ marginTop: '12px' }}>
          <div className="section-card-title">Häusliches Arbeitszimmer</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Stand {AZ_MOD.stand} · Rechnet nach § 4 Abs. 5 S. 1 Nr. 6b und 6c EStG.
            Dasselbe Modul steht in der JA-Checkliste unter Betriebsausgaben.
          </div>

          <FieldRow>
            <Field label="Bezeichnung">
              <input value={form.bezeichnung} onChange={e => set('bezeichnung', e.target.value)} placeholder="z.B. Häusliches Arbeitszimmer 2025" />
            </Field>
            <Field label="Datum">
              <input type="date" value={form.datum} onChange={e => set('datum', e.target.value)} />
            </Field>
          </FieldRow>

          <div className="grid-2">
            {felder.map(f => (
              <div key={f.k} style={f.full || f.t === 'area' ? { gridColumn: '1 / -1' } : undefined}>
                <Field label={f.l}>
                  <AZFeld f={f} wert={werte[f.k] ?? f.def ?? ''} onChange={setW} />
                </Field>
              </div>
            ))}
          </div>

          {hatEingabe && (
            <>
              <ResultBox
                title="Ergebnis"
                rows={(erg.ergebnisse || []).map(e => ({ label: e.l, value: fmtEur(e.v), muted: !e.stark }))}
                total={erg.total?.v ?? 0}
                totalLabel={erg.total?.l ?? 'Abzugsfähiger Betrag'}
              />
              {(erg.buchungen || []).length > 0 && (
                <div className="section-card" style={{ marginTop: '10px' }}>
                  <div className="section-card-title">Buchungsvorschlag</div>
                  {erg.buchungen.map((b, i) => (
                    <div key={i} style={{ fontSize: '13px', display: 'flex', gap: '8px', padding: '4px 0' }}>
                      <b>{b.s}</b> {b.st} <span style={{ color: 'var(--text-muted)' }}>an</span> <b>{b.h}</b> {b.ht}
                      <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{fmtEur(b.betr)}</span>
                    </div>
                  ))}
                </div>
              )}
              {(erg.hinweise || []).length > 0 && (
                <ul style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6, paddingLeft: '18px', marginTop: '10px' }}>
                  {erg.hinweise.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              )}
              <ExportButtons onPDF={() => exportAZPrint(form, client)} onExcel={() => exportAZExcel(form, client)} />
            </>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Abbrechen</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>💾 Speichern</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Reisekosten Rechner ─────────────────────────────────────────────────────────
const ART_LABELS = {
  unter8:    'Eintägig < 8h (0 €)',
  eintaegig: 'Eintägig 8–24h / Inland (14 €)',
  volltag:   'Volltag 24h',
  anreise:   'Anreisetag (mehrtägig)',
  abreise:   'Abreisetag',
}

export function ReisekostenRechner({ saved, onSave, onDelete, client }) {
  const emptyReise = () => ({
    id: genId(), reisedatum: new Date().toISOString().slice(0, 10),
    land: 'Deutschland (Inland)', abwesenheitsart: 'eintaegig',
    km: '', sonstiges: '',
  })

  const emptyForm = {
    id: null, bezeichnung: '', reisen: [emptyReise()], notiz: '',
  }

  const [form, setForm]       = useState(emptyForm)
  const [selectedId, setSelectId] = useState(null)
  const [showForm, setShowForm]   = useState(false)

  function setTop(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function setReise(idx, k, v) {
    setForm(f => ({
      ...f,
      reisen: f.reisen.map((r, i) => i === idx ? { ...r, [k]: v } : r),
    }))
  }

  function addReise() {
    setForm(f => ({ ...f, reisen: [...f.reisen, emptyReise()] }))
  }

  function removeReise(idx) {
    setForm(f => ({ ...f, reisen: f.reisen.filter((_, i) => i !== idx) }))
  }

  function loadSaved(id) {
    const item = saved.find(s => s.id === id)
    if (!item) return
    setForm({ ...item })
    setSelectId(id)
    setShowForm(true)
  }

  function handleNew() { setForm(emptyForm); setSelectId(null); setShowForm(true) }

  function handleSave() {
    const totals = calcReisekostenGesamt(form.reisen)
    onSave({ ...form, id: form.id ?? genId(), ergebnis: totals.gesamt })
    setSelectId(form.id ?? null)
    setShowForm(false)
  }

  const totals = calcReisekostenGesamt(form.reisen)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {saved.length} gespeicherte Abrechnung{saved.length !== 1 ? 'en' : ''}
        </span>
        <button className="btn btn-primary btn-sm" onClick={handleNew}>+ Neue Abrechnung</button>
      </div>

      {saved.map(s => (
        <SavedCard key={s.id} item={s} onDelete={onDelete} onSelect={loadSaved} selected={s.id === selectedId}
          onExportPDF={() => exportReisePrint(s, client)}
          onExportExcel={() => exportReiseExcel(s, client)}
        />
      ))}

      {showForm && (
        <div className="section-card" style={{ marginTop: '12px' }}>
          <div className="section-card-title">Reisekostenabrechnung</div>

          <Field label="Bezeichnung">
            <input value={form.bezeichnung} onChange={e => setTop('bezeichnung', e.target.value)} placeholder="z.B. Dienstreise München März 2024" />
          </Field>

          {/* VMA-Hinweis */}
          <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Verpflegungsmehraufwand Inland:</strong> &lt;8h = 0 € · 8–24h = 14 € · Volltag = 28 € · An/Abreisetag = 14 €<br/>
            <strong style={{ color: 'var(--text-secondary)' }}>Ausland:</strong> BMF-Tagessatz 2024 · Volltag = 100% · An-/Abreisetag = 80% · &lt;24h eintägig = 80%<br/>
            Fahrtkosten Pkw: 0,30 €/km (Pauschale)
          </div>

          {/* Reise-Einträge */}
          {form.reisen.map((r, idx) => {
            const vma   = calcVMASingle({ land: r.land, abwesenheitsart: r.abwesenheitsart })
            const fahrt = calcFahrtkosten(r.km)
            const sonst = Number(r.sonstiges) || 0
            const zeil  = vma + fahrt + sonst
            const isAusland = r.land !== 'Deutschland (Inland)'

            return (
              <div key={r.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Reisetag {idx + 1}</span>
                  {form.reisen.length > 1 && (
                    <button className="btn-icon" onClick={() => removeReise(idx)} title="Zeile entfernen">✕</button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <Field label="Datum">
                    <input type="date" value={r.reisedatum} onChange={e => setReise(idx, 'reisedatum', e.target.value)} />
                  </Field>
                  <Field label="Reiseziel / Land">
                    <select value={r.land} onChange={e => setReise(idx, 'land', e.target.value)}>
                      {LAENDER_LISTE.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </Field>
                  <Field label="Abwesenheitsart">
                    <select value={r.abwesenheitsart} onChange={e => setReise(idx, 'abwesenheitsart', e.target.value)}>
                      {Object.entries(ART_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <Field label="km (eigener Pkw)">
                    <input type="number" value={r.km} onChange={e => setReise(idx, 'km', e.target.value)} placeholder="0" />
                  </Field>
                  <Field label="Sonstiges (€)" hint="Taxi, Bahn, Hotel…">
                    <input type="number" value={r.sonstiges} onChange={e => setReise(idx, 'sonstiges', e.target.value)} placeholder="0" />
                  </Field>
                  <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                    <div style={{ background: 'var(--surface3)', borderRadius: 'var(--radius-sm)', padding: '7px 10px', width: '100%' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                        VMA: {fmtEur(vma)}{isAusland ? ` (${r.land})` : ''} · Fahrt: {fmtEur(fahrt)}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
                        {fmtEur(zeil)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          <button className="btn btn-ghost btn-sm" onClick={addReise} style={{ marginBottom: '12px' }}>
            + Reisetag hinzufügen
          </button>

          {/* Gesamtergebnis */}
          <ResultBox
            title="Gesamtergebnis Reisekostenabrechnung"
            rows={[
              { label: 'Verpflegungsmehraufwand', value: fmtEur(totals.vma) },
              { label: `Fahrtkosten (${form.reisen.reduce((s, r) => s + (Number(r.km) || 0), 0)} km × 0,30 €)`, value: fmtEur(totals.fahrt) },
              { label: 'Sonstige Kosten', value: fmtEur(totals.sonstiges) },
            ]}
            total={totals.gesamt}
            totalLabel="Gesamterstattung"
          />
          <ExportButtons onPDF={() => exportReisePrint(form, client)} onExcel={() => exportReiseExcel(form, client)} />

          <Field label="Notiz">
            <input value={form.notiz} onChange={e => setTop('notiz', e.target.value)} placeholder="Interne Anmerkung (optional)" style={{ marginTop: '8px' }} />
          </Field>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Abbrechen</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>💾 Speichern</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Haupt-RechnerTab ────────────────────────────────────────────────────────────
const SUB_TABS = [
  { key: 'kfz',           label: '🚗 KFZ-Nutzung' },
  { key: 'arbeitszimmer', label: '🏠 Arbeitszimmer' },
  { key: 'reisekosten',   label: '✈️ Reisekosten / VMA' },
]

export default function RechnerTab({ client, onUpdateBerechnungen }) {
  const [subTab, setSubTab] = useState('kfz')

  const b = client.berechnungen ?? { kfz: [], arbeitszimmer: [], reisekosten: [] }

  function saveItem(type, item) {
    const arr = b[type] ?? []
    const exists = arr.find(x => x.id === item.id)
    const next = exists ? arr.map(x => x.id === item.id ? item : x) : [...arr, item]
    onUpdateBerechnungen({ ...b, [type]: next })
  }

  function deleteItem(type, id) {
    onUpdateBerechnungen({ ...b, [type]: (b[type] ?? []).filter(x => x.id !== id) })
  }

  return (
    <div className="tab-content">
      {/* Sub-tab navigation */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            className={`email-template-btn${subTab === t.key ? ' active' : ''}`}
            onClick={() => setSubTab(t.key)}
            style={{ fontSize: '13px', padding: '7px 16px' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Disclaimer */}
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: '14px', lineHeight: 1.6 }}>
        ℹ️ Berechnungen basieren auf den Werten für <strong style={{ color: 'var(--text-secondary)' }}>VZ {client.veranlagungsjahr}</strong>.
        BMF-Pauschalen (Ausland, AfA-Sätze) bitte jährlich anhand aktueller BMF-Schreiben prüfen.
        Alle Ergebnisse ohne Gewähr.
      </div>

      {subTab === 'kfz' && (
        <KFZRechner
          saved={b.kfz ?? []}
          onSave={item => saveItem('kfz', item)}
          onDelete={id => deleteItem('kfz', id)}
          client={client}
        />
      )}
      {subTab === 'arbeitszimmer' && (
        <ArbeitszimmerRechner
          saved={b.arbeitszimmer ?? []}
          onSave={item => saveItem('arbeitszimmer', item)}
          onDelete={id => deleteItem('arbeitszimmer', id)}
          client={client}
        />
      )}
      {subTab === 'reisekosten' && (
        <ReisekostenRechner
          saved={b.reisekosten ?? []}
          onSave={item => saveItem('reisekosten', item)}
          onDelete={id => deleteItem('reisekosten', id)}
          client={client}
        />
      )}
    </div>
  )
}
