/* vorlagen.js – erzeugt Ausfüll-Vorlagen als .xlsx für den Mandanten.
 * Lazy geladen (xlsx ist groß), wie exportExcel.js.
 *
 * Ein Modul in registry.js meldet über die Eigenschaft `vorlage` an, dass es
 * eine Vorlage anbietet:  vorlage: { id: 'arbeitszimmer', titel: '…' }
 * Der Bauplan liegt hier, damit registry.js importfrei bleibt.
 */
import * as XLSX from 'xlsx'
import { AZ_POSTEN } from './registry.js'

// ── kleine Helfer für den Blattaufbau ───────────────────────────────────────
const EINGABE = { fill: { patternType: 'solid', fgColor: { rgb: 'E8F3E4' } } }

function blatt(zeilen) {
  const ws = XLSX.utils.aoa_to_sheet(zeilen.map(z => z.map(c => (c && c.f ? '' : c))))
  // Formeln nachtragen (aoa_to_sheet kann sie nicht direkt)
  zeilen.forEach((z, r) => z.forEach((c, k) => {
    if (c && typeof c === 'object' && c.f) {
      // v: 0 als zwischengespeicherter Wert – ohne ihn verwirft der xlsx-Writer
      // die Zelle und die Formel landet nicht in der Datei. Excel rechnet beim
      // Öffnen neu.
      ws[XLSX.utils.encode_cell({ r, c: k })] = { t: 'n', v: 0, f: c.f, z: c.z || '#,##0.00' }
    } else if (typeof c === 'number') {
      ws[XLSX.utils.encode_cell({ r, c: k })] = { t: 'n', v: c, z: '#,##0.00' }
    }
  }))
  return ws
}

/**
 * Ausfüll-Vorlage „Häusliches Arbeitszimmer" für den Mandanten.
 * Aufbau folgt dem Spielplan-Blatt „AZ"; die Kostenarten kommen aus AZ_POSTEN,
 * damit Vorlage und Modul dieselben Positionen führen.
 */
export function arbeitszimmerVorlage({ mandant = '', jahr = '', objekt = 'miete' } = {}) {
  const eigentum = objekt === 'eigentum'
  const Z = []           // Zeilen (0-basiert), Excel-Zeile = Index + 1
  const push = (...z) => { Z.push(z); return Z.length }   // gibt Excel-Zeilennr. zurück

  push('Häusliches Arbeitszimmer – Angaben für den Jahresabschluss')
  push('Variante', eigentum ? 'Eigentum' : 'Zur Miete')
  push('Mandant', mandant)
  push('Wirtschaftsjahr', jahr)
  push()
  push('Bitte die Betragsfelder in Spalte C ausfüllen. Die übrigen Werte rechnen sich von selbst.')
  push(eigentum
    ? 'Belege bitte beilegen: Grundriss mit Flächenangaben, Kaufvertrag bzw. Nachweis des Gebäudeanteils,'
    : 'Belege bitte beilegen: Mietvertrag und Nebenkostenabrechnung, Grundriss mit Flächenangaben,')
  push(eigentum
    ? 'Zinsbescheinigung der Bank, Rechnungen zu Renovierung und Ausstattung.'
    : 'Rechnungen zu Renovierung und Ausstattung.')
  push()

  push('1. Angaben zum Raum')
  const rGes = push('Gesamtwohnfläche der Wohnung einschließlich Arbeitszimmer', 'm²', '')
  const rAz = push('davon Fläche des Arbeitszimmers', 'm²', '')
  const rPct = push('Anteil Arbeitszimmer', '%', { f: `IF(C${rGes}=0,0,C${rAz}/C${rGes}*100)`, z: '#,##0.00' })
  push('Hinweis: Nebenräume wie Waschküche, Abstellraum und Dachboden bleiben außen vor,')
  push('wenn das Arbeitszimmer zu den Wohnräumen gehört.')
  push()

  push('2. Kosten des gesamten Objekts im Wirtschaftsjahr')
  push('Kostenart', '', 'Betrag 100 %', '', 'davon Arbeitszimmer')
  const ersteKost = Z.length + 1
  AZ_POSTEN.filter(([, , nur]) => !nur || nur === objekt).forEach(([, label]) => {
    const r = push(label, '', '', '', null)
    Z[r - 1][4] = { f: `IF($C$${rPct}=0,0,C${r}*$C$${rPct}/100)` }
  })
  const letzteKost = Z.length
  push()

  let rAfa = null
  if (eigentum) {
    push('3. Gebäude-AfA')
    const rKauf = push('Kaufpreis Gebäudeanteil (ohne Grund und Boden)', '', '')
    const rSatz = push('AfA-Satz in % (§ 7 Abs. 4 EStG, i. d. R. 2 % oder 3 %)', '', 2)
    rAfa = push('Gebäude-AfA im Jahr', '', { f: `C${rKauf}*C${rSatz}/100` })
    Z[rAfa - 1][4] = { f: `IF($C$${rPct}=0,0,C${rAfa}*$C$${rPct}/100)` }
    push()
  }

  push('Summe der auf das Arbeitszimmer entfallenden Kosten', '', '', '',
    { f: rAfa ? `SUM(E${ersteKost}:E${letzteKost})+E${rAfa}` : `SUM(E${ersteKost}:E${letzteKost})` })
  push()

  push('4. Fragen zur Nutzung (bitte ankreuzen: ja / nein)')
  const fragen = [
    'Wird der Raum ausschließlich oder nahezu ausschließlich beruflich genutzt?',
    'Ist der Raum von den übrigen Räumen abgetrennt (kein Durchgangszimmer)?',
    'Bildet das Arbeitszimmer den Mittelpunkt der gesamten beruflichen Tätigkeit?',
    'Steht für die Tätigkeit dauerhaft ein anderer Arbeitsplatz zur Verfügung?',
    'Wird der Raum von weiteren Personen mitgenutzt?',
    'Wurde der Raum nur einen Teil des Jahres genutzt? Wenn ja: welche Monate?',
  ]
  fragen.forEach(f => push(f, '', ''))
  push()
  push('An wie vielen Tagen wurde ausschließlich oder überwiegend zu Hause gearbeitet?', 'Tage', '')
  push('(nur nötig, wenn das Arbeitszimmer nicht den Mittelpunkt bildet – Tagespauschale 6 €/Tag)')
  push()
  push('Datum, Unterschrift', '', '')

  const ws = blatt(Z)
  ws['!cols'] = [{ wch: 62 }, { wch: 8 }, { wch: 16 }, { wch: 2 }, { wch: 18 }]

  // Hinweisblatt
  const H = [
    ['Hinweise zum Ausfüllen'],
    [],
    ['Welche Kosten gehören dazu?'],
    ['Miete, Schuldzinsen für Anschaffung/Herstellung/Reparatur, Reinigung, Wasser und Energie,'],
    ['Grundsteuer, Müllabfuhr, Schornsteinfeger, Gebäudeversicherung, Renovierung des Zimmers'],
    ['und die Ausstattung wie Tapeten, Teppiche und Vorhänge.'],
    [],
    ['Was gehört NICHT dazu?'],
    ['Luxusgegenstände zur Dekoration; Aufwendungen für Küche, Bad und Flur; Renovierung von'],
    ['Räumen, die privat genutzt werden. Arbeitsmittel wie Schreibtisch oder Regal sind dagegen'],
    ['in voller Höhe abziehbar und gehören nicht in diese Aufstellung.'],
    [],
    ['Warum die Einzelaufstellung?'],
    ['Die Aufwendungen müssen nach § 4 Abs. 7 EStG einzeln, zeitnah und getrennt von den'],
    ['übrigen Betriebsausgaben aufgezeichnet werden.'],
    [],
    ['Rechtsstand'],
    ['§ 4 Abs. 5 S. 1 Nr. 6b und 6c EStG, BMF-Schreiben vom 15.08.2023.'],
    ['Ab 2023: voller Abzug nur, wenn das Arbeitszimmer den Mittelpunkt der gesamten Tätigkeit'],
    ['bildet – wahlweise Jahrespauschale 1.260 €. Sonst Tagespauschale 6 €/Tag, höchstens 1.260 €.'],
  ]
  const wsH = XLSX.utils.aoa_to_sheet(H)
  wsH['!cols'] = [{ wch: 100 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Arbeitszimmer')
  XLSX.utils.book_append_sheet(wb, wsH, 'Hinweise')
  return wb
}

const BAUPLAENE = { arbeitszimmer: arbeitszimmerVorlage }

/** Vorlage bauen und herunterladen. `id` kommt aus MODULE[x].vorlage.id. */
export function vorlageHerunterladen(id, ctx = {}) {
  const bauen = BAUPLAENE[id]
  if (!bauen) throw new Error('Für "' + id + '" ist keine Vorlage hinterlegt.')
  const wb = bauen(ctx)
  const name = ['Vorlage', id, ctx.mandant, ctx.jahr].filter(Boolean).join('_')
  XLSX.writeFile(wb, name.replace(/[^\w.-]+/g, '_') + '.xlsx')
}
