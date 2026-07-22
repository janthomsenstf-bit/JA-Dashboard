import { useState, useEffect, useCallback } from 'react'
import { callApi } from '../utils/onedriveClient.js'

/**
 * OneDrive-Ordnerbaum im Stil des Windows-Explorers.
 *
 * Zeigt die ECHTE Ordnerstruktur aus OneDrive – Unterordner werden erst beim
 * Aufklappen nachgeladen (schont Anfragen und ist auch bei großen Ablagen schnell).
 *
 * Rein lesend: nutzt ausschließlich `listFolder`. Es wird nichts angelegt,
 * verschoben, umbenannt oder gelöscht.
 */

export default function OneDriveOrdnerbaum({
  tokens,
  onUpdateTokens,
  ausgewaehlt = '',        // aktuell gewählter Ordnerpfad ('' = OneDrive-Stamm)
  onAuswahl,               // (pfad, name) => void
  markierte = [],          // optionale Mehrfachmarkierung für spätere KI-Aktionen
  onMarkierung,            // (pfad) => void
}) {
  const [kinder, setKinder]     = useState({})   // pfad -> [ordner]
  const [offen, setOffen]       = useState(new Set(['']))
  const [laden, setLaden]       = useState(new Set())
  const [fehler, setFehler]     = useState('')
  const [suche, setSuche]       = useState('')

  const ladeOrdner = useCallback(async (pfad) => {
    if (!tokens?.accessToken) return
    setLaden(s => new Set(s).add(pfad))
    try {
      const res = await callApi('listFolder', { folderPath: pfad }, tokens, onUpdateTokens)
      const ordner = (res.items ?? [])
        .filter(i => !!i.folder)
        .map(i => ({ id: i.id, name: i.name, pfad: pfad ? `${pfad}/${i.name}` : i.name, anzahl: i.folder?.childCount ?? 0 }))
      setKinder(k => ({ ...k, [pfad]: ordner }))
      setFehler('')
    } catch (e) {
      setFehler(e.message || 'Ordner konnten nicht geladen werden.')
    } finally {
      setLaden(s => { const n = new Set(s); n.delete(pfad); return n })
    }
  }, [tokens, onUpdateTokens])

  // Wurzel beim ersten Anzeigen laden
  useEffect(() => {
    if (tokens?.accessToken && kinder[''] === undefined) ladeOrdner('')
  }, [tokens, kinder, ladeOrdner])

  function toggle(pfad) {
    setOffen(o => {
      const n = new Set(o)
      if (n.has(pfad)) { n.delete(pfad); return n }
      n.add(pfad)
      if (kinder[pfad] === undefined) ladeOrdner(pfad)
      return n
    })
  }

  function waehle(pfad, name) {
    onAuswahl?.(pfad, name)
    if (!offen.has(pfad)) toggle(pfad)
  }

  const suchbegriff = suche.trim().toLowerCase()

  function Knoten({ pfad, name, ebene }) {
    const istOffen   = offen.has(pfad)
    const istAktiv   = ausgewaehlt === pfad
    const istGeladen = kinder[pfad] !== undefined
    const laedt      = laden.has(pfad)
    const unter      = kinder[pfad] ?? []
    const markiert   = markierte.includes(pfad)

    // Bei aktiver Suche nur passende Ordner zeigen (Wurzelebene gefiltert)
    const sichtbar = !suchbegriff || name.toLowerCase().includes(suchbegriff)

    return (
      <div>
        {sichtbar && (
          <div
            onClick={() => waehle(pfad, name)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '5px 8px', paddingLeft: `${8 + ebene * 15}px`,
              cursor: 'pointer', borderRadius: '6px', userSelect: 'none',
              background: istAktiv ? 'rgba(220,38,38,0.1)' : 'transparent',
              color: istAktiv ? '#dc2626' : 'var(--text)',
              fontWeight: istAktiv ? 700 : 500, fontSize: '12.5px',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => { if (!istAktiv) e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { if (!istAktiv) e.currentTarget.style.background = 'transparent' }}
          >
            {/* Auf-/Zuklappen */}
            <span
              onClick={e => { e.stopPropagation(); toggle(pfad) }}
              title={istOffen ? 'Zuklappen' : 'Aufklappen'}
              style={{
                width: '14px', flexShrink: 0, textAlign: 'center',
                fontSize: '9px', color: 'var(--text-muted)',
                transform: istOffen ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s',
              }}
            >▶</span>

            {/* Mehrfachmarkierung für spätere KI-Aktionen */}
            {onMarkierung && (
              <input
                type="checkbox"
                checked={markiert}
                onClick={e => e.stopPropagation()}
                onChange={() => onMarkierung(pfad)}
                title="Für KI-Aktionen markieren"
                style={{ cursor: 'pointer', accentColor: '#dc2626', flexShrink: 0, width: '13px', height: '13px' }}
              />
            )}

            <span style={{ flexShrink: 0 }} aria-hidden="true">{istOffen ? '📂' : '📁'}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            {laedt && <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>…</span>}
          </div>
        )}

        {istOffen && (
          <div>
            {laedt && !istGeladen && (
              <div style={{ paddingLeft: `${8 + (ebene + 1) * 15}px`, fontSize: '11px', color: 'var(--text-muted)', padding: '4px 8px' }}>
                wird geladen …
              </div>
            )}
            {istGeladen && unter.length === 0 && (
              <div style={{ paddingLeft: `${8 + (ebene + 1) * 15}px`, fontSize: '11px', color: 'var(--text-muted)', padding: '4px 8px', fontStyle: 'italic' }}>
                keine Unterordner
              </div>
            )}
            {unter.map(u => <Knoten key={u.id} pfad={u.pfad} name={u.name} ebene={ebene + 1} />)}
          </div>
        )}
      </div>
    )
  }

  if (!tokens?.accessToken) {
    return (
      <div style={{ padding: '20px 14px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Noch keine OneDrive-Verbindung. Rechts kannst du dich verbinden – danach
        erscheint hier deine komplette Ordnerstruktur.
      </div>
    )
  }

  const wurzel = kinder[''] ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Suche */}
      <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid var(--border)' }}>
        <input
          value={suche}
          onChange={e => setSuche(e.target.value)}
          placeholder="🔍 Ordner filtern …"
          style={{
            width: '100%', padding: '7px 10px', borderRadius: '7px',
            border: '1px solid var(--border)', background: 'var(--surface2)',
            color: 'var(--text)', fontSize: '12px', outline: 'none',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px', minHeight: 0 }}>
        {/* Wurzel */}
        <div
          onClick={() => waehle('', 'OneDrive')}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', userSelect: 'none',
            background: ausgewaehlt === '' ? 'rgba(220,38,38,0.1)' : 'transparent',
            color: ausgewaehlt === '' ? '#dc2626' : 'var(--text)',
            fontWeight: 700, fontSize: '13px', marginBottom: '2px',
          }}
        >
          <span aria-hidden="true">☁️</span> OneDrive
        </div>

        {laden.has('') && wurzel.length === 0 && (
          <div style={{ padding: '10px', fontSize: '11.5px', color: 'var(--text-muted)' }}>Ordner werden geladen …</div>
        )}
        {fehler && (
          <div style={{ padding: '10px', fontSize: '11.5px', color: '#dc2626' }}>{fehler}</div>
        )}
        {wurzel.map(o => <Knoten key={o.id} pfad={o.pfad} name={o.name} ebene={0} />)}
        {!laden.has('') && !fehler && wurzel.length === 0 && kinder[''] !== undefined && (
          <div style={{ padding: '10px', fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Keine Ordner gefunden.
          </div>
        )}
      </div>

      {markierte.length > 0 && (
        <div style={{ padding: '9px 12px', borderTop: '1px solid var(--border)', fontSize: '11.5px', color: '#dc2626', fontWeight: 700 }}>
          {markierte.length} Ordner markiert
        </div>
      )}
    </div>
  )
}
