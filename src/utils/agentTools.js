/**
 * agentTools.js – Werkzeugkasten des Co-Trainers (Agenten-Startseite).
 *
 * Jedes Werkzeug ist eine reine Funktion über die im Arbeitsspeicher vorhandenen
 * Mandantendaten (`clients`). Dadurch funktionieren die Nachschlage-Skills sofort –
 * auch in der lokalen Vorschau, ohne Server.
 *
 * WICHTIG (Datensicherheit): In Version 1 sind ALLE Werkzeuge rein lesend bzw.
 * erzeugen nur einen Vorschlag (Mail-Entwurf). Kein Werkzeug verändert oder sendet
 * etwas. Verändernde Werkzeuge kommen später und laufen dann nur mit ausdrücklicher
 * Bestätigung (Feld `mutating` ist dafür vorbereitet).
 *
 * Aufbau eines Werkzeugs:
 *   {
 *     name, description, input_schema,   // für die Claude-Tool-Use-API
 *     mutating,                          // false = rein lesend
 *     run(input, ctx) -> serialisierbares Ergebnis
 *   }
 * ctx = { clients }
 */

// ── Hilfen ────────────────────────────────────────────────────────────────────
function norm(s) {
  return String(s ?? '').toLowerCase().trim()
}

// Findet Mandanten anhand Name oder Mandantennummer (unscharf, Teiltreffer).
function findeMandanten(clients, suchbegriff) {
  const q = norm(suchbegriff)
  if (!q) return []
  const aktive = (clients ?? []).filter(c => !c.archiviert)
  const treffer = aktive.filter(c =>
    norm(c.name).includes(q) ||
    norm(c.mandantennummer).includes(q) ||
    norm(c.mandantennummer2).includes(q) ||
    norm(c.mandantennummer3).includes(q)
  )
  // Exakte Namensgleichheit zuerst
  treffer.sort((a, b) => (norm(a.name) === q ? -1 : 0) - (norm(b.name) === q ? -1 : 0))
  return treffer.slice(0, 8)
}

function mandantById(clients, id) {
  return (clients ?? []).find(c => c.id === id) ?? null
}

// E-Mail-Events eines Mandanten, neueste zuerst.
function eventsSortiert(client) {
  const evs = client?.kommunikation?.events ?? []
  return [...evs].sort((a, b) => new Date(b.erstelltAm || 0) - new Date(a.erstelltAm || 0))
}

function istEingehend(ev) {
  return ev.typ === 'eingehend'
}

// ── Werkzeuge ─────────────────────────────────────────────────────────────────

const mandant_finden = {
  name: 'mandant_finden',
  description:
    'Findet Mandanten anhand von Name oder Mandantennummer. Immer ZUERST aufrufen, ' +
    'wenn der Nutzer einen Mandanten nennt, um die richtige mandantId zu bekommen. ' +
    'Gibt eine Liste möglicher Treffer zurück; bei mehreren nachfragen, welcher gemeint ist.',
  mutating: false,
  input_schema: {
    type: 'object',
    properties: {
      suchbegriff: { type: 'string', description: 'Name oder Nummer des Mandanten, z. B. "Carola Klimek"' },
    },
    required: ['suchbegriff'],
  },
  run(input, ctx) {
    const treffer = findeMandanten(ctx.clients, input.suchbegriff)
    return {
      anzahl: treffer.length,
      treffer: treffer.map(c => ({
        mandantId: c.id,
        name: c.name,
        mandantennummer: c.mandantennummer || null,
        rechtsform: c.rechtsform || null,
      })),
    }
  },
}

const stand_der_arbeit = {
  name: 'stand_der_arbeit',
  description:
    'Liest den aktuellen Bearbeitungsstand eines Mandanten: Status-Merkmale, ' +
    'offene Punkte und Hinweise aus dem Stand der Arbeit.',
  mutating: false,
  input_schema: {
    type: 'object',
    properties: { mandantId: { type: 'string' } },
    required: ['mandantId'],
  },
  run(input, ctx) {
    const c = mandantById(ctx.clients, input.mandantId)
    if (!c) return { fehler: 'Mandant nicht gefunden.' }
    const sda = c.standDerArbeit ?? {}
    return {
      name: c.name,
      inBearbeitung: !!c.inBearbeitung,
      status: {
        abschlussFertig: !!c.abschlussFertig,
        abschlussFertigDatum: c.abschlussFertigDatum ?? null,
        steGesendet: c.steGesendetDatum ?? null,
        unterschrift: c.unterschriftDatum ?? null,
        faUebermittelt: !!c.faUebermittelt,
        faUebermitteltDatum: c.faUebermitteltDatum ?? null,
      },
      hinweise: Array.isArray(sda.hinweise) ? sda.hinweise : [],
      offenePunkte: Array.isArray(sda.offenePunkte) ? sda.offenePunkte : [],
      berechnungen: Array.isArray(sda.berechnungen) ? sda.berechnungen : [],
      notizen: c.notizen || null,
    }
  },
}

const rueckfragen_lesen = {
  name: 'rueckfragen_lesen',
  description: 'Liest die Rückfragen eines Mandanten – offene und beantwortete, mit Datum und Antwort.',
  mutating: false,
  input_schema: {
    type: 'object',
    properties: { mandantId: { type: 'string' } },
    required: ['mandantId'],
  },
  run(input, ctx) {
    const c = mandantById(ctx.clients, input.mandantId)
    if (!c) return { fehler: 'Mandant nicht gefunden.' }
    const rf = Array.isArray(c.rueckfragen) ? c.rueckfragen : []
    const map = r => ({
      text: r.text,
      buchungskonto: r.buchungskonto || null,
      antwort: r.antwort || null,
      beantwortetAm: r.beantwortetAm || null,
    })
    return {
      name: c.name,
      offen: rf.filter(r => !r.beantwortet).map(map),
      beantwortet: rf.filter(r => r.beantwortet).map(map),
      anzahlOffen: rf.filter(r => !r.beantwortet).length,
      anzahlGesamt: rf.length,
    }
  },
}

const mails_lesen = {
  name: 'mails_lesen',
  description:
    'Liest die jüngste E-Mail-Kommunikation eines Mandanten: Betreff, Richtung (eingehend/ausgehend), ' +
    'Datum, ob unbeantwortet offen, und wann zuletzt eine Antwort von uns rausging. ' +
    'Hinweis: Volltexte sind evtl. nicht geladen (nur in der veröffentlichten Version) – dann nur Betreff/Metadaten.',
  mutating: false,
  input_schema: {
    type: 'object',
    properties: {
      mandantId: { type: 'string' },
      anzahl: { type: 'number', description: 'Wie viele der letzten Nachrichten (Standard 12)' },
    },
    required: ['mandantId'],
  },
  run(input, ctx) {
    const c = mandantById(ctx.clients, input.mandantId)
    if (!c) return { fehler: 'Mandant nicht gefunden.' }
    const alle = eventsSortiert(c)
    const limit = Math.min(Math.max(1, input.anzahl || 12), 40)

    const letzteAusgehend = alle.find(e => !istEingehend(e) && e.status === 'gesendet')
    const letzteEingehend = alle.find(e => istEingehend(e))
    // Offen = eingehende Mail, die noch nicht erledigt ist und nach der keine Antwort raus ging.
    const offen = alle.filter(e => {
      if (!istEingehend(e) || e.erledigtAm) return false
      const t = new Date(e.erstelltAm || 0).getTime()
      return !alle.some(x => !istEingehend(x) && x.status === 'gesendet' && new Date(x.erstelltAm || 0).getTime() > t)
    })

    return {
      name: c.name,
      anzahlGesamt: alle.length,
      letzteAntwortVonUnsAm: letzteAusgehend?.erstelltAm ?? null,
      letzteEingehendAm: letzteEingehend?.erstelltAm ?? null,
      offeneEingehende: offen.length,
      nachrichten: alle.slice(0, limit).map(e => ({
        betreff: e.betreff || '(kein Betreff)',
        richtung: istEingehend(e) ? 'eingehend' : 'ausgehend',
        von: e.absender || null,
        an: e.empfaenger || null,
        datum: e.erstelltAm || null,
        volltextGeladen: !!e.contentLoaded,
        auszug: e.contentLoaded && e.text ? String(e.text).slice(0, 400) : null,
      })),
    }
  },
}

const checkliste_lesen = {
  name: 'checkliste_lesen',
  description:
    'Gibt einen Überblick über die Prüfpunkte/Checklisten eines Mandanten: wie viele erledigt und wie viele offen sind.',
  mutating: false,
  input_schema: {
    type: 'object',
    properties: { mandantId: { type: 'string' } },
    required: ['mandantId'],
  },
  run(input, ctx) {
    const c = mandantById(ctx.clients, input.mandantId)
    if (!c) return { fehler: 'Mandant nicht gefunden.' }
    const cl = c.checklisten ?? {}
    let erledigt = 0, offen = 0
    const bereiche = []
    for (const [typId, items] of Object.entries(cl)) {
      if (!items || typeof items !== 'object') continue
      let e = 0, o = 0
      for (const eintrag of Object.values(items)) {
        if (eintrag && eintrag.erledigt) e++; else o++
      }
      erledigt += e; offen += o
      bereiche.push({ bereich: typId, erledigt: e, offen: o })
    }
    return { name: c.name, erledigtGesamt: erledigt, offenGesamt: offen, bereiche }
  },
}

const mail_entwurf = {
  name: 'mail_entwurf',
  description:
    'Erzeugt einen E-Mail-ENTWURF an den Mandanten (Betreff + Text). ' +
    'Sendet NICHTS – der Nutzer bekommt eine Vorschau und sendet selbst per Knopf. ' +
    'Nutze dieses Werkzeug, sobald du eine Mail formulieren sollst.',
  mutating: false,
  input_schema: {
    type: 'object',
    properties: {
      mandantId: { type: 'string' },
      betreff: { type: 'string' },
      text: { type: 'string', description: 'Der vollständige E-Mail-Text (Anrede bis Grußformel).' },
    },
    required: ['betreff', 'text'],
  },
  run(input, ctx) {
    const c = input.mandantId ? mandantById(ctx.clients, input.mandantId) : null
    // Der eigentliche Nutzen liegt im UI: Es erkennt "_entwurf" und zeigt die
    // Vorschau-Karte mit manuellem Sende-/Übernehmen-Knopf. Hier nur bestätigen.
    return {
      _entwurf: true,
      mandantId: input.mandantId ?? null,
      mandantName: c?.name ?? null,
      betreff: input.betreff || '',
      text: input.text || '',
      hinweis: 'Entwurf erstellt. Wird dem Nutzer als Vorschau gezeigt; Senden erfolgt manuell.',
    }
  },
}

// ── Registry ──────────────────────────────────────────────────────────────────
export const ALLE_WERKZEUGE = [
  mandant_finden,
  stand_der_arbeit,
  rueckfragen_lesen,
  mails_lesen,
  checkliste_lesen,
  mail_entwurf,
]

// Werkzeuge, die der Nutzer im Skill-Editor an-/abwählen kann (mandant_finden ist
// immer dabei und wird nicht separat angeboten).
export const WAEHLBARE_WERKZEUGE = [
  { name: 'stand_der_arbeit',  label: 'Stand der Arbeit lesen' },
  { name: 'rueckfragen_lesen', label: 'Rückfragen lesen' },
  { name: 'mails_lesen',       label: 'E-Mails lesen/zusammenfassen' },
  { name: 'checkliste_lesen',  label: 'Checklisten-Stand lesen' },
  { name: 'mail_entwurf',      label: 'Mail-Entwurf erstellen' },
]

const NACH_NAME = Object.fromEntries(ALLE_WERKZEUGE.map(t => [t.name, t]))

/**
 * Baut die Werkzeugliste für die Claude-API. `erlaubte` = Namen aus dem Skill
 * (leer/undefined => alle). mandant_finden ist immer enthalten.
 */
export function werkzeugeFuerSkill(erlaubte) {
  const set = new Set(['mandant_finden', ...(Array.isArray(erlaubte) && erlaubte.length ? erlaubte : ALLE_WERKZEUGE.map(t => t.name))])
  return ALLE_WERKZEUGE
    .filter(t => set.has(t.name))
    .map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema }))
}

/** Führt ein Werkzeug aus. Gibt immer ein serialisierbares Ergebnis zurück. */
export function fuehreWerkzeugAus(name, input, ctx) {
  const tool = NACH_NAME[name]
  if (!tool) return { fehler: `Unbekanntes Werkzeug: ${name}` }
  try {
    return tool.run(input ?? {}, ctx)
  } catch (e) {
    return { fehler: 'Werkzeugfehler: ' + (e?.message ?? String(e)) }
  }
}
