/**
 * SusaTab.jsx – Abschluss (SuSa)
 * Kontoorientierte Jahresabschlussbearbeitung auf Basis einer hochgeladenen SuSa.
 * Split-View: Blockliste links · Konto-Detailpanel rechts
 */
import { useState, useRef, useCallback } from 'react'
import { parseSusaFile, buildImportStats } from '../../utils/susaParser.js'
import { SUSA_BLOCKS, BLOCK_MAP } from '../../utils/susaKontenConfig.js'

// ── API-Key ───────────────────────────────────────────────────────────────────
const APIKEY_KEY = 'sda-claude-api-key'
function loadApiKey() { return (localStorage.getItem(APIKEY_KEY) ?? '').replace(/\s/g, '') }

async function callClaudeText(systemPrompt, userText) {
  const key = loadApiKey()
  if (!key) throw new Error('Kein Claude API-Schlüssel hinterlegt (Tab Stammdaten → API-Schlüssel).')
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
      system: systemPrompt,
      messages: [{ role: 'user', content: userText }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `HTTP ${res.status}`)
  }
  const d = await res.json()
  return (d.content?.[0]?.text ?? '').trim()
}

// ── Formatierungen ────────────────────────────────────────────────────────────
function fmtEur(n) {
  if (n === null || n === undefined) return '–'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
}
function genId() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }

// ── Status-Konfiguration ─────────────────────────────────────────────────────
const KONTO_STATUS = {
  offen:     { label: 'Offen',    icon: '○', color: '#64748b', bg: 'transparent' },
  geprueft:  { label: 'Geprüft',  icon: '✓', color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  rueckfrage:{ label: 'Rückfrage',icon: '❓', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  erledigt:  { label: 'Erledigt', icon: '✅', color: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
}

// ════════════════════════════════════════════════════════════════════════════
// IMPORT-MODAL
// ════════════════════════════════════════════════════════════════════════════

function ImportModal({ onImport, onClose }) {
  const [phase,   setPhase]   = useState('idle')   // idle | parsing | preview | error
  const [error,   setError]   = useState('')
  const [result,  setResult]  = useState(null)
  const [stats,   setStats]   = useState(null)
  const [dragging, setDrag]   = useState(false)
  const fileRef = useRef()

  async function handleFile(file) {
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('Nur Excel-Dateien (.xlsx, .xls) oder CSV werden unterstützt.')
      return
    }
    setPhase('parsing')
    setError('')
    try {
      const parsed = await parseSusaFile(file)
      setResult(parsed)
      setStats(buildImportStats(parsed))
      setPhase('preview')
    } catch (e) {
      setError(e.message)
      setPhase('error')
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleConfirm() {
    if (!result) return
    onImport(result)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '14px', width: '100%', maxWidth: '640px', border: '1px solid var(--border)', boxShadow: '0 8px 40px rgba(0,0,0,0.22)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>📊 SuSa importieren</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>

          {/* Upload-Bereich */}
          {phase === 'idle' && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '12px', padding: '40px 20px', textAlign: 'center',
                  cursor: 'pointer', background: dragging ? 'rgba(37,99,235,0.04)' : 'var(--surface2)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>📂</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>
                  Summen- und Saldenliste hochladen
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Excel-Datei (.xlsx, .xls) hierher ziehen oder klicken
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                  onChange={e => handleFile(e.target.files?.[0])} />
              </div>
              <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', fontSize: '11px', color: '#2563eb', lineHeight: 1.6 }}>
                💡 Unterstützte Formate: DATEV-SuSa, Lexware-Auswertung, generische SuSa mit Kontonummer + Saldo.
                Das System erkennt Kontenrahmen (SKR03/04) automatisch.
              </div>
            </>
          )}

          {/* Parsing läuft */}
          {phase === 'parsing' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>⏳</div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Datei wird analysiert…</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Konten werden erkannt und zugeordnet</div>
            </div>
          )}

          {/* Fehler */}
          {phase === 'error' && (
            <div style={{ padding: '16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px' }}>
              <div style={{ fontWeight: 700, color: '#b91c1c', marginBottom: '6px' }}>⚠ Fehler beim Parsen</div>
              <div style={{ fontSize: '12px', color: '#991b1b' }}>{error}</div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: '10px' }} onClick={() => setPhase('idle')}>
                ↩ Andere Datei versuchen
              </button>
            </div>
          )}

          {/* Vorschau / Bestätigung */}
          {phase === 'preview' && stats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Erkennungs-Header */}
              <div style={{ padding: '12px 16px', background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: '8px' }}>
                <div style={{ fontWeight: 700, color: '#15803d', marginBottom: '6px' }}>✅ Erkennung erfolgreich</div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span><strong>{stats.total}</strong> Konten erkannt</span>
                  <span>Kontenrahmen: <strong>{stats.kontenrahmen === 'unbekannt' ? '⚠ unklar' : stats.kontenrahmen}</strong></span>
                  <span>Gewinnermittlung: <strong>{stats.gewinnermittlung}</strong></span>
                  <span>Sicher zugeordnet: <strong>{stats.sicherN}</strong></span>
                </div>
              </div>

              {/* Block-Übersicht */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Blöcke
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {SUSA_BLOCKS.filter(b => b.id !== 'unsicher' && (stats.blockCount[b.id] ?? 0) > 0).map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', borderRadius: '6px', background: b.bg }}>
                      <span style={{ fontSize: '14px' }}>{b.icon}</span>
                      <span style={{ flex: 1, fontSize: '12px', color: b.color, fontWeight: 600 }}>{b.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: b.color }}>{stats.blockCount[b.id]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unsichere Konten */}
              {stats.unsicher.length > 0 && (
                <div style={{ padding: '10px 14px', background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: 700, color: '#92400e', marginBottom: '6px', fontSize: '12px' }}>
                    ⚠ {stats.unsicher.length} unsicher/nicht zugeordnet → landen im Block „Unsicher"
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {stats.unsicher.slice(0, 8).map(k => (
                      <div key={k.nr} style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Kto. {k.nr} – {k.bezeichnung || '(ohne Bezeichnung)'}
                      </div>
                    ))}
                    {stats.unsicher.length > 8 && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>… und {stats.unsicher.length - 8} weitere</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {(phase === 'idle' || phase === 'preview' || phase === 'error') && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Abbrechen</button>
            {phase === 'preview' && (
              <button className="btn btn-primary btn-sm" onClick={handleConfirm}>
                ✅ {stats?.total} Konten übernehmen
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// KONTO-PANEL (rechte Seite)
// ════════════════════════════════════════════════════════════════════════════

function Accordion({ title, badge, defaultOpen = false, warn = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', marginBottom: '6px' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--surface)', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: open ? '1px solid var(--border)' : 'none' }}>
        <span style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: warn ? '#d97706' : 'var(--text)' }}>{title}</span>
        {badge != null && (
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '8px', background: badge > 0 ? 'rgba(239,68,68,0.1)' : 'var(--surface2)', color: badge > 0 ? '#ef4444' : 'var(--text-muted)', border: `1px solid ${badge > 0 ? 'rgba(239,68,68,0.25)' : 'var(--border)'}` }}>
            {badge}
          </span>
        )}
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '10px 12px', background: 'var(--bg)' }}>{children}</div>}
    </div>
  )
}

function KontoPanel({ konto, alleKonten, susa, onUpdKonto, onClose }) {
  const [rueckfrageInput, setRueckfrageInput] = useState('')
  const [kiLoading,       setKiLoading]       = useState(false)
  const [emailLoading,    setEmailLoading]    = useState(false)
  const [emailText,       setEmailText]       = useState('')
  const [umbForm, setUmbForm] = useState(null)  // null oder {betrag, vonKonto, aufKonto, bezeichnung}
  const [diffIst,  setDiffIst]  = useState('')
  const [diffSoll, setDiffSoll] = useState('')
  const [taschenInput, setTaschenInput] = useState('')
  const [taschenResult, setTaschenResult] = useState(null)

  const block     = BLOCK_MAP[konto.blockManual ?? konto.block] ?? BLOCK_MAP.unsicher
  const statusCfg = KONTO_STATUS[konto.status ?? 'offen']
  const offeneRQ  = (konto.rueckfragen ?? []).filter(r => !r.erledigt).length

  function upd(changes) { onUpdKonto(konto.nr, changes) }

  // ── Rückfrage ──
  async function handleKiRueckfrage() {
    if (!rueckfrageInput.trim()) return
    setKiLoading(true)
    try {
      const sys = 'Du bist Steuerberater-Assistent. Formuliere aus dem Stichpunkt eine höfliche, professionelle Rückfrage an den Mandanten. Antworte NUR mit dem fertigen Satz.'
      const usr = `Konto ${konto.nr} – ${konto.bezeichnung}, Saldo ${fmtEur(konto.saldo)}. Anweisung: ${rueckfrageInput}`
      const text = await callClaudeText(sys, usr)
      const nextRQ = [...(konto.rueckfragen ?? []), { id: genId(), text, erstelltAm: new Date().toISOString(), erledigt: false }]
      upd({ rueckfragen: nextRQ, status: 'rueckfrage' })
      setRueckfrageInput('')
    } catch (e) { alert('KI-Fehler: ' + e.message) }
    finally { setKiLoading(false) }
  }

  function addRueckfrageManual() {
    if (!rueckfrageInput.trim()) return
    const nextRQ = [...(konto.rueckfragen ?? []), { id: genId(), text: rueckfrageInput.trim(), erstelltAm: new Date().toISOString(), erledigt: false }]
    upd({ rueckfragen: nextRQ, status: 'rueckfrage' })
    setRueckfrageInput('')
  }

  function toggleRQ(id) {
    upd({ rueckfragen: (konto.rueckfragen ?? []).map(r => r.id === id ? { ...r, erledigt: !r.erledigt } : r) })
  }
  function deleteRQ(id) {
    upd({ rueckfragen: (konto.rueckfragen ?? []).filter(r => r.id !== id) })
  }

  // ── E-Mail aus Rückfragen ──
  async function generateEmail() {
    const offene = (konto.rueckfragen ?? []).filter(r => !r.erledigt)
    if (offene.length === 0) { alert('Keine offenen Rückfragen.'); return }
    setEmailLoading(true)
    setEmailText('')
    try {
      const sys = 'Du bist Steuerberater-Assistent. Erstelle eine professionelle E-Mail mit den offenen Fragen. Antworte NUR mit dem E-Mail-Text, keine Erklärungen.'
      const usr = `Konto ${konto.nr} – ${konto.bezeichnung}:\n` + offene.map((r, i) => `${i + 1}. ${r.text}`).join('\n')
      const text = await callClaudeText(sys, usr)
      setEmailText(text)
    } catch (e) { alert('KI-Fehler: ' + e.message) }
    finally { setEmailLoading(false) }
  }

  // ── Umbuchungen ──
  function saveUmbuchung() {
    if (!umbForm) return
    const betrag = parseFloat(String(umbForm.betrag).replace(',', '.'))
    if (!betrag || isNaN(betrag)) { alert('Bitte einen gültigen Betrag eingeben.'); return }
    const nextUmb = [...(konto.umbuchungen ?? []), { id: genId(), betrag, vonKonto: umbForm.vonKonto, aufKonto: umbForm.aufKonto, bezeichnung: umbForm.bezeichnung, erstelltAm: new Date().toISOString() }]
    upd({ umbuchungen: nextUmb })
    setUmbForm(null)
  }
  function deleteUmb(id) { upd({ umbuchungen: (konto.umbuchungen ?? []).filter(u => u.id !== id) }) }

  // ── Differenzrechner ──
  const diff = (() => {
    const ist  = parseFloat(String(diffIst).replace(',', '.'))
    const soll = parseFloat(String(diffSoll).replace(',', '.'))
    if (!isNaN(ist) && !isNaN(soll)) return soll - ist
    return null
  })()

  // ── Taschenrechner ──
  function calcTaschen() {
    try {
      const safeExpr = taschenInput.replace(/[^0-9+\-*/.(), ]/g, '')
      // eslint-disable-next-line no-eval
      const r = eval(safeExpr)
      setTaschenResult(typeof r === 'number' ? r : null)
    } catch { setTaschenResult(null) }
  }

  const taStyle = { width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', resize: 'vertical', fontFamily: 'inherit' }
  const inStyle = { width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', fontFamily: 'inherit' }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Panel-Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{konto.nr}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{konto.bezeichnung || '(keine Bezeichnung)'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: konto.seite === 'S' ? '#2563eb' : '#d97706', fontFamily: 'var(--font-mono)' }}>
                {fmtEur(konto.saldo)}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: konto.seite === 'S' ? 'rgba(37,99,235,0.1)' : 'rgba(217,119,6,0.1)', color: konto.seite === 'S' ? '#2563eb' : '#d97706' }}>
                {konto.seite === 'S' ? 'Soll' : 'Haben'}
              </span>
              <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 7px', borderRadius: '10px', background: block.bg, color: block.color, border: `1px solid ${block.color}40` }}>
                {block.icon} {block.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--text-muted)', flexShrink: 0, padding: '2px' }}>✕</button>
        </div>

        {/* Status-Chips */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '10px', flexWrap: 'wrap' }}>
          {Object.entries(KONTO_STATUS).map(([s, cfg]) => {
            const active = (konto.status ?? 'offen') === s
            return (
              <button key={s} onClick={() => upd({ status: s })}
                style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: active ? 700 : 500, cursor: 'pointer', border: `1.5px solid ${active ? cfg.color : 'var(--border)'}`, background: active ? cfg.bg : 'transparent', color: active ? cfg.color : 'var(--text-muted)', transition: 'all 0.12s' }}>
                {cfg.icon} {cfg.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Scrollbarer Inhalt */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>

        {/* Notiz */}
        <Accordion title="📝 Notiz / Befund" defaultOpen>
          <textarea value={konto.notiz ?? ''} onChange={e => upd({ notiz: e.target.value })}
            placeholder="Prüfbefund, Erläuterung, interne Hinweise…"
            rows={3} style={taStyle} />
        </Accordion>

        {/* Rückfragen */}
        <Accordion title="❓ Rückfragen an Mandant" badge={offeneRQ} defaultOpen={offeneRQ > 0} warn={offeneRQ > 0}>
          {(konto.rueckfragen ?? []).map(rq => (
            <div key={rq.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '6px 8px', borderRadius: '6px', background: rq.erledigt ? 'var(--surface2)' : 'rgba(217,119,6,0.06)', border: '1px solid var(--border)', marginBottom: '5px', opacity: rq.erledigt ? 0.6 : 1 }}>
              <input type="checkbox" checked={rq.erledigt} onChange={() => toggleRQ(rq.id)} style={{ marginTop: '2px', accentColor: '#16a34a', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '12px', color: 'var(--text)', textDecoration: rq.erledigt ? 'line-through' : 'none', lineHeight: 1.4 }}>{rq.text}</span>
              <button onClick={() => deleteRQ(rq.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.4, fontSize: '12px', flexShrink: 0, padding: '0 2px' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}>🗑</button>
            </div>
          ))}

          {/* Neue Rückfrage */}
          <textarea value={rueckfrageInput} onChange={e => setRueckfrageInput(e.target.value)}
            placeholder="Stichpunkt eingeben, z.B. Betrag X unklar – KI formuliert daraus eine Rückfrage…"
            rows={2} style={{ ...taStyle, marginTop: '6px' }} />
          <div style={{ display: 'flex', gap: '5px', marginTop: '5px', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={addRueckfrageManual} disabled={!rueckfrageInput.trim()} style={{ fontSize: '11px' }}>
              + Direkt hinzufügen
            </button>
            <button
              onClick={handleKiRueckfrage}
              disabled={kiLoading || !rueckfrageInput.trim()}
              style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.08)', color: '#7c3aed', cursor: (!rueckfrageInput.trim() || kiLoading) ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: (!rueckfrageInput.trim() || kiLoading) ? 0.5 : 1 }}>
              {kiLoading ? '⏳' : '🤖'} KI formulieren
            </button>
          </div>

          {/* E-Mail generieren */}
          {offeneRQ > 0 && (
            <div style={{ marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
              <button onClick={generateEmail} disabled={emailLoading}
                style={{ width: '100%', padding: '7px', borderRadius: '6px', border: '1px solid rgba(37,99,235,0.35)', background: 'rgba(37,99,235,0.07)', color: '#2563eb', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                {emailLoading ? '⏳ Generiere…' : '✉️ Alle offenen Rückfragen → E-Mail-Text'}
              </button>
              {emailText && (
                <div style={{ marginTop: '8px' }}>
                  <textarea value={emailText} onChange={e => setEmailText(e.target.value)} rows={6}
                    style={{ ...taStyle, fontFamily: 'var(--font-mono)', fontSize: '11px' }} />
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: '4px', fontSize: '10px' }}
                    onClick={() => navigator.clipboard.writeText(emailText)}>📋 Kopieren</button>
                </div>
              )}
            </div>
          )}
        </Accordion>

        {/* Umbuchungen */}
        <Accordion title="↕ Umbuchungen" badge={(konto.umbuchungen ?? []).length || null}>
          {(konto.umbuchungen ?? []).map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '6px', background: 'var(--surface2)', border: '1px solid var(--border)', marginBottom: '4px', fontSize: '11px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{fmtEur(u.betrag)}</span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{u.vonKonto} → {u.aufKonto}</span>
              <span style={{ flex: 1, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.bezeichnung}</span>
              <button onClick={() => deleteUmb(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.4, fontSize: '12px', flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}>🗑</button>
            </div>
          ))}

          {umbForm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '6px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Betrag (€)</label>
                  <input style={inStyle} value={umbForm.betrag} onChange={e => setUmbForm(f => ({ ...f, betrag: e.target.value }))} placeholder="500,00" />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Bezeichnung</label>
                  <input style={inStyle} value={umbForm.bezeichnung} onChange={e => setUmbForm(f => ({ ...f, bezeichnung: e.target.value }))} placeholder="z.B. Privatanteil" />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Von Konto</label>
                  <input style={inStyle} value={umbForm.vonKonto} onChange={e => setUmbForm(f => ({ ...f, vonKonto: e.target.value }))} placeholder={konto.nr} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Auf Konto</label>
                  <input style={inStyle} value={umbForm.aufKonto} onChange={e => setUmbForm(f => ({ ...f, aufKonto: e.target.value }))} placeholder="z.B. 1890" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setUmbForm(null)}>Abbrechen</button>
                <button className="btn btn-primary btn-sm" onClick={saveUmbuchung}>💾 Speichern</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: '4px', fontSize: '11px' }}
              onClick={() => setUmbForm({ betrag: '', vonKonto: konto.nr, aufKonto: '', bezeichnung: '' })}>
              + Umbuchung erfassen
            </button>
          )}
        </Accordion>

        {/* Tools */}
        <Accordion title="🔢 Tools / Rechner">
          {/* Differenzrechner */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>± Differenzrechner</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Ist-Betrag (laut Buch)</label>
                <input style={inStyle} value={diffIst} onChange={e => setDiffIst(e.target.value)} placeholder={String(konto.saldo)} />
              </div>
              <div>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Soll-Betrag (laut Vertrag)</label>
                <input style={inStyle} value={diffSoll} onChange={e => setDiffSoll(e.target.value)} placeholder="0,00" />
              </div>
            </div>
            {diff !== null && (
              <div style={{ marginTop: '6px', padding: '6px 10px', borderRadius: '6px', background: Math.abs(diff) < 0.01 ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.08)', border: `1px solid ${Math.abs(diff) < 0.01 ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.25)'}`, fontSize: '12px', fontWeight: 700, color: Math.abs(diff) < 0.01 ? '#16a34a' : '#dc2626' }}>
                Differenz: {fmtEur(Math.abs(diff))} {diff > 0 ? '(zu hoch)' : diff < 0 ? '(zu niedrig)' : '✓ passt'}
              </div>
            )}
          </div>

          {/* Mini-Taschenrechner */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>🧮 Schnellrechner</div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <input style={{ ...inStyle, flex: 1, fontFamily: 'var(--font-mono)' }} value={taschenInput}
                onChange={e => setTaschenInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && calcTaschen()}
                placeholder="z.B. 1234 * 0.19" />
              <button className="btn btn-ghost btn-sm" onClick={calcTaschen} style={{ flexShrink: 0 }}>=</button>
            </div>
            {taschenResult !== null && (
              <div style={{ marginTop: '4px', fontSize: '13px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', padding: '4px 8px' }}>
                = {fmtEur(taschenResult)}
              </div>
            )}
          </div>
        </Accordion>

        {/* Block ändern */}
        <Accordion title="📂 Block ändern">
          <select value={konto.blockManual ?? konto.block}
            onChange={e => upd({ blockManual: e.target.value })}
            style={{ ...inStyle, marginBottom: '4px' }}>
            {SUSA_BLOCKS.map(b => (
              <option key={b.id} value={b.id}>{b.icon} {b.label}</option>
            ))}
          </select>
          {konto.blockManual && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: '10px' }} onClick={() => upd({ blockManual: null })}>
              ↩ Automatische Zuordnung wiederherstellen
            </button>
          )}
        </Accordion>

      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// BLOCK-LISTE (linke Seite)
// ════════════════════════════════════════════════════════════════════════════

function BlockListe({ susa, selectedNr, onSelect }) {
  const konten = susa.konten ?? []

  // Konten nach (blockManual ?? block) gruppieren
  const grouped = {}
  for (const k of konten) {
    const bid = k.blockManual ?? k.block
    if (!grouped[bid]) grouped[bid] = []
    grouped[bid].push(k)
  }

  const statusColor = s => ({ offen: 'var(--text-muted)', geprueft: '#16a34a', rueckfrage: '#d97706', erledigt: '#2563eb' }[s ?? 'offen'])
  const statusIcon  = s => ({ offen: '○', geprueft: '✓', rueckfrage: '❓', erledigt: '✅' }[s ?? 'offen'])

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '8px' }}>
      {SUSA_BLOCKS.map(block => {
        const kontenImBlock = grouped[block.id] ?? []
        if (kontenImBlock.length === 0) return null
        const erledigtN = kontenImBlock.filter(k => k.status === 'erledigt' || k.status === 'geprueft').length
        const rqN       = kontenImBlock.filter(k => k.status === 'rueckfrage').length
        const allDone   = erledigtN === kontenImBlock.length

        return (
          <div key={block.id} style={{ marginBottom: '6px' }}>
            {/* Block-Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '6px', background: block.bg, marginBottom: '2px' }}>
              <span style={{ fontSize: '13px' }}>{block.icon}</span>
              <span style={{ flex: 1, fontSize: '11px', fontWeight: 700, color: block.color }}>{block.label}</span>
              {rqN > 0 && <span style={{ fontSize: '10px', fontWeight: 700, color: '#d97706' }}>❓{rqN}</span>}
              <span style={{ fontSize: '10px', fontWeight: 700, color: allDone ? '#16a34a' : 'var(--text-muted)' }}>
                {allDone ? '✓' : `${erledigtN}/${kontenImBlock.length}`}
              </span>
            </div>

            {/* Konto-Zeilen */}
            {kontenImBlock.map(k => {
              const isSelected = k.nr === selectedNr
              return (
                <button key={k.nr} onClick={() => onSelect(k.nr)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '5px 8px 5px 16px', border: 'none', cursor: 'pointer', borderRadius: '5px',
                    background: isSelected ? 'var(--accent)' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--text)',
                    transition: 'background 0.1s',
                    textAlign: 'left', marginBottom: '1px',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: '11px', color: isSelected ? 'rgba(255,255,255,0.7)' : statusColor(k.status), flexShrink: 0 }}>
                    {statusIcon(k.status)}
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0, minWidth: '36px' }}>
                    {k.nr}
                  </span>
                  <span style={{ flex: 1, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isSelected ? '#fff' : 'var(--text-secondary)' }}>
                    {k.bezeichnung || '–'}
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0, color: isSelected ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)' }}>
                    {k.saldo >= 1000 ? (k.saldo / 1000).toFixed(1) + 'k' : k.saldo.toFixed(0)}
                  </span>
                  {(k.rueckfragen ?? []).some(r => !r.erledigt) && (
                    <span style={{ fontSize: '9px', color: isSelected ? 'rgba(255,165,0,0.9)' : '#d97706', flexShrink: 0 }}>●</span>
                  )}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// HAUPT-KOMPONENTE
// ════════════════════════════════════════════════════════════════════════════

export default function SusaTab({ client, onUpdate }) {
  const susa          = client.susa ?? { importiert: null, konten: [] }
  const [showImport,  setShowImport]  = useState(false)
  const [selectedNr,  setSelectedNr]  = useState(null)

  const konten    = susa.konten ?? []
  const hatDaten  = konten.length > 0

  function handleImport(parseResult) {
    onUpdate({
      susa: {
        importiert:       new Date().toISOString(),
        dateiname:        parseResult.dateiname,
        kontenrahmen:     parseResult.kontenrahmen,
        gewinnermittlung: parseResult.gewinnermittlung,
        konten:           parseResult.konten,
      }
    })
    setSelectedNr(null)
  }

  function updKonto(nr, changes) {
    const nextKonten = konten.map(k => k.nr === nr ? { ...k, ...changes } : k)
    onUpdate({ susa: { ...susa, konten: nextKonten } })
  }

  const selectedKonto = selectedNr ? konten.find(k => k.nr === selectedNr) : null

  // Statistiken
  const total     = konten.length
  const geprueftN = konten.filter(k => k.status === 'geprueft' || k.status === 'erledigt').length
  const rqN       = konten.filter(k => k.status === 'rueckfrage').length
  const offenN    = konten.filter(k => !k.status || k.status === 'offen').length
  const offeneRQGesamt = konten.reduce((s, k) => s + (k.rueckfragen ?? []).filter(r => !r.erledigt).length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Tab-Header ── */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>📊 Abschluss (SuSa)</span>
              {hatDaten && (
                <>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{susa.dateiname}</span>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '8px', background: 'rgba(37,99,235,0.1)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.2)' }}>
                    {susa.kontenrahmen ?? '?'}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{susa.gewinnermittlung}</span>
                </>
              )}
            </div>
            {hatDaten && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px', fontSize: '11px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)' }}>{total} Konten</span>
                {geprueftN > 0 && <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ {geprueftN} geprüft</span>}
                {rqN > 0 && <span style={{ color: '#d97706', fontWeight: 600 }}>❓ {rqN} Rückfrage</span>}
                {offenN > 0 && <span style={{ color: 'var(--text-muted)' }}>○ {offenN} offen</span>}
                {offeneRQGesamt > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>● {offeneRQGesamt} ungekl. Rückfrage{offeneRQGesamt > 1 ? 'n' : ''}</span>}
              </div>
            )}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowImport(true)} style={{ flexShrink: 0 }}>
            📤 {hatDaten ? 'Neu importieren' : 'SuSa importieren'}
          </button>
        </div>
      </div>

      {/* ── Leer-Zustand ── */}
      {!hatDaten && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '6px' }}>
            Noch keine SuSa importiert
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '360px', lineHeight: 1.6, marginBottom: '20px' }}>
            Lade eine Summen- und Saldenliste hoch — das System erkennt Konten, Salden und Kontenrahmen
            automatisch und sortiert sie in Blöcke.
          </div>
          <button className="btn btn-primary" onClick={() => setShowImport(true)}>
            📤 SuSa importieren
          </button>
        </div>
      )}

      {/* ── Split-View ── */}
      {hatDaten && (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: selectedKonto ? '280px 1fr' : '1fr', overflow: 'hidden' }}>

          {/* Linke Spalte: Blockliste */}
          <div style={{ borderRight: selectedKonto ? '1px solid var(--border)' : 'none', overflow: 'hidden' }}>
            <BlockListe susa={susa} selectedNr={selectedNr} onSelect={nr => setSelectedNr(nr === selectedNr ? null : nr)} />
          </div>

          {/* Rechte Spalte: Konto-Panel */}
          {selectedKonto && (
            <div style={{ overflow: 'hidden' }}>
              <KontoPanel
                key={selectedKonto.nr}
                konto={selectedKonto}
                alleKonten={konten}
                susa={susa}
                onUpdKonto={updKonto}
                onClose={() => setSelectedNr(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* Import-Modal */}
      {showImport && (
        <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />
      )}
    </div>
  )
}
