/**
 * RechnungSevdeskBlock – Rechnungsstellung über sevDesk, pro Mandant.
 *
 * Stufe 2 der sevDesk-Integration:
 *  - erkennt den aktuell geöffneten Mandanten (aus prop `client`)
 *  - Verbindungstest zur sevDesk-API (Proxy /api/sevdesk-api, action 'ping')
 *  - Abgleich der rechnungsrelevanten Stammdaten (Anschrift, E-Mail, USt-IdNr.)
 *
 * Datensicherheit: schreibt ausschließlich ADDITIV in ein neues Unterobjekt
 * `client.rechnung`. Bestehende Mandantenfelder werden nie berührt/überschrieben.
 * Der sevDesk-Token liegt server-seitig – hier wird er nie angefasst.
 */
import { useState } from 'react'
import {
  pingSevdesk, findSevdeskContacts, getSevdeskContactDetails, createSevdeskContact,
  createSevdeskInvoice, getSevdeskInvoicePdf,
} from '../../utils/sevdeskClient.js'

const ACCENT = '#4f46e5'

const inputBase = {
  width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px',
  background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', boxSizing: 'border-box',
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: '10px', fontWeight: 700, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
      {children}
    </div>
  )
}

// Rechnungsrelevante Felder, die sevDesk für eine (E-)Rechnung braucht.
// `pflicht`: für Erstellung + Versand zwingend nötig.
// `b2b`: nur bei Firmenmandanten empfohlen (USt-IdNr. für EN-16931-E-Rechnung).
const RECHNUNG_FELDER = [
  { key: 'strasse', label: 'Straße & Hausnr.', pflicht: true,  placeholder: 'z. B. Musterstraße 1' },
  { key: 'plz',     label: 'PLZ',              pflicht: true,  placeholder: 'z. B. 24103' },
  { key: 'ort',     label: 'Ort',             pflicht: true,  placeholder: 'z. B. Kiel' },
  { key: 'land',    label: 'Land',            pflicht: false, placeholder: 'Deutschland' },
  { key: 'email',   label: 'Rechnungs-E-Mail', pflicht: true, placeholder: 'z. B. buchhaltung@mandant.de' },
  { key: 'ustId',   label: 'USt-IdNr. (B2B)', pflicht: false, b2b: true, placeholder: 'z. B. DE123456789' },
  { key: 'kundennummer', label: 'Kundennr. (optional)', pflicht: false, placeholder: 'intern' },
]

function leerRechnung() {
  return { strasse: '', plz: '', ort: '', land: 'Deutschland', email: '', ustId: '', kundennummer: '' }
}

// ── Rechnungs-Editor (Entwurf + Vorschau) ──────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0, 10) }
function fmtEuro(v) { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(v) || 0) }

const UST_SAETZE = [19, 7, 0]

// Kleiner Leistungskatalog für wiederkehrende Positionen (Beträge frei änderbar).
const LEISTUNG_PRESETS = [
  { name: 'USt-Voranmeldung',              price: 75,  taxRate: 19 },
  { name: 'Finanzbuchführung (monatlich)', price: 150, taxRate: 19 },
  { name: 'Lohn- und Gehaltsabrechnung',   price: 15,  taxRate: 19 },
  { name: 'Jahresabschluss',               price: 0,   taxRate: 19 },
  { name: 'Beratung',                      price: 0,   taxRate: 19 },
]

function mkPos(preset) {
  return {
    id:       'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name:     preset?.name ?? '',
    quantity: 1,
    price:    preset?.price != null ? String(preset.price) : '',
    taxRate:  preset?.taxRate ?? 19,
    text:     '',
  }
}

// Empfängeranschrift für die Rechnung aus den Stammdaten (mehrzeilig).
function buildAddress(client) {
  const r = client.rechnung ?? {}
  const lines = [
    client.name,
    r.strasse,
    [r.plz, r.ort].filter(Boolean).join(' ').trim(),
    r.land && r.land !== 'Deutschland' ? r.land : null,
  ].map(s => String(s ?? '').trim()).filter(Boolean)
  return lines.join('\n')
}

function InvoiceEntwurf({ client }) {
  const [positions, setPositions]   = useState([mkPos(LEISTUNG_PRESETS[0])])
  const [headText, setHeadText]     = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayISO())
  const [timeToPay, setTimeToPay]   = useState('14')
  const [creating, setCreating]     = useState(false)
  const [invError, setInvError]     = useState('')
  const [result, setResult]         = useState(null)   // { invoice, pdf }

  const setPos = (id, k, v) => setPositions(ps => ps.map(p => p.id === id ? { ...p, [k]: v } : p))
  const addPos = (preset)   => setPositions(ps => [...ps, mkPos(preset)])
  const delPos = (id)       => setPositions(ps => ps.length > 1 ? ps.filter(p => p.id !== id) : ps)

  const sums = positions.reduce((acc, p) => {
    const net = (Number(p.quantity) || 0) * (Number(String(p.price).replace(',', '.')) || 0)
    acc.net += net
    acc.tax += net * ((Number(p.taxRate) || 0) / 100)
    return acc
  }, { net: 0, tax: 0 })
  const gross = sums.net + sums.tax

  async function createDraft() {
    const valid = positions
      .map(p => ({ ...p, price: Number(String(p.price).replace(',', '.')) || 0, quantity: Number(p.quantity) || 1, taxRate: Number(p.taxRate) || 0 }))
      .filter(p => String(p.name).trim() && p.price > 0)
    if (!valid.length) { setInvError('Bitte mindestens eine Position mit Bezeichnung und Betrag (> 0) angeben.'); return }

    setCreating(true); setInvError('')
    try {
      const res = await createSevdeskInvoice({
        contactId:   client.sevdeskContactId,
        invoiceDate,
        timeToPay:   Number(timeToPay) || 0,
        headText,
        address:     buildAddress(client) || undefined,
        positions:   valid.map(p => ({ name: p.name.trim(), quantity: p.quantity, price: p.price, taxRate: p.taxRate, text: p.text })),
      })
      let pdf = null
      try { pdf = await getSevdeskInvoicePdf(res.invoice.id) } catch { /* PDF-Vorschau optional */ }
      setResult({ invoice: res.invoice, pdf })
    } catch (e) {
      setInvError(e.message || 'Rechnungsentwurf konnte nicht erstellt werden.')
    } finally { setCreating(false) }
  }

  function neueRechnung() {
    setResult(null); setInvError('')
    setPositions([mkPos(LEISTUNG_PRESETS[0])]); setHeadText(''); setInvoiceDate(todayISO()); setTimeToPay('14')
  }

  // ── Ergebnis-Ansicht (Entwurf angelegt + Vorschau) ──
  if (result) {
    const inv = result.invoice
    const pdfUrl = result.pdf?.base64 ? `data:${result.pdf.mimetype || 'application/pdf'};base64,${result.pdf.base64}` : null
    return (
      <div style={{ border: `1px solid ${ACCENT}44`, borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ background: ACCENT, color: '#fff', padding: '8px 14px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>✓ Entwurf in sevDesk angelegt</span>
          <span style={{ flex: 1 }} />
          <button onClick={neueRechnung}
            style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
            + Neue Rechnung
          </button>
        </div>
        <div style={{ padding: '12px 14px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Entwurf-ID: <strong style={{ color: 'var(--text)' }}>{inv.id}</strong></span>
            {inv.sumNet   != null && <span style={{ color: 'var(--text-muted)' }}>Netto: <strong style={{ color: 'var(--text)' }}>{fmtEuro(inv.sumNet)}</strong></span>}
            {inv.sumGross != null && <span style={{ color: 'var(--text-muted)' }}>Brutto: <strong style={{ color: 'var(--text)' }}>{fmtEuro(inv.sumGross)}</strong></span>}
          </div>
          {pdfUrl ? (
            <>
              <iframe title="Rechnungsvorschau" src={pdfUrl} style={{ width: '100%', height: '460px', border: '1px solid var(--border)', borderRadius: '8px', background: '#fff' }} />
              <a href={pdfUrl} download={result.pdf.filename || 'rechnung.pdf'}
                style={{ alignSelf: 'flex-start', fontSize: '12px', color: ACCENT, textDecoration: 'none', fontWeight: 700 }}>
                ⬇ PDF herunterladen
              </a>
            </>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              PDF-Vorschau nicht verfügbar – der Entwurf liegt aber in sevDesk (ID {inv.id}).
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            💡 Dies ist ein <strong>Entwurf</strong> (noch keine Rechnungsnummer, kein Versand). Prüfe die Vorschau –
            der Versand an die Mandanten-E-Mail folgt in einem eigenen Schritt auf deinen Klick.
          </div>
        </div>
      </div>
    )
  }

  // ── Editor-Ansicht ──
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>Neue Rechnung (Entwurf)</div>

      {/* Kopfzeile: Datum + Zahlungsziel */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px 140px', gap: '10px' }}>
        <div>
          <FieldLabel>Rechnungsdatum</FieldLabel>
          <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={inputBase} />
        </div>
        <div>
          <FieldLabel>Zahlungsziel (Tage)</FieldLabel>
          <input type="number" min="0" value={timeToPay} onChange={e => setTimeToPay(e.target.value)} style={inputBase} />
        </div>
      </div>

      {/* Positionen */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {positions.map((p, idx) => (
          <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', background: 'var(--surface2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px 90px auto', gap: '8px', alignItems: 'end' }}>
              <div>
                {idx === 0 && <FieldLabel>Bezeichnung</FieldLabel>}
                <input value={p.name} onChange={e => setPos(p.id, 'name', e.target.value)} placeholder="z. B. USt-Voranmeldung" style={inputBase} />
              </div>
              <div>
                {idx === 0 && <FieldLabel>Menge</FieldLabel>}
                <input type="number" min="0" step="0.01" value={p.quantity} onChange={e => setPos(p.id, 'quantity', e.target.value)} style={inputBase} />
              </div>
              <div>
                {idx === 0 && <FieldLabel>Einzelpreis netto</FieldLabel>}
                <input inputMode="decimal" value={p.price} onChange={e => setPos(p.id, 'price', e.target.value)} placeholder="0,00" style={inputBase} />
              </div>
              <div>
                {idx === 0 && <FieldLabel>USt %</FieldLabel>}
                <select value={p.taxRate} onChange={e => setPos(p.id, 'taxRate', Number(e.target.value))} style={inputBase}>
                  {UST_SAETZE.map(s => <option key={s} value={s}>{s}%</option>)}
                </select>
              </div>
              <button onClick={() => delPos(p.id)} disabled={positions.length === 1} title="Position entfernen"
                style={{ background: 'none', border: 'none', cursor: positions.length === 1 ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', fontSize: '15px', padding: '6px 4px', opacity: positions.length === 1 ? 0.4 : 1 }}>
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Leistungskatalog + Position hinzufügen */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Katalog:</span>
        {LEISTUNG_PRESETS.map(pr => (
          <button key={pr.name} onClick={() => addPos(pr)}
            style={{ padding: '3px 10px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer' }}>
            + {pr.name}
          </button>
        ))}
        <button onClick={() => addPos()}
          style={{ padding: '3px 10px', borderRadius: '12px', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>
          + leere Position
        </button>
      </div>

      {/* Kopftext */}
      <div>
        <FieldLabel>Einleitungstext (optional)</FieldLabel>
        <input value={headText} onChange={e => setHeadText(e.target.value)} placeholder="z. B. Leistungszeitraum Juli 2026" style={inputBase} />
      </div>

      {/* Summen */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'flex-end', fontSize: '12px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
        <span style={{ color: 'var(--text-muted)' }}>Netto: <strong style={{ color: 'var(--text)' }}>{fmtEuro(sums.net)}</strong></span>
        <span style={{ color: 'var(--text-muted)' }}>USt: <strong style={{ color: 'var(--text)' }}>{fmtEuro(sums.tax)}</strong></span>
        <span style={{ color: 'var(--text-muted)' }}>Brutto: <strong style={{ color: ACCENT, fontSize: '14px' }}>{fmtEuro(gross)}</strong></span>
      </div>

      {invError && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#ef4444' }}>
          ⚠ {invError}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={createDraft} disabled={creating}
          style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: ACCENT, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: creating ? 'wait' : 'pointer', opacity: creating ? 0.7 : 1 }}>
          {creating ? '⏳ Entwurf wird erstellt …' : '📝 Entwurf erstellen & Vorschau'}
        </button>
      </div>

      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Es wird ein <strong>Entwurf</strong> in sevDesk angelegt (Regelbesteuerung; USt-Satz je Position wählbar).
        Fachliche Korrektheit (Bezeichnung, Beträge, Steuerfall) liegt bei dir. Kein Versand in diesem Schritt.
      </div>
    </div>
  )
}

export default function RechnungSevdeskBlock({ client, onUpdate }) {
  const rechnung = { ...leerRechnung(), ...(client.rechnung ?? {}) }

  // ── Verbindungstest ──────────────────────────────────────────────────────
  const [conn, setConn] = useState({ status: 'idle', message: '', user: null })

  async function testConnection() {
    setConn({ status: 'testing', message: '', user: null })
    try {
      const res = await pingSevdesk()
      setConn({ status: 'ok', message: '', user: res.user ?? null })
    } catch (e) {
      setConn({ status: 'error', message: e.message || 'Verbindung fehlgeschlagen', user: null })
    }
  }

  // ── Kontakt-Mapping (Mandant ↔ sevDesk-Kontakt) ──────────────────────────
  const [query, setQuery]     = useState(client.name ?? '')
  const [results, setResults] = useState(null)   // null = noch nicht gesucht
  const [mapBusy, setMapBusy] = useState(false)
  const [mapMsg, setMapMsg]   = useState('')

  async function suchen() {
    setMapBusy(true); setMapMsg('')
    try {
      const res = await findSevdeskContacts(query.trim())
      setResults(res.contacts ?? [])
    } catch (e) {
      setMapMsg(e.message || 'Suche fehlgeschlagen'); setResults(null)
    } finally { setMapBusy(false) }
  }

  // Verknüpfen: sevdeskContactId setzen + Anschrift/E-Mail ADDITIV übernehmen
  // (füllt nur leere Felder in client.rechnung – überschreibt nie Vorhandenes).
  async function verknuepfen(c) {
    setMapBusy(true); setMapMsg('')
    try {
      const patch = { sevdeskContactId: c.id, sevdeskContactName: c.name }
      try {
        const res = await getSevdeskContactDetails(c.id)
        const a   = res.contact?.address ?? {}
        const cur = client.rechnung ?? {}
        const merged = { ...cur }
        const fill = (k, v) => { if (v && !String(cur[k] ?? '').trim()) merged[k] = v }
        fill('strasse', a.strasse); fill('plz', a.plz); fill('ort', a.ort); fill('land', a.land)
        fill('email', res.contact?.email)
        if (!String(cur.kundennummer ?? '').trim() && res.contact?.customerNumber) merged.kundennummer = String(res.contact.customerNumber)
        patch.rechnung = merged
      } catch { /* Details optional – Verknüpfung trotzdem speichern */ }
      onUpdate(patch)
      setResults(null)
    } finally { setMapBusy(false) }
  }

  function loesen() {
    onUpdate({ sevdeskContactId: null, sevdeskContactName: null })  // Stammdaten bleiben erhalten
    setResults(null); setQuery(client.name ?? '')
  }

  async function neuAnlegen() {
    setMapBusy(true); setMapMsg('')
    try {
      const res = await createSevdeskContact(client.name)
      if (res.contact?.id) await verknuepfen(res.contact)
      else setMapMsg('Kontakt wurde angelegt, aber ohne ID zurückgegeben.')
    } catch (e) {
      setMapMsg(e.message || 'Anlegen fehlgeschlagen')
    } finally { setMapBusy(false) }
  }

  // Explizit Anschrift/E-Mail aus sevDesk überschreiben (mit Rückfrage)
  async function ausSevdeskAktualisieren() {
    if (!client.sevdeskContactId) return
    if (!window.confirm('Anschrift und E-Mail aus dem sevDesk-Kontakt übernehmen? Vorhandene Werte werden dabei überschrieben.')) return
    setMapBusy(true); setMapMsg('')
    try {
      const res = await getSevdeskContactDetails(client.sevdeskContactId)
      const a   = res.contact?.address ?? {}
      const merged = { ...(client.rechnung ?? {}) }
      if (a.strasse) merged.strasse = a.strasse
      if (a.plz)     merged.plz     = a.plz
      if (a.ort)     merged.ort     = a.ort
      if (a.land)    merged.land    = a.land
      if (res.contact?.email) merged.email = res.contact.email
      if (res.contact?.customerNumber) merged.kundennummer = String(res.contact.customerNumber)
      onUpdate({ rechnung: merged })
      setMapMsg('✓ Aus sevDesk aktualisiert.')
    } catch (e) {
      setMapMsg(e.message || 'Aktualisieren fehlgeschlagen')
    } finally { setMapBusy(false) }
  }

  // ── Stammdaten bearbeiten ────────────────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(rechnung)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function startEdit() { setForm({ ...leerRechnung(), ...(client.rechnung ?? {}) }); setEditing(true) }
  function saveEdit() {
    // ADDITIV: nur das rechnung-Unterobjekt schreiben, alles andere bleibt unberührt
    onUpdate({ rechnung: { ...(client.rechnung ?? {}), ...form } })
    setEditing(false)
  }

  // Vollständigkeit für die Anzeige
  const fehlendePflicht = RECHNUNG_FELDER.filter(f => f.pflicht && !String(rechnung[f.key] ?? '').trim())
  const istVollstaendig = fehlendePflicht.length === 0

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: ACCENT, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '16px' }}>🧾</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Rechnung erstellen (sevDesk)</span>
        <button onClick={testConnection} disabled={conn.status === 'testing'}
          style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: conn.status === 'testing' ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
          {conn.status === 'testing' ? '⏳ teste …' : '🔌 Verbindung testen'}
        </button>
      </div>

      <div style={{ padding: '12px', background: 'var(--surface2)', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Mandanten-Erkennung */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', border: `1px solid ${ACCENT}33`, borderRadius: '10px', padding: '10px 14px', background: `${ACCENT}0a` }}>
          <span style={{ fontSize: '18px' }}>👤</span>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: ACCENT }}>Rechnungsempfänger (erkannt)</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{client.name || 'Unbenannter Mandant'}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {[client.mandantennummer && `Nr. ${client.mandantennummer}`, client.rechtsform].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
        </div>

        {/* Verbindungs-Status */}
        {conn.status === 'ok' && (
          <div style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#16a34a' }}>
            ✓ Verbindung zu sevDesk steht{conn.user?.fullname ? ` – angemeldet als ${conn.user.fullname}` : ''}.
          </div>
        )}
        {conn.status === 'error' && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#ef4444' }}>
            ⚠ {conn.message}
          </div>
        )}

        {/* Kontakt-Mapping (Mandant ↔ sevDesk-Kontakt) */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', background: 'var(--surface)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px' }}>
            sevDesk-Kontakt
          </div>

          {client.sevdeskContactId ? (
            /* verknüpft */
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '16px' }}>🔗</span>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                  {client.sevdeskContactName || 'Verknüpfter Kontakt'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  sevDesk-Kontakt-ID {client.sevdeskContactId}
                </div>
              </div>
              <button onClick={ausSevdeskAktualisieren} disabled={mapBusy}
                style={{ padding: '5px 12px', borderRadius: '6px', border: `1px solid ${ACCENT}`, background: 'transparent', color: ACCENT, fontSize: '11px', fontWeight: 700, cursor: mapBusy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
                ⟳ Aus sevDesk aktualisieren
              </button>
              <button onClick={loesen} disabled={mapBusy}
                style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '11px', cursor: mapBusy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
                Verknüpfung lösen
              </button>
            </div>
          ) : (
            /* nicht verknüpft → suchen / anlegen */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') suchen() }}
                  placeholder="Kontakt in sevDesk suchen (Name oder Kundennr.)"
                  style={{ ...inputBase, flex: 1, minWidth: '180px' }}
                />
                <button onClick={suchen} disabled={mapBusy}
                  style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', background: ACCENT, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: mapBusy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
                  {mapBusy ? '⏳ …' : '🔍 Suchen'}
                </button>
              </div>

              {results !== null && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {results.length === 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '4px 2px' }}>
                      Kein passender Kontakt gefunden.
                    </div>
                  )}
                  {results.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '7px', background: 'var(--surface2)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{c.name || '(ohne Name)'}</div>
                        {c.customerNumber && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Kundennr. {c.customerNumber}</div>}
                      </div>
                      <button onClick={() => verknuepfen(c)} disabled={mapBusy}
                        style={{ padding: '4px 12px', borderRadius: '6px', border: `1px solid ${ACCENT}`, background: `${ACCENT}12`, color: ACCENT, fontSize: '11px', fontWeight: 700, cursor: mapBusy ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
                        Verknüpfen
                      </button>
                    </div>
                  ))}
                  <button onClick={neuAnlegen} disabled={mapBusy}
                    style={{ alignSelf: 'flex-start', marginTop: '2px', padding: '5px 12px', borderRadius: '6px', border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '11px', cursor: mapBusy ? 'wait' : 'pointer' }}>
                    ＋ „{client.name || 'Mandant'}" neu in sevDesk anlegen
                  </button>
                </div>
              )}
            </div>
          )}

          {mapMsg && (
            <div style={{ fontSize: '11px', color: mapMsg.startsWith('✓') ? '#16a34a' : '#ef4444', marginTop: '8px' }}>
              {mapMsg.startsWith('✓') ? mapMsg : `⚠ ${mapMsg}`}
            </div>
          )}
        </div>

        {/* Stammdaten-Abgleich */}
        {!editing ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', flex: 1 }}>
                Rechnungs-Stammdaten
              </span>
              {istVollstaendig
                ? <span style={{ fontSize: '10px', background: 'rgba(22,163,74,0.12)', color: '#16a34a', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>vollständig</span>
                : <span style={{ fontSize: '10px', background: 'rgba(249,115,22,0.12)', color: '#f97316', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>{fehlendePflicht.length} Pflichtfeld{fehlendePflicht.length !== 1 ? 'er' : ''} fehlt</span>}
              <button onClick={startEdit}
                style={{ padding: '4px 12px', borderRadius: '6px', border: `1px solid ${ACCENT}`, background: 'transparent', color: ACCENT, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                ✏️ Bearbeiten
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px 16px' }}>
              {RECHNUNG_FELDER.map(f => {
                const val = String(rechnung[f.key] ?? '').trim()
                const fehlt = f.pflicht && !val
                return (
                  <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {f.label}{f.pflicht && ' *'}
                    </span>
                    <span style={{ fontSize: '12px', color: val ? 'var(--text)' : (fehlt ? '#f97316' : 'var(--text-muted)'), fontWeight: val ? 600 : 400 }}>
                      {val || (fehlt ? '⚠ fehlt' : '–')}
                    </span>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: '10px' }}>
              💡 Diese Daten wandern später in den sevDesk-Kontakt und auf die Rechnung.
              sevDesk bleibt das führende System (Nummernkreis, E-Rechnung, Archiv) – hier pflegst du nur die Basis.
            </div>
          </div>
        ) : (
          <div style={{ border: `2px solid ${ACCENT}44`, borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ background: ACCENT, color: '#fff', padding: '8px 14px', fontSize: '12px', fontWeight: 700 }}>
              ✏️ Rechnungs-Stammdaten bearbeiten
            </div>
            <div style={{ padding: '14px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                {RECHNUNG_FELDER.map(f => (
                  <div key={f.key}>
                    <FieldLabel>{f.label}{f.pflicht && ' *'}</FieldLabel>
                    <input value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} style={inputBase} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setEditing(false)}
                  style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>
                  Abbrechen
                </button>
                <button onClick={saveEdit}
                  style={{ padding: '6px 18px', borderRadius: '6px', border: 'none', background: ACCENT, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                  Speichern
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rechnung erstellen (Entwurf + Vorschau) – nur bei verknüpftem Kontakt */}
        {client.sevdeskContactId ? (
          <InvoiceEntwurf client={client} />
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '10px', padding: '12px 14px', textAlign: 'center' }}>
            🔗 Zum Erstellen einer Rechnung zuerst oben einen <strong>sevDesk-Kontakt verknüpfen</strong>.
          </div>
        )}

      </div>
    </div>
  )
}
