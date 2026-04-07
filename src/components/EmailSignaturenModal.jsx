import { useState } from 'react'

function emptySig() {
  return { id: '', name: '', text: '', isDefault: false }
}

export default function EmailSignaturenModal({ signaturen = [], onUpdate, onClose }) {
  const [editId, setEditId] = useState(null)
  const [form,   setForm]   = useState(emptySig())

  function startNew() {
    setForm(emptySig())
    setEditId('new')
  }

  function startEdit(s) {
    setForm({ ...s })
    setEditId(s.id)
  }

  function cancelEdit() {
    setEditId(null)
    setForm(emptySig())
  }

  function saveForm() {
    if (!form.name.trim()) return
    if (editId === 'new') {
      const newS = { ...form, id: 'sig' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4) }
      // Erste Signatur automatisch als Standard
      if (signaturen.length === 0) newS.isDefault = true
      // Wenn als Standard gesetzt: alle anderen auf false
      const updated = newS.isDefault
        ? [...signaturen.map(s => ({ ...s, isDefault: false })), newS]
        : [...signaturen, newS]
      onUpdate(updated)
    } else {
      const updated = form.isDefault
        ? signaturen.map(s => s.id === editId ? { ...s, ...form } : { ...s, isDefault: false })
        : signaturen.map(s => s.id === editId ? { ...s, ...form } : s)
      onUpdate(updated)
    }
    cancelEdit()
  }

  function deleteSig(id) {
    if (!window.confirm('Diese Signatur wirklich löschen?')) return
    const updated = signaturen.filter(s => s.id !== id)
    // Wenn Standard gelöscht: ersten als Standard setzen
    if (updated.length > 0 && !updated.some(s => s.isDefault)) updated[0].isDefault = true
    onUpdate(updated)
  }

  function setDefault(id) {
    onUpdate(signaturen.map(s => ({ ...s, isDefault: s.id === id })))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={editId ? undefined : onClose}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '14px', width: '640px', maxWidth: '96vw',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>✍️ E-Mail-Signaturen</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Die Standard-Signatur wird automatisch in neue E-Mails eingefügt.
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: '16px' }}>✕</button>
        </div>

        {editId ? (
          /* ── Formular ── */
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px' }}>
              {editId === 'new' ? '+ Neue Signatur erstellen' : 'Signatur bearbeiten'}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Name *
              </label>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="z.B. Standard, Deutsch, Englisch, Privat..."
                style={{ width: '100%', fontSize: '13px' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Signatur-Text
              </label>
              <textarea
                className="input"
                value={form.text}
                onChange={e => setForm(p => ({ ...p, text: e.target.value }))}
                rows={10}
                placeholder={'Mit freundlichen Grüßen\n\nMax Mustermann\nMustermann Steuerberatung GmbH\nMusterstraße 1 · 12345 Musterstadt\nTel: 0123 456789 · www.mustermann-stb.de'}
                style={{ width: '100%', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }}
              />
            </div>

            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="sig-default-check"
                checked={!!form.isDefault}
                onChange={e => setForm(p => ({ ...p, isDefault: e.target.checked }))}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="sig-default-check" style={{ fontSize: '12px', cursor: 'pointer', userSelect: 'none' }}>
                Als Standard-Signatur verwenden (wird automatisch eingefügt)
              </label>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-primary btn-sm" onClick={saveForm} disabled={!form.name.trim()}>
                💾 Speichern
              </button>
              <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Abbrechen</button>
            </div>
          </div>
        ) : (
          /* ── Liste ── */
          <>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <button className="btn btn-primary btn-sm" onClick={startNew}>+ Neue Signatur</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {signaturen.length === 0 && (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Noch keine Signaturen erstellt. Klicke auf „+ Neue Signatur" um zu starten.
                </div>
              )}
              {signaturen.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{s.name}</span>
                      {s.isDefault && (
                        <span style={{
                          fontSize: '10px', padding: '1px 7px', borderRadius: '10px',
                          background: 'rgba(37,99,235,0.12)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.25)',
                        }}>Standard</span>
                      )}
                    </div>
                    <pre style={{
                      fontSize: '11px', color: 'var(--text-muted)', margin: 0,
                      fontFamily: 'inherit', whiteSpace: 'pre-wrap', lineHeight: '1.5',
                      maxHeight: '56px', overflow: 'hidden',
                      borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: '10px',
                    }}>
                      {s.text || '(kein Text)'}
                    </pre>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
                    {!s.isDefault && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setDefault(s.id)} style={{ fontSize: '10px' }}>
                        Als Standard
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(s)} style={{ fontSize: '11px' }}>✏️</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => deleteSig(s.id)} style={{ fontSize: '11px', color: 'var(--red)' }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {signaturen.length} Signatur{signaturen.length !== 1 ? 'en' : ''} gespeichert
              </span>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Schließen</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
