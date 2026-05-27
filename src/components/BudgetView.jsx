/**
 * BudgetView – Globale Honorar- und Budgetübersicht.
 * Aggregiert alle Preisvereinbarungen aller Mandanten.
 * Keine Buchhaltung – nur interne Planungsübersicht.
 */
import { useState, useMemo } from 'react'
import { LEISTUNGSART_CFG, RHYTHMUS_CFG, toMonatswert, toJahreswert, fmtEuro } from './detail/HonorareTab.jsx'

const ACCENT = '#0f766e'

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
}

// ── KPI-Kachel ────────────────────────────────────────────────────────────────────
function KpiKachel({ label, wert, sub, color, icon, isText = false }) {
  return (
    <div style={{ border: `1px solid ${color}33`, borderRadius: '10px', padding: '14px 16px', background: `${color}08`, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px' }}>{icon}</span>
        <span style={{ fontSize: '10px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>{label}</span>
      </div>
      <div style={{ fontSize: isText ? '18px' : '22px', fontWeight: 700, color, lineHeight: 1 }}>{wert}</div>
      {sub && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

// ── Tabellen-Header ───────────────────────────────────────────────────────────────
function Th({ children, align = 'left', onClick, sorted }) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: '8px 12px', textAlign: align,
        fontSize: '10px', fontWeight: 700, color: sorted ? ACCENT : 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : 'default', userSelect: 'none',
      }}
    >
      {children}{sorted ? ' ↓' : ''}
    </th>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────────
export default function BudgetView({ clients, onSelectClient }) {
  const [filterArt,  setFilterArt]  = useState('alle')
  const [nurAktiv,   setNurAktiv]   = useState(true)
  const [sortBy,     setSortBy]     = useState('mandant')
  const [gruppiertNach, setGruppiertNach] = useState('mandant') // 'mandant' | 'leistungsart'

  // Alle Honorar-Einträge flattened
  const alleEintraege = useMemo(() => {
    const result = []
    clients.filter(c => !c.archiviert).forEach(c => {
      ;(c.honorare ?? []).forEach(h => {
        if (nurAktiv && !h.aktiv) return
        if (filterArt !== 'alle' && h.leistungsart !== filterArt) return
        result.push({
          ...h,
          clientId:   c.id,
          clientName: c.name,
          monatswert: toMonatswert(h.betrag, h.rhythmus),
          jahreswert: toJahreswert(h.betrag, h.rhythmus),
        })
      })
    })
    return result
  }, [clients, nurAktiv, filterArt])

  // KPI-Berechnung
  const kpi = useMemo(() => {
    const laufend  = alleEintraege.filter(e => e.monatswert !== null)
    const einmalig = alleEintraege.filter(e => e.rhythmus === 'einmalig')
    const aufwand  = alleEintraege.filter(e => e.rhythmus === 'aufwand')
    return {
      monatsSumme:   laufend.reduce((s, e) => s + e.monatswert, 0),
      jahresSumme:   laufend.reduce((s, e) => s + e.jahreswert, 0),
      einmaligSumme: einmalig.reduce((s, e) => s + e.betrag, 0),
      einmaligCount: einmalig.length,
      aufwandCount:  aufwand.length,
      posCount:      alleEintraege.length,
    }
  }, [alleEintraege])

  // Summen nach Leistungsart
  const byArt = useMemo(() => {
    const result = {}
    alleEintraege.filter(e => e.monatswert !== null).forEach(e => {
      if (!result[e.leistungsart]) result[e.leistungsart] = { monat: 0, jahr: 0, count: 0 }
      result[e.leistungsart].monat += e.monatswert
      result[e.leistungsart].jahr  += e.jahreswert
      result[e.leistungsart].count++
    })
    return result
  }, [alleEintraege])

  // Summen nach Mandant
  const byMandant = useMemo(() => {
    const result = {}
    alleEintraege.filter(e => e.monatswert !== null).forEach(e => {
      if (!result[e.clientId]) result[e.clientId] = { name: e.clientName, monat: 0, jahr: 0, count: 0 }
      result[e.clientId].monat += e.monatswert
      result[e.clientId].jahr  += e.jahreswert
      result[e.clientId].count++
    })
    return Object.entries(result).sort((a, b) => b[1].monat - a[1].monat)
  }, [alleEintraege])

  // Tabelle sortieren
  const sortedRows = useMemo(() => {
    return [...alleEintraege].sort((a, b) => {
      if (sortBy === 'mandant') return a.clientName.localeCompare(b.clientName)
      if (sortBy === 'monat')   return (b.monatswert ?? -Infinity) - (a.monatswert ?? -Infinity)
      if (sortBy === 'art')     return a.leistungsart.localeCompare(b.leistungsart)
      if (sortBy === 'betrag')  return b.betrag - a.betrag
      return 0
    })
  }, [alleEintraege, sortBy])

  // Mandanten ohne Honorare
  const ohneHonorare = clients.filter(c => !c.archiviert && (!c.honorare || c.honorare.length === 0))
  // Mandanten mit nur inaktiven Honoraren
  const nurInaktiv = clients.filter(c => !c.archiviert && c.honorare?.length > 0 && !c.honorare.some(h => h.aktiv))

  // Gruppen für gruppierten Modus
  const groups = useMemo(() => {
    if (gruppiertNach === 'leistungsart') {
      const map = {}
      sortedRows.forEach(r => {
        if (!map[r.leistungsart]) map[r.leistungsart] = []
        map[r.leistungsart].push(r)
      })
      return Object.entries(map).map(([key, rows]) => ({
        key,
        title: `${LEISTUNGSART_CFG[key]?.icon ?? '📝'} ${LEISTUNGSART_CFG[key]?.label ?? key}`,
        color: LEISTUNGSART_CFG[key]?.color ?? '#64748b',
        rows,
      }))
    } else {
      // Nach Mandant
      const map = {}
      sortedRows.forEach(r => {
        if (!map[r.clientId]) map[r.clientId] = { name: r.clientName, rows: [] }
        map[r.clientId].rows.push(r)
      })
      return Object.entries(map).map(([key, { name, rows }]) => ({
        key,
        title: name,
        color: ACCENT,
        rows,
      }))
    }
  }, [sortedRows, gruppiertNach])

  function sortToggle(col) { setSortBy(col) }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Header ── */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>💰</span> Honorar- & Budgetübersicht
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          Planungsübersicht aller vereinbarten Honorare — rein intern, kein Ersatz für Buchhaltung.
        </p>
      </div>

      {/* ── KPI-Kacheln ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        <KpiKachel label="Monatlich laufend" wert={fmtEuro(kpi.monatsSumme)} sub="Summe aller aktiven, lfd. Positionen" color={ACCENT} icon="📅" />
        <KpiKachel label="Jahreswert laufend" wert={fmtEuro(kpi.jahresSumme)} sub="Hochgerechnet auf 12 Monate" color="#16a34a" icon="📆" />
        {kpi.einmaligCount > 0 && (
          <KpiKachel label={`Einmalig (${kpi.einmaligCount})`} wert={fmtEuro(kpi.einmaligSumme)} sub="Nicht in lfd. Monatswert" color="#f97316" icon="⚡" />
        )}
        {kpi.aufwandCount > 0 && (
          <KpiKachel label="Nach Aufwand" wert={`${kpi.aufwandCount}`} sub="Position(en) — nicht planbar" color="#64748b" icon="⏱" isText />
        )}
        {ohneHonorare.length > 0 && (
          <KpiKachel label="Ohne Honorare" wert={`${ohneHonorare.length}`} sub="Mandanten fehlen noch" color="#ef4444" icon="⚠️" isText />
        )}
      </div>

      {/* ── Verteilung nach Leistungsart ── */}
      {Object.keys(byArt).length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Verteilung nach Leistungsart · laufende Positionen
          </div>
          <div style={{ padding: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', background: 'var(--surface2)' }}>
            {Object.entries(byArt).sort((a, b) => b[1].monat - a[1].monat).map(([art, data]) => {
              const cfg = LEISTUNGSART_CFG[art] ?? LEISTUNGSART_CFG.sonstiges
              const pct = kpi.monatsSumme > 0 ? Math.round(data.monat / kpi.monatsSumme * 100) : 0
              return (
                <div
                  key={art}
                  onClick={() => setFilterArt(filterArt === art ? 'alle' : art)}
                  style={{
                    flex: '1 1 150px', border: `1px solid ${filterArt === art ? cfg.color : cfg.color + '33'}`,
                    borderRadius: '8px', padding: '10px 12px', background: filterArt === art ? cfg.bg : 'var(--surface)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                    <span>{cfg.icon}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: cfg.color, flex: 1 }}>{cfg.label}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{pct}%</span>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: cfg.color }}>
                    {fmtEuro(data.monat)}<span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-muted)' }}>/Mo.</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {fmtEuro(data.jahr)}/Jahr · {data.count} Pos.
                  </div>
                  <div style={{ height: '3px', background: 'var(--border)', borderRadius: '10px', marginTop: '7px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: '10px', transition: 'width 0.4s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Top-Mandanten ── */}
      {byMandant.length > 3 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Top-Mandanten nach lfd. Monatswert
          </div>
          <div style={{ padding: '10px 14px', background: 'var(--surface2)' }}>
            {byMandant.slice(0, 5).map(([id, data]) => {
              const pct = kpi.monatsSumme > 0 ? Math.round(data.monat / kpi.monatsSumme * 100) : 0
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <button
                    onClick={() => onSelectClient(id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: '12px', textDecoration: 'underline', padding: 0, minWidth: '140px', textAlign: 'left', flexShrink: 0 }}
                  >
                    {data.name}
                  </button>
                  <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: ACCENT, borderRadius: '10px', transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: ACCENT, minWidth: '75px', textAlign: 'right' }}>{fmtEuro(data.monat)}/Mo.</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', minWidth: '30px', textAlign: 'right' }}>{pct}%</span>
                </div>
              )
            })}
            {byMandant.length > 5 && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                + {byMandant.length - 5} weitere Mandanten in der Tabelle unten
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tabelle ── */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Alle Positionen
          </span>

          {/* Aktiv-Filter */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)', userSelect: 'none' }}>
            <input type="checkbox" checked={nurAktiv} onChange={e => setNurAktiv(e.target.checked)}
              style={{ accentColor: ACCENT, cursor: 'pointer' }} />
            nur aktive
          </label>

          {/* Leistungsart-Filter */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <FilterChip label="Alle" value="alle" current={filterArt} set={setFilterArt} color={ACCENT} />
            {Object.entries(LEISTUNGSART_CFG).map(([k, v]) => (
              <FilterChip key={k} label={`${v.icon} ${v.label}`} value={k} current={filterArt} set={setFilterArt} color={v.color} />
            ))}
          </div>

          {/* Gruppierung */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Gruppe:</span>
            <FilterChip label="Mandant" value="mandant" current={gruppiertNach} set={setGruppiertNach} color={ACCENT} />
            <FilterChip label="Leistungsart" value="leistungsart" current={gruppiertNach} set={setGruppiertNach} color={ACCENT} />
          </div>
        </div>

        {/* Tabelle leer */}
        {sortedRows.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>💰</div>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Noch keine Preisvereinbarungen</div>
            <div style={{ fontSize: '12px' }}>Öffne einen Mandanten und wechsle zum Reiter <strong>Honorare</strong>, um Vereinbarungen zu hinterlegen.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  <Th onClick={() => sortToggle('mandant')} sorted={sortBy === 'mandant'}>Mandant</Th>
                  <Th onClick={() => sortToggle('art')} sorted={sortBy === 'art'}>Leistungsart</Th>
                  <Th onClick={() => sortToggle('betrag')} sorted={sortBy === 'betrag'}>Betrag</Th>
                  <Th>Rhythmus</Th>
                  <Th align="right" onClick={() => sortToggle('monat')} sorted={sortBy === 'monat'}>Monatswert</Th>
                  <Th align="right">Jahreswert</Th>
                  <Th>Gültigkeit</Th>
                  <Th>Notiz</Th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, i) => {
                  const cfg = LEISTUNGSART_CFG[row.leistungsart] ?? LEISTUNGSART_CFG.sonstiges
                  const lbl = row.leistungsart === 'sonstiges' && row.bezeichnung ? row.bezeichnung : cfg.label
                  const gueltig = [row.startDatum && `ab ${fmtDate(row.startDatum)}`, row.endDatum && `bis ${fmtDate(row.endDatum)}`].filter(Boolean).join(' ')
                  return (
                    <tr key={`${row.clientId}-${row.id}`} style={{
                      borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                      opacity: row.aktiv ? 1 : 0.5,
                    }}>
                      <td style={{ padding: '8px 12px' }}>
                        <button
                          onClick={() => onSelectClient(row.clientId)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: '12px', textDecoration: 'underline', padding: 0, textAlign: 'left' }}
                        >
                          {row.clientName}
                        </button>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '10px', background: cfg.bg, color: cfg.color, fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap' }}>
                          {cfg.icon} {lbl}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {fmtEuro(row.betrag, 2)}
                        <span style={{ marginLeft: '3px', fontSize: '10px', color: row.bruttoNetto === 'brutto' ? '#f97316' : 'var(--text-muted)' }}>
                          {row.bruttoNetto.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {RHYTHMUS_CFG[row.rhythmus]?.label}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: row.monatswert !== null ? '#16a34a' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {row.monatswert !== null ? fmtEuro(row.monatswert) : '–'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {row.jahreswert !== null ? fmtEuro(row.jahreswert) : '–'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {gueltig || '–'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.notiz || '–'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Footer Summen */}
              {sortedRows.some(r => r.monatswert !== null) && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface)' }}>
                    <td colSpan={4} style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Σ {sortedRows.filter(r => r.monatswert !== null).length} laufende Position(en)
                      {kpi.einmaligCount > 0 && ` · ${kpi.einmaligCount} einmalig · `}
                      {kpi.aufwandCount > 0 && `${kpi.aufwandCount} nach Aufwand`}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: ACCENT, whiteSpace: 'nowrap' }}>
                      {fmtEuro(sortedRows.reduce((s, r) => s + (r.monatswert ?? 0), 0))}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: '#16a34a', whiteSpace: 'nowrap' }}>
                      {fmtEuro(sortedRows.reduce((s, r) => s + (r.jahreswert ?? 0), 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* ── Mandanten ohne Honorare ── */}
      {ohneHonorare.length > 0 && (
        <div style={{ border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.05)', borderBottom: '1px solid rgba(239,68,68,0.2)', fontSize: '11px', fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⚠ {ohneHonorare.length} Mandant{ohneHonorare.length !== 1 ? 'en' : ''} ohne Honorar-Vereinbarung
            <span style={{ fontWeight: 400, color: 'rgba(239,68,68,0.7)', marginLeft: '4px' }}>— zum Reiter „Honorare" wechseln und hinterlegen</span>
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', gap: '6px', flexWrap: 'wrap', background: 'var(--surface2)' }}>
            {ohneHonorare.map(c => (
              <button
                key={c.id}
                onClick={() => onSelectClient(c.id)}
                style={{
                  padding: '3px 12px', borderRadius: '20px', border: '1px solid rgba(239,68,68,0.3)',
                  background: 'transparent', color: '#ef4444', fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mandanten mit nur inaktiven Honoraren */}
      {nurInaktiv.length > 0 && (
        <div style={{ border: '1px solid rgba(249,115,22,0.3)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'rgba(249,115,22,0.05)', borderBottom: '1px solid rgba(249,115,22,0.2)', fontSize: '11px', fontWeight: 700, color: '#f97316' }}>
            ○ {nurInaktiv.length} Mandant{nurInaktiv.length !== 1 ? 'en' : ''} mit ausschließlich inaktiven Vereinbarungen
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', gap: '6px', flexWrap: 'wrap', background: 'var(--surface2)' }}>
            {nurInaktiv.map(c => (
              <button
                key={c.id}
                onClick={() => onSelectClient(c.id)}
                style={{
                  padding: '3px 12px', borderRadius: '20px', border: '1px solid rgba(249,115,22,0.3)',
                  background: 'transparent', color: '#f97316', fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Filter-Chip ───────────────────────────────────────────────────────────────────
function FilterChip({ label, value, current, set, color }) {
  const active = current === value
  return (
    <button
      onClick={() => set(value)}
      style={{
        padding: '2px 9px', borderRadius: '20px', border: `1px solid ${active ? color : 'var(--border)'}`,
        background: active ? color : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
        fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}
