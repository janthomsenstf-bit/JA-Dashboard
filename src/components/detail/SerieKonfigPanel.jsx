import { useState, useMemo } from 'react'
import { addIntervalDate } from '../../utils/aufgaben.js'

// ── Vorschau der nächsten Termine ─────────────────────────────────────────────
function SerieVorschau({ config }) {
  const dates = useMemo(() => {
    const freq      = config.frequenz ?? 'monatlich'
    const startD    = config.startDatum ? new Date(config.startDatum) : null
    const endD      = config.endDatum   ? new Date(config.endDatum)   : null
    const tag       = Math.min(Math.max(parseInt(config.faelligTag ?? 1, 10), 1), 28)
    const iTyp      = config.intervallTyp  ?? 'monate'
    const iWert     = Math.max(1, parseInt(config.intervallWert ?? 1, 10))

    if (!startD || isNaN(startD.getTime())) return []

    const result = []

    if (freq === 'individuell') {
      let cur = new Date(startD)
      for (let i = 0; i < 60 && result.length < 8; i++) {
        if (end && cur > endD) break
        result.push(new Date(cur))
        cur = addIntervalDate(cur, iTyp, iWert)
      }
    } else {
      // Fixed frequencies: show next 8 instances from startDatum year
      const startYear = startD.getFullYear()
      const months = freq === 'monatlich'    ? [1,2,3,4,5,6,7,8,9,10,11,12]
                   : freq === 'quartalsweise' ? [3,6,9,12]
                   : freq === 'jaehrlich'     ? [startD.getMonth() + 1]
                   : []
      for (let y = startYear; y <= startYear + 2 && result.length < 8; y++) {
        for (const m of months) {
          const d = new Date(y, m - 1, tag)
          if (d < startD) continue
          if (endD && d > endD) break
          result.push(d)
          if (result.length >= 8) break
        }
      }
    }
    return result
  }, [config])

  if (!dates.length) return null

  const fmt = d => d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div style={{
      background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)',
      borderRadius: '8px', padding: '8px 12px',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6', marginBottom: '5px' }}>
        📅 Vorschau ({dates.length}{dates.length === 8 ? '+' : ''} Termine):
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {dates.map((d, i) => (
          <span key={i} style={{
            fontSize: '10px', padding: '2px 7px', borderRadius: '10px',
            background: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontFamily: 'monospace',
          }}>{fmt(d)}</span>
        ))}
      </div>
    </div>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
/**
 * Wiederverwendbares Formular zur Konfiguration von Serienaufgaben.
 * Wird in LohnTab und FIBUTab verwendet.
 *
 * Props:
 *   config       – Serienconfig-Objekt { aktiv, startDatum, frequenz, faelligTag,
 *                                        endDatum, intervallTyp, intervallWert }
 *   onChange     – Callback mit geändertem config-Objekt
 *   accentColor  – Primärfarbe für Rahmen/Badges
 *   taskLabel    – z. B. „Lohnabrechnung" oder „FIBU / Buchhaltung"
 */
export default function SerieKonfigPanel({ config, onChange, accentColor = '#3b82f6', taskLabel = 'Aufgabe' }) {
  const freq = config.frequenz ?? 'monatlich'

  function set(key, value) {
    onChange({ ...config, [key]: value })
  }

  const inputStyle = {
    padding: '5px 9px', border: '1px solid var(--border)', borderRadius: '6px',
    background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', width: '100%',
    boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }

  return (
    <div style={{
      border: `1px solid ${config.aktiv ? accentColor + '44' : 'var(--border)'}`,
      borderRadius: '8px', overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Toggle-Header */}
      <div style={{
        padding: '8px 12px', background: config.aktiv ? `${accentColor}11` : 'var(--surface)',
        borderBottom: config.aktiv ? `1px solid ${accentColor}22` : 'none',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <input
          type="checkbox"
          checked={!!config.aktiv}
          onChange={e => set('aktiv', e.target.checked)}
          style={{ width: '15px', height: '15px', accentColor, cursor: 'pointer' }}
        />
        <span style={{
          fontSize: '12px', fontWeight: config.aktiv ? 700 : 400,
          color: config.aktiv ? accentColor : 'var(--text-secondary)',
          cursor: 'pointer', userSelect: 'none',
        }} onClick={() => set('aktiv', !config.aktiv)}>
          🔁 Serienaufgabe konfigurieren — erscheint automatisch in der Aufgaben-Übersicht
        </span>
      </div>

      {/* Konfigurationsfelder (nur wenn aktiv) */}
      {config.aktiv && (
        <div style={{ padding: '12px', background: 'var(--surface2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Frequenz */}
          <div>
            <label style={labelStyle}>Wiederholung</label>
            <select value={freq} onChange={e => set('frequenz', e.target.value)} style={inputStyle}>
              <option value="monatlich">Monatlich</option>
              <option value="quartalsweise">Quartalsweise</option>
              <option value="jaehrlich">Jährlich</option>
              <option value="individuell">📅 Individuelles Intervall</option>
            </select>
          </div>

          {/* Individuell: Intervall-Wert + Typ */}
          {freq === 'individuell' && (
            <div>
              <label style={labelStyle}>Intervall</label>
              <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Alle</span>
                <input
                  type="number" min={1} max={999} value={config.intervallWert ?? 1}
                  onChange={e => set('intervallWert', parseInt(e.target.value, 10))}
                  style={{ ...inputStyle, width: '68px', flex: 'none' }}
                />
                <select value={config.intervallTyp ?? 'monate'} onChange={e => set('intervallTyp', e.target.value)} style={{ ...inputStyle }}>
                  <option value="tage">Tage</option>
                  <option value="wochen">Wochen</option>
                  <option value="monate">Monate</option>
                </select>
              </div>
            </div>
          )}

          {/* Tag im Monat (bei nicht-individuell) */}
          {freq !== 'individuell' && (
            <div>
              <label style={labelStyle}>Fällig am (Tag im Monat)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <input
                  type="number" min={1} max={28} value={config.faelligTag ?? 1}
                  onChange={e => set('faelligTag', parseInt(e.target.value, 10))}
                  style={{ ...inputStyle, width: '72px', flex: 'none' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>. des Monats</span>
              </div>
            </div>
          )}

          {/* Startdatum / Enddatum */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={labelStyle}>Startdatum *</label>
              <input
                type="date" value={config.startDatum ?? ''}
                onChange={e => set('startDatum', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Enddatum (optional)</label>
              <input
                type="date" value={config.endDatum ?? ''}
                onChange={e => set('endDatum', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Vorschau */}
          {config.startDatum && <SerieVorschau config={config} />}
        </div>
      )}
    </div>
  )
}
