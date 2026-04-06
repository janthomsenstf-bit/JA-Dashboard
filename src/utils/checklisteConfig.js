// ── Jahresabschluss-Prüfcheckliste: Block- und Punktkonfiguration ─────────────

export const PUNKT_STATUS = {
  offen:      { label: 'Offen',    icon: '○',  color: '#94a3b8', bg: 'rgba(148,163,184,0.1)'  },
  geprueft:   { label: 'Geprüft',  icon: '🔍', color: '#2563eb', bg: 'rgba(37,99,235,0.1)'    },
  rueckfrage: { label: 'Rückfrage',icon: '❓', color: '#d97706', bg: 'rgba(217,119,6,0.1)'    },
  erledigt:   { label: 'Erledigt', icon: '✓',  color: '#16a34a', bg: 'rgba(22,163,74,0.1)'    },
}

export const RISIKO_CONFIG = {
  niedrig: { label: 'Niedrig', color: '#16a34a', bg: 'rgba(22,163,74,0.1)'   },
  mittel:  { label: 'Mittel',  color: '#d97706', bg: 'rgba(217,119,6,0.1)'   },
  hoch:    { label: 'Hoch',    color: '#dc2626', bg: 'rgba(220,38,38,0.1)'   },
}

export const CHECKLISTE_BLOCKS = [
  {
    id: 'grundlagen', nr: 1, label: 'Grundlagen & Mandatsverständnis', icon: '🏢',
    keineKonten: true, visibleFor: null,
    punkte: [
      { id: 'geschaeftsmodell',      label: 'Geschäftsmodell / was macht das Unternehmen?',   hasRisiko: true  },
      { id: 'vertraege',             label: 'Verträge / Vereinbarungen zu beachten?' },
      { id: 'gesellschaft',          label: 'Gesellschaft / Formalien' },
      { id: 'ergebnisziel',          label: 'Ergebnisziel Mandant' },
      { id: 'bilanzgrundsaetze',     label: 'Bilanzierungsgrundsätze' },
      { id: 'erkenntnisse_stichtag', label: 'Erkenntnisse nach Bilanzstichtag',              hasRisiko: true  },
      { id: 'rechtsbehelfe',         label: 'Laufende Rechtsbehelfe / Betriebsprüfungen',    hasRisiko: true  },
      { id: 'iab_vorjahre',          label: 'Investitionsabzugsbeträge aus Vorjahren',       hasRisiko: true  },
      { id: 'verlustsituation',      label: 'Verlustsituation',                              hasRisiko: true  },
      { id: 'steuerbilanz',          label: 'Steuerbilanz / Einheitsbilanz' },
      { id: 'liebhaberei',           label: 'Liebhaberei',                                   hasRisiko: true  },
      { id: 'scheinselbst',          label: 'Scheinselbstständigkeit',                       hasRisiko: true  },
      { id: 'abfaerbung',            label: 'Abfärbung / Infizierung',                       hasRisiko: true  },
    ],
  },
  {
    id: 'einnahmen', nr: 2, label: 'Betriebseinnahmen', icon: '💰',
    visibleFor: null,
    punkte: [
      { id: 'kleinunternehmer',    label: 'Kleinunternehmerregelung § 19 UStG',                hasKonto: true },
      { id: 'dauerfrist',          label: 'Dauerfristverlängerung',                            hasKonto: true },
      { id: 'veraenderungen',      label: 'Veränderungen / neue / weggefallene Einnahmen',     hasKonto: true, hasRisiko: true },
      { id: 'vorsteueraufteilung', label: 'Auswirkungen auf Vorsteueraufteilung',              hasKonto: true },
      { id: 'steuerfreie',         label: 'Steuerfreie Betriebseinnahmen',                     hasKonto: true },
      { id: 'ermaessigt',          label: 'Ermäßigter Steuersatz',                            hasKonto: true },
      { id: 'para13b_aus',         label: '§ 13b UStG',                                       hasKonto: true },
      { id: 'drittland',           label: 'Nicht steuerbare sonstige Leistungen Drittland',    hasKonto: true },
      { id: 'eu_leistungen',       label: 'Nicht steuerbare sonstige Leistungen EU',           hasKonto: true },
      { id: 'para18b',             label: '§ 18b UStG / ZM',                                  hasKonto: true },
      { id: 'empfaenger_schuldet', label: 'Leistungen, für die Empfänger Steuer schuldet',    hasKonto: true },
      { id: 'anzahlungen',         label: 'Erhaltene Anzahlungen',                            hasKonto: true },
      { id: 'ausgangsrechnungen',  label: 'Ausgangsrechnungen / Pflichtangaben / Nummern',    hasRisiko: true },
      { id: 'privatnutzung',       label: 'Private Nutzung / Entnahmen',                      hasKonto: true },
      { id: 'rueckst_aufloesung',  label: 'Auflösung Rückstellungen',                         hasKonto: true },
      { id: 'veraesserung_av',     label: 'Veräußerung Anlagevermögen',                       hasKonto: true },
    ],
  },
  {
    id: 'plausibilitaet', nr: 3, label: 'Sonstiges / Plausibilitätsprüfungen', icon: '🔎',
    visibleFor: null,
    punkte: [
      { id: 'bank_kasse',      label: 'Bank- und Kassensalden',                          hasKonto: true },
      { id: 'durchlaufend',    label: 'Durchlaufende Posten',                            hasKonto: true },
      { id: 'geldtransit',     label: 'Geldtransit',                                    hasKonto: true },
      { id: 'nachlaesse',      label: 'Nachlässe / Skonti / Zuschüsse',                  hasKonto: true },
      { id: 'richtsatz',       label: 'Verprobung Richtsatzsammlung',                    hasRisiko: true },
      { id: 'corona',          label: 'Corona-Sachverhalte',                             hasKonto: true },
      { id: 'para11',          label: '§ 11 EStG Zufluss / Abfluss',                    hasKonto: true },
      { id: 'plausibilitaet',  label: 'Technische Plausibilität / auffällige Buchungen', hasRisiko: true },
    ],
  },
  {
    id: 'betriebsausgaben', nr: 4, label: 'Betriebsausgaben – Grundlagen / Wareneingang / USt', icon: '📦',
    visibleFor: null,
    punkte: [
      { id: 'ba_pauschalen',   label: 'Betriebsausgabenpauschalen',                             hasKonto: true },
      { id: 'wareneingang',    label: 'Wareneingang allgemein',                                 hasKonto: true, hasRisiko: true },
      { id: 'vorsteuer',       label: 'Vorsteuerprüfung / Vorsteueraufteilung',                 hasKonto: true, hasRisiko: true },
      { id: 'aktivierung',     label: 'Aktivierung statt Aufwand',                             hasKonto: true, hasRisiko: true },
      { id: 'gwg',             label: 'GWG-Thematik',                                          hasKonto: true },
      { id: 'ig_erwerb',       label: 'Innergemeinschaftlicher Erwerb',                        hasKonto: true },
      { id: 'para13b_ein',     label: 'Leistungsempfänger als Steuerschuldner (§ 13b Eingang)', hasKonto: true },
      { id: 'einfuhr',         label: 'Einfuhr von Waren',                                     hasKonto: true },
    ],
  },
  {
    id: 'anlagevermogen', nr: 5, label: 'Anlagevermögen & Abschreibungen', icon: '🏗️',
    visibleFor: null,
    punkte: [
      { id: 'anlagenverzeichnis', label: 'Abgleich Anlagenverzeichnis / Buchhaltung',  hasKonto: true, hasRisiko: true },
      { id: 'zugaenge_abgaenge',  label: 'Zugänge / Abgänge',                          hasKonto: true },
      { id: 'afa_grundstuecke',   label: 'AfA Grundstücke / grundstücksgleiche Rechte', hasKonto: true },
      { id: 'afa_immateriell',    label: 'AfA immaterielle Wirtschaftsgüter',           hasKonto: true },
      { id: 'afa_beweglich',      label: 'AfA bewegliche Wirtschaftsgüter',             hasKonto: true },
      { id: 'sonder_afa',         label: 'Sonderabschreibungen § 7b / § 7g',            hasKonto: true },
      { id: 'herabsetzung',       label: 'Herabsetzung § 7g',                           hasKonto: true },
      { id: 'gwg_av',             label: 'GWG',                                         hasKonto: true },
      { id: 'sammelposten',       label: 'Sammelposten',                                hasKonto: true },
      { id: 'restbuchwerte',      label: 'Restbuchwerte ausgeschiedener Anlagegüter',   hasKonto: true },
      { id: 'nutzungsaenderung',  label: 'Nutzungsänderungen',                          hasRisiko: true },
      { id: 'ak_hk',              label: 'AK/HK-Ermittlung',                            hasKonto: true },
      { id: 'para6b',             label: '§ 6b / R 6.6',                               hasKonto: true },
      { id: 'afa_wahlrechte',     label: 'Abschreibungswahlrechte',                     hasKonto: true },
      { id: 'ausserplanmaessig',  label: 'Außerplanmäßige Abschreibungen',              hasKonto: true, hasRisiko: true },
      { id: 'gebaeude_av',        label: 'Gebäude im Anlagevermögen',                   hasKonto: true },
      { id: 'iab_vorjahre_av',    label: 'IAB aus Vorjahren',                           hasKonto: true },
      { id: 'neue_iab',           label: 'Neue IAB',                                   hasKonto: true },
      { id: 'iab_rueckgaengig',   label: 'IAB rückgängig machen',                      hasKonto: true, hasRisiko: true },
    ],
  },
  {
    id: 'lohn', nr: 6, label: 'Lohn & Gehalt', icon: '👥',
    visibleFor: null, hasVerbindlichkeitenTool: true,
    punkte: [
      { id: 'lohnverprobung',       label: 'Lohnverprobung / 12 Monate erfasst?',          hasKonto: true, hasRisiko: true },
      { id: 'fahrzeuge_mitarb',     label: 'Fahrzeuge an Mitarbeiter',                     hasKonto: true },
      { id: 'sachbezuege',          label: 'Sachbezüge',                                   hasKonto: true },
      { id: 'gutscheine',           label: 'Gutscheine / 50-Euro-Grenze',                  hasKonto: true },
      { id: 'betriebsveranst',      label: 'Betriebsveranstaltungen',                      hasKonto: true },
      { id: 'steuerfreier_lohn',    label: 'Steuerfreier Arbeitslohn § 3 EStG',            hasKonto: true },
      { id: 'aufmerksamkeiten',     label: 'Aufmerksamkeiten nach R 19.6 LStR',            hasKonto: true },
      { id: 'vj_vergleich_lohn',    label: 'Vorjahresvergleich Lohnaufwand',               hasRisiko: true },
    ],
  },
  {
    id: 'unbeschraenkt', nr: 7, label: 'Unbeschränkt abziehbare Betriebsausgaben', icon: '🧾',
    visibleFor: null,
    punkte: [
      { id: 'telekommunikation',  label: 'Telekommunikation',                                 hasKonto: true },
      { id: 'uebernachtung',      label: 'Übernachtung / Reisenebenkosten',                   hasKonto: true },
      { id: 'fortbildung',        label: 'Fortbildung',                                       hasKonto: true },
      { id: 'rechts_steuer',      label: 'Rechts- und Steuerberatung / Buchführung',          hasKonto: true },
      { id: 'miete_leasing',      label: 'Miete / Leasing bewegliche Wirtschaftsgüter',      hasKonto: true },
      { id: 'erhaltungsaufwand',  label: 'Erhaltungsaufwand',                                hasKonto: true, hasRisiko: true },
      { id: 'beitraege',          label: 'Beiträge / Gebühren / Versicherungen',             hasKonto: true },
      { id: 'edv_kosten',         label: 'Laufende EDV-Kosten',                             hasKonto: true },
      { id: 'arbeitsmittel',      label: 'Arbeitsmittel',                                    hasKonto: true },
      { id: 'entsorgung',         label: 'Abfallbeseitigung / Entsorgung',                   hasKonto: true },
      { id: 'verpackung',         label: 'Verpackung / Transport',                           hasKonto: true },
      { id: 'werbung',            label: 'Werbung',                                          hasKonto: true },
      { id: 'schuldzinsen_ahk',   label: 'Schuldzinsen AHK-Finanzierung',                   hasKonto: true },
      { id: 'schuldzinsen_ueb',   label: 'Übrige Schuldzinsen',                             hasKonto: true, hasRisiko: true },
      { id: 'vorsteuer_ba',       label: 'Vorsteuerbeträge',                                hasKonto: true },
      { id: 'gezahlte_ust',       label: 'Gezahlte USt / § 11 EStG',                       hasKonto: true },
      { id: 'ruecklagen',         label: 'Rücklagen / stille Reserven / Ausgleichsposten',  hasKonto: true },
      { id: 'uebrige_ba',         label: 'Übrige unbeschränkt abziehbare Betriebsausgaben', hasKonto: true },
    ],
  },
  {
    id: 'fahrzeugkosten', nr: 8, label: 'Fahrzeugkosten', icon: '🚗',
    visibleFor: null, hasFahrzeugeTool: true,
    punkte: [
      { id: 'vers_kfz',       label: 'Versicherungen',               hasKonto: true },
      { id: 'kfz_steuern',    label: 'Kfz-Steuern',                 hasKonto: true },
      { id: 'leasing_kfz',    label: 'Leasingkosten',               hasKonto: true },
      { id: 'lfd_betrieb',    label: 'Laufende Betriebskosten',      hasKonto: true },
      { id: 'reparaturen',    label: 'Reparaturen',                  hasKonto: true },
      { id: 'fremdfahrzeuge', label: 'Fremdfahrzeugkosten',          hasKonto: true },
      { id: 'privat_kfz',     label: 'Privatnutzung / Nutzungsentnahme', hasKonto: true, hasRisiko: true },
    ],
  },
  {
    id: 'beschraenkt', nr: 9, label: 'Beschränkt abziehbare / nicht abziehbare Betriebsausgaben', icon: '⚠️',
    visibleFor: null, hasBewirtungTool: true,
    punkte: [
      { id: 'geschenke',        label: 'Geschenke',                                        hasKonto: true, hasRisiko: true },
      { id: 'bewirtung',        label: 'Bewirtungsaufwendungen',                           hasKonto: true, hasRisiko: true },
      { id: 'verpflegung',      label: 'Verpflegungsmehraufwendungen',                    hasKonto: true },
      { id: 'arbeitszimmer',    label: 'Häusliches Arbeitszimmer',                        hasKonto: true },
      { id: 'tagespauschale',   label: 'Tagespauschale häusliche Wohnung',                hasKonto: true },
      { id: 'beschr_weitere',   label: 'Weitere beschränkt abziehbare Aufwendungen',      hasKonto: true },
      { id: 'privat_veranlasst',label: 'Privat veranlasste Aufwendungen',                  hasKonto: true, hasRisiko: true },
      { id: 'nicht_abziehbar',  label: 'Sonstige nicht abziehbare Betriebsausgaben',      hasKonto: true },
      { id: 'sonstiger_bedarf', label: 'Sonstiger Betriebsbedarf / sonstiger betriebl. Aufwand', hasKonto: true },
    ],
  },
  {
    id: 'einlagen', nr: 10, label: 'Einlagen & Sonderthemen', icon: '🔄',
    visibleFor: null,
    punkte: [
      { id: 'privateinlagen',   label: 'Privateinlagen',                            hasKonto: true },
      { id: 'nutzungseinlagen', label: 'Nutzungseinlagen',                          hasKonto: true },
      { id: 'privat_fahrzeug',  label: 'Privates Fahrzeug betrieblich genutzt',     hasKonto: true },
      { id: 'wallbox',          label: 'Wallbox / Stromkosten zu Hause / Elektrofahrzeug', hasKonto: true },
      { id: 'sonder_einlagen',  label: 'Besondere Sachverhalte / atypische Fälle',  hasKonto: true, hasRisiko: true },
    ],
  },
  {
    id: 'aktiva', nr: 11, label: 'Aktiva', icon: '📈',
    visibleFor: 'bilanz', hasPwbTool: true, hasRapAktivTool: true, hasFremdwaehrungTool: true,
    punkte: [
      { id: 'forderungen_lul',  label: 'Forderungen aus LuL',                hasKonto: true, hasRisiko: true },
      { id: 'opos_pruefung',    label: 'OPOS-Prüfung',                       hasKonto: true },
      { id: 'ausgleich_fj',     label: 'Ausgleich im Folgejahr',             hasKonto: true },
      { id: 'ewb',              label: 'Einzelwertberichtigungen',            hasKonto: true, hasRisiko: true },
      { id: 'pwb',              label: 'Pauschalwertberichtigungen',          hasKonto: true },
      { id: 'fremdwaehrung',    label: 'Fremdwährungsforderungen',            hasKonto: true, hasRisiko: true },
      { id: 'ford_gesellsch',   label: 'Forderungen gegen Gesellschafter',   hasKonto: true, hasRisiko: true },
      { id: 'vorraete',         label: 'Vorräte / Inventur',                 hasKonto: true, hasRisiko: true },
      { id: 'unfertige',        label: 'Unfertige Leistungen',               hasKonto: true },
      { id: 'sonstige_va',      label: 'Sonstige Vermögensgegenstände',      hasKonto: true },
      { id: 'arap',             label: 'Aktive Rechnungsabgrenzungsposten',  hasKonto: true },
    ],
  },
  {
    id: 'passiva', nr: 12, label: 'Passiva', icon: '📉',
    visibleFor: 'bilanz', hasDarlehenTool: true, hasRapPassivTool: true,
    punkte: [
      { id: 'eigenkapital',       label: 'Eigenkapital',                             hasKonto: true, hasRisiko: true },
      { id: 'verbindl_lul',       label: 'Verbindlichkeiten aus LuL',                hasKonto: true },
      { id: 'opos_verbindl',      label: 'OPOS-Verbindlichkeiten',                  hasKonto: true },
      { id: 'ausgleich_fj_p',     label: 'Ausgleich Folgejahr',                     hasKonto: true },
      { id: 'darlehen',           label: 'Darlehen',                                hasKonto: true, hasRisiko: true },
      { id: 'verbindl_gesellsch', label: 'Verbindlichkeiten ggü. Gesellschaftern',  hasKonto: true, hasRisiko: true },
      { id: 'prap',               label: 'Passive Rechnungsabgrenzung',             hasKonto: true },
    ],
  },
  {
    id: 'kapges', nr: 13, label: 'Kapitalgesellschaften', icon: '🏦',
    visibleFor: 'kapges', hasGesellschafterTool: true, hasZinsrechnerTool: true, hasUgRuecklageTool: true,
    punkte: [
      { id: 'gesellschafterstruktur', label: 'Gesellschafterstruktur',               hasRisiko: true },
      { id: 'beteiligungsquote',      label: 'Beteiligungsquote' },
      { id: 'funktion',               label: 'Funktion im Unternehmen' },
      { id: 'naeheverhaeltnisse',     label: 'Näheverhältnisse / Verwandtschaft',    hasRisiko: true },
      { id: 'betriebsaufspaltung',    label: 'Betriebsaufspaltung',                  hasRisiko: true },
      { id: 'vga_risiken',            label: 'vGA-Risiken',                          hasRisiko: true },
      { id: 'vertraege_gesellsch',    label: 'Verträge mit Gesellschaftern',          hasRisiko: true },
      { id: 'ford_kg',                label: 'Forderungen ggü. Gesellschaftern',     hasKonto: true, hasRisiko: true },
      { id: 'verbindl_kg',            label: 'Verbindlichkeiten ggü. Gesellschaftern', hasKonto: true },
      { id: 'tantiemen',              label: 'Tantiemen',                            hasKonto: true },
      { id: 'dreizehntes_gehalt',     label: '13. Gehalt',                           hasKonto: true },
      { id: 'beschluesse',            label: 'Beschlüsse / Vereinbarungen',           hasRisiko: true },
    ],
  },
  {
    id: 'ust', nr: 14, label: 'Umsatzsteuer', icon: '💱',
    visibleFor: null, hasUstTool: true,
    punkte: [
      { id: 'ust_abstimmung',    label: 'USt-Abstimmung Buchhaltung / Finanzamt', hasKonto: true, hasRisiko: true },
      { id: 'ust_voranmeldungen',label: 'Alle Voranmeldungen eingereicht?',        hasRisiko: true },
      { id: 'para13b_ust',       label: '§ 13b Prüfung',                          hasKonto: true },
      { id: 'vorsteuer_ust',     label: 'Vorsteuer abgestimmt?',                  hasKonto: true },
    ],
  },
  {
    id: 'gewst', nr: 15, label: 'Gewerbesteuer', icon: '🏭',
    visibleFor: 'gewst', hasGewstTool: true,
    punkte: [
      { id: 'gewst_pruefung',      label: 'Gewerbesteuer-Rückstellung geprüft?',  hasKonto: true, hasRisiko: true },
      { id: 'hinzurechnungen',     label: 'Hinzurechnungen / Kürzungen',           hasKonto: true },
    ],
  },
  {
    id: 'kst', nr: 16, label: 'Körperschaftsteuer', icon: '🏛️',
    visibleFor: 'kapges', hasKstTool: true,
    punkte: [
      { id: 'kst_pruefung',        label: 'Körperschaftsteuer-Rückstellung geprüft?', hasKonto: true, hasRisiko: true },
      { id: 'soli',                label: 'Solidaritätszuschlag',                    hasKonto: true },
      { id: 'kest',                label: 'Kapitalertragsteuer',                     hasKonto: true },
    ],
  },
]

// Leeres Checklisten-Datenobjekt
export function defaultCheckliste() {
  return {
    punkte:           {},
    rueckfragen:      [],
    fahrzeuge:        [],
    darlehen:         [],
    gesellschafter:   [],
    verbindlichkeiten: {
      lohn:           { betrag: '', zahlung: '', notiz: '', behandlung: '' },
      soziales:       { betrag: '', zahlung: '', notiz: '', behandlung: '' },
      lohnsteuer:     { betrag: '', zahlung: '', notiz: '', behandlung: '' },
      altvorsorge:    { betrag: '', zahlung: '', notiz: '', behandlung: '' },
      vermoegensbild: { betrag: '', zahlung: '', notiz: '', behandlung: '' },
    },
    ust:             { sollIst: 'soll', eurBilanz: 'bilanz', dauerfrist: false, ustBuch: '', ustFA: '', zahllastDez: '', zahlungsdatum: '' },
    gewst:           { bescheid: '', buch: '', ursache: '', behandlung: '', offene: '', zahlungsdatum: '' },
    kst:             { bescheid: '', buch: '', ursache: '', behandlung: '', offene: '', zahlungsdatum: '', soli: false, kest: false },
    pwb:             { forderungen: '', zweifelh: '', ausfallquote: '1' },
    rapAktiv:        { betrag: '', monate: '', monateFolgejahr: '' },
    rapPassiv:       { betrag: '', monate: '', monateFolgejahr: '' },
    fremdwaehrung:   { betrag: '', altKurs: '', stichtagKurs: '' },
    bewirtung:       { gesamt: '', personen: '', mitarbeiter: '', partner: '' },
    zinsrechner:     { forderung: '', zinssatz: '' },
    ugRuecklage:     { jahresueberschuss: '', verlustvortrag: '' },
  }
}

// Blockfilter: soll Block für diesen Mandanten sichtbar sein?
export function blockSichtbar(block, client) {
  if (!block.visibleFor) return true
  const rf = client.rechtsform ?? ''
  const gm = client.gewinnermittlung ?? ''
  if (block.visibleFor === 'bilanz')  return ['Bilanz', 'bilanz'].includes(gm)
  if (block.visibleFor === 'kapges')  return ['GmbH', 'AG', 'GmbH & Co. KG', 'UG'].some(f => rf.includes(f))
  if (block.visibleFor === 'gewst')   return !['Freiberufler'].includes(rf)
  return true
}
