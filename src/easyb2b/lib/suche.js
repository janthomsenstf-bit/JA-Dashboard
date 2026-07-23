/**
 * Easy-B2B – Datenquelle für die globale Suche des Spielbuchs.
 *
 * Die Easy-B2B-Daten liegen sonst nur im Store, der ausschließlich im
 * (lazy geladenen) Easy-B2B-Bereich gemountet ist. Damit die zentrale Suche
 * sie trotzdem findet, lädt dieses Modul die durchsuchbaren Bestände einmalig
 * und filtert danach lokal – anders als bei OneDrive ist kein Server-Roundtrip
 * pro Tastendruck nötig, weil der ganze Datensatz hier vorliegt.
 *
 * Anfragen und Interessenten kommen aus der Neon-Datenbank; fehlt die
 * Verbindung (z. B. DATABASE_URL nicht gesetzt), wird auf die mitgelieferten
 * Beispieldaten zurückgefallen. Unternehmen, Netzwerk- und Geschäftskontakte
 * stammen aus den statischen Beispieldaten.
 *
 * Rein lesend – es wird nichts geschrieben oder verändert.
 */

// Einmal geladen, dann für die restliche Sitzung wiederverwendet.
let cache = null

async function holeJSON(pfad, ruecksfall) {
  try {
    const r = await fetch(pfad)
    if (!r.ok) return ruecksfall
    const d = await r.json()
    return Array.isArray(d) && d.length ? d : ruecksfall
  } catch {
    return ruecksfall
  }
}

/**
 * Lädt die durchsuchbaren Easy-B2B-Bestände (einmalig, gecacht) und bringt sie
 * in eine einheitliche, flache Form: { typ, id, titel, bereich, felder }.
 * `bereich` verweist auf den Easy-B2B-Unterbereich für die Navigation.
 */
export function ladeEasyB2BSuchdaten() {
  if (cache) return cache

  // Beispieldaten erst hier dynamisch laden – so bleiben sie im Easy-B2B-Chunk
  // und belasten nicht das Haupt-Bundle, das die Suche mitbringt.
  cache = import('./mockdata.ts').then(m => Promise.all([
    holeJSON('/api/easyb2b-anfragen', m.MOCK_ANFRAGEN),
    holeJSON('/api/easyb2b-interessenten', m.MOCK_INTERESSENTEN),
  ]).then(([anfragen, interessenten]) => {
    const { MOCK_UNTERNEHMEN, MOCK_NETZWERKKONTAKTE, MOCK_KONTAKTE } = m
    const eintraege = []

    for (const a of anfragen ?? []) {
      eintraege.push({
        typ: 'Anfrage', id: `anf-${a.id}`, bereich: 'anfragen',
        titel: a.firmenname || a.anzeigenId || 'Anfrage',
        felder: [
          ['Anzeige', a.anzeigenId], ['Ansprechpartner', a.ansprechpartner],
          ['Branche', a.branche], ['Standort', a.standort],
          ['Ziel', a.ziel], ['Beschreibung', a.beschreibung],
        ],
      })
    }
    for (const i of interessenten ?? []) {
      eintraege.push({
        typ: 'Interessent', id: `int-${i.id}`, bereich: 'interessenten',
        titel: i.firmenname || i.ansprechpartner || 'Interessent',
        felder: [
          ['Ansprechpartner', i.ansprechpartner], ['E-Mail', i.email],
          ['zu Anfrage', i.anfrageFirma], ['Notiz', i.notiz],
        ],
      })
    }
    for (const u of MOCK_UNTERNEHMEN ?? []) {
      eintraege.push({
        typ: 'Unternehmen', id: `unt-${u.id}`, bereich: 'unternehmen',
        titel: u.firmenname || 'Unternehmen',
        felder: [
          ['Ansprechpartner', u.ansprechpartner], ['E-Mail', u.email],
          ['Branche', u.branche], ['Standort', u.standort],
        ],
      })
    }
    for (const k of MOCK_NETZWERKKONTAKTE ?? []) {
      eintraege.push({
        typ: 'Netzwerk', id: `netz-${k.id}`, bereich: 'netzwerk',
        titel: k.name || 'Kontakt',
        felder: [['Position', k.position], ['Branche', k.branche], ['E-Mail', k.email]],
      })
    }
    for (const k of MOCK_KONTAKTE ?? []) {
      eintraege.push({
        typ: 'Kontakt', id: `kon-${k.id}`, bereich: 'kontakte',
        titel: k.firmenname || k.ansprechpartner || 'Kontakt',
        felder: [
          ['Ansprechpartner', k.ansprechpartner], ['E-Mail', k.email], ['Branche', k.branche],
        ],
      })
    }

    return eintraege
  }))

  return cache
}

/**
 * Filtert die geladenen Einträge nach dem Suchbegriff. Reine String-Suche über
 * Titel und Felder; Treffer im Titel wiegen schwerer. Liefert Ergebnisse in der
 * Form, die GlobalSearch erwartet.
 */
export function durchsucheEasyB2B(eintraege, query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (q.length < 2 || !eintraege?.length) return []

  const treffer = []
  for (const e of eintraege) {
    const felder = e.felder.filter(([, v]) => v != null && String(v).trim() !== '')
    let gewicht = 0
    let trefferFeld = null

    if (String(e.titel).toLowerCase().includes(q)) gewicht = 100

    for (const [label, value] of felder) {
      if (String(value).toLowerCase().includes(q)) {
        gewicht = Math.max(gewicht, 70)
        if (!trefferFeld) trefferFeld = { label, value: String(value) }
      }
    }

    if (gewicht > 0) {
      treffer.push({
        category: 'easyb2b',
        client: null,
        eb: {
          typ: e.typ,
          titel: e.titel,
          treffer: trefferFeld, // Feld, in dem der Begriff gefunden wurde (kann null sein)
        },
        matches: [{ field: 'easyb2b', label: e.typ, value: e.titel, weight: gewicht }],
        weight: gewicht,
        action: { type: 'openEasyB2B', bereich: e.bereich },
      })
    }
  }
  return treffer
}
