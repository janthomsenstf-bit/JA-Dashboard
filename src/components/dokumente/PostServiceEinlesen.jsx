import { useState, useEffect, useCallback } from 'react'
import { callApi } from '../../utils/onedriveClient.js'
import { pdfTextExtrahieren } from '../../utils/pdfText.js'
import { extrahiereKennungen, erkenneDokumenttyp, ordneMandantZu, maskiereIban } from '../../utils/dokErkennung.js'

/**
 * PostServiceEinlesen – Stufe 2b-1 des Dokumente/Post-Service.
 *
 * Liest die PDFs eines konfigurierbaren OneDrive-Eingangsordners, zieht lokal
 * den Textlayer (pdf.js) und erkennt DETERMINISTISCH Dokumenttyp + Mandant
 * (Engine aus dokErkennung.js). Reine VORSCHAU – es wird nichts verschoben,
 * umbenannt, gelöscht oder gemailt. Diese Aktionen folgen in Stufe 3+.
 *
 * Bild-Scans ohne Textlayer werden erkannt und für den OCR-Fallback (2b-2)
 * markiert, aber noch nicht verarbeitet.
 */

const FARBE = '#dc2626'
const ORDNER_KEY = 'sda-postservice-eingangsordner'

const SICHERHEIT_STIL = {
  hoch:    { label: 'Sicher',      farbe: '#16a34a', bg: '#16a34a18' },
  mittel:  { label: 'Wahrscheinl.',farbe: '#ca8a04', bg: '#ca8a0418' },
  niedrig: { label: 'Unsicher',    farbe: '#ea580c', bg: '#ea580c18' },
  keiner:  { label: 'Kein Treffer',farbe: '#6b7280', bg: '#6b728018' },
}

export default function PostServiceEinlesen({ clients = [], tokens, onUpdateTokens }) {
  const [eingangsordner, setEingangsordner] = useState('')
  const [entwurfsordner, setEntwurfsordner] = useState('')
  const [dateien, setDateien]   = useState([])   // [{ id, name, size, filePath }]
  const [ergebnisse, setErgebnisse] = useState({}) // dateiId → Ergebnis
  const [ladenListe, setLadenListe] = useState(false)
  const [ladenAlle, setLadenAlle]   = useState(false)
  const [fehler, setFehler] = useState('')

  // Konfigurierten Eingangsordner laden
  useEffect(() => {
    const gespeichert = localStorage.getItem(ORDNER_KEY) ?? ''
    setEingangsordner(gespeichert)
    setEntwurfsordner(gespeichert)
  }, [])

  const speichereOrdner = () => {
    const wert = entwurfsordner.trim().replace(/^\/+|\/+$/g, '')
    localStorage.setItem(ORDNER_KEY, wert)
    setEingangsordner(wert)
    setDateien([])
    setErgebnisse({})
  }

  // Ordnerinhalt (nur PDFs) laden
  const ordnerEinlesen = useCallback(async () => {
    if (!eingangsordner) { setFehler('Bitte zuerst einen Eingangsordner speichern.'); return }
    setFehler(''); setLadenListe(true); setErgebnisse({})
    try {
      const res = await callApi('listFolder', { folderPath: eingangsordner }, tokens, onUpdateTokens)
      const pdfs = (res.items ?? [])
        .filter(i => i.file && /\.pdf$/i.test(i.name))
        .map(i => ({ id: i.id, name: i.name, size: i.size ?? 0, filePath: `${eingangsordner}/${i.name}` }))
      setDateien(pdfs)
      if (pdfs.length === 0) setFehler('Im Ordner wurden keine PDF-Dateien gefunden.')
    } catch (e) {
      setFehler(e?.message ?? 'Ordner konnte nicht gelesen werden.')
      setDateien([])
    } finally {
      setLadenListe(false)
    }
  }, [eingangsordner, tokens, onUpdateTokens])

  // Eine einzelne Datei einlesen + erkennen
  const dateiErkennen = useCallback(async (datei) => {
    setErgebnisse(prev => ({ ...prev, [datei.id]: { status: 'laden' } }))
    try {
      const dl = await callApi('downloadUrl', { filePath: datei.filePath }, tokens, onUpdateTokens)
      if (!dl.downloadUrl) throw new Error('Kein Download-Link erhalten.')
      const resp = await fetch(dl.downloadUrl)
      if (!resp.ok) throw new Error(`Download fehlgeschlagen (HTTP ${resp.status}).`)
      const buffer = await resp.arrayBuffer()

      const { text, seiten, hatTextlayer } = await pdfTextExtrahieren(buffer)
      if (!hatTextlayer) {
        setErgebnisse(prev => ({ ...prev, [datei.id]: { status: 'bildscan', seiten } }))
        return
      }
      const kennungen = extrahiereKennungen(text)
      const typ = erkenneDokumenttyp(text)
      const zuordnung = ordneMandantZu(text, clients, kennungen)
      setErgebnisse(prev => ({
        ...prev,
        [datei.id]: { status: 'fertig', seiten, typ, ...zuordnung },
      }))
    } catch (e) {
      setErgebnisse(prev => ({ ...prev, [datei.id]: { status: 'fehler', fehler: e?.message ?? 'Fehler' } }))
    }
  }, [clients, tokens, onUpdateTokens])

  const alleErkennen = useCallback(async () => {
    setLadenAlle(true)
    for (const d of dateien) {
      // bewusst sequenziell: schont Speicher/Netz und hält die Anzeige ruhig
      // eslint-disable-next-line no-await-in-loop
      await dateiErkennen(d)
    }
    setLadenAlle(false)
  }, [dateien, dateiErkennen])

  const fmtGroesse = b => (!b ? '–' : b < 1024*1024 ? `${(b/1024).toFixed(0)} KB` : `${(b/1024/1024).toFixed(1)} MB`)

  return (
    <div style={{ maxWidth: '960px' }}>
      {/* Hinweis */}
      <div style={{ padding: '13px 16px', marginBottom: '18px', borderRadius: '11px', background: 'var(--surface)', border: `1px dashed ${FARBE}55` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '6px' }}>
          <span style={{ fontSize: '17px' }} aria-hidden="true">📥</span>
          <strong style={{ fontSize: '14px', color: 'var(--text)' }}>Post-Service – Einlesen &amp; Erkennen</strong>
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: FARBE + '18', color: FARBE }}>Stufe 2</span>
        </div>
        <p style={{ margin: 0, fontSize: '12.5px', lineHeight: 1.65, color: 'var(--text-muted)' }}>
          Liest die PDFs des Eingangsordners, erkennt lokal Dokumenttyp und Mandant über
          harte Kennungen (IBAN, USt-IdNr., Steuernummer …). <strong style={{ color: 'var(--text)' }}>Reine Vorschau</strong> –
          es wird nichts verschoben, umbenannt oder versendet.
        </p>
      </div>

      {/* Eingangsordner-Konfiguration */}
      <div style={{ marginBottom: '18px' }}>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
          OneDrive-Eingangsordner
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={entwurfsordner}
            onChange={e => setEntwurfsordner(e.target.value)}
            placeholder="z. B. Jahresabschluss-Dashboard/Posteingang"
            style={{ flex: 1, minWidth: '280px', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', fontFamily: 'var(--font-mono)', outline: 'none' }}
          />
          <button
            onClick={speichereOrdner}
            disabled={entwurfsordner.trim() === eingangsordner}
            style={{ padding: '9px 15px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', fontWeight: 600, cursor: entwurfsordner.trim() === eingangsordner ? 'default' : 'pointer', opacity: entwurfsordner.trim() === eingangsordner ? 0.5 : 1 }}
          >Speichern</button>
          <button
            onClick={ordnerEinlesen}
            disabled={!eingangsordner || ladenListe}
            style={{ padding: '9px 15px', borderRadius: '9px', border: 'none', background: FARBE, color: '#fff', fontSize: '13px', fontWeight: 700, cursor: (!eingangsordner || ladenListe) ? 'default' : 'pointer', opacity: (!eingangsordner || ladenListe) ? 0.6 : 1 }}
          >{ladenListe ? 'Lese …' : '📂 Ordner einlesen'}</button>
        </div>
      </div>

      {fehler && (
        <div style={{ padding: '10px 14px', marginBottom: '16px', borderRadius: '9px', background: '#ef444414', border: '1px solid #ef444440', color: '#b91c1c', fontSize: '12.5px' }}>
          {fehler}
        </div>
      )}

      {/* Datei-Liste */}
      {dateien.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{dateien.length} PDF-Datei(en) im Eingangsordner</span>
            <button
              onClick={alleErkennen}
              disabled={ladenAlle}
              style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${FARBE}`, background: 'transparent', color: FARBE, fontSize: '12.5px', fontWeight: 700, cursor: ladenAlle ? 'default' : 'pointer', opacity: ladenAlle ? 0.6 : 1 }}
            >{ladenAlle ? 'Erkenne …' : '🔍 Alle erkennen'}</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {dateien.map(d => (
              <DateiKarte
                key={d.id}
                datei={d}
                ergebnis={ergebnisse[d.id]}
                onErkennen={() => dateiErkennen(d)}
                fmtGroesse={fmtGroesse}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Eine Datei-Zeile mit Erkennungs-Ergebnis ──────────────────────────────────
function DateiKarte({ datei, ergebnis, onErkennen, fmtGroesse }) {
  const status = ergebnis?.status
  const sk = SICHERHEIT_STIL[ergebnis?.sicherheit] ?? null

  return (
    <div style={{ borderRadius: '11px', border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
      {/* Kopf */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 15px' }}>
        <span style={{ fontSize: '18px' }} aria-hidden="true">📄</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{datei.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmtGroesse(datei.size)}{ergebnis?.seiten ? ` · ${ergebnis.seiten} Seite(n)` : ''}</div>
        </div>
        {sk && (
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px', background: sk.bg, color: sk.farbe }}>{sk.label}</span>
        )}
        {status !== 'laden' && (
          <button
            onClick={onErkennen}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >{status ? 'Neu' : 'Erkennen'}</button>
        )}
      </div>

      {/* Ergebnis */}
      {status === 'laden' && (
        <div style={{ padding: '0 15px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>Lese Text &amp; erkenne …</div>
      )}
      {status === 'fehler' && (
        <div style={{ padding: '0 15px 12px', fontSize: '12px', color: '#b91c1c' }}>Fehler: {ergebnis.fehler}</div>
      )}
      {status === 'bildscan' && (
        <div style={{ padding: '0 15px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Kein Textlayer gefunden – vermutlich ein reiner Bild-Scan. Die Texterkennung (OCR)
          folgt in der nächsten Ausbaustufe.
        </div>
      )}
      {status === 'fertig' && (
        <div style={{ padding: '0 15px 14px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {/* Typ + Kennungen */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <Chip label={`Typ: ${ergebnis.typ?.typ ?? 'Unbekannt'}`} />
            {ergebnis.kennungen?.datumse?.[0] && <Chip label={`Datum: ${ergebnis.kennungen.datumse[0]}`} />}
            {ergebnis.kennungen?.ibans?.map(i => <Chip key={i} label={`IBAN ${maskiereIban(i)}`} mono />)}
            {ergebnis.kennungen?.ustIds?.map(u => <Chip key={u} label={`USt-IdNr. ${u}`} mono />)}
            {ergebnis.kennungen?.steuernummern?.map(s => <Chip key={s} label="Steuernummer erkannt" />)}
          </div>

          {/* Zuordnung */}
          {ergebnis.besterTreffer ? (
            <div style={{ fontSize: '12.5px', color: 'var(--text)' }}>
              → Zuordnung: <strong>{ergebnis.besterTreffer.name}</strong>
              {ergebnis.besterTreffer.mandantennummer ? ` (${ergebnis.besterTreffer.mandantennummer})` : ''}
              <span style={{ color: 'var(--text-muted)' }}> · {ergebnis.besterTreffer.gruende.join(', ')}</span>
            </div>
          ) : ergebnis.kandidaten?.length > 0 ? (
            <div style={{ fontSize: '12.5px', color: 'var(--text)' }}>
              → <strong>Bitte prüfen</strong> – mehrere/unsichere Kandidaten:
              <ul style={{ margin: '4px 0 0', paddingLeft: '18px', color: 'var(--text-muted)' }}>
                {ergebnis.kandidaten.slice(0, 3).map(k => (
                  <li key={k.clientId}>{k.name}{k.mandantennummer ? ` (${k.mandantennummer})` : ''} – {k.gruende.join(', ')}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>→ Kein Mandant zugeordnet – bitte manuell auswählen.</div>
          )}
        </div>
      )}
    </div>
  )
}

function Chip({ label, mono }) {
  return (
    <span style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '8px', background: 'var(--surface2)', color: 'var(--text-muted)', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>{label}</span>
  )
}
