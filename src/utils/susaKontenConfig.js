// ── susaKontenConfig.js ───────────────────────────────────────────────────────
// Kontenrahmen-Mapping für SuSa-Import (SKR03 + SKR04)
// Quelle: Kontenklassen-Übersicht des Nutzers (Prozess- vs. Abschlussgliederung)

// ── Block-Definitionen ────────────────────────────────────────────────────────
export const SUSA_BLOCKS = [
  { id: 'betriebseinnahmen', label: 'Betriebseinnahmen / Erlöse',    icon: '💰', color: '#16a34a', bg: 'rgba(22,163,74,0.08)'    },
  { id: 'betriebsausgaben',  label: 'Betriebsausgaben',              icon: '📤', color: '#ef4444', bg: 'rgba(239,68,68,0.06)'   },
  { id: 'wareneinkauf',      label: 'Wareneinkauf / Bestände',       icon: '📦', color: '#f97316', bg: 'rgba(249,115,22,0.07)'  },
  { id: 'anlagevermögen',   label: 'Anlagevermögen',                icon: '🏗',  color: '#0f766e', bg: 'rgba(15,118,110,0.07)'  },
  { id: 'bank_kasse',        label: 'Bank / Kasse',                  icon: '🏦', color: '#2563eb', bg: 'rgba(37,99,235,0.07)'   },
  { id: 'forderungen',       label: 'Forderungen',                   icon: '📑', color: '#7c3aed', bg: 'rgba(124,58,237,0.07)'  },
  { id: 'verbindlichkeiten', label: 'Verbindlichkeiten',             icon: '💳', color: '#b45309', bg: 'rgba(180,83,9,0.07)'    },
  { id: 'darlehen',          label: 'Darlehen / Kredite',            icon: '🔗', color: '#92400e', bg: 'rgba(146,64,14,0.07)'   },
  { id: 'eigenkapital',      label: 'Eigenkapital',                  icon: '🏛',  color: '#1e40af', bg: 'rgba(30,64,175,0.07)'   },
  { id: 'rap_rueckst',       label: 'Rückstellungen / RAP',          icon: '⏳', color: '#6b7280', bg: 'rgba(107,114,128,0.07)' },
  { id: 'sonstige_ertraege', label: 'Sonstige Erträge',              icon: '➕', color: '#0891b2', bg: 'rgba(8,145,178,0.07)'   },
  { id: 'unsicher',          label: 'Unsicher / nicht zugeordnet',   icon: '⚠️', color: '#d97706', bg: 'rgba(217,119,6,0.07)'   },
]

export const BLOCK_MAP = Object.fromEntries(SUSA_BLOCKS.map(b => [b.id, b]))

// ── SKR03 Ranges ──────────────────────────────────────────────────────────────
// Kontenklassen lt. Übersicht:
// 0: Anlage- und Kapitalkonten (AV, langfristiges Kapital)
// 1: Finanz- und Privatkonten (Kasse, Bank, Forderungen, Verbindlichkeiten, Privat)
// 2: Abgrenzungskonten (RAP, Rückstellungen)
// 3: Wareneingangs- und Bestandskonten
// 4: Betriebliche Aufwandskonten (Material, Personal)
// 5: Weitere betriebliche Aufwandskonten (Raumkosten, Kfz, Werbung)
// 6: Weitere Aufwandskonten / Kostenrechnung
// 7: Bestände Erzeugnisse (selten, SME)
// 8: Erlöskonten + sonstige Erträge
// 9: Vortrags-/statistische Konten → SKIP

const SKR03_RANGES = [
  // Klasse 0: AV
  [  100,  699, 'anlagevermögen',   'sicher'   ],   // Sachanlagen, immaterielle, Finanzanlagen
  [    1,   99, 'anlagevermögen',   'sicher'   ],   // immaterielle VG
  [  700,  799, 'eigenkapital',     'unsicher'  ],   // EK-Konten (je nach SKR03-Ausprägung)
  [  800,  899, 'darlehen',         'unsicher'  ],   // Langfristige Verbindlichkeiten
  [  900,  999, 'rap_rueckst',      'unsicher'  ],   // Abgrenzungen
  // Klasse 1: Finanz- und Privatkonten
  [ 1000, 1099, 'bank_kasse',       'sicher'   ],   // Kasse
  [ 1100, 1199, 'bank_kasse',       'sicher'   ],   // Bank/Giro
  [ 1200, 1399, 'forderungen',      'sicher'   ],   // Forderungen aus LuL + sonstige
  [ 1400, 1499, 'sonstige_ertraege','unsicher'  ],   // USt/Vorsteuer-Konten → sonstige
  [ 1500, 1599, 'darlehen',         'unsicher'  ],   // Darlehen kurzfristig
  [ 1600, 1799, 'verbindlichkeiten','sicher'   ],   // Verbindlichkeiten aus LuL + sonstige
  [ 1800, 1899, 'sonstige_ertraege','unsicher'  ],   // USt-Verbindlichkeiten
  [ 1900, 1999, 'eigenkapital',     'unsicher'  ],   // Privat-/Verrechnungskonten
  // Klasse 2: Abgrenzungskonten
  [ 2000, 2999, 'rap_rueckst',      'sicher'   ],   // RAP aktiv/passiv, Rückstellungen
  // Klasse 3: Wareneinkauf
  [ 3000, 3999, 'wareneinkauf',     'sicher'   ],
  // Klasse 4: Betriebliche Aufwendungen
  [ 4000, 4999, 'betriebsausgaben', 'sicher'   ],
  // Klasse 5: Weitere Aufwendungen
  [ 5000, 5999, 'betriebsausgaben', 'sicher'   ],
  // Klasse 6: Weitere Aufwendungen
  [ 6000, 6999, 'betriebsausgaben', 'sicher'   ],
  // Klasse 7: Erzeugnisse
  [ 7000, 7999, 'wareneinkauf',     'unsicher'  ],
  // Klasse 8: Erlöse (WICHTIG: SKR03-Merkmal!)
  [ 8000, 8999, 'betriebseinnahmen','sicher'   ],
  // Klasse 9: Skip → unbekannt
  [ 9000, 9999, 'unsicher',         'unbekannt' ],
]

// ── SKR04 Ranges ──────────────────────────────────────────────────────────────
// Kontenklassen lt. Übersicht:
// 0: Anlagevermögen
// 1: Umlaufvermögen (Vorräte, Forderungen, liquide Mittel)
// 2: Eigenkapital
// 3: Fremdkapital (Rückstellungen, Verbindlichkeiten, Darlehen)
// 4: Betriebliche Erträge (Umsatzerlöse → ERLÖSE in SKR04!)
// 5: Betriebliche Aufwendungen (Material, Personal, Raumkosten)
// 6: Weitere Aufwendungen (AfA, sonst. betr. Aufwendungen)
// 7: Weitere Erträge/Aufwendungen (betriebsfremd, Steuern)
// 8: Frei → unsicher
// 9: Statistik → skip

const SKR04_RANGES = [
  // Klasse 0: AV
  [    1,  999, 'anlagevermögen',   'sicher'   ],
  // Klasse 1: UV
  [ 1000, 1299, 'wareneinkauf',     'sicher'   ],   // Vorräte (Roh/Hilfs/Betriebsstoffe, Waren)
  [ 1300, 1499, 'forderungen',      'sicher'   ],   // Forderungen
  [ 1500, 1599, 'sonstige_ertraege','unsicher'  ],   // Wertpapiere
  [ 1600, 1699, 'bank_kasse',       'sicher'   ],   // Bank/Kasse
  [ 1700, 1799, 'rap_rueckst',      'sicher'   ],   // Aktive RAP
  // Klasse 2: EK
  [ 2000, 2099, 'eigenkapital',     'sicher'   ],
  [ 2100, 2999, 'eigenkapital',     'unsicher'  ],   // Rücklagen, Jahresergebnis etc.
  // Klasse 3: FK
  [ 3000, 3099, 'rap_rueckst',      'sicher'   ],   // Rückstellungen
  [ 3100, 3199, 'darlehen',         'sicher'   ],   // Verbindlichkeiten gegenüber KI
  [ 3200, 3299, 'verbindlichkeiten','sicher'   ],   // Verbindlichkeiten LuL
  [ 3300, 3499, 'verbindlichkeiten','sicher'   ],   // Sonstige Verbindlichkeiten
  [ 3500, 3699, 'sonstige_ertraege','unsicher'  ],   // Sonstiges FK
  [ 3700, 3799, 'rap_rueckst',      'sicher'   ],   // Passive RAP
  [ 3800, 3999, 'sonstige_ertraege','unsicher'  ],   // Sonstiges FK
  // Klasse 4: Betriebliche Erträge (WICHTIG: SKR04-Merkmal!)
  [ 4000, 4999, 'betriebseinnahmen','sicher'   ],
  // Klasse 5: Betriebliche Aufwendungen
  [ 5000, 5999, 'betriebsausgaben', 'sicher'   ],
  // Klasse 6: Weitere Aufwendungen
  [ 6000, 6999, 'betriebsausgaben', 'sicher'   ],
  // Klasse 7: Sonstige Erträge/Aufwendungen
  [ 7000, 7999, 'sonstige_ertraege','unsicher'  ],
  // Klasse 8: Frei
  [ 8000, 8999, 'unsicher',         'unbekannt' ],
  // Klasse 9: Skip
  [ 9000, 9999, 'unsicher',         'unbekannt' ],
]

// ── Lookup-Funktion ───────────────────────────────────────────────────────────
export function getBlockForKonto(nrStr, kontenrahmen) {
  const nr = parseInt(nrStr, 10)
  if (isNaN(nr)) return { block: 'unsicher', konfidenz: 'unbekannt' }

  const ranges = kontenrahmen === 'SKR04' ? SKR04_RANGES : SKR03_RANGES
  for (const [von, bis, block, konfidenz] of ranges) {
    if (nr >= von && nr <= bis) return { block, konfidenz }
  }
  return { block: 'unsicher', konfidenz: 'unbekannt' }
}

// ── Kontenrahmen-Erkennung ───────────────────────────────────────────────────
// SKR03: Erlöse auf 8xxx → typisch 8400 (Erlöse 19%), 8300 (Erlöse 7%)
// SKR04: Erlöse auf 4xxx → typisch 4400 (Erlöse 19%), 4200 (Erlöse 7%)
// Unterscheidungsmerkmal: wo liegen die Konten mit "Erlös" in der Bezeichnung?

export function detectKontenrahmen(konten) {
  let score03 = 0, score04 = 0

  for (const k of konten) {
    const nr = parseInt(k.nr, 10)
    const bez = (k.bezeichnung ?? '').toLowerCase()
    const isErloes = bez.includes('erlös') || bez.includes('umsatz') || bez.includes('einnahme')
    const isAufwand = bez.includes('aufwand') || bez.includes('kosten') || bez.includes('lohn')

    // SKR03: Erlöse auf 8xxx
    if (nr >= 8000 && nr <= 8999 && isErloes) score03 += 3
    if (nr >= 8000 && nr <= 8999) score03 += 1
    // SKR03: Aufwand auf 4-6xxx
    if (nr >= 4000 && nr <= 6999 && isAufwand) score03 += 2

    // SKR04: Erlöse auf 4xxx
    if (nr >= 4000 && nr <= 4999 && isErloes) score04 += 3
    if (nr >= 4000 && nr <= 4999) score04 += 1
    // SKR04: Aufwand auf 5-6xxx
    if (nr >= 5000 && nr <= 6999 && isAufwand) score04 += 2
    // SKR04: Spezifische Konten
    if (nr >= 4400 && nr <= 4499 && isErloes) score04 += 3  // 4400 = typisch SKR04 Erlöse
    if (nr >= 8400 && nr <= 8499 && isErloes) score03 += 3  // 8400 = typisch SKR03 Erlöse
  }

  if (score03 === 0 && score04 === 0) return 'unbekannt'
  if (score03 > score04 * 1.5) return 'SKR03'
  if (score04 > score03 * 1.5) return 'SKR04'
  // Tiebreaker: gibt es 8xxx-Konten? → eher SKR03
  const hat8xxx = konten.some(k => parseInt(k.nr, 10) >= 8000 && parseInt(k.nr, 10) <= 8899)
  return hat8xxx ? 'SKR03' : 'SKR04'
}

// ── EÜR / Bilanz-Erkennung ───────────────────────────────────────────────────
// Bilanz: AV-Konten (0xxx) + EK-Konten aktiv bebbucht
// EÜR: Schwerpunkt auf 4-8xxx, keine/wenige Bilanzkonten

export function detectGewinnermittlung(konten, kontenrahmen) {
  const nrn = konten.map(k => parseInt(k.nr, 10)).filter(n => !isNaN(n))

  if (kontenrahmen === 'SKR04') {
    const hatAV  = nrn.some(n => n >= 1 && n <= 999)
    const hatEK  = nrn.some(n => n >= 2000 && n <= 2099)
    const hatVerbindl = nrn.some(n => n >= 3100 && n <= 3499)
    return hatAV && (hatEK || hatVerbindl) ? 'Bilanz' : 'EÜR'
  }

  // SKR03
  const hatAV   = nrn.some(n => n >= 100 && n <= 699)
  const hatEK   = nrn.some(n => n >= 700 && n <= 799)
  const hatDarlehen = nrn.some(n => n >= 800 && n <= 899)
  return hatAV && (hatEK || hatDarlehen) ? 'Bilanz' : 'EÜR'
}

// ── Erwartete Soll/Haben-Seite pro Block ─────────────────────────────────────
export function getErwarteteSeiteFuerBlock(blockId) {
  const SOLL_BLOCKS  = ['betriebsausgaben', 'wareneinkauf', 'anlagevermögen', 'bank_kasse', 'forderungen']
  const HABEN_BLOCKS = ['betriebseinnahmen', 'verbindlichkeiten', 'darlehen', 'eigenkapital', 'rap_rueckst', 'sonstige_ertraege']
  if (SOLL_BLOCKS.includes(blockId))  return 'S'
  if (HABEN_BLOCKS.includes(blockId)) return 'H'
  return null
}
