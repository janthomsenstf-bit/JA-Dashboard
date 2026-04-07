import { useState, useEffect, useRef, useMemo } from 'react'

export default function CommandPalette({ clients, onClose, onSelectClient, onNewClient }) {
  const [query,       setQuery]       = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)

  // Statische Befehle
  const baseCommands = useMemo(() => [
    { id: '__new__',   icon: '➕', label: 'Neuer Mandant erstellen',   hint: '',          action: onNewClient },
    { id: '__todo__',  icon: '📋', label: 'Aufgaben-Übersicht öffnen', hint: '',          action: () => onSelectClient('__todo__') },
  ], [onNewClient, onSelectClient])

  // Mandanten-Befehle
  const clientCommands = useMemo(() =>
    clients
      .filter(c => !c.archiviert)
      .map(c => ({
        id:     c.id,
        icon:   '👤',
        label:  c.name,
        hint:   c.mandantennummer,
        action: () => onSelectClient(c.id),
      })),
    [clients]
  )

  const allCommands = [...baseCommands, ...clientCommands]

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands
    const q = query.toLowerCase()
    return allCommands.filter(c =>
      c.label.toLowerCase().includes(q) || (c.hint && c.hint.toLowerCase().includes(q))
    )
  }, [query, allCommands])

  // Aktiven Index zurücksetzen wenn gefilterte Liste sich ändert
  useEffect(() => setActiveIndex(0), [filtered.length])

  // Autofokus
  useEffect(() => { inputRef.current?.focus() }, [])

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[activeIndex]) {
        filtered[activeIndex].action()
        onClose()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        zIndex: 400, display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', paddingTop: '18vh',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          width: 'min(540px, 92vw)', overflow: 'hidden',
          maxHeight: '60vh', display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Befehl oder Mandant suchen…"
          style={{
            width: '100%', background: 'transparent', border: 'none',
            borderBottom: '1px solid var(--border)', outline: 'none',
            color: 'var(--text)', padding: '14px 18px', fontSize: '15px',
            boxSizing: 'border-box',
          }}
        />

        {/* Ergebnisliste */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
              Keine Ergebnisse für „{query}"
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <div
                key={cmd.id}
                onClick={() => { cmd.action(); onClose() }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 18px', cursor: 'pointer', fontSize: '13px',
                  background: i === activeIndex ? 'var(--surface2)' : 'transparent',
                  transition: 'background 0.08s',
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span style={{ fontSize: '15px', flexShrink: 0 }}>{cmd.icon}</span>
                <span style={{ flex: 1 }}>{cmd.label}</span>
                {cmd.hint && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                    {cmd.hint}
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '6px 18px', borderTop: '1px solid var(--border)',
          fontSize: '10px', color: 'var(--text-muted)', display: 'flex', gap: '12px',
        }}>
          <span>↑↓ navigieren</span>
          <span>Enter auswählen</span>
          <span>Esc schließen</span>
        </div>
      </div>
    </div>
  )
}
