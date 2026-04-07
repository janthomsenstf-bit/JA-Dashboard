import { useState, useEffect, useRef } from 'react'
import SearchResultCard from './SearchResultCard.jsx'
import { searchClients } from '../../utils/search.js'

export default function GlobalSearch({ clients, onSelect, onEmailQuickAction }) {
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState([])
  const [open,        setOpen]        = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef    = useRef(null)
  const containerRef = useRef(null)

  // Suche mit 150ms Debounce
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    const timer = setTimeout(() => {
      const found = searchClients(clients, query)
      setResults(found)
      setOpen(found.length > 0)
      setActiveIndex(-1)
    }, 150)
    return () => clearTimeout(timer)
  }, [query, clients])

  // Click-outside schließt Dropdown
  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  // STRG+F fokussiert die Suche
  useEffect(() => {
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        // Nur übernehmen wenn kein anderes Input fokussiert ist
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
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = activeIndex >= 0 ? activeIndex : 0
      if (results[idx]) handleSelect(results[idx].client.id)
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      inputRef.current?.blur()
    }
  }

  function handleSelect(clientId) {
    onSelect(clientId)
    setOpen(false)
    setQuery('')
  }

  function handleEmailAction(clientId) {
    onEmailQuickAction(clientId)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: '1 1 auto', maxWidth: '480px' }}>
      {/* Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        background: 'var(--surface2)', border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)', padding: '0 12px',
        transition: 'border-color 0.15s',
      }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Mandant, E-Mail, Rückfrage suchen…"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', padding: '8px 0', fontSize: '13px',
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false); inputRef.current?.focus() }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: '14px', padding: '0', lineHeight: 1, flexShrink: 0,
            }}
          >
            ✕
          </button>
        )}
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.5, flexShrink: 0, whiteSpace: 'nowrap' }}>
          Strg+F
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          maxHeight: '480px', overflowY: 'auto',
        }}>
          {results.map((result, i) => (
            <SearchResultCard
              key={result.client.id}
              result={result}
              isActive={i === activeIndex}
              onSelect={() => handleSelect(result.client.id)}
              onEmailAction={() => handleEmailAction(result.client.id)}
            />
          ))}
          <div style={{
            padding: '6px 14px', fontSize: '10px', color: 'var(--text-muted)',
            borderTop: '1px solid var(--border)', textAlign: 'right',
          }}>
            {results.length} Ergebnis{results.length !== 1 ? 'se' : ''} · ↑↓ navigieren · Enter öffnen
          </div>
        </div>
      )}
    </div>
  )
}
