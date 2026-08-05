import { useState } from 'react'

/*
 * JAChecklisteV2 – neue Jahresabschluss-Checkliste (Fachanwendung im JA-Auftrag).
 * Phase 1: Bereichsmenü (BE/BA/Aktiva/Passiva je nach Gewinnermittlung) + Module
 * an-/abwählen. Alle Daten liegen ADDITIV am Auftrag unter `au.jaChecklisteV2`
 * und werden über den bestehenden onUpdate-Pfad (→ Supabase) gespeichert.
 * Bestehende Auftragsdaten werden nicht angefasst.
 */

const BEREICH_LABEL = { be: 'Betriebseinnahmen', ba: 'Betriebsausgaben', aktiva: 'Aktiva', passiva: 'Passiva' }
const BEREICH_FARBE = { be: '#16a34a', ba: '#ef4444', aktiva: '#2563eb', passiva: '#7c3aed' }

const STATUS = {
  offen:  ['Offen',       '#94a3b8'],
  arbeit: ['In Arbeit',   '#f59e0b'],
  rueck:  ['Rückfrage',   '#a855f7'],
  ok:     ['Erledigt',    '#16a34a'],
  korr:   ['Korrektur',   '#ef4444'],
}

// Modul-Katalog (Phase 1 – Auswahl; volle Fachlogik folgt in Phase 2+)
const KATALOG = {
  be: [
    ['erloeseStpfl',      'Steuerpflichtige Erlöse (19 %)',       'C'],
    ['erloeseErmaessigt', 'Erlöse mit ermäßigtem Steuersatz (7 %)','C'],
    ['erloeseSteuerfrei', 'Steuerfreie Erlöse',                    'C'],
    ['erloeseAusfuhr',    'Steuerfreie Umsätze (Ausfuhr / ig. Lief.)','C'],
    ['erloese13b',        'Erlöse mit Steuerschuldumkehr (§ 13b)', 'C'],
    ['sachentnahme',      'Sachentnahmen Gastronomie',             'A'],
  ],
  ba: [
    ['kfz1prozent', 'Private Kfz-Nutzung (1-%-Methode)', 'C'],
    ['telefon',     'Private Telefonnutzung',            'A'],
    ['bewirtung',   'Bewirtungsaufwendungen',            'C'],
    ['rap',         'Rechnungsabgrenzung',               'C'],
    ['geschenke',   'Geschenke (35-€-Grenze)',           'A'],
  ],
  aktiva: [
    ['anlagevermoegen', 'Anlagevermögen',                'C'],
    ['forderungen',     'Forderungen aus L&L',           'C'],
    ['warenbestand',    'Warenbestand / Vorräte',        'C'],
    ['bank',            'Bankguthaben',                  'B'],
    ['kasse',           'Kassenbestand',                 'B'],
  ],
  passiva: [
    ['darlehen',          'Darlehen',                    'C'],
    ['verbindlichkeiten', 'Verbindlichkeiten',           'C'],
    ['rueckstellungen',   'Rückstellungen',              'C'],
    ['kapital',           'Eigenkapital',                'C'],
  ],
}

let _uid = 0
const uid = () => 'jc' + Date.now().toString(36) + (++_uid)

export default function JAChecklisteV2({ au, client, onUpdate }) {
  const gwRaw    = String(au?.gewinnermittlung || client?.gewinnermittlung || '').toLowerCase()
  const isBilanz = gwRaw.includes('ilanz')                 // "Bilanz" / "Bilanzierung"
  const bereiche = isBilanz ? ['be', 'ba', 'aktiva', 'passiva'] : ['be', 'ba']

  const data   = au?.jaChecklisteV2 && typeof au.jaChecklisteV2 === 'object' ? au.jaChecklisteV2 : { v: 1, punkte: [] }
  const punkte = Array.isArray(data.punkte) ? data.punkte : []

  const [view, setView]             = useState(bereiche[0])
  const [pickerOpen, setPickerOpen] = useState(false)

  const activeView = bereiche.includes(view) ? view : bereiche[0]

  const save        = (next) => onUpdate({ jaChecklisteV2: { ...data, v: 1, punkte: next } })
  const patchPunkt  = (id, patch) => save(punkte.map(p => p.id === id ? { ...p, ...patch } : p))
  const removePunkt = (id) => save(punkte.filter(p => p.id !== id))
  const addModul    = (m) => {
    if (punkte.some(p => p.modul === m[0] && p.bereich === activeView)) return
    save([...punkte, { id: uid(), bereich: activeView, modul: m[0], titel: m[1], typ: m[2], status: 'offen', werte: {} }])
    setPickerOpen(false)
  }

  const shown       = punkte.filter(p => p.bereich === activeView)
  const vorhandenIds = new Set(shown.map(p => p.modul))
  const gesamt      = punkte.length
  const erledigt    = punkte.filter(p => p.status === 'ok').length

  return (
    <div style={{ marginTop: '4px' }}>

      {/* Kopf / Fortschritt */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Jahresabschluss-Checkliste
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {gesamt} Prüfpunkt(e) · {erledigt} erledigt · {isBilanz ? 'Bilanz' : 'EÜR'}
        </span>
      </div>

      {/* Bereichs-Menü */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', marginBottom: '14px' }}>
        {bereiche.map(b => {
          const on  = b === activeView
          const cnt = punkte.filter(p => p.bereich === b).length
          return (
            <button key={b}
              onClick={() => { setView(b); setPickerOpen(false) }}
              style={{
                padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 700, marginBottom: '-1px',
                color: on ? BEREICH_FARBE[b] : 'var(--text-muted)',
                borderBottom: on ? `2px solid ${BEREICH_FARBE[b]}` : '2px solid transparent',
              }}>
              {BEREICH_LABEL[b]}{cnt > 0 && <span style={{ fontSize: '11px', opacity: 0.7 }}> · {cnt}</span>}
            </button>
          )
        })}
      </div>

      {/* Module des aktiven Bereichs */}
      {shown.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px 0' }}>
          Noch keine Module in „{BEREICH_LABEL[activeView]}". Füge unten ein Modul hinzu.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {shown.map(p => (
            <PunktCard key={p.id} p={p}
              onStatus={s => patchPunkt(p.id, { status: s })}
              onNotiz={n => patchPunkt(p.id, { werte: { ...(p.werte || {}), notiz: n } })}
              onRemove={() => removePunkt(p.id)} />
          ))}
        </div>
      )}

      {/* Modul hinzufügen */}
      {pickerOpen ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', background: 'var(--surface2)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
            Modul für „{BEREICH_LABEL[activeView]}" wählen
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {(KATALOG[activeView] || []).map(m => {
              const drin = vorhandenIds.has(m[0])
              return (
                <button key={m[0]} disabled={drin} onClick={() => addModul(m)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
                    padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)',
                    background: drin ? 'rgba(22,163,74,0.06)' : 'var(--surface)',
                    color: 'var(--text)', cursor: drin ? 'default' : 'pointer', fontSize: '13px', textAlign: 'left',
                  }}>
                  <span>{m[1]} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>· Typ {m[2]}</span></span>
                  <span style={{ fontSize: '12px', color: drin ? '#16a34a' : 'var(--accent)', fontWeight: 700 }}>{drin ? '✓ drin' : '+ hinzufügen'}</span>
                </button>
              )
            })}
          </div>
          <button onClick={() => setPickerOpen(false)}
            style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Schließen
          </button>
        </div>
      ) : (
        <button onClick={() => setPickerOpen(true)}
          style={{ fontSize: '13px', fontWeight: 700, padding: '8px 14px', borderRadius: '7px', border: `1px solid ${BEREICH_FARBE[activeView]}55`, background: `${BEREICH_FARBE[activeView]}0d`, color: BEREICH_FARBE[activeView], cursor: 'pointer' }}>
          + Modul hinzufügen
        </button>
      )}

      <div style={{ marginTop: '14px', fontSize: '10.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Phase 1: Grundgerüst. Die vollständige Fachlogik (Konten, SuSa-Import, Darlehen, Assistent, Excel-Export) folgt in den nächsten Schritten. Alles wird additiv am Auftrag gespeichert.
      </div>
    </div>
  )
}

function PunktCard({ p, onStatus, onNotiz, onRemove }) {
  const st = STATUS[p.status] || STATUS.offen
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '9px', padding: '11px 13px', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: st[1], flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}>
          {p.titel} <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>· Typ {p.typ}</span>
        </span>
        <select value={p.status} onChange={e => onStatus(e.target.value)}
          style={{ fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}>
          {Object.keys(STATUS).map(s => <option key={s} value={s}>{STATUS[s][0]}</option>)}
        </select>
        <button onClick={onRemove} title="Modul entfernen"
          style={{ fontSize: '15px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          🗑
        </button>
      </div>
      <textarea defaultValue={(p.werte || {}).notiz || ''} onBlur={e => onNotiz(e.target.value)}
        placeholder="Notiz / Bearbeitungsvermerk…"
        style={{ width: '100%', marginTop: '9px', minHeight: '42px', boxSizing: 'border-box', resize: 'vertical',
          fontSize: '13px', padding: '7px 9px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', font: 'inherit' }} />
    </div>
  )
}
