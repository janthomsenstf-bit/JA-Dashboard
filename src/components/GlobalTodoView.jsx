import { useState, useMemo } from 'react'
import { AUFTRAGS_TYP_CFG, AUFTRAGS_STATUS_CFG } from './detail/AuftraegeTab.jsx'

const HEUTE     = new Date()
const CUR_MONAT = HEUTE.getMonth() + 1
const CUR_JAHR  = HEUTE.getFullYear()

const MONAT_KURZ = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
const STATUS_ORDER = ['offen', 'in_bearbeitung', 'erledigt']

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────
function fmtFrist(iso) {
  if (!iso) return null
  const d     = new Date(iso + 'T12:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff  = Math.ceil((d - today) / (1000 * 60 * 60 * 24))
  const ds    = `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
  if (diff < 0)   return { text: `${ds} (${Math.abs(diff)}d überfällig)`, color: '#ef4444', overfaellig: true }
  if (diff === 0) return { text: `${ds} (heute)`,    color: '#f97316', overfaellig: false }
  if (diff <= 7)  return { text: `${ds} (${diff}d)`, color: '#f97316', overfaellig: false }
  if (diff <= 30) return { text: `${ds} (${diff}d)`, color: '#eab308', overfaellig: false }
  return { text: ds, color: 'var(--text-muted)', overfaellig: false }
}

// ── Effektiver Anzeige-Zeitraum ────────────────────────────────────────────────
// Wenn ein Frist-Datum gesetzt ist, wird nach dem Frist-Monat/-Jahr gefiltert
// (= wann die Aufgabe tatsächlich fällig ist, nicht wann die Leistung erbracht wird).
function getDisplayPeriod(au) {
  if (au.frist) {
    const d = new Date(au.frist + 'T12:00:00')
    if (!isNaN(d.getTime())) {
      return { monat: d.getMonth() + 1, jahr: d.getFullYear() }
    }
  }
  return { monat: au.monat, jahr: au.jahr }
}

// ── Statistik-Badge ─────────────────────────────────────────────────────────────
function StatBadge({ label, count, color, bg }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 14px', borderRadius: '8px', border: `1px solid ${color}44`, background: bg, minWidth: '80px' }}>
      <div style={{ fontSize: '22px', fontWeight: 800, color }}>{count}</div>
      <div style={{ fontSize: '11px', color, opacity: 0.85, marginTop: '2px' }}>{label}</div>
    </div>
  )
}

// ── Hauptkomponente ────────────────────────────────────────────────────────────
export default function GlobalTodoView({ clients, onUpdateClient, onSelectClient }) {
  const aktiveClients = useMemo(() => clients.filter(c => !c.archiviert), [clients])

  // ── Filter-State ─────────────────────────────────────────────────────────────
  const [filterJahr,   setFilterJahr]   = useState(CUR_JAHR)
  const [filterMonat,  setFilterMonat]  = useState(CUR_MONAT)
  const [filterTyp,    setFilterTyp]    = useState('alle')
  const [filterStatus, setFilterStatus] = useState('aktiv')  // aktiv = offen+in_bearbeitung

  // ── Alle Aufträge aus allen Mandanten ─────────────────────────────────────────
  const alleAuftraege = useMemo(() => {
    const result = []
    for (const client of aktiveClients) {
      for (const au of (client.auftraege ?? [])) {
        result.push({ ...au, client })
      }
    }
    return result
  }, [aktiveClients])

  // ── Verfügbare Jahre (Leistungsjahre + Frist-Jahre + aktuelles/nächstes) ──────
  const verfuegbareJahre = useMemo(() => {
    const jahre = new Set()
    for (const au of alleAuftraege) {
      if (au.jahr) jahre.add(au.jahr)
      // Frist kann in einem anderen Jahr liegen (z. B. Dez → Jan-Frist)
      const dp = getDisplayPeriod(au)
      if (dp.jahr) jahre.add(dp.jahr)
    }
    jahre.add(CUR_JAHR)
    jahre.add(CUR_JAHR + 1)
    return [...jahre].sort((a, b) => b - a)
  }, [alleAuftraege])

  // ── Gefilterte Aufträge ───────────────────────────────────────────────────────
  // Gefiltert wird nach dem Anzeige-Zeitraum (= Frist-Monat wenn gesetzt, sonst Leistungsmonat)
  const gefiltert = useMemo(() => {
    return alleAuftraege.filter(au => {
      const dp = getDisplayPeriod(au)
      if (dp.jahr !== filterJahr) return false
      if (filterMonat !== null && dp.monat !== null && dp.monat !== filterMonat) return false
      if (filterTyp !== 'alle' && au.typ !== filterTyp) return false
      if (filterStatus === 'aktiv'  && au.status === 'erledigt')                return false
      if (filterStatus === 'offen'  && au.status !== 'offen')                   return false
      if (filterStatus === 'in_bearbeitung' && au.status !== 'in_bearbeitung')  return false
      if (filterStatus === 'erledigt' && au.status !== 'erledigt')              return false
      return true
    })
  }, [alleAuftraege, filterJahr, filterMonat, filterTyp, filterStatus])

  // ── Statistiken ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const basis = alleAuftraege.filter(au => {
      const dp = getDisplayPeriod(au)
      return dp.jahr === filterJahr &&
        (filterMonat === null || dp.monat === null || dp.monat === filterMonat)
    })
    const ueberfaellig = basis.filter(au => {
      if (au.status === 'erledigt') return false
      if (!au.frist) return false
      return new Date(au.frist + 'T12:00:00') < new Date()
    }).length
    return {
      gesamt:       basis.length,
      offen:        basis.filter(au => au.status === 'offen').length,
      in_bearb:     basis.filter(au => au.status === 'in_bearbeitung').length,
      erledigt:     basis.filter(au => au.status === 'erledigt').length,
      ueberfaellig,
    }
  }, [alleAuftraege, filterJahr, filterMonat])

  // ── Status eines Auftrags umschalten ──────────────────────────────────────────
  function cycleStatus(au) {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(au.status) + 1) % STATUS_ORDER.length]
    const updated = (au.client.auftraege ?? []).map(a =>
      a.id === au.id
        ? { ...a, status: next, erledigtAm: next === 'erledigt' ? new Date().toISOString() : null }
        : a
    )
    onUpdateClient(au.client.id, { auftraege: updated })
  }

  const inputStyle = {
    padding: '5px 10px', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
    background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '12px', cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span style={{ fontSize: '22px' }}>📋</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px' }}>Auftrags-Übersicht</div>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>Alle Mandate – Lohn / USt / JA / FIBU / Beratung</div>
          </div>
          {/* Statistik-Badges */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <StatBadge label="Offen"    count={stats.offen}    color="#60a5fa" bg="rgba(96,165,250,0.12)" />
            <StatBadge label="Bearb."   count={stats.in_bearb} color="#a78bfa" bg="rgba(167,139,250,0.12)" />
            <StatBadge label="Erledigt" count={stats.erledigt} color="#4ade80" bg="rgba(74,222,128,0.12)" />
            {stats.ueberfaellig > 0 && (
              <StatBadge label="Überfällig" count={stats.ueberfaellig} color="#f87171" bg="rgba(248,113,113,0.12)" />
            )}
          </div>
        </div>

        {/* ── Filter-Leiste ── */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Jahr */}
          <select value={filterJahr} onChange={e => setFilterJahr(Number(e.target.value))} style={{ ...inputStyle, fontWeight: 600 }}>
            {verfuegbareJahre.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Monats-Chips */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button onClick={() => setFilterMonat(null)} style={{
              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
              border: `1px solid ${filterMonat === null ? '#60a5fa' : 'rgba(255,255,255,0.2)'}`,
              background: filterMonat === null ? 'rgba(96,165,250,0.25)' : 'transparent',
              color: filterMonat === null ? '#60a5fa' : 'rgba(255,255,255,0.6)',
              fontWeight: filterMonat === null ? 700 : 400,
            }}>Alle</button>
            {MONAT_KURZ.map((m, i) => (
              <button key={i} onClick={() => setFilterMonat(filterMonat === i + 1 ? null : i + 1)} style={{
                padding: '4px 8px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
                border: `1px solid ${filterMonat === i + 1 ? '#60a5fa' : 'rgba(255,255,255,0.15)'}`,
                background: filterMonat === i + 1
                  ? 'rgba(96,165,250,0.25)'
                  : (i + 1 === CUR_MONAT && filterJahr === CUR_JAHR ? 'rgba(255,255,255,0.08)' : 'transparent'),
                color: filterMonat === i + 1 ? '#60a5fa' : 'rgba(255,255,255,0.6)',
                fontWeight: filterMonat === i + 1 ? 700 : 400,
                outline: i + 1 === CUR_MONAT && filterJahr === CUR_JAHR ? '1px solid rgba(255,255,255,0.2)' : 'none',
              }}>{m}</button>
            ))}
          </div>

          <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.15)' }} />

          {/* Typ-Filter */}
          <button onClick={() => setFilterTyp('alle')} style={{
            padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
            border: `1px solid ${filterTyp === 'alle' ? '#a78bfa' : 'rgba(255,255,255,0.2)'}`,
            background: filterTyp === 'alle' ? 'rgba(167,139,250,0.25)' : 'transparent',
            color: filterTyp === 'alle' ? '#a78bfa' : 'rgba(255,255,255,0.6)',
            fontWeight: filterTyp === 'alle' ? 700 : 400,
          }}>Alle Typen</button>
          {Object.entries(AUFTRAGS_TYP_CFG).map(([k, v]) => (
            <button key={k} onClick={() => setFilterTyp(filterTyp === k ? 'alle' : k)} style={{
              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
              border: `1px solid ${filterTyp === k ? '#a78bfa' : 'rgba(255,255,255,0.2)'}`,
              background: filterTyp === k ? 'rgba(167,139,250,0.25)' : 'transparent',
              color: filterTyp === k ? '#a78bfa' : 'rgba(255,255,255,0.6)',
              fontWeight: filterTyp === k ? 700 : 400,
            }}>{v.icon} {v.label}</button>
          ))}

          <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.15)' }} />

          {/* Status-Filter */}
          {[
            { key: 'aktiv',          label: 'Aktiv' },
            { key: 'offen',          label: '○ Offen' },
            { key: 'in_bearbeitung', label: '◑ In Bearb.' },
            { key: 'erledigt',       label: '● Erledigt' },
            { key: 'alle',           label: 'Alle' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)} style={{
              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
              border: `1px solid ${filterStatus === f.key ? '#4ade80' : 'rgba(255,255,255,0.2)'}`,
              background: filterStatus === f.key ? 'rgba(74,222,128,0.2)' : 'transparent',
              color: filterStatus === f.key ? '#4ade80' : 'rgba(255,255,255,0.6)',
              fontWeight: filterStatus === f.key ? 700 : 400,
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* ── Tabelle ── */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        {gefiltert.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            {alleAuftraege.length === 0
              ? 'Noch keine Aufträge vorhanden. Aufträge werden pro Mandant im Reiter „Aufträge" angelegt.'
              : 'Keine Aufträge für diesen Filter.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={thStyle}>Mandant</th>
                <th style={thStyle}>Typ</th>
                <th style={thStyle}>Bezeichnung</th>
                <th style={thStyle}>Zeitraum</th>
                <th style={thStyle}>Frist</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((au, idx) => {
                const typCfg    = AUFTRAGS_TYP_CFG[au.typ]     ?? AUFTRAGS_TYP_CFG.freitext
                const statusCfg = AUFTRAGS_STATUS_CFG[au.status] ?? AUFTRAGS_STATUS_CFG.offen
                const frist     = fmtFrist(au.frist)
                const erledigt  = au.status === 'erledigt'
                const bezeichnung = au.bezeichnung || null
                const zeitraum    = au.monat
                  ? `${MONAT_KURZ[au.monat - 1]} ${au.jahr}`
                  : au.jahr ? String(au.jahr) : '—'
                // Zeige Hinweis wenn Frist-Monat ≠ Leistungsmonat
                const dp = getDisplayPeriod(au)
                const fristAbweicht = au.frist && au.monat && (dp.monat !== au.monat || dp.jahr !== au.jahr)

                return (
                  <tr key={au.id + au.client.id} style={{
                    background: erledigt ? 'transparent' : frist?.overfaellig ? 'rgba(239,68,68,0.03)' : idx % 2 === 0 ? 'var(--surface)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                    opacity: erledigt ? 0.55 : 1,
                    transition: 'background 0.1s',
                  }}>
                    {/* Mandant */}
                    <td style={{ padding: '8px 12px' }}>
                      <button
                        onClick={() => onSelectClient(au.client.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: '13px', padding: 0, textAlign: 'left' }}
                        title="Mandant öffnen (Aufträge-Tab)"
                      >
                        {au.client.name}
                        {au.client.mandantennummer && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 400 }}>
                            {au.client.mandantennummer}
                          </div>
                        )}
                      </button>
                    </td>

                    {/* Typ */}
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, padding: '2px 8px',
                        borderRadius: '10px', background: typCfg.bg, color: typCfg.color,
                        border: `1px solid ${typCfg.border}`, whiteSpace: 'nowrap',
                      }}>
                        {typCfg.icon} {typCfg.label}
                      </span>
                    </td>

                    {/* Bezeichnung */}
                    <td style={{ padding: '8px 12px', color: 'var(--text)', textDecoration: erledigt ? 'line-through' : 'none', maxWidth: '260px' }}>
                      <div style={{ fontWeight: bezeichnung ? 500 : 400, color: bezeichnung ? 'var(--text)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {bezeichnung ?? `${typCfg.label} ${zeitraum}`}
                      </div>
                      {au.notiz && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {au.notiz}
                        </div>
                      )}
                    </td>

                    {/* Zeitraum (Leistungsmonat) */}
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{zeitraum}</span>
                      {fristAbweicht && (
                        <div style={{ fontSize: '9px', color: 'var(--accent)', marginTop: '1px', fontFamily: 'monospace' }}>
                          → fällig {MONAT_KURZ[dp.monat - 1]}{dp.jahr !== au.jahr ? ` ${dp.jahr}` : ''}
                        </div>
                      )}
                    </td>

                    {/* Frist */}
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {frist ? (
                        <span style={{ color: frist.color, fontWeight: frist.overfaellig ? 700 : 400 }}>
                          {frist.overfaellig ? '⚠ ' : ''}{frist.text}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>–</span>
                      )}
                    </td>

                    {/* Status (klickbar zum Cycling) */}
                    <td style={{ padding: '8px 12px' }}>
                      <button
                        onClick={() => cycleStatus(au)}
                        title="Status wechseln (Klick)"
                        style={{
                          fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                          border: `1px solid ${statusCfg.border}`,
                          background: statusCfg.bg, color: statusCfg.color,
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        {statusCfg.icon} {statusCfg.label}
                        {erledigt && au.erledigtAm && (
                          <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: '5px', fontSize: '10px' }}>
                            {new Date(au.erledigtAm).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                          </span>
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '6px 16px', background: 'var(--surface)', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0 }}>
        <span>{gefiltert.length} Aufträge angezeigt</span>
        <span>{aktiveClients.length} Mandate aktiv</span>
        <span>{alleAuftraege.length} Aufträge gesamt</span>
        <span style={{ marginLeft: 'auto' }}>
          Tipp: Klick auf Mandantenname öffnet die Detail-Ansicht · Klick auf Status wechselt ihn
        </span>
      </div>
    </div>
  )
}

// ── Shared Styles ─────────────────────────────────────────────────────────────
const thStyle = {
  padding: '8px 12px', textAlign: 'left',
  fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px',
  borderBottom: '2px solid var(--border)',
}
