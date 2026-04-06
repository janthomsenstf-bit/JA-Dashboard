import { useState, useRef, useEffect } from 'react'
import { generateAIResponse } from '../../utils/aiResponses.js'

const API_KEY_STORAGE = 'spielbuch-claude-key'
const CLAUDE_MODEL    = 'claude-opus-4-5'

const QUICK_PROMPTS = [
  { label: '📅 Abgabefristen',   prompt: '[__Abgabefristen]' },
  { label: '📊 Fallstatus',      prompt: '[__Fallstatus]' },
  { label: '☑️ Checkliste',      prompt: '[__Checkliste]' },
  { label: '⚖️ EÜR vs. Bilanz',  prompt: '[__EuR_Bilanz]' },
  { label: '🔔 Erinnerungsplan', prompt: '[__Erinnerungsplan]' },
]

const PROMPT_KEY_MAP = {
  '[__Abgabefristen]':    '[__abgabefristen]',
  '[__Fallstatus]':       '[__fallstatus]',
  '[__Checkliste]':       '[__checkliste]',
  '[__EuR_Bilanz]':       '[__eur_bilanz]',
  '[__Erinnerungsplan]':  '[__erinnerungsplan]',
}

function RichText({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <span style={{ whiteSpace: 'pre-wrap' }}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>
        return part
      })}
    </span>
  )
}

function buildSystemPrompt(client) {
  const rqOpen = client.rueckfragen.filter(r => !r.beantwortet).map(r => `- ${r.text}`).join('\n') || 'keine'
  return `Du bist ein Steuerberater-Assistent. Dir liegen folgende Falldaten vor:

Mandant: ${client.name}
Rechtsform: ${client.rechtsform}
Gewinnermittlung: ${client.gewinnermittlung}
Veranlagungsjahr: ${client.veranlagungsjahr}
Status: ${client.inBearbeitung ? 'In Bearbeitung' : 'Erfasst'}
Offene Rückfragen:
${rqOpen}

Antworte auf Deutsch, präzise und praxisbezogen. Wenn du steuerrechtliche Empfehlungen gibst, weise darauf hin, dass dies keine verbindliche Rechtsberatung ist.`
}

export default function AITab({ client }) {
  const [apiKey, setApiKey]         = useState(() => localStorage.getItem(API_KEY_STORAGE) ?? '')
  const [keyInput, setKeyInput]     = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [messages, setMessages]     = useState([
    {
      role: 'assistant',
      text: `Guten Tag! Ich bin Ihr KI-Assistent für steuerliche Fragen.\n\nIch habe Zugriff auf die Fallakte von **${client.name}** und kann Ihnen mit Auskünften zu Abgabefristen, Checklisten, Gewinnermittlungsarten und mehr behilflich sein.\n\n${apiKey ? '🔗 Verbunden mit Claude (Anthropic API)' : '⚠️ Kein API-Schlüssel – nutze lokale Antworten. Klicken Sie auf „🔑 API-Key" um Claude zu verbinden.'}`,
    },
  ])
  const [input, setInput]           = useState('')
  const [isTyping, setIsTyping]     = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking]   = useState(false)
  const [apiError, setApiError]       = useState('')
  const chatRef  = useRef(null)
  const recogRef = useRef(null)

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages, isTyping])

  useEffect(() => {
    return () => { if (window.speechSynthesis) window.speechSynthesis.cancel() }
  }, [])

  function saveApiKey() {
    const key = keyInput.trim()
    if (!key) return
    localStorage.setItem(API_KEY_STORAGE, key)
    setApiKey(key)
    setKeyInput('')
    setShowKeyInput(false)
    setApiError('')
    setMessages(prev => [...prev, {
      role: 'assistant',
      text: '✅ API-Schlüssel gespeichert. Ab jetzt antwortet Claude direkt.',
    }])
  }

  function removeApiKey() {
    localStorage.removeItem(API_KEY_STORAGE)
    setApiKey('')
    setApiError('')
  }

  async function sendWithClaude(text, displayText) {
    // Build conversation history (last 20 messages)
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-20)
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.text }))

    history.push({ role: 'user', content: text })

    try {
      const res = await fetch('/api/claude/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':     'application/json',
          'x-api-key':        apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      CLAUDE_MODEL,
          max_tokens: 1024,
          system:     buildSystemPrompt(client),
          messages:   history,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
      }

      const data = await res.json()
      return data.content?.[0]?.text ?? '(Keine Antwort erhalten)'
    } catch (err) {
      throw err
    }
  }

  async function sendMessage(rawText) {
    const text = rawText.trim()
    if (!text || isTyping) return

    const displayText = QUICK_PROMPTS.find(p => p.prompt === rawText)?.label?.replace(/^[^\s]+ /, '') ?? text

    setMessages(prev => [...prev, { role: 'user', text: displayText }])
    setInput('')
    setIsTyping(true)
    setApiError('')

    if (apiKey) {
      // Claude API mode
      try {
        const response = await sendWithClaude(text, displayText)
        setMessages(prev => [...prev, { role: 'assistant', text: response }])
        speakText(response)
      } catch (err) {
        const errMsg = `⚠️ API-Fehler: ${err.message}`
        setApiError(errMsg)
        setMessages(prev => [...prev, { role: 'assistant', text: errMsg }])
      }
    } else {
      // Lokaler Fallback
      setTimeout(() => {
        const internalKey = PROMPT_KEY_MAP[rawText] ?? text
        const response = generateAIResponse(internalKey, client)
        setMessages(prev => [...prev, { role: 'assistant', text: response }])
        speakText(response)
      }, 600 + Math.random() * 400)
    }

    setIsTyping(false)
  }

  // ── TTS ───────────────────────────────────────────────────────────────────────
  function speakText(text) {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const clean = text.replace(/\*\*/g, '').replace(/^#+\s/gm, '').replace(/[📅📊☑️⚖️🔔⏰🚨✅📤✍️⚠️]/gu, '')
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.lang = 'de-DE'
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend   = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }

  // ── Spracherkennung ───────────────────────────────────────────────────────────
  function toggleMic() {
    if (isListening) { stopListening(); return }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { alert('Spracherkennung wird nicht unterstützt.'); return }
    const recog = new SpeechRecognition()
    recog.lang = 'de-DE'
    recog.continuous = false
    recog.interimResults = false
    recog.onresult = (e) => { setInput(e.results[0][0].transcript); setIsListening(false) }
    recog.onerror  = () => setIsListening(false)
    recog.onend    = () => setIsListening(false)
    recogRef.current = recog
    recog.start()
    setIsListening(true)
  }

  function stopListening() {
    recogRef.current?.stop()
    recogRef.current = null
    setIsListening(false)
  }

  return (
    <div className="tab-content">
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '12px',
      }}>

        {/* API Key Banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{
            flex: 1, fontSize: '12px', padding: '6px 10px',
            background: apiKey ? 'var(--green-dim)' : 'var(--surface2)',
            border: `1px solid ${apiKey ? 'var(--green)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)', color: apiKey ? '#86efac' : 'var(--text-muted)',
          }}>
            {apiKey
              ? `🔗 Claude API aktiv (${CLAUDE_MODEL})`
              : '⚠️ Kein API-Schlüssel – lokale Antworten aktiv'}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowKeyInput(v => !v)}
            style={{ fontSize: '11px' }}
          >
            🔑 API-Key
          </button>
          {apiKey && (
            <button className="btn btn-ghost btn-sm" onClick={removeApiKey} style={{ fontSize: '11px', color: 'var(--red)' }}>
              Entfernen
            </button>
          )}
        </div>

        {/* API Key Input (eingeklappt) */}
        {showKeyInput && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="password"
              placeholder="sk-ant-api03-…  (wird nur lokal gespeichert)"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveApiKey()}
              style={{ flex: 1, fontSize: '12px', fontFamily: 'var(--font-mono)' }}
            />
            <button className="btn btn-primary btn-sm" onClick={saveApiKey}>Speichern</button>
          </div>
        )}

        {/* Quick prompts */}
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Quick-Prompts
          </div>
          <div className="ai-quick-prompts">
            {QUICK_PROMPTS.map(qp => (
              <button
                key={qp.prompt}
                className="ai-quick-btn"
                onClick={() => sendMessage(qp.prompt)}
                disabled={isTyping}
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chat window */}
        <div className="ai-chat-window" ref={chatRef}>
          {messages.map((msg, i) => (
            <div key={i} className={`ai-message ${msg.role}`}>
              <div className="ai-msg-avatar">{msg.role === 'assistant' ? '🤖' : '👤'}</div>
              <div className="ai-msg-bubble"><RichText text={msg.text} /></div>
            </div>
          ))}
          {isTyping && (
            <div className="ai-message assistant">
              <div className="ai-msg-avatar">🤖</div>
              <div className="ai-msg-bubble">
                <div className="typing-dots">
                  <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                </div>
              </div>
            </div>
          )}
        </div>

        {isSpeaking && (
          <div className="tts-bar">
            <span>🔊 Sprachausgabe läuft…</span>
            <button className="btn-stop-tts" onClick={stopSpeaking}>⏹ Stopp</button>
          </div>
        )}

        {/* Input */}
        <div className="ai-input-row">
          <input
            type="text"
            placeholder="Frage eingeben… (Enter zum Senden)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            disabled={isTyping}
          />
          <button className={`btn-mic${isListening ? ' active' : ''}`} onClick={toggleMic} title={isListening ? 'Stoppen' : 'Spracheingabe'}>
            {isListening ? '⏹' : '🎤'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping} style={{ flexShrink: 0 }}>
            ➤
          </button>
        </div>

        {isListening && (
          <div style={{ fontSize: '12px', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ animation: 'blink 0.8s ease infinite', display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--red)' }} />
            Aufnahme läuft – sprechen Sie jetzt…
          </div>
        )}
      </div>
    </div>
  )
}
