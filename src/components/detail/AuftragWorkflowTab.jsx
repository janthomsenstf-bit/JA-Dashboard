import { useState } from 'react'

// ── SMTP & Absender (wie KommunikationTab) ────────────────────────────────────
const ABSENDER_KEY = 'kommunikation-absender'

function loadAbsender() {
  try {
    const raw = localStorage.getItem(ABSENDER_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

async function sendViaSMTP({ to, from, subject, text, account }) {
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, from, subject, text, account }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

// ── Workflow-Vorlage: USt-Registrierung Ausland ───────────────────────────────
const UST_TEMPLATE = {
  id: 'ust_registrierung_ausland',
  name: 'USt-Registrierung Ausland',
  icon: '🌍',
  farbe: '#0891b2',
  steps: [
    {
      id: 'step1', nr: 1,
      titel: 'Unterlagen anfordern',
      beschreibung: 'Erstes Anschreiben an den Mandanten mit Anforderung aller benötigten Unterlagen und Informationen für die umsatzsteuerliche Registrierung.',
      emailHinweis: 'E-Mail an Mandanten → Unterlagen anfordern',
      autoStatus: 'warte_feedback',
      checkpunkte: [
        { id: 'c1', label: 'Handelsregistereintrag / Gründungsurkunde' },
        { id: 'c2', label: 'Ausweiskopie Geschäftsführer / Vertretungsberechtigter' },
        { id: 'c3', label: 'USt-ID des Heimatlandes (falls vorhanden)' },
        { id: 'c4', label: 'Vollmacht ausgefüllt und unterschrieben' },
        { id: 'c5', label: 'Beschreibung der Geschäftstätigkeit in Deutschland' },
        { id: 'c6', label: 'Bankverbindung des Unternehmens' },
      ],
    },
    {
      id: 'step2', nr: 2,
      titel: 'USt-Antrag zur Unterschrift',
      beschreibung: 'Alle Unterlagen liegen vor. Der Antrag wurde vorbereitet und wird zur Unterschrift an den Mandanten gesendet.',
      emailHinweis: 'E-Mail an Mandanten → Antrag zur Unterschrift',
      autoStatus: 'warte_unterschrift',
      checkpunkte: [
        { id: 'c1', label: 'Alle Unterlagen aus Step 1 vollständig eingegangen' },
        { id: 'c2', label: 'Antrag vorbereitet und geprüft' },
      ],
    },
    {
      id: 'step3', nr: 3,
      titel: 'Antrag ans Finanzamt senden',
      beschreibung: 'Der unterschriebene Antrag und alle Anlagen werden an das zuständige Finanzamt gesendet.',
      emailHinweis: 'E-Mail an Finanzamt → Antrag mit Anlagen',
      autoStatus: null,
      checkpunkte: [
        { id: 'c1', label: 'Unterschriebener Antrag vom Mandanten erhalten' },
        { id: 'c2', label: 'Alle Anlagen vollständig und geprüft' },
      ],
    },
    {
      id: 'step4', nr: 4,
      titel: 'Rückmeldung + Rechnung an Mandanten',
      beschreibung: 'Mandant wird informiert, dass der Antrag beim Finanzamt eingegangen ist. Rechnung wird versendet.',
      emailHinweis: 'E-Mail an Mandanten → Bestätigung + Rechnung',
      autoStatus: 'abgeschlossen',
      checkpunkte: [
        { id: 'c1', label: 'Rechnung erstellt und versendet' },
      ],
    },
  ],
}

export const WORKFLOW_VORLAGEN = [UST_TEMPLATE]

// ── Instanz erzeugen (kopiert alle Step-Daten → editierbar) ───────────────────
function createInstanz(template) {
  return {
    id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    templateId: template.id,
    name: template.name,
    icon: template.icon,
    farbe: template.farbe,
    gestartetAm: new Date().toISOString().slice(0, 10),
    abgeschlossenAm: null,
    status: 'aktiv',
    steps: template.steps.map((s, i) => ({
      stepId: s.id,
      nr: i + 1,
      titel: s.titel,
      beschreibung: s.beschreibung,
      emailHinweis: s.emailHinweis,
      autoStatus: s.autoStatus ?? null,
      istLetzter: false,              // wird unten gesetzt
      status: i === 0 ? 'aktiv' : 'offen',
      erledigtAm: null,
      notiz: '',
      emailGesendet: false,
      checkpunkte: (s.checkpunkte ?? []).map(c => ({ id: c.id, label: c.label, checked: false })),
    })).map((s, i, arr) => ({ ...s, istLetzter: i === arr.length - 1 })),
  }
}

function fmtDatum(iso) {
  if (!iso) return '–'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function newStepId() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4) }
function newCpId()   { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4) }

// ── Fortschrittsleiste ────────────────────────────────────────────────────────
function ProgressBar({ steps, farbe }) {
  const erledigt = steps.filter(s => s.status === 'erledigt').length
  const total    = steps.length
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {steps.map((s, i) => (
          <div key={s.stepId} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
            <div title={s.titel} style={{
              width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 700,
              background: s.status === 'erledigt' ? farbe : s.status === 'aktiv' ? 'white' : 'var(--surface)',
              border: `2px solid ${s.status === 'offen' ? 'var(--border)' : farbe}`,
              color:  s.status === 'erledigt' ? 'white' : s.status === 'aktiv' ? farbe : 'var(--text-muted)',
              transition: 'all 0.3s', cursor: 'default',
            }}>
              {s.status === 'erledigt' ? '✓' : s.nr}
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: '2px', minWidth: '16px', background: s.status === 'erledigt' ? farbe : 'var(--border)', transition: 'background 0.3s' }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
        {erledigt} von {total} Schritten · {Math.round(erledigt / total * 100)} %
      </div>
    </div>
  )
}

// ── Inline-E-Mail-Editor ──────────────────────────────────────────────────────
function InlineMailEditor({ client, emailVorlagen = [], vorgabe, onSent, onCancel }) {
  const absenderList = loadAbsender()
  const erstesKontaktEmail = (client.kontakte ?? []).find(k => k.email)?.email ?? ''

  const [von,       setVon]       = useState(absenderList.find(a => a.isDefault)?.email ?? absenderList[0]?.email ?? '')
  const [an,        setAn]        = useState(erstesKontaktEmail)
  const [betreff,   setBetreff]   = useState('')
  const [text,      setText]      = useState('')
  const [vorlageId, setVorlageId] = useState('')
  const [sending,   setSending]   = useState(false)
  const [error,     setError]     = useState('')

  function applyVorlage(id) {
    const v = emailVorlagen.find(v => v.id === id)
    if (!v) return
    setBetreff(v.betreff ?? '')
    setText(v.text ?? '')
    setVorlageId(id)
  }

  async function handleSend() {
    if (!an.trim())      { setError('Empfänger fehlt.'); return }
    if (!betreff.trim()) { setError('Betreff fehlt.');   return }
    if (!text.trim())    { setError('Text fehlt.');      return }
    if (!von)            { setError('Kein Absender konfiguriert – bitte unter Stammdaten einrichten.'); return }

    setSending(true)
    setError('')
    const acc = absenderList.find(a => a.email === von)
    try {
      await sendViaSMTP({ to: an, from: von, subject: betreff, text, account: acc })
      onSent({ von, an, betreff })
    } catch (e) {
      setError('Fehler: ' + e.message)
      setSending(false)
    }
  }

  return (
    <div style={{ border: '1px solid rgba(8,145,178,0.4)', borderRadius: '8px', background: 'rgba(8,145,178,0.04)', padding: '14px', marginBottom: '14px' }}>
      <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '10px', color: '#0891b2' }}>📧 E-Mail verfassen</div>

      {/* Vorlage */}
      {emailVorlagen.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Vorlage laden</label>
          <select className="input" value={vorlageId} onChange={e => applyVorlage(e.target.value)} style={{ fontSize: '12px', padding: '4px 8px', width: '100%' }}>
            <option value="">– Vorlage wählen –</option>
            {emailVorlagen.map(v => <option key={v.id} value={v.id}>{v.name ?? v.betreff}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        {/* Von */}
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Von</label>
          {absenderList.length > 1
            ? <select className="input" value={von} onChange={e => setVon(e.target.value)} style={{ fontSize: '12px', padding: '4px 8px', width: '100%' }}>
                {absenderList.map(a => <option key={a.email} value={a.email}>{a.name ? `${a.name} <${a.email}>` : a.email}</option>)}
              </select>
            : <input className="input" value={von} readOnly style={{ fontSize: '12px', padding: '4px 8px', width: '100%', background: 'var(--bg)' }} />
          }
        </div>
        {/* An */}
        <div>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>An</label>
          <input className="input" value={an} onChange={e => setAn(e.target.value)} placeholder="empfaenger@beispiel.de" style={{ fontSize: '12px', padding: '4px 8px', width: '100%' }} />
        </div>
      </div>

      {/* Betreff */}
      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Betreff</label>
        <input className="input" value={betreff} onChange={e => setBetreff(e.target.value)} placeholder="Betreff…" style={{ fontSize: '12px', padding: '4px 8px', width: '100%' }} />
      </div>

      {/* Text */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Text</label>
        <textarea className="input" value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="E-Mail-Text…" style={{ fontSize: '12px', padding: '6px 8px', width: '100%', resize: 'vertical', fontFamily: 'var(--font-ui)', lineHeight: 1.5 }} />
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>⚠️ {error}</div>}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={sending} style={{ fontSize: '11px' }}>Abbrechen</button>
        <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={sending} style={{ fontSize: '11px' }}>
          {sending ? '⏳ Wird gesendet…' : '📤 Senden'}
        </button>
      </div>
    </div>
  )
}

// ── Step-Editor (Bearbeiten-Modus) ────────────────────────────────────────────
function StepEditor({ step, onSave, onCancel }) {
  const [titel,       setTitel]       = useState(step.titel)
  const [beschreibung,setBeschreibung]= useState(step.beschreibung ?? '')
  const [emailHinweis,setEmailHinweis]= useState(step.emailHinweis ?? '')
  const [checkpunkte, setCheckpunkte] = useState(
    (step.checkpunkte ?? []).map(c => ({ ...c }))
  )
  const [neuerCP, setNeuerCP] = useState('')

  function addCP() {
    const label = neuerCP.trim()
    if (!label) return
    setCheckpunkte(prev => [...prev, { id: newCpId(), label, checked: false }])
    setNeuerCP('')
  }

  function removeCP(id) { setCheckpunkte(prev => prev.filter(c => c.id !== id)) }
  function updateCPLabel(id, label) { setCheckpunkte(prev => prev.map(c => c.id !== id ? c : { ...c, label })) }

  function handleSave() {
    if (!titel.trim()) return
    onSave({ titel: titel.trim(), beschreibung, emailHinweis, checkpunkte })
  }

  return (
    <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', background: 'rgba(124,58,237,0.03)' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>✏️ Schritt bearbeiten</div>

      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Titel *</label>
        <input className="input" value={titel} onChange={e => setTitel(e.target.value)} style={{ fontSize: '12px', padding: '5px 8px', width: '100%' }} />
      </div>
      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Beschreibung</label>
        <textarea className="input" value={beschreibung} onChange={e => setBeschreibung(e.target.value)} rows={2} style={{ fontSize: '12px', padding: '5px 8px', width: '100%', resize: 'vertical', fontFamily: 'var(--font-ui)' }} />
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>E-Mail-Hinweis</label>
        <input className="input" value={emailHinweis} onChange={e => setEmailHinweis(e.target.value)} placeholder="z.B. E-Mail an Mandanten → Unterlagen anfordern" style={{ fontSize: '12px', padding: '5px 8px', width: '100%' }} />
      </div>

      {/* Checkpunkte */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Checkliste</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px' }}>
          {checkpunkte.map((cp, i) => (
            <div key={cp.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '11px', width: '16px', textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
              <input className="input" value={cp.label} onChange={e => updateCPLabel(cp.id, e.target.value)} style={{ flex: 1, fontSize: '12px', padding: '3px 7px' }} />
              <button onClick={() => removeCP(cp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '14px', padding: '0 4px', flexShrink: 0 }} title="Entfernen">✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input className="input" value={neuerCP} onChange={e => setNeuerCP(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCP()} placeholder="Neuer Checkpunkt…" style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }} />
          <button className="btn btn-ghost btn-sm" onClick={addCP} disabled={!neuerCP.trim()} style={{ fontSize: '11px', flexShrink: 0 }}>＋ Hinzufügen</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} style={{ fontSize: '11px' }}>Abbrechen</button>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!titel.trim()} style={{ fontSize: '11px' }}>✓ Speichern</button>
      </div>
    </div>
  )
}

// ── Einzelner Step ────────────────────────────────────────────────────────────
function StepKarte({ step, auftragId, isExpanded, onToggle, onCheckpunkt, onNotiz, onMarkEmail, onAbschliessen, onSaveEdit, onDelete, client, emailVorlagen }) {
  const [editing,    setEditing]    = useState(false)
  const [mailOpen,   setMailOpen]   = useState(false)
  const [deleteConf, setDeleteConf] = useState(false)

  const isAktiv    = step.status === 'aktiv'
  const isErledigt = step.status === 'erledigt'
  const isOffen    = step.status === 'offen'

  const alleCPs      = step.checkpunkte ?? []
  const erledigteCPs = alleCPs.filter(c => c.checked).length
  const alleChecked  = alleCPs.length === 0 || erledigteCPs === alleCPs.length

  function handleMailSent({ von, an, betreff }) {
    onMarkEmail(true, { von, an, betreff })
    setMailOpen(false)
  }

  return (
    <div style={{
      border: `1px solid ${isAktiv ? 'rgba(8,145,178,0.45)' : 'var(--border)'}`,
      borderLeft: `4px solid ${isErledigt ? '#16a34a' : isAktiv ? '#0891b2' : 'var(--border)'}`,
      borderRadius: '8px', background: isAktiv ? 'rgba(8,145,178,0.04)' : 'var(--surface)',
      overflow: 'hidden', opacity: isOffen ? 0.65 : 1, transition: 'all 0.2s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}>
        {/* Nummer */}
        <div style={{
          width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700,
          background: isErledigt ? '#16a34a' : isAktiv ? '#0891b2' : 'var(--border)',
          color: isOffen ? 'var(--text-muted)' : 'white',
        }}>
          {isErledigt ? '✓' : step.nr}
        </div>

        {/* Titel + Info */}
        <div style={{ flex: 1, cursor: isOffen ? 'default' : 'pointer' }} onClick={() => !isOffen && !editing && onToggle()}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: isOffen ? 'var(--text-muted)' : 'var(--text)' }}>{step.titel}</div>
          {isErledigt && step.erledigtAm && (
            <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '1px' }}>✓ Erledigt am {fmtDatum(step.erledigtAm)}</div>
          )}
          {isAktiv && !isExpanded && (
            <div style={{ fontSize: '11px', color: '#0891b2', marginTop: '1px' }}>
              {alleCPs.length > 0 ? `${erledigteCPs}/${alleCPs.length} Checkpunkte` : ''}
              {step.emailGesendet ? (alleCPs.length > 0 ? ' · ' : '') + '📧 E-Mail gesendet' : ''}
            </div>
          )}
        </div>

        {/* Aktionen */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
          {!isErledigt && (
            <button
              onClick={() => { setEditing(v => !v); setMailOpen(false) }}
              title="Schritt bearbeiten"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '2px 4px', color: editing ? '#7c3aed' : 'var(--text-muted)', opacity: 0.7 }}
            >✏️</button>
          )}
          {!isErledigt && !isAktiv && (
            deleteConf
              ? <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: '#ef4444' }}>Sicher?</span>
                  <button onClick={() => { onDelete(); setDeleteConf(false) }} style={{ background: '#ef4444', border: 'none', cursor: 'pointer', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '4px' }}>Ja</button>
                  <button onClick={() => setDeleteConf(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--text-muted)' }}>✕</button>
                </span>
              : <button onClick={() => setDeleteConf(true)} title="Schritt löschen" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '2px 4px', color: 'var(--text-muted)', opacity: 0.6 }}>🗑</button>
          )}
          {!isOffen && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px' }} onClick={() => !editing && onToggle()}>
              {isExpanded ? '▲' : '▼'}
            </span>
          )}
        </div>
      </div>

      {/* Edit-Mode */}
      {editing && (
        <StepEditor
          step={step}
          onSave={data => { onSaveEdit(data); setEditing(false) }}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Body (aufgeklappt) */}
      {isExpanded && !editing && (isAktiv || isErledigt) && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
          {/* Beschreibung */}
          {step.beschreibung && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px 0 12px', lineHeight: 1.5 }}>
              {step.beschreibung}
            </div>
          )}

          {/* E-Mail-Bereich */}
          {!isErledigt && (
            mailOpen
              ? <InlineMailEditor
                  client={client}
                  emailVorlagen={emailVorlagen}
                  vorgabe={step.emailHinweis}
                  onSent={handleMailSent}
                  onCancel={() => setMailOpen(false)}
                />
              : <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px',
                  padding: '10px 12px', borderRadius: '8px',
                  background: step.emailGesendet ? 'rgba(22,163,74,0.05)' : 'rgba(8,145,178,0.06)',
                  border: step.emailGesendet ? '1px solid rgba(22,163,74,0.35)' : '1px solid rgba(8,145,178,0.25)',
                }}>
                  <span style={{ fontSize: '20px' }}>📧</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{step.emailHinweis || 'E-Mail senden'}</div>
                    {step.emailGesendet
                      ? <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>
                          ✓ Gesendet{step.emailAn ? ` an ${step.emailAn}` : ''}{step.emailBetreff ? ` · „${step.emailBetreff}"` : ''}
                        </div>
                      : <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Noch nicht gesendet</div>
                    }
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    {!step.emailGesendet && (
                      <button className="btn btn-primary btn-sm" onClick={() => setMailOpen(true)} style={{ fontSize: '11px' }}>
                        ✉️ E-Mail verfassen
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onMarkEmail(!step.emailGesendet, {})}
                      style={{ fontSize: '11px', color: step.emailGesendet ? '#16a34a' : 'var(--text-muted)' }}
                    >
                      {step.emailGesendet ? '✓ Gesendet' : '○ Manuell markieren'}
                    </button>
                  </div>
                </div>
          )}

          {/* Checkpunkte */}
          {alleCPs.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '7px' }}>
                Checkliste · {erledigteCPs}/{alleCPs.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {alleCPs.map(cp => (
                  <label key={cp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isErledigt ? 'default' : 'pointer', fontSize: '12px' }}>
                    <input type="checkbox" checked={cp.checked} disabled={isErledigt}
                      onChange={() => !isErledigt && onCheckpunkt(cp.id)}
                      style={{ cursor: isErledigt ? 'default' : 'pointer', flexShrink: 0 }}
                    />
                    <span style={{ textDecoration: cp.checked ? 'line-through' : 'none', color: cp.checked ? 'var(--text-muted)' : 'var(--text)' }}>
                      {cp.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Notiz */}
          <div style={{ marginBottom: isErledigt ? '0' : '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>Interne Notiz</div>
            <textarea className="input" value={step.notiz ?? ''} onChange={e => onNotiz(e.target.value)}
              placeholder="Anmerkungen zu diesem Schritt…" rows={2} disabled={isErledigt}
              style={{ width: '100%', fontSize: '12px', resize: 'vertical', fontFamily: 'var(--font-ui)' }}
            />
          </div>

          {/* Abschliessen */}
          {!isErledigt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
              {!alleChecked && (
                <span style={{ fontSize: '11px', color: '#f97316' }}>
                  ⚠️ Noch {alleCPs.length - erledigteCPs} Checkpunkt{alleCPs.length - erledigteCPs !== 1 ? 'e' : ''} offen
                </span>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                {step.istLetzter && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Schließt den gesamten Auftrag ab</span>}
                <button className="btn btn-primary btn-sm" onClick={onAbschliessen} style={{ fontSize: '12px' }}>
                  {step.istLetzter ? '🏁 Auftrag abschließen' : '✓ Schritt abschließen →'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Neuer Step Form ───────────────────────────────────────────────────────────
function NeuerStepForm({ onAdd, onCancel }) {
  const [titel,       setTitel]        = useState('')
  const [beschreibung,setBeschreibung] = useState('')
  const [emailHinweis,setEmailHinweis] = useState('')
  const [checkpunkte, setCheckpunkte]  = useState([])
  const [neuerCP,     setNeuerCP]      = useState('')

  function addCP() {
    const label = neuerCP.trim()
    if (!label) return
    setCheckpunkte(prev => [...prev, { id: newCpId(), label, checked: false }])
    setNeuerCP('')
  }

  function handleSave() {
    if (!titel.trim()) return
    onAdd({ titel: titel.trim(), beschreibung, emailHinweis, checkpunkte })
  }

  return (
    <div style={{ border: '2px dashed rgba(8,145,178,0.4)', borderRadius: '8px', padding: '14px', background: 'rgba(8,145,178,0.03)' }}>
      <div style={{ fontWeight: 700, fontSize: '12px', color: '#0891b2', marginBottom: '10px' }}>＋ Neuer Schritt</div>

      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Titel *</label>
        <input className="input" value={titel} onChange={e => setTitel(e.target.value)} placeholder="Schrittbezeichnung…" style={{ fontSize: '12px', padding: '5px 8px', width: '100%' }} autoFocus />
      </div>
      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Beschreibung</label>
        <textarea className="input" value={beschreibung} onChange={e => setBeschreibung(e.target.value)} rows={2} placeholder="Was ist in diesem Schritt zu tun?" style={{ fontSize: '12px', padding: '5px 8px', width: '100%', resize: 'vertical', fontFamily: 'var(--font-ui)' }} />
      </div>
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>E-Mail-Hinweis</label>
        <input className="input" value={emailHinweis} onChange={e => setEmailHinweis(e.target.value)} placeholder="z.B. E-Mail an Mandanten → …" style={{ fontSize: '12px', padding: '5px 8px', width: '100%' }} />
      </div>

      {/* Checkpunkte */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>Checkliste (optional)</label>
        {checkpunkte.map(cp => (
          <div key={cp.id} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>·</span>
            <span style={{ flex: 1, fontSize: '12px' }}>{cp.label}</span>
            <button onClick={() => setCheckpunkte(prev => prev.filter(c => c.id !== cp.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '13px' }}>✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
          <input className="input" value={neuerCP} onChange={e => setNeuerCP(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCP()} placeholder="Checkpunkt hinzufügen…" style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }} />
          <button className="btn btn-ghost btn-sm" onClick={addCP} disabled={!neuerCP.trim()} style={{ fontSize: '11px' }}>＋</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} style={{ fontSize: '11px' }}>Abbrechen</button>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!titel.trim()} style={{ fontSize: '11px' }}>＋ Schritt hinzufügen</button>
      </div>
    </div>
  )
}

// ── Einzelner Auftrag ─────────────────────────────────────────────────────────
function AuftragKarte({ instanz, onUpdate, client, emailVorlagen }) {
  const [expandedStep,   setExpandedStep]   = useState(instanz.steps.find(s => s.status === 'aktiv')?.stepId ?? null)
  const [collapsed,      setCollapsed]      = useState(instanz.status === 'abgeschlossen')
  const [addingStep,     setAddingStep]     = useState(false)

  const istAbgeschlossen = instanz.status === 'abgeschlossen'
  const farbe            = instanz.farbe ?? '#0891b2'

  // ── Schritt-Updater ──────────────────────────────────────────────────────────
  function patchStep(stepId, updater) {
    onUpdate({
      steps: instanz.steps.map(s => s.stepId !== stepId ? s : updater(s)),
    }, null)
  }

  function handleCheckpunkt(stepId, cpId) {
    patchStep(stepId, s => ({
      ...s,
      checkpunkte: s.checkpunkte.map(c => c.id !== cpId ? c : { ...c, checked: !c.checked }),
    }))
  }

  function handleNotiz(stepId, val) {
    patchStep(stepId, s => ({ ...s, notiz: val }))
  }

  function handleMarkEmail(stepId, val, meta) {
    patchStep(stepId, s => ({
      ...s,
      emailGesendet: val,
      emailAn:      meta.an      ?? s.emailAn,
      emailBetreff: meta.betreff ?? s.emailBetreff,
    }))

    // Gesendete E-Mail auch in Kommunikation-Events eintragen
    if (val && meta.an) {
      const step     = instanz.steps.find(s => s.stepId === stepId)
      const newEvent = {
        id:         'wf_' + Date.now().toString(36),
        typ:        'email',
        datum:      new Date().toISOString(),
        erstelltAm: new Date().toISOString(),
        gesendetAm: new Date().toISOString(),
        betreff:    meta.betreff ?? step?.emailHinweis ?? '',
        absender:   meta.von     ?? '',
        empfaenger: meta.an      ?? '',
        text:       '',
        anlagen:    [],
        quelle:     'workflow',
        workflowName: instanz.name,
        workflowStep: step?.titel ?? '',
      }
      const komm = client.kommunikation ?? { events: [] }
      onUpdate({ kommunikation: { ...komm, events: [newEvent, ...(komm.events ?? [])] } }, null)
    }
  }

  function handleSaveEdit(stepId, data) {
    patchStep(stepId, s => ({
      ...s,
      titel:        data.titel,
      beschreibung: data.beschreibung,
      emailHinweis: data.emailHinweis,
      checkpunkte:  data.checkpunkte.map(c => ({
        ...c,
        checked: s.checkpunkte?.find(sc => sc.id === c.id)?.checked ?? false,
      })),
    }))
  }

  function handleAbschliessen(stepId) {
    const stepIdx   = instanz.steps.findIndex(s => s.stepId === stepId)
    const naechster = instanz.steps[stepIdx + 1]
    const step      = instanz.steps[stepIdx]
    const istLetzter = !naechster

    const neueSteps = instanz.steps.map((s, i) => {
      if (s.stepId === stepId) return { ...s, status: 'erledigt', erledigtAm: new Date().toISOString().slice(0, 10) }
      if (i === stepIdx + 1)  return { ...s, status: 'aktiv' }
      return s
    }).map((s, i, arr) => ({ ...s, istLetzter: i === arr.length - 1 }))

    onUpdate(
      { steps: neueSteps, ...(istLetzter ? { status: 'abgeschlossen', abgeschlossenAm: new Date().toISOString().slice(0, 10) } : {}) },
      step?.autoStatus ?? null
    )

    if (naechster) setExpandedStep(naechster.stepId)
    else           setCollapsed(true)
  }

  function handleDeleteStep(stepId) {
    const neueSteps = instanz.steps
      .filter(s => s.stepId !== stepId)
      .map((s, i, arr) => ({ ...s, nr: i + 1, istLetzter: i === arr.length - 1 }))
    onUpdate({ steps: neueSteps }, null)
  }

  function handleAddStep(data) {
    const neueSteps = [
      ...instanz.steps.map(s => ({ ...s, istLetzter: false })),
      {
        stepId:       newStepId(),
        nr:           instanz.steps.length + 1,
        titel:        data.titel,
        beschreibung: data.beschreibung,
        emailHinweis: data.emailHinweis,
        autoStatus:   null,
        istLetzter:   true,
        status:       'offen',
        erledigtAm:   null,
        notiz:        '',
        emailGesendet:false,
        checkpunkte:  data.checkpunkte,
      },
    ]
    onUpdate({ steps: neueSteps }, null)
    setAddingStep(false)
  }

  const aktuellerIdx = instanz.steps.filter(s => s.status === 'erledigt').length

  return (
    <div style={{ border: `1px solid ${istAbgeschlossen ? 'rgba(22,163,74,0.35)' : 'var(--border)'}`, borderRadius: '10px', overflow: 'hidden', background: 'var(--surface)' }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: istAbgeschlossen ? 'rgba(22,163,74,0.05)' : 'rgba(8,145,178,0.03)', borderBottom: collapsed ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}
        onClick={() => setCollapsed(v => !v)}
      >
        <span style={{ fontSize: '22px' }}>{instanz.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '14px' }}>{instanz.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Gestartet: {fmtDatum(instanz.gestartetAm)}
            {istAbgeschlossen && instanz.abgeschlossenAm ? ` · Abgeschlossen: ${fmtDatum(instanz.abgeschlossenAm)}` : !istAbgeschlossen ? ` · Schritt ${aktuellerIdx + 1} von ${instanz.steps.length}` : ''}
          </div>
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px', background: istAbgeschlossen ? 'rgba(22,163,74,0.12)' : 'rgba(8,145,178,0.12)', color: istAbgeschlossen ? '#16a34a' : '#0891b2', border: `1px solid ${istAbgeschlossen ? 'rgba(22,163,74,0.3)' : 'rgba(8,145,178,0.3)'}` }}>
          {istAbgeschlossen ? '✅ Abgeschlossen' : '● Aktiv'}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{collapsed ? '▼' : '▲'}</span>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ padding: '16px' }}>
          {/* Progress */}
          <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <ProgressBar steps={instanz.steps} farbe={farbe} />
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {instanz.steps.map(step => (
              <StepKarte
                key={step.stepId}
                step={step}
                auftragId={instanz.id}
                isExpanded={expandedStep === step.stepId}
                onToggle={() => setExpandedStep(v => v === step.stepId ? null : step.stepId)}
                onCheckpunkt={cpId => handleCheckpunkt(step.stepId, cpId)}
                onNotiz={val => handleNotiz(step.stepId, val)}
                onMarkEmail={(val, meta) => handleMarkEmail(step.stepId, val, meta)}
                onAbschliessen={() => handleAbschliessen(step.stepId)}
                onSaveEdit={data => handleSaveEdit(step.stepId, data)}
                onDelete={() => handleDeleteStep(step.stepId)}
                client={client}
                emailVorlagen={emailVorlagen}
              />
            ))}
          </div>

          {/* Schritt hinzufügen */}
          {!istAbgeschlossen && (
            <div style={{ marginTop: '10px' }}>
              {addingStep
                ? <NeuerStepForm onAdd={handleAddStep} onCancel={() => setAddingStep(false)} />
                : <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setAddingStep(true)}
                    style={{ width: '100%', fontSize: '12px', border: '1.5px dashed var(--border)', borderRadius: '7px', padding: '8px', color: 'var(--text-muted)' }}
                  >
                    ＋ Schritt hinzufügen
                  </button>
              }
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Auswahl-Modal ─────────────────────────────────────────────────────────────
function NeuerAuftragModal({ onSelect, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', width: '100%', maxWidth: '480px', padding: '24px' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '6px' }}>⚡ Neuen Auftrag starten</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Wähle den Auftragstyp:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {WORKFLOW_VORLAGEN.map(v => (
            <button key={v.id} onClick={() => onSelect(v)}
              style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--bg)', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = v.farbe}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <span style={{ fontSize: '28px' }}>{v.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>{v.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{v.steps.length} Schritte</div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>→</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Weitere Auftragstypen folgen in einer späteren Version.</div>
        <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ marginTop: '14px', width: '100%', fontSize: '12px' }}>Abbrechen</button>
      </div>
    </div>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function AuftragWorkflowTab({ client, onUpdate, emailVorlagen = [] }) {
  const auftraege = client.auftraege ?? []
  const [showNeuerAuftrag, setShowNeuerAuftrag] = useState(false)

  const aktive         = auftraege.filter(a => a.status === 'aktiv')
  const abgeschlossene = auftraege.filter(a => a.status === 'abgeschlossen')

  function startAuftrag(template) {
    const instanz = createInstanz(template)
    onUpdate({ auftraege: [...auftraege, instanz] })
    setShowNeuerAuftrag(false)
  }

  function updateAuftrag(auftragId, patch, autoStatus) {
    const neueAuftraege = auftraege.map(a => a.id !== auftragId ? a : { ...a, ...patch })
    const updateObj = { auftraege: neueAuftraege }
    if (autoStatus) updateObj.manuellerStatus = autoStatus
    // Kommunikation-Events weiterleiten falls im patch enthalten
    if (patch.kommunikation) {
      updateObj.kommunikation = patch.kommunikation
      delete updateObj.auftraege[updateObj.auftraege.findIndex(a => a.id === auftragId)].kommunikation
    }
    onUpdate(updateObj)
  }

  // Spezialfall: handleMarkEmail schreibt auch in client.kommunikation
  function updateAuftragWithKomm(auftragId, auftragPatch, autoStatus, kommPatch) {
    const neueAuftraege = auftraege.map(a => a.id !== auftragId ? a : { ...a, ...auftragPatch })
    const updateObj = { auftraege: neueAuftraege }
    if (autoStatus) updateObj.manuellerStatus = autoStatus
    if (kommPatch)  updateObj.kommunikation   = kommPatch
    onUpdate(updateObj)
  }

  return (
    <div style={{ padding: '20px', maxWidth: '820px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>⚡ Aufträge</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Workflow-basierte Prozessketten für diesen Mandanten</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNeuerAuftrag(true)} style={{ fontSize: '12px' }}>
          ＋ Neuer Auftrag
        </button>
      </div>

      {/* Leer */}
      {auftraege.length === 0 && (
        <div style={{ padding: '48px 24px', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚡</div>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>Noch keine Aufträge</div>
          <div style={{ fontSize: '12px', marginBottom: '20px' }}>Starte einen strukturierten Workflow für diesen Mandanten.</div>
          <button className="btn btn-primary" onClick={() => setShowNeuerAuftrag(true)} style={{ fontSize: '12px' }}>＋ Ersten Auftrag starten</button>
        </div>
      )}

      {/* Aktive Aufträge */}
      {aktive.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Aktive Aufträge · {aktive.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {aktive.map(instanz => (
              <AuftragKarte
                key={instanz.id}
                instanz={instanz}
                onUpdate={(patch, autoStatus) => {
                  // Kommunikation-Events separat weiterleiten
                  if (patch.kommunikation) {
                    const { kommunikation, ...restPatch } = patch
                    const neueAuftraege = auftraege.map(a => a.id !== instanz.id ? a : { ...a, ...restPatch })
                    const upd = { auftraege: neueAuftraege, kommunikation }
                    if (autoStatus) upd.manuellerStatus = autoStatus
                    onUpdate(upd)
                  } else {
                    updateAuftrag(instanz.id, patch, autoStatus)
                  }
                }}
                client={client}
                emailVorlagen={emailVorlagen}
              />
            ))}
          </div>
        </div>
      )}

      {/* Abgeschlossene */}
      {abgeschlossene.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Abgeschlossen · {abgeschlossene.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {abgeschlossene.map(instanz => (
              <AuftragKarte
                key={instanz.id}
                instanz={instanz}
                onUpdate={(patch, autoStatus) => updateAuftrag(instanz.id, patch, autoStatus)}
                client={client}
                emailVorlagen={emailVorlagen}
              />
            ))}
          </div>
        </div>
      )}

      {showNeuerAuftrag && <NeuerAuftragModal onSelect={startAuftrag} onClose={() => setShowNeuerAuftrag(false)} />}
    </div>
  )
}
