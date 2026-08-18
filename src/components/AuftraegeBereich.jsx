import { useState, useMemo } from 'react'
import { alleFristen, fristenGruppen, QUELLE_CFG } from '../utils/fristen.js'

/**
 * Bereich „Aufträge" – hier laufen alle Dinge mit Datum zusammen.
 * (Der frühere eigene Menüpunkt „Aufgaben" ist hier aufgegangen.)
 *
 * Zwei Ansichten:
 *  · Cockpit           – Kennzahlen + chronologische Agenda (der Überblick)
 *  · Aufträge & Fristen – die vollständige Übersicht (das Arbeitstier); dort
 *    grenzt der Quellen-Filter auf reine Aufträge, auto-Fristen oder Aufgaben ein.
 *
 * Kalender und Honorare sind eigene Hauptmenüpunkte und liegen nicht hier.
 *
 * Die Agenda kommt aus `utils/fristen.js` – derselben Quelle, aus der auch die
 * Startseite speist. So zeigen beide dieselbe Wahrheit, statt jeweils eine
 * eigene unvollständige Auswahl zu treffen.
 *
 * Rein lesend – es werden nur vorhandene Daten ausgewertet.
 */

const FARBE = '#2563eb' // Farbwelt des Bereichs „Aufträge"

const ANSICHTEN = [
  { key: 'cockpit',  label: 'Cockpit',            icon: '🎛' },
  { key: 'aufgaben', label: 'Aufträge & Fristen', icon: '📋' },
]

// ── Zeit-Helfer ───────────────────────────────────────────────────────────────
const TAG = 86400000
function nurTag(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function heuteTag() { return nurTag(new Date()) }
function tageBis(iso) {
  if (!iso) return null
  const d = nurTag(new Date(iso.length === 10 ? iso + 'T12:00:00' : iso))
  if (isNaN(d.getTime())) return null
  return Math.round((d - heuteTag()) / TAG)
}
function fmtTag(iso) {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`
}
function tagLabel(diff) {
  if (diff === 0) return 'Heute'
  if (diff === 1) return 'Morgen'
  if (diff === -1) return 'Gestern'
  if (diff < 0) return `${Math.abs(diff)} Tage überfällig`
  if (diff < 7) return `in ${diff} Tagen`
  return null
}

export default function AuftraegeBereich({
  clients = [],
  termine = [],
  aufgabenListe = [],
  onOeffneMandant,
  onOeffneBereich,   // springt in einen anderen Hauptmenüpunkt (Kalender/Honorare)
  slotAufgaben,      // bestehende Auftrags-/Fristen-Übersicht
}) {
  const [ansicht, setAnsicht] = useState(() => {
    try { return localStorage.getItem('auftraege-ansicht') || 'cockpit' } catch { return 'cockpit' }
  })
  const wechsel = a => { setAnsicht(a); try { localStorage.setItem('auftraege-ansicht', a) } catch {} }

  // EINE Quelle für alles mit Datum: Aufträge, auto-Fristen, manuelle Aufgaben,
  // Termine und Erinnerungen.
  const agenda = useMemo(
    () => alleFristen({ clients, aufgabenListe, termine, tageVor: 60, tageNach: 90 }),
    [clients, aufgabenListe, termine],
  )

  const gruppen = useMemo(() => fristenGruppen(agenda), [agenda])

  // Honorar-Kennzahlen aus vorhandenen Auftragsdaten (rein lesend)
  const honorar = useMemo(() => {
    let offen = 0, fakturiert = 0, anzahlOffen = 0
    clients.filter(c => !c.archiviert).forEach(c => {
      ;(c.auftraege ?? []).forEach(a => {
        const betrag = parseFloat(String(a.honorar?.betrag ?? '').replace(/\./g, '').replace(',', '.'))
        if (!betrag || isNaN(betrag)) return
        const berechnet = !!(a.jaCheckliste?.rechnung?.faDatum || a.rechnungGestellt)
        if (berechnet) fakturiert += betrag
        else { offen += betrag; anzahlOffen++ }
      })
    })
    return { offen, fakturiert, anzahlOffen }
  }, [clients])

  const eur = n => n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'

  // Agenda für die nächsten 14 Tage (inkl. Überfälligem)
  const agendaListe = useMemo(() => {
    const offen = agenda
      .filter(e => e.diff !== null && e.diff <= 14)
      .sort((a, b) => a.diff - b.diff)
    const nachTag = new Map()
    offen.forEach(e => {
      const k = e.datum.slice(0, 10)
      if (!nachTag.has(k)) nachTag.set(k, [])
      nachTag.get(k).push(e)
    })
    return [...nachTag.entries()].map(([tag, items]) => ({ tag, diff: tageBis(tag), items }))
  }, [agenda])

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

      {/* ── Cockpit ── */}
      {ansicht === 'cockpit' && (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '24px 26px 56px' }}>
          <div style={{ maxWidth: '1180px', margin: '0 auto' }}>

            <h2 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
              Guten Morgen
            </h2>
            <p style={{ margin: '0 0 24px', fontSize: '13.5px', color: 'var(--text-muted)' }}>
              {gruppen.ueberfaellig.length > 0
                ? `${gruppen.ueberfaellig.length} Sache${gruppen.ueberfaellig.length !== 1 ? 'n' : ''} ${gruppen.ueberfaellig.length !== 1 ? 'sind' : 'ist'} überfällig – am besten zuerst.`
                : gruppen.heute.length > 0
                  ? `${gruppen.heute.length} Sache${gruppen.heute.length !== 1 ? 'n' : ''} für heute.`
                  : 'Nichts Überfälliges. Guter Start.'}
            </p>

            {/* Kennzahlen */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '13px', marginBottom: '26px' }}>
              <Kachel titel="Überfällig"   wert={gruppen.ueberfaellig.length} farbe="#ef4444" icon="⚠️" onClick={() => wechsel('aufgaben')} />
              <Kachel titel="Heute fällig" wert={gruppen.heute.length}        farbe="#f97316" icon="📌" onClick={() => wechsel('aufgaben')} />
              <Kachel titel="Diese Woche"  wert={gruppen.woche.length}        farbe="#2563eb" icon="🗓" onClick={() => wechsel('aufgaben')} />
              <Kachel titel="Demnächst"    wert={gruppen.demnaechst.length}   farbe="#64748b" icon="⏭" onClick={() => wechsel('aufgaben')} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '16px', alignItems: 'start' }}>

              {/* Agenda: Aufgaben + Fristen + Termine gemeinsam */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '13px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '15px 18px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '17px' }} aria-hidden="true">🎯</span>
                  <strong style={{ fontSize: '14px', color: 'var(--text)' }}>Agenda</strong>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Aufträge, Fristen, Aufgaben, Termine und Erinnerungen gemeinsam</span>
                  <button onClick={() => onOeffneBereich?.('kalender')}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: FARBE, fontSize: '12px', fontWeight: 700 }}>
                    Kalender →
                  </button>
                </div>

                <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
                  {agendaListe.length === 0 && (
                    <div style={{ padding: '46px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      Nichts in den nächsten 14 Tagen.
                    </div>
                  )}
                  {agendaListe.map(({ tag, diff, items }) => (
                    <div key={tag}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '9px',
                        padding: '9px 18px', background: 'var(--surface2)',
                        borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
                        position: 'sticky', top: 0, zIndex: 1,
                      }}>
                        <strong style={{
                          fontSize: '12px',
                          color: diff < 0 ? '#ef4444' : diff === 0 ? '#f97316' : 'var(--text)',
                        }}>
                          {fmtTag(tag)}
                        </strong>
                        {tagLabel(diff) && (
                          <span style={{ fontSize: '11px', color: diff < 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: diff <= 0 ? 700 : 400 }}>
                            {tagLabel(diff)}
                          </span>
                        )}
                        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>
                          {items.length}
                        </span>
                      </div>

                      {items.map(e => {
                        const cfg = QUELLE_CFG[e.eilig ? 'eilig' : e.quelle] ?? QUELLE_CFG.aufgabe
                        return (
                          <div key={e.id}
                            onClick={() => e.mandantId && onOeffneMandant?.(e.mandantId, e.quelle === 'auftrag' ? 1 : 0)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '11px',
                              padding: '11px 18px', borderBottom: '1px solid var(--border)',
                              cursor: e.mandantId ? 'pointer' : 'default',
                              borderLeft: `3px solid ${cfg.farbe}`,
                              transition: 'background 0.12s',
                            }}
                            onMouseEnter={ev => { if (e.mandantId) ev.currentTarget.style.background = 'var(--surface2)' }}
                            onMouseLeave={ev => { ev.currentTarget.style.background = 'transparent' }}
                          >
                            <span style={{ fontSize: '14px' }} aria-hidden="true">{cfg.icon}</span>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {e.titel}
                              </span>
                              {(e.mandantName || e.uhrzeit) && (
                                <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                                  {[e.mandantName, e.uhrzeit].filter(Boolean).join(' · ')}
                                </span>
                              )}
                            </span>
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                              background: cfg.farbe + '18', color: cfg.farbe, whiteSpace: 'nowrap',
                            }}>{cfg.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Honorar-Karte */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '13px', padding: '17px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '15px' }}>
                    <span style={{ fontSize: '17px' }} aria-hidden="true">💰</span>
                    <strong style={{ fontSize: '14px', color: 'var(--text)' }}>Honorare</strong>
                    <button onClick={() => onOeffneBereich?.('honorare')}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: FARBE, fontSize: '12px', fontWeight: 700 }}>
                      Details →
                    </button>
                  </div>

                  <div style={{ marginBottom: '13px' }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '2px' }}>Noch nicht berechnet</div>
                    <div style={{ fontSize: '25px', fontWeight: 800, color: honorar.offen > 0 ? '#f97316' : 'var(--text-muted)', lineHeight: 1.15 }}>
                      {eur(honorar.offen)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      aus {honorar.anzahlOffen} Auftr{honorar.anzahlOffen === 1 ? 'ag' : 'ägen'}
                    </div>
                  </div>

                  <div style={{ paddingTop: '13px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '2px' }}>Bereits berechnet</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a' }}>{eur(honorar.fakturiert)}</div>
                  </div>
                </div>

                {/* Platz für spätere Karten */}
                <div style={{
                  background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: '13px',
                  padding: '17px 18px', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.7,
                }}>
                  <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '5px' }}>Weitere Karten folgen</strong>
                  Vorgesehen: offene Rückfragen, aktuelle Projekte, KI-Hinweise,
                  persönliche Statistiken und eine Tageszusammenfassung.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Vollständige Auftrags-/Fristen-Übersicht (unverändert) ── */}
      {ansicht === 'aufgaben' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {slotAufgaben ?? <Leer text="Aufgaben-Übersicht ist hier nicht verfügbar." />}
        </div>
      )}
    </div>
  )
}

function Kachel({ titel, wert, farbe, icon, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '13px', textAlign: 'left',
        padding: '15px 17px', borderRadius: '12px', cursor: 'pointer',
        background: 'var(--surface)', border: '1px solid var(--border)',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = farbe + '66'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none' }}
    >
      <span style={{
        width: '38px', height: '38px', flexShrink: 0, borderRadius: '10px',
        background: farbe + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px',
      }} aria-hidden="true">{icon}</span>
      <span>
        <span style={{ display: 'block', fontSize: '23px', fontWeight: 800, color: wert > 0 ? farbe : 'var(--text-muted)', lineHeight: 1.15 }}>{wert}</span>
        <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{titel}</span>
      </span>
    </button>
  )
}

function Leer({ text }) {
  return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>{text}</div>
}
