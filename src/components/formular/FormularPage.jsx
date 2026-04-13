/**
 * FormularPage.jsx  –  Öffentliche Formularseite für Mandanten
 * Route: /formular/:token
 * Kein Login erforderlich.
 */

import { useState, useEffect } from 'react'

// ── Farben & Stil (unabhängig vom Dashboard-Theme) ───────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '40px 16px 80px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '620px',
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  header: {
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
    padding: '28px 32px',
    color: '#fff',
  },
  kanzleiLabel: { fontSize: '11px', opacity: 0.7, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' },
  formName: { fontSize: '22px', fontWeight: 800, margin: '0 0 4px' },
  mandantGreet: { fontSize: '13px', opacity: 0.85, margin: 0 },
  body: { padding: '28px 32px' },
  label: { fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px' },
  pflichtStar: { color: '#ef4444', marginLeft: '2px' },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
    border: '1px solid #d1d5db', borderRadius: '8px',
    fontSize: '14px', color: '#111827', background: '#fff',
    outline: 'none', transition: 'border-color 0.15s',
  },
  inputError: { borderColor: '#ef4444' },
  textarea: { minHeight: '90px', resize: 'vertical' },
  select: { appearance: 'none', cursor: 'pointer' },
  fieldGroup: { marginBottom: '18px' },
  hint: { fontSize: '11px', color: '#6b7280', marginTop: '4px' },
  error: { fontSize: '11px', color: '#ef4444', marginTop: '3px' },
  fileZone: {
    border: '2px dashed #d1d5db', borderRadius: '8px',
    padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
    background: '#f9fafb',
  },
  fileZoneHover: { borderColor: '#2563eb', background: '#eff6ff' },
  fileItem: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '8px 10px', background: '#f3f4f6', borderRadius: '6px',
    fontSize: '13px', marginTop: '8px',
  },
  submitBtn: {
    width: '100%', padding: '13px', borderRadius: '10px',
    background: '#2563eb', color: '#fff', border: 'none',
    fontSize: '15px', fontWeight: 700, cursor: 'pointer',
    transition: 'background 0.15s',
    marginTop: '8px',
  },
  submitBtnDisabled: { background: '#93c5fd', cursor: 'not-allowed' },
  divider: { border: 'none', borderTop: '1px solid #e5e7eb', margin: '22px 0' },
}

function fmtSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function FieldRenderer({ feld, value, onChange, error, dragOver, setDragOver }) {
  const { id, typ, label, pflicht, optionen, hinweis, erlaubteTypen, maxMB } = feld

  const inputStyle = { ...S.input, ...(error ? S.inputError : {}) }

  if (typ === 'text' || typ === 'email' || typ === 'tel' || typ === 'number') {
    return (
      <input
        type={typ}
        id={id}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
        placeholder={feld.placeholder ?? ''}
      />
    )
  }

  if (typ === 'date') {
    return (
      <input
        type="date"
        id={id}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
      />
    )
  }

  if (typ === 'textarea') {
    return (
      <textarea
        id={id}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, ...S.textarea }}
        placeholder={feld.placeholder ?? ''}
      />
    )
  }

  if (typ === 'select') {
    return (
      <select
        id={id}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, ...S.select }}
      >
        <option value="">– bitte wählen –</option>
        {(optionen ?? []).map((o, i) => (
          <option key={i} value={o}>{o}</option>
        ))}
      </select>
    )
  }

  if (typ === 'checkbox') {
    return (
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#111827' }}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
          style={{ marginTop: '2px', width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563eb' }}
        />
        <span>{feld.checkboxLabel ?? label}</span>
      </label>
    )
  }

  if (typ === 'file') {
    // file upload – handled at parent level, value = array of file objects
    return null  // Rendered separately below in FileField
  }

  return <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} style={inputStyle} />
}

function FileField({ feld, files, onAdd, onRemove }) {
  const [hover, setHover] = useState(false)
  const maxMB = feld.maxMB ?? 10
  const erlaubt = feld.erlaubteTypen ?? ['*']

  async function handleFiles(fileList) {
    for (const file of Array.from(fileList)) {
      if (file.size > maxMB * 1024 * 1024) {
        alert(`${file.name} ist zu groß (max. ${maxMB} MB).`)
        continue
      }
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })
      onAdd({
        id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2),
        feldId: feld.id,
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        content: base64,
      })
    }
  }

  return (
    <div>
      <label
        style={{ ...(hover ? { ...S.fileZone, ...S.fileZoneHover } : S.fileZone), display: 'block' }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onDragOver={e => { e.preventDefault(); setHover(true) }}
        onDragLeave={() => setHover(false)}
        onDrop={e => { e.preventDefault(); setHover(false); handleFiles(e.dataTransfer.files) }}
      >
        <input
          type="file"
          multiple
          accept={erlaubt.join(',')}
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
        <div style={{ fontSize: '24px', marginBottom: '6px' }}>📎</div>
        <div style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>Datei auswählen oder hierher ziehen</div>
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
          {erlaubt.includes('image/*') ? 'Bilder, ' : ''}
          {erlaubt.includes('application/pdf') ? 'PDF, ' : ''}
          max. {maxMB} MB
        </div>
      </label>

      {files.filter(f => f.feldId === feld.id).map(f => (
        <div key={f.id} style={S.fileItem}>
          <span style={{ fontSize: '18px' }}>
            {f.contentType?.includes('pdf') ? '📄' : f.contentType?.includes('image') ? '🖼' : '📎'}
          </span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename}</span>
          <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0 }}>{fmtSize(f.size)}</span>
          <button
            onClick={() => onRemove(f.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px', padding: '0 2px', lineHeight: 1 }}
          >✕</button>
        </div>
      ))}
    </div>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function FormularPage({ token }) {
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [formData,    setFormData]    = useState(null)   // { mandantName, formularName, formularDef }
  const [werte,       setWerte]       = useState({})
  const [dateien,     setDateien]     = useState([])
  const [fehler,      setFehler]      = useState({})
  const [sending,     setSending]     = useState(false)
  const [sendError,   setSendError]   = useState('')
  const [success,     setSuccess]     = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/formular?token=${token}`)
        const data = await res.json()
        if (!res.ok) { setError(data.error || 'Fehler beim Laden'); return }
        if (data.beantwortet) { setSuccess(true); setFormData(data); return }
        setFormData(data)
      } catch (e) {
        setError('Netzwerkfehler: ' + e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  function setWert(feldId, value) {
    setWerte(prev => ({ ...prev, [feldId]: value }))
    if (fehler[feldId]) setFehler(prev => ({ ...prev, [feldId]: '' }))
  }

  function validate() {
    const errs = {}
    const felder = formData?.formularDef?.felder ?? []
    felder.forEach(f => {
      if (!f.pflicht) return
      if (f.typ === 'checkbox') {
        if (!werte[f.id]) errs[f.id] = 'Pflichtfeld'
      } else if (f.typ === 'file') {
        if (!dateien.some(d => d.feldId === f.id)) errs[f.id] = 'Bitte eine Datei hochladen'
      } else {
        if (!werte[f.id]?.toString().trim()) errs[f.id] = 'Pflichtfeld'
      }
    })
    setFehler(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }

    setSending(true); setSendError('')
    try {
      const res = await fetch('/api/formular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, daten: werte, dateien }),
      })
      const data = await res.json()
      if (!res.ok) { setSendError(data.error || 'Fehler beim Senden'); return }
      setSuccess(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setSendError('Netzwerkfehler: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={S.page}>
      <div style={{ textAlign: 'center', paddingTop: '80px', color: '#6b7280' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
        <div>Formular wird geladen…</div>
      </div>
    </div>
  )

  // ── Fehler ───────────────────────────────────────────────────────────────────
  if (error) return (
    <div style={S.page}>
      <div style={{ ...S.card }}>
        <div style={{ ...S.header, background: 'linear-gradient(135deg, #7f1d1d, #dc2626)' }}>
          <div style={S.kanzleiLabel}>Formular</div>
          <h1 style={{ ...S.formName, fontSize: '18px' }}>Link ungültig oder abgelaufen</h1>
        </div>
        <div style={S.body}>
          <p style={{ color: '#374151', fontSize: '14px', lineHeight: 1.6 }}>
            {error}<br /><br />
            Bitte wenden Sie sich an Ihre Kanzlei, um einen neuen Link zu erhalten.
          </p>
        </div>
      </div>
    </div>
  )

  // ── Bereits beantwortet / Erfolg ──────────────────────────────────────────────
  if (success) return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ ...S.header, background: 'linear-gradient(135deg, #064e3b, #10b981)' }}>
          <div style={S.kanzleiLabel}>Formular</div>
          <h1 style={S.formName}>✅ Vielen Dank!</h1>
          <p style={{ ...S.mandantGreet, marginTop: '4px' }}>
            {formData?.mandantName ? `Ihre Daten, ${formData.mandantName}, wurden erfolgreich übermittelt.` : 'Ihre Daten wurden erfolgreich übermittelt.'}
          </p>
        </div>
        <div style={S.body}>
          <p style={{ color: '#374151', fontSize: '14px', lineHeight: 1.6 }}>
            Das Formular <strong>„{formData?.formularName}"</strong> wurde ausgefüllt und an die Kanzlei übermittelt.<br /><br />
            Sie können dieses Fenster jetzt schließen.
          </p>
        </div>
      </div>
    </div>
  )

  const felder = formData?.formularDef?.felder ?? []

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.kanzleiLabel}>Steuerberatung · Sicheres Formular</div>
          <h1 style={S.formName}>{formData?.formularName || 'Formular'}</h1>
          {formData?.mandantName && (
            <p style={{ ...S.mandantGreet, marginTop: '6px' }}>
              Für: <strong>{formData.mandantName}</strong>
            </p>
          )}
        </div>

        {/* Intro */}
        {formData?.formularDef?.beschreibung && (
          <div style={{ padding: '16px 32px 0', background: '#f0f9ff', borderBottom: '1px solid #bae6fd' }}>
            <p style={{ fontSize: '13px', color: '#0369a1', margin: 0, paddingBottom: '14px', lineHeight: 1.6 }}>
              ℹ️ {formData.formularDef.beschreibung}
            </p>
          </div>
        )}

        {/* Formular */}
        <form onSubmit={handleSubmit} style={S.body} noValidate>

          {/* Pflichtfeld-Hinweis */}
          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: 0, marginBottom: '20px' }}>
            Mit <span style={{ color: '#ef4444' }}>*</span> markierte Felder sind Pflichtfelder.
          </p>

          {felder.map((feld, idx) => {
            // Abschnitt-Trenner
            if (feld.typ === 'section') {
              return (
                <div key={idx} style={{ marginBottom: '20px', marginTop: idx > 0 ? '28px' : '0' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e40af', borderBottom: '2px solid #bfdbfe', paddingBottom: '6px' }}>
                    {feld.label}
                  </div>
                  {feld.hinweis && <p style={{ fontSize: '12px', color: '#6b7280', margin: '6px 0 0' }}>{feld.hinweis}</p>}
                </div>
              )
            }

            if (feld.typ === 'file') {
              return (
                <div key={feld.id} style={S.fieldGroup}>
                  <label style={S.label}>
                    {feld.label}{feld.pflicht && <span style={S.pflichtStar}>*</span>}
                  </label>
                  <FileField
                    feld={feld}
                    files={dateien}
                    onAdd={f => setDateien(prev => [...prev, f])}
                    onRemove={id => setDateien(prev => prev.filter(f => f.id !== id))}
                  />
                  {feld.hinweis && <div style={S.hint}>{feld.hinweis}</div>}
                  {fehler[feld.id] && <div style={S.error}>⚠ {fehler[feld.id]}</div>}
                </div>
              )
            }

            if (feld.typ === 'checkbox') {
              return (
                <div key={feld.id} style={S.fieldGroup}>
                  <FieldRenderer feld={feld} value={werte[feld.id]} onChange={v => setWert(feld.id, v)} error={fehler[feld.id]} />
                  {feld.hinweis && <div style={{ ...S.hint, marginTop: '6px' }}>{feld.hinweis}</div>}
                  {fehler[feld.id] && <div style={S.error}>⚠ {fehler[feld.id]}</div>}
                </div>
              )
            }

            return (
              <div key={feld.id} style={S.fieldGroup}>
                <label htmlFor={feld.id} style={S.label}>
                  {feld.label}{feld.pflicht && <span style={S.pflichtStar}>*</span>}
                </label>
                <FieldRenderer
                  feld={feld}
                  value={werte[feld.id]}
                  onChange={v => setWert(feld.id, v)}
                  error={fehler[feld.id]}
                />
                {feld.hinweis && <div style={S.hint}>{feld.hinweis}</div>}
                {fehler[feld.id] && <div style={S.error}>⚠ {fehler[feld.id]}</div>}
              </div>
            )
          })}

          <hr style={S.divider} />

          {sendError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#dc2626', marginBottom: '14px' }}>
              ⚠️ {sendError}
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            style={{ ...S.submitBtn, ...(sending ? S.submitBtnDisabled : {}) }}
            onMouseEnter={e => { if (!sending) e.target.style.background = '#1d4ed8' }}
            onMouseLeave={e => { if (!sending) e.target.style.background = '#2563eb' }}
          >
            {sending ? '⏳ Wird übermittelt…' : '📤 Formular absenden'}
          </button>

          <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '14px', marginBottom: 0 }}>
            🔒 Ihre Daten werden verschlüsselt übertragen und sicher gespeichert.
          </p>
        </form>
      </div>
    </div>
  )
}
