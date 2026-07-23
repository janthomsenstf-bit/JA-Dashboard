// =============================================================
// SUCCESS STORY KI-CONTENT-GENERATOR für Easy-B2B Dashboard
// Mock-Funktion — später mit Anthropic Claude API verbinden
// =============================================================

export interface StoryInput {
  titel: string;
  ausgangssituation?: string;
  herausforderung?: string;
  ergebnis: string;
  erkenntnisse?: string;
  vermittlungsweg?: string;
  branche?: string;
  land?: string;
  entstehungsweg?: string;
  anonymisiert?: boolean;
  firma1?: string;
  firma2?: string;
}

export interface GeneratedContent {
  homepage: string;
  linkedin: string;
  newsletter: string;
  titelAnon: string;
  ergebnisAnon: string;
}

// ─── KI-PROMPTS (für echte Anthropic-Integration) ────────────

export const KI_PROMPTS = {
  homepage: `
Du schreibst einen kurzen, überzeugenden Eintrag für die Easy-B2B Homepage.
Ton: Menschlich, vertrauensvoll, nicht werbend. Max. 3 Sätze.
Keine Superlative. Kein Marketing-Deutsch.
Fokus: Was ist für andere Unternehmen relevant an dieser Geschichte?

Story: {{STORY}}
Firma 1: {{FIRMA1}}
Firma 2: {{FIRMA2}}
Anonymisiert: {{ANON}}
`,
  linkedin: `
Du schreibst einen LinkedIn-Beitrag für Easy-B2B.
Ton: Professionell aber persönlich, direkt, norddeutsch.
Struktur: 1 starker Einstiegssatz + 3-4 Sätze + 1 Abschluss-Call-to-Action.
Hashtags: Max. 3 relevante Hashtags am Ende.
Keine Emojis außer am Anfang (1 erlaubt).

Story: {{STORY}}
`,
  newsletter: `
Du schreibst einen Newsletter-Abschnitt für den Easy-B2B-Newsletter.
Ton: Warm, persönlich, wie ein Brief von einem bekannten Ansprechpartner.
Struktur: Kurzer Einstieg + Hauptaussage + Was andere davon lernen können.
Max. 4 Sätze.

Story: {{STORY}}
`,
};

// ─── MOCK-GENERIERUNG (bis echte KI angebunden ist) ──────────

export function generiereStoryContent(input: StoryInput): GeneratedContent {
  const firma1 = input.anonymisiert ? 'ein deutsches Unternehmen' : (input.firma1 || 'Unternehmen A');
  const firma2 = input.anonymisiert ? 'ein dänischer Partner' : (input.firma2 || 'Unternehmen B');
  const branche = input.branche || 'dem Grenzhandel';

  return {
    homepage: `${input.ausgangssituation || `${firma1} suchte einen Partner in ${branche}`} Über Easy-B2B entstand der Kontakt zu ${firma2}. ${input.ergebnis}`,

    linkedin: `🤝 Wenn zwei Unternehmen aus Deutschland und Dänemark zusammenfinden, entsteht mehr als ein Geschäft.

${input.ausgangssituation || `${firma1} hatte eine klare Idee, aber der richtige Partner fehlte.`}

${input.vermittlungsweg ? `Der Weg dahin: ${input.vermittlungsweg}` : `Über das Easy-B2B-Netzwerk fanden sie sich.`}

Das Ergebnis: ${input.ergebnis}

${input.erkenntnisse ? `Was wir daraus mitgenommen haben: ${input.erkenntnisse}` : 'Genau dafür ist Easy-B2B da.'}

#EasyB2B #DeutschDänischKooperation #Matchmaking`,

    newsletter: `Diese Woche haben wir eine Vermittlung abgeschlossen, die uns zeigt, warum wir das tun, was wir tun. ${firma1 !== 'ein deutsches Unternehmen' ? firma1 : 'Ein Unternehmen aus unserer Region'} und ${firma2} haben den Weg zueinander gefunden – durch persönliches Kennenlernen, nicht durch Algorithmen. ${input.ergebnis} ${input.erkenntnisse || 'Manchmal braucht es nur den richtigen Moment und den richtigen Anknüpfungspunkt.'}`,

    titelAnon: input.titel
      .replace(input.firma1 || '', '[Deutsches Unternehmen]')
      .replace(input.firma2 || '', '[Dänisches Unternehmen]'),

    ergebnisAnon: input.ergebnis
      .replace(input.firma1 || '___', 'das deutsche Unternehmen')
      .replace(input.firma2 || '___', 'der dänische Partner'),
  };
}

// ─── HILFSFUNKTIONEN ─────────────────────────────────────────

export function getFreigabeLabel(freigabe: string): string {
  const labels: Record<string, string> = {
    intern: 'Intern',
    anonymisiert: 'Anonym veröffentlicht',
    freigegeben: 'Mit Namen veröffentlicht',
  };
  return labels[freigabe] || freigabe;
}

export function getFreigabeColor(freigabe: string): string {
  const colors: Record<string, string> = {
    intern: '#999',
    anonymisiert: '#FF9900',
    freigegeben: '#4CAF50',
  };
  return colors[freigabe] || '#999';
}

export function getFreigabeIcon(freigabe: string): string {
  return { intern: '🔒', anonymisiert: '👤', freigegeben: '🌐' }[freigabe] || '🔒';
}

export function getEntstehungswegLabel(weg: string): string {
  const labels: Record<string, string> = {
    matchmaking: 'Matchmaking',
    event: 'Event',
    netzwerkkontakt: 'Netzwerkkontakt',
    empfehlung: 'Empfehlung',
    soft_landing: 'Soft Landing',
    direktkontakt: 'Direktkontakt',
  };
  return labels[weg] || weg;
}

export function getEntstehungswegIcon(weg: string): string {
  return {
    matchmaking: '🎯',
    event: '🎤',
    netzwerkkontakt: '🤝',
    empfehlung: '⭐',
    soft_landing: '🛬',
    direktkontakt: '📞',
  }[weg] || '🔗';
}

export function getErgebnisTypLabel(typ: string): string {
  const labels: Record<string, string> = {
    kooperation: 'Kooperation',
    vertriebspartner: 'Vertriebspartner',
    lieferant: 'Lieferant',
    markteintritt: 'Markteintritt',
    projekt: 'Projekt',
    wissenstransfer: 'Wissenstransfer',
    netzwerkaufbau: 'Netzwerkaufbau',
  };
  return labels[typ] || typ;
}

export function getErgebnisTypColor(typ: string): string {
  const colors: Record<string, string> = {
    kooperation: '#9C27B0',
    vertriebspartner: '#4CAF50',
    lieferant: '#2196F3',
    markteintritt: '#FF9900',
    projekt: '#E91E63',
    wissenstransfer: '#009688',
    netzwerkaufbau: '#FF5722',
  };
  return colors[typ] || '#666';
}
