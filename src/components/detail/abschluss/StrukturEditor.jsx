import { useState } from 'react'
import { saveStruktur, resetStruktur, genBlockId, genPunktId, isSystemBlock } from '../../../utils/checklisteStruktur.js'
import { CHECKLISTE_BLOCKS } from '../../../utils/checklisteConfig.js'

const ICONS = ['🏢','💰','🔎','📦','🏗️','👥','🧾','🚗','⚠️','🔄','📈','📉','🏦','💱','🏭','🏛️','📋','🔬','💼','📊','🗂️','⭐','🔧','📌']

function inpStyle(extra = {}) {
  return { width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', ...extra }
}

// ── Block-Zeile ───────────────────────────────────────────────────────────────
function BlockRow({ block, idx, total, onEdit, onMove, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const isCustom = block.isCustom

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '6px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: expanded ? 'var(--surface2)' : 'var(--surface)' }}>
        <span style={{ fontSize: '16px', flexShrink: 0 }}>{block.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text)' }}>
            {block.nr}. {block.label}
            {isCustom && <span style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 6px', borderRadius: '6px', background: 'rgba(124,58,237,0.1)', color: '#7c3aed', fontWeight: 700 }}>BENUTZERDEFINIERT</span>}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
            {block.punkte?.length ?? 0} Prüfpunkte
            {block.hinweis && <span style={{ marginLeft: '8px' }}>· Hinweis vorhanden</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          <button onClick={() => onMove(idx, -1)} disabled={idx === 0}
            style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.3 : 0.7, fontSize: '12px', padding: '3px 5px' }} title="Nach oben">▲</button>
          <button onClick={() => onMove(idx, 1)} disabled={idx === total - 1}
            style={{ background: 'none', border: 'none', cursor: idx === total - 1 ? 'not-allowed' : 'pointer', opacity: idx === total - 1 ? 0.3 : 0.7, fontSize: '12px', padding: '3px 5px' }} title="Nach unten">▼</button>
          <button onClick={() => { onEdit(block); setExpanded(false) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)', padding: '3px 5px' }} title="Bearbeiten">✏️</button>
          <button onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--text-muted)', padding: '3px 5px' }}>
            {expanded ? '▲' : '▼'}
          </button>
          {isCustom && (
            <button onClick={() => onDelete(block.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#ef4444', opacity: 0.5, padding: '3px 5px' }}
              onMouseEnter={e => e.currentTarget.style.opacity='1'} onMouseLeave={e => e.currentTarget.style.opacity='0.5'}>🗑</button>
          )}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>PRÜFPUNKTE</div>
          {(block.punkte ?? []).map((p, pi) => (
            <div key={p.id} style={{ fontSize: '11px', padding: '3px 0', borderBottom: '1px solid var(--border)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)', minWidth: '20px' }}>{pi + 1}.</span>
              <span style={{ flex: 1 }}>{p.label}</span>
              {p.hinweis && <span title={p.hinweis} style={{ fontSize: '12px', cursor: 'help' }}>💡</span>}
              {p.isCustom && <span style={{ fontSize: '10px', color: '#7c3aed' }}>NEU</span>}
            </div>
          ))}
          <button onClick={() => onEdit(block)}
            style={{ marginTop: '8px', fontSize: '11px', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
            ✏️ Block & Prüfpunkte bearbeiten
          </button>
        </div>
      )}
    </div>
  )
}

// ── Block-Editor Modal ────────────────────────────────────────────────────────
function BlockEditor({ block, onSave, onClose }) {
  const [label,   setLabel]   = useState(block.label ?? '')
  const [icon,    setIcon]    = useState(block.icon ?? '📋')
  const [hinweis, setHinweis] = useState(block.hinweis ?? '')
  const [punkte,  setPunkte]  = useState(
    (block.punkte ?? []).map(p => ({ ...p, _hinweis: p.hinweis ?? '' }))
  )
  const [newPLabel, setNewPLabel] = useState('')
  const [newPHinweis, setNewPHinweis] = useState('')
  const [newPHasKonto, setNewPHasKonto] = useState(true)
  const [newPHasRisiko, setNewPHasRisiko] = useState(false)

  function addPunkt() {
    if (!newPLabel.trim()) return
    setPunkte(ps => [...ps, {
      id: genPunktId(), label: newPLabel.trim(),
      hinweis: newPHinweis.trim() || undefined,
      hasKonto: newPHasKonto, hasRisiko: newPHasRisiko, isCustom: true,
      _hinweis: newPHinweis.trim(),
    }])
    setNewPLabel(''); setNewPHinweis('')
  }

  function updPunkt(idx, changes) {
    setPunkte(ps => ps.map((p, i) => i === idx ? { ...p, ...changes } : p))
  }

  function movePunkt(idx, dir) {
    const ni = idx + dir
    if (ni < 0 || ni >= punkte.length) return
    const next = [...punkte]
    ;[next[idx], next[ni]] = [next[ni], next[idx]]
    setPunkte(next)
  }

  function delPunkt(idx) {
    setPunkte(ps => ps.filter((_, i) => i !== idx))
  }

  function save() {
    if (!label.trim()) return
    onSave({
      ...block,
      label: label.trim(),
      icon,
      hinweis: hinweis.trim() || undefined,
      punkte: punkte.map(p => ({
        id: p.id, label: p.label, hasKonto: p.hasKonto, hasRisiko: p.hasRisiko,
        isCustom: p.isCustom,
        ...(p._hinweis?.trim() ? { hinweis: p._hinweis.trim() } : {}),
      })),
    })
  }

  const btnPrimary = { padding: '7px 18px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }
  const btnSecondary = { padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', width: '100%', maxWidth: '640px', padding: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{block.isCustom ? '✏️ Block bearbeiten' : '✏️ Block anpassen'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Block properties */}
        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Icon</label>
            <select value={icon} onChange={e => setIcon(e.target.value)} style={{ ...inpStyle(), padding: '5px 4px', fontSize: '16px' }}>
              {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Block-Bezeichnung</label>
            <input value={label} onChange={e => setLabel(e.target.value)} style={inpStyle()} placeholder="Blockname…" />
          </div>
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>💡 Hinweis / Gedächtnisanker für diesen Block (optional)</label>
          <textarea value={hinweis} onChange={e => setHinweis(e.target.value)} rows={2}
            placeholder='z.B. "Typische Konten: 8400, 4200" oder "Bei GmbH auf vGA achten"…'
            style={{ ...inpStyle(), resize: 'vertical', lineHeight: 1.5 }} />
        </div>

        {/* Punkte list */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Prüfpunkte</div>
          <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '10px' }}>
            {punkte.map((p, idx) => (
              <div key={p.id} style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '5px', background: p.isCustom ? 'rgba(124,58,237,0.03)' : 'var(--surface2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: p._hinweis !== undefined ? '5px' : 0 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', minWidth: '18px' }}>{idx + 1}.</span>
                  <input value={p.label} onChange={e => updPunkt(idx, { label: e.target.value })}
                    style={{ ...inpStyle(), flex: 1, padding: '4px 8px', fontSize: '12px' }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
                    <input type="checkbox" checked={!!p.hasKonto} onChange={e => updPunkt(idx, { hasKonto: e.target.checked })} /> Konto
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>
                    <input type="checkbox" checked={!!p.hasRisiko} onChange={e => updPunkt(idx, { hasRisiko: e.target.checked })} /> Risiko
                  </label>
                  <button onClick={() => movePunkt(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: idx === 0 ? 0.3 : 0.7, fontSize: '11px', padding: '2px' }}>▲</button>
                  <button onClick={() => movePunkt(idx, 1)} disabled={idx === punkte.length - 1} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: idx === punkte.length - 1 ? 0.3 : 0.7, fontSize: '11px', padding: '2px' }}>▼</button>
                  <button onClick={() => delPunkt(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#ef4444', opacity: 0.5, padding: '2px' }}
                    onMouseEnter={e => e.currentTarget.style.opacity='1'} onMouseLeave={e => e.currentTarget.style.opacity='0.5'}>🗑</button>
                </div>
                <input value={p._hinweis ?? ''} onChange={e => updPunkt(idx, { _hinweis: e.target.value })}
                  placeholder="💡 Hinweis (optional, z.B. typische Konten, Prüfhinweis…)"
                  style={{ ...inpStyle(), padding: '3px 8px', fontSize: '11px', color: 'var(--text-muted)' }} />
              </div>
            ))}
          </div>

          {/* Add new Punkt */}
          <div style={{ padding: '10px', background: 'rgba(124,58,237,0.04)', borderRadius: '8px', border: '1px solid rgba(124,58,237,0.2)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', marginBottom: '7px' }}>+ Neuen Prüfpunkt hinzufügen</div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '5px' }}>
              <input value={newPLabel} onChange={e => setNewPLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPunkt()}
                placeholder="Bezeichnung des Prüfpunkts…" style={{ ...inpStyle(), flex: 1 }} />
              <button onClick={addPunkt} disabled={!newPLabel.trim()}
                style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#7c3aed', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: newPLabel.trim() ? 'pointer' : 'not-allowed', opacity: newPLabel.trim() ? 1 : 0.5, flexShrink: 0 }}>
                + Hinzu
              </button>
            </div>
            <input value={newPHinweis} onChange={e => setNewPHinweis(e.target.value)}
              placeholder="💡 Hinweis (optional)…" style={{ ...inpStyle(), marginBottom: '5px', fontSize: '11px' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
                <input type="checkbox" checked={newPHasKonto} onChange={e => setNewPHasKonto(e.target.checked)} /> Kontonummer-Feld
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
                <input type="checkbox" checked={newPHasRisiko} onChange={e => setNewPHasRisiko(e.target.checked)} /> Risikobewertung
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnSecondary}>Abbrechen</button>
          <button onClick={save} disabled={!label.trim()} style={{ ...btnPrimary, opacity: label.trim() ? 1 : 0.5 }}>✓ Speichern</button>
        </div>
      </div>
    </div>
  )
}

// ── Haupt-StrukturEditor ──────────────────────────────────────────────────────
export default function StrukturEditor({ struktur, onChange, onClose }) {
  const [editingBlock, setEditingBlock] = useState(null)
  const [showAddBlock, setShowAddBlock] = useState(false)
  const [newBlockLabel, setNewBlockLabel] = useState('')
  const [newBlockIcon, setNewBlockIcon] = useState('📋')

  function save(newStruktur) {
    saveStruktur(newStruktur)
    onChange(newStruktur)
  }

  function moveBlock(idx, dir) {
    const ni = idx + dir
    if (ni < 0 || ni >= struktur.length) return
    const next = [...struktur]
    ;[next[idx], next[ni]] = [next[ni], next[idx]]
    // Re-number
    save(next.map((b, i) => ({ ...b, nr: i + 1 })))
  }

  function deleteBlock(id) {
    if (!window.confirm('Block wirklich löschen? Bestehende Bearbeitungsdaten für diesen Block bleiben in den Mandantendaten erhalten.')) return
    save(struktur.filter(b => b.id !== id).map((b, i) => ({ ...b, nr: i + 1 })))
  }

  function saveBlock(updated) {
    save(struktur.map(b => b.id === updated.id ? updated : b))
    setEditingBlock(null)
  }

  function addBlock() {
    if (!newBlockLabel.trim()) return
    const newBlock = {
      id: genBlockId(),
      nr: struktur.length + 1,
      label: newBlockLabel.trim(),
      icon: newBlockIcon,
      isCustom: true,
      visibleFor: null,
      punkte: [],
    }
    save([...struktur, newBlock])
    setNewBlockLabel(''); setShowAddBlock(false)
  }

  function handleReset() {
    if (!window.confirm('Struktur auf Standardwerte zurücksetzen? Alle eigenen Anpassungen gehen verloren.')) return
    resetStruktur()
    onChange(null)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', width: '100%', maxWidth: '720px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>⚙️ Checklisten-Struktur bearbeiten</h2>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Blöcke und Prüfpunkte global anpassen · gilt für alle Mandanten</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {/* Block list */}
          {struktur.map((block, idx) => (
            <BlockRow key={block.id} block={block} idx={idx} total={struktur.length}
              onEdit={setEditingBlock} onMove={moveBlock} onDelete={deleteBlock} />
          ))}

          {/* Add block */}
          {!showAddBlock ? (
            <button onClick={() => setShowAddBlock(true)}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px dashed rgba(124,58,237,0.3)', background: 'transparent', color: '#7c3aed', fontSize: '12px', fontWeight: 700, cursor: 'pointer', marginTop: '6px' }}>
              + Neuen Block hinzufügen
            </button>
          ) : (
            <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.04)', marginTop: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', marginBottom: '8px' }}>NEUER BLOCK</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                <select value={newBlockIcon} onChange={e => setNewBlockIcon(e.target.value)}
                  style={{ padding: '6px 4px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '16px', width: '60px' }}>
                  {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <input value={newBlockLabel} onChange={e => setNewBlockLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBlock()}
                  placeholder="Blockbezeichnung…" style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }} />
              </div>
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowAddBlock(false); setNewBlockLabel('') }}
                  style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>Abbrechen</button>
                <button onClick={addBlock} disabled={!newBlockLabel.trim()}
                  style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: '#7c3aed', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: newBlockLabel.trim() ? 'pointer' : 'not-allowed', opacity: newBlockLabel.trim() ? 1 : 0.5 }}>
                  + Block erstellen
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleReset}
            style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.3)', background: 'transparent', color: '#dc2626', fontSize: '12px', cursor: 'pointer' }}>
            🔄 Auf Standard zurücksetzen
          </button>
          <button onClick={onClose}
            style={{ marginLeft: 'auto', padding: '7px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            ✓ Fertig
          </button>
        </div>
      </div>

      {/* Block-Editor */}
      {editingBlock && (
        <BlockEditor block={editingBlock} onSave={saveBlock} onClose={() => setEditingBlock(null)} />
      )}
    </div>
  )
}
