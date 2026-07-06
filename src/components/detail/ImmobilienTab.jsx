/**
 * ImmobilienTab – Immobilien-Cockpit (Vermietung & Verpachtung / Anlage V).
 *
 * Kerngedanke: Die IMMOBILIE steht im Mittelpunkt. Ihre Stammdaten (Allgemein,
 * Anschaffung, Darlehen, Vermietung, Werbungskosten-Struktur, Dokumente) gelten
 * DAUERHAFT und werden einmal gepflegt. Darauf bauen die einzelnen STEUERJAHRE
 * auf (Mieteinnahmen, Werbungskosten-Beträge, Besonderheiten, Notizen,
 * Rückfragen, Bearbeitungsstand). Beim Anlegen eines neuen Jahres können die
 * Vorjahreswerte übernommen werden.
 *
 * Datenablage: client.immobilien[] – ein NEUES, additives Feld. Bestehende
 * Daten werden nicht berührt (updateClient merged { ...c, ...patch }).
 * Für die spätere Kontoauszug-Auswertung ist pro Jahr bereits ein leeres
 * `kontobewegungen`-Array vorgesehen (abwärtskompatibel erweiterbar).
 */
import { useState, useEffect } from 'react'

const ACCENT = '#b45309'          // Immobilien-Akzent (warmes Bernstein/Backstein)
const PERM   = '#2563eb'          // "dauerhaft"-Kennzeichnung (blau)
const YEARC  = '#b45309'          // "Steuerjahr"-Kennzeichnung

// ── Konfiguration ───────────────────────────────────────────────────────────
const JAHR_STATUS = {
  offen:          { label: 'noch nicht begonnen', kurz: 'offen',          icon: '⚪', color: '#64748b', bg: 'rgba(100,116,139,0.1)'  },
  in_bearbeitung: { label: 'in Bearbeitung',      kurz: 'in Bearbeitung', icon: '🟡', color: '#d97706', bg: 'rgba(217,119,6,0.1)'   },
  erledigt:       { label: 'Anlage V erstellt',   kurz: 'erledigt',       icon: '✅', color: '#16a34a', bg: 'rgba(22,163,74,0.1)'   },
}
const STATUS_ORDER = ['offen', 'in_bearbeitung', 'erledigt']

// Werbungskosten in drei Hauptbereiche gegliedert (praxisnah zur Anlage V)
const WK_GRUPPEN = {
  umlagefaehig:       { label: 'Umlagefähige Werbungskosten',     kurz: 'umlagefähig',      icon: '🔁', color: '#0891b2' },
  nicht_umlagefaehig: { label: 'Nicht umlagefähige Werbungskosten', kurz: 'nicht umlagef.', icon: '🏦', color: '#7c3aed' },
  erhaltung:          { label: 'Erhaltungsaufwendungen',          kurz: 'Erhaltung',        icon: '🛠️', color: '#d97706' },
}
const WK_GRUPPEN_ORDER = ['umlagefaehig', 'nicht_umlagefaehig', 'erhaltung']

const WK_DEFAULT_GRUPPEN = {
  umlagefaehig: [
    'Grundsteuer', 'Wasser', 'Abwasser / Entwässerung', 'Müllabfuhr', 'Straßenreinigung',
    'Hausbeleuchtung / Allgemeinstrom', 'Schornsteinfeger', 'Heizungswartung', 'Heizkosten',
    'Warmwasserkosten', 'Gartenpflege', 'Hausmeister', 'Gebäudeversicherung (umlagefähig)',
    'Sonstige umlagefähige Betriebskosten',
  ],
  nicht_umlagefaehig: [
    'Schuldzinsen', 'Kontoführungs- / Bankgebühren', 'Steuerberatungskosten', 'Fahrtkosten',
    'Porto', 'Telefon', 'Verwalterkosten', 'Rechtsberatung',
    'Sonstige nicht umlagefähige Werbungskosten',
  ],
  erhaltung: [
    'Malerarbeiten', 'Dachreparatur', 'Heizungsreparatur', 'Fensteraustausch', 'Sanitärarbeiten',
    'Elektroarbeiten', 'Fassadenarbeiten', 'Bodenbeläge', 'Renovierungen',
    'Sonstige Erhaltungsaufwendungen',
  ],
}

// Auto-Zuordnung bereits erfasster (alter, flacher) Kategorien anhand ihres key.
const OLD_WK_GROUP = {
  schuldzinsen: 'nicht_umlagefaehig', renovierung_erhaltungsaufwand: 'erhaltung', versicherungen: 'umlagefaehig',
  heizungswartung: 'umlagefaehig', schornsteinfeger: 'umlagefaehig', grundsteuer: 'umlagefaehig',
  m_llabfuhr: 'umlagefaehig', wasser: 'umlagefaehig', entw_sserung: 'umlagefaehig',
  hausbeleuchtung_allgemeinstrom: 'umlagefaehig', hausgeld_verwaltung: 'nicht_umlagefaehig',
  fahrtkosten: 'nicht_umlagefaehig', baustrom: 'nicht_umlagefaehig', mietverein: 'nicht_umlagefaehig',
  sonstige_werbungskosten: 'nicht_umlagefaehig',
}

const DOK_VORSCHLAEGE = [
  'Kaufvertrag', 'Grundbuchauszug', 'Grundriss', 'Wertgutachten', 'Objektbeschreibung',
  'Grundsteuerbescheid', 'Einheitswertbescheid', 'Grundsteuermessbescheid',
]

// Steuerliche Zuordnung (Eigentümer) – bewusst als Liste, damit später leicht erweiterbar
const EIGENTUEMER_OPTS = ['— nicht zugeordnet —', 'Eigentümer 1', 'Eigentümer 2', 'Beide Eigentümer']
const VERMIETUNGSART_OPTS = [
  'Dauerhafte Vermietung zu Wohnzwecken', 'Vermietung an Angehörige', 'Ferienwohnung',
  'Kurzfristige Vermietung (z. B. Airbnb)', 'Gemischte Nutzung', 'Sonstige',
]

// ── Helfer ──────────────────────────────────────────────────────────────────
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const todayISO = () => new Date().toISOString().slice(0, 10)
const CURRENT_YEAR = new Date().getFullYear()
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || uid('k_')
function num(v) { const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n }
function eur(v) { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v || 0) }
function deDate(s) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? `${m[3]}.${m[2]}.${m[1]}` : String(s || '') }
function pct(v) { return (v * 100).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + ' %' }

// Anzahl Monate (Default 12), Warm- & Jahresmiete einer Einheit
const monateOf = (x) => (x?.monate === undefined || x?.monate === '' ? 12 : num(x.monate))
const warmOf = (e) => num(e.kaltmiete) + num(e.nebenkosten)
const einheitJahr = (e) => warmOf(e) * monateOf(e)

// Mietverhältnis-Status (aktiv/beendet) aus dem Mietende
function mietStatus(m) { return m?.mietende && m.mietende < todayISO() ? 'beendet' : 'aktiv' }
// Leerstand (Tage) zwischen Ende eines und Beginn des nächsten Mietverhältnisses
function leerstandTage(prevEndISO, nextStartISO) {
  if (!prevEndISO || !nextStartISO) return 0
  const d = Math.round((new Date(nextStartISO) - new Date(prevEndISO)) / 86400000) - 1
  return d > 0 ? d : 0
}
// Anzahl Monate, in denen ein Mietverhältnis (von…bis) im Steuerjahr aktiv war.
// Ein Monat zählt, wenn das Mietverhältnis an mindestens einem Tag des Monats bestand.
function monateImJahr(vonISO, bisISO, jahr) {
  const von = vonISO ? new Date(vonISO) : null
  const bis = bisISO ? new Date(bisISO) : null
  let n = 0
  for (let m = 0; m < 12; m++) {
    const first = new Date(jahr, m, 1)
    const last = new Date(jahr, m + 1, 0)
    if ((!von || von <= last) && (!bis || bis >= first)) n++
  }
  return n
}

// Vermietungsanteil aus (vermietete / gesamte) Wohnfläche – Basis für die WK-Aufteilung.
// Ohne Angabe der vermieteten Fläche => 100 % (volle Berücksichtigung).
function vermietungsAnteil(obj) {
  const g = num(obj?.allgemein?.wohnflaeche)
  const v = num(obj?.allgemein?.vermieteteWohnflaeche)
  return (g > 0 && v > 0) ? Math.min(v / g, 1) : 1
}

// Werbungskosten-Zelle: abwärtskompatibel. Alt = reine Zahl (voll ansetzbar),
// neu = { betrag, anteilig } (anteilig => nur Vermietungsanteil steuerlich).
function wkCell(jahr, key) {
  const c = (jahr?.werbungskosten || {})[key]
  // betrag = Einzelbetrag je Zahlung, anzahl = Anzahl der Zahlungen (Default 1 => Altdaten unverändert).
  if (typeof c === 'number') return { betrag: c, anzahl: 1, anteilig: false, aktiv: true }
  return { betrag: num(c?.betrag), anzahl: c?.anzahl == null ? 1 : Math.max(0, num(c.anzahl)), anteilig: !!c?.anteilig, aktiv: c?.aktiv !== false }
}
// Jahresbetrag einer WK-Position = Einzelbetrag × Anzahl der Zahlungen
const wkJahresbetrag = (c) => num(c.betrag) * (c.anzahl == null ? 1 : num(c.anzahl))
// Gruppe einer Kategorie: explizit gesetzt, sonst aus Altbestand abgeleitet, sonst Fallback.
function wkGruppeOf(cat) {
  if (cat?.gruppe && WK_GRUPPEN[cat.gruppe]) return cat.gruppe
  return OLD_WK_GROUP[cat?.key] || 'nicht_umlagefaehig'
}
function groupKategorien(kats) {
  return WK_GRUPPEN_ORDER.map(g => ({ gruppe: g, cats: (kats || []).filter(k => wkGruppeOf(k) === g) }))
}
// Jahressummen der Wohnungen aufgeschlüsselt (Kalt/Neben/Warm), unter Berücksichtigung der Monate
function einheitenSummen(jahr) {
  let kalt = 0, neben = 0
  ;(jahr.einheiten || []).forEach(e => { const m = monateOf(e); kalt += num(e.kaltmiete) * m; neben += num(e.nebenkosten) * m })
  return { kalt, neben, warm: kalt + neben }
}
function jahrEinnahmen(jahr) {
  const wohn   = (jahr.einheiten || []).reduce((s, e) => s + einheitJahr(e), 0)
  const gar    = (jahr.garagen || []).reduce((s, g) => s + num(g.miete) * monateOf(g), 0)
  const sonst  = (jahr.sonstigeEinnahmen || []).reduce((s, p) => s + num(p.betrag) * (num(p.anzahl) || 0), 0)
  const legacy = (jahr.mieteinnahmen || []).reduce((s, m) => s + num(m.betrag), 0)  // Altbestand
  return { wohn, gar, sonst, legacy, total: wohn + gar + sonst + legacy }
}
function jahrWerbungskosten(jahr, obj) {
  const anteil = vermietungsAnteil(obj)
  let gesamt = 0, steuerlich = 0
  ;(obj.wkKategorien || []).forEach(k => {
    const c = wkCell(jahr, k.key)
    if (!c.aktiv) return                            // kein Haken => kein Ansatz
    const jb = wkJahresbetrag(c)                     // Einzelbetrag × Anzahl
    gesamt += jb
    steuerlich += c.anteilig ? jb * anteil : jb
  })
  return { gesamt, steuerlich, anteil }
}

// ── Fabriken (Defaults; additiv, alle Felder optional lesbar) ────────────────
function mkImmobilie(bezeichnung) {
  return {
    id: uid('imm_'),
    bezeichnung: bezeichnung || 'Neue Immobilie',
    icon: '🏠',
    erstelltAm: new Date().toISOString(),
    eigentuemer: EIGENTUEMER_OPTS[0],               // steuerliche Zuordnung (erweiterbar)
    // ── DAUERHAFTE Stammdaten ──
    allgemein: { anschrift: '', einheitsaktenzeichen: '', vermietungsart: VERMIETUNGSART_OPTS[0], baujahr: '', kernsanierung: '', grundstuecksflaeche: '', wohnflaeche: '', vermieteteWohnflaeche: '', nutzflaeche: '', eigennutzung: false, garagen: false, stellplaetze: false },
    anschaffung: { datum: '', kaufpreis: 0, grunderwerbsteuer: 0, notarkosten: 0, gerichtskosten: 0, maklerprovision: 0, weitere: 0, notarvertragVorhanden: false },
    darlehen: [],                                   // erweiterbar
    einheiten: [],                                  // Vermietung (mehrere Wohnungen möglich)
    wkKategorien: WK_GRUPPEN_ORDER.flatMap(g => WK_DEFAULT_GRUPPEN[g].map(l => ({ key: slug(l), label: l, gruppe: g }))),
    dokumente: [],
    // ── JAHRESBEZOGENE Daten ──
    jahre: [],
  }
}
function mkDarlehen()  { return { id: uid('dar_'), darlehensgeber: '', darlehensnummer: '', zweck: 'Anschaffung', zinsbescheinigung: false } }
function mkEinheit()   { return { id: uid('einh_'), bezeichnung: '', notiz: '', wohnflaeche: '', mietbeginn: '', mietvertrag: false, kaltmiete: 0, nebenkosten: 0, mieter: [] } }
function mkMieter(from) { return { id: uid('mtr_'), name: '', mietbeginn: '', mietende: '', kaltmiete: from?.kaltmiete || 0, nebenkosten: from?.nebenkosten || 0, notiz: '' } }
function mkDokument(name) { return { id: uid('dok_'), name: name || '', kategorie: '', referenz: '', notiz: '', hinzugefuegtAm: todayISO() } }
function mkRueckfrage() { return { id: uid('rf_'), text: '', beantwortet: false, antwort: '' } }
// Jahresbezogene Einnahmen-Positionen
function mkGarage()   { return { id: uid('gar_'), bezeichnung: '', miete: 0, monate: 12, notiz: '' } }
function mkSonstige() { return { id: uid('son_'), bezeichnung: '', notiz: '', betrag: 0, anzahl: 12 } }
function mkJahrEinheit(from) {
  return { id: uid('je_'), bezeichnung: from?.bezeichnung || '', notiz: from?.notiz || '', wohnflaeche: from?.wohnflaeche || '',
    kaltmiete: from?.kaltmiete || 0, nebenkosten: from?.nebenkosten || 0, monate: 12 }
}
const deep = (x) => JSON.parse(JSON.stringify(x))
function mkJahr(jahr, prev) {
  return {
    jahr,
    status: 'in_bearbeitung',
    // ── Einnahmen (jahresbezogen; werden bei Übernahme als Startwert kopiert) ──
    einheiten:          prev ? deep(prev.einheiten || []) : [],
    garagen:            prev ? deep(prev.garagen || []) : [],
    sonstigeEinnahmen:  prev ? deep(prev.sonstigeEinnahmen || []) : [],
    mieteinnahmen:      prev ? deep(prev.mieteinnahmen || []) : [],   // Altbestand, weiterhin unterstützt
    // ── Werbungskosten ──
    werbungskosten:     prev ? deep(prev.werbungskosten || {}) : {},
    besonderheiten:     prev ? (prev.besonderheiten || '') : '',
    notizen:            prev ? (prev.notizen || '') : '',
    rueckfragen:        [],
    kontobewegungen:    [],                          // Zukunft: Kontoauszug-Zuordnung
    uebernommenAus:     prev ? prev.jahr : null,
    erstelltAm:         new Date().toISOString(),
  }
}

// ── gemeinsame Styles ────────────────────────────────────────────────────────
const cardCss  = { border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface)', overflow: 'hidden' }
const bodyCss  = { padding: '13px', display: 'flex', flexDirection: 'column', gap: '12px' }
const grid2    = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }
const inputCss = { padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12.5px', boxSizing: 'border-box', width: '100%' }
const labelCss = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }
const btnPrimary = { padding: '6px 14px', borderRadius: '7px', border: 'none', background: ACCENT, color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnGhost   = { padding: '6px 12px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }
const iconBtn    = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', padding: '2px 4px' }

function Badge({ kind }) {
  const isPerm = kind === 'perm'
  return (
    <span title={isPerm ? 'Gilt dauerhaft – muss nicht jedes Jahr neu erfasst werden' : 'Betrifft nur das gewählte Steuerjahr'}
      style={{ fontSize: '9.5px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '20px',
        color: isPerm ? PERM : YEARC, background: isPerm ? 'rgba(37,99,235,0.1)' : 'rgba(180,83,9,0.12)', border: `1px solid ${isPerm ? 'rgba(37,99,235,0.3)' : 'rgba(180,83,9,0.3)'}` }}>
      {isPerm ? '🔒 dauerhaft' : '📅 Steuerjahr'}
    </span>
  )
}

// ── Eingabe-Felder (lokaler State, Commit onBlur → kein Fokusverlust) ─────────
function Field({ label, value, onCommit, type = 'text', placeholder, suffix }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  const commit = () => { if (String(v) !== String(value ?? '')) onCommit(type === 'number' ? num(v) : v) }
  return (
    <label style={labelCss}>
      <span>{label}</span>
      <div style={{ position: 'relative' }}>
        <input
          type={type === 'number' ? 'text' : type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          value={v}
          placeholder={placeholder}
          onChange={e => setV(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          style={{ ...inputCss, paddingRight: suffix ? '26px' : undefined }}
        />
        {suffix && <span style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '12px', pointerEvents: 'none' }}>{suffix}</span>}
      </div>
    </label>
  )
}
function Area({ label, value, onCommit, placeholder, rows = 3 }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  return (
    <label style={labelCss}>
      <span>{label}</span>
      <textarea value={v} rows={rows} placeholder={placeholder}
        onChange={e => setV(e.target.value)}
        onBlur={() => { if (v !== (value ?? '')) onCommit(v) }}
        style={{ ...inputCss, resize: 'vertical', lineHeight: 1.5, textTransform: 'none' }} />
    </label>
  )
}
function Check({ label, checked, onToggle }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text)', padding: '6px 0' }}>
      <input type="checkbox" checked={!!checked} onChange={e => onToggle(e.target.checked)} style={{ width: '15px', height: '15px', accentColor: ACCENT, cursor: 'pointer' }} />
      {label}
    </label>
  )
}

// ── einklappbare Sektion ──────────────────────────────────────────────────────
function Section({ icon, title, kind, defaultOpen = false, right, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={cardCss}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '9px', padding: '10px 13px', background: 'var(--surface2)', border: 'none', borderBottom: open ? '1px solid var(--border)' : 'none', cursor: 'pointer', color: 'var(--text)' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{open ? '▼' : '▶'}</span>
        <span style={{ fontSize: '15px' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '13px' }}>{title}</span>
        {kind && <Badge kind={kind} />}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>{right}</span>
      </button>
      {open && <div style={bodyCss}>{children}</div>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  STAMMDATEN-EDITOREN (dauerhaft)
// ══════════════════════════════════════════════════════════════════════════════
function AllgemeinEditor({ obj, patch }) {
  const a = obj.allgemein || {}
  const set = (k, v) => patch(o => ({ ...o, allgemein: { ...o.allgemein, [k]: v } }))
  const anteil = vermietungsAnteil(obj)
  const anteilBekannt = num(a.wohnflaeche) > 0 && num(a.vermieteteWohnflaeche) > 0
  return (
    <>
      {/* Steuerliche Zuordnung */}
      <div style={grid2}>
        <label style={labelCss}><span>Eigentümer / steuerliche Zuordnung</span>
          <select value={obj.eigentuemer ?? EIGENTUEMER_OPTS[0]} onChange={e => patch(o => ({ ...o, eigentuemer: e.target.value }))} style={inputCss}>
            {EIGENTUEMER_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label style={labelCss}><span>Art der Vermietung</span>
          <select value={a.vermietungsart ?? VERMIETUNGSART_OPTS[0]} onChange={e => set('vermietungsart', e.target.value)} style={inputCss}>
            {VERMIETUNGSART_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>

      <Field label="Anschrift" value={a.anschrift} onCommit={v => set('anschrift', v)} placeholder="Straße Hausnr., PLZ Ort" />
      <div style={grid2}>
        <Field label="Einheitsaktenzeichen" value={a.einheitsaktenzeichen} onCommit={v => set('einheitsaktenzeichen', v)} placeholder="z. B. 21/815/01234" />
        <Field label="Baujahr" value={a.baujahr} onCommit={v => set('baujahr', v)} placeholder="z. B. 1998" />
        <Field label="Kernsanierung (Jahr)" value={a.kernsanierung} onCommit={v => set('kernsanierung', v)} placeholder="optional" />
        <Field label="Grundstücksfläche" value={a.grundstuecksflaeche} onCommit={v => set('grundstuecksflaeche', v)} suffix="m²" />
        <Field label="Wohnfläche gesamt" value={a.wohnflaeche} onCommit={v => set('wohnflaeche', v)} suffix="m²" />
        <Field label="davon vermietet" value={a.vermieteteWohnflaeche} onCommit={v => set('vermieteteWohnflaeche', v)} suffix="m²" />
        <Field label="Nutzfläche" value={a.nutzflaeche} onCommit={v => set('nutzflaeche', v)} suffix="m²" />
      </div>

      {/* Automatischer Vermietungsanteil */}
      <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.25)', borderRadius: '8px', padding: '8px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-muted)' }}>Vermietungsanteil (vermietete / gesamte Wohnfläche)</span>
        <strong style={{ color: PERM, fontSize: '14px' }}>{pct(anteil)}</strong>
        {!anteilBekannt && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>— ohne „davon vermietet" wird 100 % angesetzt</span>}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>steuert die anteilige Werbungskosten-Berechnung</span>
      </div>

      <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
        <Check label="Eigennutzung vorhanden" checked={a.eigennutzung} onToggle={v => set('eigennutzung', v)} />
        <Check label="Garagen vorhanden" checked={a.garagen} onToggle={v => set('garagen', v)} />
        <Check label="Stellplätze vorhanden" checked={a.stellplaetze} onToggle={v => set('stellplaetze', v)} />
      </div>
    </>
  )
}

function AnschaffungEditor({ obj, patch }) {
  const s = obj.anschaffung || {}
  const set = (k, v) => patch(o => ({ ...o, anschaffung: { ...o.anschaffung, [k]: v } }))
  const summe = num(s.kaufpreis) + num(s.grunderwerbsteuer) + num(s.notarkosten) + num(s.gerichtskosten) + num(s.maklerprovision) + num(s.weitere)
  return (
    <>
      <div style={grid2}>
        <Field label="Anschaffungsdatum" type="date" value={s.datum} onCommit={v => set('datum', v)} />
        <Field label="Kaufpreis" type="number" value={s.kaufpreis} onCommit={v => set('kaufpreis', v)} suffix="€" />
        <Field label="Grunderwerbsteuer" type="number" value={s.grunderwerbsteuer} onCommit={v => set('grunderwerbsteuer', v)} suffix="€" />
        <Field label="Notarkosten" type="number" value={s.notarkosten} onCommit={v => set('notarkosten', v)} suffix="€" />
        <Field label="Gerichtskosten" type="number" value={s.gerichtskosten} onCommit={v => set('gerichtskosten', v)} suffix="€" />
        <Field label="Maklerprovision" type="number" value={s.maklerprovision} onCommit={v => set('maklerprovision', v)} suffix="€" />
        <Field label="Weitere Anschaffungskosten" type="number" value={s.weitere} onCommit={v => set('weitere', v)} suffix="€" />
      </div>
      <Check label="Notarieller Kaufvertrag vorhanden" checked={s.notarvertragVorhanden} onToggle={v => set('notarvertragVorhanden', v)} />
      <div style={{ background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.2)', borderRadius: '8px', padding: '8px 12px', fontSize: '12.5px', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-muted)' }}>Anschaffungskosten gesamt (Basis für AfA)</span>
        <strong style={{ color: ACCENT }}>{eur(summe)}</strong>
      </div>
    </>
  )
}

function DarlehenEditor({ obj, patch }) {
  const list = obj.darlehen || []
  const add = () => patch(o => ({ ...o, darlehen: [...(o.darlehen || []), mkDarlehen()] }))
  const upd = (id, k, v) => patch(o => ({ ...o, darlehen: o.darlehen.map(d => d.id === id ? { ...d, [k]: v } : d) }))
  const del = (id) => patch(o => ({ ...o, darlehen: o.darlehen.filter(d => d.id !== id) }))
  return (
    <>
      {list.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Noch kein Darlehen erfasst.</div>}
      {list.map(d => (
        <div key={d.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={grid2}>
            <Field label="Darlehensgeber" value={d.darlehensgeber} onCommit={v => upd(d.id, 'darlehensgeber', v)} placeholder="Bank" />
            <Field label="Darlehensnummer" value={d.darlehensnummer} onCommit={v => upd(d.id, 'darlehensnummer', v)} />
            <label style={labelCss}><span>Zweck</span>
              <select value={d.zweck} onChange={e => upd(d.id, 'zweck', e.target.value)} style={inputCss}>
                <option>Anschaffung</option><option>Renovierung / Modernisierung</option><option>Umschuldung</option><option>Sonstiges</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <Check label="Zinsbescheinigung liegt vor" checked={d.zinsbescheinigung} onToggle={v => upd(d.id, 'zinsbescheinigung', v)} />
            <button onClick={() => del(d.id)} style={{ ...iconBtn, marginLeft: 'auto', color: '#ef4444' }} title="Darlehen entfernen">🗑 entfernen</button>
          </div>
        </div>
      ))}
      <button onClick={add} style={{ ...btnGhost, alignSelf: 'flex-start' }}>+ Darlehen hinzufügen</button>
    </>
  )
}

// Mieterhistorie einer Einheit (dauerhafte Stammdaten). updEinheit(key, value) setzt Felder der Einheit.
function MieterEditor({ einheit, updEinheit }) {
  const list = einheit.mieter || []
  const setList = (fn) => updEinheit('mieter', fn(list))
  const add = () => setList(l => [...l, mkMieter(einheit)])
  const upd = (id, k, v) => setList(l => l.map(m => m.id === id ? { ...m, [k]: v } : m))
  const del = (id) => setList(l => l.filter(m => m.id !== id))
  const sorted = [...list].sort((a, b) => String(a.mietbeginn).localeCompare(String(b.mietbeginn)))
  return (
    <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '9px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
      <div style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
        👤 Mieter / Mietverhältnisse ({list.length})
      </div>
      {list.length === 0 && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Noch kein Mieter erfasst. Beliebig viele Mietverhältnisse möglich – daraus entsteht die Historie.</div>}
      {sorted.map((m, i) => {
        const warm = warmOf(m)
        const status = mietStatus(m)
        const prev = sorted[i - 1]
        const leer = prev ? leerstandTage(prev.mietende, m.mietbeginn) : 0
        return (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {leer > 0 && <div style={{ fontSize: '11px', color: '#d97706' }}>⚠ Leerstand {leer} Tage zwischen den Mietverhältnissen</div>}
            <div style={{ border: '1px solid var(--border)', borderRadius: '7px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <input defaultValue={m.name} onBlur={e => upd(m.id, 'name', e.target.value)} placeholder="Name des Mieters" style={{ ...inputCss, fontWeight: 600, flex: 1 }} />
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: status === 'aktiv' ? 'rgba(22,163,74,0.12)' : 'rgba(100,116,139,0.15)', color: status === 'aktiv' ? '#16a34a' : '#64748b' }}>{status === 'aktiv' ? '● aktiv' : '○ beendet'}</span>
                <button onClick={() => del(m.id)} style={{ ...iconBtn, color: '#ef4444' }} title="Mietverhältnis entfernen">🗑</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '7px' }}>
                <label style={labelCss}><span>Mietbeginn</span><input type="date" defaultValue={m.mietbeginn} onBlur={e => upd(m.id, 'mietbeginn', e.target.value)} style={inputCss} /></label>
                <label style={labelCss}><span>Mietende</span><input type="date" defaultValue={m.mietende} onBlur={e => upd(m.id, 'mietende', e.target.value)} style={inputCss} /></label>
                <label style={labelCss}><span>Kaltmiete /Mon.</span><input inputMode="decimal" defaultValue={m.kaltmiete ? String(m.kaltmiete).replace('.', ',') : ''} onBlur={e => upd(m.id, 'kaltmiete', num(e.target.value))} placeholder="0,00" style={inputCss} /></label>
                <label style={labelCss}><span>Nebenkosten /Mon.</span><input inputMode="decimal" defaultValue={m.nebenkosten ? String(m.nebenkosten).replace('.', ',') : ''} onBlur={e => upd(m.id, 'nebenkosten', num(e.target.value))} placeholder="0,00" style={inputCss} /></label>
              </div>
              <input defaultValue={m.notiz} onBlur={e => upd(m.id, 'notiz', e.target.value)} placeholder="Notiz (z. B. Auszug wegen Arbeitsplatzwechsel)" style={inputCss} />
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Warmmiete <strong style={{ color: 'var(--text)' }}>{eur(warm)}</strong> / Mon.
                {m.mietbeginn && <> · {deDate(m.mietbeginn)} – {m.mietende ? deDate(m.mietende) : 'heute'}</>}
              </div>
            </div>
          </div>
        )
      })}
      <button onClick={add} style={{ ...btnGhost, alignSelf: 'flex-start' }}>+ Mieter hinzufügen</button>
    </div>
  )
}

function VermietungEditor({ obj, patch }) {
  const list = obj.einheiten || []
  const add = () => patch(o => ({ ...o, einheiten: [...(o.einheiten || []), mkEinheit()] }))
  const upd = (id, k, v) => patch(o => ({ ...o, einheiten: o.einheiten.map(e => e.id === id ? { ...e, [k]: v } : e) }))
  const del = (id) => patch(o => ({ ...o, einheiten: o.einheiten.filter(e => e.id !== id) }))
  return (
    <>
      {list.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Noch keine vermietete Einheit erfasst. Bei mehreren Wohnungen jede Einheit separat anlegen.</div>}
      {list.map((e, i) => {
        const warm = num(e.kaltmiete) + num(e.nebenkosten)
        return (
          <div key={e.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: ACCENT }}>Einheit {i + 1}</span>
              <button onClick={() => del(e.id)} style={{ ...iconBtn, marginLeft: 'auto', color: '#ef4444' }} title="Einheit entfernen">🗑</button>
            </div>
            <div style={grid2}>
              <Field label="Bezeichnung" value={e.bezeichnung} onCommit={v => upd(e.id, 'bezeichnung', v)} placeholder="z. B. EG links" />
              <Field label="Wohnfläche" type="number" value={e.wohnflaeche} onCommit={v => upd(e.id, 'wohnflaeche', v)} suffix="m²" />
              <Field label="Mietbeginn" type="date" value={e.mietbeginn} onCommit={v => upd(e.id, 'mietbeginn', v)} />
              <Field label="Kaltmiete (mtl.)" type="number" value={e.kaltmiete} onCommit={v => upd(e.id, 'kaltmiete', v)} suffix="€" />
              <Field label="Nebenkosten (mtl.)" type="number" value={e.nebenkosten} onCommit={v => upd(e.id, 'nebenkosten', v)} suffix="€" />
            </div>
            <Field label="Notiz" value={e.notiz} onCommit={v => upd(e.id, 'notiz', v)} placeholder="optional" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <Check label="Mietvertrag liegt vor" checked={e.mietvertrag} onToggle={v => upd(e.id, 'mietvertrag', v)} />
              <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>Sollmiete: <strong style={{ color: 'var(--text)' }}>{eur(warm)}</strong> / Monat · {eur(warm * 12)} / Jahr</span>
            </div>
            <MieterEditor einheit={e} updEinheit={(k, v) => upd(e.id, k, v)} />
          </div>
        )
      })}
      <button onClick={add} style={{ ...btnGhost, alignSelf: 'flex-start' }}>+ Einheit / Wohnung hinzufügen</button>
    </>
  )
}

function WkGruppeStruktur({ gruppe, cats, onAdd, onMove, onDel }) {
  const g = WK_GRUPPEN[gruppe]
  const [neu, setNeu] = useState('')
  const doAdd = () => { const l = neu.trim(); if (!l) return; onAdd(gruppe, l); setNeu('') }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 11px', background: g.color + '14', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: '14px' }}>{g.icon}</span>
        <strong style={{ fontSize: '12.5px', color: g.color }}>{g.label}</strong>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({cats.length})</span>
      </div>
      <div style={{ padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {cats.length === 0 && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Keine Kategorien in diesem Bereich.</div>}
        {cats.map(k => (
          <div key={k.key} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ flex: 1, fontSize: '12px' }}>{k.label}</span>
            <select value={gruppe} onChange={e => onMove(k.key, e.target.value)} title="in anderen Bereich verschieben" style={{ ...inputCss, width: 'auto', padding: '3px 6px', fontSize: '11px' }}>
              {WK_GRUPPEN_ORDER.map(gg => <option key={gg} value={gg}>{WK_GRUPPEN[gg].kurz}</option>)}
            </select>
            <button onClick={() => onDel(k.key)} style={{ ...iconBtn, color: 'var(--text-muted)' }} title="Kategorie entfernen">✕</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
          <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doAdd() }} placeholder="Kategorie hinzufügen…" style={{ ...inputCss, maxWidth: '240px' }} />
          <button onClick={doAdd} style={btnGhost}>+ hinzufügen</button>
        </div>
      </div>
    </div>
  )
}

function WkKategorienEditor({ obj, patch }) {
  const grouped = groupKategorien(obj.wkKategorien || [])
  const add  = (gruppe, label) => patch(o => ({ ...o, wkKategorien: [...(o.wkKategorien || []), { key: slug(label) + '_' + Math.random().toString(36).slice(2, 5), label, gruppe }] }))
  const move = (key, gruppe)   => patch(o => ({ ...o, wkKategorien: (o.wkKategorien || []).map(k => k.key === key ? { ...k, gruppe } : k) }))
  const del  = (key)           => patch(o => ({ ...o, wkKategorien: (o.wkKategorien || []).filter(k => k.key !== key) }))
  return (
    <>
      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Struktur der Werbungskosten – in drei Bereiche gegliedert (umlagefähig · nicht umlagefähig · Erhaltungsaufwand)
        und jederzeit erweiterbar. Nach dieser Struktur werden die Werbungskosten in jedem Steuerjahr erfasst.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
        {grouped.map(({ gruppe, cats }) => (
          <WkGruppeStruktur key={gruppe} gruppe={gruppe} cats={cats} onAdd={add} onMove={move} onDel={del} />
        ))}
      </div>
    </>
  )
}

function DokumenteEditor({ obj, patch }) {
  const list = obj.dokumente || []
  const add = (name) => patch(o => ({ ...o, dokumente: [...(o.dokumente || []), mkDokument(name)] }))
  const upd = (id, k, v) => patch(o => ({ ...o, dokumente: o.dokumente.map(d => d.id === id ? { ...d, [k]: v } : d) }))
  const del = (id) => patch(o => ({ ...o, dokumente: o.dokumente.filter(d => d.id !== id) }))
  const vorhanden = new Set(list.map(d => d.name))
  return (
    <>
      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
        Dokumente werden dauerhaft bei der Immobilie gespeichert. Schnell hinzufügen:
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {DOK_VORSCHLAEGE.filter(n => !vorhanden.has(n)).map(n => (
          <button key={n} onClick={() => add(n)} style={{ ...btnGhost, fontSize: '11px', padding: '4px 10px' }}>+ {n}</button>
        ))}
      </div>
      {list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {list.map(d => (
            <div key={d.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>📄</span>
                <input value={d.name} onChange={e => upd(d.id, 'name', e.target.value)} placeholder="Dokumentname" style={{ ...inputCss, fontWeight: 600, maxWidth: '260px' }} />
                <button onClick={() => del(d.id)} style={{ ...iconBtn, marginLeft: 'auto', color: '#ef4444' }} title="Dokument entfernen">🗑</button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input value={d.referenz} onChange={e => upd(d.id, 'referenz', e.target.value)} placeholder="Ablageort / Link (z. B. OneDrive-Pfad)" style={{ ...inputCss, flex: 2, minWidth: '160px' }} />
                <input value={d.notiz} onChange={e => upd(d.id, 'notiz', e.target.value)} placeholder="Notiz" style={{ ...inputCss, flex: 1, minWidth: '120px' }} />
              </div>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => add('')} style={{ ...btnGhost, alignSelf: 'flex-start' }}>+ Eigenes Dokument</button>
      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
        Hinweis: Hier werden Dokument-Angaben & Ablageorte gepflegt. Ein direkter Datei-Upload lässt sich später an die bestehende Dokumenten-/OneDrive-Verwaltung anbinden.
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  STEUERJAHR-EDITOR (jahresbezogen)
// ══════════════════════════════════════════════════════════════════════════════
function SubHead({ icon, title, summe }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>{title}</span>
      <span style={{ marginLeft: 'auto', fontSize: '12.5px', fontWeight: 700, color: '#16a34a' }}>{eur(summe)}</span>
    </div>
  )
}

// Einnahmen je Wohnung/Einheit (jahresbezogen) – mit Monaten & automatischer Jahresmiete
function EinheitenJahrEditor({ jahr, obj, patch }) {
  const list = jahr.einheiten || []
  const add = () => patch(j => ({ ...j, einheiten: [...(j.einheiten || []), mkJahrEinheit()] }))
  const upd = (id, k, v) => patch(j => ({ ...j, einheiten: (j.einheiten || []).map(e => e.id === id ? { ...e, [k]: v } : e) }))
  const del = (id) => patch(j => ({ ...j, einheiten: (j.einheiten || []).filter(e => e.id !== id) }))
  // Übernahme aus den Stammdaten: pro Einheit die Mietverhältnisse, die dieses
  // Steuerjahr betreffen, mit automatisch berechneten Monaten. Einheiten ohne
  // Mieter fallen auf ihre Sollmiete (12 Monate) zurück.
  const fromStamm = () => {
    const rows = []
    ;(obj.einheiten || []).forEach(e => {
      const mieter = e.mieter || []
      if (mieter.length) {
        mieter.forEach(m => {
          const monate = monateImJahr(m.mietbeginn, m.mietende, jahr.jahr)
          if (monate <= 0) return                     // Mietverhältnis betrifft dieses Jahr nicht
          rows.push({ ...mkJahrEinheit(e), bezeichnung: (e.bezeichnung || 'Einheit') + (m.name ? ' – ' + m.name : ''), kaltmiete: m.kaltmiete || 0, nebenkosten: m.nebenkosten || 0, monate, von: m.mietbeginn || '', bis: m.mietende || '', notiz: m.notiz || '' })
        })
      } else {
        rows.push(mkJahrEinheit(e))                    // Fallback ohne Mieter: Sollmiete, 12 Monate
      }
    })
    if (rows.length) patch(j => ({ ...j, einheiten: [...(j.einheiten || []), ...rows] }))
  }
  const S = einheitenSummen(jahr)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {list.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Noch keine Einheit erfasst.</div>}
      {list.map((e, i) => (
        <div key={e.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input defaultValue={e.bezeichnung} onBlur={ev => upd(e.id, 'bezeichnung', ev.target.value)} placeholder={`Einheit ${i + 1} (z. B. OG links)`} style={{ ...inputCss, fontWeight: 600, flex: 1 }} />
            <button onClick={() => del(e.id)} style={{ ...iconBtn, color: '#ef4444' }}>🗑</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '8px' }}>
            <label style={labelCss}><span>Wohnfläche</span><input inputMode="decimal" defaultValue={e.wohnflaeche} onBlur={ev => upd(e.id, 'wohnflaeche', ev.target.value)} placeholder="m²" style={inputCss} /></label>
            <label style={labelCss}><span>Kaltmiete /Mon.</span><input inputMode="decimal" defaultValue={e.kaltmiete ? String(e.kaltmiete).replace('.', ',') : ''} onBlur={ev => upd(e.id, 'kaltmiete', num(ev.target.value))} placeholder="0,00" style={inputCss} /></label>
            <label style={labelCss}><span>Nebenkosten /Mon.</span><input inputMode="decimal" defaultValue={e.nebenkosten ? String(e.nebenkosten).replace('.', ',') : ''} onBlur={ev => upd(e.id, 'nebenkosten', num(ev.target.value))} placeholder="0,00" style={inputCss} /></label>
            <label style={labelCss}><span>Monate erhalten</span><input inputMode="numeric" defaultValue={monateOf(e)} onBlur={ev => upd(e.id, 'monate', num(ev.target.value))} style={inputCss} /></label>
          </div>
          <input defaultValue={e.notiz} onBlur={ev => upd(e.id, 'notiz', ev.target.value)} placeholder="Notiz (optional)" style={inputCss} />
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted)' }}>
            <span>Warmmiete <strong style={{ color: 'var(--text)' }}>{eur(warmOf(e))}</strong> / Mon.</span>
            {(e.von || e.bis) && <span>Zeitraum {e.von ? deDate(e.von) : '…'} – {e.bis ? deDate(e.bis) : 'heute'}</span>}
            <span style={{ marginLeft: 'auto' }}>Jahresmiete ({monateOf(e)} Mon.) <strong style={{ color: '#16a34a' }}>{eur(einheitJahr(e))}</strong></span>
          </div>
        </div>
      ))}
      {list.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '7px', display: 'flex', gap: '18px', justifyContent: 'flex-end', flexWrap: 'wrap', fontSize: '12.5px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Kaltmiete <strong style={{ color: 'var(--text)' }}>{eur(S.kalt)}</strong></span>
          <span style={{ color: 'var(--text-muted)' }}>Nebenkosten <strong style={{ color: 'var(--text)' }}>{eur(S.neben)}</strong></span>
          <span style={{ fontWeight: 800 }}>Warmmiete <span style={{ color: '#16a34a' }}>{eur(S.warm)}</span></span>
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={add} style={btnGhost}>+ Einheit</button>
        {(obj.einheiten || []).length > 0 && <button onClick={fromStamm} style={btnGhost} title="Aus den Stammdaten übernehmen: Mietverhältnisse dieses Jahres inkl. automatisch berechneter Monate">↧ aus Mietern übernehmen (Monate automatisch)</button>}
      </div>
    </div>
  )
}

// Garagenvermietung (jahresbezogen)
function GaragenEditor({ jahr, patch }) {
  const list = jahr.garagen || []
  const add = () => patch(j => ({ ...j, garagen: [...(j.garagen || []), mkGarage()] }))
  const upd = (id, k, v) => patch(j => ({ ...j, garagen: (j.garagen || []).map(g => g.id === id ? { ...g, [k]: v } : g) }))
  const del = (id) => patch(j => ({ ...j, garagen: (j.garagen || []).filter(g => g.id !== id) }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      {list.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Keine Garagen erfasst.</div>}
      {list.map(g => (
        <div key={g.id} style={{ display: 'flex', gap: '7px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input defaultValue={g.bezeichnung} onBlur={e => upd(g.id, 'bezeichnung', e.target.value)} placeholder="Bezeichnung (z. B. Garage 1)" style={{ ...inputCss, flex: 2, minWidth: '140px' }} />
          <input inputMode="decimal" defaultValue={g.miete ? String(g.miete).replace('.', ',') : ''} onBlur={e => upd(g.id, 'miete', num(e.target.value))} placeholder="Miete/Mon." style={{ ...inputCss, width: '96px', textAlign: 'right' }} /><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>€</span>
          <input inputMode="numeric" defaultValue={monateOf(g)} onBlur={e => upd(g.id, 'monate', num(e.target.value))} title="Monate" style={{ ...inputCss, width: '48px', textAlign: 'right' }} /><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mon.</span>
          <input defaultValue={g.notiz} onBlur={e => upd(g.id, 'notiz', e.target.value)} placeholder="Notiz" style={{ ...inputCss, flex: 1, minWidth: '90px' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', width: '88px', textAlign: 'right' }}>{eur(num(g.miete) * monateOf(g))}</span>
          <button onClick={() => del(g.id)} style={{ ...iconBtn, color: '#ef4444' }}>🗑</button>
        </div>
      ))}
      <button onClick={add} style={{ ...btnGhost, alignSelf: 'flex-start' }}>+ Garage</button>
    </div>
  )
}

// Sonstige Vermietungseinnahmen (Werbeflächen, Mobilfunkmast, Stellplätze …)
function SonstigeEinnahmenEditor({ jahr, patch }) {
  const list = jahr.sonstigeEinnahmen || []
  const add = () => patch(j => ({ ...j, sonstigeEinnahmen: [...(j.sonstigeEinnahmen || []), mkSonstige()] }))
  const upd = (id, k, v) => patch(j => ({ ...j, sonstigeEinnahmen: (j.sonstigeEinnahmen || []).map(p => p.id === id ? { ...p, [k]: v } : p) }))
  const del = (id) => patch(j => ({ ...j, sonstigeEinnahmen: (j.sonstigeEinnahmen || []).filter(p => p.id !== id) }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      {list.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Keine sonstigen Einnahmen (z. B. Werbefläche, Mobilfunkmast, Stellplatz).</div>}
      {list.map(p => (
        <div key={p.id} style={{ display: 'flex', gap: '7px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input defaultValue={p.bezeichnung} onBlur={e => upd(p.id, 'bezeichnung', e.target.value)} placeholder="Bezeichnung (z. B. Werbefläche)" style={{ ...inputCss, flex: 2, minWidth: '150px' }} />
          <input inputMode="decimal" defaultValue={p.betrag ? String(p.betrag).replace('.', ',') : ''} onBlur={e => upd(p.id, 'betrag', num(e.target.value))} placeholder="Betrag" style={{ ...inputCss, width: '92px', textAlign: 'right' }} /><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>€</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>×</span>
          <input inputMode="numeric" defaultValue={p.anzahl ?? ''} onBlur={e => upd(p.id, 'anzahl', num(e.target.value))} title="Anzahl der Zuflüsse" style={{ ...inputCss, width: '48px', textAlign: 'right' }} /><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Zufl.</span>
          <input defaultValue={p.notiz} onBlur={e => upd(p.id, 'notiz', e.target.value)} placeholder="Notiz" style={{ ...inputCss, flex: 1, minWidth: '90px' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', width: '88px', textAlign: 'right' }}>{eur(num(p.betrag) * (num(p.anzahl) || 0))}</span>
          <button onClick={() => del(p.id)} style={{ ...iconBtn, color: '#ef4444' }}>🗑</button>
        </div>
      ))}
      <button onClick={add} style={{ ...btnGhost, alignSelf: 'flex-start' }}>+ Sonstige Einnahme</button>
    </div>
  )
}

// Altbestand: früher als Einzelposition erfasste Mieteinnahmen (bleiben erhalten & editierbar)
function LegacyEinnahmenEditor({ jahr, patch }) {
  const list = jahr.mieteinnahmen || []
  if (list.length === 0) return null
  const upd = (id, k, v) => patch(j => ({ ...j, mieteinnahmen: (j.mieteinnahmen || []).map(m => m.id === id ? { ...m, [k]: v } : m) }))
  const del = (id) => patch(j => ({ ...j, mieteinnahmen: (j.mieteinnahmen || []).filter(m => m.id !== id) }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Früher erfasste Einzelpositionen (bleiben erhalten):</div>
      {list.map(m => (
        <div key={m.id} style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
          <input defaultValue={m.bezeichnung} onBlur={e => upd(m.id, 'bezeichnung', e.target.value)} placeholder="Bezeichnung" style={{ ...inputCss, flex: 2 }} />
          <input inputMode="decimal" defaultValue={m.betrag ? String(m.betrag).replace('.', ',') : ''} onBlur={e => upd(m.id, 'betrag', num(e.target.value))} style={{ ...inputCss, width: '100px', textAlign: 'right' }} /><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>€</span>
          <button onClick={() => del(m.id)} style={{ ...iconBtn, color: '#ef4444' }}>🗑</button>
        </div>
      ))}
    </div>
  )
}

// Gesamter Einnahmen-Block (Wohnungen + Garagen + Sonstige + Altbestand)
function EinnahmenBlock({ jahr, obj, patch }) {
  const E = jahrEinnahmen(jahr)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <SubHead icon="🏠" title="Wohnungen / Einheiten" summe={E.wohn} />
        <div style={{ marginTop: '8px' }}><EinheitenJahrEditor jahr={jahr} obj={obj} patch={patch} /></div>
      </div>
      <div>
        <SubHead icon="🚗" title="Garagenvermietung" summe={E.gar} />
        <div style={{ marginTop: '8px' }}><GaragenEditor jahr={jahr} patch={patch} /></div>
      </div>
      <div>
        <SubHead icon="📡" title="Sonstige Vermietungseinnahmen" summe={E.sonst} />
        <div style={{ marginTop: '8px' }}><SonstigeEinnahmenEditor jahr={jahr} patch={patch} /></div>
      </div>
      <LegacyEinnahmenEditor jahr={jahr} patch={patch} />
      <div style={{ borderTop: '2px solid var(--border)', paddingTop: '9px', textAlign: 'right', fontSize: '14px', fontWeight: 800 }}>
        Gesamteinnahmen {jahr.jahr}: <span style={{ color: '#16a34a' }}>{eur(E.total)}</span>
      </div>
    </div>
  )
}

// Direkteingabe einer neuen Werbungskosten-Position innerhalb eines Bereichs
function WkAddRow({ gruppe, anteilDefault, onAdd }) {
  const [label, setLabel] = useState('')
  const [betrag, setBetrag] = useState('')
  const [anzahl, setAnzahl] = useState('1')
  const [anteilig, setAnteilig] = useState(anteilDefault)
  const canAdd = label.trim().length > 0
  const submit = () => { if (!canAdd) return; onAdd(gruppe, { label: label.trim(), betrag, anzahl, anteilig }); setLabel(''); setBetrag(''); setAnzahl('1'); setAnteilig(anteilDefault) }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 4px 2px', flexWrap: 'wrap' }}>
      <span style={{ width: '15px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', flexShrink: 0 }}>＋</span>
      <input value={label} onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submit() }} placeholder="Neue Position hinzufügen (Bezeichnung)" style={{ ...inputCss, flex: 1, minWidth: '130px' }} />
      <input value={betrag} onChange={e => setBetrag(e.target.value)} inputMode="decimal" placeholder="Betrag" style={{ ...inputCss, width: '70px', textAlign: 'right' }} />
      <input value={anzahl} onChange={e => setAnzahl(e.target.value)} inputMode="numeric" title="Anzahl der Zahlungen" style={{ ...inputCss, width: '44px', textAlign: 'center' }} />
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }} title="anteilig ansetzen">
        <input type="checkbox" checked={anteilig} onChange={e => setAnteilig(e.target.checked)} style={{ width: '14px', height: '14px', accentColor: ACCENT }} /> anteilig
      </label>
      <button onClick={submit} disabled={!canAdd} style={{ ...btnGhost, opacity: canAdd ? 1 : 0.5, cursor: canAdd ? 'pointer' : 'not-allowed' }}>+ hinzufügen</button>
    </div>
  )
}

function WerbungskostenEditor({ jahr, obj, patch, patchObj }) {
  const kats = obj.wkKategorien || []
  const { gesamt, steuerlich, anteil } = jahrWerbungskosten(jahr, obj)
  const anteilAktiv = anteil < 1
  const grouped = groupKategorien(kats)

  const setCell = (key, changes) => patch(j => { const c = wkCell(j, key); return { ...j, werbungskosten: { ...(j.werbungskosten || {}), [key]: { betrag: c.betrag, anzahl: c.anzahl, anteilig: c.anteilig, aktiv: c.aktiv, ...changes } } } })
  const setAll  = (field, val) => patch(j => { const wk = { ...(j.werbungskosten || {}) }; kats.forEach(k => { const c = wkCell(j, k.key); wk[k.key] = { betrag: c.betrag, anzahl: c.anzahl, anteilig: c.anteilig, aktiv: c.aktiv, [field]: val } }); return { ...j, werbungskosten: wk } })
  const aktivCount = kats.filter(k => wkCell(jahr, k.key).aktiv).length

  // Neue Position direkt im Bereich: Kategorie (Objekt-Struktur) + Jahreswert in EINEM Objekt-Patch (atomar).
  const addPosition = (gruppe, { label, betrag, anzahl, anteilig }) => {
    const key = slug(label) + '_' + Math.random().toString(36).slice(2, 5)
    const cell = { betrag: num(betrag), anzahl: Math.max(1, num(anzahl) || 1), anteilig: !!anteilig, aktiv: true }
    patchObj(o => ({
      ...o,
      wkKategorien: [...(o.wkKategorien || []), { key, label, gruppe }],
      jahre: (o.jahre || []).map(j => j.jahr === jahr.jahr ? { ...j, werbungskosten: { ...(j.werbungskosten || {}), [key]: cell } } : j),
    }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Erklärung */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '11.5px', color: 'var(--text-muted)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 11px' }}>
        <span><strong style={{ color: 'var(--text)' }}>Jahresbetrag = Einzelbetrag × Anzahl</strong>. Linker Haken = ansetzen, Haken rechts = nur anteilig (Schlüssel <strong style={{ color: PERM }}>{pct(anteil)}</strong>).</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span>Ansetzen: <button onClick={() => setAll('aktiv', true)} style={{ ...iconBtn, fontSize: '11px', color: '#16a34a' }}>alle</button> / <button onClick={() => setAll('aktiv', false)} style={{ ...iconBtn, fontSize: '11px', color: 'var(--text-muted)' }}>keine</button></span>
          <span>Anteilig: <button onClick={() => setAll('anteilig', true)} style={{ ...iconBtn, fontSize: '11px', color: 'var(--accent)' }}>alle</button> / <button onClick={() => setAll('anteilig', false)} style={{ ...iconBtn, fontSize: '11px', color: 'var(--accent)' }}>voll</button></span>
        </span>
      </div>

      {/* Spaltenkopf */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--text-muted)', padding: '0 4px' }}>
        <span style={{ width: '15px', textAlign: 'center' }} title="ansetzen">✓</span>
        <span style={{ flex: 1 }}>Werbungskosten</span>
        <span style={{ width: '78px', textAlign: 'right' }}>Einzelbetrag</span>
        <span style={{ width: '44px', textAlign: 'center' }}>Anzahl</span>
        <span style={{ width: '84px', textAlign: 'right' }}>Jahresbetrag</span>
        <span style={{ width: '52px', textAlign: 'center' }}>Aufteil.</span>
        <span style={{ width: '90px', textAlign: 'right' }}>steuerlich</span>
      </div>

      {grouped.map(({ gruppe, cats }) => {
        const g = WK_GRUPPEN[gruppe]
        let gs = 0
        cats.forEach(k => { const c = wkCell(jahr, k.key); if (c.aktiv) { const jb = wkJahresbetrag(c); gs += c.anteilig ? jb * anteil : jb } })
        return (
          <div key={gruppe} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', padding: '5px 4px', borderBottom: `1px solid ${g.color}33` }}>
              <span style={{ fontSize: '13px' }}>{g.icon}</span>
              <strong style={{ fontSize: '11px', color: g.color, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{g.label}</strong>
              <span style={{ marginLeft: 'auto', fontSize: '11.5px', color: 'var(--text-muted)' }}>steuerlich <strong style={{ color: '#ef4444' }}>{eur(gs)}</strong></span>
            </div>
            {cats.map(k => {
              const { betrag, anzahl, anteilig, aktiv } = wkCell(jahr, k.key)
              const jb = betrag * anzahl
              const stx = anteilig ? jb * anteil : jb
              return (
                <div key={k.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 4px', opacity: aktiv ? 1 : 0.55 }}>
                  <input type="checkbox" checked={aktiv} onChange={e => setCell(k.key, { aktiv: e.target.checked })} title={aktiv ? 'Wird angesetzt – zum Ausschließen abwählen' : 'Kein Ansatz – zum Berücksichtigen anhaken'} style={{ width: '15px', height: '15px', accentColor: '#16a34a', cursor: 'pointer', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-secondary)', textDecoration: aktiv ? 'none' : 'line-through' }}>{k.label}</span>
                  <span style={{ width: '78px', display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}>
                    <input inputMode="decimal" defaultValue={betrag ? String(betrag).replace('.', ',') : ''} onBlur={e => setCell(k.key, { betrag: num(e.target.value) })} placeholder="0,00" style={{ ...inputCss, width: '58px', textAlign: 'right' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>€</span>
                  </span>
                  <span style={{ width: '44px', display: 'flex', justifyContent: 'center' }}>
                    <input inputMode="numeric" defaultValue={anzahl} onBlur={e => setCell(k.key, { anzahl: Math.max(0, num(e.target.value)) })} title="Anzahl der Zahlungen (1 = einmalig · 4 = quartalsweise · 12 = monatlich …)" style={{ ...inputCss, width: '40px', textAlign: 'center' }} />
                  </span>
                  <span style={{ width: '84px', textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>{eur(jb)}</span>
                  <span style={{ width: '52px', display: 'flex', justifyContent: 'center' }}>
                    <input type="checkbox" checked={anteilig} disabled={!aktiv} onChange={e => setCell(k.key, { anteilig: e.target.checked })} title={`anteilig ${pct(anteil)} ansetzen`} style={{ width: '15px', height: '15px', accentColor: ACCENT, cursor: aktiv ? 'pointer' : 'not-allowed' }} />
                  </span>
                  <span style={{ width: '90px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: !aktiv ? 'var(--text-muted)' : (anteilig && anteilAktiv ? ACCENT : 'var(--text)') }}>{aktiv ? eur(stx) : '—'}</span>
                </div>
              )
            })}
            <WkAddRow gruppe={gruppe} anteilDefault={anteilAktiv} onAdd={addPosition} />
          </div>
        )
      })}

      <div style={{ borderTop: '1px solid var(--border)', marginTop: '4px', paddingTop: '8px', display: 'flex', gap: '18px', justifyContent: 'flex-end', flexWrap: 'wrap', fontSize: '13px', alignItems: 'center' }}>
        <span style={{ marginRight: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>{aktivCount} von {kats.length} Positionen angesetzt</span>
        <span style={{ color: 'var(--text-muted)' }}>Jahresbetrag (angesetzt) <strong style={{ color: 'var(--text)' }}>{eur(gesamt)}</strong></span>
        <span style={{ fontWeight: 800 }}>steuerlich anzusetzen <span style={{ color: '#ef4444' }}>{eur(steuerlich)}</span></span>
      </div>
    </div>
  )
}

function RueckfragenEditor({ jahr, patch }) {
  const list = jahr.rueckfragen || []
  const add = () => patch(j => ({ ...j, rueckfragen: [...(j.rueckfragen || []), mkRueckfrage()] }))
  const upd = (id, k, v) => patch(j => ({ ...j, rueckfragen: j.rueckfragen.map(r => r.id === id ? { ...r, [k]: v } : r) }))
  const del = (id) => patch(j => ({ ...j, rueckfragen: j.rueckfragen.filter(r => r.id !== id) }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      {list.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Keine Rückfragen für dieses Jahr.</div>}
      {list.map(r => (
        <div key={r.id} style={{ display: 'flex', gap: '7px', alignItems: 'flex-start' }}>
          <button onClick={() => upd(r.id, 'beantwortet', !r.beantwortet)} title={r.beantwortet ? 'Als offen markieren' : 'Als beantwortet markieren'}
            style={{ ...iconBtn, color: r.beantwortet ? '#16a34a' : 'var(--text-muted)', fontSize: '15px', paddingTop: '5px' }}>{r.beantwortet ? '☑' : '☐'}</button>
          <textarea value={r.text} onChange={e => upd(r.id, 'text', e.target.value)} rows={1} placeholder="Rückfrage an den Mandanten…" style={{ ...inputCss, flex: 1, resize: 'vertical', textDecoration: r.beantwortet ? 'line-through' : 'none', opacity: r.beantwortet ? 0.6 : 1 }} />
          <button onClick={() => del(r.id)} style={{ ...iconBtn, color: '#ef4444', paddingTop: '5px' }}>🗑</button>
        </div>
      ))}
      <button onClick={add} style={{ ...btnGhost, alignSelf: 'flex-start' }}>+ Rückfrage</button>
    </div>
  )
}

// Hinweis-Zeile für dauerhafte (jahresübergreifende) Bereiche
function PermHint({ text = 'Diese Angaben gelten dauerhaft – einmal pflegen, gilt für alle Steuerjahre.' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)', padding: '0 2px' }}>
      <Badge kind="perm" /><span>{text}</span>
    </div>
  )
}

// ── Jahresübersicht (Ampel-Strip) ─────────────────────────────────────────────
function JahresUebersicht({ obj, selectedJahr, onSelect, onAddJahr }) {
  const jahre = [...(obj.jahre || [])].sort((a, b) => a.jahr - b.jahr)
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
      {jahre.map(j => {
        const st = JAHR_STATUS[j.status] || JAHR_STATUS.in_bearbeitung
        const active = j.jahr === selectedJahr
        return (
          <button key={j.jahr} onClick={() => onSelect(j.jahr)} title={st.label}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 13px', borderRadius: '9px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
              border: `1.5px solid ${active ? ACCENT : st.color + '55'}`, background: active ? 'rgba(180,83,9,0.12)' : st.bg, color: active ? ACCENT : 'var(--text)' }}>
            <span>{st.icon}</span>{j.jahr}
          </button>
        )
      })}
      <button onClick={onAddJahr} style={{ ...btnPrimary, padding: '6px 13px' }}>+ Steuerjahr</button>
    </div>
  )
}

// ── Dialog: neues Steuerjahr (mit Vorjahres-Übernahme) ────────────────────────
function NeuesJahrDialog({ obj, onClose, onCreate }) {
  const existing = new Set((obj.jahre || []).map(j => j.jahr))
  const prevJahre = [...(obj.jahre || [])].map(j => j.jahr).sort((a, b) => b - a)
  const defaultJahr = (prevJahre[0] ? prevJahre[0] + 1 : CURRENT_YEAR)
  const [jahr, setJahr] = useState(defaultJahr)
  const [uebernehmen, setUebernehmen] = useState(prevJahre.length > 0)
  const [quelle, setQuelle] = useState(prevJahre[0] ?? null)
  const konflikt = existing.has(Number(jahr))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', width: '440px', maxWidth: '100%', overflow: 'hidden' }}>
        <div style={{ background: ACCENT, color: '#fff', padding: '11px 15px', fontWeight: 700, fontSize: '13.5px' }}>📅 Neues Steuerjahr anlegen</div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label style={labelCss}><span>Steuerjahr</span>
            <input type="number" value={jahr} onChange={e => setJahr(e.target.value)} style={{ ...inputCss, width: '120px' }} />
          </label>
          {konflikt && <div style={{ fontSize: '12px', color: '#ef4444' }}>⚠ Für {jahr} existiert bereits ein Datensatz.</div>}

          {prevJahre.length > 0 && (
            <div style={{ border: '1px solid rgba(37,99,235,0.3)', background: 'rgba(37,99,235,0.05)', borderRadius: '9px', padding: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', cursor: 'pointer' }}>
                <input type="checkbox" checked={uebernehmen} onChange={e => setUebernehmen(e.target.checked)} style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: PERM, cursor: 'pointer' }} />
                <span style={{ fontSize: '12.5px', lineHeight: 1.5 }}>
                  <strong>Vorjahresdaten übernehmen</strong> aus{' '}
                  <select value={quelle ?? ''} onChange={e => setQuelle(Number(e.target.value))} style={{ ...inputCss, width: 'auto', display: 'inline-block', padding: '2px 6px' }} onClick={e => e.stopPropagation()}>
                    {prevJahre.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <br />
                  <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>
                    Übernommen werden Mieteinnahmen, Werbungskosten-Beträge, Besonderheiten & Notizen als bearbeitbarer Startwert.
                    Stammdaten, Darlehen, Dokumente & Werbungskosten-Struktur gelten ohnehin dauerhaft.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={btnGhost}>Abbrechen</button>
            <button disabled={konflikt || !jahr} onClick={() => onCreate(Number(jahr), uebernehmen ? quelle : null)}
              style={{ ...btnPrimary, opacity: (konflikt || !jahr) ? 0.5 : 1, cursor: (konflikt || !jahr) ? 'not-allowed' : 'pointer' }}>
              Jahr anlegen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  OBJEKT-DETAIL
// ══════════════════════════════════════════════════════════════════════════════
const OBJ_TABS = [
  { id: 'stammdaten',     label: 'Stammdaten',      icon: '🏠', kind: 'perm' },
  { id: 'einheiten',      label: 'Einheiten',       icon: '🔑', kind: 'perm' },
  { id: 'einnahmen',      label: 'Einnahmen',       icon: '💶', kind: 'jahr' },
  { id: 'werbungskosten', label: 'Werbungskosten',  icon: '🧾', kind: 'jahr' },
  { id: 'dokumente',      label: 'Dokumente',       icon: '📁', kind: 'perm' },
  { id: 'rueckfragen',    label: 'Rückfragen',      icon: '❓', kind: 'jahr' },
  { id: 'besonderheiten', label: 'Besonderheiten',  icon: '📝', kind: 'jahr' },
  { id: 'uebersicht',     label: 'Jahresübersicht', icon: '📊', kind: 'overview' },
]

function ObjektDetail({ obj, patch, onDelete, onBack }) {
  const [selectedJahr, setSelectedJahr] = useState(() => { const ys = (obj.jahre || []).map(j => j.jahr); return ys.length ? Math.max(...ys) : null })
  const [showNeuesJahr, setShowNeuesJahr] = useState(false)
  const [tab, setTab] = useState(() => { try { return localStorage.getItem('immo-tab-' + obj.id) || 'stammdaten' } catch { return 'stammdaten' } })
  useEffect(() => { try { localStorage.setItem('immo-tab-' + obj.id, tab) } catch {} }, [tab, obj.id])
  useEffect(() => {
    const ys = (obj.jahre || []).map(j => j.jahr)
    if (selectedJahr == null && ys.length) setSelectedJahr(Math.max(...ys))
    if (selectedJahr != null && ys.length && !ys.includes(selectedJahr)) setSelectedJahr(Math.max(...ys))
  }, [obj.jahre, selectedJahr])

  function addJahr(jahr, quelleJahr) {
    const prev = quelleJahr != null ? (obj.jahre || []).find(j => j.jahr === quelleJahr) : null
    patch(o => ({ ...o, jahre: [...(o.jahre || []), mkJahr(jahr, prev)] }))
    setSelectedJahr(jahr); setShowNeuesJahr(false)
  }
  function deleteJahr(jahr) {
    if (!window.confirm(`Steuerjahr ${jahr} wirklich löschen? Die Stammdaten der Immobilie bleiben erhalten.`)) return
    patch(o => ({ ...o, jahre: (o.jahre || []).filter(j => j.jahr !== jahr) }))
  }
  const patchJahr = (updater) => patch(o => ({ ...o, jahre: (o.jahre || []).map(j => j.jahr === selectedJahr ? updater(j) : j) }))
  const aktJahr = (obj.jahre || []).find(j => j.jahr === selectedJahr) || null
  const cur = OBJ_TABS.find(t => t.id === tab) || OBJ_TABS[0]
  const isJahrTab = cur.kind === 'jahr'

  const einnahmen = aktJahr ? jahrEinnahmen(aktJahr).total : 0
  const wk = aktJahr ? jahrWerbungskosten(aktJahr, obj) : { steuerlich: 0 }
  const ergebnis = einnahmen - wk.steuerlich

  const emptyJahr = (
    <div style={{ ...cardCss, padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '30px', marginBottom: '8px' }}>📅</div>
      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '4px' }}>Noch kein Steuerjahr angelegt</div>
      <div style={{ fontSize: '12px', marginBottom: '14px' }}>Dieser Bereich ist jahresbezogen – lege zuerst ein Steuerjahr an.</div>
      <button onClick={() => setShowNeuesJahr(true)} style={btnPrimary}>+ Erstes Steuerjahr anlegen</button>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Kopf */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={btnGhost}>← Alle Objekte</button>
        <span style={{ fontSize: '22px' }}>{obj.icon}</span>
        <input value={obj.bezeichnung} onChange={e => patch(o => ({ ...o, bezeichnung: e.target.value }))}
          style={{ ...inputCss, fontSize: '16px', fontWeight: 700, width: 'auto', minWidth: '200px', flex: 1 }} />
        <button onClick={onDelete} style={{ ...btnGhost, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} title="Immobilie löschen">🗑 Objekt löschen</button>
      </div>

      {/* Tab-Navigation – bricht bei zu vielen Punkten in die nächste Zeile um (kein horizontales Scrollen) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', borderBottom: '1px solid var(--border)' }}>
        {OBJ_TABS.map(t => {
          const active = t.id === tab
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', whiteSpace: 'nowrap',
              border: 'none', background: active ? 'rgba(180,83,9,0.08)' : 'transparent', cursor: 'pointer',
              color: active ? ACCENT : 'var(--text-secondary)', fontWeight: active ? 700 : 500, fontSize: '12.5px',
              borderBottom: `2px solid ${active ? ACCENT : 'transparent'}`, marginBottom: '-1px', borderRadius: '7px 7px 0 0',
            }}>
              <span>{t.icon}</span>{t.label}
            </button>
          )
        })}
      </div>

      {/* Steuerjahr-Kontextleiste (nur jahresbezogene Tabs) */}
      {isJahrTab && (obj.jahre || []).length > 0 && (
        <div style={{ ...cardCss, padding: '10px 13px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Steuerjahr</span>
            <JahresUebersicht obj={obj} selectedJahr={selectedJahr} onSelect={setSelectedJahr} onAddJahr={() => setShowNeuesJahr(true)} />
          </div>
          {aktJahr && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Stand:</span>
                <select value={aktJahr.status} onChange={e => patchJahr(j => ({ ...j, status: e.target.value }))} style={{ ...inputCss, width: 'auto' }}>
                  {STATUS_ORDER.map(s => <option key={s} value={s}>{JAHR_STATUS[s].icon} {JAHR_STATUS[s].label}</option>)}
                </select>
              </label>
              {aktJahr.uebernommenAus && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>↴ aus {aktJahr.uebernommenAus}</span>}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '14px', fontSize: '12px', flexWrap: 'wrap' }}>
                <span>Einnahmen <strong style={{ color: '#16a34a' }}>{eur(einnahmen)}</strong></span>
                <span>WK (steuerl.) <strong style={{ color: '#ef4444' }}>{eur(wk.steuerlich)}</strong></span>
                <span>Überschuss <strong style={{ color: ergebnis >= 0 ? '#16a34a' : '#ef4444' }}>{eur(ergebnis)}</strong></span>
              </div>
              <button onClick={() => deleteJahr(aktJahr.jahr)} style={{ ...iconBtn, color: '#ef4444', fontSize: '11px' }}>🗑 Jahr</button>
            </div>
          )}
        </div>
      )}

      {/* Inhalt des aktiven Tabs */}
      <div>
        {tab === 'stammdaten' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <PermHint />
            <Section icon="🏠" title="Allgemeine Angaben" kind="perm" defaultOpen><AllgemeinEditor obj={obj} patch={patch} /></Section>
            <Section icon="💰" title="Anschaffung" kind="perm"><AnschaffungEditor obj={obj} patch={patch} /></Section>
            <Section icon="🏦" title="Finanzierung / Darlehen" kind="perm"><DarlehenEditor obj={obj} patch={patch} /></Section>
          </div>
        )}
        {tab === 'einheiten' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <PermHint text="Einheiten & Mieter gelten dauerhaft – sie bilden die Grundlage der jährlichen Einnahmen." />
            <div style={{ ...cardCss, padding: '13px' }}><VermietungEditor obj={obj} patch={patch} /></div>
          </div>
        )}
        {tab === 'dokumente' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <PermHint text="Dokumente werden dauerhaft bei der Immobilie gespeichert." />
            <div style={{ ...cardCss, padding: '13px' }}><DokumenteEditor obj={obj} patch={patch} /></div>
          </div>
        )}
        {tab === 'einnahmen' && (aktJahr ? <div style={{ ...cardCss, padding: '13px' }}><EinnahmenBlock jahr={aktJahr} obj={obj} patch={patchJahr} /></div> : emptyJahr)}
        {tab === 'werbungskosten' && (aktJahr ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <div style={{ ...cardCss, padding: '13px' }}><WerbungskostenEditor jahr={aktJahr} obj={obj} patch={patchJahr} patchObj={patch} /></div>
            <Section icon="📊" title="Werbungskosten-Struktur bearbeiten" kind="perm"><WkKategorienEditor obj={obj} patch={patch} /></Section>
          </div>
        ) : emptyJahr)}
        {tab === 'rueckfragen' && (aktJahr ? <div style={{ ...cardCss, padding: '13px' }}><RueckfragenEditor jahr={aktJahr} patch={patchJahr} /></div> : emptyJahr)}
        {tab === 'besonderheiten' && (aktJahr ? (
          <div style={{ ...cardCss, padding: '13px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Area label="Besonderheiten" value={aktJahr.besonderheiten} onCommit={v => patchJahr(j => ({ ...j, besonderheiten: v }))} placeholder="z. B. Leerstand, Mieterwechsel, größere Reparatur…" />
            <Area label="Interne Notizen" value={aktJahr.notizen} onCommit={v => patchJahr(j => ({ ...j, notizen: v }))} placeholder="Notizen zur Bearbeitung…" />
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              🏦 <strong style={{ color: 'var(--text)' }}>Kontoauszüge (vorbereitet):</strong> Hier wirst du künftig Kontoauszüge einlesen und Zahlungen den Einnahmen/Werbungskosten zuordnen können.
            </div>
          </div>
        ) : emptyJahr)}
        {tab === 'uebersicht' && (
          <div style={{ ...cardCss, padding: '13px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <JahresUebersicht obj={obj} selectedJahr={selectedJahr} onSelect={setSelectedJahr} onAddJahr={() => setShowNeuesJahr(true)} />
            {(obj.jahre || []).length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead><tr style={{ color: 'var(--text-muted)', textAlign: 'left', fontSize: '10.5px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '6px 8px' }}>Jahr</th><th style={{ padding: '6px 8px' }}>Status</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Einnahmen</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>WK (steuerl.)</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Überschuss / Verlust</th>
                  </tr></thead>
                  <tbody>
                    {[...(obj.jahre || [])].sort((a, b) => b.jahr - a.jahr).map(j => {
                      const e = jahrEinnahmen(j).total, w = jahrWerbungskosten(j, obj).steuerlich, g = e - w
                      const st = JAHR_STATUS[j.status] || JAHR_STATUS.in_bearbeitung
                      return (
                        <tr key={j.jahr} onClick={() => { setSelectedJahr(j.jahr); setTab('einnahmen') }} style={{ cursor: 'pointer', borderTop: '1px solid var(--border)' }} title="Öffnen">
                          <td style={{ padding: '7px 8px', fontWeight: 700 }}>{j.jahr}</td>
                          <td style={{ padding: '7px 8px', color: st.color }}>{st.icon} {st.kurz}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: '#16a34a' }}>{eur(e)}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: '#ef4444' }}>{eur(w)}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: g >= 0 ? '#16a34a' : '#ef4444' }}>{eur(g)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Noch keine Steuerjahre angelegt.</div>}
          </div>
        )}
      </div>

      {showNeuesJahr && <NeuesJahrDialog obj={obj} onClose={() => setShowNeuesJahr(false)} onCreate={addJahr} />}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  OBJEKT-LISTE
// ══════════════════════════════════════════════════════════════════════════════
function ObjektKarte({ obj, onOpen }) {
  const jahre = [...(obj.jahre || [])].sort((a, b) => a.jahr - b.jahr)
  const a = obj.allgemein || {}
  return (
    <button onClick={onOpen} style={{ textAlign: 'left', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '24px' }}>{obj.icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)' }}>{obj.bezeichnung}</div>
          {a.anschrift && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.anschrift}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {jahre.length === 0 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Noch kein Steuerjahr</span>}
        {jahre.map(j => {
          const st = JAHR_STATUS[j.status] || JAHR_STATUS.in_bearbeitung
          return <span key={j.jahr} style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: st.bg, color: st.color, border: `1px solid ${st.color}33` }}>{st.icon} {j.jahr}</span>
        })}
      </div>
    </button>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  HAUPT-TAB
// ══════════════════════════════════════════════════════════════════════════════
export default function ImmobilienTab({ client, onUpdate }) {
  const immobilien = client.immobilien ?? []
  const [openId, setOpenId] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')

  const save = (list) => onUpdate({ immobilien: list })
  const patchObjekt = (id, updater) => save(immobilien.map(o => o.id === id ? updater(o) : o))

  function addObjekt() {
    const name = newName.trim() || 'Neue Immobilie'
    const obj = mkImmobilie(name)
    save([...immobilien, obj])
    setNewName(''); setShowNew(false); setOpenId(obj.id)
  }
  function deleteObjekt(id) {
    const obj = immobilien.find(o => o.id === id)
    if (!window.confirm(`Immobilie „${obj?.bezeichnung}" mit allen Stammdaten und Steuerjahren wirklich löschen?`)) return
    save(immobilien.filter(o => o.id !== id))
    setOpenId(null)
  }

  const openObj = immobilien.find(o => o.id === openId) || null

  return (
    <div style={{ padding: '20px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' }}>
      {/* Kopf */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>🏠 Immobilien</h2>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '20px', padding: '1px 9px' }}>
          {immobilien.length} Objekt{immobilien.length !== 1 ? 'e' : ''} · Vermietung & Verpachtung (Anlage V)
        </span>
        {!openObj && (
          <button onClick={() => setShowNew(v => !v)} style={{ ...btnPrimary, marginLeft: 'auto' }}>+ Immobilie</button>
        )}
      </div>

      {/* Neu-Anlegen */}
      {!openObj && showNew && (
        <div style={{ ...cardCss, padding: '14px', marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ ...labelCss, flex: 1, minWidth: '220px' }}><span>Objektbezeichnung</span>
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addObjekt() }} placeholder="z. B. Musterstraße 15, Ferienwohnung Sylt…" style={inputCss} autoFocus />
          </label>
          <button onClick={addObjekt} style={btnPrimary}>Anlegen</button>
          <button onClick={() => { setShowNew(false); setNewName('') }} style={btnGhost}>Abbrechen</button>
        </div>
      )}

      {/* Inhalt */}
      {openObj ? (
        <ObjektDetail
          obj={openObj}
          patch={(updater) => patchObjekt(openObj.id, updater)}
          onDelete={() => deleteObjekt(openObj.id)}
          onBack={() => setOpenId(null)}
        />
      ) : immobilien.length === 0 && !showNew ? (
        <div style={{ ...cardCss, padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '38px', marginBottom: '12px' }}>🏠</div>
          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text)', marginBottom: '6px' }}>Noch keine Immobilie angelegt</div>
          <div style={{ fontSize: '12.5px', marginBottom: '16px', lineHeight: 1.6, maxWidth: '460px', marginInline: 'auto' }}>
            Lege deine erste Immobilie an. Die Stammdaten (Anschaffung, Darlehen, Dokumente…) pflegst du
            <strong> einmal dauerhaft</strong> – die Anlage V baust du dann Jahr für Jahr darauf auf.
          </div>
          <button onClick={() => setShowNew(true)} style={btnPrimary}>+ Erste Immobilie anlegen</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
          {immobilien.map(o => <ObjektKarte key={o.id} obj={o} onOpen={() => setOpenId(o.id)} />)}
        </div>
      )}
    </div>
  )
}
