/**
 * aktionDispatcher.js – Der zentrale Ausführer der Aktions-Schicht (BP 0).
 *
 * REIN und testbar: kennt weder React noch App-State. Die App reicht einen
 * „Adapter" herein, der die Katalog-Aktionen auf ihre EIGENEN, sicheren Setter
 * abbildet (addAufgabe, addRueckfrage, addTermin, updateClient, …). So läuft jedes
 * Schreiben über die App-eigene Speicherung → kein Überschreiben von Mandantendaten.
 *
 * Genau dieselbe Dispatcher-Logik nutzt später der MCP-Server (mit einem Server-
 * Adapter statt App-Setter) – einmal definiert, mehrfach genutzt.
 *
 * Adapter-Form (alle optional; fehlt eine Methode → 'nicht_implementiert'):
 *   {
 *     aufgabe_anlegen(parameter),
 *     frist_anlegen(parameter),
 *     wiedervorlage_anlegen(parameter),
 *     rueckfrage_anlegen(parameter),
 *     anruf_aufgabe(parameter),
 *     notiz_anlegen(parameter),
 *     termin_anlegen(parameter),
 *     mail_entwurf(parameter),
 *     stammdaten_aktualisieren(parameter),
 *     … weitere Katalog-ids
 *   }
 * Jede Methode gibt idealerweise etwas Serialisierbares zurück (z.B. die neue id).
 */

import { aktionDef, istBatchfaehig } from './aktionskatalog.js'

/**
 * Erzeugt einen Dispatcher, der an den übergebenen Adapter gebunden ist.
 * @param {object} adapter  Abbildung aktionId → Funktion(parameter)
 */
export function erstelleDispatcher(adapter = {}) {

  /** Führt eine einzelne Aktion aus (bzw. bereitet sie vor). */
  async function fuehreAus(aktion) {
    const def = aktionDef(aktion?.id)
    if (!def) return { id: aktion?.id ?? null, status: 'unbekannt', text: 'Unbekannte Aktion' }

    // 🔴 Freigabe-Aktionen (Mail senden, Löschen) werden NIE hier ausgeführt.
    if (def.stufe === 'freigeben') {
      return { id: def.id, status: 'vorbereitet', text: `${def.label}: wartet auf deine Freigabe` }
    }

    const fn = adapter[def.id]
    if (typeof fn !== 'function') {
      return { id: def.id, status: 'nicht_implementiert', text: `${def.label}: noch nicht angebunden` }
    }

    try {
      const ergebnis = await fn(aktion.parameter ?? {})
      return { id: def.id, status: 'ausgefuehrt', text: `${def.label} erledigt`, ergebnis }
    } catch (e) {
      return { id: def.id, status: 'fehler', text: `${def.label}: ${e?.message ?? String(e)}` }
    }
  }

  /**
   * Führt alle batchfähigen Aktionen aus („Alle ausführen").
   * 🔴-Aktionen werden übersprungen und als „vorbereitet" zurückgegeben.
   * @returns {Promise<{ergebnisse:Array, ausgefuehrt:number, vorbereitet:number, fehler:number}>}
   */
  async function fuehreAlleAus(aktionen = []) {
    const ergebnisse = []
    for (const a of aktionen) {
      const r = istBatchfaehig(a.id) ? await fuehreAus(a) : await fuehreAus(a) // fuehreAus behandelt 🔴 selbst
      ergebnisse.push(r)
    }
    return {
      ergebnisse,
      ausgefuehrt:  ergebnisse.filter(r => r.status === 'ausgefuehrt').length,
      vorbereitet:  ergebnisse.filter(r => r.status === 'vorbereitet').length,
      fehler:       ergebnisse.filter(r => r.status === 'fehler' || r.status === 'nicht_implementiert').length,
    }
  }

  return { fuehreAus, fuehreAlleAus }
}
