// ── Such- und Daten-Helfer ────────────────────────────────────────────────────
// Wird von GlobalSearch, SearchResultCard, UebersichtTab und DashboardHome genutzt

const FIELD_LABELS = {
  name:           'Name',
  mandantennummer:'Mandanten-Nr.',
  notizen:        'Notiz',
  kontaktEmail:   'E-Mail Kontakt',
  eventBetreff:   'E-Mail Betreff',
  eventText:      'E-Mail Text',
  rueckfrage:     'Rückfrage',
}

function includes(haystack, needle) {
  return String(haystack ?? '').toLowerCase().includes(needle.toLowerCase())
}

function truncate(str, max = 80) {
  const s = String(str ?? '')
  return s.length > max ? s.slice(0, max) + '…' : s
}

// ── Volltext-Suche über alle Mandanten ───────────────────────────────────────
export function searchClients(clients, query) {
  if (!query || query.trim().length < 2) return []
  const q = query.trim()
  const results = []

  for (const client of clients) {
    if (client.archiviert) continue
    const matches = []

    // Name + Mandantennummer
    if (includes(client.name, q))
      matches.push({ field: 'name', label: FIELD_LABELS.name, value: client.name })
    if (includes(client.mandantennummer, q))
      matches.push({ field: 'mandantennummer', label: FIELD_LABELS.mandantennummer, value: client.mandantennummer })

    // Notizen
    if (client.notizen && includes(client.notizen, q))
      matches.push({ field: 'notizen', label: FIELD_LABELS.notizen, value: truncate(client.notizen, 60) })

    // Kontakte (E-Mail)
    for (const k of (client.kontakte ?? [])) {
      if (k.email && includes(k.email, q)) {
        matches.push({ field: 'kontaktEmail', label: FIELD_LABELS.kontaktEmail, value: k.email })
        break
      }
    }

    // Kommunikations-Events (Betreff + Text)
    let eventBetreffFound = false
    let eventTextFound = false
    for (const ev of (client.kommunikation?.events ?? [])) {
      if (!eventBetreffFound && ev.betreff && includes(ev.betreff, q)) {
        matches.push({ field: 'eventBetreff', label: FIELD_LABELS.eventBetreff, value: truncate(ev.betreff, 60) })
        eventBetreffFound = true
      }
      if (!eventTextFound && ev.text && includes(ev.text, q)) {
        matches.push({ field: 'eventText', label: FIELD_LABELS.eventText, value: truncate(ev.text, 60) })
        eventTextFound = true
      }
      if (eventBetreffFound && eventTextFound) break
    }

    // Rückfragen
    for (const rq of (client.rueckfragen ?? [])) {
      if (rq.text && includes(rq.text, q)) {
        matches.push({ field: 'rueckfrage', label: FIELD_LABELS.rueckfrage, value: truncate(rq.text, 60) })
        break
      }
    }

    if (matches.length > 0) {
      results.push({ client, matches })
    }
  }

  // Name-Treffer zuerst, dann max 8
  results.sort((a, b) => {
    const aName = a.matches.some(m => m.field === 'name') ? 0 : 1
    const bName = b.matches.some(m => m.field === 'name') ? 0 : 1
    return aName - bName
  })

  return results.slice(0, 8)
}

// ── Letztes Kommunikationsereignis ───────────────────────────────────────────
export function getLastEmail(client) {
  const events = client.kommunikation?.events ?? []
  if (!events.length) return null
  return [...events].sort((a, b) => new Date(b.erstelltAm) - new Date(a.erstelltAm))[0]
}

// ── Letzte eingehende E-Mail ─────────────────────────────────────────────────
export function getLastIncomingEmail(client) {
  const events = (client.kommunikation?.events ?? []).filter(e => e.typ === 'eingehend')
  if (!events.length) return null
  return [...events].sort((a, b) => new Date(b.erstelltAm) - new Date(a.erstelltAm))[0]
}

// ── Offene Rückfragen ────────────────────────────────────────────────────────
export function getOpenRueckfragen(client) {
  return (client.rueckfragen ?? []).filter(r => !r.beantwortet)
}

// ── Letzte Anhänge aus allen Events ─────────────────────────────────────────
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

// ── Anstehende Fristen ───────────────────────────────────────────────────────
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

// ── Datum formatieren (kurz) ─────────────────────────────────────────────────
export function fmtDate(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  if (isNaN(d)) return '–'
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
