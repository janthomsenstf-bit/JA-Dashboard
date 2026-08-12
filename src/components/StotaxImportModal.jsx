import { useState } from 'react'
import { parseStotaxDatei, baueBericht } from '../utils/stotaxImport'

const KAT = {
  fill:        { farbe: 'var(--green)',  label: 'Leerfeld füllen' },
  mandantennr: { farbe: '#d97706',       label: 'Mandantennr. korrigieren' },
  conflict:    { farbe: 'var(--red)',    label: 'Konflikt – Wert weicht ab' },
}

function Punkt({ kat }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: KAT[kat].farbe, marginRight: 6, flexShrink: 0 }} />
}

// Standard-Auswahl: Leerfelder + Mandantennr. an, Konflikte AUS (bewusst opt-in)
function standardAuswahl(bericht) {
  const s = new Set()
  bericht.matched.forEach(m => m.diffs.forEach(d => {
    if (d.kategorie !== 'conflict') s.add(m.client.id + '::' + d.feld)
  }))
  return s
}

export default function StotaxImportModal({ clients, onApply, onClose }) {
  const [status, setStatus] = useState('idle')   // idle | laeuft | fertig | fehler
  const [fehler, setFehler] = useState('')
  const [bericht, setBericht] = useState(null)
  const [dateiname, setDateiname] = useState('')
  const [sel, setSel] = useState(new Set())       // key: clientId::feld
  const [selNeu, setSelNeu] = useState(new Set()) // Index in bericht.neu
  const [applying, setApplying] = useState(false)
  const [angewendet, setAngewendet] = useState(null) // { total, neu }

  async function handleDatei(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStatus('laeuft'); setFehler(''); setBericht(null); setDateiname(file.name); setAngewendet(null)
    try {
      const buf = await file.arrayBuffer()
      const liste = await parseStotaxDatei(buf)
      if (!liste.length) throw new Error('Keine Mandantenzeilen in der Datei gefunden.')
      const b = baueBericht(clients, liste)
      setBericht(b); setSel(standardAuswahl(b)); setSelNeu(new Set())
      setStatus('fertig')
    } catch (err) {
      setFehler(err.message || String(err)); setStatus('fehler')
    }
  }

  const gesperrt = !!angewendet || applying
  const toggle = key => { if (gesperrt) return; setSel(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n }) }
  const toggleNeu = i => { if (gesperrt) return; setSelNeu(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n }) }

  function selektierteUpdates() {
    if (!bericht) return []
    return bericht.matched.map(m => ({
      clientId: m.client.id,
      changes: m.diffs.filter(d => sel.has(m.client.id + '::' + d.feld)).map(d => ({ feld: d.feld, kind: d.kind, neu: d.neu })),
    })).filter(u => u.changes.length)
  }

  async function anwenden() {
    const updates = selektierteUpdates()
    const neuMandanten = bericht.neu.filter((_, i) => selNeu.has(i))
    const total = updates.reduce((n, u) => n + u.changes.length, 0)
    if (!total && !neuMandanten.length) return
    const txt = `${total} Änderung(en) an ${updates.length} Mandant(en)`
      + (neuMandanten.length ? ` und ${neuMandanten.length} neue(r) Mandant(en)` : '')
      + ` anwenden?\n\nVorher wird automatisch ein Snapshot (Sicherung) erstellt.`
    if (!window.confirm(txt)) return
    setApplying(true)
    try {
      await onApply({ updates, neuMandanten })
      setAngewendet({ total, neu: neuMandanten.length })
    } catch (err) {
      setFehler('Anwenden fehlgeschlagen: ' + (err.message || String(err))); setStatus('fehler')
    } finally {
      setApplying(false)
    }
  }

  const mitAenderung = bericht?.matched.filter(m => m.diffs.length > 0) || []
  const ohneAenderung = bericht?.matched.filter(m => m.diffs.length === 0) || []
  const anzahlSel = selektierteUpdates().reduce((n, u) => n + u.changes.length, 0)
  const anzahlSelNeu = selNeu.size

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 780, width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-title">📥 Stotax-Stammdaten importieren</div>

        {!angewendet && (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
            Abgleich über die <b>Steuernummer</b>. Wähle die Änderungen, die übernommen werden sollen — vor dem
            Anwenden wird automatisch ein <b>Snapshot</b> erstellt. Nichts wird gelöscht; nur angehakte Felder werden gesetzt.
          </div>
        )}

        {angewendet && (
          <div style={{ fontSize: 13.5, color: 'var(--green)', background: 'color-mix(in srgb, var(--green) 10%, transparent)', border: '1px solid var(--green)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
            ✓ Angewendet: <b>{angewendet.total}</b> Änderung(en){angewendet.neu ? <> und <b>{angewendet.neu}</b> neue(r) Mandant(en)</> : null}. Ein Snapshot wurde vorher gesichert.
          </div>
        )}

        {!angewendet && (
          <div style={{ marginBottom: 14 }}>
            <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
              {status === 'laeuft' ? 'Lese Datei …' : 'Excel-Datei wählen (.xlsx)'}
              <input type="file" accept=".xlsx" onChange={handleDatei} style={{ display: 'none' }} disabled={status === 'laeuft'} />
            </label>
            {dateiname && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>{dateiname}</span>}
          </div>
        )}

        {status === 'fehler' && (
          <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12 }}>⚠️ {fehler}</div>
        )}

        {bericht && (
          <div style={{ overflowY: 'auto', paddingRight: 4 }}>
            {/* Zusammenfassung */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <Kachel wert={bericht.gesamtDatei} text="Zeilen in Datei" />
              <Kachel wert={bericht.matched.length} text="zugeordnet" />
              <Kachel wert={bericht.neu.length} text="neu (nicht im Spielbuch)" />
              <Kachel wert={bericht.mehrdeutig.length} text="mehrdeutig" warn={bericht.mehrdeutig.length > 0} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 18, fontSize: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}><Punkt kat="fill" />{bericht.stats.fill} Leerfelder füllen</span>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}><Punkt kat="mandantennr" />{bericht.stats.mandantennr} Mandantennr. korrigieren</span>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}><Punkt kat="conflict" />{bericht.stats.conflict} Konflikte (standardmäßig aus)</span>
            </div>

            {/* Zugeordnet mit Änderungen */}
            {mitAenderung.length > 0 && (
              <Abschnitt titel={`Zugeordnet – mit Änderungen (${mitAenderung.length})`}>
                {mitAenderung.map((m, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {m.sd.mandantennummer} · {m.client.name || m.sd.name}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Match: {m.methode === 'steuernummer' ? 'Steuernummer' : 'Name'}
                      </span>
                    </div>
                    <div style={{ marginTop: 8, display: 'grid', gap: 5 }}>
                      {m.diffs.map((d, j) => {
                        const key = m.client.id + '::' + d.feld
                        return (
                          <label key={j} style={{ display: 'flex', alignItems: 'center', fontSize: 12.5, gap: 2, cursor: gesperrt ? 'default' : 'pointer' }}>
                            <input type="checkbox" checked={sel.has(key)} onChange={() => toggle(key)} disabled={gesperrt} style={{ marginRight: 6 }} />
                            <Punkt kat={d.kategorie} />
                            <span style={{ minWidth: 148, color: 'var(--text-muted)' }}>{d.label}</span>
                            <span style={{ textDecoration: d.alt ? 'line-through' : 'none', color: 'var(--text-muted)' }}>{d.alt || '—'}</span>
                            <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>→</span>
                            <span style={{ fontWeight: 600 }}>{d.neu}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </Abschnitt>
            )}

            {ohneAenderung.length > 0 && (
              <Abschnitt titel={`Zugeordnet – bereits aktuell (${ohneAenderung.length})`}>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {ohneAenderung.map(m => `${m.sd.mandantennummer} · ${m.client.name || m.sd.name}`).join('  ·  ')}
                </div>
              </Abschnitt>
            )}

            {bericht.neu.length > 0 && (
              <Abschnitt titel={`Neu in Stotax – nicht im Spielbuch (${bericht.neu.length})`}>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6, fontStyle: 'italic' }}>
                  Nur die angehakten werden als neue Mandanten angelegt (standardmäßig aus).
                </div>
                <div style={{ display: 'grid', gap: 3 }}>
                  {bericht.neu.map((sd, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 12.5, gap: 6, cursor: gesperrt ? 'default' : 'pointer' }}>
                      <input type="checkbox" checked={selNeu.has(i)} onChange={() => toggleNeu(i)} disabled={gesperrt} />
                      <span>{sd.mandantennummer} · {sd.name} {sd.steuernummer && <span style={{ color: 'var(--text-muted)' }}>({sd.steuernummer})</span>}</span>
                    </label>
                  ))}
                </div>
              </Abschnitt>
            )}

            {bericht.mehrdeutig.length > 0 && (
              <Abschnitt titel={`Mehrdeutig – bitte manuell prüfen (${bericht.mehrdeutig.length})`}>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {bericht.mehrdeutig.map((m, i) => (
                    <div key={i}>{m.sd.mandantennummer} · {m.sd.name} → {m.kandidaten.length} mögliche Treffer</div>
                  ))}
                </div>
              </Abschnitt>
            )}
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {bericht && !angewendet ? <>Ausgewählt: <b>{anzahlSel}</b> Änderung(en){anzahlSelNeu ? <>, <b>{anzahlSelNeu}</b> neu</> : null}</> : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Schließen</button>
            {bericht && !angewendet && (
              <button
                className="btn btn-primary btn-sm"
                onClick={anwenden}
                disabled={applying || (anzahlSel === 0 && anzahlSelNeu === 0)}
                title="Erstellt zuerst einen Snapshot und übernimmt dann die ausgewählten Änderungen"
              >
                {applying ? 'Wende an …' : `🔒 Snapshot & Anwenden (${anzahlSel + anzahlSelNeu})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Kachel({ wert, text, warn }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', minWidth: 92 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: warn ? 'var(--red)' : 'var(--text)' }}>{wert}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{text}</div>
    </div>
  )
}

function Abschnitt({ titel, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 8 }}>{titel}</div>
      {children}
    </div>
  )
}
