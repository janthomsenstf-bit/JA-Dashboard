import { getMandantStatus, MANDANT_STATUS_CONFIG, getClientStatus, getFACountdown } from '../utils/progress.js'

const FILTERS = [
  { key: 'all',               label: 'Alle' },
  { key: 'in_bearbeitung',    label: 'In Bearbeitung' },
  { key: 'warte_feedback',    label: 'Warte auf Feedback' },
  { key: 'warte_unterschrift',label: 'Warte auf Unterschrift' },
  { key: 'erledigt',          label: 'Erledigt' },
  { key: 'open_questions',    label: 'Offene RQ' },
]

const SORT_COLS = ['mandantennummer', 'name', 'veranlagungsjahr', 'status']

export default function ClientTable({
  clients, selectedId, filter, search, sortCol, sortDir,
  onSelect, onFilterChange, onSearchChange, onSort,
}) {
  // Filter + search
  const active   = clients.filter(c => !c.archiviert)
  const archived = clients.filter(c => c.archiviert)

  function matchesFilter(c) {
    if (filter === 'open_questions') {
      const openQ = c.rueckfragen.filter(r => !r.beantwortet).length
      if (openQ === 0) return false
    } else if (filter !== 'all') {
      if (getMandantStatus(c) !== filter) return false
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      return c.mandantennummer.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    }
    return true
  }

  const STATUS_ORDER = { in_bearbeitung: 0, warte_feedback: 1, warte_unterschrift: 2, erledigt: 3 }

  function sortClients(list) {
    return [...list].sort((a, b) => {
      let av, bv
      if (sortCol === 'status') {
        av = STATUS_ORDER[getMandantStatus(a)] ?? 0
        bv = STATUS_ORDER[getMandantStatus(b)] ?? 0
      } else if (sortCol === 'veranlagungsjahr') {
        av = a.veranlagungsjahr
        bv = b.veranlagungsjahr
      } else {
        av = (a[sortCol] ?? '').toString().toLowerCase()
        bv = (b[sortCol] ?? '').toString().toLowerCase()
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }

  const visibleActive   = sortClients(active.filter(matchesFilter))
  const visibleArchived = sortClients(archived.filter(matchesFilter))

  function SortHeader({ col, label }) {
    const active = sortCol === col
    return (
      <span className="col-sort" onClick={() => onSort(col)}>
        {label}
        <span className="sort-arrow">
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
        </span>
      </span>
    )
  }

  function ClientRow({ c }) {
    const status  = getMandantStatus(c)
    const cfg     = MANDANT_STATUS_CONFIG[status]
    const openQ   = c.rueckfragen.filter(r => !r.beantwortet).length
    const isSelected = c.id === selectedId

    // Check FA overdue
    let faFaellig = false
    if (c.faGeplantDatum && !c.faUebermittelt) {
      const cd = getFACountdown(c.faGeplantDatum)
      faFaellig = cd.type === 'overdue' || cd.type === 'today'
    }

    return (
      <div
        className={`client-row${isSelected ? ' selected' : ''}${c.archiviert ? ' archived' : ''}`}
        onClick={() => onSelect(c.id)}
      >
        <span className="client-row-num mono">{c.mandantennummer}</span>

        <div className="client-row-name">
          <span className="client-row-name-main">{c.name}</span>
          <div className="client-row-badges">
            {openQ > 0 && (
              <span className="badge badge-red">{openQ} RQ offen</span>
            )}
            {faFaellig && (
              <span className="badge badge-orange">FA fällig</span>
            )}
            {c.archiviert && (
              <span className="badge badge-muted">Archiv</span>
            )}
          </div>
        </div>

        <span className="client-row-year mono">{c.veranlagungsjahr}</span>

        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
          background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
          whiteSpace: 'nowrap',
        }}>
          {cfg.icon} {cfg.label}
        </span>
      </div>
    )
  }

  return (
    <>
      {/* Header: search + filters */}
      <div className="client-table-header">
        <div className="client-table-search">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Nr. oder Name suchen…"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`filter-tab${filter === f.key ? ' active' : ''}`}
              onClick={() => onFilterChange(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="client-table-cols">
        <SortHeader col="mandantennummer" label="Nr." />
        <SortHeader col="name"            label="Name" />
        <SortHeader col="veranlagungsjahr" label="VJ" />
        <SortHeader col="status"           label="Status" />
      </div>

      {/* Active clients */}
      <div className="client-list">
        {visibleActive.length === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Keine Mandate gefunden
          </div>
        )}
        {visibleActive.map(c => <ClientRow key={c.id} c={c} />)}
      </div>

      {/* Archived section */}
      {visibleArchived.length > 0 && (
        <>
          <div className="archived-section-title">Archiviert ({visibleArchived.length})</div>
          <div className="client-list">
            {visibleArchived.map(c => <ClientRow key={c.id} c={c} />)}
          </div>
        </>
      )}
    </>
  )
}
