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
 * Vorschlag für die nächste Nummer – bewusst INNERHALB des Nummernkreises,
 * in dem die Kanzlei arbeitet.
 *
 * Hintergrund: Neben den laufenden Mandantennummern (z. B. 10xxx) gibt es
 * vereinzelt Nummern in ganz anderen Bereichen (z. B. 7xxxx für Sonderfälle).
 * Ein globales „höchste + 1" würde daran hängenbleiben und den Nummernkreis
 * verlassen. Deshalb wird zuerst der Zehntausender-Block gesucht, in dem die
 * meisten Mandanten liegen; vorgeschlagen wird die nächste freie Nummer dort.
 *
 * Lücken werden nur gefüllt, wenn der Block oben zu Ende ist – eine
 * wiederverwendete Nummer ist sonst riskanter als eine übersprungene.
 *
 * Rückgabe: { vorschlag, hoechste, anzahl, block, ausserhalb }
 *   block      – Label des gewählten Bereichs, z. B. „10.000er"
 *   ausserhalb – wie viele Nummern außerhalb dieses Bereichs liegen
 */
export function naechsteFreieNummer(clients = []) {
  const alle = []
  for (const c of clients) {
    for (const f of FELDER) {
      const roh = String(c?.[f] ?? '').trim()
      if (/^\d+$/.test(roh)) alle.push({ roh, wert: parseInt(roh, 10) })
    }
  }
  if (alle.length === 0) return { vorschlag: '', hoechste: '', anzahl: 0, block: '', ausserhalb: 0 }

  // Zehntausender-Blöcke zählen – der am dichtesten belegte gewinnt,
  // bei Gleichstand der niedrigere (die Kanzlei wächst nach oben).
  const proBlock = new Map()
  for (const n of alle) {
    const b = Math.floor(n.wert / 10000)
    proBlock.set(b, (proBlock.get(b) || 0) + 1)
  }
  let block = null, bestesN = -1
  for (const [b, n] of [...proBlock.entries()].sort((a, b2) => a[0] - b2[0])) {
    if (n > bestesN) { bestesN = n; block = b }
  }

  const imBlock = alle.filter(n => Math.floor(n.wert / 10000) === block)
  const belegt  = new Set(imBlock.map(n => n.wert))
  const hoechsteImBlock = imBlock.reduce((a, b) => (b.wert > a.wert ? b : a))

  const untergrenze = block * 10000
  const obergrenze  = untergrenze + 9999

  // Regelfall: eins über der höchsten Nummer des Blocks.
  let kandidat = hoechsteImBlock.wert + 1
  // Block oben voll → erste Lücke von unten suchen.
  if (kandidat > obergrenze) {
    kandidat = null
    for (let i = untergrenze; i <= obergrenze; i++) {
      if (!belegt.has(i)) { kandidat = i; break }
    }
    if (kandidat === null) return { vorschlag: '', hoechste: hoechsteImBlock.roh, anzahl: alle.length, block: blockLabel(block), ausserhalb: alle.length - imBlock.length }
  }

  // Stellenzahl der höchsten Nummer im Block halten (führende Nullen bleiben)
  const text = String(kandidat)
  const vorschlag = text.length < hoechsteImBlock.roh.length
    ? text.padStart(hoechsteImBlock.roh.length, '0')
    : text

  return {
    vorschlag,
    hoechste:   hoechsteImBlock.roh,
    anzahl:     alle.length,
    block:      blockLabel(block),
    ausserhalb: alle.length - imBlock.length,
  }
}

// 1 → „10.000er", 7 → „70.000er", 0 → „unter 10.000"
function blockLabel(block) {
  if (block === 0) return 'unter 10.000'
  return `${(block * 10000).toLocaleString('de-DE')}er`
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
