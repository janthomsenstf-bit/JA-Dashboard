import { useState, useRef, useEffect, useCallback } from 'react'
import { runAgent } from '../../utils/agentClient.js'
import SkillEditor from './SkillEditor.jsx'

/**
 * AgentBereich – die Agenten-Startseite („Co-Trainer").
 *
 * Ein schlankes Chatfenster im Stil der Claude-Web-App: Eingabefeld mit Mikrofon,
 * darüber eine Leiste eigener Skills. Der Agent nutzt rein lesende Werkzeuge
 * (Stand der Arbeit, Rückfragen, E-Mails, Checklisten) und kann Mail-Entwürfe
 * vorschlagen – gesendet wird nur per Knopf des Nutzers.
 *
 * Props:
 *   clients            – Mandanten (rein lesend)
 *   skills, onSkillsChange – Skill-Liste + Setter (cloud-persistent über App)
 *   claudeApiKey       – zum Prüfen, ob ein Schlüssel hinterlegt ist
 *   offenerMandantName – optionaler Kontext
 *   onOeffneMandant    – (id, tab) => void, um aus einem Entwurf zum Mandanten zu springen
 */
export default function AgentBereich({ clients = [], skills = [], onSkillsChange, claudeApiKey, offenerMandantName, onOeffneMandant }) {
  const [chat, setChat]           = useState([])   // Anzeige: {rolle, text, entwurf?, werkzeuge?}
  const [verlauf, setVerlauf]     = useState([])   // Anthropic-Format für die API
  const [input, setInput]         = useState('')
  const [aktiverSkill, setAktiverSkill] = useState(null)
  const [laeuft, setLaeuft]       = useState(false)
  const [fehler, setFehler]       = useState('')
  const [hoert, setHoert]         = useState(false)
  const [editorOffen, setEditorOffen] = useState(false)
  const [editSkill, setEditSkill] = useState(null)

  const scrollRef = useRef(null)
  const recognitionRef = useRef(null)
  const inputRef = useRef(null)

  const hatKey = !!(claudeApiKey && String(claudeApiKey).trim())
  const spracheVerfuegbar = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chat, laeuft])

  // ── Spracheingabe (Web Speech API) ────────────────────────────────────────────
  const toggleMikro = useCallback(() => {
    if (!spracheVerfuegbar) return
    if (hoert) { recognitionRef.current?.stop(); return }
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new Rec()
    rec.lang = 'de-DE'
    rec.interimResults = true
    rec.continuous = false
    let finalText = ''
    rec.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t
        else interim += t
      }
      setInput((finalText + interim).trimStart())
    }
    rec.onerror = () => setHoert(false)
    rec.onend = () => { setHoert(false); inputRef.current?.focus() }
    recognitionRef.current = rec
    setHoert(true)
    rec.start()
  }, [hoert, spracheVerfuegbar])

  useEffect(() => () => { try { recognitionRef.current?.stop() } catch {} }, [])

  // ── Senden ────────────────────────────────────────────────────────────────────
  async function senden() {
    const text = input.trim()
    if (!text || laeuft) return
    if (!hatKey) { setFehler('Es ist kein Claude-Schlüssel hinterlegt (Stammdaten → ⚙️ → API-Schlüssel).'); return }
    setFehler('')
    if (hoert) { try { recognitionRef.current?.stop() } catch {} }

    const nutzerMsg = { role: 'user', content: text }
    setChat(prev => [...prev, { rolle: 'nutzer', text }])
    setInput('')
    setLaeuft(true)

    const werkzeugeGenutzt = []
    try {
      const res = await runAgent({
        messages: [...verlauf, nutzerMsg],
        skill: aktiverSkill,
        clients,
        offenerMandantName,
        onEvent: (ev) => { if (ev.typ === 'werkzeug') werkzeugeGenutzt.push(ev.name) },
      })
      setVerlauf(res.messages)
      setChat(prev => [...prev, { rolle: 'agent', text: res.text, entwurf: res.entwurf, werkzeuge: werkzeugeGenutzt }])
    } catch (e) {
      setChat(prev => [...prev, { rolle: 'agent', text: '', fehler: e?.message ?? String(e) }])
    } finally {
      setLaeuft(false)
    }
  }

  function neuerChat() {
    setChat([]); setVerlauf([]); setAktiverSkill(null); setFehler('')
  }

  // ── Skills ──────────────────────────────────────────────────────────────────
  function skillWaehlen(skill) {
    setAktiverSkill(prev => prev?.id === skill.id ? null : skill)
    inputRef.current?.focus()
  }
  function skillSpeichern(skill) {
    const existiert = skills.some(s => s.id === skill.id)
    onSkillsChange?.(existiert ? skills.map(s => s.id === skill.id ? skill : s) : [...skills, skill])
    setEditorOffen(false); setEditSkill(null)
  }
  function skillLoeschen(id) {
    onSkillsChange?.(skills.filter(s => s.id !== id))
    if (aktiverSkill?.id === id) setAktiverSkill(null)
    setEditorOffen(false); setEditSkill(null)
  }

  const platzhalter = aktiverSkill
    ? (aktiverSkill.brauchtMandant ? `${aktiverSkill.name}: für welchen Mandanten?` : `${aktiverSkill.name}: …`)
    : 'Frag deinen Co-Trainer … z. B. „Stand der Arbeiten bei Carola Klimek?“'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', minHeight: 0 }}>
      {/* Kopf */}
      <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <span style={{ fontSize: '22px' }} aria-hidden="true">🧭</span>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Co-Trainer</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Frag dein Spielbuch – per Text oder Sprache</div>
            </div>
          </div>
          {chat.length > 0 && (
            <button onClick={neuerChat} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '7px 13px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer' }}>
              Neuer Chat
            </button>
          )}
        </div>

        {/* Skill-Leiste */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginTop: '13px' }}>
          {skills.map(s => {
            const aktiv = aktiverSkill?.id === s.id
            return (
              <button
                key={s.id}
                onClick={() => skillWaehlen(s)}
                onDoubleClick={() => { setEditSkill(s); setEditorOffen(true) }}
                title={(s.beschreibung || '') + '  ·  Doppelklick: bearbeiten'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '7px 12px', borderRadius: '999px', cursor: 'pointer', fontSize: '12.5px',
                  border: '1px solid', borderColor: aktiv ? 'var(--accent)' : 'var(--border)',
                  background: aktiv ? 'var(--accent-dim)' : 'var(--surface)',
                  color: aktiv ? 'var(--accent-hover)' : 'var(--text-secondary)',
                  fontWeight: aktiv ? 700 : 500,
                }}
              >
                <span aria-hidden="true">{s.icon}</span>{s.name}
              </button>
            )
          })}
          <button
            onClick={() => { setEditSkill(null); setEditorOffen(true) }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '999px', cursor: 'pointer', fontSize: '12.5px', border: '1px dashed var(--border2)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 600 }}
          >
            + Skill anlegen
          </button>
        </div>
      </div>

      {/* Verlauf */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', minHeight: 0 }}>
        {chat.length === 0 && !laeuft && (
          <LeererZustand hatKey={hatKey} onBeispiel={(t) => { setInput(t); inputRef.current?.focus() }} />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '760px', margin: '0 auto' }}>
          {chat.map((m, i) => <Nachricht key={i} m={m} onOeffneMandant={onOeffneMandant} />)}
          {laeuft && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
              <span className="spin" style={{ width: '13px', height: '13px', border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              Co-Trainer schaut nach …
            </div>
          )}
        </div>
      </div>

      {/* Eingabe */}
      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', padding: '12px 20px 16px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          {fehler && <div style={{ color: 'var(--red)', fontSize: '12px', marginBottom: '8px' }}>{fehler}</div>}
          {aktiverSkill && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginBottom: '8px', padding: '4px 10px', borderRadius: '999px', background: 'var(--accent-dim)', color: 'var(--accent-hover)', fontSize: '12px', fontWeight: 700 }}>
              <span aria-hidden="true">{aktiverSkill.icon}</span>{aktiverSkill.name}
              <button onClick={() => setAktiverSkill(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '14px', lineHeight: 1 }} aria-label="Skill abwählen">×</button>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '9px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 8px 8px 14px' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); senden() } }}
              placeholder={platzhalter}
              rows={1}
              style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontSize: '14px', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: '140px', padding: '5px 0' }}
            />
            {spracheVerfuegbar && (
              <button
                onClick={toggleMikro}
                title={hoert ? 'Aufnahme stoppen' : 'Spracheingabe'}
                aria-label="Spracheingabe"
                style={{ flexShrink: 0, width: '38px', height: '38px', borderRadius: '10px', cursor: 'pointer', border: '1px solid', borderColor: hoert ? 'var(--red)' : 'var(--border)', background: hoert ? 'var(--red-dim)' : 'var(--surface)', color: hoert ? 'var(--red)' : 'var(--text-secondary)', fontSize: '17px' }}
              >
                {hoert ? '⏹' : '🎙'}
              </button>
            )}
            <button
              onClick={senden}
              disabled={!input.trim() || laeuft}
              aria-label="Senden"
              style={{ flexShrink: 0, width: '38px', height: '38px', borderRadius: '10px', cursor: (!input.trim() || laeuft) ? 'default' : 'pointer', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', fontSize: '16px', opacity: (!input.trim() || laeuft) ? 0.5 : 1 }}
            >
              ↑
            </button>
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '7px', textAlign: 'center' }}>
            Der Co-Trainer liest nur – er verändert und sendet nichts von allein. Enter sendet, Shift+Enter für Zeilenumbruch.
          </div>
        </div>
      </div>

      {editorOffen && (
        <SkillEditor
          skill={editSkill}
          onSave={skillSpeichern}
          onDelete={skillLoeschen}
          onClose={() => { setEditorOffen(false); setEditSkill(null) }}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── Einzelne Nachricht ──────────────────────────────────────────────────────────
function Nachricht({ m, onOeffneMandant }) {
  const istNutzer = m.rolle === 'nutzer'
  return (
    <div style={{ alignSelf: istNutzer ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
      <div style={{
        padding: '10px 14px', borderRadius: 'var(--radius)', fontSize: '13.5px', lineHeight: 1.6, whiteSpace: 'pre-wrap',
        background: istNutzer ? 'var(--accent)' : 'var(--surface)',
        color: istNutzer ? '#fff' : 'var(--text)',
        border: istNutzer ? '1px solid var(--accent)' : '1px solid var(--border)',
        borderBottomRightRadius: istNutzer ? '4px' : 'var(--radius)',
        borderBottomLeftRadius: istNutzer ? 'var(--radius)' : '4px',
      }}>
        {m.fehler
          ? <span style={{ color: 'var(--red)' }}>⚠ {m.fehler}</span>
          : (m.text || '—')}
      </div>

      {m.entwurf && <EntwurfKarte entwurf={m.entwurf} onOeffneMandant={onOeffneMandant} />}

      {!istNutzer && Array.isArray(m.werkzeuge) && m.werkzeuge.length > 0 && (
        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '5px' }}>
          Nachgeschaut mit: {[...new Set(m.werkzeuge)].join(', ')}
        </div>
      )}
    </div>
  )
}

// ── Mail-Entwurf-Vorschau (Senden nur manuell) ─────────────────────────────────
function EntwurfKarte({ entwurf, onOeffneMandant }) {
  const [kopiert, setKopiert] = useState(false)
  function kopieren() {
    const t = `Betreff: ${entwurf.betreff}\n\n${entwurf.text}`
    navigator.clipboard?.writeText(t).then(() => { setKopiert(true); setTimeout(() => setKopiert(false), 2000) }).catch(() => {})
  }
  return (
    <div style={{ marginTop: '9px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ padding: '9px 13px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '7px' }}>
        <span aria-hidden="true">📝</span> E-Mail-Entwurf {entwurf.mandantName ? `· ${entwurf.mandantName}` : ''}
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '7px' }}>{entwurf.betreff || '(kein Betreff)'}</div>
        <div style={{ fontSize: '13px', color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{entwurf.text}</div>
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
        <button onClick={kopieren} style={{ background: 'var(--accent)', border: '1px solid var(--accent)', color: '#fff', padding: '7px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
          {kopiert ? '✓ Kopiert' : 'Text kopieren'}
        </button>
        {entwurf.mandantId && onOeffneMandant && (
          <button onClick={() => onOeffneMandant(entwurf.mandantId, 'nachrichten')} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer' }}>
            Beim Mandanten öffnen
          </button>
        )}
        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Senden entscheidest du selbst.</span>
      </div>
    </div>
  )
}

// ── Leerer Zustand ──────────────────────────────────────────────────────────────
function LeererZustand({ hatKey, onBeispiel }) {
  const beispiele = [
    'Stand der Arbeiten bei Carola Klimek?',
    'Welche offenen Rückfragen habe ich bei …?',
    'Fasse die letzten Mails von … zusammen.',
    'Formulier eine Mail an … wegen der fehlenden Belege.',
  ]
  return (
    <div style={{ maxWidth: '560px', margin: '6vh auto 0', textAlign: 'center' }}>
      <div style={{ fontSize: '34px', marginBottom: '10px' }} aria-hidden="true">🧭</div>
      <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', marginBottom: '6px' }}>Wie kann ich helfen?</div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: 1.6 }}>
        Wähle oben einen Skill oder frag einfach los – per Text oder über das Mikrofon.
      </div>
      {!hatKey && (
        <div style={{ fontSize: '12px', color: 'var(--yellow)', background: 'var(--yellow-dim)', border: '1px solid var(--yellow)', borderRadius: 'var(--radius-sm)', padding: '9px 12px', marginBottom: '18px' }}>
          Hinweis: Es ist noch kein Claude-Schlüssel hinterlegt (Stammdaten → ⚙️ → API-Schlüssel).
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {beispiele.map((b, i) => (
          <button key={i} onClick={() => onBeispiel(b)} style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            {b}
          </button>
        ))}
      </div>
    </div>
  )
}
