import { useState, useRef } from 'react'
import { genVorlagenId } from '../utils/vorlagenStorage.js'

const MAX_VORLAGE_BYTES = 5 * 1024 * 1024   // 5 MB

function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function openAnlageDownload(v) {
  const bytes = atob(v.data)
  const arr   = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  const blob = new Blob([arr], { type: v.mimeType })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = v.name
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 100)
}

/**
 * VorlagenPickerModal
 *
 * Props:
 *   vorlagen        – Array aller Vorlagen-Objekte
 *   onSelect        – (vorlage) => void  – wenn null: nur Bibliotheks-Verwaltung
 *   onUpdateVorlagen – (newArray) => void
 *   onClose         – () => void
 *   title           – optionaler Modal-Titel
 */
export default function VorlagenPickerModal({
  vorlagen,
  onSelect,
  onUpdateVorlagen,
  onClose,
  title = '📚 Vorlagen-Bibliothek',
}) {
  const [search, setSearch]       = useState('')
  const [uploading, setUploading] = useState(false)
  const uploadRef                 = useRef(null)

  const filtered = vorlagen.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase())
  )

  // ── Upload ──────────────────────────────────────────────────────────────────
  function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > MAX_VORLAGE_BYTES) {
      window.alert(`Datei zu groß (max. ${fmtSize(MAX_VORLAGE_BYTES)}). Gewählt: ${fmtSize(file.size)}`)
      e.target.value = ''; return
    }
    setUploading(true)
    const reader = new FileReader()
    reader.onload = ev => {
      const newVorlage = {
        id:        genVorlagenId(),
        name:      file.name,
        mimeType:  file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        data:      ev.target.result.split(',')[1],
        size:      file.size,
        createdAt: new Date().toISOString(),
      }
      onUpdateVorlagen([...vorlagen, newVorlage])
      setUploading(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── Upload via Electron-Dialog ──────────────────────────────────────────────
  async function handleElectronUpload() {
    if (!window.electronAPI) { uploadRef.current?.click(); return }
    try {
      const result = await window.electronAPI.openFile({
        filters: [
          { name: 'Excel', extensions: ['xlsx', 'xls'] },
          { name: 'Alle Dateien', extensions: ['*'] },
        ],
      })
      if (!result) return
      const newVorlage = {
        id:        genVorlagenId(),
        name:      result.name,
        mimeType:  result.mimeType,
        data:      result.data,
        size:      result.size,
        createdAt: new Date().toISOString(),
      }
      onUpdateVorlagen([...vorlagen, newVorlage])
    } catch (err) {
      console.error('[Spielbuch] Vorlage hochladen fehlgeschlagen:', err)
    }
  }

  function deleteVorlage(id) {
    if (!window.confirm('Vorlage wirklich aus der Bibliothek löschen?\n(Bestehende Verknüpfungen bleiben erhalten.)')) return
    onUpdateVorlagen(vorlagen.filter(v => v.id !== id))
  }

  function renameVorlage(id, name) {
    onUpdateVorlagen(vorlagen.map(v => v.id === id ? { ...v, name } : v))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box vp-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Toolbar */}
        <div className="vp-toolbar">
          <input
            className="form-input vp-search"
            placeholder="Vorlage suchen …"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={handleElectronUpload}
            disabled={uploading}
          >
            {uploading ? '…' : '📎 Vorlage hochladen'}
          </button>
          {/* Browser-Fallback File-Input (ausgeblendet) */}
          <input
            ref={uploadRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
        </div>

        {/* Liste */}
        <div className="vp-list">
          {vorlagen.length === 0 ? (
            <div className="vp-empty">
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Noch keine Vorlagen</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Laden Sie Excel-Dateien hoch, um sie als Vorlagen für Prüfpunkte zu verwenden.
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="vp-empty">Keine Vorlage gefunden für „{search}"</div>
          ) : (
            filtered.map(v => (
              <VorlagenItem
                key={v.id}
                v={v}
                selectable={!!onSelect}
                onSelect={() => onSelect?.(v)}
                onDelete={() => deleteVorlage(v.id)}
                onRename={name => renameVorlage(v.id, name)}
                onPreview={() => openAnlageDownload(v)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {vorlagen.length} Vorlage{vorlagen.length !== 1 ? 'n' : ''} · max. {fmtSize(MAX_VORLAGE_BYTES)} pro Datei
          </span>
          <button className="btn btn-ghost" onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  )
}

// ── Einzelne Vorlage-Zeile ───────────────────────────────────────────────────
function VorlagenItem({ v, selectable, onSelect, onDelete, onRename, onPreview }) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(v.name)

  function commitRename() {
    const name = editName.trim()
    if (name && name !== v.name) onRename(name)
    setEditing(false)
  }

  return (
    <div className={`vp-item${selectable ? ' vp-item-selectable' : ''}`}>
      <span className="vp-item-icon">📊</span>

      <div className="vp-item-info">
        {editing ? (
          <form onSubmit={e => { e.preventDefault(); commitRename() }}
            style={{ display: 'flex', gap: '4px' }}>
            <input
              className="form-input"
              value={editName}
              autoFocus
              onChange={e => setEditName(e.target.value)}
              onBlur={commitRename}
              style={{ fontSize: '12px', padding: '2px 6px' }}
            />
            <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '2px 6px' }}>✓</button>
          </form>
        ) : (
          <span className="vp-item-name" onDoubleClick={() => { setEditing(true); setEditName(v.name) }}>
            {v.name}
          </span>
        )}
        <span className="vp-item-meta">
          {fmtSize(v.size)}{v.createdAt ? ` · ${fmtDate(v.createdAt)}` : ''}
        </span>
      </div>

      <div className="vp-item-actions">
        <button className="btn btn-ghost btn-sm" onClick={onPreview} title="Öffnen / Herunterladen">📥</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(true); setEditName(v.name) }} title="Umbenennen">✏</button>
        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={onDelete} title="Löschen">🗑</button>
        {selectable && (
          <button className="btn btn-primary btn-sm vp-select-btn" onClick={onSelect}>
            Auswählen
          </button>
        )}
      </div>
    </div>
  )
}
