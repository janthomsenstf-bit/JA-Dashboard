import { useState, useEffect } from 'react'

export default function NotesTab({ client, onSave }) {
  const [text, setText]   = useState(client.notizen || '')
  const [saved, setSaved] = useState(false)

  // Sync textarea when the selected client changes
  useEffect(() => {
    setText(client.notizen || '')
    setSaved(false)
  }, [client.id])

  function handleSave() {
    onSave(text)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="tab-content">
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '16px',
        }}
      >
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Interne Notizen – {client.name}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Nur intern sichtbar. Nicht für Mandantenkommunikation gedacht.
        </div>

        <textarea
          className="notes-textarea"
          value={text}
          onChange={e => { setText(e.target.value); setSaved(false) }}
          placeholder="Notizen, Besonderheiten, interne Hinweise für diesen Mandanten…"
        />

        <div className="notes-actions">
          {saved && <span className="notes-saved">✓ Gespeichert</span>}
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            💾 Speichern
          </button>
        </div>
      </div>
    </div>
  )
}
