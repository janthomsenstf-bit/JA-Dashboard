import { useState, useRef } from 'react'
import ChecklisteView from './abschluss/ChecklisteView.jsx'

// ── API ──────────────────────────────────────────────────────────────────────
const APIKEY_STORAGE = 'sda-claude-api-key'
function loadApiKey() { return (localStorage.getItem(APIKEY_STORAGE) ?? '').replace(/\s/g, '') }

async function callClaude(systemPrompt, userText) {
  const key = loadApiKey()
  if (!key) throw new Error('Bitte zuerst den Claude API-Schlüssel hinterlegen (🔑 im Tab "Status & Arbeit").')
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
      max_tokens: 1024,
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
  if (!jm) throw new Error('KI-Antwort konnte nicht verarbeitet werden.')
  return JSON.parse(jm[0])
}

// ── KI-Prompts ───────────────────────────────────────────────────────────────
const PROMPT_CAPTURE = `Du bist ein Steuerberater-Assistent. Der Nutzer erfasst einen Punkt während der Jahresabschluss-Arbeit (Prüfungen, Rückfragen, fehlende Unterlagen, Auffälligkeiten). Analysiere den Text und antworte NUR mit diesem JSON-Objekt:
{"kategorie":"rueckfrage|pruefung|unterlagen|abweichung|notiz","titel":"Prägnanter Titel max 60 Zeichen","konto":null}
Kategorien: rueckfrage=Rückfrage/Klärung beim Mandanten nötig, pruefung=Etwas muss geprüft oder kontrolliert werden, unterlagen=Unterlagen/Belege fehlen oder werden angefordert, abweichung=Abweichung oder Auffälligkeit zum Vorjahr, notiz=Sonstige interne Notiz/Gedanke.
Bei "konto": nur Kontonummer als String wenn explizit genannt (z.B. "4830"), sonst null.`

const PROMPT_EMAIL = `Du bist ein Steuerberater-Assistent. Erstelle eine professionelle, freundliche und gut strukturierte E-Mail an einen Mandanten. Die E-Mail enthält alle offenen Rückfragen und benötigten Unterlagen. Sei klar und mandantenfreundlich.
Antworte NUR mit einem JSON-Objekt:
{"betreff":"Aussagekräftiger Betreff","text":"Vollständiger E-Mail-Text mit Anrede, nummerierten Punkten und Grußformel"}`

// ── Kategorien-Config ────────────────────────────────────────────────────────
const KATEGORIEN = {
  rueckfrage: { label: 'Rückfrage Mandant',    icon: '❓', color: '#ef4444', bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.22)'   },
  pruefung:   { label: 'Prüfung erforderlich', icon: '🔍', color: '#d97706', bg: 'rgba(217,119,6,0.07)',   border: 'rgba(217,119,6,0.22)'   },
  unterlagen: { label: 'Unterlagen anfordern', icon: '📄', color: '#2563eb', bg: 'rgba(37,99,235,0.07)',   border: 'rgba(37,99,235,0.22)'   },
  abweichung: { label: 'Abweichung Vorjahr',   icon: '📊', color: '#7c3aed', bg: 'rgba(124,58,237,0.07)', border: 'rgba(124,58,237,0.22)'  },
  notiz:      { label: 'Sonstige Notiz',        icon: '💡', color: '#64748b', bg: 'rgba(100,116,139,0.07)', border: 'rgba(100,116,139,0.22)' },
}

const STATUS_ICONS   = { offen: '●', in_bearbeitung: '◐', erledigt: '✓' }
const STATUS_COLORS  = { offen: '#ef4444', in_bearbeitung: '#f97316', erledigt: '#16a34a' }
const STATUS_LABELS  = { offen: 'Offen', in_bearbeitung: 'In Bearbeitung', erledigt: 'Erledigt' }

// ── VoiceCapture ─────────────────────────────────────────────────────────────
function VoiceCapture({ onCapture, isProcessing }) {
  const [text, setText]           = useState('')
  const [isRecording, setRec]     = useState(false)
  const [interim, setInterim]     = useState('')
  const [error, setError]         = useState('')
  const recRef  = useRef(null)
  const textRef = useRef('')

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition

  function set(val) {
    const v = typeof val === 'function' ? val(textRef.current) : val
    textRef.current = v; setText(v)
  }

  function toggleRec() {
    if (isRecording) { recRef.current?.stop(); setRec(false); setInterim(''); return }
    if (!SR) return
    const r = new SR()
    r.lang = 'de-DE'; r.continuous = true; r.interimResults = true
    r.onresult = e => {
      let fin = '', int = ''
      for (let i = e.resultIndex; i < e.results.length; i++)
        e.results[i].isFinal ? fin += e.results[i][0].transcript : int += e.results[i][0].transcript
      if (fin) set(t => t.trimEnd() ? t.trimEnd() + ' ' + fin : fin)
      setInterim(int)
    }
    r.onend   = () => { setRec(false); setInterim('') }
    r.onerror = () => { setRec(false); setInterim(''); setError('Mikrofon-Fehler.') }
    r.start(); recRef.current = r; setRec(true); setError('')
  }

  async function submit() {
    const t = text.trim()
    if (!t) return
    setError('')
    try { await onCapture(t); set('') }
    catch (e) { setError(e.message) }
  }

  return (
    <div style={{ padding: '14px' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        {/* Mic */}
        <button onClick={toggleRec} disabled={!SR} style={{
          width: '40px', height: '40px', borderRadius: '50%', border: 'none', flexShrink: 0,
          background: isRecording ? '#ef4444' : 'var(--accent)', color: '#fff', fontSize: '17px',
          cursor: SR ? 'pointer' : 'not-allowed',
          boxShadow: isRecording ? '0 0 0 5px rgba(239,68,68,0.2)' : '0 2px 6px rgba(0,0,0,0.15)',
          animation: isRecording ? 'pulseRec 1.2s ease-in-out infinite' : 'none',
          transition: 'all 0.15s',
        }} title={isRecording ? 'Stoppen' : 'Sprechen'}>
          {isRecording ? '⏹' : '🎙'}
        </button>

        <div style={{ flex: 1 }}>
          {/* Text area */}
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <textarea
              value={text}
              onChange={e => set(e.target.value)}
              placeholder={isRecording ? '🎤 Aufnahme läuft – sprechen Sie jetzt…' : 'Punkt sprechen oder eingeben… z.B. „Konto 8033 prüfen" oder „Kfz-Beleg fehlt"'}
              rows={2}
              style={{
                width: '100%', padding: '8px 12px', boxSizing: 'border-box',
                border: `1.5px solid ${isRecording ? '#ef4444' : 'var(--border)'}`,
                borderRadius: '8px', background: 'var(--surface2)', color: 'var(--text)',
                fontSize: '13px', lineHeight: 1.5, resize: 'none', transition: 'border-color 0.2s',
              }}
            />
            {interim && (
              <div style={{ position: 'absolute', bottom: '8px', left: '12px', right: '12px', fontSize: '12px', color: '#ef4444', fontStyle: 'italic', opacity: 0.7, pointerEvents: 'none' }}>
                {text && <span style={{ opacity: 0 }}>{text} </span>}
                {interim}
              </div>
            )}
          </div>

          {error && <div style={{ fontSize: '11px', color: '#ef4444', marginBottom: '6px', padding: '4px 8px', background: 'rgba(239,68,68,0.06)', borderRadius: '4px' }}>⚠ {error}</div>}

          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            {text && <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }} onClick={() => set('')}>✕ Löschen</button>}
            <button
              className="btn btn-primary btn-sm"
              onClick={submit}
              disabled={!text.trim() || isProcessing}
              style={{ fontSize: '12px', fontWeight: 600 }}
            >
              {isProcessing ? '⏳ KI analysiert…' : '✨ Punkt erfassen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PunktKarte ────────────────────────────────────────────────────────────────
function PunktKarte({ punkt, onStatusChange, onDelete, onNotizChange }) {
  const [expanded,   setExpanded]   = useState(false)
  const [notiz,      setNotiz]      = useState(punkt.notiz ?? '')
  const [saved,      setSaved]      = useState(false)

  const kat      = KATEGORIEN[punkt.kategorie] ?? KATEGORIEN.notiz
  const erledigt = punkt.status === 'erledigt'

  function saveNotiz() {
    onNotizChange(punkt.id, notiz)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div style={{
      border: `1px solid ${erledigt ? 'rgba(22,163,74,0.3)' : kat.border}`,
      borderRadius: '10px',
      background: erledigt ? 'rgba(22,163,74,0.03)' : kat.bg,
      overflow: 'hidden',
      transition: 'all 0.2s',
      opacity: erledigt ? 0.65 : 1,
    }}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Kategorie-Icon */}
        <span style={{ fontSize: '18px', flexShrink: 0 }} title={kat.label}>{kat.icon}</span>

        {/* Inhalt */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 600, fontSize: '13px', color: erledigt ? 'var(--text-muted)' : 'var(--text)',
            textDecoration: erledigt ? 'line-through' : 'none',
          }}>
            {punkt.titel}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: kat.color, fontWeight: 600, background: kat.color + '15', padding: '1px 7px', borderRadius: '8px' }}>
              {kat.label}
            </span>
            {punkt.konto && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, background: 'var(--surface)', padding: '1px 7px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                Kto. {punkt.konto}
              </span>
            )}
            {punkt.notiz && !expanded && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                · {punkt.notiz}
              </span>
            )}
          </div>
        </div>

        {/* Status-Buttons (3 kleine Kreise) */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {Object.keys(STATUS_ICONS).map(s => {
            const active = punkt.status === s
            return (
              <button
                key={s}
                onClick={() => onStatusChange(punkt.id, s)}
                title={STATUS_LABELS[s]}
                style={{
                  width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer',
                  border: `2px solid ${active ? STATUS_COLORS[s] : 'var(--border)'}`,
                  background: active ? STATUS_COLORS[s] : 'transparent',
                  color: active ? '#fff' : 'var(--text-muted)',
                  fontSize: '11px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
              >
                {STATUS_ICONS[s]}
              </button>
            )
          })}
        </div>

        {/* Expand + Delete */}
        <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--text-muted)', padding: '3px 5px' }}>
          {expanded ? '▲' : '▼'}
        </button>
        <button onClick={() => onDelete(punkt.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#ef4444', opacity: 0.4, padding: '3px 5px', transition: 'opacity 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
        >🗑</button>
      </div>

      {/* Notiz-Bereich (aufgeklappt) */}
      {expanded && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>📝 Notiz / Details</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={notiz}
              onChange={e => setNotiz(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveNotiz()}
              placeholder="Weitere Details, Konto, Belegnummer…"
              style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }}
            />
            <button className={`btn btn-sm ${saved ? 'btn-success' : 'btn-primary'}`} onClick={saveNotiz} style={{ fontSize: '11px', flexShrink: 0 }}>
              {saved ? '✓' : '💾'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function AbschlussTab({ client, onUpdate }) {
  const [innerTab, setInnerTab] = useState(0) // 0=Prüfcheckliste, 1=Schnellerfassung

  const data   = client.abschluss ?? { punkte: [] }
  const punkte = data.punkte ?? []

  // ── Checkliste Rückfragen-Zähler für Badge ──
  const offeneChecklisteRQ = (client.abschluss?.checkliste?.rueckfragen ?? []).filter(r => r.status === 'offen').length

  // ── Derived ──
  const total        = punkte.length
  const erledigtN    = punkte.filter(p => p.status === 'erledigt').length
  const offeneRueckf = punkte.filter(p => p.kategorie === 'rueckfrage' && p.status !== 'erledigt')

  // ── Capture state ──
  const [isCapturing, setIsCapturing] = useState(false)
  const [showManual,  setShowManual]  = useState(false)
  const [manTitel,    setManTitel]    = useState('')
  const [manKat,      setManKat]      = useState('pruefung')
  const [manKonto,    setManKonto]    = useState('')
  const [manNotiz,    setManNotiz]    = useState('')

  // ── Filter state ──
  const [filterStatus, setFilterStatus] = useState('offen')
  const [filterKat,    setFilterKat]    = useState(null)
  const [filterKonto,  setFilterKonto]  = useState('')

  // ── E-Mail state ──
  const [showEmail,     setShowEmail]     = useState(false)
  const [emailBetreff,  setEmailBetreff]  = useState('')
  const [emailText,     setEmailText]     = useState('')
  const [isGenEmail,    setIsGenEmail]    = useState(false)
  const [emailCopied,   setEmailCopied]   = useState(false)
  const [statusDone,    setStatusDone]    = useState(false)

  // ── Toast ──
  const [toast, setToast] = useState('')
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500) }

  // ── Data operations ──
  function addPunkt(p) {
    onUpdate({ abschluss: { ...data, punkte: [p, ...punkte] } })
  }

  function updPunkt(id, changes) {
    onUpdate({ abschluss: { ...data, punkte: punkte.map(p => p.id === id ? { ...p, ...changes } : p) } })
  }

  function delPunkt(id) {
    onUpdate({ abschluss: { ...data, punkte: punkte.filter(p => p.id !== id) } })
  }

  function handleStatusChange(id, status) {
    updPunkt(id, {
      status,
      erledigtAm: status === 'erledigt' ? new Date().toISOString() : null,
    })
  }

  // ── KI-Capture ──
  async function handleCapture(text) {
    setIsCapturing(true)
    try {
      const parsed = await callClaude(PROMPT_CAPTURE, text)
      const kat = Object.keys(KATEGORIEN).includes(parsed.kategorie) ? parsed.kategorie : 'notiz'
      addPunkt({
        id:         'p' + Date.now().toString(36),
        kategorie:  kat,
        titel:      parsed.titel ?? text.slice(0, 60),
        konto:      parsed.konto ?? null,
        status:     'offen',
        notiz:      '',
        erstelltAm: new Date().toISOString(),
        erledigtAm: null,
      })
      showToast(`${KATEGORIEN[kat].icon} ${KATEGORIEN[kat].label} erfasst`)
    } finally {
      setIsCapturing(false)
    }
  }

  // ── Manuell hinzufügen ──
  function handleManualAdd() {
    if (!manTitel.trim()) return
    addPunkt({
      id:         'p' + Date.now().toString(36),
      kategorie:  manKat,
      titel:      manTitel.trim(),
      konto:      manKonto.trim() || null,
      status:     'offen',
      notiz:      manNotiz.trim(),
      erstelltAm: new Date().toISOString(),
      erledigtAm: null,
    })
    setManTitel(''); setManKonto(''); setManNotiz('')
    setShowManual(false)
    showToast(`${KATEGORIEN[manKat].icon} Punkt hinzugefügt`)
  }

  // ── E-Mail generieren ──
  async function generateEmail() {
    if (offeneRueckf.length === 0) { showToast('⚠ Keine offenen Rückfragen vorhanden.'); return }
    setIsGenEmail(true); setEmailBetreff(''); setEmailText('')
    try {
      const liste = offeneRueckf.map((p, i) => {
        let line = `${i + 1}. ${p.titel}`
        if (p.konto) line += ` (Konto ${p.konto})`
        if (p.notiz) line += `: ${p.notiz}`
        return line
      }).join('\n')
      const userText = `Erstelle eine E-Mail an den Mandanten "${client.name}". Folgende Punkte müssen geklärt werden:\n\n${liste}`
      const parsed = await callClaude(PROMPT_EMAIL, userText)
      setEmailBetreff(parsed.betreff ?? '')
      setEmailText(parsed.text ?? '')
      setStatusDone(false)
    } catch (e) {
      showToast('⚠ ' + e.message)
    } finally {
      setIsGenEmail(false)
    }
  }

  // ── An Status übergeben ──
  function uebergebenAnStatus() {
    const komm = client.kommunikation ?? { events: [] }
    onUpdate({
      kommunikation: {
        ...komm,
        events: [
          {
            id:       'e' + Date.now().toString(36),
            typ:      'rueckfragen',
            datum:    new Date().toISOString(),
            notiz:    `Rückfragen aus Abschluss gesendet (${offeneRueckf.length} Punkte)`,
            reminder: null,
          },
          ...(komm.events ?? []),
        ]
      }
    })
    setStatusDone(true)
    showToast('✅ Status auf „Warte auf Rückmeldung" gesetzt')
  }

  // ── Kopieren ──
  function copyEmail() {
    const full = `Betreff: ${emailBetreff}\n\n${emailText}`
    navigator.clipboard.writeText(full).then(() => {
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2000)
    })
  }

  // ── Filtered & sorted punkte ──
  const filtered = punkte
    .filter(p => {
      if (filterStatus === 'offen'    && p.status === 'erledigt') return false
      if (filterStatus === 'erledigt' && p.status !== 'erledigt') return false
      if (filterKat && p.kategorie !== filterKat) return false
      if (filterKonto && !(p.konto ?? '').includes(filterKonto) && !p.titel.toLowerCase().includes(filterKonto.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      // erledigt ans Ende
      if (a.status !== 'erledigt' && b.status === 'erledigt') return -1
      if (a.status === 'erledigt' && b.status !== 'erledigt') return 1
      return new Date(b.erstelltAm) - new Date(a.erstelltAm)
    })

  const iStyle = {
    padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px',
    background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box',
  }

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '10px 16px', boxShadow: 'var(--shadow-lg)', fontSize: '13px', zIndex: 2000, maxWidth: '400px' }}>
          {toast}
        </div>
      )}

      {/* ── Inner Tab-Switcher ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface2)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
        {[
          { idx: 0, label: '🔍 Prüfcheckliste', badge: offeneChecklisteRQ > 0 ? offeneChecklisteRQ : null },
          { idx: 1, label: '📝 Schnellerfassung' },
        ].map(t => (
          <button key={t.idx} onClick={() => setInnerTab(t.idx)} style={{
            flex: 1, padding: '7px 12px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: innerTab === t.idx ? 700 : 400,
            background: innerTab === t.idx ? 'var(--surface)' : 'transparent',
            color: innerTab === t.idx ? 'var(--text)' : 'var(--text-muted)',
            boxShadow: innerTab === t.idx ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}>
            {t.label}
            {t.badge && <span style={{ background: '#d97706', color: '#fff', borderRadius: '10px', padding: '0 6px', fontSize: '10px', fontWeight: 700 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ── Prüfcheckliste (neue Tab) ─────────────────────────────────── */}
      {innerTab === 0 && <ChecklisteView client={client} onUpdate={onUpdate} />}

      {/* ── Schnellerfassung (bisherige Logik, nur wenn Tab 1 aktiv) ─── */}
      {innerTab === 1 && <>

      {/* ── Fortschrittsbalken ─────────────────────────────────────── */}
      {total > 0 && (
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Fortschritt</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {erledigtN} von {total} erledigt
            </span>
            {offeneRueckf.length > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 8px', borderRadius: '10px' }}>
                {offeneRueckf.length} offene Rückfrage{offeneRueckf.length !== 1 ? 'n' : ''}
              </span>
            )}
          </div>
          <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '3px', transition: 'width 0.4s ease',
              background: erledigtN === total ? '#16a34a' : 'var(--accent)',
              width: `${total > 0 ? Math.round((erledigtN / total) * 100) : 0}%`,
            }} />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
            {Object.entries(KATEGORIEN).map(([key, cfg]) => {
              const n = punkte.filter(p => p.kategorie === key && p.status !== 'erledigt').length
              if (!n) return null
              return (
                <span key={key} style={{ fontSize: '11px', color: cfg.color, fontWeight: 600 }}>
                  {cfg.icon} {n} {cfg.label}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Quick Capture ─────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px' }}>🎯</span>
          <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Quick Capture</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sprechen oder tippen – KI kategorisiert automatisch</span>
          <button
            onClick={() => setShowManual(s => !s)}
            style={{ padding: '3px 12px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer', border: '1px solid var(--border)', background: showManual ? 'var(--surface2)' : 'none', color: 'var(--text-secondary)' }}
          >
            ✏️ Manuell
          </button>
        </div>

        <VoiceCapture onCapture={handleCapture} isProcessing={isCapturing} />

        {/* Manuelles Formular */}
        {showManual && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Manuell hinzufügen</div>

            {/* Kategorie-Chips */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {Object.entries(KATEGORIEN).map(([key, cfg]) => (
                <button key={key} onClick={() => setManKat(key)} style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '4px 12px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
                  border: `1.5px solid ${manKat === key ? cfg.color : 'var(--border)'}`,
                  background: manKat === key ? cfg.color + '18' : 'transparent',
                  color: manKat === key ? cfg.color : 'var(--text-muted)',
                  fontWeight: manKat === key ? 700 : 400,
                }}>
                  {cfg.icon} {cfg.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: '200px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>Titel *</label>
                <input type="text" value={manTitel} onChange={e => setManTitel(e.target.value)} placeholder="Kurze Beschreibung…" style={{ ...iStyle, width: '100%' }} onKeyDown={e => e.key === 'Enter' && handleManualAdd()} autoFocus />
              </div>
              <div style={{ width: '100px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>Konto (opt.)</label>
                <input type="text" value={manKonto} onChange={e => setManKonto(e.target.value)} placeholder="z.B. 4830" style={{ ...iStyle, width: '100%' }} />
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>Notiz (opt.)</label>
                <input type="text" value={manNotiz} onChange={e => setManNotiz(e.target.value)} placeholder="Details…" style={{ ...iStyle, width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn btn-primary btn-sm" onClick={handleManualAdd} disabled={!manTitel.trim()} style={{ fontWeight: 600 }}>✓ Hinzufügen</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowManual(false)}>✕ Abbrechen</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Filterliste ────────────────────────────────────────────── */}
      {total > 0 && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Status-Filter */}
          <div style={{ display: 'flex', gap: '3px' }}>
            {[
              { key: 'offen',    label: `Offen (${punkte.filter(p => p.status !== 'erledigt').length})` },
              { key: 'erledigt', label: `Erledigt (${erledigtN})` },
              { key: 'alle',     label: `Alle (${total})` },
            ].map(f => (
              <button key={f.key} onClick={() => setFilterStatus(f.key)} style={{
                padding: '4px 12px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
                border: `1px solid ${filterStatus === f.key ? 'var(--accent)' : 'var(--border)'}`,
                background: filterStatus === f.key ? 'var(--accent-dim)' : 'transparent',
                color: filterStatus === f.key ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: filterStatus === f.key ? 700 : 400,
              }}>{f.label}</button>
            ))}
          </div>

          {/* Kategorie-Filter */}
          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
            <button onClick={() => setFilterKat(null)} style={{
              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
              border: `1px solid ${!filterKat ? 'var(--accent)' : 'var(--border)'}`,
              background: !filterKat ? 'var(--accent-dim)' : 'transparent',
              color: !filterKat ? 'var(--accent)' : 'var(--text-muted)',
            }}>Alle Kategorien</button>
            {Object.entries(KATEGORIEN).map(([key, cfg]) => {
              const n = punkte.filter(p => p.kategorie === key).length
              if (!n) return null
              return (
                <button key={key} onClick={() => setFilterKat(filterKat === key ? null : key)} style={{
                  padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
                  border: `1px solid ${filterKat === key ? cfg.color : 'var(--border)'}`,
                  background: filterKat === key ? cfg.color + '18' : 'transparent',
                  color: filterKat === key ? cfg.color : 'var(--text-muted)',
                  fontWeight: filterKat === key ? 700 : 400,
                }}>{cfg.icon} {n}</button>
              )
            })}
          </div>

          {/* Konto-Suche */}
          <input
            type="text"
            value={filterKonto}
            onChange={e => setFilterKonto(e.target.value)}
            placeholder="🔎 Konto / Suche"
            style={{ ...iStyle, width: '140px', padding: '4px 10px' }}
          />
        </div>
      )}

      {/* ── Punkte-Liste ────────────────────────────────────────────── */}
      <div>
        {total === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '2px dashed var(--border)' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.35 }}>📋</div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-muted)', marginBottom: '6px' }}>Noch keine Punkte erfasst</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', opacity: 0.7 }}>
              Sprechen oder schreiben Sie oben – KI erfasst und kategorisiert automatisch.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            Keine Punkte entsprechen dem Filter.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map(punkt => (
              <PunktKarte
                key={punkt.id}
                punkt={punkt}
                onStatusChange={handleStatusChange}
                onDelete={delPunkt}
                onNotizChange={(id, notiz) => updPunkt(id, { notiz })}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── E-Mail-Generator ─────────────────────────────────────────── */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <button
          onClick={() => setShowEmail(s => !s)}
          style={{ width: '100%', padding: '10px 14px', background: 'var(--surface)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}
        >
          <span style={{ fontSize: '15px' }}>📧</span>
          <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>E-Mail an Mandant erstellen</span>
          {offeneRueckf.length > 0 && (
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 8px', borderRadius: '10px' }}>
              {offeneRueckf.length} offene Rückfrage{offeneRueckf.length !== 1 ? 'n' : ''}
            </span>
          )}
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{showEmail ? '▲' : '▼'}</span>
        </button>

        {showEmail && (
          <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
            {offeneRueckf.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Keine offenen Rückfragen vorhanden. Punkte mit der Kategorie „Rückfrage Mandant" hier erfassen.
              </div>
            ) : (
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Liste der Rückfragen */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Basis für die E-Mail ({offeneRueckf.length} Punkte)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
                    {offeneRueckf.map((p, i) => (
                      <div key={p.id} style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        {i + 1}. {p.titel}{p.konto ? ` (Kto. ${p.konto})` : ''}{p.notiz ? ` · ${p.notiz}` : ''}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={generateEmail}
                  disabled={isGenEmail}
                  className="btn btn-primary"
                  style={{ fontWeight: 700, fontSize: '13px' }}
                >
                  {isGenEmail ? '⏳ KI formuliert E-Mail…' : '✨ E-Mail generieren'}
                </button>

                {/* Generierte E-Mail */}
                {emailText && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Betreff</label>
                      <input
                        type="text"
                        value={emailBetreff}
                        onChange={e => setEmailBetreff(e.target.value)}
                        style={{ ...iStyle, width: '100%', fontWeight: 600 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>E-Mail-Text</label>
                      <textarea
                        value={emailText}
                        onChange={e => setEmailText(e.target.value)}
                        rows={10}
                        style={{ ...iStyle, width: '100%', lineHeight: 1.6, resize: 'vertical' }}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        className={`btn btn-sm ${emailCopied ? 'btn-success' : 'btn-primary'}`}
                        onClick={copyEmail}
                        style={{ fontWeight: 600 }}
                      >
                        {emailCopied ? '✓ Kopiert!' : '📋 E-Mail kopieren'}
                      </button>

                      <button
                        className={`btn btn-sm ${statusDone ? 'btn-success' : 'btn-ghost'}`}
                        onClick={uebergebenAnStatus}
                        disabled={statusDone}
                        style={{ fontWeight: 600, borderColor: statusDone ? '#16a34a' : 'rgba(37,99,235,0.4)', color: statusDone ? '#16a34a' : 'var(--accent)' }}
                        title="Erstellt einen Timeline-Eintrag im Reiter 'Status & Arbeit' mit Status 'Warte auf Rückmeldung'"
                      >
                        {statusDone ? '✅ Status aktualisiert' : '📊 An Status übergeben'}
                      </button>

                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>
                        → setzt Status auf „Warte auf Rückmeldung"
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      </>} {/* end innerTab === 1 */}

      <style>{`
        @keyframes pulseRec {
          0%, 100% { box-shadow: 0 0 0 5px rgba(239,68,68,0.25); }
          50%       { box-shadow: 0 0 0 10px rgba(239,68,68,0.06); }
        }
      `}</style>
    </div>
  )
}
