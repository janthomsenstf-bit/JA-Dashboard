/**
 * susaMapping.js
 * Kontenrahmen-Erkennung und Bereichszuordnung für SKR03 / SKR04
 *
 * SKR03 Kontenklassen:
 *  0 = Anlagevermögen              (Bilanz Aktiv)
 *  1 = Umlaufvermögen              (Bilanz Aktiv)
 *  2 = EK / Rückstellungen / Verbindlichkeiten (Bilanz Passiv)
 *  3 = Wareneingang / Bestände     (GuV Aufwand)
 *  4 = Betriebliche Aufwendungen   (GuV Aufwand)
 *  5 = Material- / Wareneinsatz    (GuV Aufwand)
 *  6 = Personalaufwand             (GuV Aufwand)
 *  7 = Weitere betriebl. Aufwend.  (GuV Aufwand)
 *  8 = Finanzerträge / neutr. Ertr.(GuV Ertrag)
 *  9 = Erlöse / Umsatzerlöse       (GuV Ertrag)
 *
 * SKR04 Kontenklassen:
 *  0 = Anlagevermögen              (Bilanz Aktiv)
 *  1 = Umlaufvermögen              (Bilanz Aktiv)
 *  2 = Eigenkapital                (Bilanz Passiv)
 *  3 = Rückstellungen / Verbindl.  (Bilanz Passiv)
 *  4 = Betriebl. Erträge / Umsätze (GuV Ertrag)
 *  5 = Materialaufwand / Wareneinsatz (GuV Aufwand)
 *  6 = Personalaufwand             (GuV Aufwand)
 *  7 = Abschreibungen / Sonst. AW  (GuV Aufwand)
 *  8 = Finanzergebnis / Steuern    (GuV Aufwand/Ertrag)
 *  9 = Abschlusskonten / Statistik (technisch)
 */

// ── SKR03: Erste Ziffer → Bereich-Code ────────────────────────────────────────
const KLASSEN_SKR03 = {
  '0': 'anlage',
  '1': 'umlauf',
  '2': 'passiva',          // EK + Rückstellungen + Verbindlichkeiten
  '3': 'wareneingang',     // GuV Aufwand
  '4': 'betriebAufwand',   // GuV Aufwand
  '5': 'material',         // GuV Aufwand
  '6': 'personal',         // GuV Aufwand
  '7': 'sonstAufwand',     // GuV Aufwand
  '8': 'finanzertrag',     // GuV Ertrag
  '9': 'umsatz',           // GuV Ertrag
}

// ── SKR04: Erste Ziffer → Bereich-Code ────────────────────────────────────────
const KLASSEN_SKR04 = {
  '0': 'anlage',
  '1': 'umlauf',
  '2': 'eigenkapital',       // Bilanz Passiv
  '3': 'verbindlichkeiten',  // Bilanz Passiv (Rückstellungen + Verbindlichkeiten)
  '4': 'ertraege',           // GuV Ertrag
  '5': 'material',           // GuV Aufwand
  '6': 'personal',           // GuV Aufwand
  '7': 'sonstAufwand',       // GuV Aufwand
  '8': 'finanzergebnis',     // GuV Aufwand/Ertrag
  '9': 'sonstige',           // technisch
}

// ── Labels SKR03 ──────────────────────────────────────────────────────────────
const LABELS_SKR03 = {
  anlage:         'Anlagevermögen',
  umlauf:         'Umlaufvermögen',
  passiva:        'Eigenkapital / Rückstellungen / Verbindlichkeiten',
  wareneingang:   'Wareneingang / Bestände',
  betriebAufwand: 'Betriebliche Aufwendungen',
  material:       'Material- / Wareneinsatz',
  personal:       'Personalaufwand',
  sonstAufwand:   'Weitere betriebliche Aufwendungen',
  finanzertrag:   'Finanzerträge / neutrale Erträge',
  umsatz:         'Erlöse / Umsatzerlöse',
  sonstige:       'Sonstige / Statistik',
}

// ── Labels SKR04 ──────────────────────────────────────────────────────────────
const LABELS_SKR04 = {
  anlage:            'Anlagevermögen',
  umlauf:            'Umlaufvermögen',
  eigenkapital:      'Eigenkapital',
  verbindlichkeiten: 'Rückstellungen / Verbindlichkeiten',
  ertraege:          'Betriebliche Erträge / Umsätze',
  material:          'Materialaufwand / Wareneinsatz',
  personal:          'Personalaufwand',
  sonstAufwand:      'Abschreibungen / Sonstige Aufwendungen',
  finanzergebnis:    'Finanzergebnis / Steuern',
  sonstige:          'Abschlusskonten / Statistik',
}

// ── Bereiche pro Kontorahmen ──────────────────────────────────────────────────
const BEREICHE_SKR03_AKTIVA  = ['anlage', 'umlauf']
const BEREICHE_SKR03_PASSIVA = ['passiva']
const BEREICHE_SKR03_GUV     = ['wareneingang', 'betriebAufwand', 'material', 'personal', 'sonstAufwand', 'finanzertrag', 'umsatz']
const BEREICHE_SKR03_EUER    = [...BEREICHE_SKR03_GUV, 'sonstige']

const BEREICHE_SKR04_AKTIVA  = ['anlage', 'umlauf']
const BEREICHE_SKR04_PASSIVA = ['eigenkapital', 'verbindlichkeiten']
const BEREICHE_SKR04_GUV     = ['ertraege', 'material', 'personal', 'sonstAufwand', 'finanzergebnis']
const BEREICHE_SKR04_EUER    = [...BEREICHE_SKR04_GUV, 'sonstige']

// ── Public: Bereiche abrufen (kontorahmen-aware) ───────────────────────────────
/**
 * getBereiche(type, kontorahmen) → string[]
 * type: 'aktiva' | 'passiva' | 'guv' | 'euer'
 */
export function getBereiche(type, kontorahmen) {
  const skr04 = kontorahmen === 'skr04'
  switch (type) {
    case 'aktiva':  return skr04 ? BEREICHE_SKR04_AKTIVA  : BEREICHE_SKR03_AKTIVA
    case 'passiva': return skr04 ? BEREICHE_SKR04_PASSIVA : BEREICHE_SKR03_PASSIVA
    case 'guv':     return skr04 ? BEREICHE_SKR04_GUV     : BEREICHE_SKR03_GUV
    case 'euer':    return skr04 ? BEREICHE_SKR04_EUER    : BEREICHE_SKR03_EUER
    default:        return []
  }
}

// ── Backward-compat-Exporte (SKR04-Default) ───────────────────────────────────
// Für Code, der noch keine KR-Unterscheidung braucht.
export const BEREICHE_GUV     = BEREICHE_SKR04_GUV
export const BEREICHE_AKTIVA  = BEREICHE_SKR04_AKTIVA
export const BEREICHE_PASSIVA = BEREICHE_SKR04_PASSIVA
export const BEREICHE_EUER    = BEREICHE_SKR04_EUER

// ── Public: Label abrufen ─────────────────────────────────────────────────────
export function getBereichLabel(bereich, kontorahmen) {
  const map = kontorahmen === 'skr04' ? LABELS_SKR04 : LABELS_SKR03
  return map[bereich] ?? bereich
}

// ── Public: Konto klassifizieren (kontorahmen-aware) ──────────────────────────
/**
 * klassifiziereKonto(kontonrStr, kontorahmen?) → bereich-Code
 * SKR03 (Standard): Klasse 3–7 = Aufwand, 8–9 = Ertrag, 2 = Passiva (alles)
 * SKR04:            Klasse 2–3 = Passiva, 4 = Ertrag, 5–7 = Aufwand, 8 = Finanz
 */
export function klassifiziereKonto(kontonrStr, kontorahmen) {
  const s = String(kontonrStr ?? '').replace(/\D/g, '')
  const map = kontorahmen === 'skr04' ? KLASSEN_SKR04 : KLASSEN_SKR03
  return map[s[0]] ?? 'sonstige'
}

// ── Kontenrahmen auto-erkennen ────────────────────────────────────────────────
export function erkenneKontorahmen(konten) {
  const nrs = konten
    .map(k => parseInt(String(k.kontonr ?? '').replace(/\D/g, ''), 10))
    .filter(n => !isNaN(n))

  if (nrs.length === 0) return 'skr03'

  // SKR03: Erträge bei 8xxx (Finanzerträge) und/oder 9xxx (Umsatzerlöse)
  const has8xxx = nrs.some(n => n >= 8000 && n <= 8999)
  const has9xxx = nrs.some(n => n >= 9000 && n <= 9999)
  if (has8xxx || has9xxx) return 'skr03'

  // SKR04: Erträge bei 4xxx (ohne 8/9xxx → sonst wäre es SKR03)
  const has4xxx = nrs.some(n => n >= 4000 && n <= 4999)
  if (has4xxx) return 'skr04'

  return 'skr03' // Fallback
}

// ── Währungs-Formatter ────────────────────────────────────────────────────────
export function fmtEuro(val) {
  if (val == null || isNaN(val)) return '–'
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
}
