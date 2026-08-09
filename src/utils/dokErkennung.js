/**
 * dokErkennung.js – Deterministische Dokument-Erkennung & Mandanten-Zuordnung
 * (Bereich „Dokumente / Post-Service", Stufe 2a)
 *
 * GRUNDSATZ (feste Entscheidung des Konzepts):
 *   Die KI liefert später nur OCR-Text. Aus diesem Text werden hier – rein
 *   deterministisch, OHNE KI-Raten – harte Kennungen extrahiert (IBAN,
 *   Steuernummer, USt-IdNr., Mandantennummer, Absender, Anschrift) und exakt
 *   gegen die hinterlegten Stammdaten abgeglichen.
 *
 *   Eine falsche Zuordnung ist ein Datenschutzvorfall. Deshalb gilt:
 *   im Zweifel lieber MEHRERE Kandidaten anzeigen (oder gar keinen) als
 *   riskant auf einen Mandanten zu tippen.
 *
 * Alle Funktionen hier sind pur (keine Seiteneffekte, kein Netz, kein DOM) und
 * damit einzeln testbar. OCR-Beschaffung und OneDrive-Verdrahtung folgen in 2b.
 */

// ───────────────────────────────────────────────────────────────────────────
//  Normalisierung
// ───────────────────────────────────────────────────────────────────────────

/** IBAN → Großbuchstaben, ohne Leerzeichen/Sonderzeichen. */
export function normIban(v) {
  return String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Steuernummer → nur Ziffern (Formatvarianten mit / . Leerzeichen werden vereinheitlicht). */
export function normSteuernr(v) {
  return String(v ?? '').replace(/\D/g, '')
}

/** USt-IdNr. → Großbuchstaben, ohne Leerzeichen/Sonderzeichen (z. B. "DE 123 456 789" → "DE123456789"). */
export function normUstId(v) {
  return String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Text für Vergleiche vereinheitlichen (klein, Umlaute normalisiert, Mehrfach-Whitespace zu einem Space). */
export function normText(v) {
  return String(v ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim()
}

// ───────────────────────────────────────────────────────────────────────────
//  Formale Gültigkeitsprüfung
// ───────────────────────────────────────────────────────────────────────────

/**
 * IBAN-Prüfung nach ISO 13616 (Mod-97). Nur Formalprüfung, kein Konten-Check.
 * Verhindert, dass zufällige Ziffernketten als IBAN gelten.
 */
export function istIbanGueltig(v) {
  const iban = normIban(v)
  if (iban.length < 15 || iban.length > 34) return false
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false
  // Länderteil ans Ende, Buchstaben → Zahlen (A=10 … Z=35), dann Mod 97 === 1
  const umgestellt = iban.slice(4) + iban.slice(0, 4)
  let rest = 0
  for (const ch of umgestellt) {
    const wert = /\d/.test(ch) ? ch : (ch.charCodeAt(0) - 55).toString()
    for (const ziffer of wert) rest = (rest * 10 + Number(ziffer)) % 97
  }
  return rest === 1
}

// ───────────────────────────────────────────────────────────────────────────
//  Kennungen aus Freitext (OCR) extrahieren
// ───────────────────────────────────────────────────────────────────────────

/**
 * Zieht alle harten Kennungen aus einem OCR-Text.
 * Rückgabe: { ibans[], ustIds[], steuernummern[], mandantennummern[], datumse[], betraege[] }
 * Werte sind normalisiert und dubletten­frei. IBANs sind Mod-97-geprüft.
 */
export function extrahiereKennungen(text) {
  const t = String(text ?? '')

  // IBAN: Ländercode + 2 Prüfziffern + Ziffern/Buchstaben, Leerzeichen (4er-Gruppen)
  // erlaubt. Das greedy-Muster kann angrenzende Wörter mitfassen ("… 00 bei der
  // Bank") – deshalb wird anschließend per Mod-97 das LÄNGSTE gültige Präfix
  // bestimmt, das die angehängten Wörter wieder abschneidet.
  const ibanRoh = t.match(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,40}/gi) ?? []
  const ibans = einzigartig(
    ibanRoh.map(laengstesGueltigesIbanPraefix).filter(Boolean)
  )

  // USt-IdNr.: länderspezifisch fest (DE + 9 Ziffern, DK + 8 Ziffern), Leerzeichen
  // erlaubt. Der Negativ-Lookahead "keine weitere Ziffer" verhindert, dass der
  // Anfang einer IBAN (DE + viele Ziffern) fälschlich als USt-IdNr. gilt.
  const ustRoh = t.match(/\b(?:DE[ ]?(?:\d[ ]?){8}\d|DK[ ]?(?:\d[ ]?){7}\d)(?![ ]?\d)/gi) ?? []
  const ustIds = einzigartig(
    ustRoh.map(normUstId).filter(x => /^(?:DE\d{9}|DK\d{8})$/.test(x))
  )

  // Steuernummer: deutsche Formate wie 12/345/67890, 123/456/78901, 1234567890 (10–13 Ziffern)
  const stRoh = t.match(/\b\d{2,3}[\/ ]\d{3}[\/ ]\d{4,5}\b/g) ?? []
  const steuernummern = einzigartig(stRoh.map(normSteuernr).filter(x => x.length >= 10 && x.length <= 13))

  // Mandantennummer wird NICHT frei geraten (zu viele nackte Zahlen im Text) –
  // der Abgleich sucht die konkreten Nummern der Mandanten gezielt im Text (s. u.).

  // Datum: TT.MM.JJJJ / TT.MM.JJ
  const datumse = einzigartig(t.match(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g) ?? [])

  // Beträge: 1.234,56 / 1234,56  (nur Info für spätere Stufen, keine Zuordnung)
  const betraege = einzigartig(t.match(/\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g) ?? [])

  return { ibans, ustIds, steuernummern, datumse, betraege }
}

function einzigartig(arr) { return [...new Set(arr)] }

/**
 * Nimmt einen (evtl. zu langen) IBAN-Rohtreffer, normalisiert ihn und gibt das
 * längste per Mod-97 gültige Präfix zurück – oder null. So werden versehentlich
 * mitgefasste Folgewörter über die Prüfsumme wieder abgeschnitten.
 */
function laengstesGueltigesIbanPraefix(roh) {
  const s = normIban(roh)
  for (let len = Math.min(s.length, 34); len >= 15; len--) {
    const kand = s.slice(0, len)
    if (istIbanGueltig(kand)) return kand
  }
  return null
}

// ───────────────────────────────────────────────────────────────────────────
//  Dokumenttyp (grobe Heuristik über Schlagwörter)
// ───────────────────────────────────────────────────────────────────────────

const DOKUMENTTYPEN = [
  { typ: 'Steuerbescheid',   woerter: ['bescheid', 'festsetzung', 'festgesetzt', 'finanzamt'] },
  { typ: 'Umsatzsteuer',     woerter: ['umsatzsteuer', 'voranmeldung', 'ust-va', 'umsatzsteuer-voranmeldung'] },
  { typ: 'Mahnung',          woerter: ['mahnung', 'zahlungserinnerung', 'letzte mahnung', 'verzug'] },
  { typ: 'Rechnung',         woerter: ['rechnung', 'rechnungsnummer', 'rechnungsbetrag', 'zu zahlen', 'leistungsdatum'] },
  { typ: 'Kontoauszug',      woerter: ['kontoauszug', 'saldo', 'auszug nr', 'buchungstag'] },
  { typ: 'Vertrag',          woerter: ['vertrag', 'vereinbarung', 'vertragsnummer', 'kuendigung'] },
  { typ: 'Lohnabrechnung',   woerter: ['lohnabrechnung', 'gehaltsabrechnung', 'entgeltabrechnung', 'sozialversicherung', 'lohnsteuer'] },
]

/**
 * Grobe Typ-Einschätzung. Gibt den Typ mit den meisten Schlagwort-Treffern zurück.
 * { typ, konfidenz: 'hoch'|'mittel'|'unklar', treffer[] } – rein informativ, nie automatisch.
 */
export function erkenneDokumenttyp(text) {
  const t = normText(text)
  let bestes = null
  for (const kat of DOKUMENTTYPEN) {
    const treffer = kat.woerter.filter(w => t.includes(normText(w)))
    if (treffer.length > 0 && (!bestes || treffer.length > bestes.treffer.length)) {
      bestes = { typ: kat.typ, treffer }
    }
  }
  if (!bestes) return { typ: 'Unbekannt', konfidenz: 'unklar', treffer: [] }
  return {
    typ: bestes.typ,
    konfidenz: bestes.treffer.length >= 2 ? 'hoch' : 'mittel',
    treffer: bestes.treffer,
  }
}

// ───────────────────────────────────────────────────────────────────────────
//  Mandanten-Zuordnung (deterministisch, gewichtet)
// ───────────────────────────────────────────────────────────────────────────

// Punktgewichte je Signal. Harte Kennungen dominieren; weiche Signale (Name,
// Absender, Anschrift) allein reichen nie für eine sichere Zuordnung.
const GEWICHT = {
  iban:         100,  // eindeutig
  ustId:        100,  // eindeutig
  steuernummer:  90,  // eindeutig
  mandantennr:   70,  // sehr stark, aber „Nr. 42" kann im Text auch anderes sein
  absender:      25,  // weich (derselbe Absender kann bei mehreren Mandanten liegen)
  anschrift:     30,  // weich
  name:          20,  // weich
}

/**
 * Ordnet einen OCR-Text einem Mandanten zu.
 *
 * @param {string} text     – OCR-Text des Dokuments
 * @param {object[]} clients – Mandantenliste (nutzt: id, name, mandantennummer,
 *                             steuernummer, ustId, ibans[], anschriften[], typischeAbsender[])
 * @param {object} [vorabKennungen] – optional bereits extrahierte Kennungen (spart Doppelarbeit)
 * @returns {{
 *   kennungen: object,
 *   kandidaten: Array<{clientId,name,mandantennummer,score,gruende:string[]}>,
 *   besterTreffer: object|null,
 *   sicherheit: 'hoch'|'mittel'|'niedrig'|'keiner',
 * }}
 */
export function ordneMandantZu(text, clients = [], vorabKennungen = null) {
  const kennungen = vorabKennungen ?? extrahiereKennungen(text)
  const tNorm = normText(text)

  const ibansImText = new Set(kennungen.ibans)
  const ustImText   = new Set(kennungen.ustIds)
  const stImText    = new Set(kennungen.steuernummern.map(normSteuernr))

  const kandidaten = []

  for (const c of clients ?? []) {
    if (!c || c.archiviert) continue
    const gruende = []
    const absenderTreffer = []
    let score = 0
    let harterTreffer = false

    // — IBAN (eindeutig) —
    for (const x of (Array.isArray(c.ibans) ? c.ibans : [])) {
      const iban = normIban(x?.iban)
      if (iban && ibansImText.has(iban)) {
        score += GEWICHT.iban; harterTreffer = true
        gruende.push(`IBAN ${maskiereIban(iban)} stimmt überein`)
      }
    }

    // — USt-IdNr. (eindeutig) —
    const cUst = normUstId(c.ustId)
    if (cUst && ustImText.has(cUst)) {
      score += GEWICHT.ustId; harterTreffer = true
      gruende.push(`USt-IdNr. ${cUst} stimmt überein`)
    }

    // — Steuernummer (eindeutig) —
    const cSt = normSteuernr(c.steuernummer)
    if (cSt && cSt.length >= 10 && stImText.has(cSt)) {
      score += GEWICHT.steuernummer; harterTreffer = true
      gruende.push(`Steuernummer stimmt überein`)
    }

    // — Mandantennummer wörtlich im Text —
    const nr = String(c.mandantennummer ?? '').trim()
    if (nr && nr.length >= 3 && new RegExp(`(^|\\D)${escapeRegExp(nr)}(\\D|$)`).test(text)) {
      score += GEWICHT.mandantennr
      gruende.push(`Mandantennummer ${nr} kommt im Text vor`)
    }

    // — Typischer Absender —
    for (const a of (Array.isArray(c.typischeAbsender) ? c.typischeAbsender : [])) {
      const name = normText(a?.name)
      if (name && name.length >= 3 && tNorm.includes(name)) {
        score += GEWICHT.absender
        gruende.push(`Absender „${a.name}" hinterlegt`)
        absenderTreffer.push(a.name)
      }
    }

    // — Anschrift (Textbaustein, z. B. „Musterstr. 1, 24937 Flensburg") —
    for (const an of (Array.isArray(c.anschriften) ? c.anschriften : [])) {
      const teil = normText(an?.text)
      if (teil && teil.length >= 6 && tNorm.includes(teil)) {
        score += GEWICHT.anschrift
        gruende.push(`Anschrift stimmt überein`)
      }
    }

    // — Mandantenname (voll) —
    const name = normText(c.name)
    if (name && name.length >= 4 && tNorm.includes(name)) {
      score += GEWICHT.name
      gruende.push(`Mandantenname „${c.name}" kommt vor`)
    }

    if (score > 0) {
      kandidaten.push({
        clientId: c.id,
        name: c.name ?? '(ohne Namen)',
        mandantennummer: c.mandantennummer ?? '',
        score,
        harterTreffer,
        gruende,
        absenderTreffer,
      })
    }
  }

  kandidaten.sort((a, b) => b.score - a.score)

  const sicherheit = bewerteSicherheit(kandidaten)
  const besterTreffer = (sicherheit === 'hoch' || sicherheit === 'mittel') ? kandidaten[0] : null

  return { kennungen, kandidaten, besterTreffer, sicherheit }
}

/**
 * Sicherheitsstufe aus der Kandidatenliste:
 *  - 'hoch'    : genau ein Kandidat mit hartem Treffer und klarem Abstand
 *  - 'mittel'  : ein deutlich führender Kandidat (weiche Signale)
 *  - 'niedrig' : Treffer vorhanden, aber mehrdeutig → Auswahl durch den Nutzer
 *  - 'keiner'  : nichts gefunden
 */
function bewerteSicherheit(kandidaten) {
  if (kandidaten.length === 0) return 'keiner'
  const erster = kandidaten[0]
  const zweiter = kandidaten[1]
  const abstand = erster.score - (zweiter?.score ?? 0)

  if (erster.harterTreffer) {
    // Ein harter Treffer ist eindeutig, solange kein zweiter Mandant denselben hat.
    const zweiterHart = zweiter?.harterTreffer
    if (!zweiterHart && abstand >= GEWICHT.steuernummer - 1) return 'hoch'
    return 'niedrig' // zwei Mandanten mit hartem Treffer → widersprüchlich, unbedingt prüfen
  }
  // nur weiche Signale
  if (erster.score >= GEWICHT.mandantennr && abstand >= GEWICHT.anschrift) return 'mittel'
  return 'niedrig'
}

// ───────────────────────────────────────────────────────────────────────────
//  Kleine Helfer
// ───────────────────────────────────────────────────────────────────────────

function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

/** IBAN teilmaskiert für Anzeige/Logs (kein Klartext in Logs, feste Regel 9). */
export function maskiereIban(iban) {
  const n = normIban(iban)
  if (n.length < 8) return n
  return `${n.slice(0, 4)}…${n.slice(-4)}`
}
