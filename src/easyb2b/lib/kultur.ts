// =============================================================
// KULTUR & WISSEN — Easy-B2B Wissensbibliothek
// Das Gedächtnis deutsch-dänischer Zusammenarbeit
// =============================================================

export interface MockKulturMoment {
  id: string;
  titel: string;
  kategorie: string;
  land: string;
  originalSprache?: string;
  status: string;
  ausgangssituation?: string;
  aussage?: string;
  interpretation?: string;
  bedeutung?: string;
  lernmoment: string;
  ton: string;
  oeffentlich: boolean;
  verwendetCount: number;
  createdAt: string;
}

export interface MockGrenzgeschichte {
  id: string;
  titel: string;
  typ: string;
  kategorie: string;
  status: string;
  situation: string;
  verlauf?: string;
  erkenntnis: string;
  oeffentlich: boolean;
  beteiligteFirma1?: string;
  beteiligteFirma2?: string;
  anonymisiert: boolean;
  verwendetCount: number;
  createdAt: string;
}

export const MOCK_KULTUR_MOMENTE: MockKulturMoment[] = [
  {
    id: 'km-001',
    titel: 'Vi skal lige tænke over det',
    kategorie: 'kommunikation',
    land: 'daenemark',
    originalSprache: 'Vi skal lige tænke over det',
    status: 'veroeffentlicht',
    ausgangssituation: 'Ein deutsches Unternehmen präsentiert ein Angebot. Der dänische Partner reagiert freundlich.',
    aussage: '"Vi skal lige tænke over det" – Wir müssen kurz darüber nachdenken.',
    interpretation: 'Deutsche Seite: "Das klingt positiv, sie überlegen ernsthaft."',
    bedeutung: 'Tatsächlich oft: höfliche Ablehnung. Eine direkte Absage gilt als unhöflich.',
    lernmoment: 'Dänische Kommunikation ist häufig indirekter als viele Deutsche erwarten. Ein "Wir denken nach" kann ein freundliches Nein sein. Nachfragen ist erlaubt – aber sensibel.',
    ton: 'ueberraschend',
    oeffentlich: true,
    verwendetCount: 12,
    createdAt: '2025-03-10',
  },
  {
    id: 'km-002',
    titel: 'Der Chef heißt Lars',
    kategorie: 'hierarchien',
    land: 'daenemark',
    status: 'veroeffentlicht',
    ausgangssituation: 'Erstes Meeting. Der deutsche Geschäftsführer erwartet eine formelle Begrüßung mit Titeln.',
    aussage: '"Hej, jeg hedder Lars" – der dänische CEO stellt sich mit Vornamen vor.',
    interpretation: 'Deutsche Seite: "Wo ist der eigentliche Entscheider? Das wirkt unprofessionell."',
    bedeutung: 'In Dänemark sind flache Hierarchien Normalität. Der Vorname ist Standard – auch beim CEO.',
    lernmoment: 'Dänische Flachheit ist kein Mangel an Respekt, sondern Ausdruck von Vertrauen. Wer auf Titeln besteht, wirkt schnell steif. Einfach mitmachen.',
    ton: 'humorvoll',
    oeffentlich: true,
    verwendetCount: 9,
    createdAt: '2025-03-15',
  },
  {
    id: 'km-003',
    titel: 'Die fehlende Agenda',
    kategorie: 'meetings',
    land: 'beide',
    status: 'veroeffentlicht',
    ausgangssituation: 'Deutsche Seite schickt vorab eine strukturierte Agenda. Im Meeting läuft alles anders.',
    aussage: 'Der dänische Partner: "Lad os bare snakke" – Lass uns einfach reden.',
    interpretation: 'Deutsche Seite: "Sie nehmen das Meeting nicht ernst."',
    bedeutung: 'Dänische Meetings sind oft gesprächsorientiert. Das Ergebnis zählt mehr als der Weg dorthin.',
    lernmoment: 'Immer eine kurze Agenda schicken – aber flexibel bleiben. Die Beziehung entsteht im Gespräch, nicht in der Tagesordnung.',
    ton: 'neutral',
    oeffentlich: true,
    verwendetCount: 7,
    createdAt: '2025-03-20',
  },
  {
    id: 'km-004',
    titel: '"Das ist nicht so gut gelaufen"',
    kategorie: 'kommunikation',
    land: 'daenemark',
    status: 'veroeffentlicht',
    ausgangssituation: 'In einem laufenden Projekt gibt es ein Problem. Der dänische Partner spricht es offen an.',
    aussage: '"Det gik ikke så godt" – Das ist nicht so gut gelaufen.',
    interpretation: 'Deutsche Seite: "Ist das jetzt eine Eskalation? Sind wir in Schwierigkeiten?"',
    bedeutung: 'Für Dänen ist offenes Ansprechen von Problemen professionell und normal – kein Drama.',
    lernmoment: 'Dänische Fehlerkultur ist offener. Probleme früh ansprechen gilt als Stärke, nicht als Schwäche. Nicht in Verteidigungshaltung gehen.',
    ton: 'ernst',
    oeffentlich: true,
    verwendetCount: 5,
    createdAt: '2025-04-02',
  },
  {
    id: 'km-005',
    titel: 'Kaffee zuerst, Geschäft danach',
    kategorie: 'vertrieb',
    land: 'daenemark',
    status: 'veroeffentlicht',
    ausgangssituation: 'Deutscher Vertriebler will direkt zum Angebot kommen. Der Däne fragt nach der Familie.',
    aussage: '"Hvordan går det? Hvordan har familien det?"',
    interpretation: 'Deutsche Seite: "Wir verlieren Zeit, lass uns zum Geschäft kommen."',
    bedeutung: 'Dänen entscheiden oft erst "Mag ich diese Person?" – bevor sie über das Angebot nachdenken.',
    lernmoment: 'Hygge im Business: 5 Minuten persönliches Gespräch sind keine vergeudete Zeit, sondern Investition in die Beziehung. Sie zahlen sich aus.',
    ton: 'neutral',
    oeffentlich: true,
    verwendetCount: 8,
    createdAt: '2025-04-10',
  },
  {
    id: 'km-006',
    titel: 'Die deutsche Gründlichkeit',
    kategorie: 'entscheidungen',
    land: 'deutschland',
    status: 'veroeffentlicht',
    ausgangssituation: 'Dänisches Unternehmen erwartet eine schnelle Zusage. Die deutsche Seite "muss erst intern abstimmen".',
    aussage: '"Wir müssen das erst intern besprechen und prüfen."',
    interpretation: 'Dänische Seite: "Warum dauert das so lange? Haben sie kein Interesse?"',
    bedeutung: 'Deutsche Entscheidungsprozesse sind oft mehrstufig. Gründlichkeit vor Schnelligkeit.',
    lernmoment: 'Deutsche brauchen mehr Zeit für interne Abstimmung – das ist kein Desinteresse. Frühzeitig kommunizieren, wann eine Entscheidung kommt.',
    ton: 'neutral',
    oeffentlich: true,
    verwendetCount: 6,
    createdAt: '2025-04-18',
  },
  {
    id: 'km-007',
    titel: 'Dänischer Humor im Meeting',
    kategorie: 'humor',
    land: 'daenemark',
    status: 'geprueft',
    ausgangssituation: 'Mitten in einer ernsten Verhandlung macht der Däne einen trockenen Witz.',
    aussage: 'Ein ironischer Kommentar über die eigene Position.',
    interpretation: 'Deutsche Seite: "Nimmt er das überhaupt ernst?"',
    bedeutung: 'Selbstironie und Humor sind in Dänemark auch im Business willkommen – sie bauen Spannung ab.',
    lernmoment: 'Humor ist in Dänemark ein Vertrauenssignal, kein Mangel an Ernsthaftigkeit. Mitlachen lohnt sich.',
    ton: 'humorvoll',
    oeffentlich: false,
    verwendetCount: 2,
    createdAt: '2025-05-05',
  },
];

export const MOCK_GRENZGESCHICHTEN: MockGrenzgeschichte[] = [
  {
    id: 'gg-001',
    titel: 'Wie eine fehlende E-Mail-Antwort fast einen Deal kostete',
    typ: 'missverstaendnis',
    kategorie: 'kommunikation',
    status: 'veroeffentlicht',
    situation: 'Ein deutsches Maschinenbau-Unternehmen schickte ein detailliertes 8-seitiges Angebot an einen dänischen Partner. Drei Tage keine Antwort.',
    verlauf: 'Die deutsche Seite interpretierte das Schweigen als Desinteresse und bereitete sich auf eine Absage vor. Tatsächlich hatte der Däne das Angebot gelesen, fand es gut – wartete aber auf einen Anruf, weil ihm 8 Seiten "zu viel zum Schreiben" für eine Antwort waren.',
    erkenntnis: 'Ein kurzes Telefonat löste alles. Deutsche bevorzugen schriftliche Dokumentation, Dänen den direkten Draht. Wer beide Kanäle bewusst nutzt, vermeidet teure Missverständnisse.',
    oeffentlich: true,
    beteiligteFirma1: 'Müller Maschinenbau GmbH',
    beteiligteFirma2: 'Vestas Wind Components',
    anonymisiert: false,
    verwendetCount: 4,
    createdAt: '2025-04-20',
  },
  {
    id: 'gg-002',
    titel: 'Der Deal, der beim Kaffee entstand',
    typ: 'erfolgsgeschichte',
    kategorie: 'kooperation',
    status: 'veroeffentlicht',
    situation: 'Auf einer Easy-B2B Failure Night kamen ein deutscher und ein dänischer Logistiker ins Gespräch – ohne Verkaufsabsicht.',
    verlauf: 'Beide erzählten von gescheiterten Kooperationsversuchen. Aus der gemeinsamen Frustration wurde Vertrauen. Kein Pitch, kein Angebot – nur ein ehrliches Gespräch über Kaffee.',
    erkenntnis: 'Die besten Kooperationen entstehen nicht im Verkaufsgespräch, sondern im echten Austausch. Ein Format, das Ehrlichkeit fördert, schafft mehr als zehn Pitch-Präsentationen.',
    oeffentlich: true,
    beteiligteFirma1: 'Schleswig Logistik GmbH',
    beteiligteFirma2: 'DSV Transport Kolding',
    anonymisiert: false,
    verwendetCount: 6,
    createdAt: '2025-05-08',
  },
  {
    id: 'gg-003',
    titel: 'Als der Preis nicht das Problem war',
    typ: 'ueberraschung',
    kategorie: 'verhandlungen',
    status: 'geprueft',
    situation: 'Ein deutscher Hersteller bot einem dänischen Einkäufer einen aggressiven Rabatt an, um den Abschluss zu sichern.',
    verlauf: 'Der Däne lehnte überraschend ab – nicht wegen des Preises, sondern weil der schnelle Rabatt Misstrauen weckte: "Warum bietet er das an? Stimmt etwas mit dem Produkt nicht?"',
    erkenntnis: 'In Dänemark kann ein zu schneller Rabatt Vertrauen zerstören statt aufzubauen. Qualität und Verlässlichkeit überzeugen mehr als Preisnachlässe.',
    oeffentlich: false,
    anonymisiert: true,
    verwendetCount: 1,
    createdAt: '2025-05-15',
  },
];

// ─── HELPER ───────────────────────────────────────────────────

export function getKategorieLabel(kat: string): string {
  const labels: Record<string, string> = {
    kommunikation: 'Kommunikation',
    meetings: 'Meetings',
    hierarchien: 'Hierarchien',
    entscheidungen: 'Entscheidungen',
    humor: 'Humor',
    vertrieb: 'Vertrieb',
    kooperation: 'Kooperation',
    verhandlungen: 'Verhandlungen',
    sprache: 'Sprache',
    sonstiges: 'Sonstiges',
  };
  return labels[kat] || kat;
}

export function getKategorieIcon(kat: string): string {
  const icons: Record<string, string> = {
    kommunikation: '💬',
    meetings: '🤝',
    hierarchien: '🏢',
    entscheidungen: '✅',
    humor: '😄',
    vertrieb: '📈',
    kooperation: '🔗',
    verhandlungen: '⚖️',
    sprache: '🗣',
    sonstiges: '📌',
  };
  return icons[kat] || '📌';
}

export function getKategorieColor(kat: string): string {
  const colors: Record<string, string> = {
    kommunikation: '#2196F3',
    meetings: '#9C27B0',
    hierarchien: '#003366',
    entscheidungen: '#4CAF50',
    humor: '#FF9900',
    vertrieb: '#E91E63',
    kooperation: '#009688',
    verhandlungen: '#FF5722',
    sprache: '#00BCD4',
    sonstiges: '#999',
  };
  return colors[kat] || '#999';
}

export function getTonLabel(ton: string): string {
  return { humorvoll: 'Humorvoll', ernst: 'Ernst', neutral: 'Neutral', ueberraschend: 'Überraschend' }[ton] || ton;
}

export function getTonIcon(ton: string): string {
  return { humorvoll: '😄', ernst: '🎯', neutral: '💡', ueberraschend: '✨' }[ton] || '💡';
}

export function getLandFlagKultur(land: string): string {
  return { deutschland: '🇩🇪', daenemark: '🇩🇰', beide: '🇩🇪🇩🇰' }[land] || '🌍';
}

export function getWissenStatusLabel(status: string): string {
  return { entwurf: 'Entwurf', geprueft: 'Geprüft', veroeffentlicht: 'Veröffentlicht', archiviert: 'Archiviert' }[status] || status;
}

export function getWissenStatusColor(status: string): string {
  return { entwurf: '#999', geprueft: '#FF9900', veroeffentlicht: '#4CAF50', archiviert: '#ccc' }[status] || '#999';
}

export function getGeschichteTypLabel(typ: string): string {
  return {
    missverstaendnis: 'Missverständnis',
    erfolgsgeschichte: 'Erfolgsgeschichte',
    ueberraschung: 'Überraschung',
    erkenntnis: 'Erkenntnis',
  }[typ] || typ;
}

export function getGeschichteTypIcon(typ: string): string {
  return { missverstaendnis: '🔀', erfolgsgeschichte: '🌟', ueberraschung: '😲', erkenntnis: '💡' }[typ] || '📖';
}

export const KATEGORIEN = [
  'kommunikation', 'meetings', 'hierarchien', 'entscheidungen', 'humor',
  'vertrieb', 'kooperation', 'verhandlungen', 'sprache', 'sonstiges',
];
