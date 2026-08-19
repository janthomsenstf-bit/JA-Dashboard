// ─────────────────────────────────────────────────────────────────────────────
// einwilligung87aNatuerlich.js — Vorlage „Einwilligung in den Versand
// unverschlüsselter E-Mails durch Finanzbehörden gemäß § 87a Abs. 1 Satz 4
// Halbsatz 2 AO" – für Bürgerinnen und Bürger –
// (Muster Nr. 605/244 (01.25) OFD NRW – St 31).
//
// Wie die Körperschafts-Variante: alle y-Werte sind aus dem amtlichen Vordruck
// ausgemessen. Unterschiede zum Körperschafts-Formular: fünfzeilige Personen-
// tabelle (mit Geburtsdatum und Identifikationsnummer), kursiver Zwischen-
// hinweis, Vertretungsblock nur für nicht/beschränkt geschäftsfähige Personen.
// ─────────────────────────────────────────────────────────────────────────────
import {
  neuesDokument, PAGE, SCHRIFT, titel, hinweisKasten, leerKasten, feldTabelle,
  ankreuzZeile, absatz, textKasten, linie, unterschriftsZeile, fusszeile,
  dateinameSauber, txt, deDatum,
} from './pdfKit.js'
import {
  HINWEISE_87A, WIDERRUF_87A, EINWILLIGUNG_EINLEITUNG_87A, BEISPIELE_87A,
  HINWEISKASTEN_KOPF_87A, TITEL_87A,
} from './texte87a.js'

const QUELLE = 'Nr. 605/244 (01.25) OFD NRW - St 31'

export const einwilligung87aNatuerlich = {
  id: 'einwilligung-87a-natuerlich',
  titel: 'Einwilligung E-Mail-Versand (§ 87a AO)',
  untertitel: 'für Bürgerinnen und Bürger',
  icon: '📧',
  kategorie: 'Finanzamt',
  beschreibung: 'Einwilligung, dass das Finanzamt unverschlüsselte E-Mails an die Person bzw. an die Kanzlei senden darf. Amtliches Muster der OFD NRW, zweiseitig.',
  quelle: QUELLE,

  felder: [
    { key: 'finanzamtBlock',        label: 'Finanzamt (Adressfeld)',       typ: 'text', breit: true, platzhalter: 'Name, Straße, PLZ Ort', quelle: 'Stammdaten: Finanzamt' },
    { key: 'nameVorname',           label: 'Name, Vorname',                typ: 'text', pflicht: true, breit: true, quelle: 'Stammdaten: Name',           stammdaten: 'name' },
    { key: 'anschrift',             label: 'Anschrift',                    typ: 'text', pflicht: true, breit: true, quelle: 'Stammdaten: Anschrift',      stammdaten: 'anschrift' },
    { key: 'steuernummer',          label: 'Steuernummer',                 typ: 'text', pflicht: true, quelle: 'Stammdaten: Steuernummer',                stammdaten: 'steuernummer' },
    { key: 'geburtsdatum',          label: 'Geburtsdatum',                 typ: 'text', platzhalter: 'TT.MM.JJJJ', quelle: 'Stammdaten: Geburtsdatum',    stammdaten: 'geburtsdatum' },
    { key: 'identifikationsnummer', label: 'Identifikationsnummer',        typ: 'text', quelle: 'Stammdaten: Steuer-IdNr.',                               stammdaten: 'steuerIdNr' },

    { key: 'vertreterName',         label: 'Gesetzl. Vertretung – Name, Vorname', typ: 'text', hinweis: 'nur bei nicht/beschränkt geschäftsfähigen Personen' },
    { key: 'vertreterGeburtsdatum', label: 'Gesetzl. Vertretung – Geburtsdatum',  typ: 'text', platzhalter: 'TT.MM.JJJJ' },
    { key: 'vertreterAnschrift',    label: 'Gesetzl. Vertretung – Anschrift',     typ: 'text', breit: true },
    { key: 'vertretungBekannt',     label: 'Gesetzliche Vertretung und deren Umfang sind dem Finanzamt bereits bekannt', typ: 'check' },
    { key: 'nachweisBeiliegend',    label: 'Nachweis der gesetzlichen Vertretung (ggf. Reichweite der Betreuung) liegt bei', typ: 'check' },

    { key: 'email',                 label: 'E-Mail-Adresse',               typ: 'text', pflicht: true, breit: true, quelle: 'Kanzlei bzw. Stammdaten' },
    { key: 'emailIstBevoll',        label: 'Es ist die E-Mail-Adresse der Vertretung / der bevollmächtigten Kanzlei', typ: 'check' },
    {
      key: 'umfang', label: 'Umfang der Einwilligung', typ: 'radio',
      optionen: [
        { wert: 'gesamt', label: 'gesamte elektronisch zulässige Kommunikation' },
        { wert: 'nur',    label: 'nur auf …' },
      ],
    },
    { key: 'umfangText', label: 'Beschränkt auf', typ: 'text', breit: true, platzhalter: 'z. B. Betriebsprüfung', zeigenWenn: w => w.umfang === 'nur' },
  ],

  vorbelegen(basis) {
    return {
      finanzamtBlock:        [basis.finanzamt, basis.finanzamtStrasse, basis.finanzamtPlzOrt].filter(Boolean).join(', '),
      nameVorname:           basis.name,
      anschrift:             basis.anschrift,
      steuernummer:          basis.steuernummer,
      geburtsdatum:          basis.geburtsdatum,
      identifikationsnummer: basis.steuerIdNr,
      vertreterName:         '',
      vertreterGeburtsdatum: '',
      vertreterAnschrift:    '',
      vertretungBekannt:     false,
      nachweisBeiliegend:    false,
      email:                 basis.kanzleiEmail,
      emailIstBevoll:        true,
      umfang:                'gesamt',
      umfangText:            '',
    }
  },

  /** Für natürliche Personen – bei Körperschaften weist der Reiter darauf hin. */
  passtZu(basis) {
    return !basis.istKoerperschaft
  },

  dateiname(w) {
    return `Einwilligung_87a_E-Mail_${dateinameSauber(w.nameVorname)}.pdf`
  },

  build(w) {
    const doc = neuesDokument()

    // ── Seite 1 ── (alle y-Werte 1:1 aus dem amtlichen Vordruck) ─────────────
    titel(doc, [...TITEL_87A, '- für Bürgerinnen und Bürger -'], 18.5)

    hinweisKasten(doc, HINWEISKASTEN_KOPF_87A, 41.0)

    leerKasten(doc, 55.8, {
      breite: 110.3, hoehe: 24.2,
      zeilen: txt(w.finanzamtBlock).split(',').map(s => s.trim()).filter(Boolean),
    })

    feldTabelle(doc, [
      ['Name, Vorname:',         txt(w.nameVorname)],
      ['Anschrift:',             txt(w.anschrift)],
      ['Steuernummer:',          txt(w.steuernummer)],
      ['Geburtsdatum:',          deDatum(w.geburtsdatum)],
      ['Identifikationsnummer¹:', txt(w.identifikationsnummer)],
    ], 85.6)

    // Kursiver Zwischenhinweis über dem Vertretungsblock
    doc.setFont('helvetica', 'italic').setFontSize(11).setTextColor(0)
    doc.text('Bei nicht geschäftsfähigen bzw. beschränkt geschäftsfähigen natürlichen Personen:', PAGE.CX, 123.6, { align: 'center' })
    doc.setFont('helvetica', 'normal')

    feldTabelle(doc, [
      ['Gesetzlich vertreten durch'],
      ['Name, Vorname:', txt(w.vertreterName)],
      ['Geburtsdatum:',  deDatum(w.vertreterGeburtsdatum)],
      ['Anschrift:',     txt(w.vertreterAnschrift)],
    ], 126.7)

    ankreuzZeile(doc, 'Die gesetzliche Vertretung und deren Umfang sind dem zuständigen Finanzamt bereits bekannt.', 161.4, { gesetzt: !!w.vertretungBekannt })
    ankreuzZeile(doc, 'Ein Nachweis der gesetzlichen Vertretung und – im Fall einer Betreuung – ihre Reichweite liegt bei.', 173.6, { gesetzt: !!w.nachweisBeiliegend })

    absatz(doc, 'Bitte führen Sie den zukünftigen Informationsaustausch über folgende E-Mail-Adresse:', 188.2)

    feldTabelle(doc, [['E-Mail-Adresse:', txt(w.email)]], 191.6)

    ankreuzZeile(doc, 'Es handelt sich um die E-Mail-Adresse meiner Vertreterin/meines Vertreters meiner/meines Bevollmächtigten', 207.0, { gesetzt: !!w.emailIstBevoll })

    absatz(doc, 'Die Überwachung des E-Mail-Postfachs auf Mitteilungen des Finanzamtes liegt in meiner Verantwortung.', 221.6)

    // Fußnote 1) zur Identifikationsnummer
    linie(doc, 271.5, { bis: PAGE.L + 51, staerke: 0.3 })
    doc.setFontSize(SCHRIFT.klein).setTextColor(0)
    doc.text('1', PAGE.L, 276.1)
    doc.text(doc.splitTextToSize('Die Ihnen vom Bundeszentralamt für Steuern mitgeteilte Identifikationsnummer nach § 139b AO finden Sie auch auf dem Einkommensteuerbescheid.', PAGE.TEXT_R - (PAGE.L + 5)), PAGE.L + 5, 277.2)
    doc.setFontSize(SCHRIFT.text)

    fusszeile(doc, {
      links: ['Einwilligung gemäß § 87a Absatz 1 Satz 4 AO', QUELLE],
      rechts: 'Seite 1 von 2',
    })

    // ── Seite 2 ───────────────────────────────────────────────────────────────
    doc.addPage()

    textKasten(doc, { ueberschrift: 'Wichtige Hinweise', absaetze: HINWEISE_87A }, 13.1)

    absatz(doc, EINWILLIGUNG_EINLEITUNG_87A, 173.0)

    ankreuzZeile(doc, 'die gesamte elektronisch zulässige Kommunikation oder', 192.4, { gesetzt: w.umfang === 'gesamt' })
    ankreuzZeile(doc, 'nur auf', 199.8, { gesetzt: w.umfang === 'nur' })

    if (w.umfang === 'nur' && txt(w.umfangText)) {
      doc.setFontSize(SCHRIFT.text).text(txt(w.umfangText), PAGE.L + 2, 206.0)
    }
    linie(doc, 207.6)
    doc.setFontSize(SCHRIFT.klein).setTextColor(0)
    doc.text(BEISPIELE_87A, PAGE.CX, 211.4, { align: 'center' })
    doc.setFontSize(SCHRIFT.text)

    absatz(doc, 'Mir ist bekannt, dass eine unverschlüsselte elektronische Kommunikation nicht sicher ist und eventuell durch Dritte eingesehen und manipuliert werden kann. Die Möglichkeit, dass dadurch meine steuerlichen Sachverhalte unbefugten Dritten bekannt werden, nehme ich in Kauf.', 220.0)

    absatz(doc, WIDERRUF_87A, 242.8)

    unterschriftsZeile(doc, 263.6, {
      linksLabel: '(Ort, Datum)',
      rechtsLabel: 'Unterschrift 2)',
      rechtsVon: 112,
      zusatz: txt(w.vertreterName) || txt(w.nameVorname),
    })

    linie(doc, 276.0, { bis: PAGE.L + 51, staerke: 0.3 })
    doc.setFontSize(SCHRIFT.klein).setTextColor(0)
    doc.text('2', PAGE.L, 282.1)
    doc.text(doc.splitTextToSize('Bei nicht geschäftsfähigen bzw. beschränkt geschäftsfähigen natürlichen Personen ist die Einwilligung von der gesetzlichen Vertretung zu unterschreiben.', PAGE.TEXT_R - (PAGE.L + 5)), PAGE.L + 5, 283.1)
    doc.setFontSize(SCHRIFT.text)

    fusszeile(doc, { rechts: 'Seite 2 von 2' })

    return doc
  },
}

export default einwilligung87aNatuerlich
