import { useState } from 'react'

/**
 * Bereich „Aufträge" – die Auftragsübersicht mit zwei Ansichten:
 *
 *  · Aufträge    – die reine Auftragsübersicht (Standard, unverändert)
 *  · Meine Liste – dieselbe Übersicht, zusätzlich mit automatischen Fristen
 *                  und manuellen Aufgaben (Quellen-Filter eingeblendet)
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
  slotAuftraege,   // die reine Auftragsübersicht (Standardansicht)
  slotAufgaben,    // dieselbe Übersicht, zusätzlich mit Fristen und Aufgaben
}) {
  const [ansicht, setAnsicht] = useState(ladeAnsicht)
  const wechsel = a => { setAnsicht(a); try { localStorage.setItem(ANSICHT_KEY, a) } catch {} }

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
            const ist = ansicht === a.key
            return (
              <button key={a.key} onClick={() => wechsel(a.key)}
                aria-current={ist ? 'page' : undefined}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '7px',
                  padding: '9px 15px', border: 'none', background: 'transparent', cursor: 'pointer',
                  borderBottom: `2px solid ${ist ? FARBE : 'transparent'}`,
                  color: ist ? FARBE : 'var(--text-muted)',
                  fontWeight: ist ? 700 : 500, fontSize: '13px',
                  transition: 'color 0.16s, border-color 0.16s',
                }}>
                <span aria-hidden="true">{a.icon}</span>{a.label}
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
