import { useState, useEffect } from 'react'
import { cloudListSnapshotsWithValues } from '../utils/cloudStorage.js'

const STORAGE_KEY = 'jans-spielbuch-v1'

// Zählt Aufträge / Zeiteinträge in einem Snapshot-Wert (Array von Mandanten)
function analyse(value) {
  const clients = Array.isArray(value) ? value : []
  let zeit = 0, auftraege = 0, honorare = 0
  for (const c of clients) {
    zeit      += Array.isArray(c?.zeiteintraege) ? c.zeiteintraege.length : 0
    auftraege += Array.isArray(c?.auftraege)     ? c.auftraege.length     : 0
    auftraege += Array.isArray(c?.jaAuftraege)   ? c.jaAuftraege.length   : 0
    honorare  += Array.isArray(c?.honorare)      ? c.honorare.length      : 0
  }
  return { mandanten: clients.length, zeit, auftraege, honorare }
}

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString('de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return String(ts) }
}

export default function DatenRettung({ onMerge }) {
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [snaps, setSnaps]     = useState([])
  const [done, setDone]       = useState('')

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
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: 860 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 22, color: 'var(--text)' }}>🛟 Daten-Rettung</h2>
      <p style={{ margin: '0 0 16px', color: 'var(--muted)', fontSize: 14, lineHeight: 1.55 }}>
        Automatische Sicherungen deiner Mandanten. <strong>Zusammenführen fügt nur Fehlendes hinzu
        und löscht nie etwas</strong> – Aufträge, Zeiten und Honorare aus dem Backup werden zu deinem
        aktuellen Stand ergänzt.
      </p>

      {/* Sicherste Rettung: alles vereinen */}
      <div style={{
        background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10,
        padding: '14px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 13, color: 'var(--text)' }}>
          <strong>Sicherste Rettung:</strong> alle Sicherungen mit dem aktuellen Stand vereinen.
          Du bekommst garantiert alles zurück, was je gesichert wurde.
        </div>
        <button
          disabled={loading || snaps.length === 0}
          onClick={() => {
            if (!window.confirm(
              `Alle ${snaps.length} Sicherungen mit dem aktuellen Stand zusammenführen?\n\n` +
              `Es wird nur Fehlendes ergänzt, nichts gelöscht. ` +
              `Der aktuelle Stand wird vorher zusätzlich gesichert.`
            )) return
            onMerge(snaps.map(s => s.value))
            setDone('Alle Sicherungen wurden zusammengeführt. Bitte prüfe deine Mandanten.')
          }}
          style={{
            padding: '10px 16px', borderRadius: 8, border: 'none',
            cursor: loading || snaps.length === 0 ? 'not-allowed' : 'pointer',
            background: '#0891b2', color: '#fff', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
            opacity: loading || snaps.length === 0 ? 0.5 : 1,
          }}
        >
          Alle zusammenführen
        </button>
      </div>

      {done && (
        <div style={{ color: '#047857', background: '#ecfdf5', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
          ✓ {done}
        </div>
      )}
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
        {snaps.map((s, i) => (
          <div
            key={s.id}
            style={{
              border: '1px solid var(--border)', borderLeft: '4px solid #0891b2',
              borderRadius: 10, padding: '14px 16px', background: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>
                  {fmt(s.created_at)} {i === 0 && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(neueste)</span>}
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                  {s.info.mandanten} Mandanten · <strong>{s.info.auftraege} Aufträge</strong> ·{' '}
                  <strong>{s.info.zeit} Zeiteinträge</strong> · {s.info.honorare} Honorare
                </div>
              </div>
              <button
                onClick={() => {
                  if (!window.confirm(
                    `Diese Sicherung vom ${fmt(s.created_at)} mit dem aktuellen Stand zusammenführen?\n\n` +
                    `• ${s.info.auftraege} Aufträge\n• ${s.info.zeit} Zeiteinträge\n\n` +
                    `Es wird nur Fehlendes ergänzt, nichts gelöscht.`
                  )) return
                  onMerge([s.value])
                  setDone(`Sicherung vom ${fmt(s.created_at)} wurde eingefügt. Bitte prüfe deine Mandanten.`)
                }}
                style={{
                  padding: '9px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'var(--surface2)', color: 'var(--text)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
                }}
              >
                Zusammenführen
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
