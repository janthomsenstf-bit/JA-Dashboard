/**
 * DauerrechnungenBlock – wiederkehrende Rechnungen pro Mandant.
 *
 * Stufe A der Dauerrechnungen: Anlegen/Bearbeiten/Löschen am Mandanten.
 * Rein additiv in `client.dauerrechnungen[]`. KEIN Versand hier – die gebündelte
 * Erzeugung + Versand fälliger Dauerrechnungen erfolgt in „Übersichten → Honorare".
 *
 * Datensicherheit: schreibt ausschließlich das Feld `dauerrechnungen`; bestehende
 * Mandantendaten werden nie berührt/überschrieben.
 */
import { useState } from 'react'

const ACCENT = '#7c3aed'

const inputBase = {
  width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px',
  background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box',
}

export const INTERVALLE = {
  monatlich:     { label: 'monatlich',     short: '/Monat' },
  quartalsweise: { label: 'quartalsweise', short: '/Quartal' },
  jaehrlich:     { label: 'jährlich',      short: '/Jahr' },
}

const UST_SAETZE = [19, 7, 0]

function todayISO() { return new Date().toISOString().slice(0, 10) }
function fmtEuro(v) { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(v) || 0) }

function mkPos(preset) {
  return {
    id:       'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name:     preset?.name ?? '',
    quantity: 1,
    price:    preset?.price != null ? String(preset.price) : '',
    taxRate:  preset?.taxRate ?? 19,
  }
}

function mkDauerrechnung() {
  return {
    id:          'dr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    bezeichnung: '',
    positionen:  [mkPos()],
    intervall:   'monatlich',
    startDatum:  todayISO(),
    aktiv:       true,
    letzterVersandPeriode: null,   // z.B. '2026-08' / '2026-Q3' / '2026'
    erstelltAm:  new Date().toISOString(),
  }
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: '10px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
      {children}
    </div>
  )
}

export function summeBrutto(dr) {
  return (dr.positionen ?? []).reduce((s, p) => {
    const net = (Number(p.quantity) || 0) * (Number(String(p.price).replace(',', '.')) || 0)
    return s + net + net * ((Number(p.taxRate) || 0) / 100)
  }, 0)
}

// ── Formular ────────────────────────────────────────────────────────────────
function DauerrechnungForm({ initial, isNew, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({ ...initial }))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setPos = (id, k, v) => setForm(f => ({ ...f, positionen: f.positionen.map(p => p.id === id ? { ...p, [k]: v } : p) }))
  const addPos = () => setForm(f => ({ ...f, positionen: [...f.positionen, mkPos()] }))
  const delPos = (id) => setForm(f => ({ ...f, positionen: f.positionen.length > 1 ? f.positionen.filter(p => p.id !== id) : f.positionen }))

  const brutto = summeBrutto(form)
  const canSave = form.bezeichnung.trim() && form.positionen.some(p => String(p.name).trim() && (Number(String(p.price).replace(',', '.')) || 0) > 0)

  function handleSave() {
    if (!canSave) return
    onSave({
      ...form,
      bezeichnung: form.bezeichnung.trim(),
      positionen: form.positionen
        .map(p => ({ ...p, name: String(p.name).trim(), quantity: Number(p.quantity) || 1, price: Number(String(p.price).replace(',', '.')) || 0, taxRate: Number(p.taxRate) || 0 }))
        .filter(p => p.name && p.price > 0),
    })
  }

  return (
    <div style={{ border: `2px solid ${ACCENT}44`, borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ background: ACCENT, color: '#fff', padding: '8px 14px', fontSize: '12px', fontWeight: 700 }}>
        {isNew ? '+ Neue Dauerrechnung' : '✏️ Dauerrechnung bearbeiten'}
      </div>
      <div style={{ padding: '14px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 150px', gap: '10px' }}>
          <div>
            <FieldLabel>Bezeichnung *</FieldLabel>
            <input value={form.bezeichnung} onChange={e => set('bezeichnung', e.target.value)} placeholder="z. B. Miete Geschäftsadresse" style={inputBase} />
          </div>
          <div>
            <FieldLabel>Intervall *</FieldLabel>
            <select value={form.intervall} onChange={e => set('intervall', e.target.value)} style={inputBase}>
              {Object.entries(INTERVALLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Startdatum</FieldLabel>
            <input type="date" value={form.startDatum} onChange={e => set('startDatum', e.target.value)} style={inputBase} />
          </div>
        </div>

        {/* Positionen */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {form.positionen.map((p, idx) => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px 90px auto', gap: '8px', alignItems: 'end' }}>
              <div>
                {idx === 0 && <FieldLabel>Bezeichnung</FieldLabel>}
                <input value={p.name} onChange={e => setPos(p.id, 'name', e.target.value)} placeholder="z. B. Monatsmiete" style={inputBase} />
              </div>
              <div>
                {idx === 0 && <FieldLabel>Menge</FieldLabel>}
                <input type="number" min="0" step="0.01" value={p.quantity} onChange={e => setPos(p.id, 'quantity', e.target.value)} style={inputBase} />
              </div>
              <div>
                {idx === 0 && <FieldLabel>Einzelpreis netto</FieldLabel>}
                <input inputMode="decimal" value={p.price} onChange={e => setPos(p.id, 'price', e.target.value)} placeholder="0,00" style={inputBase} />
              </div>
              <div>
                {idx === 0 && <FieldLabel>USt %</FieldLabel>}
                <select value={p.taxRate} onChange={e => setPos(p.id, 'taxRate', Number(e.target.value))} style={inputBase}>
                  {UST_SAETZE.map(s => <option key={s} value={s}>{s}%</option>)}
                </select>
              </div>
              <button onClick={() => delPos(p.id)} disabled={form.positionen.length === 1} title="Position entfernen"
                style={{ background: 'none', border: 'none', cursor: form.positionen.length === 1 ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', fontSize: '15px', padding: '6px 4px', opacity: form.positionen.length === 1 ? 0.4 : 1 }}>
                🗑
              </button>
            </div>
          ))}
          <button onClick={addPos}
            style={{ alignSelf: 'flex-start', padding: '3px 10px', borderRadius: '12px', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>
            + Position
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={form.aktiv} onChange={e => set('aktiv', e.target.checked)} style={{ width: '14px', height: '14px', accentColor: ACCENT, cursor: 'pointer' }} />
            Aktiv
          </label>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Brutto {INTERVALLE[form.intervall]?.short}: <strong style={{ color: ACCENT, fontSize: '14px' }}>{fmtEuro(brutto)}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel}
            style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>
            Abbrechen
          </button>
          <button onClick={handleSave} disabled={!canSave}
            style={{ padding: '6px 18px', borderRadius: '6px', border: 'none', background: canSave ? ACCENT : 'var(--border)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed' }}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Karte ───────────────────────────────────────────────────────────────────
function DauerrechnungKarte({ dr, onUpdate, onDelete, onEdit }) {
  const brutto = summeBrutto(dr)
  return (
    <div style={{ border: `1px solid ${dr.aktiv ? ACCENT + '44' : 'var(--border)'}`, borderRadius: '8px', padding: '10px 12px', background: dr.aktiv ? `${ACCENT}0a` : 'var(--surface2)', opacity: dr.aktiv ? 1 : 0.6, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '16px' }}>🔁</span>
      <div style={{ flex: 1, minWidth: '140px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{dr.bezeichnung || '(ohne Bezeichnung)'}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {(dr.positionen ?? []).length} Position{(dr.positionen ?? []).length !== 1 ? 'en' : ''} · {INTERVALLE[dr.intervall]?.label ?? dr.intervall}
          {dr.letzterVersandPeriode ? ` · zuletzt ${dr.letzterVersandPeriode}` : ''}
        </div>
      </div>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap' }}>
        {fmtEuro(brutto)} <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)' }}>{INTERVALLE[dr.intervall]?.short}</span>
      </div>
      <button onClick={() => onUpdate({ ...dr, aktiv: !dr.aktiv })} title={dr.aktiv ? 'Deaktivieren' : 'Aktivieren'}
        style={{ background: 'none', border: `1px solid ${dr.aktiv ? ACCENT : 'var(--border)'}`, borderRadius: '6px', padding: '2px 8px', cursor: 'pointer', fontSize: '11px', color: dr.aktiv ? ACCENT : 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {dr.aktiv ? '✓ Aktiv' : '○ Inaktiv'}
      </button>
      <button onClick={onEdit} title="Bearbeiten" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', padding: '2px 4px' }}>✏️</button>
      <button onClick={onDelete} title="Löschen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', padding: '2px 4px' }}>🗑</button>
    </div>
  )
}

// ── Hauptblock ────────────────────────────────────────────────────────────────
export default function DauerrechnungenBlock({ client, onUpdate }) {
  const liste = client.dauerrechnungen ?? []
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)

  function speichern(dr) {
    if (editId) onUpdate({ dauerrechnungen: liste.map(x => x.id === dr.id ? dr : x) })
    else onUpdate({ dauerrechnungen: [...liste, dr] })
    setShowForm(false); setEditId(null)
  }
  function loeschen(id) { onUpdate({ dauerrechnungen: liste.filter(x => x.id !== id) }) }
  function aktualisieren(dr) { onUpdate({ dauerrechnungen: liste.map(x => x.id === dr.id ? dr : x) }) }

  const editInitial = editId ? liste.find(x => x.id === editId) : null

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ background: ACCENT, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '16px' }}>🔁</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Dauerrechnungen (wiederkehrend)</span>
        {liste.length > 0 && (
          <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', padding: '1px 8px', borderRadius: '10px' }}>
            {liste.filter(d => d.aktiv).length} aktiv · {liste.length} gesamt
          </span>
        )}
        {!showForm && (
          <button onClick={() => { setEditId(null); setShowForm(true) }}
            style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            + Neu
          </button>
        )}
      </div>

      <div style={{ padding: '12px', background: 'var(--surface2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {showForm && (
          <DauerrechnungForm
            initial={editInitial ?? mkDauerrechnung()}
            isNew={!editId}
            onSave={speichern}
            onCancel={() => { setShowForm(false); setEditId(null) }}
          />
        )}

        {liste.length === 0 && !showForm && (
          <div style={{ textAlign: 'center', padding: '20px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
            Noch keine Dauerrechnungen. Lege z. B. „Miete Geschäftsadresse" oder „Vorschuss Buchhaltung" mit Intervall an.
          </div>
        )}

        {liste.filter(d => d.id !== editId).map(dr => (
          <DauerrechnungKarte
            key={dr.id}
            dr={dr}
            onUpdate={aktualisieren}
            onEdit={() => { setEditId(dr.id); setShowForm(true) }}
            onDelete={() => loeschen(dr.id)}
          />
        ))}

        {liste.length > 0 && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: '2px' }}>
            💡 Die gebündelte Erzeugung + Versand fälliger Dauerrechnungen erfolgt in <strong>Übersichten → Honorare</strong>.
            Voraussetzung je Mandant: verknüpfter sevDesk-Kontakt + Rechnungs-E-Mail.
          </div>
        )}
      </div>
    </div>
  )
}
