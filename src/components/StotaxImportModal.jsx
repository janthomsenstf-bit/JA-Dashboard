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

export default function StotaxImportModal({ clients, onClose }) {
  const [status, setStatus] = useState('idle')   // idle | laeuft | fertig | fehler
  const [fehler, setFehler] = useState('')
  const [bericht, setBericht] = useState(null)
  const [dateiname, setDateiname] = useState('')

  async function handleDatei(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setStatus('laeuft'); setFehler(''); setBericht(null); setDateiname(file.name)
    try {
      const buf = await file.arrayBuffer()
      const liste = await parseStotaxDatei(buf)
      if (!liste.length) throw new Error('Keine Mandantenzeilen in der Datei gefunden.')
      setBericht(baueBericht(clients, liste))
      setStatus('fertig')
    } catch (err) {
      setFehler(err.message || String(err)); setStatus('fehler')
    }
  }

  const mitAenderung = bericht?.matched.filter(m => m.diffs.length > 0) || []
  const ohneAenderung = bericht?.matched.filter(m => m.diffs.length === 0) || []

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 760, width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-title">📥 Stotax-Stammdaten importieren</div>

        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
          <b>Stufe 1 – Vorschau.</b> Hier wird <b>nichts geändert</b>. Der Abgleich ordnet über die
          <b> Steuernummer</b> zu und zeigt, was ein Import täte. Das Anwenden (mit Snapshot &amp; Bestätigung)
          kommt als Stufe 2.
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer' }}>
            {status === 'laeuft' ? 'Lese Datei …' : 'Excel-Datei wählen (.xlsx)'}
            <input type="file" accept=".xlsx" onChange={handleDatei} style={{ display: 'none' }} disabled={status === 'laeuft'} />
          </label>
          {dateiname && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>{dateiname}</span>}
        </div>

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
              <span style={{ display: 'inline-flex', alignItems: 'center' }}><Punkt kat="conflict" />{bericht.stats.conflict} Konflikte</span>
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
                    <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                      {m.diffs.map((d, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'center', fontSize: 12.5, gap: 2 }}>
                          <Punkt kat={d.kategorie} />
                          <span style={{ minWidth: 150, color: 'var(--text-muted)' }}>{d.label}</span>
                          <span style={{ textDecoration: d.alt ? 'line-through' : 'none', color: d.alt ? 'var(--text-muted)' : 'transparent' }}>
                            {d.alt || '—'}
                          </span>
                          <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>→</span>
                          <span style={{ fontWeight: 600 }}>{d.neu}</span>
                        </div>
                      ))}
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
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {bericht.neu.map((sd, i) => (
                    <div key={i}>{sd.mandantennummer} · {sd.name} {sd.steuernummer && <span>({sd.steuernummer})</span>}</div>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                  Würden in Stufe 2 als neue Mandanten angelegt (nur auf deinen Wunsch).
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

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Stufe 2 (Anwenden mit Snapshot &amp; Bestätigung) folgt nach deiner Freigabe der Vorschau.
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Schließen</button>
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
