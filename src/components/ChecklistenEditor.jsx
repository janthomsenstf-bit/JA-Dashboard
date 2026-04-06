import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { genChecklistenId } from '../utils/checklistenStorage.js'
import VorlagenPickerModal from './VorlagenPickerModal.jsx'

const MAX_FILE_BYTES = 3 * 1024 * 1024 // 3 MB

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// type: 'section' | 'item' | 'subitem'
function safeItem(it) {
  return { type: 'item', description: '', anlage: null, ...it }
}

export default function ChecklistenEditor({ typen, onSave, onClose, vorlagen = [], onUpdateVorlagen }) {
  const [localTypen, setLocalTypen]         = useState(typen)
  const [selectedId, setSelectedId]         = useState(typen[0]?.id ?? null)
  const [newText, setNewText]               = useState('')
  const [editingTypId, setEditingTypId]     = useState(null)
  const [editingTypName, setEditingTypName] = useState('')
  const [newlyAddedId, setNewlyAddedId]     = useState(null)
  const [showVorlagenPicker, setShowVorlagenPicker] = useState(false)
  const [pendingPickId, setPendingPickId]   = useState(null)

  const itemInputRefs  = useRef({})
  const attachFileRef  = useRef(null)
  const [pendingAttachId, setPendingAttachId] = useState(null)

  const selectedTyp = localTypen.find(t => t.id === selectedId) ?? null
  const safeItems   = (selectedTyp?.items ?? []).map(safeItem)

  // ── Auto-Focus neu eingefügte Items ─────────────────────────────────────
  useEffect(() => {
    if (!newlyAddedId) return
    const el = itemInputRefs.current[newlyAddedId]
    if (el) {
      el.focus()
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    setNewlyAddedId(null)
  }, [newlyAddedId])

  // ── Typ-Verwaltung ───────────────────────────────────────────────────────
  function addTyp() {
    const name = newText.trim()
    if (!name) return
    const newTyp = { id: genChecklistenId('ct'), name, items: [] }
    setLocalTypen(prev => [...prev, newTyp])
    setSelectedId(newTyp.id)
    setNewText('')
  }

  function deleteTyp(id) {
    if (!window.confirm('Checklisten-Typ wirklich löschen?')) return
    const updated = localTypen.filter(t => t.id !== id)
    setLocalTypen(updated)
    setSelectedId(updated[0]?.id ?? null)
  }

  function commitRenameTyp(id) {
    const name = editingTypName.trim()
    if (name) setLocalTypen(prev => prev.map(t => t.id === id ? { ...t, name } : t))
    setEditingTypId(null)
    setEditingTypName('')
  }

  // ── Einträge hinzufügen ──────────────────────────────────────────────────

  // Am Ende der Liste (für den unteren Eingabebereich)
  function addItem(type) {
    const text = newText.trim()
    if (!text || !selectedId) return
    const newItem = { id: genChecklistenId(type === 'section' ? 'cs' : 'ci'), type, text, description: '' }
    setLocalTypen(prev => prev.map(t => {
      if (t.id !== selectedId) return t
      return { ...t, items: [...t.items, newItem] }
    }))
    setNewText('')
    if (type !== 'section') setNewlyAddedId(newItem.id)
  }

  // Direkt am Ende eines Abschnitts einfügen (vom Abschnitts-+-Button)
  function addItemInSection(typId, sectionIdx) {
    const newItem = { id: genChecklistenId('ci'), type: 'item', text: '', description: '' }
    setLocalTypen(prev => prev.map(t => {
      if (t.id !== typId) return t
      const items = [...t.items]
      let insertIdx = sectionIdx + 1
      while (insertIdx < items.length && safeItem(items[insertIdx]).type !== 'section') insertIdx++
      items.splice(insertIdx, 0, newItem)
      return { ...t, items }
    }))
    setNewlyAddedId(newItem.id)
  }

  // Unterprüfpunkt direkt nach einem Hauptprüfpunkt + dessen Unterprüfpunkte
  function addSubItemAfterItem(typId, parentIdx) {
    const newItem = { id: genChecklistenId('csi'), type: 'subitem', text: '', description: '' }
    setLocalTypen(prev => prev.map(t => {
      if (t.id !== typId) return t
      const items = [...t.items]
      let insertIdx = parentIdx + 1
      // Überspringt bestehende Unterprüfpunkte dieses Items
      while (insertIdx < items.length && safeItem(items[insertIdx]).type === 'subitem') insertIdx++
      items.splice(insertIdx, 0, newItem)
      return { ...t, items }
    }))
    setNewlyAddedId(newItem.id)
  }

  // ── Item-Felder bearbeiten ───────────────────────────────────────────────
  function updateItemField(typId, itemId, field, value) {
    setLocalTypen(prev => prev.map(t => {
      if (t.id !== typId) return t
      return { ...t, items: t.items.map(it => it.id === itemId ? { ...safeItem(it), [field]: value } : it) }
    }))
  }

  function deleteItem(typId, itemId) {
    setLocalTypen(prev => prev.map(t => {
      if (t.id !== typId) return t
      return { ...t, items: t.items.filter(it => it.id !== itemId) }
    }))
  }

  function moveItem(typId, itemId, dir) {
    setLocalTypen(prev => prev.map(t => {
      if (t.id !== typId) return t
      const items  = [...t.items]
      const idx    = items.findIndex(it => it.id === itemId)
      if (idx < 0) return t
      const newIdx = dir === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= items.length) return t
      ;[items[idx], items[newIdx]] = [items[newIdx], items[idx]]
      return { ...t, items }
    }))
  }

  // Laufende Nummer nur für Hauptprüfpunkte (type='item')
  function getItemNr(items, targetId) {
    let count = 0
    for (const it of items) {
      if (safeItem(it).type === 'item') count++
      if (it.id === targetId) return count
    }
    return count
  }

  // Unterprüfpunkt-Buchstabe (a, b, c …) – relativ zum letzten Hauptprüfpunkt
  function getSubNr(items, targetId) {
    let count = 0
    for (const it of items) {
      const t = safeItem(it).type
      if (t === 'item') count = 0          // Reset beim nächsten Hauptpunkt
      if (t === 'subitem') count++
      if (it.id === targetId) return String.fromCharCode(96 + count) // a, b, c…
    }
    return '–'
  }

  // ── Datei-Anhang ─────────────────────────────────────────────────────────

  function openFilePicker(itemId) {
    setPendingAttachId(itemId)
    attachFileRef.current?.click()
  }

  function handleFileChosen(e) {
    const file = e.target.files[0]
    if (!file || !pendingAttachId) { e.target.value = ''; setPendingAttachId(null); return }
    if (file.size > MAX_FILE_BYTES) {
      window.alert(`Datei zu groß (max. ${formatSize(MAX_FILE_BYTES)}). Gewählt: ${formatSize(file.size)}`)
      e.target.value = ''; setPendingAttachId(null); return
    }
    const id = pendingAttachId
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target.result
      const data    = dataUrl.split(',')[1]   // nur base64
      updateItemField(selectedId, id, 'anlage', {
        name:     file.name,
        mimeType: file.type || 'application/octet-stream',
        data,
        size:     file.size,
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
    setPendingAttachId(null)
  }

  function createBlankExcel(typId, itemId, itemText) {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['Bezeichnung', 'Betrag'],
      ['', ''],
      ['', ''],
      ['', ''],
      ['', ''],
      ['Gesamt', ''],
    ])
    ws['!cols'] = [{ wch: 26 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Anlage')
    const b64      = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' })
    const safeName = (itemText || 'Anlage').slice(0, 30).replace(/[<>:"/\\|?*]/g, '').trim()
    const size     = Math.round(b64.length * 0.75)
    updateItemField(typId, itemId, 'anlage', {
      name:     `${safeName || 'Anlage'}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data:     b64,
      size,
    })
  }

  function removeAnlage(typId, itemId) {
    updateItemField(typId, itemId, 'anlage', null)
  }

  // Anlage herunterladen (öffnet sich im Standard-Programm, z. B. Excel)
  function downloadAnlage(anlage) {
    const bytes = atob(anlage.data)
    const arr   = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    const blob = new Blob([arr], { type: anlage.mimeType || 'application/octet-stream' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = anlage.name
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 100)
  }

  // ── Vorlage aus Bibliothek verknüpfen ──────────────────────────────────────
  function handleVorlagenSelect(vorlage) {
    if (!pendingPickId) return
    updateItemField(selectedId, pendingPickId, 'anlage', {
      vorlagenId: vorlage.id,
      name:       vorlage.name,
      mimeType:   vorlage.mimeType,
      data:       vorlage.data,
      size:       vorlage.size,
    })
    setShowVorlagenPicker(false)
    setPendingPickId(null)
  }

  // Beim Speichern leere Einträge entfernen
  function handleSave() {
    const cleaned = localTypen.map(t => ({
      ...t,
      items: t.items.filter(it => safeItem(it).text.trim() !== ''),
    }))
    onSave(cleaned)
    onClose()
  }

  return (
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box checklist-editor-modal" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>✅ Checklisten-Typen verwalten</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="checklist-editor-body">

          {/* ── Left: Typ-Liste ── */}
          <div className="checklist-editor-sidebar">
            <div className="checklist-editor-sidebar-title">Checklisten-Typen</div>

            {localTypen.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 4px' }}>
                Noch keine Typen. Unten einen anlegen.
              </div>
            )}

            {localTypen.map(typ => (
              <div
                key={typ.id}
                className={`checklist-type-item${selectedId === typ.id ? ' selected' : ''}`}
                onClick={() => setSelectedId(typ.id)}
              >
                {editingTypId === typ.id ? (
                  <form
                    onSubmit={e => { e.preventDefault(); commitRenameTyp(typ.id) }}
                    style={{ display: 'flex', gap: '4px', flex: 1 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <input className="form-input" value={editingTypName}
                      onChange={e => setEditingTypName(e.target.value)} autoFocus
                      style={{ fontSize: '12px', padding: '2px 6px', flex: 1 }} />
                    <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '2px 7px' }}>✓</button>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 7px' }}
                      onClick={() => { setEditingTypId(null); setEditingTypName('') }}>✕</button>
                  </form>
                ) : (
                  <>
                    <span className="checklist-type-name">{typ.name}</span>
                    <span className="checklist-type-count">
                      {typ.items.filter(it => safeItem(it).type === 'item').length}&nbsp;P.
                    </span>
                    <button className="btn btn-ghost btn-sm checklist-type-action"
                      onClick={e => { e.stopPropagation(); setEditingTypId(typ.id); setEditingTypName(typ.name) }}
                      title="Umbenennen">✏</button>
                    <button className="btn btn-ghost btn-sm checklist-type-action"
                      style={{ color: 'var(--red)' }}
                      onClick={e => { e.stopPropagation(); deleteTyp(typ.id) }}
                      title="Löschen">🗑</button>
                  </>
                )}
              </div>
            ))}

            <div className="checklist-new-type-row">
              <input className="form-input" placeholder="Neuer Typ …"
                value={editingTypId ? '' : newText}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTyp()}
                style={{ fontSize: '12px', flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={addTyp}>+</button>
            </div>
          </div>

          {/* ── Right: Einträge ── */}
          <div className="checklist-editor-items">
            {selectedTyp ? (
              <>
                <div className="checklist-editor-items-title">
                  Inhalt – <strong>{selectedTyp.name}</strong>
                  <span className="checklist-editor-items-count">
                    {safeItems.filter(it => it.type === 'item').length} Prüfpunkte
                    {safeItems.some(it => it.type === 'subitem') &&
                      `, ${safeItems.filter(it => it.type === 'subitem').length} Unterprüfpunkte`}
                    {safeItems.some(it => it.type === 'section') &&
                      `, ${safeItems.filter(it => it.type === 'section').length} Abschnitte`}
                  </span>
                </div>

                {safeItems.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px 0' }}>
                    Noch leer. Unten Prüfpunkte oder Abschnitte hinzufügen.
                  </div>
                )}

                <div className="checklist-items-list">
                  {safeItems.map((item, idx) => {
                    const isLast = idx === safeItems.length - 1

                    /* ── Abschnitt ── */
                    if (item.type === 'section') {
                      return (
                        <div key={item.id} className="checklist-item-row cl-editor-section-row">
                          <span className="cl-editor-section-icon" title="Abschnitt">§</span>
                          <input className="form-input cl-editor-section-input"
                            value={item.text}
                            onChange={e => updateItemField(selectedTyp.id, item.id, 'text', e.target.value)}
                            placeholder="Abschnitts-Überschrift …" />
                          <button className="btn cl-section-add-btn"
                            onClick={() => addItemInSection(selectedTyp.id, idx)}
                            title="Prüfpunkt in diesem Abschnitt einfügen">+</button>
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => moveItem(selectedTyp.id, item.id, 'up')}
                            disabled={idx === 0} style={{ opacity: idx === 0 ? 0.3 : 1 }} title="Nach oben">▲</button>
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => moveItem(selectedTyp.id, item.id, 'down')}
                            disabled={isLast} style={{ opacity: isLast ? 0.3 : 1 }} title="Nach unten">▼</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                            onClick={() => deleteItem(selectedTyp.id, item.id)} title="Löschen">🗑</button>
                        </div>
                      )
                    }

                    /* ── Unterprüfpunkt ── */
                    if (item.type === 'subitem') {
                      return (
                        <div key={item.id} className="checklist-item-row cl-editor-subitem-row">
                          <span className="cl-editor-subitem-indent" title="Unterprüfpunkt">↳</span>
                          <div className="cl-editor-item-fields">
                            <input
                              ref={el => { itemInputRefs.current[item.id] = el }}
                              className="form-input"
                              value={item.text}
                              onChange={e => updateItemField(selectedTyp.id, item.id, 'text', e.target.value)}
                              placeholder="Unterprüfpunkt …"
                              style={{ fontSize: '12px' }} />
                            <input className="form-input cl-editor-desc-input"
                              value={item.description}
                              onChange={e => updateItemField(selectedTyp.id, item.id, 'description', e.target.value)}
                              placeholder="Erläuterung (optional) …" />
                            <div className="cl-anlage-row">
                              {item.anlage ? (
                                <>
                                  <span className="cl-anlage-chip" title={formatSize(item.anlage.size)}>
                                    {item.anlage.vorlagenId ? '📚' : '📎'} {item.anlage.name}
                                  </span>
                                  <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}
                                    onClick={() => downloadAnlage(item.anlage)} title="Herunterladen">📥</button>
                                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', fontSize: '11px' }}
                                    onClick={() => removeAnlage(selectedTyp.id, item.id)} title="Anlage entfernen">✕</button>
                                </>
                              ) : (
                                <>
                                  <button className="btn btn-ghost btn-sm cl-anlage-add-btn"
                                    onClick={() => openFilePicker(item.id)}>📎 Datei</button>
                                  <button className="btn btn-ghost btn-sm cl-anlage-add-btn"
                                    onClick={() => createBlankExcel(selectedTyp.id, item.id, item.text)}>📊 Excel-Vorlage</button>
                                  <button className="btn btn-ghost btn-sm cl-anlage-add-btn cl-anlage-lib-btn"
                                    onClick={() => { setPendingPickId(item.id); setShowVorlagenPicker(true) }}>📚 Bibliothek</button>
                                </>
                              )}
                            </div>
                          </div>
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => moveItem(selectedTyp.id, item.id, 'up')}
                            disabled={idx === 0} style={{ opacity: idx === 0 ? 0.3 : 1 }} title="Nach oben">▲</button>
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => moveItem(selectedTyp.id, item.id, 'down')}
                            disabled={isLast} style={{ opacity: isLast ? 0.3 : 1 }} title="Nach unten">▼</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                            onClick={() => deleteItem(selectedTyp.id, item.id)} title="Löschen">🗑</button>
                        </div>
                      )
                    }

                    /* ── Hauptprüfpunkt ── */
                    return (
                      <div key={item.id} className="checklist-item-row cl-editor-item-row">
                        <span className="checklist-item-nr">{getItemNr(selectedTyp.items, item.id)}.</span>
                        <div className="cl-editor-item-fields">
                          <input
                            ref={el => { itemInputRefs.current[item.id] = el }}
                            className="form-input"
                            value={item.text}
                            onChange={e => updateItemField(selectedTyp.id, item.id, 'text', e.target.value)}
                            placeholder="Prüfpunkt-Titel …"
                            style={{ fontSize: '13px' }} />
                          <input className="form-input cl-editor-desc-input"
                            value={item.description}
                            onChange={e => updateItemField(selectedTyp.id, item.id, 'description', e.target.value)}
                            placeholder="Erläuterung / Beschreibung (optional) …" />
                          <div className="cl-anlage-row">
                            {item.anlage ? (
                              <>
                                <span className="cl-anlage-chip" title={formatSize(item.anlage.size)}>
                                  📎 {item.anlage.name}
                                </span>
                                <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}
                                  onClick={() => downloadAnlage(item.anlage)} title="Herunterladen">📥</button>
                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', fontSize: '11px' }}
                                  onClick={() => removeAnlage(selectedTyp.id, item.id)} title="Anlage entfernen">✕</button>
                              </>
                            ) : (
                              <>
                                <button className="btn btn-ghost btn-sm cl-anlage-add-btn"
                                  onClick={() => openFilePicker(item.id)}>📎 Datei</button>
                                <button className="btn btn-ghost btn-sm cl-anlage-add-btn"
                                  onClick={() => createBlankExcel(selectedTyp.id, item.id, item.text)}>📊 Excel-Vorlage</button>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Unterprüfpunkt direkt unter diesem Item einfügen */}
                        <button className="btn cl-subitem-add-btn"
                          onClick={() => addSubItemAfterItem(selectedTyp.id, idx)}
                          title="Unterprüfpunkt hier einfügen">↳+</button>
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => moveItem(selectedTyp.id, item.id, 'up')}
                          disabled={idx === 0} style={{ opacity: idx === 0 ? 0.3 : 1 }} title="Nach oben">▲</button>
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => moveItem(selectedTyp.id, item.id, 'down')}
                          disabled={isLast} style={{ opacity: isLast ? 0.3 : 1 }} title="Nach unten">▼</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                          onClick={() => deleteItem(selectedTyp.id, item.id)} title="Löschen">🗑</button>
                      </div>
                    )
                  })}
                </div>

                {/* ── Neue Zeile am Ende ── */}
                <div className="checklist-new-item-row">
                  <input className="form-input" placeholder="Text eingeben …"
                    value={newText} onChange={e => setNewText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addItem('item')}
                    style={{ flex: 1, fontSize: '13px' }} />
                  <button className="btn btn-primary btn-sm" onClick={() => addItem('item')}
                    title="Prüfpunkt am Ende hinzufügen">+ Prüfpunkt</button>
                  <button className="btn btn-ghost btn-sm cl-add-section-btn" onClick={() => addItem('section')}
                    title="Abschnitt am Ende hinzufügen">§ Abschnitt</button>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  <strong>+</strong> neben Abschnitt = Prüfpunkt darin einfügen &nbsp;·&nbsp;
                  <strong>↳+</strong> neben Prüfpunkt = Unterprüfpunkt darunter einfügen &nbsp;·&nbsp;
                  📎 Anlage max. {formatSize(MAX_FILE_BYTES)}
                </div>

                {/* Versteckter File-Picker für Anhänge */}
                <input
                  ref={attachFileRef}
                  type="file"
                  accept="*/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChosen}
                />
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '24px 0' }}>
                Wählen Sie links einen Checklisten-Typ aus oder erstellen Sie einen neuen.
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Abbrechen</button>
          <button className="btn btn-primary" onClick={handleSave}>✓ Speichern & Schließen</button>
        </div>
      </div>
    </div>

    {/* ── Vorlagen-Picker ── */}
    {showVorlagenPicker && (
      <VorlagenPickerModal
        vorlagen={vorlagen}
        onSelect={handleVorlagenSelect}
        onUpdateVorlagen={onUpdateVorlagen ?? (() => {})}
        onClose={() => { setShowVorlagenPicker(false); setPendingPickId(null) }}
        title="📚 Vorlage für Prüfpunkt auswählen"
      />
    )}
    </>
  )
}
