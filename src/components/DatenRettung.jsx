import { useState, useEffect } from 'react'
import { cloudListSnapshotsWithValues } from '../utils/cloudStorage.js'

const STORAGE_KEY = 'jans-spielbuch-v1'

// Zählt Zeiteinträge / Honorardaten in einem Snapshot-Wert (Array von Mandanten)
function analyse(value) {
  const clients = Array.isArray(value) ? value : []
  let zeit = 0, mitSatz = 0
  const proMandant = []
  for (const c of clients) {
    const n = Array.isArray(c?.zeiteintraege) ? c.zeiteintraege.length : 0
    if (c?.stundensatz != null) mitSatz++
    if (n > 0) proMandant.push({ name: c?.name || '(ohne Name)', n })
    zeit += n
  }
  proMandant.sort((a, b) => b.n - a.n)
  return { mandanten: clients.length, zeit, mitSatz, proMandant }
}

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString('de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return String(ts) }
}

export default function DatenRettung({ onRestore }) {
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [snaps, setSnaps]     = useState([])

  useEffect(() => {
    let alive = true
    setLoading(true)
    cloudListSnapshotsWithValues(STORAGE_KEY)
      .then(rows => {
        if (!alive) return
        setSnaps(rows.map(r => ({ ...r, info: analyse(r.value) })))
        setLoading(false)
      })
      .catch(e => { if (alive) { setError(String(e?.message || e)); setLoading(false) } })
    return () => { alive = false }
  }, [])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: 820 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 22, color: 'var(--text)' }}>🛟 Daten-Rettung</h2>
      <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: 14, lineHeight: 1.5 }}>
        Automatische Sicherungen deiner Mandanten (alle 30 Minuten, die letzten 10).
        Wähle den Stand, der deine Zeiten/Honorare enthält, und stelle ihn wieder her.
        <br />
        <strong>Es wird nichts automatisch überschrieben</strong> – erst beim Klick auf
        „Diesen Stand wiederherstellen" (mit Sicherheitsabfrage).
      </p>

      {loading && <div style={{ color: 'var(--muted)' }}>Sicherungen werden geladen …</div>}
      {error && (
        <div style={{ color: '#dc2626', background: '#fef2f2', padding: 12, borderRadius: 8 }}>
          Fehler beim Laden der Sicherungen: {error}
        </div>
      )}

      {!loading && !error && snaps.length === 0 && (
        <div style={{ color: 'var(--muted)' }}>Keine Sicherungen gefunden.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {snaps.map((s, i) => {
          const hatZeit = s.info.zeit > 0
          return (
            <div
              key={s.id}
              style={{
                border: '1px solid var(--border)',
                borderLeft: `4px solid ${hatZeit ? '#0891b2' : 'var(--border)'}`,
                borderRadius: 10, padding: '14px 16px', background: 'var(--surface)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>
                    {fmt(s.created_at)} {i === 0 && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(neueste)</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                    {s.info.mandanten} Mandanten ·{' '}
                    <strong style={{ color: hatZeit ? '#0891b2' : 'var(--muted)' }}>
                      {s.info.zeit} Zeiteinträge
                    </strong>{' '}
                    · {s.info.mitSatz} mit Stundensatz
                  </div>
                  {hatZeit && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      {s.info.proMandant.slice(0, 6).map(p => `${p.name} (${p.n})`).join(' · ')}
                      {s.info.proMandant.length > 6 ? ' …' : ''}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    const ok = window.confirm(
                      `Stand vom ${fmt(s.created_at)} wiederherstellen?\n\n` +
                      `• ${s.info.mandanten} Mandanten\n` +
                      `• ${s.info.zeit} Zeiteinträge\n\n` +
                      `Der aktuelle Stand wird vorher automatisch als zusätzliche Sicherung abgelegt. ` +
                      `Fortfahren?`
                    )
                    if (ok) onRestore(s.value, s.created_at)
                  }}
                  style={{
                    padding: '9px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: hatZeit ? '#0891b2' : 'var(--surface2)',
                    color: hatZeit ? '#fff' : 'var(--text)',
                    fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
                  }}
                >
                  Diesen Stand wiederherstellen
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
