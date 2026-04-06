import { useState } from 'react'

function fmtDatum(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

function EntryCard({ entry, onDelete }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      background: 'var(--surface2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', marginBottom: '8px', overflow: 'hidden',
    }}>
      <div
        style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '13px' }}>{entry.titel}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{fmtDatum(entry.datum)}</div>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: '14px', padding: '0 2px' }}
            onClick={e => { e.stopPropagation(); onDelete(entry.id) }}
            title="Löschen"
          >🗑</button>
        </div>
      </div>
      {open && (
        <div style={{ padding: '10px 14px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
            {entry.inhalt}
          </div>
          {entry.original && (
            <div style={{ marginTop: '10px', padding: '8px 10px', background: 'var(--surface)', borderRadius: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <strong>Originaltext:</strong> {entry.original}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export { EntryCard }

export default function StandListTab({ client, onUpdate, listKey, emptyMsg }) {
  const stand = client.standDerArbeit ?? {}
  const items = stand[listKey] ?? []

  function handleDelete(id) {
    onUpdate({ standDerArbeit: { ...stand, [listKey]: items.filter(e => e.id !== id) } })
  }

  return (
    <div className="tab-content">
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-muted)', fontSize: '13px' }}>
          {emptyMsg}
        </div>
      ) : (
        <div style={{ maxWidth: '860px' }}>
          {items.map(e => (
            <EntryCard key={e.id} entry={e} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
