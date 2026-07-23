// =============================================================
// MOCK-DATEN für Dashboard Testing
// Später durch echte Prisma-Queries ersetzen
// =============================================================

// ─── NETZWERKKONTAKTE ────────────────────────────────────────

export interface MockKontaktHistorie {
  id: string;
  typ: string;
  datum: string;
  notiz: string;
  ergebnis?: string;
  naechsteAktion?: string;
  naechsteAktionAm?: string;
  erledigt: boolean;
  eingetragenVon?: string;
}

export interface MockEmpfehlung {
  id: string;
  empfohleneName: string;
  datum: string;
  kontext?: string;
  status: string;
  ergebnis?: string;
  erfolgreich: boolean;
}

export interface MockNetzwerkkontakt {
  id: string;
  name: string;
  organisation?: string;
  position?: string;
  kategorie: string;
  land: string;
  region?: string;
  branche?: string;
  email?: string;
  telefon?: string;
  linkedin?: string;
  website?: string;
  quelle?: string;
  erstkontakt: string;
  letzterKontakt: string;
  aktivitaetsStatus: string;
  interneNotiz?: string;
  netzwerkWert: number;
  empfehlungen: MockEmpfehlung[];
  historie: MockKontaktHistorie[];
}

export const MOCK_NETZWERKKONTAKTE: MockNetzwerkkontakt[] = [];

// ─── SUCCESS STORIES ─────────────────────────────────────────

export interface MockSuccessStory {
  id: string;
  titel: string;
  kurzbeschreibung: string;
  freigabe: 'intern' | 'anonymisiert' | 'freigegeben';
  anonymisiert: boolean;
  // Narrative Felder
  ausgangssituation: string;
  herausforderung?: string;
  gesuch: string;
  vermittlungsweg: string;
  ergebnis: string;
  erkenntnisse?: string;
  // Anon-Versionen
  titelAnon?: string;
  ergebnisAnon?: string;
  // KI-Content
  kiHomepage?: string;
  kiLinkedIn?: string;
  kiNewsletter?: string;
  // Kategorisierung
  branche: string;
  land: string;
  entstehungsweg: string;
  ergebnisTypen: string[];
  // Firmen
  firma1Name: string;
  firma2Name: string;
  // Verknüpfung
  anfrageId?: string;
  eventId?: string;
  createdAt: string;
}

export const MOCK_SUCCESS_STORIES: MockSuccessStory[] = [];

// ─── UNTERNEHMEN ─────────────────────────────────────────────

export interface MockUnternehmen {
  id: string;
  firmenname: string;
  anfrageId?: string;          // Link zur Ursprungs-Anfrage
  land: 'deutschland' | 'daenemark' | 'andere';
  standort: string;
  website?: string;
  linkedin?: string;
  branche: string;
  groesse: string;
  ansprechpartner: string;
  email: string;
  telefon?: string;
  sprachen: string[];
  kurzbeschreibung: string;
  // Kultur & Zusammenarbeit
  kulturprofil?: string;
  arbeitsweise?: string;
  kommunikationsstil?: string;
  bevorzugteSprache?: string;
  funFactStandard?: string;
  persoenlicheNotiz?: string;
  // Glaubwürdigkeits-Faktoren (jetzt Klärungspunkte im Bereich „Glaubwürdigkeit")
  persoenlichesGespraech: boolean;
  websiteGeprueft: boolean;
  linkedinGeprueft: boolean;
  empfehlungVorhanden: boolean;
  // Netzwerk
  netzwerkStatus: string;
  erstkontakt: string;
  letzteAktivitaet: string;
  interneNotiz?: string;
  anfrageCount: number;
  interessentCount: number;
  successStories: number;
  events: MockEvent[];
  // Klärungs-Bestätigungen (Operator hat Klärungspunkt manuell bestätigt)
  klaerungsBestaetigungen?: Record<string, { notiz?: string; bestaetigtVon: string; bestaetigtAm: string }>;
}

export interface MockEvent {
  eventName: string;
  eventDatum: string;
  format: string;
  rolle: string;
}

export const MOCK_UNTERNEHMEN: MockUnternehmen[] = [
  {
    id: 'unt-nordhavn',
    firmenname: 'Nordhavn Foods A/S',
    land: 'daenemark',
    standort: 'Aalborg, Dänemark',
    website: 'https://www.nordhavn-foods.dk',
    linkedin: 'nordhavn-foods',
    branche: 'Lebensmittel',
    groesse: 'mittel',
    ansprechpartner: 'Lars Jensen',
    email: 'l.jensen@nordhavn-foods.dk',
    telefon: '+45 70 12 34 56',
    sprachen: ['daenisch', 'englisch'],
    kurzbeschreibung: 'Dänischer Lebensmittelhersteller mit Schwerpunkt auf hochwertigen Fischprodukten und ausgewählten Backwarenspezialitäten. Etabliert in Dänemark, jetzt mit Fokus auf den deutschen Markt.',
    kulturprofil: 'Dänischer Mittelstand mit Familientradition. Direkt, partnerschaftlich, langfristig orientiert.',
    arbeitsweise: 'Pragmatisch, mit hoher Qualitätsorientierung. Entscheidungen werden zügig, aber nach Rücksprache getroffen.',
    kommunikationsstil: 'direkt',
    bevorzugteSprache: 'daenisch',
    funFactStandard: 'Wir feiern erfolgreiche Partnerschaften gerne mit dänischem Smørrebrød und einer Tasse echtem Kaffee.',
    persoenlicheNotiz: 'Lars Jensen ist seit 8 Jahren bei Nordhavn — kennt Produktion und Markt sehr gut.',
    persoenlichesGespraech: true,
    websiteGeprueft: true,
    linkedinGeprueft: true,
    empfehlungVorhanden: true,
    netzwerkStatus: 'aktiv',
    erstkontakt: '2026-05-12',
    letzteAktivitaet: '2026-06-04',
    interneNotiz: 'Sehr seriöser Partner. Klare Vorstellungen, gute Vorbereitung. Bereits Produktunterlagen vorhanden, deutsche Preislisten in Vorbereitung.',
    anfrageCount: 1,
    interessentCount: 0,
    successStories: 0,
    events: [],
    klaerungsBestaetigungen: {
      'unt-erstkont': { notiz: 'Erstkontakt am 12.05.2026 per E-Mail', bestaetigtVon: 'Operator', bestaetigtAm: '2026-05-15' },
    },
  },
];

// ─── MARKTPLATZ ──────────────────────────────────────────────

export type MarktplatzStatus =
  | 'intern'
  | 'entwurf'
  | 'zur_pruefung'
  | 'veroeffentlicht'
  | 'pausiert'
  | 'abgelaufen'
  | 'archiviert';

export interface MarktplatzEintrag {
  titel: string;
  kurzbeschreibung: string;
  branche: string;
  richtung: 'de_dk' | 'dk_de';
  region: string;
  wasSuche: string;
  warumGesucht: string;
  anforderungen?: string;
  persoenlicheNote?: string;
  kulturHinweis?: string;
  funFact?: string;
  funFactFreigegeben: boolean;
  sichtbarkeit: 'oeffentlich' | 'anonym';
  laufzeitMonate: number;
  entwurfErstelltAm?: string;
  letzteBearbeitungAm?: string;
}

// ─── WORKFLOW-STATUS (Prozessfluss) ──────────────────────────

export type AnfrageWorkflowStatus =
  | 'neu'
  | 'in_pruefung'
  | 'rueckfragen_offen'
  | 'ausreichend_geklaert'
  | 'unternehmen_angelegt'
  | 'unternehmen_verifiziert'
  | 'projekt_erstellt'
  | 'archiviert';

export const WORKFLOW_SCHRITTE: { status: AnfrageWorkflowStatus; label: string; schritt: number }[] = [
  { status: 'neu',                    label: 'Eingegangen',            schritt: 1 },
  { status: 'in_pruefung',            label: 'Prüfung',               schritt: 2 },
  { status: 'unternehmen_angelegt',   label: 'Unternehmen',            schritt: 3 },
  { status: 'unternehmen_verifiziert',label: 'Qualifiziert',           schritt: 4 },
  { status: 'projekt_erstellt',       label: 'Projekt erstellt',       schritt: 5 },
  { status: 'archiviert',             label: 'Archiviert',             schritt: 6 },
];

// ─── PRÜFPUNKTE (Qualifizierungs-Checkliste) ────────────────

export interface PruefPunkt {
  id: string;
  kategorie: 'basisdaten' | 'anfragequalitaet' | 'ernsthaftigkeit' | 'intern';
  label: string;
  erledigt: boolean;
  notiz?: string;
  kritisch?: boolean;  // wenn true und nicht erledigt → Hinweis
}

export const PRUEF_KATEGORIEN: { key: PruefPunkt['kategorie']; label: string; icon: string }[] = [
  { key: 'basisdaten',       label: 'Basisdaten',                     icon: '📋' },
  { key: 'anfragequalitaet', label: 'Anfragequalität',                icon: '🎯' },
  { key: 'ernsthaftigkeit',  label: 'Ernsthaftigkeit / Vorbereitung', icon: '💼' },
  { key: 'intern',           label: 'Interne Prüfung',                icon: '🔒' },
];

export function erstelleStandardPruefPunkte(): PruefPunkt[] {
  return [
    // Basisdaten
    { id: 'pp-01', kategorie: 'basisdaten', label: 'Ansprechpartner vorhanden',         erledigt: false, kritisch: true },
    { id: 'pp-02', kategorie: 'basisdaten', label: 'E-Mail vorhanden',                  erledigt: false, kritisch: true },
    { id: 'pp-03', kategorie: 'basisdaten', label: 'Telefonnummer vorhanden',            erledigt: false },
    { id: 'pp-04', kategorie: 'basisdaten', label: 'Website / LinkedIn vorhanden',       erledigt: false },
    { id: 'pp-05', kategorie: 'basisdaten', label: 'Kommunikationssprache geklärt',      erledigt: false, kritisch: true },
    // Anfragequalität
    { id: 'pp-06', kategorie: 'anfragequalitaet', label: 'Suchziel verständlich',        erledigt: false, kritisch: true },
    { id: 'pp-07', kategorie: 'anfragequalitaet', label: 'Zielregion definiert',         erledigt: false },
    { id: 'pp-08', kategorie: 'anfragequalitaet', label: 'Branche / Zielgruppe definiert', erledigt: false, kritisch: true },
    { id: 'pp-09', kategorie: 'anfragequalitaet', label: 'Anforderungen beschrieben',    erledigt: false },
    { id: 'pp-10', kategorie: 'anfragequalitaet', label: 'Zeitfenster angegeben',        erledigt: false },
    // Ernsthaftigkeit
    { id: 'pp-11', kategorie: 'ernsthaftigkeit', label: 'Motivation beschrieben',        erledigt: false },
    { id: 'pp-12', kategorie: 'ernsthaftigkeit', label: 'Reifegrad angegeben',           erledigt: false },
    { id: 'pp-13', kategorie: 'ernsthaftigkeit', label: 'Erstgespräch grundsätzlich erwünscht', erledigt: false },
    { id: 'pp-14', kategorie: 'ernsthaftigkeit', label: 'Vorhandene Unterlagen geklärt', erledigt: false },
    { id: 'pp-15', kategorie: 'ernsthaftigkeit', label: 'Erwartungen an Partner beschrieben', erledigt: false },
    // Interne Prüfung
    { id: 'pp-16', kategorie: 'intern', label: 'Rückfragen notwendig',                  erledigt: false },
    { id: 'pp-17', kategorie: 'intern', label: 'Rückfragen erledigt',                   erledigt: false },
    { id: 'pp-18', kategorie: 'intern', label: 'Interne Notiz vorhanden',               erledigt: false },
    { id: 'pp-19', kategorie: 'intern', label: 'Freigabe durch Operator',               erledigt: false, kritisch: true },
  ];
}

export function getWorkflowStatusLabel(s?: AnfrageWorkflowStatus): string {
  return WORKFLOW_SCHRITTE.find(w => w.status === s)?.label ?? 'Neu';
}

export function getWorkflowStatusSchritt(s?: AnfrageWorkflowStatus): number {
  return WORKFLOW_SCHRITTE.find(w => w.status === s)?.schritt ?? 1;
}

export function getWorkflowStatusColor(s?: AnfrageWorkflowStatus): string {
  const map: Record<AnfrageWorkflowStatus, string> = {
    neu:                    '#9E9E9E',
    in_pruefung:            '#FF9900',
    rueckfragen_offen:      '#e53935',
    ausreichend_geklaert:   '#43a047',
    unternehmen_angelegt:   '#2196F3',
    unternehmen_verifiziert:'#4CAF50',
    projekt_erstellt:       '#9C27B0',
    archiviert:             '#546e7a',
  };
  return map[s ?? 'neu'] ?? '#9E9E9E';
}

export interface MockAnfrage {
  id: string;
  anzeigenId: string;
  firmenname: string;
  standort: string;
  // FunFact & Persönliche Note
  funFactFrage?: string;
  funFactAntwort?: string;
  funFactAntwortKI?: string;
  kulturHinweis?: string;
  gespraechseinstieg?: string;
  funFactOeffentlich?: boolean;
  richtung: 'de_dk' | 'dk_de';
  art: string;
  branche: string;
  beschreibung: string;
  ziel: string;
  status: string;
  sichtbarkeit: string;
  sprachen: string[];
  ansprechpartner: string;
  email: string;
  telefon?: string;
  interessentenCount: number;
  createdAt: string;
  // Marktplatz-Veröffentlichung
  marktplatzStatus?: MarktplatzStatus;
  marktplatzDaten?: MarktplatzEintrag;
  veroeffentlichtAm?: string;
  ablaufDatum?: string;
  veroeffentlichtVon?: string;
  deaktivierungsGrund?: string;
  // Prozess-Workflow
  workflowStatus?: AnfrageWorkflowStatus;
  unternehmensId?: string;     // Link zum verknüpften Unternehmen
  // Formular-Zuordnung
  anfrageFormularId?: string;       // welches Anfrageformular wurde verwendet
  interessentFormularId?: string;   // welches Interessentenformular für Reaktionen
  // Klärungs-Bestätigungen
  klaerungsBestaetigungen?: Record<string, { notiz?: string; bestaetigtVon: string; bestaetigtAm: string }>;
  // Interne Operator-Notizen (nicht öffentlich)
  interneNotiz?: string;
  // Prüfung & Qualifizierung (Checkliste)
  pruefPunkte?: PruefPunkt[];

  // ── Marktplatz-Reichinhalt (öffentlich sichtbar auf der Anzeige) ──
  motivation?: string;                  // „Warum dieses Projekt gestartet wurde"
  ziele?: string[];                     // „Was ein gutes Ergebnis wäre"
  partnerErwartungen?: string[];        // „Was wir uns von einem Partner wünschen"
  zielgruppe?: string[];                // „Für wen besonders interessant"
  vorbereitung?: {
    produktunterlagen?: boolean;
    preislisten?: boolean;
    zertifikate?: boolean;
    produktproben?: boolean;
    marketingmaterial?: boolean;
    referenzen?: boolean;
    webseiteDeutsch?: boolean;
    notiz?: string;                     // z.B. „Preislisten in Vorbereitung"
  };
  // Zeitfenster
  projektStartDatum?: string;
  projektEndDatum?: string;
  erstgespraechFristDatum?: string;

  // Reifegrad / Konkretisierungsgrad (1-10 Skala)
  reifegradScore?: number;             // 1-10, wie konkret ist das Vorhaben?
  reifegradBeschreibung?: string;      // Optionale öffentliche Erklärung
}

export interface MockInteressent {
  id: string;
  anfrageId: string;
  anfrageFirma: string;
  firmenname: string;
  ansprechpartner: string;
  email: string;
  telefon?: string;
  status: string;
  matchScore?: number;
  createdAt: string;
  notiz?: string;

  // Erweiterte Stammdaten (aus Formular)
  position?: string;
  website?: string;
  linkedin?: string;
  land?: string;
  region?: string;
  sprachen?: string[];
  bevorzugteSprache?: string;

  // Formular-Antworten (Bezug zur Anfrage)
  warumInteresse?: string;
  warumPassung?: string;
  beitrag?: string;
  erfahrung?: string;
  referenzen?: string;
  zusammenarbeit?: string;
  interesseLevel?: string;   // kennenlernen | gespraech | pilot | umsetzung
  reaktionszeit?: string;
  einschraenkungen?: string;
  persoenlicheNote?: string;
  funFact?: string;

  // Interne Prüfung (Operator)
  ersteindruck?: string;     // sehr_gut | gut | neutral | kritisch
  passung?: string;          // hoch | mittel | niedrig
  seriositaet?: string;      // geprueft | ungeprueft | kritisch
  gespraechGefuehrt?: boolean;
  websiteGeprueft?: boolean;
  linkedinGeprueft?: boolean;
  referenzenVorhanden?: boolean;
  gespraechsnotiz?: string;

  // Matching-Bezug
  matchGruende?: string[];
  matchRisiken?: string[];
  // Kontakt-Link (nach Konvertierung)
  kontaktId?: string;
  // Formular-Antworten (generisch, aus zugeordnetem Interessentenformular)
  formularId?: string;
  formularAntworten?: FormularAntwort[];
  // Klärungs-Bestätigungen
  klaerungsBestaetigungen?: Record<string, { notiz?: string; bestaetigtVon: string; bestaetigtAm: string }>;
}

// ─── FORMULAR-VORLAGEN ───────────────────────────────────────
// Verwaltbare, branchenspezifische Fragebögen für Anfragen und
// Interessenten. Datenmodell an Homepage-Prisma ausgerichtet.

export type FormularTyp = 'anfrage' | 'interessent';

export type FrageTyp =
  | 'text_kurz' | 'text_lang' | 'auswahl_single' | 'auswahl_multi'
  | 'zahl' | 'ja_nein' | 'skala' | 'datum' | 'datei';

export const FRAGETYP_OPTIONEN: { value: FrageTyp; label: string }[] = [
  { value: 'text_kurz', label: 'Text kurz' },
  { value: 'text_lang', label: 'Text lang' },
  { value: 'auswahl_single', label: 'Auswahl (eine)' },
  { value: 'auswahl_multi', label: 'Mehrfachauswahl' },
  { value: 'zahl', label: 'Zahl' },
  { value: 'ja_nein', label: 'Ja / Nein' },
  { value: 'skala', label: 'Skala 1–10' },
  { value: 'datum', label: 'Datum' },
  { value: 'datei', label: 'Datei-Upload' },
];

export function getFrageTypLabel(t: FrageTyp): string {
  return FRAGETYP_OPTIONEN.find(o => o.value === t)?.label ?? t;
}

export interface FormularFrage {
  id: string;
  reihenfolge: number;
  text: string;
  typ: FrageTyp;
  pflicht: boolean;
  optionen?: string[];   // bei auswahl_single / auswahl_multi
  hinweis?: string;      // Hilfetext unter der Frage
}

export interface FormularVorlage {
  id: string;
  name: string;
  typ: FormularTyp;
  branche?: string;      // undefined = allgemein gültig
  istStandard: boolean;  // Fallback wenn kein Spezialformular zugeordnet
  beschreibung?: string;
  fragen: FormularFrage[];
  aktiv: boolean;
  createdAt: string;
}

export interface FormularAntwort {
  frageId: string;
  frageText: string;
  wert: string;
}

// Hilfsfunktion: passende Vorlage finden (Branchen-Spezial vor Standard)
export function findeFormular(formulare: FormularVorlage[], typ: FormularTyp, branche?: string): FormularVorlage | undefined {
  if (branche) {
    const spezial = formulare.find(f => f.aktiv && f.typ === typ && f.branche === branche);
    if (spezial) return spezial;
  }
  return formulare.find(f => f.aktiv && f.typ === typ && f.istStandard);
}

// ─── Standardfragen ──────────────────────────────────────────

let _fid = 0;
function fr(text: string, typ: FrageTyp, pflicht = true, optionen?: string[], hinweis?: string): FormularFrage {
  _fid += 1;
  return { id: `frq-${_fid}`, reihenfolge: _fid, text, typ, pflicht, optionen, hinweis };
}

const STANDARD_ANFRAGE_FRAGEN: FormularFrage[] = [
  fr('Wer seid ihr?', 'text_lang', true, undefined, 'Kurze Vorstellung eures Unternehmens'),
  fr('Was sucht ihr?', 'text_lang'),
  fr('Warum sucht ihr das?', 'text_lang'),
  fr('In welchem Land / welcher Region?', 'text_kurz'),
  fr('Welche Branche?', 'text_kurz'),
  fr('Welche Anforderungen gibt es?', 'text_lang', false),
  fr('Welche Ausschlusskriterien gibt es?', 'text_lang', false),
  fr('Wie konkret ist das Vorhaben?', 'auswahl_single', true, ['Idee', 'Konzept', 'Bereit', 'Sofort']),
  fr('Wann soll es starten?', 'datum', false),
  fr('Welche Sprachen sind möglich?', 'auswahl_multi', true, ['Deutsch', 'Dänisch', 'Englisch']),
  fr('Gibt es Unterlagen, Bilder oder Produktkataloge?', 'datei', false),
];

const STANDARD_INTERESSENT_FRAGEN: FormularFrage[] = [
  fr('Warum interessiert euch dieses Projekt?', 'text_lang'),
  fr('Warum passt ihr zu dieser Anfrage?', 'text_lang'),
  fr('Was könnt ihr konkret beitragen?', 'text_lang'),
  fr('Welche Erfahrung habt ihr in diesem Bereich?', 'text_lang'),
  fr('Welche Region deckt ihr ab?', 'text_kurz'),
  fr('Welche Sprachen sind möglich?', 'auswahl_multi', true, ['Deutsch', 'Dänisch', 'Englisch']),
  fr('Wie schnell könnt ihr reagieren?', 'auswahl_single', true, ['Sofort', 'Innerhalb 1 Woche', 'Innerhalb 1 Monat']),
  fr('Welche Art der Kooperation stellt ihr euch vor?', 'text_lang'),
  fr('Gibt es Referenzen oder Beispiele?', 'text_lang', false),
];

const FOOD_ANFRAGE_ZUSATZ: FormularFrage[] = [
  fr('Welche Produkte sollen vertrieben werden?', 'text_lang'),
  fr('Gibt es bereits deutsche Etiketten?', 'ja_nein'),
  fr('Sind Zertifikate vorhanden?', 'text_kurz', false),
  fr('Gibt es Listungserfahrung im Einzelhandel?', 'ja_nein'),
  fr('Gibt es deutsche Preislisten?', 'ja_nein', false),
  fr('Sind Logistik und Kühlung geklärt?', 'ja_nein'),
  fr('Gibt es Mindestabnahmemengen?', 'text_kurz', false),
  fr('Welche Zielgruppe wird gesucht?', 'auswahl_multi', true, ['Einzelhandel', 'Gastronomie', 'Großhandel', 'Fachhandel']),
];

const FOOD_INTERESSENT_ZUSATZ: FormularFrage[] = [
  fr('Habt ihr Erfahrung mit Lebensmittelvertrieb?', 'ja_nein'),
  fr('Habt ihr Kontakte zum Lebensmitteleinzelhandel?', 'ja_nein'),
  fr('Habt ihr Kontakte zur Gastronomie?', 'ja_nein', false),
  fr('Welche Produktgruppen vertreibt ihr bereits?', 'text_lang'),
  fr('Gibt es Kühl-/Lagerlogistik?', 'ja_nein'),
  fr('Habt ihr Erfahrung mit Importprodukten?', 'ja_nein', false),
  fr('Welche Regionen deckt ihr ab?', 'text_kurz'),
  fr('Habt ihr Referenzen im Food-Bereich?', 'text_lang', false),
];

export const MOCK_FORMULARE: FormularVorlage[] = [
  {
    id: 'form-001', name: 'Standard Anfrageformular', typ: 'anfrage',
    istStandard: true, beschreibung: 'Allgemeines Formular für alle Branchen, wenn kein Spezialformular zugeordnet ist.',
    fragen: STANDARD_ANFRAGE_FRAGEN, aktiv: true, createdAt: '2025-01-01',
  },
  {
    id: 'form-002', name: 'Standard Interessentenformular', typ: 'interessent',
    istStandard: true, beschreibung: 'Allgemeines Formular für Interessenten, wenn kein Spezialformular zugeordnet ist.',
    fragen: STANDARD_INTERESSENT_FRAGEN, aktiv: true, createdAt: '2025-01-01',
  },
  {
    id: 'form-003', name: 'Food-Markteintritt Deutschland', typ: 'anfrage',
    branche: 'Lebensmittel & Fischerei', istStandard: false,
    beschreibung: 'Für Lebensmittelunternehmen, die in den deutschen Markt möchten.',
    fragen: [...STANDARD_ANFRAGE_FRAGEN.slice(0, 5), ...FOOD_ANFRAGE_ZUSATZ], aktiv: true, createdAt: '2025-02-15',
  },
  {
    id: 'form-004', name: 'Food-Vertriebspartner Deutschland', typ: 'interessent',
    branche: 'Lebensmittel & Fischerei', istStandard: false,
    beschreibung: 'Für Interessenten, die als Food-Vertriebspartner reagieren.',
    fragen: [...STANDARD_INTERESSENT_FRAGEN.slice(0, 5), ...FOOD_INTERESSENT_ZUSATZ], aktiv: true, createdAt: '2025-02-15',
  },
];

// ─── MATCHMAKING-VORLAGEN (editierbare E-Mail-Templates) ────

export type MatchmailTyp =
  | 'vorschlag_suchender'        // A) Match-Vorschlag an Suchenden
  | 'vorschlag_interessent'      // B) Match-Vorschlag an Interessenten
  | 'kontaktfreigabe'            // C) Kontaktdaten freigegeben (nach beidseitiger Zustimmung)
  | 'erinnerung_zustimmung'      // D) Erinnerung zur Zustimmung
  | 'beide_zugestimmt'           // E) Bestätigung: Beide haben zugestimmt
  | 'erstkontakt_erinnerung'     // F) Erstkontakt-Erinnerung
  | 'problem_meldung';           // G) Problemmeldung

export interface MatchmailPlatzhalter {
  key: string;         // z.B. "{{Projektname}}"
  label: string;       // z.B. "Projektname"
  beispiel: string;    // z.B. "Vertriebspartner für Fisch- und Backwaren"
}

export interface MatchmailButton {
  label: string;       // z.B. "✅ Kontaktdaten freigeben"
  aktion: string;      // z.B. "zustimmung" | "ablehnung" | "link"
  farbe: string;       // z.B. "#4CAF50"
}

export interface MatchmailVorlage {
  id: string;
  typ: MatchmailTyp;
  name: string;
  beschreibung: string;
  betreff: string;
  einleitung: string;         // Text vor dem Hauptinhalt
  hauptinhalt: string;        // Haupttext (mit Platzhaltern)
  hinweis: string;            // DSGVO-Hinweis oder ähnliches
  buttons: MatchmailButton[];
  platzhalter: MatchmailPlatzhalter[];
  fusszeile: string;
  aktiv: boolean;
  letzteBearbeitung?: string;
}

export const MATCHMAIL_TYP_LABELS: Record<MatchmailTyp, string> = {
  vorschlag_suchender: 'Match-Vorschlag an Suchenden',
  vorschlag_interessent: 'Match-Vorschlag an Interessenten',
  kontaktfreigabe: 'Kontaktdaten freigegeben',
  erinnerung_zustimmung: 'Erinnerung zur Zustimmung',
  beide_zugestimmt: 'Beide Parteien haben zugestimmt',
  erstkontakt_erinnerung: 'Erstkontakt-Erinnerung',
  problem_meldung: 'Problemmeldung',
};

export const MATCHMAIL_TYP_ICONS: Record<MatchmailTyp, string> = {
  vorschlag_suchender: '🎯',
  vorschlag_interessent: '🎯',
  kontaktfreigabe: '📦',
  erinnerung_zustimmung: '⏰',
  beide_zugestimmt: '✅',
  erstkontakt_erinnerung: '📞',
  problem_meldung: '⚠️',
};

// Standard-Platzhalter, die in allen Vorlagen verfügbar sind
export const ALLE_PLATZHALTER: MatchmailPlatzhalter[] = [
  { key: '{{Projektname}}', label: 'Projektname', beispiel: 'Vertriebspartner für Fisch- und Backwaren' },
  { key: '{{AnfrageId}}', label: 'Anfrage-Nr.', beispiel: 'EB-2026-001' },
  { key: '{{Unternehmen}}', label: 'Suchendes Unternehmen', beispiel: 'Nordhavn Foods A/S' },
  { key: '{{Interessent}}', label: 'Interessent', beispiel: 'NordConsult Vertrieb GmbH' },
  { key: '{{Ansprechpartner}}', label: 'Ansprechpartner', beispiel: 'Lars Jensen' },
  { key: '{{AnsprechpartnerInteressent}}', label: 'Ansprechpartner Interessent', beispiel: 'Michael Petersen' },
  { key: '{{Region}}', label: 'Region', beispiel: 'Norddeutschland' },
  { key: '{{Branche}}', label: 'Branche', beispiel: 'Lebensmittel' },
  { key: '{{MatchScore}}', label: 'Match-Score', beispiel: '92%' },
  { key: '{{MatchGruende}}', label: 'Match-Gründe (Liste)', beispiel: '• Food-Erfahrung\n• Kontakte zum LEH' },
  { key: '{{Email}}', label: 'E-Mail', beispiel: 'l.jensen@nordhavn-foods.dk' },
  { key: '{{Telefon}}', label: 'Telefon', beispiel: '+45 70 12 34 56' },
  { key: '{{Website}}', label: 'Website', beispiel: 'https://www.nordhavn-foods.dk' },
  { key: '{{Sprachen}}', label: 'Sprachen', beispiel: 'Dänisch, Englisch' },
  { key: '{{EmpfohleneSprache}}', label: 'Empfohlene Sprache', beispiel: 'Deutsch' },
  { key: '{{Datum}}', label: 'Aktuelles Datum', beispiel: new Date().toLocaleDateString('de-DE') },
];

export const MOCK_MATCHMAIL_VORLAGEN: MatchmailVorlage[] = [
  {
    id: 'mmv-001',
    typ: 'vorschlag_suchender',
    name: 'Match-Vorschlag an Suchenden',
    beschreibung: 'Wird an das suchende Unternehmen gesendet, wenn ein passender Interessent gefunden wurde.',
    betreff: '🎯 Easy-B2B: Passender Kontakt gefunden ({{AnfrageId}})',
    einleitung: 'Hallo {{Ansprechpartner}},\n\nwir haben einen Interessenten für Ihre Anfrage {{AnfrageId}} geprüft und halten ihn für passend.',
    hauptinhalt: 'MATCH-VORSCHLAG · {{MatchScore}} PASSUNG\n\n{{Interessent}}\n\nBranche: {{Branche}}\nRegion: {{Region}}\nSprachen: {{Sprachen}}\n\nWarum wir glauben, dass dieser Kontakt passt:\n{{MatchGruende}}',
    hinweis: 'Kontaktdaten werden erst nach Ihrer ausdrücklichen Zustimmung ausgetauscht. Der Interessent wird ebenfalls um Zustimmung gebeten.\n\nMit Ihrer Zustimmung dürfen wir Ihre Kontaktdaten an den Interessenten weitergeben.',
    buttons: [
      { label: '✅ Kontaktdaten freigeben', aktion: 'zustimmung', farbe: '#4CAF50' },
      { label: '❌ Kein Interesse', aktion: 'ablehnung', farbe: '#f5f5f5' },
    ],
    platzhalter: ALLE_PLATZHALTER.filter(p => ['{{Ansprechpartner}}','{{AnfrageId}}','{{Interessent}}','{{Branche}}','{{Region}}','{{Sprachen}}','{{MatchScore}}','{{MatchGruende}}','{{Datum}}'].includes(p.key)),
    fusszeile: 'Diese E-Mail wurde im Rahmen des Easy-B2B Matchmaking-Prozesses versendet. Ihre Zustimmung wird DSGVO-konform dokumentiert (Zeitpunkt, Person, Unternehmen). Ohne Ihre aktive Freigabe werden keine Kontaktdaten weitergegeben.',
    aktiv: true,
    letzteBearbeitung: '2026-06-05',
  },
  {
    id: 'mmv-002',
    typ: 'vorschlag_interessent',
    name: 'Match-Vorschlag an Interessenten',
    beschreibung: 'Wird an den Interessenten gesendet, um ihn einem suchenden Unternehmen vorzustellen.',
    betreff: '🎯 Easy-B2B möchte Sie einem Unternehmen vorstellen',
    einleitung: 'Hallo {{AnsprechpartnerInteressent}},\n\nwir glauben, dass das Projekt {{AnfrageId}} sehr gut zu Ihrem Profil passt.',
    hauptinhalt: 'PROJEKT-VORSTELLUNG · {{MatchScore}} PASSUNG\n\n{{Unternehmen}}\n\nBranche: {{Branche}}\nRegion: {{Region}}\nSprachen: {{Sprachen}}\n\nWarum wir glauben, dass dieses Projekt für Sie interessant ist:\n{{MatchGruende}}',
    hinweis: 'Kontaktdaten werden erst nach Ihrer ausdrücklichen Zustimmung ausgetauscht. Das suchende Unternehmen wird ebenfalls um Zustimmung gebeten.\n\nMit Ihrer Zustimmung dürfen wir Ihre Kontaktdaten an das suchende Unternehmen weitergeben.',
    buttons: [
      { label: '✅ Kontaktdaten freigeben', aktion: 'zustimmung', farbe: '#4CAF50' },
      { label: '❌ Kein Interesse', aktion: 'ablehnung', farbe: '#f5f5f5' },
    ],
    platzhalter: ALLE_PLATZHALTER.filter(p => ['{{AnsprechpartnerInteressent}}','{{AnfrageId}}','{{Unternehmen}}','{{Branche}}','{{Region}}','{{Sprachen}}','{{MatchScore}}','{{MatchGruende}}','{{Datum}}'].includes(p.key)),
    fusszeile: 'Diese E-Mail wurde im Rahmen des Easy-B2B Matchmaking-Prozesses versendet. Ihre Zustimmung wird DSGVO-konform dokumentiert (Zeitpunkt, Person, Unternehmen). Ohne Ihre aktive Freigabe werden keine Kontaktdaten weitergegeben.',
    aktiv: true,
    letzteBearbeitung: '2026-06-05',
  },
  {
    id: 'mmv-003',
    typ: 'kontaktfreigabe',
    name: 'Kontaktdaten freigegeben (Match-Paket)',
    beschreibung: 'Wird an beide Parteien gesendet, nachdem beide zugestimmt haben. Enthält die Kontaktdaten des jeweiligen Partners.',
    betreff: '📦 Easy-B2B Match-Paket: Kontaktdaten {{Interessent}}',
    einleitung: 'Hallo {{Ansprechpartner}},\n\nbeide Seiten haben der Kontaktfreigabe zugestimmt. Hier sind die Kontaktdaten Ihres Match-Partners:',
    hauptinhalt: '✅ MATCH BESTÄTIGT — KONTAKTDATEN\n\n{{Interessent}}\n\nAnsprechpartner: {{AnsprechpartnerInteressent}}\nE-Mail: {{Email}}\nTelefon: {{Telefon}}\nWebsite: {{Website}}\nSprachen: {{Sprachen}}',
    hinweis: 'Hinweise zum Erstkontakt:\n\n• Empfohlene Sprache: {{EmpfohleneSprache}}\n• Nennen Sie Easy-B2B als gemeinsamen Kontext — das schafft sofort Vertrauen\n• Wir freuen uns über Feedback nach dem ersten Gespräch',
    buttons: [],
    platzhalter: ALLE_PLATZHALTER,
    fusszeile: 'Tipp: Nennen Sie Easy-B2B als gemeinsamen Kontext — das schafft sofort Vertrauen. Wir freuen uns über Feedback nach dem ersten Gespräch.',
    aktiv: true,
    letzteBearbeitung: '2026-06-05',
  },
  {
    id: 'mmv-004',
    typ: 'erinnerung_zustimmung',
    name: 'Erinnerung: Zustimmung ausstehend',
    beschreibung: 'Wird gesendet, wenn eine Partei noch nicht auf den Match-Vorschlag reagiert hat.',
    betreff: '⏰ Easy-B2B: Ihr Match-Vorschlag wartet auf Ihre Rückmeldung',
    einleitung: 'Hallo {{Ansprechpartner}},\n\nvor einigen Tagen haben wir Ihnen einen Match-Vorschlag für Projekt {{AnfrageId}} zugesendet. Ihre Rückmeldung steht noch aus.',
    hauptinhalt: 'Wir möchten Sie freundlich daran erinnern, dass ein Interessent auf Ihre Entscheidung wartet.\n\nProjekt: {{Projektname}}\nMatch-Score: {{MatchScore}}\n\nSie können den Vorschlag jederzeit annehmen oder ablehnen.',
    hinweis: 'Ohne Ihre aktive Rückmeldung können wir den Matchmaking-Prozess nicht fortsetzen. Ihre Kontaktdaten werden nicht ohne Ihre Zustimmung weitergegeben.',
    buttons: [
      { label: '✅ Kontaktdaten freigeben', aktion: 'zustimmung', farbe: '#4CAF50' },
      { label: '❌ Kein Interesse', aktion: 'ablehnung', farbe: '#f5f5f5' },
    ],
    platzhalter: ALLE_PLATZHALTER.filter(p => ['{{Ansprechpartner}}','{{AnfrageId}}','{{Projektname}}','{{MatchScore}}','{{Datum}}'].includes(p.key)),
    fusszeile: 'Diese E-Mail wurde im Rahmen des Easy-B2B Matchmaking-Prozesses versendet.',
    aktiv: true,
    letzteBearbeitung: '2026-06-05',
  },
  {
    id: 'mmv-005',
    typ: 'beide_zugestimmt',
    name: 'Bestätigung: Beide haben zugestimmt',
    beschreibung: 'Kurze Bestätigungsmail, wenn die zweite Partei zugestimmt hat. Kündigt das Match-Paket an.',
    betreff: '✅ Easy-B2B: Beide Seiten haben zugestimmt!',
    einleitung: 'Hallo {{Ansprechpartner}},\n\ngute Nachrichten! Beide Seiten haben der Kontaktfreigabe für Projekt {{AnfrageId}} zugestimmt.',
    hauptinhalt: 'Wir bereiten jetzt Ihr Match-Paket mit den Kontaktdaten vor.\n\nSie erhalten in Kürze eine separate E-Mail mit allen relevanten Informationen für den Erstkontakt.',
    hinweis: 'Bitte beachten Sie: Die Kontaktdaten werden vertraulich und ausschließlich für den vereinbarten Zweck übermittelt.',
    buttons: [],
    platzhalter: ALLE_PLATZHALTER.filter(p => ['{{Ansprechpartner}}','{{AnfrageId}}','{{Datum}}'].includes(p.key)),
    fusszeile: 'Diese E-Mail wurde im Rahmen des Easy-B2B Matchmaking-Prozesses versendet.',
    aktiv: true,
    letzteBearbeitung: '2026-06-05',
  },
  {
    id: 'mmv-006',
    typ: 'erstkontakt_erinnerung',
    name: 'Erstkontakt-Erinnerung',
    beschreibung: 'Wird gesendet, wenn nach der Kontaktfreigabe noch kein Erstkontakt stattgefunden hat.',
    betreff: '📞 Easy-B2B: Haben Sie schon Kontakt aufgenommen?',
    einleitung: 'Hallo {{Ansprechpartner}},\n\nvor einigen Tagen haben wir Ihnen die Kontaktdaten Ihres Match-Partners für Projekt {{AnfrageId}} zugesendet.',
    hauptinhalt: 'Haben Sie bereits Kontakt aufgenommen?\n\nFalls ja: Wunderbar! Wir freuen uns über eine kurze Rückmeldung, wie das erste Gespräch verlaufen ist.\n\nFalls nein: Kein Problem — aber je schneller der Erstkontakt stattfindet, desto besser. Der erste Schritt ist oft der wichtigste.',
    hinweis: 'Empfohlene Sprache: {{EmpfohleneSprache}}\n\nTipp: Ein kurzer Anruf oder eine persönliche E-Mail mit Bezug auf Easy-B2B ist oft der beste Einstieg.',
    buttons: [
      { label: '✅ Ja, Kontakt hergestellt', aktion: 'bestaetigung', farbe: '#4CAF50' },
      { label: '⚠️ Problem melden', aktion: 'problem', farbe: '#FF9900' },
    ],
    platzhalter: ALLE_PLATZHALTER.filter(p => ['{{Ansprechpartner}}','{{AnfrageId}}','{{EmpfohleneSprache}}','{{Datum}}'].includes(p.key)),
    fusszeile: 'Diese E-Mail wurde im Rahmen des Easy-B2B Matchmaking-Prozesses versendet.',
    aktiv: true,
    letzteBearbeitung: '2026-06-05',
  },
  {
    id: 'mmv-007',
    typ: 'problem_meldung',
    name: 'Problemmeldung',
    beschreibung: 'Wird an den Operator weitergeleitet, wenn eine Partei ein Problem meldet.',
    betreff: '⚠️ Easy-B2B: Problemmeldung zu Projekt {{AnfrageId}}',
    einleitung: 'Hallo {{Ansprechpartner}},\n\nes tut uns leid zu hören, dass es Schwierigkeiten gibt.',
    hauptinhalt: 'Bitte beschreiben Sie uns kurz das Problem — wir kümmern uns darum.\n\nProjekt: {{Projektname}}\nMatch-Partner: {{Interessent}}\n\nSie können uns jederzeit per E-Mail oder Telefon erreichen.',
    hinweis: 'Unser Team prüft Ihre Meldung zeitnah. In dringenden Fällen melden wir uns innerhalb von 24 Stunden.',
    buttons: [
      { label: '📧 Problem beschreiben', aktion: 'antwort', farbe: '#FF9900' },
    ],
    platzhalter: ALLE_PLATZHALTER.filter(p => ['{{Ansprechpartner}}','{{AnfrageId}}','{{Projektname}}','{{Interessent}}','{{Datum}}'].includes(p.key)),
    fusszeile: 'Diese E-Mail wurde im Rahmen des Easy-B2B Matchmaking-Prozesses versendet.',
    aktiv: true,
    letzteBearbeitung: '2026-06-05',
  },
];

// ─── KONTAKTE ────────────────────────────────────────────────
// Dauerhafte Stammdaten — entstehen aus geprüften Interessenten
// oder werden manuell angelegt.

export type KontaktQuelleTyp = 'interessent' | 'manuell' | 'empfehlung' | 'event' | 'gespraech' | 'netzwerk';
export type KontaktStatus    = 'aktiv' | 'pausiert' | 'archiviert';
export type KontaktZuordnungStatus = 'vorgeschlagen' | 'in_pruefung' | 'freigegeben' | 'kontakt_laeuft' | 'abgelehnt' | 'abgeschlossen';

export interface KontaktProjektZuordnung {
  id: string;
  projektId: string;          // = anfrageId
  status: KontaktZuordnungStatus;
  notiz?: string;
  erstelltAm: string;
  erstelltVon: string;
}

export interface MockKontakt {
  id: string;
  quelleTyp: KontaktQuelleTyp;
  interessentId?: string;     // Link zum Ursprungs-Interessenten
  anfrageId?: string;         // Link zur ursprünglichen Anfrage
  firmenname: string;
  ansprechpartner: string;
  email: string;
  telefon?: string;
  website?: string;
  linkedin?: string;
  land?: string;
  region?: string;
  branche?: string;
  sprachen?: string[];
  status: KontaktStatus;
  createdAt: string;
  interneNotiz?: string;
  projektZuordnungen: KontaktProjektZuordnung[];
  formularAntworten?: FormularAntwort[];   // aus Interessent übernommen
}

export function getKontaktQuelleLabel(q: KontaktQuelleTyp): string {
  const map: Record<KontaktQuelleTyp, string> = {
    interessent: '📋 Interessent', manuell: '✏️ Manuell',
    empfehlung: '⭐ Empfehlung', event: '🎤 Event',
    gespraech: '📞 Gespräch', netzwerk: '🕸 Netzwerk',
  };
  return map[q] ?? q;
}

export function getKontaktStatusLabel(s: KontaktStatus): string {
  return { aktiv: 'Aktiv', pausiert: 'Pausiert', archiviert: 'Archiviert' }[s] ?? s;
}
export function getKontaktStatusColor(s: KontaktStatus): string {
  return { aktiv: '#4CAF50', pausiert: '#FF9900', archiviert: '#9E9E9E' }[s] ?? '#999';
}

export function getKontaktZuordnungLabel(s: KontaktZuordnungStatus): string {
  const map: Record<KontaktZuordnungStatus, string> = {
    vorgeschlagen: 'Vorgeschlagen', in_pruefung: 'In Prüfung', freigegeben: 'Freigegeben',
    kontakt_laeuft: 'Kontakt läuft', abgelehnt: 'Abgelehnt', abgeschlossen: 'Abgeschlossen',
  };
  return map[s] ?? s;
}
export function getKontaktZuordnungColor(s: KontaktZuordnungStatus): string {
  const map: Record<KontaktZuordnungStatus, string> = {
    vorgeschlagen: '#2196F3', in_pruefung: '#FF9900', freigegeben: '#4CAF50',
    kontakt_laeuft: '#9C27B0', abgelehnt: '#f44336', abgeschlossen: '#2e7d32',
  };
  return map[s] ?? '#999';
}

export const MOCK_KONTAKTE: MockKontakt[] = [
  {
    id: 'kon-nordconsult',
    quelleTyp: 'interessent',
    interessentId: 'int-nordconsult',
    anfrageId: 'anf-nordhavn',
    firmenname: 'NordConsult Vertrieb GmbH',
    ansprechpartner: 'Michael Petersen',
    email: 'm.petersen@nordconsult-vertrieb.de',
    telefon: '+49 40 555 123 45',
    website: 'https://www.nordconsult-vertrieb.de',
    linkedin: 'michael-petersen-nordconsult',
    land: 'deutschland',
    region: 'Hamburg / Norddeutschland',
    branche: 'Food-Vertrieb',
    sprachen: ['deutsch', 'englisch'],
    status: 'aktiv',
    createdAt: '2026-06-02',
    interneNotiz: 'Bestehende Kontakte zu Edeka Nord, Edeka Hamburg, Famila und mehreren regionalen Großhändlern. Sehr erfahren im LEH-Vertrieb. Bereit für langfristige Zusammenarbeit.',
    projektZuordnungen: [
      {
        id: 'kpz-nordconsult-nordhavn',
        projektId: 'anf-nordhavn',
        status: 'freigegeben',
        notiz: 'Aus Interessentenformular konvertiert. Sehr gute Passung — Branche, Region, Kontakte stimmen.',
        erstelltAm: '2026-06-03',
        erstelltVon: 'Operator',
      },
    ],
  },
];

// ─── MATCH-STATUS (DSGVO-konformer Freigabeprozess) ─────────

export type MatchStatus =
  | 'vorschlag_erstellt'        // Operator hat Match vorgeschlagen
  | 'freigabe_angefragt'        // Consent-Mails an beide Parteien gesendet
  | 'suchender_zugestimmt'      // Nur Suchender hat zugestimmt
  | 'interessent_zugestimmt'    // Nur Interessent hat zugestimmt
  | 'beide_zugestimmt'          // Beide haben zugestimmt
  | 'kontaktdaten_freigegeben'  // Match-Paket wurde versendet
  | 'erstkontakt_offen'         // Warten auf Erstkontakt
  | 'erstkontakt_erfolgt'       // Erstkontakt hat stattgefunden
  | 'problem_gemeldet'          // Eine Partei hat ein Problem gemeldet
  | 'abgeschlossen'             // Match erfolgreich abgeschlossen
  | 'abgelehnt_suchender'       // Suchender hat abgelehnt
  | 'abgelehnt_interessent';    // Interessent hat abgelehnt

export interface DsgvoZustimmung {
  zeitpunkt: string;            // ISO datetime
  person: string;               // Wer hat zugestimmt
  unternehmen: string;          // Welches Unternehmen
}

export interface MatchPaket {
  erstelltAm: string;
  versendetAm?: string;
  empfohlenerErstkontakt: 'suchender' | 'interessent';
  empfohleneSprache: string;
  hinweise: string[];
}

export interface MatchVorschlag {
  id: string;
  anfrageId: string;            // Projekt
  interessentId: string;        // Interessent
  kontaktId?: string;           // Falls bereits als Kontakt geführt
  // Beteiligte (für Anzeige und E-Mails)
  anfrageFirma: string;
  anfrageBranche: string;
  interessentFirma: string;
  // Bewertung
  score: number;                // Match-Score 0-100
  gruende: string[];            // Warum der Match passt
  risiken?: string[];           // Bekannte Risiken
  status: MatchStatus;
  // DSGVO-konforme Zustimmungs-Dokumentation
  zustimmungSuchender?: DsgvoZustimmung;
  zustimmungInteressent?: DsgvoZustimmung;
  ablehnungGrund?: string;      // Falls abgelehnt
  // Match-Paket (wird generiert nach beidseitiger Zustimmung)
  matchPaket?: MatchPaket;
  // Timeline
  erstelltAm: string;
  erstelltVon: string;
  letzteAenderung: string;
}

export function getMatchStatusLabel(s: MatchStatus): string {
  const map: Record<MatchStatus, string> = {
    vorschlag_erstellt: 'Vorschlag erstellt',
    freigabe_angefragt: 'Freigabe angefragt',
    suchender_zugestimmt: 'Suchender hat zugestimmt',
    interessent_zugestimmt: 'Interessent hat zugestimmt',
    beide_zugestimmt: 'Beide zugestimmt',
    kontaktdaten_freigegeben: 'Kontaktdaten freigegeben',
    erstkontakt_offen: 'Erstkontakt offen',
    erstkontakt_erfolgt: 'Erstkontakt erfolgt',
    problem_gemeldet: 'Problem gemeldet',
    abgeschlossen: 'Abgeschlossen',
    abgelehnt_suchender: 'Vom Suchenden abgelehnt',
    abgelehnt_interessent: 'Vom Interessenten abgelehnt',
  };
  return map[s] ?? s;
}

export function getMatchStatusColor(s: MatchStatus): string {
  const map: Record<MatchStatus, string> = {
    vorschlag_erstellt: '#2196F3',
    freigabe_angefragt: '#FF9900',
    suchender_zugestimmt: '#FF9900',
    interessent_zugestimmt: '#FF9900',
    beide_zugestimmt: '#4CAF50',
    kontaktdaten_freigegeben: '#4CAF50',
    erstkontakt_offen: '#9C27B0',
    erstkontakt_erfolgt: '#2e7d32',
    problem_gemeldet: '#f44336',
    abgeschlossen: '#2e7d32',
    abgelehnt_suchender: '#f44336',
    abgelehnt_interessent: '#f44336',
  };
  return map[s] ?? '#999';
}

export function getMatchStatusIcon(s: MatchStatus): string {
  const map: Record<MatchStatus, string> = {
    vorschlag_erstellt: '💡',
    freigabe_angefragt: '📩',
    suchender_zugestimmt: '✅🔲',
    interessent_zugestimmt: '🔲✅',
    beide_zugestimmt: '✅✅',
    kontaktdaten_freigegeben: '📦',
    erstkontakt_offen: '📞',
    erstkontakt_erfolgt: '🤝',
    problem_gemeldet: '⚠️',
    abgeschlossen: '⭐',
    abgelehnt_suchender: '❌',
    abgelehnt_interessent: '❌',
  };
  return map[s] ?? '?';
}

// Legacy-Typ für Abwärtskompatibilität
export interface MockMatch {
  anfrageId: string;
  anfrageFirma: string;
  anfrageBranche: string;
  interessentId: string;
  interessentFirma: string;
  score: number;
  grund: string;
  status: string;
}

// ─── ANFRAGEN ────────────────────────────────────────────────

export const MOCK_ANFRAGEN: MockAnfrage[] = [
  {
    id: 'anf-nordhavn',
    anzeigenId: 'EB-2026-001',
    firmenname: 'Nordhavn Foods A/S',
    standort: 'Aalborg, Dänemark',
    richtung: 'dk_de',
    art: 'vertrieb',
    branche: 'Lebensmittel',
    beschreibung: 'Wir sind ein dänischer Lebensmittelhersteller mit Schwerpunkt auf hochwertigen Fischprodukten und ausgewählten Backwarenspezialitäten. Nach erfolgreichen Aktivitäten in Dänemark möchten wir nun den deutschen Markt erschließen. Gesucht wird ein Vertriebspartner oder Handelsagent mit bestehenden Kontakten zum norddeutschen Lebensmitteleinzelhandel. Besonders interessant sind Kontakte zu Edeka Nord, Edeka Hamburg, Rewe Nord, Famila und regionalen Großhändlern. Wir suchen keinen reinen Leadgenerator, sondern einen Partner, der langfristig den Aufbau des Marktes begleiten möchte.',
    ziel: 'Vertriebspartner für Fisch- und Backwarenspezialitäten in Norddeutschland gesucht',
    status: 'aktiv',
    sichtbarkeit: 'oeffentlich',
    sprachen: ['daenisch', 'deutsch', 'englisch'],
    ansprechpartner: 'Lars Jensen',
    email: 'l.jensen@nordhavn-foods.dk',
    telefon: '+45 70 12 34 56',
    interessentenCount: 1,
    createdAt: '2026-05-15',
    funFactFrage: 'Wie würdet ihr eine erfolgreiche erste Partnerschaft feiern?',
    funFactAntwort: 'Wir würden den Partner nach Aalborg einladen, eine Brauereiführung machen und gemeinsam typisch dänisch essen — Smørrebrød und natürlich unsere eigenen Fischprodukte.',
    funFactAntwortKI: 'Für Nordhavn Foods ist eine erste erfolgreiche Partnerschaft ein Anlass, den neuen Partner persönlich in Aalborg zu empfangen — mit einer Brauereiführung, klassischem Smørrebrød und natürlich den eigenen Fischprodukten am Tisch. Verbindung statt Vertrag.',
    kulturHinweis: 'Dänischer Kommunikationsstil: direkt, partnerschaftlich, ohne lange Umwege. Lars schätzt klare Worte und persönliche Treffen vor formalen Vertragsverhandlungen.',
    gespraechseinstieg: 'Frag Lars nach der Tradition von Nordhavn — das Familienunternehmen ist seit zwei Generationen in Aalborg verwurzelt und stolz auf die handwerkliche Qualität.',
    funFactOeffentlich: true,
    workflowStatus: 'projekt_erstellt',
    unternehmensId: 'unt-nordhavn',
    pruefPunkte: [
      { id: 'pp-01', kategorie: 'basisdaten', label: 'Ansprechpartner vorhanden', erledigt: true, kritisch: true },
      { id: 'pp-02', kategorie: 'basisdaten', label: 'E-Mail vorhanden', erledigt: true, kritisch: true },
      { id: 'pp-03', kategorie: 'basisdaten', label: 'Telefonnummer vorhanden', erledigt: true },
      { id: 'pp-04', kategorie: 'basisdaten', label: 'Website / LinkedIn vorhanden', erledigt: true },
      { id: 'pp-05', kategorie: 'basisdaten', label: 'Kommunikationssprache geklärt', erledigt: true, kritisch: true },
      { id: 'pp-06', kategorie: 'anfragequalitaet', label: 'Suchziel verständlich', erledigt: true, kritisch: true },
      { id: 'pp-07', kategorie: 'anfragequalitaet', label: 'Zielregion definiert', erledigt: true },
      { id: 'pp-08', kategorie: 'anfragequalitaet', label: 'Branche / Zielgruppe definiert', erledigt: true, kritisch: true },
      { id: 'pp-09', kategorie: 'anfragequalitaet', label: 'Anforderungen beschrieben', erledigt: true },
      { id: 'pp-10', kategorie: 'anfragequalitaet', label: 'Zeitfenster angegeben', erledigt: true },
      { id: 'pp-11', kategorie: 'ernsthaftigkeit', label: 'Motivation beschrieben', erledigt: true },
      { id: 'pp-12', kategorie: 'ernsthaftigkeit', label: 'Reifegrad angegeben', erledigt: true },
      { id: 'pp-13', kategorie: 'ernsthaftigkeit', label: 'Erstgespräch grundsätzlich erwünscht', erledigt: true },
      { id: 'pp-14', kategorie: 'ernsthaftigkeit', label: 'Vorhandene Unterlagen geklärt', erledigt: true },
      { id: 'pp-15', kategorie: 'ernsthaftigkeit', label: 'Erwartungen an Partner beschrieben', erledigt: true },
      { id: 'pp-16', kategorie: 'intern', label: 'Rückfragen notwendig', erledigt: false, notiz: 'Keine Rückfragen nötig' },
      { id: 'pp-17', kategorie: 'intern', label: 'Rückfragen erledigt', erledigt: false, notiz: 'Entfällt' },
      { id: 'pp-18', kategorie: 'intern', label: 'Interne Notiz vorhanden', erledigt: true },
      { id: 'pp-19', kategorie: 'intern', label: 'Freigabe durch Operator', erledigt: true, kritisch: true },
    ],
    anfrageFormularId: 'form-003',
    interessentFormularId: 'form-004',
    marktplatzStatus: 'veroeffentlicht',
    veroeffentlichtAm: '2026-05-20',
    ablaufDatum: '2027-03-31',
    veroeffentlichtVon: 'Jan Thomsen',
    interneNotiz: 'Sehr durchdachte Anfrage. Lars hat im Erstgespräch klar formuliert: kein Leadgenerator, sondern Partner. Aktive Suche bis März 2027. Produktunterlagen liegen bereits vor, deutsche Preislisten in Vorbereitung.',
    marktplatzDaten: {
      titel: 'Vertriebspartner für Fisch- und Backwarenspezialitäten in Norddeutschland gesucht',
      kurzbeschreibung: 'Dänischer Lebensmittelhersteller mit Schwerpunkt auf hochwertigen Fischprodukten und Backwaren sucht langfristigen Vertriebspartner für den norddeutschen LEH.',
      branche: 'Lebensmittel',
      richtung: 'dk_de',
      region: 'Norddeutschland (Hamburg, Schleswig-Holstein, Niedersachsen, Bremen)',
      wasSuche: 'Vertriebspartner oder Handelsagent mit bestehenden Kontakten zum LEH (Edeka Nord, Edeka Hamburg, Rewe Nord, Famila, regionale Großhändler)',
      warumGesucht: 'Wir möchten den deutschen Markt langfristig aufbauen — kein reiner Leadgenerator, sondern partnerschaftliche Begleitung des Markteintritts.',
      anforderungen: 'Mindestens 5 Jahre Erfahrung im LEH-Vertrieb, bestehende Kontakte zu Einkaufsabteilungen oder selbstständigen Kaufleuten, Bereitschaft zu langfristiger Zusammenarbeit.',
      persoenlicheNote: 'Wir glauben an Partnerschaften auf Augenhöhe und an die handwerkliche Qualität unserer Produkte. Wer dieselben Werte teilt, ist herzlich willkommen.',
      kulturHinweis: 'Dänischer Stil: direkt, ehrlich, partnerschaftlich. Persönliche Treffen vor formalen Verträgen.',
      funFact: 'Für Nordhavn Foods ist eine erste erfolgreiche Partnerschaft ein Anlass, den neuen Partner persönlich in Aalborg zu empfangen — mit einer Brauereiführung und natürlich den eigenen Fischprodukten am Tisch.',
      funFactFreigegeben: true,
      sichtbarkeit: 'oeffentlich',
      laufzeitMonate: 6,
      entwurfErstelltAm: '2026-05-18',
      letzteBearbeitungAm: '2026-05-20',
    },
    klaerungsBestaetigungen: {
      'anf-pnote':    { notiz: 'Erstgespräch geführt, persönlicher Hintergrund ist klar.', bestaetigtVon: 'Operator', bestaetigtAm: '2026-05-19' },
      'anf-anforder': { notiz: 'Anforderungen detailliert besprochen — LEH-Kontakte sind das Schlüsselkriterium.', bestaetigtVon: 'Operator', bestaetigtAm: '2026-05-19' },
      'anf-laufzeit': { notiz: 'Aktive Suche Sept. 2026 bis März 2027. Ziel: erste Partnerschaft innerhalb 6 Monaten.', bestaetigtVon: 'Operator', bestaetigtAm: '2026-05-20' },
    },
    // ── Marktplatz-Reichinhalt ──
    motivation: 'Nach erfolgreichen Aktivitäten in Dänemark möchten wir innerhalb der nächsten 12 Monate erste Vertriebspartnerschaften in Norddeutschland aufbauen. Die Marke ist im Heimatmarkt etabliert — jetzt ist der richtige Moment, die nächste Wachstumsphase zu starten.',
    ziele: [
      '2 bis 3 aktive Vertriebspartner in Norddeutschland',
      'Erste Listungen im LEH (Edeka Nord, Edeka Hamburg, Rewe Nord, Famila)',
      'Pilotregion Norddeutschland in den ersten 6 Monaten',
      'Langfristige Zusammenarbeit statt Lead-Verkauf',
    ],
    partnerErwartungen: [
      'Bestehende Kontakte zum Lebensmitteleinzelhandel',
      'Mindestens 5 Jahre Erfahrung im Food-Vertrieb',
      'Bereitschaft zu langfristiger partnerschaftlicher Zusammenarbeit',
      'Regionale Marktkenntnis (Norddeutschland, idealerweise Hamburg/SH/NI)',
      'Persönliche Treffen und direkte Kommunikation möglich',
    ],
    zielgruppe: [
      'Handelsagenten Food',
      'Food-Vertriebspartner',
      'LEH-Spezialisten',
      'Großhandelskontakte',
      'Import- und Distributionspartner',
    ],
    vorbereitung: {
      produktunterlagen: true,
      preislisten: false,
      zertifikate: true,
      produktproben: true,
      marketingmaterial: true,
      referenzen: true,
      webseiteDeutsch: false,
      notiz: 'Deutsche Preislisten in Vorbereitung (verfügbar bis Q4 2026). Deutsche Website in Planung.',
    },
    projektStartDatum: '2026-09-01',
    projektEndDatum: '2027-03-31',
    erstgespraechFristDatum: '2026-07-15',
    // ── Reifegrad ──
    reifegradScore: 8,
    reifegradBeschreibung: 'Gut vorbereitet — Produktunterlagen, Zertifikate und Marketingmaterial liegen vor. Deutsche Preislisten und Website werden derzeit erstellt. Partner für den Markteintritt können sofort mit konkreten Unterlagen versorgt werden.',
  },
];

// ─── INTERESSENTEN ───────────────────────────────────────────

export const MOCK_INTERESSENTEN: MockInteressent[] = [
  {
    id: 'int-nordconsult',
    anfrageId: 'anf-nordhavn',
    anfrageFirma: 'Nordhavn Foods A/S',
    firmenname: 'NordConsult Vertrieb GmbH',
    ansprechpartner: 'Michael Petersen',
    email: 'm.petersen@nordconsult-vertrieb.de',
    telefon: '+49 40 555 123 45',
    status: 'kontakt_erstellt',
    matchScore: 92,
    createdAt: '2026-06-01',
    notiz: 'Hochpassender Interessent — exakt die Erfahrung und das Netzwerk, das Lars sucht.',
    position: 'Geschäftsführer',
    website: 'https://www.nordconsult-vertrieb.de',
    linkedin: 'michael-petersen-nordconsult',
    land: 'deutschland',
    region: 'Hamburg / Norddeutschland',
    sprachen: ['deutsch', 'englisch'],
    bevorzugteSprache: 'deutsch',
    warumInteresse: 'Wir betreuen bereits mehrere Lebensmittelmarken im norddeutschen Raum und sehen eine sehr gute Passung zu unserem bestehenden Netzwerk. Insbesondere im Bereich Fischprodukte verfügen wir über Kontakte zu Einkaufsabteilungen und selbstständigen Kaufleuten innerhalb der Edeka-Gruppe.',
    warumPassung: 'Seit über 15 Jahren Vertrieb und Markteinführung von Lebensmittelmarken in Norddeutschland. Wir kennen die LEH-Strukturen, die Listungsprozesse und die Entscheidungsträger.',
    beitrag: 'Direkte Einführung in unser bestehendes LEH-Netzwerk (Edeka Nord, Edeka Hamburg, Famila, regionale Großhändler), Begleitung der Listungsgespräche, Marktbeobachtung und langfristige Betreuung.',
    erfahrung: '15+ Jahre Lebensmittelvertrieb in Norddeutschland. Vorherige Markteinführungen u.a. mit skandinavischen Fischprodukten und Premium-Backwaren.',
    referenzen: 'Mehrere etablierte skandinavische Marken im norddeutschen LEH. Referenzen können auf Anfrage genannt werden.',
    zusammenarbeit: 'Langfristige partnerschaftliche Zusammenarbeit — kein reines Lead-Geschäft, sondern Aufbau und Pflege der Marke im Markt.',
    interesseLevel: 'pilot',
    reaktionszeit: 'Sofort verfügbar',
    persoenlicheNote: 'Wir teilen die Werte von Nordhavn — Qualität, Verlässlichkeit und langfristige Beziehungen. Genau deswegen melden wir uns.',
    funFact: 'Unser Team isst tatsächlich am Freitag traditionell Fisch — das passt!',
    ersteindruck: 'sehr_gut',
    passung: 'hoch',
    seriositaet: 'geprueft',
    gespraechGefuehrt: true,
    websiteGeprueft: true,
    linkedinGeprueft: true,
    referenzenVorhanden: true,
    gespraechsnotiz: 'Telefonat 02.06.: Michael sehr engagiert, kennt den Markt detailliert, hat klare Vorstellungen wie ein Markteintritt für Nordhavn aussehen würde.',
    matchGruende: [
      'Exakt passende Branche (Food-Vertrieb)',
      'Zielregion (Hamburg / Norddeutschland) deckt sich mit Nordhavns Fokus',
      'Bestehende LEH-Kontakte (Edeka Nord, Hamburg, Famila) — Schlüsselkriterium der Anfrage',
      'Langjährige Erfahrung mit skandinavischen Lebensmittelmarken',
      'Bereit für langfristige Partnerschaft (kein Leadgenerator)',
    ],
    matchRisiken: [
      'Konkurrierende Marken im Portfolio prüfen — vorab klären, ob Exklusivität in Produktkategorie möglich',
    ],
    kontaktId: 'kon-nordconsult',
    formularId: 'form-004',
    formularAntworten: [
      { frageId: 'fa-1', frageText: 'Habt ihr Erfahrung mit Lebensmittelvertrieb?', wert: 'Ja, 15+ Jahre im norddeutschen LEH' },
      { frageId: 'fa-2', frageText: 'Habt ihr Kontakte zum Lebensmitteleinzelhandel?', wert: 'Ja: Edeka Nord, Edeka Hamburg, Famila, regionale Großhändler' },
      { frageId: 'fa-3', frageText: 'Welche Produktgruppen vertreibt ihr bereits?', wert: 'Skandinavische Fischprodukte, Premium-Backwaren, Spezialitäten' },
      { frageId: 'fa-4', frageText: 'Welche Regionen deckt ihr ab?', wert: 'Hamburg, Schleswig-Holstein, Niedersachsen, Bremen' },
      { frageId: 'fa-5', frageText: 'Habt ihr Referenzen im Food-Bereich?', wert: 'Ja — auf Anfrage' },
    ],
  },
];

// ─── MATCH-VORSCHLÄGE (NEU: mit DSGVO-Consent) ─────────────

export const MOCK_MATCH_VORSCHLAEGE: MatchVorschlag[] = [
  {
    id: 'match-nordhavn-nordconsult',
    anfrageId: 'anf-nordhavn',
    interessentId: 'int-nordconsult',
    kontaktId: 'kon-nordconsult',
    anfrageFirma: 'Nordhavn Foods A/S',
    anfrageBranche: 'Lebensmittel',
    interessentFirma: 'NordConsult Vertrieb GmbH',
    score: 92,
    gruende: [
      'Exakt passende Branche (Food-Vertrieb)',
      'Zielregion (Norddeutschland) deckt sich mit Nordhavns Fokus',
      'Bestehende LEH-Kontakte (Edeka Nord, Hamburg, Famila)',
      'Langjährige Erfahrung mit skandinavischen Lebensmittelmarken',
      'Bereit für langfristige Partnerschaft (kein Leadgenerator)',
    ],
    risiken: [
      'Konkurrierende Marken im Portfolio prüfen',
    ],
    status: 'vorschlag_erstellt',
    erstelltAm: '2026-06-05',
    erstelltVon: 'Operator',
    letzteAenderung: '2026-06-05',
  },
];

// Legacy (Abwärtskompatibilität)
export const MOCK_MATCHES: MockMatch[] = [
  {
    anfrageId: 'anf-nordhavn',
    anfrageFirma: 'Nordhavn Foods A/S',
    anfrageBranche: 'Lebensmittel',
    interessentId: 'int-nordconsult',
    interessentFirma: 'NordConsult Vertrieb GmbH',
    score: 92,
    grund: 'Exakt passende Branche (Food-Vertrieb), Zielregion (Norddeutschland), bestehende LEH-Kontakte (Edeka Nord, Hamburg, Famila), langjährige Vertriebserfahrung mit skandinavischen Marken.',
    status: 'erfolgreich',
  },
];

// ─── HELPER FUNCTIONS ────────────────────────────────────────

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    eingehend: 'Eingehend',
    aktiv: 'Aktiv',
    interessent_vorhanden: 'Interessent vorhanden',
    mehrere_interessenten: 'Mehrere Interessenten',
    kontakt_laeuft: 'Kontakt läuft',
    vermittelt: 'Vermittelt',
    stalled: 'Stillstand',
    pausiert: 'Pausiert',
    archiviert: 'Archiviert',
    neu: 'Neu',
    freigegeben: 'Freigegeben',
    feedback_ausstehend: 'Feedback ausstehend',
    erfolgreich: 'Erfolgreich',
    spam: 'Spam',
    unqualifiziert: 'Unqualifiziert',
    abgelehnt: 'Abgelehnt',
    vorgeschlagen: 'Vorgeschlagen',
    in_pruefung: 'In Prüfung',
    rueckfrage: 'Rückfrage erforderlich',
    nicht_passend: 'Nicht passend',
    kontakt_erstellt: 'Kontakt erstellt',
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    eingehend: '#2196F3',
    aktiv: '#4CAF50',
    interessent_vorhanden: '#FF9900',
    mehrere_interessenten: '#FF9900',
    kontakt_laeuft: '#9C27B0',
    vermittelt: '#4CAF50',
    stalled: '#f44336',
    pausiert: '#999',
    archiviert: '#666',
    neu: '#2196F3',
    freigegeben: '#4CAF50',
    feedback_ausstehend: '#FF9900',
    erfolgreich: '#4CAF50',
    spam: '#f44336',
    unqualifiziert: '#999',
    abgelehnt: '#f44336',
    vorgeschlagen: '#2196F3',
    in_pruefung: '#FF9900',
    rueckfrage: '#FF5722',
    nicht_passend: '#999',
    kontakt_erstellt: '#2e7d32',
  };
  return colors[status] || '#999';
}

export function getRichtungLabel(richtung: string): string {
  return richtung === 'de_dk' ? '🇩🇪 → 🇩🇰' : '🇩🇰 → 🇩🇪';
}

export function getVerifizierungsLabel(status: string): string {
  const labels: Record<string, string> = {
    unbekannt: 'Unbekannt',
    in_pruefung: 'In Prüfung',
    verifiziert: 'Verifiziert',
    abgelehnt: 'Abgelehnt',
  };
  return labels[status] || status;
}

export function getVerifizierungsColor(status: string): string {
  const colors: Record<string, string> = {
    unbekannt: '#999',
    in_pruefung: '#FF9900',
    verifiziert: '#4CAF50',
    abgelehnt: '#f44336',
  };
  return colors[status] || '#999';
}

export function getNetzwerkLabel(status: string): string {
  const labels: Record<string, string> = {
    interessiert: 'Interessiert',
    aktiv: 'Aktiv',
    partner: 'Partner',
    pausiert: 'Pausiert',
    inaktiv: 'Inaktiv',
  };
  return labels[status] || status;
}

export function getNetzwerkColor(status: string): string {
  const colors: Record<string, string> = {
    interessiert: '#2196F3',
    aktiv: '#4CAF50',
    partner: '#9C27B0',
    pausiert: '#999',
    inaktiv: '#ccc',
  };
  return colors[status] || '#999';
}

export function getGroesseLabel(groesse: string): string {
  const labels: Record<string, string> = {
    solo: 'Solo (1)',
    klein: 'Klein (2–10)',
    mittel: 'Mittel (11–50)',
    gross: 'Groß (51–250)',
    konzern: 'Konzern (250+)',
  };
  return labels[groesse] || groesse;
}

export function getLandFlag(land: string): string {
  const flags: Record<string, string> = {
    deutschland: '🇩🇪',
    daenemark: '🇩🇰',
    andere: '🌍',
  };
  return flags[land] || '🌍';
}

// ─── EVENTS ──────────────────────────────────────────────────

export interface MockEvent_Full {
  id: string;
  titel: string;
  untertitel?: string;
  beschreibung: string;
  typ: string;
  datum: string;
  uhrzeit: string;
  ort: string;
  land: string;
  veranstalter: string;
  status: string;
  maxTeilnehmer: number;
  sprache: string;
  ziele: string[];
  teilnehmer: MockEventTeilnehmer[];
  feedback: MockEventFeedback[];
  matches: MockEventMatch[];
}

export interface MockEventTeilnehmer {
  id: string;
  firmenname: string;
  ansprechpartner: string;
  email: string;
  land: string;
  status: string;
  warteliste: boolean;
  rolle?: string;
  erschienen: boolean;
}

export interface MockEventFeedback {
  id: string;
  firmenname: string;
  bewertung: number;
  wiederTeilnehmen: boolean;
  neueKontakteGeknuepft: boolean;
  kooperationEntstanden: boolean;
  kommentar?: string;
  verbesserungsvorschlag?: string;
}

export interface MockEventMatch {
  id: string;
  firma1Name: string;
  firma2Name: string;
  vermitteltDurch?: string;
  notiz?: string;
  folgekontakt: boolean;
  kooperation: boolean;
  kooperationsArt?: string;
}

export const MOCK_EVENTS: MockEvent_Full[] = [];

export function getEventTypLabel(typ: string): string {
  const labels: Record<string, string> = {
    pitch_and_meet: 'Pitch & Meet',
    blind_matchmaking: 'Blind Matchmaking',
    breakfast_networking: 'No-Bullshit Breakfast',
    failure_night: 'Failure Night',
    reverse_networking: 'Reverse Networking',
    problem_solving: 'Bring ein Problem',
    walk_and_talk: 'Walk & Talk',
    betriebsbesichtigung: 'Betriebsbesichtigung',
    branchentag: 'Branchentag',
    connect_in_car: 'Connect in Car',
    online_webinar: 'Online Webinar',
    sonstiges: 'Sonstiges',
  };
  return labels[typ] || typ;
}

export function getEventTypIcon(typ: string): string {
  const icons: Record<string, string> = {
    pitch_and_meet: '🎤',
    blind_matchmaking: '🎭',
    breakfast_networking: '☕',
    failure_night: '💥',
    reverse_networking: '🔄',
    problem_solving: '💡',
    walk_and_talk: '🚶',
    betriebsbesichtigung: '🏭',
    branchentag: '📅',
    connect_in_car: '🚗',
    online_webinar: '💻',
    sonstiges: '📌',
  };
  return icons[typ] || '📌';
}

export function getEventStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    geplant: 'Geplant',
    veroeffentlicht: 'Veröffentlicht',
    ausgebucht: 'Ausgebucht',
    durchgefuehrt: 'Durchgeführt',
    abgesagt: 'Abgesagt',
  };
  return labels[status] || status;
}

export function getEventStatusColor(status: string): string {
  const colors: Record<string, string> = {
    geplant: '#2196F3',
    veroeffentlicht: '#4CAF50',
    ausgebucht: '#FF9900',
    durchgefuehrt: '#9C27B0',
    abgesagt: '#f44336',
  };
  return colors[status] || '#999';
}

export function getEventZielLabel(ziel: string): string {
  const labels: Record<string, string> = {
    matchmaking: 'Matchmaking',
    wissenstransfer: 'Wissenstransfer',
    markteintritt: 'Markteintritt',
    netzwerk: 'Netzwerk',
    kulturverstaendnis: 'Kulturverständnis',
    inspiration: 'Inspiration',
  };
  return labels[ziel] || ziel;
}

export function getTeilnehmerStatusColor(status: string): string {
  const colors: Record<string, string> = {
    angemeldet: '#2196F3',
    bestaetigt: '#4CAF50',
    erschienen: '#9C27B0',
    abgesagt: '#f44336',
    warteliste: '#FF9900',
  };
  return colors[status] || '#999';
}

export function getEventFormatLabel(format: string): string {
  const labels: Record<string, string> = {
    pitch_and_meet: 'Pitch & Meet',
    betriebsbesichtigung: 'Betriebsbesichtigung',
    branchentag: 'Branchentag',
    connect_in_car: 'Connect in Car',
    netzwerktreffen: 'Netzwerktreffen',
    interview: 'Interview',
    sonstiges: 'Sonstiges',
  };
  return labels[format] || format;
}
