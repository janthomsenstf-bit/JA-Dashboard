import { useState } from 'react'

const ART_CONFIG = {
  online:     { label: 'Online-Termin', icon: '💻' },
  frist:      { label: 'Frist / FA',    icon: '⚠️' },
  erinnerung: { label: 'Erinnerung',    icon: '📝' },
  versenden:  { label: 'JA versenden',  icon: '📬' },
}

export default function TerminModal({ termin, clients, prefillMandantId, onSave, onClose }) {
  const [form, setForm] = useState({
    art:          termin?.art          ?? 'erinnerung',
    mandantId:    termin?.mandantId    ?? prefillMandantId ?? '',
    datum:        termin?.datum        ?? '',
    uhrzeit:      termin?.uhrzeit      ?? '',
    beschreibung: termin?.beschreibung ?? '',
  })
  const [error, setError] = useState('')

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    if (field === 'datum') setError('')
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.datum) { setError('Bitte ein Datum angeben.'); return }
    onSave(form)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '480px' }}>
        <div className="modal-title">{termin ? '✏️ Termin bearbeiten' : '＋ Neuer Termin'}</div>
        <form onSubmit={handleSubmit}>
          <div className="termin-modal-grid">
            {/* Terminart */}
            <div className="modal-field">
              <label>Terminart</label>
              <select value={form.art} onChange={e => set('art', e.target.value)}>
                {Object.entries(ART_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                ))}
              </select>
            </div>

            {/* Mandant */}
            <div className="modal-field">
              <label>Mandant (optional)</label>
              <select value={form.mandantId} onChange={e => set('mandantId', e.target.value)}>
                <option value="">– kein Mandant –</option>
                {(clients ?? []).filter(c => !c.archiviert).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Datum */}
            <div className="modal-field">
              <label>Datum <span className="required">*</span></label>
              <input
                type="date"
                value={form.datum}
                onChange={e => set('datum', e.target.value)}
                style={error ? { borderColor: 'var(--red)' } : {}}
              />
              {error && <span style={{ fontSize: '11px', color: 'var(--red)' }}>{error}</span>}
            </div>

            {/* Uhrzeit */}
            <div className="modal-field">
              <label>Uhrzeit (optional)</label>
              <input
                type="time"
                value={form.uhrzeit}
                onChange={e => set('uhrzeit', e.target.value)}
              />
            </div>
          </div>

          {/* Beschreibung */}
          <div className="modal-field" style={{ marginTop: '12px' }}>
            <label>Beschreibung</label>
            <textarea
              rows={3}
              value={form.beschreibung}
              onChange={e => set('beschreibung', e.target.value)}
              placeholder="Kurze Beschreibung des Termins…"
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Abbrechen</button>
            <button type="submit" className="btn btn-primary">Speichern</button>
          </div>
        </form>
      </div>
    </div>
  )
}
