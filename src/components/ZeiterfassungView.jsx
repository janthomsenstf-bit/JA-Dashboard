/**
 * ZeiterfassungView – Globales Zeit-Logbuch (mandantenunabhängig) im Kalender-Stil.
 * Wochen-/Tagesansicht mit Blättern, Klick auf einen Tag erfasst Zeit für dieses
 * Datum (auch rückwirkend). Schnell per Sprache oder manuell.
 */
import { useState, useRef, useMemo } from 'react'
import { callAI, hasAiKey } from '../utils/aiClient.js'

const ACCENT = '#0891b2'
const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

// ── Datums-Helfer (lokal, ohne UTC-Verschiebung) ──────────────────────────────────
function pad(n) { return String(n).padStart(2, '0') }
function isoOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function parseISO(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d) }
function todayISO() { return isoOf(new Date()) }
function addDays(s, n) { const d = parseISO(s); d.setDate(d.getDate() + n); return isoOf(d) }
function startOfWeek(s) { const d = parseISO(s); const off = (d.getDay() + 6) % 7; d.setDate(d.getDate() - off); return isoOf(d) }
function weekDates(anchor) { const mon = startOfWeek(anchor); return Array.from({ length: 7 }, (_, i) => addDays(mon, i)) }
function deDate(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? `${m[3]}.${m[2]}.${m[1]}` : String(s || '') }
function ddmm(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? `${m[3]}.${m[2]}.` : '' }
function langDatum(s) { const d = parseISO(s); return `${TAGE[(d.getDay() + 6) % 7]}, ${deDate(s)}` }
function isoWeek(s) {
  const [y, m, d] = String(s).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dayNum = (dt.getUTCDay() + 6) % 7
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3)
  const firstThu = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((dt - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7)
}
function fmtStd(min) { return ((min || 0) / 60).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) }
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
async function parseDiktat(text, fallbackDatum) {
  const local = { datum: fallbackDatum || todayISO(), dauerMin: parseDauerMin(text), beschreibung: stripDauer(text) || (text || '').trim(), projekt: '' }
  if (hasAiKey()) {
    try {
      const sys = `Du wandelst eine kurze deutsche Sprachnotiz eines Steuerberaters in einen Zeit-Logbuch-Eintrag um. Bezugsdatum (falls keine Angabe): ${fallbackDatum || todayISO()}. Antworte ausschließlich mit JSON: {"dauerMin": <Minuten als Ganzzahl>, "beschreibung": "<knappe Tätigkeit ohne Dauerangabe>", "projekt": "<Mandant/Projekt falls genannt, sonst leer>", "datum": "YYYY-MM-DD"}. Beispiele: "zwei Stunden Belege gebucht" -> 120; "halbe Stunde Telefonat mit Müller" -> 30, projekt "Müller". Bei relativen Angaben wie "gestern" das Datum berechnen, sonst Bezugsdatum.`
      const r = await callAI(sys, text)
      const datum = /^\d{4}-\d{2}-\d{2}$/.test(r?.datum || '') ? r.datum : local.datum
      let dauerMin = Math.max(0, Math.round(Number(r?.dauerMin) || 0)) || local.dauerMin
      let beschreibung = String(r?.beschreibung || '').trim() || local.beschreibung
      if (dauerMin || beschreibung) return { datum, dauerMin, beschreibung, projekt: String(r?.projekt || '').trim() }
    } catch { /* lokal */ }
  }
  return local
}

// ── Styles ──────────────────────────────────────────────────────────────────────
const inputBase = { width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box' }
const lblStyle = { fontSize: '10px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }
const btnGhost = { padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer' }
const btnPrimary = { padding: '6px 16px', borderRadius: '6px', border: 'none', background: ACCENT, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }
const navBtn = { width: '30px', height: '30px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }

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
function CaptureCard({ draft, editing, onSave, onClose }) {
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
      const p = await parseDiktat(text, datum)
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
  function handleSave() { if (canSave) onSave({ datum, dauerMin, beschreibung: besch.trim(), projekt: projekt.trim() }) }

  return (
    <div style={{ border: `2px solid ${ACCENT}55`, borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ background: ACCENT, color: '#fff', padding: '9px 14px', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '15px' }}>⏱</span>
        {editing ? 'Eintrag bearbeiten' : `Zeit erfassen · ${langDatum(datum)}`}
        <button onClick={onClose} title="Schließen" style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '6px', width: '24px', height: '24px', cursor: 'pointer', fontSize: '13px' }}>✕</button>
      </div>
      <div style={{ padding: '14px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '150px 110px 1fr', gap: '10px' }}>
          <div><div style={lblStyle}>Datum</div><input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={inputBase} /></div>
          <div><div style={lblStyle}>Dauer (Std.) *</div><input type="text" inputMode="decimal" value={stdVal} onChange={e => setStdVal(e.target.value)} placeholder="1,5" style={inputBase} /></div>
          <div><div style={lblStyle}>Für (Mandant/Projekt)</div><input value={projekt} onChange={e => setProjekt(e.target.value)} placeholder="optional" style={inputBase} /></div>
        </div>
        <div><div style={lblStyle}>Tätigkeit *</div><input value={besch} onChange={e => setBesch(e.target.value)} placeholder="z. B. Belege gebucht, Buchhaltung Juni vorbereitet" style={inputBase} /></div>
        {dauerMin > 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>= {fmtStd(dauerMin)} Std</div>}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>Abbrechen</button>
          <button onClick={handleSave} disabled={!canSave} style={{ ...btnPrimary, opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'not-allowed' }}>
            {editing ? 'Speichern' : '+ Eintragen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Kompakter Eintrag (Wochenzelle) ────────────────────────────────────────────────
function MiniEntry({ e, onClick }) {
  const abger = e.status === 'abgerechnet'
  return (
    <button onClick={onClick} title={`${fmtStd(e.dauerMin)} Std · ${e.beschreibung}${e.projekt ? ' · ' + e.projekt : ''}`}
      style={{ display: 'block', width: '100%', textAlign: 'left', border: '1px solid var(--border)', borderLeft: `3px solid ${abger ? '#94a3b8' : ACCENT}`, borderRadius: '5px', background: 'var(--surface)', padding: '4px 6px', cursor: 'pointer', opacity: abger ? 0.6 : 1 }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: abger ? 'var(--text-muted)' : ACCENT }}>{fmtStd(e.dauerMin)} Std</div>
      <div style={{ fontSize: '11px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.beschreibung}</div>
      {e.projekt && <div style={{ fontSize: '10px', color: '#7c3aed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.projekt}</div>}
    </button>
  )
}

// ── Hauptansicht ──────────────────────────────────────────────────────────────────
export default function ZeiterfassungView({ entries = [], onChange }) {
  const [view, setView] = useState('woche')          // 'woche' | 'tag'
  const [anchor, setAnchor] = useState(todayISO())   // Bezugstag der Ansicht
  const [captureDate, setCaptureDate] = useState(null)
  const [editId, setEditId] = useState(null)
  const [nonce, setNonce] = useState(0)

  const today = todayISO()
  const editEntry = editId ? entries.find(e => e.id === editId) : null

  const byDay = useMemo(() => {
    const m = {}
    entries.forEach(e => { (m[e.datum] ??= []).push(e) })
    Object.values(m).forEach(arr => arr.sort((a, b) => String(a.erstelltAm).localeCompare(String(b.erstelltAm))))
    return m
  }, [entries])

  const offenMin = useMemo(() => entries.filter(e => e.status !== 'abgerechnet').reduce((s, e) => s + (e.dauerMin || 0), 0), [entries])
  const dayMin = d => (byDay[d] || []).reduce((s, e) => s + (e.dauerMin || 0), 0)

  const days = view === 'woche' ? weekDates(anchor) : [anchor]
  const wochenSumme = days.reduce((s, d) => s + dayMin(d), 0)

  function save(data) {
    if (editId) onChange(entries.map(e => e.id === editId ? { ...e, ...data } : e))
    else onChange([...entries, { ...mkEntry(), ...data }])
    if (editId) { setEditId(null) }
    else { setNonce(n => n + 1) } // Formular für weitere Einträge am selben Tag offen halten
  }
  function del(id) { onChange(entries.filter(e => e.id !== id)); setEditId(null) }
  function setStatus(id, status) { onChange(entries.map(e => e.id === id ? { ...e, status } : e)) }
  function openCapture(d) { setEditId(null); setCaptureDate(d) }
  function shift(n) { setAnchor(a => addDays(a, n)) }

  const navLabel = view === 'woche'
    ? `KW ${isoWeek(days[0])} · ${ddmm(days[0])}–${deDate(days[6])}`
    : langDatum(anchor)

  return (
    <div style={{ padding: '20px', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⏱</span> Zeiterfassung
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          Klick auf einen Tag, um Zeit zu erfassen – auch rückwirkend. Per Sprache oder manuell. Mandantenunabhängiges Logbuch.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <Kpi label="Heute" wert={`${fmtStd(dayMin(today))} Std`} />
        <Kpi label={view === 'woche' ? 'Angezeigte Woche' : 'Angezeigter Tag'} wert={`${fmtStd(wochenSumme)} Std`} sub={navLabel} />
        <Kpi label="Offen gesamt" wert={`${fmtStd(offenMin)} Std`} sub="noch nicht abgerechnet" />
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={() => shift(view === 'woche' ? -7 : -1)} style={navBtn} title="Zurück">‹</button>
        <button onClick={() => setAnchor(today)} style={{ ...btnGhost, padding: '6px 12px', fontSize: '12px' }}>Heute</button>
        <button onClick={() => shift(view === 'woche' ? 7 : 1)} style={navBtn} title="Weiter">›</button>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginLeft: '6px' }}>{navLabel}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          {['woche', 'tag'].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '5px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${view === v ? ACCENT : 'var(--border)'}`, background: view === v ? `${ACCENT}14` : 'transparent', color: view === v ? ACCENT : 'var(--text-secondary)' }}>
              {v === 'woche' ? 'Woche' : 'Tag'}
            </button>
          ))}
        </div>
      </div>

      {/* Erfassungs-/Bearbeiten-Formular */}
      {(captureDate || editId) && (
        <CaptureCard
          key={editId ? `edit-${editId}` : `new-${captureDate}-${nonce}`}
          draft={editEntry || { datum: captureDate }}
          editing={!!editId}
          onSave={save}
          onClose={() => { setCaptureDate(null); setEditId(null) }}
        />
      )}

      {/* Wochenraster */}
      {view === 'woche' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: '8px', overflowX: 'auto' }}>
          {days.map(d => {
            const items = byDay[d] || []
            const isToday = d === today
            return (
              <div key={d} style={{ border: `1px solid ${isToday ? ACCENT : 'var(--border)'}`, borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: '120px', background: 'var(--surface2)' }}>
                <button onClick={() => openCapture(d)} title="Zeit für diesen Tag erfassen"
                  style={{ border: 'none', borderBottom: '1px solid var(--border)', background: isToday ? `${ACCENT}14` : 'var(--surface)', cursor: 'pointer', padding: '6px 8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: isToday ? ACCENT : 'var(--text)' }}>{TAGE[(parseISO(d).getDay() + 6) % 7]} {ddmm(d)}</span>
                  {dayMin(d) > 0 && <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, color: ACCENT }}>{fmtStd(dayMin(d))}h</span>}
                  <span style={{ marginLeft: dayMin(d) > 0 ? '4px' : 'auto', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1 }}>＋</span>
                </button>
                <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                  {items.length === 0
                    ? <button onClick={() => openCapture(d)} style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer', padding: '4px', textAlign: 'center' }}>+ erfassen</button>
                    : items.map(e => <MiniEntry key={e.id} e={e} onClick={() => { setCaptureDate(null); setEditId(e.id) }} />)}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Tagesansicht */
        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '9px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{langDatum(anchor)}</span>
            {anchor === today && <span style={{ fontSize: '10px', background: `${ACCENT}1a`, color: ACCENT, padding: '1px 7px', borderRadius: '8px', fontWeight: 700 }}>heute</span>}
            <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: ACCENT }}>{fmtStd(dayMin(anchor))} Std</span>
            <button onClick={() => openCapture(anchor)} style={{ ...btnPrimary, padding: '4px 12px', fontSize: '11px' }}>+ erfassen</button>
          </div>
          <div style={{ background: 'var(--surface2)' }}>
            {(byDay[anchor] || []).length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Keine Einträge an diesem Tag.</div>
            ) : (byDay[anchor]).map(e => {
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
                  <button onClick={() => { setCaptureDate(null); setEditId(e.id) }} title="Bearbeiten" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', padding: '2px 3px', flexShrink: 0 }}>✏️</button>
                  <button onClick={() => del(e.id)} title="Löschen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', padding: '2px 3px', flexShrink: 0 }}>🗑</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {view === 'woche' && (
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
          💡 Tag anklicken zum Erfassen · Eintrag anklicken zum Bearbeiten · Statuswechsel (offen/abgerechnet) in der Tagesansicht.
        </p>
      )}
    </div>
  )
}
