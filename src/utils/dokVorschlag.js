/**
 * dokVorschlag.js – Ablage-Vorschläge (Zielordner + Dateiname)
 * (Bereich „Dokumente / Post-Service", Stufe 3)
 *
 * Aus dem Erkennungsergebnis (dokErkennung.js) und dem gewählten Mandanten wird
 * ein KONKRETER, aber jederzeit korrigierbarer Vorschlag gebaut:
 *   - Dateiname nach Schema  JJJJ-MM-TT_Mandantennummer_Dokumenttyp_Absender.pdf
 *   - Zielordner nach Mandant + Dokumenttyp (+ Jahr)
 *
 * Reine Vorschläge – nichts wird hier ausgeführt. Alle Funktionen sind pur und
 * damit einzeln testbar.
 */

import { getMandantPath } from './onedriveClient.js'

// Dokumenttyp → Ablage-Unterordner (steuerlicher Kontext)
export const TYP_ORDNER = {
  Steuerbescheid: 'Steuerbescheide',
  Umsatzsteuer:   'Umsatzsteuer',
  Rechnung:       'Rechnungen',
  Kontoauszug:    'Kontoauszüge',
  Mahnung:        'Mahnungen',
  Vertrag:        'Verträge',
  Lohnabrechnung: 'Lohn',
  Unbekannt:      'Posteingang',
}

/**
 * Wandelt ein erkanntes Datum "TT.MM.JJJJ" (auch "T.M.JJ") in "JJJJ-MM-TT".
 * Gibt '' zurück, wenn kein plausibles Datum vorliegt.
 */
export function normDateiDatum(datumStr) {
  const m = String(datumStr ?? '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
  if (!m) return ''
  let [, tt, mm, jjjj] = m
  const tag = Number(tt), monat = Number(mm)
  if (tag < 1 || tag > 31 || monat < 1 || monat > 12) return ''
  if (jjjj.length === 2) jjjj = (Number(jjjj) > 70 ? '19' : '20') + jjjj
  return `${jjjj}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`
}

/** Jahr (JJJJ) aus einem normalisierten Datum "JJJJ-MM-TT" oder '' */
export function jahrAusDatum(normDatum) {
  const m = String(normDatum ?? '').match(/^(\d{4})-/)
  return m ? m[1] : ''
}

/**
 * Bereinigt ein Dateinamen-Segment: unzulässige OneDrive-Zeichen und Leerzeichen
 * entfernen (Segmente werden mit "_" getrennt). Umlaute bleiben erlaubt.
 */
export function bereinigeSegment(s) {
  return String(s ?? '')
    .replace(/["/\\*:<>?|]/g, '')
    .replace(/\s+/g, '')
    .replace(/_+/g, '-')      // eigene Trenner nicht mit Segment-Trenner verwechseln
    .trim()
}

/**
 * Baut den vorgeschlagenen Dateinamen.
 * @param {{ datum?, mandantennummer?, typ?, absender?, endung? }} p
 * @returns {string} z. B. "2026-07-15_10042_Rechnung_CommerzbankAG.pdf"
 */
export function schlageDateinamen({ datum = '', mandantennummer = '', typ = '', absender = '', endung = 'pdf' }) {
  const teile = [
    datum,                                   // schon normalisiert (JJJJ-MM-TT) oder ''
    bereinigeSegment(mandantennummer),
    bereinigeSegment(typ && typ !== 'Unbekannt' ? typ : ''),
    bereinigeSegment(absender),
  ].filter(Boolean)
  const basis = teile.join('_') || 'Dokument'
  return `${basis}.${String(endung || 'pdf').replace(/^\./, '')}`
}

/**
 * Baut den vorgeschlagenen Zielordner-Pfad aus Mandant + Dokumenttyp (+ Jahr).
 */
export function schlageZielordner({ client, typ = 'Unbekannt', jahr = '' }) {
  if (!client) return ''
  const basis = getMandantPath(client).folderPath
  const unter = TYP_ORDNER[typ] ?? TYP_ORDNER.Unbekannt
  return jahr ? `${basis}/${unter}/${jahr}` : `${basis}/${unter}`
}

/**
 * Kombinierter Vorschlag aus Erkennungsergebnis + gewähltem Mandanten.
 * @param {object} ergebnis – Ergebnis von ordneMandantZu (kennungen, typ, kandidaten …)
 * @param {object|null} client – gewählter Mandant (oder null = noch offen)
 * @param {string} originalName – bisheriger Dateiname (für die Endung)
 * @returns {{ dateiname, zielordner, datum, jahr, absender, warnungen: string[] }}
 */
export function baueVorschlag(ergebnis, client, originalName = '') {
  const typ = ergebnis?.typ?.typ ?? 'Unbekannt'
  const datum = normDateiDatum(ergebnis?.kennungen?.datumse?.[0] ?? '')
  const jahr = jahrAusDatum(datum)
  const endung = (String(originalName).match(/\.([a-z0-9]+)$/i)?.[1]) ?? 'pdf'

  // Absender: aus den Absender-Treffern des gewählten Mandanten
  const kandidat = client ? (ergebnis?.kandidaten ?? []).find(k => k.clientId === client.id) : null
  const absender = kandidat?.absenderTreffer?.[0] ?? ''

  const warnungen = []
  if (!datum) warnungen.push('Kein Datum erkannt – bitte ergänzen.')
  if (!client) warnungen.push('Mandant nicht zugeordnet – bitte auswählen.')
  if (typ === 'Unbekannt') warnungen.push('Dokumenttyp unklar.')

  return {
    dateiname: schlageDateinamen({
      datum,
      mandantennummer: client?.mandantennummer ?? '',
      typ,
      absender,
      endung,
    }),
    zielordner: schlageZielordner({ client, typ, jahr }),
    datum, jahr, absender, warnungen,
  }
}
