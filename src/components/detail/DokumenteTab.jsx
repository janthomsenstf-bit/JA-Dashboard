import { useState, useMemo, useEffect, useCallback } from 'react'
import { openAuthPopup, callApi, getMandantPath, fmtFileSize } from '../../utils/onedriveClient.js'

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

// ── OneDrive Section ──────────────────────────────────────────────────────────
function OneDriveSection({ client, tokens, onUpdateTokens }) {
  const [connecting, setConnecting]   = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [items, setItems]             = useState(null)      // null = noch nicht geladen
  const [user, setUser]               = useState(null)
  const [uploadingFile, setUploadingFile] = useState(null)  // Dateiname gerade im Upload
  const [deleteConfirm, setDeleteConfirm] = useState(null)  // itemId das gelöscht werden soll
  const [successMsg, setSuccessMsg]   = useState('')
  const fileInputRef = useState(null)

  const { pathParts, folderPath, folderName } = getMandantPath(client)

  // Callback wenn Tokens server-seitig refreshed wurden
  const handleTokenRefresh = useCallback((newTokens) => {
    onUpdateTokens?.(newTokens)
  }, [onUpdateTokens])

  async function apiCall(action, params = {}) {
    return callApi(action, params, tokens, handleTokenRefresh)
  }

  // Dateien laden wenn bereits verbunden
  useEffect(() => {
    if (tokens?.accessToken && items === null) {
      loadFiles()
    }
  }, [tokens?.accessToken])

  async function loadFiles() {
    setLoading(true)
    setError('')
    try {
      // Nutzer laden (einmalig wenn noch nicht geladen)
      if (!user) {
        try {
          const ud = await apiCall('getUser')
          setUser(ud.user)
        } catch {}
      }

      const res = await apiCall('listFolder', { folderPath })
      const fileItems = (res.items ?? []).filter(i => i.file)
      setItems(fileItems)
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

  async function handleConnect() {
    setConnecting(true)
    setError('')
    try {
      const newTokens = await openAuthPopup()
      onUpdateTokens?.(newTokens)
      // Items werden durch den useEffect automatisch geladen
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
    e.target.value = ''  // Reset für erneuten Upload derselben Datei

    if (file.size > 4 * 1024 * 1024) {
      setError('Dateien über 4 MB werden derzeit noch nicht unterstützt.')
      return
    }

    setUploadingFile(file.name)
    setError('')
    try {
      // Ordner sicherstellen
      await apiCall('ensurePath', { pathParts })

      // Datei als Base64 lesen
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result  // data:...;base64,XXXX
          resolve(result.split(',')[1])
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      await apiCall('uploadSmall', {
        filePath: `${folderPath}/${file.name}`,
        base64,
        contentType: file.type || 'application/octet-stream',
      })

      setSuccessMsg(`✓ ${file.name} hochgeladen`)
      setTimeout(() => setSuccessMsg(''), 4000)
      await loadFiles()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingFile(null)
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
      await loadFiles()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function handleDownload(item) {
    try {
      const filePath = `${folderPath}/${item.name}`
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

  // Nicht verbunden
  if (!tokens?.accessToken) {
    return (
      <div style={{
        border: '1px solid var(--border)', borderRadius: '10px',
        padding: '24px', textAlign: 'center',
      }}>
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>☁️</div>
        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>OneDrive verbinden</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', maxWidth: '380px', margin: '0 auto 16px' }}>
          Speichere Dokumente dieses Mandanten direkt in deinem OneDrive unter
          <br/><code style={{ fontSize: '11px', background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', display: 'inline-block' }}>
            Jahresabschluss-Dashboard/Mandanten/{folderName}
          </code>
        </div>
        {error && (
          <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>{error}</div>
        )}
        <button
          className="btn btn-primary"
          onClick={handleConnect}
          disabled={connecting}
          style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          {connecting ? '⏳ Verbinden…' : (
            <>
              <MicrosoftIcon />
              Mit Microsoft anmelden
            </>
          )}
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
      {/* Verbunden-Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MicrosoftIcon />
          <div>
            <div style={{ fontWeight: 700, fontSize: '13px' }}>OneDrive</div>
            {user && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {user.displayName ?? user.mail ?? user.userPrincipalName}
              </div>
            )}
          </div>
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
            background: 'rgba(22,163,74,0.12)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.25)',
          }}>● Verbunden</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {successMsg && (
            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>{successMsg}</span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={loadFiles} disabled={loading} style={{ fontSize: '11px' }}>
            {loading ? '⏳' : '🔄'} Aktualisieren
          </button>
          <label style={{ cursor: 'pointer' }}>
            <input type="file" style={{ display: 'none' }} onChange={handleUpload} disabled={!!uploadingFile} />
            <span
              className="btn btn-primary btn-sm"
              style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', pointerEvents: uploadingFile ? 'none' : 'auto', opacity: uploadingFile ? 0.6 : 1 }}
            >
              {uploadingFile ? `⏳ ${uploadingFile}…` : '⬆️ Datei hochladen'}
            </span>
          </label>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { onUpdateTokens?.(null); setItems(null); setUser(null) }}
            style={{ fontSize: '11px', color: 'var(--text-muted)' }}
            title="OneDrive trennen"
          >
            ✕ Trennen
          </button>
        </div>
      </div>

      {/* Ordner-Pfad */}
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px', padding: '5px 10px', background: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
        📁 <code style={{ fontSize: '11px' }}>{folderPath}</code>
      </div>

      {/* Fehler */}
      {error && (
        <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '10px', padding: '8px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Laden */}
      {loading && (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          ⏳ Lade Dateien…
        </div>
      )}

      {/* Leer */}
      {!loading && items?.length === 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📁</div>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Noch keine Dateien</div>
          <div>Lade eine Datei hoch, um diesen Mandanten-Ordner zu erstellen.</div>
        </div>
      )}

      {/* Dateiliste */}
      {!loading && items && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '28px 1fr 60px 110px 80px 90px',
            gap: '8px', padding: '4px 10px',
            fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span/>
            <span>Datei</span>
            <span>Typ</span>
            <span>Geändert</span>
            <span style={{ textAlign: 'right' }}>Größe</span>
            <span style={{ textAlign: 'right' }}>Aktionen</span>
          </div>

          {items.map(item => (
            <div
              key={item.id}
              style={{
                display: 'grid', gridTemplateColumns: '28px 1fr 60px 110px 80px 90px',
                gap: '8px', padding: '7px 10px', alignItems: 'center',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '5px', fontSize: '12px',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <span style={{ fontSize: '16px', textAlign: 'center' }}>{fileIcon(item.name, item.file?.mimeType)}</span>
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name}>{item.name}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '8px', background: 'rgba(100,116,139,0.1)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {fileTypeLabel(item.name, item.file?.mimeType)}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                {fmtDatum(item.lastModifiedDateTime)}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'right' }}>
                {fmtFileSize(item.size)}
              </span>
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDownload(item)}
                  title="Herunterladen"
                  style={{ fontSize: '11px', padding: '2px 6px' }}
                >
                  ⬇️
                </button>
                <button
                  className={`btn btn-sm ${deleteConfirm === item.id ? 'btn-danger' : 'btn-ghost'}`}
                  onClick={() => handleDelete(item)}
                  title={deleteConfirm === item.id ? 'Klicke erneut zum Bestätigen' : 'Löschen'}
                  style={{ fontSize: '11px', padding: '2px 6px', color: deleteConfirm === item.id ? '#ef4444' : 'var(--text-muted)' }}
                >
                  {deleteConfirm === item.id ? '⚠️ Sicher?' : '🗑'}
                </button>
              </div>
            </div>
          ))}

          <div style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
            {items.length} Datei{items.length !== 1 ? 'en' : ''} · {fmtFileSize(items.reduce((s, i) => s + (i.size ?? 0), 0))} gesamt
          </div>
        </div>
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
export default function DokumenteTab({ client, onUpdate, onNavigateToKomm, onedriveTokens, onUpdateOnedriveTokens }) {
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
        />
      )}

      {/* E-Mail-Anhänge Section */}
      {activeSection === 'emails' && (
        <EmailAnhaeange client={client} onNavigateToKomm={onNavigateToKomm} />
      )}
    </div>
  )
}
