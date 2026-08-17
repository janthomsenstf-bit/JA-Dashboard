/* pauschbetraege.js – Stammdaten zu den Pauschbeträgen für unentgeltliche
 * Wertabgaben (Sachentnahmen) nach § 148 AO.
 *
 * BEWUSST GETRENNT VON DER LOGIK: Die Werte ändern sich jährlich durch neues
 * BMF-Schreiben. Sie werden hier je Kalenderjahr mit Quellenangabe gepflegt und
 * NIE hochgerechnet — fehlt ein Jahr, meldet das Modul das, statt zu schätzen.
 *
 * Vor Produktivsetzung eines neuen Jahres: Werte Zeile für Zeile gegen das
 * Original-PDF prüfen und die Spaltensumme (ermäßigt + voll = insgesamt)
 * kontrollieren.
 */

// Maßgeblich ist das KALENDERJAHR, nicht das Wirtschaftsjahr. Bei abweichendem
// Wirtschaftsjahr sind die Monate den jeweiligen Kalenderjahren zuzuordnen.
export const SE_JAHRE = {
  2024: {
    quelle: 'BMF v. 12.02.2024, IV D 3 - S 1547/19/10001 :005, DOK 2023/1121410',
    geprueft: 'am Original-PDF verprobt (alle 9 Zeilen, 17.08.2026)',
    ustErm: 0.07, ustVoll: 0.19,
    zweige: {
      baeckerei:         { label: 'Bäckerei',                                      erm: 1605, voll:  206 },
      fleischerei:       { label: 'Fleischerei / Metzgerei',                        erm: 1429, voll:  545 },
      gaststaette_kalt:  { label: 'Gaststätten aller Art – nur kalte Speisen',      erm: 1399, voll: 1016 },
      gaststaette_warm:  { label: 'Gaststätten aller Art – kalte und warme Speisen', erm: 2253, voll: 1723 },
      getraenke_eh:      { label: 'Getränkeeinzelhandel',                           erm:  118, voll:  266 },
      cafe_konditorei:   { label: 'Café und Konditorei',                            erm: 1547, voll:  575 },
      milch_eier_eh:     { label: 'Milch, Milcherzeugnisse, Fettwaren und Eier (Eh.)', erm: 693, voll:   0 },
      nahrung_genuss_eh: { label: 'Nahrungs- und Genussmittel (Eh.)',               erm: 1340, voll:  354 },
      obst_gemuese_eh:   { label: 'Obst, Gemüse, Südfrüchte und Kartoffeln (Eh.)',  erm:  369, voll:  162 },
    },
  },
  2025: {
    quelle: 'BMF v. 21.01.2025, IV D 3 - S 1547/00006/006/024',
    geprueft: null,   // noch nicht gegen das Original-PDF verprobt
    ustErm: 0.07, ustVoll: 0.19,
    zweige: {
      baeckerei:         { label: 'Bäckerei',                                      erm: 1633, voll:  209 },
      fleischerei:       { label: 'Fleischerei / Metzgerei',                        erm: 1453, voll:  555 },
      gaststaette_kalt:  { label: 'Gaststätten aller Art – nur kalte Speisen',      erm: 1423, voll: 1034 },
      gaststaette_warm:  { label: 'Gaststätten aller Art – kalte und warme Speisen', erm: 2292, voll: 1753 },
      getraenke_eh:      { label: 'Getränkeeinzelhandel',                           erm:  120, voll:  270 },
      cafe_konditorei:   { label: 'Café und Konditorei',                            erm: 1573, voll:  585 },
      milch_eier_eh:     { label: 'Milch, Milcherzeugnisse, Fettwaren und Eier (Eh.)', erm: 704, voll:   0 },
      nahrung_genuss_eh: { label: 'Nahrungs- und Genussmittel (Eh.)',               erm: 1363, voll:  360 },
      obst_gemuese_eh:   { label: 'Obst, Gemüse, Südfrüchte und Kartoffeln (Eh.)',  erm:  375, voll:  165 },
    },
  },
  // 2026: BMF v. 23.12.2025, IV D 3 - S 1547/00006/007/021 – noch nicht erfasst.
  // Beim Nachtragen beachten: zum 01.01.2026 sinkt der Steuersatz für Restaurant-
  // und Verpflegungsdienstleistungen (ohne Getränke) auf 7 %; das verschiebt bei
  // den Gaststätten-Zeilen die Aufteilung zwischen den Spalten.
}

/* Altersstaffel (BMF-Schreiben, Vorbemerkung Nr. 4).
   „bis zum vollendeten x. Lebensjahr" = solange die Person jünger als x ist. */
export const SE_ALTERSSTAFFEL = [
  { unter: 2, faktor: 0, label: 'bis zum vollendeten 2. Lebensjahr – kein Ansatz' },
  { unter: 12, faktor: 0.5, label: 'bis zum vollendeten 12. Lebensjahr – halber Wert' },
  { unter: null, faktor: 1, label: 'ab dem vollendeten 12. Lebensjahr – voller Wert' },
]

export function seFaktor(alter) {
  if (alter == null || isNaN(alter)) return 1
  for (const s of SE_ALTERSSTAFFEL) if (s.unter == null || alter < s.unter) return s.faktor
  return 1
}

/* DATEV-Konten. Die Entnahmekonten sind AUTOMATIKKONTEN: es wird der BRUTTO-
   betrag gebucht, die Umsatzsteuer spaltet die Buchführung selbst ab. Wer netto
   bucht, erzeugt eine systematisch zu niedrige Umsatzsteuer. */
export const SE_KONTEN = {
  '03': { gegen: '1880', entnahme7: '8915', entnahme19: '8910', ust7: '1771', ust19: '1776' },
  '04': { gegen: '2130', entnahme7: '4610', entnahme19: '4620', ust7: '3801', ust19: '3806' },
}

export const SE_JAHRE_LISTE = Object.keys(SE_JAHRE).map(Number).sort((a, b) => a - b)
