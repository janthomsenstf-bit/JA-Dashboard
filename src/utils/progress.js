/**
 * Statuslogik – unterstützt sowohl das neue Array rueckfragenSendungen
 * als auch das alte Einzelfeld rueckfragenGesendetDatum (Rückwärtskompatibilität).
 */

// Liefert true, wenn mindestens eine Rückfragen-Sendung eingetragen ist
function hasSendung(client) {
  if (Array.isArray(client.rueckfragenSendungen)) {
    return client.rueckfragenSendungen.some(Boolean)
  }
  return !!client.rueckfragenGesendetDatum
}

// Liefert das letzte ausgefüllte Sendedatum (für Statusanzeige)
function getLastSendung(client) {
  if (Array.isArray(client.rueckfragenSendungen)) {
    const filled = client.rueckfragenSendungen.filter(Boolean)
    return filled.length > 0 ? filled[filled.length - 1] : null
  }
  return client.rueckfragenGesendetDatum ?? null
}

/**
 * 5-Punkte-Fortschritt:
 * 1. inBearbeitung
 * 2. Rückfragen abgeschlossen (gesendet ODER keine offen)
 * 3. abschlussFertig
 * 4. steGesendetDatum
 * 5. faUebermittelt
 */
export function calculateProgress(client) {
  let score = 0

  if (client.inBearbeitung) score++

  if (
    hasSendung(client) ||
    client.rueckfragen.length === 0 ||
    client.rueckfragen.every(r => r.beantwortet)
  ) score++

  if (client.abschlussFertig) score++
  if (client.steGesendetDatum) score++
  if (client.faUebermittelt) score++

  return Math.round((score / 5) * 100)
}

export function progressColor(pct) {
  if (pct >= 100) return 'var(--green)'
  if (pct >= 60)  return 'var(--yellow)'
  if (pct >= 30)  return 'var(--orange)'
  return 'var(--red)'
}

export function getWorkflowStatus(client) {
  const lastSend = getLastSendung(client)

  if (client.faUebermittelt)
    return { key: 'fa_gesendet',     label: `An FA gesendet am ${fmt(client.faUebermitteltDatum)}`,    color: 'green' }

  if (client.steGesendetDatum)
    return { key: 'mandant_gesendet', label: `An Mandant gesendet am ${fmt(client.steGesendetDatum)}`, color: 'blue' }

  if (client.abschlussFertig)
    return { key: 'abschluss_fertig', label: 'Abschluss fertig',                                       color: 'yellow' }

  if (lastSend)
    return { key: 'rq_gesendet',     label: `Rückfragen gesendet am ${fmt(lastSend)} – warte auf Feedback`, color: 'orange' }

  if (client.inBearbeitung)
    return { key: 'in_bearbeitung',  label: 'In Bearbeitung',                                          color: 'orange' }

  return   { key: 'erfasst',          label: 'Daten und Auftrag erfasst',                              color: 'muted' }
}

function fmt(d) {
  if (!d) return '–'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

export function getClientStatus(client) {
  const pct   = calculateProgress(client)
  const openQ = client.rueckfragen.filter(r => !r.beantwortet).length
  if (pct === 100) return 'completed'
  if (openQ > 0)   return 'open_questions'
  return 'in_progress'
}

// Event-Typen, die den Mandantenstatus setzen (in Priorität absteigend)
// Neutrale Typen (erinnerung, email, notiz) werden ignoriert
const STATUS_DRIVING_EVENTS = new Set(['unterschrift', 'rueckfragen', 'antwort', 'telefonat'])

/**
 * Leitet den Bearbeitungsstatus eines Mandanten automatisch ab.
 * 4 Werte: 'in_bearbeitung' | 'warte_feedback' | 'warte_unterschrift' | 'erledigt'
 *
 * Logik:
 *  1. abschlussFertig = true → erledigt
 *  2. Letztes zustandssetzendes Event in der Timeline bestimmt den Status:
 *     - 'unterschrift'       → warte_unterschrift
 *     - 'rueckfragen'        → warte_feedback
 *     - 'antwort'/'telefonat'→ in_bearbeitung
 *  3. Kein zustandssetzendes Event → in_bearbeitung
 */
export function getMandantStatus(client) {
  if (client.abschlussFertig) return 'erledigt'

  const events = (client.kommunikation?.events ?? [])
    .filter(e => STATUS_DRIVING_EVENTS.has(e.typ))
    .sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''))  // neueste zuerst

  const last = events[0]
  if (!last) return 'in_bearbeitung'
  if (last.typ === 'unterschrift')               return 'warte_unterschrift'
  if (last.typ === 'rueckfragen')                return 'warte_feedback'
  return 'in_bearbeitung'
}

export const MANDANT_STATUS_CONFIG = {
  in_bearbeitung:     { label: 'In Bearbeitung',  icon: '🔵', color: '#2563eb', bg: 'rgba(37,99,235,0.09)',  border: 'rgba(37,99,235,0.22)'  },
  warte_feedback:     { label: 'Warte auf Feedback', icon: '💬', color: '#b45309', bg: 'rgba(180,83,9,0.09)', border: 'rgba(180,83,9,0.22)' },
  warte_unterschrift: { label: 'Zur Unterschrift', icon: '✍️', color: '#d97706', bg: 'rgba(217,119,6,0.09)',  border: 'rgba(217,119,6,0.22)'  },
  erledigt:           { label: 'Erledigt',         icon: '✅', color: '#16a34a', bg: 'rgba(22,163,74,0.09)',  border: 'rgba(22,163,74,0.22)'  },
}

export function getFACountdown(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target - today) / 86400000)

  if (diff === 0) return { label: 'Heute fällig!', type: 'today' }
  if (diff > 0)   return { label: `in ${diff} Tag${diff === 1 ? '' : 'en'}`, type: 'future' }
  return { label: `${Math.abs(diff)}d überfällig`, type: 'overdue' }
}

export function getOverdueClients(clients) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return clients.filter(c => {
    if (!c.faGeplantDatum || c.faUebermittelt || c.archiviert) return false
    const d = new Date(c.faGeplantDatum)
    d.setHours(0, 0, 0, 0)
    return d <= today
  })
}
