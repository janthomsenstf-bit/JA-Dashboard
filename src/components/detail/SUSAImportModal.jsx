import { useState, useMemo } from 'react'
import { klassifiziereKonto } from '../../utils/susaMapping.js'

// ── Bereich → Schlagwörter für Fuzzy-Matching auf Abschnittsnames ─────────────
// Deckt alle Bereich-Codes aus SKR03 und SKR04 ab.
const BEREICH_KEYWORDS = {
  // Aktiva
  anlage:            ['anlage', 'anlagevermögen', 'aktiva', 'abschreibung', 'sachanlagen'],
  umlauf:            ['umlauf', 'forderung', 'bank', 'kasse', 'liqui', 'vorrat', 'bestände'],
  // Passiva (SKR03 zusammengefasst, SKR04 aufgeteilt)
  passiva:           ['passiva', 'eigenkapital', 'kapital', 'rücklage', 'verbindlichkeit', 'rückstellung', 'fremdkapital'],
  eigenkapital:      ['eigenkapital', 'kapital', 'rücklage'],
  verbindlichkeiten: ['verbindlichkeit', 'rückstellung', 'passiva', 'fremdkapital', 'darlehen'],
  // GuV Aufwand SKR03
  wareneingang:      ['waren', 'wareneingang', 'einkauf', 'bestände', 'material', 'wareneinsatz'],
  betriebAufwand:    ['betrieblich', 'aufwand', 'kosten', 'raumkosten', 'kfz', 'reise'],
  // GuV Aufwand (beide KR)
  material:          ['material', 'wareneinsatz', 'roh', 'hilfs', 'betriebsstoff'],
  personal:          ['personal', 'lohn', 'gehalt', 'arbeit', 'sozial'],
  sonstAufwand:      ['aufwand', 'kosten', 'sonstig', 'abschreibung', 'betriebs'],
  // GuV Ertrag SKR03
  finanzertrag:      ['finanzerträge', 'finanz', 'zins', 'beteiligung', 'ertrag'],
  umsatz:            ['umsatz', 'erlös', 'einnahmen', 'leistung'],
  // GuV Ertrag SKR04
  ertraege:          ['einnahmen', 'ertrag', 'umsatz', 'erlös', 'einnahme', 'leistung'],
  // GuV Finanzergebnis SKR04
  finanzergebnis:    ['finanz', 'zins', 'darlehen', 'kredit', 'steuer'],
  // Sonstige
  sonstige:          ['sonstig', 'statistik', 'abschluss'],
}

const BEREICH_LABELS = {
  // SKR03
  passiva:           'Eigenkapital / Rückstellungen / Verbindlichkeiten',
  wareneingang:      'Wareneingang / Bestände',
  betriebAufwand:    'Betriebliche Aufwendungen',
  finanzertrag:      'Finanzerträge / neutrale Erträge',
  umsatz:            'Erlöse / Umsatzerlöse',
  // SKR04
  eigenkapital:      'Eigenkapital',
  verbindlichkeiten: 'Rückstellungen / Verbindlichkeiten',
  ertraege:          'Betriebliche Erträge / Umsätze',
  finanzergebnis:    'Finanzergebnis / Steuern',
  // Gemeinsam
  anlage:            'Anlagevermögen',
  umlauf:            'Umlaufvermögen',
  material:          'Material / Wareneinsatz',
  personal:          'Personalaufwand',
  sonstAufwand:      'Sonstige Aufwendungen',
  sonstige:          'Sonstige / Statistik',
}

function guessSection(bereich, sections) {
  const keywords = BEREICH_KEYWORDS[bereich] ?? []
  for (const kw of keywords) {
    const match = sections.find(s => (s.text ?? '').toLowerCase().includes(kw))
    if (match) return match.id
  }
  return null
}

function fmtEuro(val) {
  if (val == null || isNaN(val)) return '–'
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
}

function genExtraId() {
  return 'ex' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

export default function SUSAImportModal({ konten, kontorahmen, checklistenTyp, existingExtras, onImport, onClose }) {
  const sections = useMemo(
    () => (checklistenTyp?.items ?? []).filter(it => (it.type ?? 'item') === 'section'),
    [checklistenTyp]
  )

  // Already imported kontonr values
  const alreadyImportedNrs = useMemo(
    () => new Set((existingExtras ?? []).filter(e => e.source === 'susa').map(e => e.kontonr)),
    [existingExtras]
  )

  // Build initial row state
  const initialRows = useMemo(() => {
    const withSaldo = konten.filter(k => k.saldo !== 0)
    return withSaldo.map(k => {
      // Kontorahmen-aware Klassifizierung; gespeicherter bereich als Fallback
      const bereich    = klassifiziereKonto(k.kontonr, kontorahmen)
      const sectionId  = sections.length > 0 ? (guessSection(bereich, sections) ?? '__unassigned') : '__unassigned'
      const isImported = alreadyImportedNrs.has(String(k.kontonr))
      return {
        kontonr:       String(k.kontonr ?? ''),
        bezeichnung:   k.bezeichnung ?? '',
        saldo:         k.saldo ?? 0,
        shkz:          k.shkz ?? '',
        bereich,
        sectionId,
        checked:       !isImported && sectionId !== '__unassigned',
        isImported,
      }
    })
  }, [konten, kontorahmen, sections, alreadyImportedNrs])

  const [rows, setRows]         = useState(initialRows)
  const [searchText, setSearch] = useState('')

  function updateRow(kontonr, patch) {
    setRows(prev => prev.map(r => r.kontonr === kontonr ? { ...r, ...patch } : r))
  }

  function toggleAllAssigned(checked) {
    setRows(prev => prev.map(r =>
      r.isImported || r.sectionId === '__unassigned' ? r : { ...r, checked }
    ))
  }

  const assigned   = rows.filter(r => r.sectionId !== '__unassigned')
  const unassigned = rows.filter(r => r.sectionId === '__unassigned')
  const selected   = rows.filter(r => r.checked && !r.isImported)

  const filteredAssigned   = searchText ? assigned.filter(r => r.kontonr.includes(searchText) || r.bezeichnung.toLowerCase().includes(searchText.toLowerCase())) : assigned
  const filteredUnassigned = searchText ? unassigned.filter(r => r.kontonr.includes(searchText) || r.bezeichnung.toLowerCase().includes(searchText.toLowerCase())) : unassigned

  function handleImport() {
    const newExtras = []
    for (const r of rows) {
      if (!r.checked || r.isImported || r.sectionId === '__unassigned') continue
      newExtras.push({
        id:          genExtraId(),
        type:        'item',
        text:        `${r.kontonr} – ${r.bezeichnung}`.trim(),
        description: `Saldo: ${fmtEuro(r.saldo)} ${r.shkz}`.trim(),
        anlage:      null,
        kontonr:     r.kontonr,
        source:      'susa',
        sectionId:   r.sectionId,
      })
    }
    onImport(newExtras)
  }

  function SectionSelect({ row }) {
    return (
      <select
        className="susa-import-section-select"
        value={row.sectionId}
        onChange={e => {
          const sectionId = e.target.value
          updateRow(row.kontonr, {
            sectionId,
            checked: sectionId !== '__unassigned' && !row.isImported,
          })
        }}
      >
        <option value="__unassigned">– Abschnitt wählen –</option>
        {sections.map(s => (
          <option key={s.id} value={s.id}>{s.text}</option>
        ))}
      </select>
    )
  }

  function RowComponent({ r }) {
    return (
      <tr key={r.kontonr} className={r.isImported ? 'susa-import-row-done' : r.sectionId === '__unassigned' ? 'susa-import-row-unassigned' : ''}>
        <td style={{ textAlign: 'center' }}>
          <input
            type="checkbox"
            checked={r.checked}
            disabled={r.isImported || r.sectionId === '__unassigned'}
            onChange={e => updateRow(r.kontonr, { checked: e.target.checked })}
          />
        </td>
        <td className="mono susa-import-td-nr">{r.kontonr}</td>
        <td className="susa-import-td-bez">{r.bezeichnung || '–'}</td>
        <td className="mono susa-import-td-saldo">{fmtEuro(r.saldo)}</td>
        <td className="susa-import-td-sec">
          {r.isImported ? (
            <span style={{ fontSize: '11px', color: 'var(--green)' }}>✓ Bereits importiert</span>
          ) : (
            <SectionSelect row={r} />
          )}
        </td>
        <td className="susa-import-td-info" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {BEREICH_LABELS[r.bereich] ?? r.bereich}
        </td>
      </tr>
    )
  }

  const noSections = sections.length === 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box susa-import-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>📊 SUSA-Konten in Checkliste importieren</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="susa-import-body">

          {noSections && (
            <div className="susa-import-warning">
              ⚠ Diese Checkliste hat keine Abschnitte. Bitte zuerst Abschnitte (§) in der Checklistenverwaltung anlegen, um Konten zuzuordnen.
            </div>
          )}

          {/* Stats bar */}
          <div className="susa-import-stats">
            <span className="susa-import-stat">{rows.length} Konten mit Saldo</span>
            <span className="susa-import-stat susa-import-stat-green">{assigned.length} zugeordnet</span>
            {unassigned.length > 0 && (
              <span className="susa-import-stat susa-import-stat-orange">{unassigned.length} noch zuzuordnen</span>
            )}
            <span className="susa-import-stat susa-import-stat-blue">{selected.length} ausgewählt</span>
            <input
              className="form-input"
              style={{ marginLeft: 'auto', width: '160px', fontSize: '12px', padding: '4px 8px' }}
              placeholder="Suchen …"
              value={searchText}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Zugeordnete Konten */}
          {filteredAssigned.length > 0 && (
            <div className="susa-import-group">
              <div className="susa-import-group-header">
                <span>Zugeordnete Konten</span>
                <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={assigned.filter(r => !r.isImported).every(r => r.checked)}
                    onChange={e => toggleAllAssigned(e.target.checked)}
                  />
                  Alle
                </label>
              </div>
              <div className="susa-import-table-wrap">
                <table className="susa-import-table">
                  <thead>
                    <tr>
                      <th style={{ width: '32px' }}>☑</th>
                      <th>Konto</th>
                      <th>Bezeichnung</th>
                      <th>Saldo</th>
                      <th>Checklisten-Abschnitt</th>
                      <th>SUSA-Bereich</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssigned.map(r => <RowComponent key={r.kontonr} r={r} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Noch zuzuordnen */}
          {filteredUnassigned.length > 0 && (
            <div className="susa-import-group">
              <div className="susa-import-group-header susa-import-group-header-warn">
                ⚠ Noch zuzuordnen ({filteredUnassigned.length} Konten)
              </div>
              <div className="susa-import-table-wrap">
                <table className="susa-import-table">
                  <thead>
                    <tr>
                      <th style={{ width: '32px' }}>☑</th>
                      <th>Konto</th>
                      <th>Bezeichnung</th>
                      <th>Saldo</th>
                      <th>Abschnitt wählen</th>
                      <th>SUSA-Bereich</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnassigned.map(r => <RowComponent key={r.kontonr} r={r} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {rows.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Keine Konten mit Saldo in der SUSA.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Abbrechen</button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={selected.length === 0 || noSections}
            title={noSections ? 'Zuerst Abschnitte anlegen' : undefined}
          >
            ✓ {selected.length} Kont{selected.length === 1 ? 'o' : 'en'} importieren
          </button>
        </div>
      </div>
    </div>
  )
}
