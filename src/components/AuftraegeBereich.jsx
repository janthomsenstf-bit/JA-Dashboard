import { useState } from 'react'
import { MERK_MIME } from './GlobalTodoView.jsx'

/**
 * Bereich „Aufträge" – die Auftragsübersicht mit zwei Ansichten:
 *
 *  · Aufträge    – die Auftragsübersicht (Standard)
 *  · Meine Liste – die persönliche Merkliste: nur, was hineingezogen wurde
 *
 * Der Reiter „Meine Liste" ist zugleich Ablagefläche: eine Zeile aus der
 * Auftragsübersicht darauf ziehen merkt sie vor. Gemerkt wird nur ein Verweis,
 * nie eine Kopie – „✕" in der Liste nimmt den Eintrag heraus, nicht aus den Daten.
 *
 * Kalender und Honorare sind eigene Hauptmenüpunkte und liegen nicht hier.
 * Beide Ansichten sind fertige Elemente aus App.jsx – dieser Bereich ist nur
 * die Reiterleiste darüber.
 */

const FARBE = '#2563eb' // Farbwelt des Bereichs „Aufträge"

const ANSICHTEN = [
  { key: 'auftraege', label: 'Aufträge',    icon: '📑' },
  { key: 'aufgaben',  label: 'Meine Liste', icon: '📋' },
]

const ANSICHT_KEY = 'auftraege-ansicht'

function ladeAnsicht() {
  try {
    const gemerkt = localStorage.getItem(ANSICHT_KEY)
    // Alte Werte (z. B. das entfernte „cockpit") würden sonst ins Leere zeigen.
    if (ANSICHTEN.some(a => a.key === gemerkt)) return gemerkt
  } catch {}
  return 'auftraege'
}

export default function AuftraegeBereich({
  slotAuftraege,   // die Auftragsübersicht (Standardansicht)
  slotAufgaben,    // die persönliche Merkliste
  onMerken,        // Eintrag vormerken (Verweis { id, clientId })
  merkAnzahl = 0,
}) {
  const [ansicht, setAnsicht] = useState(ladeAnsicht)
  const [ueberMerk, setUeberMerk] = useState(false)   // Zeile schwebt über dem Reiter
  const wechsel = a => { setAnsicht(a); try { localStorage.setItem(ANSICHT_KEY, a) } catch {} }

  function ablegen(e) {
    e.preventDefault()
    setUeberMerk(false)
    try {
      const roh = e.dataTransfer.getData(MERK_MIME)
      if (!roh) return
      onMerken?.(JSON.parse(roh))
    } catch { /* unbrauchbare Ablage einfach ignorieren */ }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* Kopf */}
      <div style={{ padding: '14px 20px 0', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <nav aria-label="Pfad" style={{ display: 'flex', gap: '7px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          <span>Spielbuch</span><span style={{ opacity: 0.5 }}>›</span>
          <span style={{ color: FARBE, fontWeight: 700 }}>Aufträge</span>
        </nav>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {ANSICHTEN.map(a => {
            const ist    = ansicht === a.key
            const istMerk = a.key === 'aufgaben'          // Ablagefläche
            const aktivesZiel = istMerk && ueberMerk
            return (
              <button key={a.key} onClick={() => wechsel(a.key)}
                aria-current={ist ? 'page' : undefined}
                title={istMerk ? 'Zeilen aus der Auftragsübersicht hierher ziehen, um sie vorzumerken' : undefined}
                onDragOver={istMerk ? (e => { if (e.dataTransfer.types.includes(MERK_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setUeberMerk(true) } }) : undefined}
                onDragLeave={istMerk ? (() => setUeberMerk(false)) : undefined}
                onDrop={istMerk ? ablegen : undefined}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '7px',
                  padding: '9px 15px', border: 'none', cursor: 'pointer',
                  background: aktivesZiel ? `${FARBE}1a` : 'transparent',
                  borderRadius: aktivesZiel ? '8px 8px 0 0' : 0,
                  outline: aktivesZiel ? `2px dashed ${FARBE}` : 'none', outlineOffset: '-2px',
                  borderBottom: `2px solid ${ist ? FARBE : 'transparent'}`,
                  color: ist || aktivesZiel ? FARBE : 'var(--text-muted)',
                  fontWeight: ist ? 700 : 500, fontSize: '13px',
                  transition: 'color 0.16s, border-color 0.16s, background 0.12s',
                }}>
                <span aria-hidden="true">{a.icon}</span>{a.label}
                {istMerk && merkAnzahl > 0 && (
                  <span style={{
                    fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '10px',
                    background: 'var(--surface2)', color: 'var(--text-muted)',
                  }}>{merkAnzahl}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Reine Auftragsübersicht (Standard) ── */}
      {ansicht === 'auftraege' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {slotAuftraege ?? <Leer text="Auftrags-Übersicht ist hier nicht verfügbar." />}
        </div>
      )}

      {/* ── Meine Liste: zusätzlich auto-Fristen und manuelle Aufgaben ── */}
      {ansicht === 'aufgaben' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {slotAufgaben ?? <Leer text="Diese Ansicht ist hier nicht verfügbar." />}
        </div>
      )}
    </div>
  )
}

function Leer({ text }) {
  return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>{text}</div>
}
