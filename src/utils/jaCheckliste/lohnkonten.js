/* lohnkonten.js – Kontenlandkarte für die Lohnverprobung.
 *
 * Quelle: DATEV Dok. 5301558 (Lohnabrechnung – Konten), ergänzt um 5301525
 * (Löhne, Gehälter), 5301563 (Lohnsteuer), 5301755 (Sozialversicherung),
 * 5360651 (Verbindlichkeiten aus Lohn und Gehalt).
 *
 * Getrennt von der Logik, weil Kontenrahmen mandantenabhängig abweichen können
 * und die Liste wächst. Zwei Dinge stehen hier:
 *   1. GRUPPEN – die namentlich bekannten Konten, für die Beschriftung
 *   2. BEREICHE – Kontenbereiche für die Zuordnung beim SuSa-Import. Sie fangen
 *      auch Konten, die in den Dokumenten nicht einzeln aufgeführt sind
 *      (z. B. 4138 Berufsgenossenschaft), damit nichts durchfällt.
 */

// Die beiden Blöcke des Moduls.
export const LOHN_LISTEN = [
  { key: 'aufwand', label: 'Lohnaufwand' },
  { key: 'verbfor', label: 'Forderungen und Verbindlichkeiten' },
]

export const LOHN_GRUPPEN = [
  { key: 'loehne', liste: 'aufwand', label: 'Löhne und Gehälter', konten: {
    '03': { 4100: 'Löhne und Gehälter', 4110: 'Löhne', 4120: 'Gehälter',
      4124: 'Geschäftsführergehälter GmbH-Gesellschafter', 4125: 'Ehegattengehalt',
      4126: 'Tantiemen Gesellschafter-Geschäftsführer', 4127: 'Geschäftsführergehälter',
      4128: 'Vergütungen angestellte Mitunternehmer § 15 EStG', 4129: 'Tantiemen Arbeitnehmer',
      4175: 'Fahrtkostenerstattung Wohnung/Arbeitsstätte', 4180: 'Bedienungsgelder',
      4190: 'Aushilfslöhne', 4195: 'Löhne für Minijobs' },
    '04': { 6000: 'Löhne und Gehälter', 6010: 'Löhne', 6020: 'Gehälter',
      6024: 'Geschäftsführergehälter GmbH-Gesellschafter', 6050: 'Ehegattengehalt',
      6026: 'Tantiemen Gesellschafter-Geschäftsführer', 6027: 'Geschäftsführergehälter',
      6028: 'Vergütungen angestellte Mitunternehmer § 15 EStG', 6029: 'Tantiemen Arbeitnehmer',
      6090: 'Fahrtkostenerstattung Wohnung/Arbeitsstätte', 6045: 'Bedienungsgelder',
      6030: 'Aushilfslöhne', 6035: 'Löhne für Minijobs' } } },

  { key: 'freiwillig', liste: 'aufwand', label: 'Freiwillige Leistungen und Sachzuwendungen', konten: {
    '03': { 4145: 'Freiwillige soziale Aufwendungen, lohnsteuerpflichtig',
      4146: 'Freiwillige Zuwendungen an Minijobber', 4147: 'Freiwillige Zuwendungen an Gesellschafter-GF',
      4148: 'Freiwillige Zuwendungen angestellte Mitunternehmer', 4150: 'Krankengeldzuschüsse',
      4151: 'Sachzuwendungen an Minijobber', 4152: 'Sachzuwendungen an Arbeitnehmer',
      4153: 'Sachzuwendungen an Gesellschafter-GF', 4154: 'Sachzuwendungen angestellte Mitunternehmer',
      4155: 'Zuschüsse der Agenturen für Arbeit (Haben)' },
    '04': { 6060: 'Freiwillige soziale Aufwendungen, lohnsteuerpflichtig',
      6066: 'Freiwillige Zuwendungen an Minijobber', 6067: 'Freiwillige Zuwendungen an Gesellschafter-GF',
      6068: 'Freiwillige Zuwendungen angestellte Mitunternehmer', 6070: 'Krankengeldzuschüsse',
      6071: 'Sachzuwendungen an Minijobber', 6072: 'Sachzuwendungen an Arbeitnehmer',
      6073: 'Sachzuwendungen an Gesellschafter-GF', 6045: 'Sachzuwendungen angestellte Mitunternehmer',
      6075: 'Zuschüsse der Agenturen für Arbeit (Haben)' } } },

  { key: 'sozial', liste: 'aufwand', label: 'Soziale Abgaben', konten: {
    '03': { 4130: 'Gesetzliche soziale Aufwendungen', 4137: 'Gesetzliche soziale Aufwendungen Mitunternehmer',
      4140: 'Freiwillige soziale Aufwendungen, lohnsteuerfrei', 4141: 'Sonstige soziale Abgaben',
      4144: 'Soziale Abgaben für Minijobber' },
    '04': { 6110: 'Gesetzliche soziale Aufwendungen', 6118: 'Gesetzliche soziale Aufwendungen Mitunternehmer',
      6130: 'Freiwillige soziale Aufwendungen, lohnsteuerfrei', 6170: 'Sonstige soziale Abgaben',
      6171: 'Soziale Abgaben für Minijobber' } } },

  { key: 'pauschal', liste: 'aufwand', label: 'Pauschale Lohnsteuer', konten: {
    '03': { 4149: 'Pauschale Steuer sonstige Bezüge (Fahrtkostenzuschüsse)',
      4167: 'Pauschale Steuer sonstige Bezüge (Direktversicherungen)', 4194: 'Pauschale Steuer für Minijobber',
      4196: 'Pauschale Steuer für Gesellschafter-GF', 4197: 'Pauschale Steuer angestellte Mitunternehmer',
      4198: 'Pauschale Steuer für Arbeitnehmer', 4199: 'Pauschale Steuer für Aushilfen' },
    '04': { 6069: 'Pauschale Steuer sonstige Bezüge (Fahrtkostenzuschüsse)',
      6147: 'Pauschale Steuer sonstige Bezüge (Direktversicherungen)', 6036: 'Pauschale Steuer für Minijobber',
      6037: 'Pauschale Steuer für Gesellschafter-GF', 6038: 'Pauschale Steuer angestellte Mitunternehmer',
      6039: 'Pauschale Steuer für Arbeitnehmer', 6040: 'Pauschale Steuer für Aushilfen' } } },

  { key: 'bav', liste: 'aufwand', label: 'Betriebliche Altersversorgung und VWL', konten: {
    '03': { 4160: 'Versorgungskassen', 4165: 'Aufwendungen für Altersversorgung',
      4166: 'Altersversorgung Gesellschafter-GF', 4168: 'Altersversorgung Mitunternehmer',
      4169: 'Aufwendungen für Unterstützung', 4170: 'Vermögenswirksame Leistungen' },
    '04': { 6150: 'Versorgungskassen', 6140: 'Aufwendungen für Altersversorgung',
      6149: 'Altersversorgung Gesellschafter-GF', 6148: 'Altersversorgung Mitunternehmer',
      6160: 'Aufwendungen für Unterstützung', 6080: 'Vermögenswirksame Leistungen' } } },

  { key: 'forderung', liste: 'verbfor', label: 'Forderungen', konten: {
    '03': { 1520: 'Forderungen gegen Krankenkassen (AAG)', 1530: 'Forderungen gegen Personal',
      1531: 'Forderungen gegen Personal – RLZ bis 1 Jahr', 1537: 'Forderungen gegen Personal – RLZ über 1 Jahr',
      1544: 'Forderung gegen Bundesagentur für Arbeit' },
    '04': { 1369: 'Forderungen gegen Krankenkassen (AAG)', 1340: 'Forderungen gegen Personal',
      1341: 'Forderungen gegen Personal – RLZ bis 1 Jahr', 1345: 'Forderungen gegen Personal – RLZ über 1 Jahr',
      1457: 'Forderung gegen Bundesagentur für Arbeit' } } },

  { key: 'verb', liste: 'verbfor', label: 'Verbindlichkeiten', konten: {
    '03': { 1740: 'Verbindlichkeiten aus Lohn und Gehalt', 1741: 'Verbindlichkeiten aus Lohn- und Kirchensteuer',
      1742: 'Verbindlichkeiten soziale Sicherheit', 1743: 'Verb. soziale Sicherheit – RLZ bis 1 Jahr',
      1744: 'Verb. soziale Sicherheit – RLZ 1 bis 5 Jahre', 1745: 'Verb. soziale Sicherheit – RLZ über 5 Jahre',
      1748: 'Verbindlichkeiten für Einbehaltungen von Arbeitnehmern', 1750: 'Verbindlichkeiten aus Vermögensbildung',
      1751: 'Verb. Vermögensbildung – RLZ bis 1 Jahr', 1752: 'Verb. Vermögensbildung – RLZ 1 bis 5 Jahre',
      1753: 'Verb. Vermögensbildung – RLZ über 5 Jahre', 1755: 'Lohn- und Gehaltsverrechnungskonto',
      1756: 'Lohn-/Gehaltsverrechnung § 11 Abs. 2 S. 2 EStG (§ 4/3)',
      1759: 'Voraussichtliche Beitragsschuld Sozialversicherung',
      1795: 'Verbindlichkeiten soziale Sicherheit (§ 4/3)' },
    '04': { 3720: 'Verbindlichkeiten aus Lohn und Gehalt', 3730: 'Verbindlichkeiten aus Lohn- und Kirchensteuer',
      3740: 'Verbindlichkeiten soziale Sicherheit', 3741: 'Verb. soziale Sicherheit – RLZ bis 1 Jahr',
      3750: 'Verb. soziale Sicherheit – RLZ 1 bis 5 Jahre', 3755: 'Verb. soziale Sicherheit – RLZ über 5 Jahre',
      3725: 'Verbindlichkeiten für Einbehaltungen von Arbeitnehmern', 3770: 'Verbindlichkeiten aus Vermögensbildung',
      3771: 'Verb. Vermögensbildung – RLZ bis 1 Jahr', 3780: 'Verb. Vermögensbildung – RLZ 1 bis 5 Jahre',
      3785: 'Verb. Vermögensbildung – RLZ über 5 Jahre', 3790: 'Lohn- und Gehaltsverrechnungskonto',
      3791: 'Lohn-/Gehaltsverrechnung § 11 Abs. 2 S. 2 EStG (§ 4/3)',
      3759: 'Voraussichtliche Beitragsschuld Sozialversicherung',
      3796: 'Verbindlichkeiten soziale Sicherheit (§ 4/3)' } } },
]

/* Kontenbereiche für den SuSa-Import. Absichtlich weiter gefasst als die
   namentliche Liste, damit auch nicht einzeln dokumentierte Konten im richtigen
   Block landen (4138 Berufsgenossenschaft, 4165er-Varianten und Ähnliches). */
export const LOHN_BEREICHE = {
  '03': {
    aufwand: [[4100, 4199]],
    // Nur die im Dokument genannten Konten. Frueher standen hier weite Bereiche
    // (1530-1537, 1740-1759); dadurch waeren auch Kautionen oder eine Forderung
    // aus Gewerbesteuerueberzahlung im Lohnblock gelandet.
    verbfor: [[1520, 1520], [1530, 1531], [1537, 1537], [1544, 1544],
              [1740, 1745], [1748, 1748], [1750, 1753], [1755, 1756], [1759, 1759], [1795, 1795]],
  },
  '04': {
    aufwand: [[6000, 6199]],
    verbfor: [[1340, 1341], [1345, 1345], [1369, 1369], [1457, 1457],
              [3720, 3720], [3725, 3725], [3730, 3730], [3740, 3741], [3750, 3750], [3755, 3755],
              [3759, 3759], [3770, 3771], [3780, 3780], [3785, 3785], [3790, 3791], [3796, 3796]],
  },
}

/* Einzelne Leitkonten, an denen das Modul konkrete Prüfungen festmacht. */
export const LOHN_LEIT = {
  '03': { verrechnung: '1755', verbLohn: '1740', verbLst: '1741', verbSv: '1742',
    einbehalt: '1748', vwl: '1750', fordPersonal: '1530', vorausSv: '1759',
    par11: '1756', par11Sv: '1795', sachbezug: ['8590', '8591', '8595', '8610', '8611', '8613', '8614'] },
  '04': { verrechnung: '3790', verbLohn: '3720', verbLst: '3730', verbSv: '3740',
    einbehalt: '3725', vwl: '3770', fordPersonal: '1340', vorausSv: '3759',
    par11: '3791', par11Sv: '3796', sachbezug: ['4940', '4941', '4945', '4946', '4947', '4948', '4949'] },
}

const nr = k => parseInt(String(k ?? '').trim(), 10)

/** In welchen Block gehört das Konto? 'aufwand' | 'verbfor' | null */
export function lohnZielListe(konto, skr) {
  const n = nr(konto); if (!isFinite(n)) return null
  const b = LOHN_BEREICHE[skr === '04' ? '04' : '03']
  for (const [liste, bereiche] of Object.entries(b))
    if (bereiche.some(([von, bis]) => n >= von && n <= bis)) return liste
  return null
}

/** Gruppenbezeichnung und Kontenname, soweit namentlich bekannt. */
export function lohnGruppe(konto, skr) {
  const n = nr(konto); const s = skr === '04' ? '04' : '03'
  for (const g of LOHN_GRUPPEN) { const t = g.konten[s]; if (t && t[n]) return { gruppe: g.label, key: g.key, bez: t[n], liste: g.liste } }
  const liste = lohnZielListe(konto, s)
  return liste ? { gruppe: liste === 'aufwand' ? 'Weitere Personalaufwendungen' : 'Weitere Lohnkonten', key: 'sonstige', bez: '', liste } : null
}
