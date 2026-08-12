/**
 * Stotax-Stammdaten-Import (Abgleich Excel -> Mandanten).
 *
 * REINE Vorschau/Diff-Logik – ändert NICHTS. Das Anwenden (Merge) passiert
 * separat und immer nur mit Bestätigung + Snapshot (Datensicherheit).
 *
 * Matching-Anker: STEUERNUMMER (stabil). Mandantennummern ändern sich in Stotax,
 * alte Dokumente tragen alte Nummern – deshalb wird über die Steuernummer
 * zugeordnet und die Mandantennummer nur als (bestätigungspflichtige) Korrektur
 * vorgeschlagen.
 */

// Spielbuch-Feld  ->  Anzeige + Art des Werts
// kind: 'scalar' = direktes Client-Feld | 'email' = kontakte[].email | 'anschrift' = anschriften[] (Sitz)
export const IMPORT_FELDER = [
  { feld: 'mandantennummer',        label: 'Mandantennummer',        kind: 'scalar' },
  { feld: 'name',                   label: 'Name',                   kind: 'scalar' },
  { feld: 'steuernummer',           label: 'Steuernummer',           kind: 'scalar' },
  { feld: 'steuerIdNr',             label: 'Steuer-Identnr.',        kind: 'scalar' },
  { feld: 'finanzamt',              label: 'Finanzamt',              kind: 'scalar' },
  { feld: 'land',                   label: 'Land',                   kind: 'scalar' },
  { feld: 'laenderkuerzel',         label: 'Länderkürzel',           kind: 'scalar' },
  { feld: 'gemeinde',               label: 'Gemeinde',               kind: 'scalar' },
  { feld: 'bundeslandFa',           label: 'Bundesland (FA)',        kind: 'scalar' },
  { feld: 'telefon',                label: 'Telefon',                kind: 'scalar' },
  { feld: 'mobil',                  label: 'Mobil',                  kind: 'scalar' },
  { feld: 'bank',                   label: 'Bank',                   kind: 'scalar' },
  { feld: 'hauptverantwMitarbeiter',label: 'Betreuer',               kind: 'scalar' },
  { feld: 'unternehmensgegenstand', label: 'Unternehmensgegenstand', kind: 'scalar' },
  { feld: 'email',                  label: 'E-Mail',                 kind: 'email' },
  { feld: 'anschrift',              label: 'Anschrift (Sitz)',       kind: 'anschrift' },
]

const clean = v => String(v ?? '').trim()
export const normSteuernummer = s => String(s || '').replace(/[^0-9]/g, '')
const normName = s => String(s || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '')

/** Rohzeile aus der Stotax-Excel -> normalisierte Stammdaten mit Spielbuch-Feldnamen. */
export function zeileZuStammdaten(row) {
  const strasse = clean(row['Straße'])
  const hnr     = clean(row['Hausnummer'])
  const plz     = clean(row['PLZ'])
  const ort     = clean(row['Ort'])
  const anschrift = [
    [strasse, hnr].filter(Boolean).join(' '),
    [plz, ort].filter(Boolean).join(' '),
  ].filter(Boolean).join(', ')

  return {
    mandantennummer:         clean(row['Mandant']),
    name:                    clean(row['Name (Betrieb)']) || clean(row['Name']),
    nameKurz:                clean(row['Name']),
    steuernummer:            clean(row['Steuernummer (Betrieb)']) || clean(row['Steuernummer']),
    steuerIdNr:              clean(row['Steuer-Ident.nr.']),
    finanzamt:               clean(row['Finanzamt']),
    land:                    clean(row['Land']),
    laenderkuerzel:          clean(row['Länderkürzel']),
    gemeinde:                clean(row['Gemeinde']),
    bundeslandFa:            clean(row['Bundesland FA']),
    telefon:                 clean(row['Telefon']),
    mobil:                   clean(row['Mobil']),
    bank:                    clean(row['Bank']),
    hauptverantwMitarbeiter: clean(row['Hauptverantw. Mitarbeiter']),
    unternehmensgegenstand:  clean(row['Unternehmensgegenstand']),
    email:                   clean(row['E-Mail']),
    anschrift,
  }
}

/** .xlsx (ArrayBuffer) -> Liste normalisierter Stammdaten. xlsx wird lazy geladen (groß). */
export async function parseStotaxDatei(arrayBuffer) {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const ws = wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  return rows.map(zeileZuStammdaten).filter(sd => sd.mandantennummer || sd.nameKurz)
}

/** Aktuellen Wert aus dem Client lesen – je nach Feldart. */
export function clientWert(client, feld, kind) {
  if (!client) return ''
  if (kind === 'email') return clean(client.kontakte?.find(k => k.email)?.email)
  if (kind === 'anschrift') {
    const sitz = client.anschriften?.find(a => /sitz/i.test(a.typ)) || client.anschriften?.[0]
    return clean(sitz?.text)
  }
  return clean(client[feld])
}

/** Zuordnung: Steuernummer (hart) -> Name (weich). */
export function findeMatch(clients, sd) {
  const sn = normSteuernummer(sd.steuernummer)
  if (sn) {
    const perSn = clients.filter(c => normSteuernummer(c.steuernummer) === sn)
    if (perSn.length === 1) return { client: perSn[0], methode: 'steuernummer' }
    if (perSn.length > 1)  return { client: null, methode: 'mehrdeutig', kandidaten: perSn }
  }
  const nn = normName(sd.nameKurz || sd.name)
  if (nn) {
    const perName = clients.filter(c => {
      const cn = normName(c.name)
      return cn && (cn.includes(nn) || nn.includes(cn))
    })
    if (perName.length === 1) return { client: perName[0], methode: 'name' }
    if (perName.length > 1)  return { client: null, methode: 'mehrdeutig', kandidaten: perName }
  }
  return { client: null, methode: 'neu' }
}

/** Feld-für-Feld-Diff. kategorie: 'fill' (Leerfeld) | 'mandantennr' | 'conflict'. */
export function berechneDiff(client, sd) {
  const changes = []
  for (const f of IMPORT_FELDER) {
    const neu = clean(sd[f.feld])
    if (!neu) continue                       // Stotax liefert nichts -> kein Vorschlag
    const alt = clientWert(client, f.feld, f.kind)
    const gleich = f.feld === 'steuernummer'
      ? normSteuernummer(alt) === normSteuernummer(neu)
      : alt.toLowerCase() === neu.toLowerCase()
    if (gleich) continue
    let kategorie = 'conflict'
    if (!alt) kategorie = 'fill'
    else if (f.feld === 'mandantennummer') kategorie = 'mandantennr'
    changes.push({ feld: f.feld, label: f.label, kind: f.kind, alt, neu, kategorie })
  }
  return changes
}

/** Gesamtbericht für die Vorschau. */
export function baueBericht(clients, stammdatenListe) {
  const matched = [], neu = [], mehrdeutig = []
  const stats = { fill: 0, mandantennr: 0, conflict: 0 }
  for (const sd of stammdatenListe) {
    const m = findeMatch(clients, sd)
    if (m.client) {
      const diffs = berechneDiff(m.client, sd)
      diffs.forEach(d => { stats[d.kategorie]++ })
      matched.push({ sd, client: m.client, methode: m.methode, diffs })
    } else if (m.methode === 'mehrdeutig') {
      mehrdeutig.push({ sd, kandidaten: m.kandidaten })
    } else {
      neu.push(sd)
    }
  }
  return { matched, neu, mehrdeutig, stats, gesamtDatei: stammdatenListe.length }
}
