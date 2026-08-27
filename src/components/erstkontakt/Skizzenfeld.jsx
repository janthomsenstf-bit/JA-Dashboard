/**
 * Skizzenfeld – Freihand-Zeichenfläche für den Erstkontaktbogen.
 *
 * Für den S Pen gedacht: Zeichnen läuft über Pointer-Events (Stift, Finger, Maus),
 * die Strichstärke folgt dem Druck. `touch-action: none` verhindert, dass beim
 * Zeichnen die Seite scrollt.
 *
 * Gespeichert wird ein PNG als Datenadresse am Bogen (bogen.skizze) – also im
 * selben Datensatz wie die Felder, damit nichts getrennt verloren gehen kann.
 */
import { useEffect, useRef, useState } from 'react'

const BREITE = 1000
const HOEHE  = 460

export default function Skizzenfeld({ wert, onChange, akzent = '#3f6aa6' }) {
  const canvasRef = useRef(null)
  const zeichnetRef = useRef(false)
  const letzterRef = useRef(null)
  const [stift, setStift] = useState('#1f2937')   // Tinte oder Radierer
  const [leer, setLeer]   = useState(!wert)

  // Vorhandene Skizze beim Öffnen wiederherstellen.
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, BREITE, HOEHE)
    if (wert) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, BREITE, HOEHE)
      img.src = wert
      setLeer(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function punkt(e) {
    const c = canvasRef.current
    const r = c.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) * (BREITE / r.width),
      y: (e.clientY - r.top)  * (HOEHE / r.height),
      // Stifte melden echten Druck; Finger/Maus liefern 0 oder 0.5 → fester Wert
      druck: e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5,
    }
  }

  function start(e) {
    e.preventDefault()
    canvasRef.current?.setPointerCapture?.(e.pointerId)
    zeichnetRef.current = true
    letzterRef.current = punkt(e)
  }

  function bewegen(e) {
    if (!zeichnetRef.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const p = punkt(e)
    const v = letzterRef.current || p
    const radierer = stift === 'radierer'
    ctx.strokeStyle = radierer ? '#ffffff' : stift
    ctx.lineWidth = radierer ? 26 : Math.max(1.2, p.druck * 4.5)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(v.x, v.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    letzterRef.current = p
    setLeer(false)
  }

  function ende(e) {
    if (!zeichnetRef.current) return
    zeichnetRef.current = false
    letzterRef.current = null
    try { canvasRef.current?.releasePointerCapture?.(e.pointerId) } catch { /* egal */ }
    speichern()
  }

  function speichern() {
    const c = canvasRef.current
    if (!c) return
    try { onChange?.(c.toDataURL('image/png')) } catch { /* Speicher voll o. Ä. */ }
  }

  function loeschen() {
    if (!window.confirm('Skizze wirklich löschen?')) return
    const ctx = canvasRef.current.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, BREITE, HOEHE)
    setLeer(true)
    onChange?.(null)
  }

  const werkzeug = (aktiv, farbe) => ({
    width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer',
    border: aktiv ? '3px solid ' + akzent : '1px solid var(--border2, var(--border))',
    background: farbe === 'radierer' ? 'var(--surface2)' : farbe,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px',
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {['#1f2937', akzent, '#c2410c'].map(f => (
          <button key={f} onClick={() => setStift(f)} title="Stiftfarbe" style={werkzeug(stift === f, f)} />
        ))}
        <button onClick={() => setStift('radierer')} title="Radierer" style={werkzeug(stift === 'radierer', 'radierer')}>◻</button>
        <span style={{ flex: 1 }} />
        <button onClick={loeschen} disabled={leer}
          style={{ font: 'inherit', fontSize: '12.5px', fontWeight: 600, padding: '7px 13px', borderRadius: '11px', cursor: leer ? 'default' : 'pointer',
            border: '1px solid var(--border2, var(--border))', background: 'var(--surface)', color: 'var(--text-secondary)', opacity: leer ? 0.5 : 1 }}>
          Leeren
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={BREITE}
        height={HOEHE}
        onPointerDown={start}
        onPointerMove={bewegen}
        onPointerUp={ende}
        onPointerLeave={ende}
        onPointerCancel={ende}
        style={{
          width: '100%', height: 'auto', display: 'block', touchAction: 'none',
          borderRadius: '11px', border: '1px solid var(--border2, var(--border))',
          background: '#ffffff', cursor: 'crosshair',
        }}
      />
      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}>
        {leer
          ? 'Mit dem S Pen zeichnen – Beteiligungen, Grundstück, schnelle Zahlen. Die Strichstärke folgt dem Druck.'
          : '✓ Skizze wird beim Bogen gespeichert.'}
      </div>
    </div>
  )
}
