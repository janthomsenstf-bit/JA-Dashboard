/**
 * HonorareTab – Preisvereinbarungen & Honorarübersicht pro Mandant.
 * Rein intern / Planungstool – keine Buchhaltung, keine Rechnungen.
 */
import { useState, useRef } from 'react'
import { callAI, hasAiKey } from '../../utils/aiClient.js'
import { buildLeistungsnachweis, downloadPdf, leistungsnachweisFilename, buildZeitUebersicht, zeitUebersichtFilename } from '../../utils/leistungsnachweisPdf.js'
import RechnungSevdeskBlock from './RechnungSevdeskBlock.jsx'
import DauerrechnungenBlock from './DauerrechnungenBlock.jsx'

// ── Jahresliste ───────────────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear()
export const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => CURRENT_YEAR - 3 + i)

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
    id:            'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    leistungsart:  'fibu',
    bezeichnung:   '',
    betrag:        0,
    bruttoNetto:   'netto',
    rhythmus:      'monatlich',
    startDatum:    '',
    endDatum:      '',
    leistungsjahr: null,   // Jahreszuordnung, besonders für einmalig/aufwand
    aktiv:         true,
    notiz:         '',
    auftragId:     null,   // optionale Kopplung an einen Auftrag (Phase 2)
    erstelltAm:    new Date().toISOString(),
  }
}

// ── Hilfskomponenten ──────────────────────────────────────────────────────────────
function FieldLabel({ children, warn }) {
  return (
    <div style={{ fontSize: '10px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', color: warn ? '#f97316' : 'var(--text-muted)' }}>
      {children}
    </div>
  )
}

const inputBase = { width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box' }
const selectBase = { ...inputBase }

// ── Formular ──────────────────────────────────────────────────────────────────────
function HonorarForm({ initial, isNew, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    ...initial,
    betrag: initial.betrag === 0 && isNew ? '' : String(initial.betrag),
  }))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const betragNum  = parseFloat(form.betrag) || 0
  const monat      = form.betrag !== '' ? toMonatswert(betragNum, form.rhythmus) : null
  const jahr       = form.betrag !== '' ? toJahreswert(betragNum, form.rhythmus) : null
  const isEinmalig = form.rhythmus === 'einmalig' || form.rhythmus === 'aufwand'
  const jahrWarn   = isEinmalig && !form.leistungsjahr
  const canSave    = isEinmalig ? (form.rhythmus === 'aufwand' || betragNum > 0) : betragNum > 0

  function handleSave() { if (canSave) onSave({ ...form, betrag: betragNum }) }

  return (
    <div style={{ border: `2px solid ${ACCENT}44`, borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ background: ACCENT, color: '#fff', padding: '8px 14px', fontSize: '12px', fontWeight: 700 }}>
        {isNew ? '+ Neue Preisvereinbarung' : '✏️ Preisvereinbarung bearbeiten'}
      </div>
      <div style={{ padding: '14px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Zeile 1: Leistungsart + Bezeichnung / Notiz */}
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
              <input value={form.bezeichnung} onChange={e => set('bezeichnung', e.target.value)}
                placeholder="z. B. Gesellschafterbeschluss" style={inputBase} />
            </div>
          ) : (
            <div>
              <FieldLabel>Interne Notiz</FieldLabel>
              <input value={form.notiz} onChange={e => set('notiz', e.target.value)}
                placeholder="z. B. inkl. 2 Mitarbeiter, Sonderkonditionen…" style={inputBase} />
            </div>
          )}
        </div>

        {/* Zeile 2: Betrag + Netto/Brutto + Rhythmus */}
        <div style={{ display: 'grid', gridTemplateColumns: '130px 90px 1fr', gap: '10px' }}>
          <div>
            <FieldLabel>Betrag {form.rhythmus !== 'aufwand' && '*'}</FieldLabel>
            <div style={{ position: 'relative' }}>
              <input type="number" min="0" step="0.01"
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

        {/* Zeile 3: Gültig ab + Gültig bis + Leistungsjahr + Aktiv */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px auto', gap: '10px', alignItems: 'end' }}>
          <div>
            <FieldLabel>Gültig ab</FieldLabel>
            <input type="date" value={form.startDatum} onChange={e => set('startDatum', e.target.value)} style={inputBase} />
          </div>
          <div>
            <FieldLabel>Gültig bis (optional)</FieldLabel>
            <input type="date" value={form.endDatum} onChange={e => set('endDatum', e.target.value)} style={inputBase} />
          </div>
          <div>
            <FieldLabel warn={jahrWarn}>
              Jahr {isEinmalig && '*'}
            </FieldLabel>
            <select
              value={form.leistungsjahr ?? ''}
              onChange={e => set('leistungsjahr', e.target.value ? parseInt(e.target.value) : null)}
              style={{ ...selectBase, borderColor: jahrWarn ? 'rgba(249,115,22,0.6)' : 'var(--border)' }}
            >
              <option value="">– kein –</option>
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none', paddingBottom: '7px', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={form.aktiv} onChange={e => set('aktiv', e.target.checked)}
              style={{ width: '14px', height: '14px', accentColor: ACCENT, cursor: 'pointer' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Aktiv</span>
          </label>
        </div>

        {/* Hinweis: Jahr fehlt bei einmalig */}
        {jahrWarn && (
          <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '6px', padding: '7px 10px', fontSize: '11px', color: '#f97316' }}>
            ⚠ Bei einmaligen Honoraren empfehle ich, ein Leistungsjahr zu hinterlegen –
            sonst kann das Honorar in der zeitgefilterten Budgetübersicht nicht zugeordnet werden.
          </div>
        )}

        {/* Notiz für Sonstiges */}
        {form.leistungsart === 'sonstiges' && (
          <div>
            <FieldLabel>Interne Notiz</FieldLabel>
            <input value={form.notiz} onChange={e => set('notiz', e.target.value)}
              placeholder="Preisabsprache, Konditionen…" style={inputBase} />
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
  const cfg       = LEISTUNGSART_CFG[h.leistungsart] ?? LEISTUNGSART_CFG.sonstiges
  const monat     = toMonatswert(h.betrag, h.rhythmus)
  const jahr      = toJahreswert(h.betrag, h.rhythmus)
  const lbl       = getLabel(h)
  const isEinmalig = h.rhythmus === 'einmalig' || h.rhythmus === 'aufwand'
  const jahrFehlt  = isEinmalig && !h.leistungsjahr

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
      border: `1px solid ${h.aktiv ? (jahrFehlt ? 'rgba(249,115,22,0.4)' : cfg.color + '44') : 'var(--border)'}`,
      borderRadius: '8px', padding: '10px 12px',
      background: h.aktiv ? (jahrFehlt ? 'rgba(249,115,22,0.04)' : cfg.bg) : 'var(--surface2)',
      opacity: h.aktiv ? 1 : 0.6,
      transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>

        {/* Icon */}
        <span style={{ fontSize: '18px', flexShrink: 0, lineHeight: 1.4 }}>{cfg.icon}</span>

        {/* Label + Notiz + Datum */}
        <div style={{ flex: 1, minWidth: '120px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: '13px', color: h.aktiv ? cfg.color : 'var(--text-secondary)', lineHeight: 1.3 }}>
              {lbl}
            </span>
            {/* Leistungsjahr-Badge */}
            {h.leistungsjahr && (
              <span style={{ fontSize: '10px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', padding: '1px 7px', borderRadius: '8px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {h.leistungsjahr}
              </span>
            )}
            {/* Warnung: Jahr fehlt */}
            {jahrFehlt && (
              <span style={{ fontSize: '10px', background: 'rgba(249,115,22,0.12)', color: '#f97316', padding: '1px 7px', borderRadius: '8px', fontWeight: 600 }}>
                ⚠ kein Jahr
              </span>
            )}
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

        {/* Monatswert / Jahreswert (nur laufende) */}
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
            background: 'none', border: `1px solid ${h.aktiv ? '#16a34a' : 'var(--border)'}`,
            borderRadius: '6px', padding: '2px 8px', cursor: 'pointer',
            fontSize: '11px', color: h.aktiv ? '#16a34a' : 'var(--text-muted)', fontWeight: 600, flexShrink: 0, alignSelf: 'center',
          }}
        >
          {h.aktiv ? '✓ Aktiv' : '○ Inaktiv'}
        </button>

        {/* Bearbeiten */}
        <button onClick={() => setEditing(true)} title="Bearbeiten"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', padding: '2px 4px', flexShrink: 0, alignSelf: 'center' }}
          onMouseEnter={e => e.currentTarget.style.color = ACCENT}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >✏️</button>

        {/* Löschen */}
        <button onClick={onDelete} title="Löschen"
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
      <button onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '2px 0', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <span style={{ fontSize: '10px' }}>{open ? '▼' : '▶'}</span>
        {honorare.length} inaktive Vereinbarung{honorare.length !== 1 ? 'en' : ''}
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
          {honorare.map(h => (
            <HonorarKarte key={h.id} h={h} onUpdate={onUpdate} onDelete={() => onDelete(h.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ══ Zeiterfassung / Leistungen & Zeiten ════════════════════════════════════════════
const DEFAULT_STUNDENSATZ = 90
const ZEIT_ACCENT = '#0891b2'

const btnGhost   = { padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer' }
const btnPrimary = { padding: '5px 14px', borderRadius: '6px', border: 'none', background: ZEIT_ACCENT, color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }
const iconBtn    = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', padding: '2px 3px', flexShrink: 0 }

function todayISO()      { return new Date().toISOString().slice(0, 10) }
function deDateShort(s)  { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? `${m[3]}.${m[2]}.${m[1]}` : String(s || '') }
function fmtStunden(min) { return ((min || 0) / 60).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) }
function mkZeit() {
  return { id: 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), datum: todayISO(), art: 'stunden', dauerMin: 0, pauschalBetrag: 0, beschreibung: '', status: 'offen', auftragId: null, erstelltAm: new Date().toISOString() }
}
function eintragBetrag(z, satz) {
  return z.art === 'pauschale' ? (z.pauschalBetrag || 0) : ((z.dauerMin || 0) / 60) * (satz || 0)
}
const RE_EURO = /(\d+(?:[.,]\d+)?)\s*(?:€|eur\b|euro\b)/i
function stripPauschale(text) {
  let t = (text || '')
    .replace(RE_EURO, ' ')
    .replace(/pauschal\w*/gi, ' ')
    .replace(/\beinmal(ig)?\b/gi, ' ')
    .replace(/\s{2,}/g, ' ').trim().replace(/^[,\-–·\s]+/, '').trim()
  t = t.replace(/^f[üu]r\s+(die\s+|das\s+|den\s+|der\s+)?/i, '')
  return t.trim()
}

// ── Diktat-Parser (lokaler Fallback ohne KI) ──────────────────────────────────────
function parseGermanNum(tok) {
  if (tok == null) return null
  const s = String(tok).toLowerCase()
  if (/^\d+([.,]\d+)?$/.test(s)) return parseFloat(s.replace(',', '.'))
  const map = { ein: 1, eine: 1, einen: 1, einer: 1, zwei: 2, drei: 3, vier: 4, 'fünf': 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, 'zwölf': 12, zwoelf: 12, halbe: 0.5, anderthalb: 1.5, eineinhalb: 1.5, zweieinhalb: 2.5, dreiviertel: 0.75, 'fünfzehn': 15, fuenfzehn: 15, zwanzig: 20, 'dreißig': 30, dreissig: 30, 'fünfundvierzig': 45, fuenfundvierzig: 45 }
  return map[s] ?? null
}
const RE_STD = /(\d+(?:[.,]\d+)?|eineinhalb|anderthalb|zweieinhalb|dreiviertel|halbe|eine|einen|einer|ein|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwoelf)\s*(?:stunden|stunde|std\.?|h)\b/i
const RE_MIN = /(\d+|fünfundvierzig|fuenfundvierzig|fünfzehn|fuenfzehn|dreißig|dreissig|zwanzig|zehn)\s*(?:minuten|minute|min\.?)\b/i
function parseDauerMin(text) {
  const t = ' ' + (text || '') + ' '
  let min = 0
  const hm = t.match(RE_STD); if (hm) { const v = parseGermanNum(hm[1]); if (v != null) min += Math.round(v * 60) }
  const mm = t.match(RE_MIN); if (mm) { const v = parseGermanNum(mm[1]); if (v != null) min += Math.round(v) }
  return min
}
function stripDauer(text) {
  return (text || '')
    .replace(new RegExp(RE_STD.source, 'gi'), '')
    .replace(new RegExp(RE_MIN.source, 'gi'), '')
    .replace(/\b(und|ca\.?|circa|etwa|ungefähr|ungefaehr)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ').trim().replace(/^[,\-–·\s]+/, '').trim()
}
function parseDiktatLocal(text) {
  if (/\bpauschal/i.test(text)) {
    const m = text.match(RE_EURO) || text.match(/pauschal\w*\s+(\d+(?:[.,]\d+)?)/i) || text.match(/(\d+(?:[.,]\d+)?)/)
    const betrag = m ? parseFloat(String(m[1] || '0').replace(',', '.')) : 0
    return { datum: todayISO(), art: 'pauschale', pauschalBetrag: betrag, dauerMin: 0, beschreibung: stripPauschale(text) || (text || '').trim() }
  }
  return { datum: todayISO(), art: 'stunden', dauerMin: parseDauerMin(text), pauschalBetrag: 0, beschreibung: stripDauer(text) || (text || '').trim() }
}
async function parseDiktat(text) {
  if (hasAiKey()) {
    try {
      const sys = `Du wandelst eine kurze deutsche Sprachnotiz eines Steuerberaters über eine erbrachte Leistung in einen strukturierten Eintrag um. Heutiges Datum: ${todayISO()}. Antworte ausschließlich mit JSON: {"art": "stunden" oder "pauschale", "dauerMin": <Minuten als Ganzzahl, 0 bei Pauschale>, "pauschalBetrag": <Euro-Betrag als Zahl, 0 bei Stunden>, "beschreibung": "<knappe sachliche Tätigkeit ohne Dauer-/Betragsangabe>", "datum": "YYYY-MM-DD"}. Kommt das Wort "pauschal" vor: art=pauschale und pauschalBetrag = der genannte Euro-Betrag. Sonst art=stunden mit dauerMin. Beispiele: "zwei Stunden Telefonat" -> {"art":"stunden","dauerMin":120,"beschreibung":"Telefonat"}; "einmal pauschal 100 Euro für die Anlage der Firma und der Mitarbeiter" -> {"art":"pauschale","pauschalBetrag":100,"beschreibung":"Anlage der Firma und der Mitarbeiter"}. Ohne Datumsangabe nimm das heutige Datum.`
      const r = await callAI(sys, text)
      const datum = /^\d{4}-\d{2}-\d{2}$/.test(r?.datum || '') ? r.datum : todayISO()
      if (r?.art === 'pauschale') {
        let betrag = Math.max(0, Number(r?.pauschalBetrag) || 0)
        let beschreibung = String(r?.beschreibung || '').trim()
        if (!betrag) betrag = parseDiktatLocal(text).pauschalBetrag
        if (!beschreibung) beschreibung = stripPauschale(text)
        if (betrag || beschreibung) return { datum, art: 'pauschale', pauschalBetrag: betrag, dauerMin: 0, beschreibung }
      } else {
        let dauerMin = Math.max(0, Math.round(Number(r?.dauerMin) || 0))
        let beschreibung = String(r?.beschreibung || '').trim()
        if (!dauerMin) dauerMin = parseDauerMin(text)
        if (!beschreibung) beschreibung = stripDauer(text)
        if (dauerMin || beschreibung) return { datum, art: 'stunden', dauerMin, pauschalBetrag: 0, beschreibung }
      }
    } catch { /* fällt auf lokalen Parser zurück */ }
  }
  return parseDiktatLocal(text)
}

// ── Spracheingabe ─────────────────────────────────────────────────────────────────
function ZeitVoiceBlock({ onParsed }) {
  const [transcript, setTranscript] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [interim, setInterim] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const recRef = useRef(null)
  const textRef = useRef('')
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  function set(val) { const v = typeof val === 'function' ? val(textRef.current) : val; textRef.current = v; setTranscript(v) }
  function toggle() {
    if (isRecording) { recRef.current?.stop(); setIsRecording(false); setInterim(''); return }
    if (!SR) return
    const r = new SR(); r.lang = 'de-DE'; r.continuous = true; r.interimResults = true
    r.onresult = e => {
      let fin = '', int = ''
      for (let i = e.resultIndex; i < e.results.length; i++) e.results[i].isFinal ? fin += e.results[i][0].transcript : int += e.results[i][0].transcript
      if (fin) set(t => t.trimEnd() ? t.trimEnd() + ' ' + fin : fin)
      setInterim(int)
    }
    r.onend = () => { setIsRecording(false); setInterim('') }
    r.onerror = () => { setIsRecording(false); setInterim(''); setError('Mikrofon-Fehler – Berechtigung prüfen.') }
    r.start(); recRef.current = r; setIsRecording(true); setError('')
  }
  async function process() {
    const text = transcript.trim(); if (!text) return
    setBusy(true); setError('')
    try { const parsed = await parseDiktat(text); onParsed(parsed); set('') }
    catch (e) { setError(e.message || 'Fehler bei der Aufbereitung.') }
    finally { setBusy(false) }
  }
  return (
    <div style={{ border: `1px dashed ${ZEIT_ACCENT}55`, borderRadius: '8px', padding: '10px 12px', background: `${ZEIT_ACCENT}08` }}>
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: ZEIT_ACCENT, marginBottom: '8px' }}>
        🎤 Zeit per Sprache erfassen{!hasAiKey() && ' · ohne KI-Schlüssel: einfache Erkennung'}
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <button onClick={toggle} disabled={!SR} title={!SR ? 'Browser unterstützt keine Spracheingabe' : (isRecording ? 'Aufnahme stoppen' : 'Aufnahme starten')}
          style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', flexShrink: 0, cursor: SR ? 'pointer' : 'not-allowed', background: isRecording ? '#ef4444' : ZEIT_ACCENT, color: '#fff', fontSize: '15px' }}>
          {isRecording ? '⏹' : '🎙'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <textarea value={transcript} onChange={e => set(e.target.value)} rows={2}
            placeholder={isRecording ? '🎤 Aufnahme läuft…' : 'z. B. „Zwei Stunden Belege einscannen und Buchhaltung Juni vorbereitet"'}
            style={{ ...inputBase, resize: 'none', lineHeight: 1.5 }} />
          {interim && <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>{interim}</div>}
          {error && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>⚠ {error}</div>}
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '6px' }}>
            {transcript && <button onClick={() => set('')} style={btnGhost}>✕ Löschen</button>}
            <button onClick={process} disabled={!transcript.trim() || busy} style={{ ...btnPrimary, opacity: (!transcript.trim() || busy) ? 0.5 : 1 }}>
              {busy ? '⏳ …' : '✨ Aufbereiten'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Manuelles Formular ────────────────────────────────────────────────────────────
function ZeitForm({ initial, onSave, onCancel, auftraege = [] }) {
  const [datum, setDatum] = useState(initial.datum || todayISO())
  const [art, setArt] = useState(initial.art || 'stunden')
  const [stdVal, setStdVal] = useState(initial.dauerMin ? String(initial.dauerMin / 60).replace('.', ',') : '')
  const [pausVal, setPausVal] = useState(initial.pauschalBetrag ? String(initial.pauschalBetrag).replace('.', ',') : '')
  const [besch, setBesch] = useState(initial.beschreibung || '')
  const [zuAuftrag, setZuAuftrag] = useState(initial.auftragId || '')
  const offeneAuftraege = (auftraege ?? []).filter(a => a && a.status !== 'erledigt')
  const dauerMin = Math.round((parseFloat(String(stdVal).replace(',', '.')) || 0) * 60)
  const pauschalBetrag = Math.max(0, parseFloat(String(pausVal).replace(',', '.')) || 0)
  const canSave = !!besch.trim() && (art === 'pauschale' ? pauschalBetrag > 0 : dauerMin > 0)
  return (
    <div style={{ border: `2px solid ${ZEIT_ACCENT}44`, borderRadius: '8px', padding: '12px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <FieldLabel>Abrechnungsart</FieldLabel>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[['stunden', '⏱ Stunden'], ['pauschale', '💶 Pauschale']].map(([k, l]) => (
            <button key={k} onClick={() => setArt(k)}
              style={{ flex: 1, padding: '7px', borderRadius: '6px', border: `1px solid ${art === k ? ZEIT_ACCENT : 'var(--border)'}`, background: art === k ? `${ZEIT_ACCENT}14` : 'transparent', color: art === k ? ZEIT_ACCENT : 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '150px 130px', gap: '10px' }}>
        <div><FieldLabel>Datum</FieldLabel><input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={inputBase} /></div>
        {art === 'pauschale'
          ? <div><FieldLabel>Pauschalbetrag (€) *</FieldLabel><input type="text" inputMode="decimal" value={pausVal} onChange={e => setPausVal(e.target.value)} placeholder="z. B. 100" style={inputBase} /></div>
          : <div><FieldLabel>Dauer (Std.) *</FieldLabel><input type="text" inputMode="decimal" value={stdVal} onChange={e => setStdVal(e.target.value)} placeholder="z. B. 1,5" style={inputBase} /></div>}
      </div>
      <div><FieldLabel>Tätigkeit *</FieldLabel><input value={besch} onChange={e => setBesch(e.target.value)} placeholder="z. B. Anlage Firma und Mitarbeiter" style={inputBase} /></div>
      {offeneAuftraege.length > 0 && (
        <div>
          <FieldLabel>Zu Auftrag (optional)</FieldLabel>
          <select value={zuAuftrag} onChange={e => setZuAuftrag(e.target.value)} style={selectBase}>
            <option value="">— kein Auftrag —</option>
            {offeneAuftraege.map(a => (
              <option key={a.id} value={a.id}>{(a.bezeichnung || a.typ) + (a.jahr ? ` (${a.jahr})` : '')}</option>
            ))}
          </select>
        </div>
      )}
      {art === 'stunden' && dauerMin > 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>= {fmtStunden(dauerMin)} Std</div>}
      {art === 'pauschale' && pauschalBetrag > 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>= {fmtEuro(pauschalBetrag, 2)} pauschal</div>}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={btnGhost}>Abbrechen</button>
        <button onClick={() => canSave && onSave({ datum, art, dauerMin: art === 'stunden' ? dauerMin : 0, pauschalBetrag: art === 'pauschale' ? pauschalBetrag : 0, beschreibung: besch.trim(), auftragId: zuAuftrag || null })} disabled={!canSave}
          style={{ ...btnPrimary, padding: '6px 18px', fontSize: '12px', opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'not-allowed' }}>Speichern</button>
      </div>
    </div>
  )
}

// ── Zeile ─────────────────────────────────────────────────────────────────────────
function ZeitRow({ z, satz, onEdit, onDelete, onStatus }) {
  const abger = z.status === 'abgerechnet'
  const isPaus = z.art === 'pauschale'
  const betrag = eintragBetrag(z, satz)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '7px', background: abger ? 'var(--surface2)' : 'var(--surface)', opacity: abger ? 0.7 : 1 }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', width: '62px', flexShrink: 0 }}>{deDateShort(z.datum)}</div>
      <div style={{ width: '66px', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {isPaus
          ? <span style={{ fontSize: '10px', fontWeight: 700, color: '#7c3aed', background: 'rgba(124,58,237,0.1)', padding: '2px 7px', borderRadius: '8px' }}>Pauschale</span>
          : <span style={{ fontSize: '12px', fontWeight: 700, color: ZEIT_ACCENT }}>{fmtStunden(z.dauerMin)} Std</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: '12px', color: 'var(--text)' }}>{z.beschreibung}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{fmtEuro(betrag, 2)}</div>
      {abger
        ? <span style={{ fontSize: '10px', background: 'rgba(100,116,139,0.15)', color: '#64748b', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, flexShrink: 0 }}>abgerechnet</span>
        : <span style={{ fontSize: '10px', background: 'rgba(8,145,178,0.12)', color: ZEIT_ACCENT, padding: '2px 8px', borderRadius: '10px', fontWeight: 600, flexShrink: 0 }}>offen</span>}
      <button onClick={() => onStatus(abger ? 'offen' : 'abgerechnet')} title={abger ? 'Wieder als offen' : 'Als abgerechnet markieren'}
        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{abger ? '↩' : '✓'}</button>
      <button onClick={onEdit} title="Bearbeiten" style={iconBtn}>✏️</button>
      <button onClick={onDelete} title="Löschen" style={iconBtn}>🗑</button>
    </div>
  )
}

// ── Hauptblock Zeiterfassung ──────────────────────────────────────────────────────
function ZeiterfassungBlock({ client, onUpdate }) {
  const eintraege = client.zeiteintraege ?? []
  const satz = client.stundensatz ?? DEFAULT_STUNDENSATZ
  const [showForm, setShowForm] = useState(false)
  const [formInit, setFormInit] = useState(null)
  const [editId, setEditId] = useState(null)
  const [satzEdit, setSatzEdit] = useState(false)
  const [satzVal, setSatzVal] = useState(String(satz))
  const [showAbger, setShowAbger] = useState(false)

  const offen = eintraege.filter(z => z.status !== 'abgerechnet')
  const abger = eintraege.filter(z => z.status === 'abgerechnet')
  const offenMin = offen.filter(z => z.art !== 'pauschale').reduce((s, z) => s + (z.dauerMin || 0), 0)
  const offenPauschalen = offen.filter(z => z.art === 'pauschale')
  const offenBetrag = offen.reduce((s, z) => s + eintragBetrag(z, satz), 0)
  const byDateDesc = (a, b) => String(b.datum).localeCompare(String(a.datum))

  function saveEntry(entry) {
    if (editId) onUpdate({ zeiteintraege: eintraege.map(z => z.id === editId ? { ...z, ...entry } : z) })
    else onUpdate({ zeiteintraege: [...eintraege, { ...mkZeit(), ...entry }] })
    setShowForm(false); setFormInit(null); setEditId(null)
  }
  function startNew()       { setFormInit({ datum: todayISO(), dauerMin: 0, beschreibung: '' }); setEditId(null); setShowForm(true) }
  function startEdit(z)     { setFormInit(z); setEditId(z.id); setShowForm(true) }
  function onParsed(p)      { setFormInit({ datum: p.datum || todayISO(), dauerMin: p.dauerMin || 0, beschreibung: p.beschreibung || '' }); setEditId(null); setShowForm(true) }
  function del(id)          { onUpdate({ zeiteintraege: eintraege.filter(z => z.id !== id) }) }
  function setStatus(id, s) { onUpdate({ zeiteintraege: eintraege.map(z => z.id === id ? { ...z, status: s } : z) }) }
  function saveSatz()       { const v = Math.max(0, parseFloat(String(satzVal).replace(',', '.')) || 0); onUpdate({ stundensatz: v }); setSatzEdit(false) }
  function pdf()            { if (!offen.length) return; downloadPdf(buildLeistungsnachweis(client, offen, { satz }), leistungsnachweisFilename(client)) }
  function pdfUebersicht()  { if (!eintraege.length) return; downloadPdf(buildZeitUebersicht(client, eintraege, { satz }), zeitUebersichtFilename(client)) }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: ZEIT_ACCENT, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '16px' }}>⏱</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Leistungen & Zeiten</span>
        {satzEdit ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input type="text" inputMode="decimal" value={satzVal} onChange={e => setSatzVal(e.target.value)}
              style={{ width: '54px', padding: '3px 6px', borderRadius: '5px', border: 'none', fontSize: '12px' }} />
            <span style={{ fontSize: '11px' }}>€/Std</span>
            <button onClick={saveSatz} style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff', borderRadius: '5px', padding: '3px 8px', cursor: 'pointer', fontSize: '11px' }}>✓</button>
          </span>
        ) : (
          <button onClick={() => { setSatzVal(String(satz)); setSatzEdit(true) }} title="Stundensatz ändern"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>
            {satz} €/Std ✏️
          </button>
        )}
        <button onClick={startNew}
          style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + Zeit erfassen
        </button>
      </div>

      <div style={{ padding: '12px', background: 'var(--surface2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Offene Stunden + Leistungsnachweis */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'stretch' }}>
          <div style={{ flex: 1, minWidth: '170px', border: `1px solid ${ZEIT_ACCENT}33`, borderRadius: '10px', padding: '10px 14px', background: `${ZEIT_ACCENT}0a` }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: ZEIT_ACCENT, marginBottom: '4px' }}>Offen gesamt</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{fmtEuro(offenBetrag, 2)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {fmtStunden(offenMin)} Std{offenPauschalen.length > 0 ? ` + ${offenPauschalen.length} Pauschale${offenPauschalen.length !== 1 ? 'n' : ''}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
            <button onClick={pdf} disabled={!offen.length} title="Leistungsnachweis der offenen Zeiten als PDF"
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', fontWeight: 600, cursor: offen.length ? 'pointer' : 'not-allowed', opacity: offen.length ? 1 : 0.5, whiteSpace: 'nowrap' }}>
              🧾 Leistungsnachweis (offen)
            </button>
            <button onClick={pdfUebersicht} disabled={!eintraege.length} title="Gesamtübersicht aller erfassten Zeiten (offen + abgerechnet) als PDF"
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', fontWeight: 600, cursor: eintraege.length ? 'pointer' : 'not-allowed', opacity: eintraege.length ? 1 : 0.5, whiteSpace: 'nowrap' }}>
              📄 Gesamtübersicht (PDF)
            </button>
          </div>
        </div>

        {!showForm && <ZeitVoiceBlock onParsed={onParsed} />}
        {showForm && <ZeitForm initial={formInit} onSave={saveEntry} onCancel={() => { setShowForm(false); setFormInit(null); setEditId(null) }} auftraege={client.auftraege ?? []} />}

        {eintraege.length === 0 && !showForm && (
          <div style={{ textAlign: 'center', padding: '14px', color: 'var(--text-muted)', fontSize: '12px' }}>
            Noch keine Zeiten erfasst – per Sprache oben oder „+ Zeit erfassen".
          </div>
        )}

        {offen.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[...offen].sort(byDateDesc).map(z => (
              <ZeitRow key={z.id} z={z} satz={satz} onEdit={() => startEdit(z)} onDelete={() => del(z.id)} onStatus={s => setStatus(z.id, s)} />
            ))}
          </div>
        )}

        {abger.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
            <button onClick={() => setShowAbger(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '10px' }}>{showAbger ? '▼' : '▶'}</span>{abger.length} abgerechnet
            </button>
            {showAbger && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {[...abger].sort(byDateDesc).map(z => (
                  <ZeitRow key={z.id} z={z} satz={satz} onEdit={() => startEdit(z)} onDelete={() => del(z.id)} onStatus={s => setStatus(z.id, s)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Haupt-Tab ─────────────────────────────────────────────────────────────────────
export default function HonorareTab({ client, onUpdate, emailSignaturen = [] }) {
  const [showForm, setShowForm] = useState(false)
  const [sub, setSub] = useState('honorare')   // 'honorare' | 'rechnung' | 'dauer'
  const honorare = client.honorare ?? []

  function addHonorar(h)     { onUpdate({ honorare: [...honorare, h] }); setShowForm(false) }
  function updateHonorar(h)  { onUpdate({ honorare: honorare.map(x => x.id === h.id ? h : x) }) }
  function deleteHonorar(id) { onUpdate({ honorare: honorare.filter(h => h.id !== id) }) }

  const aktive       = honorare.filter(h => h.aktiv)
  const monatsSumme  = aktive.reduce((s, h) => s + (toMonatswert(h.betrag, h.rhythmus) ?? 0), 0)
  const jahresSumme  = aktive.reduce((s, h) => s + (toJahreswert(h.betrag, h.rhythmus) ?? 0), 0)
  const einmaligList = aktive.filter(h => h.rhythmus === 'einmalig')
  const aufwandList  = aktive.filter(h => h.rhythmus === 'aufwand')
  const ohneJahr     = aktive.filter(h => (h.rhythmus === 'einmalig' || h.rhythmus === 'aufwand') && !h.leistungsjahr)

  const aktiveHonorare   = honorare.filter(h => h.aktiv)
  const inaktiveHonorare = honorare.filter(h => !h.aktiv)

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Unter-Navigation ── */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'honorare', label: 'Honorare & Zeiten', icon: '💰' },
          { key: 'rechnung', label: 'Rechnung',          icon: '🧾' },
          { key: 'dauer',    label: 'Dauerrechnungen',   icon: '🔁', badge: (client.dauerrechnungen ?? []).filter(d => d.aktiv).length },
        ].map(s => {
          const active = sub === s.key
          return (
            <button key={s.key} onClick={() => setSub(s.key)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', border: 'none', borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent', background: active ? `${ACCENT}12` : 'transparent', color: active ? ACCENT : 'var(--text-secondary)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginBottom: '-1px', whiteSpace: 'nowrap' }}>
              <span>{s.icon}</span>{s.label}
              {s.badge > 0 && <span style={{ fontSize: '10px', background: active ? ACCENT : 'var(--border)', color: active ? '#fff' : 'var(--text-muted)', padding: '0 6px', borderRadius: '8px' }}>{s.badge}</span>}
            </button>
          )
        })}
      </div>

      {sub === 'honorare' && (
      <>
      {/* ── Zeiterfassung / Leistungen & Zeiten ── */}
      <ZeiterfassungBlock client={client} onUpdate={onUpdate} />

      {/* ── Zusammenfassung ── */}
      {honorare.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          <SumKachel label="Monatlich (laufend)" wert={fmtEuro(monatsSumme)} color={ACCENT} icon="📅" />
          <SumKachel label="Jahreswert (laufend)" wert={fmtEuro(jahresSumme)} color="#16a34a" icon="📆" />
          {einmaligList.length > 0 && (
            <SumKachel label={`Einmalig (${einmaligList.length})`} wert={fmtEuro(einmaligList.reduce((s, h) => s + h.betrag, 0))} color="#f97316" icon="⚡" />
          )}
          {aufwandList.length > 0 && (
            <SumKachel label="Nach Aufwand" wert={`${aufwandList.length} Pos.`} color="#64748b" icon="⏱" isText />
          )}
        </div>
      )}

      {/* Warnung: einmalige Honorare ohne Jahr */}
      {ohneJahr.length > 0 && (
        <div style={{ border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px', padding: '9px 12px', background: 'rgba(249,115,22,0.06)', fontSize: '12px', color: '#f97316', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⚠ <span><strong>{ohneJahr.length} Position{ohneJahr.length !== 1 ? 'en' : ''}</strong> ohne Leistungsjahr — diese erscheinen nicht in der jahresbasierten Budgetübersicht.</span>
        </div>
      )}

      {/* ── Hauptbereich ── */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ background: ACCENT, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '16px' }}>💰</span>
          <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Honorare & Preisvereinbarungen</span>
          {honorare.length > 0 && (
            <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.2)', padding: '1px 8px', borderRadius: '10px' }}>
              {aktive.length} aktiv · {honorare.length} gesamt
            </span>
          )}
          {!showForm && (
            <button onClick={() => setShowForm(true)}
              style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              + Neu
            </button>
          )}
        </div>

        <div style={{ padding: '12px', background: 'var(--surface2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {showForm && (
            <HonorarForm initial={mkHonorar()} isNew={true} onSave={addHonorar} onCancel={() => setShowForm(false)} />
          )}

          {honorare.length === 0 && !showForm && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>💰</div>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px', color: 'var(--text)' }}>Noch keine Preisvereinbarungen</div>
              <div style={{ fontSize: '12px', marginBottom: '14px' }}>Hinterlege Honorare — sie fließen in die globale Budgetübersicht ein.</div>
              <button onClick={() => setShowForm(true)}
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: ACCENT, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                + Erste Vereinbarung anlegen
              </button>
            </div>
          )}

          {aktiveHonorare.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {aktiveHonorare.map(h => (
                <HonorarKarte key={h.id} h={h} onUpdate={updateHonorar} onDelete={() => deleteHonorar(h.id)} />
              ))}
            </div>
          )}

          {inaktiveHonorare.length > 0 && (
            <InaktiveSection honorare={inaktiveHonorare} onUpdate={updateHonorar} onDelete={deleteHonorar} />
          )}
        </div>
      </div>

      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6, padding: '0 2px' }}>
        💡 Diese Preisvereinbarungen sind rein intern zur Planung und ersetzen keine Buchhaltung.
        Alle aktiven Positionen erscheinen in der globalen <strong>Honorar-Übersicht</strong> in der Seitenleiste.
      </div>
      </>
      )}

      {/* ── Rechnung erstellen (sevDesk) ── */}
      {sub === 'rechnung' && (
        <RechnungSevdeskBlock client={client} onUpdate={onUpdate} signaturen={emailSignaturen} />
      )}

      {/* ── Dauerrechnungen (wiederkehrend) ── */}
      {sub === 'dauer' && (
        <DauerrechnungenBlock client={client} onUpdate={onUpdate} />
      )}
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
