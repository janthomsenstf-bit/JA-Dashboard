/**
 * FormularEditor.jsx  –  Template-Editor für Webformulare (Dashboard)
 */
import { useState } from 'react'

// ── Standard-Templates ────────────────────────────────────────────────────────
export const DEFAULT_TEMPLATES = [
  {
    id: 'ust-reg-ausland',
    name: 'USt-Registrierung Ausland',
    icon: '🌍',
    beschreibung: 'Bitte füllen Sie alle Felder sorgfältig aus. Die Angaben werden für den Antrag auf umsatzsteuerliche Registrierung in Deutschland benötigt.',
    felder: [
      { id: 's1',           typ: 'section',   label: '👤 Persönliche Daten' },
      { id: 'anrede',       typ: 'select',    label: 'Anrede',             pflicht: true,  optionen: ['Herr', 'Frau', 'Divers', 'Firma'] },
      { id: 'vorname',      typ: 'text',      label: 'Vorname',            pflicht: true },
      { id: 'nachname',     typ: 'text',      label: 'Nachname / Firma',   pflicht: true },
      { id: 'geburtsdatum', typ: 'date',      label: 'Geburtsdatum',       pflicht: true,  hinweis: 'Nur bei natürlichen Personen' },
      { id: 's2',           typ: 'section',   label: '🏠 Anschrift (Heimatland)' },
      { id: 'strasse',      typ: 'text',      label: 'Straße + Hausnummer', pflicht: true },
      { id: 'plz',          typ: 'text',      label: 'PLZ',                pflicht: true },
      { id: 'ort',          typ: 'text',      label: 'Ort',                pflicht: true },
      { id: 'land',         typ: 'text',      label: 'Land',               pflicht: true,  placeholder: 'z. B. Dänemark' },
      { id: 's3',           typ: 'section',   label: '📞 Kontaktdaten' },
      { id: 'email',        typ: 'email',     label: 'E-Mail-Adresse',     pflicht: true },
      { id: 'telefon',      typ: 'tel',       label: 'Telefon',            pflicht: false },
      { id: 's4',           typ: 'section',   label: '💼 Steuerliche Angaben' },
      { id: 'ustid_heimat', typ: 'text',      label: 'USt-ID Heimatland',  pflicht: false, hinweis: 'Falls vorhanden, z. B. DK12345678' },
      { id: 'steuernr_de',  typ: 'text',      label: 'Deutsche Steuernummer', pflicht: false, hinweis: 'Falls bereits vorhanden' },
      { id: 'taetigkeitde', typ: 'textarea',  label: 'Tätigkeit in Deutschland', pflicht: true, placeholder: 'Kurze Beschreibung der Tätigkeit / Lieferungen in Deutschland' },
      { id: 's5',           typ: 'section',   label: '📎 Dokumente' },
      { id: 'ausweis',      typ: 'file',      label: 'Personalausweis / Reisepass', pflicht: true,
        erlaubteTypen: ['image/*', 'application/pdf'], maxMB: 10,
        hinweis: 'Scan oder Foto beider Seiten, PDF oder JPG/PNG' },
      { id: 'gewerbeschein', typ: 'file',     label: 'Gewerbeschein / Handelsregister', pflicht: false,
        erlaubteTypen: ['image/*', 'application/pdf'], maxMB: 10 },
      { id: 'bestaetigung', typ: 'checkbox',  label: 'Richtigkeit bestätigen', pflicht: true,
        checkboxLabel: 'Ich bestätige, dass alle Angaben korrekt und vollständig sind.' },
    ],
  },
  {
    id: 'stammdaten',
    name: 'Stammdaten-Erfassung',
    icon: '📋',
    beschreibung: 'Bitte erfassen Sie Ihre aktuellen Kontaktdaten und steuerlichen Informationen.',
    felder: [
      { id: 's1',       typ: 'section',  label: '👤 Persönliche Daten' },
      { id: 'anrede',   typ: 'select',   label: 'Anrede',    pflicht: true, optionen: ['Herr', 'Frau', 'Divers'] },
      { id: 'vorname',  typ: 'text',     label: 'Vorname',   pflicht: true },
      { id: 'nachname', typ: 'text',     label: 'Nachname',  pflicht: true },
      { id: 'geburt',   typ: 'date',     label: 'Geburtsdatum', pflicht: true },
      { id: 's2',       typ: 'section',  label: '🏠 Adresse' },
      { id: 'strasse',  typ: 'text',     label: 'Straße + Nr.', pflicht: true },
      { id: 'plz',      typ: 'text',     label: 'PLZ',        pflicht: true },
      { id: 'ort',      typ: 'text',     label: 'Ort',        pflicht: true },
      { id: 's3',       typ: 'section',  label: '📞 Kontakt' },
      { id: 'email',    typ: 'email',    label: 'E-Mail',    pflicht: true },
      { id: 'mobil',    typ: 'tel',      label: 'Mobilnummer', pflicht: false },
      { id: 'telefon',  typ: 'tel',      label: 'Festnetz',  pflicht: false },
      { id: 's4',       typ: 'section',  label: '💼 Bankverbindung' },
      { id: 'iban',     typ: 'text',     label: 'IBAN',      pflicht: false },
      { id: 'bic',      typ: 'text',     label: 'BIC',       pflicht: false },
      { id: 'bank',     typ: 'text',     label: 'Kreditinstitut', pflicht: false },
    ],
  },
  {
    id: 'unterlagen-ja',
    name: 'Jahresabschluss – Unterlagen',
    icon: '📁',
    beschreibung: 'Bitte laden Sie die benötigten Unterlagen für den Jahresabschluss hoch.',
    felder: [
      { id: 's1',         typ: 'section',  label: '📊 Belege & Nachweise' },
      { id: 'hinweis',    typ: 'textarea', label: 'Besondere Hinweise / Anmerkungen', pflicht: false,
        placeholder: 'z. B. fehlende Belege, besondere Vorgänge, Fragen' },
      { id: 'kontoauszug', typ: 'file',   label: 'Kontoauszüge (alle Geschäftskonten)', pflicht: true,
        erlaubteTypen: ['application/pdf', 'image/*'], maxMB: 20 },
      { id: 'kasse',      typ: 'file',    label: 'Kassenberichte (falls vorhanden)', pflicht: false,
        erlaubteTypen: ['application/pdf', 'image/*', '.xlsx', '.csv'], maxMB: 20 },
      { id: 'sonstiges',  typ: 'file',    label: 'Sonstige Belege', pflicht: false,
        erlaubteTypen: ['application/pdf', 'image/*'], maxMB: 20 },
      { id: 'bestaetigung', typ: 'checkbox', label: 'Vollständigkeit', pflicht: true,
        checkboxLabel: 'Ich bestätige, dass ich alle vorhandenen Unterlagen vollständig hochgeladen habe.' },
    ],
  },
]

// ── Feldtypen für den Editor ──────────────────────────────────────────────────
const FELD_TYPEN = [
  { typ: 'text',     label: 'Textfeld',         icon: '📝' },
  { typ: 'textarea', label: 'Mehrzeiliger Text', icon: '📄' },
  { typ: 'email',    label: 'E-Mail',            icon: '📧' },
  { typ: 'tel',      label: 'Telefon',           icon: '📞' },
  { typ: 'number',   label: 'Zahl',              icon: '🔢' },
  { typ: 'date',     label: 'Datum',             icon: '📅' },
  { typ: 'select',   label: 'Auswahlliste',      icon: '⬇️' },
  { typ: 'checkbox', label: 'Checkbox',          icon: '☑️' },
  { typ: 'file',     label: 'Datei-Upload',      icon: '📎' },
  { typ: 'section',  label: 'Abschnitt-Titel',   icon: '📌' },
]

function generateId() {
  return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

// ── Einzel-Feld bearbeiten ────────────────────────────────────────────────────
function FeldEditRow({ feld, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [open, setOpen] = useState(false)

  const typInfo = FELD_TYPEN.find(t => t.typ === feld.typ) ?? { icon: '📝', label: feld.typ }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '6px', background: 'var(--surface)', overflow: 'hidden' }}>
      {/* Zeile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px' }}>
        {/* Reihenfolge */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <button className="btn btn-ghost btn-sm" onClick={onMoveUp} disabled={isFirst}
            style={{ padding: '1px 5px', fontSize: '10px', opacity: isFirst ? 0.3 : 1 }}>▲</button>
          <button className="btn btn-ghost btn-sm" onClick={onMoveDown} disabled={isLast}
            style={{ padding: '1px 5px', fontSize: '10px', opacity: isLast ? 0.3 : 1 }}>▼</button>
        </div>

        {/* Typ-Icon + Label */}
        <span style={{ fontSize: '16px', flexShrink: 0 }}>{typInfo.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
            {feld.label || <span style={{ color: 'var(--text-muted)' }}>– kein Label –</span>}
            {feld.pflicht && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{typInfo.label} · ID: {feld.id}</div>
        </div>

        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)} style={{ fontSize: '11px', flexShrink: 0 }}>
          {open ? '▲ Einklappen' : '✏️ Bearbeiten'}
        </button>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px', padding: '0 4px' }}>🗑</button>
      </div>

      {/* Bearbeitungs-Panel */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Label / Beschriftung</label>
              <input className="input" value={feld.label ?? ''} onChange={e => onUpdate({ label: e.target.value })}
                style={{ fontSize: '12px', padding: '5px 8px' }} placeholder="z. B. Vorname" />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Typ</label>
              <select className="input" value={feld.typ} onChange={e => onUpdate({ typ: e.target.value })}
                style={{ fontSize: '12px', padding: '5px 8px' }}>
                {FELD_TYPEN.map(t => <option key={t.typ} value={t.typ}>{t.icon} {t.label}</option>)}
              </select>
            </div>
          </div>

          {feld.typ !== 'section' && feld.typ !== 'checkbox' && (
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Platzhalter-Text</label>
              <input className="input" value={feld.placeholder ?? ''} onChange={e => onUpdate({ placeholder: e.target.value })}
                style={{ fontSize: '12px', padding: '5px 8px' }} placeholder="z. B. Max Mustermann" />
            </div>
          )}

          {feld.typ === 'checkbox' && (
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Checkbox-Text (neben der Box)</label>
              <input className="input" value={feld.checkboxLabel ?? ''} onChange={e => onUpdate({ checkboxLabel: e.target.value })}
                style={{ fontSize: '12px', padding: '5px 8px' }} />
            </div>
          )}

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Hinweis-Text (unter dem Feld)</label>
            <input className="input" value={feld.hinweis ?? ''} onChange={e => onUpdate({ hinweis: e.target.value })}
              style={{ fontSize: '12px', padding: '5px 8px' }} placeholder="z. B. Format: TT.MM.JJJJ" />
          </div>

          {feld.typ === 'select' && (
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Optionen (eine pro Zeile)</label>
              <textarea className="input" rows={4}
                value={(feld.optionen ?? []).join('\n')}
                onChange={e => onUpdate({ optionen: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
                style={{ fontSize: '12px', padding: '5px 8px', resize: 'vertical' }}
                placeholder={'Option 1\nOption 2\nOption 3'} />
            </div>
          )}

          {feld.typ === 'file' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Max. Dateigröße (MB)</label>
                <input className="input" type="number" value={feld.maxMB ?? 10} min={1} max={50}
                  onChange={e => onUpdate({ maxMB: parseInt(e.target.value) })}
                  style={{ fontSize: '12px', padding: '5px 8px' }} />
              </div>
            </div>
          )}

          {feld.typ !== 'section' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text)' }}>
              <input type="checkbox" checked={!!feld.pflicht} onChange={e => onUpdate({ pflicht: e.target.checked })}
                style={{ width: '14px', height: '14px', accentColor: 'var(--accent)' }} />
              Pflichtfeld (muss ausgefüllt werden)
            </label>
          )}
        </div>
      )}
    </div>
  )
}

// ── Haupt-Editor ──────────────────────────────────────────────────────────────
export default function FormularEditor({ vorlage, onSave, onCancel }) {
  const [name,         setName]         = useState(vorlage?.name ?? '')
  const [icon,         setIcon]         = useState(vorlage?.icon ?? '📋')
  const [beschreibung, setBeschreibung] = useState(vorlage?.beschreibung ?? '')
  const [felder,       setFelder]       = useState(vorlage?.felder ?? [])
  const [addTyp,       setAddTyp]       = useState('text')
  const [addLabel,     setAddLabel]     = useState('')

  function addFeld() {
    if (!addLabel.trim()) return
    const neu = {
      id:      generateId(),
      typ:     addTyp,
      label:   addLabel.trim(),
      pflicht: addTyp !== 'section',
    }
    if (addTyp === 'select') neu.optionen = []
    if (addTyp === 'file')   neu.maxMB    = 10
    setFelder(prev => [...prev, neu])
    setAddLabel('')
  }

  function updateFeld(id, patch) {
    setFelder(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
  }

  function deleteFeld(id) {
    setFelder(prev => prev.filter(f => f.id !== id))
  }

  function moveUp(idx) {
    if (idx === 0) return
    setFelder(prev => { const a = [...prev]; [a[idx-1], a[idx]] = [a[idx], a[idx-1]]; return a })
  }

  function moveDown(idx) {
    setFelder(prev => {
      if (idx >= prev.length - 1) return prev
      const a = [...prev]; [a[idx], a[idx+1]] = [a[idx+1], a[idx]]; return a
    })
  }

  function handleSave() {
    if (!name.trim()) { alert('Name des Formulars fehlt.'); return }
    onSave({
      id:          vorlage?.id ?? ('tmpl_' + Date.now().toString(36)),
      name:        name.trim(),
      icon,
      beschreibung: beschreibung.trim(),
      felder,
    })
  }

  const typInfo = FELD_TYPEN.find(t => t.typ === addTyp) ?? FELD_TYPEN[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '14px' }}>
          {vorlage ? '✏️ Template bearbeiten' : '➕ Neues Template erstellen'}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Abbrechen</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave}>💾 Speichern</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* Basis-Infos */}
        <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: '10px', marginBottom: '14px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Icon</label>
            <input className="input" value={icon} onChange={e => setIcon(e.target.value)} style={{ fontSize: '20px', padding: '4px', textAlign: 'center', width: '100%' }} maxLength={2} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Name des Formulars</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} style={{ fontSize: '13px', padding: '6px 8px' }} placeholder="z. B. USt-Registrierung Ausland" />
          </div>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Einleitungstext / Beschreibung (wird dem Mandanten angezeigt)</label>
          <textarea className="input" value={beschreibung} onChange={e => setBeschreibung(e.target.value)} rows={2}
            style={{ fontSize: '12px', padding: '6px 8px', resize: 'vertical' }}
            placeholder="z. B. Bitte füllen Sie alle Felder vollständig aus." />
        </div>

        {/* Felder-Liste */}
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Felder ({felder.length})
        </div>

        {felder.length === 0 && (
          <div style={{ padding: '20px', border: '1px dashed var(--border)', borderRadius: '8px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Noch keine Felder – unten ein Feld hinzufügen
          </div>
        )}

        {felder.map((f, idx) => (
          <FeldEditRow
            key={f.id}
            feld={f}
            onUpdate={patch => updateFeld(f.id, patch)}
            onDelete={() => deleteFeld(f.id)}
            onMoveUp={() => moveUp(idx)}
            onMoveDown={() => moveDown(idx)}
            isFirst={idx === 0}
            isLast={idx === felder.length - 1}
          />
        ))}

        {/* Feld hinzufügen */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', background: 'var(--surface)', marginTop: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
            ➕ Neues Feld hinzufügen
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', gap: '8px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Typ</label>
              <select className="input" value={addTyp} onChange={e => setAddTyp(e.target.value)} style={{ fontSize: '12px', padding: '5px 8px' }}>
                {FELD_TYPEN.map(t => <option key={t.typ} value={t.typ}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Label</label>
              <input className="input" value={addLabel} onChange={e => setAddLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFeld()}
                style={{ fontSize: '12px', padding: '5px 8px' }}
                placeholder={addTyp === 'section' ? 'Abschnitt-Titel' : 'Feld-Beschriftung'} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={addFeld} style={{ whiteSpace: 'nowrap' }}>+ Hinzufügen</button>
          </div>
        </div>
      </div>
    </div>
  )
}
