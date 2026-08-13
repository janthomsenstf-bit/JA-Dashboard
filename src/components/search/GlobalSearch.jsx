import { useState, useEffect, useRef, useMemo } from 'react'
import { searchAll, filterByCategory, SEARCH_CATEGORIES, fmtDate } from '../../utils/search.js'
import { callApi, fmtFileSize } from '../../utils/onedriveClient.js'

function truncate(str, max) {
  const s = String(str ?? '')
  return s.length > max ? s.slice(0, max) + '…' : s
}

// ── Einzel-Ergebnis ───────────────────────────────────────────────────────────
function ResultRow({ result, isActive, onAction }) {
  const cat = SEARCH_CATEGORIES[result.category] ?? SEARCH_CATEGORIES.notizen
  const { client } = result

  // Hauptinhalt je nach Kategorie
  let title = ''
  let subtitle = ''
  let meta = ''
  let actionLabel = '→ Öffnen'

  if (result.category === 'onedrive') {
    const d = result.datei
    title    = d.name
    subtitle = d.pfad ? `☁️ ${d.pfad}` : '☁️ OneDrive'
    meta     = [d.size ? fmtFileSize(d.size) : '', d.geaendert ? fmtDate(d.geaendert) : ''].filter(Boolean).join(' · ')
    actionLabel = '→ Datei öffnen'
  } else if (result.category === 'personen') {
    title    = result.person?.name ?? ''
    subtitle = result.person?.rolle ? `${result.person.rolle} bei ${client.name}` : `Kontakt bei ${client.name}`
    meta     = [result.person?.email, result.person?.telefon].filter(Boolean).join(' · ')
    actionLabel = '→ Mandant öffnen'
  } else if (result.category === 'mandanten') {
    title    = client.name
    subtitle = [client.mandantennummer, client.rechtsform].filter(Boolean).join(' · ')
    meta     = result.matches.filter(m => m.field !== 'name').map(m => `${m.label}: ${m.value}`).join(' · ')
    actionLabel = '→ Öffnen'
  } else if (result.category === 'nachrichten') {
    const em = result.email
    title    = truncate(em?.betreff ?? '(kein Betreff)', 55)
    subtitle = `${em?.typ === 'eingehend' ? '📨' : '📤'} ${em?.absender ?? ''} – ${client.name}`
    meta     = em?.datum ? fmtDate(em.datum) : ''
    actionLabel = '→ E-Mail öffnen'
  } else if (result.category === 'dokumente') {
    const dok = result.dokument
    title    = dok?.name ?? ''
    subtitle = `${dok?.quelle ?? 'Anhang'} · ${client.name}`
    meta     = dok?.datum ? fmtDate(dok.datum) : ''
    actionLabel = '→ E-Mail öffnen'
  } else if (result.category === 'auftraege') {
    const au = result.auftrag
    title    = au?.bezeichnung || `${au?.typ} ${au?.jahr ?? ''}`
    subtitle = `Auftrag · ${client.name}`
    meta     = au?.status ? { offen: 'Offen', in_bearbeitung: 'In Bearbeitung', erledigt: 'Erledigt' }[au.status] ?? au.status : ''
    actionLabel = '→ Auftrag öffnen'
  } else if (result.category === 'aufgaben') {
    const a = result.aufgabe
    title    = a?.titel ?? ''
    subtitle = `Aufgabe · ${client.name}`
    meta     = a?.faelligAm ? `Fällig: ${fmtDate(a.faelligAm)}` : ''
    actionLabel = '→ Mandant öffnen'
  } else if (result.category === 'notizen') {
    title    = result.matches[0]?.value ?? ''
    subtitle = `${result.matches[0]?.label ?? 'Notiz'} · ${client.name}`
    meta     = ''
    actionLabel = '→ Öffnen'
  }

  return (
    <div
      onClick={onAction}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 14px', cursor: 'pointer',
        background: isActive ? 'var(--surface2)' : 'transparent',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface2)' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Kategorie-Icon */}
      <div style={{
        width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: cat.bg, fontSize: '13px',
      }}>
        {cat.icon}
      </div>

      {/* Hauptinhalt */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>
          {client?.archiviert && (
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', flexShrink: 0 }}>archiviert</span>
          )}
        </div>
        {subtitle && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {subtitle}
          </div>
        )}
        {meta && (
          <div style={{ fontSize: '10px', color: cat.color, marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {meta}
          </div>
        )}
      </div>

      {/* Aktion */}
      <div style={{
        fontSize: '10px', fontWeight: 600, color: cat.color, flexShrink: 0,
        padding: '3px 8px', borderRadius: '6px', border: `1px solid ${cat.bg}`,
        background: cat.bg, whiteSpace: 'nowrap',
      }}>
        {actionLabel}
      </div>
    </div>
  )
}

// ── Kategorie-Tab ─────────────────────────────────────────────────────────────
function CatTab({ cat, label, icon, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '4px 10px', borderRadius: '20px', border: 'none',
        background: active ? SEARCH_CATEGORIES[cat]?.bg ?? 'var(--surface2)' : 'transparent',
        color: active ? SEARCH_CATEGORIES[cat]?.color ?? 'var(--text)' : 'var(--text-muted)',
        fontWeight: active ? 700 : 400, fontSize: '11px', cursor: 'pointer',
        transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {icon} {label}
      {count > 0 && (
        <span style={{
          minWidth: '16px', height: '16px', borderRadius: '8px', fontSize: '10px',
          background: active ? SEARCH_CATEGORIES[cat]?.color ?? 'var(--accent)' : 'var(--border)',
          color: active ? '#fff' : 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          fontWeight: 700,
        }}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function GlobalSearch({ clients, onSelect, onSelectWithTab, onOpenEmail, onedriveTokens, onUpdateOnedriveTokens }) {
  const [query,       setQuery]       = useState('')
  const [open,        setOpen]        = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [activeCat,   setActiveCat]   = useState('alle')
  const inputRef     = useRef(null)
  const containerRef = useRef(null)

  // Suche mit 120ms Debounce
  const [debouncedQ, setDebouncedQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 120)
    return () => clearTimeout(t)
  }, [query])

  const lokal = useMemo(() => {
    if (debouncedQ.trim().length < 2) return { results: [], categories: {}, total: 0 }
    return searchAll(clients, debouncedQ)
  }, [debouncedQ, clients])

  // ── OneDrive-Suche (serverseitig über Microsoft: Dateinamen UND Inhalte) ──
  // Läuft parallel zur lokalen Suche; Ergebnisse werden anschließend gemischt.
  const [driveTreffer, setDriveTreffer] = useState([])
  const [driveLaedt,   setDriveLaedt]   = useState(false)
  const [driveFehler,  setDriveFehler]  = useState('')

  useEffect(() => {
    const q = debouncedQ.trim()
    if (q.length < 2 || !onedriveTokens?.accessToken) {
      setDriveTreffer([]); setDriveFehler(''); setDriveLaedt(false)
      return
    }
    let abgebrochen = false
    setDriveLaedt(true); setDriveFehler('')
    callApi('searchDrive', { q }, onedriveTokens, onUpdateOnedriveTokens)
      .then(res => {
        if (abgebrochen) return
        setDriveTreffer((res.items ?? []).filter(i => !i.istOrdner))
      })
      .catch(err => { if (!abgebrochen) { setDriveTreffer([]); setDriveFehler(err.message || 'OneDrive-Suche fehlgeschlagen') } })
      .finally(() => { if (!abgebrochen) setDriveLaedt(false) })
    return () => { abgebrochen = true }
  }, [debouncedQ, onedriveTokens, onUpdateOnedriveTokens])

  // Lokale und OneDrive-Ergebnisse zu EINER Trefferliste zusammenführen
  const searchResult = useMemo(() => {
    const driveResults = driveTreffer.map(d => ({
      category: 'onedrive',
      client: null,
      datei: d,
      matches: [{ field: 'dateiname', label: 'Datei', value: d.name, weight: 90 }],
      weight: 90,
      action: { type: 'openFile', webUrl: d.webUrl },
    }))
    const results = [...lokal.results, ...driveResults].sort((a, b) => b.weight - a.weight)
    const categories = { ...lokal.categories }
    if (driveResults.length) categories.onedrive = driveResults.length
    return {
      results, categories,
      total: (lokal.total ?? lokal.results.length) + driveResults.length,
    }
  }, [lokal, driveTreffer])

  const filteredResults = useMemo(() =>
    filterByCategory(searchResult.results, activeCat),
    [searchResult.results, activeCat]
  )

  useEffect(() => {
    const hasResults = filteredResults.length > 0
    setOpen(hasResults && debouncedQ.trim().length >= 2)
    setActiveIndex(-1)
  }, [filteredResults, debouncedQ])

  // Kategorie zurücksetzen wenn Suche leer
  useEffect(() => {
    if (!query) { setActiveCat('alle'); setOpen(false) }
  }, [query])

  // Click-outside
  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  // Strg+F
  useEffect(() => {
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const tag = document.activeElement?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  function handleKeyDown(e) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, filteredResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = activeIndex >= 0 ? activeIndex : 0
      if (filteredResults[idx]) execAction(filteredResults[idx])
    } else if (e.key === 'Escape') {
      setOpen(false); setQuery(''); inputRef.current?.blur()
    }
  }

  function execAction(result) {
    const { action } = result
    if (action.type === 'openFile') {
      // Direkt die Datei in OneDrive öffnen
      if (action.webUrl) window.open(action.webUrl, '_blank', 'noopener')
      setOpen(false); setQuery('')
      return
    }
    if (action.type === 'openEmail') {
      if (onOpenEmail) onOpenEmail(action.clientId, action.emailId)
      else if (onSelectWithTab) onSelectWithTab(action.clientId, 6)
      else onSelect?.(action.clientId)
    } else {
      if (action.tab != null && onSelectWithTab) onSelectWithTab(action.clientId, action.tab)
      else onSelect?.(action.clientId)
    }
    setOpen(false); setQuery('')
  }

  // Kategorie-Tabs
  const catOrder = ['onedrive', 'personen', 'mandanten', 'nachrichten', 'dokumente', 'auftraege', 'aufgaben', 'notizen']
  const activeCats = catOrder.filter(c => (searchResult.categories[c] ?? 0) > 0)

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: '1 1 auto', maxWidth: '520px' }}>
      {/* ── Input ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'var(--surface2)', border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: open ? '10px 10px 0 0' : 'var(--radius)', padding: '0 12px',
        transition: 'border-color 0.15s, border-radius 0.1s',
      }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => filteredResults.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Namen, Nummer, E-Mail, Dokument, Auftrag…"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', padding: '8px 0', fontSize: '13px',
          }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', padding: 0, lineHeight: 1, flexShrink: 0 }}>
            ✕
          </button>
        )}
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0, whiteSpace: 'nowrap' }}>
          Strg+F
        </span>
      </div>

      {/* ── Dropdown ── */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--accent)',
          borderTop: 'none', borderRadius: '0 0 12px 12px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
          maxHeight: '520px', display: 'flex', flexDirection: 'column',
        }}>

          {/* ── Kategorie-Tabs ── */}
          {activeCats.length > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 10px',
              borderBottom: '1px solid var(--border)', overflowX: 'auto', flexShrink: 0,
              scrollbarWidth: 'none',
            }}>
              <CatTab
                cat="alle" label="Alle" icon="🔎"
                count={searchResult.total > 30 ? 30 : searchResult.results.length}
                active={activeCat === 'alle'}
                onClick={() => setActiveCat('alle')}
              />
              {activeCats.map(cat => (
                <CatTab
                  key={cat}
                  cat={cat}
                  label={SEARCH_CATEGORIES[cat].label}
                  icon={SEARCH_CATEGORIES[cat].icon}
                  count={searchResult.categories[cat] ?? 0}
                  active={activeCat === cat}
                  onClick={() => setActiveCat(cat)}
                />
              ))}
            </div>
          )}

          {/* ── Ergebnisse ── */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredResults.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Keine Treffer in dieser Kategorie
              </div>
            ) : (
              filteredResults.map((result, i) => (
                <ResultRow
                  key={`${result.category}-${result.client?.id ?? result.datei?.id ?? 'x'}-${i}`}
                  result={result}
                  isActive={i === activeIndex}
                  onAction={() => execAction(result)}
                />
              ))
            )}

            {/* OneDrive-Suche läuft / meldet einen Fehler */}
            {driveLaedt && (
              <div style={{
                padding: '8px 14px', fontSize: '11px', color: 'var(--text-muted)',
                borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span>☁️</span> OneDrive wird durchsucht …
              </div>
            )}
            {!driveLaedt && driveFehler && (
              <div style={{
                padding: '8px 14px', fontSize: '11px', color: '#dc2626',
                borderTop: '1px solid var(--border)',
              }}>
                ☁️ OneDrive-Suche nicht möglich: {driveFehler}
              </div>
            )}
          </div>

          {/* ── Fußzeile ── */}
          <div style={{
            padding: '5px 14px', fontSize: '10px', color: 'var(--text-muted)',
            borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexShrink: 0,
          }}>
            <span>
              {searchResult.total > 30
                ? `${filteredResults.length} von ${searchResult.total} Treffern (top 30 angezeigt)`
                : `${filteredResults.length} Treffer`}
            </span>
            <span style={{ opacity: 0.7 }}>↑↓ navigieren · Enter öffnen · Esc schließen</span>
          </div>
        </div>
      )}
    </div>
  )
}
