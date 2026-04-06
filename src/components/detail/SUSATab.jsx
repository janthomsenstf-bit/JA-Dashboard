import { useState, useRef, useCallback } from 'react'
import { parseSUSAFile } from '../../utils/susaParser.js'
import {
  erkenneKontorahmen,
  klassifiziereKonto,
  getBereichLabel,
  getBereiche,
  fmtEuro,
} from '../../utils/susaMapping.js'

// ── Status-Konfiguration ──────────────────────────────────────────────────────
const STATUS_CFG = {
  ungeprueft:     { label: 'Ungep.',       color: 'var(--text-muted)',   bg: 'var(--surface3)' },
  geprueft:       { label: '✓ Geprüft',   color: 'var(--green)',        bg: 'var(--green-dim)' },
  nicht_relevant: { label: '— Irrelevant', color: 'var(--text-muted)',   bg: 'var(--surface2)' },
  rueckfrage:     { label: '? Rückfrage',  color: 'var(--orange)',       bg: 'var(--orange-dim)' },
}

const STATUS_OPTS = ['ungeprueft', 'geprueft', 'nicht_relevant', 'rueckfrage']

// ── Inline-editable Notiz / Umbuchung (debounced) ────────────────────────────
function InlineInput({ value, placeholder, onSave, mono }) {
  const [local, setLocal] = useState(value ?? '')
  const timer = useRef(null)
  function onChange(e) {
    setLocal(e.target.value)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onSave(e.target.value), 600)
  }
  return (
    <input
      type="text"
      className={`susa-inline-input${mono ? ' mono' : ''}`}
      value={local}
      placeholder={placeholder}
      onChange={onChange}
      onBlur={() => { clearTimeout(timer.current); onSave(local) }}
    />
  )
}

// ── Konten-Zeile ──────────────────────────────────────────────────────────────
function KontoRow({ konto, onUpdate }) {
  const st = STATUS_CFG[konto.status] ?? STATUS_CFG.ungeprueft

  return (
    <tr className={`susa-row susa-status-${konto.status}`}>
      <td className="susa-td-nr mono">{konto.kontonr}</td>
      <td className="susa-td-bez">{konto.bezeichnung || '–'}</td>
      <td className="susa-td-saldo mono" style={{ textAlign: 'right' }}>
        {fmtEuro(konto.saldo)}
      </td>
      <td className="susa-td-sh">
        <span className={`susa-shkz susa-shkz-${konto.shkz?.toLowerCase()}`}>
          {konto.shkz ?? '–'}
        </span>
      </td>
      <td className="susa-td-status">
        <select
          className="susa-status-select"
          value={konto.status}
          style={{ color: st.color, background: st.bg }}
          onChange={e => onUpdate(konto.kontonr, { status: e.target.value })}
        >
          {STATUS_OPTS.map(s => (
            <option key={s} value={s}>{STATUS_CFG[s].label}</option>
          ))}
        </select>
      </td>
      <td className="susa-td-notiz">
        <InlineInput
          value={konto.notiz}
          placeholder="Notiz…"
          onSave={v => onUpdate(konto.kontonr, { notiz: v })}
        />
      </td>
      <td className="susa-td-umbuchung">
        <InlineInput
          value={konto.umbuchung}
          placeholder="Umbuchung / JA-Buchung…"
          onSave={v => onUpdate(konto.kontonr, { umbuchung: v })}
          mono
        />
      </td>
    </tr>
  )
}

// ── Abschnitts-Tabelle ────────────────────────────────────────────────────────
function SUSASection({ titel, konten, onUpdate, showZero, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const visible = showZero ? konten : konten.filter(k => k.saldo !== 0)
  const summe   = konten.reduce((s, k) => s + Math.abs(k.saldo ?? 0), 0)
  const offen   = konten.filter(k => k.status === 'ungeprueft' && k.saldo !== 0).length
  const rqCount = konten.filter(k => k.status === 'rueckfrage').length

  if (konten.length === 0) return null

  return (
    <div className="susa-section">
      <button className="susa-section-header" onClick={() => setOpen(o => !o)}>
        <span className="susa-section-chevron">{open ? '▼' : '▶'}</span>
        <span className="susa-section-titel">{titel}</span>
        <span className="susa-section-meta">
          <span className="badge badge-muted">{visible.length} Konten</span>
          <span className="susa-section-summe">{fmtEuro(summe)}</span>
          {offen > 0  && <span className="badge badge-orange">{offen} ungep.</span>}
          {rqCount > 0 && <span className="badge badge-red">{rqCount} RQ</span>}
        </span>
      </button>

      {open && (
        <div className="susa-table-wrap">
          <table className="susa-table">
            <thead>
              <tr>
                <th className="susa-th-nr">Konto-Nr.</th>
                <th className="susa-th-bez">Bezeichnung</th>
                <th className="susa-th-saldo">Saldo</th>
                <th className="susa-th-sh">SH</th>
                <th className="susa-th-status">Status</th>
                <th className="susa-th-notiz">Notiz</th>
                <th className="susa-th-umbuchung">Umbuchung / JA-Buchung</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    Alle Konten mit Saldo 0 (Anzeige aktivieren mit „Nullsalden zeigen")
                  </td>
                </tr>
              )}
              {visible.map(k => (
                <KontoRow key={k.kontonr} konto={k} onUpdate={onUpdate} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function SUSATab({ client, onUpdate }) {
  const susa    = client.susa ?? {}
  const konten  = susa.konten ?? []
  const hasData = konten.length > 0

  // Pending-Zustand: Datei eingelesen, aber Typ noch nicht gewählt
  const [pending, setPending]           = useState(null) // { konten, detectedKR }
  const [pendingKR, setPendingKR]       = useState('skr03')
  const [uploading, setUploading]       = useState(false)
  const [parseError, setParseError]     = useState('')
  const [showZero, setShowZero]         = useState(false)
  const [dragOver, setDragOver]         = useState(false)
  const fileRef                         = useRef(null)

  // ── Datei verarbeiten ────────────────────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return
    setUploading(true)
    setParseError('')
    const { konten: raw, error } = await parseSUSAFile(file)
    setUploading(false)

    if (error) { setParseError(error); return }

    const detectedKR = erkenneKontorahmen(raw)
    setPending({ konten: raw, dateiname: file.name, detectedKR })
    setPendingKR(detectedKR)
  }

  function onFileInput(e) {
    handleFile(e.target.files?.[0])
    e.target.value = ''
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  // ── Typ bestätigen: EÜR oder Bilanz ──────────────────────────────────────────
  function confirmImport(typ) {
    if (!pending) return

    // Klassifiziere alle Konten (erste Ziffer der Kontonummer, kontorahmen-aware)
    const klassifiziert = pending.konten.map(k => ({
      ...k,
      bereich: klassifiziereKonto(k.kontonr, pendingKR),
    }))

    // Falls es bereits Daten gibt: Notizen/Status für bekannte Konten erhalten
    const altMap = Object.fromEntries(konten.map(k => [k.kontonr, k]))
    const merged = klassifiziert.map(k => ({
      ...k,
      status:    altMap[k.kontonr]?.status    ?? k.status,
      notiz:     altMap[k.kontonr]?.notiz     ?? k.notiz,
      umbuchung: altMap[k.kontonr]?.umbuchung ?? k.umbuchung,
    }))

    onUpdate({
      susa: {
        typ,
        kontorahmen: pendingKR,
        konten: merged,
        importDatum: new Date().toISOString().slice(0, 10),
        dateiname: pending.dateiname,
      },
    })
    setPending(null)
  }

  // ── Einzelnes Konto aktualisieren ────────────────────────────────────────────
  const updateKonto = useCallback((kontonr, patch) => {
    const newKonten = konten.map(k => k.kontonr === kontonr ? { ...k, ...patch } : k)
    onUpdate({ susa: { ...susa, konten: newKonten } })
  }, [konten, susa, onUpdate])

  // ── Konten nach Bereich filtern (live klassifiziert nach Kontorahmen) ─────────
  // Nutzt klassifiziereKonto() on-the-fly, damit auch ältere importierte Daten
  // mit veralteten bereich-Werten korrekt in die Abschnitte einsortiert werden.
  function byBereich(bereich) {
    return konten.filter(k => klassifiziereKonto(k.kontonr, susa.kontorahmen) === bereich)
  }

  // ── Statistik ────────────────────────────────────────────────────────────────
  const geprueft     = konten.filter(k => k.status === 'geprueft').length
  const mitRQ        = konten.filter(k => k.status === 'rueckfrage').length
  const nichtRel     = konten.filter(k => k.status === 'nicht_relevant').length
  const ungeprueft   = konten.filter(k => k.status === 'ungeprueft' && k.saldo !== 0).length
  const total        = konten.filter(k => k.saldo !== 0).length

  // ── Render: Upload-Zone ───────────────────────────────────────────────────────
  if (!hasData && !pending) {
    return (
      <div className="tab-content">
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>SUSA-Import</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
            Summen- und Saldenliste importieren, strukturieren und dokumentieren
          </div>
        </div>

        <div
          className={`susa-upload-zone${dragOver ? ' dragover' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <div className="susa-upload-icon">📊</div>
          <div className="susa-upload-title">
            {uploading ? 'Einlesen…' : 'Excel oder CSV hochladen'}
          </div>
          <div className="susa-upload-hint">
            .xlsx · .csv · Datei hier ablegen oder klicken
          </div>
          {parseError && (
            <div style={{ marginTop: '12px', color: 'var(--red)', fontSize: '12px' }}>{parseError}</div>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={onFileInput} />

        <div className="section-card" style={{ marginTop: '16px' }}>
          <div className="section-card-title">Hinweise zum Dateiformat</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <p>Die SUSA wird automatisch auf <strong>SKR03 oder SKR04</strong> analysiert und strukturiert.</p>
            <p style={{ marginTop: '8px' }}>Benötigte Spalten (Fuzzy-Erkennung): <span className="mono">Kontonummer · Bezeichnung · Saldo · SH-Kennzeichen</span></p>
            <p style={{ marginTop: '8px' }}>Typische DATEV-Exporte werden direkt erkannt. Bei Sonderlayouts die Spaltenbezeichnungen prüfen.</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: EÜR / Bilanz-Auswahl ─────────────────────────────────────────────
  if (pending) {
    const krLabel = pendingKR === 'skr04' ? 'SKR04' : 'SKR03'
    const auto    = pending.detectedKR === pendingKR
    return (
      <div className="tab-content">
        <div className="section-card">
          <div className="section-card-title">✓ Datei eingelesen</div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', marginBottom: '12px' }}>
            <span>📄 <strong>{pending.dateiname}</strong></span>
            <span>🔢 <strong>{pending.konten.length}</strong> Konten erkannt</span>
            <span>
              📋 Kontenrahmen:{' '}
              <select
                value={pendingKR}
                onChange={e => setPendingKR(e.target.value)}
                style={{ marginLeft: '4px', fontSize: '12px', padding: '2px 6px' }}
              >
                <option value="skr03">SKR03{auto && pendingKR === 'skr03' ? ' (automatisch erkannt)' : ''}</option>
                <option value="skr04">SKR04{auto && pendingKR === 'skr04' ? ' (automatisch erkannt)' : ''}</option>
              </select>
            </span>
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-title" style={{ fontSize: '14px' }}>
            Handelt es sich um eine EÜR oder einen Bilanzierer?
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Die Auswahl bestimmt die Gliederung: EÜR zeigt nur die GuV-Übersicht, Bilanzierer zusätzlich die vollständige Bilanzstruktur.
          </p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <button
              className="susa-typ-btn"
              onClick={() => confirmImport('euer')}
            >
              <div className="susa-typ-icon">📝</div>
              <div className="susa-typ-label">EÜR</div>
              <div className="susa-typ-desc">Einnahmenüberschussrechnung</div>
              <div className="susa-typ-sub">Nur Betriebseinnahmen &amp; Betriebsausgaben</div>
            </button>
            <button
              className="susa-typ-btn"
              onClick={() => confirmImport('bilanz')}
            >
              <div className="susa-typ-icon">📊</div>
              <div className="susa-typ-label">Bilanzierer</div>
              <div className="susa-typ-desc">GuV + vollständige Bilanz</div>
              <div className="susa-typ-sub">Aktiva · Passiva · Gewinn- und Verlustrechnung</div>
            </button>
          </div>
          <div style={{ marginTop: '16px' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPending(null)}>
              ← Abbrechen
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render: Hauptansicht ─────────────────────────────────────────────────────
  const typ = susa.typ ?? 'bilanz'
  const kr  = susa.kontorahmen === 'skr04' ? 'SKR04' : 'SKR03'

  return (
    <div className="tab-content">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>
            SUSA
            <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>
              {typ === 'euer' ? 'EÜR' : 'Bilanzierer'} · {kr} · {susa.importDatum ?? ''}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
            {susa.dateiname} · {konten.length} Konten
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showZero} onChange={e => setShowZero(e.target.checked)} />
            Nullsalden zeigen
          </label>
          <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
            📂 Neu importieren
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={onFileInput} />
        </div>
      </div>

      {/* Statistik-Leiste */}
      <div className="susa-stats-bar">
        <div className="susa-stat">
          <span className="susa-stat-val">{total}</span>
          <span className="susa-stat-lbl">Konten gesamt</span>
        </div>
        <div className="susa-stat susa-stat-green">
          <span className="susa-stat-val">{geprueft}</span>
          <span className="susa-stat-lbl">Geprüft</span>
        </div>
        <div className="susa-stat susa-stat-orange">
          <span className="susa-stat-val">{ungeprueft}</span>
          <span className="susa-stat-lbl">Ungepüft</span>
        </div>
        <div className="susa-stat susa-stat-red">
          <span className="susa-stat-val">{mitRQ}</span>
          <span className="susa-stat-lbl">Rückfragen</span>
        </div>
        <div className="susa-stat">
          <span className="susa-stat-val">{nichtRel}</span>
          <span className="susa-stat-lbl">Irrelevant</span>
        </div>
      </div>

      {/* ── EÜR-Ansicht ──────────────────────────────────────────────────── */}
      {typ === 'euer' && (
        <>
          <div className="susa-gruppe-header">Gewinn- und Verlustübersicht (EÜR)</div>
          {getBereiche('euer', susa.kontorahmen).map(b => (
            <SUSASection
              key={b}
              titel={getBereichLabel(b, susa.kontorahmen)}
              konten={byBereich(b)}
              onUpdate={updateKonto}
              showZero={showZero}
              defaultOpen={b !== 'sonstige'}
            />
          ))}
        </>
      )}

      {/* ── Bilanz-Ansicht ────────────────────────────────────────────────── */}
      {typ === 'bilanz' && (
        <>
          {/* GuV */}
          <div className="susa-gruppe-header">Gewinn- und Verlustrechnung</div>
          {getBereiche('guv', susa.kontorahmen).map(b => (
            <SUSASection
              key={b}
              titel={getBereichLabel(b, susa.kontorahmen)}
              konten={byBereich(b)}
              onUpdate={updateKonto}
              showZero={showZero}
            />
          ))}

          {/* Bilanz Aktiva */}
          <div className="susa-gruppe-header">Bilanz – Aktiva</div>
          {getBereiche('aktiva', susa.kontorahmen).map(b => (
            <SUSASection
              key={b}
              titel={getBereichLabel(b, susa.kontorahmen)}
              konten={byBereich(b)}
              onUpdate={updateKonto}
              showZero={showZero}
            />
          ))}

          {/* Bilanz Passiva */}
          <div className="susa-gruppe-header">Bilanz – Passiva</div>
          {getBereiche('passiva', susa.kontorahmen).map(b => (
            <SUSASection
              key={b}
              titel={getBereichLabel(b, susa.kontorahmen)}
              konten={byBereich(b)}
              onUpdate={updateKonto}
              showZero={showZero}
            />
          ))}

          {/* Sonstige / Statistik (Klasse 9) */}
          {byBereich('sonstige').length > 0 && (
            <>
              <div className="susa-gruppe-header">Sonstige / Statistik</div>
              <SUSASection
                titel={getBereichLabel('sonstige', susa.kontorahmen)}
                konten={byBereich('sonstige')}
                onUpdate={updateKonto}
                showZero={showZero}
                defaultOpen={false}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
