import { useState } from 'react'
import { MONAT_NAMEN } from '../../utils/aufgaben.js'

// ─────────────────────────────────────────────────────────────────────────────
// Setup-Konfiguration (Chips oben)
// ─────────────────────────────────────────────────────────────────────────────
const RECHTSFORMEN = [
  { key: 'Einzelunternehmen',   label: 'Einzelunternehmen',   short: 'EU'   },
  { key: 'GmbH',                label: 'GmbH / UG',           short: 'GmbH' },
  { key: 'Personengesellschaft',label: 'Personengesellschaft', short: 'PersG'},
  { key: 'Sonstige',            label: 'Sonstige',             short: 'Son.' },
]

const GEWINNERMITTLUNG_ARTEN = [
  { key: 'EÜR',   label: 'EÜR §4 Abs.3' },
  { key: 'Bilanz',label: 'Bilanz'        },
]

const STEUERARTEN = [
  { key: 'est',   label: 'ESt',     color: '#1d4ed8' },
  { key: 'kst',   label: 'KSt',     color: '#7c3aed' },
  { key: 'gewst', label: 'GewSt',   color: '#0f766e' },
  { key: 'ust',   label: 'USt',     color: '#b45309' },
]

const UST_SYSTEME = [
  { key: 'soll',            label: 'Sollversteuerung'  },
  { key: 'ist',             label: 'Istversteuerung'   },
  { key: 'kleinunternehmer',label: 'Kleinunternehmer'  },
]

const UST_INTERVALLE = [
  { key: 'monatlich',     label: 'Monatlich'      },
  { key: 'quartalsweise', label: 'Quartalsweise'  },
  { key: 'jährlich',      label: 'Jährlich'       },
  { key: 'keine',         label: 'Keine'          },
]

const LOHN_INTERVALLE = [
  { key: 'monatlich', label: 'Monatlich'  },
  { key: 'sonstiges', label: 'Sonstiges'  },
]

const LOHN_ARTEN = [
  { key: 'standard', label: 'Standardlohn' },
  { key: 'baulohn',  label: 'Baulohn'      },
]

// ─────────────────────────────────────────────────────────────────────────────
// Checklisten-Kategorien (mit Schlüsseln aus dem alten auftrag-Objekt)
// ─────────────────────────────────────────────────────────────────────────────

// filter: null = immer anzeigen | Fn(setup) = bedingt
const CAT_FORMALIEN = {
  id: 'formalien', titel: 'Auftrag & Formalien', icon: '🔵', color: '#1d4ed8',
  items: [
    { key: 'basics_steuervertrag',   label: 'Steuerberatungsvertrag unterschrieben' },
    { key: 'basics_vollmacht',       label: 'Vollmacht' },
    { key: 'basics_vorschuss',       label: 'Vorschuss / Honorar' },
    { key: 'basics_identifizierung', label: 'Identifizierung (Ausweis / Geldwäsche)' },
    { key: 'basics_verfahrensdoku',  label: 'Verfahrensdokumentation' },
    { key: 'besonderheiten_bp',             label: 'BP zu beachten', warn: true },
    { key: 'besonderheiten_rechtsbehelfe',  label: 'Aktuelle Rechtsbehelfe', warn: true },
    { key: 'besonderheiten_schriftwechsel', label: 'Aktueller Schriftwechsel FA', warn: true },
    { key: 'besonderheiten_vertraege',      label: 'Verträge' },
    { key: 'besonderheiten_existenzgruend', label: 'Existenzgründer (lfd. Jahr)', warn: true },
    { key: 'vorsysteme_selbstbucher',       label: 'Selbstbucher (Lexware o.ä.)', warn: true },
    { key: 'rechnung_kein_fibu',            label: 'Selbstbucher – keine FiBu abrechnen' },
    { key: 'rechnung_preisabspr',           label: 'Preisabsprache vorhanden' },
    { key: 'rechnung_mittelsatz',           label: 'Normal Mittelsatz' },
    { key: 'rechnung_vorkasse',             label: 'Vorkasse #20000' },
  ],
}

const CAT_UST_BESONDERHEITEN = {
  id: 'ust_besonderheiten', titel: 'Umsatzsteuer – Besonderheiten', icon: '🟡', color: '#b45309',
  filter: (s) => s.hatUSt && !s.istKleinunternehmer,
  items: [
    { key: 'ust_organschaft',   label: 'Organschaft', warn: true },
    { key: 'ust_diffbesteuer',  label: 'Differenzbesteuerung', warn: true },
    { key: 'ust_par13b',        label: 'Umkehr Steuerschuldnerschaft §13b UStG', warn: true },
    { key: 'ust_par12abs3',     label: '§12 Abs.3 UStG (PV-Anlagen < 30 kW)' },
    { key: 'ust_auft_vorst',    label: 'Aufteilung Vorsteuer' },
    { key: 'ust_reiseleist',    label: 'Reiseleistungen §25 UStG', warn: true },
    { key: 'ust_geschaeftsver', label: 'Geschäftsveräußerung im Ganzen' },
    { key: 'ust_konsol_ust',    label: 'Konsolidierte USt (mehrere Betriebe)' },
    { key: 'ust_befreiungen',   label: 'Befreiungen §4 Nr. …' },
    { key: 'ust_zm',            label: 'ZM beachten', warn: true },
    { key: 'ust_dauerfrist',    label: 'Dauerfristverlängerung' },
  ],
}

const CAT_GEWINNERMITTLUNG = {
  id: 'gewinnermittlung', titel: 'Gewinnermittlung & Abschluss', icon: '🟠', color: '#c2410c',
  items: [
    { key: 'aufgaben_gew_4abs3',    label: 'Gewinnermittlung §4 Abs.3 EStG', filter: (s) => s.gewinnermittlung !== 'Bilanz' },
    { key: 'aufgaben_gew_4abs1',    label: 'Gewinnermittlung §4 Abs.1 EStG', filter: (s) => s.gewinnermittlung === 'Bilanz' },
    { key: 'aufgaben_ges_festst',   label: 'Gesonderte Feststellungen',       filter: (s) => s.istPers },
    { key: 'aufgaben_einheitsbil',  label: 'Einheitsbilanz',                  filter: (s) => s.istPers },
    { key: 'aufgaben_steuerbil',    label: 'Eigene Steuerbilanz' },
    { key: 'aufgaben_eroeffbil',    label: 'Eröffnungsbilanz' },
    { key: 'aufgaben_betr_steuerk', label: 'Betriebliche Steuererklärungen' },
    { key: 'aufgaben_ebilanz',      label: 'E-Bilanz',                        filter: (s) => s.gewinnermittlung === 'Bilanz' },
    { key: 'aufgaben_offen_hinter', label: 'Offen / Hinterlegung' },
    { key: 'aufgaben_anhang',       label: 'Anhang' },
    { key: 'aufgaben_priv_steuerk', label: 'Private Steuererklärung',         filter: (s) => !s.istGmbH },
    { key: 'besonderheiten_datenimport',  label: 'Datenimport extern' },
    { key: 'besonderheiten_aend_gewinn',  label: 'Änderung Gewinnermittlung', warn: true },
    { key: 'besonderheiten_verlust',      label: 'Verlustsituation', warn: true },
    { key: 'umwandlung_eu_gmbh',          label: 'Umwandlung EU → GmbH', warn: true },
    { key: 'hinweise_fibu_kfz_nutzung',   label: 'Änderung KFZ-Nutzung (1%)' },
    { key: 'hinweise_fibu_erloesekonten', label: 'Erlösekonten (ZM)' },
  ],
}

const CAT_VORJAHR = {
  id: 'vorjahr', titel: 'Vorjahr & Historie', icon: '🟣', color: '#7c3aed',
  items: [
    { key: 'vorjahr_verlustvortrag', label: 'Verlustvortrag vorhanden', warn: true },
    { key: 'vorjahr_iab',            label: 'IAB aus Vorjahren zu berücksichtigen', warn: true },
    { key: 'vorjahr_par6b',          label: '§6b oder R6.6 aus Vorjahren', warn: true },
  ],
}

const CAT_RECHTSFORM_KAPITAL = {
  id: 'kapital', titel: 'Kapitalgesellschaft (GmbH / UG)', icon: '🏢', color: '#0f766e',
  filter: (s) => s.istGmbH,
  items: [
    { key: 'koerperschaft_geswechsel_kst', label: 'Gesellschafterwechsel §8c KStG', warn: true },
    { key: 'kapital_gewinnaussch',         label: 'Offene Gewinnausschüttung', warn: true },
    { key: 'kapital_tantieme',             label: 'Tantieme vorhanden' },
    { key: 'gewerbesteuer_zerlegung',      label: 'GewSt-Zerlegung' },
    { key: 'gewerbesteuer_neugruendung',   label: 'Neugründung (GewSt-Beginn)' },
  ],
}

const CAT_RECHTSFORM_PERS = {
  id: 'personengesellschaft', titel: 'Personengesellschaft', icon: '👥', color: '#1d4ed8',
  filter: (s) => s.istPers,
  items: [
    { key: 'personen_neuer_ges',   label: 'Neuer Gesellschafter (Eintritt)', warn: true },
    { key: 'personen_geswechsel',  label: 'Gesellschafterwechsel', warn: true },
    { key: 'personen_gesaustritt', label: 'Gesellschafteraustritt', warn: true },
    { key: 'personen_realteilung', label: 'Realteilung', warn: true },
    { key: 'personen_vertraege_p', label: 'Gesellschaftsverträge prüfen' },
    { key: 'gewerbesteuer_zerlegung',    label: 'GewSt-Zerlegung' },
    { key: 'gewerbesteuer_neugruendung', label: 'Neugründung (GewSt-Beginn)' },
  ],
}

// Veranlagung / Einkünfte – mit ER/SIE
const VEJ_ITEMS = [
  { id: 'mandat_vorschuss', label: '#20000 Mandat (Vorschuss)' },
  { id: 'zusammenveranl',   label: 'Zusammenveranlagung' },
  { id: 'stammdaten',       label: 'Änderungen Stammdaten (Kirche, Bank, Heirat …)' },
  { id: 'begruessung',      label: 'Begrüßungsmail + Beiblatt ESt gesendet' },
  { id: 'gewerbebetrieb1',  label: 'Gewerbebetrieb 1' },
  { id: 'gewerbebetrieb2',  label: 'Gewerbebetrieb 2' },
  { id: 'freiberuflich1',   label: 'Freiberuflich 1' },
  { id: 'freiberuflich2',   label: 'Freiberuflich 2 (Filiale)' },
  { id: 'nichtselbst',      label: 'Nicht selbständige Arbeit' },
  { id: 'vermietungen',     label: 'Vermietungen' },
  { id: 'sonstige',         label: 'Sonstige Einkünfte' },
  { id: 'priv_veraeuss',    label: 'Privates Veräußerungsgeschäft' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Automatische Hinweise
// ─────────────────────────────────────────────────────────────────────────────
function buildHinweise(setup, auftrag) {
  const hints = []
  const add = (sev, icon, text) => hints.push({ sev, icon, text })

  if (setup.istKleinunternehmer) {
    add('info', 'ℹ️', 'Kleinunternehmer: Keine USt auf Rechnungen, keine USt-Voranmeldung erforderlich.')
  }
  if (auftrag['ust_diffbesteuer']) {
    add('warn', '⚠️', 'Differenzbesteuerung: Besondere Behandlung der Erlöse – keine offene USt-Ausweisung möglich.')
  }
  if (auftrag['ust_organschaft']) {
    add('warn', '⚠️', 'Organschaft: Prüfung der Organträger-/Organgesellschaft-Verhältnisse erforderlich.')
  }
  if (auftrag['vorsysteme_selbstbucher']) {
    add('warn', '⚠️', 'Selbstbucher: Erhöhte Prüfpflicht der übernommenen Buchungen.')
  }
  if (auftrag['besonderheiten_bp']) {
    add('crit', '🚨', 'Betriebsprüfung: Prüfungssachverhalte aktiv im Blick halten.')
  }
  if (auftrag['vorjahr_verlustvortrag']) {
    add('info', 'ℹ️', 'Verlustvortrag vorhanden – Nutzung prüfen, gesonderte Feststellung ggf. erforderlich.')
  }
  if (auftrag['vorjahr_iab']) {
    add('warn', '⚠️', 'IAB aus Vorjahren: Investitionsabzugsbetrag – Investitionsfrist und Auflösung prüfen.')
  }
  if (auftrag['personen_geswechsel'] || auftrag['personen_neuer_ges'] || auftrag['personen_gesaustritt']) {
    add('warn', '⚠️', 'Gesellschafterwechsel/-eintritt/-austritt: Steuerliche Konsequenzen und Vertragsanpassungen prüfen.')
  }
  if (auftrag['ust_par13b']) {
    add('warn', '⚠️', '§13b UStG: Umkehr der Steuerschuldnerschaft – Eingangsrechnungen prüfen.')
  }
  if (auftrag['ust_zm']) {
    add('info', 'ℹ️', 'Zusammenfassende Meldung (ZM): Fristen und Vollständigkeit prüfen.')
  }
  if (setup.hatUSt && setup.istKleinunternehmer === false && setup.ustIntervall === 'keine') {
    add('info', 'ℹ️', 'USt aktiv aber kein Voranmeldezeitraum gesetzt – bitte im Auftrag prüfen.')
  }
  if (auftrag['besonderheiten_verlust']) {
    add('warn', '⚠️', 'Verlustsituation: Mindestbesteuerung und Verlustverrechnungsbeschränkungen beachten.')
  }
  if (auftrag['umwandlung_eu_gmbh']) {
    add('crit', '🚨', 'Umwandlung EU → GmbH: Steuerliche Sonderbehandlung, ggf. Einbringungsgewinn prüfen.')
  }
  return hints
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Komponenten
// ─────────────────────────────────────────────────────────────────────────────

function Chip({ label, active, color, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? '3px 11px' : '5px 15px',
      borderRadius: '20px', fontSize: small ? '11px' : '12px', cursor: 'pointer',
      border: `1.5px solid ${active ? color : 'var(--border)'}`,
      background: active ? color : 'var(--surface)',
      color: active ? '#fff' : 'var(--text-secondary)',
      fontWeight: active ? 700 : 400, transition: 'all 0.15s',
      flexShrink: 0,
    }}>{label}</button>
  )
}

function SetupRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', minWidth: '130px', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}

// ── Steuerliche Stammdaten (Steuernummer, Gesellschafter, GF, Gegenstand) ─────
function StammdatenErweitertSection({ client, onUpdate }) {
  const gesellschafter = Array.isArray(client.gesellschafter) ? client.gesellschafter : []
  const geschaeftsfuehrer = Array.isArray(client.geschaeftsfuehrer) ? client.geschaeftsfuehrer : []

  function genId() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4) }

  function addGesellschafter() {
    onUpdate({ gesellschafter: [...gesellschafter, { id: genId(), name: '', anteil: '' }] })
  }
  function updateGesellschafter(id, patch) {
    onUpdate({ gesellschafter: gesellschafter.map(g => g.id === id ? { ...g, ...patch } : g) })
  }
  function deleteGesellschafter(id) {
    onUpdate({ gesellschafter: gesellschafter.filter(g => g.id !== id) })
  }

  function addGF() {
    onUpdate({ geschaeftsfuehrer: [...geschaeftsfuehrer, { id: genId(), name: '' }] })
  }
  function updateGF(id, name) {
    onUpdate({ geschaeftsfuehrer: geschaeftsfuehrer.map(g => g.id === id ? { ...g, name } : g) })
  }
  function deleteGF(id) {
    onUpdate({ geschaeftsfuehrer: geschaeftsfuehrer.filter(g => g.id !== id) })
  }

  const inputStyle = {
    padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '6px',
    background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', outline: 'none',
  }

  const sumAnteil = gesellschafter.reduce((a, g) => a + (parseFloat(g.anteil) || 0), 0)

  return (
    <div style={{ marginTop: '10px', borderTop: '2px solid var(--border)', paddingTop: '10px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
        📋 Steuerliche Stammdaten
      </div>

      {/* Steuernummer */}
      <SetupRow label="Steuernummer">
        <input
          className="input"
          value={client.steuernummer ?? ''}
          onChange={e => onUpdate({ steuernummer: e.target.value })}
          placeholder="z. B. 12/345/67890"
          style={{ ...inputStyle, width: '200px' }}
        />
      </SetupRow>

      {/* Unternehmensgegenstand */}
      <SetupRow label="Unternehmensgegenstand">
        <input
          className="input"
          value={client.unternehmensgegenstand ?? ''}
          onChange={e => onUpdate({ unternehmensgegenstand: e.target.value })}
          placeholder="z. B. Handel mit Elektronikwaren"
          style={{ ...inputStyle, width: '320px' }}
        />
      </SetupRow>

      {/* Geschäftsführer */}
      <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', minWidth: '130px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Geschäftsführer
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
            {geschaeftsfuehrer.map(gf => (
              <div key={gf.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  className="input"
                  value={gf.name}
                  onChange={e => updateGF(gf.id, e.target.value)}
                  placeholder="Name des Geschäftsführers"
                  style={{ ...inputStyle, width: '240px' }}
                />
                <button
                  onClick={() => deleteGF(gf.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px', padding: '0 2px', lineHeight: 1 }}
                >✕</button>
              </div>
            ))}
            <button
              className="btn btn-ghost btn-sm"
              onClick={addGF}
              style={{ fontSize: '11px', alignSelf: 'flex-start', marginTop: geschaeftsfuehrer.length > 0 ? '2px' : '0' }}
            >
              ➕ Geschäftsführer
            </button>
          </div>
        </div>
      </div>

      {/* Gesellschafter */}
      <div style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', minWidth: '130px', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: '4px' }}>
            Gesellschafter
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
            {gesellschafter.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  className="input"
                  value={g.name}
                  onChange={e => updateGesellschafter(g.id, { name: e.target.value })}
                  placeholder="Name des Gesellschafters"
                  style={{ ...inputStyle, width: '200px' }}
                />
                <input
                  type="number"
                  min={0} max={100} step={0.01}
                  className="input"
                  value={g.anteil}
                  onChange={e => updateGesellschafter(g.id, { anteil: e.target.value })}
                  placeholder="0"
                  style={{ ...inputStyle, width: '72px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>%</span>
                <button
                  onClick={() => deleteGesellschafter(g.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px', padding: '0 2px', lineHeight: 1 }}
                >✕</button>
              </div>
            ))}
            {/* Summen-Prüfung */}
            {gesellschafter.length > 0 && (
              <div style={{ fontSize: '11px', color: Math.abs(sumAnteil - 100) < 0.01 ? '#16a34a' : sumAnteil > 0 ? '#d97706' : 'var(--text-muted)', marginTop: '2px' }}>
                {Math.abs(sumAnteil - 100) < 0.01 ? '✓ Gesamt: 100 %' : `Gesamt: ${sumAnteil.toFixed(1)} %`}
              </div>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={addGesellschafter}
              style={{ fontSize: '11px', alignSelf: 'flex-start', marginTop: gesellschafter.length > 0 ? '2px' : '0' }}
            >
              ➕ Gesellschafter
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CategoryCard({ cat, auftrag, onToggle, setup, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)

  // Prüfen ob Kategorie für dieses Setup überhaupt relevant
  if (cat.filter && !cat.filter(setup)) return null

  // Items filtern (per-item filter)
  const visibleItems = cat.items.filter(item => !item.filter || item.filter(setup))
  if (visibleItems.length === 0) return null

  const checked = visibleItems.filter(i => auftrag[i.key]).length
  const hasWarn = visibleItems.some(i => i.warn && auftrag[i.key])
  const allDone = checked === visibleItems.length && checked > 0

  return (
    <div style={{
      border: `1px solid ${hasWarn ? cat.color + '60' : 'var(--border)'}`,
      borderRadius: '10px', overflow: 'hidden', marginBottom: '10px',
      background: hasWarn ? cat.color + '05' : 'var(--surface2)',
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--surface)', border: 'none', cursor: 'pointer', textAlign: 'left',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}
      >
        <span style={{ fontSize: '14px' }}>{cat.icon}</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1, color: 'var(--text)' }}>{cat.titel}</span>
        {/* Fortschritt */}
        <span style={{
          fontSize: '11px', fontWeight: 700, padding: '1px 9px', borderRadius: '10px',
          background: allDone ? 'rgba(22,163,74,0.15)' : checked > 0 ? cat.color + '18' : 'var(--surface2)',
          color: allDone ? '#16a34a' : checked > 0 ? cat.color : 'var(--text-muted)',
          border: `1px solid ${allDone ? 'rgba(22,163,74,0.3)' : checked > 0 ? cat.color + '40' : 'var(--border)'}`,
        }}>
          {allDone ? '✓ Alle' : `${checked}/${visibleItems.length}`}
        </span>
        {hasWarn && !allDone && (
          <span style={{ fontSize: '11px', fontWeight: 600, color: cat.color, background: cat.color + '15', padding: '1px 7px', borderRadius: '8px' }}>
            ⚠ Relevant
          </span>
        )}
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Items */}
      {open && (
        <div style={{ padding: '6px 4px' }}>
          {visibleItems.map(item => {
            const checked = !!auftrag[item.key]
            return (
              <label key={item.key} style={{
                display: 'flex', alignItems: 'flex-start', gap: '9px',
                padding: '5px 10px', cursor: 'pointer', borderRadius: '6px',
                background: checked && item.warn ? cat.color + '08' : 'transparent',
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--surface)' }}
                onMouseLeave={e => { e.currentTarget.style.background = checked && item.warn ? cat.color + '08' : 'transparent' }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(item.key)}
                  style={{ marginTop: '2px', accentColor: cat.color, cursor: 'pointer', flexShrink: 0, width: '15px', height: '15px' }}
                />
                <span style={{
                  fontSize: '12px', lineHeight: 1.5, color: 'var(--text)',
                  display: 'flex', alignItems: 'center', gap: '5px', flex: 1,
                }}>
                  {item.label}
                  {item.warn && checked && (
                    <span style={{ fontSize: '10px', color: cat.color, fontWeight: 600, background: cat.color + '15', padding: '0 5px', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                      zu beachten
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function VejCard({ auftrag, onToggle, setup }) {
  const [open, setOpen] = useState(false)
  // Nur relevant für natürliche Personen / EU / PersG
  if (setup.istGmbH) return null

  const checked = VEJ_ITEMS.filter(i => auftrag[`vej_${i.id}_er`] || auftrag[`vej_${i.id}_sie`]).length

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '8px',
        background: 'var(--surface)', border: 'none', cursor: 'pointer', textAlign: 'left',
        borderBottom: open ? '1px solid var(--border)' : 'none',
      }}>
        <span style={{ fontSize: '14px' }}>📝</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Veranlagung / Einkünfte (ER / SIE)</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface2)', padding: '1px 9px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          {checked > 0 ? `${checked} aktiv` : '–'}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 34px 34px', padding: '4px 14px', background: '#f0f6ff', borderBottom: '1px solid var(--border)' }}>
            <span />
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#1e3a5f', textAlign: 'center' }}>ER</span>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#1e3a5f', textAlign: 'center' }}>SIE</span>
          </div>
          {VEJ_ITEMS.map(item => {
            const kEr  = `vej_${item.id}_er`
            const kSie = `vej_${item.id}_sie`
            return (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 34px 34px', alignItems: 'center', padding: '5px 14px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text)', lineHeight: 1.4 }}>{item.label}</span>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <input type="checkbox" checked={!!auftrag[kEr]}  onChange={() => onToggle(kEr)}  style={{ accentColor: '#1e3a5f', cursor: 'pointer', width: '15px', height: '15px' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <input type="checkbox" checked={!!auftrag[kSie]} onChange={() => onToggle(kSie)} style={{ accentColor: '#1e3a5f', cursor: 'pointer', width: '15px', height: '15px' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hauptkomponente
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Kontaktpersonen-Komponente
// ─────────────────────────────────────────────────────────────────────────────
function KontaktpersonenSection({ client, onUpdate }) {
  const kontakte = Array.isArray(client.kontakte) ? client.kontakte : []
  const [editId,    setEditId]    = useState(null)
  const [editForm,  setEditForm]  = useState({})
  const [addOpen,   setAddOpen]   = useState(false)
  const [newForm,   setNewForm]   = useState({ name: '', rolle: '', email: '', telefon: '' })

  function saveKontakt(id, patch) {
    onUpdate({ kontakte: kontakte.map(k => k.id === id ? { ...k, ...patch } : k) })
    setEditId(null)
  }

  function deleteKontakt(id) {
    onUpdate({ kontakte: kontakte.filter(k => k.id !== id) })
  }

  function addKontakt() {
    if (!newForm.name && !newForm.email) return
    const entry = { id: 'p' + Date.now().toString(36), ...newForm }
    onUpdate({ kontakte: [...kontakte, entry] })
    setNewForm({ name: '', rolle: '', email: '', telefon: '' })
    setAddOpen(false)
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Kontaktpersonen ({kontakte.length})
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setAddOpen(p => !p)} style={{ fontSize: '11px' }}>
          + Hinzufügen
        </button>
      </div>

      {/* Neue Kontaktperson */}
      {addOpen && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Name *</label>
              <input className="input" value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Max Mustermann" style={{ width: '100%', fontSize: '12px' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Rolle / Funktion</label>
              <select className="input" value={newForm.rolle} onChange={e => setNewForm(p => ({ ...p, rolle: e.target.value }))}
                style={{ width: '100%', fontSize: '12px' }}>
                <option value="">– bitte wählen –</option>
                <option value="Geschäftsführer">Geschäftsführer</option>
                <option value="Buchhaltung">Buchhaltung</option>
                <option value="Assistenz">Assistenz</option>
                <option value="Privat">Privat</option>
                <option value="Sonstiges">Sonstiges</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>E-Mail</label>
              <input className="input" value={newForm.email} onChange={e => setNewForm(p => ({ ...p, email: e.target.value }))}
                placeholder="max@firma.de" style={{ width: '100%', fontSize: '12px' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Telefon</label>
              <input className="input" value={newForm.telefon} onChange={e => setNewForm(p => ({ ...p, telefon: e.target.value }))}
                placeholder="+49 40 ..." style={{ width: '100%', fontSize: '12px' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn btn-primary btn-sm" onClick={addKontakt} style={{ fontSize: '11px' }}>Speichern</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAddOpen(false)} style={{ fontSize: '11px' }}>Abbrechen</button>
          </div>
        </div>
      )}

      {kontakte.length === 0 && !addOpen && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' }}>
          Noch keine Kontaktpersonen hinterlegt.
        </div>
      )}

      {kontakte.map(k => (
        <div key={k.id} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '10px 12px', marginBottom: '6px',
        }}>
          {editId === k.id ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Name</label>
                  <input className="input" value={editForm.name ?? k.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                    style={{ width: '100%', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Rolle</label>
                  <select className="input" value={editForm.rolle ?? k.rolle ?? ''} onChange={e => setEditForm(p => ({ ...p, rolle: e.target.value }))}
                    style={{ width: '100%', fontSize: '12px' }}>
                    <option value="">– bitte wählen –</option>
                    <option value="Geschäftsführer">Geschäftsführer</option>
                    <option value="Buchhaltung">Buchhaltung</option>
                    <option value="Assistenz">Assistenz</option>
                    <option value="Privat">Privat</option>
                    <option value="Sonstiges">Sonstiges</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>E-Mail</label>
                  <input className="input" value={editForm.email ?? k.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                    style={{ width: '100%', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>Telefon</label>
                  <input className="input" value={editForm.telefon ?? k.telefon} onChange={e => setEditForm(p => ({ ...p, telefon: e.target.value }))}
                    style={{ width: '100%', fontSize: '12px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-primary btn-sm" onClick={() => saveKontakt(k.id, editForm)} style={{ fontSize: '11px' }}>Speichern</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(null); setEditForm({}) }} style={{ fontSize: '11px' }}>Abbrechen</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{k.name || '–'}</span>
                  {k.rolle && <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--surface-2, rgba(255,255,255,0.05))', padding: '1px 7px', borderRadius: '10px' }}>{k.rolle}</span>}
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '2px', flexWrap: 'wrap' }}>
                  {k.email && <span style={{ fontSize: '11px', color: 'var(--accent)' }}>✉ {k.email}</span>}
                  {k.telefon && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📞 {k.telefon}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(k.id); setEditForm({ name: k.name, rolle: k.rolle, email: k.email, telefon: k.telefon }) }}
                  style={{ fontSize: '11px' }}>✏️</button>
                <button className="btn btn-ghost btn-sm" onClick={() => deleteKontakt(k.id)}
                  style={{ fontSize: '11px', color: 'var(--red)' }}>🗑</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── API-Key-Sektion (Stammdaten) ──────────────────────────────────────────────
// ── Absender-Auswahl pro Mandant ──────────────────────────────────────────────
const ABSENDER_KEY = 'kommunikation-absender'
function loadAbsenderGlobal() {
  try { const r = localStorage.getItem(ABSENDER_KEY); if (r) return JSON.parse(r) } catch {}
  return []
}

function AbsenderSection({ client, onUpdate }) {
  const absender = loadAbsenderGlobal()
  const current  = client.kommunikation?.standardAbsender ?? ''

  if (absender.length === 0) return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', marginTop: '14px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>✉️ Standard-Absender für diesen Mandanten</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        Noch keine Absenderadressen hinterlegt. Bitte zuerst im Reiter <strong>Nachrichten</strong> unter „Absender-Adressen verwalten" Adressen anlegen.
      </div>
    </div>
  )

  function handleChange(e) {
    const val = e.target.value
    const komm = client.kommunikation ?? { events: [] }
    onUpdate({ kommunikation: { ...komm, standardAbsender: val } })
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginTop: '14px' }}>
      <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '15px' }}>✉️</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Standard-Absender für diesen Mandanten</span>
        {current && (
          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, background: 'rgba(22,163,74,0.1)', padding: '2px 9px', borderRadius: '10px' }}>
            ✓ Festgelegt
          </span>
        )}
      </div>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Wird beim Öffnen einer neuen E-Mail an diesen Mandanten automatisch vorausgewählt. Kann im Editor jederzeit überschrieben werden.
        </div>
        <select
          className="input"
          value={current}
          onChange={handleChange}
          style={{ width: '100%', fontSize: '13px' }}
        >
          <option value="">— Globalen Standard verwenden —</option>
          {absender.map((a, i) => (
            <option key={i} value={a.email}>
              {a.name ? `${a.name} <${a.email}>` : a.email}
              {a.isDefault ? ' (globaler Standard)' : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ── Standard-Signatur pro Mandant ─────────────────────────────────────────────
function SignaturSection({ client, onUpdate, emailSignaturen }) {
  const current = client.kommunikation?.standardSignaturId ?? ''

  if (!emailSignaturen || emailSignaturen.length === 0) return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', marginTop: '14px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>✍️ Standard-Signatur für diesen Mandanten</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
        Noch keine Signaturen hinterlegt. Bitte im Reiter <strong>Nachrichten</strong> unter „Signaturen verwalten" anlegen.
      </div>
    </div>
  )

  function handleChange(e) {
    const val = e.target.value
    const komm = client.kommunikation ?? { events: [] }
    onUpdate({ kommunikation: { ...komm, standardSignaturId: val || null } })
  }

  const activeSig = emailSignaturen.find(s => s.id === current)

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginTop: '14px' }}>
      <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '15px' }}>✍️</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Standard-Signatur für diesen Mandanten</span>
        {current && activeSig && (
          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, background: 'rgba(22,163,74,0.1)', padding: '2px 9px', borderRadius: '10px' }}>
            ✓ {activeSig.name}
          </span>
        )}
      </div>
      <div style={{ padding: '12px 16px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Wird automatisch in neuen E-Mails, Antworten und Weiterleitungen an diesen Mandanten vorausgewählt.
        </div>
        <select
          className="input"
          value={current}
          onChange={handleChange}
          style={{ width: '100%', fontSize: '13px' }}
        >
          <option value="">— Globalen Standard verwenden —</option>
          {emailSignaturen.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}{s.isDefault ? ' (globaler Standard)' : ''}
            </option>
          ))}
        </select>
        {activeSig?.text && (
          <div style={{ marginTop: '10px', padding: '8px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: '80px', overflow: 'hidden' }}>
            {activeSig.text.slice(0, 200)}{activeSig.text.length > 200 ? '…' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

function ApiKeySection({ claudeApiKey, onUpdateClaudeApiKey }) {
  const [localKey, setLocalKey] = useState(claudeApiKey ?? '')
  const [saved,    setSaved]    = useState(false)
  const [show,     setShow]     = useState(false)

  function handleSave() {
    const trimmed = localKey.trim().replace(/\s/g, '')
    onUpdateClaudeApiKey?.(trimmed)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const hasKey = !!(claudeApiKey ?? '').trim()

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', marginTop: '14px' }}>
      <button
        onClick={() => setShow(o => !o)}
        style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--surface)', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: show ? '1px solid var(--border)' : 'none' }}
      >
        <span style={{ fontSize: '15px' }}>🔑</span>
        <span style={{ fontWeight: 700, fontSize: '13px', flex: 1 }}>Claude API-Schlüssel</span>
        <span style={{
          fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '10px',
          background: hasKey ? 'rgba(22,163,74,0.1)' : 'rgba(249,115,22,0.1)',
          color: hasKey ? '#16a34a' : '#f97316',
        }}>
          {hasKey ? `✓ Hinterlegt …${(claudeApiKey ?? '').slice(-6)}` : '⚠ Nicht gesetzt'}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{show ? '▲' : '▼'}</span>
      </button>

      {show && (
        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Wird für KI-Funktionen (Aufgaben, Aktivitäten, E-Mail-Formulierung) benötigt.
            Key von <strong>console.anthropic.com</strong> — wird sicher gespeichert und geräteübergreifend synchronisiert.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="password"
              value={localKey}
              onChange={e => setLocalKey(e.target.value)}
              placeholder="sk-ant-api03-..."
              style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', fontFamily: 'monospace' }}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoComplete="off"
              spellCheck={false}
            />
            <button className={`btn btn-sm ${saved ? 'btn-success' : 'btn-primary'}`} onClick={handleSave} style={{ fontSize: '12px' }}>
              {saved ? '✓ Gespeichert' : '💾 Speichern'}
            </button>
            {hasKey && (
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', fontSize: '12px' }} onClick={() => { setLocalKey(''); onUpdateClaudeApiKey?.('') }}>
                🗑 Löschen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AuftragsBlock – laufende / wiederkehrende Aufträge des Mandanten
// Konfiguriert: USt/Buchhaltung, Lohn, Jahresabschlüsse
// Wird von generateAufgaben() in aufgaben.js ausgewertet.
// ─────────────────────────────────────────────────────────────────────────────

function AuftragsToggle({ aktiv, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        padding: '3px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
        cursor: 'pointer', border: 'none',
        background: aktiv ? 'rgba(22,163,74,0.15)' : 'var(--surface2)',
        color: aktiv ? '#16a34a' : 'var(--text-muted)',
        outline: aktiv ? '1.5px solid rgba(22,163,74,0.4)' : '1.5px solid var(--border)',
        transition: 'all 0.15s',
      }}
    >
      {aktiv ? '✓ Aktiv' : '○ Inaktiv'}
    </button>
  )
}

function AuftragsBlock({ client, onUpdate }) {
  const [open, setOpen] = useState(true)

  // ── USt / Buchhaltung ──
  const ustAktiv    = !!(client.ustZahlerTyp && client.ustZahlerTyp !== 'keine')
  const ustIntervall = client.ustZahlerTyp ?? 'keine'
  const dauerfriv   = client.dauerfriv === true

  // ── Lohn ──
  const lohnAktiv = client.lohnAktiv === true
  const lohnArt   = client.lohnArt   ?? 'standard'

  // ── Jahresabschlüsse ──
  const jaAuftraege = Array.isArray(client.jaAuftraege) ? client.jaAuftraege : []

  function genJaId() { return 'ja' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4) }

  function addJA() {
    const newJahr = new Date().getFullYear() - 1
    onUpdate({ jaAuftraege: [...jaAuftraege, { id: genJaId(), geschaeftsjahr: String(newJahr), monat: '9', aktiv: true }] })
  }
  function updateJA(id, patch) {
    onUpdate({ jaAuftraege: jaAuftraege.map(j => j.id === id ? { ...j, ...patch } : j) })
  }
  function deleteJA(id) {
    onUpdate({ jaAuftraege: jaAuftraege.filter(j => j.id !== id) })
  }

  // Zusammenfassung für eingeklappten Header
  const summaryParts = []
  if (ustAktiv) summaryParts.push(`📊 USt ${ustIntervall}${dauerfriv ? ' +DFV' : ''}`)
  if (lohnAktiv) summaryParts.push(`💼 Lohn`)
  const jaAktiv = jaAuftraege.filter(j => j.aktiv).length
  if (jaAktiv > 0) summaryParts.push(`📁 ${jaAktiv} JA`)

  const inStyle = {
    padding: '5px 9px', border: '1px solid var(--border)', borderRadius: '6px',
    background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', outline: 'none',
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: '14px' }}>

      {/* Akkordeon-Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '11px 16px',
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--surface)', border: 'none', cursor: 'pointer', textAlign: 'left',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}
      >
        <span style={{ fontSize: '15px', flexShrink: 0 }}>📦</span>
        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)', flexShrink: 0 }}>Laufende Aufträge</span>
        {!open && summaryParts.length > 0 && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {summaryParts.join(' · ')}
          </span>
        )}
        {!open && summaryParts.length === 0 && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1 }}>Keine aktiven Aufträge</span>
        )}
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg)' }}>

          {/* ── 1. Buchhaltung / USt-Voranmeldung ── */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: ustAktiv ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: '15px' }}>📊</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '12px' }}>Buchhaltung / USt-Voranmeldung</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  Aufgaben erscheinen im Fristmonat (nicht im Leistungsmonat)
                </div>
              </div>
              <AuftragsToggle
                aktiv={ustAktiv}
                onToggle={() => onUpdate({ ustZahlerTyp: ustAktiv ? 'keine' : 'monatlich' })}
              />
            </div>

            {ustAktiv && (
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* Intervall */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Voranmeldungs-Intervall
                  </div>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {[
                      { key: 'monatlich',     label: 'Monatlich',      hint: 'Frist: 10. Folgemonat' },
                      { key: 'quartalsweise', label: 'Quartalsweise',   hint: 'Frist: 10. des Folgequartals' },
                      { key: 'jährlich',      label: 'Jährlich',        hint: 'Frist: 31. Juli Folgejahr' },
                    ].map(({ key, label, hint }) => (
                      <button
                        key={key}
                        title={hint}
                        onClick={() => onUpdate({ ustZahlerTyp: key })}
                        style={{
                          padding: '5px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
                          border: `1.5px solid ${ustIntervall === key ? '#1e3a5f' : 'var(--border)'}`,
                          background: ustIntervall === key ? '#1e3a5f' : 'var(--surface)',
                          color: ustIntervall === key ? '#fff' : 'var(--text-secondary)',
                          fontWeight: ustIntervall === key ? 700 : 400,
                          transition: 'all 0.15s',
                        }}
                      >{label}</button>
                    ))}
                  </div>
                </div>

                {/* Dauerfristverlängerung */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Dauerfristverlängerung
                  </div>
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                    {[
                      { v: true,  label: 'Ja',   hint: '+1 Monat Aufschub auf die Frist' },
                      { v: false, label: 'Nein', hint: 'Standardfrist (10. des Folgemonats)' },
                    ].map(({ v, label, hint }) => (
                      <button
                        key={String(v)}
                        title={hint}
                        onClick={() => onUpdate({ dauerfriv: v })}
                        style={{
                          padding: '5px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
                          border: `1.5px solid ${dauerfriv === v ? '#b45309' : 'var(--border)'}`,
                          background: dauerfriv === v ? '#b45309' : 'var(--surface)',
                          color: dauerfriv === v ? '#fff' : 'var(--text-secondary)',
                          fontWeight: dauerfriv === v ? 700 : 400,
                          transition: 'all 0.15s',
                        }}
                      >{label}</button>
                    ))}
                    {dauerfriv && (
                      <span style={{ fontSize: '11px', color: '#b45309', marginLeft: '6px' }}>
                        ℹ️ Frist verschiebt sich um 1 Monat — Aufgaben erscheinen einen Monat später
                      </span>
                    )}
                  </div>
                </div>

                {/* Frist-Info */}
                <div style={{ padding: '7px 10px', background: 'rgba(30,58,95,0.05)', borderRadius: '6px', border: '1px solid rgba(30,58,95,0.12)', fontSize: '11px', color: '#1e3a5f' }}>
                  {ustIntervall === 'monatlich' && !dauerfriv && '📅 Aufgaben erscheinen im Folgemonat (z. B. April-Voranmeldung → sichtbar im Mai, Frist 10. Mai)'}
                  {ustIntervall === 'monatlich' &&  dauerfriv && '📅 Aufgaben erscheinen zwei Monate später (z. B. April → sichtbar im Juni, Frist 10. Juni)'}
                  {ustIntervall === 'quartalsweise' && !dauerfriv && '📅 Aufgaben erscheinen im Folgemonat nach Quartalsende (Q1 → April, Frist 10. April)'}
                  {ustIntervall === 'quartalsweise' &&  dauerfriv && '📅 Aufgaben erscheinen zwei Monate nach Quartalsende (Q1 → Mai, Frist 10. Mai)'}
                  {ustIntervall === 'jährlich' && '📅 Aufgabe erscheint im Juli des Folgejahres (Frist 31. Juli)'}
                </div>
              </div>
            )}
          </div>

          {/* ── 2. Lohnabrechnung ── */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: lohnAktiv ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: '15px' }}>💼</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '12px' }}>Lohnabrechnung</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  Abrechnung (25.) + SV-Beitragsnachweis (26.) pro Monat
                </div>
              </div>
              <AuftragsToggle
                aktiv={lohnAktiv}
                onToggle={() => onUpdate({ lohnAktiv: !lohnAktiv })}
              />
            </div>

            {lohnAktiv && (
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                    Lohn-Art
                  </div>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {[
                      { key: 'standard',  label: 'Standardlohn' },
                      { key: 'baulohn',   label: 'Baulohn'      },
                      { key: 'sonstiges', label: 'Sonstiges'    },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => onUpdate({ lohnArt: key })}
                        style={{
                          padding: '5px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
                          border: `1.5px solid ${lohnArt === key ? '#7c3aed' : 'var(--border)'}`,
                          background: lohnArt === key ? '#7c3aed' : 'var(--surface)',
                          color: lohnArt === key ? '#fff' : 'var(--text-secondary)',
                          fontWeight: lohnArt === key ? 700 : 400,
                          transition: 'all 0.15s',
                        }}
                      >{label}</button>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '7px 10px', background: 'rgba(124,58,237,0.05)', borderRadius: '6px', border: '1px solid rgba(124,58,237,0.15)', fontSize: '11px', color: '#7c3aed' }}>
                  📅 Pro Monat zwei Aufgaben: Lohnabrechnung (Frist 25.) + SV-Beitragsnachweis (Frist 26.) — §28f Abs.3 SGB IV
                </div>
              </div>
            )}
          </div>

          {/* ── 3. Jahresabschlüsse ── */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: jaAuftraege.length > 0 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: '15px' }}>📁</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '12px' }}>Jahresabschlüsse</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                  Pro Geschäftsjahr: geplanter Bearbeitungsmonat im Folgejahr
                </div>
              </div>
              <button
                onClick={addJA}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '11px', flexShrink: 0 }}
              >
                ➕ Jahresabschluss
              </button>
            </div>

            {jaAuftraege.length > 0 && (
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {jaAuftraege.map(ja => (
                  <div key={ja.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                    padding: '8px 12px', borderRadius: '8px',
                    background: ja.aktiv ? 'rgba(194,65,12,0.04)' : 'var(--surface2)',
                    border: `1px solid ${ja.aktiv ? 'rgba(194,65,12,0.2)' : 'var(--border)'}`,
                  }}>
                    {/* Aktiv-Toggle */}
                    <AuftragsToggle
                      aktiv={ja.aktiv}
                      onToggle={() => updateJA(ja.id, { aktiv: !ja.aktiv })}
                    />

                    {/* Geschäftsjahr */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Geschäftsjahr</span>
                      <input
                        type="number"
                        min="2000" max="2099"
                        value={ja.geschaeftsjahr ?? ''}
                        onChange={e => updateJA(ja.id, { geschaeftsjahr: e.target.value })}
                        style={{ ...inStyle, width: '70px', textAlign: 'center' }}
                      />
                    </div>

                    {/* Bearbeitungsmonat */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Bearbeitungsmonat</span>
                      <select
                        value={ja.monat ?? ''}
                        onChange={e => updateJA(ja.id, { monat: e.target.value })}
                        style={{ ...inStyle, minWidth: '110px' }}
                      >
                        <option value="">– Monat –</option>
                        {MONAT_NAMEN.map((m, i) => (
                          <option key={i + 1} value={String(i + 1)}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {/* Anzeige-Info */}
                    {ja.aktiv && ja.geschaeftsjahr && ja.monat && (
                      <span style={{ fontSize: '11px', color: '#c2410c', marginLeft: 'auto' }}>
                        → erscheint {MONAT_NAMEN[parseInt(ja.monat, 10) - 1]} {parseInt(ja.geschaeftsjahr, 10) + 1}
                      </span>
                    )}

                    {/* Löschen */}
                    <button
                      onClick={() => deleteJA(ja.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '14px', padding: '0 3px', flexShrink: 0, marginLeft: ja.aktiv && ja.geschaeftsjahr && ja.monat ? '0' : 'auto' }}
                      title="Eintrag löschen"
                    >🗑</button>
                  </div>
                ))}

                <div style={{ padding: '7px 10px', background: 'rgba(194,65,12,0.04)', borderRadius: '6px', border: '1px solid rgba(194,65,12,0.12)', fontSize: '11px', color: '#c2410c' }}>
                  📅 Aufgabe erscheint im geplanten Monat des Folgejahres (Geschäftsjahr + 1)
                </div>
              </div>
            )}

            {jaAuftraege.length === 0 && (
              <div style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Noch kein Jahresabschluss-Auftrag angelegt. Klick auf „➕ Jahresabschluss" zum Hinzufügen.
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

export default function AuftragTab({ client, onUpdate, claudeApiKey, onUpdateClaudeApiKey, emailSignaturen = [] }) {
  const auftrag = client.auftrag ?? {}

  // Setup-Felder (aus client-Ebene)
  const rechtsform     = client.rechtsform     ?? ''
  const gewinnermittl  = client.gewinnermittlung ?? ''
  const steuerarten    = client.steuerarten    ?? {}
  const ustSystem      = client.ustSystem      ?? ''
  const ustIntervall   = client.ustZahlerTyp   ?? 'keine'
  const lohnAktiv      = client.lohnAktiv      ?? false
  const lohnIntervall  = client.lohnIntervall  ?? 'monatlich'
  const jaErforderlich = client.jahresabschlussErforderlich ?? false
  const jaMonat        = client.jaMonat        ?? null   // null = alle Monate, 0 = keine Aufgabe, 1–12 = Monat

  // Derived setup-Flags (für dynamische Filterung)
  const istGmbH            = rechtsform === 'GmbH'
  const istPers            = rechtsform === 'Personengesellschaft'
  const istKleinunternehmer= ustSystem  === 'kleinunternehmer'
  const hatUSt             = steuerarten.ust === true || (ustIntervall !== 'keine')
  const setup = { rechtsform, gewinnermittlung: gewinnermittl, istGmbH, istPers, hatUSt, istKleinunternehmer, ustIntervall }
  const [setupOpen, setSetupOpen] = useState(false)

  function toggleKey(key) {
    onUpdate({ auftrag: { ...auftrag, [key]: !auftrag[key] } })
  }

  // Hinweise berechnen
  const hinweise = buildHinweise(setup, auftrag)

  // Risiko-Level
  const risikoN = hinweise.filter(h => h.sev === 'crit').length
  const warnN   = hinweise.filter(h => h.sev === 'warn').length
  const risikoLabel = risikoN > 0 ? { label: 'Hohes Risiko', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
    : warnN > 1             ? { label: 'Mittleres Risiko', color: '#f97316', bg: 'rgba(249,115,22,0.1)' }
    : warnN > 0             ? { label: 'Prüfpunkte vorhanden', color: '#d97706', bg: 'rgba(217,119,6,0.1)' }
    : hinweise.length === 0 ? null
    :                         { label: 'Keine Besonderheiten', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' }

  const ALL_CATS = [
    CAT_FORMALIEN,
    CAT_UST_BESONDERHEITEN,
    CAT_GEWINNERMITTLUNG,
    CAT_RECHTSFORM_KAPITAL,
    CAT_RECHTSFORM_PERS,
    CAT_VORJAHR,
  ]

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '0', background: 'var(--bg)' }}>

      {/* ══════════════════ 1. MANDATS-SETUP (Akkordeon) ══════════════════ */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '14px', overflow: 'hidden' }}>

        {/* Akkordeon-Header (immer sichtbar, klickbar) */}
        <button
          onClick={() => setSetupOpen(o => !o)}
          style={{
            width: '100%', padding: '11px 16px',
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'var(--surface)', border: 'none', cursor: 'pointer',
            textAlign: 'left', borderBottom: setupOpen ? '1px solid var(--border)' : 'none',
          }}
        >
          <span style={{ fontSize: '15px', flexShrink: 0 }}>⚙️</span>
          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)', flexShrink: 0 }}>Mandats-Setup</span>

          {/* Zusammenfassung wenn eingeklappt */}
          {!setupOpen && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[
                client.mandatstyp === 'intern' ? 'Intern' : 'Extern',
                rechtsform || null,
                gewinnermittl || null,
                Object.entries(steuerarten).filter(([, v]) => v).map(([k]) => k.toUpperCase()).join('+') || null,
                lohnAktiv ? 'Lohn' : null,
              ].filter(Boolean).join(' · ')}
            </span>
          )}

          {/* Risikolabel wenn aufgeklappt */}
          {setupOpen && risikoLabel && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: risikoLabel.color, background: risikoLabel.bg, padding: '2px 9px', borderRadius: '20px', marginLeft: 'auto', flexShrink: 0 }}>
              {risikoLabel.label}
            </span>
          )}

          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: setupOpen && !risikoLabel ? 'auto' : '0', flexShrink: 0 }}>
            {setupOpen ? '▲' : '▼'}
          </span>
        </button>

        {/* Aufgeklappter Inhalt */}
        {setupOpen && (
          <div style={{ padding: '14px 16px' }}>
            {/* Mandatstyp */}
            <SetupRow label="Mandatstyp">
              <Chip label="Extern" active={(client.mandatstyp ?? 'extern') === 'extern'} color="#0891b2"
                onClick={() => onUpdate({ mandatstyp: 'extern' })} />
              <Chip label="Intern" active={(client.mandatstyp ?? 'extern') === 'intern'} color="#7c3aed"
                onClick={() => onUpdate({ mandatstyp: 'intern' })} />
            </SetupRow>

            {/* Rechtsform */}
            <SetupRow label="Rechtsform">
              {RECHTSFORMEN.map(rf => (
                <Chip key={rf.key} label={rf.label} active={rechtsform === rf.key} color="#1e3a5f"
                  onClick={() => onUpdate({ rechtsform: rf.key })} />
              ))}
            </SetupRow>

            {/* Gewinnermittlung */}
            <SetupRow label="Gewinnermittlung">
              {GEWINNERMITTLUNG_ARTEN.map(g => (
                <Chip key={g.key} label={g.label} active={gewinnermittl === g.key} color="#1e3a5f"
                  onClick={() => onUpdate({ gewinnermittlung: g.key })} />
              ))}
            </SetupRow>

            {/* Steuerarten */}
            <SetupRow label="Steuerarten aktiv">
              {STEUERARTEN.map(s => {
                if (s.key === 'kst' && rechtsform && rechtsform !== 'GmbH' && rechtsform !== 'Sonstige') return null
                const active = steuerarten[s.key] ?? false
                return (
                  <Chip key={s.key} label={s.label} active={active} color={s.color}
                    onClick={() => onUpdate({ steuerarten: { ...steuerarten, [s.key]: !active } })} />
                )
              })}
            </SetupRow>

            {/* USt-System (nur wenn USt aktiv) */}
            {(steuerarten.ust || hatUSt) && (
              <SetupRow label="USt-System">
                {UST_SYSTEME.map(s => (
                  <Chip key={s.key} label={s.label} active={ustSystem === s.key} color="#b45309"
                    onClick={() => onUpdate({ ustSystem: s.key })} small />
                ))}
              </SetupRow>
            )}

            {/* USt-Voranmeldung */}
            {(steuerarten.ust || hatUSt) && !istKleinunternehmer && (
              <SetupRow label="USt-Intervall">
                {UST_INTERVALLE.map(i => (
                  <Chip key={i.key} label={i.label} active={ustIntervall === i.key} color="#b45309"
                    onClick={() => onUpdate({ ustZahlerTyp: i.key })} small />
                ))}
              </SetupRow>
            )}

            {/* Dauerfristverlängerung */}
            {(steuerarten.ust || hatUSt) && !istKleinunternehmer && ustIntervall !== 'keine' && (
              <SetupRow label="Dauerfristverlängerung">
                <Chip label="Ja" active={client.dauerfriv === true}  color="#b45309" onClick={() => onUpdate({ dauerfriv: true })}  small />
                <Chip label="Nein" active={client.dauerfriv !== true} color="#64748b" onClick={() => onUpdate({ dauerfriv: false })} small />
                {client.dauerfriv && (
                  <span style={{ fontSize: '11px', color: '#b45309', marginLeft: '6px' }}>
                    ℹ️ Frist verschiebt sich um 1 Monat
                  </span>
                )}
              </SetupRow>
            )}

            {/* Lohn */}
            <SetupRow label="Lohnabrechnung">
              <Chip label="Vorhanden" active={lohnAktiv} color="#7c3aed" onClick={() => onUpdate({ lohnAktiv: true })} small />
              <Chip label="Nicht vorhanden" active={!lohnAktiv} color="#64748b" onClick={() => onUpdate({ lohnAktiv: false })} small />
            </SetupRow>
            {lohnAktiv && (
              <>
                <SetupRow label="Lohn-Intervall">
                  {LOHN_INTERVALLE.map(i => (
                    <Chip key={i.key} label={i.label} active={lohnIntervall === i.key} color="#7c3aed"
                      onClick={() => onUpdate({ lohnIntervall: i.key })} small />
                  ))}
                </SetupRow>
                <SetupRow label="Lohn-Art">
                  {LOHN_ARTEN.map(a => (
                    <Chip key={a.key} label={a.label} active={(client.lohnArt ?? 'standard') === a.key} color="#7c3aed"
                      onClick={() => onUpdate({ lohnArt: a.key })} small />
                  ))}
                </SetupRow>
                <SetupRow label="Anzahl Mitarbeiter">
                  <input
                    type="number"
                    min="0"
                    value={client.lohnMitarbeiter ?? ''}
                    onChange={e => onUpdate({ lohnMitarbeiter: e.target.value === '' ? null : parseInt(e.target.value) })}
                    placeholder="z.B. 5"
                    style={{ width: '80px', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }}
                  />
                  {client.lohnMitarbeiter > 0 && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                      {client.lohnMitarbeiter} Mitarbeiter
                    </span>
                  )}
                </SetupRow>
              </>
            )}

            {/* Jahresabschluss-Monat */}
            <SetupRow label="JA-Aufgabe Monat">
              <select
                value={jaMonat ?? ''}
                onChange={e => {
                  const v = e.target.value
                  onUpdate({ jaMonat: v === '' ? null : parseInt(v, 10) })
                }}
                style={{
                  padding: '4px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)',
                  outline: 'none',
                }}
              >
                <option value="">— Monat nicht konfiguriert (zeige immer)</option>
                <option value="0">Keine automatische Aufgabe</option>
                {MONAT_NAMEN.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              {jaMonat >= 1 && jaMonat <= 12 && (
                <span style={{ fontSize: '11px', color: '#0f766e', marginLeft: '8px' }}>
                  📁 Aufgabe erscheint nur im {MONAT_NAMEN[jaMonat - 1]}
                </span>
              )}
              {jaMonat === 0 && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  Keine automatische JA-Aufgabe wird erzeugt
                </span>
              )}
            </SetupRow>

            {/* Quartals-USt Hinweis */}
            {ustIntervall === 'quartalsweise' && (
              <div style={{ marginTop: '6px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.15)', fontSize: '11px', color: '#b45309' }}>
                ℹ️ Quartalsweise USt-Voranmeldungen werden nur in <strong>März · Juni · September · Dezember</strong> als Aufgabe angezeigt.
              </div>
            )}

            {/* ── Steuerliche Stammdaten ── */}
            <StammdatenErweitertSection client={client} onUpdate={onUpdate} />
          </div>
        )}
      </div>

      {/* ══════════════════ 2. LAUFENDE AUFTRÄGE ══════════════════ */}
      <AuftragsBlock client={client} onUpdate={onUpdate} />

      {/* ══════════════════ 3. KONTAKTPERSONEN ══════════════════ */}
      <KontaktpersonenSection client={client} onUpdate={onUpdate} />

      {/* ══════════════════ 4. ABSENDER ══════════════════ */}
      <AbsenderSection client={client} onUpdate={onUpdate} />

      {/* ══════════════════ 5. STANDARD-SIGNATUR ══════════════════ */}
      <SignaturSection client={client} onUpdate={onUpdate} emailSignaturen={emailSignaturen} />

      {/* ══════════════════ 6. API-SCHLÜSSEL ══════════════════ */}
      <ApiKeySection claudeApiKey={claudeApiKey} onUpdateClaudeApiKey={onUpdateClaudeApiKey} />

    </div>
  )
}
