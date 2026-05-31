import { useState, useRef, useMemo } from 'react'
import { generateAufgaben, getStatus, buildTogglePatch, TYP_CONFIG, fmtDatum, isUeberfaellig } from '../../utils/aufgaben.js'

const APIKEY_STORAGE = 'sda-claude-api-key'
function loadApiKey() { return (localStorage.getItem(APIKEY_STORAGE) ?? '').replace(/\s/g, '') }

function fmtDatumZeit(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

function isHeuteFaellig(iso) {
  if (!iso) return false
  const heute = new Date().toDateString()
  return new Date(iso).toDateString() === heute
}

const PRIO_CONFIG = {
  hoch:    { label: '🔴 Hoch',    color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  mittel:  { label: '🟡 Mittel',  color: 'var(--orange)', bg: 'rgba(249,115,22,0.1)' },
  niedrig: { label: '🟢 Niedrig', color: 'var(--green)',  bg: 'rgba(34,197,94,0.1)' },
}

const SYSTEM_PROMPT_AUFGABE = `Du bist ein Steuerberater-Assistent. Der Nutzer diktiert eine Aufgabe oder Anweisung für sich selbst. Erstelle daraus einen strukturierten Aufgaben-Eintrag auf Deutsch.
Antworte NUR mit einem JSON-Objekt, kein Text davor oder danach:
{"titel":"Kurze Aufgabenbeschreibung (max. 80 Zeichen)","inhalt":"Details oder Kontext (leer lassen wenn nicht relevant)","prioritaet":"hoch|mittel|niedrig","faelligAm":"YYYY-MM-DD oder null"}`

async function callClaude(userText) {
  const key = loadApiKey()
  if (!key) throw new Error('Bitte zuerst den Claude API-Schlüssel hinterlegen (🔑).')
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
      max_tokens: 512,
      system: SYSTEM_PROMPT_AUFGABE,
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

// ── VoiceInputBlock (lokal) ──────────────────────────────────────────────────
function VoiceInputBlock({ placeholder, onProcess }) {
  const [transcript, setTranscript]     = useState('')
  const [isRecording, setIsRecording]   = useState(false)
  const [interimText, setInterimText]   = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError]               = useState('')
  const recognitionRef = useRef(null)
  const transcriptRef  = useRef('')

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
  const voiceOk   = !!SpeechRec

  function setTBoth(val) {
    const v = typeof val === 'function' ? val(transcriptRef.current) : val
    transcriptRef.current = v
    setTranscript(v)
  }

  function toggleRec() {
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); setInterimText(''); return }
    if (!SpeechRec) return
    const rec = new SpeechRec()
    rec.lang = 'de-DE'; rec.continuous = true; rec.interimResults = true
    rec.onresult = e => {
      let fin = '', itr = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript
        else itr += e.results[i][0].transcript
      }
      if (fin) setTBoth(t => t.trimEnd() ? t.trimEnd() + ' ' + fin : fin)
      setInterimText(itr)
    }
    rec.onend   = () => { setIsRecording(false); setInterimText('') }
    rec.onerror = () => { setIsRecording(false); setInterimText(''); setError('Mikrofon-Fehler.') }
    rec.start(); recognitionRef.current = rec; setIsRecording(true); setError('')
  }

  async function handleProcess() {
    const text = transcript.trim()
    if (!text) return
    setIsProcessing(true); setError('')
    try { await onProcess(text); setTBoth('') }
    catch (e) { setError(e.message) }
    finally { setIsProcessing(false) }
  }

  return (
    <div style={{ padding: '10px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <button onClick={toggleRec} disabled={!voiceOk} style={{
          width: '34px', height: '34px', borderRadius: '50%', border: 'none', flexShrink: 0, marginTop: '1px',
          cursor: voiceOk ? 'pointer' : 'not-allowed',
          background: isRecording ? '#ef4444' : 'var(--accent)', color: '#fff', fontSize: '15px',
          boxShadow: isRecording ? '0 0 0 4px rgba(239,68,68,0.2)' : '0 1px 4px rgba(0,0,0,0.15)',
          animation: isRecording ? 'pulseRec 1.2s ease-in-out infinite' : 'none', transition: 'all 0.15s',
        }} title={isRecording ? 'Stoppen' : 'Spracheingabe'}>
          {isRecording ? '⏹' : '🎙'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative' }}>
            <textarea value={transcript} onChange={e => setTBoth(e.target.value)}
              placeholder={isRecording ? '🎤 Aufnahme läuft…' : placeholder} rows={2}
              style={{ width: '100%', padding: '6px 10px', border: `1px solid ${isRecording ? '#ef4444' : 'var(--border)'}`, borderRadius: '6px', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', lineHeight: 1.5, resize: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
            />
            {interimText && (
              <div style={{ position: 'absolute', bottom: '6px', left: '10px', right: '10px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', pointerEvents: 'none', lineHeight: 1.5 }}>
                {transcript && <span style={{ opacity: 0 }}>{transcript} </span>}
                <span style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '3px', padding: '0 2px' }}>{interimText}</span>
              </div>
            )}
          </div>
          {error && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', padding: '4px 8px', background: 'rgba(239,68,68,0.06)', borderRadius: '4px' }}>⚠ {error}</div>}
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end' }}>
            {transcript && <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => setTBoth('')}>✕ Löschen</button>}
            <button className="btn btn-primary btn-sm" onClick={handleProcess} disabled={!transcript.trim() || isProcessing} style={{ fontSize: '11px', padding: '3px 10px' }}>
              {isProcessing ? '⏳ …' : '✨ Als Aufgabe erfassen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AufgabenKarte ────────────────────────────────────────────────────────────
function AufgabenKarte({ aufgabe, onToggle, onDelete, onOpenEmail }) {
  const [expanded, setExpanded] = useState(false)
  const prio   = PRIO_CONFIG[aufgabe.prioritaet] ?? PRIO_CONFIG.mittel
  const ueber  = !aufgabe.erledigt && isUeberfaellig(aufgabe.faelligAm)
  const heute  = !aufgabe.erledigt && isHeuteFaellig(aufgabe.faelligAm)
  const hasEmailRef = aufgabe.quelle === 'email' && aufgabe.emailRef

  return (
    <div style={{
      background: aufgabe.erledigt ? 'rgba(0,0,0,0.02)' : ueber ? 'rgba(239,68,68,0.04)' : 'var(--surface)',
      border: `1px solid ${ueber ? 'rgba(239,68,68,0.3)' : heute ? 'rgba(37,99,235,0.3)' : 'var(--border)'}`,
      borderRadius: '8px', marginBottom: '8px', overflow: 'hidden', transition: 'all 0.15s',
      opacity: aufgabe.erledigt ? 0.65 : 1,
    }}>
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <input type="checkbox" checked={aufgabe.erledigt} onChange={() => onToggle(aufgabe.id)}
          style={{ marginTop: '2px', width: '16px', height: '16px', accentColor: 'var(--green)', cursor: 'pointer', flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
          <div style={{ fontWeight: 600, fontSize: '13px', textDecoration: aufgabe.erledigt ? 'line-through' : 'none', color: aufgabe.erledigt ? 'var(--text-muted)' : 'var(--text)' }}>
            {aufgabe.titel}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 7px', borderRadius: '10px', background: prio.bg, color: prio.color }}>
              {prio.label}
            </span>
            {hasEmailRef && (
              <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 7px', borderRadius: '10px', background: 'rgba(22,163,74,0.08)', color: '#16a34a' }}>
                📧 E-Mail
              </span>
            )}
            {aufgabe.faelligAm && (
              <span style={{ fontSize: '11px', color: ueber ? '#ef4444' : heute ? 'var(--accent)' : 'var(--text-muted)', fontWeight: ueber || heute ? 600 : 400 }}>
                {ueber ? '⚠ Überfällig: ' : heute ? '📅 Heute: ' : '📅 '}
                {fmtDatum(aufgabe.faelligAm)}
              </span>
            )}
            {aufgabe.erledigt && aufgabe.erledigtAm && (
              <span style={{ fontSize: '10px', color: 'var(--green)' }}>✓ {fmtDatumZeit(aufgabe.erledigtAm)}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {(aufgabe.inhalt || hasEmailRef) && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px', padding: '2px 6px' }}
              onClick={() => setExpanded(e => !e)}>{expanded ? '▲' : '▼'}</button>
          )}
          <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px', padding: '2px 6px', color: 'var(--red)' }}
            onClick={() => onDelete(aufgabe.id)}>🗑</button>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
          {aufgabe.inhalt && (
            <div style={{ padding: '8px 12px 6px 38px', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {aufgabe.inhalt}
            </div>
          )}
          {hasEmailRef && (
            <div style={{ padding: '6px 12px 8px 38px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', flex: 1, minWidth: 0 }}>
                📧 Quelle: E-Mail von <b>{aufgabe.emailRef.absender}</b>
                {aufgabe.emailRef.betreff && <> — {aufgabe.emailRef.betreff}</>}
                {aufgabe.emailRef.datum && <> ({fmtDatum(aufgabe.emailRef.datum?.split('T')[0])})</>}
              </div>
              {onOpenEmail && (
                <button className="btn btn-ghost btn-sm" onClick={() => onOpenEmail(aufgabe.emailRef.eventId)}
                  style={{ fontSize: '10px', padding: '2px 8px', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                  📧 E-Mail öffnen
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Automatische Aufgaben (USt / Lohn / JA) ──────────────────────────────────
function GenerierteAufgaben({ client, onUpdate }) {
  const HEUTE      = new Date()
  const CUR_MONAT  = HEUTE.getMonth() + 1
  const CUR_JAHR   = HEUTE.getFullYear()
  const NEXT_MONAT = CUR_MONAT === 12 ? 1 : CUR_MONAT + 1
  const NEXT_JAHR  = CUR_MONAT === 12 ? CUR_JAHR + 1 : CUR_JAHR

  const [filterZeitraum, setFilterZeitraum] = useState('aktuell') // 'aktuell'|'naechster'|'jahr'|'alle'
  const [filterStatus,   setFilterStatus]   = useState('offen')   // 'offen'|'erledigt'|'alle'
  const [filterTyp,      setFilterTyp]      = useState('alle')    // 'alle'|'USt'|'Lohn'|'JA'

  const alleTasks = useMemo(() => {
    return generateAufgaben(client).map(task => {
      const st = getStatus(client, task.key)
      return { ...task, erledigt: st.erledigt, erledigtAm: st.erledigtAm }
    })
  }, [client])

  const gefiltert = useMemo(() => {
    return alleTasks.filter(t => {
      // Zeitraum – gilt für alle Task-Typen
      if (filterZeitraum === 'aktuell') {
        if (t.jahr !== CUR_JAHR) return false
        if (t.monat !== null && t.monat !== CUR_MONAT) return false
        if (t.monat === null && t.quartal !== null && Math.ceil(CUR_MONAT / 3) !== t.quartal) return false
      } else if (filterZeitraum === 'naechster') {
        if (t.jahr !== NEXT_JAHR) return false
        if (t.monat !== null && t.monat !== NEXT_MONAT) return false
        if (t.monat === null && t.quartal !== null && Math.ceil(NEXT_MONAT / 3) !== t.quartal) return false
      } else if (filterZeitraum === 'jahr') {
        if (t.jahr !== CUR_JAHR) return false
      }
      // Typ
      if (filterTyp !== 'alle' && t.type !== filterTyp) return false
      // Status
      if (filterStatus === 'offen'    && t.erledigt)  return false
      if (filterStatus === 'erledigt' && !t.erledigt) return false
      return true
    })
  }, [alleTasks, filterZeitraum, filterStatus, filterTyp, CUR_MONAT, CUR_JAHR, NEXT_MONAT, NEXT_JAHR])

  const stats = useMemo(() => {
    const curJahr     = alleTasks.filter(t => t.jahr === CUR_JAHR)
    const curQ        = Math.ceil(CUR_MONAT / 3)
    const dieserMonat = curJahr.filter(t =>
      (t.monat === CUR_MONAT) ||
      (t.monat === null && t.quartal === curQ) ||
      (t.monat === null && t.quartal === null)
    )
    return {
      offen:       curJahr.filter(t => !t.erledigt).length,
      erledigt:    curJahr.filter(t =>  t.erledigt).length,
      dieserMonat: dieserMonat.filter(t => !t.erledigt).length,
    }
  }, [alleTasks, CUR_MONAT, CUR_JAHR])

  function handleToggle(task) {
    onUpdate(buildTogglePatch(client, task.key))
  }

  const chipStyle = (active, color = 'var(--accent)') => ({
    padding: '4px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', border: `1px solid ${active ? color : 'var(--border)'}`,
    background: active ? color : 'var(--surface2)', color: active ? '#fff' : 'var(--text-secondary)', fontWeight: active ? 600 : 400,
  })

  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>

      {/* Header + Stats */}
      <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>📋 Automatische Aufgaben</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { label: 'Offen',         count: stats.offen,       color: 'var(--accent)' },
              { label: 'Erledigt',      count: stats.erledigt,    color: 'var(--green)'  },
              { label: 'Diesen Monat',  count: stats.dieserMonat, color: 'var(--orange)' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                <span style={{ fontWeight: 700, color: s.color }}>{s.count}</span>
                <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter-Leiste */}
      <div style={{ padding: '8px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Zeitraum */}
        {[
          { key: 'aktuell',   label: 'Akt. Monat'   },
          { key: 'naechster', label: 'Nächster Monat' },
          { key: 'jahr',      label: 'Dieses Jahr'  },
          { key: 'alle',      label: 'Alle Jahre'   },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterZeitraum(f.key)} style={chipStyle(filterZeitraum === f.key)}>
            {f.label}
          </button>
        ))}

        <div style={{ width: '1px', height: '18px', background: 'var(--border)', alignSelf: 'center' }} />

        {/* Typ */}
        {[
          { key: 'alle',   label: 'Alle' },
          { key: 'USt',    label: '📊 USt' },
          { key: 'Lohn',   label: '💼 Lohn' },
          { key: 'JA',     label: '📁 JA' },
          { key: 'Zusatz', label: '⭐ Zusatz' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterTyp(f.key)} style={chipStyle(filterTyp === f.key, '#a78bfa')}>
            {f.label}
          </button>
        ))}

        <div style={{ width: '1px', height: '18px', background: 'var(--border)', alignSelf: 'center' }} />

        {/* Status */}
        {[
          { key: 'offen',    label: 'Offen'    },
          { key: 'erledigt', label: 'Erledigt' },
          { key: 'alle',     label: 'Alle'     },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterStatus(f.key)} style={chipStyle(filterStatus === f.key, '#4ade80')}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Task-Liste */}
      <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
        {gefiltert.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
            {filterStatus === 'erledigt'
              ? '🎉 Keine erledigten Aufgaben in diesem Zeitraum.'
              : '✅ Keine offenen Aufgaben in diesem Zeitraum.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <tbody>
              {gefiltert.map(task => {
                const cfg   = TYP_CONFIG[task.type]
                const ueber = !task.erledigt && isUeberfaellig(task.faellig)
                const istHeute = task.faellig && new Date(task.faellig).toDateString() === HEUTE.toDateString()
                return (
                  <tr key={task.key} style={{
                    borderBottom: '1px solid var(--border)',
                    background: task.erledigt ? 'transparent' : ueber ? 'rgba(239,68,68,0.03)' : 'var(--surface)',
                    opacity: task.erledigt ? 0.6 : 1,
                    transition: 'background 0.1s',
                  }}>
                    {/* Checkbox */}
                    <td style={{ padding: '8px 10px', width: '32px', textAlign: 'center' }}>
                      <input type="checkbox" checked={task.erledigt} onChange={() => handleToggle(task)}
                        style={{ width: '15px', height: '15px', accentColor: cfg.color, cursor: 'pointer' }}
                      />
                    </td>
                    {/* Typ-Badge */}
                    <td style={{ padding: '8px 6px', width: '80px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
                        {cfg.icon} {task.type}
                      </span>
                    </td>
                    {/* Aufgabe */}
                    <td style={{ padding: '8px 6px', fontWeight: task.erledigt ? 400 : 500, color: 'var(--text)', textDecoration: task.erledigt ? 'line-through' : 'none' }}>
                      {task.label}
                    </td>
                    {/* Fällig */}
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {task.faellig ? (
                        <span style={{ fontSize: '11px', color: ueber ? '#ef4444' : istHeute ? 'var(--orange)' : 'var(--text-muted)', fontWeight: ueber || istHeute ? 600 : 400 }}>
                          {ueber ? '⚠ ' : istHeute ? '⏰ ' : ''}{fmtDatum(task.faellig)}
                        </span>
                      ) : task.erledigt ? (
                        <span style={{ fontSize: '11px', color: 'var(--green)' }}>✓ {fmtDatum(task.erledigtAm)}</span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>–</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      {gefiltert.length > 0 && (
        <div style={{ padding: '6px 14px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface)' }}>
          {gefiltert.length} Aufgabe{gefiltert.length !== 1 ? 'n' : ''} angezeigt · Änderungen werden automatisch in der zentralen Übersicht synchronisiert
        </div>
      )}
    </div>
  )
}

// ── Haupt-Komponente ─────────────────────────────────────────────────────────
export default function AufgabenTab({ client, onUpdate, onAddTermin, onOpenEmail }) {
  const aufgaben = client.aufgaben ?? []

  const [filter, setFilter]   = useState('offen') // 'alle' | 'offen' | 'erledigt'
  const [toast, setToast]     = useState('')
  const [manForm, setManForm] = useState(false)
  const [manTitel,    setManTitel]    = useState('')
  const [manInhalt,   setManInhalt]   = useState('')
  const [manPrio,     setManPrio]     = useState('mittel')
  const [manFaellig,  setManFaellig]  = useState('')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500) }

  function addAufgabe(aufgabe) {
    onUpdate({ aufgaben: [aufgabe, ...aufgaben] })
    // Kalender-Integration: Aufgabe mit Frist → automatisch als Termin eintragen
    if (aufgabe.faelligAm && onAddTermin) {
      onAddTermin({
        id:    't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
        datum: aufgabe.faelligAm + 'T12:00:00.000Z',
        art:   'frist',
        text:  `📋 ${aufgabe.titel}`,
        erledigt:   false,
        erledigtAm: null,
      })
    }
  }

  async function processInput(text) {
    const parsed = await callClaude(text)
    addAufgabe({
      id:         'a' + Date.now().toString(36),
      titel:      parsed.titel      ?? text.slice(0, 80),
      inhalt:     parsed.inhalt     ?? '',
      prioritaet: parsed.prioritaet ?? 'mittel',
      faelligAm:  parsed.faelligAm  ?? null,
      erledigt:   false,
      erledigtAm: null,
      datum:      new Date().toISOString(),
    })
    showToast('✅ Aufgabe erfasst')
  }

  function addManuell() {
    if (!manTitel.trim()) return
    addAufgabe({
      id:         'a' + Date.now().toString(36),
      titel:      manTitel.trim(),
      inhalt:     manInhalt.trim(),
      prioritaet: manPrio,
      faelligAm:  manFaellig || null,
      erledigt:   false,
      erledigtAm: null,
      datum:      new Date().toISOString(),
    })
    setManTitel(''); setManInhalt(''); setManPrio('mittel'); setManFaellig('')
    setManForm(false)
    showToast('✅ Aufgabe manuell hinzugefügt')
  }

  function toggleErledigt(id) {
    const updated = aufgaben.map(a => a.id === id
      ? { ...a, erledigt: !a.erledigt, erledigtAm: !a.erledigt ? new Date().toISOString() : null }
      : a)
    onUpdate({ aufgaben: updated })
  }

  function deleteAufgabe(id) {
    onUpdate({ aufgaben: aufgaben.filter(a => a.id !== id) })
  }

  const gefiltert = aufgaben.filter(a =>
    filter === 'alle'     ? true :
    filter === 'offen'    ? !a.erledigt :
    filter === 'erledigt' ? a.erledigt : true
  )

  const sortiert = [...gefiltert].sort((a, b) => {
    if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1
    const prioOrder = { hoch: 0, mittel: 1, niedrig: 2 }
    const pa = prioOrder[a.prioritaet] ?? 1
    const pb = prioOrder[b.prioritaet] ?? 1
    if (pa !== pb) return pa - pb
    return new Date(a.datum) - new Date(b.datum)
  })

  const anzahlOffen    = aufgaben.filter(a => !a.erledigt).length
  const anzahlUeber    = aufgaben.filter(a => !a.erledigt && isUeberfaellig(a.faelligAm)).length
  const anzahlErledigt = aufgaben.filter(a =>  a.erledigt).length

  const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box' }

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '10px 16px', boxShadow: 'var(--shadow-lg)', fontSize: '13px', zIndex: 2000 }}>
          {toast}
        </div>
      )}

      {/* ── Eingabe-Block ── */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: '13px' }}>➕ Neue Notiz / Aufgabe</span>
          <button
            onClick={() => setManForm(s => !s)}
            style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: manForm ? 'var(--surface2)' : 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            ✏️ Manuell eingeben
          </button>
        </div>

        <VoiceInputBlock
          placeholder='Aufgabe sprechen oder tippen, z. B.: „Kontoauszüge von 2023 beim Mandanten anfordern – dringend bis Freitag"'
          onProcess={processInput}
        />

        {manForm && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input type="text" value={manTitel} onChange={e => setManTitel(e.target.value)}
              placeholder="Aufgabentitel *" style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && addManuell()}
            />
            <input type="text" value={manInhalt} onChange={e => setManInhalt(e.target.value)}
              placeholder="Details (optional)" style={inputStyle}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Priorität</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {Object.entries(PRIO_CONFIG).map(([key, cfg]) => (
                    <button key={key} onClick={() => setManPrio(key)} style={{
                      flex: 1, padding: '4px 8px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                      border: `1px solid ${manPrio === key ? cfg.color : 'var(--border)'}`,
                      background: manPrio === key ? cfg.bg : 'var(--surface2)',
                      color: manPrio === key ? cfg.color : 'var(--text-secondary)',
                      fontWeight: manPrio === key ? 700 : 400,
                    }}>{cfg.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ width: '150px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Fällig am</div>
                <input type="date" value={manFaellig} onChange={e => setManFaellig(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }} onClick={() => setManForm(false)}>Abbrechen</button>
              <button className="btn btn-primary btn-sm" style={{ fontSize: '11px' }} onClick={addManuell} disabled={!manTitel.trim()}>
                ➕ Hinzufügen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Manuelle Aufgaben-Liste ── */}
      <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>

        <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '13px' }}>🗒 Eigene Aufgaben</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {anzahlUeber > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#ef4444', padding: '2px 8px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)' }}>
                ⚠ {anzahlUeber} überfällig
              </span>
            )}
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { key: 'offen',    label: `Offen (${anzahlOffen})` },
                { key: 'erledigt', label: `Erledigt (${anzahlErledigt})` },
                { key: 'alle',     label: 'Alle' },
              ].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} style={{
                  padding: '4px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
                  border: `1px solid ${filter === f.key ? 'var(--accent)' : 'var(--border)'}`,
                  background: filter === f.key ? 'var(--accent)' : 'var(--surface2)',
                  color: filter === f.key ? '#fff' : 'var(--text-secondary)',
                  fontWeight: filter === f.key ? 600 : 400,
                }}>{f.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '10px', maxHeight: '280px', overflowY: 'auto' }}>
          {sortiert.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '24px 8px' }}>
              {filter === 'erledigt' ? 'Noch keine erledigten Aufgaben.' :
               filter === 'offen'    ? 'Keine offenen Aufgaben – alles erledigt! 🎉' :
               'Noch keine Aufgaben vorhanden.'}
              <br />
              <span style={{ fontSize: '11px', opacity: 0.7 }}>🎙 Sprechen oder tippen Sie eine neue Aufgabe oben ein.</span>
            </div>
          ) : (
            sortiert.map(a => (
              <AufgabenKarte key={a.id} aufgabe={a} onToggle={toggleErledigt} onDelete={deleteAufgabe} onOpenEmail={onOpenEmail} />
            ))
          )}
        </div>
      </div>

      {/* Auftragsaufgaben (USt/Lohn/JA) werden im Reiter „Stammdaten" → Block „Auftrag" konfiguriert */}

      <style>{`
        @keyframes pulseRec {
          0%, 100% { box-shadow: 0 0 0 4px rgba(239,68,68,0.25); }
          50%       { box-shadow: 0 0 0 8px rgba(239,68,68,0.08); }
        }
      `}</style>
    </div>
  )
}
