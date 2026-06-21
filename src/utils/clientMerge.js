/**
 * clientMerge.js
 * Vereint zwei Mandanten-Stände, OHNE jemals etwas zu löschen.
 * - Skalare Felder: der aktuelle Stand (base) gewinnt.
 * - Listen mit id (Aufträge, Zeiteinträge, Kontakte …): werden per id vereinigt.
 * - Mandanten/Einträge, die nur im Backup existieren, werden ergänzt.
 * Damit kann eine Wiederherstellung nur Fehlendes hinzufügen, nie etwas entfernen.
 */

const LIST_FIELDS_BY_ID = [
  'auftraege', 'jaAuftraege', 'zeiteintraege', 'honorare', 'rueckfragen',
  'erinnerungen', 'kontakte', 'aufgaben', 'zusatzaufgaben', 'rechner',
  'gesellschafter', 'geschaeftsfuehrer', 'fibuNotizen',
]

function unionById(base, inc) {
  const b = Array.isArray(base) ? base : []
  const i = Array.isArray(inc) ? inc : []
  if (!i.length) return b
  if (!b.length) return i
  const hasIds = b.every(x => x && x.id != null) && i.every(x => x && x.id != null)
  if (!hasIds) return b.length >= i.length ? b : i  // ohne ids: den volleren Stand behalten
  const seen = new Set(b.map(x => x.id))
  const add = i.filter(x => !seen.has(x.id))
  return add.length ? [...b, ...add] : b
}

function mergeClient(base, inc) {
  if (!base) return inc
  if (!inc) return base
  const out = { ...inc, ...base }   // aktuelle Skalare gewinnen, im Backup vorhandene fehlende Felder ergänzen
  for (const f of LIST_FIELDS_BY_ID) {
    if (Array.isArray(base?.[f]) || Array.isArray(inc?.[f])) out[f] = unionById(base?.[f], inc?.[f])
  }
  const be = base?.kommunikation?.events, ie = inc?.kommunikation?.events
  if (Array.isArray(be) || Array.isArray(ie)) {
    out.kommunikation = { ...(inc.kommunikation || {}), ...(base.kommunikation || {}), events: unionById(be, ie) }
  }
  return out
}

/** Vereint einen Backup-Stand (incClients) in den aktuellen Stand (baseClients). */
export function mergeClientsInto(baseClients, incClients) {
  const base = Array.isArray(baseClients) ? baseClients : []
  const inc  = Array.isArray(incClients)  ? incClients  : []
  const baseIds = new Set(base.map(c => c?.id))
  const result = base.map(c => {
    const match = inc.find(x => x && x.id === c?.id)
    return match ? mergeClient(c, match) : c
  })
  for (const c of inc) {
    if (c && !baseIds.has(c.id)) result.push(c)
  }
  return result
}
