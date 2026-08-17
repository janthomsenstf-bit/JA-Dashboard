// ─── Gemeinsame Fristen-Quelle ────────────────────────────────────────────────
// EINE Funktion, die alles zusammenführt, was ein Datum hat und Arbeit bedeutet.
// Damit zeigen Startseite und Aufgaben-Cockpit dieselbe Wahrheit an, statt
// jeweils eine eigene (unvollständige) Auswahl zu treffen.
//
// Quellen:
//   1. auftrag    – client.auftraege[] mit Frist bzw. Eilig-Datum (ohne Serien)
//   2. frist       – automatisch erzeugte Fristen (USt/Lohn/SV/FIBU/Zusatz)
//   3. aufgabe     – globale manuelle Aufgaben (einmalig + Serien)
//   4. termin      – Kalendereinträge
//   5. erinnerung  – client.erinnerungen[] (aus Kommunikation/BotInbox)
//
// Bewusst NICHT enthalten: automatisch erzeugte Jahresabschluss-Fristen. Der JA
// hängt bereits als echter Auftrag am Mandanten – sonst stünde er doppelt da.
// (Gleiche Entscheidung wie in GlobalTodoView.)

import { generateAufgaben, generateManuelleAufgaben, getStatus } from './aufgaben.js'

export const QUELLE_CFG = {
  auftrag:    { label: 'Auftrag',    icon: '📋', farbe: '#2563eb' },
  frist:      { label: 'Frist',      icon: '⏰', farbe: '#0891b2' },
  aufgabe:    { label: 'Aufgabe',    icon: '📌', farbe: '#0e7490' },
  termin:     { label: 'Termin',     icon: '📅', farbe: '#16a34a' },
  erinnerung: { label: 'Erinnerung', icon: '🔔', farbe: '#f97316' },
  eilig:      { label: 'Eilig',      icon: '🔥', farbe: '#ef4444' },
}

/** Normalisiert alles auf 'YYYY-MM-DD' (lokale Zeit, kein UTC-Versatz). */
export function ymd(wert) {
  if (!wert) return null
  if (typeof wert === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(wert.slice(0, 10)) && wert.length <= 10) {
    return wert.slice(0, 10)
  }
  const d = wert instanceof Date ? wert : new Date(wert)
  if (isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Heutiges Datum als 'YYYY-MM-DD'. */
export function heuteYMD() {
  return ymd(new Date())
}

/** Tage bis zum Datum (negativ = überfällig, 0 = heute). */
export function tageBis(datum) {
  const d = datum ? new Date(String(datum).slice(0, 10) + 'T12:00:00') : null
  if (!d || isNaN(d.getTime())) return null
  const heute = new Date(); heute.setHours(12, 0, 0, 0)
  return Math.round((d - heute) / 86400000)
}

function verschiebe(datum, tage) {
  const d = new Date(String(datum).slice(0, 10) + 'T12:00:00')
  d.setDate(d.getDate() + tage)
  return ymd(d)
}

/**
 * Führt alle Fristen-/Aufgaben-Quellen zu EINER chronologischen Liste zusammen.
 *
 * @param {Object}  o
 * @param {Array}   o.clients        Mandanten (archivierte werden übersprungen)
 * @param {Array}   o.aufgabenListe  globale manuelle Aufgaben
 * @param {Array}   o.termine        Kalendereinträge
 * @param {number}  o.tageVor        wie weit zurück (Standard 60)
 * @param {number}  o.tageNach       wie weit voraus (Standard 90)
 * @param {boolean} o.nurOffen       erledigte Einträge weglassen (Standard true)
 * @returns {Array} Einträge { id, quelle, titel, mandantId, mandantName, datum,
 *                             erledigt, eilig, auftragId, diff }
 */
export function alleFristen({
  clients = [],
  aufgabenListe = [],
  termine = [],
  tageVor = 60,
  tageNach = 90,
  nurOffen = true,
} = {}) {
  const heute = heuteYMD()
  const von   = verschiebe(heute, -Math.abs(tageVor))
  const bis   = verschiebe(heute,  Math.abs(tageNach))
  const aktiv = clients.filter(c => !c.archiviert)
  const nameVon = id => aktiv.find(c => c.id === id)?.name ?? ''

  const raus = []
  const nimm = (e) => {
    if (!e.datum) return
    if (e.datum < von || e.datum > bis) return
    if (nurOffen && e.erledigt) return
    raus.push(e)
  }

  for (const c of aktiv) {
    // ── 1) Aufträge mit Frist ────────────────────────────────────────────────
    for (const au of (c.auftraege ?? [])) {
      if (au.istSerie) continue                    // Serien liefert die Auftrags-Übersicht
      const datum = ymd(au.eiligBis || au.frist)
      if (!datum) continue
      nimm({
        id:         `au_${c.id}_${au.id}`,
        quelle:     'auftrag',
        titel:      au.bezeichnung || au.typ || 'Auftrag',
        mandantId:  c.id,
        mandantName: c.name,
        datum,
        erledigt:   au.status === 'erledigt',
        eilig:      !!au.eilig,
        auftragId:  au.id,
      })
    }

    // ── 2) Automatisch erzeugte Fristen ──────────────────────────────────────
    for (const t of generateAufgaben(c)) {
      if (t.type === 'JA') continue                // hängt schon als Auftrag dran
      const datum = ymd(t.faellig) ?? (t.monat ? ymd(new Date(t.jahr, t.monat - 1, 15)) : null)
      if (!datum) continue
      nimm({
        id:          `gen_${c.id}_${t.key}`,
        quelle:      'frist',
        titel:       t.label,
        mandantId:   c.id,
        mandantName: c.name,
        datum,
        erledigt:    getStatus(c, t.key).erledigt,
        eilig:       false,
        aufgabenKey: t.key,
      })
    }

    // ── 5) Erinnerungen (Kommunikation / BotInbox) ───────────────────────────
    for (const er of (c.erinnerungen ?? [])) {
      const datum = ymd(er.datum)
      if (!datum) continue
      nimm({
        id:          `er_${c.id}_${er.id}`,
        quelle:      'erinnerung',
        titel:       er.text || 'Erinnerung',
        mandantId:   c.id,
        mandantName: c.name,
        datum,
        erledigt:    !!er.erledigt,
        eilig:       false,
      })
    }
  }

  // ── 3) Globale manuelle Aufgaben (Serien brauchen ein Jahr) ────────────────
  const jahre = [...new Set([von.slice(0, 4), heute.slice(0, 4), bis.slice(0, 4)].map(Number))]
  const gesehen = new Set()
  for (const jahr of jahre) {
    for (const t of generateManuelleAufgaben(aufgabenListe, jahr)) {
      if (gesehen.has(t.key)) continue
      gesehen.add(t.key)
      const datum = ymd(t.faellig)
      if (!datum) continue
      nimm({
        id:          `man_${t.key}`,
        quelle:      'aufgabe',
        titel:       t.label,
        mandantId:   t.mandantId ?? null,
        mandantName: t.mandantId ? nameVon(t.mandantId) : '',
        datum,
        erledigt:    !!t.erledigt,
        eilig:       false,
        aufgabeId:   t.aufgabeId,
      })
    }
  }

  // ── 4) Termine ─────────────────────────────────────────────────────────────
  for (const t of (termine ?? [])) {
    const datum = ymd(t.datum)
    if (!datum) continue
    nimm({
      id:          `trm_${t.id}`,
      quelle:      'termin',
      titel:       t.titel || t.beschreibung || 'Termin',
      mandantId:   t.mandantId ?? null,
      mandantName: t.mandantId ? nameVon(t.mandantId) : '',
      datum,
      uhrzeit:     t.uhrzeit ?? '',
      erledigt:    !!t.erledigt,
      eilig:       t.art === 'frist',
    })
  }

  return raus
    .map(e => ({ ...e, diff: tageBis(e.datum) }))
    .sort((a, b) => a.datum.localeCompare(b.datum) || (a.uhrzeit || '').localeCompare(b.uhrzeit || ''))
}

/** Teilt eine Fristen-Liste in die üblichen Zeitfenster auf. */
export function fristenGruppen(liste = []) {
  const offen = liste.filter(e => !e.erledigt && e.diff !== null)
  return {
    ueberfaellig: offen.filter(e => e.diff < 0),
    heute:        offen.filter(e => e.diff === 0),
    woche:        offen.filter(e => e.diff > 0 && e.diff <= 7),
    demnaechst:   offen.filter(e => e.diff > 7 && e.diff <= 30),
  }
}
