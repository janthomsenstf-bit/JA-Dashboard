/**
 * unbekannteMails.js – gemeinsame Logik für unzugeordnete E-Mails.
 *
 * Wird von Cockpit (StartseiteHome) und AI-Empfehlungen genutzt, damit beide
 * Ansichten dieselben Absender ausblenden und dieselbe Vorsortierung nutzen.
 * Die Ignorierliste liegt bewusst weiter in localStorage (reine Anzeige-Einstellung,
 * keine Mandantendaten).
 */

const IGNORE_KEY = 'ki-ignorierte-absender-v1'

export function ladeIgnore() {
  try { return JSON.parse(localStorage.getItem(IGNORE_KEY) || '[]') } catch { return [] }
}

export function speichereIgnore(liste) {
  try { localStorage.setItem(IGNORE_KEY, JSON.stringify(liste)) } catch { /* ignore */ }
}

export function absenderKey(email) {
  return String(email?.von || '').toLowerCase().trim()
}

// Vorfilter OHNE KI: klar automatische/Bulk-Absender vorsortieren (konservativ,
// damit keine echte Mandanten-Mail versehentlich als „unwichtig" gilt).
const BULK_LOCAL = new Set(['noreply', 'no-reply', 'no_reply', 'donotreply', 'do-not-reply', 'mailer', 'mailer-daemon', 'notifications', 'notification', 'notify', 'mailings', 'mailing', 'postmaster', 'newsletter', 'news', 'marketing'])

export function istWahrscheinlichUnwichtig(email) {
  const local = String(email.von || '').toLowerCase().split('@')[0] || ''
  if (BULK_LOCAL.has(local) || local.includes('noreply') || local.includes('no-reply') || local.includes('newsletter')) return true
  const bet = String(email.betreff || '').toLowerCase()
  if (bet.includes('newsletter') || bet.includes('unsubscribe') || bet.includes('abmelden')) return true
  return false
}
