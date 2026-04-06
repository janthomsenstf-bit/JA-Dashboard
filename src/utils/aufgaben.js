// ─── Gemeinsame Aufgaben-Logik ────────────────────────────────────────────────
// Wird von FiBuJATab, LohnTab und GlobalTodoView geteilt.

export const MONAT_NAMEN = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember',
]

export const MONAT_KURZ = ['Jan','Feb','Mrz','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

export const TYP_CONFIG = {
  USt:    { label: 'USt-Voranmeldung', icon: '📊', color: '#1e3a5f', bg: 'rgba(30,58,95,0.1)'   },
  Lohn:   { label: 'Lohnabrechnung',   icon: '💼', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  JA:     { label: 'Jahresabschluss',  icon: '📁', color: '#0f766e', bg: 'rgba(15,118,110,0.1)'  },
  Zusatz: { label: 'Zusatzaufgabe',    icon: '⭐', color: '#92400e', bg: 'rgba(146,64,14,0.1)'  },
}

export const ZUSATZ_ARTEN = [
  'Jahresabschluss', 'Steuererklärung', 'Nacharbeit', 'Sonderaufgabe', 'Sonstiges',
]

// Alle Veranlagungsjahre eines Mandanten (dedupliziert)
export function getJahre(client) {
  return [client.veranlagungsjahr, client.veranlagungsjahr2, client.veranlagungsjahr3]
    .map(y => parseInt(y, 10))
    .filter(y => !isNaN(y) && y > 2000)
    .filter((y, i, arr) => arr.indexOf(y) === i)
    .sort()
}

// Fälligkeitsdatum als ISO-String
function faelligIso(year, month0based) {
  // month0based: 0=Januar → fällig Feb, 11=Dezember → fällig Januar nächstes Jahr
  if (month0based === 11) return new Date(year + 1, 0, 10).toISOString()
  return new Date(year, month0based + 1, 10).toISOString()
}

/**
 * Generiert alle Aufgaben für einen Mandanten basierend auf seinen Einstellungen.
 * Gibt ein Array von Task-Objekten zurück.
 */
export function generateAufgaben(client) {
  const tasks = []
  const jahre = getJahre(client)
  if (jahre.length === 0) return tasks

  for (const jahr of jahre) {
    const ustTyp = client.ustZahlerTyp ?? 'keine'

    // ── USt-Voranmeldungen ──────────────────────────────────────────
    if (ustTyp === 'monatlich') {
      for (let m = 0; m < 12; m++) {
        const mStr = String(m + 1).padStart(2, '0')
        tasks.push({
          key:      `ust-${jahr}-${mStr}`,
          type:     'USt',
          label:    `USt ${MONAT_NAMEN[m]} ${jahr}`,
          zeitraum: `${mStr}/${jahr}`,
          monat:    m + 1,
          quartal:  Math.ceil((m + 1) / 3),
          jahr,
          faellig:  faelligIso(jahr, m),
        })
      }
    } else if (ustTyp === 'quartalsweise') {
      // Fällig: 10. April, 10. Juli, 10. Oktober, 10. Januar (Folgejahr)
      // Anzeige-Monat: letzter Monat des Quartals (März, Juni, Sept, Dez)
      const faelligMon   = [3, 6, 9, 0]
      const faelligYOff  = [0, 0, 0, 1]
      const anzeigeMonat = [3, 6, 9, 12]   // März=3, Juni=6, September=9, Dezember=12
      for (let q = 0; q < 4; q++) {
        tasks.push({
          key:      `ust-${jahr}-q${q + 1}`,
          type:     'USt',
          label:    `USt Q${q + 1} ${jahr}`,
          zeitraum: `Q${q + 1}/${jahr}`,
          monat:    anzeigeMonat[q],        // nur in diesem Monat anzeigen
          quartal:  q + 1,
          jahr,
          faellig:  new Date(jahr + faelligYOff[q], faelligMon[q], 10).toISOString(),
        })
      }
    } else if (ustTyp === 'jährlich') {
      tasks.push({
        key:      `ust-${jahr}`,
        type:     'USt',
        label:    `USt Jahreserklärung ${jahr}`,
        zeitraum: `${jahr}`,
        monat:    null,
        quartal:  null,
        jahr,
        faellig:  new Date(jahr + 1, 6, 31).toISOString(), // 31. Juli Folgejahr
      })
    }

    // ── Lohn ────────────────────────────────────────────────────────
    if (client.lohnAktiv) {
      for (let m = 0; m < 12; m++) {
        const mStr = String(m + 1).padStart(2, '0')
        tasks.push({
          key:      `lohn-${jahr}-${mStr}`,
          type:     'Lohn',
          label:    `Lohn ${MONAT_NAMEN[m]} ${jahr}`,
          zeitraum: `${mStr}/${jahr}`,
          monat:    m + 1,
          quartal:  Math.ceil((m + 1) / 3),
          jahr,
          faellig:  null,
        })
      }
    }

    // ── Jahresabschluss ─────────────────────────────────────────────
    if (client.jahresabschlussErforderlich) {
      const jaMonat = client.jaMonat != null ? parseInt(client.jaMonat, 10) : null
      // jaMonat === 0  → "keine automatische Aufgabe" → überspringen
      // jaMonat === null/undefined → keine Einschränkung (monat: null = zeige immer)
      // jaMonat === 1–12 → nur in diesem Monat anzeigen
      if (jaMonat !== 0) {
        const monat = (jaMonat >= 1 && jaMonat <= 12) ? jaMonat : null
        tasks.push({
          key:      `ja-${jahr}`,
          type:     'JA',
          label:    `Jahresabschluss ${jahr}`,
          zeitraum: `${jahr}`,
          monat,
          quartal:  monat ? Math.ceil(monat / 3) : null,
          jahr,
          faellig:  null,
        })
      }
    }
  }

  // ── Zusatzaufgaben ──────────────────────────────────────────────────
  for (const z of (client.zusatzaufgaben ?? [])) {
    if (!z.bezeichnung?.trim() || !z.monat) continue
    const monat   = parseInt(z.monat, 10)
    const anzJahr = parseInt(z.anzeigeJahr, 10)
    if (isNaN(monat) || monat < 1 || monat > 12 || isNaN(anzJahr)) continue
    tasks.push({
      key:      `zusatz-${z.id}`,
      type:     'Zusatz',
      label:    z.bezeichnung.trim(),
      zeitraum: z.betroffJahr ? `${z.betroffJahr}` : `${anzJahr}`,
      monat,
      quartal:  Math.ceil(monat / 3),
      jahr:     anzJahr,
      faellig:  null,
      notiz:    z.notiz ?? '',
      art:      z.art ?? 'Sonstiges',
    })
  }

  return tasks
}

// Status eines Tasks aus client.aufgabenStatus lesen
export function getStatus(client, key) {
  return (client.aufgabenStatus ?? {})[key] ?? { erledigt: false, erledigtAm: null }
}

// Liefert ein Patch-Objekt für onUpdate beim Togglen
export function buildTogglePatch(client, key) {
  const current = getStatus(client, key)
  const next = current.erledigt
    ? { erledigt: false, erledigtAm: null }
    : { erledigt: true,  erledigtAm: new Date().toISOString() }
  return { aufgabenStatus: { ...(client.aufgabenStatus ?? {}), [key]: next } }
}

// Formatierung
export function fmtDatum(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
}

export function isUeberfaellig(faelligIsoStr) {
  if (!faelligIsoStr) return false
  return new Date() > new Date(faelligIsoStr)
}
