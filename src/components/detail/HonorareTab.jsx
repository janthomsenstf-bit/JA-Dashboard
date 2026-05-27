/**
 * HonorareTab – Preisvereinbarungen & Honorarübersicht pro Mandant.
 * Rein intern / Planungstool – keine Buchhaltung, keine Rechnungen.
 */
import { useState } from 'react'

// ── Konfiguration ─────────────────────────────────────────────────────────────────
export const LEISTUNGSART_CFG = {
  miete:           { label: 'Miete / Geschäftsadresse', icon: '🏠', color: '#0891b2', bg: 'rgba(8,145,178,0.07)'    },
  fibu:            { label: 'Finanzbuchhaltung',         icon: '📒', color: '#2563eb', bg: 'rgba(37,99,235,0.07)'   },
  lohn:            { label: 'Lohnbuchhaltung',           icon: '💼', color: '#7c3aed', bg: 'rgba(124,58,237,0.07)'  },
  jahresabschluss: { label: 'Jahresabschluss / Steuer',  icon: '📁', color: '#16a34a', bg: 'rgba(22,163,74,0.07)'   },
  beratung:        { label: 'Beratung',                  icon: '🧠', color: '#f97316', bg: 'rgba(249,115,22,0.07)'  },
  sonstiges:       { label: 'Sonstiges',                 icon: '📝', color: '#64748b', bg: 'rgba(100,116,139,0.07)' },
}

export const RHYTHMUS_CFG = {
  monatlich:     { label: 'monatlich',     short: '/Mon.'  },
  quartalsweise: { label: 'quartalsweise', short: '/Qu.'   },
  jaehrlich:     { label: 'jährlich',      short: '/Jahr'  },
  einmalig:      { label: 'einmalig',      short: 'einm.'  },
  aufwand:       { label: 'nach Aufwand',  short: 'Aufw.'  },
}

const ACCENT = '#0f766e'

// ── Berechnungen ──────────────────────────────────────────────────────────────────
export function toMonatswert(betrag, rhythmus) {
  const b = parseFloat(betrag) || 0
  if (rhythmus === 'monatlich')     return b
  if (rhythmus === 'quartalsweise') return b / 3
  if (rhythmus === 'jaehrlich')     return b / 12
  return null
}

export function toJahreswert(betrag, rhythmus) {
  const b = parseFloat(betrag) || 0
  if (rhythmus === 'monatlich')     return b * 12
  if (rhythmus === 'quartalsweise') return b * 4
  if (rhythmus === 'jaehrlich')     return b
  return null
}

export function fmtEuro(val, digits = 0) {
  if (val === null || val === undefined) return '–'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(val)
}

function getLabel(h) {
  const cfg = LEISTUNGSART_CFG[h.leistungsart] ?? LEISTUNGSART_CFG.sonstiges
  return h.leistungsart === 'sonstiges' && h.bezeichnung ? h.bezeichnung : cfg.label
}

function mkHonorar() {
  return {
    id:           'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    leistungsart: 'fibu',
    bezeichnung:  '',
    betrag:       0,
    bruttoNetto:  'netto',
    rhythmus:     'monatlich',
    startDatum:   '',
    endDatum:     '',
    aktiv:        true,
    notiz:        '',
    erstelltAm:   new Date().toISOString(),
  }
}

// ── Hilfskomponenten ──────────────────────────────────────────────────────────────
function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {children}
    </div>
  )
}

const inputBase = { width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box' }
const selectBase = { ...inputBase }

// ── Formular-Komponente ───────────────────────────────────────────────────────────
function HonorarForm({ initial, isNew, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    ...initial,
    betrag: initial.betrag === 0 && isNew ? '' : String(initial.betrag),
  }))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const betragNum = parseFloat(form.betrag) || 0
  const monat     = form.betrag !== '' ? toMonatswert(betragNum, form.rhythmus) : null
  const jahr      = form.betrag !== '' ? toJahreswert(betragNum, form.rhythmus) : null
  const canSave   = form.rhythmus === 'aufwand' || betragNum > 0

  function handleSave() {
    if (!canSave) return
    onSave({ ...form, betrag: betragNum })
  }

  return (
    <div style={{ border: `2px solid ${ACCENT}44`, borderRadius: '10px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: ACCENT, color: '#fff', padding: '8px 14px', fontSize: '12px', fontWeight: 700 }}>
        {isNew ? '+ Neue Preisvereinbarung' : '✏️ Preisvereinbarung bearbeiten'}
      </div>

      <div style={{ padding: '14px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Zeile 1: Leistungsart + Bezeichnung/Notiz */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <FieldLabel>Leistungsart *</FieldLabel>
            <select value={form.leistungsart} onChange={e => set('leistungsart', e.target.value)} style={selectBase}>
              {Object.entries(LEISTUNGSART_CFG).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>
          {form.leistungsart === 'sonstiges' ? (
            <div>
              <FieldLabel>Bezeichnung *</FieldLabel>
              <input
                value={form.bezeichnung}
                onChange={e => set('bezeichnung', e.target.value)}
                placeholder="z. B. Gesellschafterbeschluss"
                style={inputBase}
              />
            </div>
          ) : (
            <div>
              <FieldLabel>Interne Notiz</FieldLabel>
              <input
                value={form.notiz}
                onChange={e => set('notiz', e.target.value)}
                placeholder="z. B. inkl. 2 Mitarbeiter, Sonderkonditionen…"
                style={inputBase}
              />
            </div>
          )}
        </div>

        {/* Zeile 2: Betrag + Netto/Brutto + Rhythmus */}
        <div style={{ display: 'grid', gridTemplateColumns: '130px 90px 1fr', gap: '10px' }}>
          <div>
            <FieldLabel>Betrag {form.rhythmus !== 'aufwand' ? '*' : ''}</FieldLabel>
            <div style={{ position: 'relative' }}>
              <input
                type="number" min="0" step="0.01"
                value={form.betrag}
                onChange={e => set('betrag', e.target.value)}
                placeholder={form.rhythmus === 'aufwand' ? 'optional' : '0,00'}
                style={{ ...inputBase, paddingRight: '26px' }}
              />
              <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '12px', pointerEvents: 'none' }}>€</span>
            </div>
          </div>
          <div>
            <FieldLabel>Netto/Brutto</FieldLabel>
            <select value={form.bruttoNetto} onChange={e => set('bruttoNetto', e.target.value)} style={selectBase}>
              <option value="netto">Netto</option>
              <option value="brutto">Brutto</option>
            </select>
          </div>
          <div>
            <FieldLabel>Abrechnungsrhythmus *</FieldLabel>
            <select value={form.rhythmus} onChange={e => set('rhythmus', e.target.value)} style={selectBase}>
              {Object.entries(RHYTHMUS_CFG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Zeile 3: Start + Ende + Aktiv */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
          <div>
            <FieldLabel>Gültig ab</FieldLabel>
            <input type="date" value={form.startDatum} onChange={e => set('startDatum', e.target.value)} style={inputBase} />
          </div>
          <div>
            <FieldLabel>Gültig bis (optional)</FieldLabel>
            <input type="date" value={form.endDatum} onChange={e => set('endDatum', e.target.value)} style={inputBase} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none', paddingBottom: '7px', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={form.aktiv} onChange={e => set('aktiv', e.target.checked)}
              style={{ width: '14px', height: '14px', accentColor: ACCENT, cursor: 'pointer' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Aktiv</span>
          </label>
        </div>

        {/* Notiz bei Sonstiges */}
        {form.leistungsart === 'sonstiges' && (
          <div>
            <FieldLabel>Interne Notiz</FieldLabel>
            <input
              value={form.notiz}
              onChange={e => set('notiz', e.target.value)}
              placeholder="Preisabsprache, Konditionen…"
              style={inputBase}
            />
          </div>
        )}

        {/* Berechnungs-Vorschau */}
        {betragNum > 0 && monat !== null && (
          <div style={{ background: 'rgba(15,118,110,0.06)', border: '1px solid rgba(15,118,110,0.2)', borderRadius: '8px', padding: '8px 12px', display: 'flex', gap: '24px', fontSize: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Berechnung:</span>
            <span><strong style={{ color: ACCENT }}>{fmtEuro(monat)}</strong><span style={{ color: 'var(--text-muted)', fontSize: '11px' }}> / Monat</span></span>
            <span><strong style={{ color: ACCENT }}>{fmtEuro(jahr)}</strong><span style={{ color: 'var(--text-muted)', fontSize: '11px' }}> / Jahr</span></span>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel}
            style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>
            Abbrechen
          </button>
          <button onClick={handleSave} disabled={!canSave}
            style={{ padding: '6px 18px', borderRadius: '6px', border: 'none', background: canSave ? ACCENT : 'var(--border)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: canSave ? 'pointer' : 'not-allowed', transition: 'background 0.15s' }}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Einzelne Karte ────────────────────────────────────────────────────────────────
function HonorarKarte({ h, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const cfg   = LEISTUNGSART_CFG[h.leistungsart] ?? LEISTUNGSART_CFG.sonstiges
  const monat = toMonatswert(h.betrag, h.rhythmus)
  const jahr  = toJahreswert(h.betrag, h.rhythmus)
  const lbl   = getLabel(h)

  if (editing) {
    return (
      <HonorarForm
        initial={h}
        isNew={false}
        onSave={updated => { onUpdate(updated); setEditing(false) }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div style={{
      border: `1px solid ${h.aktiv ? cfg.color + '44' : 'var(--border)'}`,
      borderRadius: '8px',
      padding: '10px 12px',
      background: h.aktiv ? cfg.bg : 'var(--surface2)',
      opacity: h.aktiv ? 1 : 0.6,
      transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>

        {/* Icon */}
        <span style={{ fontSize: '18px', flexShrink: 0, lineHeight: 1.4 }}>{cfg.icon}</span>

        {/* Label + Notiz + Datum */}
        <div style={{ flex: 1, minWidth: '120px' }}>
          <div style={{ fontWeight: 600, fontSize: '13px', color: h.aktiv ? cfg.color : 'var(--text-secondary)', lineHeight: 1.3 }}>
            {lbl}
          </div>
          {h.notiz && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
              {h.notiz}
            </div>
          )}
          {(h.startDatum || h.endDatum) && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>
              {h.startDatum && `ab ${h.startDatum}`}
              {h.startDatum && h.endDatum && ' · '}
              {h.endDatum && `bis ${h.endDatum}`}
            </div>
          )}
        </div>

        {/* Betrag + Rhythmus */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: h.aktiv ? 'var(--text)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {fmtEuro(h.betrag, 2)}{' '}
            <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)' }}>
              {RHYTHMUS_CFG[h.rhythmus]?.short}
            </span>
          </div>
          <div style={{ fontSize: '10px', color: h.bruttoNetto === 'brutto' ? '#f97316' : 'var(--text-muted)' }}>
            {h.bruttoNetto.toUpperCase()}
          </div>
        </div>

        {/* Monatswert / Jahreswert */}
        {monat !== null ? (
          <div style={{ textAlign: 'right', flexShrink: 0, minWidth: '90px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>
              {fmtEuro(monat)}<span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)' }}>/Mo.</span>
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{fmtEuro(jahr)}/Jahr</div>
          </div>
        ) : (
          <span style={{ fontSize: '11px', background: 'rgba(100,116,139,0.12)', color: '#64748b', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap', flexShrink: 0, alignSelf: 'center' }}>
            {RHYTHMUS_CFG[h.rhythmus]?.label}
          </span>
        )}

        {/* Aktiv-Toggle */}
        <button
          onClick={() => onUpdate({ ...h, aktiv: !h.aktiv })}
          title={h.aktiv ? 'Deaktivieren' : 'Aktivieren'}
          style={{
            background: 'none',
            border: `1px solid ${h.aktiv ? '#16a34a' : 'var(--border)'}`,
            borderRadius: '6px', padding: '2px 8px', cursor: 'pointer',
            fontSize: '11px', color: h.aktiv ? '#16a34a' : 'var(--text-muted)',
            fontWeight: 600, flexShrink: 0, alignSelf: 'center',
          }}
        >
          {h.aktiv ? '✓ Aktiv' : '○ Inaktiv'}
        </button>

        {/* Bearbeiten */}
        <button
          onClick={() => setEditing(true)}
          title="Bearbeiten"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', padding: '2px 4px', flexShrink: 0, alignSelf: 'center' }}
          onMouseEnter={e => e.currentTarget.style.color = ACCENT}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >✏️</button>

        {/* Löschen */}
        <button
          onClick={onDelete}
          title="Löschen"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', padding: '2px 4px', flexShrink: 0, alignSelf: 'center' }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >🗑</button>
      </div>
    </div>
  )
}

// ── Inaktive Sektion ──────────────────────────────────────────────────────────────
function InaktiveSection({ honorare, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '2px 0', display: 'flex', alignItems: 'center', gap: '5px' }}
      >
        <span style={{ fontSize: '10px' }}>{open ? '▼' : '▶'}</span>
        {honorare.length} inaktive Vereinbarung{honorare.length !== 1 ? 'en' : ''}
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
          {honorare.map(h => (
            <HonorarKarte
              key={h.id}
              h={h}
              onUpdate={onUpdate}
              onDelete={() => onDelete(h.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Haupt-Tab ─────────────────────────────────────────────────────────────────────
export default function HonorareTab({ client, onUpdate }) {
  const [showForm, setShowForm] = useState(false)
  const honorare = client.honorare ?? []

  function addHonorar(h)     { onUpdate({ honorare: [...honorare, h] }); setShowForm(false) }
  function updateHonorar(h)  { onUpdate({ honorare: honorare.map(x => x.id === h.id ? h : x) }) }
  function deleteHonorar(id) { onUpdate({ honorare: honorare.filter(h => h.id !== id) }) }

  // Summenwerte (nur aktive, laufende)
  const aktive       = honorare.filter(h => h.aktiv)
  const monatsSumme  = aktive.reduce((s, h) => s + (toMonatswert(h.betrag, h.rhythmus) ?? 0), 0)
  const jahresSumme  = aktive.reduce((s, h) => s + (toJahreswert(h.betrag, h.rhythmus) ?? 0), 0)
  const einmaligList = aktive.filter(h => h.rhythmus === 'einmalig')
  const aufwandList  = aktive.filter(h => h.rhythmus === 'aufwand')

  const aktiveHonorare   = honorare.filter(h => h.aktiv)
  const inaktiveHonorare = honorare.filter(h => !h.aktiv)

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Zusammenfassung ── */}
      {honorare.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          <SumKachel
            label="Monatlich (laufend)"
            wert={fmtEuro(monatsSumme)}
            color={ACCENT}
            icon="📅"
          />
          <SumKachel
            label="Jahreswert (laufend)"
            wert={fmtEuro(jahresSumme)}
            color="#16a34a"
            icon="📆"
          />
          {einmaligList.length > 0 && (
            <SumKachel
              label={`Einmalig (${einmaligList.length})`}
              wert={fmtEuro(einmaligList.reduce((s, h) => s + h.betrag, 0))}
              color="#f97316"
              icon="⚡"
            />
          )}
          {aufwandList.length > 0 && (
            <SumKachel
              label="Nach Aufwand"
              wert={`${aufwandList.length} Pos.`}
              color="#64748b"
              icon="⏱"
              isText
            />
          )}
        </div>
      )}

      {/* ── Hauptbereich ── */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: ACCENT, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '16px' }}>💰</span>
          <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Honorare & Preisvereinbarungen</span>
          {honorare.length > 0 && (
            <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', padding: '1px 8px', borderRadius: '10px' }}>
              {aktive.length} aktiv · {honorare.length} gesamt
            </span>
          )}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              + Neu
            </button>
          )}
        </div>

        <div style={{ padding: '12px', background: 'var(--surface2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Neues Formular */}
          {showForm && (
            <HonorarForm
              initial={mkHonorar()}
              isNew={true}
              onSave={addHonorar}
              onCancel={() => setShowForm(false)}
            />
          )}

          {/* Leerer Zustand */}
          {honorare.length === 0 && !showForm && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>💰</div>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px', color: 'var(--text)' }}>
                Noch keine Preisvereinbarungen
              </div>
              <div style={{ fontSize: '12px', marginBottom: '14px' }}>
                Hinterlege Honorare für diesen Mandanten – sie fließen in die globale Budgetübersicht ein.
              </div>
              <button
                onClick={() => setShowForm(true)}
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: ACCENT, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                + Erste Vereinbarung anlegen
              </button>
            </div>
          )}

          {/* Aktive Einträge */}
          {aktiveHonorare.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {aktiveHonorare.map(h => (
                <HonorarKarte
                  key={h.id}
                  h={h}
                  onUpdate={updateHonorar}
                  onDelete={() => deleteHonorar(h.id)}
                />
              ))}
            </div>
          )}

          {/* Inaktive Einträge */}
          {inaktiveHonorare.length > 0 && (
            <InaktiveSection
              honorare={inaktiveHonorare}
              onUpdate={updateHonorar}
              onDelete={deleteHonorar}
            />
          )}
        </div>
      </div>

      {/* Hinweis */}
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6, padding: '0 2px' }}>
        💡 Diese Preisvereinbarungen sind rein intern zur Planung und ersetzen keine Buchhaltung.
        Alle aktiven Positionen erscheinen in der globalen <strong>Honorar-Übersicht</strong> in der Seitenleiste.
      </div>
    </div>
  )
}

function SumKachel({ label, wert, color, icon, isText = false }) {
  return (
    <div style={{ border: `1px solid ${color}33`, borderRadius: '10px', padding: '12px 14px', background: `${color}08` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px' }}>{icon}</span>
        <span style={{ fontSize: '10px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <div style={{ fontSize: isText ? '18px' : '20px', fontWeight: 700, color }}>{wert}</div>
    </div>
  )
}
