import { useState, useEffect, useRef } from 'react'
import { openAuthPopup, callApi } from '../../utils/onedriveClient.js'

/**
 * OneDriveFolderPickerModal
 *
 * Props:
 *   tokens            – aktuelle OneDrive-Tokens (oder null)
 *   onUpdateTokens    – (newTokens) => void
 *   onSelect          – (path: string) => void  – aufgerufen wenn Ordner bestätigt
 *   onClose           – () => void
 *   initialPath       – optionaler Startpfad (default: Root)
 *   title             – optionaler Modal-Titel
 */
export default function OneDriveFolderPickerModal({
  tokens,
  onUpdateTokens,
  onSelect,
  onClose,
  initialPath = '',
  title = 'OneDrive – Ordner auswählen',
}) {
  const [path,         setPath]         = useState(initialPath)
  const [breadcrumb,   setBreadcrumb]   = useState(() => buildBreadcrumb(initialPath))
  const [items,        setItems]        = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [connecting,   setConnecting]   = useState(false)
  const [localTokens,  setLocalTokens]  = useState(tokens)

  // Neuer Ordner
  const [newFolderName,   setNewFolderName]   = useState('')
  const [creatingFolder,  setCreatingFolder]  = useState(false)
  const [createLoading,   setCreateLoading]   = useState(false)
  const newFolderInputRef = useRef(null)

  // Tokens synchron halten
  useEffect(() => { setLocalTokens(tokens) }, [tokens])

  function buildBreadcrumb(p) {
    if (!p) return [{ path: '', name: '☁️ OneDrive' }]
    const parts = p.split('/').filter(Boolean)
    const bc = [{ path: '', name: '☁️ OneDrive' }]
    let cur = ''
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part
      bc.push({ path: cur, name: part })
    }
    return bc
  }

  function handleRefresh(newTokens) {
    setLocalTokens(newTokens)
    onUpdateTokens?.(newTokens)
  }

  async function ensureConnected() {
    if (localTokens?.accessToken) return localTokens
    setConnecting(true)
    setError('')
    try {
      const newTokens = await openAuthPopup()
      setLocalTokens(newTokens)
      onUpdateTokens?.(newTokens)
      return newTokens
    } catch (err) {
      setError('Anmeldung fehlgeschlagen: ' + err.message)
      return null
    } finally {
      setConnecting(false)
    }
  }

  async function loadFolder(targetPath, tokenOverride) {
    const tok = tokenOverride ?? localTokens
    if (!tok?.accessToken) return
    setLoading(true)
    setError('')
    try {
      const res = await callApi('listFolder', { folderPath: targetPath }, tok, handleRefresh)
      const folders = (res.items ?? [])
        .filter(i => i.folder)
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
      setItems(folders)
    } catch (err) {
      setError('Ordner konnte nicht geladen werden: ' + err.message)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  // Beim Öffnen: falls verbunden, sofort Root laden
  useEffect(() => {
    if (localTokens?.accessToken) {
      loadFolder(initialPath)
    }
    // ESC schließt Modal
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  async function handleConnect() {
    const tok = await ensureConnected()
    if (tok) loadFolder(initialPath, tok)
  }

  async function navigateTo(targetPath, name) {
    const tok = await ensureConnected()
    if (!tok) return
    setPath(targetPath)
    setBreadcrumb(buildBreadcrumb(targetPath))
    setItems(null)
    loadFolder(targetPath, tok)
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim()
    if (!name) return
    const tok = await ensureConnected()
    if (!tok) return
    setCreateLoading(true)
    setError('')
    try {
      await callApi('createFolder', { parentPath: path, folderName: name }, tok, handleRefresh)
      setNewFolderName('')
      setCreatingFolder(false)
      // Ordner neu laden damit der neue Ordner erscheint
      await loadFolder(path, tok)
    } catch (err) {
      setError('Ordner erstellen fehlgeschlagen: ' + err.message)
    } finally {
      setCreateLoading(false)
    }
  }

  function handleSelect() {
    onSelect(path)
    onClose()
  }

  const displayPath = path || '(OneDrive-Root)'
  const isRoot = !path

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 2000, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', zIndex: 2001,
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 'min(600px, 94vw)',
          maxHeight: '80vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
        }}>
          <span style={{ fontSize: '18px' }}>📁</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>{title}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
              Navigiere zu deinem Zielordner und bestätige die Auswahl.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1,
              padding: '2px 6px', borderRadius: '6px', flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Breadcrumb ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap',
          padding: '7px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface2)', fontSize: '11px', flexShrink: 0,
        }}>
          {breadcrumb.map((crumb, i) => (
            <span key={crumb.path} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>›</span>}
              <button
                onClick={() => navigateTo(crumb.path, crumb.name)}
                disabled={i === breadcrumb.length - 1}
                style={{
                  background: 'none', border: 'none', cursor: i < breadcrumb.length - 1 ? 'pointer' : 'default',
                  color: i < breadcrumb.length - 1 ? 'var(--accent)' : 'var(--text)',
                  fontWeight: i === breadcrumb.length - 1 ? 700 : 400,
                  fontSize: '11px', padding: '0 3px',
                  textDecoration: i < breadcrumb.length - 1 ? 'underline' : 'none',
                  opacity: i < breadcrumb.length - 1 ? 0.85 : 1,
                }}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 14px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
        }}>
          {!creatingFolder ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setCreatingFolder(true)
                setTimeout(() => newFolderInputRef.current?.focus(), 50)
              }}
              style={{ fontSize: '11px' }}
            >
              📁+ Neuer Ordner
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
              <span style={{ fontSize: '14px' }}>📁</span>
              <input
                ref={newFolderInputRef}
                className="input"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="Ordnername…"
                style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateFolder()
                  if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName('') }
                }}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || createLoading}
                style={{ fontSize: '11px' }}
              >
                {createLoading ? '⏳' : '✓ Erstellen'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setCreatingFolder(false); setNewFolderName('') }}
                style={{ fontSize: '11px' }}
              >
                ✕
              </button>
            </div>
          )}
          {!creatingFolder && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => loadFolder(path)}
              disabled={loading || !localTokens?.accessToken}
              style={{ fontSize: '11px', marginLeft: 'auto' }}
              title="Aktualisieren"
            >
              {loading ? '⏳' : '🔄'}
            </button>
          )}
        </div>

        {/* ── Inhalt ── */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

          {/* Nicht verbunden */}
          {!localTokens?.accessToken && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>☁️</div>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>
                OneDrive-Verbindung erforderlich
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Melde dich mit deinem Microsoft-Konto an, um Ordner zu durchsuchen.
              </div>
              {error && (
                <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>⚠ {error}</div>
              )}
              <button
                className="btn btn-primary"
                onClick={handleConnect}
                disabled={connecting}
                style={{ fontSize: '13px' }}
              >
                {connecting ? '⏳ Verbinden…' : '🔑 Mit Microsoft anmelden'}
              </button>
            </div>
          )}

          {/* Laden */}
          {localTokens?.accessToken && loading && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              ⏳ Lade Ordner…
            </div>
          )}

          {/* Fehler */}
          {localTokens?.accessToken && error && !loading && (
            <div style={{ padding: '16px', margin: '12px', background: 'rgba(239,68,68,0.06)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)', fontSize: '12px', color: '#ef4444' }}>
              ⚠ {error}
              <button className="btn btn-ghost btn-sm" onClick={() => loadFolder(path)} style={{ fontSize: '11px', marginLeft: '8px' }}>
                Erneut versuchen
              </button>
            </div>
          )}

          {/* Leer */}
          {localTokens?.accessToken && !loading && items?.length === 0 && !error && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>📂</div>
              <div style={{ fontWeight: 600 }}>Keine Unterordner</div>
              <div style={{ marginTop: '4px' }}>
                Mit „📁+ Neuer Ordner" kannst du hier einen Ordner anlegen.
              </div>
            </div>
          )}

          {/* Ordner-Liste */}
          {localTokens?.accessToken && !loading && items && items.length > 0 && (
            <div>
              {/* Eine Ebene zurück */}
              {!isRoot && (
                <div
                  onClick={() => {
                    const parent = breadcrumb[breadcrumb.length - 2]
                    navigateTo(parent.path, parent.name)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 16px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    color: 'var(--text-muted)', fontSize: '12px',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '16px' }}>⬆️</span>
                  <span style={{ fontStyle: 'italic' }}>.. (eine Ebene zurück)</span>
                </div>
              )}

              {items.map(folder => (
                <div
                  key={folder.id}
                  onClick={() => navigateTo(path ? `${path}/${folder.name}` : folder.name, folder.name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 16px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>📁</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {folder.name}
                    </div>
                    {folder.folder?.childCount != null && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {folder.folder.childCount} Element{folder.folder.childCount !== 1 ? 'e' : ''}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)', flexShrink: 0 }}>›</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          borderTop: '1px solid var(--border)', padding: '12px 16px', flexShrink: 0,
          background: 'var(--surface2)',
        }}>
          {/* Gewählter Pfad */}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ flexShrink: 0 }}>Ausgewählt:</span>
            <code style={{
              flex: 1, background: 'var(--bg)', padding: '3px 8px', borderRadius: '5px',
              fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              border: '1px solid var(--border)',
            }}>
              {displayPath}
            </code>
          </div>

          {/* Aktionen */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={handleSelect}
              disabled={!localTokens?.accessToken}
              style={{ flex: 1, fontSize: '13px', fontWeight: 700 }}
            >
              ✓ Diesen Ordner verwenden
            </button>
            <button
              className="btn btn-ghost"
              onClick={onClose}
              style={{ fontSize: '13px' }}
            >
              Abbrechen
            </button>
          </div>
        </div>

      </div>
    </>
  )
}
