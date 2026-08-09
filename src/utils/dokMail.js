/**
 * dokMail.js – Mail-Entwurf für den Post-Service (Stufe 5)
 *
 * Erzeugt einen DETERMINISTISCHEN Mail-Entwurf aus festen Vorlagen je
 * Dokumenttyp. Es wird NICHTS von einer KI generiert und nichts erfunden –
 * eingesetzt werden nur erkannte Fakten (Typ, Datum) und Stammdaten
 * (Empfänger). Damit gilt: keine Halluzination, §203-unkritisch (kein
 * Dokumentinhalt verlässt das Gerät).
 *
 * Sprachregelung (Konzept): DE-Mandant → nur deutsch. DA-Mandant → deutsch,
 * darunter Trennlinie „Freie Übersetzung / Fri oversættelse", darunter dänisch.
 *
 * Die dänischen Bausteine sind vom Assistenten formuliert und sollten vom
 * Steuerberater einmal gegengelesen/freigegeben werden.
 *
 * Reiner Entwurf – KEIN Versand (der ist Stufe 6). Alle Funktionen sind pur.
 */

const ANREDE = {
  de: 'Sehr geehrte Damen und Herren,',
  da: 'Til rette vedkommende,',
}
const GRUSS = {
  de: 'Mit freundlichen Grüßen',
  da: 'Med venlig hilsen',
}
const TRENNLINIE = '— Freie Übersetzung / Fri oversættelse —'

// Je Dokumenttyp: Betreff-Basis + Kernsatz, jeweils deutsch und dänisch.
const VORLAGEN = {
  Steuerbescheid: {
    betreff: { de: 'Ihr Steuerbescheid',        da: 'Din skatteopgørelse' },
    kern: {
      de: 'anbei erhalten Sie einen Steuerbescheid, der bei uns für Sie eingegangen ist. Bitte prüfen Sie ihn. Für eine Einspruchsprüfung oder bei Fragen melden Sie sich bitte kurzfristig, da Fristen zu beachten sind.',
      da: 'vedhæftet finder du en skatteopgørelse, som vi har modtaget for dig. Kontrollér den venligst. Kontakt os gerne hurtigt ved spørgsmål eller for en vurdering af en eventuel klage, da der er frister at overholde.',
    },
  },
  Umsatzsteuer: {
    betreff: { de: 'Umsatzsteuer',               da: 'Moms' },
    kern: {
      de: 'anbei ein Dokument zur Umsatzsteuer, das bei uns für Sie eingegangen ist. Bitte prüfen Sie es und geben Sie uns Bescheid, falls etwas zu veranlassen ist.',
      da: 'vedhæftet et dokument vedrørende moms, som vi har modtaget for dig. Kontrollér det venligst, og giv os besked, hvis der skal foretages noget.',
    },
  },
  Rechnung: {
    betreff: { de: 'Rechnung',                   da: 'Faktura' },
    kern: {
      de: 'anbei erhalten Sie eine Rechnung, die bei uns für Sie eingegangen ist. Bitte prüfen Sie diese und veranlassen Sie gegebenenfalls die Zahlung.',
      da: 'vedhæftet finder du en faktura, som vi har modtaget for dig. Kontrollér den venligst, og sørg eventuelt for betaling.',
    },
  },
  Kontoauszug: {
    betreff: { de: 'Kontoauszug',                da: 'Kontoudtog' },
    kern: {
      de: 'anbei ein Kontoauszug, der bei uns für Sie eingegangen ist. Bitte nehmen Sie ihn zur Buchhaltung.',
      da: 'vedhæftet et kontoudtog, som vi har modtaget for dig. Medtag det venligst i bogføringen.',
    },
  },
  Mahnung: {
    betreff: { de: 'Mahnung',                    da: 'Rykker' },
    kern: {
      de: 'anbei eine Mahnung, die bei uns für Sie eingegangen ist. Bitte prüfen Sie den Vorgang zeitnah, um weitere Kosten zu vermeiden.',
      da: 'vedhæftet en rykker, som vi har modtaget for dig. Gennemgå venligst sagen hurtigt for at undgå yderligere omkostninger.',
    },
  },
  Vertrag: {
    betreff: { de: 'Vertrag / Schriftstück',     da: 'Kontrakt / dokument' },
    kern: {
      de: 'anbei ein Vertrag bzw. Schriftstück, das bei uns für Sie eingegangen ist – zur Kenntnis und gegebenenfalls zur Prüfung.',
      da: 'vedhæftet en kontrakt/et dokument, som vi har modtaget for dig – til orientering og eventuel gennemgang.',
    },
  },
  Lohnabrechnung: {
    betreff: { de: 'Lohnunterlagen',             da: 'Lønbilag' },
    kern: {
      de: 'anbei Lohnunterlagen, die bei uns für Sie eingegangen sind – zur Kenntnis.',
      da: 'vedhæftet lønbilag, som vi har modtaget for dig – til orientering.',
    },
  },
  Unbekannt: {
    betreff: { de: 'Ihre Unterlagen',            da: 'Dine bilag' },
    kern: {
      de: 'anbei ein Dokument, das bei uns für Sie eingegangen ist. Bitte prüfen Sie, ob etwas zu veranlassen ist.',
      da: 'vedhæftet et dokument, som vi har modtaget for dig. Kontrollér venligst, om der skal foretages noget.',
    },
  },
}

/** Ersten Kontakt mit E-Mail-Adresse finden (Ansprechpartner). */
function ersteEmail(client) {
  const k = (Array.isArray(client?.kontakte) ? client.kontakte : []).find(x => x?.email)
  return k?.email ?? ''
}

/** Einen einsprachigen Block „Anrede / Kern / Gruß" bauen. */
function block(sprache, kern) {
  return `${ANREDE[sprache]}\n\n${kern}\n\n${GRUSS[sprache]}`
}

/**
 * Baut den Mail-Entwurf.
 * @param {object} ergebnis     – Erkennungsergebnis (nutzt typ, kennungen)
 * @param {object|null} client  – gewählter Mandant (Empfänger, Sprache)
 * @param {string} dateiname    – vorgeschlagener Anhang-Dateiname
 * @returns {{ empfaenger, betreff, text, anhang, sprache, warnungen: string[] }}
 */
export function baueMailEntwurf(ergebnis, client, dateiname = '') {
  const typ = ergebnis?.typ?.typ && VORLAGEN[ergebnis.typ.typ] ? ergebnis.typ.typ : 'Unbekannt'
  const v = VORLAGEN[typ]
  const sprache = client?.korrespondenzsprache === 'da' ? 'da' : 'de'
  const datum = ergebnis?.kennungen?.datumse?.[0] ?? ''

  const betreffTeil = s => `${v.betreff[s]}${datum ? ` (${datum})` : ''}`
  const betreff = sprache === 'da'
    ? `${betreffTeil('de')} / ${betreffTeil('da')}`
    : betreffTeil('de')

  const text = sprache === 'da'
    ? `${block('de', v.kern.de)}\n\n${TRENNLINIE}\n\n${block('da', v.kern.da)}`
    : block('de', v.kern.de)

  const empfaenger = ersteEmail(client)
  const warnungen = []
  if (!empfaenger) warnungen.push('Keine E-Mail-Adresse beim Mandanten hinterlegt – bitte ergänzen.')

  return { empfaenger, betreff, text, anhang: dateiname, sprache, warnungen }
}
