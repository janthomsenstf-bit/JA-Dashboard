// ─── Gemeinsame Aufgaben-Logik ────────────────────────────────────────────────
// Konfiguration erfolgt über den „Auftrag"-Block im Reiter Stammdaten.
// Der Reiter „Aufgaben" zeigt nur noch die generierten Ergebnisse an.

export const MONAT_NAMEN = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember',
]

export const MONAT_KURZ = ['Jan','Feb','Mrz','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']

export const TYP_CONFIG = {
  USt:     { label: 'USt-Voranmeldung',    icon: '📊', color: '#1e3a5f', bg: 'rgba(30,58,95,0.1)'    },
  Lohn:    { label: 'Lohnabrechnung',      icon: '💼', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)'  },
  LohnSV:  { label: 'SV-Beitragsnachweis', icon: '🏛',  color: '#0f766e', bg: 'rgba(15,118,110,0.1)'  },
  JA:      { label: 'Jahresabschluss',     icon: '📁', color: '#c2410c', bg: 'rgba(194,65,12,0.1)'   },
  Zusatz:  { label: 'Zusatzaufgabe',       icon: '⭐', color: '#92400e', bg: 'rgba(146,64,14,0.1)'   },
  Manuell: { label: 'Aufgabe',             icon: '📌', color: '#0e7490', bg: 'rgba(14,116,144,0.1)'  },
}

export const ZUSATZ_ARTEN = [
  'Jahresabschluss', 'Steuererklärung', 'Nacharbeit', 'Sonderaufgabe', 'Sonstiges',
]

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/** Addiert offsetMonate auf (jahr, monat1based) mit Jahr-Rollover. */
function addMonate(jahr, monat1based, offsetMonate) {
  let m = (monat1based - 1) + offsetMonate  // 0-based
  const jahrOff = Math.floor(m / 12)
  m = ((m % 12) + 12) % 12                  // immer positiv
  return { jahr: jahr + jahrOff, monat: m + 1 }
}

/** Alle Veranlagungsjahre eines Mandanten (dedupliziert, sortiert). */
export function getJahre(client) {
  return [client.veranlagungsjahr, client.veranlagungsjahr2, client.veranlagungsjahr3]
    .map(y => parseInt(y, 10))
    .filter(y => !isNaN(y) && y > 2000)
    .filter((y, i, arr) => arr.indexOf(y) === i)
    .sort()
}

// ── Kernfunktion: Aufgaben generieren ─────────────────────────────────────────
/**
 * Generiert alle Aufgaben für einen Mandanten.
 *
 * WICHTIG: Aufgaben erscheinen im FRISTMONAT, nicht im Leistungsmonat.
 *   - USt monatlich ohne DFV: April-Leistung → erscheint im Mai (Frist 10. Mai)
 *   - USt monatlich mit DFV:  April-Leistung → erscheint im Juni (Frist 10. Juni)
 *   - Lohn: Abrechnung fällig 25., SV-Beitragsnachweis fällig 26. des Monats
 *   - JA: erscheint nur im geplanten Bearbeitungsmonat (im Folgejahr)
 *
 * Konfigurationsquellen (aus client):
 *   USt:  ustZahlerTyp ('monatlich'|'quartalsweise'|'jährlich'|'keine'), dauerfriv
 *   Lohn: lohnAktiv, lohnArt ('standard'|'baulohn'|'sonstiges')
 *   JA:   jaAuftraege [{id, geschaeftsjahr, monat, aktiv}]
 *         Fallback: jahresabschlussErforderlich + jaMonat + veranlagungsjahr*
 */
export function generateAufgaben(client) {
  const tasks     = []
  const dauerfriv = client.dauerfriv === true
  const jahre     = getJahre(client)
  if (jahre.length === 0) return tasks

  for (const leistungsJahr of jahre) {
    const ustTyp = client.ustZahlerTyp ?? 'keine'

    // ── USt-Voranmeldungen ────────────────────────────────────────────────────
    // Fristmonat = Leistungsmonat + 1 (ohne DFV) oder + 2 (mit DFV)
    // t.monat = Fristmonat → Aufgabe erscheint im richtigen Monat in der Übersicht
    if (ustTyp === 'monatlich') {
      for (let lm = 1; lm <= 12; lm++) {
        const offset             = dauerfriv ? 2 : 1
        const { jahr, monat }    = addMonate(leistungsJahr, lm, offset)
        tasks.push({
          key:            `ust-${leistungsJahr}-${String(lm).padStart(2, '0')}`,
          type:           'USt',
          label:          `USt ${MONAT_NAMEN[lm - 1]} ${leistungsJahr}${dauerfriv ? ' (DFV)' : ''}`,
          leistungsMonat: lm,
          leistungsJahr,
          monat,           // Fristmonat
          quartal:         Math.ceil(monat / 3),
          jahr,            // ggf. Folgejahr (Dez → Jan)
          faellig:         new Date(jahr, monat - 1, 10).toISOString(),
        })
      }
    } else if (ustTyp === 'quartalsweise') {
      // Letzter Leistungsmonat des Quartals: März(3), Juni(6), Sept(9), Dez(12)
      for (let q = 0; q < 4; q++) {
        const lm              = [3, 6, 9, 12][q]
        const offset          = dauerfriv ? 2 : 1
        const { jahr, monat } = addMonate(leistungsJahr, lm, offset)
        tasks.push({
          key:            `ust-${leistungsJahr}-q${q + 1}`,
          type:           'USt',
          label:          `USt Q${q + 1} ${leistungsJahr}${dauerfriv ? ' (DFV)' : ''}`,
          leistungsMonat: lm,
          leistungsJahr,
          monat,
          quartal:        q + 1,
          jahr,
          faellig:        new Date(jahr, monat - 1, 10).toISOString(),
        })
      }
    } else if (ustTyp === 'jährlich') {
      tasks.push({
        key:            `ust-${leistungsJahr}`,
        type:           'USt',
        label:          `USt Jahreserklärung ${leistungsJahr}`,
        leistungsMonat: 12,
        leistungsJahr,
        monat:          7,
        quartal:        3,
        jahr:           leistungsJahr + 1,
        faellig:        new Date(leistungsJahr + 1, 6, 31).toISOString(),
      })
    }

    // ── Lohnabrechnung + SV-Beitragsnachweis ─────────────────────────────────
    // Pro Monat zwei Aufgaben:
    //   1) Lohnabrechnung      → fällig 25. des Monats (letzter Arbeitstag approx.)
    //   2) SV-Beitragsnachweis → fällig 26. des Monats (§28f Abs.3 SGB IV:
    //      zwei Werktage vor Fälligkeit der Beiträge = 26. des Monats)
    if (client.lohnAktiv) {
      const artSuffix = client.lohnArt === 'baulohn' ? ' (Bau)' : ''
      for (let lm = 1; lm <= 12; lm++) {
        const mStr = String(lm).padStart(2, '0')
        tasks.push({
          key:            `lohn-${leistungsJahr}-${mStr}`,
          type:           'Lohn',
          label:          `Lohnabrechnung ${MONAT_NAMEN[lm - 1]} ${leistungsJahr}${artSuffix}`,
          leistungsMonat: lm,
          leistungsJahr,
          monat:          lm,
          quartal:        Math.ceil(lm / 3),
          jahr:           leistungsJahr,
          faellig:        new Date(leistungsJahr, lm - 1, 25).toISOString(),
        })
        tasks.push({
          key:            `lohn-sv-${leistungsJahr}-${mStr}`,
          type:           'LohnSV',
          label:          `SV-Beitragsnachweis ${MONAT_NAMEN[lm - 1]} ${leistungsJahr}`,
          leistungsMonat: lm,
          leistungsJahr,
          monat:          lm,
          quartal:        Math.ceil(lm / 3),
          jahr:           leistungsJahr,
          faellig:        new Date(leistungsJahr, lm - 1, 26).toISOString(),
        })
      }
    }
  }

  // ── Jahresabschluss (neue Struktur via jaAuftraege) ───────────────────────
  // Erscheint im Bearbeitungsmonat des FOLGEJAHRES (geschaeftsjahr + 1).
  const jaAuftraege = Array.isArray(client.jaAuftraege) ? client.jaAuftraege : []
  for (const ja of jaAuftraege) {
    if (!ja.aktiv) continue
    const gj    = parseInt(ja.geschaeftsjahr, 10)
    const monat = parseInt(ja.monat, 10)
    if (isNaN(gj) || isNaN(monat) || monat < 1 || monat > 12) continue
    tasks.push({
      key:           `ja-${ja.id ?? gj}`,
      type:          'JA',
      label:         `Jahresabschluss ${gj}`,
      leistungsJahr: gj,
      monat,
      quartal:       Math.ceil(monat / 3),
      jahr:          gj + 1,   // Bearbeitungsjahr = Folgejahr
      faellig:       null,
    })
  }

  // Fallback: alte Struktur (veranlagungsjahr + jaMonat)
  if (jaAuftraege.length === 0 && client.jahresabschlussErforderlich) {
    for (const jahr of jahre) {
      const jaMonat = client.jaMonat != null ? parseInt(client.jaMonat, 10) : null
      if (jaMonat === 0) continue
      const monat = (jaMonat >= 1 && jaMonat <= 12) ? jaMonat : null
      tasks.push({
        key:     `ja-${jahr}`,
        type:    'JA',
        label:   `Jahresabschluss ${jahr}`,
        monat,
        quartal: monat ? Math.ceil(monat / 3) : null,
        jahr,
        faellig: null,
      })
    }
  }

  // ── Zusatzaufgaben ─────────────────────────────────────────────────────────
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

// ── Status-Helpers ─────────────────────────────────────────────────────────────

export function getStatus(client, key) {
  return (client.aufgabenStatus ?? {})[key] ?? { erledigt: false, erledigtAm: null }
}

export function buildTogglePatch(client, key) {
  const current = getStatus(client, key)
  const next = current.erledigt
    ? { erledigt: false, erledigtAm: null }
    : { erledigt: true,  erledigtAm: new Date().toISOString() }
  return { aufgabenStatus: { ...(client.aufgabenStatus ?? {}), [key]: next } }
}

export function fmtDatum(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
}

export function isUeberfaellig(faelligIsoStr) {
  if (!faelligIsoStr) return false
  return new Date() > new Date(faelligIsoStr)
}

// ── Datums-Helper für individuelle Intervalle ─────────────────────────────────
/** Addiert ein freies Intervall auf ein Date-Objekt. Exportiert für Preview-Berechnung. */
export function addIntervalDate(date, typ, wert) {
  const nd = new Date(date)
  const w  = Math.max(1, parseInt(wert, 10))
  if (typ === 'tage')   nd.setDate(nd.getDate() + w)
  if (typ === 'wochen') nd.setDate(nd.getDate() + w * 7)
  if (typ === 'monate') nd.setMonth(nd.getMonth() + w)
  return nd
}

// ── Manuelle Aufgaben (Einmal & Serien) ────────────────────────────────────────
/**
 * Generiert Task-Objekte aus manuellen Aufgaben (Einmal & Serien).
 * Gleiche Struktur wie generateAufgaben(), damit sie in GlobalTodoView
 * zusammen mit auto-generierten Tasks gefiltert/angezeigt werden können.
 *
 * @param {Array}  aufgabenListe  Globale manuelle Aufgaben aus App-State
 * @param {number} filterJahr     Für Serien: nur Instanzen dieses Jahres generieren
 */
export function generateManuelleAufgaben(aufgabenListe, filterJahr) {
  const tasks = []
  if (!Array.isArray(aufgabenListe)) return tasks

  for (const aufgabe of aufgabenListe) {
    if (!aufgabe?.id) continue

    // ── Einmalaufgabe ──────────────────────────────────────────────────────────
    if (aufgabe.typ === 'einmal') {
      if (!aufgabe.faellig) continue
      const d = new Date(aufgabe.faellig)
      if (isNaN(d.getTime())) continue
      const jahr = d.getFullYear()
      if (filterJahr !== undefined && filterJahr !== null && jahr !== filterJahr) continue
      const monat = d.getMonth() + 1
      tasks.push({
        key:          aufgabe.id,
        type:         'Manuell',
        label:        aufgabe.titel ?? '(Aufgabe)',
        beschreibung: aufgabe.beschreibung ?? '',
        mandantId:    aufgabe.mandantId ?? null,
        monat,
        quartal:      Math.ceil(monat / 3),
        jahr,
        faellig:      d.toISOString(),
        erledigt:     aufgabe.erledigt ?? false,
        erledigtAm:   aufgabe.erledigtAm ?? null,
        istManuell:   true,
        istSerie:     false,
        aufgabeId:    aufgabe.id,
      })

    // ── Serienaufgabe ──────────────────────────────────────────────────────────
    } else if (aufgabe.typ === 'serie') {
      const startD     = new Date(aufgabe.startDatum ?? new Date().toISOString().slice(0, 10))
      const endD       = aufgabe.endDatum ? new Date(aufgabe.endDatum) : null
      const faelligTag = Math.min(Math.max(parseInt(aufgabe.faelligTag ?? 1, 10), 1), 28)
      const freq       = aufgabe.frequenz ?? 'monatlich'
      const genYear    = (filterJahr !== undefined && filterJahr !== null) ? filterJahr : new Date().getFullYear()
      const erlInst    = aufgabe.erledigtInstanzen ?? {}

      function pushInst(monat, quartal, instKey) {
        const instanceDate = new Date(genYear, monat - 1, faelligTag)
        if (instanceDate < startD) return
        if (endD && instanceDate > endD) return
        const info = erlInst[instKey] ?? {}
        tasks.push({
          key:          `${aufgabe.id}::${instKey}`,
          type:         'Manuell',
          label:        aufgabe.titel ?? '(Aufgabe)',
          beschreibung: aufgabe.beschreibung ?? '',
          mandantId:    aufgabe.mandantId ?? null,
          monat,
          quartal,
          jahr:         genYear,
          faellig:      instanceDate.toISOString(),
          erledigt:     info.erledigt ?? false,
          erledigtAm:   info.erledigtAm ?? null,
          istManuell:   true,
          istSerie:     true,
          aufgabeId:    aufgabe.id,
          serieInstanz: instKey,
        })
      }

      if (freq === 'monatlich') {
        for (let m = 1; m <= 12; m++) {
          const mk = `${genYear}-${String(m).padStart(2, '0')}`
          pushInst(m, Math.ceil(m / 3), mk)
        }
      } else if (freq === 'quartalsweise') {
        for (let q = 1; q <= 4; q++) {
          const m = q * 3  // letzter Quartalsmonat
          pushInst(m, q, `${genYear}-Q${q}`)
        }
      } else if (freq === 'halbjaehrlich') {
        pushInst(6,  2, `${genYear}-H1`)
        pushInst(12, 4, `${genYear}-H2`)
      } else if (freq === 'jaehrlich') {
        const startMonat = startD.getMonth() + 1
        pushInst(startMonat, Math.ceil(startMonat / 3), `${genYear}`)

      } else if (freq === 'individuell') {
        // Freies Intervall: alle N Tage / Wochen / Monate ab startDatum
        const iTyp  = aufgabe.intervallTyp  ?? 'monate'
        const iWert = Math.max(1, parseInt(aufgabe.intervallWert ?? 1, 10))

        // Approx. ms pro Schritt (für schnelles Vorspulen bei weit zurück liegendem Startdatum)
        const approxMs = iTyp === 'tage'   ? iWert * 86400000
                       : iTyp === 'wochen' ? iWert * 7 * 86400000
                       :                     iWert * 30 * 86400000  // monate

        let cur = new Date(startD)

        // Vorspulen: grob bis kurz vor Jahresbeginn, dann exakt
        const minDate = new Date(genYear, 0, 1)
        if (cur < minDate && approxMs > 0) {
          const stepsRough = Math.max(0, Math.floor((minDate.getTime() - cur.getTime()) / approxMs) - 2)
          for (let i = 0; i < stepsRough; i++) cur = addIntervalDate(cur, iTyp, iWert)
          while (cur < minDate) cur = addIntervalDate(cur, iTyp, iWert)
        }

        const maxDate = new Date(genYear, 11, 31, 23, 59, 59)
        let safety = 0
        while (cur <= maxDate && safety++ < 400) {
          if (!endD || cur <= endD) {
            const ymd   = cur.toISOString().slice(0, 10)
            const monat = cur.getMonth() + 1
            const info  = erlInst[ymd] ?? {}
            tasks.push({
              key:          `${aufgabe.id}::${ymd}`,
              type:         'Manuell',
              label:        aufgabe.titel ?? '(Aufgabe)',
              beschreibung: aufgabe.beschreibung ?? '',
              mandantId:    aufgabe.mandantId ?? null,
              monat,
              quartal:      Math.ceil(monat / 3),
              jahr:         genYear,
              faellig:      cur.toISOString(),
              erledigt:     info.erledigt ?? false,
              erledigtAm:   info.erledigtAm ?? null,
              istManuell:   true,
              istSerie:     true,
              aufgabeId:    aufgabe.id,
              serieInstanz: ymd,
            })
          }
          cur = addIntervalDate(cur, iTyp, iWert)
        }
      }
    }
  }
  return tasks
}
