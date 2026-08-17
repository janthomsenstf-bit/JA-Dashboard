/**
 * mandantennummer.js – Vorschlag für die nächste freie Mandantennummer.
 *
 * Bewusst nur ein Vorschlag: die Nummer bleibt frei eingebbar. Gezählt wird über
 * alle drei Nummernfelder aller Mandanten (auch archivierte – eine vergebene
 * Nummer bleibt vergeben). Nicht-numerische Nummern werden ignoriert, führende
 * Nullen der höchsten Nummer werden beibehalten (10059 → 10060, 0042 → 0043).
 */

const FELDER = ['mandantennummer', 'mandantennummer2', 'mandantennummer3']

// Alle vergebenen Nummern als Strings – für die Dubletten-Prüfung.
export function vergebeneNummern(clients = []) {
  const set = new Set()
  for (const c of clients) {
    for (const f of FELDER) {
      const v = String(c?.[f] ?? '').trim()
      if (v) set.add(v)
    }
  }
  return set
}

export function istNummerVergeben(clients = [], nummer) {
  const n = String(nummer ?? '').trim()
  return !!n && vergebeneNummern(clients).has(n)
}

/**
 * Vorschlag = höchste vergebene Nummer + 1.
 * Lücken werden absichtlich nicht gefüllt – in der Kanzlei sind sie meist
 * gewollt (aufgegebene Mandate), eine wiederverwendete Nummer wäre riskant.
 * Rückgabe: { vorschlag, hoechste, anzahl } – vorschlag ist '' wenn es noch
 * keine einzige numerische Nummer gibt (dann schlägt nichts vor).
 */
export function naechsteFreieNummer(clients = []) {
  let hoechsteWert = -1
  let hoechsteText = ''
  let anzahl = 0

  for (const c of clients) {
    for (const f of FELDER) {
      const roh = String(c?.[f] ?? '').trim()
      if (!/^\d+$/.test(roh)) continue
      anzahl++
      const wert = parseInt(roh, 10)
      if (wert > hoechsteWert) { hoechsteWert = wert; hoechsteText = roh }
    }
  }

  if (hoechsteWert < 0) return { vorschlag: '', hoechste: '', anzahl: 0 }

  // Stellenzahl der höchsten Nummer halten (führende Nullen bleiben erhalten)
  const naechste = String(hoechsteWert + 1)
  const vorschlag = naechste.length < hoechsteText.length
    ? naechste.padStart(hoechsteText.length, '0')
    : naechste

  return { vorschlag, hoechste: hoechsteText, anzahl }
}

/**
 * Namensvorschlag aus einer E-Mail-Adresse, wenn kein Klarname mitkommt:
 * info@weissig-bau.de → „Weissig Bau". Nur ein Startwert zum Überschreiben.
 */
export function nameAusEmail(email, vonName = '') {
  const klar = String(vonName || '').trim()
  if (klar && !klar.includes('@')) return klar

  const domain = String(email || '').split('@')[1] || ''
  const basis = domain.split('.')[0] || ''
  if (!basis) return ''
  return basis
    .split(/[-_]/)
    .filter(Boolean)
    .map(t => t.charAt(0).toUpperCase() + t.slice(1))
    .join(' ')
}
