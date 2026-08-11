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

// Offene (unbeantwortete) eingehende Mails eines Mandanten.
function offeneEingehende(client) {
  const alle = eventsSortiert(client)
  return alle.filter(e => {
    if (!istEingehend(e) || e.erledigtAm) return false
    const t = new Date(e.erstelltAm || 0).getTime()
    return !alle.some(x => !istEingehend(x) && x.status === 'gesendet' && new Date(x.erstelltAm || 0).getTime() > t)
  })
}

function checklistenZusammenfassung(client) {
  const cl = client?.checklisten ?? {}
  let erledigt = 0, offen = 0
  for (const items of Object.values(cl)) {
    if (!items || typeof items !== 'object') continue
    for (const e of Object.values(items)) { if (e && e.erledigt) erledigt++; else offen++ }
  }
  return { erledigtGesamt: erledigt, offenGesamt: offen }
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

const mandanten_liste = {
  name: 'mandanten_liste',
  description:
    'Gibt einen kompakten Überblick über ALLE aktiven Mandanten mit Status-Kennzahlen ' +
    '(in Bearbeitung, Abschluss fertig, offene Rückfragen, offene E-Mails). ' +
    'Ideal für Fragen über die ganze Kanzlei, für Vergleiche, Ranglisten oder „wer braucht Aufmerksamkeit".',
  mutating: false,
  input_schema: { type: 'object', properties: {} },
  run(_input, ctx) {
    const aktive = (ctx.clients ?? []).filter(c => !c.archiviert)
    return {
      anzahl: aktive.length,
      mandanten: aktive.map(c => ({
        mandantId: c.id,
        name: c.name,
        mandantennummer: c.mandantennummer || null,
        rechtsform: c.rechtsform || null,
        veranlagungsjahr: c.veranlagungsjahr ?? null,
        mandatstyp: c.mandatstyp || null,
        inBearbeitung: !!c.inBearbeitung,
        abschlussFertig: !!c.abschlussFertig,
        faUebermittelt: !!c.faUebermittelt,
        offeneRueckfragen: (c.rueckfragen ?? []).filter(r => !r.beantwortet).length,
        offeneMails: offeneEingehende(c).length,
      })),
    }
  },
}

const mandant_details = {
  name: 'mandant_details',
  description:
    'Liefert das VOLLE Bild eines Mandanten auf einmal: Stammdaten, Bearbeitungsstatus, ' +
    'Stand der Arbeit, Rückfragen, Checklisten-Stand, E-Mail-Überblick, Aufträge, Kontakte, Notizen. ' +
    'Nimm dieses Werkzeug, wenn du über einen Mandanten nachdenken oder Schlüsse ziehen sollst.',
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
    const rf = Array.isArray(c.rueckfragen) ? c.rueckfragen : []
    const alleEvents = eventsSortiert(c)
    const letzteAusgehend = alleEvents.find(e => !istEingehend(e) && e.status === 'gesendet')
    return {
      stammdaten: {
        name: c.name,
        mandantennummer: c.mandantennummer || null,
        rechtsform: c.rechtsform || null,
        gewinnermittlung: c.gewinnermittlung || null,
        veranlagungsjahr: c.veranlagungsjahr ?? null,
        steuernummer: c.steuernummer || null,
        ustId: c.ustId || null,
        unternehmensgegenstand: c.unternehmensgegenstand || null,
        korrespondenzsprache: c.korrespondenzsprache || 'de',
        mandatstyp: c.mandatstyp || null,
      },
      status: {
        inBearbeitung: !!c.inBearbeitung,
        abschlussFertig: !!c.abschlussFertig,
        abschlussFertigDatum: c.abschlussFertigDatum ?? null,
        steGesendet: c.steGesendetDatum ?? null,
        unterschrift: c.unterschriftDatum ?? null,
        faUebermittelt: !!c.faUebermittelt,
        faUebermitteltDatum: c.faUebermitteltDatum ?? null,
        jahresabschlussErforderlich: !!c.jahresabschlussErforderlich,
        ustZahlerTyp: c.ustZahlerTyp ?? null,
        lohnAktiv: !!c.lohnAktiv,
      },
      standDerArbeit: {
        hinweise: Array.isArray(sda.hinweise) ? sda.hinweise : [],
        offenePunkte: Array.isArray(sda.offenePunkte) ? sda.offenePunkte : [],
        berechnungen: Array.isArray(sda.berechnungen) ? sda.berechnungen : [],
      },
      rueckfragen: {
        anzahlOffen: rf.filter(r => !r.beantwortet).length,
        anzahlGesamt: rf.length,
        offen: rf.filter(r => !r.beantwortet).map(r => ({ text: r.text, buchungskonto: r.buchungskonto || null })),
        zuletztBeantwortet: rf.filter(r => r.beantwortet).slice(-5).map(r => ({ text: r.text, antwort: r.antwort || null, beantwortetAm: r.beantwortetAm || null })),
      },
      checklisten: checklistenZusammenfassung(c),
      mailUeberblick: {
        anzahlGesamt: alleEvents.length,
        offeneEingehende: offeneEingehende(c).length,
        letzteAntwortVonUnsAm: letzteAusgehend?.erstelltAm ?? null,
        letzteBetreffe: alleEvents.slice(0, 5).map(e => ({
          betreff: e.betreff || '(kein Betreff)',
          richtung: istEingehend(e) ? 'eingehend' : 'ausgehend',
          datum: e.erstelltAm || null,
        })),
      },
      auftraege: (Array.isArray(c.auftraege) ? c.auftraege : []).map(a => ({
        typ: a.typ || null,
        bezeichnung: a.bezeichnung || null,
        status: a.status || a.jaWorkflowStatus || null,
        jahr: a.jahr ?? a.abschlussJahr ?? null,
      })),
      kontakte: (Array.isArray(c.kontakte) ? c.kontakte : []).map(k => ({ name: k.name || null, rolle: k.rolle || null, email: k.email || null })),
      notizen: c.notizen || null,
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
  mandanten_liste,
  mandant_details,
  stand_der_arbeit,
  rueckfragen_lesen,
  mails_lesen,
  checkliste_lesen,
  mail_entwurf,
]

// Werkzeuge, die der Nutzer im Skill-Editor an-/abwählen kann (mandant_finden ist
// immer dabei und wird nicht separat angeboten).
export const WAEHLBARE_WERKZEUGE = [
  { name: 'mandanten_liste',   label: 'Kanzlei-Überblick (alle Mandanten)' },
  { name: 'mandant_details',   label: 'Ganzen Mandanten lesen (volles Bild)' },
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
