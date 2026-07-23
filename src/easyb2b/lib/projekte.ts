// =============================================================
// PROJEKTPERSPEKTIVE — jede veröffentlichte Anfrage = ein Projekt
// Bündelt Anfrage + Interessenten + Matches + Gesundheit + KPIs.
// Keine neue Datenhaltung — aggregiert bestehende Module.
// =============================================================

import { type MockAnfrage, type MockInteressent, type MarktplatzStatus } from './mockdata';

export interface ProjektKPI {
  interessenten: number;
  freigegeben: number;
  kontakte: number;
  erfolge: number;
  abgelehnt: number;
}

export type Gesundheit = 'gruen' | 'gelb' | 'rot';

export interface ProjektStatus {
  kpi: ProjektKPI;
  gesundheit: Gesundheit;
  gesundheitLabel: string;
  veroeffentlichung: string;
  veroeffentlichungColor: string;
  hinweis: string | null;
  erfolgsquote: number; // % interessenten → kontakt/erfolg
}

// Referenz-„heute" passend zu den Mock-Daten (Ende Mai 2025)
const HEUTE = new Date('2025-05-30').getTime();

function tageSeit(datum: string): number {
  const t = new Date(datum).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, Math.round((HEUTE - t) / 86400000));
}

// `eigene` ist die bereits aufgelöste Liste der Interessenten dieses Projekts
// (inkl. manuell zugeordneter — über die Zuordnungs-Zwischentabelle ermittelt).
export function berechneProjekt(anfrage: MockAnfrage, eigene: MockInteressent[]): ProjektStatus {
  const kpi: ProjektKPI = {
    interessenten: eigene.length,
    freigegeben: eigene.filter(i => ['freigegeben', 'kontakt_laeuft', 'erfolgreich', 'feedback_ausstehend'].includes(i.status)).length,
    kontakte: eigene.filter(i => ['kontakt_laeuft', 'erfolgreich', 'feedback_ausstehend'].includes(i.status)).length,
    erfolge: eigene.filter(i => i.status === 'erfolgreich').length,
    abgelehnt: eigene.filter(i => ['abgelehnt', 'nicht_passend', 'spam'].includes(i.status)).length,
  };

  const alter = tageSeit(anfrage.createdAt);

  // Gesundheit
  let gesundheit: Gesundheit;
  if (kpi.erfolge > 0 || kpi.kontakte > 0 || kpi.interessenten >= 3) gesundheit = 'gruen';
  else if (kpi.interessenten >= 1) gesundheit = 'gelb';
  else gesundheit = 'rot';

  const gesundheitLabel = {
    gruen: 'Hohe Aktivität',
    gelb: 'Wenige Interessenten',
    rot: alter > 14 ? `Keine Reaktion seit ${alter} Tagen` : 'Noch keine Reaktion',
  }[gesundheit];

  // Veröffentlichungsstatus aus marktplatzStatus ableiten
  const ms: MarktplatzStatus = anfrage.marktplatzStatus || 'intern';
  const MKTP: Record<MarktplatzStatus, [string, string]> = {
    intern:         ['Intern',          '#9E9E9E'],
    entwurf:        ['Entwurf',         '#FF9900'],
    zur_pruefung:   ['Zur Prüfung',     '#2196F3'],
    veroeffentlicht:['Veröffentlicht',  '#4CAF50'],
    pausiert:       ['Pausiert',        '#FF9900'],
    abgelaufen:     ['Abgelaufen',      '#f44336'],
    archiviert:     ['Archiviert',      '#9E9E9E'],
  };
  const [veroeffentlichung, veroeffentlichungColor] = MKTP[ms];

  // Optimierungshinweis
  let hinweis: string | null = null;
  if (ms === 'intern') {
    hinweis = 'Dieses Projekt ist noch nicht im Marktplatz. Entwurf erstellen und veröffentlichen.';
  } else if (ms === 'entwurf') {
    hinweis = 'Marktplatz-Entwurf vorhanden – noch nicht veröffentlicht. Prüfen und freigeben.';
  } else if (ms === 'zur_pruefung') {
    hinweis = 'Marktplatz-Eintrag wartet auf finale Prüfung vor der Veröffentlichung.';
  } else if (ms === 'pausiert') {
    hinweis = 'Eintrag ist pausiert – Entscheidung: wieder veröffentlichen, überarbeiten oder archivieren?';
  } else if (ms === 'abgelaufen') {
    hinweis = 'Laufzeit abgelaufen – verlängern, überarbeiten oder archivieren?';
  } else if (kpi.interessenten === 0 && alter > 14) {
    hinweis = `Die Anfrage läuft seit ${alter} Tagen und hat noch keinen Interessenten. Eine Überarbeitung des Gesuchs oder aktives Matchmaking könnte sinnvoll sein.`;
  } else if (kpi.interessenten === 1 && alter > 21) {
    hinweis = `Seit ${alter} Tagen nur ein Interessent. Prüfe, ob das Gesuch klarer formuliert oder breiter gestreut werden sollte.`;
  } else if (kpi.interessenten >= 3 && kpi.kontakte === 0) {
    hinweis = `${kpi.interessenten} Interessenten, aber noch kein Kontakt hergestellt. Zeit, die besten freizugeben.`;
  }

  const erfolgsquote = kpi.interessenten > 0 ? Math.round((kpi.kontakte / kpi.interessenten) * 100) : 0;

  return { kpi, gesundheit, gesundheitLabel, veroeffentlichung, veroeffentlichungColor, hinweis, erfolgsquote };
}

export function getGesundheitColor(g: Gesundheit): string {
  return { gruen: '#4CAF50', gelb: '#FF9900', rot: '#f44336' }[g];
}

// Status einer Projektzuordnung (eigene Logik, unabhängig vom Interessenten-Gesamtstatus)
export const ZUORDNUNG_STATUS = ['vorgeschlagen', 'in_pruefung', 'freigegeben', 'abgelehnt', 'kontakt_hergestellt', 'abgeschlossen'];

export function getZuordnungLabel(s: string): string {
  return {
    vorgeschlagen: 'Vorgeschlagen', in_pruefung: 'In Prüfung', freigegeben: 'Freigegeben',
    abgelehnt: 'Abgelehnt', kontakt_hergestellt: 'Kontakt hergestellt', abgeschlossen: 'Abgeschlossen',
  }[s] || s;
}

export function getZuordnungColor(s: string): string {
  return {
    vorgeschlagen: '#2196F3', in_pruefung: '#FF9900', freigegeben: '#4CAF50',
    abgelehnt: '#f44336', kontakt_hergestellt: '#9C27B0', abgeschlossen: '#2e7d32',
  }[s] || '#999';
}

export function getGesundheitEmoji(g: Gesundheit): string {
  return { gruen: '🟢', gelb: '🟡', rot: '🔴' }[g];
}
