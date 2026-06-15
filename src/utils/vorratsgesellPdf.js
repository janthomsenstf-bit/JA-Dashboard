// ─────────────────────────────────────────────────────────────────────────────
// vorratsgesellPdf.js — Erzeugt das "Reservierungs- / Kaufangebot Vorrats-
// gesellschaft" aus den Auftragsdaten (auftrag.erfassungsdaten), per jsPDF.
// Gleiches Muster wie geschaeftsadressePdf.js, komplett eigenständig.
// WICHTIG: Dies ist KEIN notarieller Kaufvertrag / Geschäftsanteilsübertragungs-
// vertrag und ersetzt KEINE notarielle Urkunde — nur ein Angebot/Reservierung.
// ─────────────────────────────────────────────────────────────────────────────
import { jsPDF } from 'jspdf'
import { loadKanzlei } from './ustRegPdf.js'   // nur Briefkopf-Daten wiederverwenden

function safe(s) { return (s == null ? '' : String(s)).trim() }

function deDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(safe(s))
  return m ? `${m[3]}.${m[2]}.${m[1]}` : safe(s)
}

const RECHTSFORM_LABEL = {
  ug:   'UG (haftungsbeschränkt)',
  gmbh: 'GmbH',
}

const STATUS_LABEL = {
  frei:       'frei',
  reserviert: 'reserviert',
  verkauft:   'verkauft',
}

export function buildAngebotVorratsgesell(client, au) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const kanzlei = loadKanzlei()
  const ed = au?.erfassungsdaten ?? {}
  const g = (k, d = '') => safe(ed[k]) || d
  const L = 22, R = 188, W = R - L
  let y = 22

  const mantel  = g('vg_firmenname') || '—'
  const erwName = g('erwerber_name') || safe(client?.name) || '—'
  const erwAdr  = g('erwerber_adresse')
  const erwAp   = g('erwerber_ansprechpartner')
  const erwMail = g('erwerber_email')

  // ── Titel ──
  doc.setFont('helvetica', 'bold').setFontSize(15)
  doc.text('Reservierungs- / Kaufangebot Vorratsgesellschaft', L, y)
  y += 4
  doc.setDrawColor(150); doc.setLineWidth(0.4); doc.line(L, y, R, y)
  y += 10

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

  // ── §1 Parteien ──
  heading('§ 1  Anbieter und Interessent')
  para(`Anbieter:\n${[kanzlei.name, kanzlei.strasse, kanzlei.plzOrt, kanzlei.email].filter(Boolean).join(', ')}`)
  para(`Interessent / Erwerber:\n${[erwName, erwAdr].filter(Boolean).join(', ')}${erwAp ? `\nAnsprechpartner: ${erwAp}${erwMail ? ' (' + erwMail + ')' : ''}` : ''}`)

  // ── §2 Eckdaten der Vorratsgesellschaft ──
  heading('§ 2  Eckdaten der Vorratsgesellschaft')
  para(`Firmenname: ${mantel}`, 10.5, 4, true)
  para([
    `Rechtsform: ${RECHTSFORM_LABEL[g('vg_rechtsform')] || g('vg_rechtsform') || '—'}`,
    `Handelsregisternummer: ${g('vg_hrb') || '—'}`,
    `Sitz: ${g('vg_sitz') || '—'}`,
    `Gründungsdatum: ${deDate(g('vg_gruendungsdatum')) || '—'}`,
    `Stammkapital: ${g('vg_stammkapital') || '—'}`,
    `Status: ${STATUS_LABEL[g('vg_status')] || g('vg_status') || '—'}`,
  ].join('\n'))

  // ── §3 Geplante Übernahme & Umfirmierung ──
  heading('§ 3  Geplante Übernahme und Umfirmierung')
  para([
    `Gewünschter neuer Firmenname: ${g('neuer_firmenname') || '—'}`,
    `Neuer Sitz: ${g('neuer_sitz') || '—'}`,
    `Neuer Unternehmensgegenstand: ${g('neuer_gegenstand') || '—'}`,
    `Künftiger Geschäftsführer: ${g('kuenftiger_gf') || '—'}`,
    `Geplantes Übergabedatum: ${deDate(g('uebergabedatum')) || '—'}`,
    `Notar: ${g('notar') || '—'}`,
    `Notartermin: ${deDate(g('notartermin')) || '—'}`,
  ].join('\n'))

  // ── §4 Kaufpreis / Entgelt ──
  heading('§ 4  Kaufpreis / Entgelt')
  const kp = g('kaufpreis')
  para(`Kaufpreis / Entgelt: ${kp ? kp + (/€|eur|kr/i.test(kp) ? '' : ' €') : '____________'} zzgl. gesetzlicher Umsatzsteuer, soweit anwendbar.`)

  // ── §5 Ablauf & Hinweise ──
  heading('§ 5  Ablauf und Hinweise')
  para('Ablauf: Nach Annahme dieses Angebots reservieren wir die Vorratsgesellschaft für den Interessenten. Anschließend wird der notarielle Geschäftsanteilskaufvertrag vorbereitet und ein Notartermin vereinbart. Mit der notariellen Beurkundung geht die Gesellschaft auf den Erwerber über; im selben Zuge werden Umfirmierung, Sitzverlegung und Geschäftsführerbestellung beurkundet und zur Eintragung im Handelsregister angemeldet.')
  para('Wichtiger Hinweis: Dieses Dokument ist ein unverbindliches Angebot bzw. eine Reservierung und stellt KEINE notarielle Urkunde dar. Der eigentliche Geschäftsanteilskauf- und Übertragungsvertrag bedarf der notariellen Beurkundung und erfolgt separat durch den Notar.', 9.5, 4)

  // ── Reservierung annehmen (optional) ──
  y = Math.max(y + 14, 250)
  if (y > 262) { doc.addPage(); y = 40 }
  doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(0)
  doc.text('Reservierung annehmen:', L, y)
  y += 12
  doc.setDrawColor(0); doc.setLineWidth(0.6)
  doc.line(L, y, L + 75, y)
  doc.line(R - 75, y, R, y)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90)
  doc.text('Ort, Datum · Erwerber', L, y + 4.5)
  doc.text('Ort, Datum · Anbieter', R - 75, y + 4.5)
  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(0)
  if (erwAp) doc.text(erwAp, L, y + 9)
  doc.text(kanzlei.name, R - 75, y + 9)
  doc.setTextColor(0)

  return doc
}

export function vgAngebotFilename(au) {
  const firma = (((au && au.erfassungsdaten) || {}).vg_firmenname
    || ((au && au.erfassungsdaten) || {}).neuer_firmenname || 'Vorratsgesellschaft')
    .replace(/[^\wäöüÄÖÜß \-]/g, '').trim().replace(/\s+/g, '_')
  return `Angebot_Vorratsgesellschaft_${firma}.pdf`
}
