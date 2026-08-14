/**
 * aktionskatalog.js – Der einheitliche Aktionskatalog des AI-Mitarbeiters (BP 0).
 *
 * EINZIGE QUELLE erlaubter Aktionen. Die AI erfindet keine Buttons, sondern wählt
 * ausschließlich aus diesem Katalog. UI-Knöpfe werden aus dem Katalog erzeugt,
 * nicht von Hand. Neue Fähigkeit = neue Zeile hier, kein Sonder-Button.
 *
 * Sicherheitsstufen:
 *   'auto'        – reines Lesen/Anzeigen, keine Änderung.
 *   'bestaetigen' – verändert Daten, aber additiv & umkehrbar → 1 Klick Freigabe.
 *   'freigeben'   – außenwirksam/unwiderruflich (Mail senden, Löschen) →
 *                   IMMER eigener Klick; NIE automatisch in „Alle ausführen".
 *
 * `datenanschluss` benennt den bereits vorhandenen App-Setter/Store, über den
 * später sicher geschrieben wird (siehe aktionDispatcher.js / Adapter). Aktionen,
 * die noch keine App-Anbindung haben, tragen `implementiert: false`.
 */

export const KATEGORIEN = {
  aufgaben:      { label: 'Aufgaben',      icon: '✅' },
  fristen:       { label: 'Fristen',       icon: '⏰' },
  wiedervorlage: { label: 'Wiedervorlage', icon: '🔔' },
  kommunikation: { label: 'Kommunikation', icon: '📧' },
  kalender:      { label: 'Kalender',      icon: '📅' },
  dokumente:     { label: 'Dokumente',     icon: '📎' },
  vorgang:       { label: 'Vorgang',       icon: '📝' },
  ja:            { label: 'Jahresabschluss', icon: '📊' },
  mandant:       { label: 'Mandant',       icon: '👤' },
  recherche:     { label: 'Recherche',     icon: '🔎' },
  ai:            { label: 'AI',            icon: '🤖' },
}

/**
 * Der Katalog. Jede Aktion:
 *   id           – stabiler Schlüssel (von der AI referenziert)
 *   label, icon  – für die Anzeige des CTA-Buttons
 *   kategorie    – Schlüssel aus KATEGORIEN
 *   stufe        – 'auto' | 'bestaetigen' | 'freigeben'
 *   umkehrbar    – ob die Aktion rückgängig gemacht werden kann
 *   params       – erwartete Parameter (key, label, required)
 *   datenanschluss – Adapter-Methode / Store (Doku für die Bau-Sitzung)
 *   implementiert  – ob der App-Adapter das schon kann
 */
export const AKTIONEN = [
  {
    id: 'aufgabe_anlegen', label: 'Aufgabe anlegen', icon: '✅', kategorie: 'aufgaben',
    stufe: 'bestaetigen', umkehrbar: true, implementiert: true,
    datenanschluss: "addAufgabe({typ:'einmal',…}) → aufgabenListe",
    params: [
      { key: 'titel', label: 'Titel', required: true },
      { key: 'mandantId', label: 'Mandant', required: false },
      { key: 'faelligkeit', label: 'Fällig (YYYY-MM-DD)', required: false },
      { key: 'beschreibung', label: 'Beschreibung', required: false },
    ],
  },
  {
    id: 'frist_anlegen', label: 'Frist eintragen', icon: '⏰', kategorie: 'fristen',
    stufe: 'bestaetigen', umkehrbar: true, implementiert: true,
    datenanschluss: "addAufgabe(…) mit Fristdatum",
    params: [
      { key: 'titel', label: 'Bezeichnung', required: true },
      { key: 'faelligkeit', label: 'Datum (YYYY-MM-DD)', required: true },
      { key: 'mandantId', label: 'Mandant', required: false },
    ],
  },
  {
    id: 'wiedervorlage_anlegen', label: 'Wiedervorlage', icon: '🔔', kategorie: 'wiedervorlage',
    stufe: 'bestaetigen', umkehrbar: true, implementiert: true,
    datenanschluss: "addAufgabe(…)/Wiedervorlage-Feld (BotInbox/AuftraegeTab)",
    params: [
      { key: 'bezug', label: 'Worum', required: true },
      { key: 'faelligkeit', label: 'Datum (YYYY-MM-DD)', required: true },
      { key: 'mandantId', label: 'Mandant', required: false },
    ],
  },
  {
    id: 'rueckfrage_anlegen', label: 'Rückfrage erfassen', icon: '❓', kategorie: 'vorgang',
    stufe: 'bestaetigen', umkehrbar: true, implementiert: true,
    datenanschluss: "addRueckfrage(clientId, text) → client.rueckfragen",
    params: [
      { key: 'mandantId', label: 'Mandant', required: true },
      { key: 'text', label: 'Rückfrage', required: true },
    ],
  },
  {
    id: 'anruf_aufgabe', label: 'Anruf-Aufgabe', icon: '📞', kategorie: 'kommunikation',
    stufe: 'bestaetigen', umkehrbar: true, implementiert: true,
    datenanschluss: "addAufgabe(…) Typ Anruf",
    params: [
      { key: 'mandantId', label: 'Mandant', required: true },
      { key: 'worum', label: 'Worum', required: true },
      { key: 'faelligkeit', label: 'Bis wann', required: false },
    ],
  },
  {
    id: 'notiz_anlegen', label: 'Notiz hinterlegen', icon: '📝', kategorie: 'vorgang',
    stufe: 'bestaetigen', umkehrbar: true, implementiert: true,
    datenanschluss: "client.notizen / kommunikation.events",
    params: [
      { key: 'mandantId', label: 'Mandant', required: true },
      { key: 'text', label: 'Notiz', required: true },
    ],
  },
  {
    id: 'termin_anlegen', label: 'Termin anlegen', icon: '📅', kategorie: 'kalender',
    stufe: 'bestaetigen', umkehrbar: true, implementiert: true,
    datenanschluss: "addTermin(t) → termine",
    params: [
      { key: 'titel', label: 'Titel', required: true },
      { key: 'start', label: 'Start (ISO)', required: true },
      { key: 'mandantId', label: 'Mandant', required: false },
    ],
  },
  {
    id: 'mail_entwurf', label: 'Mail vorbereiten', icon: '📧', kategorie: 'kommunikation',
    stufe: 'bestaetigen', umkehrbar: true, implementiert: true,
    datenanschluss: "KI-Entwurf + Compose (KommunikationTab)",
    params: [
      { key: 'mandantId', label: 'Mandant', required: false },
      { key: 'betreff', label: 'Betreff', required: true },
      { key: 'text', label: 'Text', required: true },
    ],
  },
  {
    id: 'mail_senden', label: 'Mail senden', icon: '📤', kategorie: 'kommunikation',
    stufe: 'freigeben', umkehrbar: false, implementiert: false,
    datenanschluss: "api/send-email (nur nach ausdrücklichem Klick)",
    params: [{ key: 'entwurfId', label: 'Entwurf', required: true }],
  },
  {
    id: 'beleg_ablegen', label: 'Belege ablegen', icon: '📎', kategorie: 'dokumente',
    stufe: 'bestaetigen', umkehrbar: true, implementiert: false,
    datenanschluss: "OneDrive createFolder/moveItem (Posteingang-Logik)",
    params: [
      { key: 'dateien', label: 'Dateien', required: true },
      { key: 'ziel', label: 'Zielordner/Auftrag', required: true },
    ],
  },
  {
    id: 'dok_an_auftrag', label: 'Dokument → Auftrag', icon: '🗂️', kategorie: 'dokumente',
    stufe: 'bestaetigen', umkehrbar: true, implementiert: false,
    datenanschluss: "auftragId-Kopplung (im Aufbau)",
    params: [
      { key: 'dokId', label: 'Dokument', required: true },
      { key: 'auftragId', label: 'Auftrag', required: true },
    ],
  },
  {
    id: 'beleg_suchen', label: 'Fehlenden Beleg suchen', icon: '🔎', kategorie: 'dokumente',
    stufe: 'auto', umkehrbar: true, implementiert: false,
    datenanschluss: "OneDrive searchDrive (nur anzeigen)",
    params: [
      { key: 'mandantId', label: 'Mandant', required: true },
      { key: 'was', label: 'Gesucht', required: true },
    ],
  },
  {
    id: 'pruefpunkt_anlegen', label: 'Prüfpunkt anlegen', icon: '📊', kategorie: 'ja',
    stufe: 'bestaetigen', umkehrbar: true, implementiert: false,
    datenanschluss: "client.checklisten / standDerArbeit.offenePunkte",
    params: [
      { key: 'mandantId', label: 'Mandant', required: true },
      { key: 'text', label: 'Prüfpunkt', required: true },
      { key: 'jahr', label: 'Jahr', required: false },
    ],
  },
  {
    id: 'pruefpunkt_erledigen', label: 'Prüfpunkt erledigen', icon: '✓', kategorie: 'ja',
    stufe: 'bestaetigen', umkehrbar: true, implementiert: false,
    datenanschluss: "client.checklisten[typ][item].erledigt",
    params: [
      { key: 'mandantId', label: 'Mandant', required: true },
      { key: 'punktId', label: 'Prüfpunkt', required: true },
    ],
  },
  {
    id: 'auftrag_blockieren', label: 'Auftrag blockieren', icon: '🚧', kategorie: 'ja',
    stufe: 'bestaetigen', umkehrbar: true, implementiert: false,
    datenanschluss: "Status-Feld am Auftrag (client.auftraege)",
    params: [
      { key: 'mandantId', label: 'Mandant', required: true },
      { key: 'auftragId', label: 'Auftrag', required: true },
      { key: 'grund', label: 'Grund', required: true },
    ],
  },
  {
    id: 'stammdaten_aktualisieren', label: 'Stammdaten ändern', icon: '👤', kategorie: 'mandant',
    stufe: 'bestaetigen', umkehrbar: true, implementiert: true,
    datenanschluss: "updateClient(id, patch)",
    params: [
      { key: 'mandantId', label: 'Mandant', required: true },
      { key: 'patch', label: 'Änderungen', required: true },
    ],
  },
  {
    id: 'recherche', label: 'Sachverhalt recherchieren', icon: '🔍', kategorie: 'recherche',
    stufe: 'auto', umkehrbar: true, implementiert: false,
    datenanschluss: "(neu – Internet, noch nicht vorhanden)",
    params: [{ key: 'frage', label: 'Frage', required: true }],
  },
  {
    id: 'weitere_pruefung', label: 'AI-Prüfung vertiefen', icon: '🤖', kategorie: 'ai',
    stufe: 'auto', umkehrbar: true, implementiert: false,
    datenanschluss: "interner KI-Aufruf",
    params: [{ key: 'kontext', label: 'Kontext', required: true }],
  },
]

const NACH_ID = Object.fromEntries(AKTIONEN.map(a => [a.id, a]))

/** Katalog-Definition zu einer Aktions-id. */
export function aktionDef(id) {
  return NACH_ID[id] ?? null
}

/** Darf die Aktion in „Alle ausführen" automatisch mitlaufen? (alles außer 'freigeben') */
export function istBatchfaehig(id) {
  const def = NACH_ID[id]
  return !!def && def.stufe !== 'freigeben'
}

/** Farbe/Label je Sicherheitsstufe (für Badges). */
export const STUFEN = {
  auto:        { label: 'Anzeigen',    farbe: 'var(--text-muted)' },
  bestaetigen: { label: 'Bestätigen',  farbe: 'var(--accent)' },
  freigeben:   { label: 'Freigabe',    farbe: 'var(--red)' },
}
