/**
 * LohnJahresmappe.jsx – Jahres-Arbeitsmappe im Lohn-Auftrag.
 *
 * Setzt auf den bestehenden Lohn-Monatsmotor auf (generateAufgaben + aufgabenStatus):
 *   - Monatsaufgaben & Erledigt-Status kommen aus dem Motor (gleiche Keys wie die
 *     globale Aufgaben-Übersicht → kein doppelter Bestand, immer synchron).
 *   - NEU & rein additiv: Pro-Monat-Hinweise/Unteraufgaben werden am Auftrag
 *     gespeichert (au.monatsHinweise), erledigte bleiben als Historie erhalten.
 *
 * Props: { client, au, onUpdate, onUpdateClient }
 *   onUpdate       – patcht den Auftrag (au.monatsHinweise)
 *   onUpdateClient – patcht den Mandanten (aufgabenStatus, lohnAktiv/lohnSerie)
 */
import { useState } from 'react'
import { generateAufgaben, getStatus, buildTogglePatch } from '../../utils/aufgaben.js'
import SerieKonfigPanel from './SerieKonfigPanel.jsx'
import { MerkzettelDiktat } from './LohnMerkzettel.jsx'
import { zeitraumText } from './LohnStammdaten.jsx'

const ACCENT = '#7c3aed'
const MONAT_NAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

function newId() { return 'mh' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36) }

function fmtDatumZeit(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const dat = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
  const zeit = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return `${dat}, ${zeit} Uhr`
}

// ── Hinweise/Unteraufgaben eines Monats ────────────────────────────────────────
function MonatHinweise({ hinweise, onChange }) {
  const [text, setText] = useState('')

  function add(t) {
    const v = (t ?? text).trim()
    if (!v) return
    onChange([...hinweise, { id: newId(), text: v, erledigt: false, erledigtAm: null, eingegangenAm: new Date().toISOString() }])
    setText('')
  }
  function toggle(id) {
    onChange(hinweise.map(h => h.id !== id ? h : { ...h, erledigt: !h.erledigt, erledigtAm: !h.erledigt ? new Date().toISOString() : null }))
  }
  function del(id) {
    if (!window.confirm('Diesen Hinweis löschen?')) return
    onChange(hinweise.filter(h => h.id !== id))
  }
  function addFromDiktat(list) {
    const neu = list.map(e => ({
      id: newId(),
      text: (e.mitarbeiter ? e.mitarbeiter + ': ' : '') + e.hinweis,
      erledigt: false, erledigtAm: null, eingegangenAm: new Date().toISOString(),
    }))
    onChange([...hinweise, ...neu])
  }

  const offen    = hinweise.filter(h => !h.erledigt)
  const erledigt = hinweise.filter(h => h.erledigt)
  const inputS = { flex: 1, padding: '6px 9px', border: '1px solid var(--border)', borderRadius: '6px', background: '#fff', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box' }

  function Zeile({ h }) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 10px', borderRadius: '6px', background: h.erledigt ? 'rgba(22,163,74,0.05)' : 'var(--surface2)', border: `1px solid ${h.erledigt ? 'rgba(22,163,74,0.2)' : 'var(--border)'}` }}>
        <input type="checkbox" checked={h.erledigt} onChange={() => toggle(h.id)} style={{ accentColor: '#16a34a', cursor: 'pointer', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12.5px', color: h.erledigt ? 'var(--text-muted)' : 'var(--text)', textDecoration: h.erledigt ? 'line-through' : 'none', lineHeight: 1.45, wordBreak: 'break-word' }}>
            {h.text}
          </div>
          {h.erledigt && h.erledigtAm && (
            <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600, marginTop: '2px' }}>✓ erledigt am {fmtDatumZeit(h.erledigtAm)}</div>
          )}
        </div>
        <button onClick={() => del(h.id)} title="Löschen"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', padding: '0 2px', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>🗑</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Eingabe */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Hinweis / Besonderheit… (Enter)" style={inputS} />
        <button onClick={() => add()} disabled={!text.trim()}
          style={{ padding: '0 13px', borderRadius: '6px', border: 'none', background: text.trim() ? ACCENT : 'var(--border)', color: '#fff', fontSize: '16px', fontWeight: 700, cursor: text.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}>+</button>
      </div>

      <MerkzettelDiktat onEntries={addFromDiktat} />

      {/* Offene */}
      {offen.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {offen.map(h => <Zeile key={h.id} h={h} />)}
        </div>
      )}

      {/* Erledigte (Historie des Monats) */}
      {erledigt.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>
            Erledigt ({erledigt.length})
          </div>
          {erledigt.map(h => <Zeile key={h.id} h={h} />)}
        </div>
      )}

      {hinweise.length === 0 && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px' }}>Noch keine Hinweise für diesen Monat.</div>
      )}
    </div>
  )
}

export default function LohnJahresmappe({ client, au, onUpdate, onUpdateClient }) {
  const jahr = au.jahr || new Date().getFullYear()
  const monatsHinweise = au.monatsHinweise ?? {}
  const [showSettings, setShowSettings] = useState(false)
  const [openMonat, setOpenMonat] = useState(new Date().getMonth() + 1)

  const lohnTasks = generateAufgaben(client)
    .filter(t => t.type === 'Lohn' && t.jahr === jahr)
    .sort((a, b) => (a.monat || 0) - (b.monat || 0))

  const defaultSerie = { aktiv: true, startDatum: `${jahr}-01-01`, frequenz: 'monatlich', faelligTag: 25, endDatum: '', intervallTyp: 'monate', intervallWert: 1 }

  function setSerie(serie) { onUpdateClient({ lohnAktiv: true, lohnSerie: serie }) }
  function setMonatHinweise(m, list) { onUpdate({ monatsHinweise: { ...monatsHinweise, [m]: list } }) }
  function toggleMonat(key) { onUpdateClient(buildTogglePatch(client, key)) }

  const erledigtCount = lohnTasks.filter(t => getStatus(client, t.key).erledigt).length

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Kopf */}
      <div style={{ background: ACCENT, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '16px' }}>📋</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Lohn-Jahresmappe {jahr}</span>
        {lohnTasks.length > 0 && (
          <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.18)', padding: '2px 9px', borderRadius: '10px', fontWeight: 700 }}>
            {erledigtCount} / {lohnTasks.length} Monate abgerechnet
          </span>
        )}
        <button onClick={() => setShowSettings(v => !v)} title="Lohn-Einstellungen / Start-Monat"
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '6px', padding: '3px 8px', fontSize: '12px', cursor: 'pointer' }}>⚙</button>
      </div>

      {/* Einstellungen (Start-Monat / Serie) */}
      {showSettings && (
        <div style={{ padding: '12px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Bestimmt, ab welchem Monat Lohn-Aufgaben erzeugt werden (auch in der globalen Aufgaben-Übersicht). Start-Monat = <b>Startdatum</b>.
          </div>
          <SerieKonfigPanel config={client.lohnSerie ?? defaultSerie} onChange={setSerie} accentColor={ACCENT} taskLabel="Lohnabrechnung" />
        </div>
      )}

      {/* Inhalt */}
      {lohnTasks.length === 0 ? (
        <div style={{ padding: '14px', background: 'var(--surface)' }}>
          <div style={{ fontSize: '12.5px', color: 'var(--text)', marginBottom: '10px' }}>
            Für <b>{jahr}</b> sind noch keine Lohn-Monate angelegt. Aktiviere die Lohnabrechnung und lege den <b>Start-Monat</b> fest – danach erscheinen die Monate hier und in der globalen Aufgaben-Übersicht:
          </div>
          <SerieKonfigPanel config={client.lohnSerie ?? defaultSerie} onChange={setSerie} accentColor={ACCENT} taskLabel="Lohnabrechnung" />
        </div>
      ) : (
        <div style={{ background: 'var(--surface)' }}>
          {lohnTasks.map((t, i) => {
            const st       = getStatus(client, t.key)
            const m        = t.monat
            const hinweise = monatsHinweise[m] ?? []
            const offenH   = hinweise.filter(h => !h.erledigt).length
            const open     = openMonat === m
            const heute    = new Date()
            const istAkt   = m === heute.getMonth() + 1 && jahr === heute.getFullYear()

            return (
              <div key={t.key} style={{ borderBottom: i < lohnTasks.length - 1 ? '1px solid var(--border)' : 'none' }}>
                {/* Monats-Kopfzeile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', background: open ? 'var(--surface2)' : 'transparent' }}>
                  {/* Erledigt-Checkbox (Monat abgerechnet) */}
                  <input type="checkbox" checked={st.erledigt} onChange={() => toggleMonat(t.key)}
                    title="Monat als abgerechnet markieren"
                    style={{ width: '16px', height: '16px', accentColor: '#16a34a', cursor: 'pointer', flexShrink: 0 }} />

                  {/* Klickbarer Titelbereich (auf/zu) */}
                  <button onClick={() => setOpenMonat(open ? null : m)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: st.erledigt ? '#16a34a' : 'var(--text)' }}>
                      {MONAT_NAMEN[m - 1]} {jahr}
                    </span>
                    {istAkt && !st.erledigt && (
                      <span style={{ fontSize: '10px', background: 'rgba(124,58,237,0.15)', color: ACCENT, padding: '1px 6px', borderRadius: '8px', fontWeight: 700 }}>Aktuell</span>
                    )}
                    {st.erledigt && st.erledigtAm && (
                      <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>✓ {fmtDatumZeit(st.erledigtAm)}</span>
                    )}
                    {offenH > 0 && (
                      <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 700 }}>● {offenH} Hinweis{offenH !== 1 ? 'e' : ''}</span>
                    )}
                    <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '12px', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▸</span>
                  </button>
                </div>

                {/* Monats-Detail (Hinweise) */}
                {open && (
                  <div style={{ padding: '4px 14px 14px 14px', background: 'var(--surface2)' }}>
                    {(() => {
                      const dauer = (au.mitarbeiterAnweisungen ?? []).filter(d => (!d.vonMonat || m >= d.vonMonat) && (!d.bisMonat || m <= d.bisMonat))
                      if (!dauer.length) return null
                      return (
                        <div style={{ marginBottom: '8px', padding: '7px 10px', borderRadius: '6px', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>🧷 Diesen Monat zu beachten (Dauer-Anweisungen)</div>
                          {dauer.map(d => (
                            <div key={d.id} style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.5 }}>
                              • {d.mitarbeiter ? <b>{d.mitarbeiter}: </b> : ''}{d.anweisung} <span style={{ color: 'var(--text-muted)' }}>({zeitraumText(d.vonMonat, d.bisMonat)})</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                    <MonatHinweise hinweise={hinweise} onChange={list => setMonatHinweise(m, list)} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
