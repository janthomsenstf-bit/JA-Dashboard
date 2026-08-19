// ─────────────────────────────────────────────────────────────────────────────
// einwilligung87a.js — Vorlage „Einwilligung in den Versand unverschlüsselter
// E-Mails durch Finanzbehörden gemäß § 87a Abs. 1 Satz 4 Halbsatz 2 AO"
// – für Körperschaften – (Muster AO Nr. 605/244 (01.25) OFD NRW – St 31).
//
// Design und Anordnung sind dem amtlichen Vordruck nachgebildet: Alle y-Werte
// sind aus dem Original-PDF ausgemessen, damit die erzeugte Vorlage optisch
// deckungsgleich ist (gleiche Titelfolge, Hinweiskasten, Feldtabellen,
// Reihenfolge der Ankreuzfelder, zweiseitig mit „Wichtige Hinweise").
// ─────────────────────────────────────────────────────────────────────────────
import {
  neuesDokument, PAGE, SCHRIFT, titel, hinweisKasten, leerKasten, feldTabelle,
  ankreuzZeile, absatz, textKasten, linie, unterschriftsZeile, fusszeile,
  dateinameSauber, txt, deDatum,
} from './pdfKit.js'

const QUELLE = 'AO Nr. 605/244 (01.25) OFD NRW - St 31'

export const einwilligung87aKoerperschaft = {
  id: 'einwilligung-87a-koerperschaft',
  titel: 'Einwilligung E-Mail-Versand (§ 87a AO)',
  untertitel: 'für Körperschaften',
  icon: '📧',
  kategorie: 'Finanzamt',
  beschreibung: 'Einwilligung, dass das Finanzamt unverschlüsselte E-Mails an die Gesellschaft bzw. an die Kanzlei senden darf. Amtliches Muster der OFD NRW, zweiseitig.',
  quelle: QUELLE,

  felder: [
    { key: 'firma',                 label: 'Firma',                              typ: 'text', pflicht: true, breit: true, quelle: 'Stammdaten: Name',           stammdaten: 'name' },
    { key: 'anschrift',             label: 'Anschrift',                          typ: 'text', pflicht: true, breit: true, quelle: 'Stammdaten: Anschrift',      stammdaten: 'anschrift' },
    { key: 'steuernummer',          label: 'Steuernummer',                       typ: 'text', pflicht: true, quelle: 'Stammdaten: Steuernummer',                stammdaten: 'steuernummer' },
    { key: 'vertreterName',         label: 'Gesetzl. Vertreter – Name, Vorname', typ: 'text', pflicht: true, quelle: 'Stammdaten: Geschäftsführer',             stammdaten: 'gf.name' },
    { key: 'vertreterGeburtsdatum', label: 'Geburtsdatum des Vertreters',        typ: 'text', platzhalter: 'TT.MM.JJJJ', quelle: 'Stammdaten: Geschäftsführer', stammdaten: 'gf.geburtsdatum', merken: true },
    { key: 'vertreterAnschrift',    label: 'Privatanschrift des Vertreters',     typ: 'text', breit: true, quelle: 'Stammdaten: Geschäftsführer',               stammdaten: 'gf.anschrift',    merken: true },
    { key: 'vertretungBekannt',     label: 'Gesetzliche Vertretung und deren Umfang sind dem Finanzamt bereits bekannt', typ: 'check' },
    { key: 'nachweisBeiliegend',    label: 'Ein Nachweis der gesetzlichen Vertretung liegt bei',                        typ: 'check' },
    { key: 'email',                 label: 'E-Mail-Adresse',                     typ: 'text', pflicht: true, breit: true, quelle: 'Kanzlei bzw. Stammdaten' },
    { key: 'emailIstBevoll',        label: 'Es ist die E-Mail-Adresse der/des steuerlichen Bevollmächtigten',           typ: 'check' },
    {
      key: 'umfang', label: 'Umfang der Einwilligung', typ: 'radio',
      optionen: [
        { wert: 'gesamt', label: 'gesamte elektronisch zulässige Kommunikation' },
        { wert: 'nur',    label: 'nur auf …' },
      ],
    },
    { key: 'umfangText', label: 'Beschränkt auf', typ: 'text', breit: true, platzhalter: 'z. B. Betriebsprüfung', zeigenWenn: w => w.umfang === 'nur' },
  ],

  /** Vorbelegung aus den Stammdaten des Mandanten. */
  vorbelegen(basis) {
    return {
      firma:                 basis.name,
      anschrift:             basis.anschrift,
      steuernummer:          basis.steuernummer,
      vertreterName:         basis.vertreter,
      vertreterGeburtsdatum: basis.vertreterGeburtsdatum,
      vertreterAnschrift:    basis.vertreterAnschrift,
      vertretungBekannt:     true,
      nachweisBeiliegend:    false,
      email:                 basis.kanzleiEmail,
      emailIstBevoll:        true,
      umfang:                'gesamt',
      umfangText:            '',
    }
  },

  /** Nur für Körperschaften – bei anderen Rechtsformen zeigt der Reiter einen Hinweis. */
  passtZu(basis) {
    return basis.istKoerperschaft
  },

  dateiname(w) {
    return `Einwilligung_87a_E-Mail_${dateinameSauber(w.firma)}.pdf`
  },

  build(w) {
    const doc = neuesDokument()

    // ── Seite 1 ── (alle y-Werte 1:1 aus dem amtlichen Vordruck) ─────────────
    titel(doc, [
      'Einwilligung in den Versand unverschlüsselter E-Mails durch Finanzbehörden',
      'gemäß § 87a Abs. 1 Satz 4 Halbsatz 2 der Abgabenordnung (AO)',
      '- für Körperschaften -',
    ], 18.5)

    hinweisKasten(doc, [
      'Bitte beachten Sie unbedingt die Hinweise auf der zweiten Seite dieses Formulars.',
      'Füllen Sie die Felder bitte leserlich aus. Kreuzen Sie bitte Zutreffendes an.',
    ], 41.0)

    // Adressfeld des Finanzamts – bleibt bewusst leer (wird vor Ort ergänzt)
    leerKasten(doc, 55.8, { breite: 110.3, hoehe: 24.2 })

    feldTabelle(doc, [
      ['Firma:',        txt(w.firma)],
      ['Anschrift:',    txt(w.anschrift)],
      ['Steuernummer:', txt(w.steuernummer)],
    ], 85.6)

    feldTabelle(doc, [
      ['Gesetzlich vertreten durch'],
      ['Name, Vorname:', txt(w.vertreterName)],
      ['Geburtsdatum:',  deDatum(w.vertreterGeburtsdatum)],
      ['Anschrift:',     txt(w.vertreterAnschrift)],
    ], 114.0)

    ankreuzZeile(doc, 'Die gesetzliche Vertretung und deren Umfang sind dem zuständigen Finanzamt bereits bekannt.', 148.5, { gesetzt: !!w.vertretungBekannt })
    ankreuzZeile(doc, 'Ein Nachweis der gesetzlichen Vertretung liegt bei.', 160.7, { gesetzt: !!w.nachweisBeiliegend })

    absatz(doc, 'Als gesetzlicher Vertreter der o. g. Firma bitte ich Sie, den zukünftigen Informationsaustausch über folgende E-Mail-Adresse zu führen:', 168.0)

    feldTabelle(doc, [['E-Mail-Adresse:', txt(w.email)]], 176.3)

    ankreuzZeile(doc, 'Es handelt sich um die E-Mail-Adresse der/des steuerlichen Bevollmächtigten der o. g. Firma', 191.6, { gesetzt: !!w.emailIstBevoll })

    absatz(doc, 'Die Überwachung des E-Mail-Postfachs auf Mitteilungen des Finanzamtes liegt in meiner Verantwortung.', 206.2)

    fusszeile(doc, {
      links: ['Einwilligung gemäß § 87a Absatz 1 Satz 4', QUELLE],
      rechts: 'Seite 1 von 2',
    })

    // ── Seite 2 ───────────────────────────────────────────────────────────────
    doc.addPage()

    textKasten(doc, {
      ueberschrift: 'Wichtige Hinweise',
      absaetze: [
        'Das Finanzamt darf nur dann unverschlüsselte E-Mails mit geschützten Daten versenden, wenn die betroffene Person ausdrücklich in die unverschlüsselte Datenübermittlung eingewilligt und einer mit diesem Kommunikationsweg möglicherweise verbundenen Offenbarung ihrer steuerlichen Verhältnisse zugestimmt hat (§ 30 Absatz 4 Nr. 3 und § 87a Absatz 1 Satz 4 Halbsatz 2 AO, Artikel 6 Absatz 1 der Datenschutz-Grundverordnung - DSGVO -).',
        'Möchten Sie, dass das Finanzamt Ihnen oder der von Ihnen bevollmächtigten Person unverschlüsselte E-Mails übersendet, unterschreiben Sie bitte eigenhändig den vollständig ausgefüllten Vordruck und senden ihn per Post an das Finanzamt. Sie können ihn auch einscannen und die pdf-Datei als Anhang möglichst über das Kontaktformular an Ihr zuständiges Finanzamt schicken. Das Kontaktformular finden Sie auf der Seite Ihres Finanzamtes unter „Kontakt". Ihr zuständiges Finanzamt finden Sie unter https://www.finanzamt.nrw.de/mein-finanzamt. Achten Sie bitte darauf, dass Ihre Unterschrift sichtbar ist. Jede Person, deren Daten unverschlüsselt übermittelt werden sollen, muss zuvor eine eigene schriftliche Einwilligungserklärung nach diesem Muster abgeben. Dies betrifft insbesondere zusammenveranlagte Personen, d. h. Ehegatten oder Lebenspartner und Lebenspartnerinnen.',
        'Diese Einwilligung begründet keinen Anspruch auf unverschlüsselte Kommunikation per E-Mail. Das Finanzamt behält sich vor, auf andere Weise mit Ihnen zu kommunizieren (z. B. per Post), etwa wenn die Kommunikation per E-Mail aus rechtlichen oder technischen Gründen nicht möglich sein sollte. Insbesondere ist die Bekanntgabe von Steuerbescheiden mittels unverschlüsselter E-Mail nicht zulässig.',
        'Zur elektronischen Kommunikation mit dem Finanzamt beachten Sie bitte auch die Hinweise im Internet unter: https://www.finanzamt.nrw.de/einwilligung-e-mailkommunikation. Steuererklärungen können nicht über das o. g. Kontaktformular oder per E-Mail an das Finanzamt übermittelt werden. Hierfür steht Ihnen das Portal ELSTER zur Verfügung. ELSTER bietet neben der Einreichung von Steuererklärungen auch die Möglichkeit, Anträge, Einsprüche und sonstige Nachrichten sicher an das Finanzamt zu übermitteln.',
      ],
    }, 13.1)

    absatz(doc, 'In Kenntnis aller Hinweise willige ich darin ein, dass das Finanzamt mir oder der von mir bevollmächtigten Person geschützte Daten per unverschlüsselter E-Mail übermitteln darf. Die Einwilligung erstreckt sich auf', 173.0)

    ankreuzZeile(doc, 'die gesamte elektronisch zulässige Kommunikation oder', 190.0, { gesetzt: w.umfang === 'gesamt' })
    ankreuzZeile(doc, 'nur auf', 197.3, { gesetzt: w.umfang === 'nur' })

    // Ausfülllinie für die Beschränkung + Beispielhinweis (mittig wie im Muster)
    if (w.umfang === 'nur' && txt(w.umfangText)) {
      doc.setFontSize(SCHRIFT.text).text(txt(w.umfangText), PAGE.L + 2, 205.2)
    }
    linie(doc, 206.8)
    doc.setFontSize(SCHRIFT.klein).setTextColor(0)
    doc.text('(Beispiele: Betriebsprüfung, Lohnsteuer-Außenprüfung, Umsatzsteuer-Sonderprüfung)', PAGE.CX, 210.6, { align: 'center' })
    doc.setFontSize(SCHRIFT.text)

    absatz(doc, 'Mir ist bekannt, dass eine unverschlüsselte elektronische Kommunikation nicht sicher ist und eventuell durch Dritte eingesehen und manipuliert werden kann. Die Möglichkeit, dass dadurch meine steuerlichen Sachverhalte der von mir vertretenen Firma unbefugten Dritten bekannt werden, nehme ich in Kauf.', 220.0)

    absatz(doc, 'Diese Einwilligung kann ich jederzeit schriftlich (Brief, Fax), per E-Mail oder durch persönlichen Vortrag im Finanzamt widerrufen. Der Widerruf wird erst ab dem Zeitpunkt wirksam, in dem er dem Finanzamt zugeht.', 242.0)

    unterschriftsZeile(doc, 264.6, {
      linksLabel: '(Ort, Datum)',
      rechtsLabel: 'Unterschrift 1)',
      zusatz: txt(w.vertreterName),
    })

    linie(doc, 280.0, { bis: PAGE.L + 51, staerke: 0.3 })
    doc.setFontSize(SCHRIFT.klein).setTextColor(0)
    doc.text('1   Bei Körperschaften ist die Einwilligung vom gesetzlichen Vertreter zu unterschreiben.', PAGE.L, 286.3)
    doc.setFontSize(SCHRIFT.text)

    fusszeile(doc, { rechts: 'Seite 2 von 2' })

    return doc
  },
}

export default einwilligung87aKoerperschaft
