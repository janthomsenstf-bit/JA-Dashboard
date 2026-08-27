/**
 * ErstkontaktBogen – Aufnahmemaske für das Erstgespräch mit einem Interessenten.
 *
 * Fürs Tablet gebaut: eine Spalte, große Tippflächen, Handschrift läuft über die
 * Tastatur des Geräts direkt in die Felder. Gestaltung nach moin-fibu.de
 * („Nordic Minimalist": tiefes Nordisch-Blau, ruhige Flächen, große Radien),
 * Flächenfarben aus dem Spielbuch, damit der Dunkelmodus weiter stimmt.
 *
 * Speichern übernimmt die App (onChange bei jeder Eingabe) – hier wird nichts gehalten.
 */
import { useMemo, useState } from 'react'
import { callAI, hasAiKey } from '../../utils/aiClient.js'
import Skizzenfeld from './Skizzenfeld.jsx'
import {
  VISITENKARTE, vCardText, toBase64,
  EINKUNFTSARTEN, BETRIEB_MERKMALE, UST_MERKMALE, VORGESCHICHTE, LEISTUNGEN,
  hinweise, unterlagenListe, bogenAlsText, visitenkarteQr,
} from '../../utils/erstkontakt.js'

// Akzent aus der Moin-Fibu-Palette (hsl(215 40% …)) – trägt auf hellem und dunklem Grund.
const MF = '#3f6aa6'
const MF_SOFT = 'rgba(63,106,166,0.10)'
const MF_LINE = 'rgba(63,106,166,0.35)'
const R = '16px'      // moin-fibu: --radius 1rem
const R_SM = '11px'
const SCHRIFT = "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

function Abschnitt({ nr, titel, hinweis, offen, onToggle, children }) {
  return (
    <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: R, boxShadow: 'var(--shadow)', marginBottom: '12px', overflow: 'hidden' }}>
      <button onClick={onToggle}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left', padding: '14px 16px', background: 'var(--surface2)', border: 'none', borderBottom: offen ? '1px solid var(--border)' : 'none', cursor: 'pointer', font: 'inherit' }}>
        <span style={{ width: '25px', height: '25px', borderRadius: '8px', background: MF, color: '#fff', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{nr}</span>
        <span style={{ fontSize: '14.5px', fontWeight: 750, color: 'var(--text)' }}>{titel}</span>
        {hinweis && <span style={{ marginLeft: 'auto', fontSize: '11.5px', color: 'var(--text-muted)' }}>{hinweis}</span>}
        <span style={{ marginLeft: hinweis ? '8px' : 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>{offen ? '▲' : '▼'}</span>
      </button>
      {offen && <div style={{ padding: '15px 16px' }}>{children}</div>}
    </section>
  )
}

function Feld({ label, wert, onChange, breit, pflicht, mehrzeilig, optionen, platzhalter }) {
  const stil = {
    font: 'inherit', fontSize: '15px', width: '100%', padding: '11px 13px', borderRadius: R_SM,
    border: '1px solid var(--border2, var(--border))', background: 'var(--surface)', color: 'var(--text)',
    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', gridColumn: breit ? '1 / -1' : undefined }}>
      <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}{pflicht && <span style={{ color: 'var(--red)' }}> *</span>}
      </label>
      {optionen
        ? <select value={wert} onChange={e => onChange(e.target.value)} style={{ ...stil, cursor: 'pointer' }}>
            {optionen.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        : mehrzeilig
          ? <textarea value={wert} onChange={e => onChange(e.target.value)} rows={4} placeholder={platzhalter} style={{ ...stil, resize: 'vertical', lineHeight: 1.6 }} />
          : <input type="text" value={wert} onChange={e => onChange(e.target.value)} placeholder={platzhalter} style={stil} />}
    </div>
  )
}

function Chips({ liste, haken, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {liste.map(x => {
        const an = !!haken[x.key]
        const farbe = x.warn ? 'var(--yellow)' : MF
        return (
          <label key={x.key}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '999px', cursor: 'pointer',
              border: `1px solid ${an ? (x.warn ? 'var(--yellow)' : MF_LINE) : 'var(--border2, var(--border))'}`,
              background: an ? (x.warn ? 'var(--yellow-dim, rgba(180,83,9,0.10))' : MF_SOFT) : 'var(--surface)',
              color: an ? farbe : 'var(--text-secondary)', fontSize: '14px', fontWeight: 600 }}>
            <input type="checkbox" checked={an} onChange={() => onToggle(x.key)} style={{ width: '17px', height: '17px', accentColor: MF, cursor: 'pointer', margin: 0 }} />
            {x.label}
          </label>
        )
      })}
    </div>
  )
}

const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '11px' }

export default function ErstkontaktBogen({ bogen, onChange, onClose, onMandantAnlegen, onAufgabe }) {
  const [offen, setOffen] = useState(() => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]))
  const [busy, setBusy]   = useState('')
  const [msg, setMsg]     = useState('')
  const [mail, setMail]   = useState(null)      // { betreff, text, art }
  const [nummer, setNummer] = useState('')
  const [zeigeMandant, setZeigeMandant] = useState(false)
  const [qrGross, setQrGross] = useState(false)

  const f = bogen.felder ?? {}
  const h = bogen.haken ?? {}
  const toggleAbschnitt = (n) => setOffen(p => { const s = new Set(p); s.has(n) ? s.delete(n) : s.add(n); return s })
  const setFeld  = (k, v) => onChange({ ...bogen, felder: { ...f, [k]: v }, geaendertAm: new Date().toISOString() })
  const setHaken = (k)    => onChange({ ...bogen, haken: { ...h, [k]: !h[k] }, geaendertAm: new Date().toISOString() })

  const tipps = useMemo(() => hinweise(h), [h])
  const qrBild = useMemo(() => { try { return visitenkarteQr(5, 2) } catch { return null } }, [])
  const unterlagen = useMemo(() => unterlagenListe(bogen), [bogen])

  // ── Mail vorbereiten (nichts geht ohne deinen Klick raus) ───────────────────
  function visitenkarteVorbereiten() {
    setMsg('')
    setMail({
      art: 'karte',
      betreff: `Meine Kontaktdaten – ${VISITENKARTE.firma}`,
      text: `Hallo${f.ansprechpartner ? ' ' + f.ansprechpartner : ''},\n\n`
        + `anbei meine Kontaktdaten als Visitenkarte zum Speichern.\n\n`
        + `${VISITENKARTE.name} · ${VISITENKARTE.titel}\n${VISITENKARTE.firma} – ${VISITENKARTE.claim}\n`
        + `${VISITENKARTE.strasse}, ${VISITENKARTE.plz} ${VISITENKARTE.ort}\n`
        + `Telefon ${VISITENKARTE.telefon}\n${VISITENKARTE.email}\n${VISITENKARTE.web}\n\n`
        + `Viele Grüße\n${VISITENKARTE.vorname}`,
    })
  }
  function nachfassVorbereiten() {
    setMsg('')
    const punkte = unterlagen.map(u => `• ${u}`).join('\n')
    setMail({
      art: 'nachfass',
      betreff: 'Unser Gespräch – die nächsten Schritte',
      text: `Hallo${f.ansprechpartner ? ' ' + f.ansprechpartner : ''},\n\n`
        + `vielen Dank für das Gespräch. Damit wir zügig starten können, brauche ich von Ihnen:\n\n${punkte}\n\n`
        + (f.naechsterSchritt ? `Nächster Schritt: ${f.naechsterSchritt}${f.bisWann ? ` (bis ${f.bisWann})` : ''}\n\n` : '')
        + `Meine Kontaktdaten hängen als Visitenkarte an.\n\nViele Grüße\n${VISITENKARTE.vorname}\n\n`
        + `${VISITENKARTE.name} · ${VISITENKARTE.titel}\n${VISITENKARTE.firma}\n${VISITENKARTE.telefon} · ${VISITENKARTE.email}`,
    })
  }

  async function mailSenden() {
    if (!mail) return
    const to = (f.email || '').trim()
    if (!to) { setMsg('⚠ Keine E-Mail-Adresse beim Interessenten hinterlegt.'); return }
    if (!window.confirm(`Mail jetzt an ${to} senden?`)) return
    setBusy('mail'); setMsg('')
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to, from: VISITENKARTE.email, subject: mail.betreff, text: mail.text,
          attachments: [{
            filename: 'Jan-Thomsen-Moin-Fibu.vcf',
            content: toBase64(vCardText()),
            contentType: 'text/vcard; charset=utf-8',
          }],
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
      setMsg('✓ Gesendet – Visitenkarte ist unterwegs.')
      setMail(null)
    } catch (e) { setMsg('⚠ ' + (e?.message || String(e))) }
    finally { setBusy('') }
  }

  // ── KI-Aktenvermerk ─────────────────────────────────────────────────────────
  async function vermerkErzeugen() {
    if (busy) return
    if (!hasAiKey()) { setMsg('⚠ Kein KI-Schlüssel hinterlegt (Stammdaten → ⚙️).'); return }
    setBusy('ki'); setMsg('')
    try {
      const sys = 'Du bist die Assistenz eines deutschen Steuerberaters. Fasse die Notizen aus einem Erstgespräch zu einem sachlichen Aktenvermerk zusammen (4–6 Sätze) und leite die offenen Punkte als kurze Aufgaben ab. Antworte AUSSCHLIESSLICH als JSON: {"vermerk":"...","punkte":["...","..."]}. Nichts erfinden – nur was in den Angaben steht oder sich fachlich zwingend daraus ergibt. Deutsch.'
      const r = await callAI(sys, bogenAlsText(bogen), { maxTokens: 900 })
      onChange({ ...bogen, vermerk: { text: r.vermerk || r.text || '', punkte: Array.isArray(r.punkte) ? r.punkte : [] } })
    } catch (e) { setMsg('⚠ ' + (e?.message || String(e))) }
    finally { setBusy('') }
  }

  const knopf = (haupt = false) => ({
    font: 'inherit', fontSize: '14px', fontWeight: 700, padding: '12px 17px', borderRadius: R_SM, cursor: 'pointer',
    whiteSpace: 'nowrap', border: `1px solid ${haupt ? MF : 'var(--border2, var(--border))'}`,
    background: haupt ? MF : 'var(--surface)', color: haupt ? '#fff' : 'var(--text-secondary)',
  })

  return (
    <div style={{ fontFamily: SCHRIFT, background: 'var(--bg)', minHeight: '100%' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '18px 16px 140px' }}>

        {/* Kopf */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', marginBottom: '18px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Erstkontakt · {new Date(bogen.erfasstAm).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
            <h2 style={{ margin: '4px 0 4px', fontSize: '25px', fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text)' }}>
              {f.name?.trim() || 'Neuer Erstkontakt'}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Handschrift: mit der Tastatur deines Tablets direkt in die Felder schreiben – wird sofort Text.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--green)' }}>✓ automatisch gesichert</span>
            <button onClick={onClose} style={knopf()}>Schließen</button>
          </div>
        </div>

        {tipps.length > 0 && (
          <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {tipps.map((t, i) => (
              <div key={i} style={{ fontSize: '12.5px', lineHeight: 1.55, padding: '10px 13px', borderRadius: R_SM, color: 'var(--text-secondary)',
                background: t.ton === 'warn' ? 'var(--yellow-dim, rgba(180,83,9,0.08))' : MF_SOFT,
                borderLeft: `3px solid ${t.ton === 'warn' ? 'var(--yellow)' : MF}` }}>
                {t.ton === 'warn' ? '⚠️ ' : 'ℹ️ '}{t.text}
              </div>
            ))}
          </div>
        )}

        <Abschnitt nr="1" titel="Wer sitzt mir gegenüber?" hinweis="Pflichtfeld rot" offen={offen.has(1)} onToggle={() => toggleAbschnitt(1)}>
          <div style={GRID}>
            <Feld label="Name / Firma" pflicht breit wert={f.name} onChange={v => setFeld('name', v)} platzhalter="z. B. Nordlicht Handels GmbH" />
            <Feld label="Ansprechpartner" wert={f.ansprechpartner} onChange={v => setFeld('ansprechpartner', v)} />
            <Feld label="Rechtsform" wert={f.rechtsform} onChange={v => setFeld('rechtsform', v)}
              optionen={['GmbH', 'UG', 'GmbH & Co. KG', 'Einzelunternehmen', 'GbR', 'OHG', 'KG', 'Privatperson', 'Verein', 'Sonstige']} />
            <Feld label="Telefon" wert={f.telefon} onChange={v => setFeld('telefon', v)} />
            <Feld label="E-Mail" wert={f.email} onChange={v => setFeld('email', v)} platzhalter="für Visitenkarte und Nachfass-Mail" />
            <Feld label="Anschrift" breit wert={f.anschrift} onChange={v => setFeld('anschrift', v)} />
            <Feld label="Steuernummer" wert={f.steuernummer} onChange={v => setFeld('steuernummer', v)} />
            <Feld label="Steuer-ID" wert={f.steuerId} onChange={v => setFeld('steuerId', v)} />
            <Feld label="USt-IdNr." wert={f.ustIdNr} onChange={v => setFeld('ustIdNr', v)} />
            <Feld label="Finanzamt" wert={f.finanzamt} onChange={v => setFeld('finanzamt', v)} />
          </div>
          <div style={{ fontSize: '12.5px', lineHeight: 1.55, padding: '10px 13px', borderRadius: R_SM, background: 'var(--yellow-dim, rgba(180,83,9,0.08))', borderLeft: '3px solid var(--yellow)', color: 'var(--text-secondary)', marginTop: '12px' }}>
            ⚖️ <strong>Geldwäschegesetz:</strong> Bei Mandatsbegründung ist zu identifizieren – Ausweisdaten aufnehmen und dokumentieren.
          </div>
        </Abschnitt>

        <Abschnitt nr="2" titel="Einkunftsarten" hinweis="steuert die Unterlagen-Liste" offen={offen.has(2)} onToggle={() => toggleAbschnitt(2)}>
          <Chips liste={EINKUNFTSARTEN} haken={h} onToggle={setHaken} />
        </Abschnitt>

        <Abschnitt nr="3" titel="Betrieb und Buchführung" offen={offen.has(3)} onToggle={() => toggleAbschnitt(3)}>
          <div style={GRID}>
            <Feld label="Tätigkeit / Gegenstand" breit wert={f.taetigkeit} onChange={v => setFeld('taetigkeit', v)} />
            <Feld label="Beginn der Tätigkeit" wert={f.beginn} onChange={v => setFeld('beginn', v)} platzhalter="z. B. 01.09.2026" />
            <Feld label="Gewinnermittlung" wert={f.gewinnermittlung} onChange={v => setFeld('gewinnermittlung', v)}
              optionen={['noch offen', 'EÜR (§ 4 Abs. 3)', 'Bilanz']} />
          </div>
          <div style={{ marginTop: '12px' }}><Chips liste={BETRIEB_MERKMALE} haken={h} onToggle={setHaken} /></div>
        </Abschnitt>

        <Abschnitt nr="4" titel="Umsatzsteuer" offen={offen.has(4)} onToggle={() => toggleAbschnitt(4)}>
          <Chips liste={UST_MERKMALE} haken={h} onToggle={setHaken} />
        </Abschnitt>

        <Abschnitt nr="5" titel="Bisheriger Berater und Vorgeschichte" offen={offen.has(5)} onToggle={() => toggleAbschnitt(5)}>
          <div style={GRID}>
            <Feld label="Bisheriger Berater" wert={f.vorberater} onChange={v => setFeld('vorberater', v)} />
            <Feld label="Wechselgrund" wert={f.wechselgrund} onChange={v => setFeld('wechselgrund', v)} />
            <Feld label="Offene Jahre / Rückstände" breit wert={f.rueckstaende} onChange={v => setFeld('rueckstaende', v)} />
          </div>
          <div style={{ marginTop: '12px' }}><Chips liste={VORGESCHICHTE} haken={h} onToggle={setHaken} /></div>
        </Abschnitt>

        <Abschnitt nr="6" titel="Systeme und Belegübergabe" offen={offen.has(6)} onToggle={() => toggleAbschnitt(6)}>
          <div style={GRID}>
            <Feld label="Vorsystem / Kasse" wert={f.vorsystem} onChange={v => setFeld('vorsystem', v)} platzhalter="z. B. Shopify, Lexware" />
            <Feld label="Bank" wert={f.bank} onChange={v => setFeld('bank', v)} />
            <Feld label="Belege kommen als" breit wert={f.belegweg} onChange={v => setFeld('belegweg', v)}
              optionen={['digital (Upload / Mail)', 'Papier', 'gemischt']} />
          </div>
        </Abschnitt>

        <Abschnitt nr="7" titel="Gewünschte Leistungen und Honorar" offen={offen.has(7)} onToggle={() => toggleAbschnitt(7)}>
          <Chips liste={LEISTUNGEN} haken={h} onToggle={setHaken} />
          <div style={{ ...GRID, marginTop: '13px' }}>
            <Feld label="Honorarrahmen besprochen" wert={f.honorar} onChange={v => setFeld('honorar', v)} />
            <Feld label="Mandatsvertrag" wert={f.mandatsvertrag} onChange={v => setFeld('mandatsvertrag', v)}
              optionen={['noch nicht', 'zugesagt', 'unterschrieben']} />
          </div>
        </Abschnitt>

        <Abschnitt nr="8" titel="Besonderheiten" hinweis="frei schreiben" offen={offen.has(8)} onToggle={() => toggleAbschnitt(8)}>
          <Feld label="Notizen aus dem Gespräch" breit mehrzeilig wert={f.notizen} onChange={v => setFeld('notizen', v)}
            platzhalter="Beteiligungen, Besonderheiten, Wünsche des Mandanten …" />
          <div style={{ marginTop: '14px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
              Skizze (Stift)
            </div>
            <Skizzenfeld
              wert={bogen.skizze || null}
              akzent={MF}
              onChange={(daten) => onChange({ ...bogen, skizze: daten, geaendertAm: new Date().toISOString() })}
            />
          </div>
        </Abschnitt>

        <Abschnitt nr="9" titel="Nächster Schritt" hinweis="wird Aufgabe" offen={offen.has(9)} onToggle={() => toggleAbschnitt(9)}>
          <div style={GRID}>
            <Feld label="Was passiert als Nächstes?" breit wert={f.naechsterSchritt} onChange={v => setFeld('naechsterSchritt', v)} />
            <Feld label="Bis wann" wert={f.bisWann} onChange={v => setFeld('bisWann', v)} platzhalter="TT.MM.JJJJ" />
            <Feld label="Status" wert={bogen.status} onChange={v => onChange({ ...bogen, status: v })}
              optionen={['offen', 'Angebot raus', 'gewonnen', 'verloren']} />
          </div>
          {f.naechsterSchritt && (
            <button onClick={() => { onAufgabe?.(f.naechsterSchritt, f.bisWann); setMsg('✓ Als Aufgabe angelegt.') }}
              style={{ ...knopf(), marginTop: '11px' }}>＋ Als Aufgabe anlegen</button>
          )}
        </Abschnitt>

        {/* Visitenkarte + Nachfass */}
        <Abschnitt nr="✉" titel="Visitenkarte und Nachfass-Mail" hinweis="Versand erst nach deinem Klick" offen={offen.has(10)} onToggle={() => toggleAbschnitt(10)}>
          <div style={{ display: 'flex', gap: '13px', alignItems: 'center', padding: '13px', border: `1px solid ${MF_LINE}`, borderRadius: R_SM, background: MF_SOFT }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '13px', background: MF, color: '#fff', fontSize: '19px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>JT</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: 'var(--text)' }}>{VISITENKARTE.name} · {VISITENKARTE.titel}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {VISITENKARTE.firma} – {VISITENKARTE.claim}<br />
                {VISITENKARTE.strasse}, {VISITENKARTE.plz} {VISITENKARTE.ort}<br />
                {VISITENKARTE.telefon} · {VISITENKARTE.email}
              </div>
            </div>
            <img src={qrBild} alt="QR-Code mit meinen Kontaktdaten" width="88" height="88"
              style={{ width: '88px', height: '88px', flexShrink: 0, borderRadius: '10px', border: '3px solid #fff', background: '#fff', imageRendering: 'pixelated' }} />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.55 }}>
            📷 <strong>Scannen lassen:</strong> Der Gegenüber richtet die Handy-Kamera auf den QR-Code und hat deinen
            Kontakt sofort gespeichert – ohne dass er seine E-Mail-Adresse herausgeben muss. Funktioniert auch ohne Netz.
            <button onClick={() => setQrGross(true)} style={{ background: 'none', border: 'none', padding: 0, marginLeft: '6px', color: MF, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              groß anzeigen
            </button>
          </div>
          <div style={{ display: 'flex', gap: '9px', flexWrap: 'wrap', marginTop: '12px' }}>
            <button onClick={visitenkarteVorbereiten} style={knopf()}>📇 Visitenkarte vorbereiten</button>
            <button onClick={nachfassVorbereiten} style={knopf()}>📋 Nachfass-Mail mit Unterlagen-Liste</button>
          </div>

          {mail && (
            <div style={{ marginTop: '12px', border: '1px solid var(--border)', borderRadius: R_SM, padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>An: {f.email || '(keine E-Mail hinterlegt)'} · Anhang: Visitenkarte (.vcf)</div>
              <input type="text" value={mail.betreff} onChange={e => setMail({ ...mail, betreff: e.target.value })}
                style={{ font: 'inherit', fontSize: '14px', fontWeight: 600, padding: '9px 11px', borderRadius: R_SM, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', outline: 'none' }} />
              <textarea value={mail.text} onChange={e => setMail({ ...mail, text: e.target.value })} rows={9}
                style={{ font: 'inherit', fontSize: '13.5px', padding: '9px 11px', borderRadius: R_SM, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', outline: 'none', resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={mailSenden} disabled={busy === 'mail'} style={knopf(true)}>
                  {busy === 'mail' ? '⏳ sendet …' : `📤 An ${f.email || '…'} senden`}
                </button>
                <button onClick={() => setMail(null)} style={knopf()}>Abbrechen</button>
              </div>
            </div>
          )}
        </Abschnitt>

        {/* KI-Vermerk */}
        <Abschnitt nr="✨" titel="KI-Aktenvermerk" hinweis="auf Klick" offen={offen.has(11)} onToggle={() => toggleAbschnitt(11)}>
          {bogen.vermerk ? (
            <div style={{ padding: '13px 15px', borderRadius: R_SM, background: 'var(--surface2)', borderLeft: `3px solid ${MF}`, fontSize: '13.5px', lineHeight: 1.6, color: 'var(--text)' }}>
              <span style={{ display: 'block', fontSize: '10px', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: MF, marginBottom: '5px' }}>Vermerk zum Erstgespräch</span>
              {bogen.vermerk.text}
              {bogen.vermerk.punkte?.length > 0 && (
                <div style={{ marginTop: '11px' }}>
                  <div style={{ fontWeight: 700, color: MF, marginBottom: '4px' }}>Offene Punkte</div>
                  {bogen.vermerk.punkte.map((p, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', padding: '4px 0' }}>
                      <span style={{ color: MF, fontWeight: 800 }}>{i + 1}.</span>
                      <span style={{ flex: 1 }}>{p}</span>
                      <button onClick={() => { onAufgabe?.(p, f.bisWann); setMsg('✓ Als Aufgabe angelegt.') }}
                        style={{ background: 'none', border: 'none', color: MF, fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        ＋ Aufgabe
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button onClick={vermerkErzeugen} disabled={!!busy} style={knopf()}>
              {busy === 'ki' ? '⏳ schreibt …' : '✨ Vermerk und offene Punkte erzeugen'}
            </button>
          )}
        </Abschnitt>

        {msg && <div style={{ fontSize: '12.5px', marginTop: '10px', color: msg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{msg}</div>}
      </div>

      {/* Aktionsleiste unten */}
      <div style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '11px 16px', boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', gap: '9px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={visitenkarteVorbereiten} style={knopf()}>📇 Visitenkarte</button>
          <button onClick={vermerkErzeugen} disabled={!!busy} style={knopf()}>✨ Vermerk</button>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={knopf()}>Fertig</button>
          {!bogen.clientId && (
            <button onClick={() => { setNummer(''); setZeigeMandant(true) }} style={knopf(true)}>→ Mandant anlegen</button>
          )}
          {bogen.clientId && <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--green)' }}>✓ als Mandant angelegt</span>}
        </div>
      </div>

      {/* QR groß – Tablet dem Gegenüber hinhalten */}
      {qrGross && qrBild && (
        <div onClick={() => setQrGross(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1950, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px', padding: '24px', cursor: 'pointer' }}>
          <img src={qrBild} alt="QR-Code mit den Kontaktdaten"
            style={{ width: 'min(70vh, 88vw)', height: 'auto', borderRadius: '18px', border: '14px solid #fff', background: '#fff', imageRendering: 'pixelated' }} />
          <div style={{ color: '#fff', textAlign: 'center', lineHeight: 1.6 }}>
            <div style={{ fontSize: '19px', fontWeight: 800 }}>{VISITENKARTE.name} · {VISITENKARTE.titel}</div>
            <div style={{ fontSize: '14px', opacity: 0.85 }}>{VISITENKARTE.firma} · {VISITENKARTE.telefon}</div>
            <div style={{ fontSize: '12.5px', opacity: 0.7, marginTop: '8px' }}>Mit der Handy-Kamera scannen · tippen zum Schließen</div>
          </div>
        </div>
      )}

      {/* Mandanten-Anlage */}
      {zeigeMandant && (
        <div onClick={() => setZeigeMandant(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: R, width: '100%', maxWidth: '440px', padding: '20px 22px' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', marginBottom: '4px' }}>→ Aus Erstkontakt einen Mandanten machen</div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '14px' }}>
              Alle Angaben werden übernommen; der Bogen bleibt als Erstkontakt erhalten. Aus den gewählten Leistungen werden Aufträge angelegt.
            </div>
            <Feld label="Mandantennummer" pflicht wert={nummer} onChange={setNummer} platzhalter="z. B. 10063" />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setZeigeMandant(false)} style={knopf()}>Abbrechen</button>
              <button disabled={!nummer.trim()} style={{ ...knopf(true), opacity: nummer.trim() ? 1 : 0.6 }}
                onClick={() => { onMandantAnlegen?.(bogen, nummer.trim()); setZeigeMandant(false) }}>
                Mandant anlegen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
