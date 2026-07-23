/**
 * api/easyb2b-email.js
 *
 * POST /api/easyb2b-email?aktion=intro          → Intro-Mails an beide Parteien
 * POST /api/easyb2b-email?aktion=match-consent  → DSGVO-Freigabe / Match-Paket
 *                                                  (Unterfall über body.typ)
 * POST /api/easyb2b-email?aktion=test-vorlage   → Test-Mail einer Vorlage
 *
 * Fasst die drei E-Mail-Routen des eigenständigen Easy-B2B-Dashboards
 * (app/api/email/intro|match-consent|test-vorlage) in einer Vercel-Funktion
 * zusammen. Versand und HTML-Bausteine sind unverändert übernommen; die
 * Next.js-Route (getrennte Dateien, NextResponse) wurde zur Vercel-Funktion
 * (ein Handler, req/res) mit Verzweigung über den Query-Parameter `aktion`.
 *
 * WICHTIG – bewusst nicht automatisch: Jeder Versand wird von einer
 * Bedienhandlung im Dashboard ausgelöst. Diese Funktion versendet nichts von
 * sich aus.
 *
 * Voraussetzung für echten Versand: Umgebungsvariable RESEND_API_KEY.
 * Fehlt sie, wird NICHT gesendet und ein klarer Hinweis zurückgegeben – wie
 * im Ursprungsprojekt.
 */

import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.RESEND_FROM_EMAIL || 'Easy-B2B <noreply@easyb2b.de>'

// Empfänger der Test-Vorlagen (Resend-Free-Tier: nur verifizierte Adresse)
const TEST_EMPFAENGER = process.env.EASYB2B_TEST_EMAIL || 'jan.thomsen.stf@gmail.com'

async function sendeEmail(to, subject, html, typ) {
  if (!resend) {
    console.warn(`[Easy-B2B Email] RESEND_API_KEY nicht gesetzt – "${typ}" NICHT gesendet an ${to}`)
    return { success: false, error: 'kein_api_key' }
  }
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html })
    if (error) {
      console.error(`[Easy-B2B Email] Fehler (${typ}):`, error)
      return { success: false, error }
    }
    return { success: true }
  } catch (err) {
    console.error(`[Easy-B2B Email] Exception (${typ}):`, err)
    return { success: false, error: String(err) }
  }
}

const heute = () => new Date().toLocaleDateString('de-DE')

// ── HTML-Bausteine (unverändert aus lib/email.ts übernommen) ─────────────────

function baueFreigabeMailSuchender(data) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#003366;padding:20px 24px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:20px">🎯 Easy-B2B hat einen passenden Kontakt gefunden</h1>
        <p style="color:#a8c4e0;margin:4px 0 0 0;font-size:13px">Match-Vorschlag · ${heute()}</p>
      </div>
      <div style="background:white;padding:24px;border:1px solid #e0e0e0;border-top:none">
        <p style="font-size:15px">Hallo ${data.suchenderName},</p>
        <p style="line-height:1.6">wir haben einen Interessenten für Ihre Anfrage <strong>${data.anfrageId}</strong> geprüft und halten ihn für passend.</p>
        <div style="margin:20px 0;padding:20px;background:#f0f4ff;border:2px solid #2196F3;border-radius:8px">
          <div style="font-size:11px;font-weight:bold;color:#1565C0;letter-spacing:0.5px;margin-bottom:12px">MATCH-VORSCHLAG · ${data.matchScore}% PASSUNG</div>
          <div style="font-size:18px;font-weight:bold;color:#003366;margin-bottom:14px">${data.interessentFirma}</div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            ${data.interessentBranche ? `<tr><td style="padding:5px 0;color:#555;width:140px">Branche</td><td style="padding:5px 0;font-weight:600">${data.interessentBranche}</td></tr>` : ''}
            ${data.interessentRegion ? `<tr><td style="padding:5px 0;color:#555">Region</td><td style="padding:5px 0;font-weight:600">${data.interessentRegion}</td></tr>` : ''}
            ${data.interessentSprachen?.length ? `<tr><td style="padding:5px 0;color:#555">Sprachen</td><td style="padding:5px 0;font-weight:600">${data.interessentSprachen.join(', ')}</td></tr>` : ''}
          </table>
        </div>
        <div style="margin:16px 0;padding:14px 16px;background:#e8f5e9;border-radius:8px">
          <div style="font-size:12px;font-weight:bold;color:#1b5e20;margin-bottom:8px">Warum wir glauben, dass dieser Kontakt passt:</div>
          ${(data.matchGruende || []).map(g => `<div style="display:flex;gap:8px;font-size:13px;color:#333;padding:3px 0"><span style="color:#4CAF50;flex-shrink:0">✓</span><span>${g}</span></div>`).join('')}
        </div>
        <div style="background:#fff8e1;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:13px;color:#5d4037">
          <strong>Hinweis:</strong> Kontaktdaten werden erst nach Ihrer ausdrücklichen Zustimmung ausgetauscht. Der Interessent wird ebenfalls um Zustimmung gebeten.
        </div>
        <div style="margin:20px 0;text-align:center">
          <p style="font-size:13px;color:#555;margin-bottom:12px">Möchten Sie, dass Ihre Kontaktdaten an diesen Interessenten weitergegeben werden?</p>
          <p style="font-size:12px;color:#888;font-style:italic;margin-bottom:16px">Mit Ihrer Zustimmung dürfen wir Ihre Kontaktdaten an den Interessenten weitergeben.</p>
          <div style="display:inline-block;padding:12px 28px;background:#4CAF50;color:white;border-radius:8px;font-size:14px;font-weight:700;margin-right:8px">✅ Kontaktdaten freigeben</div>
          <div style="display:inline-block;padding:12px 28px;background:#f5f5f5;color:#666;border-radius:8px;font-size:14px;font-weight:600;border:1px solid #ddd">❌ Kein Interesse</div>
        </div>
        <p style="font-size:11px;color:#888;line-height:1.5;margin-top:20px">
          Diese E-Mail wurde im Rahmen des Easy-B2B Matchmaking-Prozesses versendet. Ihre Zustimmung wird DSGVO-konform dokumentiert (Zeitpunkt, Person, Unternehmen). Ohne Ihre aktive Freigabe werden keine Kontaktdaten weitergegeben.
        </p>
      </div>
      <div style="padding:12px 24px;font-size:11px;color:#999;text-align:center">Easy-B2B · Deutsch-Dänisches Matchmaking-Netzwerk</div>
    </div>`
}

function baueFreigabeMailInteressent(data) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#003366;padding:20px 24px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:20px">🎯 Easy-B2B möchte Sie einem Unternehmen vorstellen</h1>
        <p style="color:#a8c4e0;margin:4px 0 0 0;font-size:13px">Match-Vorschlag · ${heute()}</p>
      </div>
      <div style="background:white;padding:24px;border:1px solid #e0e0e0;border-top:none">
        <p style="font-size:15px">Hallo ${data.interessentName},</p>
        <p style="line-height:1.6">wir glauben, dass das Projekt <strong>${data.anfrageId}</strong> sehr gut zu Ihrem Profil passt.</p>
        <div style="margin:20px 0;padding:20px;background:#f0f4ff;border:2px solid #2196F3;border-radius:8px">
          <div style="font-size:11px;font-weight:bold;color:#1565C0;letter-spacing:0.5px;margin-bottom:12px">PROJEKT-VORSTELLUNG · ${data.matchScore}% PASSUNG</div>
          <div style="font-size:18px;font-weight:bold;color:#003366;margin-bottom:14px">${data.anfrageFirma}</div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:5px 0;color:#555;width:140px">Branche</td><td style="padding:5px 0;font-weight:600">${data.anfrageBranche}</td></tr>
            <tr><td style="padding:5px 0;color:#555">Region</td><td style="padding:5px 0;font-weight:600">${data.anfrageRegion}</td></tr>
            ${data.anfrageSprachen?.length ? `<tr><td style="padding:5px 0;color:#555">Sprachen</td><td style="padding:5px 0;font-weight:600">${data.anfrageSprachen.join(', ')}</td></tr>` : ''}
          </table>
        </div>
        <div style="margin:16px 0;padding:14px 16px;background:#e8f5e9;border-radius:8px">
          <div style="font-size:12px;font-weight:bold;color:#1b5e20;margin-bottom:8px">Warum wir glauben, dass dieses Projekt für Sie interessant ist:</div>
          ${(data.matchGruende || []).map(g => `<div style="display:flex;gap:8px;font-size:13px;color:#333;padding:3px 0"><span style="color:#4CAF50;flex-shrink:0">✓</span><span>${g}</span></div>`).join('')}
        </div>
        <div style="background:#fff8e1;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:13px;color:#5d4037">
          <strong>Hinweis:</strong> Kontaktdaten werden erst nach Ihrer ausdrücklichen Zustimmung ausgetauscht. Das suchende Unternehmen wird ebenfalls um Zustimmung gebeten.
        </div>
        <div style="margin:20px 0;text-align:center">
          <p style="font-size:13px;color:#555;margin-bottom:12px">Möchten Sie, dass Ihre Kontaktdaten an dieses Unternehmen weitergegeben werden?</p>
          <p style="font-size:12px;color:#888;font-style:italic;margin-bottom:16px">Mit Ihrer Zustimmung dürfen wir Ihre Kontaktdaten an das suchende Unternehmen weitergeben.</p>
          <div style="display:inline-block;padding:12px 28px;background:#4CAF50;color:white;border-radius:8px;font-size:14px;font-weight:700;margin-right:8px">✅ Kontaktdaten freigeben</div>
          <div style="display:inline-block;padding:12px 28px;background:#f5f5f5;color:#666;border-radius:8px;font-size:14px;font-weight:600;border:1px solid #ddd">❌ Kein Interesse</div>
        </div>
        <p style="font-size:11px;color:#888;line-height:1.5;margin-top:20px">
          Diese E-Mail wurde im Rahmen des Easy-B2B Matchmaking-Prozesses versendet. Ihre Zustimmung wird DSGVO-konform dokumentiert (Zeitpunkt, Person, Unternehmen). Ohne Ihre aktive Freigabe werden keine Kontaktdaten weitergegeben.
        </p>
      </div>
      <div style="padding:12px 24px;font-size:11px;color:#999;text-align:center">Easy-B2B · Deutsch-Dänisches Matchmaking-Netzwerk</div>
    </div>`
}

function baueMatchPaketMail(data) {
  const istErstkontakt = (data.empfohlenerErstkontakt === 'suchender' && data.empfaengerFirma !== data.partnerFirma)
    || (data.empfohlenerErstkontakt === 'interessent' && data.empfaengerFirma === data.partnerFirma)
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#003366;padding:20px 24px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:20px">📦 Ihr Match-Paket von Easy-B2B</h1>
        <p style="color:#a8c4e0;margin:4px 0 0 0;font-size:13px">Beide Seiten haben zugestimmt · ${heute()}</p>
      </div>
      <div style="background:white;padding:24px;border:1px solid #e0e0e0;border-top:none">
        <p style="font-size:15px">Hallo ${data.empfaengerName},</p>
        <p style="line-height:1.6">beide Seiten haben der Kontaktfreigabe zugestimmt. Hier sind die Kontaktdaten Ihres Match-Partners:</p>
        <div style="margin:20px 0;padding:20px;background:#e8f5e9;border:2px solid #4CAF50;border-radius:8px">
          <div style="font-size:11px;font-weight:bold;color:#2e7d32;letter-spacing:0.5px;margin-bottom:12px">✅ MATCH BESTÄTIGT — KONTAKTDATEN</div>
          <div style="font-size:18px;font-weight:bold;color:#1b5e20;margin-bottom:10px">${data.partnerFirma}</div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:5px 0;color:#555;width:140px">Ansprechpartner</td><td style="padding:5px 0;font-weight:bold">${data.partnerName}</td></tr>
            <tr><td style="padding:5px 0;color:#555">E-Mail</td><td style="padding:5px 0"><a href="mailto:${data.partnerEmail}" style="color:#003366;font-weight:bold">${data.partnerEmail}</a></td></tr>
            ${data.partnerTelefon ? `<tr><td style="padding:5px 0;color:#555">Telefon</td><td style="padding:5px 0;font-weight:bold">${data.partnerTelefon}</td></tr>` : ''}
            ${data.partnerWebsite ? `<tr><td style="padding:5px 0;color:#555">Website</td><td style="padding:5px 0"><a href="${data.partnerWebsite}" style="color:#003366">${data.partnerWebsite}</a></td></tr>` : ''}
            ${data.partnerLinkedin ? `<tr><td style="padding:5px 0;color:#555">LinkedIn</td><td style="padding:5px 0">${data.partnerLinkedin}</td></tr>` : ''}
            ${data.partnerSprachen?.length ? `<tr><td style="padding:5px 0;color:#555">Sprachen</td><td style="padding:5px 0">${data.partnerSprachen.join(', ')}</td></tr>` : ''}
          </table>
        </div>
        <div style="margin:16px 0;padding:14px 16px;background:#f0f4ff;border-radius:8px">
          <div style="font-size:12px;font-weight:bold;color:#003366;margin-bottom:10px">Hinweise zum Erstkontakt</div>
          <div style="font-size:13px;color:#333;margin-bottom:6px">
            ${istErstkontakt ? '👆 <strong>Sie sind gebeten, den Erstkontakt herzustellen.</strong>' : '⏳ <strong>Ihr Match-Partner wird den Erstkontakt herstellen.</strong>'}
          </div>
          <div style="font-size:13px;color:#333;margin-bottom:6px">🗣 <strong>Empfohlene Sprache:</strong> ${data.empfohleneSprache}</div>
          <div style="font-size:13px;color:#333;margin-bottom:8px">🎯 <strong>Projektziel:</strong> ${data.projektziel}</div>
          ${(data.hinweise || []).map(h => `<div style="display:flex;gap:8px;font-size:13px;color:#555;padding:2px 0"><span>💡</span><span>${h}</span></div>`).join('')}
        </div>
        <div style="margin-top:16px;padding:12px;background:#f5f5f5;border-radius:6px;font-size:12px;color:#666">
          💡 <strong>Tipp:</strong> Nennen Sie Easy-B2B als gemeinsamen Kontext — das schafft sofort Vertrauen. Wir freuen uns über Feedback nach dem ersten Gespräch.
        </div>
      </div>
      <div style="padding:12px 24px;font-size:11px;color:#999;text-align:center">Easy-B2B · Deutsch-Dänisches Matchmaking-Netzwerk</div>
    </div>`
}

function baueIntroMailSuchender(data) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#003366;padding:20px 24px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:20px">🤝 Easy-B2B stellt vor</h1>
        <p style="color:#a8c4e0;margin:4px 0 0 0;font-size:13px">Kontaktherstellung · ${heute()}</p>
      </div>
      <div style="background:white;padding:24px;border:1px solid #e0e0e0;border-top:none">
        <p style="font-size:15px">Hallo ${data.suchenderName},</p>
        <p style="line-height:1.6">wir haben einen Interessenten für Ihre Anfrage <strong>${data.anfrageId}</strong> geprüft und freigegeben.</p>
        <div style="margin:20px 0;padding:20px;background:#e8f5e9;border:2px solid #4CAF50;border-radius:8px">
          <div style="font-size:11px;font-weight:bold;color:#2e7d32;letter-spacing:0.5px;margin-bottom:12px">✅ FREIGEGEBENER INTERESSENT</div>
          <div style="font-size:18px;font-weight:bold;color:#1b5e20;margin-bottom:10px">${data.interessentFirma}</div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:5px 0;color:#555;width:130px">Ansprechpartner</td><td style="padding:5px 0;font-weight:bold">${data.interessentName}</td></tr>
            <tr><td style="padding:5px 0;color:#555">E-Mail</td><td style="padding:5px 0"><a href="mailto:${data.interessentEmail}" style="color:#003366;font-weight:bold">${data.interessentEmail}</a></td></tr>
            ${data.interessentTelefon ? `<tr><td style="padding:5px 0;color:#555">Telefon</td><td style="padding:5px 0;font-weight:bold">${data.interessentTelefon}</td></tr>` : ''}
          </table>
        </div>
        ${data.operatorNotiz ? `<div style="padding:12px 16px;background:#fff8e1;border-radius:6px;font-size:13px;color:#8a6d00;margin-bottom:16px"><strong>Hinweis von Easy-B2B:</strong> ${data.operatorNotiz}</div>` : ''}
        <p style="font-size:13px;line-height:1.6;color:#555">Wir empfehlen, innerhalb von <strong>3–5 Werktagen</strong> Kontakt aufzunehmen. Der Interessent wurde ebenfalls über die Kontaktherstellung informiert.</p>
        <div style="margin-top:16px;padding:12px;background:#f5f5f5;border-radius:6px;font-size:12px;color:#666">💡 <strong>Tipp:</strong> Nennen Sie Easy-B2B als gemeinsamen Kontext – das schafft sofort Vertrauen.</div>
      </div>
      <div style="padding:12px 24px;font-size:11px;color:#999;text-align:center">Easy-B2B · Deutsch-Dänisches Matchmaking-Netzwerk</div>
    </div>`
}

function baueIntroMailInteressent(data) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#003366;padding:20px 24px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:20px">🤝 Ihr Interesse wurde freigegeben</h1>
        <p style="color:#a8c4e0;margin:4px 0 0 0;font-size:13px">Kontaktherstellung · ${heute()}</p>
      </div>
      <div style="background:white;padding:24px;border:1px solid #e0e0e0;border-top:none">
        <p style="font-size:15px">Hallo ${data.interessentName},</p>
        <p style="line-height:1.6">gute Nachricht! Ihr Interesse an der Anfrage <strong>${data.anfrageId}</strong> wurde geprüft und freigegeben.</p>
        <div style="margin:20px 0;padding:20px;background:#e8f5e9;border:2px solid #4CAF50;border-radius:8px">
          <div style="font-size:11px;font-weight:bold;color:#2e7d32;letter-spacing:0.5px;margin-bottom:12px">✅ SUCHENDE FIRMA (Ihre Kontaktperson)</div>
          <div style="font-size:18px;font-weight:bold;color:#1b5e20;margin-bottom:10px">${data.anfrageFirma}</div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:5px 0;color:#555;width:130px">Ansprechpartner</td><td style="padding:5px 0;font-weight:bold">${data.anfrageName}</td></tr>
            <tr><td style="padding:5px 0;color:#555">E-Mail</td><td style="padding:5px 0"><a href="mailto:${data.anfrageEmail}" style="color:#003366;font-weight:bold">${data.anfrageEmail}</a></td></tr>
            ${data.anfrageTelefon ? `<tr><td style="padding:5px 0;color:#555">Telefon</td><td style="padding:5px 0;font-weight:bold">${data.anfrageTelefon}</td></tr>` : ''}
          </table>
        </div>
        ${data.operatorNotiz ? `<div style="padding:12px 16px;background:#fff8e1;border-radius:6px;font-size:13px;color:#8a6d00;margin-bottom:16px"><strong>Hinweis von Easy-B2B:</strong> ${data.operatorNotiz}</div>` : ''}
        <p style="font-size:13px;line-height:1.6;color:#555">Nennen Sie Easy-B2B als gemeinsamen Kontext – das schafft sofort Vertrauen. Wir freuen uns über Feedback nach dem ersten Gespräch.</p>
      </div>
      <div style="padding:12px 24px;font-size:11px;color:#999;text-align:center">Easy-B2B · Deutsch-Dänisches Matchmaking-Netzwerk</div>
    </div>`
}

function baueTestVorlageMail(b) {
  const buttonHtml = (b.buttons || []).map(btn =>
    `<div style="display:inline-block;padding:12px 24px;background-color:${btn.farbe};color:${btn.farbe === '#f5f5f5' ? '#333' : 'white'};border-radius:8px;font-size:14px;font-weight:bold;margin:4px;text-decoration:none;">${btn.label}</div>`
  ).join(' ')

  const inhaltZeilen = (b.hauptinhalt || '').split('\n').map(line => {
    if (line.startsWith('•') || line.startsWith('- ')) {
      return `<div style="display:flex;gap:8px;font-size:13px;color:#333;padding:3px 0;"><span style="color:#4CAF50;flex-shrink:0;">✓</span><span>${line.replace(/^[•\-]\s*/, '')}</span></div>`
    }
    if (line.includes(':') && !line.startsWith('Warum') && line.split(':')[0].length < 30) {
      const [key, ...val] = line.split(':')
      return `<div style="font-size:13px;padding:3px 0;"><span style="color:#555;">${key}:</span> <strong>${val.join(':').trim()}</strong></div>`
    }
    if (!line.trim()) return '<div style="height:8px;"></div>'
    return `<div style="font-size:14px;color:#333;padding:2px 0;line-height:1.6;">${line}</div>`
  }).join('')

  const hinweisHtml = b.hinweis
    ? `<div style="background:#fff8e1;padding:14px 16px;border-radius:8px;margin:16px 0;font-size:13px;color:#5d4037;">${
        b.hinweis.split('\n').map(l => `<p style="margin:0 0 4px 0;">${l}</p>`).join('')
      }</div>`
    : ''

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
      <div style="background:#003366;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h1 style="color:white;margin:0;font-size:18px;">🧪 TEST: ${b.vorlageName}</h1>
        <p style="color:#a8c4e0;margin:4px 0 0 0;font-size:12px;">Vorlage: ${b.vorlageTyp} · Dies ist eine Test-E-Mail</p>
      </div>
      <div style="padding:24px;background:white;">
        <div style="background:#fff3e0;padding:10px 14px;border-radius:6px;margin-bottom:16px;font-size:12px;color:#e65100;font-weight:bold;">
          ⚠️ DIES IST EINE TEST-E-MAIL — Platzhalter sind mit Beispieldaten gefüllt.
        </div>
        ${b.einleitung ? b.einleitung.split('\n').map(l => `<p style="font-size:14px;line-height:1.6;margin:0 0 8px 0;">${l}</p>`).join('') : ''}
        <div style="margin:20px 0;padding:20px;background:#f0f4ff;border:2px solid #2196F3;border-radius:8px;">${inhaltZeilen}</div>
        ${hinweisHtml}
        ${buttonHtml ? `<div style="margin:20px 0;text-align:center;">${buttonHtml}</div>` : ''}
        ${b.fusszeile ? `<p style="font-size:11px;color:#888;line-height:1.5;margin-top:20px;">${b.fusszeile}</p>` : ''}
      </div>
      <div style="padding:12px 24px;font-size:11px;color:#999;text-align:center;border-top:1px solid #f0f0f0;">
        Easy-B2B · Deutsch-Dänisches Matchmaking-Netzwerk · Test-Versand
      </div>
    </div>`
}

// ── Router ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const aktion = req.query?.aktion

  try {
    const body = req.body ?? {}

    if (aktion === 'intro') return await intro(body, res)
    if (aktion === 'match-consent') return await matchConsent(body, res)
    if (aktion === 'test-vorlage') return await testVorlage(body, res)

    return res.status(400).json({ error: `Unbekannte Aktion: ${aktion ?? '(keine)'}` })
  } catch (error) {
    console.error('[Easy-B2B Email] Fehler:', error)
    return res.status(500).json({ error: 'Interner Fehler beim E-Mail-Versand' })
  }
}

async function intro(body, res) {
  const {
    suchendeEmail, suchenderName, anfrageFirma, anfrageAnzeigenId, anfrageTelefon,
    interessentEmail, interessentName, interessentFirma, interessentTelefon, operatorNotiz,
  } = body

  if (!suchendeEmail || !interessentEmail || !anfrageFirma || !interessentFirma) {
    return res.status(400).json({ error: 'suchendeEmail, interessentEmail, anfrageFirma und interessentFirma sind erforderlich' })
  }

  const [r1, r2] = await Promise.all([
    sendeEmail(suchendeEmail, `🤝 Easy-B2B Kontakt: ${interessentFirma} hat Interesse (${anfrageAnzeigenId})`,
      baueIntroMailSuchender({
        suchenderName: suchenderName || 'Ansprechpartner', anfrageFirma,
        anfrageId: anfrageAnzeigenId || 'Easy-B2B Anfrage', interessentFirma,
        interessentName: interessentName || 'Ansprechpartner', interessentEmail,
        interessentTelefon: interessentTelefon || '', operatorNotiz,
      }), 'intro_suchender'),
    sendeEmail(interessentEmail, `🤝 Easy-B2B: Kontakt zu ${anfrageFirma} freigegeben (${anfrageAnzeigenId})`,
      baueIntroMailInteressent({
        interessentName: interessentName || 'Ansprechpartner', interessentFirma,
        anfrageId: anfrageAnzeigenId || 'Easy-B2B Anfrage', anfrageFirma,
        anfrageName: suchenderName || 'Ansprechpartner', anfrageEmail: suchendeEmail,
        anfrageTelefon: anfrageTelefon || '', operatorNotiz,
      }), 'intro_interessent'),
  ])

  return res.status(200).json({
    success: true,
    gesendetAn: {
      suchender: { email: suchendeEmail, erfolg: r1.success },
      interessent: { email: interessentEmail, erfolg: r2.success },
    },
  })
}

async function matchConsent(body, res) {
  const { typ } = body

  if (typ === 'freigabe_anfragen') {
    const {
      suchendeEmail, suchenderName, anfrageFirma, anfrageAnzeigenId, anfrageBranche, anfrageRegion, anfrageSprachen,
      interessentEmail, interessentName, interessentFirma, interessentBranche, interessentRegion, interessentSprachen,
      matchGruende, matchScore,
    } = body
    if (!suchendeEmail || !interessentEmail) return res.status(400).json({ error: 'E-Mail-Adressen fehlen' })

    const [r1, r2] = await Promise.all([
      sendeEmail(suchendeEmail, `🎯 Easy-B2B: Passender Kontakt gefunden (${anfrageAnzeigenId})`,
        baueFreigabeMailSuchender({
          suchenderName: suchenderName || 'Ansprechpartner', anfrageFirma, anfrageId: anfrageAnzeigenId || '',
          interessentFirma, interessentBranche, interessentRegion, interessentSprachen,
          matchGruende: matchGruende || [], matchScore: matchScore || 0,
        }), 'match_freigabe_suchender'),
      sendeEmail(interessentEmail, `🎯 Easy-B2B möchte Sie einem Unternehmen vorstellen`,
        baueFreigabeMailInteressent({
          interessentName: interessentName || 'Ansprechpartner', interessentFirma, anfrageId: anfrageAnzeigenId || '',
          anfrageFirma, anfrageBranche: anfrageBranche || '', anfrageRegion: anfrageRegion || '', anfrageSprachen,
          matchGruende: matchGruende || [], matchScore: matchScore || 0,
        }), 'match_freigabe_interessent'),
    ])

    return res.status(200).json({
      success: true,
      gesendetAn: {
        suchender: { email: suchendeEmail, erfolg: r1.success },
        interessent: { email: interessentEmail, erfolg: r2.success },
      },
    })
  }

  if (typ === 'match_paket') {
    const {
      suchendeEmail, suchenderName, anfrageFirma, anfrageTelefon, anfrageWebsite, anfrageLinkedin, anfrageSprachen,
      interessentEmail, interessentName, interessentFirma, interessentTelefon, interessentWebsite, interessentLinkedin, interessentSprachen,
      empfohlenerErstkontakt, empfohleneSprache, projektziel, hinweise,
    } = body
    if (!suchendeEmail || !interessentEmail) return res.status(400).json({ error: 'E-Mail-Adressen fehlen' })

    const [r1, r2] = await Promise.all([
      sendeEmail(suchendeEmail, `📦 Easy-B2B Match-Paket: Kontaktdaten ${interessentFirma}`,
        baueMatchPaketMail({
          empfaengerName: suchenderName || 'Ansprechpartner', empfaengerFirma: anfrageFirma,
          partnerFirma: interessentFirma, partnerName: interessentName || 'Ansprechpartner', partnerEmail: interessentEmail,
          partnerTelefon: interessentTelefon, partnerWebsite: interessentWebsite, partnerLinkedin: interessentLinkedin,
          partnerSprachen: interessentSprachen, empfohlenerErstkontakt: empfohlenerErstkontakt || 'suchender',
          empfohleneSprache: empfohleneSprache || 'Deutsch', projektziel: projektziel || '', hinweise: hinweise || [],
        }), 'match_paket_suchender'),
      sendeEmail(interessentEmail, `📦 Easy-B2B Match-Paket: Kontaktdaten ${anfrageFirma}`,
        baueMatchPaketMail({
          empfaengerName: interessentName || 'Ansprechpartner', empfaengerFirma: interessentFirma,
          partnerFirma: anfrageFirma, partnerName: suchenderName || 'Ansprechpartner', partnerEmail: suchendeEmail,
          partnerTelefon: anfrageTelefon, partnerWebsite: anfrageWebsite, partnerLinkedin: anfrageLinkedin,
          partnerSprachen: anfrageSprachen, empfohlenerErstkontakt: empfohlenerErstkontakt || 'suchender',
          empfohleneSprache: empfohleneSprache || 'Deutsch', projektziel: projektziel || '', hinweise: hinweise || [],
        }), 'match_paket_interessent'),
    ])

    return res.status(200).json({
      success: true,
      gesendetAn: {
        suchender: { email: suchendeEmail, erfolg: r1.success },
        interessent: { email: interessentEmail, erfolg: r2.success },
      },
    })
  }

  return res.status(400).json({ error: `Unbekannter Typ: ${typ}` })
}

async function testVorlage(body, res) {
  const { betreff, vorlageName } = body
  if (!betreff || !vorlageName) {
    return res.status(400).json({ error: 'Betreff und Vorlagenname sind erforderlich' })
  }
  const html = baueTestVorlageMail(body)
  const result = await sendeEmail(TEST_EMPFAENGER, betreff, html, `test-vorlage:${body.vorlageTyp}`)
  if (result.success) return res.status(200).json({ success: true, an: TEST_EMPFAENGER })
  return res.status(500).json({ success: false, error: result.error || 'Sendefehler' })
}
