/**
 * vorgang.js – Das einheitliche Empfehlungs-Objekt „Vorgang" (BP 0).
 *
 * Jeder relevante Anlass (Mail, Beleg, JA-Prüfung, Bescheid, Notiz, Überwachung)
 * erzeugt GENAU dieses Objekt. Es wird überall gleich dargestellt (VorgangKarte)
 * und später auch über den MCP nach außen gereicht.
 *
 * Struktur:
 *   {
 *     id, schwere, mandantId, titel,
 *     quelle: { typ, ref },
 *     feststellung, einschaetzung, empfehlung,
 *     aktionen: [ { id, parameter } ],   // Katalog-Aktionen, vorbefüllt
 *     erledigt
 *   }
 */

import { aktionDef, KATEGORIEN } from './aktionskatalog.js'

export const SCHWERE = {
  info:            { label: 'Info',           farbe: 'var(--text-muted)', punkt: '⚪' },
  hinweis:         { label: 'Hinweis',        farbe: 'var(--yellow)',     punkt: '🟡' },
  handlungsbedarf: { label: 'Handlungsbedarf', farbe: 'var(--red)',       punkt: '🔴' },
}

let _c = 0
function genId() {
  _c += 1
  return 'vg_' + Date.now().toString(36) + '_' + _c.toString(36)
}

/** Baut einen validierten Vorgang. Unbekannte Aktions-ids werden verworfen (nichts erfinden). */
export function makeVorgang({ schwere = 'hinweis', mandantId = null, titel = '', quelle = null, feststellung = '', einschaetzung = '', empfehlung = '', aktionen = [] } = {}) {
  return {
    id: genId(),
    schwere: SCHWERE[schwere] ? schwere : 'hinweis',
    mandantId: mandantId ?? null,
    titel: String(titel || 'Vorgang'),
    quelle: quelle && quelle.typ ? { typ: quelle.typ, ref: quelle.ref ?? null } : null,
    feststellung: String(feststellung || ''),
    einschaetzung: String(einschaetzung || ''),
    empfehlung: String(empfehlung || ''),
    aktionen: (Array.isArray(aktionen) ? aktionen : [])
      .filter(a => a && aktionDef(a.id))
      .map(a => ({ id: a.id, parameter: a.parameter ?? {} })),
    erledigt: false,
  }
}

// ── Aktions-Beschreibung für die Karte ────────────────────────────────────────
function fmtDatum(ymd) {
  if (!ymd) return null
  const d = new Date(String(ymd).length <= 10 ? `${ymd}T12:00:00` : ymd)
  if (isNaN(d.getTime())) return String(ymd)
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Menschlich lesbarer CTA-Text + Detailzeile für eine vorgeschlagene Aktion.
 * Nutzt Katalog-Label + vorbefüllte Parameter. Rein darstellend.
 */
export function beschreibeAktion(aktion) {
  const def = aktionDef(aktion?.id)
  if (!def) return { label: 'Unbekannte Aktion', icon: '•', detail: '', stufe: 'bestaetigen' }
  const p = aktion.parameter ?? {}
  const detailTeile = []
  if (p.titel || p.bezug || p.worum || p.betreff) detailTeile.push(`„${p.titel || p.bezug || p.worum || p.betreff}“`)
  if (p.faelligkeit || p.datum || p.start) detailTeile.push(`bis ${fmtDatum(p.faelligkeit || p.datum || p.start)}`)
  if (p.mandantName) detailTeile.push(p.mandantName)
  return {
    label: def.label,
    icon: def.icon || KATEGORIEN[def.kategorie]?.icon || '•',
    stufe: def.stufe,
    umkehrbar: def.umkehrbar,
    implementiert: def.implementiert,
    detail: detailTeile.join(' · '),
  }
}
