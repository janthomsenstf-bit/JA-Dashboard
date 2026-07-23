// =============================================================
// NEWSLETTER & KAMPAGNEN — Easy-B2B
// "Neues aus dem deutsch-dänischen Netzwerk"
// =============================================================

import { MOCK_ANFRAGEN, MOCK_EVENTS, MOCK_SUCCESS_STORIES, getRichtungLabel } from './mockdata';
import { MOCK_KULTUR_MOMENTE } from './kultur';

// ─── BLOCK-SYSTEM ─────────────────────────────────────────────

export type BlockTyp =
  | 'begruessung'
  | 'neue_anfragen'
  | 'success_story'
  | 'event_hinweis'
  | 'kultur_moment'
  | 'netzwerk_news'
  | 'abschluss';

export interface NewsletterBlock {
  id: string;
  typ: BlockTyp;
  titel: string;
  inhalt: string;
  // Bei Anfragen-Block: welche Anfragen
  anfrageIds?: string[];
  refId?: string; // für Story/Event/Kultur
}

export const BLOCK_TYPEN: { typ: BlockTyp; label: string; icon: string; beschreibung: string }[] = [
  { typ: 'begruessung', label: 'Begrüßung', icon: '👋', beschreibung: 'Persönliche Einleitung' },
  { typ: 'neue_anfragen', label: 'Neue Anfragen', icon: '📋', beschreibung: 'Aktuelle Gesuche aus dem Netzwerk' },
  { typ: 'success_story', label: 'Success Story', icon: '⭐', beschreibung: 'Eine erfolgreiche Vermittlung' },
  { typ: 'event_hinweis', label: 'Event-Hinweis', icon: '🎤', beschreibung: 'Kommende Veranstaltung' },
  { typ: 'kultur_moment', label: 'Kultur-Moment', icon: '📚', beschreibung: 'Deutsch-dänischer Einblick' },
  { typ: 'netzwerk_news', label: 'Netzwerk-News', icon: '🕸', beschreibung: 'Neuigkeiten aus dem Netzwerk' },
  { typ: 'abschluss', label: 'Abschluss', icon: '✍️', beschreibung: 'Grußformel & Call-to-Action' },
];

export function getBlockMeta(typ: BlockTyp) {
  return BLOCK_TYPEN.find(b => b.typ === typ)!;
}

// ─── AUTOMATISCHE INHALTSGENERIERUNG ──────────────────────────
// Baut Block-Inhalte aus echten Systemdaten

export function generiereAnfragenBlock(filter: 'alle' | 'de_dk' | 'dk_de' = 'alle'): NewsletterBlock {
  let anfragen = MOCK_ANFRAGEN.filter(a => a.status === 'aktiv');
  if (filter !== 'alle') anfragen = anfragen.filter(a => a.richtung === filter);

  const text = anfragen.slice(0, 4).map(a =>
    `${getRichtungLabel(a.richtung)} **${a.firmenname}** (${a.standort}): ${a.ziel}`
  ).join('\n\n');

  return {
    id: 'block-anfragen',
    typ: 'neue_anfragen',
    titel: 'Aktuelle Gesuche aus dem Netzwerk',
    inhalt: text || 'Aktuell keine neuen Anfragen.',
    anfrageIds: anfragen.slice(0, 4).map(a => a.id),
  };
}

export function generiereStoryBlock(): NewsletterBlock {
  const story = MOCK_SUCCESS_STORIES.find(s => s.freigabe !== 'intern');
  return {
    id: 'block-story',
    typ: 'success_story',
    titel: story?.titel || 'Erfolgsgeschichte',
    inhalt: story?.kiHomepage || story?.kurzbeschreibung || 'Keine Story verfügbar.',
    refId: story?.id,
  };
}

export function generiereEventBlock(): NewsletterBlock {
  const event = MOCK_EVENTS.find(e => e.status === 'geplant' || e.status === 'veroeffentlicht');
  return {
    id: 'block-event',
    typ: 'event_hinweis',
    titel: event ? `${event.titel} — ${event.datum}` : 'Kommende Events',
    inhalt: event ? `${event.untertitel || ''}\n\n${event.beschreibung}\n\n📍 ${event.ort} · ⏰ ${event.uhrzeit}` : 'Aktuell keine geplanten Events.',
    refId: event?.id,
  };
}

export function generiereKulturBlock(): NewsletterBlock {
  const km = MOCK_KULTUR_MOMENTE.find(m => m.oeffentlich);
  return {
    id: 'block-kultur',
    typ: 'kultur_moment',
    titel: km ? `Kultur-Moment: "${km.titel}"` : 'Deutsch-dänischer Einblick',
    inhalt: km?.lernmoment || 'Kein Kultur-Moment verfügbar.',
    refId: km?.id,
  };
}

// ─── KI: KOMPLETTEN NEWSLETTER GENERIEREN ─────────────────────

export async function generiereNewsletterMock(): Promise<NewsletterBlock[]> {
  await new Promise(r => setTimeout(r, 1600));

  return [
    {
      id: 'block-gruss',
      typ: 'begruessung',
      titel: 'Moin aus der Grenzregion,',
      inhalt: 'es tut sich wieder einiges im deutsch-dänischen Netzwerk. Hier sind die aktuellen Gesuche, eine Geschichte, die uns gefreut hat, und ein kleiner kultureller Einblick. Vielleicht ist ja etwas für Sie dabei.',
    },
    generiereAnfragenBlock('alle'),
    generiereStoryBlock(),
    generiereEventBlock(),
    generiereKulturBlock(),
    {
      id: 'block-ende',
      typ: 'abschluss',
      titel: 'Bis zum nächsten Mal',
      inhalt: 'Sie kennen ein Unternehmen, das einen Partner auf der anderen Seite der Grenze sucht? Leiten Sie diesen Newsletter gerne weiter — oder stellen Sie selbst eine Anfrage.\n\nHerzliche Grüße aus der Grenzregion,\nIhr Easy-B2B Team',
    },
  ];
}

// ─── KI: NEWSLETTER VERBESSERN ────────────────────────────────

export async function verbessereNewsletterMock(bloecke: NewsletterBlock[]): Promise<{ verbessert: NewsletterBlock[]; hinweise: string[] }> {
  await new Promise(r => setTimeout(r, 1200));
  return {
    verbessert: bloecke,
    hinweise: [
      'Begrüßung wirkt persönlich und norddeutsch — gut so.',
      'Anfragen-Block: Reihenfolge nach Aktualität optimiert.',
      'Vorschlag: Den Kultur-Moment weiter nach oben — er erzeugt erfahrungsgemäß die meisten Klicks.',
    ],
  };
}

// ─── HELPER ───────────────────────────────────────────────────

export function getNewsletterStatusLabel(status: string): string {
  return { entwurf: 'Entwurf', freigegeben: 'Freigegeben', geplant: 'Geplant', versendet: 'Versendet' }[status] || status;
}

export function getNewsletterStatusColor(status: string): string {
  return { entwurf: '#999', freigegeben: '#FF9900', geplant: '#2196F3', versendet: '#4CAF50' }[status] || '#999';
}

export const INTERESSENGRUPPEN = [
  'Vertrieb', 'Kooperationen', 'Deutschland', 'Dänemark', 'Produktion', 'Handel', 'Events',
];

// ─── MOCK-DATEN ───────────────────────────────────────────────

export interface MockNewsletter {
  id: string;
  titel: string;
  betreff: string;
  vorschautext: string;
  sprache: string;
  status: string;
  bloecke: NewsletterBlock[];
  geplantFuer?: string;
  versendetAm?: string;
  empfaengerCount: number;
  zielgruppen: string[];
  oeffnungsrate?: number;
  klickrate?: number;
  createdAt: string;
}

export const MOCK_NEWSLETTER: MockNewsletter[] = [
  {
    id: 'nl-001',
    titel: 'Netzwerk-Update Mai 2025',
    betreff: 'Neue Gesuche, eine Erfolgsgeschichte und ein Kultur-Moment',
    vorschautext: 'Diesen Monat: 4 neue Anfragen, die Gin-Story aus Hamburg und warum "Vi skal tænke over det" mehr bedeutet als gedacht.',
    sprache: 'deutsch',
    status: 'versendet',
    bloecke: [],
    versendetAm: '2025-05-15',
    empfaengerCount: 142,
    zielgruppen: ['Deutschland', 'Dänemark', 'Kooperationen'],
    oeffnungsrate: 48.6,
    klickrate: 12.3,
    createdAt: '2025-05-12',
  },
  {
    id: 'nl-002',
    titel: 'Netzwerk-Update April 2025',
    betreff: 'Failure Night Rückblick + neue Logistik-Gesuche',
    vorschautext: 'Was bei der Failure Night entstanden ist, und wer aktuell Partner sucht.',
    sprache: 'deutsch',
    status: 'versendet',
    bloecke: [],
    versendetAm: '2025-04-18',
    empfaengerCount: 128,
    zielgruppen: ['Deutschland', 'Dänemark', 'Events'],
    oeffnungsrate: 52.1,
    klickrate: 15.8,
    createdAt: '2025-04-15',
  },
  {
    id: 'nl-003',
    titel: 'Netzwerk-Update Juni 2025',
    betreff: 'Pitch & Meet Flensburg – jetzt anmelden',
    vorschautext: 'Das erste Pitch & Meet in der Grenzregion, plus neue Gesuche aus Dänemark.',
    sprache: 'deutsch',
    status: 'geplant',
    bloecke: [],
    geplantFuer: '2025-06-10',
    empfaengerCount: 0,
    zielgruppen: ['Deutschland', 'Dänemark', 'Events', 'Kooperationen'],
    createdAt: '2025-06-01',
  },
];

export const MOCK_ABONNENTEN = [
  { id: 'ab-001', name: 'Thomas Müller', unternehmen: 'Müller Maschinenbau GmbH', email: 'mueller@maschinenbau-fl.de', land: 'deutschland', branche: 'Maschinenbau', sprache: 'deutsch', interessen: ['Kooperationen', 'Dänemark', 'Produktion'], status: 'aktiv', geoeffnetCount: 8, geklicktCount: 3, abonniert: '2025-01-15' },
  { id: 'ab-002', name: 'Lars Henriksen', unternehmen: 'Nordic Fish A/S', email: 'lars@nordicfish.dk', land: 'daenemark', branche: 'Lebensmittel', sprache: 'daenisch', interessen: ['Vertrieb', 'Deutschland', 'Handel'], status: 'aktiv', geoeffnetCount: 6, geklicktCount: 4, abonniert: '2025-02-01' },
  { id: 'ab-003', name: 'Mette Andersen', unternehmen: 'Dansk Design Studio', email: 'mette@danskdesign.dk', land: 'daenemark', branche: 'Design', sprache: 'deutsch', interessen: ['Vertrieb', 'Deutschland', 'Events'], status: 'aktiv', geoeffnetCount: 9, geklicktCount: 5, abonniert: '2025-01-20' },
  { id: 'ab-004', name: 'Ulrike Brenner', unternehmen: 'IHK Schleswig-Holstein', email: 'brenner@ihk-sh.de', land: 'deutschland', branche: 'Wirtschaftsförderung', sprache: 'deutsch', interessen: ['Kooperationen', 'Events', 'Deutschland', 'Dänemark'], status: 'aktiv', geoeffnetCount: 10, geklicktCount: 7, abonniert: '2024-11-10' },
  { id: 'ab-005', name: 'Klaus Bergmann', unternehmen: 'Frische-Markt Hamburg', email: 'bergmann@frischemarkt-hh.de', land: 'deutschland', branche: 'Handel', sprache: 'deutsch', interessen: ['Handel', 'Vertrieb'], status: 'aktiv', geoeffnetCount: 4, geklicktCount: 2, abonniert: '2025-03-01' },
  { id: 'ab-006', name: 'Anders Christoffersen', unternehmen: 'Syddansk Erhvervsfremme', email: 'anders@sde.dk', land: 'daenemark', branche: 'Wirtschaftsförderung', sprache: 'daenisch', interessen: ['Kooperationen', 'Events', 'Deutschland'], status: 'aktiv', geoeffnetCount: 11, geklicktCount: 8, abonniert: '2024-11-08' },
  { id: 'ab-007', name: 'Hannah Schmidt', unternehmen: 'Kieler Brauerei', email: 'hannah@kieler-brauerei.de', land: 'deutschland', branche: 'Getränke', sprache: 'deutsch', interessen: ['Vertrieb', 'Dänemark'], status: 'pausiert', geoeffnetCount: 2, geklicktCount: 0, abonniert: '2025-04-01' },
  { id: 'ab-008', name: 'Pia Sørensen', unternehmen: 'Bornholm Keramik', email: 'pia@bornholm-keramik.dk', land: 'daenemark', branche: 'Kunsthandwerk', sprache: 'daenisch', interessen: ['Vertrieb', 'Handel', 'Deutschland'], status: 'aktiv', geoeffnetCount: 5, geklicktCount: 3, abonniert: '2025-04-28' },
];

export function getAbonnentStatusColor(status: string): string {
  return { aktiv: '#4CAF50', pausiert: '#FF9900', abgemeldet: '#f44336' }[status] || '#999';
}
