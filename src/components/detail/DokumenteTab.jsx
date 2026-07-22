import { useState, useMemo, useEffect, useCallback } from 'react'
import { openAuthPopup, callApi, getMandantPath, fmtFileSize } from '../../utils/onedriveClient.js'
import OneDriveFolderPickerModal from '../shared/OneDriveFolderPickerModal.jsx'

function fmtDatum(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
}

function fileIcon(name, mimeType) {
  const ext = (name ?? '').split('.').pop()?.toLowerCase() ?? ''
  const mime = (mimeType ?? '').toLowerCase()
  if (mime.includes('pdf')   || ext === 'pdf')                      return '📄'
  if (mime.startsWith('image/') || ['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return '🖼'
  if (mime.includes('word')  || mime.includes('document') || ['doc','docx'].includes(ext))  return '📝'
  if (mime.includes('sheet') || mime.includes('excel')   || ['xls','xlsx'].includes(ext))   return '📊'
  if (mime.includes('powerpoint') || mime.includes('presentation') || ['ppt','pptx'].includes(ext)) return '📑'
  if (mime.includes('zip')   || mime.includes('compressed') || ['zip','rar','7z'].includes(ext))    return '🗜'
  if (mime.includes('text/') || ext === 'txt')                      return '📃'
  return '📎'
}

function fileTypeLabel(name, mimeType) {
  const ext = (name ?? '').split('.').pop()?.toLowerCase() ?? ''
  if (ext) return ext.toUpperCase()
  const mime = (mimeType ?? '').toLowerCase()
  if (mime.includes('pdf'))    return 'PDF'
  if (mime.startsWith('image/')) return mime.split('/')[1]?.toUpperCase() ?? 'Bild'
  if (mime.includes('word') || mime.includes('document')) return 'WORD'
  if (mime.includes('sheet') || mime.includes('excel'))   return 'EXCEL'
  if (mime.includes('zip'))    return 'ZIP'
  return 'Datei'
}

// ── E-Mail-Anhänge Section ────────────────────────────────────────────────────
function EmailAnhaeange({ client, onNavigateToKomm }) {
  const [filter, setFilter] = useState('alle')
  const [search, setSearch] = useState('')

  const events = client.kommunikation?.events ?? []

  const allDocs = useMemo(() => {
    const docs = []
    events.forEach(ev => {
      ;(ev.anlagen ?? []).forEach((a, i) => {
        docs.push({
          key:         `${ev.id}:${i}`,
          name:        a.name,
          size:        a.size ?? 0,
          contentType: a.contentType ?? '',
          tooLarge:    a.tooLarge ?? false,
          datum:       ev.erstelltAm ?? ev.gesendetAm,
          source:      ev.typ === 'eingehend' ? 'empfangen' : 'gesendet',
          absender:    ev.absender ?? '',
          betreff:     ev.betreff  ?? '',
          eventId:     ev.id,
        })
      })
    })
    docs.sort((a, b) => new Date(b.datum) - new Date(a.datum))
    return docs
  }, [events])

  const filtered = useMemo(() => {
    let d = allDocs
    if (filter !== 'alle') d = d.filter(doc => doc.source === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      d = d.filter(doc =>
        doc.name.toLowerCase().includes(q) ||
        doc.betreff.toLowerCase().includes(q) ||
        doc.absender.toLowerCase().includes(q)
      )
    }
    return d
  }, [allDocs, filter, search])

  const totalSize = filtered.reduce((s, d) => s + (d.size ?? 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: '13px' }}>📧 E-Mail-Anhänge</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
            {allDocs.length} Anhang{allDocs.length !== 1 ? 'änge' : ''} · {fmtFileSize(allDocs.reduce((s, d) => s + d.size, 0))} gesamt
          </span>
        </div>
        {onNavigateToKomm && (
          <button className="btn btn-ghost btn-sm" onClick={onNavigateToKomm} style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            ✉️ Zur Kommunikation
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input"
          placeholder="🔍 Dateiname, Betreff, Absender…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 180px', fontSize: '12px', padding: '5px 9px', maxWidth: '280px' }}
        />
        {['alle', 'empfangen', 'gesendet'].map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f)}
            style={{ fontSize: '11px' }}
          >
            {f === 'alle' ? 'Alle' : f === 'empfangen' ? '📥 Empfangen' : '📤 Gesendet'}
          </button>
        ))}
      </div>

      {allDocs.length === 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          <div style={{ fontSize: '28px', marginBottom: '6px' }}>📭</div>
          Noch keine E-Mail-Anhänge vorhanden.
          {onNavigateToKomm && (
            <div><button className="btn btn-ghost btn-sm" onClick={onNavigateToKomm} style={{ marginTop: '8px', fontSize: '11px' }}>Zur Kommunikation →</button></div>
          )}
        </div>
      )}

      {allDocs.length > 0 && filtered.length === 0 && (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          Keine Treffer für diese Suche.
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '28px 1fr 60px 90px 1fr 70px',
            gap: '8px', padding: '4px 10px',
            fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span/>
            <span>Datei</span>
            <span>Typ</span>
            <span>Datum</span>
            <span>Quelle</span>
            <span style={{ textAlign: 'right' }}>Größe</span>
          </div>

          {filtered.map(doc => (
            <div
              key={doc.key}
              style={{
                display: 'grid', gridTemplateColumns: '28px 1fr 60px 90px 1fr 70px',
                gap: '8px', padding: '7px 10px', alignItems: 'center',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '5px', fontSize: '12px',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <span style={{ fontSize: '16px', textAlign: 'center' }}>{fileIcon(doc.name, doc.contentType)}</span>
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '8px', background: 'rgba(100,116,139,0.1)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {fileTypeLabel(doc.name, doc.contentType)}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{fmtDatum(doc.datum)}</span>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {doc.source === 'empfangen' ? `📥 ${doc.absender}` : '📤 Gesendet'}
                </div>
                {doc.betreff && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {doc.betreff}
                  </div>
                )}
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'right' }}>
                {doc.tooLarge
                  ? <span style={{ color: '#f97316', fontSize: '10px' }}>zu groß</span>
                  : fmtFileSize(doc.size)
                }
              </span>
            </div>
          ))}

          {filtered.length > 1 && (
            <div style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
              {filtered.length} Dateien · {fmtFileSize(totalSize)} gesamt
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Vorschau-Modal ────────────────────────────────────────────────────────────
function PreviewModal({ item, previewUrl, downloadUrl, webUrl, loading, error, onClose }) {
  const isImage = item?.file?.mimeType?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(item?.name ?? '')
  const isPdf   = item?.file?.mimeType === 'application/pdf' || /\.pdf$/i.test(item?.name ?? '')

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', width: '90vw', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <span style={{ fontSize: '18px' }}>{fileIcon(item?.name, item?.file?.mimeType)}</span>
            <span style={{ fontWeight: 700, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item?.name}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtFileSize(item?.size)}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {webUrl && (
              <a href={webUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>
                ☁️ In OneDrive öffnen
              </a>
            )}
            {downloadUrl && (
              <a href={downloadUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>
                ⬇️ Herunterladen
              </a>
            )}
            <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: '11px' }}>✕ Schließen</button>
          </div>
        </div>

        {/* Inhalt */}
        <div style={{ flex: 1, overflow: 'auto', padding: loading ? '40px' : '0', textAlign: loading ? 'center' : undefined, minHeight: '200px' }}>
          {loading && <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>⏳ Lade Vorschau…</div>}
          {error  && <div style={{ color: '#ef4444', fontSize: '13px', padding: '20px' }}>⚠️ {error}</div>}
          {!loading && !error && isImage && previewUrl && (
            <img src={previewUrl} alt={item?.name} style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
          )}
          {!loading && !error && isPdf && previewUrl && (
            <iframe src={previewUrl} title={item?.name} style={{ width: '100%', height: '75vh', border: 'none', display: 'block' }} />
          )}
          {!loading && !error && !isImage && !isPdf && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>{fileIcon(item?.name, item?.file?.mimeType)}</div>
              <div style={{ marginBottom: '12px' }}>Vorschau für diesen Dateityp nicht verfügbar.</div>
              {webUrl && <a href={webUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm" style={{ marginRight: '8px' }}>☁️ In OneDrive öffnen</a>}
              {downloadUrl && <a href={downloadUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">⬇️ Datei herunterladen</a>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── OneDrive Section ──────────────────────────────────────────────────────────
function OneDriveSection({ client, tokens, onUpdateTokens, onSendAsAttachment, onUpdate }) {
  const [connecting, setConnecting]         = useState(false)
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState('')
  const [items, setItems]                   = useState(null)      // null = noch nicht geladen
  const [user, setUser]                     = useState(null)
  const [uploadingFile, setUploadingFile]   = useState(null)
  const [deleteConfirm, setDeleteConfirm]   = useState(null)
  const [successMsg, setSuccessMsg]         = useState('')
  // Umbenennen (Dateien und Ordner) – Inline-Bearbeitung in der Namensspalte
  const [renamingId, setRenamingId]         = useState(null)
  const [renameValue, setRenameValue]       = useState('')
  const [renameLoading, setRenameLoading]   = useState(false)

  // Pfad-Einstellungen
  const [showPathSettings, setShowPathSettings]   = useState(false)
  const [editPath, setEditPath]                   = useState('')
  const [showFolderPicker, setShowFolderPicker]   = useState(false)

  // Ordner-Navigation
  const { pathParts, folderPath, folderName, isCustom } = getMandantPath(client)
  const [currentPath, setCurrentPath]       = useState(folderPath)
  const [breadcrumb, setBreadcrumb]         = useState([{ path: folderPath, name: folderName }])

  // Wenn sich der Mandanten-Pfad ändert (z.B. durch Stammdaten-Änderung) → Navigation zurücksetzen
  const prevFolderRef = useState({ path: folderPath })[0]
  useEffect(() => {
    if (prevFolderRef.path !== folderPath) {
      prevFolderRef.path = folderPath
      setCurrentPath(folderPath)
      setBreadcrumb([{ path: folderPath, name: folderName }])
      setItems(null)
    }
  }, [folderPath, folderName])

  // Neuer Ordner
  const [creatingFolder, setCreatingFolder]           = useState(false)
  const [newFolderName, setNewFolderName]             = useState('')
  const [creatingFolderLoading, setCreatingFolderLoading] = useState(false)

  // Auswahl (Checkboxen)
  const [selectedIds, setSelectedIds]       = useState(new Set())
  const [sendingAsAttachment, setSendingAsAttachment] = useState(false)

  // Vorschau
  const [previewItem, setPreviewItem]       = useState(null)
  const [previewUrl, setPreviewUrl]         = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError]     = useState('')
  const [previewDownloadUrl, setPreviewDownloadUrl] = useState(null)
  const [previewWebUrl, setPreviewWebUrl]   = useState(null)

  // Callback wenn Tokens server-seitig refreshed wurden
  const handleTokenRefresh = useCallback((newTokens) => {
    onUpdateTokens?.(newTokens)
  }, [onUpdateTokens])

  async function apiCall(action, params = {}) {
    return callApi(action, params, tokens, handleTokenRefresh)
  }

  // Dateien/Ordner laden wenn bereits verbunden
  useEffect(() => {
    if (tokens?.accessToken && items === null) {
      loadItems()
    }
  }, [tokens?.accessToken])

  async function loadItems(path) {
    const targetPath = path ?? currentPath
    setLoading(true)
    setError('')
    try {
      if (!user) {
        try {
          const ud = await apiCall('getUser')
          setUser(ud.user)
        } catch {}
      }
      const res = await apiCall('listFolder', { folderPath: targetPath })
      // Ordner zuerst, dann Dateien; jeweils alphabetisch
      const sorted = (res.items ?? []).sort((a, b) => {
        const af = !!a.folder, bf = !!b.folder
        if (af !== bf) return af ? -1 : 1
        return (a.name ?? '').localeCompare(b.name ?? '', 'de')
      })
      setItems(sorted)
      setSelectedIds(new Set())
    } catch (err) {
      if (err.needsReauth) {
        onUpdateTokens?.(null)
        setError('Sitzung abgelaufen – bitte erneut verbinden.')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  function navigateTo(path, name) {
    setCurrentPath(path)
    setBreadcrumb(prev => {
      // Prüfen ob Pfad bereits in Breadcrumb ist (Rücknavigation)
      const existingIdx = prev.findIndex(b => b.path === path)
      if (existingIdx >= 0) return prev.slice(0, existingIdx + 1)
      return [...prev, { path, name }]
    })
    setItems(null)
    loadItems(path)
  }

  function navigateBack() {
    if (breadcrumb.length <= 1) return
    const prev = breadcrumb[breadcrumb.length - 2]
    setCurrentPath(prev.path)
    setBreadcrumb(b => b.slice(0, -1))
    setItems(null)
    loadItems(prev.path)
  }

  async function handleConnect() {
    setConnecting(true)
    setError('')
    try {
      const newTokens = await openAuthPopup()
      onUpdateTokens?.(newTokens)
      setItems(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setConnecting(false)
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.size > 4 * 1024 * 1024) {
      setError('Dateien über 4 MB werden derzeit noch nicht unterstützt.')
      return
    }

    setUploadingFile(file.name)
    setError('')
    try {
      await apiCall('ensurePath', { pathParts: currentPath.split('/') })
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      await apiCall('uploadSmall', {
        filePath: `${currentPath}/${file.name}`,
        base64,
        contentType: file.type || 'application/octet-stream',
      })
      setSuccessMsg(`✓ ${file.name} hochgeladen`)
      setTimeout(() => setSuccessMsg(''), 4000)
      await loadItems()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingFile(null)
    }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim()
    if (!name) return
    setCreatingFolderLoading(true)
    setError('')
    try {
      await apiCall('createFolder', { parentPath: currentPath, folderName: name })
      setNewFolderName('')
      setCreatingFolder(false)
      setSuccessMsg(`✓ Ordner "${name}" erstellt`)
      setTimeout(() => setSuccessMsg(''), 4000)
      await loadItems()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreatingFolderLoading(false)
    }
  }

  async function handleDelete(item) {
    if (deleteConfirm !== item.id) {
      setDeleteConfirm(item.id)
      setTimeout(() => setDeleteConfirm(c => c === item.id ? null : c), 4000)
      return
    }
    setDeleteConfirm(null)
    setLoading(true)
    setError('')
    try {
      await apiCall('deleteItem', { itemId: item.id })
      setSuccessMsg(`✓ ${item.name} gelöscht`)
      setTimeout(() => setSuccessMsg(''), 4000)
      await loadItems()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  // ── Umbenennen (Datei ODER Ordner) ─────────────────────────────────────────
  function startRename(item) {
    setDeleteConfirm(null)
    setError('')
    setRenamingId(item.id)
    setRenameValue(item.name)
  }

  function cancelRename() {
    setRenamingId(null)
    setRenameValue('')
  }

  async function handleRename(item) {
    const neu = renameValue.trim()
    if (!neu || neu === item.name) { cancelRename(); return }
    if (/[\\/:*?"<>|]/.test(neu)) {
      setError('Der Name enthält unzulässige Zeichen ( \\ / : * ? " < > | )')
      return
    }
    setRenameLoading(true)
    setError('')
    try {
      await apiCall('renameItem', { itemId: item.id, newName: neu })
      setSuccessMsg(`✓ „${item.name}" umbenannt in „${neu}"`)
      setTimeout(() => setSuccessMsg(''), 4000)
      cancelRename()
      await loadItems()
    } catch (err) {
      setError(err.message)
    } finally {
      setRenameLoading(false)
    }
  }

  async function handleDownload(item) {
    try {
      const filePath = `${currentPath}/${item.name}`
      const res = await apiCall('downloadUrl', { filePath })
      if (res.downloadUrl) {
        window.open(res.downloadUrl, '_blank')
      } else {
        setError('Download-Link konnte nicht abgerufen werden.')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function handlePreview(item) {
    setPreviewItem(item)
    setPreviewUrl(null)
    setPreviewDownloadUrl(null)
    setPreviewWebUrl(null)
    setPreviewError('')
    setPreviewLoading(true)
    try {
      const filePath = `${currentPath}/${item.name}`
      const res = await apiCall('downloadUrl', { filePath })
      if (!res.downloadUrl) { setPreviewError('Vorschau-URL nicht verfügbar.'); return }
      setPreviewDownloadUrl(res.downloadUrl)
      setPreviewWebUrl(res.item?.webUrl ?? null)
      const isImage = item?.file?.mimeType?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(item?.name ?? '')
      const isPdf   = item?.file?.mimeType === 'application/pdf' || /\.pdf$/i.test(item?.name ?? '')
      if (isImage || isPdf) {
        // Inhalt als Blob laden → Inline-Vorschau ohne Download in den Download-Ordner
        const r = await fetch(res.downloadUrl)
        if (!r.ok) throw new Error(`Laden fehlgeschlagen (HTTP ${r.status})`)
        const blob = await r.blob()
        setPreviewUrl(URL.createObjectURL(blob))
      }
    } catch (err) {
      setPreviewError(err.message)
    } finally {
      setPreviewLoading(false)
    }
  }

  function closePreview() {
    setPreviewUrl(prev => { if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev); return null })
    setPreviewItem(null)
    setPreviewDownloadUrl(null)
    setPreviewWebUrl(null)
    setPreviewError('')
  }

  async function handleSendAsAttachment() {
    const fileItems = (items ?? []).filter(i => i.file && selectedIds.has(i.id))
    if (fileItems.length === 0) return
    const totalSize = fileItems.reduce((s, i) => s + (i.size ?? 0), 0)
    if (totalSize > 20 * 1024 * 1024) {
      setError('Ausgewählte Dateien überschreiten 20 MB – bitte weniger Dateien auswählen.')
      return
    }
    setSendingAsAttachment(true)
    setError('')
    try {
      const attachments = []
      for (const item of fileItems) {
        const filePath = `${currentPath}/${item.name}`
        const res = await apiCall('downloadUrl', { filePath })
        if (!res.downloadUrl) throw new Error(`Kein Download-Link für ${item.name}`)
        const response = await fetch(res.downloadUrl)
        if (!response.ok) throw new Error(`Download fehlgeschlagen: ${item.name}`)
        const buffer = await response.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
        attachments.push({
          filename:    item.name,
          content:     btoa(binary),
          contentType: item.file?.mimeType ?? 'application/octet-stream',
        })
      }
      onSendAsAttachment?.(attachments)
      setSelectedIds(new Set())
      setSuccessMsg(`✓ ${attachments.length} Datei${attachments.length > 1 ? 'en' : ''} an E-Mail-Editor übergeben`)
      setTimeout(() => setSuccessMsg(''), 5000)
    } catch (err) {
      setError('Fehler beim Vorbereiten der Anhänge: ' + err.message)
    } finally {
      setSendingAsAttachment(false)
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const fileIds = (items ?? []).filter(i => i.file).map(i => i.id)
    if (fileIds.every(id => selectedIds.has(id)) && fileIds.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(fileIds))
    }
  }

  const fileItems    = (items ?? []).filter(i => i.file)
  const allSelected  = fileItems.length > 0 && fileItems.every(i => selectedIds.has(i.id))
  const someSelected = selectedIds.size > 0
  const inSubfolder  = breadcrumb.length > 1

  // Nicht verbunden
  if (!tokens?.accessToken) {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>☁️</div>
        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>OneDrive verbinden</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', maxWidth: '380px', margin: '0 auto 16px' }}>
          Speichere Dokumente dieses Mandanten direkt in deinem OneDrive unter
          <br/><code style={{ fontSize: '11px', background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', display: 'inline-block' }}>
            {folderPath}
          </code>
          {isCustom && <span style={{ fontSize: '10px', display: 'block', marginTop: '4px', color: '#0891b2' }}>☁️ Individueller Pfad</span>}
        </div>
        {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>{error}</div>}
        <button className="btn btn-primary" onClick={handleConnect} disabled={connecting} style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {connecting ? '⏳ Verbinden…' : <><MicrosoftIcon /> Mit Microsoft anmelden</>}
        </button>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px' }}>
          Du wirst zu Microsoft weitergeleitet und kannst dich dort anmelden.
        </div>
      </div>
    )
  }

  // Verbunden
  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MicrosoftIcon />
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px' }}>OneDrive</div>
            {user && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.displayName ?? user.mail ?? user.userPrincipalName}</div>}
          </div>
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: 'rgba(22,163,74,0.12)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.25)' }}>● Verbunden</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {successMsg && <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>{successMsg}</span>}
          {someSelected && onSendAsAttachment && (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSendAsAttachment}
              disabled={sendingAsAttachment}
              style={{ fontSize: '11px' }}
              title={`${selectedIds.size} Datei${selectedIds.size > 1 ? 'en' : ''} als E-Mail-Anhang`}
            >
              {sendingAsAttachment ? '⏳ Wird vorbereitet…' : `📎 Als E-Mail-Anhang (${selectedIds.size})`}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setCreatingFolder(v => !v)} style={{ fontSize: '11px' }} title="Neuen Ordner anlegen">
            📁+ Neuer Ordner
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => loadItems()} disabled={loading} style={{ fontSize: '11px' }}>
            {loading ? '⏳' : '🔄'} Aktualisieren
          </button>
          <label style={{ cursor: 'pointer' }}>
            <input type="file" style={{ display: 'none' }} onChange={handleUpload} disabled={!!uploadingFile} />
            <span className="btn btn-primary btn-sm" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', pointerEvents: uploadingFile ? 'none' : 'auto', opacity: uploadingFile ? 0.6 : 1 }}>
              {uploadingFile ? `⏳ ${uploadingFile}…` : '⬆️ Hochladen'}
            </span>
          </label>
          <button className="btn btn-ghost btn-sm" onClick={() => { onUpdateTokens?.(null); setItems(null); setUser(null) }} style={{ fontSize: '11px', color: 'var(--text-muted)' }} title="OneDrive trennen">
            ✕ Trennen
          </button>
        </div>
      </div>

      {/* ── Breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', marginBottom: '8px', padding: '5px 10px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {breadcrumb.map((crumb, i) => (
          <span key={crumb.path} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {i > 0 && <span style={{ color: 'var(--text-muted)' }}>/</span>}
            <button
              onClick={() => navigateTo(crumb.path, crumb.name)}
              style={{ background: 'none', border: 'none', cursor: i < breadcrumb.length - 1 ? 'pointer' : 'default', color: i < breadcrumb.length - 1 ? 'var(--accent)' : 'var(--text)', fontWeight: i === breadcrumb.length - 1 ? 700 : 400, fontSize: '11px', padding: '0 2px' }}
              disabled={i === breadcrumb.length - 1}
            >
              {i === 0 ? `📁 ${crumb.name}` : crumb.name}
            </button>
          </span>
        ))}
      </div>

      {/* ── Speicherort-Info ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginBottom: '8px', padding: '5px 10px', background: isCustom ? 'rgba(8,145,178,0.06)' : 'var(--surface)', borderRadius: '6px', border: `1px solid ${isCustom ? 'rgba(8,145,178,0.25)' : 'var(--border)'}`, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {isCustom ? '☁️ Individueller Pfad:' : '📁 Standard-Pfad:'}
        </span>
        <code style={{ fontSize: '10px', background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>
          {folderPath}
        </code>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setShowPathSettings(v => !v); setEditPath(client.onedrivePfad ?? '') }}
          style={{ fontSize: '10px', marginLeft: 'auto', color: 'var(--text-muted)' }}
        >
          ⚙️ {showPathSettings ? 'Schließen' : 'Ändern'}
        </button>
      </div>

      {/* ── Pfad-Einstellungen ── */}
      {showPathSettings && (
        <div style={{ marginBottom: '10px', padding: '12px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>📂 Speicherpfad konfigurieren</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Wähle den Ordner, in dem die Dokumente dieses Mandanten gespeichert werden sollen.
            Ohne Angabe wird der Standard-Pfad verwendet.
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="input"
              value={editPath}
              onChange={e => setEditPath(e.target.value)}
              placeholder="Pfad oder per Durchsuchen wählen…"
              style={{ flex: 1, minWidth: '200px', fontSize: '12px', padding: '6px 8px', fontFamily: 'var(--font-mono)' }}
              onKeyDown={e => { if (e.key === 'Enter') { onUpdate({ onedrivePfad: editPath.trim() }); setShowPathSettings(false) } }}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowFolderPicker(true)}
              style={{ fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              📁 Durchsuchen
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { onUpdate({ onedrivePfad: editPath.trim() }); setShowPathSettings(false) }}
              style={{ fontSize: '11px' }}
            >
              ✓ Speichern
            </button>
            {editPath.trim() && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setEditPath(''); onUpdate({ onedrivePfad: '' }); setShowPathSettings(false) }}
                style={{ fontSize: '11px', color: '#d97706' }}
              >
                ↩ Standard
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── OneDrive Ordner-Picker Modal ── */}
      {showFolderPicker && (
        <OneDriveFolderPickerModal
          tokens={tokens}
          onUpdateTokens={onUpdateTokens}
          title={`Speicherordner wählen – ${client.name}`}
          initialPath={editPath || client.onedrivePfad || ''}
          onSelect={selectedPath => {
            setEditPath(selectedPath)
            onUpdate({ onedrivePfad: selectedPath })
            setShowPathSettings(false)
          }}
          onClose={() => setShowFolderPicker(false)}
        />
      )}

      {/* ── Neuer-Ordner-Form ── */}
      {creatingFolder && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center', padding: '8px 10px', background: 'rgba(8,145,178,0.06)', borderRadius: '7px', border: '1px solid rgba(8,145,178,0.25)' }}>
          <span style={{ fontSize: '12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>📁 Neuer Ordner:</span>
          <input
            className="input"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Ordnername"
            style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName('') } }}
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={handleCreateFolder} disabled={!newFolderName.trim() || creatingFolderLoading} style={{ fontSize: '11px' }}>
            {creatingFolderLoading ? '⏳' : '✓ Erstellen'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setCreatingFolder(false); setNewFolderName('') }} style={{ fontSize: '11px' }}>
            ✕
          </button>
        </div>
      )}

      {/* ── Fehler ── */}
      {error && (
        <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '10px', padding: '8px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Laden ── */}
      {loading && (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          ⏳ Lade Inhalte…
        </div>
      )}

      {/* ── Leer ── */}
      {!loading && items?.length === 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📁</div>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{inSubfolder ? 'Ordner ist leer' : 'Noch keine Dateien'}</div>
          <div>{inSubfolder ? 'Lade Dateien hoch oder lege Unterordner an.' : 'Lade eine Datei hoch, um diesen Mandanten-Ordner zu erstellen.'}</div>
        </div>
      )}

      {/* ── Liste ── */}
      {!loading && items && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {/* Spaltenheader */}
          <div style={{ display: 'grid', gridTemplateColumns: '22px 22px 28px 1fr 60px 100px 80px 128px', gap: '6px', padding: '4px 8px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
            <span>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                title="Alle Dateien auswählen"
                style={{ cursor: 'pointer' }}
              />
            </span>
            <span/>
            <span/>
            <span>Name</span>
            <span>Typ</span>
            <span>Geändert</span>
            <span style={{ textAlign: 'right' }}>Größe</span>
            <span style={{ textAlign: 'right' }}>Aktionen</span>
          </div>

          {/* Zurück-Zeile wenn in Unterordner */}
          {inSubfolder && (
            <div
              onClick={navigateBack}
              style={{ display: 'grid', gridTemplateColumns: '22px 22px 28px 1fr 60px 100px 80px 128px', gap: '6px', padding: '6px 8px', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '12px', cursor: 'pointer', opacity: 0.7 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <span/><span/>
              <span style={{ fontSize: '16px', textAlign: 'center' }}>⬆️</span>
              <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>.. (zurück)</span>
              <span/><span/><span/><span/>
            </div>
          )}

          {items.map(item => {
            const isFolder = !!item.folder
            const isSelected = selectedIds.has(item.id)

            return (
              <div
                key={item.id}
                style={{
                  display: 'grid', gridTemplateColumns: '22px 22px 28px 1fr 60px 100px 80px 128px',
                  gap: '6px', padding: '6px 8px', alignItems: 'center',
                  background: isSelected ? 'rgba(8,145,178,0.07)' : 'var(--surface)',
                  border: `1px solid ${isSelected ? 'rgba(8,145,178,0.4)' : 'var(--border)'}`,
                  borderRadius: '5px', fontSize: '12px',
                  transition: 'border-color 0.15s, background 0.1s',
                  cursor: isFolder ? 'pointer' : 'default',
                }}
                onClick={isFolder ? () => navigateTo(`${currentPath}/${item.name}`, item.name) : undefined}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--accent)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                {/* Checkbox (nur für Dateien) */}
                <span onClick={e => e.stopPropagation()}>
                  {!isFolder && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  )}
                </span>

                {/* Ordner-Pfeil */}
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {isFolder ? '›' : ''}
                </span>

                {/* Icon */}
                <span style={{ fontSize: '16px', textAlign: 'center' }}>
                  {isFolder ? '📁' : fileIcon(item.name, item.file?.mimeType)}
                </span>

                {/* Name – im Umbenennen-Modus als Eingabefeld */}
                {renamingId === item.id ? (
                  <span onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); handleRename(item) }
                        if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
                      }}
                      disabled={renameLoading}
                      autoFocus
                      onFocus={e => {
                        // Bei Dateien nur den Namen ohne Endung vorauswählen
                        const p = item.name.lastIndexOf('.')
                        if (!isFolder && p > 0) e.target.setSelectionRange(0, p)
                        else e.target.select()
                      }}
                      style={{ flex: 1, minWidth: 0, padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--accent)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', fontWeight: 600 }}
                    />
                    <button className="btn btn-sm" onClick={() => handleRename(item)} disabled={renameLoading}
                      title="Speichern (Enter)" style={{ fontSize: '10px', padding: '2px 5px', color: '#16a34a' }}>✓</button>
                    <button className="btn btn-ghost btn-sm" onClick={cancelRename} disabled={renameLoading}
                      title="Abbrechen (Esc)" style={{ fontSize: '10px', padding: '2px 5px' }}>✕</button>
                  </span>
                ) : (
                  <span
                    style={{ fontWeight: isFolder ? 700 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isFolder ? 'var(--accent)' : 'var(--text)', cursor: !isFolder ? 'pointer' : undefined }}
                    title={isFolder ? `Ordner öffnen: ${item.name}` : `Vorschau: ${item.name}`}
                    onClick={!isFolder ? (e => { e.stopPropagation(); handlePreview(item) }) : undefined}
                  >
                    {item.name}
                  </span>
                )}

                {/* Typ */}
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '8px', background: isFolder ? 'rgba(8,145,178,0.1)' : 'rgba(100,116,139,0.1)', color: isFolder ? '#0891b2' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {isFolder ? 'ORDNER' : fileTypeLabel(item.name, item.file?.mimeType)}
                </span>

                {/* Datum */}
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  {fmtDatum(item.lastModifiedDateTime)}
                </span>

                {/* Größe */}
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'right' }}>
                  {isFolder ? (item.folder?.childCount != null ? `${item.folder.childCount} Element${item.folder.childCount !== 1 ? 'e' : ''}` : '–') : fmtFileSize(item.size)}
                </span>

                {/* Aktionen */}
                <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                  {!isFolder && (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => handlePreview(item)} title="Vorschau" style={{ fontSize: '10px', padding: '2px 5px' }}>👁</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDownload(item)} title="Herunterladen" style={{ fontSize: '10px', padding: '2px 5px' }}>⬇️</button>
                    </>
                  )}
                  {/* Umbenennen – für Dateien und Ordner */}
                  {renamingId !== item.id && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => startRename(item)}
                      title={isFolder ? 'Ordner umbenennen' : 'Datei umbenennen'}
                      style={{ fontSize: '10px', padding: '2px 5px' }}
                    >
                      ✏️
                    </button>
                  )}
                  <button
                    className={`btn btn-sm ${deleteConfirm === item.id ? 'btn-danger' : 'btn-ghost'}`}
                    onClick={() => handleDelete(item)}
                    title={deleteConfirm === item.id ? 'Klicke erneut zum Bestätigen' : 'Löschen'}
                    style={{ fontSize: '10px', padding: '2px 5px', color: deleteConfirm === item.id ? '#ef4444' : 'var(--text-muted)' }}
                  >
                    {deleteConfirm === item.id ? '⚠️?' : '🗑'}
                  </button>
                </div>
              </div>
            )
          })}

          {/* Fußzeile */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>
              {items.filter(i => i.folder).length > 0 && `${items.filter(i => i.folder).length} Ordner · `}
              {fileItems.length} Datei{fileItems.length !== 1 ? 'en' : ''} · {fmtFileSize(fileItems.reduce((s, i) => s + (i.size ?? 0), 0))}
            </span>
            {someSelected && (
              <span style={{ color: '#0891b2', fontWeight: 600 }}>
                {selectedIds.size} ausgewählt
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Vorschau-Modal ── */}
      {previewItem && (
        <PreviewModal
          item={previewItem}
          previewUrl={previewUrl}
          downloadUrl={previewDownloadUrl}
          webUrl={previewWebUrl}
          loading={previewLoading}
          error={previewError}
          onClose={closePreview}
        />
      )}
    </div>
  )
}

// Minimales Microsoft-Logo als SVG
function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1"  width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function DokumenteTab({ client, onUpdate, onNavigateToKomm, onedriveTokens, onUpdateOnedriveTokens, onSendAsAttachment }) {
  const [activeSection, setActiveSection] = useState('onedrive')  // 'onedrive' | 'emails'

  return (
    <div style={{ padding: '20px', maxWidth: '960px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>📂 Dokumente</h2>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['onedrive', 'emails'].map(s => (
            <button
              key={s}
              className={`btn btn-sm ${activeSection === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveSection(s)}
              style={{ fontSize: '11px' }}
            >
              {s === 'onedrive' ? '☁️ OneDrive' : '📧 E-Mail-Anhänge'}
            </button>
          ))}
        </div>
      </div>

      {/* OneDrive Section */}
      {activeSection === 'onedrive' && (
        <OneDriveSection
          client={client}
          tokens={onedriveTokens}
          onUpdateTokens={onUpdateOnedriveTokens}
          onSendAsAttachment={onSendAsAttachment}
          onUpdate={onUpdate}
        />
      )}

      {/* E-Mail-Anhänge Section */}
      {activeSection === 'emails' && (
        <EmailAnhaeange client={client} onNavigateToKomm={onNavigateToKomm} />
      )}
    </div>
  )
}
