import { useState, useRef } from 'react'

const APIKEY_STORAGE = 'sda-claude-api-key'
function loadApiKey() { return (localStorage.getItem(APIKEY_STORAGE) ?? '').replace(/\s/g, '') }

// ── Karten-Konfiguration ─────────────────────────────────────────────────────
const CARDS = [
  { key: 'besonderheiten', icon: '🟡', title: 'Steuerliche Besonderheiten',        abschlussKat: 'pruefung',   color: '#d97706', bg: 'rgba(217,119,6,0.07)',    border: 'rgba(217,119,6,0.25)'    },
  { key: 'pruefung',       icon: '🔍', title: 'Prüfungsschwerpunkte (Finanzamt)',   abschlussKat: 'pruefung',   color: '#2563eb', bg: 'rgba(37,99,235,0.07)',    border: 'rgba(37,99,235,0.25)'    },
  { key: 'risiken',        icon: '⚠️', title: 'Risiken & Fehlerquellen',            abschlussKat: 'pruefung',   color: '#ef4444', bg: 'rgba(239,68,68,0.07)',    border: 'rgba(239,68,68,0.25)'    },
  { key: 'rueckfragen',    icon: '💡', title: 'Rückfragen an Mandanten',            abschlussKat: 'rueckfrage', color: '#7c3aed', bg: 'rgba(124,58,237,0.07)',   border: 'rgba(124,58,237,0.25)'   },
  { key: 'kennzahlen',     icon: '📈', title: 'Kennzahlen & Plausibilität',         abschlussKat: 'notiz',      color: '#16a34a', bg: 'rgba(22,163,74,0.07)',    border: 'rgba(22,163,74,0.25)'    },
]

// ── Schnell-Auswahl Branchen ─────────────────────────────────────────────────
const PRESET_BRANCHEN = [
  'Handwerker', 'Gastronomie', 'E-Commerce', 'Freiberufler / Berater',
  'Arzt / Heilberufe', 'Immobilien / Vermietung', 'Einzelhandel',
  'Transport / Logistik', 'IT / Software', 'Landwirtschaft',
]

// ── KI-Prompt ────────────────────────────────────────────────────────────────
function buildPrompt(branche, rechtsform, gewinnermittlung) {
  const ctx = [
    rechtsform    && `Rechtsform: ${rechtsform}`,
    gewinnermittlung && `Gewinnermittlung: ${gewinnermittlung}`,
  ].filter(Boolean).join(', ')

  return `Du bist ein erfahrener Steuerberater-Assistent. Der Nutzer fragt nach einer branchenspezifischen Beratungsübersicht.

Branche: ${branche}${ctx ? `\nKontext: ${ctx}` : ''}

Erstelle eine kompakte Übersicht für diese Branche. Berücksichtige den Kontext (z.B. EÜR vs. Bilanz, GmbH vs. Einzelunternehmen) bei den Hinweisen.

Antworte NUR mit diesem JSON-Objekt, kein Text davor oder danach:
{
  "besonderheiten": ["Stichpunkt 1", "Stichpunkt 2"],
  "pruefung":       ["Stichpunkt 1", "Stichpunkt 2"],
  "risiken":        ["Stichpunkt 1", "Stichpunkt 2"],
  "rueckfragen":    ["Konkrete Frage 1", "Konkrete Frage 2"],
  "kennzahlen":     ["Stichpunkt 1", "Stichpunkt 2"]
}

Regeln:
- Maximal 6 Punkte pro Kategorie
- Kurze, prägnante Stichpunkte – kein Fließtext
- Steuerberater-Sprache: fachlich und direkt
- Rückfragen als echte Fragen formulieren (z.B. "Fahrtenbuch vorhanden?")
- Besonderheiten und Prüfung je nach Kontext (Rechtsform / Gewinnermittlung) anpassen`
}

async function callClaude(branche, rechtsform, gewinnermittlung) {
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
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildPrompt(branche, rechtsform, gewinnermittlung) }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message ?? `HTTP ${res.status}`)
  }
  const data = await res.json()
  let raw = data.content?.[0]?.text ?? ''
  console.log('[BeratungTab] Roh-Antwort (komplett):', raw)

  // Robustes JSON-Parsing: Code-Block entfernen, dann per indexOf extrahieren
  const cbMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (cbMatch) raw = cbMatch[1]

  const firstBrace = raw.indexOf('{')
  const lastBrace  = raw.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error(`Kein vollständiges JSON in Antwort (ggf. zu lang). Anfang: "${raw.slice(0, 150)}"`)
  }
  const jsonStr = raw.slice(firstBrace, lastBrace + 1)
  const parsed = JSON.parse(jsonStr)
  console.log('[BeratungTab] Geparst:', parsed)

  // Flexibles Key-Mapping: auch wenn Claude leicht andere Namen wählt
  const KEY_ALIASES = {
    besonderheiten: ['besonderheiten', 'steuerlicheBesonderheiten', 'steuerliche_besonderheiten', 'steuerlich', 'besonderheit'],
    pruefung:       ['pruefung', 'pruefungsschwerpunkte', 'prüfung', 'prüfungsschwerpunkte', 'pruefung_schwerpunkte', 'schwerpunkte', 'finanzamt'],
    risiken:        ['risiken', 'fehlerquellen', 'risiken_fehlerquellen', 'fehler', 'risiko'],
    rueckfragen:    ['rueckfragen', 'rückfragen', 'fragen', 'mandantenfragen', 'rueckfrage', 'rückfrage'],
    kennzahlen:     ['kennzahlen', 'plausiblitaet', 'plausibilitaet', 'plausibilität', 'kennzahl', 'benchmarks'],
  }

  function findValue(obj, aliases) {
    for (const alias of aliases) {
      if (Array.isArray(obj[alias]) && obj[alias].length > 0) return obj[alias]
    }
    // Fallback: case-insensitive search
    const lowerKeys = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]))
    for (const alias of aliases) {
      const v = lowerKeys[alias.toLowerCase()]
      if (Array.isArray(v) && v.length > 0) return v
    }
    return []
  }

  const result = {}
  for (const card of CARDS) {
    result[card.key] = findValue(parsed, KEY_ALIASES[card.key] ?? [card.key])
  }

  // Wenn gar nichts gematcht: alle Werte des Parsed-Objekts aufteilen
  const totalItems = Object.values(result).reduce((s, a) => s + a.length, 0)
  if (totalItems === 0 && Object.keys(parsed).length > 0) {
    console.warn('[BeratungTab] Kein Key-Match – versuche automatische Zuweisung', Object.keys(parsed))
    const allValues = Object.values(parsed).filter(Array.isArray)
    const cardKeys = CARDS.map(c => c.key)
    allValues.forEach((arr, i) => { if (i < cardKeys.length) result[cardKeys[i]] = arr })
  }

  console.log('[BeratungTab] Ergebnis-Objekt:', result)
  return result
}

// ── Einzel-Karte ─────────────────────────────────────────────────────────────
function BeratungsKarte({ card, items, ausgewaehlt, onToggleItem, showAuswahl }) {
  const [collapsed, setCollapsed] = useState(false)
  if (!items || items.length === 0) return null

  return (
    <div style={{
      background: card.bg, border: `1px solid ${card.border}`,
      borderRadius: '10px', overflow: 'hidden',
    }}>
      {/* Karten-Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: '16px' }}>{card.icon}</span>
        <span style={{ fontWeight: 700, fontSize: '13px', color: card.color, flex: 1 }}>{card.title}</span>
        <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 7px', borderRadius: '10px', background: `${card.color}22`, color: card.color }}>
          {items.length}
        </span>
        <span style={{ fontSize: '11px', color: card.color, opacity: 0.7 }}>{collapsed ? '▸' : '▾'}</span>
      </div>

      {!collapsed && (
        <div style={{ padding: '0 14px 12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {items.map((item, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'flex-start', gap: '8px',
              padding: '6px 8px', borderRadius: '6px',
              background: showAuswahl && ausgewaehlt?.has(`${card.key}::${idx}`) ? `${card.color}18` : 'rgba(255,255,255,0.45)',
              border: `1px solid ${showAuswahl && ausgewaehlt?.has(`${card.key}::${idx}`) ? card.color + '55' : 'transparent'}`,
              transition: 'all 0.12s',
            }}>
              {showAuswahl && (
                <input
                  type="checkbox"
                  checked={ausgewaehlt?.has(`${card.key}::${idx}`) ?? false}
                  onChange={() => onToggleItem(`${card.key}::${idx}`)}
                  style={{ marginTop: '2px', width: '14px', height: '14px', accentColor: card.color, cursor: 'pointer', flexShrink: 0 }}
                />
              )}
              <span style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.5, flex: 1 }}>
                {item}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Haupt-Komponente ─────────────────────────────────────────────────────────
export default function BeratungTab({ client, onUpdate }) {
  const beratung = client.beratung ?? {}

  const [branche,       setBranche]       = useState(beratung.branche ?? '')
  const [ergebnis,      setErgebnis]      = useState(beratung.ergebnis ?? null)
  const [erstelltAm,    setErstelltAm]    = useState(beratung.erstelltAm ?? null)
  const [isLoading,     setIsLoading]     = useState(false)
  const [error,         setError]         = useState('')
  const [toast,         setToast]         = useState('')
  const [showAuswahl,   setShowAuswahl]   = useState(false)
  const [ausgewaehlt,   setAusgewaehlt]   = useState(new Set())
  const abortRef = useRef(false)

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500) }

  // ── KI Generierung ──────────────────────────────────────────────────────
  async function generieren(targetBranche) {
    const b = (targetBranche ?? branche).trim()
    if (!b) return
    setIsLoading(true); setError(''); abortRef.current = false
    try {
      const result = await callClaude(b, client.rechtsform ?? '', client.gewinnermittlung ?? '')
      console.log('[BeratungTab] generieren – result erhalten:', result)
      if (abortRef.current) return
      const jetzt = new Date().toISOString()
      setErgebnis(result)
      setErstelltAm(jetzt)
      setShowAuswahl(false)
      setAusgewaehlt(new Set())
      // Persistieren
      onUpdate({ beratung: { ...(client.beratung ?? {}), branche: b, ergebnis: result, erstelltAm: jetzt } })
      showToast('✅ Übersicht erstellt')
    } catch (e) {
      console.error('[BeratungTab] Fehler in generieren:', e)
      setError(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleBrancheSelect(b) {
    setBranche(b)
    generieren(b)
  }

  function handleBrancheSave(b) {
    onUpdate({ beratung: { ...(client.beratung ?? {}), branche: b } })
  }

  // ── Auswahl für Abschluss ───────────────────────────────────────────────
  function toggleItem(id) {
    setAusgewaehlt(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function alleAuswaehlen() {
    const alle = new Set()
    if (ergebnis) {
      for (const card of CARDS) {
        const items = ergebnis[card.key] ?? []
        items.forEach((_, idx) => alle.add(`${card.key}::${idx}`))
      }
    }
    setAusgewaehlt(alle)
  }

  function uebergebenAnAbschluss() {
    if (ausgewaehlt.size === 0) return
    const data   = client.abschluss ?? { punkte: [] }
    const punkte = data.punkte ?? []
    const neue   = []

    for (const card of CARDS) {
      const items = ergebnis?.[card.key] ?? []
      items.forEach((item, idx) => {
        if (!ausgewaehlt.has(`${card.key}::${idx}`)) return
        neue.push({
          id:         'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          kategorie:  card.abschlussKat,
          titel:      item,
          konto:      '',
          notiz:      `aus Beratung (${branche})`,
          status:     'offen',
          datum:      new Date().toISOString(),
        })
      })
    }

    onUpdate({ abschluss: { ...data, punkte: [...neue, ...punkte] } })
    setShowAuswahl(false)
    setAusgewaehlt(new Set())
    showToast(`✅ ${neue.length} Punkt${neue.length !== 1 ? 'e' : ''} in Abschluss übernommen`)
  }

  // ── Formatierung Zeitstempel ────────────────────────────────────────────
  function fmtZeit(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  }

  const inputStyle = {
    flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px',
    background: 'var(--surface2)', color: 'var(--text)', fontSize: '13px', outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '10px 16px', boxShadow: 'var(--shadow-lg)', fontSize: '13px', zIndex: 2000 }}>
          {toast}
        </div>
      )}

      {/* ── Eingabe-Block ── */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🧠</span>
          <span style={{ fontWeight: 700, fontSize: '13px' }}>Branchenspezifische Beratungsübersicht</span>
          {client.rechtsform && (
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>
              {client.rechtsform}{client.gewinnermittlung ? ` · ${client.gewinnermittlung}` : ''}
            </span>
          )}
        </div>

        {/* Eingabe + Button */}
        <div style={{ padding: '12px 14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={branche}
            onChange={e => setBranche(e.target.value)}
            onBlur={e => handleBrancheSave(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generieren()}
            placeholder='Branche eingeben, z. B. "Gastronomie", "Handwerker", "IT-Freelancer" …'
            style={inputStyle}
          />
          <button
            onClick={() => generieren()}
            disabled={!branche.trim() || isLoading}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: branche.trim() && !isLoading ? 'pointer' : 'not-allowed',
              background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap',
              opacity: !branche.trim() || isLoading ? 0.6 : 1, transition: 'opacity 0.15s',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {isLoading ? (
              <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Generiert…</>
            ) : (
              <>{ergebnis ? '🔄 Neu generieren' : '✨ Übersicht erstellen'}</>
            )}
          </button>
        </div>

        {/* Schnell-Auswahl Chips */}
        <div style={{ padding: '0 14px 12px 14px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {PRESET_BRANCHEN.map(b => (
            <button
              key={b}
              onClick={() => handleBrancheSelect(b)}
              style={{
                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer', border: '1px solid var(--border)',
                background: branche === b ? 'var(--accent)' : 'var(--surface)',
                color: branche === b ? '#fff' : 'var(--text-secondary)',
                fontWeight: branche === b ? 600 : 400, transition: 'all 0.12s',
              }}
            >
              {b}
            </button>
          ))}
        </div>

        {/* Fehler */}
        {error && (
          <div style={{ margin: '0 14px 12px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '12px', color: '#ef4444' }}>
            ⚠ {error}
          </div>
        )}
      </div>

      {/* ── Ladeanzeige ── */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px', animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>⟳</div>
          <div>KI analysiert die Branche <strong>{branche}</strong>…</div>
          <div style={{ fontSize: '11px', marginTop: '6px', opacity: 0.6 }}>
            {[client.rechtsform, client.gewinnermittlung].filter(Boolean).join(' · ')}
          </div>
        </div>
      )}

      {/* ── Ergebnis ── */}
      {!isLoading && ergebnis && (
        <>
          {/* Meta-Zeile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '14px' }}>📋</span>
              <span style={{ fontWeight: 700, fontSize: '14px' }}>{branche}</span>
              {[client.rechtsform, client.gewinnermittlung].filter(Boolean).length > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  ({[client.rechtsform, client.gewinnermittlung].filter(Boolean).join(' · ')})
                </span>
              )}
            </div>
            {erstelltAm && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                Erstellt: {fmtZeit(erstelltAm)}
              </span>
            )}
          </div>

          {/* Karten-Grid */}
          {CARDS.every(c => !(ergebnis[c.key]?.length > 0)) ? (
            <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              ⚠ Die KI-Antwort konnte nicht in Karten umgewandelt werden.{' '}
              <button onClick={() => generieren()} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>
                Erneut versuchen
              </button>
              {' '}– Bitte Browserkonsole (F12) prüfen für Details.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {CARDS.map(card => (
                <BeratungsKarte
                  key={card.key}
                  card={card}
                  items={ergebnis[card.key]}
                  ausgewaehlt={ausgewaehlt}
                  onToggleItem={toggleItem}
                  showAuswahl={showAuswahl}
                />
              ))}
            </div>
          )}

          {/* ── Abschluss-Übernahme ── */}
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>

            {/* Aktions-Leiste */}
            <div style={{ padding: '10px 14px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', flex: 1 }}>
                📁 Punkte in den Abschluss-Reiter übernehmen
              </span>
              {!showAuswahl ? (
                <button
                  onClick={() => { setShowAuswahl(true); setAusgewaehlt(new Set()) }}
                  style={{ padding: '5px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}
                >
                  🗂 Punkte auswählen
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ausgewaehlt.size} ausgewählt</span>
                  <button onClick={alleAuswaehlen} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Alle
                  </button>
                  <button onClick={() => { setShowAuswahl(false); setAusgewaehlt(new Set()) }} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Abbrechen
                  </button>
                  <button
                    onClick={uebergebenAnAbschluss}
                    disabled={ausgewaehlt.size === 0}
                    style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', cursor: ausgewaehlt.size > 0 ? 'pointer' : 'not-allowed', background: ausgewaehlt.size > 0 ? 'var(--accent)' : 'var(--border)', color: ausgewaehlt.size > 0 ? '#fff' : 'var(--text-muted)', fontSize: '12px', fontWeight: 700 }}
                  >
                    📁 In Abschluss übernehmen
                  </button>
                </div>
              )}
            </div>

            {showAuswahl && (
              <div style={{ padding: '10px 14px 14px', fontSize: '11px', color: 'var(--text-muted)' }}>
                Wähle oben in den Karten die gewünschten Punkte aus. Die Einträge werden als Prüfpunkte oder Rückfragen im Abschluss-Reiter angelegt.
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Leer-Zustand ── */}
      {!isLoading && !ergebnis && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', fontSize: '13px' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🧠</div>
          <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>Branche eingeben und Übersicht erstellen</div>
          <div style={{ fontSize: '12px', lineHeight: 1.6, maxWidth: '380px', margin: '0 auto' }}>
            Die KI generiert eine branchenspezifische Übersicht mit steuerlichen Besonderheiten, typischen Prüfungsschwerpunkten,
            Risiken und Rückfragen-Ideen.
            {client.rechtsform && (
              <><br /><br />Kontext wird berücksichtigt: <strong>{[client.rechtsform, client.gewinnermittlung].filter(Boolean).join(' · ')}</strong></>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}
