// ─────────────────────────────────────────────────────────────────────────────
// sepaMandat.js — Vorlage „SEPA-Lastschriftmandat" der Finanzverwaltung
// Schleswig-Holstein (Stand 01/2026), zweiseitig: Vordruck + Hinweisblatt.
//
// Der Vordruck gilt für ALLE Finanzämter in Schleswig-Holstein (also auch
// Flensburg); die Gläubiger-Identifikationsnummer ist landesweit dieselbe und
// deshalb fest eingedruckt. Nicht verwendbar für die Umlage zur Landwirtschafts-
// kammer und die Kfz-Steuer — dafür gibt es eigene Vordrucke.
//
// Anders als die Vollmachten arbeitet dieses Formular durchgehend mit
// Kästchenrastern (ein Zeichen je Kästchen). Alle Koordinaten sind aus dem
// amtlichen PDF ausgelesen (Textpositionen und Rechtecke), nicht geschätzt.
//
// Quelle: https://www.schleswig-holstein.de/DE/fachinhalte/S/steuern/Downloads/
//         SEPA_Lastschriftmandat.pdf
// ─────────────────────────────────────────────────────────────────────────────
import { neuesDokument, dateinameSauber, txt, deDatum, heuteDE } from './pdfKit.js'

// Landesweit gültige Gläubiger-ID der Finanzverwaltung Schleswig-Holstein
const GLAEUBIGER_ID = 'DE88FIN00000001392'

// Rückfall, solange am Mandanten kein Finanzamt gepflegt ist
const FA_FLENSBURG = {
  name:    'Finanzamt Flensburg',
  strasse: 'Duburger Straße 58-64',
  plzOrt:  '24939 Flensburg',
}

// Satzspiegel des Vordrucks
const L = 17.5, R = 192.7          // Außenrahmen
const IL = 18.0, IR = 192.6        // Innenkante
const KOPF_X = 110.1               // Trennlinie des Kopfkastens

// Kästchenraster: 35 Zellen über die volle Breite
const K_X0 = 22.1, K_N = 35, K_P = (IR - K_X0) / K_N, K_H = 5

// Schriftgrade des Vordrucks (aus den Glyphenhöhen des Originals)
const S_MINI = 5, S_LABEL = 7, S_TEXT = 8, S_MITTEL = 9, S_KOPF = 10, S_GROSS = 11, S_XL = 12

export const sepaMandat = {
  id: 'sepa-mandat-sh',
  titel: 'SEPA-Lastschriftmandat',
  untertitel: 'Finanzamt (Schleswig-Holstein)',
  icon: '🏦',
  kategorie: 'Finanzamt',
  beschreibung:
    'Amtlicher Vordruck der Finanzverwaltung Schleswig-Holstein (Stand 01/2026) für die Teilnahme am Lastschrifteinzugsverfahren. '
    + 'Zwei Seiten: Mandat und Hinweisblatt. Nicht für Umlage zur Landwirtschaftskammer und Kfz-Steuer.',
  quelle: 'Vordruck SEPA-Lastschriftmandat Schleswig-Holstein, Stand 01/2026',

  felder: [
    // ── Empfänger ───────────────────────────────────────────────────────────
    { key: 'faZeile1', label: 'Finanzamt',              typ: 'text', pflicht: true, breit: true, quelle: 'Stammdaten: Finanzamt', stammdaten: 'finanzamt' },
    { key: 'faZeile2', label: 'Finanzamt – Straße',     typ: 'text', breit: true, quelle: 'Stammdaten: Finanzamt', stammdaten: 'finanzamtStrasse' },
    { key: 'faZeile3', label: 'Finanzamt – PLZ, Ort',   typ: 'text', breit: true, quelle: 'Stammdaten: Finanzamt', stammdaten: 'finanzamtPlzOrt' },

    // ── Kontoinhaber ────────────────────────────────────────────────────────
    { key: 'name',    label: 'Kontoinhaber – Name',            typ: 'text', pflicht: true, breit: true, quelle: 'Stammdaten: Name',      stammdaten: 'name' },
    { key: 'strasse', label: 'Straße und Hausnummer',          typ: 'text', pflicht: true, breit: true, quelle: 'Stammdaten: Anschrift' },
    { key: 'plz',     label: 'Postleitzahl',                   typ: 'text', pflicht: true, quelle: 'Stammdaten: Anschrift' },
    { key: 'ort',     label: 'Ort',                            typ: 'text', pflicht: true, quelle: 'Stammdaten: Anschrift' },
    { key: 'land',    label: 'Land',                           typ: 'text', quelle: 'Vorgabe' },

    // ── Bankverbindung ──────────────────────────────────────────────────────
    { key: 'iban', label: 'IBAN', typ: 'text', pflicht: true, breit: true, merken: true,
      quelle: 'Stammdaten: IBANs/Konten', stammdaten: 'iban',
      hinweis: 'Bitte kein Sparkonto angeben. Leerzeichen dürfen mit eingegeben werden.' },
    { key: 'bic',  label: 'BIC', typ: 'text', merken: true,
      hinweis: 'Nur erforderlich für Banken außerhalb des Europäischen Wirtschaftsraums (EWR).' },
    { key: 'bank', label: 'Name der Bank', typ: 'text', breit: true, merken: true, quelle: 'Stammdaten: IBANs/Konten' },

    // ── Unterschrift Kontoinhaber ───────────────────────────────────────────
    { key: 'unterschriftOrt',    label: 'Ort (Unterschrift)',    typ: 'text', quelle: 'Stammdaten: Anschrift' },
    { key: 'unterschriftDatum',  label: 'Datum der Unterschrift', typ: 'text', platzhalter: 'TT.MM.JJJJ',
      hinweis: 'Pflichtfeld des Vordrucks – Format TT.MM.JJJJ.' },

    // ── Steuernummer / Steuerpflichtiger ────────────────────────────────────
    { key: 'steuernummer',  label: 'Steuernummer', typ: 'text', pflicht: true, breit: true,
      quelle: 'Stammdaten: Steuernummer', stammdaten: 'steuernummer',
      hinweis: 'Grundsatz: je Steuernummer ein eigenes Mandat.' },
    { key: 'nameAbweichend', label: 'Name des/der Steuerpflichtigen (nur falls abweichend vom Kontoinhaber)', typ: 'text', breit: true },

    // ── Umfang des Mandats ──────────────────────────────────────────────────
    {
      key: 'umfang', label: 'Das Lastschriftmandat gilt für', typ: 'radio',
      optionen: [
        { wert: 'alle',      label: 'alle Beträge zur o. a. Steuernummer' },
        { wert: 'bestimmte', label: 'nur die folgenden Steuerarten' },
      ],
    },
    {
      key: 'estKst', label: 'Einkommen-/Körperschaftsteuer', typ: 'radio',
      optionen: [
        { wert: 'keine', label: '— nicht angekreuzt' },
        { wert: 'mit',   label: 'mit Abschlusszahlungen' },
        { wert: 'vz',    label: 'nur Vorauszahlungen' },
      ],
    },
    {
      key: 'ust', label: 'Umsatzsteuer', typ: 'radio',
      optionen: [
        { wert: 'keine', label: '— nicht angekreuzt' },
        { wert: 'mit',   label: 'mit Abschlusszahlungen' },
        { wert: 'vz',    label: 'nur Vorauszahlungen' },
      ],
    },
    { key: 'lst',       label: 'Lohnsteuer',                                              typ: 'check' },
    { key: 'kapst',     label: 'Kapitalertragsteuer und Steuerabzugsbeträge nach § 50a EStG', typ: 'check' },
    { key: 'bauabzug',  label: 'Steuerabzug bei Bauleistungen',                           typ: 'check' },
  ],

  vorbelegen(basis) {
    return {
      faZeile1: basis.finanzamt        || FA_FLENSBURG.name,
      faZeile2: basis.finanzamtStrasse || (basis.finanzamt ? '' : FA_FLENSBURG.strasse),
      faZeile3: basis.finanzamtPlzOrt  || (basis.finanzamt ? '' : FA_FLENSBURG.plzOrt),

      name:    basis.name,
      strasse: basis.strasse,
      plz:     basis.plz,
      ort:     basis.ort,
      land:    'Deutschland',

      iban: basis.iban,
      bic:  '',
      bank: basis.bankName,

      unterschriftOrt:   basis.ort,
      unterschriftDatum: heuteDE(),

      steuernummer:   basis.steuernummer,
      nameAbweichend: '',

      // Der Regelfall in der Praxis: alle Beträge zur Steuernummer
      umfang:   'alle',
      estKst:   'keine',
      ust:      'keine',
      lst:      false,
      kapst:    false,
      bauabzug: false,
    }
  },

  dateiname(w) {
    return `SEPA-Lastschriftmandat_${dateinameSauber(w.name)}.pdf`
  },

  build(w) {
    const doc = neuesDokument()

    // ── Zeichen-Helfer dieses Vordrucks ─────────────────────────────────────
    const setz = (size, fett = false) => doc.setFont('helvetica', fett ? 'bold' : 'normal').setFontSize(size).setTextColor(0)

    const strich = (x1, y, x2, staerke = 0.2) => {
      doc.setDrawColor(0).setLineWidth(staerke).line(x1, y, x2, y)
    }
    const senkrecht = (x, y1, y2, staerke = 0.2) => {
      doc.setDrawColor(0).setLineWidth(staerke).line(x, y1, x, y2)
    }
    const rahmen = (x, y, b, h, staerke = 0.4) => {
      doc.setDrawColor(0).setLineWidth(staerke).rect(x, y, b, h)
    }
    const flaeche = (x, y, b, h, grau = 217) => {
      doc.setFillColor(grau, grau, grau).rect(x, y, b, h, 'F')
    }
    const zeile = (text, x, y, size = S_TEXT, fett = false) => {
      setz(size, fett); doc.text(text, x, y)
    }
    /** Absatz mit fester Zeilenhöhe; gibt die Grundlinie der letzten Zeile zurück. */
    const block = (text, x, y, breite, { size = S_TEXT, lh = 3.25, fett = false } = {}) => {
      setz(size, fett)
      const zeilen = doc.splitTextToSize(text, breite)
      zeilen.forEach((t, i) => doc.text(t, x, y + i * lh))
      return y + (zeilen.length - 1) * lh
    }

    /**
     * Kästchenraster: n Zellen ab x, ein Zeichen je Zelle, zentriert.
     * `hinweis` legt (grau) Platzhalterzeichen in die leeren Zellen – im
     * Original steht so „TTMMJJJJ" im Datumsfeld.
     */
    const kaestchen = (x, y, n, pitch, text, { hoehe = K_H, hinweis = '', size = S_MITTEL } = {}) => {
      doc.setDrawColor(0).setLineWidth(0.2)
      for (let i = 0; i < n; i++) doc.rect(x + i * pitch, y, pitch, hoehe)
      const zeichen = [...txt(text)].slice(0, n)
      const grund = y + hoehe - 1.4
      if (hinweis) {
        setz(size); doc.setTextColor(130)
        ;[...hinweis].slice(0, n).forEach((z, i) => {
          if (zeichen[i]) return
          doc.text(z, x + i * pitch + pitch / 2, grund, { align: 'center' })
        })
        doc.setTextColor(0)
      }
      setz(size)
      zeichen.forEach((z, i) => doc.text(z, x + i * pitch + pitch / 2, grund, { align: 'center' }))
    }

    /** Ankreuzkästchen (3,3 mm) mit optionalem Kreuz. */
    const ankreuz = (x, y, gesetzt) => {
      doc.setDrawColor(0).setLineWidth(0.3).rect(x, y, 3.3, 3.3)
      if (gesetzt) { setz(S_KOPF, true); doc.text('X', x + 0.45, y + 2.85) }
    }

    // ✗ und ■ fehlen in den Standardschriften des PDF-Kerns – beide werden
    // deshalb gezeichnet statt gesetzt.
    /** Unterschriftskreuz (fett, leicht geneigt) mit Grundlinie bei y. */
    const kreuz = (x, y, g = 3.6) => {
      doc.setDrawColor(0).setLineWidth(0.7)
      doc.line(x, y, x + g, y - g)
      doc.line(x, y - g, x + g, y)
    }
    /** Aufzählungsquadrat, Grundlinie bei y. */
    const quadrat = (x, y, g = 1.5) => {
      doc.setFillColor(0, 0, 0).rect(x, y - g, g, g, 'F')
    }

    // Werte aufbereiten
    const ibanRein = txt(w.iban).replace(/\s+/g, '').toUpperCase()
    const bicRein  = txt(w.bic).replace(/\s+/g, '').toUpperCase()
    const stnrRein = txt(w.steuernummer).replace(/\s+/g, '')
    const datumZiffern = deDatum(w.unterschriftDatum).replace(/\D/g, '')   // TTMMJJJJ
    const bestimmte = w.umfang === 'bestimmte'

    // ════════════════════════════════════════════════════════════════════════
    // Seite 1 — der Vordruck
    // ════════════════════════════════════════════════════════════════════════
    setz(S_MITTEL); doc.text('Stand 01/2026', IR, 17.8, { align: 'right' })

    // ── Kopfkasten ──────────────────────────────────────────────────────────
    rahmen(L, 18.5, R - L, 88.7 - 18.5)
    senkrecht(KOPF_X, 18.5, 88.7, 0.4)
    strich(L, 41.1, KOPF_X, 0.4)          // linke Spalte: Stempel | An das Finanzamt
    strich(KOPF_X, 28.6, R, 0.4)          // rechte Spalte: Land | Gläubiger-ID
    strich(KOPF_X, 41.1, R, 0.4)          // rechte Spalte: Gläubiger-ID | Mandat

    zeile('Eingangsstempel', 19.7, 21.7, S_TEXT)
    zeile('An das Finanzamt', 19.7, 60.5, S_TEXT)

    // Zuständiges Finanzamt in den Kasten „An das Finanzamt"
    const faZeilen = [w.faZeile1, w.faZeile2, w.faZeile3].map(txt).filter(Boolean)
    setz(S_MITTEL)
    faZeilen.slice(0, 3).forEach((z, i) => doc.text(z, 19.7, 68.0 + i * 4.6, { maxWidth: KOPF_X - 23 }))

    zeile('gilt nur für das Bundesland', 112.3, 21.7, S_TEXT)
    setz(S_GROSS, true); doc.text('SCHLESWIG-HOLSTEIN', 151.4, 25.9, { align: 'center' })
    zeile('Gläubiger-Identifikationsnummer', 112.3, 32.1, S_MITTEL)
    setz(S_XL, true); doc.text(GLAEUBIGER_ID, 151.4, 38.8, { align: 'center' })

    flaeche(127, 46.4, 49.3, 5)
    setz(S_XL, true); doc.text('SEPA-Lastschriftmandat', 151.6, 50.5, { align: 'center' })

    block(
      'Ich ermächtige/Wir ermächtigen die zuständige Finanzbehörde (Zahlungsempfänger), Zahlungen von '
      + 'meinem/unserem Konto mittels Lastschrift einzuziehen. Zugleich weise ich mein/weisen wir unser '
      + 'Kreditinstitut an, die vom Zahlungsempfänger auf mein/unser Konto gezogenen Lastschriften einzulösen.',
      115.3, 58.9, 76,
    )
    block(
      'Hinweis: Ich kann/Wir können innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die '
      + 'Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem/unserem Kreditinstitut '
      + 'vereinbarten Bedingungen.',
      115.3, 78.3, 76,
    )

    // ── Kontoinhaberin/Kontoinhaber ─────────────────────────────────────────
    rahmen(L, 88.7, R - L, 178.0 - 88.7)
    zeile('Kontoinhaberin/Kontoinhaber', 19.7, 96.3, S_KOPF, true)
    strich(L, 99.2, R, 0.4)

    const label = (text, x, y, size = S_LABEL) => zeile(text, x, y, size)

    // Name
    kaestchen(K_X0, 99.2, K_N, K_P, w.name)
    label('Name', 24, 106.6)

    // Straße und Hausnummer
    kaestchen(K_X0, 108.6, K_N, K_P, w.strasse)
    label('Straße und Hausnummer', 24, 116.1)

    // Postleitzahl | Ort
    kaestchen(K_X0, 118.0, 9, (67.5 - K_X0) / 9, w.plz)
    kaestchen(67.5, 118.0, 26, (IR - 67.5) / 26, w.ort)
    label('Postleitzahl', 24, 125.5)
    label('Ort', 69.4, 125.5)

    // Land
    kaestchen(K_X0, 127.5, K_N, K_P, w.land)
    label('Land', 24, 135.0)

    // IBAN
    kaestchen(K_X0, 136.9, K_N, K_P, ibanRein)
    label('IBAN (International Bank Account Number)', 24, 144.4)
    label('Bitte kein Sparkonto angeben', 90.1, 144.4)

    // BIC | Name der Bank
    kaestchen(K_X0, 146.4, 11, (70 - K_X0) / 11, bicRein)
    kaestchen(70, 146.4, 25, (IR - 70) / 25, w.bank)
    label('BIC', 24, 153.9)
    label('(Business Identifier Code) – Nur erforderlich für', 28.7, 153.9, S_MINI)
    label('Banken außerhalb des Europ. Wirtschaftsraums (EWR)', 24, 157.5, S_MINI)
    label('Name der Bank', 82.5, 155.4)

    // Ort | Datum der Unterschrift
    kaestchen(K_X0, 158.9, 26, (150.1 - K_X0) / 26, w.unterschriftOrt)
    kaestchen(150.1, 158.9, 8, (IR - 150.1) / 8, datumZiffern, { hinweis: 'TTMMJJJJ' })
    label('Ort', 24, 166.4)
    label('Datum der Unterschrift', 152, 166.4)

    // Unterschriftsfeld Kontoinhaber
    kreuz(19.6, 172.9)
    strich(22, 173.3, 165, 0.3)
    label('Unterschrift(en) des/der Kontoinhaber(s)/Kontoinhaberin', 24, 175.8)

    // ── Vereinbarungen ──────────────────────────────────────────────────────
    rahmen(L, 178.0, R - L, 270.1 - 178.0)
    block(
      'Zur Teilnahme am SEPA-Lastschriftverfahren sind die Zustimmung zu folgenden Vereinbarungen und '
      + 'Angaben zur Verwendung erforderlich:',
      19.7, 183.3, 168, { size: S_KOPF, lh: 4.7, fett: true },
    )
    strich(L, 189.4, R, 0.3)

    const punkt = (text, y) => {
      quadrat(20.4, y - 0.6)
      return block(text, 24.7, y, 163.5)
    }
    punkt('Zur Erleichterung des Zahlungsverkehrs beträgt die Frist für die Information vor Einzug einer fälligen '
      + 'Zahlung mindestens einen Tag vor Belastung. Diese Information entfällt beim Einzug fälliger Beträge '
      + 'aufgrund von Steueranmeldungen.', 192.2)
    punkt('Die Mandatsreferenznummer wird im Steuerbescheid, in einem sonstigen Schreiben und/oder im '
      + 'Kontoauszug des Kreditinstituts mitgeteilt.', 199.9)
    strich(L, 203.8, R, 0.3)

    // Steuernummer
    zeile('Steuernummer', 24.5, 207.3, S_TEXT)
    kaestchen(55.2, 203.8, 15, 4.68, stnrRein)
    strich(L, 209.0, R, 0.3)

    zeile('Sofern abweichend von den Angaben zum/zur Kontoinhaber/in:', 24.5, 214.9, S_TEXT)
    kaestchen(K_X0, 215.5, K_N, K_P, w.nameAbweichend)
    label('Name des/der Steuerpflichtigen', 24.5, 223.0)

    // Umfang: alle Beträge
    ankreuz(25.1, 225.0, w.umfang === 'alle')
    zeile('Das Lastschriftmandat gilt für alle unter der o. a. Steuernummer zu entrichtenden Beträge.', 30.1, 227.8, S_TEXT)
    zeile('oder', 30.0, 231.2, S_TEXT)

    // Umfang: nur bestimmte Steuerarten
    flaeche(22.6, 233.1, IR - 22.6, 7.0)
    rahmen(22.6, 233.1, IR - 22.6, 7.0, 0.3)
    ankreuz(25.1, 233.2, bestimmte)
    block('Das Lastschriftmandat gilt nur für die folgenden unter der o. a. Steuernummer zu entrichtenden Beträge '
      + 'einschließlich steuerlicher Nebenleistungen (ausgenommen Zwangsgelder) und Folgesteuern:',
      30.1, 236.0, 157)

    // Tabelle der Steuerarten
    const T_O = 240.2, T_U = 263.4
    const SPALTEN = [22.6, 27.3, 60.1, 105.1, IR]
    const REIHEN  = [240.2, 246.9, 251.1, 255.3, 259.5, 263.4]
    doc.setDrawColor(0).setLineWidth(0.2)
    flaeche(SPALTEN[0], T_O, SPALTEN[1] - SPALTEN[0], T_U - T_O)   // schmale graue Randspalte
    REIHEN.forEach(y => strich(SPALTEN[0], y, IR, 0.2))
    senkrecht(SPALTEN[0], T_O, T_U); senkrecht(SPALTEN[1], T_O, T_U); senkrecht(IR, T_O, T_U)
    senkrecht(SPALTEN[2], REIHEN[0], REIHEN[2])
    senkrecht(SPALTEN[3], REIHEN[0], REIHEN[2])

    // Einkommen-/Körperschaftsteuer (zweizeilig) und Umsatzsteuer
    zeile('Einkommen-',          29.1, 242.9, S_TEXT)
    zeile('/Körperschaftsteuer', 29.1, 246.1, S_TEXT)
    zeile('Umsatzsteuer',        29.1, 249.9, S_TEXT)

    const wahlzeile = (wert, y) => {
      ankreuz(61.9, y - 2.85, wert === 'mit')
      zeile('mit Abschlusszahlungen', 67.7, y, S_TEXT)
      ankreuz(105.2, y - 2.85, wert === 'vz')
      zeile('nur Vorauszahlungen und andere wiederkehrende Zahlungen', 111.0, y, S_TEXT)
    }
    wahlzeile(bestimmte ? w.estKst : 'keine', 244.5)
    wahlzeile(bestimmte ? w.ust    : 'keine', 249.9)

    const einzelzeile = (text, y, gesetzt) => {
      ankreuz(29.1, y - 2.85, gesetzt)
      zeile(text, 34.9, y, S_TEXT)
    }
    einzelzeile('Lohnsteuer',                                              254.1, bestimmte && !!w.lst)
    einzelzeile('Kapitalertragsteuer und Steuerabzugsbeträge nach § 50a EStG', 258.3, bestimmte && !!w.kapst)
    einzelzeile('Steuerabzug bei Bauleistungen',                           262.5, bestimmte && !!w.bauabzug)

    zeile('Das o.a. Konto wird auch für Steuererstattungen verwendet.', 24.5, 266.2, S_TEXT)

    // ── Unterschriften ──────────────────────────────────────────────────────
    strich(L, 270.1, R, 0.3)
    zeile('Unterschrift(en) des/der Steuerpflichtigen und des/der ggf. abweichenden Kontoinhaber(s)/Kontoinhaberin:',
      19.7, 272.7, S_TEXT, true)
    rahmen(L, 270.1, R - L, 287.5 - 270.1)

    kreuz(19.6, 282.8)
    kreuz(98.2, 282.8)
    strich(22.0, 283.2, 100.6, 0.3)
    strich(100.6, 283.2, IR, 0.3)
    label('Unterschrift(en) des/der Steuerpflichtigen', 23.9, 285.5)
    label('Unterschrift(en) des/der abweichenden Kontoinhaber(s)/Kontoinhaberin', 102.5, 285.5)

    // ════════════════════════════════════════════════════════════════════════
    // Seite 2 — Hinweisblatt (Wortlaut des amtlichen Vordrucks)
    // ════════════════════════════════════════════════════════════════════════
    doc.addPage()
    setz(S_MITTEL); doc.text('Stand 01/2026', IR, 14.5, { align: 'right' })
    setz(S_KOPF, true); doc.text('Hinweise zum SEPA-Lastschriftverfahren', 105, 20.5, { align: 'center' })

    const T_L = 20, T_B = 170
    let y = 30

    const p = (text, { fett = false, abstand = 5.5 } = {}) => {
      y = block(text, T_L, y, T_B, { size: S_MITTEL, lh: 4.3, fett }) + abstand
    }

    p('Sehr geehrte Steuerzahlerin, sehr geehrter Steuerzahler,')
    p('Sie können zu entrichtende Steuerbeträge und Abgaben (einschließlich steuerlicher Nebenleistungen '
      + '– ohne Zwangsgelder –) durch Ihr Finanzamt im Lastschriftverfahren von Ihrem Girokonto '
      + '(nicht Sparkonto) abbuchen lassen.')
    p('Dabei können Sie wählen, ob zu Ihrer Veranlagungs-Steuernummer')
    y -= 2.5
    p('– alle Beträge\n– oder nur Vorauszahlungen und andere wiederkehrende Zahlungen\n'
      + '– oder nur bestimmte Steuer- und Abgabearten abgebucht werden sollen.')
    p('Durch die Teilnahme am Lastschriftverfahren können Sie die termingerechten Zahlungen nicht versäumen. '
      + 'Außerdem sparen Sie sich dadurch den Weg zu Ihrem Kreditinstitut und helfen Ihrem Finanzamt, die '
      + 'Verwaltungsaufgaben möglichst Kosten sparend zu erledigen.')
    p('Wenn Sie am Lastschriftverfahren teilnehmen wollen, bitten wir Sie, das SEPA-Lastschriftmandat '
      + 'vollständig auszufüllen.')
    setz(S_KOPF, true); doc.text('Vergessen Sie bitte nicht Ihre Unterschrift bzw. Unterschriften!', 105, y + 1, { align: 'center' })
    y += 9
    p('Anschließend reichen Sie das Formular bei Ihrem zuständigen Finanzamt ein. Es ist möglich, das ausgefüllte '
      + 'unterschriebene SEPA-Lastschriftmandat zu scannen und als PDF-Dokument über den ELSTER-Account als '
      + 'Anhang zu einer Sonstigen Nachricht an das jeweilige Finanzamt zu senden. Eine Übersendung per E-Mail '
      + 'ist nicht möglich. Das Finanzamt veranlasst dann die Abbuchungen der entsprechenden Beträge.')
    p('Weitere Hinweise:', { abstand: 3 })

    const strichpunkt = (text) => {
      quadrat(T_L + 3, y - 0.5, 1.7)
      y = block(text, T_L + 8, y, T_B - 8, { size: S_MITTEL, lh: 4.3 }) + 3.4
    }
    strichpunkt('Grundsatz: Beachten Sie bitte, dass Sie bei mehreren Steuernummern ein Lastschriftmandat zu jeder '
      + 'Steuernummer einreichen müssen, wenn alle Steuern und Abgaben eingezogen werden sollen.')
    strichpunkt('Ausnahme: Ergibt die Auswertung der Fragebögen zur steuerlichen Erfassung die Erteilung von mehr als '
      + 'einer Steuernummer, gilt das Lastschriftmandat für die umseitig gekennzeichneten Steuerarten übergreifend '
      + 'für diese Steuernummern.')
    strichpunkt('Bei einer Zusammenveranlagung sind die Unterschriften beider Ehegatten erforderlich!')
    strichpunkt('Erfolgt eine Änderung der Steuer- oder Abgabenfestsetzung, nachdem die Abbuchung von Ihrem Konto '
      + 'veranlasst wurde, werden überzahlte Beträge von Amts wegen zurückgezahlt.')
    strichpunkt('Sollte einmal ein Betrag zu Unrecht abgebucht werden, können Sie diese Abbuchung innerhalb von acht '
      + 'Wochen stornieren lassen.')
    strichpunkt('Bitte teilen Sie Änderungen Ihrer Bankverbindung umgehend schriftlich Ihrem Finanzamt mit!')
    strichpunkt('Die eingezogenen Beträge werden Ihnen im Kontoauszug bzw. in Abbuchungsmitteilungen mit '
      + 'Steuernummer, Steuer- bzw. Abgabeart und Zeitraum erläutert.')
    strichpunkt('Ihr SEPA-Lastschriftmandat ist generell unbefristet und bis zu Ihrem Widerruf gültig. Dieses wird von '
      + 'der Finanzverwaltung automatisch gelöscht, sofern innerhalb von 36 Monaten seit dem letzten '
      + 'Lastschrifteinzug keine weitere Lastschrift durch die Finanzverwaltung erfolgte.')

    y += 3
    p('Eventuelle Fragen beantworten wir Ihnen gerne.')
    p('Mit freundlichen Grüßen\nIhr Finanzamt')

    return doc
  },
}

export default sepaMandat
