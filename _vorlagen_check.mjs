// Prüf-Werkzeug für die Mandanten-Vorlagen (nicht Teil der App).
//   node _vorlagen_check.mjs <vorlagen-id> <ausgabe-basis>       → PDF + PNG je Seite
//   node _vorlagen_check.mjs --pos <pdf> <seite>                 → Textpositionen in mm
// Damit lässt sich eine neue Vorlage Zeile für Zeile mit dem Muster vergleichen.
import fs from 'node:fs'
import { createCanvas } from '@napi-rs/canvas'
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

async function positionen(datei, seite = 1) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(datei)), verbosity: 0 }).promise
  const page = await doc.getPage(Number(seite))
  const vp = page.getViewport({ scale: 1 })
  const mm = v => (v * 25.4 / 72).toFixed(1)
  for (const i of (await page.getTextContent()).items) {
    if (!i.str.trim()) continue
    console.log(`x=${mm(i.transform[4]).padStart(6)}  y=${mm(vp.height - i.transform[5]).padStart(6)}  ${i.str.slice(0, 70)}`)
  }
}

async function rendern(pdfDatei, basis) {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(pdfDatei)),
    standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/',
    verbosity: 0,
  }).promise
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const vp = page.getViewport({ scale: 1.6 })
    const canvas = createCanvas(vp.width, vp.height)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, vp.width, vp.height)
    await page.render({ canvasContext: ctx, viewport: vp }).promise
    fs.writeFileSync(`${basis}-${p}.png`, canvas.toBuffer('image/png'))
    console.log('Seite', p, '→', `${basis}-${p}.png`)
  }
}

const [a, b, c] = process.argv.slice(2)
if (a === '--pos') { await positionen(b, c) }
else {
  const { VORLAGEN } = await import('./src/utils/vorlagen/index.js')
  const v = VORLAGEN.find(x => x.id === a) ?? VORLAGEN[0]
  const demo = {
    id: 'demo', name: 'Nordisk Møbler GmbH', rechtsform: 'GmbH', steuernummer: '15/123/45678',
    anschriften: [{ typ: 'post', text: 'Hauptstraße 24a, 24986 Mittelangeln' }],
    geburtsdatum: '13.12.1967', steuerIdNr: '12 345 678 901',
    finanzamt: 'Finanzamt Flensburg', finanzamtStrasse: 'Duburger Str. 58-64', finanzamtPlzOrt: '24939 Flensburg',
    geschaeftsfuehrer: [{ name: 'Thomsen, Jan' }],
    vorlagenDaten: { vertreterGeburtsdatum: '17.04.1980', vertreterAnschrift: 'Am Deich 3, 24937 Flensburg' },
  }
  const { werteFuerVorlage } = await import('./src/utils/vorlagen/index.js')
  const { werte } = werteFuerVorlage(v, demo)
  const pdf = `${b ?? 'vorlage'}.pdf`
  fs.writeFileSync(pdf, Buffer.from(v.build(werte).output('arraybuffer')))
  console.log('PDF:', pdf, '|', v.titel)
  await rendern(pdf, b ?? 'vorlage')
}
