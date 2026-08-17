import { useState, useMemo, useRef, useEffect } from 'react'
import JAComposePanel from './JAComposePanel.jsx'
import JAChecklisteV2 from './JAChecklisteV2.jsx'
import LohnJahresmappe, { MonatHinweise } from './LohnJahresmappe.jsx'
import LohnStammdaten, { zeitraumText } from './LohnStammdaten.jsx'
import { buildDoc, downloadPdf, pdfFilename, pdfToBase64 } from '../../utils/ustRegPdf.js'
import { buildVertragGeschaeftsadresse, gaVertragFilename } from '../../utils/geschaeftsadressePdf.js'
import { buildAngebotVorratsgesell, vgAngebotFilename } from '../../utils/vorratsgesellPdf.js'
import { buildGruendungsdatenblatt, gruendungFilename, gruendungRechtsform } from '../../utils/gruendungPdf.js'
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
  liquidation:     { label: 'Liquidation',         icon: '🔚', color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)', gruppe: 'etablering' },
  freitext:        { label: 'Eigener Auftrag',   icon: '📝', color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.25)' },
}

// Merge aus eingebauten Auftragsarten + eigenem Leistungskatalog (Phase 4).
// Eigene Typen tragen KEIN gruppe/WORKFLOW_CONFIGS → verhalten sich automatisch
// wie 'freitext' (generisch, kein JA-/Lohn-/Etablering-Spezialworkflow).
export function buildTypCfg(katalog = []) {
  const custom = {}
  for (const k of (katalog ?? [])) {
    if (!k || !k.key || AUFTRAGS_TYP_CFG[k.key]) continue   // eingebaute nie ueberschreiben
    custom[k.key] = {
      label:  k.label  || k.key,
      icon:   k.icon   || '📝',
      color:  k.color  || '#64748b',
      bg:     k.bg     || 'rgba(100,116,139,0.08)',
      border: k.border || 'rgba(100,116,139,0.25)',
      eigen:  true,
    }
  }
  return { ...AUFTRAGS_TYP_CFG, ...custom }
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
  unterlagen_angefordert: { label: 'Unterlagen angefordert',      icon: '📥', color: '#f97316' },
  fristverlaengerung:{ label: 'Fristverlängerung beantragt', icon: '⏳', color: '#d97706' },
  freigabe_mandant:  { label: 'Freigabe vom Mandant',    icon: '👍', color: '#16a34a' },
  bescheid_erhalten: { label: 'Steuerbescheid erhalten', icon: '📬', color: '#0891b2' },
  bescheid_geprueft: { label: 'Bescheid geprüft',        icon: '🔎', color: '#0f766e' },
  einspruch:         { label: 'Einspruch eingelegt',     icon: '⚖️', color: '#dc2626' },
  wiedervorlage:     { label: 'Wiedervorlage',           icon: '📌', color: '#7c3aed' },
  notiz:             { label: 'Interne Notiz',          icon: '📝', color: '#64748b' },
  meilenstein:       { label: 'Meilenstein',            icon: '🏁', color: '#2563eb' },
}

// Eigene (benutzerdefinierte) Schnellauswahl-Buttons – kanzleiweit in localStorage.
// Rein additiv, kein Bezug zu Mandanten-/Auftragsdaten.
const JA_VERLAUF_CUSTOM_KEY = 'ja-verlauf-custom'
const VERLAUF_FARBEN = ['#2563eb', '#0891b2', '#16a34a', '#f97316', '#d97706', '#7c3aed', '#dc2626', '#0f766e', '#64748b']
function loadCustomVerlaufTypen() {
  try { const arr = JSON.parse(localStorage.getItem(JA_VERLAUF_CUSTOM_KEY) || '[]'); return Array.isArray(arr) ? arr.filter(t => t && t.key && t.label) : [] } catch { return [] }
}
function saveCustomVerlaufTypen(list) { try { localStorage.setItem(JA_VERLAUF_CUSTOM_KEY, JSON.stringify(list)) } catch {} }

// Eigene (benutzerdefinierte) Status-Buttons für den Jahresabschluss – kanzleiweit in localStorage.
const JA_STATUS_CUSTOM_KEY = 'ja-status-custom'
function loadCustomStatus() {
  try { const arr = JSON.parse(localStorage.getItem(JA_STATUS_CUSTOM_KEY) || '[]'); return Array.isArray(arr) ? arr.filter(t => t && t.key && t.label) : [] } catch { return [] }
}
function saveCustomStatus(list) { try { localStorage.setItem(JA_STATUS_CUSTOM_KEY, JSON.stringify(list)) } catch {} }

function TypOptions({ bereich = 'allgemein', mitFachbereichen = false } = {}) {
  // In den Spezial-Bereichen nur der jeweilige Typ zur Auswahl.
  if (bereich === 'jahresabschluss') {
    const v = AUFTRAGS_TYP_CFG.jahresabschluss
    return <option value="jahresabschluss">{v.icon} {v.label}</option>
  }
  if (bereich === 'lohn') {
    const v = AUFTRAGS_TYP_CFG.lohn
    return <option value="lohn">{v.icon} {v.label}</option>
  }
  // Allgemein: alles außer Jahresabschluss & Lohn (die haben eigene Reiter).
  const kanzlei = Object.entries(AUFTRAGS_TYP_CFG).filter(([k, v]) => !v.gruppe && k !== 'jahresabschluss' && k !== 'lohn')
  const etab    = Object.entries(AUFTRAGS_TYP_CFG).filter(([, v]) => v.gruppe === 'etablering')
  return (
    <>
      <optgroup label="Kanzlei">
        {kanzlei.map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
      </optgroup>
      <optgroup label="Etablering / International">
        {etab.map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
      </optgroup>
      {/* Jahresabschluss und Lohn stehen hier zur Auswahl, damit man sie findet –
          die Auswahl legt nichts an, sondern springt in den zuständigen Reiter.
          Nur in der Kopfzeilen-Auswahl, nicht in Batch-/Serien-Formularen. */}
      {mitFachbereichen && (
        <optgroup label="Eigene Reiter – öffnet den Reiter">
          {['jahresabschluss', 'lohn'].map(k => (
            <option key={k} value={k}>{AUFTRAGS_TYP_CFG[k].icon} {AUFTRAGS_TYP_CFG[k].label} →</option>
          ))}
        </optgroup>
      )}
    </>
  )
}

// ── Reiter-Bereiche: Jahresabschluss & Lohn haben eigene Reiter, alles übrige
// bleibt im allgemeinen Aufträge-Reiter. Rein anzeigeseitige Filterung – die
// Daten (client.auftraege) bleiben eine gemeinsame Liste. ──────────────────────
function auftragInBereich(a, bereich) {
  if (bereich === 'jahresabschluss') return a.typ === 'jahresabschluss'
  if (bereich === 'lohn')            return a.typ === 'lohn'
  return a.typ !== 'jahresabschluss' && a.typ !== 'lohn'  // allgemein
}
const BEREICH_CFG = {
  allgemein:       { icon: '📋', title: 'Aufträge',        neuLabel: '+ Einzelauftrag',  defaultTyp: 'fibu'            },
  jahresabschluss: { icon: '📁', title: 'Jahresabschluss', neuLabel: '+ Jahresabschluss', defaultTyp: 'jahresabschluss' },
  lohn:            { icon: '💼', title: 'Lohn',            neuLabel: '+ Lohnauftrag',    defaultTyp: 'lohn'            },
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

// ── Telefon-/Rückfragen-Vorbereitung (JA-Auftrag · Kommunikation & Rückfragen) ─
// Zwei getrennte Listen am Auftrag: Abfragen an den Mandanten + interne Prüfpunkte.
// Diktat (Web-Speech de-DE) → Claude formt daraus einzelne Listenpunkte.
function TelefonVorbereitungSection({ au, onUpdate, client, onAddRueckfrage, onToggleRueckfrage, onDeleteRueckfrage }) {
  const [ziel,        setZiel]        = useState('abfragen') // 'abfragen' → Mandanten-Rückfragen | 'pruefpunkte' → intern/lokal
  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [kiLoading,   setKiLoading]   = useState(false)
  const [error,       setError]       = useState('')
  const [manual,      setManual]      = useState('')
  const recRef        = useRef(null)
  const transcriptRef = useRef('')
  const SpeechRec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  // Abfragen an den Mandanten = die EINE kanonische Mandanten-Rückfragenliste (client.rueckfragen).
  // Prüfpunkte (intern) bleiben lokal am Auftrag. telefonAbfragen = Altbestand vor der Umstellung (wird per Klick übernommen).
  const abfragen    = client?.rueckfragen || []
  const pruefpunkte = au.telefonPruefpunkte || []
  const altAbfragen = au.telefonAbfragen || []

  const CFG = {
    abfragen:    { color: '#2563eb', icon: '❓', titel: 'Abfragen an den Mandanten', ph: 'Frage an den Mandanten … (Enter)' },
    pruefpunkte: { color: '#7c3aed', icon: '☐', titel: 'Prüfpunkte (intern)',        ph: 'Interner Prüfpunkt fürs Gespräch … (Enter)' },
  }
  const cfg = CFG[ziel]

  useEffect(() => () => recRef.current?.stop(), [])

  // Prüfpunkte intern (lokal am Auftrag)
  function mkLocal(arr) { const base = Date.now().toString(36); return arr.map((t, i) => ({ id: base + i.toString(36) + Math.random().toString(36).slice(2, 4), text: t, ok: false })) }
  function addPruef(texte) { const clean = (texte || []).map(t => (t || '').trim()).filter(Boolean); if (!clean.length) return; onUpdate({ telefonPruefpunkte: [...pruefpunkte, ...mkLocal(clean)] }) }
  const togglePruef  = id      => onUpdate({ telefonPruefpunkte: pruefpunkte.map(x => x.id === id ? { ...x, ok: !x.ok } : x) })
  const delPruef     = id      => onUpdate({ telefonPruefpunkte: pruefpunkte.filter(x => x.id !== id) })
  const setPruefText = (id, t) => onUpdate({ telefonPruefpunkte: pruefpunkte.map(x => x.id === id ? { ...x, text: t } : x) })

  // Abfragen an Mandant → kanonische Liste
  function addAbfragen(texte) { (texte || []).map(t => (t || '').trim()).filter(Boolean).forEach(t => onAddRueckfrage?.(t)) }
  function addCurrent(texte) { if (ziel === 'abfragen') addAbfragen(texte); else addPruef(texte) }
  function addManual() { addCurrent(manual.split('\n')); setManual('') }
  function migrateAlt() { altAbfragen.forEach(x => { if (x && x.text) onAddRueckfrage?.(x.text) }); onUpdate({ telefonAbfragen: [] }) }

  async function verarbeite(text) {
    if (!text.trim()) return
    const apiKey = loadNotizApiKey()
    if (!apiKey) { setError('Claude API-Schlüssel fehlt (Stammdaten → ⚙️).'); return }
    setKiLoading(true); setError('')
    const sys = ziel === 'abfragen'
      ? 'Du bist Steuerberater-Assistent. Wandle gesprochene Gedanken in einzelne, klare, höfliche Rückfragen an den Mandanten um – je Anliegen genau ein kurzer Punkt, keine Nummerierung im Text. Antworte NUR mit JSON: {"items":["Frage 1","Frage 2"]}'
      : 'Du bist Steuerberater-Assistent. Wandle gesprochene Gedanken in einzelne, knappe interne Prüfpunkte für ein Mandantengespräch um – je Punkt eine kurze Prüf-/Handlungsnotiz, keine Nummerierung im Text. Antworte NUR mit JSON: {"items":["Prüfpunkt 1","Prüfpunkt 2"]}'
    try {
      const result = await callClaudeNotiz(apiKey, sys, text.trim())
      const items = Array.isArray(result.items) ? result.items : (typeof result.text === 'string' ? result.text.split('\n') : [])
      addCurrent(items)
    } catch (err) { setError('KI-Fehler: ' + err.message) }
    finally { setKiLoading(false) }
  }

  function toggleRecording() {
    if (isRecording) {
      recRef.current?.stop(); setIsRecording(false); setInterimText('')
      if (transcriptRef.current.trim()) verarbeite(transcriptRef.current)
      return
    }
    if (!SpeechRec) { setError('Spracherkennung nicht verfügbar (in Chrome).'); return }
    transcriptRef.current = ''; setInterimText(''); setError('')
    const rec = new SpeechRec()
    rec.lang = 'de-DE'; rec.continuous = true; rec.interimResults = true
    rec.onresult = e => {
      let fin = '', itr = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + ' '; else itr += e.results[i][0].transcript
      }
      if (fin) transcriptRef.current = (transcriptRef.current.trimEnd() + ' ' + fin).trim()
      setInterimText(itr)
    }
    rec.onend   = () => { setIsRecording(false); setInterimText('') }
    rec.onerror = () => { setIsRecording(false); setInterimText(''); setError('Mikrofon-Fehler.') }
    rec.start(); recRef.current = rec; setIsRecording(true)
  }

  const row = (id, text, done, onToggle, onDel, color, onEdit) => (
    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 6px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <input type="checkbox" checked={!!done} onChange={onToggle} style={{ flexShrink: 0, cursor: 'pointer', accentColor: color }} />
      {onEdit
        ? <input value={text} onChange={e => onEdit(e.target.value)}
            style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', outline: 'none', fontSize: '12px', color: done ? 'var(--text-muted)' : 'var(--text)', textDecoration: done ? 'line-through' : 'none' }} />
        : <span style={{ flex: 1, minWidth: 0, fontSize: '12px', color: done ? 'var(--text-muted)' : 'var(--text)', textDecoration: done ? 'line-through' : 'none' }}>{text}</span>}
      <button onClick={onDel} title="Entfernen" style={{ flexShrink: 0, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', lineHeight: 1 }}>✕</button>
    </div>
  )

  const offenA = abfragen.filter(r => !r.beantwortet).length
  const offenP = pruefpunkte.filter(x => !x.ok).length

  return (
    <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
        📞 Telefon-/Rückfragen-Vorbereitung
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
        Sprich rein – die KI macht daraus einzelne Punkte. <b>Abfragen</b> landen direkt in der Mandanten-Rückfragenliste (fürs Mandantenschreiben); <b>Prüfpunkte</b> bleiben intern.
      </div>

      {/* Ziel-Umschalter */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {Object.entries(CFG).map(([k, l]) => (
          <button key={k} onClick={() => setZiel(k)} style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: ziel === k ? 700 : 500, cursor: 'pointer',
            border: `1px solid ${ziel === k ? l.color : 'var(--border)'}`,
            background: ziel === k ? l.color + '18' : 'transparent',
            color: ziel === k ? l.color : 'var(--text-muted)',
          }}>{l.icon} {l.titel}</button>
        ))}
      </div>

      {/* Diktat + manuelle Eingabe */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: interimText || kiLoading || error ? '6px' : '10px', flexWrap: 'wrap' }}>
        <button onClick={toggleRecording} disabled={kiLoading} title="Diktat: sprechen → KI listet Punkte auf"
          style={{ width: '38px', height: '38px', borderRadius: '50%', border: 'none', flexShrink: 0, cursor: 'pointer', color: '#fff', fontSize: '16px',
            background: isRecording ? '#ef4444' : cfg.color, boxShadow: isRecording ? '0 0 0 5px rgba(239,68,68,0.2)' : 'none' }}>
          {isRecording ? '⏹' : kiLoading ? '⏳' : '🎤'}
        </button>
        <div style={{ flex: 1, minWidth: '200px', display: 'flex', gap: '6px' }}>
          <input value={manual} onChange={e => setManual(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }}
            placeholder={cfg.ph}
            style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', outline: 'none' }} />
          <button onClick={addManual} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: cfg.color, color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>+</button>
        </div>
      </div>
      {(isRecording || interimText) && (
        <div style={{ fontSize: '11px', color: isRecording ? '#ef4444' : 'var(--text-muted)', marginBottom: '8px' }}>
          {isRecording ? '● Aufnahme läuft – frei sprechen, dann ⏹' : ''} <span style={{ fontStyle: 'italic', opacity: 0.7 }}>{interimText}</span>
        </div>
      )}
      {kiLoading && <div style={{ fontSize: '11px', color: '#7c3aed', marginBottom: '8px' }}>KI erstellt Punkte …</div>}
      {error && <div style={{ fontSize: '11px', color: '#ef4444', marginBottom: '8px' }}>⚠ {error}</div>}

      {/* Altbestand aus der früheren, separaten Telefonliste – additiv in die Mandantenliste übernehmen */}
      {altAbfragen.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '7px 10px', borderRadius: '6px', background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.25)', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text)', flex: 1, minWidth: '160px' }}>
            {altAbfragen.length} frühere Abfrage(n) aus der Telefonliste sind noch nicht in der Mandanten-Rückfragenliste.
          </span>
          <button onClick={migrateAlt} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>→ übernehmen</button>
        </div>
      )}

      {/* Die zwei Listen */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '4px' }}>
        {/* Abfragen an Mandant = client.rueckfragen (kanonisch) */}
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>❓ Abfragen an den Mandanten</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>{abfragen.length ? `${offenA} offen / ${abfragen.length}` : '—'}</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px' }}>= Mandanten-Rückfragenliste (fürs Schreiben)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {abfragen.length === 0
              ? <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Noch keine Rückfragen – diktieren oder tippen.</div>
              : abfragen.map(r => row(r.id, r.text, r.beantwortet, () => onToggleRueckfrage?.(r.id, !r.beantwortet), () => onDeleteRueckfrage?.(r.id), '#2563eb', null))}
          </div>
        </div>
        {/* Prüfpunkte intern = au.telefonPruefpunkte (lokal) */}
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>☐ Prüfpunkte (intern)</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)' }}>{pruefpunkte.length ? `${offenP} offen / ${pruefpunkte.length}` : '—'}</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px' }}>nur intern, nicht im Mandantenschreiben</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {pruefpunkte.length === 0
              ? <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Noch keine Einträge – diktieren oder tippen.</div>
              : pruefpunkte.map(x => row(x.id, x.text, x.ok, () => togglePruef(x.id), () => delPruef(x.id), '#7c3aed', t => setPruefText(x.id, t)))}
          </div>
        </div>
      </div>

      <style>{`@keyframes pulseDiktat{0%,100%{box-shadow:0 0 0 5px rgba(239,68,68,0.2)}50%{box-shadow:0 0 0 10px rgba(239,68,68,0.04)}}`}</style>
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
export function mkAuftrag(typ = 'freitext') {
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
    verknuepfungen: [],   // Belege/Mails/Notizen, die an diesem Auftrag haengen (art: 'beleg'|'mail'|'notiz')
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

// ── Editierbares Textfeld mit Vorschau vor dem Speichern ──────────────────────
// Ablauf: Ansicht → ✏️ Bearbeiten → 👁 Vorschau → Speichern / Weiter bearbeiten / Abbrechen
// Rein additiv: verändert nur den Wert, den onSave() zurückgibt.
function EditableText({ value = '', placeholder = '', color = '#2563eb', multiline = false, onSave }) {
  const [mode,  setMode]  = useState('view')   // 'view' | 'edit' | 'preview'
  const [draft, setDraft] = useState(value ?? '')

  const startEdit = () => { setDraft(value ?? ''); setMode('edit') }
  const cancel    = () => { setDraft(value ?? ''); setMode('view') }
  const commit    = () => { onSave((draft ?? '').trim()); setMode('view') }

  const fieldStyle = {
    width: '100%', border: '1px solid var(--border)', borderRadius: '6px',
    padding: '7px 10px', fontSize: '12px', fontFamily: 'inherit',
    background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box',
  }
  const btn = (bg, fg, bd) => ({
    padding: '5px 12px', borderRadius: '6px', border: bd || 'none',
    background: bg, color: fg, fontSize: '11px', fontWeight: 700, cursor: 'pointer',
  })

  if (mode === 'view') {
    const empty = !value || !String(value).trim()
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: '12px', color: empty ? 'var(--text-muted)' : 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontStyle: empty ? 'italic' : 'normal' }}>
          {empty ? (placeholder || '—') : value}
        </div>
        <button onClick={startEdit} title="Bearbeiten"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', flexShrink: 0, padding: '0 2px' }}>✏️</button>
      </div>
    )
  }

  if (mode === 'preview') {
    const empty = !(draft ?? '').trim()
    return (
      <div>
        <div style={{ fontSize: '10px', fontWeight: 700, color: color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Vorschau</div>
        <div style={{ padding: '8px 10px', borderRadius: '6px', border: `1px solid ${color}`, background: 'var(--surface2)', fontSize: '12px', whiteSpace: 'pre-wrap', lineHeight: 1.5, color: 'var(--text)', marginBottom: '6px' }}>
          {empty ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(leerer Text – beim Speichern wird der Eintrag geleert)</span> : draft}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={commit}                style={btn(color, '#fff')}>✓ Speichern</button>
          <button onClick={() => setMode('edit')} style={btn('var(--surface2)', 'var(--text)', '1px solid var(--border)')}>Weiter bearbeiten</button>
          <button onClick={cancel}                style={btn('none', 'var(--text-muted)', '1px solid var(--border)')}>Abbrechen</button>
        </div>
      </div>
    )
  }

  // mode === 'edit'
  return (
    <div>
      {multiline
        ? <textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder} rows={3}
            style={{ ...fieldStyle, resize: 'vertical', minHeight: '56px' }} autoFocus />
        : <input value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setMode('preview') } if (e.key === 'Escape') cancel() }}
            style={fieldStyle} autoFocus />
      }
      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
        <button onClick={() => setMode('preview')} style={btn(color, '#fff')}>👁 Vorschau</button>
        <button onClick={cancel}                   style={btn('none', 'var(--text-muted)', '1px solid var(--border)')}>Abbrechen</button>
      </div>
    </div>
  )
}

// ── Ein Hinweis / eine Unteraufgabe: Titel editierbar + Antwort/Notizen (Doku) ─
function HinweisItem({ h, color, onChange, onToggle, onDelete }) {
  const [open, setOpen] = useState(false)
  const hasDoc = (h.antwort && h.antwort.trim()) || (h.notiz && h.notiz.trim())
  const fmt = iso => { if (!iso) return ''; const d = new Date(iso); return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}` }

  return (
    <div style={{ borderRadius: '6px', background: h.erledigt ? 'rgba(22,163,74,0.04)' : 'var(--surface2)', border: `1px solid ${h.erledigt ? 'rgba(22,163,74,0.2)' : 'var(--border)'}`, padding: '6px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <input type="checkbox" checked={!!h.erledigt} onChange={onToggle}
          style={{ accentColor: color, cursor: 'pointer', flexShrink: 0, marginTop: '3px' }} />
        <div style={{ flex: 1, minWidth: 0, opacity: h.erledigt ? 0.6 : 1, textDecoration: h.erledigt ? 'line-through' : 'none' }}>
          <EditableText value={h.text} placeholder="Hinweis…" color={color} onSave={t => onChange({ text: t })} />
        </div>
        <button onClick={() => setOpen(o => !o)} title="Antwort / Notizen"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: hasDoc ? color : 'var(--text-muted)', fontSize: '13px', flexShrink: 0, padding: '0 2px' }}>
          {open ? '▾' : (hasDoc ? '📝' : '▸')}
        </button>
        <button onClick={onDelete} title="Löschen"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '0 2px', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>✕</button>
      </div>

      {open && (
        <div style={{ marginTop: '8px', marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px dashed var(--border)', paddingTop: '8px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Antwort / Bearbeitungsvermerk</div>
            <EditableText value={h.antwort} placeholder="Noch keine Antwort – klicken zum Ergänzen…" color={color} multiline onSave={t => onChange({ antwort: t })} />
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Notizen</div>
            <EditableText value={h.notiz} placeholder="Freie Notizen – z. B. Hinweis für den nächsten Jahresabschluss…" color={color} multiline onSave={t => onChange({ notiz: t })} />
          </div>
          {(h.createdAt || h.updatedAt) && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {h.createdAt && <>angelegt {fmt(h.createdAt)}</>}
              {h.updatedAt && <> · zuletzt bearbeitet {fmt(h.updatedAt)}</>}
            </div>
          )}
        </div>
      )}
    </div>
  )
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
// ── Stammdaten-Block (oben im Jahresabschluss-Auftrag) ────────────────────────
// Rein additiv: pflegt neue Felder am Auftrag (einkunftsarten, einkunftsartFrei,
// branche, gewinnermittlung, jaNotiz, kennzeichen) + bereits vorhandene abschlussJahr/frist.
const JA_EINKUNFTSARTEN = ['Gewerbebetrieb','Selbständige Arbeit','Freiberufliche Tätigkeit','Vermietung und Verpachtung','Nichtselbständige Arbeit','Kapitalvermögen','Land- und Forstwirtschaft','Sonstige Einkünfte']
const JA_KENNZ_DEFAULT = [{ id:'k1', label:'Besonderer Prüfungsfall', checked:false }, { id:'k2', label:'Erhöhter Beratungsbedarf', checked:false }]

// Ein-/Ausklappzustand des Stammdaten-Blocks (gerätelokal, reine Anzeige-Einstellung; Standard: eingeklappt)
const JA_STAMM_OPEN_KEY = 'ja-stammdaten-open'
function loadStammOpen() { try { return localStorage.getItem(JA_STAMM_OPEN_KEY) === '1' } catch { return false } }
function saveStammOpen(v) { try { localStorage.setItem(JA_STAMM_OPEN_KEY, v ? '1' : '0') } catch {} }

function JAStammdatenBlock({ au, onUpdate }) {
  const einkArten = Array.isArray(au.einkunftsarten) ? au.einkunftsarten : []
  const kennz     = Array.isArray(au.kennzeichen)    ? au.kennzeichen    : JA_KENNZ_DEFAULT
  const [open, setOpen] = useState(loadStammOpen)
  const toggleOpen = () => { const n = !open; setOpen(n); saveStammOpen(n) }
  const toggleEink = a => onUpdate({ einkunftsarten: einkArten.includes(a) ? einkArten.filter(x => x !== a) : [...einkArten, a] })
  const setKennz   = (id, patch) => onUpdate({ kennzeichen: kennz.map(k => k.id === id ? { ...k, ...patch } : k) })
  const chip = active => ({ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'11px', padding:'4px 10px', borderRadius:'20px', cursor:'pointer', border:`1px solid ${active ? '#2563eb' : 'var(--border)'}`, background: active ? 'rgba(37,99,235,0.1)' : 'var(--surface)', color: active ? '#2563eb' : 'var(--text-muted)', fontWeight: active ? 700 : 500, userSelect:'none' })

  return (
    <div style={{ marginBottom:'14px', padding:'12px 14px', background:'var(--surface2)', borderRadius:'10px', border:'1px solid var(--border-strong, var(--border))' }}>
      {/* Klickbare Kopfzeile – klappt den Block ein/aus. Eingeklappt: Kompakt-Zusammenfassung (Jahr + Eilig). */}
      <div onClick={toggleOpen} title={open ? 'Stammdaten einklappen' : 'Stammdaten ausklappen'}
        style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', userSelect:'none', marginBottom: open ? '12px' : 0, flexWrap:'wrap' }}>
        <span style={{ fontSize:'14px' }}>📋</span>
        <span style={{ fontSize:'12px', fontWeight:700, color:'var(--text)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Stammdaten Jahresabschluss</span>
        {!open && (
          <span style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:'10px', fontWeight:700, color:'#2563eb', background:'rgba(37,99,235,0.1)', border:'1px solid rgba(37,99,235,0.25)', borderRadius:'8px', padding:'1px 7px' }}>
              VZ {au.abschlussJahr ?? new Date().getFullYear() - 1}
            </span>
            {au.eilig && (
              <span style={{ fontSize:'10px', fontWeight:700, color:'#ef4444', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'8px', padding:'1px 7px' }}>
                🔥 Eilig{au.eiligBis ? ` · bis ${fmtShortDate(au.eiligBis)}` : ''}
              </span>
            )}
          </span>
        )}
        <span style={{ marginLeft:'auto', fontSize:'13px', color:'var(--text-muted)', transition:'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none', lineHeight:1 }}>▸</span>
      </div>

      {open && (<>
      {/* Eilig-Markierung – rein additiv (au.eilig / au.eiligBis). Steuert den Filter „🔥 Eilig" in der Auftrags-Übersicht. */}
      <div style={{ marginBottom:'12px', padding:'10px 12px', borderRadius:'8px',
        background: au.eilig ? 'rgba(239,68,68,0.08)' : 'var(--surface)',
        border:`1px solid ${au.eilig ? 'rgba(239,68,68,0.4)' : 'var(--border)'}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
          <label style={{ display:'inline-flex', alignItems:'center', gap:'7px', cursor:'pointer', userSelect:'none' }}>
            <input type="checkbox" checked={!!au.eilig}
              onChange={e => onUpdate({ eilig: e.target.checked })}
              style={{ width:'16px', height:'16px', accentColor:'#ef4444', cursor:'pointer', flexShrink:0 }} />
            <span style={{ fontSize:'13px', fontWeight:700, color: au.eilig ? '#ef4444' : 'var(--text)' }}>🔥 Eilig</span>
          </label>
          {au.eilig && (
            <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
              <span style={{ ...labelStyle, color:'#ef4444' }}>Fertigstellung bis</span>
              <input type="date" value={au.eiligBis ?? ''} onChange={e => onUpdate({ eiligBis: e.target.value })}
                style={{ ...inputStyle, width:'160px', borderColor:'rgba(239,68,68,0.35)', fontWeight:700, color:'#ef4444' }} />
            </div>
          )}
        </div>
        {au.eilig && !au.eiligBis && (
          <div style={{ fontSize:'10px', color:'#ef4444', marginTop:'6px' }}>
            Tipp: Fristdatum setzen – der Auftrag erscheint dann in der Auftrags-Übersicht unter „🔥 Eilig", sortiert nach Frist.
          </div>
        )}
      </div>

      <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', marginBottom:'12px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
          <span style={{ ...labelStyle, color:'#2563eb' }}>📅 Veranlagungsjahr</span>
          <input type="number" min="2010" max="2035" value={au.abschlussJahr ?? new Date().getFullYear() - 1}
            onChange={e => onUpdate({ abschlussJahr: parseInt(e.target.value) || au.abschlussJahr })}
            style={{ ...inputStyle, width:'90px', fontWeight:700, fontSize:'16px', textAlign:'center', color:'#2563eb', borderColor:'rgba(37,99,235,0.3)', background:'rgba(37,99,235,0.06)' }} />
        </div>
        <div style={{ flex:1, minWidth:'160px', display:'flex', flexDirection:'column', gap:'4px' }}>
          <span style={labelStyle}>Geplante Fertigstellung</span>
          <input type="date" value={au.frist ?? ''} onChange={e => onUpdate({ frist: e.target.value })} style={inputStyle} />
        </div>
      </div>

      {/* Vereinbartes Honorar – in die Stammdaten integriert */}
      <JAHonorarSection au={au} onUpdate={onUpdate} />

      <div style={{ marginBottom:'12px' }}>
        <span style={{ ...labelStyle, display:'block', marginBottom:'5px' }}>Art der Gewinnermittlung</span>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {[{ k:'euer', l:'Einnahmen-Überschussrechnung (EÜR)' }, { k:'bilanz', l:'Bilanzierung' }].map(g => (
            <span key={g.k} onClick={() => onUpdate({ gewinnermittlung: g.k })} style={chip(au.gewinnermittlung === g.k)}>
              <span>{au.gewinnermittlung === g.k ? '●' : '○'}</span> {g.l}
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginBottom:'12px' }}>
        <span style={{ ...labelStyle, display:'block', marginBottom:'5px' }}>Einkunftsart (Mehrfachauswahl)</span>
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {JA_EINKUNFTSARTEN.map(a => (
            <span key={a} onClick={() => toggleEink(a)} style={chip(einkArten.includes(a))}>
              <span>{einkArten.includes(a) ? '✓' : '+'}</span> {a}
            </span>
          ))}
        </div>
        <input value={au.einkunftsartFrei ?? ''} onChange={e => onUpdate({ einkunftsartFrei: e.target.value })}
          placeholder="Weitere Einkunftsart (Freitext)…" style={{ ...inputStyle, marginTop:'6px' }} />
      </div>

      <div style={{ marginBottom:'12px' }}>
        <span style={{ ...labelStyle, display:'block', marginBottom:'5px' }}>Tätigkeit / Branche</span>
        <input value={au.branche ?? ''} onChange={e => onUpdate({ branche: e.target.value })}
          placeholder="z. B. Physiotherapeut, Kfz-Werkstatt, IT-Dienstleister…" style={inputStyle} />
      </div>

      <div style={{ marginBottom:'12px' }}>
        <span style={{ ...labelStyle, display:'block', marginBottom:'5px' }}>Allgemeine Hinweise / freie Notiz</span>
        <textarea value={au.jaNotiz ?? ''} onChange={e => onUpdate({ jaNotiz: e.target.value })} rows={3}
          placeholder="Besonderheiten, Betriebsprüfung angekündigt, Gesellschafterwechsel, Umwandlung, Auslandsbezug…"
          style={{ ...inputStyle, minHeight:'60px', resize:'vertical' }} />
      </div>

      <div>
        <span style={{ ...labelStyle, display:'block', marginBottom:'5px' }}>Interne Kennzeichnung (Beschriftung frei änderbar)</span>
        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
          {kennz.map(k => (
            <div key={k.id} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <input type="checkbox" checked={!!k.checked} onChange={() => setKennz(k.id, { checked: !k.checked })}
                style={{ accentColor:'#2563eb', cursor:'pointer', flexShrink:0 }} />
              <input value={k.label} onChange={e => setKennz(k.id, { label: e.target.value })}
                style={{ ...inputStyle, flex:1, fontWeight: k.checked ? 700 : 400 }} />
            </div>
          ))}
        </div>
      </div>
      </>)}
    </div>
  )
}

function JAStatusSection({ au, onUpdate }) {
  const [customStatus, setCustomStatus] = useState(loadCustomStatus)
  const [showForm, setShowForm] = useState(false)
  const [cLabel, setCLabel] = useState('')
  const [cIcon,  setCIcon]  = useState('🏷️')
  const [cColor, setCColor] = useState(VERLAUF_FARBEN[0])
  const statusInput = { padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', outline: 'none' }

  // eigene Status inkl. abgeleiteter Hintergrund-/Rahmenfarbe
  const customMap = Object.fromEntries(customStatus.map(t => [t.key, { ...t, bg: t.color + '18', border: t.color + '55' }]))
  const STATUS_MAP = { ...JA_WORKFLOW_STATUS, ...customMap }
  const current    = au.jaWorkflowStatus ?? 'neu'
  // Snapshot am Auftrag sorgt dafür, dass ein gesetzter (auch eigener) Status korrekt angezeigt wird,
  // selbst wenn der Button später gelöscht wurde.
  const currentCfg = STATUS_MAP[current] ?? au.jaStatusSnap ?? JA_WORKFLOW_STATUS.neu
  const statusDatum = au.jaWorkflowStatusDatum ?? ''

  function setStatus(key) {
    const cfg = STATUS_MAP[key] ?? JA_WORKFLOW_STATUS.neu
    onUpdate({ jaWorkflowStatus: key, jaWorkflowStatusDatum: todayISO(), jaStatusSnap: { label: cfg.label, icon: cfg.icon, color: cfg.color, bg: cfg.bg, border: cfg.border } })
  }
  function addCustom() {
    const label = cLabel.trim()
    if (!label) return
    const key = 'custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    const next = [...customStatus, { key, label, icon: (cIcon || '🏷️').trim().slice(0, 3), color: cColor }]
    setCustomStatus(next); saveCustomStatus(next)
    setCLabel(''); setCIcon('🏷️'); setCColor(VERLAUF_FARBEN[0]); setShowForm(false)
  }
  function deleteCustom(key) {
    const next = customStatus.filter(t => t.key !== key)
    setCustomStatus(next); saveCustomStatus(next)
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
        {Object.entries(STATUS_MAP).map(([key, cfg]) => {
          const isCustom = !!customMap[key]
          return (
            <span key={key} style={{ position: 'relative', display: 'inline-flex' }}>
              <button onClick={() => setStatus(key)} title={cfg.label} style={{
                padding: isCustom ? '3px 20px 3px 9px' : '3px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: key === current ? 700 : 400, cursor: 'pointer',
                border: `1px solid ${key === current ? cfg.color : 'var(--border)'}`,
                background: key === current ? cfg.bg : 'transparent',
                color: key === current ? cfg.color : 'var(--text-muted)',
              }}>
                {cfg.icon} {cfg.label}
              </button>
              {isCustom && (
                <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Eigenen Status „${cfg.label}" entfernen? Aufträge, die aktuell diesen Status haben, behalten ihre Anzeige.`)) deleteCustom(key) }}
                  title="Eigenen Status entfernen"
                  style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1, padding: '1px' }}>✕</button>
              )}
            </span>
          )
        })}
        <button onClick={() => setShowForm(v => !v)} style={{
          padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
          border: `1px dashed ${showForm ? 'var(--accent)' : 'var(--border)'}`, background: 'transparent', color: showForm ? 'var(--accent)' : 'var(--text-muted)',
        }}>＋ Eigener Status</button>
      </div>

      {/* Eigenen Status anlegen */}
      {showForm && (
        <div style={{ marginTop: '10px', padding: '10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Icon</label>
            <input value={cIcon} onChange={e => setCIcon(e.target.value)} maxLength={3} style={{ ...statusInput, width: '48px', textAlign: 'center', fontSize: '15px' }} />
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Bezeichnung</label>
            <input value={cLabel} onChange={e => setCLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCustom() }} placeholder="z. B. Beim Mandant zur Prüfung" style={{ ...statusInput, width: '100%', boxSizing: 'border-box' }} autoFocus />
          </div>
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Farbe</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {VERLAUF_FARBEN.map(c => (
                <button key={c} onClick={() => setCColor(c)} title={c} style={{ width: '18px', height: '18px', borderRadius: '50%', background: c, cursor: 'pointer', border: cColor === c ? '2px solid var(--text)' : '2px solid transparent' }} />
              ))}
            </div>
          </div>
          <button onClick={addCustom} disabled={!cLabel.trim()} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: cLabel.trim() ? cColor : 'var(--border)', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: cLabel.trim() ? 'pointer' : 'not-allowed' }}>Status speichern</button>
          <div style={{ width: '100%', fontSize: '10px', color: 'var(--text-muted)' }}>Eigene Status gelten kanzleiweit (für alle Jahresabschluss-Aufträge) und werden lokal gespeichert.</div>
        </div>
      )}
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

  // Eigene Schnellauswahl-Buttons (kanzleiweit)
  const [customTypen, setCustomTypen] = useState(loadCustomVerlaufTypen)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [cLabel, setCLabel] = useState('')
  const [cIcon,  setCIcon]  = useState('📌')
  const [cColor, setCColor] = useState(VERLAUF_FARBEN[0])
  const customMap = Object.fromEntries(customTypen.map(t => [t.key, t]))
  const TYPEN = { ...VERLAUF_TYPEN, ...customMap }
  // Darstellung eines Verlaufseintrags – bevorzugt am Eintrag gespeicherte Werte (überlebt Button-Löschung)
  const cfgFor = (item) => {
    const t = TYPEN[item.typ]
    return { icon: item.icon || t?.icon || '📝', color: item.color || t?.color || '#64748b', label: item.label || t?.label || 'Eintrag' }
  }

  function addCustomTyp() {
    const label = cLabel.trim()
    if (!label) return
    const key = 'custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    const next = [...customTypen, { key, label, icon: (cIcon || '📌').trim().slice(0, 3), color: cColor }]
    setCustomTypen(next); saveCustomVerlaufTypen(next)
    setCLabel(''); setCIcon('📌'); setCColor(VERLAUF_FARBEN[0]); setShowCustomForm(false)
  }
  function deleteCustomTyp(key) {
    const next = customTypen.filter(t => t.key !== key)
    setCustomTypen(next); saveCustomVerlaufTypen(next)
    if (selectedTyp === key) setSelectedTyp(null)
  }

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
    const cfg = TYPEN[selectedTyp] ?? VERLAUF_TYPEN.notiz
    const item = {
      id: genVerlaufId(),
      typ: selectedTyp,
      datum: newDatum,
      text: newNotiz.trim() || cfg.label,
      icon: cfg.icon, label: cfg.label, color: cfg.color,   // Darstellung mitspeichern (robust)
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
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {Object.entries(TYPEN).map(([key, cfg]) => {
              const active = selectedTyp === key
              const isCustom = !!customMap[key]
              return (
                <span key={key} style={{ position: 'relative', display: 'inline-flex' }}>
                  <button onClick={() => handleQuickAction(key)} style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: isCustom ? '6px 24px 6px 14px' : '6px 14px', borderRadius: '20px', cursor: 'pointer',
                    border: `1px solid ${active ? cfg.color : 'var(--border)'}`,
                    background: active ? cfg.color + '18' : 'var(--surface2)',
                    color: active ? cfg.color : 'var(--text-secondary)',
                    fontSize: '12px', fontWeight: active ? 600 : 400, transition: 'all 0.15s',
                    boxShadow: active ? `0 0 0 2px ${cfg.color}25` : 'none',
                  }}>
                    {cfg.icon} {cfg.label}
                  </button>
                  {isCustom && (
                    <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Eigenen Button „${cfg.label}" entfernen? Bereits erfasste Verlaufseinträge bleiben erhalten.`)) deleteCustomTyp(key) }}
                      title="Eigenen Button entfernen"
                      style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1, padding: '2px' }}>✕</button>
                  )}
                </span>
              )
            })}
            <button onClick={() => setShowCustomForm(v => !v)} style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
              border: `1px dashed ${showCustomForm ? 'var(--accent)' : 'var(--border)'}`, background: 'transparent',
              color: showCustomForm ? 'var(--accent)' : 'var(--text-muted)', fontSize: '12px', fontWeight: 600,
            }}>＋ Eigener Button</button>
          </div>

          {/* Eigenen Schnellauswahl-Button anlegen */}
          {showCustomForm && (
            <div style={{ marginTop: '10px', padding: '12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Icon</label>
                <input value={cIcon} onChange={e => setCIcon(e.target.value)} maxLength={3} style={{ ...iStyle, width: '52px', textAlign: 'center', fontSize: '16px' }} />
              </div>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Bezeichnung</label>
                <input value={cLabel} onChange={e => setCLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCustomTyp() }} placeholder="z. B. Belege nachgefordert" style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Farbe</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {VERLAUF_FARBEN.map(c => (
                    <button key={c} onClick={() => setCColor(c)} title={c} style={{ width: '20px', height: '20px', borderRadius: '50%', background: c, cursor: 'pointer', border: cColor === c ? '2px solid var(--text)' : '2px solid transparent' }} />
                  ))}
                </div>
              </div>
              <button onClick={addCustomTyp} disabled={!cLabel.trim()} style={{ padding: '7px 16px', borderRadius: '6px', border: 'none', background: cLabel.trim() ? cColor : 'var(--border)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: cLabel.trim() ? 'pointer' : 'not-allowed' }}>Button speichern</button>
              <div style={{ width: '100%', fontSize: '10px', color: 'var(--text-muted)' }}>Eigene Buttons gelten kanzleiweit (für alle Jahresabschluss-Aufträge) und werden lokal gespeichert.</div>
            </div>
          )}
        </div>

        {/* Inline-Formular (erscheint bei Schnellauswahl-Klick) */}
        {selectedTyp && (() => {
          const cfg = TYPEN[selectedTyp] ?? VERLAUF_TYPEN.notiz
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
            const cfg = isEmail ? { icon: '✉️', color: '#16a34a', label: null } : cfgFor(item)
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
                  <div style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', borderBottom: item.text && !isEmail && item.text !== cfg.label ? '1px solid var(--border)' : 'none' }}>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, color: cfg.color,
                      background: cfg.color + '15', padding: '2px 8px', borderRadius: '10px',
                    }}>
                      {isEmail ? (item.text?.startsWith('📨') ? 'Empfangen' : 'Gesendet') : (cfg.label ?? 'Eintrag')}
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
                  ) : item.text && item.text !== cfg.label ? (
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

// ── Geschäftsadresse: Vertragsdaten + Vertrag-PDF + Versand ───────────────────
const GA_FELDER = [
  { gruppe: 'Vertragspartner', felder: [
    { key: 'unternehmensname',     label: 'Unternehmensname' },
    { key: 'ansprechpartner',      label: 'Ansprechpartner' },
    { key: 'ansprechpartner_email',label: 'E-Mail Ansprechpartner' },
    { key: 'rechnungsadresse',     label: 'Rechnungsadresse (optional)', textarea: true, wide: true },
  ]},
  { gruppe: 'Adresse & Vertrag', felder: [
    { key: 'gewuenschte_adresse',  label: 'Gewünschte Geschäftsadresse', textarea: true, wide: true },
    { key: 'vertragsbeginn',       label: 'Vertragsbeginn', date: true },
    { key: 'laufzeit',             label: 'Laufzeit', placeholder: 'z. B. 12 Monate / unbefristet' },
    { key: 'kuendigungsfrist',     label: 'Kündigungsfrist', placeholder: 'z. B. 3 Monate zum Laufzeitende' },
    { key: 'monatliches_entgelt',  label: 'Monatliches Entgelt (€)', placeholder: 'z. B. 49' },
  ]},
  { gruppe: 'Leistungsumfang', felder: [
    { key: 'leistungsumfang', label: 'Leistungsumfang', options: [
      { value: 'nur_adresse',   label: 'Nur Adresse' },
      { value: 'postannahme',   label: 'Postannahme' },
      { value: 'postweiterltg', label: 'Postweiterleitung' },
      { value: 'digital',       label: 'Digitale Postweiterleitung' },
    ]},
    { key: 'postweiterleitung', label: 'Postweiterleitung?', options: [
      { value: 'ja', label: 'Ja' }, { value: 'nein', label: 'Nein' } ]},
    { key: 'postweiterleitung_intervall', label: 'Intervall Postweiterleitung', placeholder: 'z. B. wöchentlich' },
    { key: 'digitale_postweiterleitung', label: 'Digitale Postweiterleitung?', options: [
      { value: 'ja', label: 'Ja' }, { value: 'nein', label: 'Nein' } ]},
  ]},
]

const GA_LEISTUNG_LABEL = {
  nur_adresse: 'Nutzung der Geschäftsadresse', postannahme: 'Geschäftsadresse + Postannahme',
  postweiterltg: 'Geschäftsadresse + Postweiterleitung', digital: 'Geschäftsadresse + digitale Postweiterleitung',
}

// 4 Vorlagen (DE/DK nach Land, Du-Form; Signatur hängt der Composer an)
function buildGaVorlagen(client, au) {
  const ed = au.erfassungsdaten || {}
  const isDK = /dänemark|danmark|denmark|\bdk\b/.test((ed.adresse_land || client?.land || '').toLowerCase())
  const firma = (ed.unternehmensname || client?.name || '').trim()
  const ap = (ed.ansprechpartner || (client?.kontakte || [])[0]?.name || '').trim()
  const vorname = ap.split(/\s+/)[0] || ''
  const adresse = (ed.gewuenschte_adresse || '').trim()
  const leistung = GA_LEISTUNG_LABEL[ed.leistungsumfang] || ed.leistungsumfang || 'Nutzung der Geschäftsadresse'
  const laufzeit = (ed.laufzeit || '').trim()
  const entgelt = (ed.monatliches_entgelt || '').trim()
  const entgeltTxt = entgelt ? entgelt + (/€|eur|kr/i.test(entgelt) ? '' : ' €') : ''
  const postJa = ed.postweiterleitung === 'ja'

  const sfx = firma ? ' – ' + firma : ''
  if (isDK) {
    return [
      { id: '_ga_angebot', name: '📤 Angebot senden 🇩🇰', betreff: `Tilbud forretningsadresse${sfx}`,
        text: `Hej${vorname ? ' ' + vorname : ''}\n\njeg sender dig hermed et tilbud på en forretningsadresse i Tyskland.\n\n• Adresse: ${adresse || '—'}\n• Ydelser: ${leistung}\n• Løbetid: ${laufzeit || '—'}\n• Månedligt gebyr: ${entgeltTxt || '—'} plus moms\n\nHvis det passer dig, sender jeg kontrakten til underskrift. Sig endelig til, hvis du har spørgsmål.\n\nVenlig hilsen` },
      { id: '_ga_vertrag', name: '✍️ Vertrag zur Unterschrift 🇩🇰', betreff: `Kontrakt forretningsadresse til underskrift${sfx}`,
        text: `Hej${vorname ? ' ' + vorname : ''}\n\nvedhæftet finder du kontrakten for forretningsadressen.\n\nGennemgå venligst kontrakten, underskriv den og send den retur til mig som PDF. Så snart jeg har den underskrevne kontrakt, aktiverer jeg adressen for dig.\n\nSig endelig til, hvis du har spørgsmål.\n\nVenlig hilsen` },
      { id: '_ga_erinnerung', name: '🔔 Erinnerung Unterschrift 🇩🇰', betreff: `Påmindelse: kontrakt forretningsadresse${sfx}`,
        text: `Hej${vorname ? ' ' + vorname : ''}\n\njeg vender lige tilbage vedrørende kontrakten for forretningsadressen. Vil du sende den underskrevet retur, når du har tid? Så kan jeg aktivere adressen.\n\nMange tak og venlig hilsen` },
      { id: '_ga_aktiv', name: '📍 Adresse aktiv bestätigen 🇩🇰', betreff: `Forretningsadresse aktiv${sfx}`,
        text: `Hej${vorname ? ' ' + vorname : ''}\n\ndin forretningsadresse er nu aktiv:\n\n${adresse || '—'}\n\nDu kan bruge denne adresse erhvervsmæssigt med det samme.${postJa ? ' Indgående post videresender vi som aftalt.' : ''}\n\nSig endelig til, hvis du har spørgsmål.\n\nVenlig hilsen` },
    ]
  }
  return [
    { id: '_ga_angebot', name: '📤 Angebot senden 🇩🇪', betreff: `Angebot Geschäftsadresse${sfx}`,
      text: `Hallo${vorname ? ' ' + vorname : ''}\n\ngerne unterbreite ich dir ein Angebot für eine Geschäftsadresse in Deutschland.\n\n• Adresse: ${adresse || '—'}\n• Leistungsumfang: ${leistung}\n• Laufzeit: ${laufzeit || '—'}\n• Monatliches Entgelt: ${entgeltTxt || '—'} zzgl. USt.\n\nWenn das für dich passt, sende ich dir den Vertrag zur Unterschrift. Bei Fragen melde dich gerne.\n\nViele Grüße` },
    { id: '_ga_vertrag', name: '✍️ Vertrag zur Unterschrift 🇩🇪', betreff: `Vertrag Geschäftsadresse zur Unterschrift${sfx}`,
      text: `Hallo${vorname ? ' ' + vorname : ''}\n\nanbei findest du den Vertrag für die Geschäftsadresse.\n\nBitte prüfe den Vertrag, unterschreibe ihn und sende ihn mir als PDF zurück. Sobald mir der unterschriebene Vertrag vorliegt, aktiviere ich die Adresse für dich.\n\nBei Fragen bin ich gerne für dich da.\n\nViele Grüße` },
    { id: '_ga_erinnerung', name: '🔔 Erinnerung Unterschrift 🇩🇪', betreff: `Erinnerung: Vertrag Geschäftsadresse${sfx}`,
      text: `Hallo${vorname ? ' ' + vorname : ''}\n\nich komme kurz auf den Vertrag für die Geschäftsadresse zurück. Magst du ihn bei Gelegenheit unterschrieben zurücksenden? Dann kann ich die Adresse aktivieren.\n\nVielen Dank und viele Grüße` },
    { id: '_ga_aktiv', name: '📍 Adresse aktiv bestätigen 🇩🇪', betreff: `Geschäftsadresse aktiv${sfx}`,
      text: `Hallo${vorname ? ' ' + vorname : ''}\n\ndeine Geschäftsadresse ist jetzt aktiv:\n\n${adresse || '—'}\n\nDu kannst diese Adresse ab sofort geschäftlich nutzen.${postJa ? ' Eingehende Post leiten wir wie vereinbart weiter.' : ''}\n\nBei Fragen melde dich jederzeit.\n\nViele Grüße` },
  ]
}

function GeschaeftsadresseSection({ au, client, onUpdate, emailVorlagen = [], emailSignaturen = [], onedriveTokens = null, onUpdateOnedriveTokens, onUpdateClient }) {
  const [open, setOpen] = useState(true)
  const [preview, setPreview] = useState(null)        // { url }
  const [showCompose, setShowCompose] = useState(false)
  const [composeMode, setComposeMode] = useState(null) // 'vertrag' | 'angebot' | null
  const ed = au.erfassungsdaten ?? {}
  const dokumente = au.dokumente ?? []
  const canCompose = !!(client && onUpdateClient)

  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url) }, [preview])

  function setFeld(key, val) {
    onUpdate({ erfassungsdaten: { ...ed, [key]: val }, erfassungsdatenBearbeitetAm: new Date().toISOString() })
  }

  const gaVorlagen = useMemo(() => buildGaVorlagen(client, au), [au.erfassungsdaten, client])

  const composePreset = useMemo(() => {
    if (!showCompose || !composeMode) return null
    const v = gaVorlagen.find(t => t.id === (composeMode === 'vertrag' ? '_ga_vertrag' : '_ga_angebot'))
    const attachments = composeMode === 'vertrag'
      ? [{ name: gaVertragFilename(au), data: pdfToBase64(buildVertragGeschaeftsadresse(client, au)), type: 'application/pdf', size: 0 }]
      : []
    return v ? { subject: v.betreff, body: v.text, attachments } : null
  }, [showCompose, composeMode, au.erfassungsdaten, client])

  function openPreview() {
    const url = URL.createObjectURL(buildVertragGeschaeftsadresse(client, au).output('blob'))
    setPreview({ url })
  }
  function confirmDownload() {
    const doc = buildVertragGeschaeftsadresse(client, au)
    const filename = gaVertragFilename(au)
    downloadPdf(doc, filename)
    onUpdate({
      dokumente: [{ id: 'dok_' + Date.now().toString(36), art: 'ga_vertrag', name: filename, contentType: 'application/pdf', erstelltAm: new Date().toISOString() }, ...dokumente.filter(d => d.art !== 'ga_vertrag')],
      verlauf: [{ id: genVerlaufId(), typ: 'dokument_erstellt', datum: todayISO(), text: 'Vertrag Geschäftsadresse erzeugt: ' + filename, erstelltAm: new Date().toISOString() }, ...(au.verlauf ?? [])],
    })
    if (preview?.url) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }
  function startSend(mode) { setComposeMode(mode); setShowCompose(true) }
  function closeCompose() { setShowCompose(false); setComposeMode(null) }
  function handleSent() {
    const order = (WORKFLOW_CONFIGS[au.typ]?.steps ?? []).map(s => s.key)
    const target = composeMode === 'vertrag' ? 'vertrag_gesendet' : 'angebot_gesendet'
    const curIdx = order.indexOf(au.workflowStatus ?? order[0])
    const tIdx = order.indexOf(target)
    if (tIdx >= 0 && curIdx < tIdx) onUpdate({ workflowStatus: target, workflowStatusDatum: todayISO() })
  }

  const fieldInput = (f) => f.options ? (
    <select value={ed[f.key] ?? ''} onChange={e => setFeld(f.key, e.target.value)} style={inputStyle}>
      {(ed[f.key] ?? '') === '' && <option value="">— bitte wählen —</option>}
      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ) : f.textarea ? (
    <textarea value={ed[f.key] ?? ''} onChange={e => setFeld(f.key, e.target.value)} placeholder={f.placeholder ?? ''} rows={2}
      style={{ ...inputStyle, resize: 'vertical', whiteSpace: 'pre-wrap', minHeight: '44px' }} />
  ) : (
    <input type={f.date ? 'date' : 'text'} value={ed[f.key] ?? ''} onChange={e => setFeld(f.key, e.target.value)} placeholder={f.placeholder ?? ''} style={inputStyle} />
  )

  return (
    <div style={{ marginBottom: '16px', border: '1px solid rgba(15,118,110,0.3)', borderRadius: '10px', overflow: 'hidden', background: 'rgba(15,118,110,0.03)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(15,118,110,0.06)', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: open ? '1px solid rgba(15,118,110,0.2)' : 'none' }}>
        <span style={{ fontSize: '15px' }}>📍</span>
        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)', flex: 1 }}>Vertragsdaten Geschäftsadresse</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '14px' }}>
          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <button onClick={openPreview}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #0f766e', background: 'transparent', color: '#0f766e', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              📄 Vertrag – Vorschau
            </button>
            {canCompose && (
              <>
                <button onClick={() => (showCompose && composeMode === 'vertrag') ? closeCompose() : startSend('vertrag')}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: (showCompose && composeMode === 'vertrag') ? 'rgba(15,118,110,0.15)' : '#0f766e', color: (showCompose && composeMode === 'vertrag') ? '#0f766e' : '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  {(showCompose && composeMode === 'vertrag') ? '✕ Schließen' : '📨 Vertrag senden'}
                </button>
                <button onClick={() => (showCompose && composeMode === 'angebot') ? closeCompose() : startSend('angebot')}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #0f766e', background: (showCompose && composeMode === 'angebot') ? 'rgba(15,118,110,0.15)' : 'transparent', color: '#0f766e', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  {(showCompose && composeMode === 'angebot') ? '✕ Schließen' : '📨 Angebot senden'}
                </button>
              </>
            )}
          </div>

          {/* Compose-Panel */}
          {canCompose && showCompose && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {composeMode === 'vertrag' ? 'Vertrag-Mail (mit Vertrag-PDF im Anhang)' : 'Angebots-Mail'} – {/dänemark|danmark|denmark|\bdk\b/.test((au.erfassungsdaten?.adresse_land || client?.land || '').toLowerCase()) ? '🇩🇰 Dänisch' : '🇩🇪 Deutsch'} – vorbefüllt. Prüfen, dann „Senden".
              </div>
              <JAComposePanel au={au} client={client}
                emailVorlagen={emailVorlagen} extraVorlagen={gaVorlagen}
                preset={composePreset} forcePreset={true} onSent={handleSent}
                emailSignaturen={emailSignaturen} onedriveTokens={onedriveTokens}
                onUpdateOnedriveTokens={onUpdateOnedriveTokens} onUpdateClient={onUpdateClient}
                onClose={closeCompose} />
            </div>
          )}

          {dokumente.some(d => d.art === 'ga_vertrag') && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              📄 Vertrag zuletzt erzeugt {fmtShortDate((dokumente.find(d => d.art === 'ga_vertrag') || {}).erstelltAm)}
            </div>
          )}

          {/* Felder */}
          {GA_FELDER.map(grp => (
            <div key={grp.gruppe} style={{ marginBottom: '12px' }}>
              <div style={{ ...labelStyle, marginBottom: '6px', color: '#0f766e' }}>{grp.gruppe}</div>
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
        </div>
      )}

      {/* PDF-Vorschau-Modal */}
      {preview && (
        <div onClick={() => { if (preview.url) URL.revokeObjectURL(preview.url); setPreview(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '12px', width: 'min(900px, 95vw)', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.45)' }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '15px' }}>📄</span>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', flex: 1 }}>Vorschau – Vertrag Geschäftsadresse</span>
              <button onClick={() => { if (preview.url) URL.revokeObjectURL(preview.url); setPreview(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1 }}>✕</button>
            </div>
            <iframe title="Vertrag-Vorschau" src={preview.url} style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }} />
            <div style={{ padding: '12px 16px', display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { if (preview.url) URL.revokeObjectURL(preview.url); setPreview(null) }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '13px', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={confirmDownload}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#0f766e', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>⬇️ Herunterladen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vorratsgesellschaft: Daten + Angebot-PDF + Versand ────────────────────────
const VG_FELDER = [
  { gruppe: 'Mantelgesellschaft', felder: [
    { key: 'vg_firmenname',     label: 'Firmenname der Vorratsgesellschaft', wide: true },
    { key: 'vg_rechtsform',     label: 'Rechtsform', options: [
      { value: 'ug',   label: 'UG' }, { value: 'gmbh', label: 'GmbH' } ]},
    { key: 'vg_hrb',            label: 'Handelsregisternummer' },
    { key: 'vg_sitz',           label: 'Sitz' },
    { key: 'vg_gruendungsdatum',label: 'Gründungsdatum', date: true },
    { key: 'vg_stammkapital',   label: 'Stammkapital' },
    { key: 'vg_status',         label: 'Status', options: [
      { value: 'frei', label: 'frei' }, { value: 'reserviert', label: 'reserviert' }, { value: 'verkauft', label: 'verkauft' } ]},
  ]},
  { gruppe: 'Erwerber', felder: [
    { key: 'erwerber_name',          label: 'Name / Firma Erwerber' },
    { key: 'erwerber_ansprechpartner',label: 'Ansprechpartner' },
    { key: 'erwerber_email',         label: 'E-Mail Ansprechpartner' },
    { key: 'erwerber_adresse',       label: 'Adresse Erwerber', textarea: true, wide: true },
  ]},
  { gruppe: 'Umfirmierung & Übernahme', felder: [
    { key: 'neuer_firmenname', label: 'Gewünschter neuer Firmenname' },
    { key: 'neuer_sitz',       label: 'Neuer Sitz' },
    { key: 'neuer_gegenstand', label: 'Neuer Unternehmensgegenstand', textarea: true, wide: true },
    { key: 'kuenftiger_gf',    label: 'Künftiger Geschäftsführer' },
    { key: 'kaufpreis',        label: 'Kaufpreis / Entgelt', placeholder: 'z. B. 12.900 €' },
    { key: 'notar',            label: 'Notar' },
    { key: 'notartermin',      label: 'Notartermin', date: true },
    { key: 'uebergabedatum',   label: 'Geplantes Übergabedatum', date: true },
  ]},
]

const VG_RECHTSFORM_LABEL = { ug: 'UG (haftungsbeschränkt)', gmbh: 'GmbH' }

// 4 Vorlagen (DE/DK nach Land, Du-Form; Signatur hängt der Composer an)
function buildVgVorlagen(client, au) {
  const ed = au.erfassungsdaten || {}
  const isDK = /dänemark|danmark|denmark|\bdk\b/.test((ed.erwerber_land || client?.land || '').toLowerCase())
  const erwName = (ed.erwerber_name || client?.name || '').trim()
  const ap = (ed.erwerber_ansprechpartner || (client?.kontakte || [])[0]?.name || '').trim()
  const vorname = ap.split(/\s+/)[0] || ''
  const mantel = (ed.vg_firmenname || '').trim()
  const rechtsform = VG_RECHTSFORM_LABEL[ed.vg_rechtsform] || ed.vg_rechtsform || ''
  const neuerName = (ed.neuer_firmenname || '').trim()
  const kp = (ed.kaufpreis || '').trim()
  const kpTxt = kp ? kp + (/€|eur|kr/i.test(kp) ? '' : ' €') : ''
  const notar = (ed.notar || '').trim()
  const notartermin = (ed.notartermin || '').trim()
  const ntDE = /^(\d{4})-(\d{2})-(\d{2})$/.test(notartermin) ? notartermin.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3.$2.$1') : notartermin

  const sfx = mantel ? ' – ' + mantel : (neuerName ? ' – ' + neuerName : '')
  if (isDK) {
    return [
      { id: '_vg_angebot', name: '📤 Angebot senden 🇩🇰', betreff: `Tilbud skuffeselskab${sfx}`,
        text: `Hej${vorname ? ' ' + vorname : ''}\n\njeg sender dig hermed et tilbud på et tysk skuffeselskab (Vorratsgesellschaft).\n\n• Selskab: ${mantel || '—'}${rechtsform ? ' (' + rechtsform + ')' : ''}\n• Ønsket nyt navn: ${neuerName || '—'}\n• Pris: ${kpTxt || '—'} plus moms\n\nVedhæftet finder du det fulde tilbud. Den notarielle overdragelse sker separat hos notaren. Sig endelig til, hvis du har spørgsmål.\n\nVenlig hilsen` },
      { id: '_vg_reservierung', name: '✅ Reservierungsbestätigung 🇩🇰', betreff: `Bekræftelse på reservation${sfx}`,
        text: `Hej${vorname ? ' ' + vorname : ''}\n\ntak — jeg bekræfter hermed, at vi reserverer selskabet ${mantel || ''} til dig. Jeg forbereder nu den notarielle aftale og vender tilbage med en tid hos notaren.\n\nVenlig hilsen` },
      { id: '_vg_notar', name: '📅 Notartermin-Info 🇩🇰', betreff: `Notartermin${sfx}`,
        text: `Hej${vorname ? ' ' + vorname : ''}\n\nher er informationerne om den notarielle overdragelse:\n\n• Notar: ${notar || '—'}\n• Tidspunkt: ${ntDE || '—'}\n\nSelve overdragelsen af selskabet sker ved den notarielle beurkundelse. Sig endelig til, hvis tidspunktet skal ændres.\n\nVenlig hilsen` },
      { id: '_vg_uebernahme', name: '🏛 Übernahme / nächste Schritte 🇩🇰', betreff: `Næste skridt overdragelse${sfx}`,
        text: `Hej${vorname ? ' ' + vorname : ''}\n\nselskabet er nu overdraget til dig. De næste skridt er omdøbning til ${neuerName || '—'}, ny hjemsted og registrering i handelsregistret. Jeg holder dig opdateret.\n\nVenlig hilsen` },
    ]
  }
  return [
    { id: '_vg_angebot', name: '📤 Angebot senden 🇩🇪', betreff: `Angebot Vorratsgesellschaft${sfx}`,
      text: `Hallo${vorname ? ' ' + vorname : ''}\n\ngerne unterbreite ich dir ein Angebot für eine deutsche Vorratsgesellschaft.\n\n• Gesellschaft: ${mantel || '—'}${rechtsform ? ' (' + rechtsform + ')' : ''}\n• Gewünschter neuer Name: ${neuerName || '—'}\n• Kaufpreis: ${kpTxt || '—'} zzgl. USt.\n\nDas vollständige Angebot findest du im Anhang. Die notarielle Übertragung erfolgt separat beim Notar. Bei Fragen melde dich gerne.\n\nViele Grüße` },
    { id: '_vg_reservierung', name: '✅ Reservierungsbestätigung 🇩🇪', betreff: `Reservierungsbestätigung${sfx}`,
      text: `Hallo${vorname ? ' ' + vorname : ''}\n\nvielen Dank — hiermit bestätige ich, dass wir die Gesellschaft ${mantel || ''} für dich reservieren. Ich bereite nun den notariellen Vertrag vor und melde mich mit einem Notartermin.\n\nViele Grüße` },
    { id: '_vg_notar', name: '📅 Notartermin-Info 🇩🇪', betreff: `Notartermin${sfx}`,
      text: `Hallo${vorname ? ' ' + vorname : ''}\n\nhier die Informationen zur notariellen Übertragung:\n\n• Notar: ${notar || '—'}\n• Termin: ${ntDE || '—'}\n\nDie eigentliche Übertragung der Gesellschaft erfolgt mit der notariellen Beurkundung. Falls der Termin nicht passt, sag gerne Bescheid.\n\nViele Grüße` },
    { id: '_vg_uebernahme', name: '🏛 Übernahme / nächste Schritte 🇩🇪', betreff: `Nächste Schritte Übernahme${sfx}`,
      text: `Hallo${vorname ? ' ' + vorname : ''}\n\ndie Gesellschaft ist nun auf dich übertragen. Die nächsten Schritte sind die Umfirmierung in ${neuerName || '—'}, der neue Sitz und die Eintragung im Handelsregister. Ich halte dich auf dem Laufenden.\n\nViele Grüße` },
  ]
}

function VorratsgesellSection({ au, client, onUpdate, emailVorlagen = [], emailSignaturen = [], onedriveTokens = null, onUpdateOnedriveTokens, onUpdateClient }) {
  const [open, setOpen] = useState(true)
  const [preview, setPreview] = useState(null)         // { url }
  const [showCompose, setShowCompose] = useState(false)
  const [composeMode, setComposeMode] = useState(null) // 'angebot' | 'notar' | null
  const ed = au.erfassungsdaten ?? {}
  const dokumente = au.dokumente ?? []
  const canCompose = !!(client && onUpdateClient)

  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url) }, [preview])

  function setFeld(key, val) {
    onUpdate({ erfassungsdaten: { ...ed, [key]: val }, erfassungsdatenBearbeitetAm: new Date().toISOString() })
  }

  const vgVorlagen = useMemo(() => buildVgVorlagen(client, au), [au.erfassungsdaten, client])

  const composePreset = useMemo(() => {
    if (!showCompose || !composeMode) return null
    const v = vgVorlagen.find(t => t.id === (composeMode === 'notar' ? '_vg_notar' : '_vg_angebot'))
    const attachments = composeMode === 'angebot'
      ? [{ name: vgAngebotFilename(au), data: pdfToBase64(buildAngebotVorratsgesell(client, au)), type: 'application/pdf', size: 0 }]
      : []
    return v ? { subject: v.betreff, body: v.text, attachments } : null
  }, [showCompose, composeMode, au.erfassungsdaten, client])

  function openPreview() {
    const url = URL.createObjectURL(buildAngebotVorratsgesell(client, au).output('blob'))
    setPreview({ url })
  }
  function confirmDownload() {
    const doc = buildAngebotVorratsgesell(client, au)
    const filename = vgAngebotFilename(au)
    downloadPdf(doc, filename)
    onUpdate({
      dokumente: [{ id: 'dok_' + Date.now().toString(36), art: 'vg_angebot', name: filename, contentType: 'application/pdf', erstelltAm: new Date().toISOString() }, ...dokumente.filter(d => d.art !== 'vg_angebot')],
      verlauf: [{ id: genVerlaufId(), typ: 'dokument_erstellt', datum: todayISO(), text: 'Angebot Vorratsgesellschaft erzeugt: ' + filename, erstelltAm: new Date().toISOString() }, ...(au.verlauf ?? [])],
    })
    if (preview?.url) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }
  function startSend(mode) { setComposeMode(mode); setShowCompose(true) }
  function closeCompose() { setShowCompose(false); setComposeMode(null) }
  function handleSent() {
    const order = (WORKFLOW_CONFIGS[au.typ]?.steps ?? []).map(s => s.key)
    const target = composeMode === 'notar' ? 'notar_termin' : 'angebot_gesendet'
    const curIdx = order.indexOf(au.workflowStatus ?? order[0])
    const tIdx = order.indexOf(target)
    if (tIdx >= 0 && curIdx < tIdx) onUpdate({ workflowStatus: target, workflowStatusDatum: todayISO() })
  }

  const fieldInput = (f) => f.options ? (
    <select value={ed[f.key] ?? ''} onChange={e => setFeld(f.key, e.target.value)} style={inputStyle}>
      {(ed[f.key] ?? '') === '' && <option value="">— bitte wählen —</option>}
      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ) : f.textarea ? (
    <textarea value={ed[f.key] ?? ''} onChange={e => setFeld(f.key, e.target.value)} placeholder={f.placeholder ?? ''} rows={2}
      style={{ ...inputStyle, resize: 'vertical', whiteSpace: 'pre-wrap', minHeight: '44px' }} />
  ) : (
    <input type={f.date ? 'date' : 'text'} value={ed[f.key] ?? ''} onChange={e => setFeld(f.key, e.target.value)} placeholder={f.placeholder ?? ''} style={inputStyle} />
  )

  return (
    <div style={{ marginBottom: '16px', border: '1px solid rgba(217,119,6,0.3)', borderRadius: '10px', overflow: 'hidden', background: 'rgba(217,119,6,0.03)' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(217,119,6,0.06)', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: open ? '1px solid rgba(217,119,6,0.2)' : 'none' }}>
        <span style={{ fontSize: '15px' }}>📦</span>
        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)', flex: 1 }}>Daten Vorratsgesellschaft</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '14px' }}>
          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <button onClick={openPreview}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #d97706', background: 'transparent', color: '#d97706', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              📄 Angebot – Vorschau
            </button>
            {canCompose && (
              <>
                <button onClick={() => (showCompose && composeMode === 'angebot') ? closeCompose() : startSend('angebot')}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: (showCompose && composeMode === 'angebot') ? 'rgba(217,119,6,0.15)' : '#d97706', color: (showCompose && composeMode === 'angebot') ? '#d97706' : '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  {(showCompose && composeMode === 'angebot') ? '✕ Schließen' : '📨 Angebot senden'}
                </button>
                <button onClick={() => (showCompose && composeMode === 'notar') ? closeCompose() : startSend('notar')}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #d97706', background: (showCompose && composeMode === 'notar') ? 'rgba(217,119,6,0.15)' : 'transparent', color: '#d97706', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  {(showCompose && composeMode === 'notar') ? '✕ Schließen' : '📨 Notartermin-Info senden'}
                </button>
              </>
            )}
          </div>

          {/* Compose-Panel */}
          {canCompose && showCompose && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {composeMode === 'angebot' ? 'Angebots-Mail (mit Angebot-PDF im Anhang)' : 'Notartermin-Info (ohne Anhang)'} – {/dänemark|danmark|denmark|\bdk\b/.test((au.erfassungsdaten?.erwerber_land || client?.land || '').toLowerCase()) ? '🇩🇰 Dänisch' : '🇩🇪 Deutsch'} – vorbefüllt. Prüfen, dann „Senden".
              </div>
              <JAComposePanel au={au} client={client}
                emailVorlagen={emailVorlagen} extraVorlagen={vgVorlagen}
                preset={composePreset} forcePreset={true} onSent={handleSent}
                emailSignaturen={emailSignaturen} onedriveTokens={onedriveTokens}
                onUpdateOnedriveTokens={onUpdateOnedriveTokens} onUpdateClient={onUpdateClient}
                onClose={closeCompose} />
            </div>
          )}

          {dokumente.some(d => d.art === 'vg_angebot') && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              📄 Angebot zuletzt erzeugt {fmtShortDate((dokumente.find(d => d.art === 'vg_angebot') || {}).erstelltAm)}
            </div>
          )}

          {/* Felder */}
          {VG_FELDER.map(grp => (
            <div key={grp.gruppe} style={{ marginBottom: '12px' }}>
              <div style={{ ...labelStyle, marginBottom: '6px', color: '#d97706' }}>{grp.gruppe}</div>
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

          {/* Hinweis: notarieller Vertrag bleibt beim Notar */}
          <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Hinweis: Das erzeugte PDF ist nur ein Angebot/Reservierung. Der notarielle Geschäftsanteilskaufvertrag bleibt beim Notar.
          </div>
        </div>
      )}

      {/* PDF-Vorschau-Modal */}
      {preview && (
        <div onClick={() => { if (preview.url) URL.revokeObjectURL(preview.url); setPreview(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '12px', width: 'min(900px, 95vw)', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.45)' }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '15px' }}>📦</span>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', flex: 1 }}>Vorschau – Angebot Vorratsgesellschaft</span>
              <button onClick={() => { if (preview.url) URL.revokeObjectURL(preview.url); setPreview(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1 }}>✕</button>
            </div>
            <iframe title="Angebot-Vorschau" src={preview.url} style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }} />
            <div style={{ padding: '12px 16px', display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { if (preview.url) URL.revokeObjectURL(preview.url); setPreview(null) }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '13px', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={confirmDownload}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#d97706', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>⬇️ Herunterladen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── UG-/GmbH-Gründung: gemeinsame Gründungsdaten + Datenblatt-PDF + Versand ────
const GRUENDUNG_FELDER = [
  { gruppe: 'Gesellschaft', felder: [
    { key: 'g_firmenname',   label: 'Gewünschter Firmenname', wide: true },
    { key: 'g_rechtsform',   label: 'Rechtsform', options: [
      { value: 'ug', label: 'UG (haftungsbeschränkt)' }, { value: 'gmbh', label: 'GmbH' } ]},
    { key: 'g_sitz',         label: 'Sitz' },
    { key: 'g_geschaeftsadresse', label: 'Geschäftsadresse', textarea: true, wide: true },
    { key: 'g_gegenstand',   label: 'Unternehmensgegenstand', textarea: true, wide: true },
    { key: 'g_geschaeftsjahr',label: 'Geschäftsjahr', placeholder: 'z. B. Kalenderjahr' },
  ]},
  { gruppe: 'Gesellschafter', felder: [
    { key: 'gs_name',        label: 'Name / Firma' },
    { key: 'gs_beteiligung', label: 'Beteiligung %' },
    { key: 'gs_kapitalanteil',label: 'Kapitalanteil €' },
    { key: 'gs_email',       label: 'E-Mail' },
    { key: 'gs_adresse',     label: 'Adresse', textarea: true, wide: true },
    { key: 'gs_weitere',     label: 'Weitere Gesellschafter (Freitext)', textarea: true, wide: true },
  ]},
  { gruppe: 'Geschäftsführer', felder: [
    { key: 'gf_name',        label: 'Name' },
    { key: 'gf_geburtsdatum',label: 'Geburtsdatum', date: true },
    { key: 'gf_email',       label: 'E-Mail' },
    { key: 'gf_staat',       label: 'Staatsangehörigkeit' },
    { key: 'gf_einzelvertretung', label: 'Einzelvertretungsberechtigt', options: [
      { value: 'ja', label: 'Ja' }, { value: 'nein', label: 'Nein' } ]},
    { key: 'gf_adresse',     label: 'Adresse', textarea: true, wide: true },
    { key: 'gf_weitere',     label: 'Weitere Geschäftsführer (Freitext)', textarea: true, wide: true },
  ]},
  { gruppe: 'Kapital', felder: [
    { key: 'k_stammkapital', label: 'Stammkapital' },
    { key: 'k_einzahlung',   label: 'Einzahlung' },
    { key: 'k_bankkonto',    label: 'Bankkonto', options: [
      { value: 'geplant', label: 'geplant' }, { value: 'vorhanden', label: 'vorhanden' } ]},
  ]},
  { gruppe: 'Notar / Ablauf', felder: [
    { key: 'n_notar',          label: 'Notar' },
    { key: 'n_notartermin',    label: 'Notartermin', date: true },
    { key: 'n_handelsregister',label: 'Handelsregister (Amtsgericht)' },
    { key: 'n_steuerl_erfassung', label: 'Steuerliche Erfassung' },
    { key: 'n_geschaeftskonto',label: 'Geschäftskonto' },
  ]},
]

// 5 Vorlagen (DE/DK nach Land, Du-Form; Signatur hängt der Composer an)
function buildGruendungVorlagen(client, au) {
  const ed = au.erfassungsdaten || {}
  const isDK = /dänemark|danmark|denmark|\bdk\b/.test((ed.gs_land || client?.land || '').toLowerCase())
  const rfLabel = gruendungRechtsform(au) === 'gmbh' ? 'GmbH' : 'UG (haftungsbeschränkt)'
  const firma = (ed.g_firmenname || '').trim()
  const ap = (ed.gf_name || ed.gs_name || (client?.kontakte || [])[0]?.name || '').trim()
  const vorname = ap.split(/\s+/)[0] || ''
  const notar = (ed.n_notar || '').trim()
  const nt = (ed.n_notartermin || '').trim()
  const ntDE = /^(\d{4})-(\d{2})-(\d{2})$/.test(nt) ? nt.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3.$2.$1') : nt

  const sfx = firma ? ' – ' + firma : ` – ${rfLabel}`
  if (isDK) {
    return [
      { id: '_gr_anfordern', name: '📨 Gründungsdaten anfordern 🇩🇰', betreff: `Oplysninger til stiftelse${sfx}`,
        text: `Hej${vorname ? ' ' + vorname : ''}\n\nfor at stifte dit tyske selskab (${rfLabel}) har jeg brug for et par oplysninger:\n\n• Ønsket firmanavn og hjemsted\n• Selskabets formål\n• Anpartshavere (navn, adresse, andel)\n• Direktør (navn, adresse, fødselsdato, statsborgerskab)\n• Stamkapital og indbetaling\n\nSig endelig til, hvis du har spørgsmål.\n\nVenlig hilsen` },
      { id: '_gr_pruefung', name: '✅ Daten erhalten / Prüfung 🇩🇰', betreff: `Tak – vi gennemgår dine oplysninger${sfx}`,
        text: `Hej${vorname ? ' ' + vorname : ''}\n\ntak for oplysningerne. Jeg gennemgår dem nu og vender tilbage, hvis der mangler noget. Derefter forbereder jeg stiftelsen og notarmødet.\n\nVenlig hilsen` },
      { id: '_gr_notar', name: '📅 Notartermin / Datenblatt 🇩🇰', betreff: `Forberedelse notarmøde${sfx}`,
        text: `Hej${vorname ? ' ' + vorname : ''}\n\nvedhæftet finder du et datablad med alle stiftelsesoplysninger til forberedelse af notarmødet.\n\n• Notar: ${notar || '—'}\n• Tidspunkt: ${ntDE || '—'}\n\nSelve stiftelsen beurkundes hos notaren. Tjek venligst oplysningerne og giv besked ved rettelser.\n\nVenlig hilsen` },
      { id: '_gr_nachgruendung', name: '🏛 Nach Gründung: nächste Schritte 🇩🇰', betreff: `Næste skridt efter stiftelsen${sfx}`,
        text: `Hej${vorname ? ' ' + vorname : ''}\n\nselskabet er stiftet. De næste skridt er registrering i handelsregistret, den skattemæssige registrering og åbning af erhvervskontoen. Jeg holder dig opdateret.\n\nVenlig hilsen` },
      { id: '_gr_erinnerung', name: '🔔 Erinnerung fehlende Angaben 🇩🇰', betreff: `Påmindelse: manglende oplysninger${sfx}`,
        text: `Hej${vorname ? ' ' + vorname : ''}\n\njeg mangler stadig nogle oplysninger til stiftelsen. Vil du sende dem, når du har tid? Så kan vi gå videre.\n\nMange tak og venlig hilsen` },
    ]
  }
  return [
    { id: '_gr_anfordern', name: '📨 Gründungsdaten anfordern 🇩🇪', betreff: `Gründungsdaten${sfx}`,
      text: `Hallo${vorname ? ' ' + vorname : ''}\n\nfür die Gründung deiner ${rfLabel} brauche ich noch ein paar Angaben:\n\n• Gewünschter Firmenname und Sitz\n• Unternehmensgegenstand\n• Gesellschafter (Name, Adresse, Beteiligung)\n• Geschäftsführer (Name, Adresse, Geburtsdatum, Staatsangehörigkeit)\n• Stammkapital und Einzahlung\n\nBei Fragen melde dich gerne.\n\nViele Grüße` },
    { id: '_gr_pruefung', name: '✅ Daten erhalten / Prüfung 🇩🇪', betreff: `Danke – ich prüfe deine Angaben${sfx}`,
      text: `Hallo${vorname ? ' ' + vorname : ''}\n\nvielen Dank für die Angaben. Ich prüfe sie jetzt und melde mich, falls etwas fehlt. Anschließend bereite ich die Gründung und den Notartermin vor.\n\nViele Grüße` },
    { id: '_gr_notar', name: '📅 Notartermin / Datenblatt 🇩🇪', betreff: `Vorbereitung Notartermin${sfx}`,
      text: `Hallo${vorname ? ' ' + vorname : ''}\n\nanbei findest du ein Datenblatt mit allen Gründungsangaben zur Vorbereitung des Notartermins.\n\n• Notar: ${notar || '—'}\n• Termin: ${ntDE || '—'}\n\nDie eigentliche Gründung wird beim Notar beurkundet. Bitte prüfe die Angaben und sag bei Korrekturen Bescheid.\n\nViele Grüße` },
    { id: '_gr_nachgruendung', name: '🏛 Nach Gründung: nächste Schritte 🇩🇪', betreff: `Nächste Schritte nach der Gründung${sfx}`,
      text: `Hallo${vorname ? ' ' + vorname : ''}\n\ndie Gesellschaft ist gegründet. Die nächsten Schritte sind die Eintragung im Handelsregister, die steuerliche Erfassung und die Eröffnung des Geschäftskontos. Ich halte dich auf dem Laufenden.\n\nViele Grüße` },
    { id: '_gr_erinnerung', name: '🔔 Erinnerung fehlende Angaben 🇩🇪', betreff: `Erinnerung: fehlende Gründungsangaben${sfx}`,
      text: `Hallo${vorname ? ' ' + vorname : ''}\n\nmir fehlen noch einige Angaben für die Gründung. Magst du sie bei Gelegenheit nachreichen? Dann können wir weitermachen.\n\nVielen Dank und viele Grüße` },
  ]
}

function GruendungSection({ au, client, onUpdate, emailVorlagen = [], emailSignaturen = [], onedriveTokens = null, onUpdateOnedriveTokens, onUpdateClient }) {
  const [open, setOpen] = useState(true)
  const [preview, setPreview] = useState(null)          // { url }
  const [showCompose, setShowCompose] = useState(false)
  const [composeMode, setComposeMode] = useState(null)  // 'anfordern' | 'notar' | null
  const ed = au.erfassungsdaten ?? {}
  const dokumente = au.dokumente ?? []
  const canCompose = !!(client && onUpdateClient)
  const isGmbH = au.typ === 'gmbh_gruendung'
  const TH = isGmbH
    ? { c: '#2563eb', soft: 'rgba(37,99,235,0.06)', soft2: 'rgba(37,99,235,0.03)', b: 'rgba(37,99,235,0.3)', b2: 'rgba(37,99,235,0.2)', sel: 'rgba(37,99,235,0.15)' }
    : { c: '#7c3aed', soft: 'rgba(124,58,237,0.06)', soft2: 'rgba(124,58,237,0.03)', b: 'rgba(124,58,237,0.3)', b2: 'rgba(124,58,237,0.2)', sel: 'rgba(124,58,237,0.15)' }

  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url) }, [preview])

  function setFeld(key, val) {
    onUpdate({ erfassungsdaten: { ...ed, [key]: val }, erfassungsdatenBearbeitetAm: new Date().toISOString() })
  }

  const grVorlagen = useMemo(() => buildGruendungVorlagen(client, au), [au.erfassungsdaten, client])

  const composePreset = useMemo(() => {
    if (!showCompose || !composeMode) return null
    const v = grVorlagen.find(t => t.id === (composeMode === 'notar' ? '_gr_notar' : '_gr_anfordern'))
    const attachments = composeMode === 'notar'
      ? [{ name: gruendungFilename(au), data: pdfToBase64(buildGruendungsdatenblatt(client, au)), type: 'application/pdf', size: 0 }]
      : []
    return v ? { subject: v.betreff, body: v.text, attachments } : null
  }, [showCompose, composeMode, au.erfassungsdaten, client])

  function openPreview() {
    const url = URL.createObjectURL(buildGruendungsdatenblatt(client, au).output('blob'))
    setPreview({ url })
  }
  function confirmDownload() {
    const doc = buildGruendungsdatenblatt(client, au)
    const filename = gruendungFilename(au)
    downloadPdf(doc, filename)
    onUpdate({
      dokumente: [{ id: 'dok_' + Date.now().toString(36), art: 'gruendung_datenblatt', name: filename, contentType: 'application/pdf', erstelltAm: new Date().toISOString() }, ...dokumente.filter(d => d.art !== 'gruendung_datenblatt')],
      verlauf: [{ id: genVerlaufId(), typ: 'dokument_erstellt', datum: todayISO(), text: 'Gründungsdatenblatt erzeugt: ' + filename, erstelltAm: new Date().toISOString() }, ...(au.verlauf ?? [])],
    })
    if (preview?.url) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }
  function startSend(mode) { setComposeMode(mode); setShowCompose(true) }
  function closeCompose() { setShowCompose(false); setComposeMode(null) }
  function handleSent() {
    const order = (WORKFLOW_CONFIGS[au.typ]?.steps ?? []).map(s => s.key)
    const target = composeMode === 'notar' ? 'notar_termin' : 'formular_gesendet'
    const curIdx = order.indexOf(au.workflowStatus ?? order[0])
    const tIdx = order.indexOf(target)
    if (tIdx >= 0 && curIdx < tIdx) onUpdate({ workflowStatus: target, workflowStatusDatum: todayISO() })
  }

  const fieldInput = (f) => f.options ? (
    <select value={ed[f.key] ?? ''} onChange={e => setFeld(f.key, e.target.value)} style={inputStyle}>
      {(ed[f.key] ?? '') === '' && <option value="">— bitte wählen —</option>}
      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ) : f.textarea ? (
    <textarea value={ed[f.key] ?? ''} onChange={e => setFeld(f.key, e.target.value)} placeholder={f.placeholder ?? ''} rows={2}
      style={{ ...inputStyle, resize: 'vertical', whiteSpace: 'pre-wrap', minHeight: '44px' }} />
  ) : (
    <input type={f.date ? 'date' : 'text'} value={ed[f.key] ?? ''} onChange={e => setFeld(f.key, e.target.value)} placeholder={f.placeholder ?? ''} style={inputStyle} />
  )

  return (
    <div style={{ marginBottom: '16px', border: `1px solid ${TH.b}`, borderRadius: '10px', overflow: 'hidden', background: TH.soft2 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', background: TH.soft, border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: open ? `1px solid ${TH.b2}` : 'none' }}>
        <span style={{ fontSize: '15px' }}>🏢</span>
        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)', flex: 1 }}>Gründungsdaten ({isGmbH ? 'GmbH' : 'UG'})</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '14px' }}>
          {/* Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <button onClick={openPreview}
              style={{ padding: '8px 14px', borderRadius: '8px', border: `1px solid ${TH.c}`, background: 'transparent', color: TH.c, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              📄 Gründungsdatenblatt – Vorschau
            </button>
            {canCompose && (
              <>
                <button onClick={() => (showCompose && composeMode === 'anfordern') ? closeCompose() : startSend('anfordern')}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: (showCompose && composeMode === 'anfordern') ? TH.sel : TH.c, color: (showCompose && composeMode === 'anfordern') ? TH.c : '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  {(showCompose && composeMode === 'anfordern') ? '✕ Schließen' : '📨 Gründungsdaten anfordern'}
                </button>
                <button onClick={() => (showCompose && composeMode === 'notar') ? closeCompose() : startSend('notar')}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: `1px solid ${TH.c}`, background: (showCompose && composeMode === 'notar') ? TH.sel : 'transparent', color: TH.c, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  {(showCompose && composeMode === 'notar') ? '✕ Schließen' : '📨 Datenblatt / Notartermin senden'}
                </button>
              </>
            )}
          </div>

          {/* Compose-Panel */}
          {canCompose && showCompose && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {composeMode === 'notar' ? 'Notartermin-Mail (mit Gründungsdatenblatt im Anhang)' : 'Anforderungs-Mail (ohne Anhang)'} – {/dänemark|danmark|denmark|\bdk\b/.test((au.erfassungsdaten?.gs_land || client?.land || '').toLowerCase()) ? '🇩🇰 Dänisch' : '🇩🇪 Deutsch'} – vorbefüllt. Prüfen, dann „Senden".
              </div>
              <JAComposePanel au={au} client={client}
                emailVorlagen={emailVorlagen} extraVorlagen={grVorlagen}
                preset={composePreset} forcePreset={true} onSent={handleSent}
                emailSignaturen={emailSignaturen} onedriveTokens={onedriveTokens}
                onUpdateOnedriveTokens={onUpdateOnedriveTokens} onUpdateClient={onUpdateClient}
                onClose={closeCompose} />
            </div>
          )}

          {dokumente.some(d => d.art === 'gruendung_datenblatt') && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              📄 Datenblatt zuletzt erzeugt {fmtShortDate((dokumente.find(d => d.art === 'gruendung_datenblatt') || {}).erstelltAm)}
            </div>
          )}

          {/* Felder */}
          {GRUENDUNG_FELDER.map(grp => (
            <div key={grp.gruppe} style={{ marginBottom: '12px' }}>
              <div style={{ ...labelStyle, marginBottom: '6px', color: TH.c }}>{grp.gruppe}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {grp.felder.map(f => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px', gridColumn: f.wide ? '1 / -1' : 'auto' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{f.label}</span>
                    {fieldInput(f)}
                  </label>
                ))}
              </div>
              {/* Kapital-Hinweis je nach Rechtsform */}
              {grp.gruppe === 'Kapital' && (
                <div style={{ marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {isGmbH
                    ? 'GmbH: Stammkapital 25.000 €, mind. 12.500 € bei der HR-Anmeldung einzuzahlen.'
                    : 'UG: freies Stammkapital ab 1 €, nur Bareinlage; gesetzliche Thesaurierungspflicht (25 % bis 25.000 €).'}
                </div>
              )}
            </div>
          ))}

          {/* Hinweis: Datenblatt ersetzt keine Beurkundung */}
          <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Hinweis: Das Gründungsdatenblatt dient nur der Vorbereitung und ersetzt keine notarielle Beurkundung. Satzung/Beurkundung erfolgen beim Notar.
          </div>
        </div>
      )}

      {/* PDF-Vorschau-Modal */}
      {preview && (
        <div onClick={() => { if (preview.url) URL.revokeObjectURL(preview.url); setPreview(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: '12px', width: 'min(900px, 95vw)', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.45)' }}>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '15px' }}>🏢</span>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', flex: 1 }}>Vorschau – Gründungsdatenblatt</span>
              <button onClick={() => { if (preview.url) URL.revokeObjectURL(preview.url); setPreview(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1 }}>✕</button>
            </div>
            <iframe title="Datenblatt-Vorschau" src={preview.url} style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }} />
            <div style={{ padding: '12px 16px', display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { if (preview.url) URL.revokeObjectURL(preview.url); setPreview(null) }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '13px', cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={confirmDownload}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: TH.c, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>⬇️ Herunterladen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AuftragCard({ au, expanded, onExpand, onUpdate, onDelete, client, onOpenEmail, onUpdateClient, emailVorlagen, emailSignaturen, onedriveTokens, onUpdateOnedriveTokens, onAddRueckfrage, onToggleRueckfrage, onDeleteRueckfrage, onUpdateRueckfrageAntwort, onUpdateRueckfrageBuchungskonto, onAddRueckfrageFromCheckliste }) {
  const typCfg    = AUFTRAGS_TYP_CFG[au.typ]      ?? AUFTRAGS_TYP_CFG.freitext
  const statusCfg = AUFTRAGS_STATUS_CFG[au.status] ?? AUFTRAGS_STATUS_CFG.offen
  const frist     = fmtFrist(au.frist)
  const hinweise  = au.hinweise ?? []
  const offeneH   = hinweise.filter(h => !h.erledigt).length

  const [newH, setNewH] = useState('')
  const [jaSubView, setJaSubView] = useState('stammdaten')  // JA-Auftrag: Unter-Reiter Stammdaten | Kommunikation & Rückfragen | Checkliste

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

  // Additiv: nur das getroffene Hinweis-Objekt wird via Spread ergänzt/geändert,
  // alle übrigen Hinweise und Felder bleiben unverändert erhalten.
  const updateHinweis = (id, patch) =>
    onUpdate({ hinweise: hinweise.map(x => x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x) })
  const toggleHinweis = (id) =>
    onUpdate({ hinweise: hinweise.map(x => x.id === id ? { ...x, erledigt: !x.erledigt } : x) })
  const deleteHinweis = (id) =>
    onUpdate({ hinweise: hinweise.filter(x => x.id !== id) })

  // ── Auftrag abschließen / wieder öffnen (rein additiv: nur status + erledigtAm) ──
  // Setzt ausschließlich den vorhandenen Status; alle übrigen Auftragsdaten
  // (Hinweise, Checkliste, Honorar, Dokumente, Historie) bleiben unangetastet.
  const abgeschlossen = au.status === 'erledigt'
  const [showAbschlussConfirm, setShowAbschlussConfirm] = useState(false)
  const abschliessen  = () => { onUpdate({ status: 'erledigt', erledigtAm: new Date().toISOString() }); setShowAbschlussConfirm(false) }
  const wiederOeffnen = () => onUpdate({ status: 'in_bearbeitung', erledigtAm: null })

  // ── Auftrag blockieren (additiv & orthogonal: eigenes Flag, kein Status-Wert) ──
  // Überlagert nur; lässt status/jaWorkflowStatus/workflowStatus unangetastet.
  const blockiert = !!au.blockiert
  const blockieren = () => {
    const g = window.prompt('Grund für die Blockade (z. B. „Tilgungsplan fehlt"):', au.blockGrund || '')
    if (g === null) return
    onUpdate({ blockiert: true, blockGrund: g.trim(), blockiertAm: new Date().toISOString() })
  }
  const blockAufheben = () => onUpdate({ blockiert: false, blockGrund: '', blockiertAm: null })

  const fmtAbDatum    = iso => { if (!iso) return ''; const d = new Date(iso); return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}` }

  const isJA        = au.typ === 'jahresabschluss'
  const isErfassung = au.typ === 'erfassung'
  const hasWorkflow = !!WORKFLOW_CONFIGS[au.typ]
  // Eigene (custom_…) Status stehen nicht in JA_WORKFLOW_STATUS → Snapshot am Auftrag als Fallback nutzen,
  // damit auch selbst angelegte Status oben in der Überschrift korrekt angezeigt werden.
  const jaWfsCfg = isJA ? (JA_WORKFLOW_STATUS[au.jaWorkflowStatus ?? 'neu'] ?? au.jaStatusSnap ?? JA_WORKFLOW_STATUS.neu) : null
  const wfCurrentStep = hasWorkflow ? (WORKFLOW_CONFIGS[au.typ].steps.find(s => s.key === (au.workflowStatus ?? 'anfrage')) ?? WORKFLOW_CONFIGS[au.typ].steps[0]) : null
  // Für JA: Abschluss-Jahr prominent im Titel zeigen
  const titel = au.bezeichnung
    || (isJA && au.abschlussJahr ? `Jahresabschluss ${au.abschlussJahr}` : `${typCfg.label}${au.monat ? ' ' + MONATE[au.monat - 1] : ''} ${au.jahr}`)

  return (
    <div style={{
      border: `1px solid ${expanded ? typCfg.color + '55' : (abgeschlossen ? 'rgba(22,163,74,0.4)' : 'var(--border)')}`,
      borderRadius: '10px', background: (abgeschlossen && !expanded) ? 'rgba(22,163,74,0.05)' : 'var(--surface)', overflow: 'hidden',
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
            {au.blockiert && (
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--red)', background: 'var(--red-dim)', padding: '1px 6px', borderRadius: '8px', border: '1px solid var(--red)' }}>
                🚧 Blockiert
              </span>
            )}
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
            {abgeschlossen && (
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.12)', padding: '1px 7px', borderRadius: '8px', border: '1px solid rgba(22,163,74,0.35)' }}>
                ✓ Abgeschlossen
              </span>
            )}
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

          {/* ── JA-Auftrag: Unter-Reiter Kommunikation | Checkliste ── */}
          {isJA && (
            <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border)', marginBottom: '14px' }}>
              {[['stammdaten', '📇 Stammdaten'], ['kommunikation', '✉️ Kommunikation & Rückfragen'], ['checkliste', '📋 Checkliste']].map(([v, l]) => (
                <button key={v} onClick={() => setJaSubView(v)}
                  style={{
                    padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: '13px', fontWeight: 700, marginBottom: '-1px',
                    color: jaSubView === v ? 'var(--accent)' : 'var(--text-muted)',
                    borderBottom: jaSubView === v ? '2px solid var(--accent)' : '2px solid transparent',
                  }}>
                  {l}
                </button>
              ))}
            </div>
          )}

          {isJA && jaSubView === 'checkliste' ? (
            <JAChecklisteV2 au={au} client={client} onUpdate={onUpdate} />
          ) : (
          <>

          {/* ── JA: Stammdaten (Reiter Stammdaten) / Status + Telefon-Vorbereitung (Reiter Kommunikation) ── */}
          {isJA && jaSubView === 'stammdaten' && (
            <JAStammdatenBlock au={au} onUpdate={onUpdate} />
          )}
          {isJA && jaSubView === 'kommunikation' && (<>
            <JAStatusSection au={au} onUpdate={onUpdate} />
            <TelefonVorbereitungSection au={au} onUpdate={onUpdate} client={client}
              onAddRueckfrage={onAddRueckfrage} onToggleRueckfrage={onToggleRueckfrage} onDeleteRueckfrage={onDeleteRueckfrage} />
          </>)}

          {/* ── Workflow-Typen: Prozess-Stepper oben ── */}
          {hasWorkflow && (
            <WorkflowPanel au={au} onUpdate={onUpdate} />
          )}

          {/* ── USt-Reg. DE: Antragsdaten + PDF-Erzeugung ── */}
          {(au.typ === 'ust_reg_de' || (au.erfassungsdaten && au.typ !== 'geschaeftsadresse' && au.typ !== 'vorratsgesell' && au.typ !== 'ug_gruendung' && au.typ !== 'gmbh_gruendung')) && (
            <AntragsdatenSection au={au} client={client} onUpdate={onUpdate} />
          )}

          {/* ── Geschäftsadresse: Vertragsdaten + Vertrag-PDF + Versand ── */}
          {au.typ === 'geschaeftsadresse' && (
            <GeschaeftsadresseSection au={au} client={client} onUpdate={onUpdate}
              emailVorlagen={emailVorlagen} emailSignaturen={emailSignaturen}
              onedriveTokens={onedriveTokens} onUpdateOnedriveTokens={onUpdateOnedriveTokens}
              onUpdateClient={onUpdateClient} />
          )}

          {/* ── Vorratsgesellschaft: Daten + Angebot-PDF + Versand ── */}
          {au.typ === 'vorratsgesell' && (
            <VorratsgesellSection au={au} client={client} onUpdate={onUpdate}
              emailVorlagen={emailVorlagen} emailSignaturen={emailSignaturen}
              onedriveTokens={onedriveTokens} onUpdateOnedriveTokens={onUpdateOnedriveTokens}
              onUpdateClient={onUpdateClient} />
          )}

          {/* ── UG-/GmbH-Gründung: Gründungsdaten + Datenblatt-PDF + Versand ── */}
          {(au.typ === 'ug_gruendung' || au.typ === 'gmbh_gruendung') && (
            <GruendungSection au={au} client={client} onUpdate={onUpdate}
              emailVorlagen={emailVorlagen} emailSignaturen={emailSignaturen}
              onedriveTokens={onedriveTokens} onUpdateOnedriveTokens={onUpdateOnedriveTokens}
              onUpdateClient={onUpdateClient} />
          )}

          {(!isJA || jaSubView === 'stammdaten') && (<>
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
          </>)}

          {au.typ === 'lohn' && (
            <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <LohnStammdaten au={au} onUpdate={onUpdate} />
              <LohnJahresmappe au={au} onUpdate={onUpdate} />
            </div>
          )}

          {/* E-Mail-Quelle (wenn aus E-Mail erstellt) */}
          {au.emailRef && (!isJA || jaSubView === 'stammdaten') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(22,163,74,0.04)', border: '1px solid rgba(22,163,74,0.15)', marginBottom: '14px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', flex: 1, minWidth: 0 }}>
                📧 Quelle: E-Mail von <b>{au.emailRef.absender}</b>
                {au.emailRef.betreff && <> — {au.emailRef.betreff}</>}
              </span>
            </div>
          )}

          {/* Verknüpfte Belege / Mails / Notizen (auftrag.verknuepfungen) */}
          {Array.isArray(au.verknuepfungen) && au.verknuepfungen.length > 0 && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
                🔗 Verknüpft ({au.verknuepfungen.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {au.verknuepfungen.map(v => (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: '11px' }}>
                    <span>{v.art === 'beleg' ? '📄' : v.art === 'mail' ? '📧' : '📝'}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={v.docPath || v.name || v.betreff || ''}>
                      {v.name || v.betreff || v.docPath || 'Verknüpfung'}
                    </span>
                    {v.frist && <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 700, whiteSpace: 'nowrap' }}>⏰ {v.frist}</span>}
                    <button onClick={() => onUpdate({ verknuepfungen: au.verknuepfungen.filter(x => x.id !== v.id) })}
                      title="Verknüpfung entfernen (Datei/Mail bleibt erhalten)"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', flexShrink: 0 }}>
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gekoppelte Zeiten & Honorare (Phase 2) – additiv, entkoppeln loescht NIE den Eintrag */}
          {(() => {
            const satz = client.stundensatz ?? 90
            const zeiten   = (client.zeiteintraege ?? []).filter(z => z && z.auftragId === au.id)
            const honorare = (client.honorare ?? []).filter(h => h && h.auftragId === au.id)
            if (!zeiten.length && !honorare.length) return null
            const eb = z => z.art === 'pauschale' ? (z.pauschalBetrag || 0) : ((z.dauerMin || 0) / 60) * satz
            const stundenMin    = zeiten.filter(z => z.art !== 'pauschale').reduce((s, z) => s + (z.dauerMin || 0), 0)
            const zeitBetrag    = zeiten.reduce((s, z) => s + eb(z), 0)
            const honorarBetrag = honorare.reduce((s, h) => s + (Number(h.betrag) || 0), 0)
            const eur = n => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
            const std = m => (m / 60).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
            const deDat = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? `${m[3]}.${m[2]}.${m[1]}` : (s || '') }
            const clearZeit = id => onUpdateClient({ zeiteintraege: (client.zeiteintraege ?? []).map(z => z.id === id ? { ...z, auftragId: null } : z) })
            const clearHon  = id => onUpdateClient({ honorare:      (client.honorare ?? []).map(h => h.id === id ? { ...h, auftragId: null } : h) })
            return (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
                  ⏱ Zeiten &amp; Honorare
                </div>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {zeiten.length > 0   && <span style={{ fontSize: '12px', fontWeight: 700, color: '#0891b2' }}>{std(stundenMin)} Std · {eur(zeitBetrag)}</span>}
                  {honorare.length > 0 && <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>Honorar: {eur(honorarBetrag)}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {zeiten.map(z => (
                    <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', borderRadius: '6px', background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: '11px' }}>
                      <span style={{ color: 'var(--text-muted)', width: '58px', flexShrink: 0 }}>{deDat(z.datum)}</span>
                      <span style={{ flexShrink: 0, fontWeight: 700, color: '#0891b2', width: '58px' }}>{z.art === 'pauschale' ? 'Pausch.' : `${std(z.dauerMin || 0)} Std`}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.beschreibung}</span>
                      <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{eur(eb(z))}</span>
                      <button onClick={() => clearZeit(z.id)} title="Vom Auftrag lösen (Eintrag bleibt erhalten)"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                  {honorare.map(h => (
                    <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', borderRadius: '6px', background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: '11px' }}>
                      <span style={{ flexShrink: 0 }}>💶</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.bezeichnung || h.leistungsart}</span>
                      <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{eur(Number(h.betrag) || 0)}</span>
                      <button onClick={() => clearHon(h.id)} title="Vom Auftrag lösen (Eintrag bleibt erhalten)"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {(!isJA || jaSubView === 'kommunikation') && (
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
                  <HinweisItem key={h.id} h={h} color={typCfg.color}
                    onChange={patch => updateHinweis(h.id, patch)}
                    onToggle={() => toggleHinweis(h.id)}
                    onDelete={() => deleteHinweis(h.id)} />
                ))
              }
            </div>
          </div>
          )}

          {/* ── Kommunikation & Rückfragen (Reiter) ── */}
          {isJA && jaSubView === 'kommunikation' && (
            <>
              <JAVerlaufSection
                au={au} client={client} onUpdate={onUpdate} onOpenEmail={onOpenEmail}
                onUpdateClient={onUpdateClient}
                emailVorlagen={emailVorlagen}
                emailSignaturen={emailSignaturen}
                onedriveTokens={onedriveTokens}
                onUpdateOnedriveTokens={onUpdateOnedriveTokens}
              />
              <JAChecklisteSection
                jaCheckliste={au.jaCheckliste}
                onUpdate={patch => onUpdate(patch)}
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

          {/* ── Auftrag abschließen / wieder öffnen (Reiter Jahresabschluss) ── */}
          {(!isJA || jaSubView === 'kommunikation') && (
          <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            {abgeschlossen ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '12px 14px', borderRadius: '8px', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.35)' }}>
                <span style={{ fontSize: '22px', flexShrink: 0 }}>✅</span>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a' }}>Auftrag abgeschlossen</div>
                  {au.erledigtAm && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>am {fmtAbDatum(au.erledigtAm)} · bleibt vollständig erhalten</div>}
                </div>
                <button onClick={wiederOeffnen}
                  style={{ fontSize: '12px', fontWeight: 600, padding: '7px 14px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', flexShrink: 0 }}>
                  ↩️ Auftrag wieder öffnen
                </button>
              </div>
            ) : showAbschlussConfirm ? (
              <div style={{ padding: '14px 16px', borderRadius: '8px', background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.35)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>Auftrag wirklich abschließen?</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '12px' }}>
                  Der Auftrag wird als <b style={{ color: '#16a34a' }}>vollständig abgeschlossen</b> markiert. Er bleibt komplett erhalten – Hinweise, Unteraufgaben, Dokumente, Honorare und Historie – und kann jederzeit wieder geöffnet werden.
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={abschliessen}
                    style={{ fontSize: '12px', fontWeight: 700, padding: '8px 16px', borderRadius: '7px', border: 'none', background: '#16a34a', color: '#fff', cursor: 'pointer' }}>
                    ✅ Auftrag abschließen
                  </button>
                  <button onClick={() => setShowAbschlussConfirm(false)}
                    style={{ fontSize: '12px', padding: '8px 14px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
                    ✏️ Zurück zur Bearbeitung
                  </button>
                  <button onClick={() => setShowAbschlussConfirm(false)}
                    style={{ fontSize: '12px', padding: '8px 14px', borderRadius: '7px', border: '1px solid var(--border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    ❌ Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAbschlussConfirm(true)}
                style={{ width: '100%', fontSize: '13px', fontWeight: 700, padding: '10px 16px', borderRadius: '8px', border: '1px solid rgba(22,163,74,0.4)', background: 'rgba(22,163,74,0.08)', color: '#16a34a', cursor: 'pointer' }}>
                ✅ Auftrag abschließen
              </button>
            )}
          </div>
          )}

          {/* Blockieren – additiv, orthogonal zum Status (überlagert nur) */}
          <div style={{ marginTop: '10px' }}>
            {blockiert ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 12px', borderRadius: '8px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.35)' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>🚧</span>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--red)' }}>Auftrag blockiert</div>
                  {au.blockGrund && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{au.blockGrund}</div>}
                  {au.blockiertAm && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>seit {fmtAbDatum(au.blockiertAm)}</div>}
                </div>
                <button onClick={blockAufheben}
                  style={{ fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', flexShrink: 0 }}>
                  Blockierung aufheben
                </button>
              </div>
            ) : (
              <button onClick={blockieren}
                style={{ fontSize: '12px', fontWeight: 600, padding: '7px 13px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                🚧 Auftrag blockieren
              </button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <button onClick={onDelete}
              style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' }}>
              🗑 Auftrag löschen
            </button>
          </div>

          </>
          )}
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
  const [openInst, setOpenInst] = useState(null)
  const istLohn = au.typ === 'lohn'

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

          {au.typ === 'lohn' && (
            <div style={{ marginBottom: '14px' }}>
              <LohnStammdaten au={au} onUpdate={onUpdate} />
            </div>
          )}

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
                const m = inst.datum.getMonth() + 1, y = inst.datum.getFullYear()
                const mhKey = `${y}-${m}`
                const mh = (au.monatsHinweise ?? {})[mhKey] ?? []
                const offenH = mh.filter(h => !h.erledigt).length
                const dauer = istLohn ? (au.mitarbeiterAnweisungen ?? []).filter(d => (!d.vonMonat || m >= d.vonMonat) && (!d.bisMonat || m <= d.bisMonat)) : []
                const exp = istLohn && openInst === inst.key
                return (
                  <div key={inst.key} style={{
                    borderRadius: '6px',
                    background: istHeute ? 'rgba(59,130,246,0.07)' : inst.status === 'erledigt' ? 'rgba(22,163,74,0.03)' : 'var(--surface2)',
                    border: `1px solid ${istHeute ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px' }}>
                    <span style={{
                      fontSize: '11px', fontFamily: 'monospace', minWidth: '75px', flexShrink: 0,
                      color: istVergangen && inst.status !== 'erledigt' ? '#ef4444' : istHeute ? '#3b82f6' : 'var(--text-muted)',
                      fontWeight: istHeute ? 700 : 400,
                    }}>
                      {fmtDatumShort(inst.datum)}{istHeute ? ' ◀' : ''}
                    </span>
                    {istLohn ? (
                      <button onClick={() => setOpenInst(exp ? null : inst.key)}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontSize: '11px', color: inst.status === 'erledigt' ? 'var(--text-muted)' : 'var(--text)', textDecoration: inst.status === 'erledigt' ? 'line-through' : 'none' }}>
                        <span>{au.bezeichnung || `${typCfg.label} ${MONATE[inst.datum.getMonth()]} ${inst.datum.getFullYear()}`}</span>
                        {offenH > 0 && <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700 }}>● {offenH}</span>}
                        {dauer.length > 0 && <span style={{ fontSize: '10px', color: '#7c3aed' }}>🧷 {dauer.length}</span>}
                        <span style={{ color: 'var(--text-muted)', transform: exp ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▸</span>
                      </button>
                    ) : (
                      <span style={{ flex: 1, fontSize: '11px', color: inst.status === 'erledigt' ? 'var(--text-muted)' : 'var(--text)', textDecoration: inst.status === 'erledigt' ? 'line-through' : 'none' }}>
                        {au.bezeichnung || `${typCfg.label} ${MONATE[inst.datum.getMonth()]} ${inst.datum.getFullYear()}`}
                      </span>
                    )}
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
                    {exp && (
                      <div style={{ padding: '0 10px 10px 10px' }}>
                        {dauer.length > 0 && (
                          <div style={{ marginBottom: '8px', padding: '7px 10px', borderRadius: '6px', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>🧷 Diesen Monat zu beachten</div>
                            {dauer.map(d => (
                              <div key={d.id} style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.5 }}>
                                • {d.mitarbeiter ? <b>{d.mitarbeiter}: </b> : ''}{d.anweisung} <span style={{ color: 'var(--text-muted)' }}>({zeitraumText(d.vonMonat, d.bisMonat)})</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <MonatHinweise hinweise={mh} onChange={list => onUpdate({ monatsHinweise: { ...(au.monatsHinweise ?? {}), [mhKey]: list } })} />
                      </div>
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
export default function AuftraegeTab({ client, onUpdate, initialFilterTyp = 'alle', bereich = 'allgemein', nurAuftragId = null, onClearNur, onOpenEmail, emailVorlagen = [], emailSignaturen = [], onedriveTokens = null, onUpdateOnedriveTokens, onAddRueckfrage, onToggleRueckfrage, onDeleteRueckfrage, onUpdateRueckfrageAntwort, onUpdateRueckfrageBuchungskonto, onAddRueckfrageFromCheckliste, onWechselZuTyp }) {
  const bereichCfg = BEREICH_CFG[bereich] ?? BEREICH_CFG.allgemein

  // WICHTIG (Datensicherheit): allAuftraege = die VOLLSTÄNDIGE Liste. Sie ist die
  // Basis für ALLE Speicher-Operationen, damit Aufträge anderer Bereiche niemals
  // verloren gehen. `auftraege` ist nur die für diesen Reiter sichtbare Teilmenge
  // (Anzeige, Filter, Zählung) – reine Ansicht, keine Datenänderung.
  const allAuftraege = client.auftraege ?? []
  const auftraege = allAuftraege.filter(a => auftragInBereich(a, bereich))

  // Aufteilen in Einzel- und Serienaufträge (nur Anzeige des Bereichs)
  const einzelauftraege = auftraege.filter(a => !a.istSerie)
  const serienauftraege = auftraege.filter(a => a.istSerie)

  const [filterStatus,       setFilterStatus]       = useState('aktiv')
  const [filterTyp,          setFilterTyp]          = useState(initialFilterTyp)
  const [expandedId,         setExpandedId]         = useState(() => {
    try { return localStorage.getItem(`sda-expanded-auftrag_${client.id}`) ?? null } catch { return null }
  })
  const [quickTyp,           setQuickTyp]           = useState(bereichCfg.defaultTyp)

  // Geöffneten Auftrag persistieren
  useEffect(() => {
    try {
      if (expandedId) localStorage.setItem(`sda-expanded-auftrag_${client.id}`, expandedId)
      else localStorage.removeItem(`sda-expanded-auftrag_${client.id}`)
    } catch {}
  }, [expandedId, client.id])
  // Fokussierten Auftrag (aus dem Leistungen-Band) aufklappen – auch wenn der Reiter schon offen ist.
  useEffect(() => { if (nurAuftragId) setExpandedId(nurAuftragId) }, [nurAuftragId])
  const [showBatch,          setShowBatch]          = useState(false)
  const [showSerieErstellen, setShowSerieErstellen] = useState(false)

  function save(list) { onUpdate({ auftraege: list }) }

  // Jahresabschluss und Lohn werden in ihren eigenen Reitern angelegt. Wird so
  // ein Typ hier gewählt, springen wir dorthin, statt einen Auftrag anzulegen,
  // der im falschen Reiter landen würde.
  const istFachbereich = (typ) => typ === 'jahresabschluss' || typ === 'lohn'

  function waehleQuickTyp(typ) {
    if (bereich === 'allgemein' && istFachbereich(typ)) { onWechselZuTyp?.(typ); return }
    setQuickTyp(typ)
  }

  function createAuftrag() {
    if (bereich === 'allgemein' && istFachbereich(quickTyp)) { onWechselZuTyp?.(quickTyp); return }
    const au = mkAuftrag(quickTyp)
    save([au, ...allAuftraege])
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
    save([...newAuftraege, ...allAuftraege])
    setShowBatch(false)
    setFilterStatus('aktiv')
    setFilterTyp('alle')
  }

  function createSerienauftrag(au) {
    save([au, ...allAuftraege])
    setShowSerieErstellen(false)
    setExpandedId(au.id)
  }

  function updateAuftrag(id, patch) {
    save(allAuftraege.map(a => a.id === id ? { ...a, ...patch } : a))
  }

  function deleteAuftrag(id) {
    if (!window.confirm('Auftrag wirklich löschen?')) return
    save(allAuftraege.filter(a => a.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  // Einzel-Fokus: genau EIN Auftrag (Klick im Leistungen-Band) → überschreibt die Filter.
  const nurEintrag = nurAuftragId ? auftraege.find(a => a.id === nurAuftragId) : null

  // Einzelaufträge filtern – oder nur den fokussierten anzeigen
  const filteredEinzel = nurEintrag
    ? (nurEintrag.istSerie ? [] : [nurEintrag])
    : einzelauftraege
        .filter(a => {
          if (filterStatus === 'aktiv') return a.status !== 'erledigt'
          if (filterStatus === 'alle')  return true
          return a.status === filterStatus
        })
        .filter(a => filterTyp === 'alle' || a.typ === filterTyp)

  // Serienaufträge: immer bei 'aktiv' und 'alle', ausblenden bei Einzelstatus-Filtern
  const filteredSerien = nurEintrag
    ? (nurEintrag.istSerie ? [nurEintrag] : [])
    : (filterStatus === 'offen' || filterStatus === 'in_bearbeitung' || filterStatus === 'erledigt')
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

      {nurEintrag && (
        <button onClick={() => onClearNur?.()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '12px', background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '7px', fontSize: '12px', cursor: 'pointer' }}>
          ← Alle {bereichCfg.title}
        </button>
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>{bereichCfg.icon} {bereichCfg.title}</h2>
        {auftraege.length > 0 && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '1px 9px' }}>
            {counts.aktiv} aktiv · {counts.erledigt} erledigt{serienauftraege.length > 0 ? ` · ${serienauftraege.length} Serie${serienauftraege.length !== 1 ? 'n' : ''}` : ''}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          {bereich === 'allgemein' && (
            <select value={quickTyp} onChange={e => waehleQuickTyp(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', cursor: 'pointer' }}>
              <TypOptions bereich={bereich} mitFachbereichen={!!onWechselZuTyp} />
            </select>
          )}
          <button onClick={createAuftrag}
            style={{ padding: '7px 16px', borderRadius: '7px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {bereichCfg.neuLabel}
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

      {/* ── Hinweis: Jahresabschluss und Lohn liegen in eigenen Reitern ──
          Ohne diesen Hinweis sucht man sie hier vergeblich (die Auftragsdaten
          sind eine gemeinsame Liste, nur die Anzeige ist aufgeteilt). */}
      {bereich === 'allgemein' && onWechselZuTyp && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
          marginBottom: '10px', padding: '7px 11px', borderRadius: '8px',
          background: 'var(--surface2)', border: '1px solid var(--border)',
          fontSize: '11.5px', color: 'var(--text-muted)',
        }}>
          <span>Jahresabschluss und Lohn haben eigene Reiter:</span>
          {['jahresabschluss', 'lohn'].map(k => {
            const cfg = AUFTRAGS_TYP_CFG[k]
            const anzahl = allAuftraege.filter(a => a.typ === k).length
            return (
              <button key={k} onClick={() => onWechselZuTyp(k)}
                title={`Zum Reiter ${cfg.label} wechseln`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '3px 9px', borderRadius: '20px', cursor: 'pointer',
                  border: `1px solid ${cfg.color ?? 'var(--border2)'}55`,
                  background: 'var(--surface)', color: 'var(--text)',
                  fontSize: '11.5px', fontWeight: 600,
                }}>
                <span aria-hidden="true">{cfg.icon}</span>{cfg.label}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{anzahl}</span>
                <span aria-hidden="true">→</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Panels ── */}
      {showBatch          && <BatchSeriePanel  onCreate={createBatchSerie}    onClose={() => setShowBatch(false)} />}
      {showSerieErstellen && <SerieErstellenPanel onCreate={createSerienauftrag} onClose={() => setShowSerieErstellen(false)} />}

      {/* ── Status-Filter (gilt nur für Einzelaufträge) ── */}
      {!nurEintrag && (
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
      )}

      {/* ── Typ-Filter (nur im allgemeinen Aufträge-Reiter; JA & Lohn sind einheitlich) ── */}
      {bereich === 'allgemein' && !nurEintrag && (
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
      )}

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
              onAddRueckfrage={onAddRueckfrage}
              onToggleRueckfrage={onToggleRueckfrage}
              onDeleteRueckfrage={onDeleteRueckfrage}
              onUpdateRueckfrageAntwort={onUpdateRueckfrageAntwort}
              onUpdateRueckfrageBuchungskonto={onUpdateRueckfrageBuchungskonto}
              onAddRueckfrageFromCheckliste={onAddRueckfrageFromCheckliste}
            />
          ))}
        </div>
      )}
    </div>
  )
}
