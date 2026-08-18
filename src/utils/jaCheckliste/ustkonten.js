/* ustkonten.js – Kontenlandkarte für die Umsatzsteuer-Abgrenzung zum Jahresende.
 *
 * Quelle: DATEV Dok. 5305393 (USt-Vorauszahlungen – Konten), 1036907
 * (Jahresabschluss: Umsatzsteuer buchen), 1037686 (Ausweis im Jahresabschluss),
 * 1037179 (EÜR: Vorauszahlungen und Jahreserklärung).
 *
 * Wichtig für die Auswertung: Die Umsatzsteuer ist eine JAHRESsteuer. Nach dem
 * Saldierungsverbot (§ 246 Abs. 2 HGB) ist je Jahr getrennt zu beurteilen, ob
 * eine Forderung oder eine Verbindlichkeit vorliegt. Deshalb sind die Konten
 * hier nach Jahresschicht gruppiert – laufendes Jahr, Vorjahr, frühere Jahre.
 */

export const UST_A_GRUPPEN = [
  { key: 'laufend', label: 'Laufendes Jahr', konten: {
    '03': { 1780: 'Umsatzsteuer-Vorauszahlungen', 1781: 'Umsatzsteuer-Vorauszahlung 1/11 (Sondervorauszahlung)',
      1789: 'Umsatzsteuer laufendes Jahr', 1797: 'Verbindlichkeiten aus Umsatzsteuer-Vorauszahlungen',
      1545: 'Forderungen aus Umsatzsteuer-Vorauszahlungen' },
    '04': { 3820: 'Umsatzsteuer-Vorauszahlungen', 3830: 'Umsatzsteuer-Vorauszahlung 1/11 (Sondervorauszahlung)',
      3840: 'Umsatzsteuer laufendes Jahr', 3860: 'Verbindlichkeiten aus Umsatzsteuer-Vorauszahlungen',
      1420: 'Forderungen aus Umsatzsteuer-Vorauszahlungen' } } },

  { key: 'vorjahr', label: 'Vorjahr', konten: {
    '03': { 1790: 'Umsatzsteuer Vorjahr (Verbindlichkeit)', 1546: 'Umsatzsteuerforderungen Vorjahr' },
    '04': { 3841: 'Umsatzsteuer Vorjahr (Verbindlichkeit)', 1422: 'Umsatzsteuerforderungen Vorjahr' } } },

  { key: 'frueher', label: 'Frühere Jahre', konten: {
    '03': { 1791: 'Umsatzsteuer frühere Jahre' },
    '04': { 3845: 'Umsatzsteuer frühere Jahre' } } },

  { key: 'par11', label: '§ 11 Abs. 2 S. 2 EStG (nur EÜR)', konten: {
    '03': { 1704: 'Sonstige Verbindlichkeiten § 11 Abs. 2 S. 2 EStG', 1450: 'Forderungen § 11 EStG' },
    '04': { 3509: 'Sonstige Verbindlichkeiten § 11 Abs. 2 S. 2 EStG', 1220: 'Forderungen § 11 EStG' } } },
]

/* Leitkonten für die einzelnen Prüfungen. */
export const UST_A_LEIT = {
  '03': { vz: '1780', svz: '1781', lfd: '1789', verb: '1797', ford: '1545',
    vjVerb: '1790', vjFord: '1546', frueher: '1791', par11Verb: '1704', par11Ford: '1450' },
  '04': { vz: '3820', svz: '3830', lfd: '3840', verb: '3860', ford: '1420',
    vjVerb: '3841', vjFord: '1422', frueher: '3845', par11Verb: '3509', par11Ford: '1220' },
}

const nr = k => parseInt(String(k ?? '').trim(), 10)

/** Gehört das Konto zur Umsatzsteuer-Abgrenzung? Liefert Gruppe und Bezeichnung. */
export function ustAGruppe(konto, skr) {
  const n = nr(konto); const s = skr === '04' ? '04' : '03'
  for (const g of UST_A_GRUPPEN) { const t = g.konten[s]; if (t && t[n]) return { gruppe: g.label, key: g.key, bez: t[n] } }
  return null
}

export function istUstAKonto(konto, skr) { return !!ustAGruppe(konto, skr) }

/** Alle Konten einer Gruppe für den geltenden Kontenrahmen. */
export function ustAKonten(gruppe, skr) {
  const g = UST_A_GRUPPEN.find(x => x.key === gruppe)
  return g ? Object.keys(g.konten[skr === '04' ? '04' : '03']).map(String) : []
}

/* Voranmeldungszeiträume (§ 18 Abs. 1, 2 UStG). Monatlich bei Zahllast über
 * 9.000 EUR im Vorjahr, vierteljährlich darunter; Existenzgründer melden in den
 * ersten beiden Jahren monatlich (§ 18 Abs. 2 S. 4 UStG). */
export const UST_MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

export const UST_QUARTALE = ['I. Quartal', 'II. Quartal', 'III. Quartal', 'IV. Quartal']

/** Zeiträume für den gewählten Rhythmus. */
export function ustZeitraeume(rhythmus) {
  return rhythmus === 'quartal' ? UST_QUARTALE : UST_MONATE
}

/** Der letzte Zeitraum – auf ihn wird die Sondervorauszahlung angerechnet. */
export function ustLetzterZeitraum(rhythmus) {
  const z = ustZeitraeume(rhythmus); return z[z.length - 1]
}
