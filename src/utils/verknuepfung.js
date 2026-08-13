// Gemeinsamer Helfer fuer Auftrags-Verknuepfungen (Belege/Mails/Notizen an einem Auftrag).
// EIN Container: auftrag.verknuepfungen[] – wird von DokumenteTab, KommunikationTab, BotInbox
// ueber dasselbe Muster beschrieben, damit es nicht mehrere Systeme gibt.

export function mkVerknuepfung({ art, ...rest }) {
  return {
    id:           'vk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    art,                                  // 'beleg' | 'mail' | 'notiz'
    verknuepftAm: new Date().toISOString(),
    ...rest,                              // z.B. name, docPath, eventId, betreff, absender, datum, frist
  }
}

/**
 * Haengt eine Verknuepfung additiv an einen Auftrag – entweder an einen bestehenden
 * (zielId) oder an einen neu angelegten (macheNeu()). Gibt das NEUE auftraege-Array
 * zurueck (bestehendes wird nie mutiert, nur gespreadet -> Datensicherheit).
 *
 *   auftraege   aktuelles client.auftraege
 *   zielId      Auftrags-ID | '__neu__'
 *   macheNeu    () => neues Auftrag-Objekt (z.B. mkAuftrag(...) mit gesetzter Bezeichnung)
 *   eintrag     Verknuepfungs-Objekt (aus mkVerknuepfung)
 */
export function verknuepfungAnhaengen({ auftraege, zielId, macheNeu, eintrag }) {
  const liste = [...(auftraege ?? [])]
  if (zielId === '__neu__') {
    const neu = macheNeu()
    neu.verknuepfungen = [...(neu.verknuepfungen ?? []), eintrag]
    liste.unshift(neu)
    return { auftraege: liste, auftragId: neu.id }
  }
  const idx = liste.findIndex(a => a && a.id === zielId)
  if (idx >= 0) {
    liste[idx] = { ...liste[idx], verknuepfungen: [...(liste[idx].verknuepfungen ?? []), eintrag] }
    return { auftraege: liste, auftragId: zielId }
  }
  // Ziel nicht gefunden -> nichts veraendern (kein Datenverlust)
  return { auftraege: liste, auftragId: null }
}
