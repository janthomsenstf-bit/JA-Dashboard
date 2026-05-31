import { useState, useMemo } from 'react'

// ── Konfiguration (auch von AuftragKontextPanel genutzt) ──────────────────────
export const AUFTRAGS_TYP_CFG = {
  jahresabschluss: { label: 'Jahresabschluss', icon: '📁', color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.25)' },
  fibu:            { label: 'Buchhaltung/FIBU', icon: '📒', color: '#0891b2', bg: 'rgba(8,145,178,0.08)',  border: 'rgba(8,145,178,0.25)' },
  lohn:            { label: 'Lohn',             icon: '💼', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)' },
  beratung:        { label: 'Beratung',          icon: '🧠', color: '#16a34a', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.25)' },
  ust:             { label: 'Umsatzsteuer',      icon: '🧾', color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)' },
  freitext:        { label: 'Eigener Auftrag',   icon: '📝', color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.25)' },
}

export const AUFTRAGS_STATUS_CFG = {
  offen:          { label: 'Offen',          icon: '○', color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.3)' },
  in_bearbeitung: { label: 'In Bearbeitung', icon: '◑', color: '#2563eb', bg: 'rgba(37,99,235,0.09)',  border: 'rgba(37,99,235,0.3)' },
  erledigt:       { label: 'Erledigt',       icon: '●', color: '#16a34a', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.3)' },
}

const MONATE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
const STATUS_ORDER = ['offen', 'in_bearbeitung', 'erledigt']

// ── Jahresabschluss-Checkliste ──────────────────────────────────────────────────
const JA_CHECKLISTE_ITEMS = [
  { key: 'est',         label: 'Einkommensteuererklärung',    col1: 'an Mandant gesendet', col2: 'ans Finanzamt gesendet' },
  { key: 'gewst',       label: 'Gewerbesteuererklärung',      col1: 'an Mandant gesendet', col2: 'ans Finanzamt gesendet' },
  { key: 'kst',         label: 'Körperschaftsteuererklärung', col1: 'an Mandant gesendet', col2: 'ans Finanzamt gesendet' },
  { key: 'ust',         label: 'Umsatzsteuererklärung',       col1: 'an Mandant gesendet', col2: 'ans Finanzamt gesendet' },
  { key: 'ebilanz',     label: 'E-Bilanz',                    col1: 'an Mandant gesendet', col2: 'übermittelt' },
  { key: 'offenlegung', label: 'Offenlegung',                 col1: 'an Mandant gesendet', col2: 'offengelegt' },
  { key: 'rechnung',    label: 'Rechnung',                    col1: null,                   col2: 'an Mandant gesendet' },
]

// ── Batch-Serien (Feature 4): Mehrere Einzelaufträge auf einmal anlegen ───────
const SERIE_RHYTHMUS = [
  { key: 'monatlich',     label: 'Monatlich (12×)',    monate: [1,2,3,4,5,6,7,8,9,10,11,12] },
  { key: 'quartalsweise', label: 'Quartalsweise (4×)', monate: [3,6,9,12] },
  { key: 'halbjaehrlich', label: 'Halbjährlich (2×)',  monate: [6,12] },
  { key: 'jaehrlich',     label: 'Jährlich (1×)',      monate: [12] },
]

const FRIST_DEFAULTS = {
  lohn:            { modus: 'gleicher',   tag: 22 },
  fibu:            { modus: 'folgemonat', tag: 10 },
  ust:             { modus: 'folgemonat', tag: 10 },
  jahresabschluss: { modus: 'kein',       tag: 1  },
  beratung:        { modus: 'kein',       tag: 1  },
  freitext:        { modus: 'kein',       tag: 1  },
}

function calcFrist(ljahr, lmonat, modus, tag, tage) {
  if (modus === 'kein') return ''
  if (modus === 'tage') {
    const lastDay = new Date(ljahr, lmonat, 0)
    lastDay.setDate(lastDay.getDate() + (tage || 0))
    return lastDay.toISOString().slice(0, 10)
  }
  let fJahr = ljahr; let fMonat = lmonat
  if (modus === 'folgemonat') {
    fMonat++
    if (fMonat > 12) { fMonat = 1; fJahr++ }
  }
  const maxDay = new Date(fJahr, fMonat, 0).getDate()
  const d      = Math.min(Math.max(1, tag || 1), maxDay)
  return `${fJahr}-${String(fMonat).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ── Wiederholungslogik (Feature 5): Echter Serienauftrag ──────────────────────
export const INTERVALL_TYPEN = [
  { key: 'tage',     label: 'Tag(e)',      short: 'täglich'       },
  { key: 'wochen',   label: 'Woche(n)',    short: 'wöchentlich'   },
  { key: 'monate',   label: 'Monat(e)',    short: 'monatlich'     },
  { key: 'quartale', label: 'Quartal(e)',  short: 'quartalsweise' },
  { key: 'jahre',    label: 'Jahr(e)',     short: 'jährlich'      },
]

/**
 * Berechnet das nächste Datum basierend auf Intervalltyp und -wert.
 * Gibt immer ein neues Date-Objekt zurück.
 */
export function addIntervalDate(date, typ, wert) {
  const d = new Date(date)
  const n = wert || 1
  if (typ === 'tage')     { d.setDate(d.getDate() + n);                 return d }
  if (typ === 'wochen')   { d.setDate(d.getDate() + n * 7);             return d }
  if (typ === 'monate')   { d.setMonth(d.getMonth() + n);               return d }
  if (typ === 'quartale') { d.setMonth(d.getMonth() + n * 3);           return d }
  if (typ === 'jahre')    { d.setFullYear(d.getFullYear() + n);         return d }
  return d
}

/**
 * Generiert alle Instanzen eines Serienauftrags.
 * Für endTyp='kein' werden Instanzen bis 93 Tage in die Zukunft erzeugt.
 *
 * @param {object} au          – Auftrag mit istSerie=true und au.serie config
 * @param {number} maxInstances – Sicherheits-Cap
 * @returns {Array<{key:string, datum:Date, status:string, erledigtAm:string|null}>}
 */
export function generateSerieInstanzen(au, maxInstances = 300) {
  const serie = au.serie
  if (!serie || !serie.startDatum) return []

  const instanzenMap = au.instanzen ?? {}
  const heute    = new Date(); heute.setHours(0, 0, 0, 0)
  const horizont = new Date(heute); horizont.setDate(horizont.getDate() + 93)  // ~3 Monate

  const ergebnis = []
  let current = new Date(serie.startDatum + 'T00:00:00')
  let count   = 0

  while (count < maxInstances) {
    // Ende-Bedingung prüfen
    if (serie.endTyp === 'datum' && serie.endDatum) {
      if (current > new Date(serie.endDatum + 'T23:59:59')) break
    } else if (serie.endTyp === 'anzahl') {
      if (count >= (serie.endAnzahl || 12)) break
    } else {
      // 'kein' oder default: bis Horizont
      if (current > horizont) break
    }

    const key     = current.toISOString().slice(0, 10)
    const instanz = instanzenMap[key] ?? {}
    ergebnis.push({
      key,
      datum:      new Date(current),
      status:     instanz.status     ?? 'offen',
      erledigtAm: instanz.erledigtAm ?? null,
    })

    current = addIntervalDate(current, serie.intervallTyp || 'monate', serie.intervallWert || 1)
    count++
  }

  return ergebnis
}

/**
 * Gibt einen lesbaren Label für das Wiederholungsintervall zurück.
 */
export function intervallLabel(serie) {
  if (!serie) return ''
  const wert = serie.intervallWert || 1
  const typ  = INTERVALL_TYPEN.find(t => t.key === serie.intervallTyp)
  if (!typ) return ''
  if (wert === 1) return typ.short.charAt(0).toUpperCase() + typ.short.slice(1)
  return `Alle ${wert} ${typ.label}`
}

// ── Factories ─────────────────────────────────────────────────────────────────
function mkAuftrag(typ = 'freitext') {
  return {
    id:          'au_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    typ,
    bezeichnung: '',
    jahr:        new Date().getFullYear(),
    monat:       null,
    frist:       '',
    status:      'offen',
    notiz:       '',
    hinweise:    [],
    erstelltAm:  new Date().toISOString(),
    erledigtAm:  null,
  }
}

function mkSerienauftrag(typ = 'fibu') {
  const heute      = new Date()
  const startDatum = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-01`
  return {
    id:          'au_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    typ,
    bezeichnung: '',
    istSerie:    true,
    serie: {
      startDatum,
      intervallTyp:  'monate',
      intervallWert: 1,
      endTyp:        'kein',
      endDatum:      '',
      endAnzahl:     12,
    },
    instanzen:  {},
    notiz:      '',
    erstelltAm: new Date().toISOString(),
  }
}

function mkHinweis(text) {
  return {
    id:        'h_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
    text,
    erledigt:  false,
    createdAt: new Date().toISOString(),
  }
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function fmtFrist(iso) {
  if (!iso) return null
  const d     = new Date(iso + 'T12:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff  = Math.ceil((d - today) / (1000 * 60 * 60 * 24))
  const ds    = `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
  if (diff < 0)   return { text: `${ds} (${Math.abs(diff)}d überfällig)`, color: '#ef4444' }
  if (diff === 0) return { text: `${ds} (heute)`,    color: '#f97316' }
  if (diff <= 7)  return { text: `${ds} (${diff}d)`, color: '#f97316' }
  if (diff <= 30) return { text: `${ds} (${diff}d)`, color: '#eab308' }
  return { text: ds, color: 'var(--text-muted)' }
}

function fmtDatumShort(d) {
  if (!d) return '—'
  const dt = d instanceof Date ? d : new Date(d + 'T00:00:00')
  return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`
}

// ── Shared Styles ─────────────────────────────────────────────────────────────
const labelStyle = { fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const inputStyle  = { padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', width: '100%', boxSizing: 'border-box' }

// ── Jahresabschluss-Checkliste-Komponente ─────────────────────────────────────
function JAChecklisteSection({ jaCheckliste = {}, onUpdate }) {
  const today = new Date().toISOString().slice(0, 10)

  function setDatum(itemKey, field, value) {
    const current = jaCheckliste[itemKey] ?? {}
    onUpdate({
      jaCheckliste: {
        ...jaCheckliste,
        [itemKey]: { ...current, [field]: value },
      },
    })
  }

  function toggleCheck(itemKey, field) {
    const current = jaCheckliste[itemKey] ?? {}
    const hasDatum = !!current[field]
    setDatum(itemKey, field, hasDatum ? '' : today)
  }

  const totalFields = JA_CHECKLISTE_ITEMS.reduce((n, it) => n + (it.col1 ? 1 : 0) + 1, 0)
  const doneFields = JA_CHECKLISTE_ITEMS.reduce((n, it) => {
    const d = jaCheckliste[it.key] ?? {}
    return n + (it.col1 && d.mandantDatum ? 1 : 0) + (d.faDatum ? 1 : 0)
  }, 0)
  const progress = totalFields > 0 ? Math.round((doneFields / totalFields) * 100) : 0

  const cellBase = { padding: '7px 8px', fontSize: '12px', borderBottom: '1px solid var(--border)' }
  const headerCell = { ...cellBase, fontWeight: 700, color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--surface2)' }

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          📋 Abschluss-Checkliste
        </div>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: '10px', fontWeight: 700, padding: '2px 10px', borderRadius: '10px',
          background: progress === 100 ? 'rgba(22,163,74,0.12)' : progress > 0 ? 'rgba(37,99,235,0.08)' : 'var(--surface2)',
          color: progress === 100 ? '#16a34a' : progress > 0 ? '#2563eb' : 'var(--text-muted)',
          border: `1px solid ${progress === 100 ? 'rgba(22,163,74,0.3)' : progress > 0 ? 'rgba(37,99,235,0.25)' : 'var(--border)'}`,
        }}>
          {progress === 100 ? '✓ Vollständig' : `${doneFields}/${totalFields} erledigt`}
        </span>
      </div>

      {/* Fortschrittsbalken */}
      <div style={{ height: '4px', borderRadius: '2px', background: 'var(--surface2)', marginBottom: '12px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '2px', transition: 'width 0.3s',
          width: `${progress}%`,
          background: progress === 100 ? '#16a34a' : '#2563eb',
        }} />
      </div>

      {/* Tabelle */}
      <div style={{ borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...headerCell, textAlign: 'left', width: '35%' }}>Erklärung / Meldung</th>
              <th style={{ ...headerCell, textAlign: 'center', width: '32.5%' }}>an Mandant gesendet</th>
              <th style={{ ...headerCell, textAlign: 'center', width: '32.5%' }}>ans FA / erledigt</th>
            </tr>
          </thead>
          <tbody>
            {JA_CHECKLISTE_ITEMS.map((item, idx) => {
              const data = jaCheckliste[item.key] ?? {}
              const hasMandant = !!data.mandantDatum
              const hasFa = !!data.faDatum
              const isLast = idx === JA_CHECKLISTE_ITEMS.length - 1

              return (
                <tr key={item.key} style={{ background: (hasMandant || !item.col1) && hasFa ? 'rgba(22,163,74,0.03)' : 'transparent' }}>
                  {/* Label */}
                  <td style={{ ...cellBase, fontWeight: 500, color: 'var(--text)', borderBottom: isLast ? 'none' : cellBase.borderBottom }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {(hasMandant || !item.col1) && hasFa
                        ? <span style={{ color: '#16a34a', fontSize: '13px' }}>✓</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>○</span>
                      }
                      {item.label}
                    </div>
                  </td>

                  {/* Spalte 1: an Mandant */}
                  <td style={{ ...cellBase, textAlign: 'center', borderBottom: isLast ? 'none' : cellBase.borderBottom }}>
                    {item.col1 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <input
                          type="checkbox"
                          checked={hasMandant}
                          onChange={() => toggleCheck(item.key, 'mandantDatum')}
                          style={{ accentColor: '#2563eb', cursor: 'pointer', width: '14px', height: '14px' }}
                          title={item.col1}
                        />
                        <input
                          type="date"
                          value={data.mandantDatum || ''}
                          onChange={e => setDatum(item.key, 'mandantDatum', e.target.value)}
                          style={{
                            padding: '3px 6px', borderRadius: '5px', fontSize: '11px',
                            border: '1px solid var(--border)', background: hasMandant ? 'rgba(22,163,74,0.06)' : 'var(--surface2)',
                            color: hasMandant ? '#16a34a' : 'var(--text)', fontFamily: 'var(--font-mono)',
                            width: '120px',
                          }}
                        />
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                    )}
                  </td>

                  {/* Spalte 2: ans FA / erledigt */}
                  <td style={{ ...cellBase, textAlign: 'center', borderBottom: isLast ? 'none' : cellBase.borderBottom }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <input
                        type="checkbox"
                        checked={hasFa}
                        onChange={() => toggleCheck(item.key, 'faDatum')}
                        style={{ accentColor: '#16a34a', cursor: 'pointer', width: '14px', height: '14px' }}
                        title={item.col2}
                      />
                      <input
                        type="date"
                        value={data.faDatum || ''}
                        onChange={e => setDatum(item.key, 'faDatum', e.target.value)}
                        style={{
                          padding: '3px 6px', borderRadius: '5px', fontSize: '11px',
                          border: '1px solid var(--border)', background: hasFa ? 'rgba(22,163,74,0.06)' : 'var(--surface2)',
                          color: hasFa ? '#16a34a' : 'var(--text)', fontFamily: 'var(--font-mono)',
                          width: '120px',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
        Haken setzen → heutiges Datum wird automatisch eingetragen. Datum kann manuell angepasst werden.
      </div>
    </div>
  )
}

// ── Einzelauftrag-Karte ───────────────────────────────────────────────────────
function AuftragCard({ au, expanded, onExpand, onUpdate, onDelete }) {
  const typCfg    = AUFTRAGS_TYP_CFG[au.typ]      ?? AUFTRAGS_TYP_CFG.freitext
  const statusCfg = AUFTRAGS_STATUS_CFG[au.status] ?? AUFTRAGS_STATUS_CFG.offen
  const frist     = fmtFrist(au.frist)
  const hinweise  = au.hinweise ?? []
  const offeneH   = hinweise.filter(h => !h.erledigt).length

  const [newH, setNewH] = useState('')

  function cycleStatus(e) {
    e.stopPropagation()
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(au.status) + 1) % STATUS_ORDER.length]
    onUpdate({ status: next, erledigtAm: next === 'erledigt' ? new Date().toISOString() : null })
  }

  function addHinweis() {
    const t = newH.trim(); if (!t) return
    onUpdate({ hinweise: [...hinweise, mkHinweis(t)] })
    setNewH('')
  }

  const titel = au.bezeichnung || `${typCfg.label}${au.monat ? ' ' + MONATE[au.monat - 1] : ''} ${au.jahr}`

  return (
    <div style={{
      border: `1px solid ${expanded ? typCfg.color + '55' : 'var(--border)'}`,
      borderRadius: '10px', background: 'var(--surface)', overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      <div
        onClick={() => onExpand(expanded ? null : au.id)}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', background: expanded ? typCfg.bg : 'transparent', userSelect: 'none' }}
      >
        <span style={{ fontSize: '16px', flexShrink: 0 }}>{typCfg.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: au.status === 'erledigt' ? 'var(--text-muted)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: au.status === 'erledigt' ? 'line-through' : 'none' }}>
            {titel}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '3px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: typCfg.color, fontWeight: 600, background: typCfg.bg, padding: '1px 6px', borderRadius: '8px', border: `1px solid ${typCfg.border}` }}>
              {typCfg.label}
            </span>
            {au.monat
              ? <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{MONATE[au.monat - 1]} {au.jahr}</span>
              : au.jahr && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{au.jahr}</span>
            }
            {frist && <span style={{ fontSize: '10px', fontWeight: 600, color: frist.color }}>⏰ {frist.text}</span>}
            {offeneH > 0 && <span style={{ fontSize: '10px', color: '#f97316', fontWeight: 600 }}>· {offeneH} Hinweis{offeneH !== 1 ? 'e' : ''} offen</span>}
          </div>
        </div>
        <button onClick={cycleStatus} title="Status wechseln"
          style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', border: `1px solid ${statusCfg.border}`, background: statusCfg.bg, color: statusCfg.color, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {statusCfg.icon} {statusCfg.label}
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: '10px', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${typCfg.color}33`, padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px', marginBottom: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Bezeichnung</span>
              <input value={au.bezeichnung} onChange={e => onUpdate({ bezeichnung: e.target.value })} placeholder="z. B. Lohn Juni 2026" style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Typ</span>
              <select value={au.typ} onChange={e => onUpdate({ typ: e.target.value })} style={inputStyle}>
                {Object.entries(AUFTRAGS_TYP_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Jahr</span>
              <input type="number" value={au.jahr} min="2020" max="2035"
                onChange={e => onUpdate({ jahr: parseInt(e.target.value) || au.jahr })} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Monat</span>
              <select value={au.monat ?? ''} onChange={e => onUpdate({ monat: e.target.value ? parseInt(e.target.value) : null })} style={inputStyle}>
                <option value="">— keiner —</option>
                {MONATE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Interne Frist</span>
              <input type="date" value={au.frist} onChange={e => onUpdate({ frist: e.target.value })} style={inputStyle} />
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: au.emailRef ? '8px' : '14px' }}>
            <span style={labelStyle}>Notiz / Kontext</span>
            <textarea value={au.notiz} rows={2} onChange={e => onUpdate({ notiz: e.target.value })}
              placeholder="Interne Anmerkungen zum Auftrag…" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </label>

          {/* E-Mail-Quelle (wenn aus E-Mail erstellt) */}
          {au.emailRef && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(22,163,74,0.04)', border: '1px solid rgba(22,163,74,0.15)', marginBottom: '14px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', flex: 1, minWidth: 0 }}>
                📧 Quelle: E-Mail von <b>{au.emailRef.absender}</b>
                {au.emailRef.betreff && <> — {au.emailRef.betreff}</>}
              </span>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
              Hinweise &amp; Unteraufgaben
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <input value={newH} onChange={e => setNewH(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (() => { const t = newH.trim(); if (!t) return; onUpdate({ hinweise: [...hinweise, mkHinweis(t)] }); setNewH('') })()}
                placeholder="Hinweis eingeben… (Enter)" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => { const t = newH.trim(); if (!t) return; onUpdate({ hinweise: [...hinweise, mkHinweis(t)] }); setNewH('') }}
                style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: typCfg.color, color: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>
                +
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {hinweise.length === 0
                ? <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Noch keine Hinweise.</div>
                : hinweise.map(h => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', background: h.erledigt ? 'rgba(22,163,74,0.04)' : 'var(--surface2)', border: `1px solid ${h.erledigt ? 'rgba(22,163,74,0.2)' : 'var(--border)'}` }}>
                    <input type="checkbox" checked={h.erledigt}
                      onChange={() => onUpdate({ hinweise: hinweise.map(x => x.id === h.id ? { ...x, erledigt: !x.erledigt } : x) })}
                      style={{ accentColor: typCfg.color, cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '12px', color: h.erledigt ? 'var(--text-muted)' : 'var(--text)', textDecoration: h.erledigt ? 'line-through' : 'none' }}>
                      {h.text}
                    </span>
                    <button onClick={() => onUpdate({ hinweise: hinweise.filter(x => x.id !== h.id) })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '0 2px', flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>✕</button>
                  </div>
                ))
              }
            </div>
          </div>

          {/* ── Jahresabschluss-Checkliste (nur für Typ jahresabschluss) ── */}
          {au.typ === 'jahresabschluss' && (
            <JAChecklisteSection
              jaCheckliste={au.jaCheckliste}
              onUpdate={patch => onUpdate(patch)}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <button onClick={onDelete}
              style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' }}>
              🗑 Auftrag löschen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Serienauftrag-Karte (echter Wiederholungsauftrag) ─────────────────────────
function SerienAuftragCard({ au, expanded, onExpand, onUpdate, onDelete }) {
  const typCfg    = AUFTRAGS_TYP_CFG[au.typ] ?? AUFTRAGS_TYP_CFG.freitext
  const serie     = au.serie ?? {}
  const instanzen = useMemo(() => generateSerieInstanzen(au), [au])
  const [showAll, setShowAll] = useState(false)

  const heute = new Date(); heute.setHours(0, 0, 0, 0)

  const cntErledigt  = instanzen.filter(i => i.status === 'erledigt').length
  const cntOffen     = instanzen.filter(i => i.status === 'offen').length
  const cntInBearb   = instanzen.filter(i => i.status === 'in_bearbeitung').length
  const cntUeberfaellig = instanzen.filter(i => i.status !== 'erledigt' && i.datum < heute).length

  function cycleInstanzStatus(key, currentStatus) {
    const next      = STATUS_ORDER[(STATUS_ORDER.indexOf(currentStatus) + 1) % STATUS_ORDER.length]
    const instanzen = { ...(au.instanzen ?? {}), [key]: { status: next, erledigtAm: next === 'erledigt' ? new Date().toISOString() : null } }
    onUpdate({ instanzen })
  }

  function updateSerie(patch) {
    onUpdate({ serie: { ...serie, ...patch } })
  }

  const titelLabel = au.bezeichnung || `${typCfg.label} – ${intervallLabel(serie)}`

  return (
    <div style={{
      border: `1px solid ${expanded ? 'rgba(99,102,241,0.55)' : 'rgba(99,102,241,0.3)'}`,
      borderRadius: '10px', background: 'var(--surface)', overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      {/* ── Kopfzeile ── */}
      <div
        onClick={() => onExpand(expanded ? null : au.id)}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', background: expanded ? 'rgba(99,102,241,0.05)' : 'transparent', userSelect: 'none' }}
      >
        <span style={{ fontSize: '16px', flexShrink: 0 }}>🔁</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {titelLabel}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '3px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: typCfg.color, fontWeight: 600, background: typCfg.bg, padding: '1px 6px', borderRadius: '8px', border: `1px solid ${typCfg.border}` }}>
              {typCfg.icon} {typCfg.label}
            </span>
            <span style={{ fontSize: '10px', color: 'rgba(99,102,241,0.9)', fontWeight: 600, background: 'rgba(99,102,241,0.08)', padding: '1px 6px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.25)' }}>
              🔁 {intervallLabel(serie)}
            </span>
            {cntUeberfaellig > 0 && <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700 }}>⚠ {cntUeberfaellig} überfällig</span>}
            {cntInBearb > 0  && <span style={{ fontSize: '10px', color: '#2563eb' }}>◑ {cntInBearb} in Bearb.</span>}
            {cntOffen > 0    && <span style={{ fontSize: '10px', color: '#64748b' }}>○ {cntOffen} offen</span>}
            {cntErledigt > 0 && <span style={{ fontSize: '10px', color: '#16a34a' }}>✓ {cntErledigt}×</span>}
          </div>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '10px', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* ── Detail-Bereich ── */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(99,102,241,0.2)', padding: '14px 16px' }}>

          {/* Konfiguration */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Bezeichnung</span>
              <input value={au.bezeichnung} onChange={e => onUpdate({ bezeichnung: e.target.value })}
                placeholder="z. B. FIBU monatlich" style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Typ</span>
              <select value={au.typ} onChange={e => onUpdate({ typ: e.target.value })} style={inputStyle}>
                {Object.entries(AUFTRAGS_TYP_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Startdatum</span>
              <input type="date" value={serie.startDatum ?? ''} onChange={e => updateSerie({ startDatum: e.target.value })} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Wiederholung</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input type="number" min={1} max={99} value={serie.intervallWert ?? 1}
                  onChange={e => updateSerie({ intervallWert: Math.max(1, parseInt(e.target.value) || 1) })}
                  style={{ ...inputStyle, width: '54px', flex: 'none' }} />
                <select value={serie.intervallTyp ?? 'monate'}
                  onChange={e => updateSerie({ intervallTyp: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}>
                  {INTERVALL_TYPEN.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Ende</span>
              <select value={serie.endTyp ?? 'kein'} onChange={e => updateSerie({ endTyp: e.target.value })} style={inputStyle}>
                <option value="kein">Fortlaufend (~3 Mo. voraus)</option>
                <option value="datum">Am Datum</option>
                <option value="anzahl">Nach N Terminen</option>
              </select>
            </label>
            {serie.endTyp === 'datum' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={labelStyle}>Enddatum</span>
                <input type="date" value={serie.endDatum ?? ''} onChange={e => updateSerie({ endDatum: e.target.value })} style={inputStyle} />
              </label>
            )}
            {serie.endTyp === 'anzahl' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={labelStyle}>Anzahl Termine</span>
                <input type="number" min={1} max={300} value={serie.endAnzahl ?? 12}
                  onChange={e => updateSerie({ endAnzahl: Math.max(1, parseInt(e.target.value) || 1) })}
                  style={inputStyle} />
              </label>
            )}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
            <span style={labelStyle}>Notiz / Kontext</span>
            <textarea value={au.notiz ?? ''} rows={2} onChange={e => onUpdate({ notiz: e.target.value })}
              placeholder="Interne Anmerkungen…" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
          </label>

          {/* ── Instanzen-Zeitstrahl ── */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Termine ({instanzen.length})
              </span>
              {instanzen.length > 8 && (
                <button onClick={() => setShowAll(v => !v)}
                  style={{ fontSize: '10px', background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showAll ? 'Kompakt' : `Alle ${instanzen.length} anzeigen`}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: showAll ? 'none' : '220px', overflowY: showAll ? 'visible' : 'auto' }}>
              {instanzen.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Keine Termine generiert – Startdatum und Endbedingung prüfen.</div>
              ) : instanzen.map(inst => {
                const stCfg      = AUFTRAGS_STATUS_CFG[inst.status] ?? AUFTRAGS_STATUS_CFG.offen
                const istVergangen = inst.datum < heute
                const istHeute     = inst.datum.toDateString() === heute.toDateString()
                return (
                  <div key={inst.key} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '5px 10px', borderRadius: '6px',
                    background: istHeute ? 'rgba(59,130,246,0.07)' : inst.status === 'erledigt' ? 'rgba(22,163,74,0.03)' : 'var(--surface2)',
                    border: `1px solid ${istHeute ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                  }}>
                    <span style={{
                      fontSize: '11px', fontFamily: 'monospace', minWidth: '75px', flexShrink: 0,
                      color: istVergangen && inst.status !== 'erledigt' ? '#ef4444' : istHeute ? '#3b82f6' : 'var(--text-muted)',
                      fontWeight: istHeute ? 700 : 400,
                    }}>
                      {fmtDatumShort(inst.datum)}{istHeute ? ' ◀' : ''}
                    </span>
                    <span style={{ flex: 1, fontSize: '11px', color: inst.status === 'erledigt' ? 'var(--text-muted)' : 'var(--text)', textDecoration: inst.status === 'erledigt' ? 'line-through' : 'none' }}>
                      {au.bezeichnung || `${typCfg.label} ${MONATE[inst.datum.getMonth()]} ${inst.datum.getFullYear()}`}
                    </span>
                    <button onClick={() => cycleInstanzStatus(inst.key, inst.status)} title="Status wechseln"
                      style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', border: `1px solid ${stCfg.border}`, background: stCfg.bg, color: stCfg.color, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {stCfg.icon} {stCfg.label}
                    </button>
                    {inst.erledigtAm && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {new Date(inst.erledigtAm).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {serie.endTyp === 'kein' && (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
                Fortlaufend – zeigt Termine bis 3 Monate im Voraus. Vergangene Termine bleiben sichtbar.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <button onClick={onDelete}
              style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' }}>
              🗑 Serienauftrag löschen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Batch-Serie Panel (Feature 4) ─────────────────────────────────────────────
const FRIST_MODI = [
  { key: 'kein',       label: 'Keine Frist'           },
  { key: 'gleicher',   label: 'Gleicher Monat'         },
  { key: 'folgemonat', label: 'Folgemonat'             },
  { key: 'tage',       label: 'X Tage nach Monatsende' },
]

function BatchSeriePanel({ onCreate, onClose }) {
  const initDef = FRIST_DEFAULTS.lohn
  const [typ,        setTyp]        = useState('lohn')
  const [jahr,       setJahr]       = useState(new Date().getFullYear())
  const [rhythmus,   setRhythmus]   = useState('monatlich')
  const [fristModus, setFristModus] = useState(initDef.modus)
  const [fristTag,   setFristTag]   = useState(initDef.tag)
  const [fristTage,  setFristTage]  = useState(10)

  function handleTypChange(newTyp) {
    setTyp(newTyp)
    const def = FRIST_DEFAULTS[newTyp]
    if (def) { setFristModus(def.modus); setFristTag(def.tag) }
  }

  const monate   = SERIE_RHYTHMUS.find(r => r.key === rhythmus)?.monate ?? []
  const vorschau = monate.map(monat => ({ monat, frist: calcFrist(jahr, monat, fristModus, fristTag, fristTage) }))
  const smallInput = { ...inputStyle, width: '62px', flex: 'none', padding: '5px 8px' }

  const fmtPrev = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontWeight: 700, fontSize: '13px' }}>📅 Batch-Serie anlegen</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>– erstellt {monate.length} Einzelaufträge</span>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px' }}>✕</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: '10px', marginBottom: '12px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Typ</span>
          <select value={typ} onChange={e => handleTypChange(e.target.value)} style={inputStyle}>
            {Object.entries(AUFTRAGS_TYP_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Jahr</span>
          <input type="number" value={jahr} min="2020" max="2035" onChange={e => setJahr(parseInt(e.target.value) || jahr)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Rhythmus</span>
          <select value={rhythmus} onChange={e => setRhythmus(e.target.value)} style={inputStyle}>
            {SERIE_RHYTHMUS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </label>
      </div>

      <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
        <div style={{ ...labelStyle, display: 'block', marginBottom: '8px' }}>Fristlogik</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {FRIST_MODI.map(o => (
            <button key={o.key} type="button" onClick={() => setFristModus(o.key)} style={{
              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
              border: `1px solid ${fristModus === o.key ? 'var(--accent)' : 'var(--border)'}`,
              background: fristModus === o.key ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: fristModus === o.key ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: fristModus === o.key ? 700 : 400,
            }}>{o.label}</button>
          ))}
          {(fristModus === 'gleicher' || fristModus === 'folgemonat') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tag:</span>
              <input type="number" min={1} max={28} value={fristTag}
                onChange={e => setFristTag(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))} style={smallInput} />
            </div>
          )}
          {fristModus === 'tage' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '4px' }}>
              <input type="number" min={0} max={90} value={fristTage}
                onChange={e => setFristTage(Math.max(0, parseInt(e.target.value) || 0))} style={smallInput} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tage nach Monatsende</span>
            </div>
          )}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
          {fristModus === 'kein'       && 'Kein Fälligkeitsdatum.'}
          {fristModus === 'gleicher'   && `${fristTag}. des Leistungsmonats`}
          {fristModus === 'folgemonat' && `${fristTag}. des Folgemonats`}
          {fristModus === 'tage'       && `${fristTage} Tag${fristTage !== 1 ? 'e' : ''} nach Monatsende`}
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ ...labelStyle, display: 'block', marginBottom: '6px' }}>Vorschau – {monate.length} Aufträge</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px' }}>
          {vorschau.map(({ monat, frist }) => (
            <div key={monat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', background: 'var(--surface2)', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '11px' }}>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{MONATE[monat - 1]} {jahr}</span>
              <span style={{ color: frist ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'monospace', fontSize: '10px' }}>
                {frist ? `→ ${fmtPrev(frist)}` : '→ —'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>Abbrechen</button>
        <button onClick={() => onCreate(typ, jahr, monate, { modus: fristModus, tag: fristTag, tage: fristTage })}
          style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
          ✓ {monate.length} Aufträge anlegen
        </button>
      </div>
    </div>
  )
}

// ── Serienauftrag-Erstellen-Panel (Feature 5) ─────────────────────────────────
function SerieErstellenPanel({ onCreate, onClose }) {
  const [typ,           setTyp]           = useState('fibu')
  const [bezeichnung,   setBezeichnung]   = useState('')
  const [startDatum,    setStartDatum]    = useState(() => {
    const h = new Date()
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [intervallTyp,  setIntervallTyp]  = useState('monate')
  const [intervallWert, setIntervallWert] = useState(1)
  const [endTyp,        setEndTyp]        = useState('kein')
  const [endDatum,      setEndDatum]      = useState('')
  const [endAnzahl,     setEndAnzahl]     = useState(12)

  const vorschau = useMemo(() => {
    const mock = {
      serie: { startDatum, intervallTyp, intervallWert: Number(intervallWert), endTyp, endDatum, endAnzahl: Number(endAnzahl) },
      instanzen: {},
    }
    return generateSerieInstanzen(mock, 6)
  }, [startDatum, intervallTyp, intervallWert, endTyp, endDatum, endAnzahl])

  function handleCreate() {
    const au = mkSerienauftrag(typ)
    au.bezeichnung = bezeichnung.trim()
    au.serie = { startDatum, intervallTyp, intervallWert: Number(intervallWert), endTyp, endDatum, endAnzahl: Number(endAnzahl) }
    onCreate(au)
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid rgba(99,102,241,0.5)', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontWeight: 700, fontSize: '13px' }}>🔁 Serienauftrag anlegen</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>– ein Eintrag, automatisch fortgeführt</span>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px' }}>✕</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Typ</span>
          <select value={typ} onChange={e => setTyp(e.target.value)} style={inputStyle}>
            {Object.entries(AUFTRAGS_TYP_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Bezeichnung (optional)</span>
          <input value={bezeichnung} onChange={e => setBezeichnung(e.target.value)}
            placeholder="z. B. FIBU lfd., Lohn monatlich" style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Startdatum</span>
          <input type="date" value={startDatum} onChange={e => setStartDatum(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Wiederholung</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input type="number" min={1} max={99} value={intervallWert}
              onChange={e => setIntervallWert(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ ...inputStyle, width: '50px', flex: 'none' }} />
            <select value={intervallTyp} onChange={e => setIntervallTyp(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              {INTERVALL_TYPEN.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Ende</span>
          <select value={endTyp} onChange={e => setEndTyp(e.target.value)} style={inputStyle}>
            <option value="kein">Fortlaufend (~3 Mo. voraus)</option>
            <option value="datum">Am Datum</option>
            <option value="anzahl">Nach N Terminen</option>
          </select>
        </label>
        {endTyp === 'datum' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={labelStyle}>Enddatum</span>
            <input type="date" value={endDatum} onChange={e => setEndDatum(e.target.value)} style={inputStyle} />
          </label>
        )}
        {endTyp === 'anzahl' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={labelStyle}>Anzahl Termine</span>
            <input type="number" min={1} max={300} value={endAnzahl}
              onChange={e => setEndAnzahl(Math.max(1, parseInt(e.target.value) || 1))} style={inputStyle} />
          </label>
        )}
      </div>

      {/* Vorschau */}
      {vorschau.length > 0 && (
        <div style={{ marginBottom: '12px', background: 'var(--surface2)', borderRadius: '8px', padding: '8px 12px' }}>
          <div style={{ ...labelStyle, display: 'block', marginBottom: '6px' }}>
            Vorschau – erste {vorschau.length} Termine
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {vorschau.map(inst => (
              <span key={inst.key} style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent)', background: 'rgba(59,130,246,0.07)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.2)' }}>
                {fmtDatumShort(inst.datum)}
              </span>
            ))}
            {endTyp === 'kein' && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>… (fortlaufend)</span>}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>Abbrechen</button>
        <button onClick={handleCreate} disabled={!startDatum}
          style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'rgba(99,102,241,0.9)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: startDatum ? 'pointer' : 'not-allowed', opacity: startDatum ? 1 : 0.5 }}>
          🔁 Serienauftrag anlegen
        </button>
      </div>
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function AuftraegeTab({ client, onUpdate }) {
  const auftraege = client.auftraege ?? []

  // Aufteilen in Einzel- und Serienaufträge
  const einzelauftraege = auftraege.filter(a => !a.istSerie)
  const serienauftraege = auftraege.filter(a => a.istSerie)

  const [filterStatus,       setFilterStatus]       = useState('aktiv')
  const [filterTyp,          setFilterTyp]          = useState('alle')
  const [expandedId,         setExpandedId]         = useState(null)
  const [quickTyp,           setQuickTyp]           = useState('lohn')
  const [showBatch,          setShowBatch]          = useState(false)
  const [showSerieErstellen, setShowSerieErstellen] = useState(false)

  function save(list) { onUpdate({ auftraege: list }) }

  function createAuftrag() {
    const au = mkAuftrag(quickTyp)
    save([au, ...auftraege])
    setExpandedId(au.id)
    setFilterStatus('aktiv')
    setFilterTyp('alle')
  }

  function createBatchSerie(typ, jahr, monate, fristKonfig = { modus: 'kein', tag: 1, tage: 0 }) {
    const newAuftraege = monate.map(monat => ({
      ...mkAuftrag(typ),
      id:    'au_' + Date.now().toString(36) + monat + Math.random().toString(36).slice(2, 4),
      jahr, monat,
      frist: calcFrist(jahr, monat, fristKonfig.modus, fristKonfig.tag, fristKonfig.tage),
    }))
    save([...newAuftraege, ...auftraege])
    setShowBatch(false)
    setFilterStatus('aktiv')
    setFilterTyp('alle')
  }

  function createSerienauftrag(au) {
    save([au, ...auftraege])
    setShowSerieErstellen(false)
    setExpandedId(au.id)
  }

  function updateAuftrag(id, patch) {
    save(auftraege.map(a => a.id === id ? { ...a, ...patch } : a))
  }

  function deleteAuftrag(id) {
    if (!window.confirm('Auftrag wirklich löschen?')) return
    save(auftraege.filter(a => a.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  // Einzelaufträge filtern
  const filteredEinzel = einzelauftraege
    .filter(a => {
      if (filterStatus === 'aktiv') return a.status !== 'erledigt'
      if (filterStatus === 'alle')  return true
      return a.status === filterStatus
    })
    .filter(a => filterTyp === 'alle' || a.typ === filterTyp)

  // Serienaufträge: immer bei 'aktiv' und 'alle', ausblenden bei Einzelstatus-Filtern
  const filteredSerien = (filterStatus === 'offen' || filterStatus === 'in_bearbeitung' || filterStatus === 'erledigt')
    ? []
    : serienauftraege.filter(a => filterTyp === 'alle' || a.typ === filterTyp)

  const counts = {
    aktiv:          einzelauftraege.filter(a => a.status !== 'erledigt').length,
    alle:           einzelauftraege.length,
    offen:          einzelauftraege.filter(a => a.status === 'offen').length,
    in_bearbeitung: einzelauftraege.filter(a => a.status === 'in_bearbeitung').length,
    erledigt:       einzelauftraege.filter(a => a.status === 'erledigt').length,
  }

  return (
    <div style={{ padding: '20px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>📋 Aufträge</h2>
        {auftraege.length > 0 && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '1px 9px' }}>
            {counts.aktiv} aktiv · {counts.erledigt} erledigt{serienauftraege.length > 0 ? ` · ${serienauftraege.length} Serie${serienauftraege.length !== 1 ? 'n' : ''}` : ''}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={quickTyp} onChange={e => setQuickTyp(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', cursor: 'pointer' }}>
            {Object.entries(AUFTRAGS_TYP_CFG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <button onClick={createAuftrag}
            style={{ padding: '7px 16px', borderRadius: '7px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Einzelauftrag
          </button>
          <button
            onClick={() => { setShowBatch(v => !v); if (!showBatch) setShowSerieErstellen(false) }}
            title="Mehrere Einzelaufträge auf einmal anlegen"
            style={{ padding: '7px 12px', borderRadius: '7px', border: `1px solid ${showBatch ? 'var(--accent)' : 'var(--border)'}`, background: showBatch ? 'rgba(59,130,246,0.1)' : 'var(--surface2)', color: showBatch ? 'var(--accent)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            📅 Batch
          </button>
          <button
            onClick={() => { setShowSerieErstellen(v => !v); if (!showSerieErstellen) setShowBatch(false) }}
            title="Serienauftrag mit automatischer Wiederholung (Outlook-Stil)"
            style={{ padding: '7px 12px', borderRadius: '7px', border: `1px solid ${showSerieErstellen ? 'rgba(99,102,241,0.6)' : 'var(--border)'}`, background: showSerieErstellen ? 'rgba(99,102,241,0.1)' : 'var(--surface2)', color: showSerieErstellen ? 'rgba(99,102,241,0.9)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            🔁 Serie
          </button>
        </div>
      </div>

      {/* ── Panels ── */}
      {showBatch          && <BatchSeriePanel  onCreate={createBatchSerie}    onClose={() => setShowBatch(false)} />}
      {showSerieErstellen && <SerieErstellenPanel onCreate={createSerienauftrag} onClose={() => setShowSerieErstellen(false)} />}

      {/* ── Status-Filter (gilt nur für Einzelaufträge) ── */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {[
          { key: 'aktiv',          label: `Aktiv (${counts.aktiv})` },
          { key: 'offen',          label: `Offen (${counts.offen})` },
          { key: 'in_bearbeitung', label: `In Bearbeitung (${counts.in_bearbeitung})` },
          { key: 'erledigt',       label: `Erledigt (${counts.erledigt})` },
          { key: 'alle',           label: `Alle (${counts.alle})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterStatus(f.key)}
            style={{ padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--border)', background: filterStatus === f.key ? 'var(--accent)' : 'var(--surface2)', color: filterStatus === f.key ? '#fff' : 'var(--text-muted)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Typ-Filter ── */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => setFilterTyp('alle')}
          style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: filterTyp === 'alle' ? 700 : 400, cursor: 'pointer',
            border: `1px solid ${filterTyp === 'alle' ? 'var(--accent)' : 'var(--border)'}`,
            background: filterTyp === 'alle' ? 'rgba(8,145,178,0.1)' : 'transparent',
            color: filterTyp === 'alle' ? 'var(--accent)' : 'var(--text-muted)',
          }}>
          Alle
        </button>
        {Object.entries(AUFTRAGS_TYP_CFG).map(([k, v]) => {
          const cnt = auftraege.filter(a => a.typ === k).length
          if (cnt === 0) return null
          return (
            <button key={k} onClick={() => setFilterTyp(k === filterTyp ? 'alle' : k)}
              style={{
                padding: '4px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '11px',
                border: `1px solid ${k === filterTyp ? v.color : 'var(--border)'}`,
                background: k === filterTyp ? v.bg : 'transparent',
                color: k === filterTyp ? v.color : 'var(--text-muted)',
                fontWeight: k === filterTyp ? 700 : 400,
                display: 'inline-flex', alignItems: 'center', gap: '4px',
              }}>
              {v.icon} {v.label} <span style={{ opacity: 0.75 }}>({cnt})</span>
            </button>
          )
        })}
      </div>

      {/* ── Serienaufträge ── */}
      {filteredSerien.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(99,102,241,0.8)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
            🔁 Serienaufträge ({filteredSerien.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredSerien.map(au => (
              <SerienAuftragCard
                key={au.id}
                au={au}
                expanded={expandedId === au.id}
                onExpand={setExpandedId}
                onUpdate={patch => updateAuftrag(au.id, patch)}
                onDelete={() => deleteAuftrag(au.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Einzelaufträge ── */}
      {(filteredEinzel.length > 0 || filteredSerien.length === 0) && filteredSerien.length > 0 && filteredEinzel.length > 0 && (
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
          Einzelaufträge ({filteredEinzel.length})
        </div>
      )}

      {filteredEinzel.length === 0 && filteredSerien.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
          {auftraege.length === 0 ? (
            <>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>Noch keine Aufträge</div>
              <div style={{ fontSize: '12px' }}>„+ Einzelauftrag" für einmalige Aufgaben · „🔁 Serie" für Wiederholungen · „📅 Batch" für mehrere auf einmal</div>
            </>
          ) : (
            <div style={{ fontSize: '13px' }}>Keine Aufträge für diesen Filter.</div>
          )}
        </div>
      ) : filteredEinzel.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredEinzel.map(au => (
            <AuftragCard
              key={au.id}
              au={au}
              expanded={expandedId === au.id}
              onExpand={setExpandedId}
              onUpdate={patch => updateAuftrag(au.id, patch)}
              onDelete={() => deleteAuftrag(au.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
