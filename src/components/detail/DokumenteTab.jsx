import { useState, useMemo } from 'react'

function fmtDatum(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
}

function fmtFileSize(bytes) {
  if (!bytes) return '–'
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileIcon(contentType) {
  if (!contentType) return '📎'
  if (contentType.includes('pdf'))                              return '📄'
  if (contentType.startsWith('image/'))                        return '🖼'
  if (contentType.includes('word') || contentType.includes('document')) return '📝'
  if (contentType.includes('sheet') || contentType.includes('excel'))   return '📊'
  if (contentType.includes('zip') || contentType.includes('compressed')) return '🗜'
  if (contentType.includes('text/'))                           return '📃'
  return '📎'
}

function fileTypeLabel(contentType) {
  if (!contentType) return 'Datei'
  if (contentType.includes('pdf'))    return 'PDF'
  if (contentType.startsWith('image/')) return contentType.split('/')[1]?.toUpperCase() ?? 'Bild'
  if (contentType.includes('word') || contentType.includes('document')) return 'Word'
  if (contentType.includes('sheet') || contentType.includes('excel'))   return 'Excel'
  if (contentType.includes('zip'))    return 'ZIP'
  if (contentType.includes('text/plain')) return 'Text'
  return contentType.split('/')[1]?.split('.').pop()?.toUpperCase() ?? 'Datei'
}

export default function DokumenteTab({ client, onNavigateToKomm }) {
  const [filter, setFilter] = useState('alle')   // 'alle' | 'empfangen' | 'gesendet'
  const [search, setSearch] = useState('')

  const events = client.kommunikation?.events ?? []

  // Alle Anhänge aus Events aggregieren
  const allDocs = useMemo(() => {
    const docs = []
    events.forEach(ev => {
      ;(ev.anlagen ?? []).forEach((a, i) => {
        docs.push({
          key:      `${ev.id}:${i}`,
          name:     a.name,
          size:     a.size ?? 0,
          contentType: a.contentType ?? '',
          tooLarge: a.tooLarge ?? false,
          datum:    ev.erstelltAm ?? ev.gesendetAm,
          source:   ev.typ === 'eingehend' ? 'empfangen' : 'gesendet',
          absender: ev.absender ?? '',
          betreff:  ev.betreff  ?? '',
          eventId:  ev.id,
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
      d = d.filter(doc => doc.name.toLowerCase().includes(q) || doc.betreff.toLowerCase().includes(q) || doc.absender.toLowerCase().includes(q))
    }
    return d
  }, [allDocs, filter, search])

  const totalSize = filtered.reduce((s, d) => s + (d.size ?? 0), 0)

  return (
    <div style={{ padding: '20px', maxWidth: '900px' }}>

      {/* Kopfzeile */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
            📂 Dokumente & Anhänge
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {allDocs.length} Anhang{allDocs.length !== 1 ? 'änge' : ''} · {fmtFileSize(allDocs.reduce((s, d) => s + d.size, 0))} gesamt
          </div>
        </div>
        {onNavigateToKomm && (
          <button className="btn btn-ghost btn-sm" onClick={onNavigateToKomm} style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            ✉️ Zur Kommunikation
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="input"
          placeholder="🔍 Dateiname, Betreff, Absender…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 200px', fontSize: '12px', padding: '6px 10px', maxWidth: '300px' }}
        />
        {['alle', 'empfangen', 'gesendet'].map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f)}
            style={{ fontSize: '11px', textTransform: 'capitalize' }}
          >
            {f === 'alle' ? 'Alle' : f === 'empfangen' ? '📥 Empfangen' : '📤 Gesendet'}
          </button>
        ))}
      </div>

      {/* Leer-Zustand */}
      {allDocs.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Noch keine Anhänge</div>
          <div style={{ fontSize: '12px' }}>
            Anhänge aus E-Mails erscheinen hier automatisch.
          </div>
          {onNavigateToKomm && (
            <button className="btn btn-ghost btn-sm" onClick={onNavigateToKomm} style={{ marginTop: '12px', fontSize: '12px' }}>
              Zur Kommunikation →
            </button>
          )}
        </div>
      )}

      {/* Kein Treffer */}
      {allDocs.length > 0 && filtered.length === 0 && (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
          Keine Treffer für diese Suche.
        </div>
      )}

      {/* Dokument-Liste */}
      {filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Tabellen-Kopf */}
          <div style={{
            display: 'grid', gridTemplateColumns: '32px 1fr 80px 100px 1fr 80px',
            gap: '10px', padding: '6px 12px',
            fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span />
            <span>Datei</span>
            <span>Typ</span>
            <span>Datum</span>
            <span>Quelle</span>
            <span>Größe</span>
          </div>

          {filtered.map(doc => (
            <div
              key={doc.key}
              style={{
                display: 'grid', gridTemplateColumns: '32px 1fr 80px 100px 1fr 80px',
                gap: '10px', padding: '8px 12px', alignItems: 'center',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '6px', fontSize: '12px',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              {/* Icon */}
              <span style={{ fontSize: '18px', textAlign: 'center' }}>{fileIcon(doc.contentType)}</span>

              {/* Dateiname */}
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.name}
              </span>

              {/* Typ */}
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px',
                background: 'rgba(100,116,139,0.1)', color: 'var(--text-muted)', whiteSpace: 'nowrap',
              }}>
                {fileTypeLabel(doc.contentType)}
              </span>

              {/* Datum */}
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                {fmtDatum(doc.datum)}
              </span>

              {/* Quelle */}
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {doc.source === 'empfangen' ? `📥 Von: ${doc.absender}` : `📤 Gesendet`}
                </div>
                {doc.betreff && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {doc.betreff}
                  </div>
                )}
              </div>

              {/* Größe */}
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', textAlign: 'right' }}>
                {doc.tooLarge
                  ? <span style={{ color: '#f97316', fontSize: '10px' }}>zu groß</span>
                  : fmtFileSize(doc.size)
                }
              </span>
            </div>
          ))}

          {/* Footer */}
          {filtered.length > 1 && (
            <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right' }}>
              {filtered.length} Dateien · {fmtFileSize(totalSize)} gesamt
            </div>
          )}
        </div>
      )}

      {/* Hinweis für zukünftige Drive-Integration */}
      <div style={{
        marginTop: '24px', padding: '12px 16px', borderRadius: '8px',
        border: '1px dashed var(--border)', fontSize: '12px', color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ fontSize: '16px' }}>☁️</span>
        <span>
          <strong style={{ color: 'var(--text)' }}>Cloud-Anbindung</strong> — OneDrive / Google Drive Integration ist geplant.
          Dann werden Anhänge direkt im Mandanten-Ordner gespeichert und hier angezeigt.
        </span>
      </div>
    </div>
  )
}
