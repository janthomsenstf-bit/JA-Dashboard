import { useState, useMemo, useRef, useEffect } from 'react'
import JAComposePanel from './JAComposePanel.jsx'
import { buildDoc, downloadPdf, pdfFilename, pdfToBase64 } from '../../utils/ustRegPdf.js'
import { callApi, getMandantPath, openAuthPopup } from '../../utils/onedriveClient.js'

// ── Konfiguration (auch von AuftragKontextPanel genutzt) ──────────────────────
export const AUFTRAGS_TYP_CFG = {
  jahresabschluss: { label: 'Jahresabschluss', icon: '📁', color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.25)' },
  fibu:            { label: 'Buchhaltung/FIBU', icon: '📒', color: '#0891b2', bg: 'rgba(8,145,178,0.08)',  border: 'rgba(8,145,178,0.25)' },
  lohn:            { label: 'Lohn',             icon: '💼', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)' },
  beratung:        { label: 'Beratung',          icon: '🧠', color: '#16a34a', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.25)' },
  ust:             { label: 'Umsatzsteuer',      icon: '🧾', color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)' },
  erfassung:       { label: 'Steuerl. Erfassung', icon: '🏛', color: '#0d9488', bg: 'rgba(13,148,136,0.08)', border: 'rgba(13,148,136,0.25)' },
  ust_reg_de:      { label: 'USt-Reg. DE',        icon: '🇩🇪', color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.25)', gruppe: 'etablering' },
  ust_reg_se:      { label: 'USt-Reg. SE',        icon: '🇸🇪', color: '#0891b2', bg: 'rgba(8,145,178,0.08)',  border: 'rgba(8,145,178,0.25)', gruppe: 'etablering' },
  ust_reg_no:      { label: 'USt-Reg. NO',        icon: '🇳🇴', color: '#dc2626', bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.25)', gruppe: 'etablering' },
  ust_reg_dk:      { label: 'USt-Reg. DK',        icon: '🇩🇰', color: '#dc2626', bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.25)', gruppe: 'etablering' },
  ug_gruendung:    { label: 'UG-Gründung',        icon: '🏢', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.25)', gruppe: 'etablering' },
  gmbh_gruendung:  { label: 'GmbH-Gründung',      icon: '🏛', color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.25)', gruppe: 'etablering' },
  vorratsgesell:   { label: 'Vorratsgesellschaft', icon: '📦', color: '#d97706', bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.25)', gruppe: 'etablering' },
  geschaeftsadresse:{ label: 'Geschäftsadresse',   icon: '📍', color: '#0f766e', bg: 'rgba(15,118,110,0.08)', border: 'rgba(15,118,110,0.25)', gruppe: 'etablering' },
  easy_b2b:        { label: 'Easy-B2B',            icon: '🤝', color: '#16a34a', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.25)', gruppe: 'etablering' },
  liquidation:     { label: 'Liquidation',         icon: '🔚', color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)', gruppe: 'etablering' },
  freitext:        { label: 'Eigener Auftrag',   icon: '📝', color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.25)' },
}

export const AUFTRAGS_STATUS_CFG = {
  offen:          { label: 'Offen',          icon: '○', color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.3)' },
  in_bearbeitung: { label: 'In Bearbeitung', icon: '◑', color: '#2563eb', bg: 'rgba(37,99,235,0.09)',  border: 'rgba(37,99,235,0.3)' },
  erledigt:       { label: 'Erledigt',       icon: '●', color: '#16a34a', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.3)' },
}

const MONATE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
const STATUS_ORDER = ['offen', 'in_bearbeitung', 'erledigt']

// ── JA-spezifischer Workflow-Status (11 Stufen) ────────────────────────────────
export const JA_WORKFLOW_STATUS = {
  neu:                   { label: 'Neu',                     icon: '🆕', color: '#64748b', bg: 'rgba(100,116,139,0.1)',  border: 'rgba(100,116,139,0.3)'  },
  in_bearbeitung:        { label: 'In Bearbeitung',          icon: '🔧', color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.3)'   },
  rueckfragen_erstellt:  { label: 'Rückfragen erstellt',     icon: '📋', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.3)'  },
  rueckfragen_versendet: { label: 'Rückfragen versendet',    icon: '📤', color: '#0891b2', bg: 'rgba(8,145,178,0.08)',  border: 'rgba(8,145,178,0.3)'   },
  warte_rueckmeldung:    { label: 'Warte auf Rückmeldung',   icon: '⏳', color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)'  },
  unterlagen_erhalten:   { label: 'Unterlagen erhalten',     icon: '📬', color: '#16a34a', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.3)'   },
  entwurf_erstellt:      { label: 'Entwurf erstellt',        icon: '📝', color: '#0891b2', bg: 'rgba(8,145,178,0.08)',  border: 'rgba(8,145,178,0.3)'   },
  an_mandant_gesendet:   { label: 'An Mandanten gesendet',   icon: '📨', color: '#0f766e', bg: 'rgba(15,118,110,0.08)', border: 'rgba(15,118,110,0.3)'  },
  warte_unterschrift:    { label: 'Warte auf Unterschrift',  icon: '✍️', color: '#d97706', bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.3)'   },
  an_fa_gesendet:        { label: 'An Finanzamt gesendet',   icon: '🏛',  color: '#2563eb', bg: 'rgba(37,99,235,0.08)',  border: 'rgba(37,99,235,0.3)'   },
  abgeschlossen:         { label: 'Abgeschlossen',           icon: '✅', color: '#16a34a', bg: 'rgba(22,163,74,0.1)',   border: 'rgba(22,163,74,0.3)'   },
}

// ── Honorar-Typen ─────────────────────────────────────────────────────────────
const HONORAR_TYPEN = [
  { key: 'pauschale',   label: 'Pauschale'              },
  { key: 'festpreis',   label: 'Festpreis'              },
  { key: 'stunden',     label: 'Stundenhonorar'         },
  { key: 'individuell', label: 'Individuelle Vereinbarung' },
]

// ── Verlauf-Typen (interne Ereignisse am Auftrag) ─────────────────────────────
const VERLAUF_TYPEN = {
  rueckfragen:       { label: 'Rückfragen gesendet',    icon: '📤', color: '#2563eb' },
  erinnerung:        { label: 'Erinnerung gesendet',    icon: '🔔', color: '#f97316' },
  antwort:           { label: 'Antwort / Unterlagen erhalten', icon: '💬', color: '#16a34a' },
  vollstaendigkeit:  { label: 'Vollständigkeitserklärung erhalten', icon: '📋', color: '#0f766e' },
  telefonat:         { label: 'Telefonat / Persönlich', icon: '📞', color: '#7c3aed' },
  ste_mandant:       { label: 'Steuererklärung an Mandant gesendet', icon: '✍️', color: '#0f766e' },
  ste_fa:            { label: 'Steuererklärung ans Finanzamt', icon: '🏛', color: '#0891b2' },
  ebilanz:           { label: 'E-Bilanz versendet',     icon: '📊', color: '#2563eb' },
  offenlegung:       { label: 'Offenlegung eingereicht', icon: '📰', color: '#7c3aed' },
  rechnung:          { label: 'Rechnung erstellt',      icon: '🧾', color: '#16a34a' },
  notiz:             { label: 'Interne Notiz',          icon: '📝', color: '#64748b' },
  meilenstein:       { label: 'Meilenstein',            icon: '🏁', color: '#2563eb' },
}

function TypOptions() {
  const kanzlei = Object.entries(AUFTRAGS_TYP_CFG).filter(([, v]) => !v.gruppe)
  const etab    = Object.entries(AUFTRAGS_TYP_CFG).filter(([, v]) => v.gruppe === 'etablering')
  return (
    <>
      <optgroup label="Kanzlei">
        {kanzlei.map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
      </optgroup>
      <optgroup label="Etablering / International">
        {etab.map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
      </optgroup>
    </>
  )
}

function genVerlaufId() { return 'vl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }
function todayISO() { return new Date().toISOString().slice(0, 10) }
function fmtShortDate(iso) {
  if (!iso) return '–'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
}

const NOTIZ_API_KEY = 'sda-claude-api-key'
function loadNotizApiKey() { return (localStorage.getItem(NOTIZ_API_KEY) ?? '').replace(/\s/g, '') }

async function callClaudeNotiz(apiKey, systemPrompt, userText) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 800, system: systemPrompt, messages: [{ role: 'user', content: userText }] }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  let raw = data.content?.[0]?.text ?? ''
  const m = raw.match(/\{[\s\S]*\}/)
  if (m) return JSON.parse(m[0])
  return { text: raw.trim() }
}

// ── Diktat-Widget für Notizfelder ─────────────────────────────────────────────
function NotizDiktatWidget({ value, onChange, placeholder = 'Interne Anmerkungen…', rows = 2, inputStyle }) {
  const [isRecording,  setIsRecording]  = useState(false)
  const [transcript,   setTranscript]   = useState('')
  const [interimText,  setInterimText]  = useState('')
  const [kiLoading,    setKiLoading]    = useState(false)
  const [kiDone,       setKiDone]       = useState(false)
  const [error,        setError]        = useState('')
  const [showDiktat,   setShowDiktat]   = useState(false)
  const recRef         = useRef(null)
  const transcriptRef  = useRef('')

  const SpeechRec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  const voiceOk   = !!SpeechRec

  function setTBoth(val) {
    const v = typeof val === 'function' ? val(transcriptRef.current) : val
    transcriptRef.current = v; setTranscript(v)
  }

  useEffect(() => () => recRef.current?.stop(), [])

  function toggleRecording() {
    if (isRecording) {
      recRef.current?.stop(); setIsRecording(false); setInterimText('')
      if (transcriptRef.current.trim()) processTranscript(transcriptRef.current)
      return
    }
    const apiKey = loadNotizApiKey()
    if (!apiKey) { setError('Claude API-Schlüssel fehlt (Stammdaten → ⚙️).'); return }
    if (!SpeechRec) { setError('Spracherkennung nicht verfügbar (Chrome).'); return }
    setTBoth(''); setInterimText(''); setKiDone(false); setError('')
    const rec = new SpeechRec()
    rec.lang = 'de-DE'; rec.continuous = true; rec.interimResults = true
    rec.onresult = e => {
      let fin = '', itr = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + ' '
        else itr += e.results[i][0].transcript
      }
      if (fin) setTBoth(t => t.trimEnd() ? t.trimEnd() + ' ' + fin : fin)
      setInterimText(itr)
    }
    rec.onend   = () => { setIsRecording(false); setInterimText('') }
    rec.onerror = () => { setIsRecording(false); setInterimText(''); setError('Mikrofon-Fehler.') }
    rec.start(); recRef.current = rec; setIsRecording(true)
  }

  async function processTranscript(text, formatHint = 'fliesstext') {
    const apiKey = loadNotizApiKey()
    if (!apiKey || !text.trim()) return
    setKiLoading(true); setError('')
    const systemPrompts = {
      fliesstext:   'Du bist Steuerberater-Assistent. Wandle gesprochenen Text in einen sauberen, professionellen internen Arbeitsvermerk um. Kein Briefformat, keine Anrede. Klarer Fließtext mit sinnvollen Absätzen. Antworte NUR mit JSON: {"text":"..."}',
      stichpunkte:  'Du bist Steuerberater-Assistent. Wandle gesprochenen Text in prägnante Stichpunkte um (mit • Zeichen). Antworte NUR mit JSON: {"text":"..."}',
      todo:         'Du bist Steuerberater-Assistent. Wandle gesprochenen Text in eine To-do-Liste um (mit ☐ Zeichen). Antworte NUR mit JSON: {"text":"..."}',
      rueckfrage:   'Du bist Steuerberater-Assistent. Wandle gesprochenen Text in nummerierte Rückfragen an den Mandanten um (höflich, klar). Antworte NUR mit JSON: {"text":"..."}',
    }
    try {
      const result = await callClaudeNotiz(apiKey, systemPrompts[formatHint] ?? systemPrompts.fliesstext, text.trim())
      const newText = result.text ?? text
      // An bestehende Notiz anhängen (mit Trenner wenn bereits Text vorhanden)
      const existing = (value ?? '').trim()
      const now = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const prefix = existing ? `${existing}\n\n[${now}] ` : `[${now}] `
      onChange(prefix + newText)
      setKiDone(true)
    } catch (err) {
      setError('KI-Fehler: ' + err.message)
    } finally {
      setKiLoading(false)
    }
  }

  const labelS = { fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {/* Label + Diktat-Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={labelS}>Notiz / Kontext</span>
        <button
          onClick={() => setShowDiktat(v => !v)}
          title="Diktat: Gedanken sprechen → KI erstellt sauberen Vermerk"
          style={{
            padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${showDiktat ? 'rgba(239,68,68,0.4)' : 'rgba(8,145,178,0.3)'}`,
            background: showDiktat ? 'rgba(239,68,68,0.08)' : 'rgba(8,145,178,0.06)',
            color: showDiktat ? '#ef4444' : '#0891b2',
            animation: isRecording ? 'pulseDiktat 1.2s ease-in-out infinite' : 'none',
          }}
        >
          {isRecording ? '⏹ Aufnahme…' : '🎤 Diktat'}
        </button>
      </div>

      {/* Diktat-Bereich (ausklappbar) */}
      {showDiktat && (
        <div style={{ padding: '10px 12px', borderRadius: '8px', background: isRecording ? 'rgba(239,68,68,0.05)' : 'rgba(8,145,178,0.04)', border: `1px solid ${isRecording ? 'rgba(239,68,68,0.25)' : 'rgba(8,145,178,0.2)'}`, marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: transcript || isRecording || kiLoading ? '8px' : '0' }}>
            <button
              onClick={toggleRecording}
              disabled={kiLoading}
              style={{
                width: '36px', height: '36px', borderRadius: '50%', border: 'none', flexShrink: 0,
                background: isRecording ? '#ef4444' : '#0891b2', color: '#fff', fontSize: '16px', cursor: 'pointer',
                boxShadow: isRecording ? '0 0 0 5px rgba(239,68,68,0.2)' : 'none',
                animation: isRecording ? 'pulseDiktat 1.2s ease-in-out infinite' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {isRecording ? '⏹' : kiLoading ? '⏳' : '🎤'}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: isRecording ? '#ef4444' : kiLoading ? '#7c3aed' : '#0891b2' }}>
                {isRecording ? '● Aufnahme läuft – sprechen Sie frei…' : kiLoading ? 'KI strukturiert Notiz…' : 'Diktat starten'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                {isRecording ? 'Stopp → automatische Aufbereitung' : 'Gedanken / Gesprächsnotizen einfach sprechen'}
              </div>
            </div>
            {transcript.trim() && !isRecording && !kiLoading && (
              <button
                onClick={() => processTranscript(transcript, 'fliesstext')}
                style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#0891b2', color: '#fff', fontSize: '10px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
              >
                ✨ Verarbeiten
              </button>
            )}
          </div>

          {/* Transcript */}
          {(transcript || isRecording) && (
            <div style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border)', fontSize: '11px', lineHeight: 1.6, marginBottom: '8px', color: 'var(--text)', minHeight: '32px' }}>
              {transcript}
              {interimText && <span style={{ opacity: 0.5, fontStyle: 'italic', color: '#ef4444' }}>{transcript ? ' ' : ''}{interimText}</span>}
            </div>
          )}

          {/* Format-Buttons (nach Aufnahme) */}
          {transcript.trim() && !isRecording && !kiLoading && (
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {[
                { key: 'fliesstext',  label: '📝 Fließtext' },
                { key: 'stichpunkte', label: '• Stichpunkte' },
                { key: 'todo',        label: '☐ To-do-Liste' },
                { key: 'rueckfrage',  label: '❓ Rückfragen' },
              ].map(f => (
                <button key={f.key} onClick={() => processTranscript(transcript, f.key)}
                  style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '10px', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#0891b2'; e.currentTarget.style.color = '#0891b2' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {kiDone && (
            <div style={{ fontSize: '10px', color: '#16a34a', marginTop: '6px', fontWeight: 600 }}>
              ✓ Diktat wurde zur Notiz hinzugefügt
            </div>
          )}
          {error && (
            <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '6px' }}>⚠ {error}</div>
          )}
        </div>
      )}

      {/* Notiz-Textarea */}
      <textarea value={value ?? ''} rows={rows} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />

      <style>{`
        @keyframes pulseDiktat {
          0%,100% { box-shadow: 0 0 0 5px rgba(239,68,68,0.2); }
          50%      { box-shadow: 0 0 0 10px rgba(239,68,68,0.04); }
        }
      `}</style>
    </div>
  )
}

// ── Jahresabschluss-Checkliste ──────────────────────────────────────────────────
const JA_CHECKLISTE_ITEMS = [
  { key: 'est',         label: 'Einkommensteuererklärung',    col1: 'an Mandant gesendet', col2: 'ans Finanzamt gesendet' },
  { key: 'gewst',       label: 'Gewerbesteuererklärung',      col1: 'an Mandant gesendet', col2: 'ans Finanzamt gesendet' },
  { key: 'kst',         label: 'Körperschaftsteuererklärung', col1: 'an Mandant gesendet', col2: 'ans Finanzamt gesendet' },
  { key: 'ust',         label: 'Umsatzsteuererklärung',       col1: 'an Mandant gesendet', col2: 'ans Finanzamt gesendet' },
  { key: 'ebilanz',     label: 'E-Bilanz',                    col1: 'an Mandant gesendet', col2: 'übermittelt' },
  { key: 'offenlegung', label: 'Offenlegung',                 col1: 'an Mandant gesendet', col2: 'offengelegt' },
  { key: 'rechnung',    label: 'Rechnung',                    col1: null,                   col2: 'an Mandant gesendet' },
]

// ── Batch-Serien (Feature 4): Mehrere Einzelaufträge auf einmal anlegen ───────
const SERIE_RHYTHMUS = [
  { key: 'monatlich',     label: 'Monatlich (12×)',    monate: [1,2,3,4,5,6,7,8,9,10,11,12] },
  { key: 'quartalsweise', label: 'Quartalsweise (4×)', monate: [3,6,9,12] },
  { key: 'halbjaehrlich', label: 'Halbjährlich (2×)',  monate: [6,12] },
  { key: 'jaehrlich',     label: 'Jährlich (1×)',      monate: [12] },
]

const FRIST_DEFAULTS = {
  lohn:            { modus: 'gleicher',   tag: 22 },
  fibu:            { modus: 'folgemonat', tag: 10 },
  ust:             { modus: 'folgemonat', tag: 10 },
  jahresabschluss: { modus: 'kein',       tag: 1  },
  beratung:        { modus: 'kein',       tag: 1  },
  freitext:        { modus: 'kein',       tag: 1  },
}

function calcFrist(ljahr, lmonat, modus, tag, tage) {
  if (modus === 'kein') return ''
  if (modus === 'tage') {
    const lastDay = new Date(ljahr, lmonat, 0)
    lastDay.setDate(lastDay.getDate() + (tage || 0))
    return lastDay.toISOString().slice(0, 10)
  }
  let fJahr = ljahr; let fMonat = lmonat
  if (modus === 'folgemonat') {
    fMonat++
    if (fMonat > 12) { fMonat = 1; fJahr++ }
  }
  const maxDay = new Date(fJahr, fMonat, 0).getDate()
  const d      = Math.min(Math.max(1, tag || 1), maxDay)
  return `${fJahr}-${String(fMonat).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ── Wiederholungslogik (Feature 5): Echter Serienauftrag ──────────────────────
export const INTERVALL_TYPEN = [
  { key: 'tage',     label: 'Tag(e)',      short: 'täglich'       },
  { key: 'wochen',   label: 'Woche(n)',    short: 'wöchentlich'   },
  { key: 'monate',   label: 'Monat(e)',    short: 'monatlich'     },
  { key: 'quartale', label: 'Quartal(e)',  short: 'quartalsweise' },
  { key: 'jahre',    label: 'Jahr(e)',     short: 'jährlich'      },
]

/**
 * Berechnet das nächste Datum basierend auf Intervalltyp und -wert.
 * Gibt immer ein neues Date-Objekt zurück.
 */
export function addIntervalDate(date, typ, wert) {
  const d = new Date(date)
  const n = wert || 1
  if (typ === 'tage')     { d.setDate(d.getDate() + n);                 return d }
  if (typ === 'wochen')   { d.setDate(d.getDate() + n * 7);             return d }
  if (typ === 'monate')   { d.setMonth(d.getMonth() + n);               return d }
  if (typ === 'quartale') { d.setMonth(d.getMonth() + n * 3);           return d }
  if (typ === 'jahre')    { d.setFullYear(d.getFullYear() + n);         return d }
  return d
}

/**
 * Generiert alle Instanzen eines Serienauftrags.
 * Für endTyp='kein' werden Instanzen bis 93 Tage in die Zukunft erzeugt.
 *
 * @param {object} au          – Auftrag mit istSerie=true und au.serie config
 * @param {number} maxInstances – Sicherheits-Cap
 * @returns {Array<{key:string, datum:Date, status:string, erledigtAm:string|null}>}
 */
export function generateSerieInstanzen(au, maxInstances = 300) {
  const serie = au.serie
  if (!serie || !serie.startDatum) return []

  const instanzenMap = au.instanzen ?? {}
  const heute    = new Date(); heute.setHours(0, 0, 0, 0)
  const horizont = new Date(heute); horizont.setDate(horizont.getDate() + 93)  // ~3 Monate

  const ergebnis = []
  let current = new Date(serie.startDatum + 'T00:00:00')
  let count   = 0

  while (count < maxInstances) {
    // Ende-Bedingung prüfen
    if (serie.endTyp === 'datum' && serie.endDatum) {
      if (current > new Date(serie.endDatum + 'T23:59:59')) break
    } else if (serie.endTyp === 'anzahl') {
      if (count >= (serie.endAnzahl || 12)) break
    } else {
      // 'kein' oder default: bis Horizont
      if (current > horizont) break
    }

    const key     = current.toISOString().slice(0, 10)
    const instanz = instanzenMap[key] ?? {}
    ergebnis.push({
      key,
      datum:      new Date(current),
      status:     instanz.status     ?? 'offen',
      erledigtAm: instanz.erledigtAm ?? null,
    })

    current = addIntervalDate(current, serie.intervallTyp || 'monate', serie.intervallWert || 1)
    count++
  }

  return ergebnis
}

/**
 * Gibt einen lesbaren Label für das Wiederholungsintervall zurück.
 */
export function intervallLabel(serie) {
  if (!serie) return ''
  const wert = serie.intervallWert || 1
  const typ  = INTERVALL_TYPEN.find(t => t.key === serie.intervallTyp)
  if (!typ) return ''
  if (wert === 1) return typ.short.charAt(0).toUpperCase() + typ.short.slice(1)
  return `Alle ${wert} ${typ.label}`
}

// ── Factories ─────────────────────────────────────────────────────────────────
function mkAuftrag(typ = 'freitext') {
  const base = {
    id:          'au_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    typ,
    bezeichnung: '',
    jahr:        new Date().getFullYear(),
    monat:       null,
    frist:       '',
    status:      'offen',
    notiz:       '',
    hinweise:    [],
    verlauf:     [],
    erstelltAm:  new Date().toISOString(),
    erledigtAm:  null,
  }
  if (typ === 'jahresabschluss') {
    return {
      ...base,
      abschlussJahr:         new Date().getFullYear() - 1,  // Standard: Vorjahr
      jaWorkflowStatus:      'neu',
      jaWorkflowStatusDatum: todayISO(),
      honorar:               { typ: 'pauschale', betrag: '', notiz: '' },
    }
  }
  return base
}

function mkSerienauftrag(typ = 'fibu') {
  const heute      = new Date()
  const startDatum = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-01`
  return {
    id:          'au_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    typ,
    bezeichnung: '',
    istSerie:    true,
    serie: {
      startDatum,
      intervallTyp:  'monate',
      intervallWert: 1,
      endTyp:        'kein',
      endDatum:      '',
      endAnzahl:     12,
    },
    instanzen:  {},
    notiz:      '',
    erstelltAm: new Date().toISOString(),
  }
}

function mkHinweis(text) {
  return {
    id:        'h_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
    text,
    erledigt:  false,
    createdAt: new Date().toISOString(),
  }
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function fmtFrist(iso) {
  if (!iso) return null
  const d     = new Date(iso + 'T12:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff  = Math.ceil((d - today) / (1000 * 60 * 60 * 24))
  const ds    = `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
  if (diff < 0)   return { text: `${ds} (${Math.abs(diff)}d überfällig)`, color: '#ef4444' }
  if (diff === 0) return { text: `${ds} (heute)`,    color: '#f97316' }
  if (diff <= 7)  return { text: `${ds} (${diff}d)`, color: '#f97316' }
  if (diff <= 30) return { text: `${ds} (${diff}d)`, color: '#eab308' }
  return { text: ds, color: 'var(--text-muted)' }
}

function fmtDatumShort(d) {
  if (!d) return '—'
  const dt = d instanceof Date ? d : new Date(d + 'T00:00:00')
  return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`
}

// ── Shared Styles ─────────────────────────────────────────────────────────────
const labelStyle = { fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const inputStyle  = { padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', width: '100%', boxSizing: 'border-box' }

// ── Jahresabschluss-Checkliste-Komponente ─────────────────────────────────────
function JAChecklisteSection({ jaCheckliste = {}, onUpdate }) {
  const today = new Date().toISOString().slice(0, 10)

  function setDatum(itemKey, field, value) {
    const current = jaCheckliste[itemKey] ?? {}
    onUpdate({
      jaCheckliste: {
        ...jaCheckliste,
        [itemKey]: { ...current, [field]: value },
      },
    })
  }

  function toggleCheck(itemKey, field) {
    const current = jaCheckliste[itemKey] ?? {}
    const hasDatum = !!current[field]
    setDatum(itemKey, field, hasDatum ? '' : today)
  }

  const totalFields = JA_CHECKLISTE_ITEMS.reduce((n, it) => n + (it.col1 ? 1 : 0) + 1, 0)
  const doneFields = JA_CHECKLISTE_ITEMS.reduce((n, it) => {
    const d = jaCheckliste[it.key] ?? {}
    return n + (it.col1 && d.mandantDatum ? 1 : 0) + (d.faDatum ? 1 : 0)
  }, 0)
  const progress = totalFields > 0 ? Math.round((doneFields / totalFields) * 100) : 0

  const cellBase = { padding: '7px 8px', fontSize: '12px', borderBottom: '1px solid var(--border)' }
  const headerCell = { ...cellBase, fontWeight: 700, color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'var(--surface2)' }

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          📋 Abschluss-Checkliste
        </div>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: '10px', fontWeight: 700, padding: '2px 10px', borderRadius: '10px',
          background: progress === 100 ? 'rgba(22,163,74,0.12)' : progress > 0 ? 'rgba(37,99,235,0.08)' : 'var(--surface2)',
          color: progress === 100 ? '#16a34a' : progress > 0 ? '#2563eb' : 'var(--text-muted)',
          border: `1px solid ${progress === 100 ? 'rgba(22,163,74,0.3)' : progress > 0 ? 'rgba(37,99,235,0.25)' : 'var(--border)'}`,
        }}>
          {progress === 100 ? '✓ Vollständig' : `${doneFields}/${totalFields} erledigt`}
        </span>
      </div>

      {/* Fortschrittsbalken */}
      <div style={{ height: '4px', borderRadius: '2px', background: 'var(--surface2)', marginBottom: '12px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '2px', transition: 'width 0.3s',
          width: `${progress}%`,
          background: progress === 100 ? '#16a34a' : '#2563eb',
        }} />
      </div>

      {/* Tabelle */}
      <div style={{ borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...headerCell, textAlign: 'left', width: '35%' }}>Erklärung / Meldung</th>
              <th style={{ ...headerCell, textAlign: 'center', width: '32.5%' }}>an Mandant gesendet</th>
              <th style={{ ...headerCell, textAlign: 'center', width: '32.5%' }}>ans FA / erledigt</th>
            </tr>
          </thead>
          <tbody>
            {JA_CHECKLISTE_ITEMS.map((item, idx) => {
              const data = jaCheckliste[item.key] ?? {}
              const hasMandant = !!data.mandantDatum
              const hasFa = !!data.faDatum
              const isLast = idx === JA_CHECKLISTE_ITEMS.length - 1

              return (
                <tr key={item.key} style={{ background: (hasMandant || !item.col1) && hasFa ? 'rgba(22,163,74,0.03)' : 'transparent' }}>
                  {/* Label */}
                  <td style={{ ...cellBase, fontWeight: 500, color: 'var(--text)', borderBottom: isLast ? 'none' : cellBase.borderBottom }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {(hasMandant || !item.col1) && hasFa
                        ? <span style={{ color: '#16a34a', fontSize: '13px' }}>✓</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>○</span>
                      }
                      {item.label}
                    </div>
                  </td>

                  {/* Spalte 1: an Mandant */}
                  <td style={{ ...cellBase, textAlign: 'center', borderBottom: isLast ? 'none' : cellBase.borderBottom }}>
                    {item.col1 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <input
                          type="checkbox"
                          checked={hasMandant}
                          onChange={() => toggleCheck(item.key, 'mandantDatum')}
                          style={{ accentColor: '#2563eb', cursor: 'pointer', width: '14px', height: '14px' }}
                          title={item.col1}
                        />
                        <input
                          type="date"
                          value={data.mandantDatum || ''}
                          onChange={e => setDatum(item.key, 'mandantDatum', e.target.value)}
                          style={{
                            padding: '3px 6px', borderRadius: '5px', fontSize: '11px',
                            border: '1px solid var(--border)', background: hasMandant ? 'rgba(22,163,74,0.06)' : 'var(--surface2)',
                            color: hasMandant ? '#16a34a' : 'var(--text)', fontFamily: 'var(--font-mono)',
                            width: '120px',
                          }}
                        />
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                    )}
                  </td>

                  {/* Spalte 2: ans FA / erledigt */}
                  <td style={{ ...cellBase, textAlign: 'center', borderBottom: isLast ? 'none' : cellBase.borderBottom }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <input
                        type="checkbox"
                        checked={hasFa}
                        onChange={() => toggleCheck(item.key, 'faDatum')}
                        style={{ accentColor: '#16a34a', cursor: 'pointer', width: '14px', height: '14px' }}
                        title={item.col2}
                      />
                      <input
                        type="date"
                        value={data.faDatum || ''}
                        onChange={e => setDatum(item.key, 'faDatum', e.target.value)}
                        style={{
                          padding: '3px 6px', borderRadius: '5px', fontSize: '11px',
                          border: '1px solid var(--border)', background: hasFa ? 'rgba(22,163,74,0.06)' : 'var(--surface2)',
                          color: hasFa ? '#16a34a' : 'var(--text)', fontFamily: 'var(--font-mono)',
                          width: '120px',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
        Haken setzen → heutiges Datum wird automatisch eingetragen. Datum kann manuell angepasst werden.
      </div>
    </div>
  )
}

// ── JA: Workflow-Status-Sektion ───────────────────────────────────────────────
function JAStatusSection({ au, onUpdate }) {
  const current   = au.jaWorkflowStatus ?? 'neu'
  const currentCfg = JA_WORKFLOW_STATUS[current] ?? JA_WORKFLOW_STATUS.neu
  const statusDatum = au.jaWorkflowStatusDatum ?? ''

  function setStatus(key) {
    onUpdate({ jaWorkflowStatus: key, jaWorkflowStatusDatum: todayISO() })
  }

  return (
    <div style={{ marginBottom: '16px', padding: '12px 14px', background: currentCfg.bg, borderRadius: '8px', border: `1px solid ${currentCfg.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Status</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: currentCfg.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
          {currentCfg.icon} {currentCfg.label}
        </span>
        {statusDatum && (
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>seit {fmtShortDate(statusDatum)}</span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {Object.entries(JA_WORKFLOW_STATUS).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setStatus(key)}
            title={cfg.label}
            style={{
              padding: '3px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: key === current ? 700 : 400, cursor: 'pointer',
              border: `1px solid ${key === current ? cfg.color : 'var(--border)'}`,
              background: key === current ? cfg.bg : 'transparent',
              color: key === current ? cfg.color : 'var(--text-muted)',
            }}
          >
            {cfg.icon} {cfg.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── JA: Honorar-Sektion ───────────────────────────────────────────────────────
function JAHonorarSection({ au, onUpdate }) {
  const honorar = au.honorar ?? { typ: 'pauschale', betrag: '', notiz: '' }

  function updateHonorar(patch) {
    onUpdate({ honorar: { ...honorar, ...patch } })
  }

  const inputS = {
    padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)',
    background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', outline: 'none',
  }

  return (
    <div style={{ marginBottom: '14px', padding: '12px 14px', background: 'rgba(22,163,74,0.03)', borderRadius: '8px', border: '1px solid rgba(22,163,74,0.15)' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#16a34a', marginBottom: '10px' }}>
        💰 Vereinbartes Honorar
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <select value={honorar.typ} onChange={e => updateHonorar({ typ: e.target.value })} style={{ ...inputS, minWidth: '180px' }}>
          {HONORAR_TYPEN.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: '120px' }}>
          <input
            type="text"
            value={honorar.betrag}
            onChange={e => updateHonorar({ betrag: e.target.value })}
            placeholder={honorar.typ === 'stunden' ? 'Stundensatz z. B. 150' : 'Betrag z. B. 1.500'}
            style={{ ...inputS, flex: 1 }}
          />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {honorar.typ === 'stunden' ? '€/Std.' : '€'}
          </span>
        </div>
      </div>
      <input
        type="text"
        value={honorar.notiz}
        onChange={e => updateHonorar({ notiz: e.target.value })}
        placeholder="Notiz zur Honorarvereinbarung (optional)…"
        style={{ ...inputS, width: '100%', boxSizing: 'border-box' }}
      />
    </div>
  )
}

// ── JA: Verlauf-Sektion (interne Ereignisse + verknüpfte E-Mails) ─────────────
function JAVerlaufSection({ au, client, onUpdate, onOpenEmail, onUpdateClient, emailVorlagen, emailSignaturen, onedriveTokens, onUpdateOnedriveTokens }) {
  const verlauf    = au.verlauf ?? []
  const [selectedTyp, setSelectedTyp] = useState(null)
  const [newNotiz,    setNewNotiz]    = useState('')
  const [newDatum,    setNewDatum]    = useState(todayISO)
  const [showCompose, setShowCompose] = useState(false)

  // Verknüpfte E-Mails: Events aus globalem Kommunikation mit auftragId === au.id
  const linkedEmails = (client?.kommunikation?.events ?? [])
    .filter(ev => ev.auftragId === au.id)
    .sort((a, b) => new Date(b.erstelltAm ?? b.gesendetAm ?? 0) - new Date(a.erstelltAm ?? a.gesendetAm ?? 0))

  // Zusammenführen und chronologisch sortieren
  const allItems = [
    ...verlauf.map(v => ({ ...v, _source: 'intern' })),
    ...linkedEmails.map(ev => ({
      id: ev.id, _source: 'email',
      datum: ev.erstelltAm ?? ev.gesendetAm ?? '',
      text: `${ev.typ === 'eingehend' ? '📨 Empfangen' : '📤 Gesendet'}: ${ev.betreff ?? '(kein Betreff)'}`,
      absender: ev.absender ?? ev.empfaenger,
      eventId: ev.id,
    })),
  ].sort((a, b) => new Date(b.datum) - new Date(a.datum))

  function handleQuickAction(typ) {
    if (selectedTyp === typ) { setSelectedTyp(null); return }
    setSelectedTyp(typ)
    setNewDatum(todayISO())
    setNewNotiz('')
  }

  function addVerlauf() {
    if (!selectedTyp) return
    const cfg = VERLAUF_TYPEN[selectedTyp]
    const item = {
      id: genVerlaufId(),
      typ: selectedTyp,
      datum: newDatum,
      text: newNotiz.trim() || cfg.label,
      erstelltAm: new Date().toISOString(),
    }
    onUpdate({ verlauf: [item, ...verlauf] })
    setNewNotiz(''); setNewDatum(todayISO()); setSelectedTyp(null)
  }

  function deleteVerlauf(id) {
    onUpdate({ verlauf: verlauf.filter(v => v.id !== id) })
  }

  const iStyle = { padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', outline: 'none' }

  return (
    <div style={{ marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>

      {/* ═══════ HEADER ═══════ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
          📊 Verlauf & Aktivitäten
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--surface2)', padding: '1px 7px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          {allItems.length}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => { setShowCompose(v => !v); if (!showCompose) setSelectedTyp(null) }}
            style={{
              padding: '4px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 600,
              border: `1px solid ${showCompose ? 'var(--accent)' : 'rgba(8,145,178,0.3)'}`,
              background: showCompose ? 'rgba(8,145,178,0.1)' : 'rgba(8,145,178,0.05)',
              color: showCompose ? 'var(--accent)' : '#0891b2',
            }}
          >
            {showCompose ? '✕ Schließen' : '✉️ Neue E-Mail'}
          </button>
        </div>
      </div>

      {/* ═══════ COMPOSE-PANEL ═══════ */}
      {showCompose && (
        <div style={{ marginBottom: '14px' }}>
          <JAComposePanel
            au={au}
            client={client}
            emailVorlagen={emailVorlagen}
            emailSignaturen={emailSignaturen}
            onedriveTokens={onedriveTokens}
            onUpdateOnedriveTokens={onUpdateOnedriveTokens}
            onUpdateClient={onUpdateClient}
            onClose={() => setShowCompose(false)}
          />
        </div>
      )}

      {/* ═══════ AKTIVITÄT ERFASSEN ═══════ */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: '14px' }}>
        <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '13px' }}>➕ Aktivität erfassen</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>— per Schnellauswahl</span>
        </div>

        {/* Schnellauswahl-Chips */}
        <div style={{ padding: '12px 14px', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Object.entries(VERLAUF_TYPEN).map(([key, cfg]) => {
              const active = selectedTyp === key
              return (
                <button key={key} onClick={() => handleQuickAction(key)} style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
                  border: `1px solid ${active ? cfg.color : 'var(--border)'}`,
                  background: active ? cfg.color + '18' : 'var(--surface2)',
                  color: active ? cfg.color : 'var(--text-secondary)',
                  fontSize: '12px', fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s',
                  boxShadow: active ? `0 0 0 2px ${cfg.color}25` : 'none',
                }}>
                  {cfg.icon} {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Inline-Formular (erscheint bei Schnellauswahl-Klick) */}
        {selectedTyp && (() => {
          const cfg = VERLAUF_TYPEN[selectedTyp]
          return (
            <div style={{ padding: '14px', background: cfg.color + '06', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px' }}>{cfg.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: cfg.color }}>{cfg.label}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>Datum</label>
                  <input type="date" value={newDatum} onChange={e => setNewDatum(e.target.value)} style={iStyle} />
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>Notiz (optional)</label>
                  <textarea
                    value={newNotiz}
                    onChange={e => setNewNotiz(e.target.value)}
                    placeholder="z.B. Mandant telefonisch informiert, Unterlagen teilweise erhalten…"
                    rows={3}
                    style={{ ...iStyle, width: '100%', resize: 'vertical', whiteSpace: 'pre-wrap', minHeight: '60px', boxSizing: 'border-box' }}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addVerlauf() }}
                    autoFocus
                  />
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>Strg+Enter zum Speichern · Notiz leer → Label wird verwendet</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addVerlauf}
                  style={{ padding: '7px 18px', borderRadius: '6px', border: 'none', background: cfg.color, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  ✓ Hinzufügen
                </button>
                <button onClick={() => setSelectedTyp(null)}
                  style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
                  ✕ Abbrechen
                </button>
              </div>
            </div>
          )
        })()}
      </div>

      {/* ═══════ TIMELINE ═══════ */}
      {allItems.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '20px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '2px dashed var(--border)' }}>
          <div style={{ fontSize: '24px', marginBottom: '6px', opacity: 0.4 }}>🗓</div>
          Noch keine Aktivitäten erfasst.<br />
          <span style={{ fontSize: '11px', opacity: 0.7 }}>Erste Aktivität oben hinzufügen.</span>
        </div>
      ) : (
        <div>
          {allItems.map((item, idx) => {
            const isEmail = item._source === 'email'
            const cfg = isEmail ? { icon: '✉️', color: '#16a34a' } : (VERLAUF_TYPEN[item.typ] ?? VERLAUF_TYPEN.notiz)
            const isLast = idx === allItems.length - 1

            return (
              <div key={item.id} style={{ display: 'flex', gap: '0', position: 'relative' }}>
                {/* Timeline-Dot + Linie */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '36px', flexShrink: 0 }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '50%', zIndex: 1, flexShrink: 0,
                    background: 'var(--bg, #0f1117)',
                    border: `2px solid ${cfg.color}`,
                    boxShadow: `0 0 0 2px ${cfg.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px',
                  }}>
                    {cfg.icon}
                  </div>
                  {!isLast && <div style={{ width: '2px', flex: 1, background: 'var(--border)', marginTop: '2px', minHeight: '12px' }} />}
                </div>

                {/* Inhalt */}
                <div style={{
                  flex: 1, marginLeft: '8px', marginBottom: isLast ? '0' : '10px',
                  background: isEmail ? 'rgba(22,163,74,0.04)' : 'var(--surface2)',
                  border: `1px solid ${isEmail ? 'rgba(22,163,74,0.2)' : 'var(--border)'}`,
                  borderRadius: '8px', overflow: 'hidden',
                }}>
                  <div style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', borderBottom: item.text && !isEmail && item.text !== (VERLAUF_TYPEN[item.typ]?.label) ? '1px solid var(--border)' : 'none' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, color: cfg.color,
                      background: cfg.color + '15', padding: '2px 8px', borderRadius: '10px',
                    }}>
                      {isEmail ? (item.text?.startsWith('📨') ? 'Empfangen' : 'Gesendet') : (VERLAUF_TYPEN[item.typ]?.label ?? 'Eintrag')}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1 }}>
                      {fmtShortDate(item.datum)}
                    </span>
                    {isEmail && onOpenEmail ? (
                      <button onClick={() => onOpenEmail(item.eventId)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', color: '#16a34a', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(22,163,74,0.3)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                        öffnen →
                      </button>
                    ) : !isEmail ? (
                      <button onClick={() => deleteVerlauf(item.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '0 2px', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>✕</button>
                    ) : null}
                  </div>
                  {/* Notiz / E-Mail-Text */}
                  {isEmail ? (
                    <div style={{ padding: '5px 10px', fontSize: '11px' }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</div>
                      {item.absender && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>{item.absender}</div>}
                    </div>
                  ) : item.text && item.text !== (VERLAUF_TYPEN[item.typ]?.label) ? (
                    <div style={{ padding: '5px 10px', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {item.text}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Aktivitäten-Typen für Steuerliche Erfassung ──────────────────────────────
const ERFASSUNG_AKTIVITAETEN = {
  telefonat:              { label: 'Telefonat geführt',               icon: '📞', color: '#7c3aed' },
  unterlagen_angefordert: { label: 'Unterlagen angefordert',          icon: '📤', color: '#2563eb' },
  unterlagen_erhalten:    { label: 'Unterlagen erhalten',             icon: '📬', color: '#16a34a' },
  antrag_vorbereitet:     { label: 'Antrag vorbereitet',              icon: '📝', color: '#0891b2' },
  antrag_unterschrift:    { label: 'Antrag zur Unterschrift gesendet', icon: '✍️', color: '#d97706' },
  antrag_fa:              { label: 'Antrag an Finanzamt gesendet',    icon: '🏛', color: '#2563eb' },
  warte_rueckmeldung:     { label: 'Warten auf Rückmeldung',         icon: '⏳', color: '#f97316' },
  steuernummer_erhalten:  { label: 'Steuernummer erhalten',           icon: '✅', color: '#16a34a' },
  notiz:                  { label: 'Interne Notiz',                   icon: '📝', color: '#64748b' },
}

function ErfassungVerlaufSection({ au, onUpdate }) {
  const verlauf = au.verlauf ?? []
  const [selectedTyp, setSelectedTyp] = useState(null)
  const [newNotiz,    setNewNotiz]    = useState('')
  const [newDatum,    setNewDatum]    = useState(todayISO)

  function handleQuickAction(typ) {
    if (selectedTyp === typ) { setSelectedTyp(null); return }
    setSelectedTyp(typ)
    setNewDatum(todayISO())
    setNewNotiz('')
  }

  function addVerlauf() {
    if (!selectedTyp) return
    const cfg = ERFASSUNG_AKTIVITAETEN[selectedTyp]
    const item = {
      id: genVerlaufId(),
      typ: selectedTyp,
      datum: newDatum,
      text: newNotiz.trim() || cfg.label,
      erstelltAm: new Date().toISOString(),
    }
    onUpdate({ verlauf: [item, ...verlauf] })
    setNewNotiz(''); setNewDatum(todayISO()); setSelectedTyp(null)
  }

  function deleteVerlauf(id) {
    onUpdate({ verlauf: verlauf.filter(v => v.id !== id) })
  }

  const sorted = [...verlauf].sort((a, b) => new Date(b.datum) - new Date(a.datum))
  const iStyle = { padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', outline: 'none' }

  return (
    <div style={{ marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
          🏛 Verlauf & Aktivitäten
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--surface2)', padding: '1px 7px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          {sorted.length}
        </span>
      </div>

      {/* Aktivität erfassen */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: '14px' }}>
        <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '13px' }}>➕ Aktivität erfassen</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>— per Schnellauswahl</span>
        </div>

        <div style={{ padding: '12px 14px', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Object.entries(ERFASSUNG_AKTIVITAETEN).map(([key, cfg]) => {
              const active = selectedTyp === key
              return (
                <button key={key} onClick={() => handleQuickAction(key)} style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
                  border: `1px solid ${active ? cfg.color : 'var(--border)'}`,
                  background: active ? cfg.color + '18' : 'var(--surface2)',
                  color: active ? cfg.color : 'var(--text-secondary)',
                  fontSize: '12px', fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s',
                  boxShadow: active ? `0 0 0 2px ${cfg.color}25` : 'none',
                }}>
                  {cfg.icon} {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {selectedTyp && (() => {
          const cfg = ERFASSUNG_AKTIVITAETEN[selectedTyp]
          return (
            <div style={{ padding: '14px', background: cfg.color + '06', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px' }}>{cfg.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: cfg.color }}>{cfg.label}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>Datum</label>
                  <input type="date" value={newDatum} onChange={e => setNewDatum(e.target.value)} style={iStyle} />
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>Notiz (optional)</label>
                  <textarea
                    value={newNotiz}
                    onChange={e => setNewNotiz(e.target.value)}
                    placeholder="z.B. Mandant telefonisch informiert, fehlende Unterlagen besprochen…"
                    rows={3}
                    style={{ ...iStyle, width: '100%', resize: 'vertical', whiteSpace: 'pre-wrap', minHeight: '60px', boxSizing: 'border-box' }}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addVerlauf() }}
                    autoFocus
                  />
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>Strg+Enter zum Speichern · Notiz leer → Label wird verwendet</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addVerlauf}
                  style={{ padding: '7px 18px', borderRadius: '6px', border: 'none', background: cfg.color, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  ✓ Bestätigen
                </button>
                <button onClick={() => setSelectedTyp(null)}
                  style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
                  ✕ Abbrechen
                </button>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Timeline */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '20px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '2px dashed var(--border)' }}>
          <div style={{ fontSize: '24px', marginBottom: '6px', opacity: 0.4 }}>🏛</div>
          Noch keine Aktivitäten erfasst.<br />
          <span style={{ fontSize: '11px', opacity: 0.7 }}>Erste Aktivität oben hinzufügen.</span>
        </div>
      ) : (
        <div>
          {sorted.map((item, idx) => {
            const cfg = ERFASSUNG_AKTIVITAETEN[item.typ] ?? ERFASSUNG_AKTIVITAETEN.notiz
            const isLast = idx === sorted.length - 1
            return (
              <div key={item.id} style={{ display: 'flex', gap: '0', position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '36px', flexShrink: 0 }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '50%', zIndex: 1, flexShrink: 0,
                    background: 'var(--bg, #0f1117)',
                    border: `2px solid ${cfg.color}`,
                    boxShadow: `0 0 0 2px ${cfg.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px',
                  }}>
                    {cfg.icon}
                  </div>
                  {!isLast && <div style={{ width: '2px', flex: 1, background: 'var(--border)', marginTop: '2px', minHeight: '12px' }} />}
                </div>
                <div style={{
                  flex: 1, marginLeft: '8px', marginBottom: isLast ? '0' : '10px',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: '8px', overflow: 'hidden',
                }}>
                  <div style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', borderBottom: item.text && item.text !== cfg.label ? '1px solid var(--border)' : 'none' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, color: cfg.color,
                      background: cfg.color + '15', padding: '2px 8px', borderRadius: '10px',
                    }}>
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1 }}>
                      {fmtShortDate(item.datum)}
                    </span>
                    {item._email
                      ? <span style={{ fontSize: '9px', color: 'var(--text-muted)', flexShrink: 0 }}>📧 Nachrichten</span>
                      : <button onClick={() => deleteVerlauf(item.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '0 2px', flexShrink: 0 }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>✕</button>
                    }
                  </div>
                  {item.text && item.text !== cfg.label && (
                    <div style={{ padding: '5px 10px', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {item.text}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Generische Workflow-Konfigurationen (Etablering + weitere) ────────────────
const WF_COLORS = {
  gray:   { color: '#64748b', bg: 'rgba(100,116,139,0.1)',  border: 'rgba(100,116,139,0.3)' },
  blue:   { color: '#2563eb', bg: 'rgba(37,99,235,0.08)',   border: 'rgba(37,99,235,0.3)' },
  cyan:   { color: '#0891b2', bg: 'rgba(8,145,178,0.08)',   border: 'rgba(8,145,178,0.3)' },
  purple: { color: '#7c3aed', bg: 'rgba(124,58,237,0.08)',  border: 'rgba(124,58,237,0.3)' },
  orange: { color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.3)' },
  green:  { color: '#16a34a', bg: 'rgba(22,163,74,0.08)',   border: 'rgba(22,163,74,0.3)' },
  teal:   { color: '#0f766e', bg: 'rgba(15,118,110,0.08)',  border: 'rgba(15,118,110,0.3)' },
  amber:  { color: '#d97706', bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.3)' },
  red:    { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)' },
}

export const WORKFLOW_CONFIGS = {
  ust_reg_de: {
    label: 'USt-Registrierung Deutschland',
    steps: [
      { key: 'anfrage',              label: 'Anfrage eingegangen',          icon: '📨', ...WF_COLORS.gray },
      { key: 'formular_gesendet',    label: 'Formularlink gesendet',        icon: '📤', ...WF_COLORS.blue },
      { key: 'formular_ausgefuellt', label: 'Formular ausgefüllt',          icon: '📋', ...WF_COLORS.cyan },
      { key: 'daten_geprueft',       label: 'Daten geprüft',               icon: '✅', ...WF_COLORS.teal },
      { key: 'antrag_erzeugt',       label: 'Antrag erzeugt',              icon: '📝', ...WF_COLORS.purple },
      { key: 'zur_unterschrift',     label: 'Zur Unterschrift gesendet',   icon: '✍️', ...WF_COLORS.amber },
      { key: 'unterschrieben',       label: 'Unterschrift erhalten',       icon: '📬', ...WF_COLORS.green },
      { key: 'an_fa',               label: 'An Finanzamt gesendet',       icon: '🏛', ...WF_COLORS.blue },
      { key: 'steuernr_erhalten',    label: 'Steuernummer erhalten',       icon: '🔢', ...WF_COLORS.green },
      { key: 'ustid_erhalten',       label: 'USt-ID erhalten',             icon: '🇪🇺', ...WF_COLORS.green },
      { key: 'abgeschlossen',        label: 'Abgeschlossen',              icon: '✅', ...WF_COLORS.green },
    ],
  },
  ust_reg_se: {
    label: 'Momsregistrering Sverige',
    steps: [
      { key: 'anfrage',              label: 'Anfrage eingegangen',          icon: '📨', ...WF_COLORS.gray },
      { key: 'formular_gesendet',    label: 'Formularlink gesendet',        icon: '📤', ...WF_COLORS.blue },
      { key: 'formular_ausgefuellt', label: 'Formular ausgefüllt',          icon: '📋', ...WF_COLORS.cyan },
      { key: 'daten_geprueft',       label: 'Daten geprüft',               icon: '✅', ...WF_COLORS.teal },
      { key: 'antrag_erzeugt',       label: 'Antrag erzeugt',              icon: '📝', ...WF_COLORS.purple },
      { key: 'zur_unterschrift',     label: 'Zur Unterschrift gesendet',   icon: '✍️', ...WF_COLORS.amber },
      { key: 'unterschrieben',       label: 'Unterschrift erhalten',       icon: '📬', ...WF_COLORS.green },
      { key: 'eingereicht',          label: 'Bei Skatteverket eingereicht', icon: '🏛', ...WF_COLORS.blue },
      { key: 'momsnr_erhalten',      label: 'Momsnummer erhalten',         icon: '🔢', ...WF_COLORS.green },
      { key: 'abgeschlossen',        label: 'Abgeschlossen',              icon: '✅', ...WF_COLORS.green },
    ],
  },
  ust_reg_no: {
    label: 'MVA-registrering Norge',
    steps: [
      { key: 'anfrage',              label: 'Anfrage eingegangen',          icon: '📨', ...WF_COLORS.gray },
      { key: 'formular_gesendet',    label: 'Formularlink gesendet',        icon: '📤', ...WF_COLORS.blue },
      { key: 'formular_ausgefuellt', label: 'Formular ausgefüllt',          icon: '📋', ...WF_COLORS.cyan },
      { key: 'daten_geprueft',       label: 'Daten geprüft',               icon: '✅', ...WF_COLORS.teal },
      { key: 'antrag_erzeugt',       label: 'Antrag erzeugt',              icon: '📝', ...WF_COLORS.purple },
      { key: 'zur_unterschrift',     label: 'Zur Unterschrift gesendet',   icon: '✍️', ...WF_COLORS.amber },
      { key: 'unterschrieben',       label: 'Unterschrift erhalten',       icon: '📬', ...WF_COLORS.green },
      { key: 'eingereicht',          label: 'Bei Skatteetaten eingereicht', icon: '🏛', ...WF_COLORS.blue },
      { key: 'mvanr_erhalten',       label: 'MVA-Nummer erhalten',         icon: '🔢', ...WF_COLORS.green },
      { key: 'abgeschlossen',        label: 'Abgeschlossen',              icon: '✅', ...WF_COLORS.green },
    ],
  },
  ust_reg_dk: {
    label: 'Momsregistrering Danmark',
    steps: [
      { key: 'anfrage',              label: 'Anfrage eingegangen',          icon: '📨', ...WF_COLORS.gray },
      { key: 'formular_gesendet',    label: 'Formularlink gesendet',        icon: '📤', ...WF_COLORS.blue },
      { key: 'formular_ausgefuellt', label: 'Formular ausgefüllt',          icon: '📋', ...WF_COLORS.cyan },
      { key: 'daten_geprueft',       label: 'Daten geprüft',               icon: '✅', ...WF_COLORS.teal },
      { key: 'antrag_erzeugt',       label: 'Antrag erzeugt',              icon: '📝', ...WF_COLORS.purple },
      { key: 'zur_unterschrift',     label: 'Zur Unterschrift gesendet',   icon: '✍️', ...WF_COLORS.amber },
      { key: 'unterschrieben',       label: 'Unterschrift erhalten',       icon: '📬', ...WF_COLORS.green },
      { key: 'eingereicht',          label: 'Bei Skattestyrelsen eingereicht', icon: '🏛', ...WF_COLORS.blue },
      { key: 'momsnr_erhalten',      label: 'SE-Nummer erhalten',          icon: '🔢', ...WF_COLORS.green },
      { key: 'abgeschlossen',        label: 'Abgeschlossen',              icon: '✅', ...WF_COLORS.green },
    ],
  },
  ug_gruendung: {
    label: 'UG-Gründung',
    steps: [
      { key: 'anfrage',              label: 'Anfrage eingegangen',          icon: '📨', ...WF_COLORS.gray },
      { key: 'formular_gesendet',    label: 'Formularlink gesendet',        icon: '📤', ...WF_COLORS.blue },
      { key: 'formular_ausgefuellt', label: 'Daten erhalten',              icon: '📋', ...WF_COLORS.cyan },
      { key: 'daten_geprueft',       label: 'Daten geprüft',               icon: '✅', ...WF_COLORS.teal },
      { key: 'satzung_erstellt',     label: 'Satzung erstellt',            icon: '📝', ...WF_COLORS.purple },
      { key: 'notar_termin',         label: 'Notartermin vereinbart',      icon: '📅', ...WF_COLORS.amber },
      { key: 'beurkundet',           label: 'Beurkundet',                  icon: '📜', ...WF_COLORS.teal },
      { key: 'handelsregister',      label: 'Handelsregister eingereicht', icon: '🏛', ...WF_COLORS.blue },
      { key: 'eingetragen',          label: 'HR-Eintragung erhalten',      icon: '✅', ...WF_COLORS.green },
      { key: 'steuerl_erfassung',    label: 'Steuerliche Erfassung',       icon: '🔢', ...WF_COLORS.orange },
      { key: 'geschaeftskonto',      label: 'Geschäftskonto eröffnet',     icon: '🏦', ...WF_COLORS.cyan },
      { key: 'abgeschlossen',        label: 'Abgeschlossen',              icon: '✅', ...WF_COLORS.green },
    ],
  },
  gmbh_gruendung: {
    label: 'GmbH-Gründung',
    steps: [
      { key: 'anfrage',              label: 'Anfrage eingegangen',          icon: '📨', ...WF_COLORS.gray },
      { key: 'formular_gesendet',    label: 'Formularlink gesendet',        icon: '📤', ...WF_COLORS.blue },
      { key: 'formular_ausgefuellt', label: 'Daten erhalten',              icon: '📋', ...WF_COLORS.cyan },
      { key: 'daten_geprueft',       label: 'Daten geprüft',               icon: '✅', ...WF_COLORS.teal },
      { key: 'satzung_erstellt',     label: 'Satzung erstellt',            icon: '📝', ...WF_COLORS.purple },
      { key: 'notar_termin',         label: 'Notartermin vereinbart',      icon: '📅', ...WF_COLORS.amber },
      { key: 'beurkundet',           label: 'Beurkundet',                  icon: '📜', ...WF_COLORS.teal },
      { key: 'stammkapital',         label: 'Stammkapital eingezahlt',     icon: '💰', ...WF_COLORS.green },
      { key: 'handelsregister',      label: 'Handelsregister eingereicht', icon: '🏛', ...WF_COLORS.blue },
      { key: 'eingetragen',          label: 'HR-Eintragung erhalten',      icon: '✅', ...WF_COLORS.green },
      { key: 'steuerl_erfassung',    label: 'Steuerliche Erfassung',       icon: '🔢', ...WF_COLORS.orange },
      { key: 'geschaeftskonto',      label: 'Geschäftskonto eröffnet',     icon: '🏦', ...WF_COLORS.cyan },
      { key: 'abgeschlossen',        label: 'Abgeschlossen',              icon: '✅', ...WF_COLORS.green },
    ],
  },
  vorratsgesell: {
    label: 'Vorratsgesellschaft',
    steps: [
      { key: 'anfrage',              label: 'Anfrage eingegangen',          icon: '📨', ...WF_COLORS.gray },
      { key: 'angebot_gesendet',     label: 'Angebot gesendet',            icon: '📤', ...WF_COLORS.blue },
      { key: 'angebot_angenommen',   label: 'Angebot angenommen',          icon: '✅', ...WF_COLORS.green },
      { key: 'kaufvertrag',          label: 'Kaufvertrag erstellt',        icon: '📝', ...WF_COLORS.purple },
      { key: 'notar_termin',         label: 'Notartermin vereinbart',      icon: '📅', ...WF_COLORS.amber },
      { key: 'beurkundet',           label: 'Beurkundet / Übertragen',    icon: '📜', ...WF_COLORS.teal },
      { key: 'umfirmiert',           label: 'Umfirmierung eingetragen',    icon: '🏛', ...WF_COLORS.blue },
      { key: 'abgeschlossen',        label: 'Abgeschlossen',              icon: '✅', ...WF_COLORS.green },
    ],
  },
  geschaeftsadresse: {
    label: 'Geschäftsadresse',
    steps: [
      { key: 'anfrage',              label: 'Anfrage eingegangen',          icon: '📨', ...WF_COLORS.gray },
      { key: 'angebot_gesendet',     label: 'Angebot gesendet',            icon: '📤', ...WF_COLORS.blue },
      { key: 'vertrag_gesendet',     label: 'Vertrag gesendet',            icon: '📝', ...WF_COLORS.purple },
      { key: 'vertrag_unterzeichnet',label: 'Vertrag unterzeichnet',       icon: '✍️', ...WF_COLORS.amber },
      { key: 'adresse_aktiv',        label: 'Adresse aktiv',               icon: '📍', ...WF_COLORS.green },
      { key: 'abgeschlossen',        label: 'Abgeschlossen / Gekündigt',  icon: '✅', ...WF_COLORS.green },
    ],
  },
  easy_b2b: {
    label: 'Easy-B2B-Anfrage',
    steps: [
      { key: 'anfrage',              label: 'Anfrage eingegangen',          icon: '📨', ...WF_COLORS.gray },
      { key: 'kontakt_aufgenommen',  label: 'Kontakt aufgenommen',         icon: '📞', ...WF_COLORS.blue },
      { key: 'angebot_gesendet',     label: 'Angebot gesendet',            icon: '📤', ...WF_COLORS.purple },
      { key: 'in_umsetzung',         label: 'In Umsetzung',               icon: '🔧', ...WF_COLORS.cyan },
      { key: 'abgeschlossen',        label: 'Abgeschlossen',              icon: '✅', ...WF_COLORS.green },
    ],
  },
  liquidation: {
    label: 'Liquidation',
    steps: [
      { key: 'anfrage',              label: 'Anfrage eingegangen',          icon: '📨', ...WF_COLORS.gray },
      { key: 'beratung',             label: 'Beratungsgespräch',           icon: '📞', ...WF_COLORS.blue },
      { key: 'beschluss',            label: 'Gesellschafterbeschluss',     icon: '📝', ...WF_COLORS.purple },
      { key: 'hr_anmeldung',         label: 'HR-Anmeldung eingereicht',   icon: '🏛', ...WF_COLORS.blue },
      { key: 'sperrjahr',            label: 'Sperrjahr läuft',            icon: '⏳', ...WF_COLORS.orange },
      { key: 'schlussrechnung',      label: 'Schlussrechnung erstellt',    icon: '🧾', ...WF_COLORS.cyan },
      { key: 'loeschung',            label: 'Löschung beantragt',         icon: '🔚', ...WF_COLORS.red },
      { key: 'abgeschlossen',        label: 'Abgeschlossen',              icon: '✅', ...WF_COLORS.green },
    ],
  },
}

// ── Generisches Workflow-Panel (für alle Typen mit WORKFLOW_CONFIGS) ──────────
const FORMULAR_URLS = {
  ust_reg_de: 'https://etablering-tyskland.com/formular/ust-registrierung-de',
}

function WorkflowPanel({ au, onUpdate }) {
  const wfCfg = WORKFLOW_CONFIGS[au.typ]
  if (!wfCfg) return null

  const current = au.workflowStatus ?? wfCfg.steps[0]?.key ?? 'anfrage'
  const currentStep = wfCfg.steps.find(s => s.key === current) ?? wfCfg.steps[0]
  const currentIdx = wfCfg.steps.findIndex(s => s.key === current)
  const [linkCopied, setLinkCopied] = useState(false)
  const formularUrl = FORMULAR_URLS[au.typ]

  function setStatus(key) {
    onUpdate({ workflowStatus: key, workflowStatusDatum: todayISO() })
  }

  function copyFormularLink() {
    if (!formularUrl) return
    navigator.clipboard?.writeText(formularUrl).catch(() => {
      const el = document.createElement('textarea')
      el.value = formularUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    })
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Aktueller Status */}
      <div style={{ padding: '12px 14px', background: currentStep.bg, borderRadius: '8px', border: `1px solid ${currentStep.border}`, marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Status</span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: currentStep.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
            {currentStep.icon} {currentStep.label}
          </span>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {currentIdx + 1} / {wfCfg.steps.length}
            {au.workflowStatusDatum && <> · seit {fmtShortDate(au.workflowStatusDatum)}</>}
          </span>
        </div>

        {/* Fortschrittsbalken */}
        <div style={{ display: 'flex', gap: '2px', marginBottom: '10px' }}>
          {wfCfg.steps.map((step, idx) => (
            <div key={step.key} style={{
              flex: 1, height: '4px', borderRadius: '2px',
              background: idx <= currentIdx ? currentStep.color : 'var(--border)',
              opacity: idx <= currentIdx ? 1 : 0.4,
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        {/* Stufen-Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {wfCfg.steps.map((step, idx) => {
            const isActive = step.key === current
            const isPast = idx < currentIdx
            return (
              <button
                key={step.key}
                onClick={() => setStatus(step.key)}
                title={step.label}
                style={{
                  padding: '3px 9px', borderRadius: '20px', fontSize: '10px', cursor: 'pointer',
                  fontWeight: isActive ? 700 : 400,
                  border: `1px solid ${isActive ? step.color : isPast ? step.color + '60' : 'var(--border)'}`,
                  background: isActive ? step.bg : isPast ? step.color + '08' : 'transparent',
                  color: isActive ? step.color : isPast ? step.color + 'cc' : 'var(--text-muted)',
                  textDecoration: isPast ? 'none' : 'none',
                }}
              >
                {step.icon} {step.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Formular-Link senden */}
      {formularUrl && (
        <div style={{ padding: '10px 14px', background: 'rgba(37,99,235,0.06)', borderRadius: '8px', border: '1px solid rgba(37,99,235,0.2)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📋 Formular:</span>
          <a href={formularUrl} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '11px', color: '#2563eb', textDecoration: 'underline', wordBreak: 'break-all' }}>
            {formularUrl}
          </a>
          <button onClick={copyFormularLink}
            style={{ marginLeft: 'auto', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 600, border: '1px solid #2563eb', background: linkCopied ? '#16a34a' : '#2563eb', color: '#fff', transition: 'background 0.2s', whiteSpace: 'nowrap' }}>
            {linkCopied ? '✓ Kopiert!' : '📋 Link kopieren'}
          </button>
        </div>
      )}

      {/* Schnellnavigation: Vor/Zurück */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {currentIdx > 0 && (
          <button onClick={() => setStatus(wfCfg.steps[currentIdx - 1].key)}
            style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-muted)' }}>
            ← {wfCfg.steps[currentIdx - 1].label}
          </button>
        )}
        {currentIdx < wfCfg.steps.length - 1 && (
          <button onClick={() => setStatus(wfCfg.steps[currentIdx + 1].key)}
            style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 600, border: `1px solid ${wfCfg.steps[currentIdx + 1].color}`, background: wfCfg.steps[currentIdx + 1].bg, color: wfCfg.steps[currentIdx + 1].color }}>
            → {wfCfg.steps[currentIdx + 1].label}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Generische Verlauf-Aktivitäten für Workflow-Aufträge ─────────────────────
const WORKFLOW_AKTIVITAETEN = {
  telefonat:              { label: 'Telefonat geführt',               icon: '📞', color: '#7c3aed' },
  email_gesendet:         { label: 'E-Mail gesendet',                icon: '📤', color: '#2563eb' },
  unterlagen_angefordert: { label: 'Unterlagen angefordert',          icon: '📋', color: '#0891b2' },
  unterlagen_erhalten:    { label: 'Unterlagen erhalten',             icon: '📬', color: '#16a34a' },
  dokument_erstellt:      { label: 'Dokument erstellt',               icon: '📝', color: '#0891b2' },
  zur_unterschrift:       { label: 'Zur Unterschrift gesendet',       icon: '✍️', color: '#d97706' },
  unterschrift_erhalten:  { label: 'Unterschrift erhalten',           icon: '📬', color: '#16a34a' },
  eingereicht:            { label: 'Eingereicht / Übermittelt',       icon: '🏛', color: '#2563eb' },
  rueckmeldung_erhalten:  { label: 'Rückmeldung erhalten',            icon: '💬', color: '#16a34a' },
  warte:                  { label: 'Warten auf Rückmeldung',          icon: '⏳', color: '#f97316' },
  notiz:                  { label: 'Interne Notiz',                   icon: '📝', color: '#64748b' },
}

// ── E-Mail-Vorlagen für USt-Reg. DE (vorbefüllt aus Antragsdaten) ─────────────
function buildUstRegVorlagen(client, au) {
  const ed = au.erfassungsdaten ?? {}
  const firma  = ed.firmenname || client?.name || 'das Unternehmen'
  const ap     = ed.ansprechpartner_name || (client?.kontakte ?? [])[0]?.name || ''
  const anrede = ap ? `Sehr geehrte/r ${ap},` : 'Sehr geehrte Damen und Herren,'
  const vorname = (ap || ed.geschaeftsfuehrer_name || '').split(/\s+/)[0] || ''
  const isDK = /dänemark|danmark|denmark|\bdk\b/.test((ed.adresse_land || client?.land || '').toLowerCase())

  // Bestätigung an Mandant nach Einreichung beim Finanzamt (DK/DE, Du-Form; Rechnung manuell anhängen)
  const eingereicht = isDK ? {
    id: '_ustreg_eingereicht',
    name: '📨 Bestätigung: Antrag eingereicht (an Mandant) 🇩🇰',
    betreff: `Momsregistrering indsendt${firma ? ' – ' + firma : ''}`,
    text:
`Hej${vorname ? ' ' + vorname : ''}

Jeg har i dag sendt ansøgningen om momsregistrering til det tyske skattekontor (Finanzamt).

Normalt tager sagsbehandlingen omkring 2–6 uger.

Du vil først modtage et brev fra Finanzamt Flensburg med dit tyske skattenummer.

Skattenummeret har typisk følgende format:

15/xxx/xxxxx

Dette nummer bruges blandt andet til indsendelse af momsangivelser til de tyske myndigheder.

Kort tid efter modtager du normalt endnu et brev med dit tyske momsnummer (USt-IdNr.).

Nummeret har følgende format:

DEXXXXXXXXXX

Dette nummer skal blandt andet bruges ved registrering hos platforme som Amazon, Zalando og andre markedspladser.

Hvis du har underskrevet en fuldmagt

Hvis du har underskrevet fuldmagten, vil breve og meddelelser fra Finanzamt som udgangspunkt blive sendt til mig i stedet for direkte til virksomheden.

I så fald videresender jeg naturligvis alle relevante breve, skattenumre og momsnumre til dig, så snart jeg modtager dem.

Hvis du ikke har underskrevet en fuldmagt, vil Finanzamt sende brevene direkte til virksomheden. Sørg derfor for, at virksomhedsadressen kan modtage post, og at virksomhedens navn fremgår tydeligt af postkassen.

Hvis momsnummeret ikke kommer inden for rimelig tid efter modtagelsen af skattenummeret, må du meget gerne kontakte mig. Så følger jeg op på sagen hos myndighederne.

Du finder min faktura vedhæftet denne e-mail.

Bemærk

Hvis du ønsker, at jeg fremover skal hjælpe med de løbende tyske momsangivelser, er du meget velkommen til at kontakte mig.

Har du spørgsmål til processen eller de breve, du modtager fra Finanzamt, hjælper jeg naturligvis også gerne.

Venlig hilsen`,
  } : {
    id: '_ustreg_eingereicht',
    name: '📨 Bestätigung: Antrag eingereicht (an Mandant) 🇩🇪',
    betreff: `Antrag auf umsatzsteuerliche Registrierung eingereicht${firma ? ' – ' + firma : ''}`,
    text:
`Hallo${vorname ? ' ' + vorname : ''}

ich habe heute den Antrag auf umsatzsteuerliche Registrierung beim deutschen Finanzamt eingereicht.

Die Bearbeitung dauert in der Regel etwa 2–6 Wochen.

Du erhältst zunächst ein Schreiben vom Finanzamt Flensburg mit deiner deutschen Steuernummer.

Die Steuernummer hat üblicherweise folgendes Format:

15/xxx/xxxxx

Diese Nummer wird unter anderem für die Abgabe der Umsatzsteuer-Voranmeldungen verwendet.

Kurz darauf erhältst du in der Regel ein weiteres Schreiben mit deiner deutschen Umsatzsteuer-Identifikationsnummer (USt-IdNr.).

Die Nummer hat folgendes Format:

DEXXXXXXXXXX

Diese Nummer benötigst du unter anderem für die Registrierung bei Plattformen wie Amazon, Zalando und anderen Marktplätzen.

Wenn du eine Vollmacht unterschrieben hast

Wenn du die Vollmacht unterschrieben hast, werden Schreiben und Mitteilungen des Finanzamts grundsätzlich an mich statt direkt an das Unternehmen gesendet.

In diesem Fall leite ich dir selbstverständlich alle relevanten Schreiben, Steuernummern und USt-IdNr. weiter, sobald ich sie erhalte.

Wenn du keine Vollmacht unterschrieben hast, sendet das Finanzamt die Schreiben direkt an das Unternehmen. Stelle daher sicher, dass die Unternehmensadresse Post empfangen kann und der Firmenname am Briefkasten klar erkennbar ist.

Falls die USt-IdNr. nicht innerhalb einer angemessenen Frist nach Erhalt der Steuernummer eintrifft, melde dich gerne bei mir. Dann gehe ich der Sache bei der Behörde nach.

Meine Rechnung findest du im Anhang dieser E-Mail.

Hinweis

Wenn du möchtest, dass ich dich künftig bei den laufenden deutschen Umsatzsteuer-Voranmeldungen unterstütze, melde dich gerne.

Bei Fragen zum Ablauf oder zu den Schreiben des Finanzamts helfe ich dir natürlich ebenfalls gerne weiter.

Viele Grüße`,
  }

  return [
    eingereicht,
    {
      id: '_ustreg_unterschrift',
      name: '✍️ Antrag zur Unterschrift (an Mandant)',
      betreff: `USt-Registrierung Deutschland – Vollmacht zur Unterschrift (${firma})`,
      text: `${anrede}\n\nfür die umsatzsteuerliche Registrierung von ${firma} in Deutschland haben wir die Vollmacht sowie das Anschreiben an das Finanzamt vorbereitet (siehe Anhang).\n\nBitte unterschreiben Sie die Vollmacht und senden Sie uns das unterschriebene Dokument zurück – gerne als Scan per E-Mail. Anschließend reichen wir den Antrag beim Finanzamt ein.\n\nBei Fragen stehen wir Ihnen jederzeit zur Verfügung.`,
    },
    {
      id: '_ustreg_fa',
      name: '🏛 Antrag ans Finanzamt',
      betreff: `Steuerliche Erfassung / Umsatzsteuerliche Registrierung – ${firma}`,
      text: `Sehr geehrte Damen und Herren,\n\nnamens und im Auftrag von ${firma} beantragen wir die steuerliche Erfassung sowie die Erteilung einer Steuernummer für umsatzsteuerliche Zwecke in Deutschland.\n\nDie erforderlichen Angaben sowie die Vollmacht, eine Passkopie des Geschäftsführers und ein aktueller Registerauszug sind beigefügt.\n\nFür Rückfragen stehen wir Ihnen gerne zur Verfügung.`,
    },
    {
      id: '_ustreg_erinnerung',
      name: '🔔 Erinnerung ans Finanzamt',
      betreff: `Erinnerung: Steuerliche Erfassung – ${firma}`,
      text: `Sehr geehrte Damen und Herren,\n\nwir nehmen Bezug auf unseren Antrag auf steuerliche Erfassung von ${firma}. Da uns bislang keine Rückmeldung vorliegt, möchten wir höflich um eine kurze Information zum aktuellen Bearbeitungsstand bitten.\n\nVielen Dank für Ihre Unterstützung.`,
    },
  ]
}

function buildPdfAttachments(client, au) {
  const docs = au.dokumente ?? []
  return docs.map(d => {
    const doc = buildDoc(d.art, client, au)
    return { name: pdfFilename(d.art, au), data: pdfToBase64(doc), type: 'application/pdf', size: 0 }
  })
}

// Alle 3 Unterlagen frisch erzeugen (für den Versand) — Einwilligung nach Personenart
function buildAllPdfAttachments(client, au) {
  const personenart = (au.erfassungsdaten || {}).personenart
  const einwArt = personenart === 'natuerlich' ? 'einwilligung_nat' : 'einwilligung_jur'
  return ['antrag', 'vollmacht', einwArt].map(art => {
    const doc = buildDoc(art, client, au)
    return { name: pdfFilename(art, au), data: pdfToBase64(doc), type: 'application/pdf', size: 0 }
  })
}

// Sende-Vorlage (Du-Form, Sprache nach Land) mit vorbefüllten Variablen
function buildSendeVorlage(client, au) {
  const ed = au.erfassungsdaten || {}
  const land = (ed.adresse_land || client?.land || '').toLowerCase()
  const isDK = /dänemark|danmark|denmark|\bdk\b/.test(land)
  const firma = (ed.firmenname || client?.name || '').trim()
  const apName = (ed.ansprechpartner_name || (client?.kontakte || [])[0]?.name || ed.geschaeftsfuehrer_name || '').trim()
  const vorname = apName.split(/\s+/)[0] || ''

  if (isDK) {
    return {
      subject: `Dokumenter til momsregistrering i Tyskland${firma ? ' – ' + firma : ''}`,
      body:
`Hej${vorname ? ' ' + vorname : ''}

Vedhæftet finder du dokumenterne til momsregistreringen i Tyskland.

Jeg vil bede dig om at gennemgå dokumenterne, underskrive dem og sende dem retur til mig som PDF-filer.

Vedlagt finder du:

• Ansøgning om momsregistrering i Tyskland
• Fuldmagt
• Samtykke til kommunikation med Finanzamt via e-mail

Når jeg har modtaget de underskrevne dokumenter, sender jeg registreringen videre til det relevante Finanzamt.

Fuldmagt

Hvis du vælger at underskrive fuldmagten, kan Finanzamt sende breve, afgørelser og henvendelser direkte til mig. Det gør som regel sagsbehandlingen hurtigere og mere smidig. Fuldmagten er frivillig.

Behandlingstid

Behandlingstiden hos Finanzamt er typisk mellem 2 og 6 uger afhængigt af myndighedens aktuelle sagsmængde.

Hvis der ikke gives fuldmagt, vil breve og afgørelser blive sendt direkte til virksomheden. Sørg derfor for, at virksomhedsadressen kan modtage post, og at virksomhedens navn fremgår tydeligt af postkassen.

Hvis der ikke er kommet nogen tilbagemelding inden for cirka 4–6 uger, er du meget velkommen til at kontakte mig, så følger vi op på sagen sammen.

Du er naturligvis også velkommen til at kontakte mig, hvis du har spørgsmål til dokumenterne eller processen.

Venlig hilsen`,
    }
  }
  return {
    subject: `Unterlagen zur umsatzsteuerlichen Registrierung in Deutschland${firma ? ' – ' + firma : ''}`,
    body:
`Hallo${vorname ? ' ' + vorname : ''}

im Anhang findest du die Unterlagen zur umsatzsteuerlichen Registrierung in Deutschland.

Bitte prüfe die Dokumente, unterschreibe sie und sende sie mir anschließend als PDF-Dateien zurück.

Beigefügt findest du:

• Antrag auf umsatzsteuerliche Registrierung in Deutschland
• Vollmacht
• Einwilligung zur Kommunikation mit dem Finanzamt per E-Mail

Sobald mir die unterschriebenen Dokumente vorliegen, reiche ich die Registrierung beim zuständigen Finanzamt ein.

Vollmacht

Wenn du die Vollmacht unterschreibst, kann das Finanzamt Briefe, Bescheide und Rückfragen direkt an mich senden. Das macht die Bearbeitung in der Regel schneller und unkomplizierter. Die Vollmacht ist freiwillig.

Bearbeitungszeit

Die Bearbeitungszeit beim Finanzamt beträgt üblicherweise zwischen 2 und 6 Wochen, je nach aktueller Auslastung der Behörde.

Wird keine Vollmacht erteilt, werden Briefe und Bescheide direkt an das Unternehmen gesendet. Sorge daher dafür, dass die Unternehmensadresse Post empfangen kann und der Firmenname am Briefkasten klar erkennbar ist.

Falls innerhalb von etwa 4–6 Wochen keine Rückmeldung kommt, melde dich gerne bei mir, dann gehen wir der Sache gemeinsam nach.

Du kannst dich natürlich auch jederzeit melden, wenn du Fragen zu den Dokumenten oder zum Ablauf hast.

Viele Grüße`,
  }
}

// PDFs nach Versand in OneDrive ablegen (best-effort, blockiert den Versand nicht)
async function uploadPdfsToOneDrive(client, au, attachments, tokens, onUpdateTokens) {
  if (!tokens?.accessToken || !attachments?.length) return
  const { pathParts, folderPath } = getMandantPath(client)
  await callApi('ensurePath', { pathParts }, tokens, onUpdateTokens)
  for (const a of attachments) {
    await callApi('uploadSmall', {
      filePath: `${folderPath}/${a.name}`,
      base64: a.data,
      contentType: a.type || 'application/pdf',
    }, tokens, onUpdateTokens)
  }
}

function WorkflowVerlaufSection({ au, onUpdate, client, onUpdateClient, emailVorlagen = [], emailSignaturen = [], onedriveTokens = null, onUpdateOnedriveTokens }) {
  const verlauf = au.verlauf ?? []
  const [selectedTyp, setSelectedTyp] = useState(null)
  const [newNotiz,    setNewNotiz]    = useState('')
  const [newDatum,    setNewDatum]    = useState(todayISO)
  const [showCompose, setShowCompose] = useState(false)
  const [sendMode, setSendMode] = useState(false)     // dedizierter "Unterlagen senden"-Modus
  const [sendSelect, setSendSelect] = useState(null)  // Anlagen-Auswahl offen (Objekt mit booleans)
  const [sendArts, setSendArts] = useState([])        // gewählte Dokument-Arten für die Mail
  const [infoMode, setInfoMode] = useState(false)     // "Antrag eingereicht"-Info an Mandant
  const canCompose = !!(client && onUpdateClient)
  const isUstReg = au.typ === 'ust_reg_de'
  const ustRegVorlagen = useMemo(
    () => isUstReg ? buildUstRegVorlagen(client, au) : [],
    [isUstReg, au.erfassungsdaten, client]
  )
  const pdfAttachments = useMemo(
    () => (showCompose && !sendMode && isUstReg) ? buildPdfAttachments(client, au) : [],
    [showCompose, sendMode, au.dokumente, au.erfassungsdaten, client]
  )
  // Vorbelegte Sende-Mail: Vorlage (DE/DK, Du-Form) + die ausgewählten Anhänge (frisch erzeugt)
  const sendPreset = useMemo(() => {
    if (!sendMode || !isUstReg) return null
    const v = buildSendeVorlage(client, au)
    const attachments = sendArts.map(art => ({
      name: pdfFilename(art, au),
      data: pdfToBase64(buildDoc(art, client, au)),
      type: 'application/pdf',
      size: 0,
    }))
    return { subject: v.subject, body: v.body, attachments }
  }, [sendMode, sendArts, isUstReg, au.erfassungsdaten, client])

  // Vorbelegte "Antrag eingereicht"-Mail (Rechnung manuell anhängen)
  const infoPreset = useMemo(() => {
    if (!infoMode || !isUstReg) return null
    const v = buildUstRegVorlagen(client, au).find(t => t.id === '_ustreg_eingereicht')
    return v ? { subject: v.betreff, body: v.text, attachments: [] } : null
  }, [infoMode, isUstReg, au.erfassungsdaten, client])

  // Auswählbare Dokumente (Reihenfolge wie in der E-Mail)
  const SEND_DOKS = [
    { art: 'antrag',           label: 'Antrag auf umsatzsteuerliche Registrierung' },
    { art: 'vollmacht',        label: 'Empfangsvollmacht' },
    { art: 'einwilligung_jur', label: 'Einwilligung E-Mail – juristische Person' },
    { art: 'einwilligung_nat', label: 'Einwilligung E-Mail – natürliche Person' },
  ]
  function defaultSendSel() {
    const pa = (au.erfassungsdaten || {}).personenart
    return {
      antrag: true,
      vollmacht: true,
      einwilligung_jur: pa !== 'natuerlich',
      einwilligung_nat: pa === 'natuerlich',
    }
  }

  // Verknüpfte E-Mails (global, mit auftragId) → in Timeline + Reiter Nachrichten sichtbar
  const linkedEmails = (client?.kommunikation?.events ?? [])
    .filter(ev => ev.auftragId === au.id)
    .map(ev => ({
      id: ev.id, _email: true,
      typ: ev.typ === 'eingehend' ? 'rueckmeldung_erhalten' : 'email_gesendet',
      datum: ev.gesendetAm ?? ev.erstelltAm ?? '',
      text: `${ev.typ === 'eingehend' ? 'Empfangen' : 'Gesendet'}: ${ev.betreff ?? '(kein Betreff)'}${ev.empfaenger ? '  →  ' + ev.empfaenger : ''}`,
    }))

  function handleQuickAction(typ) {
    if (selectedTyp === typ) { setSelectedTyp(null); return }
    setSelectedTyp(typ)
    setNewDatum(todayISO())
    setNewNotiz('')
  }

  function addVerlauf() {
    if (!selectedTyp) return
    const cfg = WORKFLOW_AKTIVITAETEN[selectedTyp]
    const item = {
      id: genVerlaufId(),
      typ: selectedTyp,
      datum: newDatum,
      text: newNotiz.trim() || cfg.label,
      erstelltAm: new Date().toISOString(),
    }
    onUpdate({ verlauf: [item, ...verlauf] })
    setNewNotiz(''); setNewDatum(todayISO()); setSelectedTyp(null)
  }

  function deleteVerlauf(id) {
    onUpdate({ verlauf: verlauf.filter(v => v.id !== id) })
  }

  function openCompose(send) {
    setSendMode(send)
    setInfoMode(false)
    setShowCompose(true)
    setSelectedTyp(null)
  }
  function closeCompose() { setShowCompose(false); setSendMode(false); setSendSelect(null); setInfoMode(false) }

  // Schritt 1: Anlagen-Auswahl öffnen
  function startSend() {
    setSendSelect(defaultSendSel())
    setShowCompose(false); setSendMode(false); setInfoMode(false); setSelectedTyp(null)
  }
  // "Antrag eingereicht"-Info an Mandant: Composer direkt mit Vorlage öffnen
  function startInfo() {
    setInfoMode(true); setSendMode(false); setSendSelect(null); setShowCompose(true); setSelectedTyp(null)
  }
  // Nach Versand der Info-Mail: Status auf "An Finanzamt gesendet" vorrücken
  function handleSentInfo() {
    const order = (WORKFLOW_CONFIGS[au.typ]?.steps ?? []).map(s => s.key)
    const curIdx = order.indexOf(au.workflowStatus ?? order[0])
    const targetIdx = order.indexOf('an_fa')
    if (targetIdx >= 0 && curIdx < targetIdx) {
      onUpdate({ workflowStatus: 'an_fa', workflowStatusDatum: todayISO() })
    }
  }
  // Schritt 2: ausgewählte Anlagen übernehmen → E-Mail-Entwurf öffnen
  function prepareSend() {
    const arts = SEND_DOKS.map(d => d.art).filter(a => sendSelect?.[a])
    setSendArts(arts)
    setSendSelect(null)
    setSendMode(true)
    setShowCompose(true)
  }

  // Nach erfolgreichem Versand (Sende-Modus): Status vorrücken + PDFs in OneDrive ablegen
  function handleSent(info) {
    const order = (WORKFLOW_CONFIGS[au.typ]?.steps ?? []).map(s => s.key)
    const curIdx = order.indexOf(au.workflowStatus ?? order[0])
    const targetIdx = order.indexOf('zur_unterschrift')
    if (targetIdx >= 0 && curIdx < targetIdx) {
      onUpdate({ workflowStatus: 'zur_unterschrift', workflowStatusDatum: todayISO() })
    }
    if (onedriveTokens?.accessToken) {
      uploadPdfsToOneDrive(client, au, info?.attachments ?? sendPreset?.attachments, onedriveTokens, onUpdateOnedriveTokens).catch(() => {})
    }
  }

  const sorted = [...verlauf, ...linkedEmails].sort((a, b) => new Date(b.datum) - new Date(a.datum))
  const iStyle = { padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', outline: 'none' }

  return (
    <div style={{ marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
          📊 Verlauf & Aktivitäten
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--surface2)', padding: '1px 7px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          {sorted.length}
        </span>
        {canCompose && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            {isUstReg && (
              <button
                onClick={() => (sendSelect || (showCompose && sendMode)) ? closeCompose() : startSend()}
                style={{
                  padding: '4px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 700,
                  border: '1px solid #2563eb',
                  background: (sendSelect || (showCompose && sendMode)) ? 'rgba(37,99,235,0.15)' : '#2563eb',
                  color: (sendSelect || (showCompose && sendMode)) ? '#2563eb' : '#fff',
                }}
              >
                {(sendSelect || (showCompose && sendMode)) ? '✕ Schließen' : '📨 Antragsunterlagen an Mandanten senden'}
              </button>
            )}
            {isUstReg && (
              <button
                onClick={() => (showCompose && infoMode) ? closeCompose() : startInfo()}
                style={{
                  padding: '4px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 700,
                  border: '1px solid #0f766e',
                  background: (showCompose && infoMode) ? 'rgba(15,118,110,0.15)' : '#0f766e',
                  color: (showCompose && infoMode) ? '#0f766e' : '#fff',
                }}
              >
                {(showCompose && infoMode) ? '✕ Schließen' : '🏛 Mandant: Antrag eingereicht'}
              </button>
            )}
            <button
              onClick={() => showCompose ? closeCompose() : openCompose(false)}
              style={{
                padding: '4px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                border: `1px solid ${showCompose ? 'var(--accent)' : 'rgba(8,145,178,0.3)'}`,
                background: showCompose ? 'rgba(8,145,178,0.1)' : 'rgba(8,145,178,0.05)',
                color: showCompose ? 'var(--accent)' : '#0891b2',
              }}
            >
              {showCompose ? '✕ Schließen' : '✉️ Neue E-Mail'}
            </button>
          </div>
        )}
      </div>

      {/* Anlagen-Auswahl (Schritt 1) */}
      {canCompose && sendSelect && (
        <div style={{ marginBottom: '14px', border: '1px solid rgba(37,99,235,0.3)', borderRadius: '10px', background: 'rgba(37,99,235,0.04)', padding: '14px' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px', color: 'var(--text)' }}>📎 Anlagen auswählen</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Welche Dokumente sollen an die E-Mail angehängt werden? (frisch aus den aktuellen Antragsdaten erzeugt)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
            {SEND_DOKS.map(d => (
              <label key={d.art} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!sendSelect[d.art]}
                  onChange={e => setSendSelect(s => ({ ...s, [d.art]: e.target.checked }))}
                  style={{ accentColor: '#2563eb', cursor: 'pointer', width: '15px', height: '15px' }} />
                <span>📄 {d.label}</span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={prepareSend} disabled={!SEND_DOKS.some(d => sendSelect[d.art])}
              style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: SEND_DOKS.some(d => sendSelect[d.art]) ? '#2563eb' : 'var(--border)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: SEND_DOKS.some(d => sendSelect[d.art]) ? 'pointer' : 'not-allowed' }}>
              ✉️ E-Mail vorbereiten
            </button>
            <button onClick={() => setSendSelect(null)}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '12px', cursor: 'pointer' }}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Compose-Panel */}
      {canCompose && showCompose && (
        <div style={{ marginBottom: '14px' }}>
          {sendMode && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Vorbefüllte E-Mail ({/dänemark|danmark|denmark|\bdk\b/.test((au.erfassungsdaten?.adresse_land || '').toLowerCase()) ? '🇩🇰 Dänisch' : '🇩🇪 Deutsch'}) mit {sendArts.length} {sendArts.length === 1 ? 'Anlage' : 'Anlagen'}. Bitte prüfen, dann „Senden".
            </div>
          )}
          {infoMode && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Info-Mail „Antrag eingereicht" ({/dänemark|danmark|denmark|\bdk\b/.test((au.erfassungsdaten?.adresse_land || '').toLowerCase()) ? '🇩🇰 Dänisch' : '🇩🇪 Deutsch'}) vorbefüllt. Bei Bedarf die Rechnung anhängen (📎), prüfen, dann „Senden".
            </div>
          )}
          <JAComposePanel
            au={au}
            client={client}
            emailVorlagen={emailVorlagen}
            extraVorlagen={ustRegVorlagen}
            initialAttachments={pdfAttachments}
            preset={sendMode ? sendPreset : infoMode ? infoPreset : null}
            forcePreset={sendMode || infoMode}
            onSent={sendMode ? handleSent : infoMode ? handleSentInfo : undefined}
            emailSignaturen={emailSignaturen}
            onedriveTokens={onedriveTokens}
            onUpdateOnedriveTokens={onUpdateOnedriveTokens}
            onUpdateClient={onUpdateClient}
            onClose={closeCompose}
          />
        </div>
      )}

      {/* Aktivität erfassen */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: '14px' }}>
        <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '13px' }}>➕ Aktivität erfassen</span>
        </div>
        <div style={{ padding: '12px 14px', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Object.entries(WORKFLOW_AKTIVITAETEN).map(([key, cfg]) => {
              const active = selectedTyp === key
              return (
                <button key={key} onClick={() => handleQuickAction(key)} style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
                  border: `1px solid ${active ? cfg.color : 'var(--border)'}`,
                  background: active ? cfg.color + '18' : 'var(--surface2)',
                  color: active ? cfg.color : 'var(--text-secondary)',
                  fontSize: '12px', fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s',
                  boxShadow: active ? `0 0 0 2px ${cfg.color}25` : 'none',
                }}>
                  {cfg.icon} {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {selectedTyp && (() => {
          const cfg = WORKFLOW_AKTIVITAETEN[selectedTyp]
          return (
            <div style={{ padding: '14px', background: cfg.color + '06', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px' }}>{cfg.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: cfg.color }}>{cfg.label}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>Datum</label>
                  <input type="date" value={newDatum} onChange={e => setNewDatum(e.target.value)} style={iStyle} />
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>Notiz (optional)</label>
                  <textarea
                    value={newNotiz}
                    onChange={e => setNewNotiz(e.target.value)}
                    placeholder="Details zur Aktivität…"
                    rows={3}
                    style={{ ...iStyle, width: '100%', resize: 'vertical', whiteSpace: 'pre-wrap', minHeight: '60px', boxSizing: 'border-box' }}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addVerlauf() }}
                    autoFocus
                  />
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>Strg+Enter zum Speichern</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addVerlauf}
                  style={{ padding: '7px 18px', borderRadius: '6px', border: 'none', background: cfg.color, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  ✓ Bestätigen
                </button>
                <button onClick={() => setSelectedTyp(null)}
                  style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>
                  ✕ Abbrechen
                </button>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Timeline */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '20px 12px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '2px dashed var(--border)' }}>
          <div style={{ fontSize: '24px', marginBottom: '6px', opacity: 0.4 }}>📊</div>
          Noch keine Aktivitäten erfasst.
        </div>
      ) : (
        <div>
          {sorted.map((item, idx) => {
            const cfg = WORKFLOW_AKTIVITAETEN[item.typ] ?? WORKFLOW_AKTIVITAETEN.notiz
            const isLast = idx === sorted.length - 1
            return (
              <div key={item.id} style={{ display: 'flex', gap: '0', position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '36px', flexShrink: 0 }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '50%', zIndex: 1, flexShrink: 0,
                    background: 'var(--bg, #0f1117)',
                    border: `2px solid ${cfg.color}`,
                    boxShadow: `0 0 0 2px ${cfg.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px',
                  }}>
                    {cfg.icon}
                  </div>
                  {!isLast && <div style={{ width: '2px', flex: 1, background: 'var(--border)', marginTop: '2px', minHeight: '12px' }} />}
                </div>
                <div style={{
                  flex: 1, marginLeft: '8px', marginBottom: isLast ? '0' : '10px',
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: '8px', overflow: 'hidden',
                }}>
                  <div style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', borderBottom: item.text && item.text !== cfg.label ? '1px solid var(--border)' : 'none' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, color: cfg.color,
                      background: cfg.color + '15', padding: '2px 8px', borderRadius: '10px',
                    }}>
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1 }}>
                      {fmtShortDate(item.datum)}
                    </span>
                    {item._email
                      ? <span style={{ fontSize: '9px', color: 'var(--text-muted)', flexShrink: 0 }}>📧 Nachrichten</span>
                      : <button onClick={() => deleteVerlauf(item.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '0 2px', flexShrink: 0 }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>✕</button>
                    }
                  </div>
                  {item.text && item.text !== cfg.label && (
                    <div style={{ padding: '5px 10px', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {item.text}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Einzelauftrag-Karte ───────────────────────────────────────────────────────
// ── Antragsdaten + Dokumente (USt-Reg. DE) ────────────────────────────────────
const ERFASSUNG_FELDER = [
  { gruppe: 'Unternehmen', felder: [
    { key: 'personenart',      label: 'Personenart (für Einwilligung)', options: [
      { value: 'juristisch', label: 'Juristische Person (ApS, GmbH …)' },
      { value: 'natuerlich', label: 'Natürliche Person (Einzelunternehmer)' },
    ]},
    { key: 'firmenname',       label: 'Firmenname' },
    { key: 'cvr_nummer',       label: 'CVR-/Handelsreg.-Nr.' },
    { key: 'adresse_strasse',  label: 'Straße, Hausnr.' },
    { key: 'adresse_plz_ort',  label: 'PLZ & Ort' },
    { key: 'adresse_land',     label: 'Land' },
  ]},
  { gruppe: 'Geschäftsführer / Inhaber', felder: [
    { key: 'geschaeftsfuehrer_name',         label: 'Name' },
    { key: 'geschaeftsfuehrer_geburtsdatum', label: 'Geburtsdatum' },
    { key: 'geschaeftsfuehrer_adresse',      label: 'Privatadresse' },
  ]},
  { gruppe: 'Ansprechpartner', felder: [
    { key: 'ansprechpartner_name',    label: 'Name' },
    { key: 'ansprechpartner_email',   label: 'E-Mail' },
    { key: 'ansprechpartner_telefon', label: 'Telefon' },
  ]},
  { gruppe: 'Tätigkeit & Umsatz', felder: [
    { key: 'taetigkeit_beschreibung', label: 'Tätigkeit', textarea: true, wide: true },
    { key: 'taetigkeit_beginn',       label: 'Beginn DE-Tätigkeit' },
    { key: 'umsatz_art',              label: 'Art der Umsätze' },
    { key: 'umsatz_geschaetzt',       label: 'Umsatz DE (1. Jahr)' },
    { key: 'umsatz_folgejahr',        label: 'Umsatz Folgejahr' },
    { key: 'lager_in_deutschland',    label: 'Lager / Büro in DE' },
    { key: 'bereits_registriert',     label: 'Bereits registriert?' },
  ]},
  { gruppe: 'Bank & Sonstiges', felder: [
    { key: 'bankverbindung_iban', label: 'IBAN' },
    { key: 'bemerkungen',         label: 'Bemerkungen', textarea: true, wide: true },
  ]},
  { gruppe: 'Finanzamt-Antrag – Zusatzangaben', felder: [
    { key: 'fa_betriebsart',      label: '6. Art des Betriebes', placeholder: 'Website-Verkäufe' },
    { key: 'fa_inland_besteht',   label: '7. Im Inland besteht ein/eine', placeholder: '-' },
    { key: 'fa_finanzamt_ertrag', label: '8. FA (ertragsteuerlich)', placeholder: 'Flensburg' },
    { key: 'fa_10_1',             label: '10.1 Lieferung an Unternehmer mit ID-Nr.', placeholder: 'Nein' },
    { key: 'fa_10_2',             label: '10.2 Lieferung an Kunden ohne ID-Nr.', placeholder: 'Ja' },
    { key: 'fa_10_3',             label: '10.3 Ein-/Verkauf innerhalb DE', placeholder: 'Ja' },
    { key: 'fa_10_4',             label: '10.4 Innergem. steuerfreie Lieferungen', placeholder: 'Nein' },
    { key: 'fa_11',               label: '11. Freiwilliges innergem. Verbringen?', placeholder: 'Nein' },
    { key: 'fa_12',               label: '12. Lieferung mit Montage / sonstige Leistungen an', placeholder: 'Nein' },
    { key: 'fa_13',               label: '13. Ausländische Subunternehmer (§13b)?', placeholder: 'Nein' },
    { key: 'fa_14',               label: '14. USt-IdNr. benötigt?', placeholder: 'Ja' },
    { key: 'fa_14_1',             label: '14.1 Wenn ja, wofür?', placeholder: 'Für die Registrierung bei Onlinemarktplätzen', wide: true },
  ]},
]

function dokLabel(art) {
  switch (art) {
    case 'vollmacht':        return 'Empfangsvollmacht'
    case 'einwilligung_jur': return 'Einwilligung E-Mail (juristisch)'
    case 'einwilligung_nat': return 'Einwilligung E-Mail (natürlich)'
    default:                 return 'Antrag ans Finanzamt'
  }
}

function AntragsdatenSection({ au, client, onUpdate }) {
  const [open, setOpen] = useState(true)
  const [preview, setPreview] = useState(null)   // { art, doc, url }
  const ed = au.erfassungsdaten ?? {}
  const dokumente = au.dokumente ?? []

  // Blob-URL freigeben, wenn Vorschau wechselt/schließt
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url) }, [preview])

  function setFeld(key, val) {
    onUpdate({ erfassungsdaten: { ...ed, [key]: val }, erfassungsdatenBearbeitetAm: new Date().toISOString() })
  }

  // Vorschau öffnen — erzeugt PDF nur zur Ansicht, noch kein Download / keine Aufzeichnung
  function openPreview(art) {
    // Einwilligung: passende Variante nach Personenart wählen
    let resolvedArt = art
    if (art === 'einwilligung') {
      resolvedArt = (ed.personenart === 'natuerlich') ? 'einwilligung_nat' : 'einwilligung_jur'
    }
    const doc = buildDoc(resolvedArt, client, au)
    const url = URL.createObjectURL(doc.output('blob'))
    setPreview({ art: resolvedArt, doc, url })
  }

  function closePreview() { setPreview(null) }

  // Erst beim Bestätigen in der Vorschau: Download + Verlauf + Status
  function confirmDownload() {
    if (!preview) return
    const { art, doc } = preview
    const filename = pdfFilename(art, au)
    downloadPdf(doc, filename)

    const eintrag = {
      id: 'dok_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      art,
      name: filename,
      contentType: 'application/pdf',
      erstelltAm: new Date().toISOString(),
    }
    const verlaufItem = {
      id: genVerlaufId(),
      typ: 'dokument_erstellt',
      datum: todayISO(),
      text: dokLabel(art) + ' erzeugt: ' + filename,
      erstelltAm: new Date().toISOString(),
    }
    const patch = {
      dokumente: [eintrag, ...dokumente.filter(d => d.art !== art)],
      verlauf: [verlaufItem, ...(au.verlauf ?? [])],
    }
    // Status auf 'antrag_erzeugt' vorrücken, falls noch davor
    const order = (WORKFLOW_CONFIGS[au.typ]?.steps ?? []).map(s => s.key)
    const curIdx = order.indexOf(au.workflowStatus ?? order[0])
    const targetIdx = order.indexOf('antrag_erzeugt')
    if (targetIdx >= 0 && curIdx < targetIdx) {
      patch.workflowStatus = 'antrag_erzeugt'
      patch.workflowStatusDatum = todayISO()
    }
    onUpdate(patch)
    closePreview()
  }

  const fieldInput = (f) => f.options ? (
    <select value={ed[f.key] ?? ''} onChange={e => setFeld(f.key, e.target.value)} style={inputStyle}>
      {(ed[f.key] ?? '') === '' && <option value="">— bitte wählen —</option>}
      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ) : f.textarea ? (
    <textarea
      value={ed[f.key] ?? ''}
      onChange={e => setFeld(f.key, e.target.value)}
      placeholder={f.placeholder ?? ''}
      rows={2}
      style={{ ...inputStyle, resize: 'vertical', whiteSpace: 'pre-wrap', minHeight: '44px' }}
    />
  ) : (
    <input value={ed[f.key] ?? ''} onChange={e => setFeld(f.key, e.target.value)} placeholder={f.placeholder ?? ''} style={inputStyle} />
  )

  return (
    <div style={{ marginBottom: '16px', border: '1px solid rgba(37,99,235,0.25)', borderRadius: '10px', overflow: 'hidden', background: 'rgba(37,99,235,0.03)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(37,99,235,0.06)', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: open ? '1px solid rgba(37,99,235,0.2)' : 'none' }}
      >
        <span style={{ fontSize: '15px' }}>📋</span>
        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)', flex: 1 }}>Antragsdaten</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '14px' }}>
          {/* PDF-Buttons (öffnen Vorschau) */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <button onClick={() => openPreview('antrag')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              📝 Antrag ans Finanzamt – Vorschau
            </button>
            <button onClick={() => openPreview('vollmacht')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #2563eb', background: 'transparent', color: '#2563eb', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              📄 Empfangsvollmacht – Vorschau
            </button>
            <button onClick={() => openPreview('einwilligung')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: '1px solid #2563eb', background: 'transparent', color: '#2563eb', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              📧 Einwilligung E-Mail – Vorschau
              <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.75 }}>
                ({(ed.personenart === 'natuerlich') ? 'natürl.' : 'jurist.'})
              </span>
            </button>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Erst Vorschau prüfen — heruntergeladen wird das PDF erst nach Bestätigung.
          </div>

          {dokumente.length > 0 && (
            <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {dokumente.map(d => (
                <div key={d.id} style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📄</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{d.name}</span>
                  <span>· erzeugt {fmtShortDate(d.erstelltAm)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Felder gruppiert */}
          {ERFASSUNG_FELDER.map(grp => (
            <div key={grp.gruppe} style={{ marginBottom: '12px' }}>
              <div style={{ ...labelStyle, marginBottom: '6px', color: '#2563eb' }}>{grp.gruppe}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {grp.felder.map(f => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px', gridColumn: f.wide ? '1 / -1' : 'auto' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{f.label}</span>
                    {fieldInput(f)}
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Änderungshistorie */}
          <div style={{ marginTop: '6px', paddingTop: '10px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)' }}>
            {au.erfassungsdatenBearbeitetAm
              ? <span>✏️ Zuletzt bearbeitet: {fmtShortDate(au.erfassungsdatenBearbeitetAm)}</span>
              : <span>Unverändert – Originaldaten aus dem Webformular</span>}
            {au.erfassungsdatenOriginal && (
              <details style={{ marginTop: '6px' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--accent)' }}>Ursprüngliche Webformular-Daten anzeigen</summary>
                <div style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '3px 16px' }}>
                  {Object.entries(au.erfassungsdatenOriginal).filter(([, v]) => String(v ?? '').trim()).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{k}:</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* ── PDF-Vorschau-Modal ── */}
      {preview && (
        <div onClick={closePreview} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '12px', width: 'min(900px, 95vw)', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.45)' }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '15px' }}>{preview.art === 'vollmacht' ? '📄' : preview.art.startsWith('einwilligung') ? '📧' : '📝'}</span>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', flex: 1 }}>
                Vorschau – {dokLabel(preview.art)}
              </span>
              <button onClick={closePreview} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1 }}>✕</button>
            </div>
            <iframe title="PDF-Vorschau" src={preview.url} style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }} />
            <div style={{ padding: '12px 16px', display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Stimmt alles? Sonst „Abbrechen", oben die Antragsdaten korrigieren und erneut prüfen.
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={closePreview} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '13px', cursor: 'pointer' }}>
                  Abbrechen
                </button>
                <button onClick={confirmDownload} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  ⬇️ Herunterladen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AuftragCard({ au, expanded, onExpand, onUpdate, onDelete, client, onOpenEmail, onUpdateClient, emailVorlagen, emailSignaturen, onedriveTokens, onUpdateOnedriveTokens }) {
  const typCfg    = AUFTRAGS_TYP_CFG[au.typ]      ?? AUFTRAGS_TYP_CFG.freitext
  const statusCfg = AUFTRAGS_STATUS_CFG[au.status] ?? AUFTRAGS_STATUS_CFG.offen
  const frist     = fmtFrist(au.frist)
  const hinweise  = au.hinweise ?? []
  const offeneH   = hinweise.filter(h => !h.erledigt).length

  const [newH, setNewH] = useState('')

  function cycleStatus(e) {
    e.stopPropagation()
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(au.status) + 1) % STATUS_ORDER.length]
    onUpdate({ status: next, erledigtAm: next === 'erledigt' ? new Date().toISOString() : null })
  }

  function addHinweis() {
    const t = newH.trim(); if (!t) return
    onUpdate({ hinweise: [...hinweise, mkHinweis(t)] })
    setNewH('')
  }

  const isJA        = au.typ === 'jahresabschluss'
  const isErfassung = au.typ === 'erfassung'
  const hasWorkflow = !!WORKFLOW_CONFIGS[au.typ]
  const jaWfsCfg = isJA ? (JA_WORKFLOW_STATUS[au.jaWorkflowStatus ?? 'neu'] ?? JA_WORKFLOW_STATUS.neu) : null
  const wfCurrentStep = hasWorkflow ? (WORKFLOW_CONFIGS[au.typ].steps.find(s => s.key === (au.workflowStatus ?? 'anfrage')) ?? WORKFLOW_CONFIGS[au.typ].steps[0]) : null
  // Für JA: Abschluss-Jahr prominent im Titel zeigen
  const titel = au.bezeichnung
    || (isJA && au.abschlussJahr ? `Jahresabschluss ${au.abschlussJahr}` : `${typCfg.label}${au.monat ? ' ' + MONATE[au.monat - 1] : ''} ${au.jahr}`)

  return (
    <div style={{
      border: `1px solid ${expanded ? typCfg.color + '55' : 'var(--border)'}`,
      borderRadius: '10px', background: 'var(--surface)', overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      <div
        onClick={() => onExpand(expanded ? null : au.id)}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', background: expanded ? typCfg.bg : 'transparent', userSelect: 'none' }}
      >
        <span style={{ fontSize: '16px', flexShrink: 0 }}>{typCfg.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: au.status === 'erledigt' ? 'var(--text-muted)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: au.status === 'erledigt' ? 'line-through' : 'none' }}>
            {titel}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '3px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: typCfg.color, fontWeight: 600, background: typCfg.bg, padding: '1px 6px', borderRadius: '8px', border: `1px solid ${typCfg.border}` }}>
              {typCfg.label}
            </span>
            {/* JA: Workflow-Status statt einfachem "Jahr" */}
            {isJA && jaWfsCfg && (
              <span style={{ fontSize: '10px', fontWeight: 600, color: jaWfsCfg.color, background: jaWfsCfg.bg, padding: '1px 6px', borderRadius: '8px', border: `1px solid ${jaWfsCfg.border}` }}>
                {jaWfsCfg.icon} {jaWfsCfg.label}
              </span>
            )}
            {/* Workflow-Typen: aktuellen Schritt anzeigen */}
            {hasWorkflow && wfCurrentStep && (
              <span style={{ fontSize: '10px', fontWeight: 600, color: wfCurrentStep.color, background: wfCurrentStep.bg, padding: '1px 6px', borderRadius: '8px', border: `1px solid ${wfCurrentStep.border}` }}>
                {wfCurrentStep.icon} {wfCurrentStep.label}
              </span>
            )}
            {!isJA && !hasWorkflow && (au.monat
              ? <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{MONATE[au.monat - 1]} {au.jahr}</span>
              : au.jahr && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{au.jahr}</span>
            )}
            {frist && <span style={{ fontSize: '10px', fontWeight: 600, color: frist.color }}>⏰ {frist.text}</span>}
            {offeneH > 0 && <span style={{ fontSize: '10px', color: '#f97316', fontWeight: 600 }}>· {offeneH} offen</span>}
          </div>
        </div>
        {/* JA + Workflow-Typen: kein einfacher cycle-Button */}
        {!isJA && !hasWorkflow && (
          <button onClick={cycleStatus} title="Status wechseln"
            style={{ fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', border: `1px solid ${statusCfg.border}`, background: statusCfg.bg, color: statusCfg.color, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {statusCfg.icon} {statusCfg.label}
          </button>
        )}
        <span style={{ color: 'var(--text-muted)', fontSize: '10px', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${typCfg.color}33`, padding: '14px 16px' }}>

          {/* ── JA: Abschluss-Jahr + Workflow-Status prominent oben ── */}
          {isJA && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', padding: '10px 14px', background: 'rgba(37,99,235,0.04)', borderRadius: '8px', border: '1px solid rgba(37,99,235,0.15)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ ...labelStyle, color: '#2563eb' }}>📅 Jahresabschluss für Jahr</span>
                  <input
                    type="number"
                    value={au.abschlussJahr ?? new Date().getFullYear() - 1}
                    min="2010" max="2035"
                    onChange={e => onUpdate({ abschlussJahr: parseInt(e.target.value) || au.abschlussJahr })}
                    style={{ ...inputStyle, width: '80px', fontWeight: 700, fontSize: '18px', textAlign: 'center', color: '#2563eb', borderColor: 'rgba(37,99,235,0.3)', background: 'rgba(37,99,235,0.06)' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ ...labelStyle }}>Geplante Fertigstellung</span>
                  <input type="date" value={au.frist ?? ''} onChange={e => onUpdate({ frist: e.target.value })} style={inputStyle} />
                </div>
              </div>
              <JAStatusSection au={au} onUpdate={onUpdate} />
            </>
          )}

          {/* ── Workflow-Typen: Prozess-Stepper oben ── */}
          {hasWorkflow && (
            <WorkflowPanel au={au} onUpdate={onUpdate} />
          )}

          {/* ── USt-Reg. DE: Antragsdaten + PDF-Erzeugung ── */}
          {(au.typ === 'ust_reg_de' || au.erfassungsdaten) && (
            <AntragsdatenSection au={au} client={client} onUpdate={onUpdate} />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '10px', marginBottom: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Bezeichnung</span>
              <input value={au.bezeichnung} onChange={e => onUpdate({ bezeichnung: e.target.value })} placeholder={isJA ? `Jahresabschluss ${au.abschlussJahr ?? ''}` : 'z. B. Lohn Juni 2026'} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Typ</span>
              <select value={au.typ} onChange={e => onUpdate({ typ: e.target.value })} style={inputStyle}>
                <TypOptions />
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>{isJA ? 'Bearbeitungsjahr' : 'Jahr'}</span>
              <input type="number" value={au.jahr} min="2020" max="2035"
                onChange={e => onUpdate({ jahr: parseInt(e.target.value) || au.jahr })} style={inputStyle} />
            </label>
            {!isJA && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={labelStyle}>Monat</span>
                <select value={au.monat ?? ''} onChange={e => onUpdate({ monat: e.target.value ? parseInt(e.target.value) : null })} style={inputStyle}>
                  <option value="">— keiner —</option>
                  {MONATE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </label>
            )}
            {!isJA && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={labelStyle}>Interne Frist</span>
                <input type="date" value={au.frist} onChange={e => onUpdate({ frist: e.target.value })} style={inputStyle} />
              </label>
            )}
          </div>

          <div style={{ marginBottom: au.emailRef ? '8px' : '14px' }}>
            <NotizDiktatWidget
              value={au.notiz}
              onChange={val => onUpdate({ notiz: val })}
              placeholder="Interne Anmerkungen zum Auftrag…"
              rows={2}
              inputStyle={inputStyle}
            />
          </div>

          {/* E-Mail-Quelle (wenn aus E-Mail erstellt) */}
          {au.emailRef && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(22,163,74,0.04)', border: '1px solid rgba(22,163,74,0.15)', marginBottom: '14px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', flex: 1, minWidth: 0 }}>
                📧 Quelle: E-Mail von <b>{au.emailRef.absender}</b>
                {au.emailRef.betreff && <> — {au.emailRef.betreff}</>}
              </span>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
              Hinweise &amp; Unteraufgaben
            </div>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <input value={newH} onChange={e => setNewH(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (() => { const t = newH.trim(); if (!t) return; onUpdate({ hinweise: [...hinweise, mkHinweis(t)] }); setNewH('') })()}
                placeholder="Hinweis eingeben… (Enter)" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={() => { const t = newH.trim(); if (!t) return; onUpdate({ hinweise: [...hinweise, mkHinweis(t)] }); setNewH('') }}
                style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: typCfg.color, color: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>
                +
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {hinweise.length === 0
                ? <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Noch keine Hinweise.</div>
                : hinweise.map(h => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', background: h.erledigt ? 'rgba(22,163,74,0.04)' : 'var(--surface2)', border: `1px solid ${h.erledigt ? 'rgba(22,163,74,0.2)' : 'var(--border)'}` }}>
                    <input type="checkbox" checked={h.erledigt}
                      onChange={() => onUpdate({ hinweise: hinweise.map(x => x.id === h.id ? { ...x, erledigt: !x.erledigt } : x) })}
                      style={{ accentColor: typCfg.color, cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '12px', color: h.erledigt ? 'var(--text-muted)' : 'var(--text)', textDecoration: h.erledigt ? 'line-through' : 'none' }}>
                      {h.text}
                    </span>
                    <button onClick={() => onUpdate({ hinweise: hinweise.filter(x => x.id !== h.id) })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '0 2px', flexShrink: 0 }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>✕</button>
                  </div>
                ))
              }
            </div>
          </div>

          {/* ── Jahresabschluss-spezifische Sektionen ── */}
          {isJA && (
            <>
              <JAHonorarSection au={au} onUpdate={onUpdate} />
              <JAChecklisteSection
                jaCheckliste={au.jaCheckliste}
                onUpdate={patch => onUpdate(patch)}
              />
              <JAVerlaufSection
                au={au} client={client} onUpdate={onUpdate} onOpenEmail={onOpenEmail}
                onUpdateClient={onUpdateClient}
                emailVorlagen={emailVorlagen}
                emailSignaturen={emailSignaturen}
                onedriveTokens={onedriveTokens}
                onUpdateOnedriveTokens={onUpdateOnedriveTokens}
              />
            </>
          )}

          {/* ── Steuerliche Erfassung ── */}
          {isErfassung && (
            <ErfassungVerlaufSection au={au} onUpdate={onUpdate} />
          )}

          {/* ── Workflow-Typen: Verlauf & Aktivitäten ── */}
          {hasWorkflow && (
            <WorkflowVerlaufSection
              au={au} onUpdate={onUpdate}
              client={client} onUpdateClient={onUpdateClient}
              emailVorlagen={emailVorlagen} emailSignaturen={emailSignaturen}
              onedriveTokens={onedriveTokens} onUpdateOnedriveTokens={onUpdateOnedriveTokens}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <button onClick={onDelete}
              style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' }}>
              🗑 Auftrag löschen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Serienauftrag-Karte (echter Wiederholungsauftrag) ─────────────────────────
function SerienAuftragCard({ au, expanded, onExpand, onUpdate, onDelete }) {
  const typCfg    = AUFTRAGS_TYP_CFG[au.typ] ?? AUFTRAGS_TYP_CFG.freitext
  const serie     = au.serie ?? {}
  const instanzen = useMemo(() => generateSerieInstanzen(au), [au])
  const [showAll, setShowAll] = useState(false)

  const heute = new Date(); heute.setHours(0, 0, 0, 0)

  const cntErledigt  = instanzen.filter(i => i.status === 'erledigt').length
  const cntOffen     = instanzen.filter(i => i.status === 'offen').length
  const cntInBearb   = instanzen.filter(i => i.status === 'in_bearbeitung').length
  const cntUeberfaellig = instanzen.filter(i => i.status !== 'erledigt' && i.datum < heute).length

  function cycleInstanzStatus(key, currentStatus) {
    const next      = STATUS_ORDER[(STATUS_ORDER.indexOf(currentStatus) + 1) % STATUS_ORDER.length]
    const instanzen = { ...(au.instanzen ?? {}), [key]: { status: next, erledigtAm: next === 'erledigt' ? new Date().toISOString() : null } }
    onUpdate({ instanzen })
  }

  function updateSerie(patch) {
    onUpdate({ serie: { ...serie, ...patch } })
  }

  const titelLabel = au.bezeichnung || `${typCfg.label} – ${intervallLabel(serie)}`

  return (
    <div style={{
      border: `1px solid ${expanded ? 'rgba(99,102,241,0.55)' : 'rgba(99,102,241,0.3)'}`,
      borderRadius: '10px', background: 'var(--surface)', overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      {/* ── Kopfzeile ── */}
      <div
        onClick={() => onExpand(expanded ? null : au.id)}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', background: expanded ? 'rgba(99,102,241,0.05)' : 'transparent', userSelect: 'none' }}
      >
        <span style={{ fontSize: '16px', flexShrink: 0 }}>🔁</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {titelLabel}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '3px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: typCfg.color, fontWeight: 600, background: typCfg.bg, padding: '1px 6px', borderRadius: '8px', border: `1px solid ${typCfg.border}` }}>
              {typCfg.icon} {typCfg.label}
            </span>
            <span style={{ fontSize: '10px', color: 'rgba(99,102,241,0.9)', fontWeight: 600, background: 'rgba(99,102,241,0.08)', padding: '1px 6px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.25)' }}>
              🔁 {intervallLabel(serie)}
            </span>
            {cntUeberfaellig > 0 && <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700 }}>⚠ {cntUeberfaellig} überfällig</span>}
            {cntInBearb > 0  && <span style={{ fontSize: '10px', color: '#2563eb' }}>◑ {cntInBearb} in Bearb.</span>}
            {cntOffen > 0    && <span style={{ fontSize: '10px', color: '#64748b' }}>○ {cntOffen} offen</span>}
            {cntErledigt > 0 && <span style={{ fontSize: '10px', color: '#16a34a' }}>✓ {cntErledigt}×</span>}
          </div>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '10px', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* ── Detail-Bereich ── */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(99,102,241,0.2)', padding: '14px 16px' }}>

          {/* Konfiguration */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '14px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Bezeichnung</span>
              <input value={au.bezeichnung} onChange={e => onUpdate({ bezeichnung: e.target.value })}
                placeholder="z. B. FIBU monatlich" style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Typ</span>
              <select value={au.typ} onChange={e => onUpdate({ typ: e.target.value })} style={inputStyle}>
                <TypOptions />
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Startdatum</span>
              <input type="date" value={serie.startDatum ?? ''} onChange={e => updateSerie({ startDatum: e.target.value })} style={inputStyle} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Wiederholung</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input type="number" min={1} max={99} value={serie.intervallWert ?? 1}
                  onChange={e => updateSerie({ intervallWert: Math.max(1, parseInt(e.target.value) || 1) })}
                  style={{ ...inputStyle, width: '54px', flex: 'none' }} />
                <select value={serie.intervallTyp ?? 'monate'}
                  onChange={e => updateSerie({ intervallTyp: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}>
                  {INTERVALL_TYPEN.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={labelStyle}>Ende</span>
              <select value={serie.endTyp ?? 'kein'} onChange={e => updateSerie({ endTyp: e.target.value })} style={inputStyle}>
                <option value="kein">Fortlaufend (~3 Mo. voraus)</option>
                <option value="datum">Am Datum</option>
                <option value="anzahl">Nach N Terminen</option>
              </select>
            </label>
            {serie.endTyp === 'datum' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={labelStyle}>Enddatum</span>
                <input type="date" value={serie.endDatum ?? ''} onChange={e => updateSerie({ endDatum: e.target.value })} style={inputStyle} />
              </label>
            )}
            {serie.endTyp === 'anzahl' && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={labelStyle}>Anzahl Termine</span>
                <input type="number" min={1} max={300} value={serie.endAnzahl ?? 12}
                  onChange={e => updateSerie({ endAnzahl: Math.max(1, parseInt(e.target.value) || 1) })}
                  style={inputStyle} />
              </label>
            )}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <NotizDiktatWidget
              value={au.notiz ?? ''}
              onChange={val => onUpdate({ notiz: val })}
              placeholder="Interne Anmerkungen…"
              rows={2}
              inputStyle={inputStyle}
            />
          </div>

          {/* ── Instanzen-Zeitstrahl ── */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Termine ({instanzen.length})
              </span>
              {instanzen.length > 8 && (
                <button onClick={() => setShowAll(v => !v)}
                  style={{ fontSize: '10px', background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 8px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showAll ? 'Kompakt' : `Alle ${instanzen.length} anzeigen`}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: showAll ? 'none' : '220px', overflowY: showAll ? 'visible' : 'auto' }}>
              {instanzen.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Keine Termine generiert – Startdatum und Endbedingung prüfen.</div>
              ) : instanzen.map(inst => {
                const stCfg      = AUFTRAGS_STATUS_CFG[inst.status] ?? AUFTRAGS_STATUS_CFG.offen
                const istVergangen = inst.datum < heute
                const istHeute     = inst.datum.toDateString() === heute.toDateString()
                return (
                  <div key={inst.key} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '5px 10px', borderRadius: '6px',
                    background: istHeute ? 'rgba(59,130,246,0.07)' : inst.status === 'erledigt' ? 'rgba(22,163,74,0.03)' : 'var(--surface2)',
                    border: `1px solid ${istHeute ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                  }}>
                    <span style={{
                      fontSize: '11px', fontFamily: 'monospace', minWidth: '75px', flexShrink: 0,
                      color: istVergangen && inst.status !== 'erledigt' ? '#ef4444' : istHeute ? '#3b82f6' : 'var(--text-muted)',
                      fontWeight: istHeute ? 700 : 400,
                    }}>
                      {fmtDatumShort(inst.datum)}{istHeute ? ' ◀' : ''}
                    </span>
                    <span style={{ flex: 1, fontSize: '11px', color: inst.status === 'erledigt' ? 'var(--text-muted)' : 'var(--text)', textDecoration: inst.status === 'erledigt' ? 'line-through' : 'none' }}>
                      {au.bezeichnung || `${typCfg.label} ${MONATE[inst.datum.getMonth()]} ${inst.datum.getFullYear()}`}
                    </span>
                    <button onClick={() => cycleInstanzStatus(inst.key, inst.status)} title="Status wechseln"
                      style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', border: `1px solid ${stCfg.border}`, background: stCfg.bg, color: stCfg.color, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {stCfg.icon} {stCfg.label}
                    </button>
                    {inst.erledigtAm && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {new Date(inst.erledigtAm).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {serie.endTyp === 'kein' && (
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
                Fortlaufend – zeigt Termine bis 3 Monate im Voraus. Vergangene Termine bleiben sichtbar.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <button onClick={onDelete}
              style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' }}>
              🗑 Serienauftrag löschen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Batch-Serie Panel (Feature 4) ─────────────────────────────────────────────
const FRIST_MODI = [
  { key: 'kein',       label: 'Keine Frist'           },
  { key: 'gleicher',   label: 'Gleicher Monat'         },
  { key: 'folgemonat', label: 'Folgemonat'             },
  { key: 'tage',       label: 'X Tage nach Monatsende' },
]

function BatchSeriePanel({ onCreate, onClose }) {
  const initDef = FRIST_DEFAULTS.lohn
  const [typ,        setTyp]        = useState('lohn')
  const [jahr,       setJahr]       = useState(new Date().getFullYear())
  const [rhythmus,   setRhythmus]   = useState('monatlich')
  const [fristModus, setFristModus] = useState(initDef.modus)
  const [fristTag,   setFristTag]   = useState(initDef.tag)
  const [fristTage,  setFristTage]  = useState(10)

  function handleTypChange(newTyp) {
    setTyp(newTyp)
    const def = FRIST_DEFAULTS[newTyp]
    if (def) { setFristModus(def.modus); setFristTag(def.tag) }
  }

  const monate   = SERIE_RHYTHMUS.find(r => r.key === rhythmus)?.monate ?? []
  const vorschau = monate.map(monat => ({ monat, frist: calcFrist(jahr, monat, fristModus, fristTag, fristTage) }))
  const smallInput = { ...inputStyle, width: '62px', flex: 'none', padding: '5px 8px' }

  const fmtPrev = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontWeight: 700, fontSize: '13px' }}>📅 Batch-Serie anlegen</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>– erstellt {monate.length} Einzelaufträge</span>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px' }}>✕</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: '10px', marginBottom: '12px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Typ</span>
          <select value={typ} onChange={e => handleTypChange(e.target.value)} style={inputStyle}>
            <TypOptions />
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Jahr</span>
          <input type="number" value={jahr} min="2020" max="2035" onChange={e => setJahr(parseInt(e.target.value) || jahr)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Rhythmus</span>
          <select value={rhythmus} onChange={e => setRhythmus(e.target.value)} style={inputStyle}>
            {SERIE_RHYTHMUS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </label>
      </div>

      <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
        <div style={{ ...labelStyle, display: 'block', marginBottom: '8px' }}>Fristlogik</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {FRIST_MODI.map(o => (
            <button key={o.key} type="button" onClick={() => setFristModus(o.key)} style={{
              padding: '4px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
              border: `1px solid ${fristModus === o.key ? 'var(--accent)' : 'var(--border)'}`,
              background: fristModus === o.key ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: fristModus === o.key ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: fristModus === o.key ? 700 : 400,
            }}>{o.label}</button>
          ))}
          {(fristModus === 'gleicher' || fristModus === 'folgemonat') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tag:</span>
              <input type="number" min={1} max={28} value={fristTag}
                onChange={e => setFristTag(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))} style={smallInput} />
            </div>
          )}
          {fristModus === 'tage' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '4px' }}>
              <input type="number" min={0} max={90} value={fristTage}
                onChange={e => setFristTage(Math.max(0, parseInt(e.target.value) || 0))} style={smallInput} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tage nach Monatsende</span>
            </div>
          )}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontStyle: 'italic' }}>
          {fristModus === 'kein'       && 'Kein Fälligkeitsdatum.'}
          {fristModus === 'gleicher'   && `${fristTag}. des Leistungsmonats`}
          {fristModus === 'folgemonat' && `${fristTag}. des Folgemonats`}
          {fristModus === 'tage'       && `${fristTage} Tag${fristTage !== 1 ? 'e' : ''} nach Monatsende`}
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ ...labelStyle, display: 'block', marginBottom: '6px' }}>Vorschau – {monate.length} Aufträge</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px' }}>
          {vorschau.map(({ monat, frist }) => (
            <div key={monat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', background: 'var(--surface2)', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '11px' }}>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{MONATE[monat - 1]} {jahr}</span>
              <span style={{ color: frist ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'monospace', fontSize: '10px' }}>
                {frist ? `→ ${fmtPrev(frist)}` : '→ —'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>Abbrechen</button>
        <button onClick={() => onCreate(typ, jahr, monate, { modus: fristModus, tag: fristTag, tage: fristTage })}
          style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
          ✓ {monate.length} Aufträge anlegen
        </button>
      </div>
    </div>
  )
}

// ── Serienauftrag-Erstellen-Panel (Feature 5) ─────────────────────────────────
function SerieErstellenPanel({ onCreate, onClose }) {
  const [typ,           setTyp]           = useState('fibu')
  const [bezeichnung,   setBezeichnung]   = useState('')
  const [startDatum,    setStartDatum]    = useState(() => {
    const h = new Date()
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [intervallTyp,  setIntervallTyp]  = useState('monate')
  const [intervallWert, setIntervallWert] = useState(1)
  const [endTyp,        setEndTyp]        = useState('kein')
  const [endDatum,      setEndDatum]      = useState('')
  const [endAnzahl,     setEndAnzahl]     = useState(12)

  const vorschau = useMemo(() => {
    const mock = {
      serie: { startDatum, intervallTyp, intervallWert: Number(intervallWert), endTyp, endDatum, endAnzahl: Number(endAnzahl) },
      instanzen: {},
    }
    return generateSerieInstanzen(mock, 6)
  }, [startDatum, intervallTyp, intervallWert, endTyp, endDatum, endAnzahl])

  function handleCreate() {
    const au = mkSerienauftrag(typ)
    au.bezeichnung = bezeichnung.trim()
    au.serie = { startDatum, intervallTyp, intervallWert: Number(intervallWert), endTyp, endDatum, endAnzahl: Number(endAnzahl) }
    onCreate(au)
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid rgba(99,102,241,0.5)', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontWeight: 700, fontSize: '13px' }}>🔁 Serienauftrag anlegen</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>– ein Eintrag, automatisch fortgeführt</span>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px' }}>✕</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '12px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Typ</span>
          <select value={typ} onChange={e => setTyp(e.target.value)} style={inputStyle}>
            <TypOptions />
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Bezeichnung (optional)</span>
          <input value={bezeichnung} onChange={e => setBezeichnung(e.target.value)}
            placeholder="z. B. FIBU lfd., Lohn monatlich" style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Startdatum</span>
          <input type="date" value={startDatum} onChange={e => setStartDatum(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Wiederholung</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input type="number" min={1} max={99} value={intervallWert}
              onChange={e => setIntervallWert(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ ...inputStyle, width: '50px', flex: 'none' }} />
            <select value={intervallTyp} onChange={e => setIntervallTyp(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
              {INTERVALL_TYPEN.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={labelStyle}>Ende</span>
          <select value={endTyp} onChange={e => setEndTyp(e.target.value)} style={inputStyle}>
            <option value="kein">Fortlaufend (~3 Mo. voraus)</option>
            <option value="datum">Am Datum</option>
            <option value="anzahl">Nach N Terminen</option>
          </select>
        </label>
        {endTyp === 'datum' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={labelStyle}>Enddatum</span>
            <input type="date" value={endDatum} onChange={e => setEndDatum(e.target.value)} style={inputStyle} />
          </label>
        )}
        {endTyp === 'anzahl' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={labelStyle}>Anzahl Termine</span>
            <input type="number" min={1} max={300} value={endAnzahl}
              onChange={e => setEndAnzahl(Math.max(1, parseInt(e.target.value) || 1))} style={inputStyle} />
          </label>
        )}
      </div>

      {/* Vorschau */}
      {vorschau.length > 0 && (
        <div style={{ marginBottom: '12px', background: 'var(--surface2)', borderRadius: '8px', padding: '8px 12px' }}>
          <div style={{ ...labelStyle, display: 'block', marginBottom: '6px' }}>
            Vorschau – erste {vorschau.length} Termine
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {vorschau.map(inst => (
              <span key={inst.key} style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--accent)', background: 'rgba(59,130,246,0.07)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.2)' }}>
                {fmtDatumShort(inst.datum)}
              </span>
            ))}
            {endTyp === 'kein' && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>… (fortlaufend)</span>}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}>Abbrechen</button>
        <button onClick={handleCreate} disabled={!startDatum}
          style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'rgba(99,102,241,0.9)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: startDatum ? 'pointer' : 'not-allowed', opacity: startDatum ? 1 : 0.5 }}>
          🔁 Serienauftrag anlegen
        </button>
      </div>
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────
export default function AuftraegeTab({ client, onUpdate, initialFilterTyp = 'alle', onOpenEmail, emailVorlagen = [], emailSignaturen = [], onedriveTokens = null, onUpdateOnedriveTokens }) {
  const auftraege = client.auftraege ?? []

  // Aufteilen in Einzel- und Serienaufträge
  const einzelauftraege = auftraege.filter(a => !a.istSerie)
  const serienauftraege = auftraege.filter(a => a.istSerie)

  const [filterStatus,       setFilterStatus]       = useState('aktiv')
  const [filterTyp,          setFilterTyp]          = useState(initialFilterTyp)
  const [expandedId,         setExpandedId]         = useState(() => {
    try { return localStorage.getItem(`sda-expanded-auftrag_${client.id}`) ?? null } catch { return null }
  })
  const [quickTyp,           setQuickTyp]           = useState('lohn')

  // Geöffneten Auftrag persistieren
  useEffect(() => {
    try {
      if (expandedId) localStorage.setItem(`sda-expanded-auftrag_${client.id}`, expandedId)
      else localStorage.removeItem(`sda-expanded-auftrag_${client.id}`)
    } catch {}
  }, [expandedId, client.id])
  const [showBatch,          setShowBatch]          = useState(false)
  const [showSerieErstellen, setShowSerieErstellen] = useState(false)

  function save(list) { onUpdate({ auftraege: list }) }

  function createAuftrag() {
    const au = mkAuftrag(quickTyp)
    save([au, ...auftraege])
    setExpandedId(au.id)
    setFilterStatus('aktiv')
    setFilterTyp('alle')
  }

  function createBatchSerie(typ, jahr, monate, fristKonfig = { modus: 'kein', tag: 1, tage: 0 }) {
    const newAuftraege = monate.map(monat => ({
      ...mkAuftrag(typ),
      id:    'au_' + Date.now().toString(36) + monat + Math.random().toString(36).slice(2, 4),
      jahr, monat,
      frist: calcFrist(jahr, monat, fristKonfig.modus, fristKonfig.tag, fristKonfig.tage),
    }))
    save([...newAuftraege, ...auftraege])
    setShowBatch(false)
    setFilterStatus('aktiv')
    setFilterTyp('alle')
  }

  function createSerienauftrag(au) {
    save([au, ...auftraege])
    setShowSerieErstellen(false)
    setExpandedId(au.id)
  }

  function updateAuftrag(id, patch) {
    save(auftraege.map(a => a.id === id ? { ...a, ...patch } : a))
  }

  function deleteAuftrag(id) {
    if (!window.confirm('Auftrag wirklich löschen?')) return
    save(auftraege.filter(a => a.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  // Einzelaufträge filtern
  const filteredEinzel = einzelauftraege
    .filter(a => {
      if (filterStatus === 'aktiv') return a.status !== 'erledigt'
      if (filterStatus === 'alle')  return true
      return a.status === filterStatus
    })
    .filter(a => filterTyp === 'alle' || a.typ === filterTyp)

  // Serienaufträge: immer bei 'aktiv' und 'alle', ausblenden bei Einzelstatus-Filtern
  const filteredSerien = (filterStatus === 'offen' || filterStatus === 'in_bearbeitung' || filterStatus === 'erledigt')
    ? []
    : serienauftraege.filter(a => filterTyp === 'alle' || a.typ === filterTyp)

  const counts = {
    aktiv:          einzelauftraege.filter(a => a.status !== 'erledigt').length,
    alle:           einzelauftraege.length,
    offen:          einzelauftraege.filter(a => a.status === 'offen').length,
    in_bearbeitung: einzelauftraege.filter(a => a.status === 'in_bearbeitung').length,
    erledigt:       einzelauftraege.filter(a => a.status === 'erledigt').length,
  }

  return (
    <div style={{ padding: '20px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>📋 Aufträge</h2>
        {auftraege.length > 0 && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '1px 9px' }}>
            {counts.aktiv} aktiv · {counts.erledigt} erledigt{serienauftraege.length > 0 ? ` · ${serienauftraege.length} Serie${serienauftraege.length !== 1 ? 'n' : ''}` : ''}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={quickTyp} onChange={e => setQuickTyp(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', cursor: 'pointer' }}>
            <TypOptions />
          </select>
          <button onClick={createAuftrag}
            style={{ padding: '7px 16px', borderRadius: '7px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Einzelauftrag
          </button>
          <button
            onClick={() => { setShowBatch(v => !v); if (!showBatch) setShowSerieErstellen(false) }}
            title="Mehrere Einzelaufträge auf einmal anlegen"
            style={{ padding: '7px 12px', borderRadius: '7px', border: `1px solid ${showBatch ? 'var(--accent)' : 'var(--border)'}`, background: showBatch ? 'rgba(59,130,246,0.1)' : 'var(--surface2)', color: showBatch ? 'var(--accent)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            📅 Batch
          </button>
          <button
            onClick={() => { setShowSerieErstellen(v => !v); if (!showSerieErstellen) setShowBatch(false) }}
            title="Serienauftrag mit automatischer Wiederholung (Outlook-Stil)"
            style={{ padding: '7px 12px', borderRadius: '7px', border: `1px solid ${showSerieErstellen ? 'rgba(99,102,241,0.6)' : 'var(--border)'}`, background: showSerieErstellen ? 'rgba(99,102,241,0.1)' : 'var(--surface2)', color: showSerieErstellen ? 'rgba(99,102,241,0.9)' : 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            🔁 Serie
          </button>
        </div>
      </div>

      {/* ── Panels ── */}
      {showBatch          && <BatchSeriePanel  onCreate={createBatchSerie}    onClose={() => setShowBatch(false)} />}
      {showSerieErstellen && <SerieErstellenPanel onCreate={createSerienauftrag} onClose={() => setShowSerieErstellen(false)} />}

      {/* ── Status-Filter (gilt nur für Einzelaufträge) ── */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {[
          { key: 'aktiv',          label: `Aktiv (${counts.aktiv})` },
          { key: 'offen',          label: `Offen (${counts.offen})` },
          { key: 'in_bearbeitung', label: `In Bearbeitung (${counts.in_bearbeitung})` },
          { key: 'erledigt',       label: `Erledigt (${counts.erledigt})` },
          { key: 'alle',           label: `Alle (${counts.alle})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterStatus(f.key)}
            style={{ padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--border)', background: filterStatus === f.key ? 'var(--accent)' : 'var(--surface2)', color: filterStatus === f.key ? '#fff' : 'var(--text-muted)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Typ-Filter ── */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => setFilterTyp('alle')}
          style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: filterTyp === 'alle' ? 700 : 400, cursor: 'pointer',
            border: `1px solid ${filterTyp === 'alle' ? 'var(--accent)' : 'var(--border)'}`,
            background: filterTyp === 'alle' ? 'rgba(8,145,178,0.1)' : 'transparent',
            color: filterTyp === 'alle' ? 'var(--accent)' : 'var(--text-muted)',
          }}>
          Alle
        </button>
        {Object.entries(AUFTRAGS_TYP_CFG).map(([k, v]) => {
          const cnt = auftraege.filter(a => a.typ === k).length
          if (cnt === 0) return null
          return (
            <button key={k} onClick={() => setFilterTyp(k === filterTyp ? 'alle' : k)}
              style={{
                padding: '4px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '11px',
                border: `1px solid ${k === filterTyp ? v.color : 'var(--border)'}`,
                background: k === filterTyp ? v.bg : 'transparent',
                color: k === filterTyp ? v.color : 'var(--text-muted)',
                fontWeight: k === filterTyp ? 700 : 400,
                display: 'inline-flex', alignItems: 'center', gap: '4px',
              }}>
              {v.icon} {v.label} <span style={{ opacity: 0.75 }}>({cnt})</span>
            </button>
          )
        })}
      </div>

      {/* ── Serienaufträge ── */}
      {filteredSerien.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(99,102,241,0.8)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
            🔁 Serienaufträge ({filteredSerien.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredSerien.map(au => (
              <SerienAuftragCard
                key={au.id}
                au={au}
                expanded={expandedId === au.id}
                onExpand={setExpandedId}
                onUpdate={patch => updateAuftrag(au.id, patch)}
                onDelete={() => deleteAuftrag(au.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Einzelaufträge ── */}
      {(filteredEinzel.length > 0 || filteredSerien.length === 0) && filteredSerien.length > 0 && filteredEinzel.length > 0 && (
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
          Einzelaufträge ({filteredEinzel.length})
        </div>
      )}

      {filteredEinzel.length === 0 && filteredSerien.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
          {auftraege.length === 0 ? (
            <>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>Noch keine Aufträge</div>
              <div style={{ fontSize: '12px' }}>„+ Einzelauftrag" für einmalige Aufgaben · „🔁 Serie" für Wiederholungen · „📅 Batch" für mehrere auf einmal</div>
            </>
          ) : (
            <div style={{ fontSize: '13px' }}>Keine Aufträge für diesen Filter.</div>
          )}
        </div>
      ) : filteredEinzel.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredEinzel.map(au => (
            <AuftragCard
              key={au.id}
              au={au}
              expanded={expandedId === au.id}
              onExpand={setExpandedId}
              onUpdate={patch => updateAuftrag(au.id, patch)}
              onDelete={() => deleteAuftrag(au.id)}
              client={client}
              onOpenEmail={onOpenEmail}
              onUpdateClient={onUpdate}
              emailVorlagen={emailVorlagen}
              emailSignaturen={emailSignaturen}
              onedriveTokens={onedriveTokens}
              onUpdateOnedriveTokens={onUpdateOnedriveTokens}
            />
          ))}
        </div>
      )}
    </div>
  )
}
