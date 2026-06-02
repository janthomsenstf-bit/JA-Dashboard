/**
 * JAComposePanel – E-Mail-Compose direkt im Jahresabschlussauftrag.
 * Nutzt dieselbe Versand- und Signatur-Logik wie KommunikationTab.
 */
import { useState, useRef } from 'react'
import { sendMailGraph, openAuthPopup } from '../../utils/onedriveClient.js'

// ── Konstanten (identisch zu KommunikationTab) ─────────────────────────────────
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

async function callClaudeKI(apiKey, systemPrompt, userText) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1500, system: systemPrompt, messages: [{ role: 'user', content: userText }] }),
  })
  if (!res.ok) throw new Error(`Claude API: HTTP ${res.status}`)
  const data = await res.json()
  let raw = data.content?.[0]?.text ?? ''
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('Antwort konnte nicht verarbeitet werden.')
  return JSON.parse(m[0])
}

function fmtFileSize(bytes) {
  if (!bytes || bytes === 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function JAComposePanel({
  au,
  client,
  emailVorlagen   = [],
  emailSignaturen = [],
  onedriveTokens  = null,
  onUpdateOnedriveTokens,
  onUpdateClient,   // client-level onUpdate → speichert in client.kommunikation.events
  onClose,
}) {
  const absenderList = loadAbsender()

  // Defaults aus Stammdaten
  const defaultTo    = (client.kontakte ?? []).find(k => k.email)?.email ?? ''
  const defaultFrom  = client.kommunikation?.standardAbsender
    ?? absenderList.find(a => a.isDefault)?.email
    ?? absenderList[0]?.email ?? ''
  const defaultSigId = client.kommunikation?.standardSignaturId
    ?? emailSignaturen.find(s => s.isDefault)?.id ?? ''

  const aktiveSig = (sigId) => emailSignaturen.find(s => s.id === sigId)

  const [to,          setTo]          = useState(defaultTo)
  const [from,        setFrom]        = useState(defaultFrom)
  const [subject,     setSubject]     = useState('')
  const [body,        setBody]        = useState(() => {
    const sig = emailSignaturen.find(s => s.id === defaultSigId)
    return sig ? SIG_SEP + sig.text : ''
  })
  const [sigId,       setSigId]       = useState(defaultSigId)
  const [attachments, setAttachments] = useState([])
  const [sending,     setSending]     = useState(false)
  const [sendMode,    setSendMode]    = useState('smtp')   // 'smtp' | 'outlook'
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState(false)
  const [kiLoading,   setKiLoading]   = useState(false)
  const [kiPrompt,    setKiPrompt]    = useState('')
  const [showKiInput, setShowKiInput] = useState(false)
  const fileInputRef = useRef(null)

  const auftragLabel = au.bezeichnung || `Jahresabschluss ${au.abschlussJahr ?? au.jahr ?? ''}`

  // ── Vorlage anwenden ────────────────────────────────────────────────────────
  function applyVorlage(vorlageId) {
    const v = emailVorlagen.find(v => v.id === vorlageId)
    if (!v) return
    setSubject(v.betreff ?? '')
    const sig = aktiveSig(sigId)
    setBody((v.text ?? '') + (sig ? SIG_SEP + sig.text : ''))
  }

  // ── Signatur wechseln ───────────────────────────────────────────────────────
  function handleSigChange(newSigId) {
    setSigId(newSigId)
    const newSig = aktiveSig(newSigId)
    const sepIdx = body.indexOf(SIG_SEP)
    const baseBody = sepIdx >= 0 ? body.slice(0, sepIdx) : body
    setBody(newSig ? baseBody + SIG_SEP + newSig.text : baseBody)
  }

  // ── Datei anhängen ──────────────────────────────────────────────────────────
  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.size > 4 * 1024 * 1024) { setError('Datei zu groß – max. 4 MB'); return }
    const reader = new FileReader()
    reader.onload = () => setAttachments(prev => [
      ...prev,
      { name: file.name, data: reader.result.split(',')[1], type: file.type || 'application/octet-stream', size: file.size },
    ])
    reader.readAsDataURL(file)
  }

  // ── Senden ──────────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!to.trim())      { setError('Empfänger fehlt.'); return }
    if (!subject.trim()) { setError('Betreff fehlt.'); return }
    setSending(true); setError('')

    const smtpAttachments = attachments.map(a => ({ filename: a.name, content: a.data, contentType: a.type }))

    try {
      if (sendMode === 'outlook') {
        let tokens = onedriveTokens
        if (!tokens?.accessToken) {
          tokens = await openAuthPopup()
          onUpdateOnedriveTokens?.(tokens)
        }
        await sendMailGraph(
          { to, subject, body, bodyType: 'Text', attachments: smtpAttachments },
          tokens, (t) => onUpdateOnedriveTokens?.(t)
        )
      } else {
        const selectedAbs = absenderList.find(a => a.email === from)
        const account = selectedAbs?.konto ?? selectedAbs?.account ?? 'hostinger'
        await sendViaSMTP({ to, from, subject, text: body, cc: '', account, attachments: smtpAttachments })
      }

      // Ereignis in client.kommunikation.events speichern (mit auftragId)
      const komm = client.kommunikation ?? { events: [] }
      const now  = new Date().toISOString()
      const newEvent = {
        id:          'ev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        typ:         'frei',
        status:      'gesendet',
        betreff:     subject,
        text:        body,
        empfaenger:  to,
        absender:    from || absenderList[0]?.email || '',
        cc:          '',
        erstelltAm:  now,
        gesendetAm:  now,
        versandweg:  sendMode === 'outlook' ? 'outlook' : 'smtp',
        auftragId:   au.id,   // ← Verknüpfung zum Auftrag
        anlagen:     attachments.map(a => ({ name: a.name, size: a.size, contentType: a.type })),
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

  // ── KI-Entwurf ──────────────────────────────────────────────────────────────
  async function handleKI() {
    const apiKey = loadApiKey()
    if (!apiKey) { setError('Claude API-Schlüssel nicht hinterlegt (Stammdaten → ⚙️ → API-Schlüssel).'); return }
    setKiLoading(true); setError('')
    try {
      const systemPrompt = `Du bist ein professioneller Steuerberater-Assistent. Formuliere eine professionelle, höfliche E-Mail auf Deutsch für den Auftrag "${auftragLabel}". Antworte NUR mit JSON: {"betreff":"...","text":"..."}`
      const userText = kiPrompt.trim() || `Erstelle eine allgemeine Statusmail zum Auftrag "${auftragLabel}".`
      const result = await callClaudeKI(apiKey, systemPrompt, userText)
      if (result.betreff) setSubject(result.betreff)
      if (result.text) {
        const sig = aktiveSig(sigId)
        setBody(result.text + (sig ? SIG_SEP + sig.text : ''))
      }
      setShowKiInput(false); setKiPrompt('')
    } catch (err) {
      setError('KI-Fehler: ' + err.message)
    } finally {
      setKiLoading(false)
    }
  }

  const inputStyle = {
    padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '7px',
    background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px',
    outline: 'none', boxSizing: 'border-box',
  }

  // ── Erfolgsmeldung ──────────────────────────────────────────────────────────
  if (success) return (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
      <div style={{ fontWeight: 700, fontSize: '14px', color: '#16a34a' }}>E-Mail gesendet!</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Wird im Verlauf dieses Auftrags angezeigt.</div>
    </div>
  )

  return (
    <div style={{ padding: '14px 16px', background: 'rgba(37,99,235,0.04)', borderRadius: '10px', border: '1px solid rgba(37,99,235,0.2)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '14px' }}>✉️</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--accent)' }}>Neue E-Mail</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>für Auftrag: {auftragLabel}</div>
        </div>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1 }}>✕</button>
      </div>

      {/* Vorlage auswählen */}
      {emailVorlagen.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
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
        {/* Kontakt-Schnellauswahl */}
        {(client.kontakte ?? []).filter(k => k.email).map(k => (
          <button key={k.id} onClick={() => setTo(k.email)}
            style={{ fontSize: '10px', marginTop: '4px', marginRight: '4px', padding: '2px 8px', borderRadius: '8px', border: `1px solid ${to === k.email ? 'var(--accent)' : 'var(--border)'}`, background: to === k.email ? 'rgba(8,145,178,0.08)' : 'var(--surface)', cursor: 'pointer', color: to === k.email ? 'var(--accent)' : 'var(--text-muted)' }}>
            {k.name ? `${k.name} – ${k.email}` : k.email}
          </button>
        ))}
      </div>

      {/* Von */}
      {(absenderList.length > 0 || from) && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Von</div>
          {absenderList.length > 0 ? (
            <select value={from} onChange={e => setFrom(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
              <option value="">— Standard —</option>
              {absenderList.map((a, i) => <option key={i} value={a.email}>{a.name ? `${a.name} <${a.email}>` : a.email}</option>)}
            </select>
          ) : (
            <input value={from} onChange={e => setFrom(e.target.value)} placeholder="absender@kanzlei.de" style={{ ...inputStyle, width: '100%' }} />
          )}
        </div>
      )}

      {/* Betreff */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Betreff</div>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Betreff…"
          style={{ ...inputStyle, width: '100%', fontWeight: 600 }} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Signatur */}
        {emailSignaturen.length > 0 && (
          <select value={sigId} onChange={e => handleSigChange(e.target.value)}
            style={{ ...inputStyle, width: 'auto', fontSize: '11px', padding: '4px 8px' }}>
            <option value="">Ohne Signatur</option>
            {emailSignaturen.map(s => <option key={s.id} value={s.id}>✍️ {s.name}</option>)}
          </select>
        )}
        {/* KI */}
        <button onClick={() => setShowKiInput(v => !v)}
          style={{ padding: '4px 10px', borderRadius: '6px', border: `1px solid ${showKiInput ? 'rgba(124,58,237,0.5)' : 'rgba(124,58,237,0.25)'}`, background: showKiInput ? 'rgba(124,58,237,0.1)' : 'rgba(124,58,237,0.05)', color: '#7c3aed', fontSize: '11px', cursor: 'pointer', fontWeight: showKiInput ? 700 : 400 }}>
          ✨ KI-Entwurf
        </button>
        {/* Anhang */}
        <label style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '11px', cursor: 'pointer', color: 'var(--text-muted)' }}>
          📎 Anhang
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFile} />
        </label>
        {/* Versandweg */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          {['smtp', 'outlook'].map(mode => (
            <button key={mode} onClick={() => setSendMode(mode)}
              style={{ padding: '3px 9px', borderRadius: '6px', fontSize: '10px', cursor: 'pointer', fontWeight: sendMode === mode ? 700 : 400, border: `1px solid ${sendMode === mode ? 'var(--accent)' : 'var(--border)'}`, background: sendMode === mode ? 'rgba(8,145,178,0.1)' : 'transparent', color: sendMode === mode ? 'var(--accent)' : 'var(--text-muted)' }}>
              {mode === 'smtp' ? 'SMTP' : '📧 Outlook'}
            </button>
          ))}
        </div>
      </div>

      {/* KI-Prompt-Eingabe */}
      {showKiInput && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', padding: '8px 10px', background: 'rgba(124,58,237,0.06)', borderRadius: '8px', border: '1px solid rgba(124,58,237,0.2)' }}>
          <input value={kiPrompt} onChange={e => setKiPrompt(e.target.value)}
            placeholder={`z. B. „Rückfragen zum ${auftragLabel} freundlich anfragen"…`}
            style={{ ...inputStyle, flex: 1, fontSize: '11px' }}
            onKeyDown={e => e.key === 'Enter' && handleKI()} />
          <button onClick={handleKI} disabled={kiLoading}
            style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: '#7c3aed', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
            {kiLoading ? '⏳' : '→'}
          </button>
        </div>
      )}

      {/* E-Mail-Text */}
      <div style={{ marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Text</div>
        <textarea value={body} onChange={e => setBody(e.target.value)}
          placeholder="E-Mail Text…" rows={7}
          style={{ ...inputStyle, width: '100%', resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }} />
      </div>

      {/* Anhänge-Liste */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {attachments.map((a, i) => (
            <span key={i} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              📎 {a.name} <span style={{ color: 'var(--text-muted)' }}>({fmtFileSize(a.size)})</span>
              <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
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

      {/* Aktionen */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleSend} disabled={sending || !to.trim() || !subject.trim()}
          style={{ flex: 1, padding: '9px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: (sending || !to.trim() || !subject.trim()) ? 0.6 : 1 }}>
          {sending ? '⏳ Wird gesendet…' : (sendMode === 'outlook' ? '📧 Über Outlook senden' : '📤 Senden')}
        </button>
        <button onClick={onClose}
          style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer' }}>
          Abbrechen
        </button>
      </div>
    </div>
  )
}
