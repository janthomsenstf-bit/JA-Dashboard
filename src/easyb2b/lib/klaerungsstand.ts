// =============================================================
// KLÄRUNGSSTAND — "Von Easy-B2B geklärte Punkte"
// Löst das frühere Verifizierungs-/TrustScore-System ab.
// Easy-B2B macht nicht Verifizierung — Easy-B2B macht Klärung
// transparent. Daten + manuelle Bestätigungen.
// =============================================================

import type { MockAnfrage, MockInteressent, MockUnternehmen } from './mockdata';

export type KlaerungsTyp = 'anfrage' | 'interessent' | 'unternehmen';

export type KlaerungsBereich =
  // Anfrage
  | 'motivation' | 'konkretisierung' | 'zeitfenster' | 'vorbereitung' | 'zusammenarbeit'
  // Interessent
  | 'i_motivation' | 'beitrag' | 'erfahrung' | 'reichweite' | 'verfuegbarkeit'
  // Unternehmen
  | 'identitaet' | 'erreichbarkeit' | 'glaubwuerdigkeit' | 'historie';

export type ScoreLevel = 'anfang' | 'teilweise' | 'groesstenteils' | 'vollstaendig';

export interface KlaerungsBestaetigung {
  notiz?: string;
  bestaetigtVon: string;
  bestaetigtAm: string;
}

export interface KlaerungsPunkt {
  id: string;
  bereich: KlaerungsBereich;
  titel: string;
  erfuellt: boolean;            // automatisch aus Daten abgeleitet
  manuellBestaetigt?: boolean;  // Operator hat zusätzlich bestätigt
  datenquelle?: string;         // "anfrage.ziel"
  hinweis?: string;             // was fehlt
  notiz?: string;
  bestaetigtVon?: string;
  bestaetigtAm?: string;
}

export interface KlaerungsBereichInfo {
  bereich: KlaerungsBereich;
  punkte: KlaerungsPunkt[];
  erfuellt: number;
  gesamt: number;
}

export interface KlaerungsStand {
  punkte: KlaerungsPunkt[];
  bereiche: KlaerungsBereichInfo[];
  score: number;       // 0–100
  scoreLevel: ScoreLevel;
}

// ─── BEREICHS-METADATEN ───────────────────────────────────────

export const BEREICHE_META: Record<KlaerungsBereich, { label: string; icon: string }> = {
  // Anfrage
  motivation:       { label: 'Motivation',      icon: '🎯' },
  konkretisierung:  { label: 'Konkretisierung', icon: '📍' },
  zeitfenster:      { label: 'Zeitfenster',     icon: '📅' },
  vorbereitung:     { label: 'Vorbereitung',    icon: '📦' },
  zusammenarbeit:   { label: 'Zusammenarbeit',  icon: '🤝' },
  // Interessent
  i_motivation:     { label: 'Motivation',      icon: '🎯' },
  beitrag:          { label: 'Beitrag',         icon: '💼' },
  erfahrung:        { label: 'Erfahrung',       icon: '🏆' },
  reichweite:       { label: 'Reichweite',      icon: '🌐' },
  verfuegbarkeit:   { label: 'Verfügbarkeit',   icon: '⏱' },
  // Unternehmen
  identitaet:       { label: 'Identität',       icon: '🏢' },
  erreichbarkeit:   { label: 'Erreichbarkeit',  icon: '📞' },
  glaubwuerdigkeit: { label: 'Glaubwürdigkeit', icon: '⭐' },
  historie:         { label: 'Historie',        icon: '📜' },
};

// ─── SCORE-LEVEL ──────────────────────────────────────────────

export function getScoreLevel(score: number): ScoreLevel {
  if (score >= 86) return 'vollstaendig';
  if (score >= 61) return 'groesstenteils';
  if (score >= 31) return 'teilweise';
  return 'anfang';
}

export const SCORE_LEVEL_META: Record<ScoreLevel, { label: string; color: string; bg: string }> = {
  anfang:         { label: 'Anfangsstadium',     color: '#FF9900', bg: '#fff3e0' },
  teilweise:      { label: 'Teilweise geklärt',  color: '#FF9900', bg: '#fff3e0' },
  groesstenteils: { label: 'Größtenteils geklärt', color: '#4CAF50', bg: '#e8f5e9' },
  vollstaendig:   { label: 'Vollständig geklärt', color: '#2e7d32', bg: '#c8e6c9' },
};

// ─── HILFSFUNKTIONEN ──────────────────────────────────────────

const ist = (v: unknown): boolean => {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return !isNaN(v) && v !== 0;
  return true;
};

const istEmail = (s?: string): boolean => !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const merge = (
  punkte: Omit<KlaerungsPunkt, 'manuellBestaetigt' | 'notiz' | 'bestaetigtVon' | 'bestaetigtAm'>[],
  bestaetigungen?: Record<string, KlaerungsBestaetigung>,
): KlaerungsPunkt[] => {
  return punkte.map(p => {
    const bestaetigung = bestaetigungen?.[p.id];
    return {
      ...p,
      manuellBestaetigt: !!bestaetigung,
      notiz: bestaetigung?.notiz,
      bestaetigtVon: bestaetigung?.bestaetigtVon,
      bestaetigtAm: bestaetigung?.bestaetigtAm,
      erfuellt: p.erfuellt || !!bestaetigung,
    };
  });
};

function fasseZusammen(punkte: KlaerungsPunkt[]): KlaerungsStand {
  const bereicheMap = new Map<KlaerungsBereich, KlaerungsPunkt[]>();
  punkte.forEach(p => {
    const list = bereicheMap.get(p.bereich) || [];
    list.push(p);
    bereicheMap.set(p.bereich, list);
  });
  const bereiche: KlaerungsBereichInfo[] = Array.from(bereicheMap.entries()).map(([bereich, pts]) => ({
    bereich,
    punkte: pts,
    erfuellt: pts.filter(p => p.erfuellt).length,
    gesamt: pts.length,
  }));
  const gesamtErfuellt = punkte.filter(p => p.erfuellt).length;
  const score = punkte.length === 0 ? 0 : Math.round((gesamtErfuellt / punkte.length) * 100);
  return { punkte, bereiche, score, scoreLevel: getScoreLevel(score) };
}

// ─── ANFRAGE — 13 Punkte in 5 Bereichen ──────────────────────

export function berechneAnfrageKlaerung(
  a: MockAnfrage,
  bestaetigungen?: Record<string, KlaerungsBestaetigung>,
): KlaerungsStand {
  const md = a.marktplatzDaten;
  const punkte = merge([
    // Motivation
    { id: 'anf-ziel',         bereich: 'motivation', titel: 'Ziel definiert',         erfuellt: ist(a.ziel),                     datenquelle: 'anfrage.ziel',                 hinweis: 'Im Edit-Modal das Feld „Ziel" ausfüllen.' },
    { id: 'anf-beschreibung', bereich: 'motivation', titel: 'Beschreibung ausreichend', erfuellt: (a.beschreibung?.length || 0) >= 50, datenquelle: 'anfrage.beschreibung (≥ 50 Z.)', hinweis: 'Mindestens 50 Zeichen Beschreibung erfassen.' },
    { id: 'anf-pnote',        bereich: 'motivation', titel: 'Persönliche Note erfasst', erfuellt: ist(a.funFactAntwort) || ist(md?.persoenlicheNote), datenquelle: 'funFactAntwort / marktplatzDaten.persoenlicheNote', hinweis: 'FunFact-Antwort oder persönliche Note ergänzen.' },

    // Konkretisierung
    { id: 'anf-branche',      bereich: 'konkretisierung', titel: 'Branche definiert',  erfuellt: ist(a.branche),                  datenquelle: 'anfrage.branche',              hinweis: 'Branche im Edit-Modal wählen.' },
    { id: 'anf-art',          bereich: 'konkretisierung', titel: 'Art der Suche klar', erfuellt: ist(a.art),                      datenquelle: 'anfrage.art',                  hinweis: 'Vertrieb, Kooperation, Lieferant oder Kunden auswählen.' },
    { id: 'anf-anforder',     bereich: 'konkretisierung', titel: 'Anforderungen beschrieben', erfuellt: ist(md?.anforderungen),  datenquelle: 'marktplatzDaten.anforderungen', hinweis: 'Im Marktplatz-Editor Anforderungen ergänzen.' },

    // Zeitfenster
    { id: 'anf-eingang',      bereich: 'zeitfenster', titel: 'Eingangsdatum vorhanden', erfuellt: ist(a.createdAt),               datenquelle: 'anfrage.createdAt' },
    { id: 'anf-laufzeit',     bereich: 'zeitfenster', titel: 'Laufzeit / Ablauf definiert', erfuellt: ist(a.ablaufDatum) || ist(md?.laufzeitMonate), datenquelle: 'ablaufDatum / marktplatzDaten.laufzeitMonate', hinweis: 'Ablaufdatum oder Laufzeit beim Veröffentlichen setzen.' },

    // Vorbereitung
    { id: 'anf-sprachen',     bereich: 'vorbereitung', titel: 'Kommunikationssprachen klar', erfuellt: (a.sprachen?.length || 0) > 0, datenquelle: 'anfrage.sprachen', hinweis: 'Mindestens eine Sprache angeben.' },
    { id: 'anf-kultur',       bereich: 'vorbereitung', titel: 'Kulturhinweis erfasst', erfuellt: ist(a.kulturHinweis),             datenquelle: 'anfrage.kulturHinweis', hinweis: 'Kulturhinweis als Operator-Tipp ergänzen.' },
    { id: 'anf-einstieg',     bereich: 'vorbereitung', titel: 'Gesprächseinstieg vorbereitet', erfuellt: ist(a.gespraechseinstieg), datenquelle: 'anfrage.gespraechseinstieg', hinweis: 'Möglichen Gesprächseinstieg ergänzen.' },

    // Zusammenarbeit
    { id: 'anf-aspartner',    bereich: 'zusammenarbeit', titel: 'Ansprechpartner vorhanden', erfuellt: ist(a.ansprechpartner),    datenquelle: 'anfrage.ansprechpartner', hinweis: 'Namen des Ansprechpartners erfassen.' },
    { id: 'anf-kontakt',      bereich: 'zusammenarbeit', titel: 'Kontaktdaten plausibel', erfuellt: istEmail(a.email),             datenquelle: 'anfrage.email', hinweis: 'Gültige E-Mail-Adresse hinterlegen.' },
  ], bestaetigungen);

  return fasseZusammen(punkte);
}

// ─── INTERESSENT — 10 Punkte in 5 Bereichen ──────────────────

export function berechneInteressentKlaerung(
  i: MockInteressent,
  bestaetigungen?: Record<string, KlaerungsBestaetigung>,
): KlaerungsStand {
  const punkte = merge([
    // Motivation
    { id: 'int-warum',     bereich: 'i_motivation', titel: 'Motivation beschrieben',    erfuellt: ist(i.warumInteresse), datenquelle: 'i.warumInteresse', hinweis: 'Im Detail-Modal die Frage „Warum interessiert dich das Projekt?" ergänzen.' },
    { id: 'int-level',     bereich: 'i_motivation', titel: 'Interesse-Level klar',      erfuellt: ist(i.interesseLevel), datenquelle: 'i.interesseLevel', hinweis: 'Interesse-Level (kennenlernen/gespräch/pilot/umsetzung) erfassen.' },

    // Beitrag
    { id: 'int-beitrag',   bereich: 'beitrag', titel: 'Konkreter Beitrag beschrieben', erfuellt: ist(i.beitrag),         datenquelle: 'i.beitrag', hinweis: 'Was kann der Interessent konkret beitragen?' },
    { id: 'int-zusarbeit', bereich: 'beitrag', titel: 'Vorstellung Zusammenarbeit',     erfuellt: ist(i.zusammenarbeit), datenquelle: 'i.zusammenarbeit', hinweis: 'Wie stellt sich der Interessent die Kooperation vor?' },

    // Erfahrung
    { id: 'int-erfahrung', bereich: 'erfahrung', titel: 'Erfahrung dargestellt',       erfuellt: ist(i.erfahrung), datenquelle: 'i.erfahrung', hinweis: 'Branchen-/Projekterfahrung ergänzen.' },
    { id: 'int-referenz',  bereich: 'erfahrung', titel: 'Referenzen vorhanden',         erfuellt: ist(i.referenzen) || !!i.referenzenVorhanden, datenquelle: 'i.referenzen / i.referenzenVorhanden', hinweis: 'Referenzen abfragen oder als geprüft markieren.' },

    // Reichweite
    { id: 'int-region',    bereich: 'reichweite', titel: 'Region angegeben',           erfuellt: ist(i.region) || ist(i.land), datenquelle: 'i.region / i.land', hinweis: 'Region oder Land erfassen.' },
    { id: 'int-online',    bereich: 'reichweite', titel: 'Online-Präsenz',              erfuellt: ist(i.website) || ist(i.linkedin), datenquelle: 'i.website / i.linkedin', hinweis: 'Website oder LinkedIn-Profil ergänzen.' },

    // Verfügbarkeit
    { id: 'int-reaktion',  bereich: 'verfuegbarkeit', titel: 'Reaktionszeit kommuniziert', erfuellt: ist(i.reaktionszeit), datenquelle: 'i.reaktionszeit', hinweis: 'Wann kann der Interessent reagieren / starten?' },
    { id: 'int-sprachen',  bereich: 'verfuegbarkeit', titel: 'Sprachen kommuniziert',     erfuellt: (i.sprachen?.length || 0) > 0, datenquelle: 'i.sprachen', hinweis: 'Mindestens eine Sprache angeben.' },
  ], bestaetigungen);

  return fasseZusammen(punkte);
}

// ─── UNTERNEHMEN — 12 Punkte in 4 Bereichen ──────────────────

export function berechneUnternehmenKlaerung(
  u: MockUnternehmen,
  bestaetigungen?: Record<string, KlaerungsBestaetigung>,
): KlaerungsStand {
  const punkte = merge([
    // Identität
    { id: 'unt-name',      bereich: 'identitaet', titel: 'Firmenname + Land bekannt', erfuellt: ist(u.firmenname) && ist(u.land), datenquelle: 'u.firmenname + u.land' },
    { id: 'unt-standort',  bereich: 'identitaet', titel: 'Standort definiert',         erfuellt: ist(u.standort), datenquelle: 'u.standort', hinweis: 'Standort (Stadt, Land) eintragen.' },
    { id: 'unt-branche',   bereich: 'identitaet', titel: 'Branche bekannt',            erfuellt: ist(u.branche),  datenquelle: 'u.branche', hinweis: 'Branche eintragen.' },

    // Erreichbarkeit
    { id: 'unt-aspartner', bereich: 'erreichbarkeit', titel: 'Ansprechpartner vorhanden', erfuellt: ist(u.ansprechpartner), datenquelle: 'u.ansprechpartner', hinweis: 'Ansprechpartner ergänzen.' },
    { id: 'unt-email',     bereich: 'erreichbarkeit', titel: 'E-Mail vorhanden',         erfuellt: istEmail(u.email), datenquelle: 'u.email', hinweis: 'Gültige E-Mail-Adresse eintragen.' },
    { id: 'unt-website',   bereich: 'erreichbarkeit', titel: 'Website angegeben',        erfuellt: ist(u.website),    datenquelle: 'u.website', hinweis: 'Website-URL ergänzen.' },

    // Glaubwürdigkeit (frühere Boolean-Checkboxen)
    { id: 'unt-gespraech', bereich: 'glaubwuerdigkeit', titel: 'Persönliches Gespräch geführt', erfuellt: !!u.persoenlichesGespraech, datenquelle: 'manuell (u.persoenlichesGespraech)' },
    { id: 'unt-website-g', bereich: 'glaubwuerdigkeit', titel: 'Website geprüft',                erfuellt: !!u.websiteGeprueft,        datenquelle: 'manuell (u.websiteGeprueft)' },
    { id: 'unt-linkedin',  bereich: 'glaubwuerdigkeit', titel: 'LinkedIn geprüft',               erfuellt: !!u.linkedinGeprueft,       datenquelle: 'manuell (u.linkedinGeprueft)' },
    { id: 'unt-empfehl',   bereich: 'glaubwuerdigkeit', titel: 'Empfehlung vorhanden',           erfuellt: !!u.empfehlungVorhanden,    datenquelle: 'manuell (u.empfehlungVorhanden)' },

    // Historie
    { id: 'unt-erstkont',  bereich: 'historie', titel: 'Erstkontakt-Datum vorhanden', erfuellt: ist(u.erstkontakt),     datenquelle: 'u.erstkontakt', hinweis: 'Erstkontakt-Datum eintragen.' },
    { id: 'unt-aktiv',     bereich: 'historie', titel: 'Aktuelle Aktivität',           erfuellt: ist(u.letzteAktivitaet), datenquelle: 'u.letzteAktivitaet', hinweis: 'Letzte Aktivität dokumentieren.' },
  ], bestaetigungen);

  return fasseZusammen(punkte);
}

// ─── ZUGRIFF FÜR ENTITÄTSTYP ──────────────────────────────────

export function berechneKlaerung(
  typ: KlaerungsTyp,
  entitaet: MockAnfrage | MockInteressent | MockUnternehmen,
  bestaetigungen?: Record<string, KlaerungsBestaetigung>,
): KlaerungsStand {
  switch (typ) {
    case 'anfrage':     return berechneAnfrageKlaerung(entitaet as MockAnfrage, bestaetigungen);
    case 'interessent': return berechneInteressentKlaerung(entitaet as MockInteressent, bestaetigungen);
    case 'unternehmen': return berechneUnternehmenKlaerung(entitaet as MockUnternehmen, bestaetigungen);
  }
}
