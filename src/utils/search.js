// ── Intelligente globale Suche ────────────────────────────────────────────────
// Durchsucht alle Datenbereiche: Mandanten, Personen, Kontakte, E-Mails,
// Aufträge, Aufgaben, Notizen, Anhänge, Rückfragen, Geschäftsführer, Gesellschafter

// ── Kategorien ───────────────────────────────────────────────────────────────
export const SEARCH_CATEGORIES = {
  personen:   { label: 'Personen',          icon: '👤', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
  mandanten:  { label: 'Mandanten',         icon: '🏢', color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
  nachrichten:{ label: 'Nachrichten',       icon: '✉️', color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
  dokumente:  { label: 'Dokumente/Anhänge', icon: '📎', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  auftraege:  { label: 'Aufträge',          icon: '📋', color: '#0891b2', bg: 'rgba(8,145,178,0.08)' },
  aufgaben:   { label: 'Aufgaben',          icon: '📌', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  notizen:    { label: 'Notizen/Historie',  icon: '📝', color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
}

function includes(haystack, needle) {
  return String(haystack ?? '').toLowerCase().includes(needle)
}

function truncate(str, max = 80) {
  const s = String(str ?? '')
  return s.length > max ? s.slice(0, max) + '...' : s
}

// ── Gewichtung: höher = wichtiger ────────────────────────────────────────────
const WEIGHT = {
  name: 100,
  mandantennummer: 90,
  kontaktName: 85,
  kontaktEmail: 80,
  kontaktTelefon: 75,
  geschaeftsfuehrer: 82,
  gesellschafter: 78,
  steuernummer: 70,
  auftragBezeichnung: 60,
  aufgabeTitel: 58,
  emailBetreff: 50,
  emailAbsender: 48,
  anhangName: 45,
  notiz: 30,
  emailText: 20,
  rueckfrage: 35,
  hinweis: 32,
}

// ── Haupt-Suchfunktion ──────────────────────────────────────────────────────
export function searchAll(clients, query) {
  if (!query || query.trim().length < 2) return { results: [], categories: {} }
  const q = query.trim().toLowerCase()
  const results = []

  for (const client of clients) {
    // Auch archivierte durchsuchen (mit Markierung)

    // ── 1. Mandant (Name, Nummern, Steuernummer) ─────────────────
    const mandantMatches = []
    if (includes(client.name, q))
      mandantMatches.push({ field: 'name', label: 'Name', value: client.name, weight: WEIGHT.name })
    for (const nr of [client.mandantennummer, client.mandantennummer2, client.mandantennummer3]) {
      if (nr && includes(nr, q))
        mandantMatches.push({ field: 'mandantennummer', label: 'Mandanten-Nr.', value: nr, weight: WEIGHT.mandantennummer })
    }
    if (client.steuernummer && includes(client.steuernummer, q))
      mandantMatches.push({ field: 'steuernummer', label: 'Steuernummer', value: client.steuernummer, weight: WEIGHT.steuernummer })

    if (mandantMatches.length > 0) {
      results.push({
        category: 'mandanten',
        client,
        matches: mandantMatches,
        weight: Math.max(...mandantMatches.map(m => m.weight)),
        action: { type: 'openClient', clientId: client.id },
      })
    }

    // ── 2. Kontaktpersonen (Name, E-Mail, Telefon) ───────────────
    for (const k of (client.kontakte ?? [])) {
      const personMatches = []
      if (k.name && includes(k.name, q))
        personMatches.push({ field: 'kontaktName', label: 'Kontaktperson', value: k.name, weight: WEIGHT.kontaktName })
      if (k.email && includes(k.email, q))
        personMatches.push({ field: 'kontaktEmail', label: 'E-Mail', value: k.email, weight: WEIGHT.kontaktEmail })
      if (k.telefon && includes(k.telefon, q))
        personMatches.push({ field: 'kontaktTelefon', label: 'Telefon', value: k.telefon, weight: WEIGHT.kontaktTelefon })

      if (personMatches.length > 0) {
        results.push({
          category: 'personen',
          client,
          person: { name: k.name, rolle: k.rolle, email: k.email, telefon: k.telefon },
          matches: personMatches,
          weight: Math.max(...personMatches.map(m => m.weight)),
          action: { type: 'openClient', clientId: client.id, tab: 0 },  // TAB.mandant
        })
      }
    }

    // ── 3. Geschäftsführer ────────────────────────────────────────
    for (const gf of (client.geschaeftsfuehrer ?? [])) {
      if (gf.name && includes(gf.name, q)) {
        results.push({
          category: 'personen',
          client,
          person: { name: gf.name, rolle: 'Geschäftsführer' },
          matches: [{ field: 'geschaeftsfuehrer', label: 'Geschäftsführer', value: gf.name, weight: WEIGHT.geschaeftsfuehrer }],
          weight: WEIGHT.geschaeftsfuehrer,
          action: { type: 'openClient', clientId: client.id, tab: 0 },  // TAB.mandant
        })
      }
    }

    // ── 4. Gesellschafter ────────────────────────────────────────
    for (const gs of (client.gesellschafter ?? [])) {
      if (gs.name && includes(gs.name, q)) {
        results.push({
          category: 'personen',
          client,
          person: { name: gs.name, rolle: `Gesellschafter${gs.anteil ? ' (' + gs.anteil + ' %)' : ''}` },
          matches: [{ field: 'gesellschafter', label: 'Gesellschafter', value: gs.name, weight: WEIGHT.gesellschafter }],
          weight: WEIGHT.gesellschafter,
          action: { type: 'openClient', clientId: client.id, tab: 0 },  // TAB.mandant
        })
      }
    }

    // ── 5. E-Mails (Betreff, Absender, Text) ─────────────────────
    const events = client.kommunikation?.events ?? []
    let emailCount = 0
    for (const ev of events) {
      if (emailCount >= 3) break // max 3 E-Mails pro Mandant
      const emailMatches = []
      if (ev.betreff && includes(ev.betreff, q))
        emailMatches.push({ field: 'emailBetreff', label: 'Betreff', value: truncate(ev.betreff, 60), weight: WEIGHT.emailBetreff })
      if (ev.absender && includes(ev.absender, q))
        emailMatches.push({ field: 'emailAbsender', label: 'Absender', value: ev.absender, weight: WEIGHT.emailAbsender })
      if (ev.text && includes(ev.text, q))
        emailMatches.push({ field: 'emailText', label: 'E-Mail-Text', value: truncate(ev.text, 80), weight: WEIGHT.emailText })

      if (emailMatches.length > 0) {
        results.push({
          category: 'nachrichten',
          client,
          email: { id: ev.id, betreff: ev.betreff, absender: ev.absender, datum: ev.erstelltAm ?? ev.gesendetAm, typ: ev.typ },
          matches: emailMatches,
          weight: Math.max(...emailMatches.map(m => m.weight)),
          action: { type: 'openEmail', clientId: client.id, emailId: ev.id },
        })
        emailCount++
      }

      // ── 6. Anhänge aus E-Mails ──────────────────────────────────
      for (const a of (ev.anlagen ?? [])) {
        if (a.name && includes(a.name, q)) {
          results.push({
            category: 'dokumente',
            client,
            dokument: { name: a.name, size: a.size, datum: ev.erstelltAm, quelle: ev.typ === 'eingehend' ? 'Empfangen' : 'Gesendet' },
            matches: [{ field: 'anhangName', label: 'Anhang', value: a.name, weight: WEIGHT.anhangName }],
            weight: WEIGHT.anhangName,
            action: { type: 'openEmail', clientId: client.id, emailId: ev.id },
          })
        }
      }
    }

    // ── 7. Aufträge ──────────────────────────────────────────────
    for (const au of (client.auftraege ?? [])) {
      const auMatches = []
      if (au.bezeichnung && includes(au.bezeichnung, q))
        auMatches.push({ field: 'auftragBezeichnung', label: 'Auftrag', value: au.bezeichnung, weight: WEIGHT.auftragBezeichnung })
      if (au.notiz && includes(au.notiz, q))
        auMatches.push({ field: 'notiz', label: 'Auftrag-Notiz', value: truncate(au.notiz, 60), weight: WEIGHT.notiz })
      // Hinweise durchsuchen
      for (const h of (au.hinweise ?? [])) {
        if (h.text && includes(h.text, q)) {
          auMatches.push({ field: 'hinweis', label: 'Hinweis', value: truncate(h.text, 60), weight: WEIGHT.hinweis })
          break
        }
      }
      if (auMatches.length > 0) {
        results.push({
          category: 'auftraege',
          client,
          auftrag: { id: au.id, typ: au.typ, bezeichnung: au.bezeichnung, jahr: au.jahr, status: au.status },
          matches: auMatches,
          weight: Math.max(...auMatches.map(m => m.weight)),
          action: { type: 'openClient', clientId: client.id, tab: 1 },  // TAB.auftraege
        })
      }
    }

    // ── 8. Aufgaben ──────────────────────────────────────────────
    for (const a of (client.aufgaben ?? [])) {
      const aMatches = []
      if (a.titel && includes(a.titel, q))
        aMatches.push({ field: 'aufgabeTitel', label: 'Aufgabe', value: a.titel, weight: WEIGHT.aufgabeTitel })
      if (a.inhalt && includes(a.inhalt, q))
        aMatches.push({ field: 'notiz', label: 'Aufgabe-Detail', value: truncate(a.inhalt, 60), weight: WEIGHT.notiz })
      if (aMatches.length > 0) {
        results.push({
          category: 'aufgaben',
          client,
          aufgabe: { id: a.id, titel: a.titel, prioritaet: a.prioritaet, erledigt: a.erledigt, faelligAm: a.faelligAm },
          matches: aMatches,
          weight: Math.max(...aMatches.map(m => m.weight)),
          action: { type: 'openClient', clientId: client.id },
        })
      }
    }

    // ── 9. Notizen / Rückfragen ───────────────────────────────────
    if (client.notizen && includes(client.notizen, q)) {
      results.push({
        category: 'notizen',
        client,
        matches: [{ field: 'notiz', label: 'Notiz', value: truncate(client.notizen, 80), weight: WEIGHT.notiz }],
        weight: WEIGHT.notiz,
        action: { type: 'openClient', clientId: client.id },
      })
    }
    for (const rq of (client.rueckfragen ?? [])) {
      if (rq.text && includes(rq.text, q)) {
        results.push({
          category: 'notizen',
          client,
          matches: [{ field: 'rueckfrage', label: 'Rückfrage', value: truncate(rq.text, 60), weight: WEIGHT.rueckfrage }],
          weight: WEIGHT.rueckfrage,
          action: { type: 'openClient', clientId: client.id, tab: 6 },  // TAB.historie
        })
        break
      }
    }

    // ── 10. Stand-der-Arbeit Hinweise ─────────────────────────────
    const sda = client.standDerArbeit ?? {}
    for (const arr of [sda.hinweise ?? [], sda.offenePunkte ?? []]) {
      for (const item of arr) {
        const text = typeof item === 'string' ? item : item?.text
        if (text && includes(text, q)) {
          results.push({
            category: 'notizen',
            client,
            matches: [{ field: 'hinweis', label: 'Hinweis', value: truncate(text, 60), weight: WEIGHT.hinweis }],
            weight: WEIGHT.hinweis,
            action: { type: 'openClient', clientId: client.id, tab: 6 },  // TAB.historie
          })
          break
        }
      }
    }
  }

  // ── Sortierung: Gewicht absteigend, dann Name alphabetisch ─────
  results.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight
    return (a.client.name ?? '').localeCompare(b.client.name ?? '', 'de')
  })

  // ── Kategorien zählen ──────────────────────────────────────────
  const categories = {}
  for (const r of results) {
    categories[r.category] = (categories[r.category] ?? 0) + 1
  }

  return { results: results.slice(0, 30), categories, total: results.length }
}

// ── Ergebnisse nach Kategorie filtern ────────────────────────────────────────
export function filterByCategory(results, category) {
  if (!category || category === 'alle') return results
  return results.filter(r => r.category === category)
}

// ── Hilfsfunktionen (Legacy-kompatibel) ──────────────────────────────────────
export function searchClients(clients, query) {
  const { results } = searchAll(clients, query)
  // Legacy-Format zurückgeben
  const seen = new Set()
  const legacy = []
  for (const r of results) {
    if (r.category === 'mandanten' && !seen.has(r.client.id)) {
      seen.add(r.client.id)
      legacy.push({ client: r.client, matches: r.matches })
    }
  }
  return legacy.slice(0, 8)
}

export function getLastEmail(client) {
  const events = client.kommunikation?.events ?? []
  if (!events.length) return null
  return [...events].sort((a, b) => new Date(b.erstelltAm) - new Date(a.erstelltAm))[0]
}

export function getLastIncomingEmail(client) {
  const events = (client.kommunikation?.events ?? []).filter(e => e.typ === 'eingehend')
  if (!events.length) return null
  return [...events].sort((a, b) => new Date(b.erstelltAm) - new Date(a.erstelltAm))[0]
}

export function getOpenRueckfragen(client) {
  return (client.rueckfragen ?? []).filter(r => !r.beantwortet)
}

export function getLastAnlagen(client, max = 3) {
  const result = []
  const events = [...(client.kommunikation?.events ?? [])]
    .sort((a, b) => new Date(b.erstelltAm) - new Date(a.erstelltAm))

  for (const ev of events) {
    for (const anlage of (ev.anlagen ?? [])) {
      result.push({
        name:      anlage.name ?? '(Datei)',
        size:      anlage.size ?? 0,
        datum:     ev.erstelltAm,
        richtung:  ev.typ === 'eingehend' ? 'eingehend' : 'gesendet',
      })
      if (result.length >= max) return result
    }
  }
  return result
}

export function getUpcomingDeadlines(client, days = 30) {
  const result = []
  const now    = new Date()
  const cutoff = new Date(now.getTime() + days * 86400000)

  function check(label, dateStr) {
    if (!dateStr) return
    const d = new Date(dateStr)
    if (!isNaN(d) && d >= now && d <= cutoff) {
      result.push({ label, date: dateStr })
    }
  }

  check('FA geplant',         client.faGeplantDatum)
  check('STE gesendet bis',   client.steGesendetDatum)
  check('Unterschrift fällig', client.unterschriftDatum)
  check('Abschluss fertig',   client.abschlussFertigDatum)

  return result.sort((a, b) => new Date(a.date) - new Date(b.date))
}

export function fmtDate(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  if (isNaN(d)) return '–'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
