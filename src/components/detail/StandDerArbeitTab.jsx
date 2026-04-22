import { useState, useRef } from 'react'

// ── Persistence helpers ──────────────────────────────────────────────────────
const APIKEY_STORAGE = 'sda-claude-api-key'
const TEMPLATE3_KEY  = 'sda-email-template3'
function loadApiKey()     { return (localStorage.getItem(APIKEY_STORAGE) ?? '').replace(/\s/g, '') }
function loadTemplate3()  { return localStorage.getItem(TEMPLATE3_KEY) ?? '' }
function saveTemplate3(t) { localStorage.setItem(TEMPLATE3_KEY, t) }

// ── Date helpers ─────────────────────────────────────────────────────────────
function getTodayISO() { return new Date().toISOString().slice(0, 10) }

function toISO(dateStr) {
  return new Date(dateStr + 'T12:00:00').toISOString()
}

function fmtDateShort(iso) {
  if (!iso) return '–'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
}

function fmtDatumLang(iso) {
  if (!iso) return '–'
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

function fmtDateInput(iso) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function addDays(dateStr, n) {
  const d = new Date(dateStr.length === 10 ? dateStr + 'T12:00:00' : dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function daysUntil(iso) {
  if (!iso) return null
  const diff = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function daysSince(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// ── Event-Typen ───────────────────────────────────────────────────────────────
const EVENT_TYPES = {
  rueckfragen: {
    label: 'Rückfragen gesendet', icon: '📤', color: '#2563eb',
    statusLabel: 'Warte auf Rückmeldung',
    statusIcon: '⏳', statusColor: '#ef4444',
    statusBg: 'rgba(239,68,68,0.05)', statusBorder: 'rgba(239,68,68,0.25)',
  },
  erinnerung: {
    label: 'Erinnerung gesendet', icon: '🔔', color: '#f97316',
    statusLabel: 'Erinnerung gesendet',
    statusIcon: '🔔', statusColor: '#f97316',
    statusBg: 'rgba(249,115,22,0.05)', statusBorder: 'rgba(249,115,22,0.25)',
  },
  antwort: {
    label: 'Antwort erhalten', icon: '💬', color: '#16a34a',
    statusLabel: 'Antwort erhalten – Bearbeitung läuft',
    statusIcon: '✅', statusColor: '#16a34a',
    statusBg: 'rgba(22,163,74,0.05)', statusBorder: 'rgba(22,163,74,0.25)',
  },
  vollstaendigkeit: {
    label: 'Vollständigkeitserklärung erhalten', icon: '📋', color: '#0f766e',
    statusLabel: 'Vollständigkeitserklärung erhalten',
    statusIcon: '📋', statusColor: '#0f766e',
    statusBg: 'rgba(15,118,110,0.05)', statusBorder: 'rgba(15,118,110,0.25)',
  },
  telefonat: {
    label: 'Telefonat / Persönlich', icon: '📞', color: '#7c3aed',
    statusLabel: 'Telefonat geführt',
    statusIcon: '📞', statusColor: '#7c3aed',
    statusBg: 'rgba(124,58,237,0.05)', statusBorder: 'rgba(124,58,237,0.25)',
  },
  email: {
    label: 'E-Mail gesendet', icon: '📧', color: '#0891b2',
    statusLabel: 'E-Mail gesendet',
    statusIcon: '📧', statusColor: '#0891b2',
    statusBg: 'rgba(8,145,178,0.05)', statusBorder: 'rgba(8,145,178,0.25)',
  },
  unterschrift: {
    label: 'Steuererklärung zur Unterschrift gesendet', icon: '✍️', color: '#0f766e',
    statusLabel: 'Steuererklärung zur Unterschrift gesendet',
    statusIcon: '✍️', statusColor: '#0f766e',
    statusBg: 'rgba(15,118,110,0.05)', statusBorder: 'rgba(15,118,110,0.25)',
  },
  notiz: {
    label: 'Interne Notiz', icon: '🧠', color: '#64748b',
    statusLabel: 'In Bearbeitung',
    statusIcon: '🛠', statusColor: '#16a34a',
    statusBg: 'rgba(22,163,74,0.05)', statusBorder: 'rgba(22,163,74,0.25)',
  },
  fa_gesendet: {
    label: 'Steuererklärung ans Finanzamt geschickt', icon: '🏛', color: '#0891b2',
    statusLabel: 'An Finanzamt gesendet → Rechnung schreiben',
    statusIcon: '🧾', statusColor: '#0891b2',
    statusBg: 'rgba(8,145,178,0.05)', statusBorder: 'rgba(8,145,178,0.25)',
  },
  rechnung_gestellt: {
    label: 'Rechnung geschrieben', icon: '🧾', color: '#16a34a',
    statusLabel: 'Abgeschlossen',
    statusIcon: '✅', statusColor: '#16a34a',
    statusBg: 'rgba(22,163,74,0.05)', statusBorder: 'rgba(22,163,74,0.25)',
  },
}

// ── KI: Kombinierter Prompt (Timeline + Rückfragen-Erkennung) ─────────────────
function getKiPrompt(clientName, vj, today) {
  return `Du bist ein Steuerberater-Assistent. Heute: ${today}. Mandant: ${clientName}, Veranlagungsjahr: ${vj}.

Analysiere den Text. Entscheide:
(A) Enthält er Rückfragen/Nachforderungen an den Mandanten (Belege, Erklärungen, Aufstellungen, konkrete Fragen)?
(B) Oder ist es eine allgemeine Aktivitätsbeschreibung (Telefonat, Erinnerung, Notiz, …)?

Antworte NUR mit einem JSON-Objekt:
{
  "typ": "rueckfragen" | "erinnerung" | "antwort" | "vollstaendigkeit" | "telefonat" | "email" | "notiz" | "fa_gesendet" | "rechnung_gestellt",
  "hatRueckfragen": true / false,
  "datum": "YYYY-MM-DD",
  "notiz": "Kurze Beschreibung max 100 Zeichen",
  "reminder_tage": Zahl oder null,
  "rueckfragen": ["Präzise Rückfrage 1", "Präzise Rückfrage 2"],
  "emailBetreff": "Aussagekräftiger Betreff",
  "emailText": "Vollständiger E-Mail-Text mit Anrede Sehr geehrte/r … und Grußformel"
}

Regeln:
- hatRueckfragen=true nur wenn mindestens eine konkrete Frage/Anforderung erkennbar
- rueckfragen[]: jede Rückfrage als eigenständiger, vollständiger Satz
- emailText: professionell, höflich, alle Rückfragen nummeriert aufgelistet, keine Platzhalter
- Bei hatRueckfragen=false: rueckfragen=[], emailBetreff="", emailText=""
- typ: bei Rückfragen immer "rueckfragen", sonst passend klassifizieren`
}

// ── KI: E-Mail generieren ────────────────────────────────────────────────────
const PROMPT_EMAIL = `Du bist ein Steuerberater-Assistent. Der Nutzer beschreibt eine E-Mail an den Mandanten. Formuliere eine professionelle, höfliche E-Mail auf Deutsch.
Antworte NUR mit einem JSON-Objekt:
{"betreff":"Aussagekräftiger E-Mail-Betreff","text":"Vollständiger E-Mail-Text mit Anrede und Grußformel"}`

async function callClaude(systemPrompt, userText) {
  const key = loadApiKey()
  if (!key) throw new Error('Bitte zuerst den Claude API-Schlüssel hinterlegen (🗂 Stammdaten).')
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
    throw new Error('Fehler: ' + (err.error?.message ?? `HTTP ${res.status}`))
  }
  const data = await res.json()
  let raw = data.content?.[0]?.text ?? ''
  const cb = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (cb) raw = cb[1]
  const jm = raw.match(/\{[\s\S]*\}/)
  if (!jm) throw new Error('Antwort konnte nicht verarbeitet werden.')
  const jsonStr = jm[0]
  // Erst direkt versuchen
  try { return JSON.parse(jsonStr) } catch {}
  // Fallback: echte Zeilenumbrüche / Tabs innerhalb von JSON-Strings bereinigen
  // (Claude schreibt manchmal echte \n statt \\n in String-Werten)
  const fixed = jsonStr.replace(/("(?:[^"\\]|\\.)*")/gs, m =>
    m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
  )
  return JSON.parse(fixed)
}

// ── VoiceInputBlock ───────────────────────────────────────────────────────────
function VoiceInputBlock({ placeholder, onProcess }) {
  const [transcript, setTranscript]     = useState('')
  const [isRecording, setIsRecording]   = useState(false)
  const [interimText, setInterimText]   = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError]               = useState('')
  const recRef   = useRef(null)
  const textRef  = useRef('')

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  const supported = !!SR

  function set(val) {
    const v = typeof val === 'function' ? val(textRef.current) : val
    textRef.current = v
    setTranscript(v)
  }

  function toggle() {
    if (isRecording) { recRef.current?.stop(); setIsRecording(false); setInterimText(''); return }
    if (!SR) return
    const r = new SR()
    r.lang = 'de-DE'; r.continuous = true; r.interimResults = true
    r.onresult = e => {
      let fin = '', int = ''
      for (let i = e.resultIndex; i < e.results.length; i++)
        e.results[i].isFinal ? fin += e.results[i][0].transcript : int += e.results[i][0].transcript
      if (fin) set(t => t.trimEnd() ? t.trimEnd() + ' ' + fin : fin)
      setInterimText(int)
    }
    r.onend   = () => { setIsRecording(false); setInterimText('') }
    r.onerror = () => { setIsRecording(false); setInterimText(''); setError('Mikrofon-Fehler – Berechtigung prüfen.') }
    r.start(); recRef.current = r; setIsRecording(true); setError('')
  }

  async function process() {
    const text = transcript.trim()
    if (!text) return
    setIsProcessing(true); setError('')
    try { await onProcess(text); set('') }
    catch (e) { setError(e.message) }
    finally { setIsProcessing(false) }
  }

  return (
    <div style={{ padding: '12px 14px', background: 'var(--surface)' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        🎤 KI-Spracheingabe
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        <button onClick={toggle} disabled={!supported} style={{
          width: '36px', height: '36px', borderRadius: '50%', border: 'none', flexShrink: 0,
          cursor: supported ? 'pointer' : 'not-allowed',
          background: isRecording ? '#ef4444' : 'var(--accent)', color: '#fff', fontSize: '16px',
          boxShadow: isRecording ? '0 0 0 4px rgba(239,68,68,0.2)' : '0 1px 4px rgba(0,0,0,0.15)',
          animation: isRecording ? 'pulseRec 1.2s ease-in-out infinite' : 'none', transition: 'all 0.15s',
        }} title={isRecording ? 'Aufnahme stoppen' : 'Spracheingabe starten'}>
          {isRecording ? '⏹' : '🎙'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative' }}>
            <textarea
              value={transcript}
              onChange={e => set(e.target.value)}
              placeholder={isRecording ? '🎤 Aufnahme läuft…' : placeholder}
              rows={3}
              style={{
                width: '100%', padding: '6px 10px',
                border: `1px solid ${isRecording ? '#ef4444' : 'var(--border)'}`,
                borderRadius: '6px', background: 'var(--surface2)', color: 'var(--text)',
                fontSize: '12px', lineHeight: 1.5, resize: 'none', boxSizing: 'border-box',
              }}
            />
            {interimText && (
              <div style={{ position: 'absolute', bottom: '6px', left: '10px', right: '10px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', pointerEvents: 'none' }}>
                {transcript && <span style={{ opacity: 0 }}>{transcript} </span>}
                <span style={{ background: 'rgba(239,68,68,0.08)', borderRadius: '3px', padding: '0 2px' }}>{interimText}</span>
              </div>
            )}
          </div>
          {error && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', padding: '4px 8px', background: 'rgba(239,68,68,0.06)', borderRadius: '4px' }}>⚠ {error}</div>}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
            KI erkennt automatisch: Rückfragen-Listen → strukturierte Checkliste + E-Mail-Entwurf · Aktivitäten → Timeline-Eintrag
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end' }}>
            {transcript && <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }} onClick={() => set('')}>✕ Löschen</button>}
            <button className="btn btn-primary btn-sm" onClick={process} disabled={!transcript.trim() || isProcessing} style={{ fontSize: '11px' }}>
              {isProcessing ? '⏳ KI analysiert…' : '✨ Verarbeiten'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PendingRueckfragenBlock ───────────────────────────────────────────────────
function PendingRueckfragenBlock({ pending, onConfirm, onCancel, onToggleItem, onToggleEmail, onUpdateEmailText, onUpdateEmailBetreff }) {
  const selectedCount = pending.items.filter(i => i.selected).length

  return (
    <div style={{
      border: '2px solid rgba(37,99,235,0.4)', borderRadius: '10px', overflow: 'hidden',
      background: 'rgba(37,99,235,0.03)',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', background: 'rgba(37,99,235,0.08)',
        borderBottom: '1px solid rgba(37,99,235,0.2)',
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '18px' }}>🤖</span>
        <span style={{ fontWeight: 700, fontSize: '13px', color: '#1d4ed8', flex: 1 }}>
          KI hat {pending.items.length} Rückfrage{pending.items.length !== 1 ? 'n' : ''} erkannt
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bitte prüfen und bestätigen</span>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Rückfragen-Liste */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Erkannte Rückfragen
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            {pending.items.map((item, i) => (
              <label key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '9px 12px', cursor: 'pointer',
                borderBottom: i < pending.items.length - 1 ? '1px solid var(--border)' : 'none',
                background: item.selected ? 'rgba(37,99,235,0.04)' : 'transparent',
                transition: 'background 0.1s',
              }}>
                <input
                  type="checkbox" checked={item.selected}
                  onChange={() => onToggleItem(i)}
                  style={{ marginTop: '2px', width: '14px', height: '14px', accentColor: '#2563eb', flexShrink: 0, cursor: 'pointer' }}
                />
                <span style={{
                  fontSize: '12px', lineHeight: 1.5,
                  color: item.selected ? 'var(--text)' : 'var(--text-muted)',
                  textDecoration: item.selected ? 'none' : 'line-through',
                }}>
                  {item.text}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* E-Mail-Entwurf */}
        {pending.emailText && (
          <div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '11px', marginBottom: pending.showEmail ? '8px' : '0' }}
              onClick={onToggleEmail}
            >
              {pending.showEmail ? '▲ E-Mail-Entwurf ausblenden' : '📧 E-Mail-Entwurf anzeigen / bearbeiten'}
            </button>
            {pending.showEmail && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input
                  className="input"
                  value={pending.emailBetreff}
                  onChange={e => onUpdateEmailBetreff(e.target.value)}
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                  placeholder="Betreff"
                />
                <textarea
                  className="input"
                  value={pending.emailText}
                  onChange={e => onUpdateEmailText(e.target.value)}
                  rows={8}
                  style={{ fontSize: '12px', resize: 'vertical', padding: '8px 10px', lineHeight: 1.6, fontFamily: 'var(--font-ui)' }}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  💡 E-Mail wird nur als Entwurf gespeichert. Versand erfolgt im Reiter ✉️ Komm.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Aktions-Buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
          <button
            className="btn btn-primary btn-sm"
            style={{ fontWeight: 700 }}
            disabled={selectedCount === 0}
            onClick={() => onConfirm(false)}
          >
            ✓ {selectedCount} Rückfrage{selectedCount !== 1 ? 'n' : ''} speichern
          </button>
          {pending.emailText && (
            <button
              className="btn btn-sm"
              style={{ fontWeight: 600, background: 'rgba(37,99,235,0.12)', color: '#1d4ed8', border: '1px solid rgba(37,99,235,0.3)' }}
              disabled={selectedCount === 0}
              onClick={() => onConfirm(true)}
            >
              ✓ Speichern + E-Mail-Entwurf erstellen
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onCancel} style={{ marginLeft: 'auto' }}>
            ✕ Verwerfen
          </button>
        </div>
      </div>
    </div>
  )
}

// ── StatusBanner ──────────────────────────────────────────────────────────────
function StatusBanner({ events }) {
  if (!events.length) {
    return (
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>📋</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-muted)' }}>Noch keine Aktivitäten erfasst</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>Erste Aktivität unten hinzufügen – per Schnellauswahl oder Spracheingabe.</div>
        </div>
      </div>
    )
  }

  const latest = events[0]
  const cfg = EVENT_TYPES[latest.typ] ?? EVENT_TYPES.notiz
  const since = daysSince(latest.datum)

  const pending = events.find(e => e.reminder && !e.reminder.erledigt)
  const reminderN = pending ? daysUntil(pending.reminder.datum) : null
  const reminderOverdue = reminderN !== null && reminderN < 0
  const reminderToday = reminderN === 0

  return (
    <div style={{ background: cfg.statusBg, border: `1px solid ${cfg.statusBorder}`, borderRadius: 'var(--radius)', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
          background: cfg.statusColor + '18', border: `2px solid ${cfg.statusColor}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
        }}>
          {cfg.statusIcon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '17px', color: cfg.statusColor, letterSpacing: '-0.01em' }}>
            {cfg.statusLabel}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
            <span>
              Letzte Aktion: {cfg.icon} <strong>{cfg.label}</strong> am {fmtDateShort(latest.datum)}
              {since !== null && since > 0 && (
                <span style={{ marginLeft: '6px', color: 'var(--text-muted)' }}>
                  ({since === 1 ? 'gestern' : `vor ${since} Tagen`})
                </span>
              )}
            </span>
            {latest.notiz && (
              <span style={{ color: 'var(--text-muted)' }}>· {latest.notiz}</span>
            )}
          </div>
        </div>
      </div>

      {pending && (
        <div style={{
          marginTop: '12px', padding: '9px 14px', borderRadius: '8px',
          background: reminderOverdue ? 'rgba(239,68,68,0.1)' : reminderToday ? 'rgba(249,115,22,0.1)' : 'rgba(37,99,235,0.08)',
          border: `1px solid ${reminderOverdue ? 'rgba(239,68,68,0.3)' : reminderToday ? 'rgba(249,115,22,0.3)' : 'rgba(37,99,235,0.2)'}`,
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{ fontSize: '16px' }}>{reminderOverdue ? '⚠️' : '⏰'}</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: reminderOverdue ? '#ef4444' : reminderToday ? '#f97316' : 'var(--accent)' }}>
            {reminderOverdue
              ? `Erinnerung überfällig! (fällig am ${fmtDateShort(pending.reminder.datum)})`
              : reminderToday
              ? `Erinnerung fällig: Heute!`
              : `Nächste Erinnerung: ${fmtDateShort(pending.reminder.datum)} (in ${reminderN} ${reminderN === 1 ? 'Tag' : 'Tagen'})`
            }
          </span>
          {pending.notiz && <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '4px' }}>· {pending.notiz}</span>}
        </div>
      )}
    </div>
  )
}

// ── Timeline-Eintrag ─────────────────────────────────────────────────────────
function TimelineItem({ event, isLast, onDelete, onToggleReminder }) {
  const cfg = EVENT_TYPES[event.typ] ?? EVENT_TYPES.notiz
  const hasReminder = !!event.reminder
  const reminderDone = hasReminder && event.reminder.erledigt
  const reminderN = hasReminder ? daysUntil(event.reminder.datum) : null
  const reminderOverdue = hasReminder && !reminderDone && reminderN < 0

  return (
    <div style={{ display: 'flex', gap: '0', position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '44px', flexShrink: 0 }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%', zIndex: 1, flexShrink: 0,
          background: 'var(--bg, #0f1117)',
          border: `2px solid ${cfg.color}`,
          boxShadow: `0 0 0 3px ${cfg.color}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
        }}>
          {cfg.icon}
        </div>
        {!isLast && <div style={{ width: '2px', flex: 1, background: 'var(--border)', marginTop: '2px', minHeight: '20px' }} />}
      </div>

      <div style={{
        flex: 1, marginLeft: '10px', marginBottom: isLast ? '0' : '16px',
        background: reminderOverdue ? 'rgba(239,68,68,0.03)' : 'var(--surface2)',
        border: `1px solid ${reminderOverdue ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)', overflow: 'hidden',
      }}>
        <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface)', borderBottom: (event.notiz || hasReminder) ? '1px solid var(--border)' : 'none' }}>
          <span style={{
            fontSize: '11px', fontWeight: 700, color: cfg.color,
            background: cfg.color + '15', padding: '2px 8px', borderRadius: '10px',
          }}>
            {cfg.label}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1 }}>
            {fmtDateShort(event.datum)}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '11px', padding: '1px 5px', color: 'var(--red)', opacity: 0.5, flexShrink: 0 }}
            onClick={() => onDelete(event.id)}
            title="Eintrag löschen"
          >🗑</button>
        </div>

        {(event.notiz || hasReminder) && (
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {event.notiz && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>{event.notiz}</div>
            )}
            {hasReminder && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', userSelect: 'none', width: 'fit-content' }}>
                <input
                  type="checkbox"
                  checked={reminderDone}
                  onChange={() => onToggleReminder(event.id)}
                  style={{ width: '14px', height: '14px', accentColor: 'var(--green)', cursor: 'pointer' }}
                />
                <span style={{
                  fontSize: '12px',
                  color: reminderDone ? 'var(--text-muted)' : reminderOverdue ? '#ef4444' : 'var(--accent)',
                  textDecoration: reminderDone ? 'line-through' : 'none',
                  fontWeight: reminderOverdue && !reminderDone ? 600 : 400,
                }}>
                  {reminderDone
                    ? `✓ Erinnerung erledigt`
                    : `⏰ Erinnerung: ${fmtDateShort(event.reminder.datum)}${reminderOverdue ? ' – Überfällig!' : reminderN === 0 ? ' – Heute!' : ''}`
                  }
                </span>
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── EmailCard ─────────────────────────────────────────────────────────────────
function EmailCard({ entry, onDelete, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied]     = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(`Betreff: ${entry.betreff}\n\n${entry.text}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const gesendet = !!entry.gesendetAm

  return (
    <div style={{
      background: gesendet ? 'rgba(34,197,94,0.05)' : 'var(--surface)',
      border: `1px solid ${gesendet ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
      borderRadius: '6px', marginBottom: '8px', overflow: 'hidden', transition: 'all 0.2s',
    }}>
      <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <span style={{ fontSize: '14px' }}>{gesendet ? '✉️' : '📧'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.betreff}</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{fmtDatumLang(entry.datum)}</div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px', padding: '2px 8px', flexShrink: 0 }} onClick={e => { e.stopPropagation(); handleCopy() }}>{copied ? '✓' : '📋'}</button>
        <button className="btn btn-ghost btn-sm" style={{ fontSize: '11px', padding: '2px 6px', color: 'var(--red)', flexShrink: 0 }} onClick={e => { e.stopPropagation(); onDelete(entry.id) }}>🗑</button>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      <div style={{ padding: '6px 12px 8px', borderTop: '1px solid var(--border)', background: gesendet ? 'rgba(34,197,94,0.06)' : 'var(--surface2)', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={gesendet} onChange={() => onUpdate(entry.id, { gesendetAm: gesendet ? null : new Date().toISOString() })} style={{ width: '15px', height: '15px', accentColor: 'var(--green)', cursor: 'pointer' }} />
          <span style={{ fontSize: '12px', fontWeight: gesendet ? 600 : 400, color: gesendet ? 'var(--green)' : 'var(--text-secondary)' }}>
            {gesendet ? `✓ Gesendet am ${fmtDatumLang(entry.gesendetAm)}` : 'An Mandanten gesendet am …'}
          </span>
        </label>
      </div>
      {expanded && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <pre style={{ fontSize: '12px', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'var(--font-ui)', color: 'var(--text)' }}>{entry.text}</pre>
          <button className={`btn btn-sm ${copied ? 'btn-success' : 'btn-primary'}`} style={{ marginTop: '10px', fontSize: '11px' }} onClick={handleCopy}>{copied ? '✓ Kopiert!' : '📋 E-Mail kopieren'}</button>
        </div>
      )}
    </div>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function StandDerArbeitTab({ client, onUpdate }) {

  // ── Timeline-Daten ──
  const komm   = client.kommunikation ?? { events: [] }
  const events = [...(komm.events ?? [])].sort((a, b) => new Date(b.datum) - new Date(a.datum))

  function addEvent(typ, datum, notiz, reminderDatum) {
    const newEvent = {
      id: 'e' + Date.now().toString(36),
      typ,
      datum: toISO(datum),
      notiz: notiz.trim(),
      reminder: reminderDatum ? { datum: toISO(reminderDatum), erledigt: false } : null,
    }
    onUpdate({ kommunikation: { ...komm, events: [newEvent, ...(komm.events ?? [])] } })
  }

  function deleteEvent(id) {
    onUpdate({ kommunikation: { ...komm, events: (komm.events ?? []).filter(e => e.id !== id) } })
  }

  function toggleReminder(id) {
    const updated = (komm.events ?? []).map(e =>
      e.id === id && e.reminder ? { ...e, reminder: { ...e.reminder, erledigt: !e.reminder.erledigt } } : e
    )
    onUpdate({ kommunikation: { ...komm, events: updated } })
  }

  // ── Neue-Aktivität-Formular ──
  const [selectedTyp,    setSelectedTyp]    = useState(null)
  const [newDatum,       setNewDatum]       = useState(getTodayISO)
  const [newNotiz,       setNewNotiz]       = useState('')
  const [reminderActive, setReminderActive] = useState(false)
  const [reminderTage,   setReminderTage]   = useState(7)

  const reminderDatum = reminderActive ? addDays(newDatum, reminderTage) : null

  function handleQuickAction(typ) {
    if (selectedTyp === typ) { setSelectedTyp(null); return }
    setSelectedTyp(typ)
    setNewDatum(getTodayISO())
    setNewNotiz('')
    setReminderActive(false)
    setReminderTage(7)
  }

  function handleAddEvent() {
    if (!selectedTyp) return
    addEvent(selectedTyp, newDatum, newNotiz, reminderDatum)
    setSelectedTyp(null)
    setNewDatum(getTodayISO())
    setNewNotiz('')
    setReminderActive(false)
    setReminderTage(7)
    showToast(`${EVENT_TYPES[selectedTyp].icon} ${EVENT_TYPES[selectedTyp].label} eingetragen`)
  }

  // ── Toast ──
  const [toast, setToast_] = useState('')
  function showToast(msg) { setToast_(msg); setTimeout(() => setToast_(''), 4000) }

  // ── Pending Rückfragen (KI-Vorschau) ──
  const [pendingRQ, setPendingRQ] = useState(null)
  // Schema: { items: [{text, selected}], emailBetreff, emailText, showEmail, datum }

  // ── Voice / KI ──
  async function processVoice(text) {
    const vj = [client.veranlagungsjahr, client.veranlagungsjahr2, client.veranlagungsjahr3].filter(Boolean).join('/') || String(new Date().getFullYear())
    const parsed = await callClaude(getKiPrompt(client.name, vj, getTodayISO()), text)

    if (parsed.hatRueckfragen && Array.isArray(parsed.rueckfragen) && parsed.rueckfragen.length > 0) {
      // Rückfragen erkannt → Vorschau zeigen
      setPendingRQ({
        items: parsed.rueckfragen.map(t => ({ text: t, selected: true })),
        emailBetreff: parsed.emailBetreff ?? '',
        emailText: parsed.emailText ?? '',
        showEmail: false,
        datum: parsed.datum && /^\d{4}-\d{2}-\d{2}$/.test(parsed.datum) ? parsed.datum : getTodayISO(),
      })
      showToast(`🤖 ${parsed.rueckfragen.length} Rückfrage${parsed.rueckfragen.length !== 1 ? 'n' : ''} erkannt – bitte prüfen`)
    } else {
      // Normale Aktivität → direkt als Timeline-Eintrag
      const typ = Object.keys(EVENT_TYPES).includes(parsed.typ) ? parsed.typ : 'notiz'
      const datum = parsed.datum && /^\d{4}-\d{2}-\d{2}$/.test(parsed.datum) ? parsed.datum : getTodayISO()
      const notiz = parsed.notiz ?? ''
      let remDatum = null
      if (parsed.reminder_tage && parsed.reminder_tage > 0)
        remDatum = addDays(datum, Math.round(parsed.reminder_tage))
      addEvent(typ, datum, notiz, remDatum)
      showToast(`${EVENT_TYPES[typ].icon} ${EVENT_TYPES[typ].label} – KI hat Eintrag erstellt${remDatum ? ` · ⏰ Erinnerung am ${fmtDateShort(remDatum)}` : ''}`)
    }
  }

  function confirmRueckfragen(withEmail) {
    if (!pendingRQ) return
    const selected = pendingRQ.items.filter(i => i.selected)
    if (selected.length === 0) { setPendingRQ(null); return }

    const now = new Date().toISOString()
    const existingRQ = client.rueckfragen ?? []

    // Neue Rückfragen erstellen – Architektur: buchungskonto + antwort für spätere Verknüpfung
    const newRQs = selected.map((item, idx) => ({
      id: 'rq_' + Date.now().toString(36) + idx.toString(36),
      text: item.text,
      buchungskonto: '',   // kann später mit Konto verknüpft werden
      antwort: '',         // wird befüllt wenn Mandant antwortet
      beantwortet: false,
      datum: now,
      gesendetAm: null,    // Zeitpunkt des Versands an Mandant (wird in Komm. gesetzt)
    }))

    let updates = { rueckfragen: [...existingRQ, ...newRQs] }

    // Timeline-Event für den Verlauf
    const summary = selected.map(i => i.text).join(' · ')
    const newEvent = {
      id: 'e' + Date.now().toString(36),
      typ: 'rueckfragen',
      datum: toISO(pendingRQ.datum),
      notiz: `${selected.length} Rückfrage${selected.length !== 1 ? 'n' : ''} erstellt${summary.length < 100 ? ': ' + summary : ''}`,
      reminder: null,
    }
    updates.kommunikation = { ...komm, events: [newEvent, ...(komm.events ?? [])] }

    // Optional: E-Mail-Entwurf speichern
    if (withEmail && pendingRQ.emailText.trim()) {
      const stand = client.standDerArbeit ?? { emails: [] }
      const emailEntry = {
        id: 'em_' + Date.now().toString(36),
        betreff: pendingRQ.emailBetreff || `Rückfragen Jahresabschluss ${client.veranlagungsjahr ?? ''}`.trim(),
        text: pendingRQ.emailText,
        datum: new Date().toISOString(),
        gesendetAm: null,
      }
      updates.standDerArbeit = { ...stand, emails: [emailEntry, ...(stand.emails ?? [])] }
    }

    onUpdate(updates)
    setPendingRQ(null)
    showToast(`✓ ${selected.length} Rückfrage${selected.length !== 1 ? 'n' : ''} gespeichert${withEmail ? ' + E-Mail-Entwurf erstellt' : ''}`)
  }

  // ── E-Mail-Bereich ──
  const stand     = client.standDerArbeit ?? { emails: [] }
  const emails    = stand.emails ?? []
  const [showEmails,     setShowEmails]     = useState(false)
  const [quickLoading,   setQuickLoading]   = useState(null)
  const [showT3Edit,     setShowT3Edit]     = useState(false)
  const [template3Text,  setTemplate3Text]  = useState(loadTemplate3)
  const [t3Saved,        setT3Saved]        = useState(false)

  function updateEmail(id, changes) {
    const updated = emails.map(e => e.id === id ? { ...e, ...changes } : e)
    onUpdate({ standDerArbeit: { ...stand, emails: updated } })
  }

  function deleteEmail(id) {
    onUpdate({ standDerArbeit: { ...stand, emails: emails.filter(e => e.id !== id) } })
  }

  async function processEmail(text) {
    const parsed = await callClaude(PROMPT_EMAIL, text)
    const newEntry = { id: 'e' + Date.now().toString(36), betreff: parsed.betreff ?? 'E-Mail', text: parsed.text ?? '', datum: new Date().toISOString(), gesendetAm: null }
    onUpdate({ standDerArbeit: { ...stand, emails: [newEntry, ...emails] } })
    showToast('📧 E-Mail formuliert')
  }

  async function generateQuickEmail(type) {
    if (!loadApiKey()) { showToast('⚠ Bitte zuerst den Claude API-Schlüssel in den Stammdaten hinterlegen.'); return }
    const vj = [client.veranlagungsjahr, client.veranlagungsjahr2, client.veranlagungsjahr3].filter(Boolean).join('/')
    let userText = ''
    if (type === 'termin') {
      userText = `Erstelle eine freundliche E-Mail an den Mandanten "${client.name}" zur Terminvereinbarung. Jahresabschluss/Steuererklärung ${vj}. Bitte um Terminvorschläge. Herzlich und professionell.`
    } else if (type === 'jahresabschluss') {
      const t3 = loadTemplate3().trim()
      if (!t3) { setShowT3Edit(true); showToast('⚠ Bitte zuerst den Vorlage-Text hinterlegen.'); return }
      userText = t3
    }
    setQuickLoading(type)
    try {
      const parsed = await callClaude(PROMPT_EMAIL, userText)
      const newEntry = { id: 'e' + Date.now().toString(36), betreff: parsed.betreff ?? 'E-Mail', text: parsed.text ?? '', datum: new Date().toISOString(), gesendetAm: null }
      onUpdate({ standDerArbeit: { ...stand, emails: [newEntry, ...emails] } })
      setShowEmails(true)
      showToast('📧 E-Mail formuliert')
    } catch (e) { showToast('⚠ ' + e.message) }
    finally { setQuickLoading(null) }
  }

  // ── Styles ──
  const iStyle = {
    padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px',
    background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box',
  }

  // Rückfragen (aus client.rueckfragen)
  const rueckfragen = client.rueckfragen ?? []
  const offeneRQ = rueckfragen.filter(r => !r.beantwortet)
  const erledigteRQ = rueckfragen.filter(r => r.beantwortet)

  function fmtRQDatum(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
  }

  const hasApiKey = !!loadApiKey()

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '10px 16px', boxShadow: 'var(--shadow-lg)', fontSize: '13px', zIndex: 2000, maxWidth: '420px' }}>
          {toast}
        </div>
      )}

      {/* API-Key Hinweis */}
      {!hasApiKey && (
        <div style={{ padding: '8px 12px', background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '7px', fontSize: '12px', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🔑 <span>Claude API-Schlüssel fehlt — KI-Funktionen nicht verfügbar. Bitte unter <strong>🗂 Stammdaten → API-Schlüssel</strong> hinterlegen.</span>
        </div>
      )}

      {/* ══════════ RÜCKFRAGEN-ÜBERSICHT ══════════ */}
      {rueckfragen.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '9px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>📤</span>
            <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Rückfragen</span>
            {offeneRQ.length > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                {offeneRQ.length} offen
              </span>
            )}
            {offeneRQ.length === 0 && erledigteRQ.length > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '10px', background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                ✓ Alle beantwortet
              </span>
            )}
          </div>
          <div style={{ padding: '6px 0', maxHeight: '260px', overflowY: 'auto' }}>
            {rueckfragen.map((rq, i) => (
              <div key={rq.id ?? i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 14px',
                borderBottom: i < rueckfragen.length - 1 ? '1px solid var(--border)' : 'none',
                background: rq.beantwortet ? 'transparent' : 'rgba(239,68,68,0.02)',
              }}>
                <span style={{ fontSize: '14px', marginTop: '1px', flexShrink: 0 }}>
                  {rq.beantwortet ? '✅' : '❓'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: rq.beantwortet ? 400 : 600, color: rq.beantwortet ? 'var(--text-muted)' : 'var(--text)', textDecoration: rq.beantwortet ? 'line-through' : 'none', lineHeight: 1.4 }}>
                    {rq.text}
                  </div>
                  {rq.buchungskonto && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Konto: {rq.buchungskonto}
                    </div>
                  )}
                  {rq.antwort && (
                    <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '3px', background: 'rgba(22,163,74,0.06)', padding: '3px 8px', borderRadius: '4px' }}>
                      💬 {rq.antwort}
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {fmtRQDatum(rq.datum)}
                  </span>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '8px',
                    background: rq.beantwortet ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)',
                    color: rq.beantwortet ? '#16a34a' : '#ef4444',
                  }}>
                    {rq.beantwortet ? 'Beantwortet' : 'Offen'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {offeneRQ.length > 0 && (
            <div style={{ padding: '8px 14px', background: 'var(--surface)', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)' }}>
              💡 Rückfragen bearbeiten: <strong>📁 Abschluss → Rückfragen</strong>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════ STATUS BANNER ═══════════════════════ */}
      <StatusBanner events={events} />

      {/* ═══════════════════════ NEUE AKTIVITÄT ══════════════════════ */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>

        <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '13px' }}>➕ Aktivität erfassen</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>— per Schnellauswahl oder KI-Spracheingabe</span>
        </div>

        {/* Schnellauswahl-Chips */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Schnellauswahl</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {Object.entries(EVENT_TYPES).map(([key, cfg]) => {
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

        {/* Inline-Formular */}
        {selectedTyp && (() => {
          const cfg = EVENT_TYPES[selectedTyp]
          return (
            <div style={{ padding: '14px', background: cfg.color + '06', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px' }}>{cfg.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: cfg.color }}>{cfg.label}</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>Datum</label>
                  <input type="date" value={newDatum} onChange={e => setNewDatum(e.target.value)} style={iStyle} />
                </div>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px', display: 'block' }}>Notiz / Text (optional)</label>
                  <textarea
                    value={newNotiz}
                    onChange={e => setNewNotiz(e.target.value)}
                    placeholder="Beschreibung, E-Mail-Text, Notiz… Formatierung (Zeilenumbrüche) bleibt erhalten."
                    rows={4}
                    style={{ ...iStyle, width: '100%', resize: 'vertical', whiteSpace: 'pre-wrap', minHeight: '80px', boxSizing: 'border-box' }}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddEvent() }}
                    autoFocus
                  />
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>Strg+Enter zum Speichern</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={reminderActive} onChange={e => setReminderActive(e.target.checked)} style={{ width: '14px', height: '14px', accentColor: 'var(--accent)' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>⏰ Erinnerung in</span>
                </label>
                {reminderActive && (
                  <>
                    <input type="number" value={reminderTage} onChange={e => setReminderTage(Math.max(1, parseInt(e.target.value) || 7))} min="1" max="365" style={{ ...iStyle, width: '64px', textAlign: 'center' }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tagen</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 8px', borderRadius: '10px' }}>
                      {fmtDateShort(reminderDatum + 'T12:00:00')}
                    </span>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary btn-sm" onClick={handleAddEvent} style={{ fontWeight: 600 }}>✓ Hinzufügen</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedTyp(null)}>✕ Abbrechen</button>
              </div>
            </div>
          )
        })()}

        {/* KI-Spracheingabe */}
        <VoiceInputBlock
          placeholder={'Rückfragen sprechen, z.B.: "Erstelle Rückfragen: 1. Beleg 1.520 € vom 23.12. nachreichen 2. Warum ist Konto 8400 höher als Vorjahr"\nOder Aktivität: "Heute Telefonat mit Mandant, Unterlagen kommen nächste Woche"'}
          onProcess={processVoice}
        />
      </div>

      {/* ═══════════ PENDING RÜCKFRAGEN VORSCHAU ═══════════ */}
      {pendingRQ && (
        <PendingRueckfragenBlock
          pending={pendingRQ}
          onConfirm={confirmRueckfragen}
          onCancel={() => setPendingRQ(null)}
          onToggleItem={i => setPendingRQ(prev => ({
            ...prev,
            items: prev.items.map((item, idx) => idx === i ? { ...item, selected: !item.selected } : item),
          }))}
          onToggleEmail={() => setPendingRQ(prev => ({ ...prev, showEmail: !prev.showEmail }))}
          onUpdateEmailText={t => setPendingRQ(prev => ({ ...prev, emailText: t }))}
          onUpdateEmailBetreff={t => setPendingRQ(prev => ({ ...prev, emailBetreff: t }))}
        />
      )}

      {/* ═══════════ E-MAIL-ENTWÜRFE ═══════════ */}
      {emails.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div
            style={{ padding: '9px 14px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
            onClick={() => setShowEmails(v => !v)}
          >
            <span style={{ fontSize: '14px' }}>📧</span>
            <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>E-Mail-Entwürfe</span>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: '10px', background: 'var(--surface2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {emails.length}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{showEmails ? '▲' : '▼'}</span>
          </div>
          {showEmails && (
            <div style={{ padding: '10px 14px', background: 'var(--surface2)' }}>
              {emails.map(e => (
                <EmailCard key={e.id} entry={e} onDelete={id => deleteEmail(id)} onUpdate={updateEmail} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ SCHNELL E-MAILS GENERIEREN ═══════════ */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ padding: '9px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>⚡</span>
          <span style={{ fontWeight: 700, fontSize: '13px' }}>Schnell-E-Mails</span>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', gap: '8px', flexWrap: 'wrap', background: 'var(--surface2)' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '12px' }}
            onClick={() => generateQuickEmail('termin')}
            disabled={!!quickLoading}
          >
            {quickLoading === 'termin' ? '⏳…' : '📅 Terminanfrage'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '12px' }}
            onClick={() => generateQuickEmail('jahresabschluss')}
            disabled={!!quickLoading}
          >
            {quickLoading === 'jahresabschluss' ? '⏳…' : '📄 Jahresabschluss-Vorlage'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '11px', marginLeft: 'auto', opacity: 0.7 }}
            onClick={() => setShowT3Edit(v => !v)}
          >
            ⚙ Vorlage bearbeiten
          </button>
        </div>
        {showT3Edit && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>Beschreibe die gewünschte E-Mail – KI formuliert sie aus:</div>
            <textarea
              value={template3Text}
              onChange={e => setTemplate3Text(e.target.value)}
              rows={4}
              placeholder='z. B. "Freundliche E-Mail zum Jahresabschluss. Bitten um Einreichung der Unterlagen bis Ende des Monats."'
              style={{ width: '100%', padding: '8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button className="btn btn-primary btn-sm" onClick={() => { saveTemplate3(template3Text); setT3Saved(true); setTimeout(() => setT3Saved(false), 2000) }} style={{ fontSize: '11px' }}>
                {t3Saved ? '✓ Gespeichert' : '💾 Speichern'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowT3Edit(false)} style={{ fontSize: '11px' }}>Schließen</button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════ TIMELINE ════════════════════════════ */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Verlauf
          </span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface2)', padding: '1px 8px', borderRadius: '10px', border: '1px solid var(--border)' }}>
            {events.length}
          </span>
        </div>

        {events.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '40px 24px', background: 'var(--surface2)', borderRadius: 'var(--radius)', border: '2px dashed var(--border)' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px', opacity: 0.4 }}>🗓</div>
            Noch keine Aktivitäten erfasst.<br />
            <span style={{ fontSize: '12px', opacity: 0.7 }}>Erste Aktivität oben hinzufügen – per Schnellauswahl oder Spracheingabe.</span>
          </div>
        ) : (
          <div>
            {events.map((event, i) => (
              <TimelineItem
                key={event.id}
                event={event}
                isLast={i === events.length - 1}
                onDelete={deleteEvent}
                onToggleReminder={toggleReminder}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulseRec {
          0%, 100% { box-shadow: 0 0 0 4px rgba(239,68,68,0.25); }
          50%       { box-shadow: 0 0 0 8px rgba(239,68,68,0.08); }
        }
      `}</style>
    </div>
  )
}
