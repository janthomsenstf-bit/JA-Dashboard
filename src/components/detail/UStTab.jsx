import { useState, useMemo } from 'react'

// ── Konstanten ────────────────────────────────────────────────────────────────
const MONATE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
const ABSENDER_KEY = 'kommunikation-absender'

function loadAbsender() {
  try { const r = localStorage.getItem(ABSENDER_KEY); if (r) return JSON.parse(r) } catch {}
  return []
}

async function sendViaSMTP({ to, from, subject, text, account, attachments = [] }) {
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, from, subject, text, account, attachments }),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

// ── Zahlen-Helfer ─────────────────────────────────────────────────────────────
function parseNum(v) { return parseFloat((v ?? '').toString().replace(',', '.')) || 0 }

function fmtEur(n) {
  if (n === 0 && typeof n === 'number') return '0,00 €'
  return parseNum(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtEurShort(n) {
  const v = parseNum(n)
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calcUSt(bem, satz) { return parseNum(bem) * parseNum(satz) / 100 }
function calcZahllast(bem, satz, vor) { return calcUSt(bem, satz) - parseNum(vor) }

// ── Standard-E-Mail-Text ──────────────────────────────────────────────────────
function buildDefaultMail(monatName, jahr, zahllast) {
  return {
    betreff: `Moms – ${monatName} ${jahr}`,
    text:
`Hej med dig,

Moms for periode ${monatName} – ${jahr} blive indberet.
Du skal betale til tysk Finanzamt= ${fmtEurShort(zahllast)} EUR

Bankforbindelse Finanzamt:
BBK Hamburg (Banknavn)
IBAN: DE27 2000 0000 0020 2015 00
BIC: MARKDEF1200

Husk at du skriver dit skattenummer med på overføring så Skattevæsen (Finanzamt) kan tildele betalingen korrekt.`,
  }
}

function buildMailFromVorlage(vorlage, monatName, jahr, bem, satz, ust, vor, zahllast) {
  const replacements = {
    '[MONAT]':              monatName,
    '[JAHR]':               String(jahr),
    '[BEMESSUNGSGRUNDLAGE]':fmtEurShort(bem) + ' €',
    '[STEUERSATZ]':         String(satz) + ' %',
    '[UST]':                fmtEurShort(ust) + ' €',
    '[VORSTEUER]':          fmtEurShort(vor) + ' €',
    '[ZAHLLAST]':           fmtEurShort(zahllast) + ' €',
  }
  function replace(str) {
    return Object.entries(replacements).reduce((s, [k, v]) => s.replaceAll(k, v), str ?? '')
  }
  return { betreff: replace(vorlage.betreff), text: replace(vorlage.text) }
}

// ── Inline-E-Mail-Editor ──────────────────────────────────────────────────────
function InlineMailEditor({ monatIdx, jahr, monatDaten, emailVorlagen, client, onSent, onCancel }) {
  const monatName  = MONATE[monatIdx]
  const bem        = parseNum(monatDaten.bem)
  const satz       = parseNum(monatDaten.satz)
  const ust        = calcUSt(bem, satz)
  const vor        = parseNum(monatDaten.vor)
  const zahllast   = calcZahllast(bem, satz, vor)

  const absenderList = loadAbsender()
  const kontaktEmail = (client.kontakte ?? []).find(k => k.email)?.email ?? ''
  const defaultMail  = buildDefaultMail(monatName, jahr, zahllast)

  const [von,        setVon]        = useState(absenderList.find(a => a.isDefault)?.email ?? absenderList[0]?.email ?? '')
  const [an,         setAn]         = useState(kontaktEmail)
  const [betreff,    setBetreff]    = useState(defaultMail.betreff)
  const [text,       setText]       = useState(defaultMail.text)
  const [vorlageId,  setVorlageId]  = useState('')
  const [anlagen,    setAnlagen]    = useState([])   // [{ id, filename, content (base64), contentType, size }]
  const [sending,    setSending]    = useState(false)
  const [error,      setError]      = useState('')
  const fileInputRef = useState(null)

  function applyVorlage(id) {
    setVorlageId(id)
    if (!id) { setBetreff(defaultMail.betreff); setText(defaultMail.text); return }
    const v = emailVorlagen.find(v => v.id === id)
    if (!v) return
    const filled = buildMailFromVorlage(v, monatName, jahr, bem, satz, ust, vor, zahllast)
    setBetreff(filled.betreff)
    setText(filled.text)
  }

  async function handleFileAdd(e) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) { setError(`${file.name} ist zu groß (max. 10 MB).`); continue }
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload  = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })
      setAnlagen(prev => [...prev, {
        id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2),
        filename: file.name,
        content:  base64,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      }])
    }
  }

  function removeAnlage(id) { setAnlagen(prev => prev.filter(a => a.id !== id)) }

  function fmtSize(bytes) {
    if (bytes < 1024)       return bytes + ' B'
    if (bytes < 1024*1024)  return (bytes/1024).toFixed(0) + ' KB'
    return (bytes/1024/1024).toFixed(1) + ' MB'
  }

  async function handleSend() {
    if (!an.trim())      { setError('Empfänger fehlt.'); return }
    if (!betreff.trim()) { setError('Betreff fehlt.');   return }
    if (!text.trim())    { setError('Text fehlt.');      return }
    if (!von)            { setError('Kein Absender – bitte unter Stammdaten einrichten.'); return }
    setSending(true); setError('')
    const acc = absenderList.find(a => a.email === von)
    const attachments = anlagen.map(a => ({ filename: a.filename, content: a.content, contentType: a.contentType }))
    try {
      await sendViaSMTP({ to: an, from: von, subject: betreff, text, account: acc, attachments })
      onSent({ von, an, betreff, text, anlagenCount: anlagen.length })
    } catch (e) {
      setError('Fehler: ' + e.message)
      setSending(false)
    }
  }

  return (
    <div style={{ gridColumn: '1 / -1', padding: '14px 16px', background: 'rgba(8,145,178,0.04)', borderTop: '1px solid rgba(8,145,178,0.2)', borderBottom: '1px solid rgba(8,145,178,0.2)' }}>
      <div style={{ maxWidth: '680px' }}>
        <div style={{ fontWeight: 700, fontSize: '12px', color: '#0891b2', marginBottom: '10px' }}>
          📧 E-Mail für {monatName} {jahr} · Zahllast: <strong>{fmtEur(zahllast)}</strong>
        </div>

        {/* Vorlage */}
        {emailVorlagen.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Vorlage laden</label>
            <select className="input" value={vorlageId} onChange={e => applyVorlage(e.target.value)} style={{ fontSize: '12px', padding: '4px 8px', width: '100%' }}>
              <option value="">– Standard-Vorlage (Dänisch) –</option>
              {emailVorlagen.map(v => <option key={v.id} value={v.id}>{v.name ?? v.betreff}</option>)}
            </select>
          </div>
        )}

        {/* Von / An */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Von</label>
            {absenderList.length > 1
              ? <select className="input" value={von} onChange={e => setVon(e.target.value)} style={{ fontSize: '12px', padding: '4px 8px', width: '100%' }}>
                  {absenderList.map(a => <option key={a.email} value={a.email}>{a.name ? `${a.name} <${a.email}>` : a.email}</option>)}
                </select>
              : <input className="input" value={von} readOnly style={{ fontSize: '12px', padding: '4px 8px', width: '100%', background: 'var(--bg)' }} />
            }
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>An</label>
            <input className="input" value={an} onChange={e => setAn(e.target.value)} placeholder="empfaenger@beispiel.de" style={{ fontSize: '12px', padding: '4px 8px', width: '100%' }} />
          </div>
        </div>

        {/* Betreff */}
        <div style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Betreff</label>
          <input className="input" value={betreff} onChange={e => setBetreff(e.target.value)} style={{ fontSize: '12px', padding: '4px 8px', width: '100%' }} />
        </div>

        {/* Text */}
        <div style={{ marginBottom: '10px' }}>
          <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Text</label>
          <textarea className="input" value={text} onChange={e => setText(e.target.value)} rows={9}
            style={{ fontSize: '12px', padding: '6px 8px', width: '100%', resize: 'vertical', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }} />
        </div>

        {/* Anlagen */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Anlagen{anlagen.length > 0 ? ` (${anlagen.length})` : ''}
            </label>
            <label style={{ cursor: 'pointer' }}>
              <input type="file" multiple style={{ display: 'none' }} onChange={handleFileAdd} />
              <span className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>📎 Datei hinzufügen</span>
            </label>
          </div>
          {anlagen.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {anlagen.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 9px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px' }}>
                  <span style={{ fontSize: '15px' }}>📄</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.filename}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{fmtSize(a.size)}</span>
                  <button onClick={() => removeAnlage(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '14px', padding: '0 2px', flexShrink: 0 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          {anlagen.length === 0 && (
            <div style={{ padding: '8px 10px', border: '1px dashed var(--border)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Keine Anlagen – „Datei hinzufügen" klicken
            </div>
          )}
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>⚠️ {error}</div>}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={sending} style={{ fontSize: '11px' }}>Abbrechen</button>
          <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={sending} style={{ fontSize: '11px' }}>
            {sending ? '⏳ Wird gesendet…' : `📤 Senden${anlagen.length > 0 ? ` (${anlagen.length} Anlage${anlagen.length > 1 ? 'n' : ''})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Leere Monatsdaten ─────────────────────────────────────────────────────────
function emptyMonate() {
  return Array.from({ length: 12 }, (_, i) => ({ monatIdx: i, bem: '', satz: 19, vor: '' }))
}

function getJahrDaten(ust, jahr) {
  const key = String(jahr)
  if (ust?.[key]) {
    const m = ust[key]
    // Sicherstellen dass 12 Einträge da sind
    if (m.length === 12) return m
  }
  return emptyMonate()
}

// ── Zahl-Eingabe-Komponente ───────────────────────────────────────────────────
function NumInput({ value, onChange, placeholder = '0,00' }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      className="input"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ width: '100%', fontSize: '12px', padding: '4px 7px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
    />
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function UStTab({ client, onUpdate, emailVorlagen = [] }) {
  const currentYear = new Date().getFullYear()
  const [jahr, setJahr] = useState(parseInt(client.veranlagungsjahr) || currentYear)
  const [mailOffenIdx, setMailOffenIdx] = useState(null)   // welche Monatszeile hat Mail offen

  const ust     = client.ust ?? {}
  const monate  = getJahrDaten(ust, jahr)

  // ── Wert ändern ─────────────────────────────────────────────────────────────
  function patchMonat(monatIdx, field, value) {
    const neueM = monate.map((m, i) => i !== monatIdx ? m : { ...m, [field]: value })
    onUpdate({ ust: { ...ust, [String(jahr)]: neueM } })
  }

  // ── Mail gesendet ────────────────────────────────────────────────────────────
  function handleMailSent(monatIdx, meta) {
    setMailOffenIdx(null)
    // Eintrag in Kommunikation
    const newEvent = {
      id:          'ust_' + Date.now().toString(36),
      typ:         'email',
      datum:        new Date().toISOString(),
      erstelltAm:   new Date().toISOString(),
      gesendetAm:   new Date().toISOString(),
      betreff:      meta.betreff ?? '',
      absender:     meta.von     ?? '',
      empfaenger:   meta.an      ?? '',
      text:         meta.text    ?? '',
      anlagen:      [],
      quelle:       'ust',
      ustMonat:     MONATE[monatIdx],
      ustJahr:      String(jahr),
    }
    const komm = client.kommunikation ?? { events: [] }
    onUpdate({ kommunikation: { ...komm, events: [newEvent, ...(komm.events ?? [])] } })
  }

  // ── Jahressummen ─────────────────────────────────────────────────────────────
  const summen = useMemo(() => {
    return monate.reduce((acc, m) => {
      const ust = calcUSt(m.bem, m.satz)
      const zl  = calcZahllast(m.bem, m.satz, m.vor)
      return {
        bem: acc.bem + parseNum(m.bem),
        ust: acc.ust + ust,
        vor: acc.vor + parseNum(m.vor),
        zl:  acc.zl  + zl,
      }
    }, { bem: 0, ust: 0, vor: 0, zl: 0 })
  }, [monate])

  // ── Spaltenbreiten ───────────────────────────────────────────────────────────
  const COL = '80px 1fr 90px 110px 1fr 110px 90px'

  const headerStyle = {
    fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    padding: '6px 8px', whiteSpace: 'nowrap',
  }

  return (
    <div style={{ padding: '20px', maxWidth: '980px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>🧾 Umsatzsteuer-Voranmeldung</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Monatsübersicht · Zahllast · E-Mail-Versand
          </div>
        </div>

        {/* Jahr-Auswahl */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setJahr(j => j - 1); setMailOffenIdx(null) }} style={{ fontSize: '12px', padding: '4px 10px' }}>◀</button>
          <span style={{ fontWeight: 700, fontSize: '15px', minWidth: '48px', textAlign: 'center' }}>{jahr}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { setJahr(j => j + 1); setMailOffenIdx(null) }} style={{ fontSize: '12px', padding: '4px 10px' }}>▶</button>
        </div>
      </div>

      {/* ── Tabelle ── */}
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>

        {/* Spalten-Header */}
        <div style={{ display: 'grid', gridTemplateColumns: COL, background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>
          {[
            ['Monat',                  'left'],
            ['Bemessungsgrundlage',    'right'],
            ['Satz',                   'center'],
            ['Umsatzsteuer',           'right'],
            ['Abzügl. Vorsteuer',      'right'],
            ['Zahllast',               'right'],
            ['Aktion',                 'center'],
          ].map(([label, align]) => (
            <div key={label} style={{ ...headerStyle, textAlign: align }}>{label}</div>
          ))}
        </div>

        {/* Monatszeilen */}
        {monate.map((m, i) => {
          const ust_val  = calcUSt(m.bem, m.satz)
          const zl       = calcZahllast(m.bem, m.satz, m.vor)
          const mailOffen = mailOffenIdx === i
          const hatWerte  = !!m.bem || !!m.vor

          return (
            <div key={i}>
              {/* Zeile */}
              <div style={{
                display: 'grid', gridTemplateColumns: COL,
                borderBottom: mailOffen ? 'none' : '1px solid var(--border)',
                background: mailOffen ? 'rgba(8,145,178,0.04)' : i % 2 === 0 ? 'var(--bg)' : 'var(--surface)',
                transition: 'background 0.1s',
              }}>

                {/* Monat */}
                <div style={{ padding: '7px 8px', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{MONATE[i]}</span>
                </div>

                {/* Bemessungsgrundlage */}
                <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center' }}>
                  <NumInput value={m.bem} onChange={v => patchMonat(i, 'bem', v)} placeholder="0,00" />
                </div>

                {/* Steuersatz */}
                <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <select
                    className="input"
                    value={m.satz}
                    onChange={e => patchMonat(i, 'satz', parseInt(e.target.value))}
                    style={{ fontSize: '12px', padding: '4px 6px', textAlign: 'center', width: '100%', fontFamily: 'var(--font-mono)' }}
                  >
                    <option value={19}>19 %</option>
                    <option value={7}>7 %</option>
                  </select>
                </div>

                {/* USt (berechnet) */}
                <div style={{ padding: '7px 8px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <span style={{
                    fontSize: '12px', fontFamily: 'var(--font-mono)',
                    color: hatWerte ? 'var(--text)' : 'var(--text-muted)',
                  }}>
                    {hatWerte || m.bem ? fmtEur(ust_val) : '–'}
                  </span>
                </div>

                {/* Vorsteuer */}
                <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center' }}>
                  <NumInput value={m.vor} onChange={v => patchMonat(i, 'vor', v)} placeholder="0,00" />
                </div>

                {/* Zahllast */}
                <div style={{ padding: '7px 8px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <span style={{
                    fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)',
                    color: !hatWerte && !m.bem ? 'var(--text-muted)'
                         : zl > 0 ? '#dc2626'
                         : zl < 0 ? '#16a34a'
                         : 'var(--text)',
                  }}>
                    {hatWerte || m.bem ? fmtEur(zl) : '–'}
                  </span>
                </div>

                {/* E-Mail Button */}
                <div style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button
                    className={`btn btn-sm ${mailOffen ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setMailOffenIdx(mailOffen ? null : i)}
                    title={`E-Mail für ${MONATE[i]} ${jahr}`}
                    style={{ fontSize: '11px', padding: '3px 10px', whiteSpace: 'nowrap' }}
                  >
                    {mailOffen ? '✕ Schließen' : '📧 E-Mail'}
                  </button>
                </div>
              </div>

              {/* Inline-Mail-Editor */}
              {mailOffen && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', borderBottom: '1px solid var(--border)' }}>
                  <InlineMailEditor
                    monatIdx={i}
                    jahr={jahr}
                    monatDaten={m}
                    emailVorlagen={emailVorlagen}
                    client={client}
                    onSent={meta => handleMailSent(i, meta)}
                    onCancel={() => setMailOffenIdx(null)}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* ── Summenzeile ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: COL,
          background: 'var(--surface)',
          borderTop: '2px solid var(--border)',
        }}>
          <div style={{ padding: '9px 8px', fontSize: '12px', fontWeight: 700 }}>Gesamt</div>

          <div style={{ padding: '9px 8px', textAlign: 'right' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmtEur(summen.bem)}</span>
          </div>

          <div />  {/* Satz */}

          <div style={{ padding: '9px 8px', textAlign: 'right' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmtEur(summen.ust)}</span>
          </div>

          <div style={{ padding: '9px 8px', textAlign: 'right' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{fmtEur(summen.vor)}</span>
          </div>

          <div style={{ padding: '9px 8px', textAlign: 'right' }}>
            <span style={{
              fontSize: '13px', fontWeight: 800, fontFamily: 'var(--font-mono)',
              color: summen.zl > 0 ? '#dc2626' : summen.zl < 0 ? '#16a34a' : 'var(--text)',
            }}>
              {fmtEur(summen.zl)}
            </span>
          </div>

          <div />  {/* Aktion */}
        </div>
      </div>

      {/* ── Legende ── */}
      <div style={{ display: 'flex', gap: '20px', marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span><span style={{ color: '#dc2626', fontWeight: 700 }}>●</span> Zahllast (Betrag fällig)</span>
        <span><span style={{ color: '#16a34a', fontWeight: 700 }}>●</span> Erstattung (Vorsteuerüberhang)</span>
        <span>💡 Vorlagen-Platzhalter: [MONAT] [JAHR] [ZAHLLAST] [UST] [VORSTEUER] [BEMESSUNGSGRUNDLAGE]</span>
      </div>
    </div>
  )
}
