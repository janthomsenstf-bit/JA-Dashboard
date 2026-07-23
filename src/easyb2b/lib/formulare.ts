// KI-Unterstützung für Formular-Vorlagen (Mock — später Anthropic API)
// Analog zu lib/ki.ts: prompt-vorbereitet + Mock-Funktionen.

import type { FormularFrage, FormularTyp, FormularAntwort } from './mockdata';

export const PROMPT_BRANCHEN_FRAGEN = `Du bist Formular-Assistent für Easy-B2B, ein deutsch-dänisches Matchmaking-Netzwerk.
Schlage anhand der Branchen-/Vorhaben-Beschreibung 5–8 präzise Zusatzfragen vor,
die helfen, {TYP_BESCHREIBUNG} besser einzuschätzen. Kurz, konkret, ohne Floskeln.`;

let _kid = 0;
function frage(text: string, typ: FormularFrage['typ'], pflicht = true, optionen?: string[]): FormularFrage {
  _kid += 1;
  return { id: `ki-frq-${_kid}`, reihenfolge: 999 + _kid, text, typ, pflicht, optionen };
}

// Keyword-basierte Branchenerkennung → passende Zusatzfragen
const BRANCHEN_FRAGEN: { keywords: string[]; anfrage: () => FormularFrage[]; interessent: () => FormularFrage[] }[] = [
  {
    keywords: ['food', 'lebensmittel', 'fisch', 'getränk', 'gastronomie', 'einzelhandel', 'bäcker'],
    anfrage: () => [
      frage('Welche Produkte sollen vertrieben werden?', 'text_lang'),
      frage('Gibt es bereits deutsche Etiketten?', 'ja_nein'),
      frage('Sind Zertifikate vorhanden (Bio, IFS, HACCP)?', 'text_kurz', false),
      frage('Gibt es Listungserfahrung im Einzelhandel?', 'ja_nein'),
      frage('Sind Logistik und Kühlung geklärt?', 'ja_nein'),
      frage('Welche Zielgruppe wird gesucht?', 'auswahl_multi', true, ['Einzelhandel', 'Gastronomie', 'Großhandel', 'Fachhandel']),
    ],
    interessent: () => [
      frage('Habt ihr Erfahrung mit Lebensmittelvertrieb?', 'ja_nein'),
      frage('Habt ihr Kontakte zum Lebensmitteleinzelhandel?', 'ja_nein'),
      frage('Welche Produktgruppen vertreibt ihr bereits?', 'text_lang'),
      frage('Gibt es Kühl-/Lagerlogistik?', 'ja_nein'),
      frage('Habt ihr Referenzen im Food-Bereich?', 'text_lang', false),
    ],
  },
  {
    keywords: ['maschin', 'industrie', 'cnc', 'fertigung', 'stahl', 'produktion', 'technik'],
    anfrage: () => [
      frage('Welche Fertigungsverfahren werden benötigt?', 'text_lang'),
      frage('Welche Zertifizierungen sind erforderlich (ISO 9001, etc.)?', 'text_kurz', false),
      frage('Welche Stückzahlen / Losgrößen?', 'text_kurz'),
      frage('Gibt es technische Zeichnungen / Spezifikationen?', 'datei', false),
      frage('Welche Materialien werden verarbeitet?', 'text_kurz'),
    ],
    interessent: () => [
      frage('Welche Fertigungskapazitäten habt ihr?', 'text_lang'),
      frage('Welche Zertifizierungen besitzt ihr?', 'text_kurz', false),
      frage('Habt ihr Erfahrung in der Windenergie-/Industriebranche?', 'ja_nein'),
      frage('Welche Maschinen / Verfahren stehen zur Verfügung?', 'text_lang'),
    ],
  },
  {
    keywords: ['it', 'software', 'digital', 'saas', 'cloud', 'tech'],
    anfrage: () => [
      frage('Welche Technologien / Plattformen werden eingesetzt?', 'text_lang'),
      frage('Geht es um Entwicklung, Integration oder Vertrieb?', 'auswahl_single', true, ['Entwicklung', 'Integration', 'Vertrieb', 'Beratung']),
      frage('Gibt es Datenschutz-/Compliance-Anforderungen?', 'text_kurz', false),
      frage('Welche Sprachen muss das Produkt unterstützen?', 'auswahl_multi', false, ['Deutsch', 'Dänisch', 'Englisch']),
    ],
    interessent: () => [
      frage('Welche technischen Kompetenzen bringt ihr mit?', 'text_lang'),
      frage('Habt ihr Referenzprojekte im DACH-/Nordics-Raum?', 'text_lang', false),
      frage('Welche Plattformen / Stacks beherrscht ihr?', 'text_kurz'),
    ],
  },
  {
    keywords: ['logistik', 'transport', 'spedition', 'lager'],
    anfrage: () => [
      frage('Welche Transportrouten werden benötigt?', 'text_lang'),
      frage('Welche Frachtarten (Stückgut, Teilladung, Komplettladung)?', 'auswahl_multi', true, ['Stückgut', 'Teilladung', 'Komplettladung', 'Kühltransport']),
      frage('Welche Frequenz ist geplant?', 'text_kurz'),
    ],
    interessent: () => [
      frage('Welche Routen bedient ihr regelmäßig?', 'text_lang'),
      frage('Welche Kapazitäten sind frei?', 'text_kurz'),
      frage('Bietet ihr Kühl-/Spezialtransporte an?', 'ja_nein', false),
    ],
  },
];

export interface BranchenFragenErgebnis {
  erkannteBranche: string;
  fragen: FormularFrage[];
}

export async function schlageBranchenFragenVor(beschreibung: string, typ: FormularTyp): Promise<BranchenFragenErgebnis> {
  await simulateDelay();
  const text = beschreibung.toLowerCase();
  const treffer = BRANCHEN_FRAGEN.find(b => b.keywords.some(k => text.includes(k)));
  if (!treffer) {
    return {
      erkannteBranche: 'Allgemein',
      fragen: [
        frage('Welche besonderen Anforderungen gibt es in eurer Branche?', 'text_lang'),
        frage('Welche Zertifikate oder Nachweise sind relevant?', 'text_kurz', false),
        frage('Gibt es regionale Besonderheiten zu beachten?', 'text_kurz', false),
      ],
    };
  }
  const branchenLabel = treffer.keywords[0].charAt(0).toUpperCase() + treffer.keywords[0].slice(1);
  return {
    erkannteBranche: branchenLabel,
    fragen: typ === 'anfrage' ? treffer.anfrage() : treffer.interessent(),
  };
}

export interface FormularPruefErgebnis {
  score: number;
  hinweise: { typ: 'doppelt' | 'fehlt' | 'tipp'; text: string }[];
}

export async function pruefeFormular(fragen: FormularFrage[], typ: FormularTyp): Promise<FormularPruefErgebnis> {
  await simulateDelay();
  const hinweise: FormularPruefErgebnis['hinweise'] = [];

  // Doppelte erkennen (ähnlicher Text)
  const normalisiert = fragen.map(f => f.text.toLowerCase().replace(/[^a-zäöü ]/g, '').trim());
  normalisiert.forEach((t, i) => {
    const dup = normalisiert.findIndex((other, j) => j < i && ueberlappung(t, other) > 0.6);
    if (dup !== -1) hinweise.push({ typ: 'doppelt', text: `„${fragen[i].text}" ähnelt stark „${fragen[dup].text}" — evtl. zusammenführen.` });
  });

  // Fehlende wichtige Felder
  const hatRegion = fragen.some(f => /region|land|gebiet/i.test(f.text));
  const hatSprache = fragen.some(f => /sprach/i.test(f.text));
  if (!hatRegion) hinweise.push({ typ: 'fehlt', text: 'Es fehlt eine Frage nach Region/Land — wichtig für DE-DK-Matching.' });
  if (!hatSprache) hinweise.push({ typ: 'fehlt', text: 'Es fehlt eine Frage nach möglichen Sprachen.' });

  // Pflichtfeld-Tipp
  const pflichtAnteil = fragen.filter(f => f.pflicht).length / Math.max(1, fragen.length);
  if (pflichtAnteil > 0.85) hinweise.push({ typ: 'tipp', text: 'Sehr viele Pflichtfelder — das kann Nutzer abschrecken. Optionale Felder erhöhen die Abschlussrate.' });
  if (fragen.length > 15) hinweise.push({ typ: 'tipp', text: `${fragen.length} Fragen sind viel. Erwäge, weniger wichtige optional zu machen oder zu kürzen.` });

  const score = Math.max(40, Math.min(100, 100 - hinweise.length * 10));
  return { score, hinweise };
}

export async function fasseAntwortenZusammen(antworten: FormularAntwort[]): Promise<string> {
  await simulateDelay();
  if (antworten.length === 0) return 'Keine Antworten vorhanden.';
  const kernpunkte = antworten.slice(0, 4).map(a => `${a.frageText.replace(/\?$/, '')}: ${a.wert}`).join('; ');
  return `Zusammenfassung: ${kernpunkte}.${antworten.length > 4 ? ` (+${antworten.length - 4} weitere Antworten)` : ''}`;
}

// ── Hilfsfunktionen ──
function simulateDelay(ms = 900) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ueberlappung(a: string, b: string): number {
  const wa = new Set(a.split(' ').filter(w => w.length > 3));
  const wb = new Set(b.split(' ').filter(w => w.length > 3));
  if (wa.size === 0 || wb.size === 0) return 0;
  let gemeinsam = 0;
  wa.forEach(w => { if (wb.has(w)) gemeinsam += 1; });
  return gemeinsam / Math.min(wa.size, wb.size);
}
