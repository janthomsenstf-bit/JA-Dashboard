// ── Zahl-Parser: Komma + Punkt akzeptieren ──────────────────────────────────
export function parseZ(v) {
  if (v == null || v === '') return 0
  return parseFloat(v.toString().replace(',', '.')) || 0
}

// ── Euro-Formatter ───────────────────────────────────────────────────────────
export function fmtEur(v) {
  if (v == null || isNaN(v)) return '0,00 €'
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// ── KFZ-Nutzungsentnahme: Hilfsfunktionen ────────────────────────────────────

// Ermittelt den anwendbaren 1%-Satz anhand Fahrzeugart + BLP + Zulassungsjahr + PHEV-Werte
export function getBlpRate(fahrzeugArt, blp, erstzulassungJahr, co2GKm, elektrischeReichweite) {
  const blpNum = parseZ(blp)
  const jahr   = parseInt(erstzulassungJahr) || new Date().getFullYear()
  if (fahrzeugArt === 'verbrenner')      return 0.01
  if (fahrzeugArt === 'brennstoffzelle') return 0.0025
  if (fahrzeugArt === 'bev') {
    const cap = jahr >= 2024 ? 70000 : 60000   // Wachstumschancengesetz ab 2024
    return blpNum <= cap ? 0.0025 : 0.005
  }
  if (fahrzeugArt === 'phev') {
    const minRw = jahr >= 2025 ? 80 : 60       // ab 2025: mind. 80 km elektrisch
    const co2OK = parseZ(co2GKm) > 0 && parseZ(co2GKm) <= 50
    const rwOK  = parseZ(elektrischeReichweite) >= minRw
    return (co2OK || rwOK) ? 0.005 : 0.01
  }
  return 0.01
}

// Vollständige Fahrzeug-Berechnung (1%-Methode ODER Fahrtenbuch)
// Gibt ein Ergebnisobjekt zurück – wird vom SlideIn UND von berechnung() genutzt
export function berechneFahrzeug(fz) {
  const warnings    = []
  const monate      = Math.min(Math.max(parseInt(fz.nutzungsMonate) || 12, 1), 12)
  const unterjährig = monate < 12

  if (unterjährig) {
    warnings.push({ typ: 'info', text: `Unterjährige Nutzung: ${monate} Monat${monate !== 1 ? 'e' : ''} → Jahreswert anteilig.` })
  }

  if (fz.methode === '1pct') {
    const blp      = parseZ(fz.bruttolistenpreis)
    const blpGer   = Math.floor(blp / 100) * 100
    const rate     = getBlpRate(fz.fahrzeugArt, blp, fz.erstzulassungJahr, fz.co2GKm, fz.elektrischeReichweite)
    const ratioF   = rate / 0.01   // 1.0 / 0.5 / 0.25 – für Pendlerkürzung bei BEV/PHEV
    const pendlerBasis = blpGer * ratioF

    if (fz.fahrzeugArt === 'phev' && !parseZ(fz.co2GKm) && !parseZ(fz.elektrischeReichweite)) {
      warnings.push({ typ: 'warn', text: 'CO₂-Wert und el. Reichweite fehlen – es gilt 1,0 % (ungünstigster Fall).' })
    }
    if (fz.fahrzeugArt === 'bev' && parseZ(blp) > 70000 && parseInt(fz.erstzulassungJahr || 0) >= 2024) {
      warnings.push({ typ: 'info', text: 'BLP > 70.000 € → 0,5 % statt 0,25 % (Kappungsgrenze 2024).' })
    }

    const pendlerKm = parseZ(fz.pendlerKm)
    // Monatswert Pendler: immer je Monat berechnen, dann × Nutzungsmonate
    let pendlerMonat = 0
    if (fz.pendlerMethode === 'einzelbewertung') {
      const tageMonat = Math.min(parseZ(fz.einzelbewertungTageProMonat), 15)
      pendlerMonat = 0.00002 * pendlerBasis * pendlerKm * tageMonat
    } else {
      pendlerMonat = 0.0003 * pendlerBasis * pendlerKm
    }

    const privatnutzungMonat = rate * blpGer             // 1%-Monatswert
    const monatswert         = privatnutzungMonat + pendlerMonat
    const privatnutzungJahr  = privatnutzungMonat * monate
    const pendlerJahr        = pendlerMonat * monate
    const jahreswert         = monatswert * monate
    const ustBetrag          = (fz.nutzerTyp === 'unternehmer' && fz.ustPflichtig)
                                 ? jahreswert * 0.80 * 0.19 : 0

    return {
      methode: '1pct', rate, rateLabel: (rate * 100).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' %',
      blpGer, ratioF, monate, unterjährig,
      privatnutzungMonat, pendlerMonat, monatswert,
      privatnutzungJahr, pendlerJahr, jahreswert, ustBetrag, warnings,
    }
  } else {
    // ── Fahrtenbuch ──────────────────────────────────────────────────────────
    // Kosten werden als tatsächliche Kosten für den Nutzungszeitraum eingegeben.
    // monatswert = jahreswert / monate (abgeleitet).
    const rate   = getBlpRate(fz.fahrzeugArt, 999999, fz.erstzulassungJahr, fz.co2GKm, fz.elektrischeReichweite)
    const ratioF = rate / 0.01   // für AfA/Leasing-Kürzung bei BEV/PHEV
    const afaF   = (fz.fahrzeugArt === 'bev' || fz.fahrzeugArt === 'phev') ? ratioF : 1

    const afaBasis     = parseZ(fz.afa)     * afaF
    const leasingBasis = parseZ(fz.leasing) * afaF
    const gesamtkosten = afaBasis + leasingBasis
                       + parseZ(fz.kraftstoff) + parseZ(fz.versicherung)
                       + parseZ(fz.kfzSteuer)  + parseZ(fz.reparaturen) + parseZ(fz.sonstiges)

    const gesamtKm   = parseZ(fz.gesamtKm)
    const privatKm   = parseZ(fz.privatKm)
    const pendlerKm  = parseZ(fz.pendlerKmFb)

    if (gesamtKm > 0 && privatKm + pendlerKm > gesamtKm) {
      warnings.push({ typ: 'fehler', text: 'Privat-km + Pendler-km übersteigen Gesamt-km!' })
    }

    const privatAnteil        = gesamtKm > 0 ? privatKm  / gesamtKm : 0
    const pendlerAnteil       = gesamtKm > 0 ? pendlerKm / gesamtKm : 0
    const nutzungswertPrivat  = gesamtkosten * privatAnteil
    const nutzungswertPendler = gesamtkosten * pendlerAnteil
    const jahreswert          = nutzungswertPrivat + nutzungswertPendler
    const monatswert          = monate > 0 ? jahreswert / monate : 0

    if (afaF < 1) {
      const typ = fz.fahrzeugArt === 'bev' ? 'BEV' : 'PHEV'
      warnings.push({ typ: 'info', text: `${typ}: AfA/Leasing mit Faktor ${(afaF * 100).toFixed(0)} % angesetzt (§ 6 Abs. 1 Nr. 4 EStG).` })
    }

    return {
      methode: 'fahrtenbuch', gesamtkosten, afaBasis, leasingBasis,
      privatAnteilPct: privatAnteil * 100, pendlerAnteilPct: pendlerAnteil * 100,
      nutzungswertPrivat, nutzungswertPendler,
      monate, unterjährig, monatswert, jahreswert, ustBetrag: 0, warnings,
    }
  }
}

// Leeres Fahrzeug-Objekt
export function newFahrzeug() {
  return {
    id: 'fz_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    bezeichnung: '',
    methode: '1pct',            // '1pct' | 'fahrtenbuch'
    nutzerTyp: 'unternehmer',   // 'unternehmer' | 'arbeitnehmer'
    fahrzeugArt: 'verbrenner',  // 'verbrenner' | 'bev' | 'phev' | 'brennstoffzelle'
    erstzulassungJahr: String(new Date().getFullYear()),
    nutzungsMonate: '12',       // 1–12, für unterjährige Fahrzeuge
    // ── 1%-Methode ──
    bruttolistenpreis: '',
    co2GKm: '',
    elektrischeReichweite: '',
    ustPflichtig: true,
    pendlerKm: '',
    pendlerMethode: 'pauschale',          // 'pauschale' | 'einzelbewertung'
    einzelbewertungTageProMonat: '',
    // ── Fahrtenbuch ──
    afa: '', leasing: '', kraftstoff: '', versicherung: '',
    kfzSteuer: '', reparaturen: '', sonstiges: '',
    gesamtKm: '', privatKm: '', pendlerKmFb: '',
  }
}

// ── Kategorien ───────────────────────────────────────────────────────────────
export const RECHNER_KATEGORIEN = {
  kfz: { label: 'Fahrzeug / Kfz', icon: '🚗' },
}

// ── Template-Definitionen ────────────────────────────────────────────────────
// felder:      [{ id, label, typ:'zahl'|'text'|'prozent', einheit?, placeholder? }]
// berechnung:  (felder) → [{ id, label, wert, einheit?, hervorgehoben?, farbe?:'gruen'|'rot'|'orange' }]
// befundTemplate: (felder, ergebnis) → string
// multiRow:    true → felder enthält zeilen-Array + zeilenFelder-Definition

export const RECHNER_TEMPLATES = {

  // ── Kfz-Nutzungsentnahme (Multi-Fahrzeug) ────────────────────────────────
  kfzNutzung: {
    label: 'Kfz-Nutzungsentnahme',
    icon: '🚗',
    kategorie: 'kfz',
    beschreibung: 'Privatnutzung betrieblicher Fahrzeuge: 1%-Methode oder Fahrtenbuch – mehrere Fahrzeuge, § 6 Abs. 1 Nr. 4 EStG',
    multiVehicle: true,
    berechnung(felder) {
      const fahrzeuge = Array.isArray(felder.fahrzeuge) ? felder.fahrzeuge : []
      let gesamtJahr = 0, gesamtUst = 0
      fahrzeuge.forEach(fz => {
        try { const r = berechneFahrzeug(fz); gesamtJahr += r.jahreswert ?? 0; gesamtUst += r.ustBetrag ?? 0 } catch {}
      })
      const res = [
        { id: 'jahresgesamt', label: 'Nutzungsentnahme gesamt', wert: gesamtJahr, einheit: '€', hervorgehoben: true, farbe: 'orange' },
        { id: 'anzahlFz',     label: 'Fahrzeuge',               wert: fahrzeuge.length,         einheit: '' },
      ]
      if (gesamtUst > 0) res.push({ id: 'ustGesamt', label: 'USt-Anteil gesamt', wert: gesamtUst, einheit: '€' })
      return res
    },
    buchungshinweisDefault: { kontoSoll: '4670', kontoHaben: '8920', buchungstext: 'Kfz-Nutzungsentnahme Privatanteil' },
    befundTemplate(felder, ergebnis) {
      const fahrzeuge = Array.isArray(felder.fahrzeuge) ? felder.fahrzeuge : []
      const gesamt    = ergebnis.find(e => e.id === 'jahresgesamt')?.wert ?? 0
      const lines     = [`Kfz-Nutzungsentnahme (${fahrzeuge.length} Fahrzeug${fahrzeuge.length !== 1 ? 'e' : ''}):`, '']
      fahrzeuge.forEach(fz => {
        try {
          const r = berechneFahrzeug(fz)
          const mLabel = r.methode === '1pct' ? `1%-Methode (${r.rateLabel})` : 'Fahrtenbuch'
          lines.push(`  · ${fz.bezeichnung || 'Fahrzeug'}: ${fmtEur(r.jahreswert)} p.a. (${mLabel})`)
          if (r.ustBetrag > 0) lines.push(`    USt-Anteil: ${fmtEur(r.ustBetrag)}`)
        } catch {}
      })
      lines.push('', `Nutzungsentnahme gesamt: ${fmtEur(gesamt)} p.a.`)
      return lines.join('\n')
    },
  },

}

export const TEMPLATE_LIST = Object.entries(RECHNER_TEMPLATES).map(([key, tpl]) => ({ key, ...tpl }))

// Neues Zeilen-Objekt für RAP (alle Felder leer)
export function newZeile(template) {
  const fields = template.zeilenFelder ?? []
  return { id: 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), ...Object.fromEntries(fields.map(f => [f.id, ''])) }
}

// Neue Instanz anlegen
export function newInstanz(templateKey, client) {
  const tpl = RECHNER_TEMPLATES[templateKey]
  const id = 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
  return {
    id,
    templateKey,
    name: tpl.label + ' – ' + new Date().toLocaleDateString('de-DE'),
    jahr: client?.veranlagungsjahr ?? new Date().getFullYear(),
    blockId: null,
    punktId: null,
    felder: tpl.multiRow ? { zeilen: [newZeile(tpl)] } : {},
    buchungshinweise: { ...tpl.buchungshinweisDefault },
    befund: '',
    erstelltAm: new Date().toISOString(),
  }
}
