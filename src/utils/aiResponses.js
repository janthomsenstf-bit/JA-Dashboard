import { calculateProgress, getFACountdown } from './progress.js'

function fmt(d) {
  if (!d) return 'nicht gesetzt'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

/** Generates automatic KI-Hinweise based on client status */
export function getAutoHints(client) {
  const hints = []
  const openQ = client.rueckfragen.filter(r => !r.beantwortet)

  if (openQ.length > 0) {
    hints.push({
      icon: '⚠️',
      text: `${openQ.length} offene Rückfrage${openQ.length > 1 ? 'n' : ''} ausstehend – Kontaktaufnahme mit dem Mandanten empfohlen.`,
    })
  }

  if (client.rueckfragen.length === 0 || client.rueckfragen.every(r => r.beantwortet)) {
    if (!client.steGesendetDatum) {
      hints.push({
        icon: '📤',
        text: 'Alle Rückfragen beantwortet – Steuererklärung kann jetzt erstellt und versandt werden.',
      })
    }
  }

  if (client.steGesendetDatum && !client.unterschriftDatum) {
    hints.push({
      icon: '✍️',
      text: `Steuererklärung wurde am ${fmt(client.steGesendetDatum)} versendet. Unterschrift / Vollständigkeitserklärung steht noch aus.`,
    })
  }

  if (client.unterschriftDatum && !client.faGeplantDatum) {
    hints.push({
      icon: '📅',
      text: 'Unterschrift erhalten – FA-Übermittlungsdatum noch nicht geplant. Bitte Termin festlegen.',
    })
  }

  if (client.faGeplantDatum && !client.faUebermittelt) {
    const cd = getFACountdown(client.faGeplantDatum)
    if (cd.type === 'overdue') {
      hints.push({
        icon: '🚨',
        text: `FA-Übermittlung ist ${cd.label}! Bitte umgehend einreichen oder Fristverlängerung beantragen.`,
      })
    } else if (cd.type === 'today') {
      hints.push({
        icon: '🔔',
        text: 'FA-Übermittlung ist heute fällig! Bitte noch heute einreichen.',
      })
    } else if (cd.type === 'future') {
      const days = parseInt(cd.label.match(/\d+/)?.[0] || '0')
      if (days <= 3) {
        hints.push({
          icon: '⏰',
          text: `FA-Übermittlung ist in ${days} Tag${days === 1 ? '' : 'en'} fällig – Vorbereitungen abschließen.`,
        })
      }
    }
  }

  if (client.faUebermittelt) {
    hints.push({
      icon: '✅',
      text: `Jahresabschluss vollständig abgeschlossen. FA wurde am ${fmt(client.faUebermitteltDatum)} übermittelt.`,
    })
  }

  if (hints.length === 0) {
    const pct = calculateProgress(client)
    hints.push({
      icon: '📊',
      text: `Fortschritt: ${pct}%. Nächster Schritt: ${getNextStep(client)}`,
    })
  }

  return hints
}

function getNextStep(client) {
  const openQ = client.rueckfragen.filter(r => !r.beantwortet)
  if (openQ.length > 0) return 'Rückfragen klären'
  if (!client.steGesendetDatum) return 'Steuererklärung versenden'
  if (!client.unterschriftDatum) return 'Unterschrift einholen'
  if (!client.faGeplantDatum) return 'FA-Termin festlegen'
  if (!client.faUebermittelt) return 'FA beim Finanzamt einreichen'
  return 'Abgeschlossen'
}

/** Generates a response in the AI chat based on the user query */
export function generateAIResponse(message, client) {
  const msg = message.toLowerCase()

  // ── Quick prompts ────────────────────────────────────────────────────────────
  if (msg.startsWith('[__abgabefristen]')) return getAbgabefristen(client)
  if (msg.startsWith('[__fallstatus]'))    return getFallstatus(client)
  if (msg.startsWith('[__checkliste]'))    return getCheckliste(client)
  if (msg.startsWith('[__eur_bilanz]'))    return getEURBilanz()
  if (msg.startsWith('[__erinnerungsplan]')) return getErinnerungsplan(client)

  // ── Keyword matching ─────────────────────────────────────────────────────────
  if (msg.includes('abgabefrist') || msg.includes('deadline') || msg.includes('frist'))
    return getAbgabefristen(client)

  if (msg.includes('status') || msg.includes('stand') || msg.includes('fortschritt'))
    return getFallstatus(client)

  if (msg.includes('checkliste') || msg.includes('liste') || msg.includes('aufgabe'))
    return getCheckliste(client)

  if (msg.includes('eür') || msg.includes('bilanz') || msg.includes('gewinnermittlung') || msg.includes('unterschied'))
    return getEURBilanz()

  if (msg.includes('erinnerung') || msg.includes('reminder') || msg.includes('plan'))
    return getErinnerungsplan(client)

  if (msg.includes('umsatzsteuer') || msg.includes('ust') || msg.includes('mehrwertsteuer'))
    return `**Umsatzsteuer (${client?.name || 'Mandant'})**\n\nBei der USt. unterscheiden wir:\n• **Kleinunternehmerregelung** (§ 19 UStG): bis 22.000 € Umsatz p.a. keine USt.-Pflicht\n• **Ist-Besteuerung**: USt. erst bei Zahlungseingang fällig\n• **Soll-Besteuerung**: USt. bereits bei Rechnungsstellung fällig\n\nUmsatzsteuer-Voranmeldungen:\n• Monatlich: bei USt.-Schuld >7.500 € im Vorjahr\n• Vierteljährlich: bei USt.-Schuld ≤7.500 €\n• Jährliche Erklärung: bis 31. Juli des Folgejahres (mit StB-Verlängerung)\n\nBenötigen Sie weitere Informationen zur USt.-Behandlung für diesen Mandanten?`

  if (msg.includes('körperschaftsteuer') || msg.includes('kst') || msg.includes('gmbh'))
    return `**Körperschaftsteuer (KSt)**\n\nFür Kapitalgesellschaften (GmbH, AG etc.) gilt:\n• **KSt-Satz**: 15 % zzgl. Solidaritätszuschlag (5,5 % auf KSt)\n• **Gewerbesteuer**: Hebesatz je nach Gemeinde (bundesweit ∅ ca. 14–15 %)\n• **Effektive Steuerbelastung**: ca. 29–33 % auf Gewinn\n• **Vorauszahlungen**: 10.03., 10.06., 10.09., 10.12.\n\nBei Ausschüttungen an Gesellschafter gilt zusätzlich die Kapitalertragsteuer (25 % + SolZ = 26,375 %).`

  if (msg.includes('einkommensteuer') || msg.includes('est'))
    return `**Einkommensteuer**\n\nFür natürliche Personen und Personengesellschaften:\n• **Steuertarif**: progressiv, 14–45 % (ab 277.826 € Spitzensteuersatz)\n• **Grundfreibetrag 2024**: 11.604 €\n• **Vorauszahlungen**: 10.03., 10.06., 10.09., 10.12.\n• **Erklärungspflicht**: grundsätzlich bis 31. Juli des Folgejahres (mit StB bis 28.02. des übernächsten Jahres)\n\nFür Freiberufler und Einzelunternehmer gilt zusätzlich die Gewerbesteuerbefreiung bei freiberuflicher Tätigkeit (§ 18 EStG).`

  if (msg.includes('vollmacht') || msg.includes('datev'))
    return `**Steuerberatervollmacht & DATEV**\n\nFür die Vertretung beim FA benötigen Sie:\n• Steuerberatervollmacht (blanko oder beschränkt)\n• DATEV-Vollmachtsdatenbank: Eintrag sichert verlängerte Abgabefristen\n• Bei Erstmandaten: Empfang des Freistellungsauftrags prüfen\n\nMit eingetragener Vollmacht in DATEV verlängert sich die Abgabefrist für Einkommensteuer- und Körperschaftsteuererklärungen automatisch bis 28.02. des übernächsten Jahres.`

  if (msg.includes('hallo') || msg.includes('guten') || msg.includes('hi'))
    return `Guten Tag! Ich bin Ihr KI-Assistent für steuerliche Fragen.\n\n${client ? `Ich sehe, dass ${client.name} aktuell ausgewählt ist. ` : ''}Ich kann Ihnen helfen bei:\n• Abgabefristen und Terminen\n• Fallstatus-Zusammenfassungen\n• Checklisten für verschiedene Mandantentypen\n• Fragen zu EÜR vs. Bilanz\n• Allgemeinen Steuerfragen\n\nWie kann ich Ihnen helfen?`

  // Default response
  return `Vielen Dank für Ihre Anfrage.${client ? ` Bezüglich **${client.name}** (${client.gewinnermittlung}, ${client.rechtsform}):` : ''}\n\nIch habe Ihre Frage zur Kenntnis genommen. Als KI-Assistent im Offline-Modus kann ich allgemeine steuerrechtliche Informationen liefern sowie mandantenspezifische Hinweise auf Basis der gespeicherten Daten.\n\nBitte nutzen Sie die **Quick-Prompt-Buttons** oben für strukturierte Antworten zu:\n• Abgabefristen\n• Fallstatus\n• Checklisten\n• EÜR vs. Bilanz\n• Erinnerungsplan\n\nOder stellen Sie eine konkretere Frage – z.B. zu Umsatzsteuer, Körperschaftsteuer oder Einkommensteuer.`
}

function getAbgabefristen(client) {
  const vj = client?.veranlagungsjahr || 2024
  const folgeJahr = vj + 1
  const uebernaechstesJahr = vj + 2

  return `**Steuerliche Abgabefristen – Veranlagungszeitraum ${vj}**

**Ohne Steuerberater:**
• Einkommensteuer / KSt / USt: 31. Juli ${folgeJahr}

**Mit Steuerberater (DATEV-Vollmacht):**
• Einkommensteuer / KSt-Erklärung: 28. Februar ${uebernaechstesJahr}
• Gewerbesteuererklärung: 28. Februar ${uebernaechstesJahr}
• Umsatzsteuerjahreserklärung: 28. Februar ${uebernaechstesJahr}

**Sonderfälle:**
• Bei Anforderung durch das FA: 4 Monate Bearbeitungsfrist
• Fristverlängerung beantragen: Antrag beim zuständigen FA

**Vorauszahlungstermine ${folgeJahr}:**
• 10.03. / 10.06. / 10.09. / 10.12.

${client ? `\n**Für ${client.name} (${client.rechtsform}):**\nFA-Übermittlung geplant: ${client.faGeplantDatum ? fmt(client.faGeplantDatum) : 'noch nicht festgelegt'}` : ''}`
}

function getFallstatus(client) {
  if (!client) return 'Bitte wählen Sie zunächst einen Mandanten aus der linken Spalte aus.'

  const pct = calculateProgress(client)
  const openQ = client.rueckfragen.filter(r => !r.beantwortet).length
  const totalQ = client.rueckfragen.length
  const faInfo = client.faGeplantDatum && !client.faUebermittelt
    ? `FA-Termin: ${fmt(client.faGeplantDatum)} (${getFACountdown(client.faGeplantDatum).label})`
    : client.faUebermittelt
    ? `FA übermittelt: ${fmt(client.faUebermitteltDatum)}`
    : 'FA-Termin: noch nicht geplant'

  return `**Fallstatus: ${client.name}**

**Übersicht:**
• Mandantennummer: ${client.mandantennummer}
• Rechtsform: ${client.rechtsform} | Gewinnermittlung: ${client.gewinnermittlung}
• Veranlagungsjahr: ${client.veranlagungsjahr}
• Gesamtfortschritt: **${pct}%**

**Bearbeitungsstand:**
${totalQ > 0 ? `• Rückfragen: ${totalQ - openQ}/${totalQ} beantwortet${openQ > 0 ? ` ⚠️ (${openQ} offen)` : ' ✅'}` : '• Rückfragen: keine ✅'}
• StE gesendet: ${client.steGesendetDatum ? `✅ ${fmt(client.steGesendetDatum)}` : '○ ausstehend'}
• Unterschrift: ${client.unterschriftDatum ? `✅ ${fmt(client.unterschriftDatum)}` : '○ ausstehend'}
• ${faInfo}

**Nächste empfohlene Maßnahme:**
→ ${getNextStep(client)}`
}

function getCheckliste(client) {
  const isGmbH = client?.rechtsform === 'GmbH' || client?.rechtsform === 'AG'
  const isKG   = client?.rechtsform === 'KG' || client?.rechtsform === 'OHG' || client?.rechtsform === 'GbR' || client?.rechtsform === 'GmbH & Co. KG'
  const isEUR  = client?.gewinnermittlung === 'EÜR'

  let list = `**Checkliste Jahresabschluss ${client?.veranlagungsjahr || '2024'}${client ? ` – ${client.name}` : ''}**\n\n`

  list += `**Unterlagen anfordern:**\n`
  list += `☐ Kontoauszüge aller Bankkonten (vollständig)\n`
  list += `☐ Kassenbuch (falls Bargeschäfte)\n`
  list += `☐ Ausgangsrechnungen (vollständige Nummernfolge prüfen)\n`
  list += `☐ Eingangsrechnungen mit Vorsteuerabzug\n`
  list += `☐ Anlageverzeichnis / Inventarliste\n`

  if (isGmbH) {
    list += `☐ Gesellschaftsvertrag (aktuelle Fassung)\n`
    list += `☐ Gesellschafterbeschlüsse (Gewinnverwendung)\n`
    list += `☐ Gesellschafterdarlehen – Zinsen und Tilgungsplan\n`
  }
  if (isKG) {
    list += `☐ Gesellschafterkonten und Entnahmen\n`
    list += `☐ Kapitalkonten-Entwicklung\n`
  }
  if (!isEUR) {
    list += `☐ Inventurnachweis zum 31.12.\n`
    list += `☐ Rückstellungsberechnung\n`
    list += `☐ Forderungsbewertung / Einzelwertberichtigungen\n`
  } else {
    list += `☐ Umsatzübersicht (Einnahmen / Ausgaben)\n`
  }

  list += `\n**Steuerliche Prüfpunkte:**\n`
  list += `☐ Umsatzsteuer-Voranmeldungen abgestimmt\n`
  list += `☐ Körperschaft-/Einkommensteuer-Vorauszahlungen gebucht\n`
  list += `☐ Gewerbesteuer-Vorauszahlungen gebucht\n`
  list += `☐ Sonderabschreibungen geprüft (§ 7g EStG)\n`

  if (isEUR) {
    list += `☐ Betriebliche Kfz-Nutzung (1%-Regelung oder Fahrtenbuch)\n`
    list += `☐ Homeoffice-Pauschale prüfen\n`
  }

  list += `\n**Abschlussprozess:**\n`
  list += `☐ Rückfragen an Mandanten versenden\n`
  list += `☐ Steuererklärung erstellen und senden\n`
  list += `☐ Unterschrift / Vollständigkeitserklärung einholen\n`
  list += `☐ Finanzamt-Übermittlung\n`
  list += `☐ Steuerbescheid prüfen (Einspruchsfrist: 1 Monat)\n`

  return list
}

function getEURBilanz() {
  return `**EÜR vs. Bilanz – Überblick**

**Einnahmen-Überschuss-Rechnung (EÜR)**
• Rechtsgrundlage: § 4 Abs. 3 EStG
• Prinzip: Zufluss-/Abflussprinzip (Zahlung entscheidend)
• Pflicht: Umsatz ≤ 600.000 € ODER Gewinn ≤ 60.000 € p.a.
• Wer darf: Freiberufler (immer), Gewerbetreibende unterhalb der Grenzen
• Vorteile: Einfacher, geringerer Buchführungsaufwand
• Nachteil: Eingeschränkte Gestaltungsmöglichkeiten

**Bilanzierung (Doppelte Buchführung)**
• Rechtsgrundlage: §§ 238 ff. HGB, § 5 EStG
• Pflicht: Umsatz > 600.000 € ODER Gewinn > 60.000 €
• Kapitalgesellschaften (GmbH, AG): immer Bilanzierungspflicht
• Vorteile: Mehr Gestaltungsspielraum (Rückstellungen, Abgrenzungen)
• Nachteil: Höherer Aufwand, Jahresabschluss-Offenlegung (GmbH)

**Wechsel EÜR → Bilanz:**
• Bei Überschreitung der Grenzen: Finanzamt teilt Wechselpflicht mit
• Übergangsbilanz erforderlich
• Empfehlung: Frühzeitig vorbereiten

**Praxis-Tipp:**
Auch unterhalb der Grenzen kann die Bilanzierung sinnvoll sein, z.B. bei Kreditverhandlungen oder bei Investitionsplänen mit § 7g EStG-Abzügen.`
}

function getErinnerungsplan(client) {
  if (!client) return 'Bitte wählen Sie zunächst einen Mandanten aus.'

  const today = new Date()
  const year  = today.getFullYear()

  let plan = `**Empfohlener Erinnerungsplan – ${client.name}**\n\n`
  plan += `Basierend auf aktuellem Status (${calculateProgress(client)}% Fortschritt):\n\n`

  const openQ = client.rueckfragen.filter(r => !r.beantwortet).length
  if (openQ > 0) {
    plan += `⏰ **Sofort** – ${openQ} offene Rückfrage(n) nachfassen\n`
  }
  if (!client.steGesendetDatum) {
    plan += `📤 **${openQ > 0 ? 'Nach Rückfragen' : 'Kurzfristig'}** – Steuererklärung versenden\n`
  }
  if (client.steGesendetDatum && !client.unterschriftDatum) {
    plan += `✍️ **In 5–7 Tagen** – Unterschrift / Vollständigkeitserklärung anmahnen\n`
  }
  if (!client.faGeplantDatum) {
    plan += `📅 **Sobald Unterschrift vorliegt** – FA-Übermittlungstermin festlegen\n`
  }
  if (client.faGeplantDatum && !client.faUebermittelt) {
    const cd = getFACountdown(client.faGeplantDatum)
    plan += `🚨 **${fmt(client.faGeplantDatum)}** – FA übermitteln (${cd.label})\n`
  }

  plan += `\n**Standardtermine ${year}:**\n`
  plan += `• Vorauszahlungen: 10.03., 10.06., 10.09., 10.12.\n`
  plan += `• Lohnsteuer-Anmeldungen: jeweils 10. des Folgemonats\n`
  plan += `• USt-Voranmeldungen: je nach Vereinbarung\n`
  plan += `• Jahreserklärungen (mit StB): 28.02.${year + 1}\n`

  return plan
}
