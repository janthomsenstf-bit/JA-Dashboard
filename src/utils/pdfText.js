/**
 * pdfText.js – Textlayer aus einer PDF lesen (lokal, im Browser).
 * (Bereich „Dokumente / Post-Service", Stufe 2b-1)
 *
 * Strategie laut Konzept: ZUERST den eingebetteten Text einer PDF auslesen
 * (viele Bank-/Behörden-PDFs und E-Rechnungen enthalten ihn – ohne OCR, sofort).
 * Nur echte Bild-Scans ohne Textlayer brauchen später den OCR-Fallback (2b-2).
 *
 * Es verlässt kein Dokument das Gerät: pdf.js läuft vollständig im Browser.
 */

/** Ab wie vielen Textzeichen eine PDF als „hat Textlayer" gilt (sonst Bild-Scan). */
export const TEXTLAYER_SCHWELLE = 40

// pdf.js (~1 MB) wird NUR bei Bedarf geladen (dynamischer Import), damit es nicht
// im Haupt-Bundle des Dashboards liegt. Einmal geladen, wird es gecacht.
let _pdfjs = null
async function ladePdfjs() {
  if (_pdfjs) return _pdfjs
  const pdfjsLib = await import('pdfjs-dist')
  // Vite bündelt den Worker als Asset; import.meta.url liefert die richtige URL.
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href
  _pdfjs = pdfjsLib
  return pdfjsLib
}

/**
 * Liest den Textlayer einer PDF.
 * @param {ArrayBuffer} arrayBuffer – Roh-Bytes der PDF
 * @returns {Promise<{ text: string, seiten: number, hatTextlayer: boolean }>}
 */
export async function pdfTextExtrahieren(arrayBuffer) {
  const pdfjsLib = await ladePdfjs()
  // Kopie, da pdf.js den Puffer intern übernimmt (detached ArrayBuffer vermeiden).
  const daten = new Uint8Array(arrayBuffer.slice(0))
  const doc = await pdfjsLib.getDocument({ data: daten }).promise
  try {
    let text = ''
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map(it => (it.str ?? '')).join(' ') + '\n'
      page.cleanup()
    }
    const sauber = text.replace(/[ \t]+\n/g, '\n').trim()
    return {
      text: sauber,
      seiten: doc.numPages,
      hatTextlayer: sauber.replace(/\s/g, '').length >= TEXTLAYER_SCHWELLE,
    }
  } finally {
    doc.destroy()
  }
}
