import { useState } from 'react'

const MONAT_NAMEN = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember',
]

const RECHTSFORMEN = [
  'GmbH', 'AG', 'KG', 'OHG', 'GbR',
  'Einzelunternehmen', 'Freiberufler', 'GmbH & Co. KG',
]

const ZUSATZ_ARTEN = [
  'Jahresabschluss', 'Steuererklärung', 'Nacharbeit', 'Sonderaufgabe', 'Sonstiges',
]

const CURRENT_YEAR = new Date().getFullYear()

function genZusatzId() {
  return 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

const EMPTY_ZUSATZ = { bezeichnung: '', art: 'Sonstiges', betroffJahr: '', anzeigeJahr: CURRENT_YEAR - 1, monat: 1, notiz: '' }

export default function NewClientModal({ onClose, onSubmit, initialData = null, editMode = false, nummernVorschlag = null, herkunft = '' }) {
  const [form, setForm] = useState(initialData ? {
    mandantennummer:    initialData.mandantennummer    ?? '',
    mandantennummer2:   initialData.mandantennummer2   ?? '',
    mandantennummer3:   initialData.mandantennummer3   ?? '',
    name:               initialData.name               ?? '',
    veranlagungsjahr:   initialData.veranlagungsjahr   ?? '',
    veranlagungsjahr2:  initialData.veranlagungsjahr2  ?? '',
    veranlagungsjahr3:  initialData.veranlagungsjahr3  ?? '',
    rechtsform:         initialData.rechtsform         ?? 'GmbH',
    gewinnermittlung:   initialData.gewinnermittlung   ?? 'Bilanz',
    unternehmensgegenstand: initialData.unternehmensgegenstand ?? '',
    zusatzaufgaben:     Array.isArray(initialData.zusatzaufgaben) ? initialData.zusatzaufgaben : [],
    kontaktEmail:       initialData.kontaktEmail       ?? '',
  } : {
    mandantennummer:   '',
    mandantennummer2:  '',
    mandantennummer3:  '',
    name:              '',
    veranlagungsjahr:  '',
    veranlagungsjahr2: '',
    veranlagungsjahr3: '',
    rechtsform:        'GmbH',
    gewinnermittlung:  'Bilanz',
    unternehmensgegenstand: '',
    zusatzaufgaben:    [],
    kontaktEmail:      initialData?.kontaktEmail ?? '',
  })
  const [errors, setErrors] = useState({})
  const [newZusatz, setNewZusatz] = useState({ ...EMPTY_ZUSATZ })
  const [showAddZusatz, setShowAddZusatz] = useState(false)

  function setNZ(field, value) {
    setNewZusatz(z => ({ ...z, [field]: value }))
  }

  function addZusatz() {
    if (!newZusatz.bezeichnung.trim() || !newZusatz.monat || !newZusatz.anzeigeJahr) return
    const entry = { ...newZusatz, id: genZusatzId(), monat: parseInt(newZusatz.monat, 10), anzeigeJahr: parseInt(newZusatz.anzeigeJahr, 10) }
    set('zusatzaufgaben', [...form.zusatzaufgaben, entry])
    setNewZusatz({ ...EMPTY_ZUSATZ })
    setShowAddZusatz(false)
  }

  function removeZusatz(id) {
    set('zusatzaufgaben', form.zusatzaufgaben.filter(z => z.id !== id))
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.mandantennummer.trim()) e.mandantennummer = 'Pflichtfeld'
    if (!form.name.trim())            e.name = 'Pflichtfeld'
    return e
  }

  function handleSubmit(ev) {
    ev.preventDefault()
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    const { kontaktEmail, ...rest } = form
    onSubmit({
      ...rest,
      // Beim Anlegen: erkannte Mail-Adresse gleich als Kontakt hinterlegen –
      // dadurch ordnet der Auto-Abgleich künftige Mails dieses Absenders zu.
      ...(!editMode && kontaktEmail.trim()
        ? { kontakte: [{ id: 'p' + Date.now().toString(36), name: '', rolle: '', email: kontaktEmail.trim(), telefon: '' }] }
        : {}),
      veranlagungsjahr:  form.veranlagungsjahr ? Number(form.veranlagungsjahr) : '',
      veranlagungsjahr2: form.veranlagungsjahr2 ? Number(form.veranlagungsjahr2) : '',
      veranlagungsjahr3: form.veranlagungsjahr3 ? Number(form.veranlagungsjahr3) : '',
    })
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{editMode ? '✏️ Mandant bearbeiten' : '+ Neuer Fall anlegen'}</div>
        {!editMode && herkunft && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '-4px 0 12px', lineHeight: 1.5 }}>
            {herkunft}
          </div>
        )}
        <form onSubmit={handleSubmit}>

          {/* Mandantennummern – bis zu 3 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
              Mandantennummer(n) <span className="required">*</span>
            </label>
            {!editMode && nummernVorschlag?.vorschlag && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '7px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => set('mandantennummer', nummernVorschlag.vorschlag)}
                  disabled={form.mandantennummer === nummernVorschlag.vorschlag}
                  style={{
                    background: form.mandantennummer === nummernVorschlag.vorschlag ? 'var(--surface2)' : 'var(--surface)',
                    border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)',
                    padding: '5px 11px', fontSize: '12px', fontWeight: 600,
                    color: form.mandantennummer === nummernVorschlag.vorschlag ? 'var(--text-muted)' : 'var(--accent)',
                    cursor: form.mandantennummer === nummernVorschlag.vorschlag ? 'default' : 'pointer',
                  }}
                >
                  {form.mandantennummer === nummernVorschlag.vorschlag ? '✓ ' : '＋ '}
                  Vorschlag {nummernVorschlag.vorschlag}
                </button>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  höchste vergebene: {nummernVorschlag.hoechste}
                </span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div>
                <input
                  type="text"
                  placeholder="Nr. 1 *"
                  value={form.mandantennummer}
                  onChange={e => set('mandantennummer', e.target.value)}
                  style={errors.mandantennummer ? { borderColor: 'var(--red)' } : {}}
                />
                {errors.mandantennummer && (
                  <span style={{ fontSize: '11px', color: 'var(--red)' }}>{errors.mandantennummer}</span>
                )}
              </div>
              <input
                type="text"
                placeholder="Nr. 2 (optional)"
                value={form.mandantennummer2}
                onChange={e => set('mandantennummer2', e.target.value)}
              />
              <input
                type="text"
                placeholder="Nr. 3 (optional)"
                value={form.mandantennummer3}
                onChange={e => set('mandantennummer3', e.target.value)}
              />
            </div>
          </div>

          <div className="modal-field-row">
            <div className="modal-field" style={{ flex: 2 }}>
              <label>Name des Mandanten <span className="required">*</span></label>
              <input
                type="text"
                placeholder="z.B. Müller GmbH"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                style={errors.name ? { borderColor: 'var(--red)' } : {}}
              />
              {errors.name && (
                <span style={{ fontSize: '11px', color: 'var(--red)' }}>{errors.name}</span>
              )}
            </div>
          </div>

          {/* E-Mail-Kontakt – nur beim Anlegen. Im Bearbeiten-Modus bleiben die
              Kontakte unangetastet (die werden in den Stammdaten gepflegt). */}
          {!editMode && (
            <div className="modal-field-row">
              <div className="modal-field" style={{ flex: 2 }}>
                <label>E-Mail (Kontakt)</label>
                <input
                  type="email"
                  placeholder="z.B. info@firma.de"
                  value={form.kontaktEmail}
                  onChange={e => set('kontaktEmail', e.target.value)}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Wird als Kontakt gespeichert – künftige Mails dieses Absenders ordnet das Dashboard dann von selbst zu.
                </span>
              </div>
            </div>
          )}

          {/* Veranlagungsjahre – bis zu 3 (optional) */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
              Veranlagungsjahr(e)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div>
                <input
                  type="number"
                  min="2010"
                  max={CURRENT_YEAR}
                  placeholder={`${CURRENT_YEAR - 1} (optional)`}
                  value={form.veranlagungsjahr}
                  onChange={e => set('veranlagungsjahr', e.target.value)}
                />
              </div>
              <input
                type="number"
                min="2010"
                max={CURRENT_YEAR}
                placeholder="2. Jahr (optional)"
                value={form.veranlagungsjahr2}
                onChange={e => set('veranlagungsjahr2', e.target.value)}
              />
              <input
                type="number"
                min="2010"
                max={CURRENT_YEAR}
                placeholder="3. Jahr (optional)"
                value={form.veranlagungsjahr3}
                onChange={e => set('veranlagungsjahr3', e.target.value)}
              />
            </div>
          </div>

          <div className="modal-field-row">
            <div className="modal-field">
              <label>Rechtsform</label>
              <select value={form.rechtsform} onChange={e => set('rechtsform', e.target.value)}>
                {RECHTSFORMEN.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="modal-field">
              <label>Gewinnermittlung</label>
              <select value={form.gewinnermittlung} onChange={e => set('gewinnermittlung', e.target.value)}>
                <option value="Bilanz">Bilanz</option>
                <option value="EÜR">EÜR</option>
                <option value="Nur Einkommensteuer">Nur Einkommensteuer</option>
              </select>
            </div>
          </div>

          <div className="modal-field">
            <label>Unternehmensgegenstand</label>
            <input
              type="text"
              placeholder="z.B. Handel mit Maschinen, Steuerberatung, Gastronomie …"
              value={form.unternehmensgegenstand}
              onChange={e => set('unternehmensgegenstand', e.target.value)}
            />
          </div>

          {/* ── Zusatzaufgaben ── */}
          <div style={{ margin: '8px 0 4px', padding: '10px 14px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ⭐ Zusatzaufgaben
              </div>
              <button type="button" onClick={() => setShowAddZusatz(s => !s)}
                style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
                {showAddZusatz ? '✕ Abbrechen' : '+ Hinzufügen'}
              </button>
            </div>

            {/* Existing entries */}
            {form.zusatzaufgaben.length === 0 && !showAddZusatz && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Keine Zusatzaufgaben hinterlegt</div>
            )}
            {form.zusatzaufgaben.map(z => (
              <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: '6px', fontSize: '12px' }}>
                <span style={{ flex: 1, fontWeight: 600 }}>{z.bezeichnung}</span>
                <span style={{ color: 'var(--text-muted)' }}>{z.art}</span>
                {z.betroffJahr && <span style={{ color: 'var(--text-muted)' }}>VJ {z.betroffJahr}</span>}
                <span style={{ color: 'var(--text-muted)' }}>→ {MONAT_NAMEN[z.monat - 1]} {z.anzeigeJahr}</span>
                <button type="button" onClick={() => removeZusatz(z.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}>✕</button>
              </div>
            ))}

            {/* Add form */}
            {showAddZusatz && (
              <div style={{ padding: '10px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Bezeichnung *</label>
                  <input type="text" placeholder="z.B. Jahresabschluss 2022 nachreichen"
                    value={newZusatz.bezeichnung} onChange={e => setNZ('bezeichnung', e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Art</label>
                    <select value={newZusatz.art} onChange={e => setNZ('art', e.target.value)} style={{ width: '100%' }}>
                      {ZUSATZ_ARTEN.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Betroffenes Jahr</label>
                    <input type="number" min="2010" max={CURRENT_YEAR} placeholder="z.B. 2022"
                      value={newZusatz.betroffJahr} onChange={e => setNZ('betroffJahr', e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Anzeige-Jahr *</label>
                    <input type="number" min="2010" max={CURRENT_YEAR + 5}
                      value={newZusatz.anzeigeJahr} onChange={e => setNZ('anzeigeJahr', e.target.value)} style={{ width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Geplanter Monat *</label>
                    <select value={newZusatz.monat} onChange={e => setNZ('monat', parseInt(e.target.value, 10))} style={{ width: '100%' }}>
                      {MONAT_NAMEN.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Notiz</label>
                  <input type="text" placeholder="Optionale Anmerkung"
                    value={newZusatz.notiz} onChange={e => setNZ('notiz', e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }} />
                </div>
                <button type="button" onClick={addZusatz}
                  disabled={!newZusatz.bezeichnung.trim()}
                  style={{ alignSelf: 'flex-start', padding: '6px 16px', borderRadius: '6px', border: 'none', background: '#7c2d12', color: '#fff', fontWeight: 600, fontSize: '12px', cursor: newZusatz.bezeichnung.trim() ? 'pointer' : 'not-allowed', opacity: newZusatz.bezeichnung.trim() ? 1 : 0.5 }}>
                  ⭐ Aufgabe hinzufügen
                </button>
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Abbrechen</button>
            <button type="submit" className="btn btn-primary">{editMode ? '💾 Änderungen speichern' : 'Fall anlegen'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
