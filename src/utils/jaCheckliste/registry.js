/*
 * registry.js – Fachlogik der Jahresabschluss-Checkliste (nativ portiert aus
 * dem Prototyp „Jahresabschluss-Checklisten.html"). Framework-frei: nur reine
 * Funktionen + die Modul-Registry (MODULE). Die React-Komponente rendert diese
 * datengetrieben. KEINE DOM-Zugriffe hier.
 */

// ── Helfer ──────────────────────────────────────────────────────────────────
export const eur = n => (isFinite(n) ? n : 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
export const num = v => {
  v = (v == null ? '' : v).toString().trim().replace(/[\s€]/g, '')
  if (!v) return 0
  if (v.indexOf(',') > -1) v = v.replace(/\./g, '').replace(',', '.')
  return parseFloat(v) || 0
}
export const tage = (a, b) => Math.round((b - a) / 86400000) + 1

// Stichtag (31.12. des Wirtschaftsjahres) – von der Komponente setzbar.
let _stichtag = new Date('2025-12-31')
export const setStichtag = (jahr) => { const j = parseInt(jahr, 10); if (j >= 2000 && j <= 2100) _stichtag = new Date(j + '-12-31') }
export const getStichtag = () => _stichtag

export const STATUS = {
  offen:  ['st-offen',  'Offen'],
  arbeit: ['st-arbeit', 'In Arbeit'],
  rueck:  ['st-rueck',  'Rückfrage'],
  ok:     ['st-ok',     'Erledigt'],
  korr:   ['st-korr',   'Korrekturbedarf'],
}

// Fortlaufende ID (kollisionsfrei, kein Date.now im Sync-Aufbau)
let _uc = 0
export const uid = () => 'p' + (Date.now().toString(36)) + (++_uc)

// ── Vorgelagerter Bereich „Auftrag & Rahmen" ──────────────────────────────────
export const AUFTRAG = [
  { gruppe: 'Auftrag & Umfang', items: [
    { k: 'bilanzart', typ: 'choice', label: 'Bilanz', opt: [['einheit', 'Einheitsbilanz'], ['eigen', 'eigene Steuerbilanz']] },
    { k: 'feststellung', label: 'Gesonderte Feststellungserklärung' },
    { k: 'eroeffnung', label: 'Eröffnungsbilanz berücksichtigen' },
    { k: 'estBetrieb', label: 'Betriebliche Steuererklärungen' },
    { k: 'estPrivat', label: 'Private Steuererklärungen' },
    { k: 'ebilanz', label: 'E-Bilanz' },
    { k: 'offenlegung', label: 'Offenlegung / Hinterlegung' },
    { k: 'anhang', label: 'Anhang erforderlich' },
    { k: 'betriebsaufgabe', label: 'Betriebsaufgabe / Wechsel der Gewinnermittlung' },
  ] },
  { gruppe: 'Vorsysteme & Besonderheiten', items: [
    { k: 'buchfuehrung', typ: 'choice', label: 'Buchführung', opt: [['mandant', 'Selbstbucher'], ['kanzlei', 'wir buchen']] },
    { k: 'bp', label: 'Laufende Betriebsprüfung beachten' },
    { k: 'rechtsbehelf', label: 'Offene Rechtsbehelfe beachten' },
    { k: 'import', label: 'Externer Datenimport' },
    { k: 'vertraege', label: 'Verträge zu berücksichtigen' },
    { k: 'gruender', label: 'Existenzgründer' },
  ] },
]

// ── Kfz-Fachhelfer (versioniert) ──────────────────────────────────────────────
// Begünstigungsfaktor für die Listenpreis-Werte (1 %, 0,03 %, 0,002 %).
// Wirkt NUR ertragsteuerlich – NIE auf die umsatzsteuerliche Bemessungsgrundlage.
// art: verbrenner | mildhybrid | hybrid | elektro | brennstoff | sonstiges
export function kfzFaktor(art, blpAbg, datum, opt = {}) {
  const d = datum instanceof Date ? datum : (datum ? new Date(datum) : getStichtag())
  if (!art || art === 'verbrenner' || art === 'sonstiges')
    return { f: 1, label: '1 % (Verbrenner)', quelle: '§ 6 Abs. 1 Nr. 4 S. 2 EStG' }
  if (art === 'mildhybrid')
    return { f: 1, label: '1 % (Mild-Hybrid – nicht begünstigt)', quelle: '§ 6 Abs. 1 Nr. 4 S. 2 EStG' }
  if (d < new Date('2019-01-01'))
    return { f: 1, label: '1 % (Altfall vor 2019)', warn: 'Anschaffung vor 2019: Batterie-Nachteilsausgleich (kWh-Abzug/Höchstbetrag) nach § 6 Abs. 1 Nr. 4 EStG a. F. gesondert ermitteln.', quelle: '§ 6 Abs. 1 Nr. 4 EStG a. F.' }
  if (art === 'elektro' || art === 'brennstoff') {
    if (d < new Date('2020-01-01')) return { f: 0.5, label: '0,5 % (BEV 2019)', quelle: '§ 6 Abs. 1 Nr. 4 S. 2 EStG (2019: Halbierung)' }
    const grenze = d >= new Date('2025-07-01') ? 100000 : (d >= new Date('2024-01-01') ? 70000 : 60000)
    return blpAbg <= grenze
      ? { f: 0.25, label: '0,25 % (BEV, BLP ≤ ' + eur(grenze) + ')', quelle: '§ 6 Abs. 1 Nr. 4 S. 3 EStG' }
      : { f: 0.5, label: '0,5 % (BEV, BLP > ' + eur(grenze) + ')', quelle: '§ 6 Abs. 1 Nr. 4 S. 2 EStG' }
  }
  if (art === 'hybrid') {
    const co2 = num(opt.co2), rw = num(opt.reichweite)
    const need = d < new Date('2022-01-01') ? 40 : (d < new Date('2025-01-01') ? 60 : 80)
    const ok = (co2 > 0 && co2 <= 50) || rw >= need
    return ok
      ? { f: 0.5, label: '0,5 % (PHEV begünstigt)', quelle: '§ 6 Abs. 1 Nr. 4 S. 2 EStG' }
      : { f: 1, label: '1 % (PHEV nicht begünstigt)', warn: 'PHEV: CO₂ ≤ 50 g/km oder elektrische Mindestreichweite ≥ ' + need + ' km nicht erfüllt → voller 1-%-Ansatz.', quelle: '§ 6 Abs. 1 Nr. 4 S. 2 EStG' }
  }
  return { f: 1, label: '1 %' }
}

// Abziehbare Entfernungspauschale (Betrag) für die 0,03-%-/0,002-%-Gegenrechnung.
// 2026: 0,38 €/km ab dem 1. km; Vorjahre gestaffelt (0,30 € km 1–20, 0,38 € ab 21).
export function entfPauschale(km, tage, jahr) {
  km = Math.max(0, Math.floor(num(km))); tage = Math.max(0, num(tage))
  if (!km || !tage) return 0
  const proTag = jahr >= 2026 ? km * 0.38 : (Math.min(km, 20) * 0.30 + Math.max(0, km - 20) * 0.38)
  return Math.round(tage * proTag * 100) / 100
}

// Strompreispauschale für selbst getragenen Ladestrom (§ 3 Nr. 50 EStG, BMF 21.7.2026).
// €/kWh = auf volle Cent abgerundeter Destatis-Gesamtdurchschnittspreis des 1. Halbjahrs
// des Vorjahres (Haushalte 5.000–15.000 kWh). Gilt für WJ ab 1.1.2026.
export const STROMPAUSCHALE = { 2026: 0.34 }

// Kfz-Privatnutzung: DATEV-Konten je Kontenrahmen (Dok. 5301656, Verbrenner/Unternehmer).
// gegen = Gegenkonto (unentgeltl. Wertabgabe), mitUst = Automatikkonto 19 % (Brutto),
// ohneUst = Konto ohne USt (20 %-/nicht vorsteuerbelasteter Anteil), ust = USt-Sammelkonto.
export const KFZ_KONTEN = {
  '03': { gegen: '1880', mitUst: '8921', ohneUst: '8924', ust: '1776' },
  '04': { gegen: '2130', mitUst: '4645', ohneUst: '4639', ust: '3806' },
}

// Gewerbesteuer: DATEV-Konten je Kontenrahmen (Dok. 5305413).
// gewst=Aufwand, rueck=Rückstellung §4(5b), aufloesung=Ertrag Auflösung Rückstellung,
// vorjahr=Nachzahlung/Erstattung Vorjahre §4(5b), forderung=Forderung Überzahlung,
// verb=Verbindlichkeit Steuern (RLZ ≤ 1 J.), bank=Bank.
export const GEWST_KONTEN = {
  '03': { gewst: '4320', rueck: '0956', aufloesung: '2283', vorjahr: '2281', forderung: '1540', verb: '1737', bank: '1200' },
  '04': { gewst: '7610', rueck: '3035', aufloesung: '7643', vorjahr: '7641', forderung: '1435', verb: '3701', bank: '1800' },
}

// ── Modul-Registry (Typ C = Fachanwendungen) ──────────────────────────────────
export const MODULE = {
  bewirtung: { name: 'Bewirtungsaufwendungen', bereich: 'ba', typ: 'C',
    felder: [{ k: 'anlass', l: 'Anlass / bewirtete Personen', t: 'text' }, { k: 'gaeste', l: 'Anzahl Teilnehmer', t: 'num' },
             { k: 'betrag', l: 'Betrag netto', t: 'num' },
             { k: 'kAbz', l: 'Konto abziehbar', t: 'text', def: '4650' }, { k: 'kNab', l: 'Konto nicht abziehbar', t: 'text', def: '4654' }],
    rechnen: w => { const b = num(w.betrag), abz = b * 0.7, nab = b * 0.3, g = num(w.gaeste)
      const erg = [{ l: 'Bewirtungsaufwand netto', v: b }, { l: '70 % abziehbar', v: abz, stark: 1 }, { l: '30 % nicht abziehbar', v: nab }]
      if (g > 0) erg.push({ l: 'Aufwand je Teilnehmer (' + g + ')', v: Math.round(b / g * 100) / 100 })
      return { ergebnisse: erg, total: { l: 'Als Betriebsausgabe abziehbar', v: abz },
        buchungen: [{ s: w.kAbz || '4650', st: 'Bewirtung abziehbar', h: '', ht: '', betr: abz, text: 'Bewirtung 70% – ' + (w.anlass || '') },
                    { s: w.kNab || '4654', st: 'Bewirtung n. abz.', h: '', ht: '', betr: nab, text: 'Bewirtung 30% – ' + (w.anlass || '') }] } } },
  rap: { name: 'Rechnungsabgrenzung (aktiv)', bereich: 'ba', typ: 'C', positionen: true,
    posFelder: [{ k: 'bez', l: 'Bezeichnung', t: 'text' }, { k: 'betrag', l: 'Betrag gesamt', t: 'num' },
               { k: 'beginn', l: 'Beginn', t: 'date' }, { k: 'ende', l: 'Ende', t: 'date' }, { k: 'kAufw', l: 'Aufwandskonto', t: 'text', def: '4360' }],
    rechnen: w => { const pos = (w._pos || []); let sumRap = 0, sumAufw = 0; const buchungen = []; const detail = []
      const STICHTAG = _stichtag
      pos.forEach(p => { const b = num(p.betrag); if (!b || !p.beginn || !p.ende) return
        const A = new Date(p.beginn), E = new Date(p.ende); const ges = Math.max(1, tage(A, E))
        const nach = Math.max(0, tage(STICHTAG < A ? A : new Date(STICHTAG.getTime() + 86400000), E))
        const rap = Math.round(b * Math.min(nach, ges) / ges * 100) / 100; const aufw = Math.round((b - rap) * 100) / 100
        sumRap += rap; sumAufw += aufw; detail.push({ l: (p.bez || 'Position') + ' – aktiver RAP', v: rap })
        if (rap > 0) buchungen.push({ s: '1900', st: 'Aktive RAP', h: p.kAufw || '4360', ht: 'Aufwand', betr: rap, text: 'ARAP ' + (p.bez || '') }) })
      return { ergebnisse: [...detail, { l: 'Aufwand laufendes Jahr', v: sumAufw }],
        total: { l: 'Aktiver RAP zum ' + _stichtag.toLocaleDateString('de-DE'), v: sumRap }, buchungen } } },
  umsatzsteuer: { name: 'Umsatzsteuer-Abstimmung', bereich: 'ba', typ: 'C',
    felder: (ctx, w) => { const gw = w.gw || ctx.gw; const f = [
      { k: 'gw', l: 'Gewinnermittlung', t: 'select', opt: [['bilanz', 'Bilanzierung'], ['euer', 'EÜR (§ 4 Abs. 3)']], def: ctx.gw },
      { k: 'ust', l: 'Umsatzsteuer lt. Konten', t: 'num' },
      { k: 'vst', l: 'Vorsteuer lt. Konten', t: 'num' },
      { k: 'vzBuch', l: 'USt-Vorauszahlungen lt. Buchungskonto', t: 'num' },
      { k: 'vzFA', l: 'geleistet lt. Steuerkonto (Finanzamt)', t: 'num' }]
      if (gw === 'euer') {
        f.push({ k: 'p11', l: '§ 11 – Vorauszahlung um den Jahreswechsel (10-Tage-Regel)', t: 'select', full: true, opt: [
          ['nein', 'nicht einschlägig'],
          ['dez', 'Dez.-/Q4-Vorauszahlung bis 10.01. gezahlt → altes Jahr'],
          ['jan', 'Januar-Vorauszahlung für Dez. Vorjahr → gehört ins Vorjahr']] })
        f.push({ k: 'p11betrag', l: 'davon betroffener Betrag', t: 'num' })
      } else {
        f.push({ k: 'kForderung', l: 'Konto Forderung USt', t: 'text', def: '1548' })
        f.push({ k: 'kVerb', l: 'Konto Verbindlichkeit USt', t: 'text', def: '1790' })
      }
      return f },
    rechnen: (w, ctx) => { const gw = w.gw || ctx.gw
      const ust = num(w.ust), vst = num(w.vst), vzBuch = num(w.vzBuch), vzFA = num(w.vzFA)
      const zahllast = ust - vst, rest = zahllast - vzFA, diffKonto = vzBuch - vzFA, erstattung = rest < 0
      const erg = [{ l: 'Umsatzsteuer (Erlöse)', v: ust }, { l: 'abzüglich Vorsteuer', v: -vst },
        { l: 'Zahllast lt. Buchführung', v: zahllast, stark: 1 },
        { l: 'geleistete Vorauszahlungen (Steuerkonto)', v: -vzFA }]
      const total = { l: erstattung ? 'USt-Erstattungsanspruch' : 'USt-Restschuld ans Finanzamt', v: Math.abs(rest) }
      const hinweise = [], buchungen = []
      if (Math.abs(diffKonto) >= 0.01) hinweise.push('Buchungskonto (' + eur(vzBuch) + ') und Steuerkonto (' + eur(vzFA) + ') weichen um ' + eur(Math.abs(diffKonto)) + ' ab – Vorauszahlungen zunächst abstimmen und nachbuchen.')
      if (gw === 'bilanz') {
        if (Math.abs(rest) >= 0.01) {
          if (erstattung) buchungen.push({ s: w.kForderung || '1548', st: 'Forderung Umsatzsteuer', h: '1780', ht: 'USt-Vorauszahlungen', betr: Math.abs(rest), text: 'USt-Erstattungsanspruch zum 31.12.' })
          else buchungen.push({ s: '1780', st: 'USt-Vorauszahlungen', h: w.kVerb || '1790', ht: 'Verbindlichkeit Umsatzsteuer', betr: Math.abs(rest), text: 'USt-Restschuld zum 31.12.' })
        }
      } else {
        hinweise.push('EÜR: keine Forderung/Verbindlichkeit ausweisen – die USt wirkt sich erst bei Zahlung bzw. Erstattung als Betriebsausgabe/-einnahme aus (§ 11 EStG).')
        const b = num(w.p11betrag)
        if (w.p11 === 'dez' && b > 0) hinweise.push('10-Tage-Regel: ' + eur(b) + ' (Dez./Q4-Vorauszahlung, bis 10.01. gezahlt) sind als regelmäßig wiederkehrende Ausgabe noch dem laufenden Jahr zuzuordnen.')
        if (w.p11 === 'jan' && b > 0) hinweise.push('10-Tage-Regel: ' + eur(b) + ' (Januar-Vorauszahlung für Dez. des Vorjahres) gehören ins Vorjahr – im laufenden Jahr nicht als Betriebsausgabe erfassen.')
      }
      return { ergebnisse: erg, total, buchungen, hinweise } } },
  /* ── Betriebseinnahmen ── */
  erloeseStpfl: { name: 'Steuerpflichtige Erlöse (19 %)', bereich: 'be', typ: 'C',
    flags: [{ k: 'fPlausibel', label: 'Erlöse plausibel / mit Vorjahr abgestimmt' }, { k: 'fUst', label: 'USt-Ausweis geprüft' }],
    listen: [{ key: 'konten', label: 'Erlöskonten', rowNotes: true, felder: [{ k: 'konto', l: 'Konto', t: 'text' }, { k: 'bez', l: 'Bezeichnung', t: 'text' }, { k: 'saldo', l: 'Saldo', t: 'num' }, { k: 'vj', l: 'Vorjahr', t: 'num' }, { k: 'ok', l: 'geprüft / unauffällig', t: 'check' }] }],
    felder: [{ k: 'notiz', l: 'Notiz / Abweichungen dokumentieren', t: 'area' }] },
  erloeseErmaessigt: { name: 'Erlöse mit ermäßigtem Steuersatz (7 %)', bereich: 'be', typ: 'C',
    flags: [{ k: 'fPlausibel', label: 'Erlöse plausibel / mit Vorjahr abgestimmt' }, { k: 'fUst', label: 'Ermäßigter Satz zutreffend geprüft' }],
    listen: [{ key: 'konten', label: 'Erlöskonten', rowNotes: true, felder: [{ k: 'konto', l: 'Konto', t: 'text' }, { k: 'bez', l: 'Bezeichnung', t: 'text' }, { k: 'saldo', l: 'Saldo', t: 'num' }, { k: 'vj', l: 'Vorjahr', t: 'num' }, { k: 'ok', l: 'geprüft / unauffällig', t: 'check' }] }],
    felder: [{ k: 'notiz', l: 'Notiz / Abweichungen dokumentieren', t: 'area' }] },
  erloeseSteuerfrei: { name: 'Steuerfreie Erlöse', bereich: 'be', typ: 'C',
    flags: [{ k: 'fPlausibel', label: 'Erlöse plausibel / mit Vorjahr abgestimmt' }, { k: 'fUst', label: 'Steuerbefreiung dokumentiert (§ 4 UStG)' }],
    listen: [{ key: 'konten', label: 'Erlöskonten', rowNotes: true, felder: [{ k: 'konto', l: 'Konto', t: 'text' }, { k: 'bez', l: 'Bezeichnung', t: 'text' }, { k: 'saldo', l: 'Saldo', t: 'num' }, { k: 'vj', l: 'Vorjahr', t: 'num' }, { k: 'ok', l: 'geprüft / unauffällig', t: 'check' }] }],
    felder: [{ k: 'notiz', l: 'Notiz / Abweichungen dokumentieren', t: 'area' }] },
  erloeseAusfuhr: { name: 'Steuerfreie Umsätze (Ausfuhr / ig. Lieferungen)', bereich: 'be', typ: 'C',
    flags: [{ k: 'fPlausibel', label: 'Erlöse plausibel / mit Vorjahr abgestimmt' }, { k: 'fNachweis', label: 'Ausfuhr-/Gelangensnachweise vollständig' }, { k: 'fZm', label: 'Zusammenfassende Meldung abgestimmt' }],
    listen: [{ key: 'konten', label: 'Erlöskonten', rowNotes: true, felder: [{ k: 'konto', l: 'Konto', t: 'text' }, { k: 'bez', l: 'Bezeichnung', t: 'text' }, { k: 'saldo', l: 'Saldo', t: 'num' }, { k: 'vj', l: 'Vorjahr', t: 'num' }, { k: 'ok', l: 'geprüft / unauffällig', t: 'check' }] }],
    felder: [{ k: 'notiz', l: 'Notiz / Abweichungen dokumentieren', t: 'area' }] },
  erloese13b: { name: 'Erlöse mit Steuerschuldumkehr (§ 13b UStG)', bereich: 'be', typ: 'C',
    flags: [{ k: 'fPlausibel', label: 'Erlöse plausibel / mit Vorjahr abgestimmt' }, { k: 'fHinweis', label: 'Rechnungshinweis „Steuerschuldnerschaft des Leistungsempfängers" geprüft' }],
    listen: [{ key: 'konten', label: 'Erlöskonten', rowNotes: true, felder: [{ k: 'konto', l: 'Konto', t: 'text' }, { k: 'bez', l: 'Bezeichnung', t: 'text' }, { k: 'saldo', l: 'Saldo', t: 'num' }, { k: 'vj', l: 'Vorjahr', t: 'num' }, { k: 'ok', l: 'geprüft / unauffällig', t: 'check' }] }],
    felder: [{ k: 'notiz', l: 'Notiz / Abweichungen dokumentieren', t: 'area' }] },
  erloeseSonst: { name: 'Sonstige betriebliche Erträge / übrige Erlöse', bereich: 'be', typ: 'C',
    flags: [{ k: 'fPlausibel', label: 'Plausibel / mit Vorjahr abgestimmt' }, { k: 'fPeriode', label: 'Periodenabgrenzung geprüft' }],
    listen: [{ key: 'konten', label: 'Konten', rowNotes: true, felder: [{ k: 'konto', l: 'Konto', t: 'text' }, { k: 'bez', l: 'Bezeichnung', t: 'text' }, { k: 'saldo', l: 'Saldo', t: 'num' }, { k: 'vj', l: 'Vorjahr', t: 'num' }, { k: 'ok', l: 'geprüft / unauffällig', t: 'check' }] }],
    felder: [{ k: 'notiz', l: 'Notiz / Abweichungen dokumentieren', t: 'area' }] },
  erloesschmaelerung: { name: 'Erlösschmälerungen / Skonti', bereich: 'be', typ: 'B', konto: '8730', bez: 'Erlösschmälerungen' },
  igLieferung: { name: 'Innergemeinschaftliche Lieferungen', bereich: 'be', typ: 'A' },
  sachentnahme: { name: 'Sachentnahmen Gastronomie (Pauschbeträge)', bereich: 'be', typ: 'C', hinweis: 'Pauschbeträge-Rechner folgt' },
  eigenverbrauch: { name: 'Unentgeltliche Wertabgaben / Eigenverbrauch', bereich: 'be', typ: 'A' },
  kleinunternehmer: { name: 'Kleinunternehmerregelung prüfen', bereich: 'be', typ: 'A' },
  ustVerprobung: { name: 'Umsatzsteuer-Verprobung', bereich: 'be', typ: 'A' },
  liebhaberei: { name: 'Liebhaberei / Gewinnerzielungsabsicht', bereich: 'be', typ: 'A' },
  betriebsaufgabe: { name: 'Betriebsaufgabe (§ 16 EStG)', bereich: 'be', typ: 'C', posLabel: 'Wesentliche Betriebsgrundlagen – Aufdeckung stiller Reserven',
    flags: [
      { k: 'fUeberleitung', label: 'Übergang EÜR → Bestandsvergleich (Überleitungsrechnung)' },
      { k: 'fFreibetrag', label: '§ 16 Abs. 4: 55+ oder dauernd berufsunfähig (Freibetrag)' },
      { k: 'f34', label: '§ 34: ermäßigter Steuersatz / Fünftelregelung' },
      { k: 'fSchlussbilanz', label: 'Aufgabe-/Schlussbilanz erstellt' }],
    felder: [
      { k: 'beginn', l: 'Beginn der Aufgabe', t: 'date' },
      { k: 'ende', l: 'Ende der Aufgabe', t: 'date' },
      { k: 'uebergang', l: 'Übergangsgewinn/-verlust (§ 4 Abs. 3 → § 4 Abs. 1)', t: 'num', full: true },
      { k: 'aufgabekosten', l: 'Aufgabekosten', t: 'num' }],
    positionen: true,
    posFelder: [{ k: 'bez', l: 'Wirtschaftsgut', t: 'text' }, { k: 'bw', l: 'Buchwert', t: 'num' }, { k: 'wert', l: 'Veräußerungspreis / gemeiner Wert', t: 'num' }],
    rechnen: (w, ctx) => {
      let sumBw = 0, sumWert = 0; const det = []
      ;(w._pos || []).forEach(x => { const bw = num(x.bw), wt = num(x.wert); if (!bw && !wt) return; sumBw += bw; sumWert += wt; det.push({ l: (x.bez || 'WG') + ' – stille Reserve', v: wt - bw }) })
      const kosten = num(w.aufgabekosten), aufgabegewinn = (sumWert - sumBw) - kosten, uebergang = num(w.uebergang)
      let freibetrag = 0; if (w.fFreibetrag && aufgabegewinn > 0) { freibetrag = Math.max(0, 45000 - Math.max(0, aufgabegewinn - 136000)); freibetrag = Math.min(freibetrag, aufgabegewinn) }
      const stpfl = aufgabegewinn - freibetrag
      const erg = [...det, { l: 'Summe Veräußerungspreise / gemeine Werte', v: sumWert }, { l: '− Buchwerte', v: -sumBw },
        { l: '− Aufgabekosten', v: -kosten }, { l: '= Aufgabegewinn (§ 16 Abs. 3)', v: aufgabegewinn, stark: 1 }]
      if (freibetrag > 0) erg.push({ l: '− Freibetrag (§ 16 Abs. 4)', v: -freibetrag })
      erg.push({ l: 'steuerpflichtiger Aufgabegewinn', v: stpfl })
      if (uebergang) erg.push({ l: 'nachrichtl.: Übergangsgewinn (laufend, nicht begünstigt)', v: uebergang })
      const hinweise = [
        'Beginn: erste vom Aufgabeentschluss getragene Handlung zur Betriebsauflösung. Ende: Veräußerung/Überführung der letzten wesentlichen Betriebsgrundlage – die Aufgabe ist ein zeitlich zusammengedrängter Vorgang.']
      if (w.fUeberleitung || uebergang) hinweise.push('Zum Aufgabezeitpunkt Überleitung von der EÜR zum Bestandsvergleich (R 4.6 EStR). Der Übergangsgewinn ist laufender, NICHT nach § 34 begünstigter Gewinn.')
      if (w.fFreibetrag) hinweise.push('§ 16 Abs. 4: Freibetrag 45.000 €, gekürzt um den 136.000 € übersteigenden Teil des Aufgabegewinns; nur einmal im Leben, ab 55 Jahren oder bei dauernder Berufsunfähigkeit.')
      if (w.f34) hinweise.push('§ 34: auf Antrag ermäßigter Steuersatz (56 % des durchschnittlichen Steuersatzes, mind. 14 %), einmalig; andernfalls Fünftelregelung.')
      if (!w.fSchlussbilanz) hinweise.push('Aufgabe-/Schlussbilanz zum Aufgabezeitpunkt noch erstellen – Grundlage für Übergangs- und Aufgabegewinn.')
      return { ergebnisse: erg, total: { l: 'steuerpflichtiger Aufgabegewinn', v: stpfl }, hinweise } } },
  /* ── Betriebsausgaben ── */
  wareneinkauf: { name: 'Wareneinkauf / Materialaufwand', bereich: 'ba', typ: 'B', konto: '3400', bez: 'Wareneingang' },
  spenden: { name: 'Spenden', bereich: 'ba', typ: 'A' },
  geschenke: { name: 'Geschenke (35-€-Grenze)', bereich: 'ba', typ: 'C', hinweis: 'Grenzprüfung folgt' },
  reisekosten: { name: 'Reisekosten', bereich: 'ba', typ: 'A' },
  verpflegung: { name: 'Verpflegungsmehraufwand', bereich: 'ba', typ: 'C', hinweis: 'Pauschalen-Rechner folgt' },
  arbeitszimmer: { name: 'Häusliches Arbeitszimmer', bereich: 'ba', typ: 'C', hinweis: 'Rechner folgt' },
  kfzKosten: { name: 'Kfz-Kosten (Konto)', bereich: 'ba', typ: 'B', konto: '4500', bez: 'Kfz-Kosten' },
  kfz1prozent: { name: 'Firmenfahrzeug – private Nutzung (Unternehmer)', bereich: 'be', typ: 'C', custom: 'kfz', posLabel: 'Firmenfahrzeuge',
    flags: [
      { k: 'fUst', label: 'Fahrzeug dem Unternehmen zugeordnet · Vorsteuerabzug (USt auf Privatnutzung ansetzen)' },
      { k: 'fFbOrdnung', label: 'Fahrtenbuch ordnungsgemäß (zeitnah, fortlaufend, geschlossen, vollständig)' },
      { k: 'fFbBelege', label: 'Gesamtkosten vollständig belegt (keine geschätzten Kraftstoffkosten)' },
      { k: 'fVerbot', label: 'Privatnutzung ausgeschlossen (schriftl. Verbot, tatsächlich kontrolliert)' } ],
    felder: [
      { k: 'kEntnahme', l: 'Gegenkonto (Privat/Verrechnung)', t: 'text', def: '1880' },
      { k: 'kErtragUst', l: 'Konto Kfz-Nutzung m. USt (SKR03 8921)', t: 'text', def: '8921' },
      { k: 'kErtragOhneUst', l: 'Konto Kfz-Nutzung o. USt (SKR03 8924)', t: 'text', def: '8924' },
      { k: 'kUst', l: 'Konto Umsatzsteuer 19 % (SKR03 1776)', t: 'text', def: '1776' },
      { k: 'notiz', l: 'Notiz', t: 'area' } ],
    positionen: true,
    posFelder: [
      { k: 'bez', l: 'Fahrzeug / Kennzeichen', t: 'text' },
      { k: 'art', l: 'Antrieb', t: 'select', opt: [['verbrenner', 'Verbrenner'], ['mildhybrid', 'Mild-Hybrid'], ['hybrid', 'Plug-in-Hybrid'], ['elektro', 'Elektro (BEV)'], ['brennstoff', 'Brennstoffzelle'], ['sonstiges', 'Sonstiges']] },
      { k: 'betrAnteil', l: 'betriebl. Nutzung %', t: 'num' },
      { k: 'methode', l: 'Methode', t: 'select', opt: [['pauschal', '1-%-Methode'], ['fahrtenbuch', 'Fahrtenbuch']] },
      { k: 'erstzulassung', l: 'Erstzulassung (BLP-Stichtag)', t: 'date' },
      { k: 'anschaffung', l: 'Anschaffung/Leasingbeginn (Faktor)', t: 'date' },
      { k: 'blp', l: 'Bruttolistenpreis', t: 'num' },
      { k: 'monate', l: 'Monate mit Privatnutzung', t: 'num', def: '12' },
      { k: 'reichweite', l: 'E-Reichweite km (Hybrid)', t: 'num' },
      { k: 'co2', l: 'CO₂ g/km (Hybrid)', t: 'num' },
      { k: 'entfernung', l: 'Entfernung Whg–Betrieb (km)', t: 'num' },
      { k: 'pendelTage', l: 'Pendeltage/Jahr', t: 'num' },
      { k: 'heimEntfernung', l: 'Familienheimfahrt km (dopp. HH)', t: 'num' },
      { k: 'heimFahrten', l: 'zusätzl. Heimfahrten (Anzahl)', t: 'num' },
      { k: 'kosten', l: 'tats. Gesamtkosten (Deckelung/Fahrtenbuch)', t: 'num' },
      { k: 'kostenVst', l: 'davon vorsteuerbelastet (USt)', t: 'num' },
      { k: 'ustAnteil', l: 'USt-Privatanteil % (bei Kostendeckelung)', t: 'num' },
      { k: 'kmGesamt', l: 'Fahrtenbuch: Gesamt-km', t: 'num' },
      { k: 'kmPrivat', l: 'Fahrtenbuch: Privat-km', t: 'num' },
      { k: 'kmPendel', l: 'Fahrtenbuch: km Whg–Betrieb', t: 'num' } ],
    rechnen: (w) => {
      const r2 = x => Math.round(x * 100) / 100
      const jahr = getStichtag().getFullYear()
      const skr = w.skr === '04' ? '04' : '03'
      const K = KFZ_KONTEN[skr]
      const pos = w._pos || []
      const det = [], hinweise = [], buchungen = []
      const fUst = !!w.fUst
      let sumEst = 0, sumUstBase = 0, sumPendelNA = 0, sumHeimNA = 0

      if (w.fVerbot) {
        hinweise.push('ℹ️ Privatnutzung ausgeschlossen (schriftliches, tatsächlich kontrolliertes Verbot) – keine Nutzungsentnahme angesetzt. Nachweis/Kontrolle dokumentieren.')
        return { ergebnisse: [], total: { l: 'Nutzungsentnahme (ESt)', v: 0 }, hinweise, buchungen }
      }

      pos.forEach(v => {
        const name = v.bez || 'Fahrzeug'
        const blp = num(v.blp)
        if (!blp) { hinweise.push('⚠️ ' + name + ': kein Bruttolistenpreis erfasst – übersprungen.'); return }
        const blpAbg = Math.floor(blp / 100) * 100
        const datFaktor = v.anschaffung || v.erstzulassung
        const monate = Math.min(12, Math.max(0, num(v.monate) || 12))
        const anteil = num(v.betrAnteil)
        const methode = v.methode || 'pauschal'
        const km = Math.floor(num(v.entfernung))
        const pendelTage = num(v.pendelTage)
        const kosten = num(v.kosten)

        // Begünstigungsfaktor (nur ESt)
        const fk = kfzFaktor(v.art, blpAbg, datFaktor, { co2: v.co2, reichweite: v.reichweite })
        if (fk.warn) hinweise.push('⚠️ ' + name + ': ' + fk.warn)
        // ESt-Nutzungsbasis: bei E-/Hybrid den geviertelten/halbierten Wert auf 100 € abrunden
        // (DATEV Dok. 5301038: 25 % × 56.220 = 14.055 → 14.000). Verbrenner = BLP abgerundet.
        const MBLP = fk.f < 1 ? Math.floor(blp * fk.f / 100) * 100 : blpAbg * fk.f

        // Klassifizierung des Nutzungsumfangs (Ertragsteuer)
        // < 10 % → notwendiges Privatvermögen: keine Entnahme
        if (anteil > 0 && anteil < 10) {
          hinweise.push('⛔ ' + name + ': betriebliche Nutzung ' + r2(anteil) + ' % < 10 % → notwendiges Privatvermögen. Keine Nutzungsentnahme/1-%-Methode; betriebliche Fahrten als Nutzungseinlage (tats. Kosten oder pauschal 0,30 €/km).')
          return
        }
        // 10–50 % → gewillkürtes BV: anteilige tatsächliche Kosten, KEINE 1-%-Methode
        if (anteil >= 10 && anteil <= 50) {
          const gesKm = num(v.kmGesamt), privKm = num(v.kmPrivat)
          const privAnteil = gesKm > 0 ? privKm / gesKm : (100 - anteil) / 100
          const est = kosten > 0 ? r2(kosten * privAnteil) : 0
          det.push({ l: name + ' — gewillkürtes BV (' + r2(anteil) + ' %) · anteilige tats. Kosten (Privatanteil ' + Math.round(privAnteil * 100) + ' %)', v: est })
          sumEst += est
          if (fUst) { const vst = num(v.kostenVst); if (vst > 0) sumUstBase += r2(vst * privAnteil) }
          hinweise.push('ℹ️ ' + name + ': betriebliche Nutzung 10–50 % → Zuordnungswahlrecht (gewillkürtes BV). Bei Zuordnung KEINE 1-%-Methode, sondern private Nutzung = tats. Gesamtkosten × Privatanteil. E-/Hybrid-Begünstigung nach § 6 EStG stichtagsabhängig prüfen.')
          if (methode === 'pauschal') hinweise.push('⛔ ' + name + ': 1-%-Methode bei ≤ 50 % betrieblicher Nutzung unzulässig – tatsächliche Kosten angesetzt.')
          if (!kosten) hinweise.push('⚠️ ' + name + ': tatsächliche Gesamtkosten fehlen – anteilige Bewertung unvollständig.')
          return
        }
        // > 50 % (oder unbekannt) → 1-%-/Fahrtenbuchmethode
        if (!anteil) hinweise.push('⚠️ ' + name + ': betrieblicher Nutzungsumfang nicht erfasst. Die 1-%-Methode setzt > 50 % betriebliche Nutzung voraus (Nachweis: 3-Monats-Aufzeichnung/Fahrtenbuch).')

        // Fahrtenbuch-Zulässigkeit
        let useFb = methode === 'fahrtenbuch'
        if (useFb && (!w.fFbOrdnung || !w.fFbBelege)) {
          useFb = false
          const g = []; if (!w.fFbOrdnung) g.push('nicht als ordnungsgemäß bestätigt'); if (!w.fFbBelege) g.push('Gesamtkosten nicht vollständig belegt (BFH VI R 44/20)')
          hinweise.push('⛔ ' + name + ': Fahrtenbuch ' + g.join(' + ') + ' → Rückfall auf 1-%-Methode + § 4 Abs. 5 Nr. 6. HOCHRISIKO.')
        }
        const gesKm = num(v.kmGesamt), privKm = num(v.kmPrivat), pendKm = num(v.kmPendel)
        const fbMoeglich = kosten > 0 && gesKm > 0
        if (useFb && !fbMoeglich) hinweise.push('⚠️ ' + name + ': Fahrtenbuch gewählt, aber Gesamtkosten/Gesamt-km fehlen – 1-%-Methode angesetzt.')
        const nutzeFb = useFb && fbMoeglich
        const privAnteil = gesKm > 0 ? privKm / gesKm : 0

        // Werte beider Methoden (für Vergleich)
        const p1_privat = r2(MBLP * 0.01 * monate)
        const p1_pendel = km > 0 ? r2(MBLP * 0.0003 * km * monate) : 0
        const cpk = fbMoeglich ? kosten / gesKm : 0
        const fb_privat = fbMoeglich ? r2(cpk * privKm) : 0
        const fb_pendel = fbMoeglich ? r2(cpk * pendKm) : 0

        // Familienheimfahrten (0,002 %) – nur pauschale Methode
        const heimKm = Math.floor(num(v.heimEntfernung)), heimN = num(v.heimFahrten)
        let heimBrutto = (!nutzeFb && heimKm > 0 && heimN > 0) ? r2(MBLP * 0.00002 * heimKm * heimN) : 0
        const heimAllow = heimBrutto > 0 ? entfPauschale(heimKm, heimN, jahr) : 0

        let estPrivat, estPendelBrutto
        if (nutzeFb) {
          estPrivat = fb_privat; estPendelBrutto = fb_pendel
          det.push({ l: name + ' — Fahrtenbuch · ' + eur(r2(cpk)) + '/km · privat ' + privKm + ' km', v: fb_privat })
        } else {
          estPrivat = p1_privat; estPendelBrutto = p1_pendel
          det.push({ l: name + ' — ' + fk.label + ' · ' + monate + ' Mon. · BLP ' + eur(blpAbg), v: p1_privat })
        }

        // Kostendeckelung (nur ESt, nur pauschale Rohwerte)
        let deckel = false
        if (!nutzeFb && kosten > 0) {
          const roh = estPrivat + estPendelBrutto + heimBrutto
          if (roh > kosten && roh > 0) {
            deckel = true
            const f = kosten / roh
            estPrivat = r2(estPrivat * f); estPendelBrutto = r2(estPendelBrutto * f); heimBrutto = r2(heimBrutto * f)
            hinweise.push('ℹ️ ' + name + ': Kostendeckelung – pauschaler Rohwert (' + eur(roh) + ') über den tats. Gesamtkosten (' + eur(kosten) + '); Ansatz proportional auf die Kosten begrenzt. Entfernungspauschale danach berücksichtigt; USt separat (keine Übernahme der ESt-Deckelung).')
          }
        }

        // nicht abziehbare Pendelkosten = Ansatz − Entfernungspauschale
        const distAllow = entfPauschale(km, pendelTage, jahr)
        const pendelNA = Math.max(0, r2(estPendelBrutto - distAllow))
        sumPendelNA += pendelNA
        if (estPendelBrutto > 0) det.push({ l: '   Pendeln Whg–Betrieb: Ansatz ' + eur(estPendelBrutto) + ' − Entf.pauschale ' + eur(distAllow) + ' = nicht abziehbar', v: pendelNA })

        // nicht abziehbare Familienheimfahrten
        if (heimBrutto > 0) {
          const heimNA = Math.max(0, r2(heimBrutto - heimAllow))
          sumHeimNA += heimNA
          det.push({ l: '   Familienheimfahrten (0,002 %): Ansatz ' + eur(heimBrutto) + ' − ' + eur(heimAllow) + ' = nicht abziehbar', v: heimNA })
        }

        sumEst += estPrivat

        // USt-Bemessung: Netto-Anteil, der USt trägt.
        // 1-%-Methode (Verbrenner): 80 % des ungekürzten 1-%-Werts.
        // Fahrtenbuch: Privatanteil × vorsteuerbelastete Kosten.
        // Kostendeckelung: geschätzter Privatanteil × vorsteuerbelastete Kosten (DATEV Dok. 5301656).
        if (fUst) {
          let baseNet = 0
          if (deckel) {
            const ua = num(v.ustAnteil), vst = num(v.kostenVst)
            if (ua > 0 && vst > 0) baseNet = r2(vst * ua / 100)
            else hinweise.push('⚠️ ' + name + ': USt bei Kostendeckelung sachgerecht schätzen – Felder „USt-Privatanteil %" und „davon vorsteuerbelastet" erfassen.')
          } else if (nutzeFb) {
            const vst = num(v.kostenVst)
            if (vst > 0 && privAnteil > 0) baseNet = r2(vst * privAnteil)
            else hinweise.push('⚠️ ' + name + ' USt (Fahrtenbuch): „davon vorsteuerbelastet" fehlt – USt belegmäßig ermitteln.')
          } else {
            baseNet = r2(blpAbg * 0.01 * monate * 0.80)
          }
          sumUstBase += baseNet
        }

        // Methodenvergleich (nur Privatanteil)
        if (fbMoeglich && p1_privat > 0) {
          const g = fb_privat < p1_privat ? 'Fahrtenbuch' : '1-%-Methode'
          hinweise.push('📊 ' + name + ' Methodenvergleich (Privatanteil): 1 % = ' + eur(p1_privat) + ' · Fahrtenbuch = ' + eur(fb_privat) + ' → günstiger: ' + g + '.')
        }
      })

      sumEst = r2(sumEst); sumUstBase = r2(sumUstBase)
      const sumUst = r2(sumUstBase * 0.19)
      const ohneUst = r2(sumEst - sumUstBase)
      const mitUstBrutto = r2(sumUstBase + sumUst)
      const gesamtBrutto = r2(sumEst + sumUst)
      const divergenz = fUst && sumUstBase > 0 && ohneUst < 0

      const erg = [...det, { l: 'Private Nutzung (ESt-Betriebseinnahme, netto)', v: sumEst, stark: 1 }]
      if (fUst && sumUstBase > 0 && !divergenz) {
        erg.push({ l: '  davon ohne USt (20 %-Pauschalabschlag / nicht vorsteuerbelastet) → ' + K.ohneUst, v: ohneUst })
        erg.push({ l: '  davon umsatzsteuerpflichtig (netto)', v: sumUstBase })
        erg.push({ l: '  + Umsatzsteuer 19 %', v: sumUst })
        erg.push({ l: '  = Wert mit USt (brutto) → ' + K.mitUst, v: mitUstBrutto })
        erg.push({ l: 'Gesamtentnahme (brutto, Summe der Buchungen)', v: gesamtBrutto, stark: 1 })
      } else if (divergenz) {
        const ustDiffErg = r2(sumUst - r2(sumEst * 0.19))
        erg.push({ l: '  ESt-Bemessung (E-/Hybrid-Faktor) netto', v: sumEst })
        erg.push({ l: '  USt-Bemessung (80 % v. 1 %, ohne E-Kürzung) netto', v: sumUstBase })
        erg.push({ l: '  Umsatzsteuer 19 % (auf 80 %-Basis)', v: sumUst })
        erg.push({ l: '  USt-Differenz (als zusätzliche Wertabgabe)', v: ustDiffErg })
        erg.push({ l: 'Unentgeltliche Wertabgabe gesamt (ESt-Wert netto + USt)', v: gesamtBrutto, stark: 1 })
      }
      if (sumPendelNA) erg.push({ l: 'Nachrichtlich: nicht abziehbare Pendelkosten (§ 4 Abs. 5 Nr. 6 EStG)', v: sumPendelNA })
      if (sumHeimNA) erg.push({ l: 'Nachrichtlich: nicht abziehbare Familienheimfahrten', v: sumHeimNA })

      if (sumPendelNA) hinweise.push('Die nicht abziehbaren Pendelkosten (' + eur(sumPendelNA) + ', 0,03 % gekürzt um die Entfernungspauschale ' + (jahr >= 2026 ? '0,38 €/km ab dem 1. km' : 'gestaffelt') + ') sind außerbilanziell hinzuzurechnen (§ 4 Abs. 5 S. 1 Nr. 6 EStG) – eigene DATEV-Buchung „Fahrten Wohnung–Betrieb", nicht Teil der Nutzungsentnahme.')
      if (fUst && sumUstBase > 0 && !divergenz) hinweise.push('Buchung nach DATEV (Dok. 5301656, SKR' + skr + '): Bruttobetrag „mit USt" (' + eur(mitUstBrutto) + ') auf ' + K.mitUst + ' – Automatikkonto zieht die USt selbst heraus; Anteil „ohne USt" (' + eur(ohneUst) + ') auf ' + K.ohneUst + '; Gegenkonto ' + K.gegen + '. Gegenkonto ' + K.gegen + ' nur für Voll­hafter/Einzelunternehmer – bei Teilhaftern ' + (skr === '04' ? '2530 (Fremdkapital) / 9480 (Eigenkapital)' : '1980 (Fremdkapital) / 9480 (Eigenkapital)') + '.')
      if (divergenz) hinweise.push('E-/Hybridfahrzeug (DATEV Dok. 5301038, SKR' + skr + '): ESt nach Faktor (25 %/50 %), USt aber auf 80 % des ungekürzten 1-%-Werts → 3 Buchungen: (1) Privatnutzung brutto ' + K.gegen + ' an ' + K.mitUst + ' (Automatikkonto), (2) USt-Differenz-Zwischenbuchung ' + K.ohneUst + ' an ' + K.mitUst + ', (3) USt-Differenz als Wertabgabe ' + K.gegen + ' an ' + K.ohneUst + '. Alternativ DATEV-Faktor-2-Kontenfunktion (15,9664 %). Gegenkonto ' + K.gegen + ' nur Voll­hafter/Einzelunternehmer (sonst ' + (skr === '04' ? '2530/9480' : '1980/9480') + ').')
      if (!fUst) hinweise.push('USt nicht angesetzt (kein Vorsteuerabzug / keine Unternehmenszuordnung) – volle Nutzungsentnahme ohne USt auf ' + K.ohneUst + '.')

      if (sumEst > 0) {
        const kGegen = w.kEntnahme || K.gegen
        if (fUst && sumUstBase > 0 && !divergenz) {
          buchungen.push({ s: kGegen, st: 'Unentgeltl. Wertabgabe', h: (w.kErtragUst || K.mitUst), ht: 'Kfz-Nutzung 19 % USt (Automatik)', betr: mitUstBrutto, text: 'Privatnutzung Pkw mit USt' })
          if (ohneUst > 0) buchungen.push({ s: kGegen, st: 'Unentgeltl. Wertabgabe', h: (w.kErtragOhneUst || K.ohneUst), ht: 'Kfz-Nutzung ohne USt', betr: ohneUst, text: 'Privatnutzung Pkw ohne USt' })
        } else if (divergenz) {
          const kMit = w.kErtragUst || K.mitUst, kOhne = w.kErtragOhneUst || K.ohneUst
          const b1 = r2(sumEst * 1.19), b2 = r2((sumUstBase - sumEst) * 1.19), b3 = r2(sumUst - r2(sumEst * 0.19))
          buchungen.push({ s: kGegen, st: 'Unentgeltl. Wertabgabe', h: kMit, ht: 'Kfz-Nutzung 19 % USt (Automatik)', betr: b1, text: 'Privatnutzung Pkw (E-Fahrzeug)' })
          buchungen.push({ s: kOhne, st: 'Kfz-Nutzung ohne USt', h: kMit, ht: 'Kfz-Nutzung 19 % USt (Automatik)', betr: b2, text: 'USt-Differenz 55 % (Zwischenbuchung)' })
          buchungen.push({ s: kGegen, st: 'Unentgeltl. Wertabgabe', h: kOhne, ht: 'Kfz-Nutzung ohne USt', betr: b3, text: 'USt-Differenz als unentgeltliche Wertabgabe' })
        } else {
          buchungen.push({ s: kGegen, st: 'Unentgeltl. Wertabgabe', h: (w.kErtragOhneUst || K.ohneUst), ht: 'Kfz-Nutzung ohne USt', betr: sumEst, text: 'Privatnutzung Pkw ohne USt' })
        }
      }

      return { ergebnisse: erg, total: { l: fUst && sumUstBase > 0 ? 'Gesamtentnahme (brutto)' : 'Nutzungsentnahme (ESt)', v: fUst && sumUstBase > 0 ? gesamtBrutto : sumEst }, hinweise, buchungen }
    } },
  kfzArbeitnehmer: { name: 'Dienstwagen – Arbeitnehmer (geldwerter Vorteil)', bereich: 'ba', typ: 'C', posLabel: 'Dienstwagen je Arbeitnehmer',
    flags: [
      { k: 'fUst', label: 'USt: Überlassung als entgeltlicher/tauschähnl. Umsatz (BMF 3.3.2026)' },
      { k: 'fPauschal40', label: '§ 40 Abs. 2 EStG: Pendelvorteil pauschal 15 % (bis Entfernungspauschale)' } ],
    felder: [ { k: 'notiz', l: 'Notiz', t: 'area' } ],
    positionen: true,
    posFelder: [
      { k: 'an', l: 'Arbeitnehmer', t: 'text' },
      { k: 'bez', l: 'Fahrzeug / Kennzeichen', t: 'text' },
      { k: 'art', l: 'Antrieb', t: 'select', opt: [['verbrenner', 'Verbrenner'], ['mildhybrid', 'Mild-Hybrid'], ['hybrid', 'Plug-in-Hybrid'], ['elektro', 'Elektro (BEV)'], ['brennstoff', 'Brennstoffzelle'], ['sonstiges', 'Sonstiges']] },
      { k: 'methode', l: 'Methode', t: 'select', opt: [['pauschal', '1-%-Methode'], ['fahrtenbuch', 'Fahrtenbuch']] },
      { k: 'erstzulassung', l: 'Erstzulassung (BLP-Stichtag)', t: 'date' },
      { k: 'anschaffung', l: 'Anschaffung/Leasingbeginn', t: 'date' },
      { k: 'ueberlassung', l: 'erstmalige Überlassung an AN', t: 'date' },
      { k: 'blp', l: 'Bruttolistenpreis', t: 'num' },
      { k: 'monate', l: 'Monate Überlassung', t: 'num', def: '12' },
      { k: 'reichweite', l: 'E-Reichweite km (Hybrid)', t: 'num' },
      { k: 'co2', l: 'CO₂ g/km (Hybrid)', t: 'num' },
      { k: 'ersteTS', l: 'erste Tätigkeitsstätte?', t: 'select', opt: [['ja', 'ja'], ['nein', 'nein (Sammelpunkt prüfen)']] },
      { k: 'pendelKm', l: 'Entfernung Whg–erste TS (km)', t: 'num' },
      { k: 'pendelMethode', l: 'Pendel-Bewertung', t: 'select', opt: [['monat', 'Monat 0,03 %'], ['einzel', 'Einzel 0,002 % (max. 180 T.)']] },
      { k: 'pendelTage', l: 'Fahrten Whg–TS/Jahr (Einzelbew.)', t: 'num' },
      { k: 'familienKm', l: 'Familienheimfahrt km (dopp. HH)', t: 'num' },
      { k: 'familienFahrten', l: 'zusätzl. Heimfahrten (> 1/Woche)', t: 'num' },
      { k: 'nutzerzahl', l: 'Nutzungsberechtigte (Pool)', t: 'num', def: '1' },
      { k: 'fahrer', l: 'Fahrergestellung?', t: 'select', opt: [['nein', 'nein'], ['ja', 'ja (+50 %)']] },
      { k: 'entgelt', l: 'Nutzungsentgelt/Zuzahlung €', t: 'num' },
      { k: 'kosten', l: 'Fahrtenbuch: Gesamtkosten', t: 'num' },
      { k: 'kmGesamt', l: 'Fahrtenbuch: Gesamt-km', t: 'num' },
      { k: 'kmPrivat', l: 'Fahrtenbuch: Privat-km', t: 'num' },
      { k: 'kmPendel', l: 'Fahrtenbuch: km Whg–TS', t: 'num' },
      { k: 'kmFamilie', l: 'Fahrtenbuch: Familienheim-km', t: 'num' },
      { k: 'fbOk', l: 'Fahrtenbuch ordnungsgemäß & belegt', t: 'check' } ],
    rechnen: (w) => {
      const r2 = x => Math.round(x * 100) / 100
      const jahr = getStichtag().getFullYear()
      const det = [], hinweise = [], buchungen = []
      const fUst = !!w.fUst
      let sumVorteil = 0, sumPauschal40 = 0, sumUst = 0

      ;(w._pos || []).forEach(v => {
        const name = (v.an || 'AN') + (v.bez ? ' · ' + v.bez : '')
        const blp = num(v.blp)
        if (!blp) { hinweise.push('⚠️ ' + name + ': kein Bruttolistenpreis – übersprungen.'); return }
        const blpAbg = Math.floor(blp / 100) * 100
        const monate = Math.min(12, Math.max(0, num(v.monate) || 12))
        const n = Math.max(1, num(v.nutzerzahl) || 1)
        // Faktor: für AN gilt die 100.000-€-Grenze nur, wenn Anschaffung UND Überlassung
        // im begünstigten Zeitraum liegen → maßgeblich ist das spätere der beiden Daten.
        const dA = v.anschaffung ? new Date(v.anschaffung) : null
        const dU = v.ueberlassung ? new Date(v.ueberlassung) : null
        let datFaktor = v.anschaffung || v.ueberlassung || v.erstzulassung
        if (dA && dU) datFaktor = dA > dU ? v.anschaffung : v.ueberlassung
        const fk = kfzFaktor(v.art, blpAbg, datFaktor, { co2: v.co2, reichweite: v.reichweite })
        if (fk.warn) hinweise.push('⚠️ ' + name + ': ' + fk.warn)
        if (fk.f === 0.25) hinweise.push('ℹ️ ' + name + ': 0,25-%-Ansatz setzt bei Arbeitnehmern (100.000-€-Grenze) Anschaffung UND Überlassung im begünstigten Zeitraum voraus – beide Daten prüfen.')
        const MBLP = blpAbg * fk.f

        const methode = v.methode || 'pauschal'
        const useFb = methode === 'fahrtenbuch'
        const gesKm = num(v.kmGesamt), kosten = num(v.kosten)
        const fbMoeglich = useFb && kosten > 0 && gesKm > 0 && v.fbOk
        if (useFb && !v.fbOk) hinweise.push('⛔ ' + name + ': Fahrtenbuch nicht als ordnungsgemäß/belegt bestätigt → Rückfall auf 1-%-Methode (BFH VI R 44/20: keine Schätzung fehlender Treibstoffkosten).')
        else if (useFb && !(kosten > 0 && gesKm > 0)) hinweise.push('⚠️ ' + name + ': Fahrtenbuch gewählt, aber Gesamtkosten/Gesamt-km fehlen → 1-%-Methode angesetzt.')

        const km = Math.floor(num(v.pendelKm))
        const ersteTS = (v.ersteTS || 'ja') === 'ja'
        const einzel = (v.pendelMethode || 'monat') === 'einzel'
        const pTage = num(v.pendelTage)
        let privat, pendel = 0, familie = 0, pendelBasis40 = 0

        if (fbMoeglich) {
          const cpk = kosten / gesKm
          privat = r2(cpk * num(v.kmPrivat)); pendel = r2(cpk * num(v.kmPendel)); familie = r2(cpk * num(v.kmFamilie))
          det.push({ l: name + ' — Fahrtenbuch · ' + eur(r2(cpk)) + '/km · privat ' + num(v.kmPrivat) + ' km', v: privat })
          if (pendel) { pendelBasis40 = pendel; det.push({ l: '   Pendeln Whg–TS (Fahrtenbuch)', v: pendel }) }
          if (familie) det.push({ l: '   Familienheimfahrten (Fahrtenbuch)', v: familie })
        } else {
          privat = r2(MBLP * 0.01 * monate / n)
          det.push({ l: name + ' — ' + fk.label + ' · ' + monate + ' Mon.' + (n > 1 ? ' · ÷ ' + n + ' Nutzer' : ''), v: privat })
          if (ersteTS && km > 0) {
            if (einzel) {
              const t = Math.min(180, pTage)
              if (pTage > 180) hinweise.push('⛔ ' + name + ': Einzelbewertung ist auf 180 Tage/Jahr begrenzt (' + pTage + ' erfasst) – gekappt.')
              pendel = r2(MBLP * 0.00002 * km * t / n)
              det.push({ l: '   Pendeln Einzelbewertung 0,002 % × ' + km + ' km × ' + t + ' Tage', v: pendel })
            } else {
              pendel = r2(MBLP * 0.0003 * km * monate / n)
              det.push({ l: '   Pendeln Monatsmethode 0,03 % × ' + km + ' km × ' + monate + ' Mon.', v: pendel })
            }
            pendelBasis40 = pendel
          } else if (!ersteTS) {
            hinweise.push('ℹ️ ' + name + ': keine erste Tätigkeitsstätte → kein 0,03-/0,002-%-Zuschlag; Sammelpunkt/weiträumiges Tätigkeitsgebiet (§ 9 Abs. 1 S. 3 Nr. 4a EStG) gesondert prüfen.')
          }
          const fKm = Math.floor(num(v.familienKm)), fN = num(v.familienFahrten)
          if (fKm > 0 && fN > 0) { familie = r2(MBLP * 0.00002 * fKm * fN); det.push({ l: '   zusätzliche Familienheimfahrten 0,002 % × ' + fKm + ' km × ' + fN + ' (erste wöchentl. bereits im 1-%-Wert)', v: familie }) }
        }

        let fahrerZ = 0
        if ((v.fahrer || 'nein') === 'ja') { fahrerZ = r2(0.5 * (privat + pendel + familie)); det.push({ l: '   Fahrergestellung (+50 % der Nutzungswerte – LStR-Staffelung prüfen)', v: fahrerZ }) }

        const brutto = r2(privat + pendel + familie + fahrerZ)
        const entgelt = num(v.entgelt)
        let vorteil = brutto - entgelt
        if (entgelt > 0) det.push({ l: '   − Nutzungsentgelt/Zuzahlung', v: -entgelt })
        if (vorteil < 0) { hinweise.push('⛔ ' + name + ': Nutzungsentgelt (' + eur(entgelt) + ') übersteigt den Vorteil (' + eur(brutto) + ') → kein negativer Vorteil; Überhang verfällt (keine jahresübergreifende Übertragung ohne zulässige Zuordnung).'); vorteil = 0 }
        vorteil = r2(vorteil)

        if (w.fPauschal40 && pendelBasis40 > 0 && ersteTS) {
          const epTage = einzel ? Math.min(180, pTage) : Math.round(15 * monate)
          const ep = entfPauschale(km, epTage, jahr)
          const p40 = r2(Math.min(pendelBasis40, ep))
          if (p40 > 0) { sumPauschal40 += p40; hinweise.push('ℹ️ ' + name + ': § 40 Abs. 2 EStG – Pendelvorteil bis Entfernungspauschale (' + eur(ep) + ') pauschal 15 % LSt: Basis ' + eur(p40) + ' (pausch. LSt ~ ' + eur(r2(p40 * 0.15)) + '); mindert die Werbungskostenbescheinigung, nicht regelversteuert.') }
        }

        sumVorteil += vorteil

        if (fUst) {
          const bruttoUst = fbMoeglich ? brutto
            : r2(blpAbg * 0.01 * monate / n + (ersteTS && km > 0 ? (einzel ? blpAbg * 0.00002 * km * Math.min(180, pTage) : blpAbg * 0.0003 * km * monate) / n : 0))
          const net = r2(bruttoUst / 1.19), u = r2(net * 0.19); sumUst += u
          hinweise.push('ℹ️ ' + name + ' USt: Überlassung regelmäßig entgeltl./tauschähnl. Umsatz (BMF 3.3.2026). Bemessung OHNE E-/Hybrid-Kürzung; hier grob ' + eur(net) + ' netto → USt 19 % ' + eur(u) + '. Mindestbemessung, Nutzungsentgelt, Leistungsort (Auslandsfälle) separat prüfen.')
        }
      })

      const erg = [...det, { l: 'Steuer-/SV-pflichtiger geldwerter Vorteil (gesamt)', v: sumVorteil, stark: 1 }]
      if (sumPauschal40) erg.push({ l: 'davon § 40 Abs. 2 EStG pauschal (15 %) – nicht regelversteuert', v: sumPauschal40 })
      if (fUst && sumUst) erg.push({ l: 'Umsatzsteuer 19 % (Überlassung an AN)', v: sumUst })

      hinweise.push('Lohnabrechnung: Der geldwerte Vorteil ist Bruttolohn/Sachbezug (§ 8 Abs. 2 EStG) – über Lohnarten als Brutto-Hinzurechnung/Netto-Abzug abzurechnen, KEINE Unternehmer-Privatentnahme. Bei Gesellschafter-Geschäftsführern zusätzlich vGA-Prüfung.')
      if (!fUst) hinweise.push('USt der Fahrzeugüberlassung an Arbeitnehmer nicht angesetzt – nach BMF 3.3.2026 regelmäßig steuerbar; ggf. Flag setzen.')

      return { ergebnisse: erg, total: { l: 'Geldwerter Vorteil (gesamt)', v: sumVorteil }, hinweise, buchungen }
    } },
  kfzLadestrom: { name: 'Ladestrom-Erstattung E-Dienstwagen (ab 2026)', bereich: 'ba', typ: 'C', posLabel: 'Ladestrom je Arbeitnehmer',
    flags: [
      { k: 'fPauschale', label: 'Strompreispauschale statt Einzelnachweis (kalenderjährlich einheitlich)' },
      { k: 'fOeffentlich', label: 'Öffentlicher Ladestrom zusätzlich belegmäßig erstattet' } ],
    felder: [
      { k: 'kErstattung', l: 'Konto steuerfreier Auslagenersatz', t: 'text', def: '4137' },
      { k: 'notiz', l: 'Notiz', t: 'area' } ],
    positionen: true,
    posFelder: [
      { k: 'an', l: 'Arbeitnehmer', t: 'text' },
      { k: 'kwh', l: 'nachgewiesene kWh (Ladung zuhause)', t: 'num' },
      { k: 'tatsKosten', l: 'tats. Stromkosten € (Alternative)', t: 'num' },
      { k: 'oeffentlich', l: 'öffentl. Ladestrom € (Beleg)', t: 'num' } ],
    rechnen: (w) => {
      const r2 = x => Math.round(x * 100) / 100
      const jahr = getStichtag().getFullYear()
      const satz = STROMPAUSCHALE[jahr] || STROMPAUSCHALE[2026]
      const det = [], hinweise = []; let sum = 0
      ;(w._pos || []).forEach(v => {
        const name = v.an || 'AN'; const kwh = num(v.kwh); const oeff = num(v.oeffentlich)
        let betr
        if (w.fPauschale) { betr = r2(kwh * satz); det.push({ l: name + ' — Pauschale ' + kwh + ' kWh × ' + eur(satz), v: betr }) }
        else { betr = num(v.tatsKosten); det.push({ l: name + ' — tatsächliche Stromkosten (Nachweis)', v: betr }) }
        if (oeff > 0) { det.push({ l: '   + öffentlicher Ladestrom (Beleg)', v: oeff }); betr = r2(betr + oeff) }
        sum += betr
      })
      hinweise.push('Strompreispauschale ' + jahr + ': ' + eur(satz) + '/kWh (auf volle Cent abgerundeter Destatis-Gesamtdurchschnittspreis 1. Halbjahr Vorjahr, Haushalte 5.000 bis unter 15.000 kWh) × nachgewiesene kWh – steuerfreier Auslagenersatz (§ 3 Nr. 50 EStG). Strommenge nachweisen; nur E-/Hybrid-Dienstwagen.')
      hinweise.push('BMF 21.7.2026: gilt für nach dem 31.12.2025 beginnende Wirtschaftsjahre; Nichtbeanstandung der alten monatlichen Pauschalen bis 31.7.2026. Öffentlicher Ladestrom ist zusätzlich belegmäßig erstattbar.')
      if (jahr < 2026) hinweise.push('⚠️ Wirtschaftsjahr < 2026: die neue Pauschale gilt noch nicht durchgängig – alte monatliche Pauschalen prüfen (Nichtbeanstandung bis 31.7.2026).')
      return { ergebnisse: [...det, { l: 'Steuerfreier Auslagenersatz Ladestrom (gesamt)', v: sum, stark: 1 }], total: { l: 'Erstattung gesamt', v: sum }, hinweise, buchungen: [] }
    } },
  fahrtenbuch: { name: 'Fahrtenbuch', bereich: 'ba', typ: 'A' },
  telefon: { name: 'Private Telefonnutzung', bereich: 'ba', typ: 'A' },
  beschraenktBA: { name: 'Beschränkt abziehbare Betriebsausgaben', bereich: 'ba', typ: 'A' },
  vorsteuer: { name: 'Vorsteuer', bereich: 'ba', typ: 'B', konto: '1576', bez: 'Vorsteuer' },
  igErwerb: { name: 'Innergemeinschaftliche Erwerbe', bereich: 'ba', typ: 'A' },
  durchlaufend: { name: 'Durchlaufende Posten', bereich: 'ba', typ: 'A' },
  ustZahllast: { name: 'Umsatzsteuer-Verbindlichkeit', bereich: 'ba', typ: 'B', konto: '1776', bez: 'USt' },
  lohn: { name: 'Lohn und Gehalt', bereich: 'ba', typ: 'A' },
  gewerbesteuer: { name: 'Gewerbesteuer (Abstimmung & Berechnung)', bereich: 'steuern', typ: 'C', kontoListe: true,
    listen: [{ key: 'konten', label: 'Gewerbesteuer-Konten (Vorauszahlungen, Rückstellung …)', rowNotes: true, felder: [
      { k: 'konto', l: 'Konto', t: 'text' }, { k: 'bez', l: 'Bezeichnung', t: 'text' }, { k: 'saldo', l: 'Saldo', t: 'num' }, { k: 'vj', l: 'Vorjahr', t: 'num' }, { k: 'ok', l: 'geprüft', t: 'check' } ] }],
    flags: [
      { k: 'fBescheid', label: 'GewSt-Vorauszahlungsbescheid liegt vor' },
      { k: 'fAbgestimmt', label: 'Vorauszahlungen mit Buchung abgestimmt' },
      { k: 'fNachtraeglich', label: 'Nachträgliche Vorauszahlungen berücksichtigt' },
      { k: 'fRueckstellung', label: 'GewSt-Rückstellung gebildet / geprüft' },
      { k: 'f35', label: 'Messbetrag in ESt-Erklärung übertragen (§ 35 EStG)' },
      { k: 'fZerlegung', label: 'Zerlegung auf mehrere Gemeinden geprüft' } ],
    felder: [
      { k: 'skr', l: 'Kontenrahmen', t: 'select', def: '03', opt: [['03', 'SKR 03'], ['04', 'SKR 04']] },
      { k: 'rechtsformKlasse', l: 'Rechtsform (§ 35 / KapGes)', t: 'select', opt: [['', '(aus Stammdaten)'], ['pers', 'Einzel / Personengesellschaft'], ['kap', 'Kapitalgesellschaft']] },
      { k: 'gewinn', l: 'Gewinn aus Gewerbebetrieb', t: 'num' },
      { k: 'hinzu', l: '+ Hinzurechnungen (§ 8 GewStG)', t: 'num' },
      { k: 'kuerz', l: '− Kürzungen (§ 9 GewStG)', t: 'num' },
      { k: 'freibetrag', l: 'Freibetrag (24.500 € nur Einzel/PersG)', t: 'num', def: '24500' },
      { k: 'hebesatz', l: 'Hebesatz %', t: 'num' },
      { k: 'vzFestgesetzt', l: 'Vorauszahlungen lt. Bescheid (Gewerbeamt)', t: 'num' },
      { k: 'vzGebucht', l: 'Vorauszahlungen lt. Buchung', t: 'num' },
      { k: 'vzNachtraeglich', l: 'fällige, noch nicht gezahlte VZ (zum 31.12.)', t: 'num' },
      { k: 'rueckVorjahr', l: 'GewSt-Rückstellung Vorjahr (Bilanz)', t: 'num' },
      { k: 'gewStBescheid', l: 'tatsächliche GewSt Vorjahr lt. Bescheid', t: 'num' },
      { k: 'vorjahrKorrektur', l: 'Erstattung(+)/Nachzahlung(−) Vorjahre aus BP/geänd. Bescheid', t: 'num' },
      { k: 'notiz', l: 'Notiz / Bescheiddaten (Datum, Aktenzeichen, Gemeinde)', t: 'area' } ],
    rechnen: (w, ctx) => { const r2 = x => Math.round(x * 100) / 100
      const skr = w.skr === '04' ? '04' : '03'; const K = GEWST_KONTEN[skr]
      // Rechtsform-Klasse: Modulfeld, sonst heuristisch aus den Stammdaten (ctx.rechtsform)
      let rf = w.rechtsformKlasse || ''
      const rfText = (ctx && ctx.rechtsform ? ctx.rechtsform : '').toLowerCase()
      if (!rf && rfText) {
        if (/co\.?\s*kg|&\s*co|\bkg\b|ohg|gbr|einzel|e\.?\s?k\b|partnerg|freiberuf/.test(rfText)) rf = 'pers'
        else if (/gmbh|\bug\b|kgaa|\bag\b|mbh|kapital|körperschaft|limited|\bltd\b|\beg\b|genossensch/.test(rfText)) rf = 'kap'
      }
      const ertrag = num(w.gewinn) + num(w.hinzu) - num(w.kuerz)
      const ertragAbg = Math.floor(Math.max(0, ertrag) / 100) * 100
      const fb = rf === 'kap' ? 0 : num(w.freibetrag); const nachFB = Math.max(0, ertragAbg - fb)
      const messbetrag = r2(nachFB * 0.035); const hebe = num(w.hebesatz); const gewSt = r2(messbetrag * hebe / 100)
      const vzGeb = num(w.vzGebucht), vzFest = num(w.vzFestgesetzt), vzNach = num(w.vzNachtraeglich)
      const vzGesamt = vzGeb + vzNach; const rueck = r2(gewSt - vzGesamt); const erstattung = rueck < 0
      const anr35 = r2(Math.min(messbetrag * 4, gewSt))
      const erg = [
        { l: 'Gewerbeertrag (Gewinn + Hinzurechnungen − Kürzungen)', v: ertrag },
        { l: 'abgerundet auf volle 100 €', v: ertragAbg },
        { l: '− Freibetrag' + (rf === 'kap' ? ' (KapGes: 0 €)' : ''), v: -fb },
        { l: '= Gewerbeertrag nach Freibetrag', v: nachFB },
        { l: 'Steuermessbetrag (× 3,5 %)', v: messbetrag, stark: 1 },
        { l: 'Gewerbesteuer (Messbetrag × Hebesatz ' + (hebe || 0) + ' %)', v: gewSt },
        { l: '− Vorauszahlungen (gebucht' + (vzNach ? ' + fällige' : '') + ')', v: -vzGesamt } ]
      const total = { l: erstattung ? 'GewSt-Erstattungsanspruch' : 'GewSt-Rückstellung / Nachzahlung', v: Math.abs(rueck) }
      const hinweise = [], buchungen = []

      // Vorauszahlungs-Abstimmung
      if ((vzGeb || vzFest) && Math.abs(vzGeb - vzFest) >= 0.01) hinweise.push('Vorauszahlungen lt. Buchung (' + eur(vzGeb) + ') weichen vom Bescheid des Gewerbeamts (' + eur(vzFest) + ') ab – Differenz ' + eur(vzGeb - vzFest) + ' klären / nachbuchen.')
      else if (vzFest && vzGeb) hinweise.push('Vorauszahlungen stimmen mit dem Bescheid überein.')
      // Fällige, noch nicht gezahlte VZ zum 31.12. → Verbindlichkeit (DATEV Fall 1)
      if (vzNach > 0) { hinweise.push('Fällige, aber zum 31.12. noch nicht gezahlte Vorauszahlung ' + eur(vzNach) + ' als Verbindlichkeit einbuchen (' + K.gewst + ' an ' + K.verb + ').')
        buchungen.push({ s: K.gewst, st: 'Gewerbesteuer', h: K.verb, ht: 'Verbindlichkeit Steuern (RLZ ≤ 1 J.)', betr: r2(vzNach), text: 'GewSt-VZ fällig, noch nicht gezahlt' }) }

      // Laufendes Jahr: Rückstellung (GewSt > VZ) bzw. Forderung (VZ > GewSt)
      if (rueck > 0.01) {
        hinweise.push('Gewerbesteuer ist nicht abziehbare Betriebsausgabe (§ 4 Abs. 5b EStG) – die Rückstellung außerbilanziell dem Gewinn wieder hinzurechnen.')
        buchungen.push({ s: K.gewst, st: 'Gewerbesteuer', h: K.rueck, ht: 'GewSt-Rückstellung § 4 Abs. 5b', betr: rueck, text: 'GewSt-Rückstellung ' + getStichtag().getFullYear() })
      } else if (erstattung && Math.abs(rueck) >= 0.01) {
        hinweise.push('Überzahlung ' + eur(Math.abs(rueck)) + ' – Erstattungsanspruch aktivieren (' + K.forderung + ' an ' + K.gewst + ').')
        buchungen.push({ s: K.forderung, st: 'Forderung GewSt-Überzahlung', h: K.gewst, ht: 'Gewerbesteuer', betr: r2(Math.abs(rueck)), text: 'GewSt-Erstattungsanspruch ' + getStichtag().getFullYear() })
      }

      // Vorjahres-Rückstellung abstimmen (DATEV Fall 4/5)
      const rvj = num(w.rueckVorjahr), gbesch = num(w.gewStBescheid)
      if (rvj > 0 || gbesch > 0) {
        const diff = r2(rvj - gbesch)
        erg.push({ l: 'Vorjahr: gebildete Rückstellung', v: rvj }, { l: 'Vorjahr: GewSt lt. Bescheid', v: gbesch })
        if (Math.abs(diff) < 0.01) hinweise.push('Vorjahres-Rückstellung entspricht dem Bescheid – Verbrauch ' + eur(gbesch) + ' (' + K.rueck + ' an ' + K.bank + '), keine Auflösung/Nachzahlung.')
        else if (diff > 0) {
          hinweise.push('Vorjahres-Rückstellung (' + eur(rvj) + ') über dem Bescheid (' + eur(gbesch) + ') → Verbrauch ' + eur(gbesch) + ', Auflösung ' + eur(diff) + ' als Ertrag.')
          if (gbesch > 0) buchungen.push({ s: K.rueck, st: 'GewSt-Rückstellung § 4 Abs. 5b', h: K.bank, ht: 'Bank', betr: r2(gbesch), text: 'GewSt Vorjahr (Verbrauch Rückstellung)' })
          buchungen.push({ s: K.rueck, st: 'GewSt-Rückstellung § 4 Abs. 5b', h: K.aufloesung, ht: 'Ertrag Auflösung GewSt-Rückstellung § 4 Abs. 5b', betr: diff, text: 'Auflösung GewSt-Rückstellung Vorjahr' })
        } else {
          hinweise.push('Vorjahres-Rückstellung (' + eur(rvj) + ') unter dem Bescheid (' + eur(gbesch) + ') → Verbrauch ' + eur(rvj) + ', Nachzahlung ' + eur(-diff) + ' über ' + K.vorjahr + '.')
          if (rvj > 0) buchungen.push({ s: K.rueck, st: 'GewSt-Rückstellung § 4 Abs. 5b', h: K.bank, ht: 'Bank', betr: r2(rvj), text: 'GewSt Vorjahr (Verbrauch Rückstellung)' })
          buchungen.push({ s: K.vorjahr, st: 'GewSt-Nachzahlung Vorjahre § 4 Abs. 5b', h: K.bank, ht: 'Bank', betr: r2(-diff), text: 'GewSt-Nachzahlung Vorjahr' })
        }
      }

      // Vorjahres-Korrektur aus Betriebsprüfung / geändertem Bescheid (DATEV Fall 2/3)
      const vk = num(w.vorjahrKorrektur)
      if (vk > 0.01) {
        hinweise.push('Vorjahres-Erstattung ' + eur(vk) + ' (BP/geänderter Bescheid) – ' + K.bank + ' an ' + K.vorjahr + ' (§ 4 Abs. 5b: außerbilanziell zu neutralisieren).')
        buchungen.push({ s: K.bank, st: 'Bank', h: K.vorjahr, ht: 'GewSt-Erstattung Vorjahre § 4 Abs. 5b', betr: r2(vk), text: 'GewSt-Erstattung Vorjahre (BP)' })
      } else if (vk < -0.01) {
        hinweise.push('Vorjahres-Nachzahlung ' + eur(-vk) + ' (BP/geänderter Bescheid) – ' + K.vorjahr + ' an ' + K.bank + ' (§ 4 Abs. 5b: nicht abziehbar).')
        buchungen.push({ s: K.vorjahr, st: 'GewSt-Nachzahlung Vorjahre § 4 Abs. 5b', h: K.bank, ht: 'Bank', betr: r2(-vk), text: 'GewSt-Nachzahlung Vorjahre (BP)' })
      }

      // Rechtsform-Weiche: § 35 EStG vs. Kapitalgesellschaft
      if (messbetrag > 0) {
        if (rf === 'kap') hinweise.push('Kapitalgesellschaft: Gewerbesteuer ist nicht abziehbar (§ 4 Abs. 5b EStG) und wird außerbilanziell hinzugerechnet (Programmverbindung Jahresabschluss → KSt/GewSt). Keine Anrechnung nach § 35 EStG; kein Freibetrag von 24.500 €.')
        else if (rf === 'pers') hinweise.push('§ 35 EStG (Einzel/PersG): Steuerermäßigung = 4-facher Messbetrag (' + eur(messbetrag * 4) + '), höchstens die tatsächliche Gewerbesteuer (' + eur(anr35) + ') – Messbetrag in die ESt-Erklärung übernehmen.')
        else hinweise.push('§ 35 EStG (nur Einzel/PersG, nicht KapGes): 4-facher Messbetrag (' + eur(messbetrag * 4) + '), höchstens die tatsächliche GewSt (' + eur(anr35) + '). Rechtsform in den Stammdaten hinterlegen für den passenden Hinweis.')
      }
      if (rf !== 'kap' && rf !== 'pers') hinweise.push('Buchungskonten SKR' + skr + ': Aufwand ' + K.gewst + ', Rückstellung ' + K.rueck + ', Auflösung ' + K.aufloesung + ', Vorjahre ' + K.vorjahr + ', Forderung ' + K.forderung + ', Verbindlichkeit ' + K.verb + '.')
      return { ergebnisse: erg, total, hinweise, buchungen } } },
  /* ── Aktiva (Bilanz) ── */
  anlagevermoegen: { name: 'Anlagevermögen', bereich: 'aktiva', typ: 'C',
    flags: [
      { k: 'fZugang', label: 'Zugänge im Wirtschaftsjahr' },
      { k: 'fAbgang', label: 'Abgänge / Veräußerungen' },
      { k: 'fIab', label: 'Investitionsabzugsbetrag (§ 7g) beachten' },
      { k: 'fRuecklage', label: 'Rücklage R 6.6 EStR / § 6b EStG prüfen' },
      { k: 'fAbgestimmt', label: 'Mit Mandant abgestimmt (Vollständigkeit, Schäden)' }],
    listen: [
      { key: 'zugaenge', label: 'Zugänge – neue Wirtschaftsgüter', rowNotes: true, rowFertig: true, felder: [{ k: 'buchungskonto', l: 'Buchungskonto', t: 'text' }, { k: 'bez', l: 'Bezeichnung Wirtschaftsgut', t: 'text' }, { k: 'betrOk', l: 'Betriebl. Nutzung unbedenklich', t: 'check' }, { k: 'pruef', l: 'Prüfung: betrieblich veranlasst? (→ Rückfrage)', t: 'check', warn: true }] },
      { key: 'abgaenge', label: 'Anlagenabgänge', rowNotes: true, rowFertig: true, felder: [{ k: 'buchungskonto', l: 'Buchungskonto', t: 'text' }, { k: 'bez', l: 'Bezeichnung Wirtschaftsgut', t: 'text' }] }] },
  warenbestand: { name: 'Warenbestand / Vorräte (Inventur)', bereich: 'aktiva', typ: 'C',
    flags: [
      { k: 'fInventur', label: 'Inventur durchgeführt / Inventurliste vorhanden' },
      { k: 'fNiederst', label: 'Niederstwertprinzip / Bewertung geprüft' },
      { k: 'fGaengig', label: 'Gängigkeitsabschlag / Teilwertabschreibung' },
      { k: 'fAbgestimmt', label: 'Mit Mandant abgestimmt' }],
    felder: [
      { k: 'bestandVj', l: 'Warenbestand Vorjahr (Buchwert)', t: 'num' },
      { k: 'inventur', l: 'Inventurwert 31.12. (AK/HK)', t: 'num' },
      { k: 'abwertung', l: 'Gängigkeits-/Teilwertabschlag', t: 'num' },
      { k: 'kBestand', l: 'Konto Warenbestand', t: 'text', def: '3980' },
      { k: 'kVeraenderung', l: 'Konto Bestandsveränderung', t: 'text', def: '3960' }],
    rechnen: (w, ctx) => { const vj = num(w.bestandVj), inv = num(w.inventur), abw = num(w.abwertung)
      const neu = inv - abw, ver = neu - vj
      const erg = [{ l: 'Inventurwert (AK/HK)', v: inv }, { l: '− Abwertung (Gängigkeit/Teilwert)', v: -abw },
        { l: '= Bilanzansatz 31.12.', v: neu, stark: 1 }, { l: 'Warenbestand Vorjahr', v: vj },
        { l: (ver >= 0 ? 'Bestandserhöhung' : 'Bestandsminderung'), v: ver }]
      const buchungen = []; if (Math.abs(ver) >= 0.01) {
        if (ver >= 0) buchungen.push({ s: w.kBestand || '3980', st: 'Warenbestand', h: w.kVeraenderung || '3960', ht: 'Bestandsveränderung', betr: ver, text: 'Bestandserhöhung lt. Inventur' })
        else buchungen.push({ s: w.kVeraenderung || '3960', st: 'Bestandsveränderung', h: w.kBestand || '3980', ht: 'Warenbestand', betr: Math.abs(ver), text: 'Bestandsminderung lt. Inventur' }) }
      const hinweise = []
      if (!w.fInventur) hinweise.push('Inventur zum Bilanzstichtag nachweisen (körperliche Bestandsaufnahme / Inventurliste).')
      if (w.fGaengig && abw > 0) hinweise.push('Teilwertabschreibung nur bei voraussichtlich dauernder Wertminderung; Gängigkeitsabschläge dokumentieren.')
      return { ergebnisse: erg, total: { l: 'Bilanzansatz Vorräte', v: neu }, hinweise, buchungen } } },
  forderungen: { name: 'Forderungen aus L&L (mit Wertberichtigung)', bereich: 'aktiva', typ: 'C',
    flags: [
      { k: 'fOpListe', label: 'OP-Liste / Altersstruktur geprüft' },
      { k: 'fUneinbr', label: 'Uneinbringliche Forderungen' },
      { k: 'fEwb', label: 'Einzelwertberichtigung (zweifelhaft)' },
      { k: 'fPwb', label: 'Pauschalwertberichtigung bilden' },
      { k: 'fAbgestimmt', label: 'Mit Mandant abgestimmt' }],
    felder: [
      { k: 'brutto', l: 'Forderungsbestand brutto (lt. Konto)', t: 'num' },
      { k: 'ustSatz', l: 'USt-Satz %', t: 'num', def: '19' },
      { k: 'uneinbr', l: 'davon uneinbringlich (brutto)', t: 'num' },
      { k: 'zweifelNetto', l: 'zweifelhafte Forderungen (netto)', t: 'num' },
      { k: 'ewbPct', l: 'EWB-Satz %', t: 'num' },
      { k: 'pwbPct', l: 'PWB-Satz % (auf einwandfreie netto)', t: 'num', def: '1' },
      { k: 'kForderung', l: 'Konto Forderungen', t: 'text', def: '1400' },
      { k: 'kAbschr', l: 'Konto Abschreibung Forderungen', t: 'text', def: '2400' },
      { k: 'kEwb', l: 'Konto Wertberichtigungen', t: 'text', def: '0998' }],
    rechnen: (w, ctx) => { const brutto = num(w.brutto), satz = num(w.ustSatz) || 0, unBr = num(w.uneinbr), zwNetto = num(w.zweifelNetto), ewbP = num(w.ewbPct), pwbP = num(w.pwbPct)
      const f = 1 + satz / 100, r2 = x => Math.round(x * 100) / 100
      const unNetto = r2(unBr / f), unUst = r2(unBr - unNetto), ewb = r2(zwNetto * ewbP / 100)
      const einwandfreiNetto = Math.max(0, r2((brutto - unBr) / f - zwNetto)), pwb = r2(einwandfreiNetto * pwbP / 100)
      const abschrGes = r2(unNetto + ewb + pwb)
      const erg = [{ l: 'Forderungen brutto', v: brutto },
        { l: 'uneinbringlich – netto abzuschreiben', v: unNetto }, { l: 'uneinbringlich – USt-Berichtigung (§ 17)', v: unUst },
        { l: 'Einzelwertberichtigung (EWB)', v: ewb }, { l: 'einwandfreie Forderungen (netto)', v: einwandfreiNetto },
        { l: 'Pauschalwertberichtigung (PWB)', v: pwb }, { l: 'Forderungsabschreibung gesamt (Aufwand)', v: abschrGes, stark: 1 }]
      const buchungen = []
      if (unBr > 0) { buchungen.push({ s: w.kAbschr || '2400', st: 'Abschreibung Forderungen', h: w.kForderung || '1400', ht: 'Forderungen', betr: unNetto, text: 'uneinbringliche Forderung (netto)' })
        if (unUst > 0) buchungen.push({ s: '1776', st: 'Umsatzsteuer', h: w.kForderung || '1400', ht: 'Forderungen', betr: unUst, text: 'USt-Berichtigung § 17 UStG' }) }
      if (ewb > 0) buchungen.push({ s: w.kAbschr || '2400', st: 'Einstellung EWB', h: w.kEwb || '0998', ht: 'Wertberichtigungen', betr: ewb, text: 'Einzelwertberichtigung' })
      if (pwb > 0) buchungen.push({ s: w.kAbschr || '2400', st: 'Einstellung PWB', h: w.kEwb || '0998', ht: 'Wertberichtigungen', betr: pwb, text: 'Pauschalwertberichtigung' })
      const hinweise = []
      if (!w.fOpListe) hinweise.push('OP-Liste / Altersstruktur prüfen – Basis für zweifelhafte und uneinbringliche Forderungen.')
      if (w.fUneinbr) hinweise.push('Uneinbringlich: Forderung netto ausbuchen und USt nach § 17 UStG berichtigen.')
      if (w.fEwb) hinweise.push('EWB nur auf den Nettobetrag; USt erst bei tatsächlicher Uneinbringlichkeit berichtigen.')
      return { ergebnisse: erg, total: { l: 'Forderungsabschreibung gesamt', v: abschrGes }, hinweise, buchungen } } },
  immVg: { name: 'Immaterielle Vermögensgegenstände', bereich: 'aktiva', typ: 'B', konto: '0027', bez: 'Immaterielle VG' },
  finanzanlagen: { name: 'Finanzanlagen / Wertpapiere', bereich: 'aktiva', typ: 'B', konto: '0500', bez: 'Finanzanlagen' },
  kasse: { name: 'Kassenbestand', bereich: 'aktiva', typ: 'B', konto: '1000', bez: 'Kasse' },
  sonstVg: { name: 'Sonstige Vermögensgegenstände', bereich: 'aktiva', typ: 'B', konto: '1500', bez: 'Sonstige VG' },
  bank: { name: 'Bankguthaben', bereich: 'aktiva', typ: 'B', konto: '1200', bez: 'Bank' },
  rapAktiv: { name: 'Aktive Rechnungsabgrenzung (Bilanz)', bereich: 'aktiva', typ: 'C', positionen: true,
    posFelder: [{ k: 'bez', l: 'Bezeichnung', t: 'text' }, { k: 'betrag', l: 'Betrag gesamt', t: 'num' }, { k: 'beginn', l: 'Beginn', t: 'date' }, { k: 'ende', l: 'Ende', t: 'date' }, { k: 'kAufw', l: 'Aufwandskonto', t: 'text', def: '4360' }] },
  /* ── Passiva (Bilanz) ── */
  rueckstellungen: { name: 'Rückstellungen (Rückstellungsspiegel)', bereich: 'passiva', typ: 'C', posLabel: 'Rückstellungsspiegel',
    flags: [
      { k: 'fSteuer', label: 'Steuerrückstellungen (GewSt/KSt) enthalten' },
      { k: 'fAbzinsung', label: 'Abzinsung § 6 Abs. 1 Nr. 3a (Laufzeit > 12 Monate)' },
      { k: 'fDrohverlust', label: 'Drohverlustrückstellung (steuerlich Ansatzverbot § 5 Abs. 4a)' },
      { k: 'fAbgestimmt', label: 'Mit Mandant abgestimmt' }],
    felder: [
      { k: 'kAufwand', l: 'Konto Zuführung (Aufwand)', t: 'text', def: '4930' },
      { k: 'kRueck', l: 'Rückstellungskonto', t: 'text', def: '0970' },
      { k: 'kErtrag', l: 'Konto Erträge aus Auflösung', t: 'text', def: '2735' }],
    positionen: true,
    posFelder: [{ k: 'bez', l: 'Rückstellung', t: 'text' }, { k: 'anfang', l: 'Anfangsbestand', t: 'num' }, { k: 'zufuehr', l: 'Zuführung', t: 'num' }, { k: 'inanspr', l: 'Inanspruchnahme', t: 'num' }, { k: 'aufl', l: 'Auflösung', t: 'num' }],
    rechnen: (w, ctx) => { let sA = 0, sZ = 0, sI = 0, sL = 0; const det = []
      ;(w._pos || []).forEach(x => { const a = num(x.anfang), z = num(x.zufuehr), i = num(x.inanspr), l = num(x.aufl); if (!a && !z && !i && !l) return
        sA += a; sZ += z; sI += i; sL += l; det.push({ l: (x.bez || 'Rückstellung') + ' – Endbestand', v: a + z - i - l }) })
      const end = sA + sZ - sI - sL
      const erg = [...det, { l: 'Anfangsbestand gesamt', v: sA }, { l: '+ Zuführung', v: sZ }, { l: '− Inanspruchnahme', v: -sI }, { l: '− Auflösung', v: -sL }, { l: '= Endbestand 31.12.', v: end, stark: 1 }]
      const buchungen = []
      if (sZ > 0) buchungen.push({ s: w.kAufwand || '4930', st: 'Zuführung Rückstellungen', h: w.kRueck || '0970', ht: 'Rückstellungen', betr: sZ, text: 'Zuführung Rückstellungen' })
      if (sL > 0) buchungen.push({ s: w.kRueck || '0970', st: 'Rückstellungen', h: w.kErtrag || '2735', ht: 'Erträge aus Auflösung', betr: sL, text: 'Auflösung Rückstellungen' })
      const hinweise = []
      if (w.fAbzinsung) hinweise.push('Rückstellungen mit Restlaufzeit > 12 Monaten steuerlich mit 5,5 % abzinsen (§ 6 Abs. 1 Nr. 3a Buchst. e).')
      if (w.fDrohverlust) hinweise.push('Drohverlustrückstellungen sind handelsrechtlich zu bilden, steuerlich aber nicht ansatzfähig (§ 5 Abs. 4a EStG) – außerbilanziell korrigieren.')
      if (w.fSteuer) hinweise.push('Steuerrückstellungen (GewSt/KSt) gesondert ermitteln und mit den Vorauszahlungen abstimmen.')
      return { ergebnisse: erg, total: { l: 'Rückstellungen 31.12.', v: end }, hinweise, buchungen } } },
  verbindlichkeiten: { name: 'Verbindlichkeiten (Restlaufzeiten)', bereich: 'passiva', typ: 'C', posLabel: 'Verbindlichkeitenspiegel (für Anhang)',
    flags: [
      { k: 'fSpiegel', label: 'Verbindlichkeitenspiegel für Anhang erstellt' },
      { k: 'fSicherheiten', label: 'Besicherte Verbindlichkeiten (Angabe)' },
      { k: 'fAbgestimmt', label: 'Mit Mandant abgestimmt (Saldenbestätigungen)' }],
    positionen: true,
    posFelder: [{ k: 'bez', l: 'Art der Verbindlichkeit', t: 'text' }, { k: 'u1', l: '≤ 1 Jahr', t: 'num' }, { k: 'm15', l: '1–5 Jahre', t: 'num' }, { k: 'ue5', l: '> 5 Jahre', t: 'num' }],
    rechnen: (w, ctx) => { let a = 0, b = 0, c = 0; (w._pos || []).forEach(x => { a += num(x.u1); b += num(x.m15); c += num(x.ue5) })
      const ges = a + b + c
      return { ergebnisse: [{ l: 'Restlaufzeit ≤ 1 Jahr', v: a }, { l: 'Restlaufzeit 1–5 Jahre', v: b }, { l: 'Restlaufzeit > 5 Jahre', v: c }, { l: 'Gesamt', v: ges, stark: 1 }],
        total: { l: 'Verbindlichkeiten gesamt', v: ges },
        hinweise: w.fSpiegel ? [] : ['Verbindlichkeitenspiegel (Restlaufzeiten) für den Anhang aufbereiten (§ 285 Nr. 1 HGB).'] } } },
  kapital: { name: 'Kapital / Eigenkapital-Entwicklung', bereich: 'passiva', typ: 'C',
    flags: [
      { k: 'fEntnahmen', label: 'Entnahmen geprüft (Überentnahmen § 4 Abs. 4a)' },
      { k: 'fAbgestimmt', label: 'Mit Mandant abgestimmt' }],
    felder: [
      { k: 'anfang', l: 'Kapital / Eigenkapital 01.01.', t: 'num' },
      { k: 'einlagen', l: 'Einlagen / Kapitalerhöhung', t: 'num' },
      { k: 'entnahmen', l: 'Entnahmen / Ausschüttungen', t: 'num' },
      { k: 'ergebnis', l: 'Jahresüberschuss (+) / -fehlbetrag (−)', t: 'num', full: true }],
    rechnen: (w, ctx) => { const a = num(w.anfang), ein = num(w.einlagen), ent = num(w.entnahmen), erg = num(w.ergebnis)
      const end = a + ein - ent + erg
      const hinweise = []; if (w.fEntnahmen) hinweise.push('Bei Überentnahmen ggf. nicht abziehbare Schuldzinsen nach § 4 Abs. 4a EStG hinzurechnen.')
      return { ergebnisse: [{ l: 'Kapital 01.01.', v: a }, { l: '+ Einlagen', v: ein }, { l: '− Entnahmen', v: -ent }, { l: '± Jahresergebnis', v: erg }, { l: '= Kapital 31.12.', v: end, stark: 1 }],
        total: { l: 'Kapital 31.12.', v: end }, hinweise } } },
  ruecklage6b: { name: 'Rücklage § 6b EStG', bereich: 'passiva', typ: 'C',
    flags: [
      { k: 'fBildung', label: 'Rücklage im Wirtschaftsjahr gebildet' },
      { k: 'fUebertrag', label: 'Auf Reinvestition übertragen' },
      { k: 'fAufloesung', label: 'Aufgelöst ohne Reinvestition (Gewinnzuschlag)' }],
    felder: [
      { k: 'betrag', l: 'Rücklagenbetrag (aufgedeckte stille Reserven)', t: 'num' },
      { k: 'reinvest', l: 'auf Reinvestition übertragen', t: 'num' },
      { k: 'jahre', l: 'Bestehensjahre der Rücklage', t: 'num' }],
    rechnen: (w, ctx) => { const betr = num(w.betrag), re = num(w.reinvest), j = num(w.jahre)
      const rest = Math.max(0, betr - re)
      const zuschlag = w.fAufloesung ? Math.round(rest * 0.06 * j * 100) / 100 : 0
      const erg = [{ l: 'Rücklage § 6b', v: betr }, { l: '− übertragen auf Reinvestition', v: -re }, { l: 'verbleibende Rücklage', v: rest, stark: 1 }]
      if (w.fAufloesung) { erg.push({ l: 'gewinnerhöhende Auflösung', v: rest }); erg.push({ l: '+ Gewinnzuschlag 6 % p.a. (' + j + ' J.)', v: zuschlag }) }
      const hinweise = ['Reinvestitionsfrist grundsätzlich 4 Jahre (6 Jahre bei neu hergestellten Gebäuden mit Herstellungsbeginn in der Frist).']
      if (w.fAufloesung) hinweise.push('Bei Auflösung ohne Reinvestition: gewinnerhöhende Auflösung zzgl. Gewinnzuschlag 6 % pro Jahr des Bestehens (§ 6b Abs. 7 EStG).')
      return { ergebnisse: erg, total: { l: w.fAufloesung ? 'Auflösung inkl. Zuschlag' : 'verbleibende Rücklage', v: w.fAufloesung ? rest + zuschlag : rest }, hinweise } } },
  rapPassiv: { name: 'Passive Rechnungsabgrenzung (PRAP)', bereich: 'passiva', typ: 'C', posLabel: 'Passive Abgrenzungsposten',
    flags: [
      { k: 'fVollstaendig', label: 'Im Voraus erhaltene Erträge vollständig erfasst' },
      { k: 'fAbgestimmt', label: 'Mit Mandant abgestimmt' }],
    felder: [{ k: 'kPrap', l: 'Konto Passive RAP', t: 'text', def: '0990' }],
    positionen: true,
    posFelder: [{ k: 'bez', l: 'Bezeichnung', t: 'text' }, { k: 'betrag', l: 'Betrag gesamt (im Voraus erhalten)', t: 'num' },
                { k: 'beginn', l: 'Beginn', t: 'date' }, { k: 'ende', l: 'Ende', t: 'date' }, { k: 'kErtrag', l: 'Ertragskonto', t: 'text', def: '8000' }],
    rechnen: (w, ctx) => { const pos = (w._pos || []); let sumRap = 0, sumErtrag = 0; const buchungen = []; const detail = []
      const STICHTAG = getStichtag()
      pos.forEach(p => { const b = num(p.betrag); if (!b || !p.beginn || !p.ende) return
        const A = new Date(p.beginn), E = new Date(p.ende); const ges = Math.max(1, tage(A, E))
        const nach = Math.max(0, tage(STICHTAG < A ? A : new Date(STICHTAG.getTime() + 86400000), E))
        const prap = Math.round(b * Math.min(nach, ges) / ges * 100) / 100; const ertrag = Math.round((b - prap) * 100) / 100
        sumRap += prap; sumErtrag += ertrag; detail.push({ l: (p.bez || 'Position') + ' – passiver RAP', v: prap })
        if (prap > 0) buchungen.push({ s: p.kErtrag || '8000', st: 'Ertrag', h: w.kPrap || '0990', ht: 'Passive RAP', betr: prap, text: 'PRAP ' + (p.bez || '') }) })
      return { ergebnisse: [...detail, { l: 'Ertrag laufendes Jahr', v: sumErtrag }],
        total: { l: 'Passiver RAP zum ' + getStichtag().toLocaleDateString('de-DE'), v: sumRap },
        buchungen, hinweise: ['Passive RAP: im Voraus erhaltene (vereinnahmte) Erträge, die wirtschaftlich das Folgejahr betreffen (§ 5 Abs. 5 Satz 1 Nr. 2 EStG).'] } } },
  ustModul: { name: 'Umsatzsteuer (Konten & Verprobung)', bereich: 'steuern', typ: 'C', kontoListe: true,
    flags: [
      { k: 'fVa', label: 'USt-Voranmeldungen mit Jahressummen abgestimmt' },
      { k: 'fZm', label: 'Zusammenfassende Meldung / § 13b abgestimmt' },
      { k: 'fVerprobung', label: 'Umsatzsteuer-Verprobung durchgeführt' } ],
    felder: [
      { k: 'erloese19', l: 'Bemessungsgrundlage 19 % (netto, lt. Erlöskonten)', t: 'num' },
      { k: 'erloese7', l: 'Bemessungsgrundlage 7 % (netto)', t: 'num' },
      { k: 'vzFA', l: 'geleistete USt-Vorauszahlungen lt. Steuerkonto (Finanzamt)', t: 'num' },
      { k: 'kForderung', l: 'Konto Forderung USt', t: 'text', def: '1548' },
      { k: 'kVerb', l: 'Konto Verbindlichkeit USt', t: 'text', def: '1790' },
      { k: 'notiz', l: 'Notiz / Klärung Verprobungsdifferenz', t: 'area' } ],
    listen: [{ key: 'konten', label: 'Umsatzsteuer-Konten (Rolle je Konto zuordnen)', rowNotes: true, felder: [
      { k: 'konto', l: 'Konto', t: 'text' }, { k: 'bez', l: 'Bezeichnung', t: 'text' }, { k: 'saldo', l: 'Saldo', t: 'num' }, { k: 'vj', l: 'Vorjahr', t: 'num' },
      { k: 'rolle', l: 'Rolle', t: 'select', opt: [['', '— Rolle —'], ['ust', 'USt (Ausgang)'], ['vst', 'Vorsteuer'], ['13b', '§ 13b'], ['vz', 'Vorauszahlung'], ['fordverb', 'Forderung/Verb.'], ['sonst', 'sonstige']] },
      { k: 'ok', l: 'geprüft', t: 'check' } ] }],
    rechnen: (w, ctx) => {
      const rows = w.konten || []; let ust = 0, vst = 0, u13 = 0, vz = 0, fv = 0
      rows.forEach(r => { if (!r) return; const s = num(r.saldo); const rolle = r.rolle || ustRolleGuess(r.konto, r.bez)
        if (rolle === 'ust') ust += s; else if (rolle === 'vst') vst += s; else if (rolle === '13b') u13 += s; else if (rolle === 'vz') vz += s; else if (rolle === 'fordverb') fv += s })
      const zahllast = ust + u13 - vst
      const bmg19 = num(w.erloese19), bmg7 = num(w.erloese7); const soll = Math.round((bmg19 * 0.19 + bmg7 * 0.07) * 100) / 100
      const verpr = Math.round((ust - soll) * 100) / 100
      const vzFA = num(w.vzFA); const rest = zahllast - vzFA; const erstattung = rest < 0
      const erg = [
        { l: 'Ausgangsumsatzsteuer (gebucht)', v: ust },
        { l: '+ Umsatzsteuer § 13b', v: u13 },
        { l: '− Vorsteuer', v: -vst },
        { l: '= Umsatzsteuer-Zahllast', v: zahllast, stark: 1 },
        { l: '− geleistete Vorauszahlungen (Steuerkonto FA)', v: -vzFA } ]
      if (bmg19 || bmg7) erg.push({ l: 'Verprobung: Soll-USt (19 % / 7 %)', v: soll }, { l: 'gebuchte Ausgangs-USt', v: ust }, { l: 'Verprobungsdifferenz', v: verpr })
      const total = { l: erstattung ? 'USt-Erstattungsanspruch' : 'USt-Restschuld ans Finanzamt', v: Math.abs(rest) }
      const hinweise = [], buchungen = []
      if ((bmg19 || bmg7) && Math.abs(verpr) >= 1) hinweise.push('Verprobungsdifferenz ' + eur(verpr) + ' aufklären (z. B. § 13b-, steuerfreie/Ausfuhr-Umsätze, Anzahlungen, unentgeltliche Wertabgaben, Periodenverschiebungen).')
      if ((vz || vzFA) && Math.abs(vz - vzFA) >= 0.01) hinweise.push('Vorauszahlungen lt. Buchung (' + eur(vz) + ') und lt. Steuerkonto FA (' + eur(vzFA) + ') weichen um ' + eur(Math.abs(vz - vzFA)) + ' ab – abstimmen.')
      if ((ctx.gw || 'euer') === 'bilanz') {
        if (Math.abs(rest) >= 0.01) {
          if (erstattung) buchungen.push({ s: w.kForderung || '1548', st: 'Forderung Umsatzsteuer', h: '1780', ht: 'USt-Vorauszahlungen', betr: Math.abs(rest), text: 'USt-Erstattungsanspruch zum 31.12.' })
          else buchungen.push({ s: '1780', st: 'USt-Vorauszahlungen', h: w.kVerb || '1790', ht: 'Verbindlichkeit Umsatzsteuer', betr: Math.abs(rest), text: 'USt-Restschuld zum 31.12.' })
        }
      } else hinweise.push('EÜR: USt wirkt sich erst bei Zahlung/Erstattung als Betriebsausgabe/-einnahme aus (§ 11 EStG) – keine Forderung/Verbindlichkeit ausweisen.')
      return { ergebnisse: erg, total, hinweise, buchungen }
    } },
  steuerrueck: { name: 'Steuerrückstellungen (GewSt/KSt)', bereich: 'passiva', typ: 'B', konto: '0955', bez: 'Steuerrückstellungen' },
  darlehenKonto: { name: 'Darlehen / Bankverbindlichkeiten (Konto)', bereich: 'passiva', typ: 'B', konto: '0630', bez: 'Darlehen' },
  sonstVerb: { name: 'Sonstige Verbindlichkeiten', bereich: 'passiva', typ: 'B', konto: '1700', bez: 'Sonstige Verb.' },
  ergebnisverwendung: { name: 'Ergebnisverwendung / Gewinnverteilung', bereich: 'passiva', typ: 'A' },
}
MODULE.rapAktiv.rechnen = MODULE.rap.rechnen // rapAktiv nutzt denselben RAP-Rechner

export function KONTO_RECHNEN(w) { let sS = 0, sV = 0; const erg = [], hin = []
  ;(w.konten || []).forEach(k => { const s = num(k.saldo), v = num(k.vj); if (!(k.konto || s || v)) return; sS += s; sV += v; const d = s - v; const p = v ? Math.round(d / Math.abs(v) * 1000) / 10 : 0
    erg.push({ l: ((k.konto || '') + ' ' + (k.bez || '')).trim() + (v ? ' (' + (p > 0 ? '+' : '') + p + '%)' : ''), v: d })
    if (v && Math.abs(p) >= 20 && !k.ok) hin.push('Konto ' + (k.konto || '?') + ': ' + (p > 0 ? '+' : '') + p + '% ggü. Vorjahr – Ursache dokumentieren.') })
  erg.push({ l: 'Summe (Saldo)', v: sS, stark: 1 }); erg.push({ l: 'Summe Vorjahr', v: sV })
  if (!w.fPlausibel) hin.push('Plausibilität bestätigen, sobald geprüft.')
  return { ergebnisse: erg, total: { l: 'Abweichung ggü. Vorjahr', v: sS - sV }, hinweise: hin } }

;['erloeseStpfl', 'erloeseErmaessigt', 'erloeseSteuerfrei', 'erloeseAusfuhr', 'erloese13b', 'erloeseSonst'].forEach(k => { MODULE[k].rechnen = KONTO_RECHNEN; MODULE[k].kontoListe = true })

// Generische Konten-Kategorien (Kontenabstimmung je Bereich)
function kontoModul(name, bereich) { return { name, bereich, typ: 'C', kontoListe: true,
  flags: [{ k: 'fPlausibel', label: 'Konten geprüft / mit Vorjahr abgestimmt' }],
  listen: [{ key: 'konten', label: 'Konten', rowNotes: true, felder: [{ k: 'konto', l: 'Konto', t: 'text' }, { k: 'bez', l: 'Bezeichnung', t: 'text' }, { k: 'saldo', l: 'Saldo', t: 'num' }, { k: 'vj', l: 'Vorjahr', t: 'num' }, { k: 'ok', l: 'abgestimmt', t: 'check' }] }],
  felder: [{ k: 'notiz', l: 'Notiz / Abweichungen dokumentieren', t: 'area' }], rechnen: KONTO_RECHNEN } }
MODULE.konAnlage   = kontoModul('Anlagevermögen (Konten)', 'aktiva')
MODULE.konUmlauf   = kontoModul('Umlaufvermögen & sonstige Aktiva (Konten)', 'aktiva')
MODULE.konKapital  = kontoModul('Eigenkapital / Privat (Konten)', 'passiva')
MODULE.konVerbindl = kontoModul('Verbindlichkeiten (Konten)', 'passiva')
MODULE.konRueckst  = kontoModul('Rückstellungen (Konten)', 'passiva')
MODULE.konMaterial = kontoModul('Wareneinkauf / Materialaufwand (Konten)', 'ba')
MODULE.konAufwand  = kontoModul('Betriebsausgaben / Aufwand (Konten)', 'ba')
MODULE.konNeutral  = kontoModul('Neutrale / sonstige Konten', 'ba')
MODULE.konUnklar   = kontoModul('Nicht zugeordnete Konten', 'ba')
MODULE.darlehen    = { name: 'Darlehen (Verwaltung & Prüfung)', bereich: 'passiva', typ: 'C', custom: 'darlehen' }

// ── Labels / Reihenfolge ──────────────────────────────────────────────────────
export const BEREICH = { be: 'Betriebseinnahmen', ba: 'Betriebsausgaben', aktiva: 'Aktiva (Bilanz)', passiva: 'Passiva (Bilanz)', steuern: 'Steuern' }
export const VIEW_LABEL = { stammdaten: 'Stammdaten', be: 'Betriebseinnahmen', ba: 'Betriebsausgaben', aktiva: 'Aktiva', passiva: 'Passiva', steuern: 'Steuern', _: 'Weitere' }
export const VIEW_ORDER = ['be', 'ba', 'aktiva', 'passiva', 'steuern', '_']
export const BEREICH_FARBE = { stammdaten: '#475569', be: '#16a34a', ba: '#ef4444', aktiva: '#2563eb', passiva: '#7c3aed', steuern: '#b45309', abstimmung: '#0891b2' }

// ── Stammdaten & Auftrag (vorangestellter Sonder-Reiter, datengetrieben) ──────
// Wird in data.stammdaten gespeichert und im Excel-Export als eigenes Blatt ausgegeben.
export const STAMMDATEN_FELDER = [
  { gruppe: 'Mandant & Kontakt', felder: [
    { k: 'name', l: 'Mandant / Firma', t: 'text' },
    { k: 'mandantennr', l: 'Mandantennummer', t: 'text' },
    { k: 'ansprechpartner', l: 'Ansprechpartner', t: 'text' },
    { k: 'telefon', l: 'Telefon', t: 'text' },
    { k: 'email', l: 'E-Mail', t: 'text' },
    { k: 'steuernr', l: 'Steuernummer', t: 'text' },
    { k: 'ustid', l: 'USt-IdNr.', t: 'text' },
    { k: 'adresse', l: 'Anschrift', t: 'area' } ] },
  { gruppe: 'Besteuerung & Gewinnermittlung', felder: [
    { k: 'versteuerung', l: 'Umsatzsteuer-Art', t: 'select', opt: [['', '—'], ['soll', 'Sollversteuerung (§ 16 UStG)'], ['ist', 'Istversteuerung (§ 20 UStG)'], ['klein', 'Kleinunternehmer (§ 19 UStG)']] },
    { k: 'rechtsform', l: 'Rechtsform', t: 'text' },
    { k: 'gewinnermittlung', l: 'Gewinnermittlung', t: 'select', opt: [['', '—'], ['euer', 'EÜR (§ 4 Abs. 3 EStG)'], ['bilanz', 'Bilanzierung (§ 4 Abs. 1 / § 5 EStG)']] },
    { k: 'gwHinweis', l: 'Hinweis zur Gewinnermittlung', t: 'area' } ] },
  { gruppe: 'Erlöse & USt-Besonderheiten', felder: [
    { k: 'steuerfreieErloese', l: 'Steuerfreie / besondere Erlöse – Grund & Art (z. B. § 4 UStG, Ausfuhr, ig. Lieferung, § 13b)', t: 'area' } ] },
  { gruppe: 'Prüfung & Besonderheiten', felder: [
    { k: 'betriebspruefung', l: 'Betriebsprüfung (laufend/angekündigt, Zeitraum, Prüfer)', t: 'area' },
    { k: 'rechtsbehelfe', l: 'Offene Rechtsbehelfe / Vorbehalt der Nachprüfung', t: 'area' },
    { k: 'besonderheiten', l: 'Besonderheiten / Sonstiges', t: 'area' } ] },
]

export function modLists(mod) {
  if (mod.listen) return mod.listen
  if (mod.positionen) return [{ key: '_pos', label: mod.posLabel || 'Positionen', felder: mod.posFelder || [] }]
  return []
}

// ── Vorlagen (Grundchecklisten) ───────────────────────────────────────────────
function cat(name, bereich, abschnitt) { return { id: uid(), name, bereich, abschnitt, punkte: [] } }
export function vorlageJA(gw) {
  if (gw === 'bilanz') return [
    cat('Betriebseinnahmen', 'be', 'guv'), cat('Betriebsausgaben', 'ba', 'guv'),
    cat('Aktive Bilanzposten', 'aktiva', 'aktiva'), cat('Passive Bilanzposten', 'passiva', 'passiva')]
  return [cat('Betriebseinnahmen', 'be', 'euer'), cat('Betriebsausgaben', 'ba', 'euer')]
}

// ── Prüfpunkt-Fabriken ────────────────────────────────────────────────────────
export function neuerModulPunkt(id) { const m = MODULE[id]; if (!m) return null
  return { id: uid(), titel: m.name, typ: m.typ, modul: id, konten: [], status: 'offen', werte: { _pos: [] } } }

export function viewsOf(cl) { const p = []; (cl.kategorien || []).forEach(k => { const b = k.bereich || '_'; if (p.indexOf(b) < 0) p.push(b) })
  return p.sort((a, b) => { const ia = VIEW_ORDER.indexOf(a), ib = VIEW_ORDER.indexOf(b); return (ia < 0 ? 9 : ia) - (ib < 0 ? 9 : ib) }) }

export function ensureKat(cl, bereich) {
  if (!cl.kategorien) cl.kategorien = []
  let k = cl.kategorien.find(x => x.bereich === bereich)
  if (k) return k
  const namen = { be: 'Betriebseinnahmen', ba: 'Betriebsausgaben', aktiva: 'Aktive Bilanzposten', passiva: 'Passive Bilanzposten', steuern: 'Steuern' }
  const absch = { be: cl.gw === 'bilanz' ? 'guv' : 'euer', ba: cl.gw === 'bilanz' ? 'guv' : 'euer', aktiva: 'aktiva', passiva: 'passiva', steuern: 'steuern' }
  k = cat(namen[bereich] || bereich, bereich, absch[bereich] || '')
  cl.kategorien.push(k)
  return k
}

export const alleP = cl => (cl.kategorien || []).flatMap(k => k.punkte || [])
export function fortschritt(cl) { const p = alleP(cl); const done = p.filter(x => x.status === 'ok').length; return { done, total: p.length, pct: p.length ? Math.round(done / p.length * 100) : 0 } }

// ── SuSa-/Kontenabstimmliste: Klassifizierung & Zuordnung ─────────────────────
export function erloesKategorie(bez, konto) { const b = (bez || '').toLowerCase()
  if (/13\s*b|steuerschuld|reverse|umkehr/.test(b)) return 'erloese13b'
  if (/ausfuhr|innergemeinschaft|ig[-\s.]|drittland|eu-lieferung|gelangen/.test(b)) return 'erloeseAusfuhr'
  if (/ermäßigt|ermaessigt|7\s*%|halb/.test(b)) return 'erloeseErmaessigt'
  if (/steuerfrei|steuerbefreit|§\s*4/.test(b)) return 'erloeseSteuerfrei'
  if (/steuerpflicht|19\s*%|regelsteuer|volle[rn]?\s+satz/.test(b)) return 'erloeseStpfl'
  if (/schaden|sonstige|übrige|neutral|periodenfremd/.test(b)) return 'erloeseSonst'
  const n = +konto; if (n >= 8400 && n <= 8419) return 'erloeseStpfl'; if (n >= 8300 && n <= 8319) return 'erloeseErmaessigt'
  if (n >= 8120 && n <= 8140) return 'erloeseAusfuhr'; if (n >= 8100 && n <= 8199) return 'erloeseSteuerfrei'
  return 'erloeseSonst' }

// Rolle eines USt-Kontos aus der Bezeichnung ableiten (SKR03/04-übergreifend, textbasiert)
export function ustRolleGuess(konto, bez) { const b = (bez || '').toLowerCase()
  if (/vorsteuer/.test(b)) return 'vst'
  if (/13\s*b|steuerschuld|reverse[- ]?charge|leistungsempfänger/.test(b)) return '13b'
  if (/vorauszahlung|voranmeldung|ust-?va/.test(b)) return 'vz'
  if (/forderung|erstattungsanspruch/.test(b) && /umsatzsteuer|ust/.test(b)) return 'fordverb'
  if (/verbindlichkeit/.test(b) && /umsatzsteuer|ust/.test(b)) return 'fordverb'
  if (/umsatzsteuer|\bust\b/.test(b)) return 'ust'
  return '' }

export function klassifiziereKonto(konto, bez) { const n = +konto; const b = (bez || '').toLowerCase()
  if (n >= 8000 && n <= 8999) return erloesKategorie(bez, konto)
  if (/gewerbesteuer|gewst/.test(b)) return 'gewerbesteuer'
  if (/umsatzsteuer|vorsteuer|13\s*b|voranmeldung|ust-?va|ust-?zahllast|ust[\s-]?voraus/.test(b)) return 'ustModul'
  if (n >= 1 && n <= 999) {
    if (/rückstell|rueckstell/.test(b) || (n >= 950 && n <= 989)) return 'konRueckst'
    if (/darlehen|kredit|kreditinstitut|hypothek/.test(b) || (n >= 630 && n <= 699)) return 'konVerbindl'
    if (/kapital|eigenkapital|privat|rücklage|gewinnvortrag|einlage|entnahme/.test(b) || (n >= 800 && n <= 899)) return 'konKapital'
    return 'konAnlage' }
  if (n >= 1000 && n <= 1999) {
    if ((n >= 1800 && n <= 1899) || /privat|entnahme|einlage/.test(b)) return 'konKapital'
    if (/rückstell|rueckstell/.test(b)) return 'konRueckst'
    if ((n >= 1600 && n <= 1799) || /verbindlichkeit|umsatzsteuer|lohnsteuer|kirchensteuer|sozialvers|darlehen/.test(b)) return 'konVerbindl'
    return 'konUmlauf' }
  if (n >= 2000 && n <= 2999) return 'konNeutral'
  if (n >= 3000 && n <= 3999) { if (/bestand/.test(b) || n >= 3960) return 'konUmlauf'; return 'konMaterial' }
  if (n >= 4000 && n <= 4999) return 'konAufwand'
  return 'konUnklar' }

export function kontoZiele() { return Object.entries(MODULE).filter(([k, m]) => m.kontoListe).map(([k, m]) => ({ k, name: m.name, bereich: m.bereich })) }

// Text/CSV einfügen (Konto ; Bezeichnung ; Saldo ; Vorjahr)
export function parseKontenText(text) { const rows = []
  ;(text || '').split(/\r?\n/).forEach(line => { if (!line.trim()) return
    const t = line.split(/[;\t]/).map(s => s.trim()); let konto = null, bez = '', nums = []
    t.forEach(tok => { if (!tok) return
      if (konto === null && /^\d{2,8}$/.test(tok)) { konto = tok; return }
      const cl = tok.replace(/[.\s€]/g, '').replace(',', '.')
      if (/^-?\d+(\.\d+)?$/.test(cl) && tok !== konto) { nums.push(tok) }
      else if (/[a-zäöüß]/i.test(tok) && !bez) { bez = tok } })
    if (konto) rows.push({ konto, bez, saldo: nums[0] || '', vj: nums[1] || '' }) })
  return rows }

// Zugeordnete Konten in Module übernehmen (mutiert d.kategorien). rows: [{konto,bez,saldo,vj,ziel}]
export function applyKonten(d, rows) { let nP = 0, nMod = 0
  rows.forEach(r => { if (r.ziel === '__ignore' || !r.ziel) return; const m = MODULE[r.ziel]; if (!m) return
    const kat = ensureKat(d, m.bereich)
    let p = alleP(d).find(x => x.modul === r.ziel); if (!p) { p = neuerModulPunkt(r.ziel); kat.punkte.push(p); nMod++ }
    if (!Array.isArray(p.werte.konten)) p.werte.konten = []
    p.werte.konten = p.werte.konten.filter(x => x && (x.konto || x.saldo || x.vj))
    const ex = p.werte.konten.find(x => String(x.konto).trim() === r.konto)
    if (ex) { ex.saldo = r.saldo; ex.vj = r.vj; if (!ex.bez) ex.bez = r.bez }
    else p.werte.konten.push({ konto: r.konto, bez: r.bez || '', saldo: r.saldo || '', vj: r.vj || '', ok: false })
    if (p.status === 'offen') p.status = 'arbeit'; if (!p.werte.konten.length) p.werte.konten = [{}]; nP++ })
  return { nP, nMod } }

// Nur bestehende Kontenprüfungen/-listen mit Salden füllen. map: {konto:{s,v}}
export function fillExisting(d, map) { let n = 0
  alleP(d).forEach(p => {
    if (p.typ === 'B') { const k = (p.werte.konto || (p.konten || [])[0] || '').trim(); if (map[k]) { p.werte.saldo = map[k].s; p.werte.vj = map[k].v; if (p.status === 'offen') p.status = 'arbeit'; n++ } }
    if (p.typ === 'C' && p.werte) { Object.keys(p.werte).forEach(key => { if (Array.isArray(p.werte[key])) p.werte[key].forEach(row => { if (row && row.konto) { const kk = String(row.konto).trim(); if (map[kk]) { row.saldo = map[kk].s; row.vj = map[kk].v; if (p.status === 'offen') p.status = 'arbeit'; n++ } } }) }) }
  })
  return n }

// ── Rückfragen-Sammler ────────────────────────────────────────────────────────
export function sammleRueckfragen(cl) { const out = []
  ;(cl.kategorien || []).forEach(k => { (k.punkte || []).forEach(p => { const w = p.werte || {}
    const quelle = p.modul && MODULE[p.modul] ? MODULE[p.modul].name : p.titel
    ;(w.rueckfragen || []).forEach((r, idx) => { if ((r.t || '').trim()) out.push({ bereich: k.name, quelle, text: r.t, ok: !!r.ok, kind: 'manual', pid: p.id, idx }) })
    if (p.modul === 'anlagevermoegen') { (w.zugaenge || []).forEach((z, zi) => { if (z.pruef) out.push({ bereich: k.name, quelle,
      text: `Wirtschaftsgut „${z.bez || '(ohne Bezeichnung)'}"${z.buchungskonto ? ' (Buchungskonto ' + z.buchungskonto + ')' : ''}: ausschließlich betrieblich veranlasst – kein privater Nutzungsanteil?`,
      ok: !!z.pruefOk, kind: 'auto', pid: p.id, zi }) }) }
    if (p.modul && MODULE[p.modul]) modLists(MODULE[p.modul]).forEach(L => { if (!L.rowNotes) return
      ;(w[L.key] || []).forEach((row, ri) => { (row && Array.isArray(row.rueck) ? row.rueck : []).forEach((r, rj) => { if ((r.t || '').trim()) {
        const konto = row.buchungskonto || row.konto || ''; const bez = row.bez || ''
        out.push({ bereich: k.name, quelle: quelle + (konto ? (' · Konto ' + konto) : (bez ? (' · ' + bez) : '')), text: r.t, ok: !!r.ok, kind: 'row', key: 'row:' + p.id + ':' + L.key + ':' + ri + ':' + rj }) } }) }) })
  }) })
  return out }

export function markRueckfrage(d, key, checked) { const parts = key.split(':'); const kind = parts[0]
  if (kind === 'row') { const p = findPunkt(d, parts[1]); const L = parts[2], i = +parts[3], rj = +parts[4]
    if (p && p.werte[L] && p.werte[L][i] && Array.isArray(p.werte[L][i].rueck) && p.werte[L][i].rueck[rj]) p.werte[L][i].rueck[rj].ok = checked; return }
  const p = findPunkt(d, parts[1]); if (!p) return; const i = +parts[2]
  if (kind === 'manual') { if (p.werte.rueckfragen && p.werte.rueckfragen[i]) p.werte.rueckfragen[i].ok = checked }
  else { if (p.werte.zugaenge && p.werte.zugaenge[i]) p.werte.zugaenge[i].pruefOk = checked } }

function findPunkt(d, pid) { return alleP(d).find(p => p.id === pid) }

export function aufbereitenText(cl, mandantName, wj) {
  const all = sammleRueckfragen(cl); const byB = {}, bOrder = []
  all.forEach(x => { if (!byB[x.bereich]) { byB[x.bereich] = {}; bOrder.push(x.bereich) } const g = byB[x.bereich]; (g[x.quelle] || (g[x.quelle] = [])).push(x) })
  let s = `Rückfragen zum Jahresabschluss ${wj || ''} – ${mandantName || ''}\n`
  bOrder.forEach(b => { const g = byB[b]; let any = false
    Object.keys(g).forEach(q => { if (g[q].some(x => !x.ok)) any = true }); if (!any) return
    s += `\n${b.toUpperCase()}\n`
    Object.keys(g).forEach(q => { const qi = g[q].filter(x => !x.ok); if (!qi.length) return
      s += `  ${q}:\n`; qi.forEach((x, i) => { s += `    ${i + 1}. ${x.text}\n` }) })
  })
  return s.trim()
}

// ── Excel-Export: Tabellenblätter aufbauen (Arrays von Zeilen) ─────────────────
export function buildExportSheets(cl, meta) {
  meta = meta || {}; const bl = []
  const done = alleP(cl).filter(p => p.status === 'ok').length
  bl.push({ name: 'Übersicht', rows: [['Mandant', meta.mandant || ''], ['Rechtsform', meta.rf || ''],
    ['Gewinnermittlung', (cl.gw || meta.gw) === 'bilanz' ? 'Bilanz' : 'EÜR'], ['Wirtschaftsjahr', meta.wj || ''], ['Checkliste', meta.checkliste || ''], [],
    ['Prüfpunkte gesamt', alleP(cl).length], ['davon erledigt', done],
    ['Rückfragen', alleP(cl).filter(p => p.status === 'rueck').length], ['Korrekturbedarf', alleP(cl).filter(p => p.status === 'korr').length]] })
  const sd = cl.stammdaten || {}
  const sdRows = [['Stammdaten & Auftrag'], []]
  STAMMDATEN_FELDER.forEach(grp => { sdRows.push([grp.gruppe])
    grp.felder.forEach(f => {
      let v = (sd[f.k] != null && sd[f.k] !== '') ? sd[f.k]
        : (f.k === 'name' ? (meta.mandant || '') : (f.k === 'gewinnermittlung' ? (cl.gw === 'bilanz' ? 'bilanz' : 'euer') : (f.k === 'rechtsform' ? (meta.rf || '') : '')))
      if (f.t === 'select' && f.opt) { const o = f.opt.find(o => o[0] === v); if (o) v = o[1] }
      sdRows.push([f.l, v]) })
    sdRows.push([]) })
  bl.push({ name: 'Stammdaten', rows: sdRows })
  const check = [['Kategorie', 'Typ', 'Prüfpunkt', 'Konto', 'Status', 'Saldo', 'Vorjahr', 'Abweichung', 'Notiz']]
  ;(cl.kategorien || []).forEach(k => (k.punkte || []).forEach(p => { const w = p.werte; const s = num(w.saldo), v = num(w.vj)
    check.push([k.name, p.typ, p.titel, (w.konto || (p.konten || [])[0] || ''), (STATUS[p.status] || STATUS.offen)[1],
      p.typ === 'B' ? s : (w.betrag ? num(w.betrag) : ''), p.typ === 'B' ? v : '', p.typ === 'B' ? s - v : '', w.notiz || '']) }))
  bl.push({ name: 'Checkliste', rows: check, num: [5, 6, 7] })
  alleP(cl).forEach(p => { const mod = MODULE[p.modul]; if (!mod) return
    if (mod.custom === 'darlehen') { const dl = p.werte.darlehen || []; const fr = { kurz: 'kurzfristig', lang: 'langfristig', gemischt: 'teils/teils' }
      const rows = [['Darlehen – ' + (meta.mandant || '')], [], ['Anzahl', dl.length], ['Restschuld gesamt', dl.reduce((s, d) => s + num(d.restschuld), 0)],
        ['Zinsaufwand gesamt', dl.reduce((s, d) => s + num(d.zinsaufwand), 0)], ['Tilgung WJ gesamt', dl.reduce((s, d) => s + num(d.tilgungWj), 0)]]
      dl.forEach((d, idx) => { rows.push([], ['Darlehen ' + (idx + 1), d.geber || ''], ['Verwendungszweck', d.zweck || ''], ['Vertragsnummer', d.vertragsnr || ''],
        ['Vertragsdatum', d.vertragsdatum || ''], ['Auszahlungsdatum', d.auszahlung || ''], ['Laufzeit bis', d.laufzeitBis || ''], ['Zinssatz %', d.zinssatz || ''],
        ['Ursprungsbetrag', d.betrag || ''], ['Restschuld 31.12.', d.restschuld || ''], ['Tilgung im WJ', d.tilgungWj || ''], ['Zinsaufwand', d.zinsaufwand || ''],
        ['Sondertilgungen', d.sondertilgung || ''], ['Fristigkeit', fr[d.art] || ''],
        ['Unterlagen', [d.dVertrag ? 'Vertrag' : '', d.dTilgplan ? 'Tilgungsplan' : '', d.dSalden ? 'Saldenbestätigung' : ''].filter(Boolean).join(', ') || '—'],
        ['Prüfungen erledigt', [d.pSaldo ? 'Saldo' : '', d.pTilgung ? 'Tilgung' : '', d.pZinsen ? 'Zinsen' : '', d.pRestschuld ? 'Restschuld' : '', d.pFrist ? 'Fristigkeit' : '', d.pBesonder ? 'Besonderheiten' : ''].filter(Boolean).join(', ') || '—'],
        ['Status', (STATUS[d.status || 'offen'])[1]], ['Notiz', d.notiz || '']);
        (d.offen || []).forEach((o, oi) => rows.push([oi === 0 ? 'Offene Punkte' : '', o])) })
      bl.push({ name: 'Darlehen', rows }); return }
    const struktur = mod.flags || mod.felder || mod.positionen || mod.listen
    if (!mod.rechnen && !struktur) return; const ctx = { gw: cl.gw || meta.gw, rechtsform: (cl.stammdaten && cl.stammdaten.rechtsform) || meta.rf || '' }
    const rows = [[p.titel], []]
    if (mod.flags) { mod.flags.forEach(fl => rows.push([fl.label, p.werte[fl.k] ? 'ja' : '—'])); rows.push([]) }
    if (mod.felder) { const felder = typeof mod.felder === 'function' ? mod.felder(ctx, p.werte) : mod.felder
      felder.forEach(f => rows.push([f.l, f.t === 'num' ? num(p.werte[f.k]) : (p.werte[f.k] || '')])); rows.push([]) }
    modLists(mod).forEach(L => { rows.push([L.label || '']); rows.push((L.felder || []).map(f => f.l))
      ;(p.werte[L.key] || []).forEach(x => rows.push((L.felder || []).map(f => f.t === 'num' ? num(x[f.k]) : (x[f.k] || '')))); rows.push([]) })
    if (mod.rechnen) { const r = mod.rechnen(p.werte, ctx); rows.push(['Berechnung', '']); r.ergebnisse.forEach(e => rows.push([e.l, e.v]))
      if (r.total) rows.push([r.total.l, r.total.v]); (r.hinweise || []).forEach(h => rows.push(['Hinweis', h])) }
    bl.push({ name: mod.name.slice(0, 28), rows }) })
  if ((cl.buchungen || []).length) { const b = [['Herkunft', 'Soll', 'Bezeichnung', 'Haben', 'Betrag', 'Text']]
    cl.buchungen.forEach(x => b.push([x.quelle, x.s, x.st, x.h || '', x.betr, x.text])); bl.push({ name: 'Buchungsstapel', rows: b }) }
  return bl
}

// ── Vorbereitungs-Assistent (Text → Vorschläge) ───────────────────────────────
export const ASS_BEISPIEL = 'Ich sehe drei neue Fahrzeuge. Ein Lkw wurde am 03.05.2024 gekauft. Ein weiterer am 01.08.2024. Ein dritter am 11.12.2024. Außerdem benötigen wir die Sachentnahmen Gastronomie. Es gibt sieben Darlehensverträge. Außerdem brauchen wir Rechnungsabgrenzung. Es dürften ungefähr fünfzehn Abgrenzungsposten werden.'
const ZAHLW = { null: 0, ein: 1, eine: 1, einen: 1, eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, fuenfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19, zwanzig: 20 }
function wortZahl(w) { w = (w || '').toLowerCase().replace(/[.,;:!?]/g, ''); if (/^\d+$/.test(w)) return +w; return ZAHLW[w] != null ? ZAHLW[w] : null }
function findeAnzahl(text, kwRe) { const toks = text.split(/\s+/)
  for (let i = 0; i < toks.length; i++) { const c = toks[i].replace(/[.,;:!?]/g, ''); if (kwRe.test(c)) {
    for (let j = i; j >= Math.max(0, i - 3); j--) { const z = wortZahl(toks[j]); if (z != null) return z } } }
  return null }
const INTENTS = [
  { key: 'anlage', modul: 'anlagevermoegen', test: /angeschafft|gekauft|erworben|zugang|zugänge|anschaffung|investition|investiert|neu(?:e|er|es)?\s+(?:fahrzeug|lkw|pkw|transporter|maschine|anlage|wirtschaftsg)/i, zahlRe: /fahrzeug|lkw|pkw|maschine|wirtschaftsg|anlage|zugang/i,
    rueck: ['Für die Zugänge eine AfA-Übersicht aus DATEV beilegen?', 'Bei Fahrzeugen: 1-%-Methode oder Fahrtenbuch – privater Nutzungsanteil?'], fehlend: 'Bezeichnung, Buchungskonto, Anschaffungskosten je Wirtschaftsgut' },
  { key: 'kfz1', modul: 'kfz1prozent', unvoll: true, test: /1\s*[-–]?\s*%|1\s*[-–]?\s*prozent|ein[- ]?prozent|firmenwagen|privatnutzung|private\s+(?:kfz|pkw|fahrzeug|nutzung)|kfz-?nutzung/i,
    rueck: ['Wie viele Fahrzeuge sind betroffen, und wie hoch ist der Bruttolistenpreis je Fahrzeug?', 'Liegt für ein Fahrzeug ein ordnungsgemäßes Fahrtenbuch vor (statt 1-%-Methode)?'], fehlend: 'Bruttolistenpreis, Anzahl Nutzungsmonate, Entfernung Wohnung–Betrieb je Fahrzeug' },
  { key: 'telefon', modul: 'telefon', unvoll: true, test: /telefon|handy|mobilfunk|telekommunikation/i,
    rueck: ['Private Telefonnutzung pauschal (z. B. anteilig) oder per Einzelnachweis ansetzen?'] },
  { key: 'fahrtenbuch', modul: 'fahrtenbuch', test: /fahrtenbuch/i },
  { key: 'sachentnahme', modul: 'sachentnahme', test: /sachentnahme|eigenverbrauch|gastronomie|unentgeltliche\s+wertabgabe/i,
    rueck: ['Pauschbeträge nach aktueller BMF-Tabelle ansetzen?'] },
  { key: 'darlehen', modul: 'darlehen', test: /darlehen|kredit|tilgung|bankverbindlichkeit|finanzierung/i, zahlRe: /darlehen|kredit|vertrag|finanzierung/i,
    rueck: ['Tilgungspläne / Restlaufzeiten je Darlehen vorbereiten?', 'Saldenbestätigungen der Banken einholen?'] },
  { key: 'rap', modul: null, test: /abgrenzung|rechnungsabgrenzung|\brap\b|arap|parap|abgrenzungsposten/i, zahlRe: /abgrenzung|posten|position/i,
    rueck: ['Abgrenzungsbetrag und Zeitraum je Position erfassen?'] },
  { key: 'rueckstellung', modul: 'rueckstellungen', test: /rückstellung|rueckstellung/i },
  { key: 'bewirtung', modul: 'bewirtung', test: /bewirtung/i },
  { key: 'warenbestand', modul: 'warenbestand', test: /inventur|warenbestand|vorräte|vorrat|lagerbestand/i },
  { key: 'forderungen', modul: 'forderungen', test: /forderung|wertberichtigung|uneinbringlich|ewb|pwb/i },
  { key: 'geschenke', modul: 'geschenke', test: /geschenk/i },
  { key: 'reisekosten', modul: 'reisekosten', test: /reisekosten|dienstreise/i },
  { key: 'verpflegung', modul: 'verpflegung', test: /verpflegung|verpflegungsmehr/i },
  { key: 'gewerbesteuer', modul: 'gewerbesteuer', test: /gewerbesteuer/i },
  { key: 'erloese', modul: null, bereich: 'be', test: /außergewöhnlich|aussergewöhnlich|erlösentwicklung|umsatzentwicklung|auffällig|erlössprung|umsatzsprung/i,
    note: 'Auffällige Erlös-/Umsatzentwicklung prüfen', rueck: ['Woraus resultiert die außergewöhnliche Erlösentwicklung?'] },
]
function findeKonten(text) { const out = [], seen = {}; const re = /konto\s+(\d{3,5})\s*(?:[–\-:]\s*([^\n,;.]+))?/gi; let m
  while ((m = re.exec(text))) { const k = m[1]; if (seen[k]) continue; seen[k] = 1; out.push({ konto: k, bez: (m[2] || '').trim(), keep: true }) }
  return out }
export function assistAnalyse(text, gw) {
  const dates = (text.match(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g)) || []
  const items = []
  INTENTS.forEach(intent => { if (!intent.test.test(text)) return
    let modul = intent.modul; if (intent.key === 'rap') modul = gw === 'bilanz' ? 'rapAktiv' : 'rap'
    const m = modul ? MODULE[modul] : null
    const it = { key: intent.key, name: m ? m.name : (intent.name || intent.key), bereich: m ? m.bereich : (intent.bereich || 'ba'), modul, include: true,
      positionen: null, count: null, status: 'arbeit', note: intent.note || null, listBez: intent.listBez || null,
      rueckfragen: (intent.rueck || []).slice(), rfKeep: (intent.rueck || []).map(() => true),
      fehlend: intent.fehlend ? [intent.fehlend] : [], erkannt: [], aktion: '' }
    if (intent.key === 'anlage') {
      const cnt = findeAnzahl(text, intent.zahlRe) || dates.length
      const rows = dates.map(d => ({ bez: 'Zugang ' + d })); while (rows.length < cnt) rows.push({})
      if (rows.length) { it.positionen = { key: 'zugaenge', rows }; it.status = 'unvoll'
        it.erkannt.push(rows.length + ' Anlagenzugang/-zugänge' + (dates.length ? ' – ' + dates.join(', ') : '')) }
      it.aktion = 'Modul „Anlagevermögen" anlegen' + (rows.length ? ' + ' + rows.length + ' Zugänge' : '')
    } else {
      const anz = intent.zahlRe ? findeAnzahl(text, intent.zahlRe) : null
      if (anz != null && m) { const lk = (modLists(m)[0] || {}).key
        if (lk) { it.positionen = { key: lk, rows: Array.from({ length: anz }, (_, i) => intent.listBez ? ({ bez: intent.listBez + ' ' + (i + 1) }) : ({})) } }
        it.count = anz; it.status = 'unvoll'; it.erkannt.push(anz + '× vorbereiten')
        it.aktion = 'Modul „' + m.name + '" anlegen' + (lk ? ' + ' + anz + ' Positionen' : '')
      } else if (m) { it.aktion = 'Modul „' + m.name + '" aktivieren'; it.erkannt.push('erkannt'); if (intent.unvoll) it.status = 'unvoll' }
      else { it.aktion = intent.note || 'Notiz anlegen'; it.erkannt.push(intent.note || 'Hinweis') }
    }
    items.push(it) })
  const konten = findeKonten(text)
  if (konten.length) {
    const erloese = konten.filter(k => k.konto[0] === '8'); const rest = konten.filter(k => k.konto[0] !== '8')
    const byMod = {}, mo = []
    erloese.forEach(k => { const mk = erloesKategorie(k.bez, k.konto); if (!byMod[mk]) { byMod[mk] = []; mo.push(mk) } byMod[mk].push(k) })
    mo.forEach(mk => { const m = MODULE[mk]; const ks = byMod[mk]
      items.push({ key: mk, kind: 'modulKonten', modul: mk, name: m.name, bereich: 'be', include: true,
        konten: ks.map(k => ({ ...k })), listKey: 'konten', status: 'unvoll', note: null, positionen: null, count: null, listBez: null,
        rueckfragen: ['Salden per SuSa-Import einlesen und Vorjahresabweichungen dokumentieren?'], rfKeep: [true],
        fehlend: ['Saldo & Vorjahr je Konto (aus SuSa)'],
        erkannt: [ks.length + ' Konto/Konten: ' + ks.map(k => k.konto).join(', ')],
        aktion: 'Kategorie „' + m.name + '" – ' + ks.length + ' Konto/Konten einordnen' }) })
    if (rest.length) { const grp = {}, go = []
      rest.forEach(k => { const b = 'ba'; if (!grp[b]) { grp[b] = []; go.push(b) } grp[b].push(k) })
      const BN = { be: 'Betriebseinnahmen', ba: 'Betriebsausgaben' }
      go.forEach(b => { const ks = grp[b]
        items.push({ key: 'konten_' + b, kind: 'konten', name: 'Kontenprüfungen ' + (BN[b] || b), bereich: b, include: true,
          konten: ks, status: 'offen', note: null, positionen: null, count: null, listBez: null,
          rueckfragen: ['Salden per SuSa-Import einlesen und Vorjahresabweichungen prüfen?'], rfKeep: [true],
          fehlend: ['Saldo & Vorjahressaldo je Konto (aus SuSa)'],
          erkannt: [ks.length + ' Konten: ' + ks.map(k => k.konto).join(', ')],
          aktion: ks.length + ' Konto-Prüfpunkte (Typ B) in „' + (BN[b] || b) + '" anlegen' }) })
    }
  }
  return { items, dates, text }
}

// Assistent-Vorschläge übernehmen (mutiert d). Gibt Zähler zurück.
export function applyAssist(d, items) { let nMod = 0, nPos = 0, nRf = 0
  items.forEach(it => { it.rueckfragen = it.rueckfragen.filter((_, j) => it.rfKeep[j]) })
  items.filter(it => it.include).forEach(it => { const kat = ensureKat(d, it.bereich)
    if (it.kind === 'modulKonten') { let p = alleP(d).find(x => x.modul === it.modul); let neu = false
      if (!p) { p = neuerModulPunkt(it.modul); neu = true }
      const rows = it.konten.filter(k => k.keep).map(k => ({ konto: k.konto, bez: k.bez || '', saldo: '', vj: '', ok: false }))
      const base = neu ? [] : (p.werte.konten || []).filter(r => r && (r.konto || r.saldo || r.vj))
      const seen = {}; p.werte.konten = base.concat(rows).filter(r => { const kk = (r.konto || '').trim(); if (!kk) return true; if (seen[kk]) return false; seen[kk] = 1; return true })
      if (!p.werte.konten.length) p.werte.konten = [{}]
      if (it.rueckfragen.length) { p.werte.rueckfragen = (p.werte.rueckfragen || []).concat(it.rueckfragen.map(t => ({ t, ok: false }))); nRf += it.rueckfragen.length }
      if (neu || p.status === 'offen') p.status = 'arbeit'
      if (neu) { kat.punkte.push(p); nMod++ } nPos += rows.length; return
    }
    if (it.kind === 'konten') { let angelegt = 0
      it.konten.filter(k => k.keep).forEach(k => {
        if (alleP(d).some(x => x.typ === 'B' && String(x.werte.konto || (x.konten || [])[0] || '') === k.konto)) return
        kat.punkte.push({ id: uid(), titel: k.bez || ('Konto ' + k.konto), typ: 'B', modul: null, konten: [k.konto], status: 'offen', werte: { konto: k.konto, bez: k.bez || '' } }); angelegt++ })
      nPos += angelegt; if (angelegt) nMod++; return
    }
    let p = it.modul ? alleP(d).find(x => x.modul === it.modul) : null; let neu = false
    if (!p) { p = it.modul ? neuerModulPunkt(it.modul) : { id: uid(), titel: it.name, typ: 'A', modul: null, konten: [], status: 'offen', werte: {} }; neu = true }
    if (it.positionen) { const k = it.positionen.key; const rows = it.positionen.rows.map(r => ({ ...r }))
      if (neu) p.werte[k] = rows.length ? rows : [{}]; else p.werte[k] = (p.werte[k] || []).concat(rows); nPos += rows.length }
    if (it.modul === 'darlehen' && it.count) { if (!Array.isArray(p.werte.darlehen)) p.werte.darlehen = []
      for (let z = 0; z < it.count; z++) p.werte.darlehen.push({ id: uid(), status: 'offen', offen: [] }); nPos += it.count }
    if (it.note && neu) { p.werte.notiz = (p.werte.notiz ? p.werte.notiz + ' · ' : '') + it.note }
    if (it.rueckfragen.length) { p.werte.rueckfragen = (p.werte.rueckfragen || []).concat(it.rueckfragen.map(t => ({ t, ok: false }))); nRf += it.rueckfragen.length }
    if (it.status === 'unvoll' && (neu || p.status === 'offen')) { p.status = 'arbeit'
      p.werte.notiz = (p.werte.notiz ? p.werte.notiz + ' · ' : '') + 'Vom Assistenten vorbereitet – Angaben bitte ergänzen.' }
    if (neu) { kat.punkte.push(p); nMod++ }
  })
  return { nMod, nPos, nRf }
}
