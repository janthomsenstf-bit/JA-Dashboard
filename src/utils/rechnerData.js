// ─── BMF-Auslandspauschalen 2024 ────────────────────────────────────────────────
// Quelle: BMF-Schreiben zu § 9 Abs. 4a EStG
// Vollpauschale = Tagegeld bei 24h-Abwesenheit
// An-/Abreisetag und eintägige Auslandsreise = 80% der Vollpauschale
// Bitte jährlich anhand des aktuellen BMF-Schreibens prüfen!

export const BMF_AUSLAND_2024 = {
  'Australien':                       58,
  'Belgien':                          42,
  'China':                            55,
  'Dänemark':                         51,
  'Deutschland (Inland)':             28,
  'Frankreich':                       40,
  'Griechenland':                     35,
  'Großbritannien':                   49,
  'Indien':                           44,
  'Irland':                           48,
  'Israel':                           55,
  'Italien':                          37,
  'Japan':                            56,
  'Kanada':                           53,
  'Kroatien':                         35,
  'Luxemburg':                        42,
  'Niederlande':                      42,
  'Norwegen':                         56,
  'Österreich':                       35,
  'Polen':                            35,
  'Portugal':                         38,
  'Rumänien':                         31,
  'Russland':                         45,
  'Schweden':                         53,
  'Schweiz':                          58,
  'Slowakei':                         35,
  'Spanien':                          37,
  'Tschechien':                       32,
  'Türkei':                           32,
  'Ungarn':                           31,
  'USA':                              65,
  'Vereinigte Arabische Emirate':     55,
}

export const LAENDER_LISTE = ['Deutschland (Inland)', ...Object.keys(BMF_AUSLAND_2024).filter(l => l !== 'Deutschland (Inland)').sort()]

// ─── KFZ-Besteuerungssätze ──────────────────────────────────────────────────────
export const KFZ_SAETZE = {
  verbrenner:   0.01,   // 1,0% des BLP
  hybrid_05:    0.005,  // 0,5% (Plug-in Hybrid mit ≥60km Reichweite oder ≤50g CO₂/km)
  elektro_025:  0.0025, // 0,25% (BLP ≤ 70.000 € bei Anschaffung ab 2024)
  elektro_05:   0.005,  // 0,5%  (BLP > 70.000 €)
}

// ─── KFZ Berechnung ──────────────────────────────────────────────────────────────
export function calcKFZ1Prozent({ bruttolistenpreis, fahrzeugtyp, monate, entfernungKm, pendler }) {
  const blp    = Number(bruttolistenpreis) || 0
  const mon    = Number(monate) || 12
  const ekm    = Number(entfernungKm) || 0
  const satz   = KFZ_SAETZE[fahrzeugtyp] ?? 0.01

  const privatMonatlich  = blp * satz
  const privatJaehrlich  = privatMonatlich * mon

  // 0,03%-Regelung für Pendler (Fahrten Wohnung-Arbeitsstätte)
  const pendelMonatlich  = pendler && ekm > 0 ? blp * 0.0003 * ekm : 0
  const pendelJaehrlich  = pendelMonatlich * mon

  const gesamt = privatJaehrlich + pendelJaehrlich

  return {
    satzProzent:      satz * 100,
    privatMonatlich,
    privatJaehrlich,
    pendelMonatlich,
    pendelJaehrlich,
    gesamt,
  }
}

export function calcKFZFahrtenbuch({ gesamtkm, privatkm, gesamtkosten }) {
  const gkm  = Number(gesamtkm) || 0
  const pkm  = Number(privatkm) || 0
  const gk   = Number(gesamtkosten) || 0
  if (gkm === 0) return { privatquote: 0, betriebsquote: 0, privatkosten: 0, betriebskosten: 0 }

  const privatquote   = pkm / gkm
  const betriebsquote = (gkm - pkm) / gkm

  return {
    privatquote:   privatquote * 100,
    betriebsquote: betriebsquote * 100,
    privatkosten:  privatquote * gk,
    betriebskosten: betriebsquote * gk,
  }
}

// ─── Arbeitszimmer ───────────────────────────────────────────────────────────────
export function calcArbeitszimmerPauschale({ arbeitstage }) {
  const tage  = Math.min(Number(arbeitstage) || 0, 210)
  const betrag = tage * 6
  return { tage, betrag, maxErreicht: Number(arbeitstage) > 210 }
}

export function calcArbeitszimmerKosten({
  bueroflaeche, gesamtflaeche,
  jahresmiete, jahresNK, jahresAfA,
  versicherung, grundsteuer, abfallgebuehren,
  schornsteinfeger, renovierung, strom,
  sonstiges,
}) {
  const bf  = Number(bueroflaeche)    || 0
  const gf  = Number(gesamtflaeche)   || 0
  if (gf === 0) return { anteil: 0, gesamtkosten: 0, abzugsfaehig: 0 }

  const positionen = [
    Number(jahresmiete)      || 0,
    Number(jahresNK)         || 0,
    Number(jahresAfA)        || 0,
    Number(versicherung)     || 0,
    Number(grundsteuer)      || 0,
    Number(abfallgebuehren)  || 0,
    Number(schornsteinfeger) || 0,
    Number(renovierung)      || 0,
    Number(strom)            || 0,
    Number(sonstiges)        || 0,
  ]

  const anteil       = bf / gf
  const gesamtkosten = positionen.reduce((s, v) => s + v, 0)
  const abzugsfaehig = anteil * gesamtkosten

  return { anteil: anteil * 100, gesamtkosten, abzugsfaehig }
}

// ─── Reisekosten / VMA ───────────────────────────────────────────────────────────
// abwesenheitsart:
//   'unter8'       = Eintägig, unter 8h       → 0 €
//   'eintaegig'    = Eintägig, 8–24h Inland   → 14 €
//   'volltag'      = Voller Tag (24h)          → 28 € / Ausland: 100%
//   'anreise'      = Anreisetag mehrtägig      → 14 € / Ausland: 100%
//   'abreise'      = Abreisetag               → 14 € / Ausland: 80%

export function calcVMASingle({ land, abwesenheitsart }) {
  const inland = !land || land === 'Deutschland (Inland)'

  if (inland) {
    switch (abwesenheitsart) {
      case 'unter8':    return 0
      case 'eintaegig': return 14
      case 'volltag':   return 28
      case 'anreise':   return 14
      case 'abreise':   return 14
      default:          return 0
    }
  }

  // Ausland
  const vollsatz = BMF_AUSLAND_2024[land] ?? 28
  switch (abwesenheitsart) {
    case 'unter8':    return 0
    case 'eintaegig': return Math.round(vollsatz * 0.8 * 100) / 100 // 80%
    case 'volltag':   return vollsatz
    case 'anreise':   return vollsatz                                 // 100% (Übernachtung im Ausland)
    case 'abreise':   return Math.round(vollsatz * 0.8 * 100) / 100 // 80%
    default:          return 0
  }
}

export function calcFahrtkosten(km) {
  return (Number(km) || 0) * 0.30
}

export function calcReisekostenGesamt(reisen) {
  let vma = 0, fahrt = 0, sonstiges = 0
  for (const r of reisen) {
    vma       += calcVMASingle({ land: r.land, abwesenheitsart: r.abwesenheitsart })
    fahrt     += calcFahrtkosten(r.km)
    sonstiges += Number(r.sonstiges) || 0
  }
  return { vma, fahrt, sonstiges, gesamt: vma + fahrt + sonstiges }
}

// ─── Formatierung ────────────────────────────────────────────────────────────────
export function fmtEur(val) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val ?? 0)
}

export function fmtPct(val) {
  return (val ?? 0).toFixed(2).replace('.', ',') + ' %'
}
