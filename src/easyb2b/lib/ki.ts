// =============================================================
// KI-ZENTRALE — Easy-B2B Dashboard
// Mock-Funktionen + Anthropic API Prompts
// Jede Funktion ist API-ready: Prompt ersetzen, Mock entfernen
// =============================================================

// ─── ANTHROPIC API PROMPT-VORLAGE ────────────────────────────

export const SYSTEM_PROMPT = `
Du bist der KI-Assistent von Easy-B2B, einem deutsch-dänischen Matchmaking-Netzwerk.

ÜBER EASY-B2B:
- Kein klassisches Leadportal, sondern ein kuratiertes Vertrauensnetzwerk
- Persönliche Vermittlung von deutsch-dänischen Unternehmenskooperationen
- Werte: Vertrauen, Ehrlichkeit, Menschlichkeit, Direktheit
- Zielgruppe: KMU in Deutschland und Dänemark

SPRACHREGELN (EASY-B2B VOICE):
✓ Norddeutsch-direkt, klar, ehrlich
✓ Menschlich: "Unternehmen" und "Menschen", nicht "Leads"
✓ Konkret, kein Blabla, keine Superlative
✓ Max. 2-3 Sätze für Hauptaussagen
✗ KEIN Marketing-Deutsch ("innovativ", "ganzheitlich", "Mehrwert")
✗ KEINE Buzzwords ("synergistisch", "disruptiv", "skalierbar")
✗ KEIN Startup-Sprech
✗ Jan Thomsen steht NICHT im Mittelpunkt — Easy-B2B schon
`;

// ─── TOOL 1: ANFRAGE VERBESSERN ──────────────────────────────

export const PROMPT_ANFRAGE_VERBESSERN = `
${SYSTEM_PROMPT}

AUFGABE: Wandle die folgende Rohfassung einer Anfrage in eine strukturierte Easy-B2B-Anfrage um.

FORMAT DER AUSGABE:
1. **Ziel** (1 Satz, was wird konkret gesucht)
2. **Ausgangssituation** (2-3 Sätze, wer ist das Unternehmen, was machen sie)
3. **Gesuch** (konkret, was wird gesucht)
4. **Was wir mitbringen** (Mehrwert für den Partner)
5. **Musterhaves** (was muss ein Partner mitbringen)
6. **Marktplatz-Version** (öffentliche, anonymisierte Kurzversion, max. 2 Sätze)

Rohtext: {{ROHTEXT}}
Branche: {{BRANCHE}}
Richtung: {{RICHTUNG}}
`;

export async function verbessereAnfrageMock(
  rohtext: string,
  branche: string,
  richtung: string
): Promise<AnfrageVerbesserungResult> {
  await simulateDelay(1400);

  const isDK = richtung === 'dk_de';
  const herkunft = isDK ? 'dänisches' : 'deutsches';
  const ziel = isDK ? 'deutschen' : 'dänischen';

  return {
    ziel: `Ein ${herkunft} Unternehmen aus dem Bereich ${branche} sucht einen ${ziel} Vertriebs- oder Kooperationspartner.`,
    ausgangssituation: `Das Unternehmen ist in ${branche} tätig und verfügt über ein etabliertes Produkt- oder Dienstleistungsangebot. Der Einstieg in den ${ziel.replace('en', '')}en Markt ist konkret geplant, ein lokaler Partner wird gesucht, der die Marktstrukturen kennt.`,
    gesuch: rohtext.trim().endsWith('.') ? rohtext.trim() : rohtext.trim() + '.',
    mitbringen: `Langjährige Erfahrung im Heimatmarkt, ein gut positioniertes Produkt und klare Vorstellungen von der Zusammenarbeit.`,
    mustHaves: `Erfahrung im ${branche}-Bereich, Kenntnis des ${ziel}en Marktes, Interesse an langfristiger Kooperation.`,
    marktplatzVersion: `${herkunft.charAt(0).toUpperCase() + herkunft.slice(1)} Unternehmen aus ${branche} sucht ${ziel}en Partner für Markteinstieg und Vertrieb.`,
    interneVersion: `[INTERN] Rohtext wurde strukturiert. Bitte Unternehmensdaten ergänzen und Kontaktperson verifizieren.`,
  };
}

export interface AnfrageVerbesserungResult {
  ziel: string;
  ausgangssituation: string;
  gesuch: string;
  mitbringen: string;
  mustHaves: string;
  marktplatzVersion: string;
  interneVersion: string;
}

// ─── TOOL 2: INTRO-MAIL GENERATOR ────────────────────────────

export const PROMPT_INTRO_MAIL = `
${SYSTEM_PROMPT}

AUFGABE: Erstelle eine Einführungsmail für zwei Unternehmen, die über Easy-B2B vermittelt werden.

FORMAT:
- Betreff: Knapp, konkret (kein "Kooperationsmöglichkeit")
- Ansprache: Persönlich (Vorname wenn möglich)
- Einleitung: Wer schreibt, warum
- Verbindung: Warum passen die beiden zusammen?
- FunFact (optional): Menschliche Note
- Nächste Schritte: Konkreter Vorschlag für ersten Schritt
- Abschluss: Kurz, warm, nicht förmlich

Sprache: {{SPRACHE}}
Firma 1: {{FIRMA1}}
Firma 2: {{FIRMA2}}
Kontext: {{KONTEXT}}
FunFact: {{FUNFACT}}
`;

export async function generiereIntroMailMock(
  firma1: string,
  firma2: string,
  kontext: string,
  sprache: 'de' | 'dk' | 'en',
  funFact?: string
): Promise<IntroMailResult> {
  await simulateDelay(1600);

  const mails: Record<'de' | 'dk' | 'en', IntroMailResult> = {
    de: {
      betreff: `${firma1} × ${firma2} – auf dem Weg zur Zusammenarbeit`,
      anrede: `Guten Tag,`,
      intro: `ich freue mich, Sie über Easy-B2B miteinander bekannt zu machen.`,
      verbindung: `${kontext} Ich halte diese Verbindung für vielversprechend – nicht nur auf dem Papier, sondern weil beide Seiten eine ähnliche Herangehensweise an Kooperationen haben.`,
      funFactBlock: funFact ? `\nEine kleine persönliche Note vorweg: ${funFact}\n` : '',
      naechsteSchritte: `Ich schlage vor, dass Sie sich zunächst zu einem kurzen Gespräch von 20–30 Minuten zusammenfinden – per Video oder telefonisch. Bei Interesse melde ich gerne den nächsten Schritt.`,
      abschluss: `Mit herzlichen Grüßen aus der deutsch-dänischen Grenzregion,\nJan Thomsen\nEasy-B2B`,
    },
    dk: {
      betreff: `${firma1} × ${firma2} – en intro via Easy-B2B`,
      anrede: `Hej,`,
      intro: `Jeg er glad for at introducere jer til hinanden via Easy-B2B.`,
      verbindung: `${kontext} Jeg ser et godt match her – ikke bare fagligt, men fordi I begge nærmer jer samarbejde på en lignende måde.`,
      funFactBlock: funFact ? `\nEn lille personlig note: ${funFact}\n` : '',
      naechsteSchritte: `Jeg foreslår, at I finder et tidspunkt til en kort snak på 20–30 minutter – gerne online. Sig til, hvis I vil gå videre.`,
      abschluss: `Med venlig hilsen,\nJan Thomsen\nEasy-B2B`,
    },
    en: {
      betreff: `${firma1} × ${firma2} – an introduction via Easy-B2B`,
      anrede: `Dear all,`,
      intro: `I'm happy to introduce you to each other through Easy-B2B.`,
      verbindung: `${kontext} I believe this could be a strong match – not just on paper, but because you share a similar mindset when it comes to collaboration.`,
      funFactBlock: funFact ? `\nA small personal note: ${funFact}\n` : '',
      naechsteSchritte: `I'd suggest starting with a short 20–30 minute intro call. Let me know if you'd like me to set something up.`,
      abschluss: `Kind regards,\nJan Thomsen\nEasy-B2B`,
    },
  };

  return mails[sprache];
}

export interface IntroMailResult {
  betreff: string;
  anrede: string;
  intro: string;
  verbindung: string;
  funFactBlock: string;
  naechsteSchritte: string;
  abschluss: string;
}

export function formatIntroMail(mail: IntroMailResult): string {
  return `Betreff: ${mail.betreff}\n\n${mail.anrede}\n\n${mail.intro}\n\n${mail.verbindung}${mail.funFactBlock}\n${mail.naechsteSchritte}\n\n${mail.abschluss}`;
}

// ─── TOOL 3: LINKEDIN-GENERATOR ──────────────────────────────

export const PROMPT_LINKEDIN = `
${SYSTEM_PROMPT}

AUFGABE: Erstelle einen LinkedIn-Beitrag für Easy-B2B.

STILE:
- kurz: 3-4 Sätze, ein Hook, keine Hashtags
- standard: 6-8 Sätze, Struktur, max. 3 Hashtags
- story: Narrativ, 10-12 Sätze, emotionaler Einstieg

Typ: {{TYP}} (anfrage/event/story/netzwerk)
Stil: {{STIL}} (kurz/standard/story)
Inhalt: {{INHALT}}
`;

export async function generiereLinkedInPostMock(
  inhalt: string,
  typ: string,
  stil: 'kurz' | 'standard' | 'story'
): Promise<LinkedInResult> {
  await simulateDelay(1200);

  const hooks: Record<string, string> = {
    anfrage: '🤝 Wer kennt wen?',
    event: '🎤 Es war wieder soweit.',
    story: '🎯 Das passiert, wenn zwei Unternehmen wirklich zusammenpassen.',
    netzwerk: '🌍 Deutsch-dänisch. Nicht weit, aber manchmal noch zu weit.'
  };

  const hook = hooks[typ] || '🤝 Eine Geschichte aus dem Netzwerk.';

  const posts: Record<'kurz' | 'standard' | 'story', LinkedInResult> = {
    kurz: {
      text: `${hook}\n\n${inhalt.slice(0, 120)}.\n\nWer hat ähnliche Erfahrungen gemacht?`,
      zeichenAnzahl: 180,
      hashtags: [],
    },
    standard: {
      text: `${hook}\n\n${inhalt}\n\nGenau dafür ist Easy-B2B da. Persönlich. Direkt. Deutsch-dänisch.\n\nWer mehr erfahren möchte: Link im Kommentar.`,
      zeichenAnzahl: inhalt.length + 120,
      hashtags: ['#EasyB2B', '#DeutschDänisch', '#Matchmaking'],
    },
    story: {
      text: `${hook}\n\n${inhalt}\n\nEs fing klein an. Mit einem Gespräch. Einem ehrlichen.\n\nDas ist die Art von Kooperation, die trägt. Nicht weil ein Algorithmus sie gemacht hat – sondern weil zwei Menschen sich wirklich verstanden haben.\n\nDas ist Easy-B2B.`,
      zeichenAnzahl: inhalt.length + 280,
      hashtags: ['#EasyB2B', '#DeutschDänisch', '#Netzwerk', '#KMU'],
    },
  };

  return posts[stil];
}

export interface LinkedInResult {
  text: string;
  zeichenAnzahl: number;
  hashtags: string[];
}

// ─── TOOL 4: VOICE-CHECK ─────────────────────────────────────

export const PROMPT_VOICE_CHECK = `
${SYSTEM_PROMPT}

AUFGABE: Prüfe den folgenden Text auf Easy-B2B Voice-Konformität.

PRÜFKRITERIEN:
1. Marketing-Deutsch (innovativ, ganzheitlich, Mehrwert, etc.)
2. Buzzwords (disruptiv, skalierbar, agil, etc.)
3. Jan Thomsen im Mittelpunkt statt Easy-B2B
4. Zu lange Sätze (>25 Wörter)
5. Passive Formulierungen
6. Klingt es menschlich oder corporate?

AUSGABE: Bewertung 0-100, Probleme mit Zeilen, Verbesserungsvorschläge

Text: {{TEXT}}
`;

export async function pruefeVoiceMock(text: string): Promise<VoiceCheckResult> {
  await simulateDelay(1000);

  const probleme: VoiceProblem[] = [];
  let score = 100;

  const buzzwords = ['innovativ', 'ganzheitlich', 'mehrwert', 'nachhaltig', 'synerg', 'disruptiv', 'skalier', 'agil', 'transformier', 'optimier'];
  const marketingWoerter = ['Lösung', 'Solutions', 'Premium', 'exklusiv', 'führend', 'beste', 'einzigartig'];
  const ichBezug = ['ich bin', 'ich habe', 'mein Unternehmen', 'Jan Thomsen hat'];

  for (const bw of buzzwords) {
    if (text.toLowerCase().includes(bw)) {
      probleme.push({ typ: 'buzzword', text: `Buzzword erkannt: "${bw}"`, schwere: 'mittel', vorschlag: `Ersetzen durch konkrete Beschreibung.` });
      score -= 12;
    }
  }

  for (const mw of marketingWoerter) {
    if (text.includes(mw)) {
      probleme.push({ typ: 'marketing', text: `Marketing-Sprache: "${mw}"`, schwere: 'leicht', vorschlag: `Direkter formulieren.` });
      score -= 8;
    }
  }

  for (const ich of ichBezug) {
    if (text.toLowerCase().includes(ich.toLowerCase())) {
      probleme.push({ typ: 'ich_fokus', text: `Fokus auf Person statt Netzwerk`, schwere: 'schwer', vorschlag: `"Easy-B2B" statt "Jan Thomsen" oder "Ich"` });
      score -= 15;
    }
  }

  const saetze = text.split(/[.!?]/).filter(s => s.trim().length > 0);
  const langeSaetze = saetze.filter(s => s.trim().split(' ').length > 25);
  if (langeSaetze.length > 0) {
    probleme.push({ typ: 'laenge', text: `${langeSaetze.length} zu langer Satz/Sätze (>25 Wörter)`, schwere: 'leicht', vorschlag: `Sätze aufteilen.` });
    score -= 8;
  }

  score = Math.max(0, score);

  const empfehlung = score >= 80
    ? 'Text klingt gut nach Easy-B2B. Kleine Anpassungen können noch helfen.'
    : score >= 60
    ? 'Text hat Potenzial, aber einige Formulierungen wirken zu corporate. Anpassungen empfohlen.'
    : 'Text entspricht nicht dem Easy-B2B Voice. Überarbeitung empfohlen.';

  return { score, probleme, empfehlung, wortanzahl: text.split(' ').length };
}

export interface VoiceCheckResult {
  score: number;
  probleme: VoiceProblem[];
  empfehlung: string;
  wortanzahl: number;
}

export interface VoiceProblem {
  typ: 'buzzword' | 'marketing' | 'ich_fokus' | 'laenge' | 'passiv';
  text: string;
  schwere: 'leicht' | 'mittel' | 'schwer';
  vorschlag: string;
}

// ─── TOOL 5: KULTUR-ASSISTENT ─────────────────────────────────

export const PROMPT_KULTUR = `
${SYSTEM_PROMPT}

AUFGABE: Gib kulturelle Hinweise für eine deutsch-dänische Zusammenarbeit.

Liefere:
1. Kommunikationsstil-Unterschiede
2. Meeting-Kultur
3. Entscheidungsprozesse
4. Typische Missverständnisse
5. Empfehlung für diesen spezifischen Kontext

Kontext: {{KONTEXT}}
Firma Deutschland: {{FIRMA_DE}}
Firma Dänemark: {{FIRMA_DK}}
`;

export const KULTUR_HINWEISE_DATENBANK = [
  {
    kategorie: 'Kommunikation',
    icon: '💬',
    deutsch: 'Strukturiert, schriftlich, präzise. Lange E-Mails mit Anhängen.',
    daenisch: 'Direkt, informell, oft per Telefon oder kurze Nachrichten.',
    tipp: 'Dänen interpretieren lange Einleitungen als Unsicherheit. Deutsche interpretieren kurze Mails als Respektlosigkeit. Goldener Weg: kurz und freundlich, mit klarem Ziel.',
  },
  {
    kategorie: 'Meeting-Kultur',
    icon: '🤝',
    deutsch: 'Agenda vorab, Pünktlichkeit wichtig, Protokoll danach.',
    daenisch: 'Lockerere Struktur, Gespräch wichtiger als Agenda, Zeit ist flexibler.',
    tipp: 'Immer eine kurze Agenda schicken — aber darauf gefasst sein, dass das Meeting trotzdem anders läuft. Das ist ok.',
  },
  {
    kategorie: 'Entscheidungen',
    icon: '✅',
    deutsch: 'Mehrstufige Entscheidungsprozesse, viele Abstimmungen intern.',
    daenisch: 'Oft schnelle Entscheidungen auf niedrigen Hierarchieebenen möglich.',
    tipp: 'Dänische Partner können frustriert werden, wenn deutsche Seite immer "erst intern abstimmen" muss. Frühzeitig kommunizieren, welche Entscheidungen wann kommen.',
  },
  {
    kategorie: 'Hierarchie',
    icon: '🏢',
    deutsch: 'Klare Hierarchien, Titel sind wichtig, Respekt gegenüber Vorgesetzten.',
    daenisch: 'Sehr flache Hierarchien, Vorname auch mit dem Chef, Meinung zählt unabhängig von Position.',
    tipp: 'Beim ersten Treffen nicht überrascht sein, wenn der dänische CEO im T-Shirt erscheint und "Lars" genannt werden möchte.',
  },
  {
    kategorie: 'Fehlerkultur',
    icon: '💥',
    deutsch: 'Fehler werden eher vermieden als offen kommuniziert.',
    daenisch: 'Fehler offen ansprechen gilt als professionell, nicht als Schwäche.',
    tipp: 'Dänische Partner schätzen es, wenn Probleme früh angesprochen werden. "Das ist nicht so gut gelaufen" ist für sie kein Drama — es ist Normalität.',
  },
  {
    kategorie: 'Smalltalk',
    icon: '☕',
    deutsch: 'Wenig Smalltalk vor Business. Direkt zum Punkt.',
    daenisch: 'Hygge — persönliche Wärme vor dem Business. Familie, Wetter, Urlaub.',
    tipp: '5 Minuten persönliches Gespräch am Anfang zahlen sich aus. Dänen entscheiden oft: "Mag ich diese Person?" — bevor sie entscheiden: "Ist das ein gutes Angebot?"',
  },
];

export async function generiereKulturTippsMock(
  kontextStichwort: string,
  kategorien: string[]
): Promise<KulturTippsResult> {
  await simulateDelay(900);

  const relevante = kategorien.length > 0
    ? KULTUR_HINWEISE_DATENBANK.filter(k => kategorien.includes(k.kategorie))
    : KULTUR_HINWEISE_DATENBANK;

  return {
    hinweise: relevante,
    gesamtempfehlung: `Für eine erfolgreiche deutsch-dänische Zusammenarbeit im Kontext "${kontextStichwort || 'Allgemein'}": Direktheit schätzen, Hierarchien lockern, persönliche Note nicht vergessen. Die Grenzregion ist ein Vorteil — nutze sie als gemeinsame Identität, nicht als Barriere.`,
  };
}

export interface KulturTippsResult {
  hinweise: typeof KULTUR_HINWEISE_DATENBANK;
  gesamtempfehlung: string;
}

// ─── TOOL 6: MATCHING-ASSISTENT ──────────────────────────────

export const PROMPT_MATCHING = `
${SYSTEM_PROMPT}

AUFGABE: Analysiere, ob zwei Unternehmen zusammenpassen.

AUSGABE:
1. Match-Score (0–100) mit Begründung
2. Stärken der Verbindung
3. Potenzielle Risiken
4. Empfohlene Gesprächseinstiege
5. Mögliche Synergien

Unternehmen 1: {{FIRMA1}}
Branche 1: {{BRANCHE1}}
Gesuch 1: {{GESUCH1}}

Unternehmen 2: {{FIRMA2}}
Branche 2: {{BRANCHE2}}
Angebot 2: {{ANGEBOT2}}
`;

export async function analysiereMatchMock(
  firma1: string, branche1: string, gesuch1: string,
  firma2: string, branche2: string, angebot2: string
): Promise<MatchAnalyseResult> {
  await simulateDelay(1800);

  const score = Math.floor(60 + Math.random() * 35);
  const level = score >= 85 ? 'sehr_stark' : score >= 70 ? 'stark' : 'mittel';

  return {
    score,
    level,
    staerken: [
      `Beide Unternehmen sind in ${branche1} tätig und sprechen die gleiche Fachsprache.`,
      `${firma1} sucht genau das, was ${firma2} anbietet.`,
      `Komplementäre Marktpositionen: einer kennt den deutschen Markt, einer den dänischen.`,
    ],
    risiken: [
      `Sprachbarriere könnte Missverständnisse erzeugen — Englisch als Brückensprache empfehlen.`,
      `Unterschiedliche Entscheidungsgeschwindigkeit typisch für DE/DK — frühzeitig kommunizieren.`,
    ],
    gespraechseinstiege: [
      `"Wie lange arbeiten Sie schon grenzüberschreitend?" — öffnet das Gespräch ohne Verkaufsdruck.`,
      `"Was war bisher die größte Herausforderung beim ${branche1}-Markt auf der anderen Seite?" — zeigt Verständnis.`,
    ],
    synergien: [
      `${firma1} könnte ${firma2} als lokalen Anker im deutschen Markt nutzen.`,
      `${firma2} könnte ${firma1} als ersten Pilotpartner für die dänische Markteinführung gewinnen.`,
      `Gemeinsame Teilnahme an einem Easy-B2B-Event könnte den Einstieg erleichtern.`,
    ],
    empfehlung: score >= 80
      ? `Starker Match. Persönliches Kennenlernen empfehlen, ohne Pitch-Druck.`
      : `Guter Match, aber weitere Qualifizierung nötig. Telefonat empfehlen.`,
  };
}

export interface MatchAnalyseResult {
  score: number;
  level: 'mittel' | 'stark' | 'sehr_stark';
  staerken: string[];
  risiken: string[];
  gespraechseinstiege: string[];
  synergien: string[];
  empfehlung: string;
}

// ─── HILFSFUNCTION ───────────────────────────────────────────

function simulateDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
