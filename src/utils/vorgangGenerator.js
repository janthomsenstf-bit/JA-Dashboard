/**
 * vorgangGenerator.js – erzeugt „Vorgänge" (AI-Empfehlungen) aus den vorhandenen
 * Mandantendaten. REIN LESEND – erzeugt nur Vorschläge, ändert nichts.
 *
 * Erste, KI-freie Erkenner (BP 4, Stufe 1):
 *   1) unbeantwortete eingehende E-Mails je Mandant
 *   2) offene (unbeantwortete) Rückfragen je Mandant
 *
 * Die vorgeschlagenen Aktionen sind bewusst nur solche, die der App-Adapter schon
 * ausführen kann (aufgabe_anlegen, wiedervorlage_anlegen) – so wirkt „Alle ausführen"
 * sofort. Weitere Erkenner/Aktionen (Belege, JA-Prüfung, Mail-Entwurf) folgen.
 */

import { makeVorgang } from './vorgang.js'

function plusTage(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
function tageSeit(iso) {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

// Unbeantwortete eingehende Mails (keine erledigtAm, danach keine gesendete Antwort).
function offeneEingehende(client) {
  const evs = [...(client?.kommunikation?.events || [])]
    .sort((a, b) => new Date(b.erstelltAm || 0) - new Date(a.erstelltAm || 0))
  return evs.filter(e => {
    if (e.typ !== 'eingehend' || e.erledigtAm) return false
    const t = new Date(e.erstelltAm || 0).getTime()
    return !evs.some(x => x.typ !== 'eingehend' && x.status === 'gesendet' && new Date(x.erstelltAm || 0).getTime() > t)
  })
}

export function generiereVorgaenge(clients, ignorierteAbsender = []) {
  const out = []
  const ignoreSet = new Set((ignorierteAbsender || []).map(a => String(a).toLowerCase().trim()).filter(Boolean))

  for (const c of (clients || [])) {
    if (c.archiviert) continue

    // 1) Unbeantwortete E-Mails (ignorierte Absender ausgenommen)
    const offen = offeneEingehende(c).filter(e => !ignoreSet.has(String(e.absender || '').toLowerCase().trim()))
    if (offen.length) {
      const neueste = offen[0]
      const alter = tageSeit(neueste.erstelltAm)
      const v = makeVorgang({
        schwere: alter >= 3 ? 'handlungsbedarf' : 'hinweis',
        mandantId: c.id,
        titel: `Unbeantwortete E-Mail – ${c.name}`,
        quelle: { typ: 'mail', ref: neueste.id },
        feststellung: `${offen.length} unbeantwortete eingehende Nachricht${offen.length > 1 ? 'en' : ''}. Neueste: „${neueste.betreff || '(kein Betreff)'}“ von ${neueste.absender || 'unbekannt'}${alter > 0 ? `, vor ${alter} Tag${alter > 1 ? 'en' : ''}` : ''}.`,
        einschaetzung: alter >= 3 ? 'Seit mehreren Tagen ohne Antwort – sollte bald bearbeitet werden.' : 'Wartet auf eine Reaktion.',
        empfehlung: 'Aufgabe zum Beantworten anlegen und zur Sicherheit wiedervorlegen. Ist es Spam, unten „Verwerfen" oder „Absender ignorieren".',
        aktionen: [
          { id: 'aufgabe_anlegen', parameter: { mandantId: c.id, mandantName: c.name, titel: `E-Mail beantworten: ${neueste.betreff || '(kein Betreff)'}`, faelligkeit: plusTage(2), beschreibung: `Von ${neueste.absender || ''}` } },
          { id: 'wiedervorlage_anlegen', parameter: { mandantId: c.id, mandantName: c.name, bezug: `E-Mail ${c.name}`, faelligkeit: plusTage(5) } },
        ],
      })
      // Merkmale fürs Verwerfen/Spam (rein darstellend, nicht Teil des Vorgang-Vertrags)
      v._mailEventIds = offen.map(e => e.id)
      v._absender = neueste.absender || null
      out.push(v)
    }

    // 2) Offene Rückfragen
    const rf = (c.rueckfragen || []).filter(r => !r.beantwortet)
    if (rf.length) {
      out.push(makeVorgang({
        schwere: 'hinweis',
        mandantId: c.id,
        titel: `Offene Rückfragen – ${c.name}`,
        quelle: { typ: 'ueberwachung', ref: 'rueckfragen' },
        feststellung: `${rf.length} unbeantwortete Rückfrage${rf.length > 1 ? 'n' : ''}. Z. B.: „${String(rf[0].text || '').slice(0, 90)}“.`,
        einschaetzung: 'Der Mandant hat auf diese Punkte noch nicht geantwortet.',
        empfehlung: 'Nachfass-Aufgabe anlegen und wiedervorlegen.',
        aktionen: [
          { id: 'aufgabe_anlegen', parameter: { mandantId: c.id, mandantName: c.name, titel: `Rückfragen nachfassen (${rf.length})`, faelligkeit: plusTage(7) } },
          { id: 'wiedervorlage_anlegen', parameter: { mandantId: c.id, mandantName: c.name, bezug: `Rückfragen ${c.name}`, faelligkeit: plusTage(7) } },
        ],
      }))
    }
  }

  const rang = { handlungsbedarf: 0, hinweis: 1, info: 2 }
  out.sort((a, b) => (rang[a.schwere] ?? 9) - (rang[b.schwere] ?? 9))
  return out.slice(0, 40)
}
