/**
 * skillsStorage.js – Speicher für die Skills der Agenten-Startseite („Co-Trainer").
 *
 * Ein Skill ist ein benannter, wiederverwendbarer Arbeitsauftrag: ein gespeicherter
 * Satz Anweisung + welche Werkzeuge er benutzen darf. Der Nutzer legt eigene Skills
 * selbst an (SkillEditor). Standard-Skills sind mitgeliefert und als `builtin`
 * markiert – sie lassen sich anpassen, aber nicht löschen.
 *
 * Gespeichert wird gleich wie die E-Mail-Vorlagen: lokal in localStorage und
 * cloud-persistent über cloudSave('spielbuch-skills-v1', …) in App.jsx.
 */

export const SKILLS_KEY = 'spielbuch-skills-v1'

// Namen der verfügbaren Werkzeuge – müssen mit agentTools.js übereinstimmen.
export const TOOL_STAND      = 'stand_der_arbeit'
export const TOOL_RUECKFRAGE = 'rueckfragen_lesen'
export const TOOL_MAILS      = 'mails_lesen'
export const TOOL_CHECKLISTE = 'checkliste_lesen'
export const TOOL_ENTWURF    = 'mail_entwurf'

export function genSkillId() {
  return 'skl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
}

/**
 * Standard-Skills. Diese werden beim ersten Start eingesetzt und decken genau die
 * Wünsche ab, die im Alltag am meisten gebraucht werden. `id` ist stabil, damit
 * Anpassungen des Nutzers erhalten bleiben.
 */
export function defaultSkills() {
  return [
    {
      id: 'builtin_stand',
      builtin: true,
      name: 'Stand der Arbeiten',
      icon: '📌',
      beschreibung: 'Fasst zusammen, wie weit ein Mandant ist – Stand, offene Punkte, offene Rückfragen.',
      anweisung:
        'Fasse den aktuellen Stand der Arbeiten für den genannten Mandanten knapp zusammen. ' +
        'Nenne: den Bearbeitungsstatus, offene Punkte aus dem Stand der Arbeit und die Anzahl noch offener Rückfragen. ' +
        'Schreibe in kurzen Stichpunkten, keine Erfindungen – nur was die Werkzeuge liefern.',
      werkzeuge: [TOOL_STAND, TOOL_RUECKFRAGE],
      brauchtMandant: true,
    },
    {
      id: 'builtin_rueckfragen',
      builtin: true,
      name: 'Offene Rückfragen',
      icon: '❓',
      beschreibung: 'Zeigt die offenen und die zuletzt gestellten Rückfragen zu einem Mandanten.',
      anweisung:
        'Liste die Rückfragen des genannten Mandanten auf: zuerst die offenen (unbeantworteten), ' +
        'danach kurz die zuletzt beantworteten mit Datum. Gruppiere klar und bleibe knapp.',
      werkzeuge: [TOOL_RUECKFRAGE],
      brauchtMandant: true,
    },
    {
      id: 'builtin_mails',
      builtin: true,
      name: 'Mail-Zusammenfassung',
      icon: '✉️',
      beschreibung: 'Fasst die letzte E-Mail-Kommunikation zusammen und sagt, wann du zuletzt geantwortet hast.',
      anweisung:
        'Fasse die letzte E-Mail-Kommunikation mit dem genannten Mandanten zusammen. ' +
        'Nenne die wichtigsten Betreffzeilen mit Datum und Richtung, ob etwas unbeantwortet offen ist, ' +
        'und wann zuletzt eine Antwort von uns rausging. Wenn Volltexte nicht geladen sind, sag das ehrlich.',
      werkzeuge: [TOOL_MAILS],
      brauchtMandant: true,
    },
    {
      id: 'builtin_entwurf',
      builtin: true,
      name: 'Mail-Entwurf',
      icon: '📝',
      beschreibung: 'Formuliert eine E-Mail an den Mandanten. Du bekommst eine Vorschau – gesendet wird nur per deinem Knopf.',
      anweisung:
        'Formuliere auf Basis meiner Vorgabe eine freundliche, professionelle E-Mail an den Mandanten. ' +
        'Wenn hilfreich, ziehe die letzte Kommunikation als Kontext heran. ' +
        'Erzeuge den Entwurf ausschließlich über das Werkzeug „mail_entwurf" (Betreff + Text). ' +
        'Sende nichts – der Nutzer prüft und sendet selbst.',
      werkzeuge: [TOOL_MAILS, TOOL_ENTWURF],
      brauchtMandant: true,
    },
  ]
}

export function loadSkills() {
  try {
    const raw = localStorage.getItem(SKILLS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch { /* ignore */ }
  return defaultSkills()
}

export function saveSkills(skills) {
  try {
    localStorage.setItem(SKILLS_KEY, JSON.stringify(skills))
  } catch { /* ignore */ }
}

/**
 * Führt gespeicherte Skills mit den Standard-Skills zusammen: fehlt ein Builtin
 * (z. B. neu hinzugekommen), wird es ergänzt, ohne die Anpassungen des Nutzers an
 * bereits vorhandenen Skills zu überschreiben.
 */
export function mergeWithDefaults(skills) {
  const list = Array.isArray(skills) ? [...skills] : []
  const vorhandene = new Set(list.map(s => s.id))
  for (const def of defaultSkills()) {
    if (!vorhandene.has(def.id)) list.push(def)
  }
  return list
}
