// ─────────────────────────────────────────────────────────────────────────────
// empfangsvollmacht.js — Vorlage „Erteilung einer Empfangsvollmacht"
// (Vordruck der Finanzverwaltung, einseitig).
//
// Anders als die § 87a-Vordrucke ist dieses Formular in einer Serifenschrift
// gesetzt und arbeitet mit Ausfülllinien statt Kästen – beides ist hier
// nachgebildet. Alle Koordinaten sind aus dem Muster ausgemessen; gezeichnet
// wird direkt (eigener Satzspiegel 20–186 mm statt des OFD-Rasters).
// ─────────────────────────────────────────────────────────────────────────────
import { neuesDokument, dateinameSauber, txt } from './pdfKit.js'

// Satzspiegel dieses Vordrucks
const L = 20, R = 186, MITTE = (20 + 186) / 2
const SP1_R = 95        // rechter Rand der linken Spalte (Kopfzeilen)
const SP2_L = 108.5     // linke Kante der rechten Kopfspalte

const TEXT = 12         // Grundschrift (Times)
const LABEL = 8         // Beschriftungen unter den Linien
const FUSS = 8          // Hinweisblock

export const empfangsvollmacht = {
  id: 'empfangsvollmacht',
  titel: 'Empfangsvollmacht',
  untertitel: 'Bescheide an die Kanzlei',
  icon: '📬',
  kategorie: 'Finanzamt',
  beschreibung: 'Empfangsvollmacht für alle Steuerarten zu den angegebenen Steuernummern – Schreiben und Bescheide des Finanzamts gehen an die Kanzlei. Vordruck der Finanzverwaltung, einseitig.',
  quelle: 'Vordruck Erteilung einer Empfangsvollmacht',

  felder: [
    { key: 'vollmachtgeber',  label: 'Name(n) des Vollmachtgebers', typ: 'text', pflicht: true, breit: true, quelle: 'Stammdaten: Name',        stammdaten: 'name' },
    { key: 'telefon',         label: 'Tagsüber telefonisch erreichbar unter', typ: 'text', quelle: 'Stammdaten: Telefon',                       stammdaten: 'telefon' },
    { key: 'strasse',         label: 'Straße und Hausnummer',       typ: 'text', pflicht: true, breit: true, quelle: 'Stammdaten: Anschrift' },
    { key: 'plzOrt',          label: 'PLZ und Ort',                 typ: 'text', pflicht: true, breit: true, quelle: 'Stammdaten: Anschrift' },
    // ohne das Wort „Finanzamt" – das steht schon im Vordruck; deshalb kein Rückweg in die Stammdaten
    { key: 'finanzamt',       label: 'Finanzamt',                   typ: 'text', pflicht: true, quelle: 'Stammdaten: Finanzamt' },
    { key: 'finanzamtZeile2', label: 'Finanzamt – Straße',          typ: 'text', quelle: 'Stammdaten: Finanzamt',                               stammdaten: 'finanzamtStrasse' },
    { key: 'finanzamtZeile3', label: 'Finanzamt – PLZ, Ort',        typ: 'text', quelle: 'Stammdaten: Finanzamt',                               stammdaten: 'finanzamtPlzOrt' },
    { key: 'steuernummern',   label: 'Steuernummer(n)',             typ: 'text', pflicht: true, breit: true, quelle: 'Stammdaten: Steuernummer', stammdaten: 'steuernummer' },
    { key: 'bevollZeile1',    label: 'Empfangsbevollmächtigte(r) – Name',      typ: 'text', pflicht: true, breit: true, quelle: 'Kanzlei-Profil' },
    { key: 'bevollZeile2',    label: 'Empfangsbevollmächtigte(r) – Straße',    typ: 'text', breit: true, quelle: 'Kanzlei-Profil' },
    { key: 'bevollZeile3',    label: 'Empfangsbevollmächtigte(r) – PLZ, Ort',  typ: 'text', breit: true, quelle: 'Kanzlei-Profil' },
    {
      key: 'verfahren', label: 'Die Vollmacht erstreckt sich auf', typ: 'radio',
      optionen: [
        { wert: 'beides',        label: 'Feststellungs-/Festsetzungs- und Erhebungsverfahren' },
        { wert: 'feststellung',  label: 'nur Feststellungs-/Festsetzungsverfahren' },
        { wert: 'erhebung',      label: 'nur Erhebungsverfahren' },
      ],
    },
  ],

  vorbelegen(basis) {
    return {
      vollmachtgeber:  basis.name,
      telefon:         basis.telefon,
      strasse:         basis.strasse,
      plzOrt:          basis.plzOrt,
      // Das Wort „Finanzamt" steht schon im Vordruck
      finanzamt:       basis.finanzamt.replace(/^Finanzamt\s+/i, ''),
      finanzamtZeile2: basis.finanzamtStrasse,
      finanzamtZeile3: basis.finanzamtPlzOrt,
      steuernummern:   basis.steuernummer,
      bevollZeile1:    basis.kanzleiName,
      bevollZeile2:    basis.kanzleiStrasse,
      bevollZeile3:    basis.kanzleiPlzOrt,
      verfahren:       'beides',
    }
  },

  dateiname(w) {
    return `Empfangsvollmacht_${dateinameSauber(w.vollmachtgeber)}.pdf`
  },

  build(w) {
    const doc = neuesDokument()
    doc.setFont('times', 'normal').setFontSize(TEXT)

    // ── Helfer für diesen Vordruck ──────────────────────────────────────────
    // Ausfülllinie auf Höhe y (die Linie sitzt knapp unter der Schriftlinie)
    const linie = (y, von, bis) => {
      doc.setDrawColor(0).setLineWidth(0.25).line(von, y + 0.9, bis, y + 0.9)
    }
    // Wert auf die Linie schreiben
    const wert = (text, x, y, breite) => {
      const t = txt(text)
      if (!t) return
      doc.setFont('times', 'normal').setFontSize(TEXT).setTextColor(0)
      let aus = t
      while (doc.getTextWidth(aus) > breite && aus.length > 4) aus = aus.slice(0, -2)
      doc.text(aus, x, y)
    }
    // Beschriftung unter der Linie
    const label = (text, x, y, { zentriert = false } = {}) => {
      doc.setFont('times', 'normal').setFontSize(LABEL).setTextColor(0)
      doc.text(text, x, y, zentriert ? { align: 'center' } : undefined)
      doc.setFontSize(TEXT)
    }

    // ── Kopf: Vollmachtgeber und Telefon ────────────────────────────────────
    linie(28.0, L, SP1_R)
    linie(28.0, SP2_L, R - 2)
    wert(w.vollmachtgeber, L + 0.5, 27.0, SP1_R - L)
    wert(w.telefon,        SP2_L + 0.5, 27.0, (R - 2) - SP2_L)
    label('Name(n) des Vollmachtgebers/der Vollmachtgeber', L, 33.3)
    label('tagsüber telefonisch erreichbar unter', 109.3, 33.3)

    linie(42.4, L, SP1_R)
    wert(w.strasse, L + 0.5, 41.4, SP1_R - L)
    label('Straße und Hausnummer', L, 46.3)

    linie(53.4, L, SP1_R)
    wert(w.plzOrt, L + 0.5, 52.4, SP1_R - L)
    label('PLZ und Ort', L, 57.5)

    // ── Zuständiges Finanzamt (drei Zeilen) ─────────────────────────────────
    doc.setFont('times', 'normal').setFontSize(TEXT)
    doc.text('Finanzamt', L, 71.5)
    linie(71.5, 38.9, SP1_R + 1)
    wert(txt(w.finanzamt).replace(/^Finanzamt\s+/i, ''), 40, 71.5, SP1_R - 40)
    linie(81.0, L, SP1_R + 1)
    wert(w.finanzamtZeile2, L + 0.5, 81.0, SP1_R - L)
    linie(90.6, L, SP1_R + 1)
    wert(w.finanzamtZeile3, L + 0.5, 90.6, SP1_R - L)

    // ── Überschrift + Steuernummer(n) ───────────────────────────────────────
    doc.setFont('times', 'bold').setFontSize(TEXT)
    doc.text('Erteilung einer Empfangsvollmacht', L, 104.9)
    doc.text('Steuernummer(n):', L, 112.7)
    doc.setFont('times', 'normal')
    linie(112.7, 54.9, R)
    wert(w.steuernummern, 56, 112.7, R - 56)

    // ── Empfangsbevollmächtigte(r) ──────────────────────────────────────────
    doc.text('Hiermit erteile(n) ich/wir', L, 127.0)
    linie(127.0, 63.9, R)
    wert(w.bevollZeile1, 65, 127.0, R - 65)
    linie(136.5, L, R)
    wert(w.bevollZeile2, L + 0.5, 136.5, R - L)
    linie(146.0, L, R)
    wert(w.bevollZeile3, L + 0.5, 146.0, R - L)

    doc.setFont('times', 'normal').setFontSize(8.8)
    doc.text('Name und Anschrift ggf. Postfachadresse des Empfangsbevollmächtigten', MITTE, 149.5, { align: 'center' })
    doc.setFontSize(TEXT)

    doc.text('für alle Steuerarten zu o. g. Steuernummer(n) eine Empfangsvollmacht.', L, 161.9)

    // ── Verfahren (Ankreuzfelder) ───────────────────────────────────────────
    doc.text(doc.splitTextToSize('Die Empfangsvollmacht ist bis zu Ihrem Widerruf gültig und erstreckt sich auf die folgenden Verfahren:', 155), L, 171.4)

    const verfahrenZeilen = [
      { wert: 'beides',       text: 'das Feststellungs-/Festsetzungs- und Erhebungsverfahren', marker: '1)', mx: 124.1, y: 185.7 },
      { wert: 'feststellung', text: 'das Feststellungs-/Festsetzungsverfahren',                marker: '2)', mx:  96.1, y: 190.9 },
      { wert: 'erhebung',     text: 'das Erhebungsverfahren',                                  marker: '3)', mx:  67.8, y: 196.1 },
    ]
    verfahrenZeilen.forEach(z => {
      doc.setDrawColor(0).setLineWidth(0.25).rect(L, z.y - 3.4, 3.4, 3.4)
      if (w.verfahren === z.wert) {
        doc.setFont('times', 'bold').setFontSize(10)
        doc.text('X', L + 0.5, z.y - 0.4)
        doc.setFont('times', 'normal')
      }
      doc.setFontSize(TEXT)
      doc.text(z.text, 25.7, z.y)
      doc.setFontSize(LABEL)
      doc.text(z.marker, z.mx, z.y - 1.6)
      doc.setFontSize(TEXT)
    })

    // ── Unterschriften ──────────────────────────────────────────────────────
    linie(210.8, L, 76)
    linie(210.8, 95, R)
    label('Ort, Datum', 38.0, 215.6)
    label('Unterschrift des/der Vollmachtgeber(s)', 119.0, 215.6)

    // ── Hinweisblock (im Muster von zwei feinen Linien gerahmt) ─────────────
    doc.setDrawColor(160).setLineWidth(0.15)
    doc.line(19.3, 250.3, 19.3, 274.6)
    doc.line(168.5, 250.3, 168.5, 274.6)
    doc.setDrawColor(0)

    doc.setFont('times', 'bold').setFontSize(FUSS)
    doc.text('Hinweis:', 20.5, 254.7)
    doc.setFont('times', 'normal')

    const hinweise = [
      ['1)', 'Der Bevollmächtigte erhält sämtliche Schreiben und Bescheide der Finanzverwaltung.'],
      ['2)', 'Der Bevollmächtigte erhält nur die Schreiben und Bescheide, welche in erster Linie die Ermittlung der tatsächlichen Verhältnisse zur Berechnung und Feststellung der Besteuerungsgrundlagen gem. §§ 179 ff. Abgabenordnung bzw. die Berechnung und Festsetzung der Steuern, Steuermessbeträge, steuerlichen Nebenleistungen usw. betreffen, z.B. auch die Steuerbescheide.'],
      ['3)', 'Der Bevollmächtigte erhält nur die Schreiben und Bescheide, welche ausschließlich der reinen Zahlung und Erstattung der Steuern sowie der steuerlichen Nebenleistungen dienen.'],
    ]
    // Erste Zeile hinter der Ziffer, Folgezeilen wieder am linken Rand (wie im Muster)
    let hy = 257.9
    hinweise.forEach(([nr, text]) => {
      const zeilen = doc.splitTextToSize(text, 165)
      doc.text(nr, 20.5, hy)
      doc.text(zeilen[0], 23.6, hy)
      if (zeilen.length > 1) doc.text(zeilen.slice(1), 20.5, hy + 3.2)
      hy += zeilen.length * 3.2
    })
    doc.setFontSize(TEXT)

    return doc
  },
}

export default empfangsvollmacht
