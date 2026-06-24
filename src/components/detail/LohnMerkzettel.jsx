/**
 * LohnMerkzettel.jsx – Zentrale Übersicht lohnrelevanter Besonderheiten je Mitarbeiter.
 *
 * Rein additiv: speichert ausschließlich in client.lohn.merkzettel.
 * Bestehende Daten (notizen etc.) werden nicht verändert.
 *
 * Eintrag: { id, mitarbeiter, hinweis, status, eingegangenAm, erledigtAm }
 *   status: 'offen' | 'in_bearbeitung' | 'erledigt'
 */
import { useState, useRef, useEffect } from 'react'
import { fmtDatum } from '../../utils/aufgaben.js'
import { callAI, hasAiKey } from '../../utils/aiClient.js'

const ACCENT = '#7c3aed'

const STATUS = {
  offen:          { label: 'Offen',          dot: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.35)' },
  in_bearbeitung: { label: 'In Bearbeitung', dot: '🟡', color: '#d97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.35)' },
  erledigt:       { label: 'Erledigt',       dot: '🟢', color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.35)' },
}
const ORDER = ['offen', 'in_bearbeitung', 'erledigt']

function todayInput() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function inputToIso(dateStr) {
  if (!dateStr) return new Date().toISOString()
  return new Date(dateStr + 'T12:00:00').toISOString()
}
function newId() { return 'lm' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36) }

// ── Diktat → KI: erzeugt strukturierte Merkzettel-Einträge ─────────────────────
function MerkzettelDiktat({ onEntries }) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript,  setTranscript]  = useState('')
  const [interim,     setInterim]     = useState('')
  const [kiLoading,   setKiLoading]   = useState(false)
  const [error,       setError]       = useState('')
  const [open,        setOpen]        = useState(false)
  const recRef = useRef(null)
  const tRef   = useRef('')

  const SpeechRec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => () => recRef.current?.stop(), [])

  function setT(v) { const nv = typeof v === 'function' ? v(tRef.current) : v; tRef.current = nv; setTranscript(nv) }

  function toggle() {
    if (isRecording) {
      recRef.current?.stop(); setIsRecording(false); setInterim('')
      if (tRef.current.trim()) process(tRef.current)
      return
    }
    setError('')
    if (!hasAiKey()) { setError('KI-Schlüssel fehlt (Stammdaten → ⚙️ → API-Schlüssel).'); return }
    if (!SpeechRec)  { setError('Spracherkennung nur in Chrome verfügbar.'); return }
    setT(''); setInterim('')
    const rec = new SpeechRec()
    rec.lang = 'de-DE'; rec.continuous = true; rec.interimResults = true
    rec.onresult = e => {
      let fin = '', itr = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + ' '
        else itr += e.results[i][0].transcript
      }
      if (fin) setT(t => t.trimEnd() ? t.trimEnd() + ' ' + fin : fin)
      setInterim(itr)
    }
    rec.onend   = () => { setIsRecording(false); setInterim('') }
    rec.onerror = () => { setIsRecording(false); setInterim(''); setError('Mikrofon-Fehler.') }
    rec.start(); recRef.current = rec; setIsRecording(true)
  }

  async function process(text) {
    if (!text.trim()) return
    setKiLoading(true); setError('')
    const sys = 'Du bist Assistent eines deutschen Steuerberaters für die Lohnbuchhaltung. ' +
      'Extrahiere aus dem gesprochenen Text strukturierte Merkzettel-Einträge für die nächste Lohnabrechnung. ' +
      'Pro genanntem Mitarbeiter ein eigener Eintrag. Formuliere den Hinweis knapp, klar und als Arbeitsanweisung ' +
      '(z. B. "Zusätzlich 5 Stunden berücksichtigen", "Vorschuss 500 € bereits ausgezahlt", "BG-Bescheinigung erstellen"). ' +
      'Antworte AUSSCHLIESSLICH mit JSON in der Form ' +
      '{"eintraege":[{"mitarbeiter":"<Name oder leer>","hinweis":"<knappe Anweisung>"}]}.'
    try {
      const res  = await callAI(sys, text.trim())
      const list = Array.isArray(res?.eintraege) ? res.eintraege
                 : Array.isArray(res)            ? res
                 : (res?.mitarbeiter || res?.hinweis) ? [res] : []
      const clean = list
        .map(e => ({ mitarbeiter: (e.mitarbeiter || '').trim(), hinweis: (e.hinweis || '').trim() }))
        .filter(e => e.hinweis)
      if (!clean.length) { setError('Kein verwertbarer Hinweis erkannt – bitte erneut versuchen.'); return }
      onEntries(clean)
      setT(''); setOpen(false)
    } catch (err) {
      setError('KI-Fehler: ' + err.message)
    } finally {
      setKiLoading(false)
    }
  }

  return (
    <div style={{ marginTop: '8px' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Diktat: Hinweis sprechen → KI erstellt strukturierte Einträge"
        style={{
          padding: '4px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
          border: `1px solid ${open ? 'rgba(239,68,68,0.4)' : 'rgba(8,145,178,0.3)'}`,
          background: open ? 'rgba(239,68,68,0.08)' : 'rgba(8,145,178,0.06)',
          color: open ? '#ef4444' : '#0891b2',
        }}
      >
        {isRecording ? '⏹ Aufnahme…' : '🎤 Per Diktat erfassen'}
      </button>

      {open && (
        <div style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '8px', background: isRecording ? 'rgba(239,68,68,0.05)' : 'rgba(8,145,178,0.04)', border: `1px solid ${isRecording ? 'rgba(239,68,68,0.25)' : 'rgba(8,145,178,0.2)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={toggle}
              disabled={kiLoading}
              style={{
                width: '38px', height: '38px', borderRadius: '50%', border: 'none', flexShrink: 0,
                background: isRecording ? '#ef4444' : '#0891b2', color: '#fff', fontSize: '17px',
                cursor: kiLoading ? 'wait' : 'pointer',
                animation: isRecording ? 'pulseDiktat 1.2s ease-in-out infinite' : 'none',
              }}
            >
              {isRecording ? '⏹' : kiLoading ? '⏳' : '🎤'}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: isRecording ? '#ef4444' : kiLoading ? ACCENT : '#0891b2' }}>
                {isRecording ? '● Aufnahme läuft – einfach sprechen…' : kiLoading ? 'KI erstellt Einträge…' : 'Diktat starten'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                z. B. „Für Max Mustermann nächsten Monat 5 Stunden zusätzlich berücksichtigen."
              </div>
            </div>
            {transcript.trim() && !isRecording && !kiLoading && (
              <button onClick={() => process(transcript)}
                style={{ padding: '5px 11px', borderRadius: '6px', border: 'none', background: '#0891b2', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                ✨ Verarbeiten
              </button>
            )}
          </div>

          {(transcript || isRecording) && (
            <div style={{ marginTop: '8px', padding: '6px 10px', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border)', fontSize: '11px', lineHeight: 1.6, color: 'var(--text)', minHeight: '30px' }}>
              {transcript}
              {interim && <span style={{ opacity: 0.5, fontStyle: 'italic', color: '#ef4444' }}>{transcript ? ' ' : ''}{interim}</span>}
            </div>
          )}
          {error && <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '6px' }}>⚠ {error}</div>}
        </div>
      )}
      <style>{`@keyframes pulseDiktat {0%,100%{box-shadow:0 0 0 4px rgba(239,68,68,0.2);}50%{box-shadow:0 0 0 9px rgba(239,68,68,0.04);}}`}</style>
    </div>
  )
}

// ── Einzelner Hinweis-Eintrag ──────────────────────────────────────────────────
function MerkEintrag({ eintrag, onCycle, onDelete, istHistorie }) {
  const st = STATUS[eintrag.status] ?? STATUS.offen
  return (
    <div style={{ padding: '9px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', alignItems: 'flex-start', opacity: istHistorie ? 0.85 : 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {eintrag.mitarbeiter
            ? <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>👤 {eintrag.mitarbeiter}</span>
            : <span style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--text-muted)' }}>Ohne Mitarbeiter-Zuordnung</span>}
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>📅 {fmtDatum(eintrag.eingegangenAm)}</span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5, marginTop: '3px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {eintrag.hinweis}
        </div>
        {eintrag.status === 'erledigt' && eintrag.erledigtAm && (
          <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600, marginTop: '3px' }}>✓ erledigt am {fmtDatum(eintrag.erledigtAm)}</div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', flexShrink: 0 }}>
        <button
          onClick={() => onCycle(eintrag.id, eintrag.status)}
          title="Status wechseln"
          style={{ fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', border: `1px solid ${st.border}`, background: st.bg, color: st.color, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {st.dot} {st.label}
        </button>
        <button
          onClick={() => onDelete(eintrag.id)}
          title="Eintrag löschen"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '0 2px' }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >🗑</button>
      </div>
    </div>
  )
}

export default function LohnMerkzettel({ client, onUpdate }) {
  const lohn      = client.lohn ?? {}
  const eintraege = Array.isArray(lohn.merkzettel) ? lohn.merkzettel : []

  const [showForm,    setShowForm]    = useState(false)
  const [mitarbeiter, setMitarbeiter] = useState('')
  const [hinweis,     setHinweis]     = useState('')
  const [datum,       setDatum]       = useState(todayInput())
  const [showHist,    setShowHist]    = useState(false)

  function save(next) { onUpdate({ lohn: { ...lohn, merkzettel: next } }) }

  function addManuell() {
    const h = hinweis.trim()
    if (!h) return
    const eintrag = { id: newId(), mitarbeiter: mitarbeiter.trim(), hinweis: h, status: 'offen', eingegangenAm: inputToIso(datum), erledigtAm: null }
    save([...eintraege, eintrag])
    setMitarbeiter(''); setHinweis(''); setDatum(todayInput()); setShowForm(false)
  }

  function addDiktat(list) {
    const neu = list.map(e => ({ id: newId(), mitarbeiter: e.mitarbeiter, hinweis: e.hinweis, status: 'offen', eingegangenAm: new Date().toISOString(), erledigtAm: null }))
    save([...eintraege, ...neu])
  }

  function cycle(id, current) {
    const nextStatus = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]
    save(eintraege.map(e => e.id !== id ? e : { ...e, status: nextStatus, erledigtAm: nextStatus === 'erledigt' ? new Date().toISOString() : null }))
  }

  function del(id) {
    if (!window.confirm('Diesen Hinweis wirklich löschen?')) return
    save(eintraege.filter(e => e.id !== id))
  }

  const aktive   = eintraege.filter(e => e.status !== 'erledigt')
  const historie = eintraege.filter(e => e.status === 'erledigt')
  const nOffen   = eintraege.filter(e => e.status === 'offen').length
  const nBearb   = eintraege.filter(e => e.status === 'in_bearbeitung').length
  const nErl     = historie.length

  const inputS = { width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: '#fff', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box' }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Header + Ampel */}
      <div style={{ background: ACCENT, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '16px' }}>📋</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Lohn-Merkzettel</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.18)', padding: '2px 9px', borderRadius: '10px', fontWeight: 700 }}>🔴 {nOffen} offen</span>
          <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.18)', padding: '2px 9px', borderRadius: '10px', fontWeight: 700 }}>🟡 {nBearb} in Bearbeitung</span>
          <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.18)', padding: '2px 9px', borderRadius: '10px', fontWeight: 700 }}>🟢 {nErl} erledigt</span>
        </div>
      </div>

      {/* Erfassen */}
      <div style={{ padding: '10px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
        {!showForm ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => setShowForm(true)}
              style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: ACCENT, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              + Hinweis erfassen
            </button>
            <MerkzettelDiktat onEntries={addDiktat} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input value={mitarbeiter} onChange={e => setMitarbeiter(e.target.value)} placeholder="Mitarbeiter (Name)" style={{ ...inputS, flex: '2 1 180px' }} />
              <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={{ ...inputS, flex: '1 1 130px' }} />
            </div>
            <textarea value={hinweis} onChange={e => setHinweis(e.target.value)} rows={2}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addManuell() } }}
              placeholder="Hinweis zur nächsten Lohnabrechnung… (Strg+Enter zum Speichern)"
              style={{ ...inputS, resize: 'vertical', lineHeight: 1.5 }} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={addManuell} disabled={!hinweis.trim()}
                style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: hinweis.trim() ? ACCENT : 'var(--border)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: hinweis.trim() ? 'pointer' : 'not-allowed' }}>
                Speichern
              </button>
              <button onClick={() => { setShowForm(false); setMitarbeiter(''); setHinweis('') }}
                style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Aktive Hinweise */}
      <div style={{ background: 'var(--surface)' }}>
        {aktive.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
            Keine offenen Hinweise. {nErl > 0 ? 'Erledigte siehe Historie unten.' : ''}
          </div>
        ) : (
          aktive.map(e => <MerkEintrag key={e.id} eintrag={e} onCycle={cycle} onDelete={del} />)
        )}
      </div>

      {/* Historie (erledigt) */}
      {historie.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={() => setShowHist(v => !v)}
            style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: 'var(--surface2)', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ transform: showHist ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▸</span>
            Historie – erledigte Hinweise ({historie.length})
          </button>
          {showHist && (
            <div>
              {[...historie]
                .sort((a, b) => (b.erledigtAm || '').localeCompare(a.erledigtAm || ''))
                .map(e => <MerkEintrag key={e.id} eintrag={e} onCycle={cycle} onDelete={del} istHistorie />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
