import { useState } from 'react'

const KATEGORIEN = ['Allgemein', 'USt', 'Lohn', 'Jahresabschluss', 'Rückfragen', 'Erinnerung', 'Sonstiges']

const PLATZHALTER = [
  { key: '{{name}}',  label: 'Mandantenname' },
  { key: '{{vj}}',    label: 'Veranlagungsjahr' },
  { key: '{{monat}}', label: 'Aktueller Monat' },
]

function emptyVorlage() {
  return { id: '', name: '', kategorie: 'Allgemein', betreff: '', text: '', cc: '' }
}

export default function EmailVorlagenModal({ vorlagen = [], onUpdate, onClose }) {
  const [editId,   setEditId]   = useState(null)   // null = Liste, 'new' = neu, id = bearbeiten
  const [form,     setForm]     = useState(emptyVorlage())
  const [search,   setSearch]   = useState('')
  const [katFilter, setKatFilter] = useState('Alle')

  const filtered = vorlagen.filter(v => {
    const matchKat = katFilter === 'Alle' || v.kategorie === katFilter
    const matchSearch = !search.trim() || v.name.toLowerCase().includes(search.toLowerCase()) || v.betreff.toLowerCase().includes(search.toLowerCase())
    return matchKat && matchSearch
  })

  function startNew() {
    setForm(emptyVorlage())
    setEditId('new')
  }

  function startEdit(v) {
    setForm({ ...v })
    setEditId(v.id)
  }

  function cancelEdit() {
    setEditId(null)
    setForm(emptyVorlage())
  }

  function saveForm() {
    if (!form.name.trim() || !form.betreff.trim()) return
    if (editId === 'new') {
      const newV = { ...form, id: 'ev' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4) }
      onUpdate([...vorlagen, newV])
    } else {
      onUpdate(vorlagen.map(v => v.id === editId ? { ...v, ...form } : v))
    }
    cancelEdit()
  }

  function deleteVorlage(id) {
    if (!window.confirm('Diese Vorlage wirklich löschen?')) return
    onUpdate(vorlagen.filter(v => v.id !== id))
  }

  function insertPlatzhalter(key, field) {
    setForm(prev => ({ ...prev, [field]: (prev[field] ?? '') + key }))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={editId ? undefined : onClose}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '14px', width: '760px', maxWidth: '96vw',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>📝 E-Mail-Vorlagen</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Platzhalter: {PLATZHALTER.map(p => <code key={p.key} style={{ background: 'rgba(255,255,255,0.06)', padding: '0 4px', borderRadius: '3px', fontSize: '10px', marginRight: '4px' }}>{p.key}</code>)}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: '16px' }}>✕</button>
        </div>

        {editId ? (
          /* ── Formular (Neu / Bearbeiten) ── */
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px' }}>
              {editId === 'new' ? '+ Neue Vorlage erstellen' : 'Vorlage bearbeiten'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Vorlagenname *</label>
                <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="z.B. USt-Voranmeldung Oktober" style={{ width: '100%', fontSize: '13px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Kategorie</label>
                <select className="input" value={form.kategorie} onChange={e => setForm(p => ({ ...p, kategorie: e.target.value }))}
                  style={{ width: '100%', fontSize: '13px' }}>
                  {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Betreff *</label>
              <input className="input" value={form.betreff} onChange={e => setForm(p => ({ ...p, betreff: e.target.value }))}
                placeholder="z.B. Umsatzsteuervoranmeldung {{monat}} {{vj}}" style={{ width: '100%', fontSize: '13px' }} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>E-Mail-Text</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {PLATZHALTER.map(p => (
                    <button key={p.key} className="btn btn-ghost btn-sm" style={{ fontSize: '10px' }}
                      onClick={() => insertPlatzhalter(p.key, 'text')} title={`${p.key} einfügen`}>
                      + {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea className="input" value={form.text} onChange={e => setForm(p => ({ ...p, text: e.target.value }))}
                rows={10} placeholder="Text der Vorlage..." style={{ width: '100%', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Standard-CC (optional)</label>
              <input className="input" value={form.cc} onChange={e => setForm(p => ({ ...p, cc: e.target.value }))}
                placeholder="cc@kanzlei.de" style={{ width: '100%', fontSize: '13px' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-primary btn-sm" onClick={saveForm}
                disabled={!form.name.trim() || !form.betreff.trim()}>
                💾 Speichern
              </button>
              <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Abbrechen</button>
            </div>
          </div>
        ) : (
          /* ── Vorlagenliste ── */
          <>
            {/* Toolbar */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
              <input className="input" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="🔍 Vorlage suchen..."
                style={{ flex: '1 1 200px', fontSize: '12px', padding: '6px 10px' }} />
              <select className="input" value={katFilter} onChange={e => setKatFilter(e.target.value)}
                style={{ fontSize: '12px', padding: '6px 10px' }}>
                <option value="Alle">Alle Kategorien</option>
                {KATEGORIEN.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={startNew}>+ Neue Vorlage</button>
            </div>

            {/* Liste */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {filtered.length === 0 && (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {vorlagen.length === 0
                    ? 'Noch keine Vorlagen erstellt. Klicke auf „+ Neue Vorlage" um zu starten.'
                    : 'Keine Vorlagen für diese Suche.'}
                </div>
              )}
              {filtered.map(v => (
                <div key={v.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '12px',
                  padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{v.name}</span>
                      <span style={{
                        fontSize: '10px', padding: '1px 7px', borderRadius: '10px',
                        background: 'rgba(37,99,235,0.12)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.25)',
                      }}>{v.kategorie}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{v.betreff}</div>
                    {v.cc && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>CC: {v.cc}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(v)} style={{ fontSize: '11px' }}>✏️</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => deleteVorlage(v.id)} style={{ fontSize: '11px', color: 'var(--red)' }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{vorlagen.length} Vorlage{vorlagen.length !== 1 ? 'n' : ''} gespeichert</span>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Schließen</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
