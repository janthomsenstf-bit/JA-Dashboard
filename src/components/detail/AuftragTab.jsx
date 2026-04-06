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
export default function AuftragTab({ client, onUpdate }) {
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

      {/* ══════════════════ 1. MANDATS-SETUP ══════════════════ */}
      <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: '14px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <span style={{ fontSize: '16px' }}>⚙️</span>
          <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)' }}>Mandats-Setup</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1 }}>Steuert dynamische Filterung & Aufgaben-Übersicht automatisch</span>
          {risikoLabel && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: risikoLabel.color, background: risikoLabel.bg, padding: '3px 10px', borderRadius: '20px' }}>
              {risikoLabel.label}
            </span>
          )}
        </div>

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
            // KSt nur für GmbH anzeigen
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

        {/* USt-Voranmeldung (nicht bei Kleinunternehmer) */}
        {(steuerarten.ust || hatUSt) && !istKleinunternehmer && (
          <SetupRow label="USt-Intervall">
            {UST_INTERVALLE.map(i => (
              <Chip key={i.key} label={i.label} active={ustIntervall === i.key} color="#b45309"
                onClick={() => onUpdate({ ustZahlerTyp: i.key })} small />
            ))}
          </SetupRow>
        )}

        {/* Lohn */}
        <SetupRow label="Lohnabrechnung">
          <Chip label="Vorhanden" active={lohnAktiv}  color="#7c3aed" onClick={() => onUpdate({ lohnAktiv: true  })} small />
          <Chip label="Nicht vorhanden" active={!lohnAktiv} color="#64748b" onClick={() => onUpdate({ lohnAktiv: false })} small />
          {lohnAktiv && (
            <>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 4px' }}>Intervall:</span>
              {LOHN_INTERVALLE.map(i => (
                <Chip key={i.key} label={i.label} active={lohnIntervall === i.key} color="#7c3aed"
                  onClick={() => onUpdate({ lohnIntervall: i.key })} small />
              ))}
            </>
          )}
        </SetupRow>

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

        {/* Info: Quartals-USt Hinweis */}
        {ustIntervall === 'quartalsweise' && (
          <div style={{ marginTop: '6px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.15)', fontSize: '11px', color: '#b45309' }}>
            ℹ️ Quartalsweise USt-Voranmeldungen werden nur in <strong>März · Juni · September · Dezember</strong> als Aufgabe angezeigt.
          </div>
        )}

      </div>

      {/* ══════════════════ 2. AUTOMATISCHE HINWEISE ══════════════════ */}
      {hinweise.length > 0 && (
        <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {hinweise.map((h, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 14px',
              borderRadius: '8px',
              background: h.sev === 'crit' ? 'rgba(239,68,68,0.07)' : h.sev === 'warn' ? 'rgba(217,119,6,0.07)' : 'rgba(37,99,235,0.07)',
              border: `1px solid ${h.sev === 'crit' ? 'rgba(239,68,68,0.25)' : h.sev === 'warn' ? 'rgba(217,119,6,0.25)' : 'rgba(37,99,235,0.2)'}`,
            }}>
              <span style={{ fontSize: '15px', flexShrink: 0 }}>{h.icon}</span>
              <span style={{
                fontSize: '12px', lineHeight: 1.5,
                color: h.sev === 'crit' ? '#b91c1c' : h.sev === 'warn' ? '#92400e' : '#1e40af',
                fontWeight: h.sev === 'crit' ? 700 : 400,
              }}>{h.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════ 3. INTELLIGENTE CHECKLISTE ══════════════════ */}
      <div>
        {ALL_CATS.map(cat => (
          <CategoryCard
            key={cat.id}
            cat={cat}
            auftrag={auftrag}
            onToggle={toggleKey}
            setup={setup}
            defaultOpen={cat.id === 'formalien'}
          />
        ))}

        {/* Veranlagung / Einkünfte (ER/SIE) */}
        <VejCard auftrag={auftrag} onToggle={toggleKey} setup={setup} />
      </div>

    </div>
  )
}
