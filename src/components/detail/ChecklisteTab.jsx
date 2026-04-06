import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import KontoRechnerModal from './KontoRechnerModal.jsx'

const MAX_CLIENT_FILE_BYTES = 5 * 1024 * 1024  // 5 MB

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

function fmtEuro(val) {
  if (val == null || isNaN(val)) return '–'
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
}

const DEFAULT_STATE = {
  kontonummer:    '',
  notiz:          '',
  geprueft:       false,
  ja:             false,
  nein:           false,
  nicht_relevant: false,
  anfordern:      false,
  rueckfrageId:   null,
  rueckfrageText: '',
  erledigt:       false,
  berechnungen:   null,
}

function safeItem(it) {
  return { type: 'item', description: '', anlage: null, ...it }
}

function genRqId() {
  return 'rq' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

function genExtraId() {
  return 'ex' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

// ── Browser-Fallback: Download ─────────────────────────────────────────────
function openAnlage(anlage) {
  const bytes = atob(anlage.data)
  const arr   = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  const blob  = new Blob([arr], { type: anlage.mimeType || 'application/octet-stream' })
  const url   = URL.createObjectURL(blob)
  const a     = document.createElement('a')
  a.href      = url
  a.download  = anlage.name
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 100)
}

export default function ChecklisteTab({
  client,
  checklistenTypen,
  onUpdateCheckliste,
  onAddRueckfrageFromCheckliste,
  onDeleteRueckfrage,
  onToggleRueckfrage,
  vorlagen = [],
  onUpdateClient,
}) {
  const [selectedTypId, setSelectedTypId]         = useState(checklistenTypen.length > 0 ? checklistenTypen[0].id : null)
  const [showErledigt, setShowErledigt]            = useState(false)

  // Sync selectedTypId when types are added after initial mount (e.g. after creating first type)
  useEffect(() => {
    if (!selectedTypId && checklistenTypen.length > 0) {
      setSelectedTypId(checklistenTypen[0].id)
    }
  }, [checklistenTypen])
  const [pendingUploadItemId, setPendingUploadItemId] = useState(null)
  const [collapsedSections, setCollapsedSections]  = useState({})
  const [rechnerItemId, setRechnerItemId]           = useState(null)
  // Electron: gemappte Temp-Pfade {[itemId]: tmpPath} für File-Watch
  const [watchedPaths, setWatchedPaths]            = useState({})
  // Toast-Benachrichtigung bei Excel-Speichern
  const [toast, setToast]                          = useState(null)  // { itemId, msg }
  const uploadRef = useRef(null)

  const selectedTyp     = checklistenTypen.find(t => t.id === selectedTypId) ?? null
  const clientChecklist = (client.checklisten ?? {})[selectedTypId] ?? {}
  // Extra items (per-client duplicates + SUSA imports)
  const extraItems = Array.isArray(clientChecklist.__extras) ? clientChecklist.__extras : []

  // ── Electron: File-Watch-Listener ─────────────────────────────────────────
  useEffect(() => {
    if (!window.electronAPI) return
    const handler = async (changedPath) => {
      const entry = Object.entries(watchedPaths).find(([, p]) => p === changedPath)
      if (!entry) return
      const [itemId] = entry
      try {
        const { data, size } = await window.electronAPI.readFile(changedPath)
        const s = getState(itemId)
        const existing = s.clientAnlage ?? {}
        updateItem(itemId, {
          clientAnlage: {
            ...existing,
            data,
            size,
            updatedAt: new Date().toISOString(),
          },
        })
        setToast({ itemId, msg: '✓ In Excel gespeichert' })
        setTimeout(() => setToast(t => t?.itemId === itemId ? null : t), 4000)
      } catch (err) {
        console.warn('[Spielbuch] Datei-Reload fehlgeschlagen:', err)
      }
    }
    window.electronAPI.onFileChanged(handler)
    return () => window.electronAPI.offFileChanged(handler)
  }, [watchedPaths])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Electron: In Excel öffnen (+ per-Mandant auto-copy) ───────────────────
  async function openInExcel(item, s) {
    // Effektive Anlage ermitteln: clientAnlage > item.anlage (aus Bibliothek oder direkt)
    const template = item.anlage
    const working  = s.clientAnlage

    // Wenn noch keine Mandantenkopie existiert und ein Template da ist → auto-copy
    if (!working && template?.data) {
      updateItem(item.id, {
        clientAnlage: {
          name:      template.name,
          mimeType:  template.mimeType,
          data:      template.data,
          size:      template.size,
          updatedAt: new Date().toISOString(),
        },
      })
    }
    const anlage = working ?? template
    if (!anlage?.data) return

    if (window.electronAPI) {
      try {
        const tmpPath = await window.electronAPI.saveAndOpen(anlage.name, anlage.data, anlage.mimeType)
        await window.electronAPI.watchFile(tmpPath)
        setWatchedPaths(prev => ({ ...prev, [item.id]: tmpPath }))
      } catch (err) {
        console.error('[Spielbuch] Electron-Open fehlgeschlagen:', err)
        openAnlage(anlage)  // Fallback
      }
    } else {
      openAnlage(anlage)   // Browser-Fallback
    }
  }

  // ── State helpers ──────────────────────────────────────────────────────────
  function getState(itemId) {
    const raw = clientChecklist[itemId]
    if (raw === undefined || Array.isArray(raw)) return { ...DEFAULT_STATE }
    if (typeof raw === 'object' && raw !== null) return { ...DEFAULT_STATE, ...raw }
    return { ...DEFAULT_STATE }
  }

  function updateItem(itemId, patch) {
    onUpdateCheckliste(selectedTypId, itemId, { ...getState(itemId), ...patch })
  }

  // ── Toggle section collapse ────────────────────────────────────────────────
  function toggleSection(sectionId) {
    setCollapsedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }

  // ── Extra items (per-client) ───────────────────────────────────────────────
  function saveExtras(newExtras) {
    onUpdateCheckliste(selectedTypId, '__extras', newExtras)
  }

  function duplicateItem(item) {
    const newId = genExtraId()
    saveExtras([...extraItems, {
      id:          newId,
      type:        item.type === 'section' ? 'item' : item.type,
      text:        item.text,
      description: item.description || '',
      anlage:      item.anlage || null,
      parentId:    item.id,
      source:      'duplicate',
    }])
  }

  function deleteExtraItem(extraId) {
    saveExtras(extraItems.filter(e => e.id !== extraId))
  }

  function updateExtraText(extraId, text) {
    saveExtras(extraItems.map(e => e.id === extraId ? { ...e, text } : e))
  }

  // ── Anfordern ──────────────────────────────────────────────────────────────
  function toggleAnfordern(item, checked) {
    if (checked) {
      const rqId = genRqId()
      const s    = getState(item.id)
      const text = s.rueckfrageText?.trim() || item.text
      onAddRueckfrageFromCheckliste(rqId, text, selectedTypId, item.id, selectedTyp.name)
      updateItem(item.id, { anfordern: true, rueckfrageId: rqId })
    } else {
      const s = getState(item.id)
      if (s.rueckfrageId) onDeleteRueckfrage(s.rueckfrageId)
      updateItem(item.id, { anfordern: false, rueckfrageId: null })
    }
  }

  function handleErledigt(item) {
    const s = getState(item.id)
    updateItem(item.id, { erledigt: true })
    if (s.rueckfrageId) {
      const rq = (client.rueckfragen ?? []).find(r => r.id === s.rueckfrageId)
      if (rq && !rq.beantwortet) onToggleRueckfrage(s.rueckfrageId, true)
    }
  }

  function handleRueckgaengig(item) {
    updateItem(item.id, { erledigt: false })
  }

  function getRqStatus(rueckfrageId) {
    if (!rueckfrageId) return null
    const rq = (client.rueckfragen ?? []).find(r => r.id === rueckfrageId)
    if (!rq) return 'missing'
    return rq.beantwortet ? 'done' : 'open'
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  function openUploadPicker(itemId) {
    setPendingUploadItemId(itemId)
    uploadRef.current?.click()
  }

  function handleClientAnlageUpload(e) {
    const file = e.target.files[0]
    if (!file || !pendingUploadItemId) { e.target.value = ''; setPendingUploadItemId(null); return }
    if (file.size > MAX_CLIENT_FILE_BYTES) {
      window.alert(`Datei zu groß (max. 5 MB). Gewählt: ${(file.size / (1024*1024)).toFixed(1)} MB`)
      e.target.value = ''; setPendingUploadItemId(null); return
    }
    const id = pendingUploadItemId
    const reader = new FileReader()
    reader.onload = ev => {
      updateItem(id, {
        clientAnlage: {
          name:      file.name,
          mimeType:  file.type || 'application/octet-stream',
          data:      ev.target.result.split(',')[1],
          size:      file.size,
          updatedAt: new Date().toISOString(),
        },
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
    setPendingUploadItemId(null)
  }

  function removeClientAnlage(itemId) {
    updateItem(itemId, { clientAnlage: null })
  }

  // ── Excel-Export ───────────────────────────────────────────────────────────
  function exportExcel() {
    if (!selectedTyp) return
    const rows = [['Nr.', 'Buchungskonto', 'Prüfpunkt', 'Notiz', 'Geprüft', 'Ja', 'Nein', 'N/R', 'Anfordern', 'Erledigt']]
    let nr = 0
    for (const raw of buildCombinedItems()) {
      const it = safeItem(raw)
      if (it.type === 'section') {
        rows.push([`── ${it.text} ──`, '', '', '', '', '', '', '', '', ''])
      } else {
        nr++
        const s = getState(it.id)
        rows.push([nr, s.kontonummer || '–', it.text, s.notiz || '–',
          s.geprueft ? '✓' : '', s.ja ? '✓' : '', s.nein ? '✓' : '',
          s.nicht_relevant ? '✓' : '', s.anfordern ? '✓' : '', s.erledigt ? '✓' : ''])
      }
    }
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch:5 },{ wch:14 },{ wch:40 },{ wch:28 },{ wch:8 },{ wch:6 },{ wch:6 },{ wch:6 },{ wch:10 },{ wch:9 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Checkliste')
    XLSX.writeFile(wb, `Checkliste_${client.name}_${selectedTyp.name}_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // ── Build combined items (template + per-client extras) ───────────────────
  const templateItems = (selectedTyp?.items ?? []).map(safeItem)

  function buildCombinedItems() {
    const result = []

    // Group SUSA extras by sectionId
    const susaBySec = {}
    for (const ex of extraItems) {
      if (ex.source === 'susa' && ex.sectionId) {
        ;(susaBySec[ex.sectionId] ??= []).push(ex)
      }
    }

    let currentSectionId = null

    for (const item of templateItems) {
      if (item.type === 'section') {
        // Before new section: flush SUSA extras of previous section
        if (currentSectionId) {
          for (const ex of (susaBySec[currentSectionId] ?? []))
            result.push({ ...safeItem(ex), isExtra: true })
        }
        result.push({ ...item, isExtra: false })
        currentSectionId = item.id
      } else {
        result.push({ ...item, isExtra: false })
        // Duplicate extras after this item
        for (const ex of extraItems.filter(e => e.parentId === item.id))
          result.push({ ...safeItem(ex), isExtra: true })
      }
    }

    // Flush last section's SUSA extras
    if (currentSectionId) {
      for (const ex of (susaBySec[currentSectionId] ?? []))
        result.push({ ...safeItem(ex), isExtra: true })
    }

    // Orphan extras (not yet placed)
    const placed = new Set(result.filter(r => r.isExtra).map(r => r.id))
    for (const ex of extraItems) {
      if (!placed.has(ex.id))
        result.push({ ...safeItem(ex), isExtra: true })
    }

    return result
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (checklistenTypen.length === 0) {
    return (
      <div className="tab-content">
        <div className="checklist-empty-state">
          <div className="checklist-empty-icon">✅</div>
          <div className="checklist-empty-title">Keine Checklisten-Typen vorhanden</div>
          <div className="checklist-empty-hint">
            Erstellen Sie zuerst einen Checklisten-Typ über den Button <strong>„Checklisten"</strong> im Header.
          </div>
        </div>
      </div>
    )
  }

  // ── Statistik ──────────────────────────────────────────────────────────────
  const allItems      = buildCombinedItems()
  const pureItems     = allItems.filter(it => it.type !== 'section')
  const erledigtCount = pureItems.filter(it => getState(it.id).erledigt).length
  const total         = pureItems.length
  const pct           = total > 0 ? Math.round((erledigtCount / total) * 100) : 0

  // ── Section-Metadaten für Header ───────────────────────────────────────────
  function getSectionMeta(sectionId) {
    let inSec = false
    let count = 0, done = 0
    for (const it of allItems) {
      if (it.type === 'section') { inSec = it.id === sectionId; continue }
      if (!inSec) continue
      count++
      if (getState(it.id).erledigt) done++
    }
    return { count, done }
  }

  // ── Sichtbare Zeilen ───────────────────────────────────────────────────────
  const filteredItems = showErledigt
    ? allItems
    : allItems.filter(it => it.type === 'section' || !getState(it.id).erledigt)

  let curSec = null
  const visibleRows = filteredItems.filter(item => {
    if (item.type === 'section') { curSec = item.id; return true }
    if (curSec && collapsedSections[curSec]) return false
    return true
  })

  // Laufende Nummerierung
  let itemNrCounter = 0
  let subNrCounter  = 0
  const numberedRows = visibleRows.map(item => {
    if (item.type === 'section') return { ...item, nr: null, subLabel: null }
    if (item.type === 'subitem') {
      subNrCounter++
      return { ...item, nr: null, subLabel: String.fromCharCode(96 + subNrCounter) }
    }
    itemNrCounter++
    subNrCounter = 0
    return { ...item, nr: itemNrCounter, subLabel: null }
  })

  // ── Cell renderers ─────────────────────────────────────────────────────────

  function renderKontoCell(item, s) {
    return (
      <td className="cl-td-konto">
        <input
          className="form-input cl-konto-input"
          placeholder="Konto …"
          value={s.kontonummer}
          onChange={e => updateItem(item.id, { kontonummer: e.target.value })}
        />
      </td>
    )
  }

  function autoResize(el) {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  function renderNotizCell(item, s) {
    return (
      <td className="cl-td-notiz">
        <textarea
          className="cl-notiz-input"
          placeholder="Notiz …"
          value={s.notiz}
          ref={autoResize}
          onChange={e => {
            updateItem(item.id, { notiz: e.target.value })
            autoResize(e.target)
          }}
        />
      </td>
    )
  }

  function renderTextCell(item, s, rqStatus) {
    const clientAnlage = s.clientAnlage ?? null
    return (
      <td className="cl-td-text">
        <div className="cl-item-title">
          {item.isExtra ? (
            <input
              className="form-input cl-extra-title-input"
              value={item.text}
              placeholder="Bezeichnung …"
              onChange={e => updateExtraText(item.id, e.target.value)}
            />
          ) : (
            item.text
          )}
          {item.source === 'susa' && (
            <span className="cl-badge cl-susa-badge" title="Importiert aus SUSA">SUSA</span>
          )}
          {item.source === 'duplicate' && (
            <span className="cl-badge cl-copy-badge" title="Kopie">⎘</span>
          )}
        </div>
        {item.description && !item.isExtra && (
          <div className="cl-item-description">{item.description}</div>
        )}
        {/* Rückfrage-Textfeld */}
        <div className="cl-rueckfrage-row">
          <input
            className="cl-rueckfrage-input"
            placeholder="💬 Rückfrage formulieren …"
            value={s.rueckfrageText ?? ''}
            onChange={e => updateItem(item.id, { rueckfrageText: e.target.value })}
            disabled={!!s.rueckfrageId}
          />
        </div>

        {rqStatus === 'open' && <span className="cl-rq-badge cl-rq-open">🔗 RQ offen</span>}
        {rqStatus === 'done' && <span className="cl-rq-badge cl-rq-done">🔗 RQ beantwortet</span>}

        {item.anlage && !clientAnlage && (
          <div className="cl-anlage-row" style={{ marginTop: '5px' }}>
            {item.anlage.vorlagenId
              ? <span style={{ fontSize: '10px', color: 'var(--accent)', flexShrink: 0 }}>📚 Vorlage:</span>
              : <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>Vorlage:</span>
            }
            <button className="cl-anlage-open-btn" onClick={() => openInExcel(item, s)}
              title={`Öffnen + Mandantenkopie erstellen: ${item.anlage.name}`}>
              📊 {item.anlage.name}
            </button>
          </div>
        )}

        <div className="cl-client-anlage-row">
          {clientAnlage ? (
            <>
              <button className="cl-anlage-open-btn cl-client-anlage-btn"
                onClick={() => openInExcel(item, s)} title={`In Excel öffnen: ${clientAnlage.name}`}>
                {watchedPaths[item.id] ? '👁 ' : '📊 '}{clientAnlage.name}
              </button>
              {toast?.itemId === item.id && (
                <span className="cl-excel-toast">{toast.msg}</span>
              )}
              <button className="btn btn-ghost btn-sm cl-anlage-icon-btn"
                onClick={() => openUploadPicker(item.id)} title="Manuell aktualisieren">📤</button>
              <button className="btn btn-ghost btn-sm cl-anlage-icon-btn"
                onClick={() => removeClientAnlage(item.id)} style={{ color: 'var(--red)' }}>✕</button>
              {clientAnlage.updatedAt && (
                <span className="cl-anlage-date">{fmtDate(clientAnlage.updatedAt)}</span>
              )}
            </>
          ) : (
            <>
              {!item.anlage && (
                <button className="btn btn-ghost btn-sm cl-anlage-add-btn"
                  onClick={() => openUploadPicker(item.id)} title="Anlage hochladen">
                  📤 Anlage
                </button>
              )}
            </>
          )}
        </div>
      </td>
    )
  }

  function renderCheckboxCells(item, s) {
    return (
      <>
        <td className="cl-td-check">
          <label className="cl-check-label">
            <input type="checkbox" className="cl-checkbox"
              checked={s.geprueft} onChange={e => updateItem(item.id, { geprueft: e.target.checked })} />
          </label>
        </td>
        <td className="cl-td-check">
          <label className="cl-check-label">
            <input type="checkbox" className="cl-checkbox cl-checkbox-green"
              checked={s.ja} onChange={e => updateItem(item.id, { ja: e.target.checked })} />
          </label>
        </td>
        <td className="cl-td-check">
          <label className="cl-check-label">
            <input type="checkbox" className="cl-checkbox cl-checkbox-red"
              checked={s.nein} onChange={e => updateItem(item.id, { nein: e.target.checked })} />
          </label>
        </td>
        <td className="cl-td-check">
          <label className="cl-check-label">
            <input type="checkbox" className="cl-checkbox cl-checkbox-muted"
              checked={s.nicht_relevant} onChange={e => updateItem(item.id, { nicht_relevant: e.target.checked })} />
          </label>
        </td>
        <td className="cl-td-check">
          <label className="cl-check-label" title="Als Rückfrage anfordern">
            <input type="checkbox" className="cl-checkbox cl-checkbox-orange"
              checked={s.anfordern} onChange={e => toggleAnfordern(item, e.target.checked)} />
          </label>
        </td>
      </>
    )
  }

  function renderErledigtCell(item, s) {
    return (
      <td className="cl-td-erledigt">
        {!s.erledigt ? (
          <button className="cl-erledigt-btn" onClick={() => handleErledigt(item)}>✓ Erledigt</button>
        ) : (
          <button className="btn btn-ghost btn-sm cl-rueck-btn" onClick={() => handleRueckgaengig(item)}>↩</button>
        )}
      </td>
    )
  }

  function renderActionsCell(item) {
    const s          = getState(item.id)
    const b          = s.berechnungen
    const rechCount  = (b?.kfz?.length ?? 0) + (b?.arbeitszimmer?.length ?? 0) + (b?.reisekosten?.length ?? 0)
    return (
      <td className="cl-td-actions">
        <button
          className={`cl-rechner-btn${rechCount > 0 ? ' cl-rechner-btn-active' : ''}`}
          onClick={() => setRechnerItemId(item.id)}
          title="Rechner öffnen"
        >
          🧮{rechCount > 0 && <span className="cl-rechner-count">{rechCount}</span>}
        </button>
        <button
          className="cl-duplicate-btn"
          onClick={() => duplicateItem(item)}
          title="Prüfpunkt duplizieren"
        >⎘</button>
        {item.isExtra && (
          <button
            className="cl-delete-extra-btn"
            onClick={() => deleteExtraItem(item.id)}
            title="Löschen"
          >🗑</button>
        )}
      </td>
    )
  }

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ── */}
      <div className="checklist-tab-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label className="checklist-tab-type-label">Typ:</label>
          <select className="form-select checklist-typ-select"
            value={selectedTypId ?? ''}
            onChange={e => setSelectedTypId(e.target.value)}>
            {checklistenTypen.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {erledigtCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowErledigt(s => !s)} style={{ fontSize: '12px' }}>
              {showErledigt ? '🙈 Erledigte ausblenden' : `👁 ${erledigtCount} erledigte einblenden`}
            </button>
          )}
        </div>

        <button className="btn btn-ghost btn-sm" onClick={exportExcel} title="Als Excel exportieren">
          📊 Excel-Export
        </button>
      </div>

      {/* ── Fortschrittsbalken ── */}
      {total > 0 && (
        <div className="checklist-progress-bar-wrap">
          <div className="checklist-progress-bar-bg">
            <div className="checklist-progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="checklist-progress-stats">
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓ {erledigtCount} Erledigt</span>
            <span style={{ color: 'var(--text-muted)' }}>{total - erledigtCount} ausstehend</span>
            <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--accent)' }}>{pct}%</span>
          </div>
        </div>
      )}

      {/* ── Leer-Meldungen ── */}
      {selectedTyp && allItems.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '24px 16px' }}>
          Dieser Checklisten-Typ hat noch keine Prüfpunkte.
        </div>
      )}
      {selectedTyp && total > 0 && erledigtCount === total && !showErledigt && (
        <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--green)', fontSize: '14px', fontWeight: 600 }}>
          🎉 Alle Prüfpunkte erledigt!
        </div>
      )}

      {/* ── Tabelle ── */}
      {selectedTyp && numberedRows.length > 0 && (
        <div className="checklist-table-wrap">
          <table className="checklist-table">
            <thead>
              <tr>
                <th className="cl-th-nr">#</th>
                <th className="cl-th-konto">Buchungskonto</th>
                <th className="cl-th-text">Prüfpunkt</th>
                <th className="cl-th-notiz">Notiz</th>
                <th className="cl-th-check">Geprüft</th>
                <th className="cl-th-check">Ja</th>
                <th className="cl-th-check">Nein</th>
                <th className="cl-th-check">N/R</th>
                <th className="cl-th-check cl-th-anfordern">Anfordern</th>
                <th className="cl-th-erledigt"></th>
                <th className="cl-th-actions"></th>
              </tr>
            </thead>
            <tbody>
              {numberedRows.map(item => {

                /* ── Abschnitt-Header ── */
                if (item.type === 'section') {
                  const isCollapsed = !!collapsedSections[item.id]
                  const meta        = getSectionMeta(item.id)
                  return (
                    <tr
                      key={item.id}
                      className="cl-section-row cl-section-row-clickable"
                      onClick={() => toggleSection(item.id)}
                    >
                      <td colSpan={11} className="cl-section-cell">
                        <span className="cl-section-chevron">{isCollapsed ? '▶' : '▼'}</span>
                        <span className="cl-section-icon">▐</span>
                        {item.text}
                        <span className="cl-section-meta">
                          {meta.count} Einträge
                          {meta.done > 0 && ` · ${meta.done} erledigt`}
                          {meta.count > 0 && meta.done === meta.count && ' ✓'}
                        </span>
                      </td>
                    </tr>
                  )
                }

                /* ── Unterprüfpunkt ── */
                if (item.type === 'subitem') {
                  const s        = getState(item.id)
                  const rqStatus = getRqStatus(s.rueckfrageId)
                  return (
                    <tr
                      key={item.id}
                      className={['checklist-table-row cl-subitem-row',
                        s.erledigt  ? 'cl-row-erledigt'  : '',
                        s.anfordern ? 'cl-row-anfordern' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <td className="cl-td-nr cl-subitem-nr">↳{item.subLabel}</td>
                      {renderKontoCell(item, s)}
                      {renderTextCell(item, s, rqStatus)}
                      {renderNotizCell(item, s)}
                      {renderCheckboxCells(item, s)}
                      {renderErledigtCell(item, s)}
                      {renderActionsCell(item)}
                    </tr>
                  )
                }

                /* ── Hauptprüfpunkt ── */
                const s        = getState(item.id)
                const rqStatus = getRqStatus(s.rueckfrageId)
                return (
                  <tr
                    key={item.id}
                    className={['checklist-table-row',
                      s.erledigt  ? 'cl-row-erledigt'  : '',
                      s.anfordern ? 'cl-row-anfordern' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <td className="cl-td-nr">{item.nr}</td>
                    {renderKontoCell(item, s)}
                    {renderTextCell(item, s, rqStatus)}
                    {renderNotizCell(item, s)}
                    {renderCheckboxCells(item, s)}
                    {renderErledigtCell(item, s)}
                    {renderActionsCell(item)}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Versteckter File-Picker ── */}
      <input ref={uploadRef} type="file" accept="*/*" style={{ display: 'none' }} onChange={handleClientAnlageUpload} />

      {/* ── Konto-Rechner Modal ── */}
      {rechnerItemId && (() => {
        const rechItem = allItems.find(it => it.id === rechnerItemId)
        if (!rechItem) { setRechnerItemId(null); return null }
        const rechState = getState(rechnerItemId)
        return (
          <KontoRechnerModal
            item={rechItem}
            state={rechState}
            client={client}
            onUpdateState={patch => updateItem(rechnerItemId, patch)}
            onClose={() => setRechnerItemId(null)}
          />
        )
      })()}
    </div>
  )
}
