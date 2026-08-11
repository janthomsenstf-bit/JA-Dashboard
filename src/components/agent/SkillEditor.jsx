import { useState } from 'react'
import { WAEHLBARE_WERKZEUGE } from '../../utils/agentTools.js'
import { genSkillId } from '../../utils/skillsStorage.js'

/**
 * SkillEditor – Modal zum Anlegen/Bearbeiten eines eigenen Skills.
 *
 * Ein Skill bündelt: Name, Symbol, Beschreibung, die Anweisung an den Agenten und
 * welche Werkzeuge er benutzen darf. Standard-Skills (builtin) lassen sich anpassen,
 * aber nicht löschen.
 */
export default function SkillEditor({ skill, onSave, onClose, onDelete }) {
  const istNeu = !skill
  const [name,         setName]         = useState(skill?.name ?? '')
  const [icon,         setIcon]         = useState(skill?.icon ?? '⭐')
  const [beschreibung, setBeschreibung] = useState(skill?.beschreibung ?? '')
  const [anweisung,    setAnweisung]    = useState(skill?.anweisung ?? '')
  const [werkzeuge,    setWerkzeuge]    = useState(skill?.werkzeuge ?? [])
  const [brauchtMandant, setBrauchtMandant] = useState(skill?.brauchtMandant ?? true)

  function toggleWerkzeug(n) {
    setWerkzeuge(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])
  }

  function speichern() {
    if (!name.trim() || !anweisung.trim()) return
    onSave({
      id: skill?.id ?? genSkillId(),
      builtin: skill?.builtin ?? false,
      name: name.trim(),
      icon: icon.trim() || '⭐',
      beschreibung: beschreibung.trim(),
      anweisung: anweisung.trim(),
      werkzeuge,
      brauchtMandant,
    })
  }

  const feld = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: '13px', color: 'var(--text)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', outline: 'none' }
  const label = { fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '5px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '8vh', overflowY: 'auto' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', width: 'min(560px, 94vw)', marginBottom: '40px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: '15px', color: 'var(--text)' }}>{istNeu ? 'Neuen Skill anlegen' : 'Skill bearbeiten'}</strong>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-muted)' }} aria-label="Schließen">×</button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ width: '64px' }}>
              <label style={label}>Symbol</label>
              <input value={icon} onChange={e => setIcon(e.target.value)} maxLength={2} style={{ ...feld, textAlign: 'center', fontSize: '18px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="z. B. Stand der Arbeiten" style={feld} />
            </div>
          </div>

          <div>
            <label style={label}>Kurzbeschreibung</label>
            <input value={beschreibung} onChange={e => setBeschreibung(e.target.value)} placeholder="Was macht dieser Skill? (eine Zeile)" style={feld} />
          </div>

          <div>
            <label style={label}>Anweisung an den Agenten</label>
            <textarea
              value={anweisung}
              onChange={e => setAnweisung(e.target.value)}
              rows={5}
              placeholder="Beschreibe in eigenen Worten, was der Agent tun soll. Beispiel: „Fasse den Stand der Arbeiten knapp zusammen und nenne offene Rückfragen.“"
              style={{ ...feld, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px' }}>
              Das ist der „Rahmen“ des Skills – wie wenn du einem Mitarbeiter den Auftrag erklärst.
            </div>
          </div>

          <div>
            <label style={label}>Welche Werkzeuge darf der Skill benutzen?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {WAEHLBARE_WERKZEUGE.map(w => (
                <label key={w.name} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px', color: 'var(--text)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={werkzeuge.includes(w.name)} onChange={() => toggleWerkzeug(w.name)} />
                  {w.label}
                </label>
              ))}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
              Nichts angehakt = der Agent darf alle Werkzeuge nutzen. „Mandant finden“ ist immer erlaubt.
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px', color: 'var(--text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={brauchtMandant} onChange={e => setBrauchtMandant(e.target.checked)} />
            Dieser Skill bezieht sich auf einen bestimmten Mandanten
          </label>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {!istNeu && !skill.builtin && (
              <button
                onClick={() => onDelete(skill.id)}
                style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer' }}
              >
                Löschen
              </button>
            )}
            {!istNeu && skill.builtin && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Standard-Skill – anpassbar, nicht löschbar</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '9px' }}>
            <button onClick={onClose} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', fontSize: '13px', cursor: 'pointer' }}>Abbrechen</button>
            <button
              onClick={speichern}
              disabled={!name.trim() || !anweisung.trim()}
              style={{ background: 'var(--accent)', border: '1px solid var(--accent)', color: '#fff', padding: '8px 18px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: (!name.trim() || !anweisung.trim()) ? 0.5 : 1 }}
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
