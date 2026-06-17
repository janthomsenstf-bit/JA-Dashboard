/**
 * ZeiterfassungView – Globales Zeit-Logbuch (mandantenunabhängig).
 * Schnell per Sprache oder manuell erfassen, was am Tag erledigt wurde.
 * Rückwirkende Erfassung über das Datumsfeld. Nach Tagen gruppiert mit Tagessummen.
 */
import { useState, useRef, useMemo } from 'react'
import { callAI, hasAiKey } from '../utils/aiClient.js'

const ACCENT = '#0891b2'

// ── Datums-/Zeit-Helfer ─────────────────────────────────────────────────────────
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function weekStartISO() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // Montag = 0
  d.setDate(d.getDate() - day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function deDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(s || '')
}
function wochentag(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''))
  if (!m) return ''
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()]
}
function fmtStd(min) {
  return ((min || 0) / 60).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}
function mkEntry() {
  return { id: 'zl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), datum: todayISO(), dauerMin: 0, beschreibung: '', projekt: '', status: 'offen', erstelltAm: new Date().toISOString() }
}

// ── Diktat-Parser (lokaler Fallback) ────────────────────────────────────────────
function parseGermanNum(tok) {
  if (tok == null) return null
  const s = String(tok).toLowerCase()
  if (/^\d+([.,]\d+)?$/.test(s)) return parseFloat(s.replace(',', '.'))
  const map = { ein: 1, eine: 1, einen: 1, einer: 1, zwei: 2, drei: 3, vier: 4, 'fünf': 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, 'zwölf': 12, zwoelf: 12, halbe: 0.5, anderthalb: 1.5, eineinhalb: 1.5, zweieinhalb: 2.5, dreiviertel: 0.75, 'fünfzehn': 15, fuenfzehn: 15, zwanzig: 20, 'dreißig': 30, dreissig: 30, 'fünfundvierzig': 45, fuenfundvierzig: 45 }
  return map[s] ?? null
}
const RE_STD = /(\d+(?:[.,]\d+)?|eineinhalb|anderthalb|zweieinhalb|dreiviertel|halbe|eine|einen|einer|ein|zwei|drei|vier|fünf|fuenf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwoelf)\s*(?:stunden|stunde|std\.?|h)\b/i
const RE_MIN = /(\d+|fünfundvierzig|fuenfundvierzig|fünfzehn|fuenfzehn|dreißig|dreissig|zwanzig|zehn)\s*(?:minuten|minute|min\.?)\b/i
function parseDauerMin(text) {
  const t = ' ' + (text || '') + ' '
  let min = 0
  const hm = t.match(RE_STD); if (hm) { const v = parseGermanNum(hm[1]); if (v != null) min += Math.round(v * 60) }
  const mm = t.match(RE_MIN); if (mm) { const v = parseGermanNum(mm[1]); if (v != null) min += Math.round(v) }
  return min
}
function stripDauer(text) {
  return (text || '')
    .replace(new RegExp(RE_STD.source, 'gi'), '')
    .replace(new RegExp(RE_MIN.source, 'gi'), '')
    .replace(/\b(und|ca\.?|circa|etwa|ungefähr|ungefaehr)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ').trim().replace(/^[,\-–·\s]+/, '').trim()
}
function parseLocal(text) {
  return { datum: todayISO(), dauerMin: parseDauerMin(text), beschreibung: stripDauer(text) || (text || '').trim() }
}
async function parseDiktat(text) {
  if (hasAiKey()) {
    try {
      const sys = `Du wandelst eine kurze deutsche Sprachnotiz eines Steuerberaters in einen Zeit-Logbuch-Eintrag um. Heutiges Datum: ${todayISO()}. Antworte ausschließlich mit JSON: {"dauerMin": <Minuten als Ganzzahl>, "beschreibung": "<knappe Tätigkeit ohne Dauerangabe>", "projekt": "<Mandant/Projekt falls genannt, sonst leer>", "datum": "YYYY-MM-DD"}. Beispiele: "zwei Stunden Belege gebucht" -> 120; "halbe Stunde Telefonat mit Müller" -> 30, projekt "Müller". Bei relativen Angaben wie "gestern" das passende Datum berechnen, sonst heutiges Datum.`
      const r = await callAI(sys, text)
      const datum = /^\d{4}-\d{2}-\d{2}$/.test(r?.datum || '') ? r.datum : todayISO()
      let dauerMin = Math.max(0, Math.round(Number(r?.dauerMin) || 0))
      let beschreibung = String(r?.beschreibung || '').trim()
      if (!dauerMin) dauerMin = parseDauerMin(text)
      if (!beschreibung) beschreibung = stripDauer(text)
      if (dauerMin || beschreibung) return { datum, dauerMin, beschreibung, projekt: String(r?.projekt || '').trim() }
    } catch { /* fällt auf lokalen Parser zurück */ }
  }
  return parseLocal(text)
}

// ── Styles ──────────────────────────────────────────────────────────────────────
const inputBase = { width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box' }
const lblStyle = { fontSize: '10px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }
const btnGhost = { padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer' }
const btnPrimary = { padding: '6px 16px', borderRadius: '6px', border: 'none', background: ACCENT, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', padding: '2px 3px', flexShrink: 0 }

function Kpi({ label, wert, sub }) {
  return (
    <div style={{ border: `1px solid ${ACCENT}33`, borderRadius: '10px', padding: '12px 16px', background: `${ACCENT}08`, minWidth: 0 }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{wert}</div>
      {sub && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

// ── Erfassungsformular (mit Sprache) ──────────────────────────────────────────────
function CaptureCard({ draft, editing, onSave, onCancel }) {
  const [datum, setDatum] = useState(draft?.datum || todayISO())
  const [stdVal, setStdVal] = useState(draft?.dauerMin ? String(draft.dauerMin / 60).replace('.', ',') : '')
  const [besch, setBesch] = useState(draft?.beschreibung || '')
  const [projekt, setProjekt] = useState(draft?.projekt || '')
  const [transcript, setTranscript] = useState('')
  const [isRec, setIsRec] = useState(false)
  const [interim, setInterim] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const recRef = useRef(null)
  const textRef = useRef('')
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  function setT(val) { const v = typeof val === 'function' ? val(textRef.current) : val; textRef.current = v; setTranscript(v) }
  function toggle() {
    if (isRec) { recRef.current?.stop(); setIsRec(false); setInterim(''); return }
    if (!SR) return
    const r = new SR(); r.lang = 'de-DE'; r.continuous = true; r.interimResults = true
    r.onresult = e => {
      let fin = '', int = ''
      for (let i = e.resultIndex; i < e.results.length; i++) e.results[i].isFinal ? fin += e.results[i][0].transcript : int += e.results[i][0].transcript
      if (fin) setT(t => t.trimEnd() ? t.trimEnd() + ' ' + fin : fin)
      setInterim(int)
    }
    r.onend = () => { setIsRec(false); setInterim('') }
    r.onerror = () => { setIsRec(false); setInterim(''); setError('Mikrofon-Fehler – Berechtigung prüfen.') }
    r.start(); recRef.current = r; setIsRec(true); setError('')
  }
  async function aufbereiten() {
    const text = transcript.trim(); if (!text) return
    setBusy(true); setError('')
    try {
      const p = await parseDiktat(text)
      if (p.datum) setDatum(p.datum)
      if (p.dauerMin) setStdVal(String(p.dauerMin / 60).replace('.', ','))
      if (p.beschreibung) setBesch(p.beschreibung)
      if (p.projekt) setProjekt(p.projekt)
      setT('')
    } catch (e) { setError(e.message || 'Fehler bei der Aufbereitung.') }
    finally { setBusy(false) }
  }

  const dauerMin = Math.round((parseFloat(String(stdVal).replace(',', '.')) || 0) * 60)
  const canSave = dauerMin > 0 && besch.trim()

  return (
    <div style={{ border: `1px solid var(--border)`, borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ background: ACCENT, color: '#fff', padding: '10px 14px', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>⏱</span>{editing ? 'Eintrag bearbeiten' : 'Neue Zeit erfassen'}
      </div>
      <div style={{ padding: '14px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Sprache */}
        {!editing && (
          <div style={{ border: `1px dashed ${ACCENT}55`, borderRadius: '8px', padding: '10px 12px', background: `${ACCENT}08` }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: ACCENT, marginBottom: '8px' }}>
              🎤 Per Sprache erfassen{!hasAiKey() && ' · ohne KI-Schlüssel: einfache Erkennung'}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <button onClick={toggle} disabled={!SR} title={!SR ? 'Browser unterstützt keine Spracheingabe' : (isRec ? 'Stopp' : 'Aufnahme starten')}
                style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', flexShrink: 0, cursor: SR ? 'pointer' : 'not-allowed', background: isRec ? '#ef4444' : ACCENT, color: '#fff', fontSize: '15px' }}>
                {isRec ? '⏹' : '🎙'}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <textarea value={transcript} onChange={e => setT(e.target.value)} rows={2}
                  placeholder={isRec ? '🎤 Aufnahme läuft…' : 'z. B. „Zwei Stunden Belege gebucht für Müller GmbH"'}
                  style={{ ...inputBase, resize: 'none', lineHeight: 1.5 }} />
                {interim && <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>{interim}</div>}
                {error && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>⚠ {error}</div>}
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '6px' }}>
                  {transcript && <button onClick={() => setT('')} style={btnGhost}>✕ Löschen</button>}
                  <button onClick={aufbereiten} disabled={!transcript.trim() || busy} style={{ ...btnPrimary, padding: '5px 14px', fontSize: '11px', opacity: (!transcript.trim() || busy) ? 0.5 : 1 }}>
                    {busy ? '⏳ …' : '✨ Aufbereiten'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Felder */}
        <div style={{ display: 'grid', gridTemplateColumns: '150px 110px 1fr', gap: '10px' }}>
          <div><div style={lblStyle}>Datum</div><input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={inputBase} /></div>
          <div><div style={lblStyle}>Dauer (Std.) *</div><input type="text" inputMode="decimal" value={stdVal} onChange={e => setStdVal(e.target.value)} placeholder="1,5" style={inputBase} /></div>
          <div><div style={lblStyle}>Für (Mandant/Projekt)</div><input value={projekt} onChange={e => setProjekt(e.target.value)} placeholder="optional" style={inputBase} /></div>
        </div>
        <div><div style={lblStyle}>Tätigkeit *</div><input value={besch} onChange={e => setBesch(e.target.value)} placeholder="z. B. Belege gebucht, Buchhaltung Juni vorbereitet" style={inputBase} /></div>
        {dauerMin > 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>= {fmtStd(dauerMin)} Std</div>}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          {editing && <button onClick={onCancel} style={btnGhost}>Abbrechen</button>}
          <button onClick={() => canSave && onSave({ datum, dauerMin, beschreibung: besch.trim(), projekt: projekt.trim() })} disabled={!canSave}
            style={{ ...btnPrimary, opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'not-allowed' }}>
            {editing ? 'Speichern' : '+ Eintragen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Hauptansicht ──────────────────────────────────────────────────────────────────
export default function ZeiterfassungView({ entries = [], onChange }) {
  const [editId, setEditId] = useState(null)
  const [nurOffen, setNurOffen] = useState(false)

  const editEntry = editId ? entries.find(e => e.id === editId) : null

  function save(data) {
    if (editId) onChange(entries.map(e => e.id === editId ? { ...e, ...data } : e))
    else onChange([...entries, { ...mkEntry(), ...data }])
    setEditId(null)
  }
  function del(id) { onChange(entries.filter(e => e.id !== id)) }
  function setStatus(id, status) { onChange(entries.map(e => e.id === id ? { ...e, status } : e)) }

  const today = todayISO()
  const wStart = weekStartISO()
  const kpi = useMemo(() => {
    let heute = 0, woche = 0, offen = 0
    entries.forEach(e => {
      const m = e.dauerMin || 0
      if (e.datum === today) heute += m
      if (e.datum >= wStart && e.datum <= today) woche += m
      if (e.status !== 'abgerechnet') offen += m
    })
    return { heute, woche, offen }
  }, [entries, today, wStart])

  // Nach Tag gruppieren (neueste zuerst)
  const groups = useMemo(() => {
    const list = nurOffen ? entries.filter(e => e.status !== 'abgerechnet') : entries
    const byDay = {}
    list.forEach(e => { (byDay[e.datum] ??= []).push(e) })
    return Object.keys(byDay).sort((a, b) => b.localeCompare(a)).map(datum => {
      const items = byDay[datum].slice().sort((a, b) => String(b.erstelltAm).localeCompare(String(a.erstelltAm)))
      const summe = items.reduce((s, e) => s + (e.dauerMin || 0), 0)
      return { datum, items, summe }
    })
  }, [entries, nurOffen])

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⏱</span> Zeiterfassung
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          Schnell festhalten, was du erledigt hast – per Sprache oder manuell, auch rückwirkend. Mandantenunabhängiges Logbuch.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <Kpi label="Heute" wert={`${fmtStd(kpi.heute)} Std`} />
        <Kpi label="Diese Woche" wert={`${fmtStd(kpi.woche)} Std`} sub="seit Montag" />
        <Kpi label="Offen gesamt" wert={`${fmtStd(kpi.offen)} Std`} sub="noch nicht abgerechnet" />
      </div>

      {/* Erfassung */}
      <CaptureCard
        key={editId || 'neu'}
        draft={editEntry}
        editing={!!editId}
        onSave={save}
        onCancel={() => setEditId(null)}
      />

      {/* Liste */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>Verlauf</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)', userSelect: 'none' }}>
          <input type="checkbox" checked={nurOffen} onChange={e => setNurOffen(e.target.checked)} style={{ accentColor: ACCENT, cursor: 'pointer' }} />
          nur offene
        </label>
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '10px' }}>
          Noch keine Einträge – oben per Sprache oder manuell erfassen.
        </div>
      ) : (
        groups.map(g => (
          <div key={g.datum} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '8px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{wochentag(g.datum)}, {deDate(g.datum)}</span>
              {g.datum === today && <span style={{ fontSize: '10px', background: `${ACCENT}1a`, color: ACCENT, padding: '1px 7px', borderRadius: '8px', fontWeight: 700 }}>heute</span>}
              <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: ACCENT }}>{fmtStd(g.summe)} Std</span>
            </div>
            <div style={{ background: 'var(--surface2)' }}>
              {g.items.map(e => {
                const abger = e.status === 'abgerechnet'
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', borderBottom: '1px solid var(--border)', opacity: abger ? 0.65 : 1 }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: ACCENT, width: '58px', flexShrink: 0, whiteSpace: 'nowrap' }}>{fmtStd(e.dauerMin)} Std</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '12px', color: 'var(--text)' }}>{e.beschreibung}</span>
                      {e.projekt && <span style={{ marginLeft: '8px', fontSize: '10px', background: 'rgba(124,58,237,0.1)', color: '#7c3aed', padding: '1px 7px', borderRadius: '8px', fontWeight: 600 }}>{e.projekt}</span>}
                    </div>
                    {abger
                      ? <span style={{ fontSize: '10px', background: 'rgba(100,116,139,0.15)', color: '#64748b', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, flexShrink: 0 }}>abgerechnet</span>
                      : <span style={{ fontSize: '10px', background: `${ACCENT}1f`, color: ACCENT, padding: '2px 8px', borderRadius: '10px', fontWeight: 600, flexShrink: 0 }}>offen</span>}
                    <button onClick={() => setStatus(e.id, abger ? 'offen' : 'abgerechnet')} title={abger ? 'Wieder offen' : 'Als abgerechnet markieren'}
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '2px 8px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{abger ? '↩' : '✓'}</button>
                    <button onClick={() => setEditId(e.id)} title="Bearbeiten" style={iconBtn}>✏️</button>
                    <button onClick={() => del(e.id)} title="Löschen" style={iconBtn}>🗑</button>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
