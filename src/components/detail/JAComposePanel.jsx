/**
 * JAComposePanel – E-Mail-Compose direkt im Jahresabschlussauftrag.
 * Diktat-/Sprach-KI statt manueller Prompt-Eingabe.
 */
import { useState, useRef, useEffect } from 'react'
import { sendMailGraph, openAuthPopup } from '../../utils/onedriveClient.js'

const ABSENDER_KEY   = 'kommunikation-absender'
const APIKEY_STORAGE = 'sda-claude-api-key'
const SIG_SEP        = '\n\n--\n'

function loadAbsender() {
  try { return JSON.parse(localStorage.getItem(ABSENDER_KEY) ?? '[]') } catch { return [] }
}
function loadApiKey() { return (localStorage.getItem(APIKEY_STORAGE) ?? '').replace(/\s/g, '') }

async function sendViaSMTP({ to, from, subject, text, cc = '', account, attachments = [] }) {
  const res = await fetch('/api/send-email', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, from, subject, text, cc, account, attachments }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

async function callClaude(apiKey, systemPrompt, userText) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'x-api-key': apiKey,
      'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userText }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API: HTTP ${res.status}`)
  const data = await res.json()
  let raw = data.content?.[0]?.text ?? ''
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('Antwort konnte nicht verarbeitet werden.')
  return JSON.parse(m[0])
}

function fmtFileSize(b) {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

// ── Diktat-System-Prompt (speziell für Steuerberater-Mandantenpost) ────────────
function buildDiktatPrompt(auftragLabel, mandantName, anrede) {
  return `Du bist Steuerberater-Assistent. Du bekommst gesprochenen Text eines Steuerberaters – oft Stichpunkte, unfertige Gedanken oder eine Aufzählung von benötigten Unterlagen.

Aufgabe: Erstelle daraus eine vollständige, professionelle E-Mail auf Deutsch an den Mandanten "${mandantName || 'den Mandanten'}".

Kontext: Es geht um den Auftrag "${auftragLabel}".
Anrede: "${anrede || 'Sehr geehrte Damen und Herren,'}"
Grußformel: "Mit freundlichen Grüßen"

Regeln:
- Rückfragen/fehlende Unterlagen sauber nummeriert auflisten
- Professionell, höflich, klar – kein Kanzlei-Jargon
- Keine überflüssigen Floskeln
- Wenn der Sprecher sagt "Fahrzeugrechnung fehlt" → formuliere es als höfliche Bitte
- Betreff soll präzise und informativ sein

Antworte NUR mit einem JSON-Objekt, kein Text davor oder danach:
{"betreff":"...","text":"..."}`
}

// Prompt für nachträgliche Überarbeitung
function buildOptimierungsPrompt(anweisung) {
  return `Du bist Steuerberater-Assistent. Überarbeite die folgende E-Mail: ${anweisung}. Behalte Inhalt und Struktur bei, ändere nur Stil/Sprache/Ton. Antworte NUR mit JSON: {"betreff":"...","text":"..."}`
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function JAComposePanel({
  au, client,
  emailVorlagen   = [],
  emailSignaturen = [],
  onedriveTokens  = null,
  onUpdateOnedriveTokens,
  onUpdateClient,
  onClose,
}) {
  const absenderList = loadAbsender()

  const defaultTo    = (client.kontakte ?? []).find(k => k.email)?.email ?? ''
  const defaultFrom  = client.kommunikation?.standardAbsender
    ?? absenderList.find(a => a.isDefault)?.email
    ?? absenderList[0]?.email ?? ''
  const defaultSigId = client.kommunikation?.standardSignaturId
    ?? emailSignaturen.find(s => s.isDefault)?.id ?? ''
  const aktiveSig    = (id) => emailSignaturen.find(s => s.id === id)

  const auftragLabel = au.bezeichnung || `Jahresabschluss ${au.abschlussJahr ?? au.jahr ?? ''}`
  // Anrede aus Kontakten
  const anrede = (() => {
    const k = (client.kontakte ?? []).find(c => c.email === defaultTo) ?? (client.kontakte ?? [])[0]
    if (k?.name) return `Sehr geehrte/r ${k.name},`
    return 'Sehr geehrte Damen und Herren,'
  })()

  // ── States ─────────────────────────────────────────────────────────────────
  const [to,           setTo]           = useState(defaultTo)
  const [from,         setFrom]         = useState(defaultFrom)
  const [subject,      setSubject]      = useState('')
  const [body,         setBody]         = useState(() => {
    const sig = aktiveSig(defaultSigId)
    return sig ? SIG_SEP + sig.text : ''
  })
  const [sigId,        setSigId]        = useState(defaultSigId)
  const [attachments,  setAttachments]  = useState([])
  const [sending,      setSending]      = useState(false)
  const [sendMode,     setSendMode]     = useState('smtp')
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState(false)

  // Diktat-States
  const [isRecording,   setIsRecording]   = useState(false)
  const [transcript,    setTranscript]    = useState('')
  const [interimText,   setInterimText]   = useState('')
  const [kiLoading,     setKiLoading]     = useState(false)
  const [kiDone,        setKiDone]        = useState(false)  // E-Mail wurde einmal generiert
  const [optLoading,    setOptLoading]    = useState('')     // aktive Optimierungsaktion
  const recRef        = useRef(null)
  const transcriptRef = useRef('')
  const fileInputRef  = useRef(null)

  const SpeechRec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  const voiceOk   = !!SpeechRec

  // Transcript sync helper (Ref + State)
  function setTranscriptBoth(val) {
    const v = typeof val === 'function' ? val(transcriptRef.current) : val
    transcriptRef.current = v
    setTranscript(v)
  }

  // ── Diktat starten / stoppen ────────────────────────────────────────────────
  function toggleRecording() {
    if (isRecording) {
      recRef.current?.stop()
      setIsRecording(false)
      setInterimText('')
      // Automatisch KI starten wenn etwas erkannt wurde
      if (transcriptRef.current.trim()) generateFromDiktat(transcriptRef.current)
      return
    }
    if (!SpeechRec) { setError('Spracherkennung nicht verfügbar (Chrome empfohlen)'); return }
    const apiKey = loadApiKey()
    if (!apiKey) { setError('Claude API-Schlüssel fehlt (Stammdaten → ⚙️ → API-Schlüssel).'); return }

    setTranscriptBoth('')
    setInterimText('')
    setKiDone(false)
    setError('')

    const rec = new SpeechRec()
    rec.lang = 'de-DE'
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = e => {
      let fin = '', itr = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + ' '
        else itr += e.results[i][0].transcript
      }
      if (fin) setTranscriptBoth(t => t.trimEnd() ? t.trimEnd() + ' ' + fin : fin)
      setInterimText(itr)
    }
    rec.onend   = () => { setIsRecording(false); setInterimText('') }
    rec.onerror = () => { setIsRecording(false); setInterimText(''); setError('Mikrofon-Fehler.') }

    rec.start()
    recRef.current = rec
    setIsRecording(true)
  }

  // Aufräumen bei Unmount
  useEffect(() => () => recRef.current?.stop(), [])

  // ── KI: Diktat → E-Mail ─────────────────────────────────────────────────────
  async function generateFromDiktat(text) {
    const apiKey = loadApiKey()
    if (!apiKey || !text.trim()) return
    setKiLoading(true); setError('')
    try {
      const result = await callClaude(
        apiKey,
        buildDiktatPrompt(auftragLabel, client.name, anrede),
        text.trim()
      )
      const sig = aktiveSig(sigId)
      if (result.betreff) setSubject(result.betreff)
      if (result.text) setBody(result.text + (sig ? SIG_SEP + sig.text : ''))
      setKiDone(true)
    } catch (err) {
      setError('KI-Fehler: ' + err.message)
    } finally {
      setKiLoading(false)
    }
  }

  // ── KI: Nachträgliche Optimierung ──────────────────────────────────────────
  async function optimizeText(anweisung, key) {
    const apiKey = loadApiKey()
    if (!apiKey) return
    setOptLoading(key); setError('')
    try {
      const sepIdx = body.indexOf(SIG_SEP)
      const baseBody = sepIdx >= 0 ? body.slice(0, sepIdx) : body
      const result = await callClaude(
        apiKey,
        buildOptimierungsPrompt(anweisung),
        `Betreff: ${subject}\n\n${baseBody}`
      )
      const sig = aktiveSig(sigId)
      if (result.betreff) setSubject(result.betreff)
      if (result.text) setBody(result.text + (sig ? SIG_SEP + sig.text : ''))
    } catch (err) {
      setError('KI-Fehler: ' + err.message)
    } finally {
      setOptLoading('')
    }
  }

  // ── Vorlage / Signatur ──────────────────────────────────────────────────────
  function applyVorlage(vorlageId) {
    const v = emailVorlagen.find(v => v.id === vorlageId)
    if (!v) return
    setSubject(v.betreff ?? '')
    const sig = aktiveSig(sigId)
    setBody((v.text ?? '') + (sig ? SIG_SEP + sig.text : ''))
    setKiDone(false)
  }

  function handleSigChange(newSigId) {
    setSigId(newSigId)
    const newSig = aktiveSig(newSigId)
    const sepIdx = body.indexOf(SIG_SEP)
    const baseBody = sepIdx >= 0 ? body.slice(0, sepIdx) : body
    setBody(newSig ? baseBody + SIG_SEP + newSig.text : baseBody)
  }

  // ── Datei ───────────────────────────────────────────────────────────────────
  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.size > 4 * 1024 * 1024) { setError('Datei zu groß – max. 4 MB'); return }
    const reader = new FileReader()
    reader.onload = () => setAttachments(prev => [
      ...prev, { name: file.name, data: reader.result.split(',')[1], type: file.type || 'application/octet-stream', size: file.size },
    ])
    reader.readAsDataURL(file)
  }

  // ── Senden ──────────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!to.trim())      { setError('Empfänger fehlt.'); return }
    if (!subject.trim()) { setError('Betreff fehlt.'); return }
    setSending(true); setError('')
    const smtpAtts = attachments.map(a => ({ filename: a.name, content: a.data, contentType: a.type }))
    try {
      if (sendMode === 'outlook') {
        let tokens = onedriveTokens
        if (!tokens?.accessToken) { tokens = await openAuthPopup(); onUpdateOnedriveTokens?.(tokens) }
        await sendMailGraph({ to, subject, body, bodyType: 'Text', attachments: smtpAtts }, tokens, t => onUpdateOnedriveTokens?.(t))
      } else {
        const selectedAbs = absenderList.find(a => a.email === from)
        const account = selectedAbs?.konto ?? selectedAbs?.account ?? 'hostinger'
        await sendViaSMTP({ to, from, subject, text: body, cc: '', account, attachments: smtpAtts })
      }
      const komm   = client.kommunikation ?? { events: [] }
      const now    = new Date().toISOString()
      const newEvent = {
        id: 'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        typ: 'frei', status: 'gesendet', betreff: subject, text: body,
        empfaenger: to, absender: from || absenderList[0]?.email || '',
        cc: '', erstelltAm: now, gesendetAm: now,
        versandweg: sendMode === 'outlook' ? 'outlook' : 'smtp',
        auftragId: au.id,
        anlagen: attachments.map(a => ({ name: a.name, size: a.size, contentType: a.type })),
      }
      onUpdateClient({ kommunikation: { ...komm, events: [newEvent, ...(komm.events ?? [])] } })
      setSuccess(true)
      setTimeout(onClose, 1800)
    } catch (err) {
      setError('Senden fehlgeschlagen: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  const inputStyle = {
    padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '7px',
    background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px',
    outline: 'none', boxSizing: 'border-box',
  }

  // ── Optimierungs-Aktionen ───────────────────────────────────────────────────
  const OPT_ACTIONS = [
    { key: 'freundlicher', label: '😊 Freundlicher', anweisung: 'freundlicher, wärmer und weniger formell' },
    { key: 'kuerzer',      label: '✂️ Kürzer',       anweisung: 'deutlich kürzer und auf das Wesentliche reduziert' },
    { key: 'foermlicher',  label: '🎩 Förmlicher',   anweisung: 'förmlicher und professioneller' },
    { key: 'du',           label: 'Du-Form',          anweisung: 'komplett in der Du-Form (duzen)' },
    { key: 'sie',          label: 'Sie-Form',         anweisung: 'komplett in der Sie-Form (siezen)' },
    { key: 'daenisch',     label: '🇩🇰 Dänisch',      anweisung: 'ins Dänische übersetzt' },
    { key: 'englisch',     label: '🇬🇧 Englisch',     anweisung: 'ins Englische übersetzt' },
  ]

  if (success) return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
      <div style={{ fontWeight: 700, fontSize: '14px', color: '#16a34a' }}>E-Mail gesendet!</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
        Sie erscheint im Verlauf dieses Auftrags.
      </div>
    </div>
  )

  return (
    <div style={{ padding: '14px 16px', background: 'rgba(37,99,235,0.04)', borderRadius: '10px', border: '1px solid rgba(37,99,235,0.2)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '14px' }}>✉️</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--accent)' }}>Neue E-Mail</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>für: {auftragLabel}</div>
        </div>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1 }}>✕</button>
      </div>

      {/* ── 🎤 DIKTAT-BEREICH ── */}
      <div style={{
        marginBottom: '12px', padding: '12px 14px', borderRadius: '10px',
        background: isRecording ? 'rgba(239,68,68,0.06)' : kiLoading ? 'rgba(124,58,237,0.06)' : 'rgba(8,145,178,0.05)',
        border: `1px solid ${isRecording ? 'rgba(239,68,68,0.3)' : kiLoading ? 'rgba(124,58,237,0.25)' : 'rgba(8,145,178,0.2)'}`,
        transition: 'all 0.3s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: transcript || isRecording || kiLoading ? '10px' : '0' }}>
          {/* Diktat-Button */}
          <button
            onClick={toggleRecording}
            disabled={kiLoading || !voiceOk}
            title={voiceOk ? (isRecording ? 'Aufnahme stoppen' : 'Diktat starten') : 'Spracherkennung nicht verfügbar'}
            style={{
              width: '44px', height: '44px', borderRadius: '50%', border: 'none', flexShrink: 0,
              cursor: voiceOk ? 'pointer' : 'not-allowed',
              background: isRecording ? '#ef4444' : kiLoading ? '#7c3aed' : '#0891b2',
              color: '#fff', fontSize: '18px',
              boxShadow: isRecording ? '0 0 0 6px rgba(239,68,68,0.2)' : 'none',
              animation: isRecording ? 'pulseMic 1.2s ease-in-out infinite' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {isRecording ? '⏹' : kiLoading ? '⏳' : '🎤'}
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '12px', color: isRecording ? '#ef4444' : kiLoading ? '#7c3aed' : '#0891b2' }}>
              {isRecording ? '● Aufnahme läuft – sprechen Sie jetzt…' : kiLoading ? 'KI formuliert E-Mail…' : '🎤 Diktat / KI-Entwurf'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {isRecording
                ? 'Klicken zum Stoppen → E-Mail wird automatisch erstellt'
                : kiLoading
                  ? 'Rückfragen werden erkannt und professionell formuliert…'
                  : voiceOk
                    ? 'Klicken → Rückfragen / Unterlagen einfach sprechen → fertige E-Mail'
                    : 'Spracherkennung nicht verfügbar (Chrome empfohlen)'}
            </div>
          </div>

          {/* Manuell verarbeiten wenn Transcript vorhanden */}
          {transcript.trim() && !isRecording && !kiLoading && (
            <button
              onClick={() => generateFromDiktat(transcript)}
              style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: '#0891b2', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
            >
              ✨ Jetzt erstellen
            </button>
          )}
        </div>

        {/* Transcript-Anzeige */}
        {(transcript || isRecording) && (
          <div style={{
            padding: '8px 10px', borderRadius: '7px', background: 'var(--surface)',
            border: `1px solid ${isRecording ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
            fontSize: '12px', lineHeight: 1.6, color: 'var(--text)', minHeight: '40px', position: 'relative',
          }}>
            <span style={{ opacity: isRecording && !transcript ? 0.5 : 1 }}>
              {transcript || (isRecording ? '' : '(leer)')}
            </span>
            {interimText && (
              <span style={{ opacity: 0.5, fontStyle: 'italic', color: '#ef4444' }}>{transcript ? ' ' : ''}{interimText}</span>
            )}
            {!isRecording && transcript && (
              <button
                onClick={() => { setTranscriptBoth(''); setKiDone(false) }}
                style={{ position: 'absolute', top: '4px', right: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '0 2px' }}
                title="Löschen"
              >✕</button>
            )}
          </div>
        )}

        {/* Optimierungs-Aktionen (erscheinen nach erstem KI-Entwurf) */}
        {kiDone && !kiLoading && !isRecording && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              E-Mail anpassen:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {OPT_ACTIONS.map(a => (
                <button
                  key={a.key}
                  onClick={() => optimizeText(a.anweisung, a.key)}
                  disabled={!!optLoading}
                  style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
                    border: '1px solid var(--border)', background: optLoading === a.key ? 'var(--surface2)' : 'transparent',
                    color: optLoading === a.key ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: optLoading === a.key ? 700 : 400,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!optLoading) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' } }}
                  onMouseLeave={e => { if (!optLoading) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' } }}
                >
                  {optLoading === a.key ? '⏳' : a.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CSS für Diktat-Animation */}
      <style>{`
        @keyframes pulseMic {
          0%, 100% { box-shadow: 0 0 0 6px rgba(239,68,68,0.2); }
          50%       { box-shadow: 0 0 0 12px rgba(239,68,68,0.05); }
        }
      `}</style>

      {/* ── FORMULAR ── */}

      {/* Vorlage */}
      {emailVorlagen.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <select onChange={e => { if (e.target.value) applyVorlage(e.target.value); e.target.value = '' }} defaultValue=""
            style={{ ...inputStyle, width: '100%', fontSize: '11px' }}>
            <option value="">📄 Vorlage auswählen…</option>
            {emailVorlagen.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      )}

      {/* An */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>An</div>
        <input value={to} onChange={e => setTo(e.target.value)} placeholder="empfaenger@email.de" style={{ ...inputStyle, width: '100%' }} />
        {(client.kontakte ?? []).filter(k => k.email).map(k => (
          <button key={k.id} onClick={() => setTo(k.email)}
            style={{ fontSize: '10px', marginTop: '4px', marginRight: '4px', padding: '2px 8px', borderRadius: '8px', border: `1px solid ${to === k.email ? 'var(--accent)' : 'var(--border)'}`, background: to === k.email ? 'rgba(8,145,178,0.08)' : 'var(--surface)', cursor: 'pointer', color: to === k.email ? 'var(--accent)' : 'var(--text-muted)' }}>
            {k.name ? `${k.name} – ${k.email}` : k.email}
          </button>
        ))}
      </div>

      {/* Von */}
      {absenderList.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Von</div>
          <select value={from} onChange={e => setFrom(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
            <option value="">— Standard —</option>
            {absenderList.map((a, i) => <option key={i} value={a.email}>{a.name ? `${a.name} <${a.email}>` : a.email}</option>)}
          </select>
        </div>
      )}

      {/* Betreff */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Betreff</div>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Betreff…" style={{ ...inputStyle, width: '100%', fontWeight: 600 }} />
      </div>

      {/* Signatur + Anhang + Versandweg */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {emailSignaturen.length > 0 && (
          <select value={sigId} onChange={e => handleSigChange(e.target.value)}
            style={{ ...inputStyle, width: 'auto', fontSize: '11px', padding: '4px 8px' }}>
            <option value="">Ohne Signatur</option>
            {emailSignaturen.map(s => <option key={s.id} value={s.id}>✍️ {s.name}</option>)}
          </select>
        )}
        <label style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '11px', cursor: 'pointer', color: 'var(--text-muted)' }}>
          📎 Anhang
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFile} />
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          {['smtp', 'outlook'].map(mode => (
            <button key={mode} onClick={() => setSendMode(mode)}
              style={{ padding: '3px 9px', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', fontWeight: sendMode === mode ? 700 : 400, border: `1px solid ${sendMode === mode ? 'var(--accent)' : 'var(--border)'}`, background: sendMode === mode ? 'rgba(8,145,178,0.1)' : 'transparent', color: sendMode === mode ? 'var(--accent)' : 'var(--text-muted)' }}>
              {mode === 'smtp' ? 'SMTP' : '📧 Outlook'}
            </button>
          ))}
        </div>
      </div>

      {/* E-Mail-Text */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Text</div>
        <textarea value={body} onChange={e => setBody(e.target.value)}
          placeholder="E-Mail Text… (oder 🎤 Diktat verwenden)"
          rows={8} style={{ ...inputStyle, width: '100%', resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }} />
      </div>

      {/* Anhänge */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {attachments.map((a, i) => (
            <span key={i} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              📎 {a.name} <span style={{ color: 'var(--text-muted)' }}>({fmtFileSize(a.size)})</span>
              <button onClick={() => setAttachments(p => p.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '12px', padding: 0, lineHeight: 1 }}>✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Fehler */}
      {error && (
        <div style={{ fontSize: '11px', color: '#ef4444', marginBottom: '8px', padding: '7px 10px', background: 'rgba(239,68,68,0.06)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
          ⚠ {error}
        </div>
      )}

      {/* Senden */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleSend} disabled={sending || !to.trim() || !subject.trim()}
          style={{ flex: 1, padding: '9px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: (sending || !to.trim() || !subject.trim()) ? 0.6 : 1 }}>
          {sending ? '⏳ Wird gesendet…' : sendMode === 'outlook' ? '📧 Über Outlook senden' : '📤 Senden'}
        </button>
        <button onClick={onClose}
          style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer' }}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}
