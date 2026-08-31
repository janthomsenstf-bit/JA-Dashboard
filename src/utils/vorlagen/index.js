// ─────────────────────────────────────────────────────────────────────────────
// vorlagen/index.js — Register aller Mandanten-Vorlagen (Vollmachten,
// Einwilligungen, Anträge) + Aufbereitung der Stammdaten für die Vorbelegung.
//
// Neue Vorlage anlegen:
//   1) Datei unter src/utils/vorlagen/<name>.js nach dem Muster von
//      einwilligung87a.js anlegen (id, titel, felder, vorbelegen, build).
//   2) Hier importieren und in VORLAGEN eintragen — fertig, der Reiter
//      „Vorlagen" am Mandanten zeigt sie automatisch an.
// ─────────────────────────────────────────────────────────────────────────────
import { einwilligung87aKoerperschaft } from './einwilligung87a.js'
import { einwilligung87aNatuerlich }    from './einwilligung87aNatuerlich.js'
import { empfangsvollmacht }            from './empfangsvollmacht.js'
import { sepaMandat }                   from './sepaMandat.js'
import { loadKanzlei } from '../ustRegPdf.js'
import { txt } from './pdfKit.js'

export const VORLAGEN = [
  einwilligung87aKoerperschaft,
  einwilligung87aNatuerlich,
  empfangsvollmacht,
  sepaMandat,
]

export function vorlageNachId(id) {
  return VORLAGEN.find(v => v.id === id) || null
}

const KOERPERSCHAFTEN = ['GmbH', 'UG', 'AG', 'gGmbH', 'e.V.', 'Genossenschaft']

/**
 * Zerlegt eine Freitext-Anschrift („Hauptstraße 24a, 24986 Mittelangeln") in
 * Straße / PLZ / Ort. Rückfall, solange die strukturierten Felder am Mandanten
 * nicht gepflegt sind — die Vordrucke brauchen die Teile getrennt.
 */
export function anschriftZerlegen(text) {
  const roh = txt(text)
  if (!roh) return { strasse: '', plz: '', ort: '' }
  const teile = roh.split(',').map(t => t.trim()).filter(Boolean)
  const plzOrtTeil = teile.find(t => /^\d{4,5}\s+\S/.test(t)) ?? ''
  const m = /^(\d{4,5})\s+(.+)$/.exec(plzOrtTeil)
  const strasse = teile.filter(t => t !== plzOrtTeil).join(', ')
  return {
    strasse: strasse || (m ? '' : roh),
    plz: m ? m[1] : '',
    ort: m ? m[2] : '',
  }
}

/**
 * Stammdaten des Mandanten → einheitliche Basis, aus der sich alle Vorlagen
 * bedienen. Liest ausschließlich (verändert nie den Mandanten).
 */
export function stammdatenBasis(client) {
  const c = client || {}
  const kanzlei = loadKanzlei()

  const anschriften = Array.isArray(c.anschriften) ? c.anschriften : []
  const sitz = anschriften.find(a => /sitz|post/i.test(a.typ || '')) || anschriften[0]
  const zerlegt = anschriftZerlegen(sitz?.text)

  const strasse = txt(c.strasse) || zerlegt.strasse
  const plz     = txt(c.plz)     || zerlegt.plz
  const ort     = txt(c.ort)     || zerlegt.ort
  const anschrift = txt(sitz?.text) || [strasse, [plz, ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  const gfListe = (Array.isArray(c.geschaeftsfuehrer) ? c.geschaeftsfuehrer : [])
    .filter(g => txt(g.name))
  const kontakte = Array.isArray(c.kontakte) ? c.kontakte : []
  const gfKontakt = kontakte.find(k => /geschäftsführer|inhaber/i.test(k.rolle || ''))
  const ersterKontaktMitMail = kontakte.find(k => txt(k.email))
  const gf1 = gfListe[0]

  const rechtsform = txt(c.rechtsform)

  // Bankverbindung (Stammdaten-Block „Bankverbindung"): das mit ★ markierte
  // Konto, sonst das erste gepflegte.
  const kontenListe = (Array.isArray(c.ibans) ? c.ibans : []).filter(x => txt(x?.iban))
  const ibanEintrag = kontenListe.find(x => x.sepa === true) ?? kontenListe[0]

  return {
    id:               c.id,
    name:             txt(c.name),
    rechtsform,
    istKoerperschaft: KOERPERSCHAFTEN.some(k => rechtsform.toLowerCase().startsWith(k.toLowerCase())),
    mandantennummer:  txt(c.mandantennummer),

    // Anschrift – zusammengesetzt und in Einzelteilen (Vordrucke brauchen beides)
    anschrift,
    strasse,
    plz,
    ort,
    plzOrt:           [plz, ort].filter(Boolean).join(' '),

    steuernummer:     txt(c.steuernummer),
    steuerIdNr:       txt(c.steuerIdNr),
    ustId:            txt(c.ustId),
    geburtsdatum:     txt(c.geburtsdatum),
    handelsregister:  txt(c.handelsregister),
    unternehmensgegenstand: txt(c.unternehmensgegenstand),
    telefon:          txt(c.telefon) || txt(c.mobil) || txt(kontakte.find(k => txt(k.telefon))?.telefon),

    // Bankverbindung
    iban:             txt(ibanEintrag?.iban),
    bic:              txt(ibanEintrag?.bic),
    bankName:         txt(ibanEintrag?.bez),

    // Zuständiges Finanzamt
    finanzamt:        txt(c.finanzamt),
    finanzamtStrasse: txt(c.finanzamtStrasse),
    finanzamtPlzOrt:  txt(c.finanzamtPlzOrt),

    // Gesetzliche Vertretung
    vertreter:             txt(gf1?.name) || txt(gfKontakt?.name),
    vertreterGeburtsdatum: txt(gf1?.geburtsdatum),
    vertreterAnschrift:    txt(gf1?.anschrift),
    vertreterListe:        gfListe.map(g => ({
      name: txt(g.name), geburtsdatum: txt(g.geburtsdatum), anschrift: txt(g.anschrift),
    })),

    mandantEmail:     txt(gfKontakt?.email) || txt(ersterKontaktMitMail?.email),

    // Kanzlei (Bevollmächtigte)
    kanzleiName:      txt(kanzlei.name),
    kanzleiStrasse:   txt(kanzlei.strasse),
    kanzleiPlzOrt:    txt(kanzlei.plzOrt),
    kanzleiAnschrift: [txt(kanzlei.strasse), txt(kanzlei.plzOrt)].filter(Boolean).join(', '),
    kanzleiEmail:     txt(kanzlei.email),
    kanzleiTelefon:   txt(kanzlei.telefon),
  }
}

/**
 * Werte für eine Vorlage: Vorbelegung aus den Stammdaten, darüber die am
 * Mandanten gemerkten Zusatzangaben (client.vorlagenDaten).
 */
export function werteFuerVorlage(vorlage, client) {
  const basis = stammdatenBasis(client)
  const vorbelegt = vorlage.vorbelegen ? vorlage.vorbelegen(basis) : {}
  const gemerkt = (client?.vorlagenDaten && typeof client.vorlagenDaten === 'object') ? client.vorlagenDaten : {}
  const werte = { ...vorbelegt }
  ;(vorlage.felder || []).forEach(f => {
    // Gemerktes greift nur, wo die Stammdaten (noch) nichts liefern.
    if (f.merken && !txt(werte[f.key]) && txt(gemerkt[f.key])) werte[f.key] = gemerkt[f.key]
  })
  return { basis, werte }
}

/**
 * Leere Werte für „selbst eintragen": Textfelder leer, Auswahl-/Ankreuzfelder
 * behalten die sinnvollen Vorgaben der Vorlage.
 */
export function leereWerte(vorlage, client) {
  const { werte } = werteFuerVorlage(vorlage, client)
  const leer = { ...werte }
  ;(vorlage.felder || []).forEach(f => {
    if (f.typ === 'check' || f.typ === 'radio') return
    leer[f.key] = ''
  })
  return leer
}

// ── Rückweg: im Formular Eingetragenes zurück in die Stammdaten ──────────────
// Ziele, die eine Vorlage über `feld.stammdaten` ansprechen kann.
const ZIEL_LABEL = {
  name:             'Name',
  steuernummer:     'Steuernummer',
  steuerIdNr:       'Steuer-IdNr.',
  geburtsdatum:     'Geburtsdatum',
  telefon:          'Telefon',
  finanzamt:        'Finanzamt',
  finanzamtStrasse: 'Finanzamt – Straße',
  finanzamtPlzOrt:  'Finanzamt – PLZ/Ort',
  anschrift:        'Anschrift (Straße/PLZ/Ort)',
  iban:             'Bankverbindung – IBAN',
  bic:              'Bankverbindung – BIC',
  bankName:         'Bankverbindung – Name der Bank',
  'gf.name':          'Geschäftsführer – Name',
  'gf.geburtsdatum':  'Geschäftsführer – Geburtsdatum',
  'gf.anschrift':     'Geschäftsführer – Anschrift',
}

// Ziele, die auf einen Eintrag in client.ibans schreiben → dessen Feldname
const BANK_FELD = { iban: 'iban', bic: 'bic', bankName: 'bez' }

/**
 * Vergleicht die Formularwerte mit den Stammdaten und liefert die
 * Abweichungen – Grundlage für „In Stammdaten übernehmen" (mit Anzeige,
 * was sich ändern würde; nichts passiert ohne Bestätigung).
 */
export function stammdatenAbweichungen(vorlage, werte, client) {
  const basis = stammdatenBasis(client)
  const gf1 = (Array.isArray(client?.geschaeftsfuehrer) ? client.geschaeftsfuehrer : [])[0] || {}
  const aktuell = {
    name:             basis.name,
    steuernummer:     basis.steuernummer,
    steuerIdNr:       basis.steuerIdNr,
    geburtsdatum:     basis.geburtsdatum,
    telefon:          basis.telefon,
    finanzamt:        basis.finanzamt,
    finanzamtStrasse: basis.finanzamtStrasse,
    finanzamtPlzOrt:  basis.finanzamtPlzOrt,
    anschrift:        basis.anschrift,
    iban:             basis.iban,
    bic:              basis.bic,
    bankName:         basis.bankName,
    'gf.name':          txt(gf1.name),
    'gf.geburtsdatum':  txt(gf1.geburtsdatum),
    'gf.anschrift':     txt(gf1.anschrift),
  }

  // Nur für den Vergleich: eine bloß anders gruppierte IBAN ist keine Änderung.
  const vergleichbar = (ziel, wert) =>
    (ziel === 'iban' || ziel === 'bic') ? txt(wert).replace(/\s+/g, '').toUpperCase() : txt(wert)

  return (vorlage.felder || [])
    .filter(f => f.stammdaten && ZIEL_LABEL[f.stammdaten])
    .map(f => ({ ziel: f.stammdaten, label: ZIEL_LABEL[f.stammdaten], alt: aktuell[f.stammdaten] ?? '', neu: txt(werte[f.key]) }))
    .filter(a => a.neu && vergleichbar(a.ziel, a.neu) !== vergleichbar(a.ziel, a.alt))
}

/**
 * Baut aus den bestätigten Abweichungen einen Patch für onUpdate.
 * Rein additiv: es werden nur die betroffenen Felder gesetzt, Listen
 * (Geschäftsführer, Anschriften) werden kopiert und ergänzt, nie ersetzt.
 */
export function stammdatenPatch(abweichungen, client) {
  const patch = {}
  const gfListe = Array.isArray(client?.geschaeftsfuehrer) ? [...client.geschaeftsfuehrer] : []
  let gfGeaendert = false
  const bank = {}

  const setzeGF = (feld, wert) => {
    const erster = gfListe[0] ?? { id: 'gf' + Date.now().toString(36), name: '' }
    gfListe[0] = { ...erster, [feld]: wert }
    gfGeaendert = true
  }

  abweichungen.forEach(a => {
    if (a.ziel === 'anschrift') {
      const z = anschriftZerlegen(a.neu)
      if (z.strasse) patch.strasse = z.strasse
      if (z.plz)     patch.plz     = z.plz
      if (z.ort)     patch.ort     = z.ort
      // Freitext-Anschrift des Sitzes nachziehen bzw. anlegen
      const anschriften = Array.isArray(client?.anschriften) ? [...client.anschriften] : []
      const idx = anschriften.findIndex(x => /sitz|post/i.test(x.typ || ''))
      if (idx >= 0) anschriften[idx] = { ...anschriften[idx], text: a.neu }
      else anschriften.push({ id: 'an' + Date.now().toString(36), typ: 'post', text: a.neu })
      patch.anschriften = anschriften
      return
    }
    if (BANK_FELD[a.ziel]) { bank[BANK_FELD[a.ziel]] = a.neu; return }
    if (a.ziel.startsWith('gf.')) { setzeGF(a.ziel.slice(3), a.neu); return }
    patch[a.ziel] = a.neu
  })

  if (gfGeaendert) patch.geschaeftsfuehrer = gfListe

  // Bankfelder gehören zu EINEM Konto – deshalb gesammelt und in einem Zug auf
  // den Eintrag geschrieben, aus dem die Vordrucke lesen (★, sonst der erste).
  if (Object.keys(bank).length) {
    const liste = Array.isArray(client?.ibans) ? client.ibans.map(x => ({ ...x })) : []
    const belegt = liste.filter(x => txt(x.iban))
    const ziel = belegt.find(x => x.sepa === true) ?? belegt[0]
    if (ziel) Object.assign(ziel, bank)
    else liste.push({ id: 'ib' + Date.now().toString(36), iban: '', bic: '', bez: '', sepa: true, ...bank })
    patch.ibans = liste
  }

  return patch
}

/** Pflichtfelder, die noch leer sind. */
export function fehlendeFelder(vorlage, werte) {
  return (vorlage.felder || [])
    .filter(f => f.pflicht && !txt(werte[f.key]))
    .map(f => f.label)
}
