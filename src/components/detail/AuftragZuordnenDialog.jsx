import { useState } from 'react'

/**
 * Einheitlicher Zuordnungs-Dialog: haengt eine Mail / einen Beleg / eine Notiz
 * an einen BESTEHENDEN oder einen NEU anzulegenden Auftrag.
 *
 * Wird ueberall gleich verwendet (KommunikationTab, DokumenteTab, BotInbox),
 * damit es EIN System ist und nicht mehrere.
 *
 * Props:
 *   auftraege     Array bestehender Auftraege des Mandanten (zur Auswahl)
 *   quelleLabel   kurze Beschreibung, was verknuepft wird (z.B. "📄 Beleg: rechnung.pdf")
 *   neuBezDefault Vorbelegung fuer die Bezeichnung, falls neuer Auftrag (z.B. Dateiname/Betreff)
 *   mitFrist      wenn true, kann optional eine eigene Frist gesetzt werden
 *   accent        Akzentfarbe (default cyan wie Auftraege)
 *   onConfirm     ({ zielId, neuTyp, neuBez, neuJahr, frist }) => void
 *                   zielId === '__neu__'  -> neuer Auftrag (neuTyp/neuBez/neuJahr)
 *                   sonst                 -> vorhandene Auftrags-ID
 *                   frist === '' wenn keine gesetzt
 *   onCancel      () => void
 */

const AUFTRAG_TYP_OPTIONEN = [
  { v: 'jahresabschluss', l: '📁 Jahresabschluss' },
  { v: 'fibu',            l: '📒 Buchhaltung/FIBU' },
  { v: 'lohn',            l: '💼 Lohn' },
  { v: 'beratung',        l: '🧠 Beratung' },
  { v: 'ust',             l: '🧾 Umsatzsteuer' },
  { v: 'freitext',        l: '📝 Eigener Auftrag' },
]

export default function AuftragZuordnenDialog({
  auftraege = [],
  quelleLabel = '',
  neuBezDefault = '',
  mitFrist = false,
  accent = '#0891b2',
  onConfirm,
  onCancel,
}) {
  const [ziel,    setZiel]    = useState('')
  const [neuTyp,  setNeuTyp]  = useState('freitext')
  const [neuBez,  setNeuBez]  = useState(neuBezDefault || '')
  const [neuJahr, setNeuJahr] = useState(new Date().getFullYear())
  const [fristAktiv, setFristAktiv] = useState(false)
  const [frist,   setFrist]   = useState('')

  const istNeu = ziel === '__neu__'
  const kannSpeichern = istNeu ? neuBez.trim().length > 0 : !!ziel

  const offeneAuftraege = (auftraege ?? []).filter(a => a && a.status !== 'erledigt')

  function bestaetigen() {
    if (!kannSpeichern) return
    onConfirm?.({
      zielId:  ziel,
      neuTyp,
      neuBez:  neuBez.trim(),
      neuJahr: Number(neuJahr) || new Date().getFullYear(),
      frist:   (mitFrist && fristAktiv) ? frist : '',
    })
  }

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
               display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px',
                 width: '100%', maxWidth: '440px', maxHeight: '85vh', overflowY: 'auto',
                 boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        {/* Kopf */}
        <div style={{ padding: '16px 18px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: accent }}>📋 Einem Auftrag zuordnen</div>
          {quelleLabel && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px',
                          padding: '5px 8px', background: 'var(--bg)', borderRadius: '6px',
                          border: '1px solid var(--border)', wordBreak: 'break-word' }}>
              {quelleLabel}
            </div>
          )}
        </div>

        {/* Auswahl */}
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>An welchen Auftrag?</div>
          <select className="input" value={ziel} onChange={e => setZiel(e.target.value)}
            style={{ fontSize: '12px', padding: '7px 8px', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
            <option value="">– Bitte wählen –</option>
            {offeneAuftraege.length > 0 && (
              <optgroup label="Bestehende Aufträge">
                {offeneAuftraege.map(a => (
                  <option key={a.id} value={a.id}>
                    {(a.bezeichnung || a.typ) + (a.jahr ? ` (${a.jahr})` : '')}
                  </option>
                ))}
              </optgroup>
            )}
            <option value="__neu__">➕ Neuen Auftrag anlegen</option>
          </select>

          {/* Neuer Auftrag */}
          {istNeu && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px',
                          background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <select className="input" value={neuTyp} onChange={e => setNeuTyp(e.target.value)}
                style={{ fontSize: '12px', padding: '6px 8px', borderRadius: '6px' }}>
                {AUFTRAG_TYP_OPTIONEN.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <input className="input" value={neuBez} onChange={e => setNeuBez(e.target.value)}
                placeholder="Bezeichnung…"
                style={{ fontSize: '12px', padding: '6px 8px', borderRadius: '6px', width: '100%', boxSizing: 'border-box' }} />
              <input type="number" className="input" value={neuJahr} onChange={e => setNeuJahr(e.target.value)}
                style={{ fontSize: '12px', padding: '6px 8px', borderRadius: '6px', width: '90px' }} />
            </div>
          )}

          {/* Optionale eigene Frist */}
          {mitFrist && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input type="checkbox" checked={fristAktiv} onChange={e => setFristAktiv(e.target.checked)} />
                Eigene Frist/Erinnerung für diese Verknüpfung setzen
              </label>
              {fristAktiv && (
                <input type="date" className="input" value={frist} onChange={e => setFrist(e.target.value)}
                  style={{ fontSize: '12px', padding: '6px 8px', borderRadius: '6px', width: '160px' }} />
              )}
            </div>
          )}
        </div>

        {/* Aktionen */}
        <div style={{ display: 'flex', gap: '8px', padding: '10px 18px 16px' }}>
          <button className="btn btn-primary btn-sm" onClick={bestaetigen} disabled={!kannSpeichern}
            style={{ fontSize: '12px', flex: 1, borderRadius: '8px', opacity: kannSpeichern ? 1 : 0.5 }}>
            Zuordnen
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}
            style={{ fontSize: '12px', borderRadius: '8px' }}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
