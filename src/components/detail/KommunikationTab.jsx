import { useState } from 'react'

// ── Persistence helpers ───────────────────────────────────────────────────────
const APIKEY_STORAGE  = 'sda-claude-api-key'
const ABSENDER_KEY    = 'kommunikation-absender'

function loadApiKey()  { return (localStorage.getItem(APIKEY_STORAGE) ?? '').replace(/\s/g, '') }

function loadAbsender() {
  try {
    const raw = localStorage.getItem(ABSENDER_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}
function saveAbsender(list) {
  try { localStorage.setItem(ABSENDER_KEY, JSON.stringify(list)) } catch {}
}

// ── Typ-Konfiguration ─────────────────────────────────────────────────────────
const TYP_CONFIG = {
  rueckfragen:  { label: 'Rückfragen',        icon: '📤', color: '#2563eb', bg: 'rgba(37,99,235,0.08)'  },
  erinnerung:   { label: 'Erinnerung',         icon: '🔔', color: '#f97316', bg: 'rgba(249,115,22,0.08)' },
  unterschrift: { label: 'Unterschrift',       icon: '✍️', color: '#0f766e', bg: 'rgba(15,118,110,0.08)' },
  unterlagen:   { label: 'Unterlagen anfordern', icon: '📎', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  termin:       { label: 'Termin abstimmen',   icon: '📅', color: '#0891b2', bg: 'rgba(8,145,178,0.08)'  },
  frei:         { label: 'Freie Nachricht',    icon: '✉️', color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
}

const STATUS_BADGES = {
  entwurf:       { label: 'Entwurf',    color: '#f97316', bg: 'rgba(249,115,22,0.1)'  },
  gesendet:      { label: 'Gesendet',   color: '#16a34a', bg: 'rgba(22,163,74,0.1)'   },
  fehlgeschlagen:{ label: 'Fehlgeschlagen', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
}

// ── Templates ─────────────────────────────────────────────────────────────────
function buildTemplate(typ, client) {
  const name = client.name ?? ''
  const vj   = client.veranlagungsjahr ?? new Date().getFullYear()
  const offene = (client.rueckfragen ?? [])
    .filter(r => !r.beantwortet)
    .map((r, i) => `  ${i + 1}. ${r.text}`)
    .join('\n')

  switch (typ) {
    case 'rueckfragen':
      return {
        betreff: `Rückfragen zum Jahresabschluss ${vj}`,
        text: `Sehr geehrte Damen und Herren,

im Rahmen der Aufstellung des Jahresabschlusses ${vj} haben sich folgende Rückfragen ergeben, zu denen wir Ihre Unterstützung benötigen:

${offene || '  1. (bitte ergänzen)'}

Bitte leiten Sie uns die entsprechenden Unterlagen und Informationen möglichst zeitnah zu.

Bei Fragen stehen wir Ihnen selbstverständlich gerne zur Verfügung.

Mit freundlichen Grüßen`,
      }
    case 'erinnerung':
      return {
        betreff: `Erinnerung: Ausstehende Unterlagen – Jahresabschluss ${vj}`,
        text: `Sehr geehrte Damen und Herren,

wir erlauben uns, Sie an die noch ausstehenden Unterlagen für den Jahresabschluss ${vj} zu erinnern.

Für eine zügige Bearbeitung Ihrer Steuerangelegenheiten bitten wir Sie, uns die benötigten Informationen baldmöglichst zuzuleiten.

Mit freundlichen Grüßen`,
      }
    case 'unterschrift':
      return {
        betreff: `Steuererklärung ${vj} – Bitte um Unterschrift`,
        text: `Sehr geehrte Damen und Herren,

beiliegend übersenden wir Ihnen die erstellte Steuererklärung für das Jahr ${vj} zur Durchsicht und Unterzeichnung.

Bitte prüfen Sie die Unterlagen und senden Sie uns die unterschriebenen Dokumente zurück.

Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen`,
      }
    case 'unterlagen':
      return {
        betreff: `Anforderung von Unterlagen – ${vj}`,
        text: `Sehr geehrte Damen und Herren,

für die Erstellung Ihrer Steuererklärung / Ihres Jahresabschlusses ${vj} benötigen wir folgende Unterlagen:

  1. (bitte ergänzen)

Bitte stellen Sie uns diese Unterlagen möglichst zeitnah zur Verfügung.

Mit freundlichen Grüßen`,
      }
    case 'termin':
      return {
        betreff: `Terminabstimmung – ${vj}`,
        text: `Sehr geehrte Damen und Herren,

gerne würden wir einen Besprechungstermin mit Ihnen abstimmen, um offene Punkte zu Ihrem Jahresabschluss ${vj} zu klären.

Bitte teilen Sie uns Ihre Verfügbarkeit mit, sodass wir einen passenden Termin vereinbaren können.

Mit freundlichen Grüßen`,
      }
    default:
      return { betreff: '', text: '' }
  }
}

// ── mailto: Link ──────────────────────────────────────────────────────────────
function openMailto({ empfaenger, betreff, text, cc, bcc }) {
  const params = []
  if (betreff) params.push(`subject=${encodeURIComponent(betreff)}`)
  if (text)    params.push(`body=${encodeURIComponent(text)}`)
  if (cc)      params.push(`cc=${encodeURIComponent(cc)}`)
  if (bcc)     params.push(`bcc=${encodeURIComponent(bcc)}`)
  const url = `mailto:${encodeURIComponent(empfaenger)}${params.length ? '?' + params.join('&') : ''}`
  window.location.href = url
}

// ── KI ────────────────────────────────────────────────────────────────────────
async function callClaude(systemPrompt, userText) {
  const key = loadApiKey()
  if (!key) throw new Error('Bitte zuerst den Claude API-Schlüssel im Reiter „Status & Arbeit" hinterlegen (🔑).')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userText }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `HTTP ${res.status}`)
  }
  const data = await res.json()
  let raw = data.content?.[0]?.text ?? ''
  const cb = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (cb) raw = cb[1]
  const jm = raw.match(/\{[\s\S]*\}/)
  if (!jm) throw new Error('Antwort konnte nicht verarbeitet werden.')
  return JSON.parse(jm[0])
}

function buildKIEntwurfPrompt(typ, client) {
  const offene = (client.rueckfragen ?? [])
    .filter(r => !r.beantwortet)
    .map((r, i) => `${i + 1}. ${r.text}`)
    .join('\n')
  return `Du bist Steuerberater-Assistent. Erstelle eine professionelle E-Mail an den Mandanten "${client.name}" (${client.rechtsform ?? ''}, Veranlagungsjahr ${client.veranlagungsjahr}).
E-Mail-Typ: ${TYP_CONFIG[typ]?.label ?? typ}.
${offene ? `Offene Rückfragen:\n${offene}\n` : ''}Antworte NUR mit JSON: {"betreff":"...","text":"..."}`
}

// ── Absender-Verwaltung Modal ─────────────────────────────────────────────────
function AbsenderModal({ onClose }) {
  const [list, setList] = useState(() => loadAbsender())
  const [newName, setNewName]   = useState('')
  const [newEmail, setNewEmail] = useState('')

  function add() {
    if (!newEmail.trim()) return
    const updated = [...list, { name: newName.trim(), email: newEmail.trim(), isDefault: list.length === 0 }]
    setList(updated)
    saveAbsender(updated)
    setNewName('')
    setNewEmail('')
  }

  function remove(i) {
    const updated = list.filter((_, idx) => idx !== i)
    // Wenn gelöschter der Default war: ersten als Default setzen
    if (list[i].isDefault && updated.length > 0) updated[0].isDefault = true
    setList(updated)
    saveAbsender(updated)
  }

  function setDefault(i) {
    const updated = list.map((a, idx) => ({ ...a, isDefault: idx === i }))
    setList(updated)
    saveAbsender(updated)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px',
        padding: '24px', width: '480px', maxWidth: '95vw',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '15px' }}>Absender-Adressen verwalten</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {list.length === 0 && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Noch keine Adressen hinterlegt.
          </p>
        )}

        {list.map((a, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px',
            background: a.isDefault ? 'rgba(37,99,235,0.06)' : 'transparent',
            borderRadius: '6px', marginBottom: '4px',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{a.name || a.email}</div>
              {a.name && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{a.email}</div>}
            </div>
            {a.isDefault
              ? <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 700 }}>Standard</span>
              : <button className="btn btn-ghost btn-sm" style={{ fontSize: '10px' }} onClick={() => setDefault(i)}>Als Standard</button>
            }
            <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px', color: 'var(--red)' }} onClick={() => remove(i)}>✕</button>
          </div>
        ))}

        <div style={{ marginTop: '16px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <input
            className="input"
            placeholder="Name (optional)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{ flex: '1 1 140px', fontSize: '12px', padding: '6px 10px' }}
          />
          <input
            className="input"
            placeholder="E-Mail-Adresse *"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            style={{ flex: '2 1 180px', fontSize: '12px', padding: '6px 10px' }}
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <button className="btn btn-primary btn-sm" onClick={add}>+ Hinzufügen</button>
        </div>

        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Fertig</button>
        </div>
      </div>
    </div>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function KommunikationTab({ client, onUpdate }) {
  const komm    = client.kommunikation ?? { events: [], standardAbsender: '' }
  const events  = Array.isArray(komm.events) ? komm.events : []
  const absender = loadAbsender()

  // Editor State
  const [editorOpen,  setEditorOpen]  = useState(false)
  const [activTyp,    setActivTyp]    = useState('frei')
  const [empfaenger,  setEmpfaenger]  = useState('')
  const [absenderVal, setAbsenderVal] = useState(komm.standardAbsender || (absender.find(a => a.isDefault)?.email ?? ''))
  const [betreff,     setBetreff]     = useState('')
  const [text,        setText]        = useState('')
  const [cc,          setCC]          = useState('')
  const [bcc,         setBCC]         = useState('')
  const [showCCBCC,   setShowCCBCC]   = useState(false)

  // UI State
  const [aiLoading,   setAiLoading]   = useState(false)
  const [aiError,     setAiError]     = useState('')
  const [filter,      setFilter]      = useState('alle')
  const [expanded,    setExpanded]    = useState(null)   // id des expandierten Eintrags
  const [showAbsenderModal, setShowAbsenderModal] = useState(false)

  function saveKomm(patch) {
    onUpdate({ kommunikation: { ...komm, ...patch } })
  }

  // Schnellaktion → Editor befüllen
  function openQuickAction(typ) {
    const tpl = buildTemplate(typ, client)
    setActivTyp(typ)
    setBetreff(tpl.betreff)
    setText(tpl.text)
    setEditorOpen(true)
  }

  // Entwurf speichern
  function saveEntwurf() {
    if (!betreff && !text) return
    const entry = {
      id: 'k' + Date.now().toString(36),
      typ: activTyp,
      empfaenger, absender: absenderVal, betreff, text, cc, bcc,
      status: 'entwurf',
      erstelltAm: new Date().toISOString(),
      gesendetAm: null,
    }
    saveKomm({ events: [entry, ...events] })
    resetEditor()
  }

  // Als gesendet markieren (+ mailto öffnen optional)
  function markGesendet(openMail = true) {
    if (!betreff && !text) return
    if (openMail) {
      openMailto({ empfaenger, betreff, text, cc, bcc })
    }
    const now = new Date().toISOString()
    const entry = {
      id: 'k' + Date.now().toString(36),
      typ: activTyp,
      empfaenger, absender: absenderVal, betreff, text, cc, bcc,
      status: 'gesendet',
      erstelltAm: now,
      gesendetAm: now,
    }
    saveKomm({ events: [entry, ...events] })
    applyStatusUpdates(activTyp, now)
    resetEditor()
  }

  // mailto öffnen ohne zu speichern
  function handleMailto() {
    openMailto({ empfaenger, betreff, text, cc, bcc })
  }

  function resetEditor() {
    setEditorOpen(false)
    setBetreff('')
    setText('')
    setCC('')
    setBCC('')
    setEmpfaenger('')
    setActivTyp('frei')
    setAiError('')
  }

  // Status-Verknüpfungen
  function applyStatusUpdates(typ, now) {
    const today = now.slice(0, 10)
    const st    = client.status ?? {}
    const sq    = st.schnellauswahl ?? {}

    const patch = {
      status: {
        ...st,
        letzterKontakt: { datum: now, art: 'email', notiz: TYP_CONFIG[typ]?.label ?? '' },
      },
    }

    if (typ === 'rueckfragen') {
      const sendungen = [...(client.rueckfragenSendungen ?? ['', '', '', ''])]
      sendungen[0] = today
      patch.rueckfragenSendungen = sendungen
      patch.status.schnellauswahl = { ...sq, rueckfragenGesendet: { aktiv: true, datum: now } }
    } else if (typ === 'unterschrift') {
      patch.steGesendetDatum = today
      patch.status.schnellauswahl = { ...sq, steuerUnterschrift: { aktiv: true, datum: now } }
    } else if (typ === 'erinnerung') {
      patch.status.schnellauswahl = { ...sq, warteRueckmeldung: { aktiv: true, datum: now } }
    }

    onUpdate(patch)
  }

  // Entwurf aus Historie nachträglich senden
  function sendFromHistory(entry) {
    openMailto({ empfaenger: entry.empfaenger, betreff: entry.betreff, text: entry.text, cc: entry.cc, bcc: entry.bcc })
    const now = new Date().toISOString()
    saveKomm({
      events: events.map(e => e.id === entry.id
        ? { ...e, status: 'gesendet', gesendetAm: now }
        : e
      ),
    })
    applyStatusUpdates(entry.typ, now)
  }

  // KI-Entwurf erzeugen
  async function handleKIEntwurf() {
    setAiLoading(true)
    setAiError('')
    try {
      const result = await callClaude(buildKIEntwurfPrompt(activTyp, client), 'Erstelle den E-Mail-Entwurf.')
      if (result.betreff) setBetreff(result.betreff)
      if (result.text)    setText(result.text)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  // KI-Reformulierung
  async function handleReformulate(art) {
    if (!text.trim()) return
    setAiLoading(true)
    setAiError('')
    try {
      const prompt = `Formuliere diesen E-Mail-Text ${art} um. Behalte alle inhaltlichen Punkte bei. Antworte NUR mit JSON: {"text":"..."}`
      const result = await callClaude(prompt, text)
      if (result.text) setText(result.text)
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  // Gefilterte Events
  const filteredEvents = events.filter(e => {
    if (filter === 'gesendet')  return e.status === 'gesendet'
    if (filter === 'entwuerfe') return e.status === 'entwurf'
    return true
  })

  function fmtDatum(iso) {
    if (!iso) return '–'
    const d = new Date(iso)
    return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  }

  return (
    <div style={{ padding: '20px', maxWidth: '900px' }}>

      {/* ── 1. Schnellaktionen ── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: '10px', textTransform: 'uppercase' }}>
          Schnellaktionen
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {Object.entries(TYP_CONFIG).map(([typ, cfg]) => (
            <button
              key={typ}
              onClick={() => openQuickAction(typ)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px', cursor: 'pointer',
                background: cfg.bg, color: cfg.color,
                border: `1px solid ${cfg.color}40`,
                fontSize: '12px', fontWeight: 600,
              }}
            >
              <span>{cfg.icon}</span>{cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. E-Mail-Editor ── */}
      {editorOpen && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '20px', marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                background: TYP_CONFIG[activTyp]?.bg, color: TYP_CONFIG[activTyp]?.color,
              }}>
                {TYP_CONFIG[activTyp]?.icon} {TYP_CONFIG[activTyp]?.label}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {Object.keys(TYP_CONFIG).filter(t => t !== activTyp).map(t => (
                  <button key={t} onClick={() => { setActivTyp(t); const tpl = buildTemplate(t, client); setBetreff(tpl.betreff); setText(tpl.text) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', marginRight: '4px' }}>
                    {TYP_CONFIG[t].icon}
                  </button>
                ))}
              </span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={resetEditor} style={{ fontSize: '11px' }}>✕ Schließen</button>
          </div>

          {/* Felder */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>An (Empfänger)</label>
              <input className="input" value={empfaenger} onChange={e => setEmpfaenger(e.target.value)}
                placeholder="mandant@firma.de" style={{ width: '100%', fontSize: '13px' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Von (Absender)
                <button onClick={() => setShowAbsenderModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '10px', marginLeft: '6px' }}>
                  ⚙ verwalten
                </button>
              </label>
              {absender.length > 0 ? (
                <select className="input" value={absenderVal} onChange={e => setAbsenderVal(e.target.value)} style={{ width: '100%', fontSize: '13px' }}>
                  <option value="">– Absender wählen –</option>
                  {absender.map((a, i) => (
                    <option key={i} value={a.email}>{a.name ? `${a.name} <${a.email}>` : a.email}</option>
                  ))}
                </select>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input className="input" value={absenderVal} onChange={e => setAbsenderVal(e.target.value)}
                    placeholder="absender@kanzlei.de" style={{ flex: 1, fontSize: '13px' }} />
                </div>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Betreff</label>
            <input className="input" value={betreff} onChange={e => setBetreff(e.target.value)}
              placeholder="Betreff..." style={{ width: '100%', fontSize: '13px' }} />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Nachricht</label>
            <textarea
              className="input"
              value={text}
              onChange={e => setText(e.target.value)}
              rows={10}
              style={{ width: '100%', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.6' }}
            />
          </div>

          {/* CC/BCC Toggle */}
          <div style={{ marginBottom: '10px' }}>
            <button onClick={() => setShowCCBCC(p => !p)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px' }}>
              {showCCBCC ? '▲ CC/BCC ausblenden' : '▼ CC / BCC hinzufügen'}
            </button>
            {showCCBCC && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>CC</label>
                  <input className="input" value={cc} onChange={e => setCC(e.target.value)} placeholder="cc@firma.de" style={{ width: '100%', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>BCC</label>
                  <input className="input" value={bcc} onChange={e => setBCC(e.target.value)} placeholder="bcc@kanzlei.de" style={{ width: '100%', fontSize: '13px' }} />
                </div>
              </div>
            )}
          </div>

          {/* KI-Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '4px' }}>KI:</span>
            <button className="btn btn-ghost btn-sm" onClick={handleKIEntwurf} disabled={aiLoading} style={{ fontSize: '11px' }}>
              {aiLoading ? '⏳' : '✨'} KI-Entwurf
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => handleReformulate('kürzer')} disabled={aiLoading || !text} style={{ fontSize: '11px' }}>Kürzer</button>
            <button className="btn btn-ghost btn-sm" onClick={() => handleReformulate('freundlicher')} disabled={aiLoading || !text} style={{ fontSize: '11px' }}>Freundlicher</button>
            <button className="btn btn-ghost btn-sm" onClick={() => handleReformulate('klarer')} disabled={aiLoading || !text} style={{ fontSize: '11px' }}>Klarer</button>
            <button className="btn btn-ghost btn-sm" onClick={() => handleReformulate('in Du-Form')} disabled={aiLoading || !text} style={{ fontSize: '11px' }}>Du-Form</button>
            <button className="btn btn-ghost btn-sm" onClick={() => handleReformulate('in Sie-Form')} disabled={aiLoading || !text} style={{ fontSize: '11px' }}>Sie-Form</button>
          </div>

          {aiError && (
            <div style={{ fontSize: '11px', color: '#dc2626', marginBottom: '10px', padding: '6px 10px', background: 'rgba(220,38,38,0.06)', borderRadius: '6px' }}>
              ⚠️ {aiError}
            </div>
          )}

          {/* Aktions-Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => markGesendet(true)}
              style={{ fontSize: '12px' }}
              title="E-Mail-Client öffnen und als gesendet markieren"
            >
              📤 mailto: öffnen + als gesendet markieren
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleMailto}
              style={{ fontSize: '12px' }}
            >
              📧 mailto: öffnen (ohne Speichern)
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={saveEntwurf}
              style={{ fontSize: '12px' }}
            >
              💾 Als Entwurf speichern
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => markGesendet(false)}
              style={{ fontSize: '12px', color: '#16a34a' }}
            >
              ✓ Nur als gesendet markieren
            </button>
          </div>
        </div>
      )}

      {/* Neues Editor-Öffnen-Button wenn geschlossen */}
      {!editorOpen && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setEditorOpen(true)}
          style={{ marginBottom: '20px', fontSize: '12px' }}
        >
          ✏️ Neue E-Mail verfassen
        </button>
      )}

      {/* ── 3. E-Mail-Historie ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            E-Mail-Historie ({events.length})
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[['alle','Alle'], ['gesendet','Gesendet'], ['entwuerfe','Entwürfe']].map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`btn btn-ghost btn-sm`}
                style={{ fontSize: '10px', ...(filter === key ? { background: 'var(--accent-dim)', color: 'var(--accent)' } : {}) }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            {events.length === 0 ? 'Noch keine E-Mails gesendet oder gespeichert.' : 'Keine Einträge für diesen Filter.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredEvents.map(entry => {
              const cfg    = TYP_CONFIG[entry.typ] ?? TYP_CONFIG.frei
              const sbCfg  = STATUS_BADGES[entry.status] ?? STATUS_BADGES.entwurf
              const isOpen = expanded === entry.id

              return (
                <div key={entry.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '8px', overflow: 'hidden',
                }}>
                  {/* Zeile */}
                  <div
                    onClick={() => setExpanded(isOpen ? null : entry.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '130px 90px 1fr 130px 80px',
                      alignItems: 'center', gap: '12px',
                      padding: '10px 14px', cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {fmtDatum(entry.gesendetAm ?? entry.erstelltAm)}
                    </span>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                      background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
                    }}>
                      {cfg.icon} {cfg.label}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.betreff || '(kein Betreff)'}
                      </div>
                      {entry.empfaenger && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          An: {entry.empfaenger}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.absender}
                    </span>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                      background: sbCfg.bg, color: sbCfg.color, textAlign: 'center',
                    }}>
                      {sbCfg.label}
                    </span>
                  </div>

                  {/* Detail-Klappteil */}
                  {isOpen && (
                    <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                      <pre style={{
                        fontFamily: 'inherit', fontSize: '12px', lineHeight: '1.6',
                        whiteSpace: 'pre-wrap', margin: '12px 0', color: 'var(--text)',
                        background: 'rgba(0,0,0,0.1)', padding: '12px', borderRadius: '6px',
                      }}>
                        {entry.text || '(kein Text)'}
                      </pre>
                      {(entry.cc || entry.bcc) && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                          {entry.cc && <span>CC: {entry.cc} </span>}
                          {entry.bcc && <span>BCC: {entry.bcc}</span>}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        {entry.status === 'entwurf' && (
                          <button className="btn btn-primary btn-sm" onClick={() => sendFromHistory(entry)} style={{ fontSize: '11px' }}>
                            📤 Jetzt senden
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          // In Editor laden
                          setActivTyp(entry.typ)
                          setEmpfaenger(entry.empfaenger ?? '')
                          setAbsenderVal(entry.absender ?? '')
                          setBetreff(entry.betreff ?? '')
                          setText(entry.text ?? '')
                          setCC(entry.cc ?? '')
                          setBCC(entry.bcc ?? '')
                          setEditorOpen(true)
                          setExpanded(null)
                        }} style={{ fontSize: '11px' }}>
                          ✏️ In Editor laden
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          saveKomm({ events: events.filter(e => e.id !== entry.id) })
                          setExpanded(null)
                        }} style={{ fontSize: '11px', color: 'var(--red)' }}>
                          🗑 Löschen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Absender-Modal ── */}
      {showAbsenderModal && (
        <AbsenderModal onClose={() => setShowAbsenderModal(false)} />
      )}
    </div>
  )
}
