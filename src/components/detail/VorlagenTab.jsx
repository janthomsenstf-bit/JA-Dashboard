/**
 * VorlagenTab – Reiter „Vorlagen" am Mandanten.
 *
 * Auf Knopfdruck entstehen fertige Formulare (Vollmachten, Einwilligungen,
 * Anträge) im Design des jeweiligen Musters. Zwei Wege:
 *   • „Aus Stammdaten"  – Felder werden aus dem Mandanten vorbelegt
 *   • „Selbst eintragen" – Felder bleiben leer und werden von Hand gefüllt
 * Einzelne Felder lassen sich in beiden Fällen überschreiben; abweichende
 * Angaben können auf Wunsch zurück in die Stammdaten übernommen werden.
 *
 * Der Katalog der Vorlagen liegt in src/utils/vorlagen/ – eine neue Vorlage
 * dort eintragen genügt, dieser Reiter zeigt sie automatisch.
 *
 * Datensicherheit: Der Mandant wird ausschließlich über „In Stammdaten
 * übernehmen" geändert – mit Anzeige der Abweichungen und Bestätigung.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  VORLAGEN, stammdatenBasis, werteFuerVorlage, leereWerte, fehlendeFelder,
  stammdatenAbweichungen, stammdatenPatch,
} from '../../utils/vorlagen/index.js'

export default function VorlagenTab({ client, onUpdate }) {
  const basis = useMemo(() => stammdatenBasis(client), [client])

  // Vorausgewählt ist die Vorlage, die zur Rechtsform des Mandanten passt.
  const [aktivId, setAktivId] = useState(
    () => (VORLAGEN.find(v => !v.passtZu || v.passtZu(stammdatenBasis(client))) ?? VORLAGEN[0])?.id ?? null,
  )
  const [quelle,  setQuelle]  = useState('stammdaten')   // 'stammdaten' | 'manuell'
  const [werte,   setWerte]   = useState({})
  const [toast,   setToast]   = useState('')
  const [blobUrl, setBlobUrl] = useState('')
  const [uebernahmeOffen, setUebernahmeOffen] = useState(false)
  const letzteUrl = useRef('')

  const vorlage = VORLAGEN.find(v => v.id === aktivId) ?? null

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500) }

  // Vorlage, Mandant oder Quelle gewechselt → Werte neu aufbauen
  useEffect(() => {
    if (!vorlage) return
    setWerte(quelle === 'manuell' ? leereWerte(vorlage, client) : werteFuerVorlage(vorlage, client).werte)
    setUebernahmeOffen(false)
  }, [aktivId, client?.id, quelle])   // eslint-disable-line react-hooks/exhaustive-deps

  // Live-Vorschau (leicht verzögert, damit Tippen nicht ruckelt)
  useEffect(() => {
    if (!vorlage || !Object.keys(werte).length) return
    const t = setTimeout(() => {
      try {
        const url = String(vorlage.build(werte).output('bloburl'))
        if (letzteUrl.current) URL.revokeObjectURL(letzteUrl.current)
        letzteUrl.current = url
        setBlobUrl(url)
      } catch (e) {
        console.error('Vorschau fehlgeschlagen', e)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [werte, aktivId])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (letzteUrl.current) URL.revokeObjectURL(letzteUrl.current) }, [])

  const stammwerte = useMemo(
    () => (vorlage ? werteFuerVorlage(vorlage, client).werte : {}),
    [vorlage, client],
  )
  const fehlt = vorlage ? fehlendeFelder(vorlage, werte) : []
  const passt = vorlage?.passtZu ? vorlage.passtZu(basis) : true
  const abweichungen = vorlage ? stammdatenAbweichungen(vorlage, werte, client) : []

  function setFeld(key, wert) { setWerte(w => ({ ...w, [key]: wert })) }

  function erzeugen() {
    if (!vorlage) return
    vorlage.build(werte).save(vorlage.dateiname(werte, client))
    showToast('✅ PDF erzeugt')
  }

  function uebernehmen() {
    if (!vorlage || !abweichungen.length) return
    onUpdate(stammdatenPatch(abweichungen, client))
    setUebernahmeOffen(false)
    showToast(`✅ ${abweichungen.length} Angabe(n) in die Stammdaten übernommen`)
  }

  const kategorien = [...new Set(VORLAGEN.map(v => v.kategorie || 'Sonstige'))]

  return (
    <div style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>📄 Vorlagen</h2>
        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
          {VORLAGEN.length} Vorlage{VORLAGEN.length === 1 ? '' : 'n'}
        </span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Vorlage wählen, Angaben prüfen, PDF erzeugen – wahlweise mit den Stammdaten von{' '}
        <strong style={{ color: 'var(--text)' }}>{basis.name || 'diesem Mandanten'}</strong> oder komplett von Hand.
      </p>

      {toast && (
        <div style={{
          marginBottom: '12px', padding: '7px 12px', borderRadius: '8px', fontSize: '12.5px',
          background: 'rgba(22,163,74,0.10)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.3)',
        }}>{toast}</div>
      )}

      <div style={{ display: 'flex', gap: '18px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Katalog ── */}
        <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {kategorien.map(kat => (
            <div key={kat}>
              <div style={{
                fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px',
              }}>{kat}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {VORLAGEN.filter(v => (v.kategorie || 'Sonstige') === kat).map(v => (
                  <button
                    key={v.id}
                    onClick={() => setAktivId(v.id)}
                    style={{
                      textAlign: 'left', cursor: 'pointer', padding: '10px 11px', borderRadius: '10px',
                      background: v.id === aktivId ? 'var(--surface2)' : 'var(--surface)',
                      border: `1px solid ${v.id === aktivId ? 'var(--accent, #3b82f6)' : 'var(--border)'}`,
                      color: 'inherit', font: 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px' }}>{v.icon}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{v.titel}</span>
                    </div>
                    {v.untertitel && (
                      <div style={{
                        fontSize: '11px', marginTop: '3px', marginLeft: '23px',
                        color: (v.passtZu && v.passtZu(basis)) ? 'var(--accent, #3b82f6)' : 'var(--text-muted)',
                      }}>
                        {v.untertitel}
                        {v.passtZu && v.passtZu(basis) && ' · passt zu diesem Mandanten'}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Formular + Vorschau ── */}
        {vorlage && (
          <div style={{ flex: 1, minWidth: '380px', display: 'flex', gap: '18px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

            <div style={{ flex: 1, minWidth: '340px' }}>
              <div style={{
                border: '1px solid var(--border)', borderRadius: '12px',
                background: 'var(--surface)', padding: '14px 16px',
              }}>
                <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '2px' }}>
                  {vorlage.icon} {vorlage.titel}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: '12px' }}>
                  {vorlage.beschreibung}
                  {vorlage.quelle && <> <span style={{ opacity: 0.75 }}>({vorlage.quelle})</span></>}
                </div>

                {/* Quelle der Daten */}
                <div style={{
                  display: 'flex', gap: '6px', padding: '4px', marginBottom: '12px',
                  background: 'var(--surface2)', borderRadius: '9px', width: 'fit-content',
                }}>
                  {[
                    { wert: 'stammdaten', label: '📋 Aus Stammdaten' },
                    { wert: 'manuell',    label: '✏️ Selbst eintragen' },
                  ].map(o => (
                    <button
                      key={o.wert}
                      onClick={() => setQuelle(o.wert)}
                      style={{
                        cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: '5px 11px',
                        borderRadius: '7px', border: '1px solid transparent',
                        background: quelle === o.wert ? 'var(--surface)' : 'transparent',
                        borderColor: quelle === o.wert ? 'var(--border)' : 'transparent',
                        color: quelle === o.wert ? 'var(--text)' : 'var(--text-muted)',
                      }}
                    >{o.label}</button>
                  ))}
                </div>

                {!passt && (
                  <div style={{
                    marginBottom: '12px', padding: '8px 11px', borderRadius: '8px', fontSize: '12px',
                    background: 'rgba(234,179,8,0.10)', color: '#a16207', border: '1px solid rgba(234,179,8,0.35)',
                  }}>
                    Hinweis: Diese Vorlage ist für {vorlage.untertitel || 'einen anderen Fall'} gedacht.
                    Rechtsform laut Stammdaten: <strong>{basis.rechtsform || 'nicht gesetzt'}</strong>.
                  </div>
                )}

                {fehlt.length > 0 && (
                  <div style={{
                    marginBottom: '12px', padding: '8px 11px', borderRadius: '8px', fontSize: '12px',
                    background: 'rgba(239,68,68,0.08)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.3)',
                  }}>
                    Fehlt noch: {fehlt.join(', ')}
                  </div>
                )}

                {/* Felder */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {vorlage.felder.filter(f => !f.zeigenWenn || f.zeigenWenn(werte)).map(f => (
                    <Feld
                      key={f.key}
                      feld={f}
                      wert={werte[f.key]}
                      stammwert={stammwerte[f.key]}
                      onChange={v => setFeld(f.key, v)}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
                  <button className="btn btn-primary btn-sm" onClick={erzeugen} style={{ fontSize: '12.5px' }}>
                    📄 PDF erzeugen
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setWerte(werteFuerVorlage(vorlage, client).werte)}
                    style={{ fontSize: '12.5px' }}
                    title="Alle Felder wieder mit den Stammdaten füllen"
                  >
                    ↺ Stammdaten übernehmen
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setWerte(leereWerte(vorlage, client))}
                    style={{ fontSize: '12.5px' }}
                    title="Alle Felder leeren"
                  >
                    ␡ Felder leeren
                  </button>
                </div>

                {/* Rückweg: Eingetragenes in die Stammdaten */}
                {abweichungen.length > 0 && (
                  <div style={{
                    marginTop: '14px', padding: '10px 12px', borderRadius: '9px',
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: '12px', marginBottom: uebernahmeOffen ? '8px' : '0' }}>
                      {abweichungen.length} Angabe{abweichungen.length === 1 ? '' : 'n'} weicht von den Stammdaten ab.{' '}
                      <button
                        onClick={() => setUebernahmeOffen(o => !o)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent, #3b82f6)', font: 'inherit', textDecoration: 'underline' }}
                      >
                        {uebernahmeOffen ? 'ausblenden' : 'in die Stammdaten übernehmen?'}
                      </button>
                    </div>
                    {uebernahmeOffen && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                          {abweichungen.map(a => (
                            <div key={a.ziel} style={{ fontSize: '11.5px', lineHeight: 1.5 }}>
                              <span style={{ color: 'var(--text-muted)' }}>{a.label}: </span>
                              <span style={{ textDecoration: a.alt ? 'line-through' : 'none', opacity: a.alt ? 0.6 : 0.4 }}>
                                {a.alt || '(leer)'}
                              </span>
                              <span style={{ margin: '0 5px' }}>→</span>
                              <strong>{a.neu}</strong>
                            </div>
                          ))}
                        </div>
                        <button className="btn btn-sm" onClick={uebernehmen} style={{ fontSize: '12px' }}>
                          💾 Stammdaten aktualisieren
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Vorschau */}
            <div style={{ width: '380px', flexShrink: 0 }}>
              <div style={{
                fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px',
              }}>Vorschau</div>
              {blobUrl ? (
                <iframe
                  title="Vorlagen-Vorschau"
                  src={blobUrl}
                  style={{
                    width: '100%', height: '520px', border: '1px solid var(--border)',
                    borderRadius: '10px', background: '#fff',
                  }}
                />
              ) : (
                <div style={{
                  height: '520px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px dashed var(--border2)', borderRadius: '10px',
                  fontSize: '12.5px', color: 'var(--text-muted)',
                }}>
                  Vorschau wird erzeugt …
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Ein Formularfeld ──────────────────────────────────────────────────────────
function Feld({ feld, wert, stammwert, onChange }) {
  if (feld.typ === 'check') {
    return (
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12.5px', cursor: 'pointer' }}>
        <input type="checkbox" checked={!!wert} onChange={e => onChange(e.target.checked)} style={{ marginTop: '2px' }} />
        <span style={{ lineHeight: 1.45 }}>{feld.label}</span>
      </label>
    )
  }

  if (feld.typ === 'radio') {
    return (
      <div>
        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>{feld.label}</div>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          {feld.optionen.map(o => (
            <label key={o.wert} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', cursor: 'pointer' }}>
              <input type="radio" checked={wert === o.wert} onChange={() => onChange(o.wert)} />
              {o.label}
            </label>
          ))}
        </div>
      </div>
    )
  }

  const eingetragen = String(wert ?? '').trim()
  const ausStammdaten = String(stammwert ?? '').trim()
  const abweichend = !!eingetragen && eingetragen !== ausStammdaten
  const stammdatenLeer = !ausStammdaten

  return (
    <div>
      <label style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
        <span>
          {feld.label}
          {feld.pflicht && <span style={{ color: '#ef4444' }}> *</span>}
        </span>
        {abweichend && <Badge farbe="#3b82f6">manuell</Badge>}
        {!abweichend && !stammdatenLeer && eingetragen && <Badge farbe="#64748b">{feld.quelle || 'Stammdaten'}</Badge>}
        {stammdatenLeer && feld.stammdaten && <Badge farbe="#a16207">nicht in den Stammdaten</Badge>}
        {abweichend && ausStammdaten && (
          <button
            onClick={() => onChange(ausStammdaten)}
            title={`Zurück auf den Stammdatenwert: ${ausStammdaten}`}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px' }}
          >↺</button>
        )}
      </label>
      <input
        className="input"
        value={wert ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={feld.platzhalter ?? ''}
        style={{ width: feld.breit ? '100%' : '220px', fontSize: '12.5px' }}
      />
      {feld.hinweis && (
        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{feld.hinweis}</div>
      )}
    </div>
  )
}

function Badge({ children, farbe }) {
  return (
    <span style={{
      fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
      padding: '1px 5px', borderRadius: '5px', color: farbe, border: `1px solid ${farbe}55`,
      background: `${farbe}14`,
    }}>{children}</span>
  )
}
