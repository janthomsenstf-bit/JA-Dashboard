import { useState, useMemo } from 'react'
import { generateAufgaben, getStatus, buildTogglePatch, TYP_CONFIG, fmtDatum, isUeberfaellig, MONAT_NAMEN, MONAT_KURZ } from '../utils/aufgaben.js'

const HEUTE = new Date()
const CUR_MONAT = HEUTE.getMonth() + 1
const CUR_JAHR  = HEUTE.getFullYear()

function StatBadge({ label, count, color, bg }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 14px', borderRadius: '8px', border: `1px solid ${color}44`, background: bg, minWidth: '80px' }}>
      <div style={{ fontSize: '22px', fontWeight: 800, color }}>{count}</div>
      <div style={{ fontSize: '11px', color, opacity: 0.85, marginTop: '2px' }}>{label}</div>
    </div>
  )
}

export default function GlobalTodoView({ clients, onUpdateClient, onSelectClient }) {
  const aktiveClients = clients.filter(c => !c.archiviert)

  // ── Filter-State ─────────────────────────────────────────────────────────
  const [filterMonat,  setFilterMonat]  = useState(CUR_MONAT)   // 1–12 oder null
  const [filterJahr,   setFilterJahr]   = useState(CUR_JAHR)
  const [filterTyp,    setFilterTyp]    = useState('alle')       // 'alle'|'USt'|'Lohn'|'JA'
  const [filterStatus, setFilterStatus] = useState('offen')      // 'alle'|'offen'|'erledigt'

  // ── Alle Tasks aller Mandanten ────────────────────────────────────────────
  const alleTasks = useMemo(() => {
    const result = []
    for (const client of aktiveClients) {
      const tasks = generateAufgaben(client)
      for (const task of tasks) {
        // Tasks ausblenden wenn jeweiliger Übersichts-Toggle deaktiviert
        if (task.type === 'Lohn' && client.lohnInUebersicht === false) continue
        if (task.type === 'USt'  && client.ustInUebersicht  === false) continue
        if (task.type === 'JA'   && client.jaInUebersicht   === false) continue
        const st = getStatus(client, task.key)
        result.push({ ...task, client, erledigt: st.erledigt, erledigtAm: st.erledigtAm })
      }
    }
    return result
  }, [aktiveClients])

  // ── Gefilterte Tasks ──────────────────────────────────────────────────────
  const gefiltert = useMemo(() => {
    return alleTasks.filter(t => {
      // Jahr-Filter
      if (t.jahr !== filterJahr) return false
      // Monats-Filter – gilt für alle Task-Typen
      if (filterMonat !== null) {
        // Hat der Task einen konkreten Monat → exakt filtern
        if (t.monat !== null && t.monat !== filterMonat) return false
        // Quartalsaufgaben ohne festen Monat → Quartal des Monats prüfen
        if (t.monat === null && t.quartal !== null) {
          const quartalDesMonats = Math.ceil(filterMonat / 3)
          if (t.quartal !== quartalDesMonats) return false
        }
        // monat === null && quartal === null → Aufgabe ohne Monatsbindung (zeige immer)
      }
      // Typ-Filter
      if (filterTyp !== 'alle' && t.type !== filterTyp) return false
      // Status-Filter
      if (filterStatus === 'offen'    && t.erledigt) return false
      if (filterStatus === 'erledigt' && !t.erledigt) return false
      return true
    })
  }, [alleTasks, filterJahr, filterMonat, filterTyp, filterStatus])

  // ── Statistiken ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const base = alleTasks.filter(t => t.jahr === filterJahr)
    const cur  = filterMonat !== null
      ? base.filter(t =>
          t.monat === filterMonat ||                                           // exakter Monat
          (t.monat === null && t.quartal === null) ||                          // monatlos (JA ohne Konfiguration)
          (t.monat === null && t.quartal === Math.ceil(filterMonat / 3))       // Quartal enthält Monat
        )
      : base
    return {
      gesamt:    cur.length,
      offen:     cur.filter(t => !t.erledigt).length,
      erledigt:  cur.filter(t =>  t.erledigt).length,
      ueberfaellig: cur.filter(t => !t.erledigt && isUeberfaellig(t.faellig)).length,
    }
  }, [alleTasks, filterJahr, filterMonat])

  // ── Toggle ────────────────────────────────────────────────────────────────
  function handleToggle(task) {
    const patch = buildTogglePatch(task.client, task.key)
    onUpdateClient(task.client.id, patch)
  }

  // ── Jahre für Dropdown ────────────────────────────────────────────────────
  const verfuegbareJahre = useMemo(() => {
    const jahre = new Set(alleTasks.map(t => t.jahr))
    return [...jahre].sort((a, b) => b - a)
  }, [alleTasks])

  const inputStyle = {
    padding: '5px 10px', border: '1px solid var(--border)', borderRadius: '6px',
    background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span style={{ fontSize: '22px' }}>📋</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px' }}>Aufgaben-Übersicht</div>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>Alle Mandate – USt / Lohn / Jahresabschluss</div>
          </div>
          {/* Statistik-Badges */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <StatBadge label="Offen"       count={stats.offen}      color="#60a5fa" bg="rgba(96,165,250,0.12)" />
            <StatBadge label="Erledigt"    count={stats.erledigt}   color="#4ade80" bg="rgba(74,222,128,0.12)" />
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
            {!verfuegbareJahre.includes(CUR_JAHR) && <option value={CUR_JAHR}>{CUR_JAHR}</option>}
          </select>

          {/* Monats-Chips */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <button onClick={() => setFilterMonat(null)} style={{
              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
              border: `1px solid ${filterMonat === null ? '#60a5fa' : 'rgba(255,255,255,0.2)'}`,
              background: filterMonat === null ? 'rgba(96,165,250,0.25)' : 'transparent',
              color: filterMonat === null ? '#60a5fa' : 'rgba(255,255,255,0.6)', fontWeight: filterMonat === null ? 700 : 400,
            }}>Alle Monate</button>
            {MONAT_KURZ.map((m, i) => (
              <button key={i} onClick={() => setFilterMonat(i + 1)} style={{
                padding: '4px 8px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
                border: `1px solid ${filterMonat === i + 1 ? '#60a5fa' : 'rgba(255,255,255,0.15)'}`,
                background: filterMonat === i + 1 ? 'rgba(96,165,250,0.25)' : i + 1 === CUR_MONAT && filterJahr === CUR_JAHR ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: filterMonat === i + 1 ? '#60a5fa' : 'rgba(255,255,255,0.6)',
                fontWeight: filterMonat === i + 1 ? 700 : 400,
                outline: i + 1 === CUR_MONAT && filterJahr === CUR_JAHR ? '1px solid rgba(255,255,255,0.2)' : 'none',
              }}>{m}</button>
            ))}
          </div>

          <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.15)' }} />

          {/* Typ-Filter */}
          {[
            { key: 'alle',   label: 'Alle Typen' },
            { key: 'USt',    label: '📊 USt' },
            { key: 'Lohn',   label: '💼 Lohn' },
            { key: 'JA',     label: '📁 JA' },
            { key: 'Zusatz', label: '⭐ Zusatz' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterTyp(f.key)} style={{
              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
              border: `1px solid ${filterTyp === f.key ? '#a78bfa' : 'rgba(255,255,255,0.2)'}`,
              background: filterTyp === f.key ? 'rgba(167,139,250,0.25)' : 'transparent',
              color: filterTyp === f.key ? '#a78bfa' : 'rgba(255,255,255,0.6)',
              fontWeight: filterTyp === f.key ? 700 : 400,
            }}>{f.label}</button>
          ))}

          <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.15)' }} />

          {/* Status-Filter */}
          {[
            { key: 'offen',    label: '⬜ Offen' },
            { key: 'erledigt', label: '✅ Erledigt' },
            { key: 'alle',     label: 'Alle' },
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
            {filterStatus === 'erledigt'
              ? '🎉 Keine erledigten Aufgaben in diesem Zeitraum.'
              : '✅ Keine offenen Aufgaben – alles erledigt!'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', borderBottom: '2px solid var(--border)', width: '36px' }}></th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', borderBottom: '2px solid var(--border)' }}>Mandant</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', borderBottom: '2px solid var(--border)' }}>Typ</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', borderBottom: '2px solid var(--border)' }}>Aufgabe</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', borderBottom: '2px solid var(--border)' }}>Fällig</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '11px', borderBottom: '2px solid var(--border)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((task, idx) => {
                const cfg      = TYP_CONFIG[task.type]
                const ueber    = !task.erledigt && isUeberfaellig(task.faellig)
                const istHeute = task.faellig && new Date(task.faellig).toDateString() === HEUTE.toDateString()
                return (
                  <tr key={`${task.client.id}-${task.key}`} style={{
                    background: task.erledigt ? 'transparent' : ueber ? 'rgba(239,68,68,0.03)' : idx % 2 === 0 ? 'var(--surface)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                    opacity: task.erledigt ? 0.6 : 1,
                    transition: 'background 0.1s',
                  }}>
                    {/* Checkbox */}
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={task.erledigt}
                        onChange={() => handleToggle(task)}
                        style={{ width: '15px', height: '15px', accentColor: cfg.color, cursor: 'pointer' }}
                      />
                    </td>

                    {/* Mandant */}
                    <td style={{ padding: '8px 12px' }}>
                      <button
                        onClick={() => onSelectClient(task.client.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: '13px', padding: 0, textAlign: 'left' }}
                        title="Mandant öffnen"
                      >
                        {task.client.name}
                      </button>
                      {task.client.mandantennummer && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{task.client.mandantennummer}</div>
                      )}
                    </td>

                    {/* Typ */}
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
                        {cfg.icon} {task.type}
                      </span>
                    </td>

                    {/* Aufgabe */}
                    <td style={{ padding: '8px 12px', fontWeight: task.erledigt ? 400 : 500, color: 'var(--text)', textDecoration: task.erledigt ? 'line-through' : 'none' }}>
                      {task.label}
                    </td>

                    {/* Fällig */}
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {task.faellig ? (
                        <span style={{ color: ueber ? '#ef4444' : istHeute ? 'var(--orange)' : 'var(--text-muted)', fontWeight: ueber || istHeute ? 600 : 400 }}>
                          {ueber ? '⚠ ' : istHeute ? '⏰ ' : ''}{fmtDatum(task.faellig)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>–</span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      {task.erledigt ? (
                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
                          ✓ {fmtDatum(task.erledigtAm)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: ueber ? '#ef4444' : 'var(--text-muted)', fontWeight: ueber ? 600 : 400 }}>
                          {ueber ? '⚠ Überfällig' : 'Offen'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '6px 16px', background: 'var(--surface)', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '16px' }}>
        <span>{gefiltert.length} Aufgaben angezeigt</span>
        <span>{aktiveClients.length} Mandate aktiv</span>
        <span style={{ marginLeft: 'auto' }}>
          Tipp: Klick auf Mandantenname öffnet die Detail-Ansicht
        </span>
      </div>
    </div>
  )
}
