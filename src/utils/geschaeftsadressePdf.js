// ─────────────────────────────────────────────────────────────────────────────
// geschaeftsadressePdf.js — Erzeugt den "Vertrag Geschäftsadresse" aus den
// Vertragsdaten eines Auftrags (auftrag.erfassungsdaten), per jsPDF.
// Gleiches Muster wie ustRegPdf.js, aber komplett eigenständig (USt unberührt).
// ─────────────────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf'
import { loadKanzlei } from './ustRegPdf.js'   // nur Briefkopf-Daten wiederverwenden

function safe(s) { return (s == null ? '' : String(s)).trim() }

function deDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(safe(s))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : safe(s)
}

const LEISTUNG_LABEL = {
  nur_adresse:    'Nutzung der Geschäftsadresse',
  postannahme:    'Geschäftsadresse + Postannahme',
  postweiterltg:  'Geschäftsadresse + Postweiterleitung',
  digital:        'Geschäftsadresse + digitale Postweiterleitung',
}

export function buildVertragGeschaeftsadresse(client, au) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const kanzlei = loadKanzlei()
  const ed = au?.erfassungsdaten ?? {}
  const g = (k, d = '') => safe(ed[k]) || d
  const L = 22, R = 188, W = R - L
  let y = 22

  const firma   = g('unternehmensname') || safe(client?.name) || '—'
  const ap      = g('ansprechpartner')
  const apMail  = g('ansprechpartner_email')
  const rechAdr = g('rechnungsadresse')
  const adresse = g('gewuenschte_adresse')

  // ── Titel ──
  doc.setFont('helvetica', 'bold').setFontSize(15)
  doc.text('Vertrag über die Nutzung einer Geschäftsadresse', L, y)
  y += 4
  doc.setDrawColor(150); doc.setLineWidth(0.4); doc.line(L, y, R, y)
  y += 10

  // ── §1 Vertragsparteien ──
  function para(text, size = 10, gap = 4, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(0)
    const lines = doc.splitTextToSize(text, W)
    doc.text(lines, L, y)
    y += lines.length * (size * 0.48) + gap
  }
  function heading(t) {
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(20)
    doc.text(t, L, y); y += 6
    doc.setTextColor(0)
  }

  heading('§ 1  Vertragsparteien')
  para(`Anbieter:\n${[kanzlei.name, kanzlei.strasse, kanzlei.plzOrt, kanzlei.email].filter(Boolean).join(', ')}`)
  para(`Auftraggeber:\n${[firma, rechAdr].filter(Boolean).join(', ')}${ap ? `\nAnsprechpartner: ${ap}${apMail ? ' (' + apMail + ')' : ''}` : ''}`)

  // ── §2 Gegenstand ──
  heading('§ 2  Vertragsgegenstand')
  para(`Der Anbieter stellt dem Auftraggeber folgende Geschäftsadresse zur geschäftlichen Nutzung zur Verfügung:`)
  para(adresse || '________________________________________', 10.5, 5, true)
  para(`Leistungsumfang: ${LEISTUNG_LABEL[g('leistungsumfang')] || g('leistungsumfang') || 'Nutzung der Geschäftsadresse'}`)
  para(`Postannahme/-weiterleitung: ${g('postweiterleitung') === 'ja' ? `ja${g('postweiterleitung_intervall') ? ' (' + g('postweiterleitung_intervall') + ')' : ''}` : 'nein'}    ·    Digitale Weiterleitung (Scan per E-Mail): ${g('digitale_postweiterleitung') === 'ja' ? 'ja' : 'nein'}`)

  // ── §3 Laufzeit & Kündigung ──
  heading('§ 3  Laufzeit und Kündigung')
  para(`Vertragsbeginn: ${deDate(g('vertragsbeginn')) || '____________'}    ·    Laufzeit: ${g('laufzeit') || '____________'}`)
  para(`Kündigungsfrist: ${g('kuendigungsfrist') || '____________'}. Die Kündigung bedarf der Textform.`)

  // ── §4 Entgelt ──
  heading('§ 4  Entgelt')
  const entgelt = g('monatliches_entgelt')
  para(`Das monatliche Entgelt beträgt ${entgelt ? entgelt + (/€|eur/i.test(entgelt) ? '' : ' €') : '____________'} zzgl. gesetzlicher Umsatzsteuer.${rechAdr ? `\nRechnungsadresse: ${rechAdr}` : ''}`)

  // ── §5 Sonstiges ──
  heading('§ 5  Schlussbestimmungen')
  para('Änderungen und Ergänzungen dieses Vertrags bedürfen der Textform. Sollte eine Bestimmung unwirksam sein, bleibt der Vertrag im Übrigen wirksam.')

  // ── Unterschriften (hervorgehoben) ──
  y = Math.max(y + 14, 250)
  if (y > 262) { doc.addPage(); y = 40 }
  doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(0)
  doc.text('Bitte hier unterschreiben:', L, y)
  y += 12
  doc.setDrawColor(0); doc.setLineWidth(0.6)
  doc.line(L, y, L + 75, y)
  doc.line(R - 75, y, R, y)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90)
  doc.text('Ort, Datum · Auftraggeber', L, y + 4.5)
  doc.text('Ort, Datum · Anbieter', R - 75, y + 4.5)
  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(0)
  if (ap)        doc.text(ap, L, y + 9)
  doc.text(kanzlei.name, R - 75, y + 9)
  doc.setTextColor(0)

  return doc
}

export function gaVertragFilename(au) {
  const firma = (((au && au.erfassungsdaten) || {}).unternehmensname || 'Mandant')
    .replace(/[^\wäöüÄÖÜß \-]/g, '').trim().replace(/\s+/g, '_')
  return `Vertrag_Geschaeftsadresse_${firma}.pdf`
}
