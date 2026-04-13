import { useState } from 'react'

// ── Workflow-Vorlage: USt-Registrierung Ausland ───────────────────────────────
const UST_TEMPLATE = {
  id: 'ust_registrierung_ausland',
  name: 'USt-Registrierung Ausland',
  icon: '🌍',
  farbe: '#0891b2',
  steps: [
    {
      id: 'step1',
      nr: 1,
      titel: 'Unterlagen anfordern',
      beschreibung: 'Erstes Anschreiben an den Mandanten mit Anforderung aller benötigten Unterlagen und Informationen für die umsatzsteuerliche Registrierung.',
      typ: 'email',
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
      id: 'step2',
      nr: 2,
      titel: 'USt-Antrag zur Unterschrift',
      beschreibung: 'Alle Unterlagen liegen vor. Der Antrag wurde vorbereitet und wird zur Unterschrift an den Mandanten gesendet.',
      typ: 'email',
      emailHinweis: 'E-Mail an Mandanten → Antrag zur Unterschrift',
      autoStatus: 'warte_unterschrift',
      checkpunkte: [
        { id: 'c1', label: 'Alle Unterlagen aus Step 1 vollständig eingegangen' },
        { id: 'c2', label: 'Antrag vorbereitet und geprüft' },
      ],
    },
    {
      id: 'step3',
      nr: 3,
      titel: 'Antrag ans Finanzamt senden',
      beschreibung: 'Der unterschriebene Antrag und alle Anlagen werden an das zuständige Finanzamt gesendet.',
      typ: 'email',
      emailHinweis: 'E-Mail an Finanzamt → Antrag mit Anlagen',
      autoStatus: null,
      checkpunkte: [
        { id: 'c1', label: 'Unterschriebener Antrag vom Mandanten erhalten' },
        { id: 'c2', label: 'Alle Anlagen vollständig und geprüft' },
      ],
    },
    {
      id: 'step4',
      nr: 4,
      titel: 'Rückmeldung + Rechnung an Mandanten',
      beschreibung: 'Mandant wird informiert, dass der Antrag beim Finanzamt eingegangen ist. Bearbeitungszeit und weitere Hinweise werden mitgeteilt. Rechnung wird versendet.',
      typ: 'email_abschluss',
      emailHinweis: 'E-Mail an Mandanten → Bestätigung + Rechnung',
      autoStatus: 'abgeschlossen',
      checkpunkte: [
        { id: 'c1', label: 'Rechnung erstellt und versendet' },
      ],
    },
  ],
}

export const WORKFLOW_VORLAGEN = [UST_TEMPLATE]

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
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
      status: i === 0 ? 'aktiv' : 'offen',
      erledigtAm: null,
      notiz: '',
      emailGesendet: false,
      checkpunkte: (s.checkpunkte ?? []).map(c => ({ id: c.id, checked: false })),
    })),
  }
}

function fmtDatum(iso) {
  if (!iso) return '–'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function getAktuellenStepIdx(instanz) {
  const idx = instanz.steps.findIndex(s => s.status === 'aktiv')
  if (idx >= 0) return idx
  // Alle erledigt → letzter
  return instanz.steps.length - 1
}

// ── Status-Badge ──────────────────────────────────────────────────────────────
function StepBadge({ status }) {
  const cfg = {
    offen:    { label: 'Offen',       bg: 'rgba(100,116,139,0.1)', color: '#64748b', dot: '○' },
    aktiv:    { label: 'Aktiv',       bg: 'rgba(8,145,178,0.12)',  color: '#0891b2', dot: '◉' },
    erledigt: { label: 'Erledigt',    bg: 'rgba(22,163,74,0.1)',   color: '#16a34a', dot: '●' },
  }[status] ?? { label: status, bg: 'transparent', color: '#64748b', dot: '○' }

  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
    }}>
      {cfg.dot} {cfg.label}
    </span>
  )
}

// ── Fortschrittsleiste ────────────────────────────────────────────────────────
function ProgressBar({ steps, farbe }) {
  const total = steps.length
  const erledigt = steps.filter(s => s.status === 'erledigt').length
  const pct = Math.round((erledigt / total) * 100)

  return (
    <div>
      {/* Punkte-Linie */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '4px' }}>
        {steps.map((s, i) => (
          <div key={s.stepId} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: 700,
              background: s.status === 'erledigt' ? farbe
                        : s.status === 'aktiv'    ? 'white'
                        : 'var(--surface)',
              border: `2px solid ${s.status === 'offen' ? 'var(--border)' : farbe}`,
              color: s.status === 'erledigt' ? 'white'
                   : s.status === 'aktiv'    ? farbe
                   : 'var(--text-muted)',
              transition: 'all 0.3s',
            }}>
              {s.status === 'erledigt' ? '✓' : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: '2px',
                background: s.status === 'erledigt' ? farbe : 'var(--border)',
                transition: 'background 0.3s',
                minWidth: '20px',
              }} />
            )}
          </div>
        ))}
      </div>
      {/* Prozent */}
      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
        {erledigt} von {total} Schritten erledigt · {pct} %
      </div>
    </div>
  )
}

// ── Einzelner Step ────────────────────────────────────────────────────────────
function StepKarte({ step, templateStep, auftragId, isExpanded, onToggle, onCheckpunkt, onNotiz, onEmailGesendet, onAbschliessen, onNavigateToKomm }) {
  const isAktiv    = step.status === 'aktiv'
  const isErledigt = step.status === 'erledigt'
  const isOffen    = step.status === 'offen'
  const istLetzterStep = templateStep.typ === 'email_abschluss'

  const alleCPs     = step.checkpunkte ?? []
  const erledigteCPs = alleCPs.filter(c => c.checked).length
  const alleChecked  = alleCPs.length === 0 || erledigteCPs === alleCPs.length

  return (
    <div style={{
      border: `1px solid ${isAktiv ? 'rgba(8,145,178,0.45)' : 'var(--border)'}`,
      borderLeft: `4px solid ${isErledigt ? '#16a34a' : isAktiv ? '#0891b2' : 'var(--border)'}`,
      borderRadius: '8px',
      background: isAktiv ? 'rgba(8,145,178,0.04)' : 'var(--surface)',
      overflow: 'hidden',
      opacity: isOffen ? 0.65 : 1,
      transition: 'all 0.2s',
    }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: isOffen ? 'default' : 'pointer' }}
        onClick={() => !isOffen && onToggle()}
      >
        {/* Nummer */}
        <div style={{
          width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: 700,
          background: isErledigt ? '#16a34a' : isAktiv ? '#0891b2' : 'var(--border)',
          color: isOffen ? 'var(--text-muted)' : 'white',
        }}>
          {isErledigt ? '✓' : templateStep.nr}
        </div>

        {/* Titel */}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: isOffen ? 'var(--text-muted)' : 'var(--text)' }}>
            {templateStep.titel}
          </div>
          {isErledigt && step.erledigtAm && (
            <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '1px' }}>
              ✓ Erledigt am {fmtDatum(step.erledigtAm)}
            </div>
          )}
          {isAktiv && !isExpanded && (
            <div style={{ fontSize: '11px', color: '#0891b2', marginTop: '1px' }}>
              {alleCPs.length > 0 ? `${erledigteCPs}/${alleCPs.length} Checkpunkte · ` : ''}{step.emailGesendet ? '📧 E-Mail gesendet' : ''}
            </div>
          )}
        </div>

        {/* Badge + Pfeil */}
        <StepBadge status={step.status} />
        {!isOffen && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>
            {isExpanded ? '▲' : '▼'}
          </span>
        )}
      </div>

      {/* Body */}
      {isExpanded && (isAktiv || isErledigt) && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>

          {/* Beschreibung */}
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px 0 12px', lineHeight: 1.5 }}>
            {templateStep.beschreibung}
          </div>

          {/* E-Mail-Aktion */}
          {!isErledigt && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px',
              padding: '10px 12px', background: 'rgba(8,145,178,0.07)',
              border: step.emailGesendet ? '1px solid rgba(22,163,74,0.4)' : '1px solid rgba(8,145,178,0.25)',
              borderRadius: '8px',
            }}>
              <span style={{ fontSize: '20px' }}>📧</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>{templateStep.emailHinweis}</div>
                {step.emailGesendet
                  ? <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>✓ Als gesendet markiert</div>
                  : <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Öffne Kommunikation-Tab und versende die passende Vorlage</div>
                }
              </div>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {!step.emailGesendet && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onNavigateToKomm?.()}
                    style={{ fontSize: '11px' }}
                  >
                    ✉️ Kommunikation öffnen
                  </button>
                )}
                <button
                  className={`btn btn-sm ${step.emailGesendet ? 'btn-ghost' : 'btn-ghost'}`}
                  onClick={() => onEmailGesendet(auftragId, step.stepId, !step.emailGesendet)}
                  style={{ fontSize: '11px', color: step.emailGesendet ? '#16a34a' : 'var(--text-muted)' }}
                >
                  {step.emailGesendet ? '✓ Gesendet' : '○ Als gesendet markieren'}
                </button>
              </div>
            </div>
          )}

          {/* Checkpunkte */}
          {alleCPs.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Checkliste · {erledigteCPs}/{alleCPs.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {(templateStep.checkpunkte ?? []).map(cp => {
                  const instCP = step.checkpunkte?.find(c => c.id === cp.id)
                  const checked = instCP?.checked ?? false
                  return (
                    <label
                      key={cp.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isErledigt ? 'default' : 'pointer', fontSize: '12px' }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isErledigt}
                        onChange={() => !isErledigt && onCheckpunkt(auftragId, step.stepId, cp.id)}
                        style={{ cursor: isErledigt ? 'default' : 'pointer', flexShrink: 0 }}
                      />
                      <span style={{ textDecoration: checked ? 'line-through' : 'none', color: checked ? 'var(--text-muted)' : 'var(--text)' }}>
                        {cp.label}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* Notiz */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Interne Notiz
            </div>
            <textarea
              className="input"
              value={step.notiz ?? ''}
              onChange={e => onNotiz(auftragId, step.stepId, e.target.value)}
              placeholder="Anmerkungen zu diesem Schritt…"
              rows={2}
              disabled={isErledigt}
              style={{ width: '100%', fontSize: '12px', resize: 'vertical', fontFamily: 'var(--font-ui)' }}
            />
          </div>

          {/* Abschliessen */}
          {!isErledigt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
              {!alleChecked && (
                <span style={{ fontSize: '11px', color: '#f97316' }}>
                  ⚠️ Noch {alleCPs.length - erledigteCPs} Checkpunkt{alleCPs.length - erledigteCPs !== 1 ? 'e' : ''} offen
                </span>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                {istLetzterStep && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Schließt den gesamten Auftrag ab
                  </span>
                )}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onAbschliessen(auftragId, step.stepId)}
                  style={{ fontSize: '12px' }}
                >
                  {istLetzterStep ? '🏁 Auftrag abschließen' : '✓ Schritt abschließen →'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Einzelner Auftrag ─────────────────────────────────────────────────────────
function AuftragKarte({ instanz, template, onUpdate, onUpdateStep, onNavigateToKomm }) {
  const aktuellerIdx = getAktuellenStepIdx(instanz)
  const [expandedStep, setExpandedStep] = useState(
    instanz.status === 'aktiv' ? instanz.steps.find(s => s.status === 'aktiv')?.stepId ?? null : null
  )
  const [collapsed, setCollapsed] = useState(instanz.status === 'abgeschlossen')

  function handleCheckpunkt(auftragId, stepId, checkId) {
    onUpdateStep(stepId, s => ({
      ...s,
      checkpunkte: s.checkpunkte.map(c => c.id !== checkId ? c : { ...c, checked: !c.checked }),
    }))
  }

  function handleNotiz(auftragId, stepId, val) {
    onUpdateStep(stepId, s => ({ ...s, notiz: val }))
  }

  function handleEmailGesendet(auftragId, stepId, val) {
    onUpdateStep(stepId, s => ({ ...s, emailGesendet: val }))
  }

  function handleAbschliessen(auftragId, stepId) {
    const stepIdx = instanz.steps.findIndex(s => s.stepId === stepId)
    const naechster = instanz.steps[stepIdx + 1]
    const templateStep = template.steps.find(s => s.id === stepId)
    const istLetzter = !naechster

    const neueSteps = instanz.steps.map((s, i) => {
      if (s.stepId === stepId) return { ...s, status: 'erledigt', erledigtAm: new Date().toISOString().slice(0, 10) }
      if (i === stepIdx + 1) return { ...s, status: 'aktiv' }
      return s
    })

    const patch = { steps: neueSteps }
    if (istLetzter) {
      patch.status = 'abgeschlossen'
      patch.abgeschlossenAm = new Date().toISOString().slice(0, 10)
    }

    onUpdate(patch, templateStep?.autoStatus ?? null)

    if (naechster) {
      setExpandedStep(naechster.stepId)
    } else {
      setCollapsed(true)
    }
  }

  const istAbgeschlossen = instanz.status === 'abgeschlossen'

  return (
    <div style={{
      border: `1px solid ${istAbgeschlossen ? 'rgba(22,163,74,0.35)' : 'var(--border)'}`,
      borderRadius: '10px', overflow: 'hidden',
      background: 'var(--surface)',
    }}>
      {/* Auftrag-Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '14px 16px',
          background: istAbgeschlossen ? 'rgba(22,163,74,0.05)' : `rgba(8,145,178,0.04)`,
          borderBottom: collapsed ? 'none' : '1px solid var(--border)',
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed(v => !v)}
      >
        <span style={{ fontSize: '22px' }}>{instanz.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '14px' }}>{instanz.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Gestartet: {fmtDatum(instanz.gestartetAm)}
            {istAbgeschlossen && instanz.abgeschlossenAm && ` · Abgeschlossen: ${fmtDatum(instanz.abgeschlossenAm)}`}
            {!istAbgeschlossen && ` · Schritt ${aktuellerIdx + 1} von ${instanz.steps.length}`}
          </div>
        </div>
        <span style={{
          fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px',
          background: istAbgeschlossen ? 'rgba(22,163,74,0.12)' : 'rgba(8,145,178,0.12)',
          color: istAbgeschlossen ? '#16a34a' : '#0891b2',
          border: `1px solid ${istAbgeschlossen ? 'rgba(22,163,74,0.3)' : 'rgba(8,145,178,0.3)'}`,
        }}>
          {istAbgeschlossen ? '✅ Abgeschlossen' : '● Aktiv'}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{collapsed ? '▼' : '▲'}</span>
      </div>

      {/* Fortschrittsleiste + Steps */}
      {!collapsed && (
        <div style={{ padding: '16px' }}>
          {/* Progress */}
          <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <ProgressBar steps={instanz.steps} farbe={instanz.farbe ?? '#0891b2'} />
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {instanz.steps.map(step => {
              const tStep = template.steps.find(s => s.id === step.stepId)
              if (!tStep) return null
              return (
                <StepKarte
                  key={step.stepId}
                  step={step}
                  templateStep={tStep}
                  auftragId={instanz.id}
                  isExpanded={expandedStep === step.stepId}
                  onToggle={() => setExpandedStep(v => v === step.stepId ? null : step.stepId)}
                  onCheckpunkt={handleCheckpunkt}
                  onNotiz={handleNotiz}
                  onEmailGesendet={handleEmailGesendet}
                  onAbschliessen={handleAbschliessen}
                  onNavigateToKomm={onNavigateToKomm}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Auswahl-Modal für neuen Auftrag ───────────────────────────────────────────
function NeuerAuftragModal({ onSelect, onClose }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', width: '100%', maxWidth: '480px', padding: '24px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '6px' }}>⚡ Neuen Auftrag starten</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Wähle den Auftragstyp:</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {WORKFLOW_VORLAGEN.map(v => (
            <button
              key={v.id}
              onClick={() => onSelect(v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 16px', border: '1px solid var(--border)',
                borderRadius: '10px', background: 'var(--bg)',
                cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = v.farbe; e.currentTarget.style.background = `rgba(8,145,178,0.04)` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)' }}
            >
              <span style={{ fontSize: '28px' }}>{v.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>{v.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {v.steps.length} Schritte
                </div>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>→</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Weitere Auftragstypen folgen in einer späteren Version.
        </div>

        <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ marginTop: '16px', width: '100%', fontSize: '12px' }}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function AuftragWorkflowTab({ client, onUpdate, onNavigateToKomm }) {
  const auftraege = client.auftraege ?? []
  const [showNeuerAuftrag, setShowNeuerAuftrag] = useState(false)

  const aktive       = auftraege.filter(a => a.status === 'aktiv')
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
    onUpdate(updateObj)
  }

  function updateStep(auftragId, stepId, updater) {
    const auftrag = auftraege.find(a => a.id === auftragId)
    if (!auftrag) return
    updateAuftrag(auftragId, {
      steps: auftrag.steps.map(s => s.stepId !== stepId ? s : updater(s)),
    }, null)
  }

  function getTemplate(templateId) {
    return WORKFLOW_VORLAGEN.find(v => v.id === templateId) ?? null
  }

  return (
    <div style={{ padding: '20px', maxWidth: '820px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>⚡ Aufträge</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Workflow-basierte Prozessketten für diesen Mandanten
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowNeuerAuftrag(true)}
          style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          ＋ Neuer Auftrag
        </button>
      </div>

      {/* Leer-Zustand */}
      {auftraege.length === 0 && (
        <div style={{
          padding: '48px 24px', textAlign: 'center',
          border: '2px dashed var(--border)', borderRadius: '12px',
          color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚡</div>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>Noch keine Aufträge</div>
          <div style={{ fontSize: '12px', marginBottom: '20px' }}>
            Starte einen strukturierten Workflow für diesen Mandanten.
          </div>
          <button className="btn btn-primary" onClick={() => setShowNeuerAuftrag(true)} style={{ fontSize: '12px' }}>
            ＋ Ersten Auftrag starten
          </button>
        </div>
      )}

      {/* Aktive Aufträge */}
      {aktive.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Aktive Aufträge · {aktive.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {aktive.map(instanz => {
              const tmpl = getTemplate(instanz.templateId)
              if (!tmpl) return null
              return (
                <AuftragKarte
                  key={instanz.id}
                  instanz={instanz}
                  template={tmpl}
                  onUpdate={(patch, autoStatus) => updateAuftrag(instanz.id, patch, autoStatus)}
                  onUpdateStep={(stepId, updater) => updateStep(instanz.id, stepId, updater)}
                  onNavigateToKomm={onNavigateToKomm}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Abgeschlossene Aufträge */}
      {abgeschlossene.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Abgeschlossen · {abgeschlossene.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {abgeschlossene.map(instanz => {
              const tmpl = getTemplate(instanz.templateId)
              if (!tmpl) return null
              return (
                <AuftragKarte
                  key={instanz.id}
                  instanz={instanz}
                  template={tmpl}
                  onUpdate={(patch, autoStatus) => updateAuftrag(instanz.id, patch, autoStatus)}
                  onUpdateStep={(stepId, updater) => updateStep(instanz.id, stepId, updater)}
                  onNavigateToKomm={onNavigateToKomm}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Neuer Auftrag Modal */}
      {showNeuerAuftrag && (
        <NeuerAuftragModal
          onSelect={startAuftrag}
          onClose={() => setShowNeuerAuftrag(false)}
        />
      )}
    </div>
  )
}
