/**
 * BudgetView – Globale Honorar- und Budgetübersicht.
 * Aggregiert alle Preisvereinbarungen aller Mandanten.
 * Jahresfilter + Monatsansicht für historische Auswertungen.
 * Keine Buchhaltung – nur interne Planungsübersicht.
 */
import { useState, useMemo } from 'react'
import { LEISTUNGSART_CFG, RHYTHMUS_CFG, toMonatswert, toJahreswert, fmtEuro } from './detail/HonorareTab.jsx'
import DauerrechnungenSammellauf from './DauerrechnungenSammellauf.jsx'

const ACCENT      = '#0f766e'
const CURRENT_YR  = new Date().getFullYear()
const MONTH_NAMES = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const MONTH_SHORT = ['Jan','Feb','Mrz','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

// ── Zeitraum-Hilfsfunktionen ──────────────────────────────────────────────────────

/** Prüft ob ein laufendes Honorar im gewählten Jahr (teilweise) aktiv war. */
function isLaufendInYear(h, year) {
  const yearStart = new Date(year, 0, 1)
  const yearEnd   = new Date(year, 11, 31)
  const startOk   = !h.startDatum || new Date(h.startDatum) <= yearEnd
  const endOk     = !h.endDatum   || new Date(h.endDatum)   >= yearStart
  return startOk && endOk
}

/** Gibt die Monate (1–12) zurück, in denen ein laufendes Honorar im Jahr aktiv war. */
function activeMonthsInYear(h, year) {
  const months = []
  for (let m = 0; m < 12; m++) {
    const mStart = new Date(year, m, 1)
    const mEnd   = new Date(year, m + 1, 0)
    const startOk = !h.startDatum || new Date(h.startDatum) <= mEnd
    const endOk   = !h.endDatum   || new Date(h.endDatum)   >= mStart
    if (startOk && endOk) months.push(m + 1)
  }
  return months
}

/** Gesamtwert eines laufenden Honorars im Jahr (monatswert × aktive Monate). */
function calcLaufendYearValue(h, year) {
  const m = toMonatswert(h.betrag, h.rhythmus) ?? 0
  return m * activeMonthsInYear(h, year).length
}

/** Einmalig/Aufwand: zugeordnet wenn leistungsjahr passt. */
function isEinmaligInYear(h, year) {
  return h.leistungsjahr === year
}

/** Prüft ob ein Honorar im gegebenen Jahr relevant ist. */
function isInYear(h, year) {
  const isEinmalig = h.rhythmus === 'einmalig' || h.rhythmus === 'aufwand'
  return isEinmalig ? isEinmaligInYear(h, year) : isLaufendInYear(h, year)
}

// ── UI-Subkomponenten ─────────────────────────────────────────────────────────────

function KpiKachel({ label, wert, sub, color, icon }) {
  return (
    <div style={{ border: `1px solid ${color}33`, borderRadius: '10px', padding: '14px 16px', background: `${color}08`, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px' }}>{icon}</span>
        <span style={{ fontSize: '10px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>{label}</span>
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color, lineHeight: 1 }}>{wert}</div>
      {sub && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function YearPill({ year, label, current, set, highlight }) {
  const active = current === year
  return (
    <button
      onClick={() => set(year)}
      style={{
        padding: '4px 14px', borderRadius: '20px',
        border: `1px solid ${active ? ACCENT : highlight ? `${ACCENT}55` : 'var(--border)'}`,
        background: active ? ACCENT : 'transparent',
        color: active ? '#fff' : highlight ? ACCENT : 'var(--text-secondary)',
        fontSize: '12px', fontWeight: active || highlight ? 700 : 400,
        cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

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

function Th({ children, align = 'left', onClick, sorted }) {
  return (
    <th onClick={onClick} style={{
      padding: '8px 12px', textAlign: align,
      fontSize: '10px', fontWeight: 700, color: sorted ? ACCENT : 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
      cursor: onClick ? 'pointer' : 'default', userSelect: 'none',
    }}>
      {children}{sorted ? ' ↓' : ''}
    </th>
  )
}

// ── Monatsansicht ─────────────────────────────────────────────────────────────────
function Monatsansicht({ clients, year, nurAktiv, filterArt }) {
  const months = useMemo(() => {
    const data = Array.from({ length: 12 }, (_, i) => ({
      monat: i + 1,
      name:  MONTH_NAMES[i],
      short: MONTH_SHORT[i],
      laufend: 0,
      laufendPositionen: [],
    }))

    clients.filter(c => !c.archiviert).forEach(c => {
      ;(c.honorare ?? []).forEach(h => {
        if (nurAktiv && !h.aktiv) return
        if (filterArt !== 'alle' && h.leistungsart !== filterArt) return
        if (h.rhythmus === 'einmalig' || h.rhythmus === 'aufwand') return

        const mw = toMonatswert(h.betrag, h.rhythmus) ?? 0
        activeMonthsInYear(h, year).forEach(m => {
          data[m - 1].laufend += mw
          data[m - 1].laufendPositionen.push({ ...h, clientName: c.name, monatswert: mw })
        })
      })
    })
    return data
  }, [clients, year, nurAktiv, filterArt])

  // Einmalige für das Jahr
  const einmalige = useMemo(() => {
    const result = []
    clients.filter(c => !c.archiviert).forEach(c => {
      ;(c.honorare ?? []).forEach(h => {
        if (nurAktiv && !h.aktiv) return
        if (filterArt !== 'alle' && h.leistungsart !== filterArt) return
        if (h.rhythmus !== 'einmalig' && h.rhythmus !== 'aufwand') return
        if (h.leistungsjahr !== year) return
        result.push({ ...h, clientName: c.name })
      })
    })
    return result
  }, [clients, year, nurAktiv, filterArt])

  const laufendJahresgesamt = months.reduce((s, m) => s + m.laufend, 0)
  const einmaligGesamt      = einmalige.filter(h => h.rhythmus === 'einmalig').reduce((s, h) => s + h.betrag, 0)
  const [expandedMonth, setExpandedMonth] = useState(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Monatstabelle */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Monatliche Einnahmen {year}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>Klick = Details</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                <Th>Monat</Th>
                <Th align="right">Laufend</Th>
                <Th>Positionen</Th>
                <Th align="right">vs. ∅ Monat</Th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => {
                const avgMonthly = laufendJahresgesamt / 12
                const diff       = m.laufend - avgMonthly
                const isExpanded = expandedMonth === m.monat
                const isNow      = m.monat === new Date().getMonth() + 1 && year === CURRENT_YR

                return (
                  <>
                    <tr key={m.monat}
                      onClick={() => setExpandedMonth(isExpanded ? null : m.monat)}
                      style={{
                        borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                        background: isNow ? 'rgba(15,118,110,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                        cursor: m.laufendPositionen.length > 0 ? 'pointer' : 'default',
                        transition: 'background 0.1s',
                      }}
                    >
                      <td style={{ padding: '8px 12px', fontWeight: isNow ? 700 : 400, color: isNow ? ACCENT : 'var(--text)' }}>
                        {isNow ? '▶ ' : ''}{m.name} {year}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: m.laufend > 0 ? '#16a34a' : 'var(--text-muted)' }}>
                        {m.laufend > 0 ? fmtEuro(m.laufend) : '–'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '11px' }}>
                        {m.laufendPositionen.length > 0
                          ? `${m.laufendPositionen.length} Position${m.laufendPositionen.length !== 1 ? 'en' : ''}`
                          : '–'}
                        {m.laufendPositionen.length > 0 && <span style={{ marginLeft: '4px', fontSize: '10px' }}>{isExpanded ? '▲' : '▼'}</span>}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', color: diff > 0.01 ? '#16a34a' : diff < -0.01 ? '#ef4444' : 'var(--text-muted)' }}>
                        {avgMonthly > 0 ? (diff > 0 ? '+' : '') + fmtEuro(diff) : '–'}
                      </td>
                    </tr>
                    {isExpanded && m.laufendPositionen.length > 0 && (
                      <tr key={`${m.monat}-detail`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td colSpan={4} style={{ padding: '0 12px 10px 32px', background: 'rgba(15,118,110,0.03)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '6px' }}>
                            {m.laufendPositionen.map((p, pi) => {
                              const cfg = LEISTUNGSART_CFG[p.leistungsart] ?? LEISTUNGSART_CFG.sonstiges
                              return (
                                <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                                  <span>{cfg.icon}</span>
                                  <span style={{ color: cfg.color, fontWeight: 600 }}>{p.clientName}</span>
                                  <span style={{ color: 'var(--text-muted)' }}>{cfg.label}</span>
                                  <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#16a34a' }}>{fmtEuro(p.monatswert)}</span>
                                </div>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface)' }}>
                <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Jahresgesamt (laufend)</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: ACCENT }}>{fmtEuro(laufendJahresgesamt)}</td>
                <td style={{ padding: '8px 12px', fontSize: '10px', color: 'var(--text-muted)' }}>Ø {fmtEuro(laufendJahresgesamt / 12)}/Mon.</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Einmalige im Jahr */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
            Einmalige Honorare {year}
          </span>
          {einmalige.length > 0 && (
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#f97316' }}>{fmtEuro(einmaligGesamt)}</span>
          )}
        </div>
        {einmalige.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
            Keine einmaligen Honorare mit Leistungsjahr {year}.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  <Th>Mandant</Th>
                  <Th>Leistungsart</Th>
                  <Th>Rhythmus</Th>
                  <Th align="right">Betrag</Th>
                  <Th>Notiz</Th>
                </tr>
              </thead>
              <tbody>
                {einmalige.map((h, i) => {
                  const cfg = LEISTUNGSART_CFG[h.leistungsart] ?? LEISTUNGSART_CFG.sonstiges
                  const lbl = h.leistungsart === 'sonstiges' && h.bezeichnung ? h.bezeichnung : cfg.label
                  return (
                    <tr key={h.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{h.clientName}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '10px', background: cfg.bg, color: cfg.color, fontWeight: 600, fontSize: '11px' }}>
                          {cfg.icon} {lbl}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{RHYTHMUS_CFG[h.rhythmus]?.label}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: h.rhythmus === 'einmalig' ? '#f97316' : 'var(--text-muted)' }}>
                        {h.rhythmus === 'einmalig' ? fmtEuro(h.betrag, 2) : '–'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.notiz || '–'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {einmaligGesamt > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface)' }}>
                    <td colSpan={3} style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Gesamtjahr {year}: laufend + einmalig
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: ACCENT }}>
                      {fmtEuro(laufendJahresgesamt + einmaligGesamt)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────────
export default function BudgetView({ clients, onSelectClient, onUpdateClient, emailSignaturen = [] }) {
  const [yearFilter,    setYearFilter]    = useState(null)         // null = alle Jahre
  const [viewMode,      setViewMode]      = useState('uebersicht') // 'uebersicht' | 'monate'
  const [filterArt,     setFilterArt]     = useState('alle')
  const [nurAktiv,      setNurAktiv]      = useState(true)
  const [sortBy,        setSortBy]        = useState('mandant')

  // Verfügbare Jahre: 4 Jahre vor aktuell bis 2 nach aktuell + Jahre aus Daten
  const availableYears = useMemo(() => {
    const years = new Set()
    for (let y = CURRENT_YR - 4; y <= CURRENT_YR + 2; y++) years.add(y)
    clients.forEach(c => (c.honorare ?? []).forEach(h => {
      if (h.leistungsjahr) years.add(h.leistungsjahr)
      if (h.startDatum)    years.add(new Date(h.startDatum).getFullYear())
    }))
    return [...years].sort((a, b) => b - a) // neueste zuerst
  }, [clients])

  // ── Gefilterte Einträge ──────────────────────────────────────────────────────────
  const alleEintraege = useMemo(() => {
    const result = []
    clients.filter(c => !c.archiviert).forEach(c => {
      ;(c.honorare ?? []).forEach(h => {
        if (nurAktiv && !h.aktiv) return
        if (filterArt !== 'alle' && h.leistungsart !== filterArt) return
        if (yearFilter !== null && !isInYear(h, yearFilter)) return

        const isEinmalig = h.rhythmus === 'einmalig' || h.rhythmus === 'aufwand'
        const monatswert = isEinmalig ? null : toMonatswert(h.betrag, h.rhythmus)
        const jahreswert = yearFilter !== null && !isEinmalig
          ? calcLaufendYearValue(h, yearFilter)
          : (isEinmalig ? null : toJahreswert(h.betrag, h.rhythmus))

        result.push({
          ...h,
          clientId:    c.id,
          clientName:  c.name,
          monatswert,
          jahreswert,
          activeMonths: yearFilter !== null && !isEinmalig ? activeMonthsInYear(h, yearFilter).length : null,
        })
      })
    })
    return result
  }, [clients, nurAktiv, filterArt, yearFilter])

  // ── KPIs ────────────────────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const laufend  = alleEintraege.filter(e => e.monatswert !== null)
    const einmalig = alleEintraege.filter(e => e.rhythmus === 'einmalig')
    const aufwand  = alleEintraege.filter(e => e.rhythmus === 'aufwand')

    const monatsSumme  = laufend.reduce((s, e) => s + e.monatswert, 0)
    const jahresLaufend = yearFilter !== null
      ? laufend.reduce((s, e) => s + (e.jahreswert ?? 0), 0)    // nur aktive Monate
      : laufend.reduce((s, e) => s + (e.jahreswert ?? 0), 0)    // voller Jahreswert
    const einmaligSumme = einmalig.reduce((s, e) => s + e.betrag, 0)

    return { monatsSumme, jahresLaufend, einmaligSumme, einmaligCount: einmalig.length, aufwandCount: aufwand.length }
  }, [alleEintraege, yearFilter])

  // ── Verteilung nach Leistungsart ─────────────────────────────────────────────────
  const byArt = useMemo(() => {
    const result = {}
    alleEintraege.filter(e => e.monatswert !== null).forEach(e => {
      if (!result[e.leistungsart]) result[e.leistungsart] = { monat: 0, jahr: 0, count: 0 }
      result[e.leistungsart].monat += e.monatswert
      result[e.leistungsart].jahr  += (e.jahreswert ?? 0)
      result[e.leistungsart].count++
    })
    return result
  }, [alleEintraege])

  // ── Top-Mandanten ────────────────────────────────────────────────────────────────
  const byMandant = useMemo(() => {
    const result = {}
    alleEintraege.filter(e => e.monatswert !== null).forEach(e => {
      if (!result[e.clientId]) result[e.clientId] = { name: e.clientName, monat: 0, jahr: 0, count: 0 }
      result[e.clientId].monat += e.monatswert
      result[e.clientId].jahr  += (e.jahreswert ?? 0)
      result[e.clientId].count++
    })
    return Object.entries(result).sort((a, b) => b[1].monat - a[1].monat)
  }, [alleEintraege])

  // ── Sortierte Tabelle ────────────────────────────────────────────────────────────
  const sortedRows = useMemo(() => {
    return [...alleEintraege].sort((a, b) => {
      if (sortBy === 'mandant') return a.clientName.localeCompare(b.clientName)
      if (sortBy === 'monat')   return (b.monatswert ?? -Infinity) - (a.monatswert ?? -Infinity)
      if (sortBy === 'art')     return a.leistungsart.localeCompare(b.leistungsart)
      if (sortBy === 'betrag')  return b.betrag - a.betrag
      return 0
    })
  }, [alleEintraege, sortBy])

  // Einmalige ohne Leistungsjahr (Warnung)
  const einmaligOhneJahr = useMemo(() => {
    let count = 0
    clients.filter(c => !c.archiviert).forEach(c =>
      (c.honorare ?? []).forEach(h => {
        if (h.aktiv && (h.rhythmus === 'einmalig' || h.rhythmus === 'aufwand') && !h.leistungsjahr) count++
      })
    )
    return count
  }, [clients])

  // Mandanten ohne Honorare
  const ohneHonorare = clients.filter(c => !c.archiviert && (!c.honorare || c.honorare.length === 0))

  // Offene abrechenbare Zeiten (Zeiterfassung, mandantenübergreifend)
  const offeneZeiten = useMemo(() => {
    const rows = []
    let totalBetrag = 0, totalMin = 0
    clients.filter(c => !c.archiviert).forEach(c => {
      const offen = (c.zeiteintraege ?? []).filter(z => z.status !== 'abgerechnet')
      if (offen.length === 0) return
      const satz = c.stundensatz ?? 90
      let min = 0, betrag = 0, pausch = 0
      offen.forEach(z => {
        if (z.art === 'pauschale') { betrag += (z.pauschalBetrag || 0); pausch++ }
        else { min += (z.dauerMin || 0); betrag += ((z.dauerMin || 0) / 60) * satz }
      })
      rows.push({ id: c.id, name: c.name, min, betrag, pausch, anzahl: offen.length })
      totalBetrag += betrag; totalMin += min
    })
    rows.sort((a, b) => b.betrag - a.betrag)
    return { rows, totalBetrag, totalMin }
  }, [clients])

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Fällige Dauerrechnungen (Sammel-Erzeugung + Versand) ── */}
      {onUpdateClient && <DauerrechnungenSammellauf clients={clients} onUpdateClient={onUpdateClient} signaturen={emailSignaturen} />}

      {/* ── Header ── */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>💰</span> Honorar- & Budgetübersicht
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          Planungsübersicht aller vereinbarten Honorare — rein intern, kein Ersatz für Buchhaltung.
        </p>
      </div>

      {/* ── Jahresauswahl ── */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Zeile 1: Jahr-Pills */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Zeitraum:</span>
          <YearPill year={null}       label="Alle Jahre" current={yearFilter} set={(y) => { setYearFilter(y); setViewMode('uebersicht') }} />
          {availableYears.map(y => (
            <YearPill key={y} year={y} label={String(y)} current={yearFilter} set={setYearFilter} highlight={y === CURRENT_YR} />
          ))}
        </div>

        {/* Zeile 2: Ansicht (nur wenn Jahr gewählt) */}
        {yearFilter !== null && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Ansicht:</span>
            <button
              onClick={() => setViewMode('uebersicht')}
              style={{
                padding: '3px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${viewMode === 'uebersicht' ? ACCENT : 'var(--border)'}`,
                background: viewMode === 'uebersicht' ? 'rgba(15,118,110,0.1)' : 'transparent',
                color: viewMode === 'uebersicht' ? ACCENT : 'var(--text-secondary)',
              }}
            >
              📊 Jahresübersicht
            </button>
            <button
              onClick={() => setViewMode('monate')}
              style={{
                padding: '3px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${viewMode === 'monate' ? ACCENT : 'var(--border)'}`,
                background: viewMode === 'monate' ? 'rgba(15,118,110,0.1)' : 'transparent',
                color: viewMode === 'monate' ? ACCENT : 'var(--text-secondary)',
              }}
            >
              📅 Monatsansicht
            </button>
            <span style={{ marginLeft: '4px', fontSize: '11px', color: ACCENT, fontWeight: 600 }}>
              · Jahr {yearFilter}
            </span>
          </div>
        )}
      </div>

      {/* ── Offene abrechenbare Zeiten (Zeiterfassung) ── */}
      {offeneZeiten.rows.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
              ⏱ Wer hat offene abrechenbare Zeiten?
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0891b2' }}>{fmtEuro(offeneZeiten.totalBetrag)}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>offen gesamt</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  <Th>Mandant</Th>
                  <Th align="right">Offene Stunden</Th>
                  <Th align="right">Offener Betrag</Th>
                </tr>
              </thead>
              <tbody>
                {offeneZeiten.rows.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <button onClick={() => onSelectClient(r.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: '12px', textDecoration: 'underline', padding: 0 }}>
                        {r.name}
                      </button>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {r.min > 0 ? (r.min / 60).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + ' Std' : '–'}
                      {r.pausch > 0 && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#7c3aed' }}>+{r.pausch} Pausch.</span>}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0891b2', whiteSpace: 'nowrap' }}>
                      {fmtEuro(r.betrag, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface)' }}>
                  <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Σ {offeneZeiten.rows.length} Mandant{offeneZeiten.rows.length !== 1 ? 'en' : ''}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {(offeneZeiten.totalMin / 60).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Std
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: '#0891b2', whiteSpace: 'nowrap' }}>
                    {fmtEuro(offeneZeiten.totalBetrag)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Warnung: einmalige ohne Jahr ── */}
      {einmaligOhneJahr > 0 && yearFilter !== null && (
        <div style={{ border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px', padding: '9px 12px', background: 'rgba(249,115,22,0.06)', fontSize: '12px', color: '#f97316' }}>
          ⚠ <strong>{einmaligOhneJahr} einmalige Position{einmaligOhneJahr !== 1 ? 'en' : ''}</strong> ohne Leistungsjahr — werden in der Jahresansicht nicht angezeigt.
          Bitte im Mandanten-Reiter „Honorare" ein Jahr zuordnen.
        </div>
      )}

      {/* ── Monatsansicht ── */}
      {yearFilter !== null && viewMode === 'monate' && (
        <Monatsansicht clients={clients} year={yearFilter} nurAktiv={nurAktiv} filterArt={filterArt} />
      )}

      {/* ── Jahresübersicht / Gesamtansicht ── */}
      {viewMode === 'uebersicht' && (
        <>
          {/* KPI-Kacheln */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
            <KpiKachel
              label={yearFilter ? `Monatswert ∅ ${yearFilter}` : 'Monatlich laufend'}
              wert={fmtEuro(kpi.monatsSumme)}
              sub={yearFilter ? 'Durchschnittliche Auslastung' : 'Summe aller aktiven, lfd. Positionen'}
              color={ACCENT} icon="📅"
            />
            <KpiKachel
              label={yearFilter ? `Laufend gesamt ${yearFilter}` : 'Jahreswert laufend'}
              wert={fmtEuro(kpi.jahresLaufend)}
              sub={yearFilter ? 'Nur aktive Monate gewertet' : 'Hochgerechnet auf 12 Monate'}
              color="#16a34a" icon="📆"
            />
            {kpi.einmaligCount > 0 && (
              <KpiKachel
                label={yearFilter ? `Einmalig ${yearFilter} (${kpi.einmaligCount})` : `Einmalig (${kpi.einmaligCount})`}
                wert={fmtEuro(kpi.einmaligSumme)}
                sub="Nicht in laufendem Monatswert"
                color="#f97316" icon="⚡"
              />
            )}
            {kpi.einmaligCount > 0 && kpi.einmaligSumme > 0 && (
              <KpiKachel
                label={yearFilter ? `Gesamtjahr ${yearFilter}` : 'Gesamtjahr (lfd.+einm.)'}
                wert={fmtEuro(kpi.jahresLaufend + kpi.einmaligSumme)}
                sub="Laufend + einmalig"
                color="#7c3aed" icon="🎯"
              />
            )}
            {kpi.aufwandCount > 0 && (
              <KpiKachel label="Nach Aufwand" wert={`${kpi.aufwandCount}`} sub="Positionen — nicht planbar" color="#64748b" icon="⏱" />
            )}
            {ohneHonorare.length > 0 && !yearFilter && (
              <KpiKachel label="Ohne Honorare" wert={`${ohneHonorare.length}`} sub="Mandanten fehlen noch" color="#ef4444" icon="⚠️" />
            )}
          </div>

          {/* Verteilung nach Leistungsart */}
          {Object.keys(byArt).length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Verteilung nach Leistungsart · laufende Positionen{yearFilter ? ` in ${yearFilter}` : ''}
              </div>
              <div style={{ padding: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', background: 'var(--surface2)' }}>
                {Object.entries(byArt).sort((a, b) => b[1].monat - a[1].monat).map(([art, data]) => {
                  const cfg = LEISTUNGSART_CFG[art] ?? LEISTUNGSART_CFG.sonstiges
                  const pct = kpi.monatsSumme > 0 ? Math.round(data.monat / kpi.monatsSumme * 100) : 0
                  return (
                    <div key={art}
                      onClick={() => setFilterArt(filterArt === art ? 'alle' : art)}
                      style={{
                        flex: '1 1 150px', border: `1px solid ${filterArt === art ? cfg.color : cfg.color + '33'}`,
                        borderRadius: '8px', padding: '10px 12px',
                        background: filterArt === art ? cfg.bg : 'var(--surface)',
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

          {/* Top-Mandanten (nur bei >3) */}
          {byMandant.length > 3 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Top-Mandanten nach lfd. Monatswert{yearFilter ? ` · ${yearFilter}` : ''}
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--surface2)' }}>
                {byMandant.slice(0, 5).map(([id, data]) => {
                  const pct = kpi.monatsSumme > 0 ? Math.round(data.monat / kpi.monatsSumme * 100) : 0
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <button onClick={() => onSelectClient(id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: '12px', textDecoration: 'underline', padding: 0, minWidth: '140px', textAlign: 'left', flexShrink: 0 }}>
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

          {/* ── Positionstabelle ── */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Positionen{yearFilter ? ` · ${yearFilter}` : ''}
              </span>

              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)', userSelect: 'none' }}>
                <input type="checkbox" checked={nurAktiv} onChange={e => setNurAktiv(e.target.checked)}
                  style={{ accentColor: ACCENT, cursor: 'pointer' }} />
                nur aktive
              </label>

              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                <FilterChip label="Alle" value="alle" current={filterArt} set={setFilterArt} color={ACCENT} />
                {Object.entries(LEISTUNGSART_CFG).map(([k, v]) => (
                  <FilterChip key={k} label={`${v.icon} ${v.label}`} value={k} current={filterArt} set={setFilterArt} color={v.color} />
                ))}
              </div>
            </div>

            {sortedRows.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>💰</div>
                <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                  {yearFilter ? `Keine Positionen für ${yearFilter}` : 'Noch keine Preisvereinbarungen'}
                </div>
                <div style={{ fontSize: '12px' }}>
                  {yearFilter
                    ? 'Laufende Honorare oder einmalige Positionen mit Leistungsjahr ' + yearFilter + ' anlegen.'
                    : 'Öffne einen Mandanten und wechsle zum Reiter Honorare.'}
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                      <Th onClick={() => setSortBy('mandant')} sorted={sortBy === 'mandant'}>Mandant</Th>
                      <Th onClick={() => setSortBy('art')} sorted={sortBy === 'art'}>Leistungsart</Th>
                      <Th onClick={() => setSortBy('betrag')} sorted={sortBy === 'betrag'}>Betrag</Th>
                      <Th>Rhythmus</Th>
                      {yearFilter && <Th align="center">Aktive Monate</Th>}
                      <Th align="right" onClick={() => setSortBy('monat')} sorted={sortBy === 'monat'}>Monatswert</Th>
                      <Th align="right">Jahreswert</Th>
                      <Th>Jahr</Th>
                      <Th>Notiz</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, i) => {
                      const cfg = LEISTUNGSART_CFG[row.leistungsart] ?? LEISTUNGSART_CFG.sonstiges
                      const lbl = row.leistungsart === 'sonstiges' && row.bezeichnung ? row.bezeichnung : cfg.label
                      return (
                        <tr key={`${row.clientId}-${row.id}`} style={{
                          borderBottom: '1px solid var(--border)',
                          background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                          opacity: row.aktiv ? 1 : 0.5,
                        }}>
                          <td style={{ padding: '8px 12px' }}>
                            <button onClick={() => onSelectClient(row.clientId)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: '12px', textDecoration: 'underline', padding: 0 }}>
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
                          {yearFilter && (
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
                              {row.activeMonths !== null ? `${row.activeMonths}/12 Mon.` : '–'}
                            </td>
                          )}
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: row.monatswert !== null ? '#16a34a' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {row.monatswert !== null ? fmtEuro(row.monatswert) : '–'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {row.jahreswert !== null ? fmtEuro(row.jahreswert) : (row.rhythmus === 'einmalig' ? fmtEuro(row.betrag) : '–')}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {row.leistungsjahr
                              ? <span style={{ fontSize: '10px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', padding: '1px 7px', borderRadius: '8px', fontWeight: 700 }}>{row.leistungsjahr}</span>
                              : <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>–</span>}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.notiz || '–'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>

                  {sortedRows.some(r => r.monatswert !== null) && (
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface)' }}>
                        <td colSpan={yearFilter ? 5 : 4} style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                          Σ {sortedRows.filter(r => r.monatswert !== null).length} laufende · {sortedRows.filter(r => r.rhythmus === 'einmalig').length} einmalig
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: ACCENT, whiteSpace: 'nowrap' }}>
                          {fmtEuro(sortedRows.reduce((s, r) => s + (r.monatswert ?? 0), 0))}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: '14px', color: '#16a34a', whiteSpace: 'nowrap' }}>
                          {fmtEuro(sortedRows.reduce((s, r) => s + (r.jahreswert ?? (r.rhythmus === 'einmalig' ? r.betrag : 0)), 0))}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          {/* Mandanten ohne Honorare */}
          {ohneHonorare.length > 0 && !yearFilter && (
            <div style={{ border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.05)', borderBottom: '1px solid rgba(239,68,68,0.2)', fontSize: '11px', fontWeight: 700, color: '#ef4444' }}>
                ⚠ {ohneHonorare.length} Mandant{ohneHonorare.length !== 1 ? 'en' : ''} ohne Honorar-Vereinbarung
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', gap: '6px', flexWrap: 'wrap', background: 'var(--surface2)' }}>
                {ohneHonorare.map(c => (
                  <button key={c.id} onClick={() => onSelectClient(c.id)}
                    style={{ padding: '3px 12px', borderRadius: '20px', border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
