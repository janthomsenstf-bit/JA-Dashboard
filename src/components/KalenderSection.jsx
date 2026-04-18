import { useState } from 'react'
import TerminModal from './TerminModal.jsx'

const ART_CONFIG = {
  online:     { label: 'Online-Termin', icon: '💻', color: '#3b82f6', bg: '#dbeafe' },
  frist:      { label: 'Frist / FA',    icon: '⚠️', color: '#dc2626', bg: '#fee2e2' },
  erinnerung: { label: 'Erinnerung',    icon: '📝', color: '#d97706', bg: '#fef3c7' },
  versenden:  { label: 'JA versenden',  icon: '📬', color: '#16a34a', bg: '#dcfce7' },
}

const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const DOW    = ['Mo','Di','Mi','Do','Fr','Sa','So']

function toYMD(d) {
  return d.toISOString().slice(0, 10)
}

function getCalendarDays(month) {
  const year = month.getFullYear()
  const m    = month.getMonth()
  const firstDay = new Date(year, m, 1)
  const lastDay  = new Date(year, m + 1, 0)

  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const days = []

  // Vortages-Tage
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, m, -i)
    days.push({ date: d, current: false })
  }

  // Tage des Monats
  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push({ date: new Date(year, m, day), current: true })
  }

  // Folge-Tage auffüllen bis 42 Felder
  while (days.length < 42) {
    const d = new Date(year, m + 1, days.length - startDow - lastDay.getDate() + 1)
    days.push({ date: d, current: false })
  }

  return days
}

function fmtDatum(ymd, uhrzeit) {
  if (!ymd) return ''
  const [y, mo, d] = ymd.split('-')
  const base = `${d}.${mo}.${y}`
  return uhrzeit ? `${base} ${uhrzeit}` : base
}

export default function KalenderSection({ termine, clients, onAdd, onUpdate, onDelete, compact = false, prefillMandantId = null, eventsOnly = false }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState(null)
  const [filter, setFilter]           = useState(30)
  const [showModal, setShowModal]     = useState(false)
  const [editTermin, setEditTermin]   = useState(null)

  const todayStr = toYMD(new Date())

  const calDays = getCalendarDays(currentMonth)

  // Termine nach Datum gruppiert (für Dots)
  const terminByDay = {}
  termine.forEach(t => {
    if (!terminByDay[t.datum]) terminByDay[t.datum] = []
    terminByDay[t.datum].push(t)
  })

  function prevMonth() {
    setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  }
  function nextMonth() {
    setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))
  }

  // Gefilterte Termine
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const filteredTermine = termine.filter(t => {
    if (selectedDay) return t.datum === selectedDay
    const d = new Date(t.datum)
    d.setHours(0, 0, 0, 0)
    if (filter === 'all') return true
    const days = filter
    const end = new Date(today)
    end.setDate(end.getDate() + days)
    return d >= new Date(today.getTime() - 24 * 60 * 60 * 1000) && d <= end
  }).sort((a, b) => a.datum.localeCompare(b.datum) || (a.uhrzeit || '').localeCompare(b.uhrzeit || ''))

  function handleSave(formData) {
    if (editTermin) {
      onUpdate(editTermin.id, formData)
    } else {
      onAdd({
        ...formData,
        id:        'trm_' + Date.now().toString(36),
        erledigt:  false,
        createdAt: new Date().toISOString(),
      })
    }
    setShowModal(false)
    setEditTermin(null)
  }

  function handleDeleteDay(id) {
    if (window.confirm('Termin wirklich löschen?')) onDelete(id)
  }

  function getMandantName(mandantId) {
    if (!mandantId) return null
    const c = clients.find(cl => cl.id === mandantId)
    return c ? c.name : null
  }

  const pendingCount = termine.filter(t => {
    const d = new Date(t.datum)
    d.setHours(0, 0, 0, 0)
    return !t.erledigt && d >= today
  }).length

  // ── Kompakter Events-only Modus ────────────────────────────────────────────
  if (eventsOnly) {
    const upcomingTermine = termine
      .filter(t => {
        const d = new Date(t.datum); d.setHours(0, 0, 0, 0)
        return d >= new Date(today.getTime() - 24 * 60 * 60 * 1000)
      })
      .sort((a, b) => a.datum.localeCompare(b.datum) || (a.uhrzeit || '').localeCompare(b.uhrzeit || ''))
      .slice(0, 10)

    return (
      <div className="kalender-events-only">
        <div className="kalender-events-only-header">
          <span style={{ fontWeight: 700, fontSize: '13px' }}>📅 Termine</span>
          {pendingCount > 0 && (
            <span className="badge badge-blue" style={{ fontSize: '10px' }}>{pendingCount}</span>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setEditTermin(null); setShowModal(true) }}
            style={{ marginLeft: 'auto', fontSize: '11px', padding: '3px 8px' }}
          >＋ Neu</button>
        </div>

        <div className="kalender-events-only-list">
          {upcomingTermine.length === 0 ? (
            <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              Keine anstehenden Termine
            </div>
          ) : upcomingTermine.map(t => {
            const cfg      = ART_CONFIG[t.art] ?? ART_CONFIG.erinnerung
            const tDate    = new Date(t.datum); tDate.setHours(0, 0, 0, 0)
            const isToday  = t.datum === todayStr
            const isOverdue= !t.erledigt && tDate < today
            const mandant  = getMandantName(t.mandantId)
            return (
              <div key={t.id} className={`kalender-events-only-item${t.erledigt ? ' done' : ''}${isOverdue ? ' overdue' : ''}`}>
                <span className="ev-art-badge" style={{ background: cfg.bg }} title={cfg.label}>{cfg.icon}</span>
                <div className="ev-info">
                  <div className="ev-datum" style={{ color: isOverdue ? 'var(--red)' : isToday ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {isToday && <strong style={{ marginRight: '4px' }}>HEUTE</strong>}
                    {isOverdue && <span style={{ marginRight: '4px' }}>⚠</span>}
                    {fmtDatum(t.datum, t.uhrzeit)}
                  </div>
                  {mandant && <div className="ev-mandant">{mandant}</div>}
                  {t.beschreibung && <div className="ev-beschreibung">{t.beschreibung}</div>}
                </div>
                <div className="ev-actions">
                  <input type="checkbox" checked={!!t.erledigt}
                    onChange={e => onUpdate(t.id, { erledigt: e.target.checked })}
                    style={{ cursor: 'pointer', accentColor: 'var(--green)' }} />
                  <button className="btn btn-ghost btn-sm"
                    onClick={() => { setEditTermin(t); setShowModal(true) }}
                    style={{ fontSize: '10px', padding: '1px 4px' }} title="Bearbeiten">✏️</button>
                </div>
              </div>
            )
          })}
        </div>

        {showModal && (
          <TerminModal
            termin={editTermin}
            clients={clients}
            prefillMandantId={editTermin ? null : prefillMandantId}
            onSave={handleSave}
            onClose={() => { setShowModal(false); setEditTermin(null) }}
          />
        )}
      </div>
    )
  }

  // Filter-Label wenn Tag ausgewählt
  function selectedDayLabel() {
    if (!selectedDay) return null
    const [y, mo, d] = selectedDay.split('-')
    return `${d}.${mo}.${y}`
  }

  return (
    <div className={compact ? 'kalender-section-compact' : 'kalender-section'}>
      {/* ─── Linke Spalte / Oben (compact): Monatskalender ─── */}
      <div className={compact ? 'kalender-left-compact' : 'kalender-left'}>
        {/* Monat-Navigation */}
        <div className="kalender-month-nav">
          <button onClick={prevMonth} title="Vormonat">‹</button>
          <span>{MONATE[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
          <button onClick={nextMonth} title="Nächster Monat">›</button>
        </div>

        {/* Wochentag-Header */}
        <div className="kalender-grid">
          {DOW.map(d => (
            <div key={d} className="kalender-dow">{d}</div>
          ))}

          {/* Tage */}
          {calDays.map((item, idx) => {
            const ymd      = toYMD(item.date)
            const isToday  = ymd === todayStr
            const isSel    = ymd === selectedDay
            const dots     = terminByDay[ymd] ?? []

            let cls = 'kalender-day'
            if (!item.current) cls += ' other-month'
            if (isToday)       cls += ' today'
            if (isSel)         cls += ' selected'

            return (
              <div
                key={idx}
                className={cls}
                onClick={() => setSelectedDay(prev => prev === ymd ? null : ymd)}
                title={ymd}
              >
                <span className="day-num">{item.date.getDate()}</span>
                {dots.length > 0 && (
                  <div className="day-dots">
                    {dots.slice(0, 4).map((t, i) => (
                      <span
                        key={i}
                        className="day-dot"
                        style={{ background: ART_CONFIG[t.art]?.color ?? '#94a3b8' }}
                        title={ART_CONFIG[t.art]?.label}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legende */}
        <div className="kalender-legende">
          {Object.entries(ART_CONFIG).map(([key, cfg]) => (
            <div key={key} className="kalender-legende-item">
              <span className="kalender-legende-dot" style={{ background: cfg.color }} />
              {cfg.label}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Rechte Spalte / Unten (compact): Terminliste ─── */}
      <div className={compact ? 'kalender-right-compact' : 'kalender-right'}>
        {/* Header */}
        <div className="kalender-right-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px' }}>Kommende Termine</span>
            {pendingCount > 0 && (
              <span className="badge badge-blue" style={{ fontSize: '11px' }}>{pendingCount}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Filter-Buttons */}
            <div className="kalender-filter-btns">
              {selectedDay ? (
                <button
                  className="kalender-filter-btn active"
                  onClick={() => setSelectedDay(null)}
                  title="Tagesfilter entfernen"
                >
                  {selectedDayLabel()} ×
                </button>
              ) : (
                <>
                  {[30, 90, 'all'].map(f => (
                    <button
                      key={f}
                      className={`kalender-filter-btn${filter === f && !selectedDay ? ' active' : ''}`}
                      onClick={() => setFilter(f)}
                    >
                      {f === 'all' ? 'Alle' : `${f} Tage`}
                    </button>
                  ))}
                </>
              )}
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setEditTermin(null); setShowModal(true) }}
              style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
            >
              ＋ Neuer Termin
            </button>
          </div>
        </div>

        {/* Terminliste */}
        <div className="kalender-termine-list">
          {filteredTermine.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
              Keine Termine in diesem Zeitraum
            </div>
          ) : (
            filteredTermine.map(t => {
              const cfg        = ART_CONFIG[t.art] ?? ART_CONFIG.erinnerung
              const tDate      = new Date(t.datum); tDate.setHours(0, 0, 0, 0)
              const isToday    = t.datum === todayStr
              const isOverdue  = !t.erledigt && tDate < today
              const mandant    = getMandantName(t.mandantId)

              let itemCls = 'kalender-termin-item'
              if (isOverdue)   itemCls += ' overdue'
              else if (isToday) itemCls += ' today-item'
              if (t.erledigt)  itemCls += ' erledigt'

              return (
                <div key={t.id} className={itemCls}>
                  {/* Art-Badge */}
                  <div
                    className="termin-art-badge"
                    style={{ background: cfg.bg }}
                    title={cfg.label}
                  >
                    {cfg.icon}
                  </div>

                  {/* Info */}
                  <div className="termin-info">
                    <div className="termin-datum">
                      {isOverdue && <span style={{ color: 'var(--red)', marginRight: '4px' }}>⚠️</span>}
                      {isToday && <span style={{
                        background: 'var(--accent)', color: '#fff',
                        fontSize: '9px', padding: '1px 5px', borderRadius: '4px',
                        marginRight: '4px', fontWeight: 700,
                      }}>HEUTE</span>}
                      {fmtDatum(t.datum, t.uhrzeit)}
                    </div>
                    {mandant && <div className="termin-mandant">{mandant}</div>}
                    {t.beschreibung && <div className="termin-beschreibung">{t.beschreibung}</div>}
                  </div>

                  {/* Actions */}
                  <div className="termin-actions">
                    <input
                      type="checkbox"
                      checked={!!t.erledigt}
                      onChange={e => onUpdate(t.id, { erledigt: e.target.checked })}
                      title="Erledigt"
                      style={{ cursor: 'pointer', accentColor: 'var(--green)' }}
                    />
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => { setEditTermin(t); setShowModal(true) }}
                      title="Bearbeiten"
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDeleteDay(t.id)}
                      title="Löschen"
                      style={{ fontSize: '11px', padding: '2px 6px', color: 'var(--red)' }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <TerminModal
          termin={editTermin}
          clients={clients}
          prefillMandantId={editTermin ? null : prefillMandantId}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTermin(null) }}
        />
      )}
    </div>
  )
}
