/* avkonten.js – welche Konten zum Anlagevermögen gehören und welche die
 * Abschreibungen tragen.
 *
 * Quellen: § 266 Abs. 2 A. HGB (Gliederung), § 284 Abs. 3 HGB (Anlagespiegel),
 * DATEV Dok. 5301997 (Aufbau), 5300879 (Anlagespiegel), 5300884 (Anlagevermögen).
 *
 * Das Modul rechnet bewusst keine AfA und keine Anschaffungskosten – das
 * passiert in der Anlagenbuchhaltung. Hier geht es um die Frage, welches
 * Anlagevermögen vorhanden ist und ob sich die Bewegung des Jahres erklären
 * lässt.
 */

const nr = k => parseInt(String(k ?? '').trim(), 10)

/* Bestandskonten. SKR03 endet vor den Darlehen (0600) und den
 * Verbindlichkeiten (0700) – die gehören nicht ins Anlagevermögen, auch wenn
 * sie im selben Nummernblock stehen. */
export const AV_BESTAND = {
  '03': [[10, 599]],
  '04': [[100, 899]],
}

/* Abschreibungskonten. 4800–4819 bleiben aussen vor: dort stehen Reparaturen,
 * Wartung und Leasing, also laufender Aufwand. */
export const AV_AFA = {
  '03': [[4820, 4899]],
  '04': [[6200, 6299]],
}

/* Gliederung nach § 266 Abs. 2 A. HGB (Dok. 5301997) – als Vorbelegung für die
 * Übersicht, welche Arten von Anlagevermögen vorhanden sind. */
export const AV_POSTEN = [
  'Immaterielle Vermögensgegenstände',
  'Grundstücke und Bauten',
  'Technische Anlagen und Maschinen',
  'Andere Anlagen, Betriebs- und Geschäftsausstattung',
  'Fuhrpark',
  'Geleistete Anzahlungen und Anlagen im Bau',
  'Finanzanlagen',
]

const inBereich = (n, bereiche) => bereiche.some(([a, b]) => n >= a && n <= b)

export function istAvBestand(konto, skr) {
  const n = nr(konto); return !!n && inBereich(n, AV_BESTAND[skr === '04' ? '04' : '03'])
}

export function istAvAfa(konto, skr) {
  const n = nr(konto); return !!n && inBereich(n, AV_AFA[skr === '04' ? '04' : '03'])
}

export function istAvKonto(konto, skr) { return istAvBestand(konto, skr) || istAvAfa(konto, skr) }

/** In welche Liste des Moduls gehört das Konto? */
export function avZielListe(konto, skr) {
  if (istAvAfa(konto, skr)) return 'afa'
  if (istAvBestand(konto, skr)) return 'bestand'
  return null
}

/* Grobe Zuordnung eines Bestandskontos zu einem Bilanzposten – nur als
 * Anhaltspunkt in der Anzeige, nicht als Bilanzgliederung. */
export function avPosten(konto, skr) {
  const n = nr(konto)
  if (!n) return ''
  if (skr === '04') {
    if (n < 200) return 'Immaterielle Vermögensgegenstände'
    if (n < 400) return 'Grundstücke und Bauten'
    if (n < 500) return 'Technische Anlagen und Maschinen'
    if (n < 520) return 'Andere Anlagen, Betriebs- und Geschäftsausstattung'
    if (n < 700) return 'Fuhrpark'
    return 'Finanzanlagen'
  }
  if (n < 50) return 'Immaterielle Vermögensgegenstände'
  if (n < 200) return 'Grundstücke und Bauten'
  if (n < 300) return 'Technische Anlagen und Maschinen'
  if (n < 400) return 'Fuhrpark'
  if (n < 500) return 'Andere Anlagen, Betriebs- und Geschäftsausstattung'
  return 'Finanzanlagen'
}
