/**
 * mailFormat.js – Hilfsfunktionen für formatierte Rechnungs-E-Mails.
 *
 * sevDesk rendert den Mailtext als HTML → reiner Text mit \n käme als Fließtext
 * an (Zeilenumbrüche gehen verloren). Daher Text nach HTML wandeln.
 */

/** Escaped HTML-Sonderzeichen und wandelt Zeilenumbrüche in <br>. */
export function plainToHtml(text) {
  const esc = String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return esc.replace(/\r\n|\r|\n/g, '<br>')
}

/**
 * Baut den finalen Mail-Body als HTML aus Anschreiben + optionaler Signatur.
 * Signatur wird durch eine Leerzeile abgesetzt.
 */
export function buildMailHtml(anschreiben, signaturText) {
  const teile = [String(anschreiben ?? '').trim()]
  const sig = String(signaturText ?? '').trim()
  if (sig) teile.push(sig)
  return plainToHtml(teile.join('\n\n'))
}
