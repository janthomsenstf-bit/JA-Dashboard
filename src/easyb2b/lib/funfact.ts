// =============================================================
// FUNFACT & KULTUR-MODUL für Easy-B2B Dashboard
// "Menschen vor Geschäft"
// =============================================================

// ─── FUNFACT-FRAGEN ──────────────────────────────────────────

export interface FunFactFrage {
  id: string;
  frage: string;
  kategorie: 'kooperation' | 'kultur' | 'persoenlich' | 'spass';
  beispiel: string;
}

export const FUNFACT_FRAGEN: FunFactFrage[] = [
  {
    id: 'ff-01',
    frage: 'Wie würdet ihr eine erfolgreiche Kooperation feiern?',
    kategorie: 'kooperation',
    beispiel: 'Mit einem gemeinsamen Abendessen – am liebsten halb deutsch, halb dänisch.',
  },
  {
    id: 'ff-02',
    frage: 'Wohin würde euer erstes gemeinsames Team-Event gehen?',
    kategorie: 'kooperation',
    beispiel: 'Irgendwo an die Küste – zwischen Flensburg und Kolding passt das gut.',
  },
  {
    id: 'ff-03',
    frage: 'Was wäre euer Ritual nach einem erfolgreichen Deal?',
    kategorie: 'kooperation',
    beispiel: 'Kurz Pause, dann direkt zum nächsten Projekt.',
  },
  {
    id: 'ff-04',
    frage: 'Kaffee, Bier oder Smørrebrød beim ersten Treffen?',
    kategorie: 'kultur',
    beispiel: 'Kaffee zum Start, Bier zum Abschluss.',
  },
  {
    id: 'ff-05',
    frage: 'Was sollte ein Partner über eure Arbeitsweise wissen?',
    kategorie: 'persoenlich',
    beispiel: 'Wir reden lieber einmal zu viel als einmal zu wenig.',
  },
  {
    id: 'ff-06',
    frage: 'Was verbindet euch mit Dänemark/Deutschland?',
    kategorie: 'kultur',
    beispiel: 'Wir lieben die direkte, ehrliche Art der Dänen.',
  },
  {
    id: 'ff-07',
    frage: 'Welcher Song beschreibt eure Zusammenarbeit?',
    kategorie: 'spass',
    beispiel: '"We Are the Champions" – aber auf Dänisch gesungen.',
  },
  {
    id: 'ff-08',
    frage: 'Was wäre euer Maskottchen als Kooperation?',
    kategorie: 'spass',
    beispiel: 'Ein Wikinger mit Aktentasche.',
  },
  {
    id: 'ff-09',
    frage: 'Was macht eine Zusammenarbeit für euch menschlich?',
    kategorie: 'persoenlich',
    beispiel: 'Wenn man auch mal über Privates reden kann.',
  },
  {
    id: 'ff-10',
    frage: 'Wie trefft ihr Entscheidungen als Unternehmen?',
    kategorie: 'persoenlich',
    beispiel: 'Schnell und pragmatisch – lange Meetings liegen uns nicht.',
  },
];

// ─── KULTUR-HINWEISE ─────────────────────────────────────────

export interface KulturHinweis {
  id: string;
  text: string;
  land: 'deutschland' | 'daenemark' | 'beide';
  typ: 'kommunikation' | 'entscheidung' | 'beziehung' | 'sprache' | 'stil';
}

export const KULTUR_HINWEISE: KulturHinweis[] = [
  { id: 'kh-01', text: 'Bevorzugt direkte, unkomplizierte Kommunikation', land: 'daenemark', typ: 'kommunikation' },
  { id: 'kh-02', text: 'Trifft Entscheidungen eher schnell und pragmatisch', land: 'daenemark', typ: 'entscheidung' },
  { id: 'kh-03', text: 'Legt Wert auf persönliche Beziehung vor dem Geschäft', land: 'beide', typ: 'beziehung' },
  { id: 'kh-04', text: 'Strukturierte Unterlagen und klare Agenda werden erwartet', land: 'deutschland', typ: 'stil' },
  { id: 'kh-05', text: 'Spricht lieber Englisch als die Muttersprache des Partners', land: 'beide', typ: 'sprache' },
  { id: 'kh-06', text: 'Informeller Umgang, duzen von Anfang an', land: 'daenemark', typ: 'kommunikation' },
  { id: 'kh-07', text: 'Braucht mehr Zeit für interne Abstimmung', land: 'deutschland', typ: 'entscheidung' },
  { id: 'kh-08', text: 'Humor und Leichtigkeit im Gespräch willkommen', land: 'daenemark', typ: 'kommunikation' },
  { id: 'kh-09', text: 'Schätzt Pünktlichkeit und Verlässlichkeit sehr', land: 'deutschland', typ: 'stil' },
  { id: 'kh-10', text: 'Networking-Events wichtiger als formelle Meetings', land: 'beide', typ: 'beziehung' },
];

export function getKommunikationStilLabel(stil: string): string {
  const labels: Record<string, string> = {
    direkt_informell: 'Direkt & informell',
    strukturiert_formal: 'Strukturiert & formal',
    offen_herzlich: 'Offen & herzlich',
    zurueckhaltend: 'Zurückhaltend',
    digital_bevorzugt: 'Digital bevorzugt',
    persoenlich_bevorzugt: 'Persönlich bevorzugt',
  };
  return labels[stil] || stil;
}

export function getKommunikationStilIcon(stil: string): string {
  const icons: Record<string, string> = {
    direkt_informell: '💬',
    strukturiert_formal: '📋',
    offen_herzlich: '🤗',
    zurueckhaltend: '🤫',
    digital_bevorzugt: '💻',
    persoenlich_bevorzugt: '🤝',
  };
  return icons[stil] || '💬';
}

export function getFunFactFrageById(id: string): FunFactFrage | undefined {
  return FUNFACT_FRAGEN.find(f => f.id === id);
}

// ─── KI-FUNKTION: FUNFACT VERBESSERN ─────────────────────────
// Simuliert KI-Verbesserung (später mit Anthropic API verbinden)

export function verbessereAntwortMock(
  frage: string,
  rohAntwort: string,
  firmenname: string
): string {
  // Einfache Mock-Transformation — zeigt das Konzept
  // In Produktion: Anthropic API-Aufruf mit dem Prompt unten

  const starters = [
    `Bei ${firmenname} ist das ganz klar:`,
    `Für uns bei ${firmenname} gilt:`,
    `Wenn man uns bei ${firmenname} fragt:`,
    `Typisch ${firmenname}:`,
  ];

  const endings = [
    ' – und das ist keine Floskel.',
    ' Das klingt vielleicht simpel, aber es steckt viel dahinter.',
    ' Und das meinen wir wirklich so.',
    '',
  ];

  const starter = starters[Math.floor(Math.random() * starters.length)];
  const ending = endings[Math.floor(Math.random() * endings.length)];

  // Rohtext etwas aufräumen (Großschreibung, Satzzeichen)
  const clean = rohAntwort.trim();
  const sentence = clean.charAt(0).toLowerCase() + clean.slice(1);
  const withDot = sentence.endsWith('.') || sentence.endsWith('!') ? sentence : sentence + '.';

  return `${starter} ${withDot}${ending}`;
}

// ─── KI-PROMPT (für echte Anthropic-Integration) ─────────────

export const KI_FUNFACT_PROMPT = `
Du hilfst dem Easy-B2B-Team, rohe FunFact-Antworten von Unternehmen
sympathisch und professionell umzuformulieren.

Ziel: Menschlich, leicht, kurz (max. 2 Sätze), nicht werbend.
Ton: Norddeutsch-direkt, ehrlich, ein wenig Humor erlaubt.
Nicht: Marketing-Sprache, Superlative, Klischees.

Frage: {{FRAGE}}
Firmenname: {{FIRMA}}
Rohantwort: {{ANTWORT}}

Bitte formuliere diese Antwort so um, dass sie auf einem Marktplatz-Eintrag
oder in einer Intro-Mail sympathisch wirkt. Max. 2 Sätze.
`;

// ─── GESPRÄCHSEINSTIEG GENERIEREN ────────────────────────────

export function generiereGespraechseinstieg(
  funFactFrage: string,
  funFactAntwort: string,
  firmenname: string
): string {
  return `Gesprächseinstieg für ${firmenname}: Auf unsere Frage "${funFactFrage}" haben sie geantwortet: "${funFactAntwort}" – ein guter Anknüpfungspunkt für das erste Gespräch.`;
}

// ─── INTRO-MAIL SNIPPET ──────────────────────────────────────

export function generiereIntroMailSnippet(
  funFactAntwortKI: string | undefined,
  kulturHinweis: string | undefined
): string {
  const teile: string[] = [];

  if (funFactAntwortKI) {
    teile.push(`Damit Sie schon etwas über das Unternehmen wissen: ${funFactAntwortKI}`);
  }

  if (kulturHinweis) {
    teile.push(`Hinweis zur Zusammenarbeit: ${kulturHinweis}`);
  }

  return teile.join('\n\n');
}
