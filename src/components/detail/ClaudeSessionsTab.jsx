/**
 * ClaudeSessionsTab – Sitzungen der Claude-Desktop-App am Mandanten hinterlegen.
 *
 * Hintergrund: Zu jeder Sitzung lässt sich der Link kopieren. Die Desktop-App
 * registriert unter Windows den Protokoll-Handler `claude://` und kennt zwei
 * Sprungziele:
 *   • Cloud-/Cowork-Sitzung (ID beginnt mit cse_ bzw. session_):
 *       claude://code/<id>            – aus https://claude.ai/cowork/<id>
 *   • lokale CLI-Sitzung (ID ist eine UUID):
 *       claude://resume?session=<uuid>
 * Beide Formen werden hier erkannt; zusätzlich bleibt der Web-Link als Rückfall.
 *
 * Gespeichert wird additiv in client.claudeSessions (Array) – kein bestehendes
 * Feld wird angefasst, migrateClient behält unbekannte Felder ohnehin bei.
 */
import { useState } from 'react'

const UUID_RE  = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/
const CLOUD_RE = /(?:cse|session)_((?:staging_)?[A-Za-z0-9]{1,64})/

/**
 * Erkennt aus Rohtext (kopierter Link, nackte ID) die Sitzung.
 * → { typ: 'cloud'|'lokal', sessionId } oder null
 */
function parseSession(raw) {
  const text = String(raw ?? '').trim()
  const cloud = text.match(CLOUD_RE)
  if (cloud) return { typ: 'cloud', sessionId: 'cse_' + cloud[1] }   // session_… wird auf cse_… normalisiert
  const uuid = text.match(UUID_RE)
  if (uuid) return { typ: 'lokal', sessionId: uuid[0].toLowerCase() }
  return null
}

// Alt-Einträge ohne typ-Feld anhand der ID einordnen.
function typVon(s) {
  return s.typ ?? (/^(?:cse|session)_/.test(s.sessionId ?? '') ? 'cloud' : 'lokal')
}

// Sprung in die Desktop-App.
function appUrl(s) {
  return typVon(s) === 'cloud'
    ? 'claude://code/' + encodeURIComponent(s.sessionId)
    : 'claude://resume?session=' + encodeURIComponent(s.sessionId)
}

// Rückfall: dieselbe Sitzung im Browser (nur für Cloud-/Cowork-Sitzungen).
function webUrl(s) {
  return typVon(s) === 'cloud'
    ? 'https://claude.ai/cowork/' + encodeURIComponent(s.sessionId)
    : null
}

function fmtDatum(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

export default function ClaudeSessionsTab({ client, onUpdate }) {
  const sessions = Array.isArray(client.claudeSessions) ? client.claudeSessions : []

  const [neuLabel,  setNeuLabel]  = useState('')
  const [neuId,     setNeuId]     = useState('')
  const [neuNotiz,  setNeuNotiz]  = useState('')
  const [fehler,    setFehler]    = useState('')
  const [toast,     setToast]     = useState('')
  const [loeschId,  setLoeschId]  = useState(null)   // 2-Klick-Bestätigung statt window.confirm
  const [editId,    setEditId]    = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [editNotiz, setEditNotiz] = useState('')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // Immer die vollständige Liste zurückschreiben (rein additive Ergänzung am Client).
  function speichern(next) {
    onUpdate({ claudeSessions: next })
  }

  function hinzufuegen() {
    setFehler('')
    const parsed = parseSession(neuId)
    if (!parsed) {
      setFehler('Keine Sitzung erkannt. Erwartet wird der kopierte Link (z.B. https://claude.ai/cowork/cse_…), die ID selbst oder – bei lokalen CLI-Sitzungen – eine UUID.')
      return
    }
    const sid = parsed.sessionId
    if (sessions.some(s => s.sessionId === sid)) {
      setFehler('Diese Sitzungs-ID ist bei diesem Mandanten bereits hinterlegt.')
      return
    }
    const eintrag = {
      id:               'cs' + Date.now().toString(36),
      label:            neuLabel.trim() || 'Sitzung',
      sessionId:        sid,
      typ:              parsed.typ,
      notiz:            neuNotiz.trim(),
      angelegtAm:       new Date().toISOString(),
      zuletztGeoeffnet: null,
    }
    speichern([...sessions, eintrag])
    setNeuLabel(''); setNeuId(''); setNeuNotiz('')
    showToast('✅ Sitzung hinterlegt')
  }

  function loeschen(id) {
    speichern(sessions.filter(s => s.id !== id))
    setLoeschId(null)
    showToast('Eintrag entfernt')
  }

  function editSpeichern(id) {
    speichern(sessions.map(s => s.id === id
      ? { ...s, label: editLabel.trim() || 'Sitzung', notiz: editNotiz.trim() }
      : s))
    setEditId(null)
    showToast('✅ Gespeichert')
  }

  // Merkt nur den Zeitpunkt – geöffnet wird der Link nativ vom <a>.
  function merkeGeoeffnet(id) {
    speichern(sessions.map(s => s.id === id
      ? { ...s, zuletztGeoeffnet: new Date().toISOString() }
      : s))
  }

  async function kopieren(text, was) {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`📋 ${was} kopiert`)
    } catch {
      showToast('⚠ Kopieren nicht möglich')
    }
  }

  return (
    <div style={{ padding: '18px 20px', maxWidth: '900px' }}>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>✨ Claude-Sitzungen</h2>
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
          {sessions.length} hinterlegt
        </span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Link oder ID der Sitzung in Cowork kopieren, hier einfügen – ein Klick auf den Eintrag öffnet
        genau diese Sitzung in der Claude-Desktop-App.
      </p>

      {toast && (
        <div style={{
          marginBottom: '12px', padding: '7px 12px', borderRadius: '8px', fontSize: '12.5px',
          background: 'rgba(22,163,74,0.10)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.3)',
        }}>{toast}</div>
      )}

      {/* ── Liste ── */}
      {sessions.length === 0 && (
        <div style={{
          padding: '18px', borderRadius: '10px', border: '1px dashed var(--border2)',
          fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '18px',
        }}>
          Noch keine Sitzung hinterlegt.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '22px' }}>
        {sessions.map(s => (
          <div key={s.id} style={{
            border: '1px solid var(--border)', borderRadius: '10px',
            background: 'var(--surface)', padding: '10px 12px',
          }}>
            {editId === s.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <input
                  className="input" value={editLabel} autoFocus
                  onChange={e => setEditLabel(e.target.value)}
                  placeholder="Bezeichnung"
                  style={{ fontSize: '13px' }}
                />
                <input
                  className="input" value={editNotiz}
                  onChange={e => setEditNotiz(e.target.value)}
                  placeholder="Notiz (optional)"
                  style={{ fontSize: '12.5px' }}
                />
                <div style={{ display: 'flex', gap: '7px' }}>
                  <button className="btn btn-sm" onClick={() => editSpeichern(s.id)}>Speichern</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>Abbrechen</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <a
                  href={appUrl(s)}
                  onClick={() => merkeGeoeffnet(s.id)}
                  title="In der Claude-Desktop-App öffnen"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px', flex: 1, minWidth: '220px',
                    textDecoration: 'none', color: 'inherit',
                  }}
                >
                  <span style={{ fontSize: '15px' }} aria-hidden="true">✨</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 600 }}>{s.label}</span>
                    <span className="mono" style={{
                      display: 'block', fontSize: '10.5px', color: 'var(--text-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{s.sessionId}</span>
                    {s.notiz && (
                      <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {s.notiz}
                      </span>
                    )}
                  </span>
                </a>

                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {s.zuletztGeoeffnet
                    ? `zuletzt ${fmtDatum(s.zuletztGeoeffnet)}`
                    : (s.angelegtAm ? `angelegt ${fmtDatum(s.angelegtAm)}` : '')}
                </span>

                <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                  <a
                    className="btn btn-sm"
                    href={appUrl(s)}
                    onClick={() => merkeGeoeffnet(s.id)}
                    style={{ textDecoration: 'none' }}
                  >
                    ▶ Öffnen
                  </a>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => kopieren(s.sessionId, 'Sitzungs-ID')}
                    title="Sitzungs-ID kopieren"
                  >📋</button>
                  {webUrl(s) && (
                    <a
                      className="btn btn-ghost btn-sm"
                      href={webUrl(s)}
                      target="_blank"
                      rel="noreferrer"
                      title="Rückfall: Sitzung im Browser öffnen"
                      style={{ textDecoration: 'none' }}
                    >🌐</a>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => { setEditId(s.id); setEditLabel(s.label ?? ''); setEditNotiz(s.notiz ?? '') }}
                    title="Bezeichnung / Notiz bearbeiten"
                  >✏️</button>
                  {loeschId === s.id ? (
                    <>
                      <button
                        className="btn btn-sm"
                        onClick={() => loeschen(s.id)}
                        style={{ color: 'var(--red)', borderColor: 'var(--red-dim)' }}
                      >Wirklich löschen</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setLoeschId(null)}>Abbrechen</button>
                    </>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setLoeschId(s.id)}
                      title="Eintrag entfernen"
                      style={{ color: 'var(--red)' }}
                    >🗑</button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Neu hinterlegen ── */}
      <div style={{
        border: '1px solid var(--border)', borderRadius: '10px',
        background: 'var(--surface)', padding: '14px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>＋ Sitzung hinterlegen</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            className="input"
            value={neuLabel}
            onChange={e => setNeuLabel(e.target.value)}
            placeholder="Bezeichnung, z.B. JA 2025 – Belegvorerfassung"
            style={{ fontSize: '13px' }}
          />
          <input
            className="input mono"
            value={neuId}
            onChange={e => { setNeuId(e.target.value); setFehler('') }}
            onKeyDown={e => { if (e.key === 'Enter') hinzufuegen() }}
            placeholder="Link oder ID einfügen, z.B. https://claude.ai/cowork/cse_…"
            style={{ fontSize: '12.5px' }}
          />
          <input
            className="input"
            value={neuNotiz}
            onChange={e => setNeuNotiz(e.target.value)}
            placeholder="Notiz (optional)"
            style={{ fontSize: '12.5px' }}
          />
          {fehler && (
            <div style={{ fontSize: '12px', color: 'var(--red)', lineHeight: 1.5 }}>{fehler}</div>
          )}
          <div>
            <button className="btn btn-sm" onClick={hinzufuegen}>Hinterlegen</button>
          </div>
        </div>
      </div>

      <p style={{ marginTop: '14px', fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Hinweis: Der Sprung funktioniert nur auf einem Rechner mit installierter
        Claude-Desktop-App – sie registriert den <span className="mono">claude://</span>-Handler.
        Der Browser fragt beim ersten Mal, ob er die App öffnen darf. Tut sich nichts, führt 🌐 dieselbe Sitzung im Browser auf.
      </p>
    </div>
  )
}
