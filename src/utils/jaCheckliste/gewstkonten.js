/* gewstkonten.js – Kontenlandkarte und Vorauszahlungstermine der Gewerbesteuer.
 *
 * Quellen: § 19 GewStG (Vorauszahlungen), § 11 GewStG (Messzahl, Freibetrag),
 * § 16 GewStG (Hebesatz), § 4 Abs. 5b EStG (nicht abziehbar), § 35 EStG
 * (Anrechnung), §§ 28–34 GewStG (Zerlegung). Die Konten sind der SKR-Standard
 * und vom Bearbeiter zu prüfen.
 *
 * Anders als bei der Umsatzsteuer gibt es keinen Rhythmus zur Auswahl: die
 * Vorauszahlungen sind gesetzlich auf vier feste Termine gelegt (§ 19 Abs. 1
 * S. 1 GewStG). Eine nachträgliche Vorauszahlung nach § 19 Abs. 3 S. 3 GewStG
 * kommt als zusätzliche Zeile dazu und wird deshalb nicht mit angelegt.
 */

export const GEWST_VZ_TERMINE = ['15.02.', '15.05.', '15.08.', '15.11.']

/* Konten, die das Modul beim SuSa-Import für sich beansprucht. Bank und das
 * allgemeine Steuerverbindlichkeitskonto stehen bewusst NICHT darin – sie
 * gehören anderen Bereichen und werden nur als Buchungsziel genannt. */
export const GEWST_A_KONTEN = {
  '03': {
    '4320': { rolle: 'aufwand', bez: 'Gewerbesteuer (Aufwand)' },
    '0956': { rolle: 'rueckstellung', bez: 'Gewerbesteuerrückstellung § 4 Abs. 5b EStG' },
    '2281': { rolle: 'vorjahre', bez: 'Gewerbesteuer-Nachzahlungen/Erstattungen Vorjahre' },
    '2283': { rolle: 'aufloesung', bez: 'Erträge aus der Auflösung der GewSt-Rückstellung' },
    '1540': { rolle: 'forderung', bez: 'Forderung aus Gewerbesteuerüberzahlung' },
  },
  '04': {
    '7610': { rolle: 'aufwand', bez: 'Gewerbesteuer (Aufwand)' },
    '3035': { rolle: 'rueckstellung', bez: 'Gewerbesteuerrückstellung § 4 Abs. 5b EStG' },
    '7641': { rolle: 'vorjahre', bez: 'Gewerbesteuer-Nachzahlungen/Erstattungen Vorjahre' },
    '7643': { rolle: 'aufloesung', bez: 'Erträge aus der Auflösung der GewSt-Rückstellung' },
    '1435': { rolle: 'forderung', bez: 'Forderung aus Gewerbesteuerüberzahlung' },
  },
}

/** Kontonummern vergleichen, ohne über führende Nullen zu stolpern (0956 = 956). */
export function gleichKonto(a, b) {
  const n = x => String(x ?? '').trim().replace(/^0+/, '')
  return n(a) !== '' && n(a) === n(b)
}

/** Rolle und Bezeichnung eines Gewerbesteuerkontos, sonst null. */
export function gewStGruppe(konto, skr) {
  const t = GEWST_A_KONTEN[skr === '04' ? '04' : '03']
  const k = Object.keys(t).find(x => gleichKonto(x, konto))
  return k ? { konto: k, ...t[k] } : null
}

export function istGewStKonto(konto, skr) { return !!gewStGruppe(konto, skr) }

/** Das Konto einer Rolle im geltenden Kontenrahmen. */
export function gewStKontoFuer(rolle, skr) {
  const t = GEWST_A_KONTEN[skr === '04' ? '04' : '03']
  const k = Object.keys(t).find(x => t[x].rolle === rolle)
  return k || ''
}
