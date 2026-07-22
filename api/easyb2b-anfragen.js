/**
 * api/easyb2b-anfragen.js
 *
 * GET   /api/easyb2b-anfragen  →  Anfragen aus der Neon-Datenbank
 * PATCH /api/easyb2b-anfragen  →  Status einer Anfrage setzen  { id, status }
 *
 * Übernommen aus dem eigenständigen Easy-B2B-Dashboard
 * (app/api/anfragen/route.ts). Die SQL-Abfragen und die Feldabbildung sind
 * unverändert; angepasst wurde nur die Aufrufform: Next.js-Routen
 * (GET/PATCH als getrennte Exporte, NextResponse) → Vercel-Funktion
 * (ein Handler, req/res), wie bei den übrigen Funktionen dieses Projekts.
 *
 * Die Datenbank bleibt dieselbe. Es wird keine Struktur geändert und
 * ausschließlich der Status geschrieben – wie bisher.
 *
 * Voraussetzung: Umgebungsvariable DATABASE_URL (Neon-Verbindung).
 * Fehlt sie, antwortet die Funktion mit einem klaren Hinweis statt
 * abzustürzen; der Bereich fällt dann auf Beispieldaten zurück.
 */

import pg from 'pg'

const { Pool } = pg

let pool = null
function holePool() {
  if (!process.env.DATABASE_URL) return null
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
  }
  return pool
}

/**
 * Liest ein Feld tolerant gegenüber der Schreibweise.
 *
 * Hintergrund: In der Abfrage stehen gequotete Spalten wie a."anzeigenId".
 * PostgreSQL behält dort die Groß-/Kleinschreibung bei, der Treiber liefert
 * also `anzeigenId`. Im Ursprungscode wurde teils `row.anzeigenid`
 * (kleingeschrieben) gelesen, was undefined ergeben hätte. Statt das hier
 * einseitig zu entscheiden, werden beide Schreibweisen akzeptiert – das kann
 * kein bisher funktionierendes Verhalten verschlechtern.
 */
function feld(row, ...namen) {
  for (const n of namen) {
    if (row[n] !== undefined && row[n] !== null) return row[n]
  }
  return undefined
}

function alsDatum(wert) {
  if (!wert) return undefined
  return new Date(wert).toISOString().split('T')[0]
}

function mapStatus(dbStatus) {
  const map = {
    eingehend: 'eingehend',
    aktiv: 'aktiv',
    interessent_vorhanden: 'interessent_vorhanden',
    mehrere_interessenten: 'interessent_vorhanden',
    kontakt_laeuft: 'aktiv',
    vermittelt: 'vermittelt',
    stalled: 'pausiert',
    pausiert: 'pausiert',
    archiviert: 'archiviert',
  }
  return map[dbStatus] || dbStatus
}

function mapMarktplatzStatus(dbStatus) {
  if (dbStatus === 'aktiv' || dbStatus === 'interessent_vorhanden' || dbStatus === 'mehrere_interessenten' || dbStatus === 'kontakt_laeuft') return 'veroeffentlicht'
  if (dbStatus === 'eingehend') return 'intern'
  if (dbStatus === 'pausiert' || dbStatus === 'stalled') return 'pausiert'
  if (dbStatus === 'vermittelt') return 'archiviert'
  if (dbStatus === 'archiviert') return 'archiviert'
  return 'intern'
}

const ABFRAGE = `
  SELECT
    a.id,
    a."anzeigenId",
    a.firmenname,
    a.standort,
    a.richtung::text,
    a.art::text,
    a.beschreibung,
    a.ziel,
    a.status::text,
    a.sichtbarkeit::text,
    a.ansprechpartner,
    a.email,
    a.telefon,
    a."createdAt",
    a."gueltigBis",
    a.reifegrad::text,
    a."persönlicherTouch",
    a."mustHaves",
    a."niceToHaves",
    b.name AS branche_name,
    COUNT(i.id)::int AS interessenten_count
  FROM "Anfrage" a
  LEFT JOIN "Branche" b ON b.id = a."brancheId"
  LEFT JOIN "Interessent" i ON i."anfrageId" = a.id
  GROUP BY a.id, b.name
  ORDER BY a."createdAt" DESC
`

export default async function handler(req, res) {
  const p = holePool()
  if (!p) {
    return res.status(503).json({
      error: 'Keine Datenbankverbindung konfiguriert. Die Umgebungsvariable DATABASE_URL fehlt.',
    })
  }

  if (req.method === 'GET')   return holeAnfragen(p, res)
  if (req.method === 'PATCH') return setzeStatus(p, req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function holeAnfragen(p, res) {
  try {
    const client = await p.connect()
    try {
      const result = await client.query(ABFRAGE)

      const anfragen = result.rows.map(row => {
        const status      = feld(row, 'status')
        const rohStatus   = mapStatus(status)
        const erstelltAm  = alsDatum(feld(row, 'createdAt', 'createdat'))
        const gueltigBis  = alsDatum(feld(row, 'gueltigBis', 'gueltigbis'))
        const mustHaves   = feld(row, 'mustHaves', 'musthaves')
        const branche     = feld(row, 'branche_name') || 'Sonstige'
        const touch       = feld(row, 'persönlicherTouch')
        const marktplatz  = mapMarktplatzStatus(status)

        return {
          id: row.id,
          anzeigenId: feld(row, 'anzeigenId', 'anzeigenid'),
          firmenname: row.firmenname,
          standort: row.standort,
          richtung: row.richtung,
          art: row.art,
          branche,
          beschreibung: row.beschreibung,
          ziel: row.ziel,
          status: rohStatus,
          sichtbarkeit: row.sichtbarkeit,
          sprachen: [],
          ansprechpartner: row.ansprechpartner,
          email: row.email,
          telefon: row.telefon || undefined,
          interessentenCount: feld(row, 'interessenten_count') || 0,
          createdAt: erstelltAm ?? '',
          marktplatzStatus: marktplatz,
          gueltigBis,
          'persönlicherTouch': touch,
          mustHaves,
          niceToHaves: feld(row, 'niceToHaves', 'nicetohaves'),
          marktplatzDaten: rohStatus === 'aktiv' || status === 'interessent_vorhanden' ? {
            titel: row.ziel,
            kurzbeschreibung: row.beschreibung?.slice(0, 250) || '',
            branche: feld(row, 'branche_name') || '',
            richtung: row.richtung,
            region: row.standort,
            wasSuche: row.ziel,
            warumGesucht: row.beschreibung || '',
            anforderungen: mustHaves,
            persoenlicheNote: touch,
            sichtbarkeit: row.sichtbarkeit,
            funFactFreigegeben: false,
            laufzeitMonate: 3,
          } : undefined,
          veroeffentlichtAm: marktplatz === 'veroeffentlicht' ? erstelltAm : undefined,
          ablaufDatum: gueltigBis,
        }
      })

      return res.status(200).json(anfragen)
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[Easy-B2B GET /anfragen]', error)
    return res.status(500).json({ error: 'Datenbankfehler' })
  }
}

async function setzeStatus(p, req, res) {
  try {
    const { id, status } = req.body ?? {}
    if (!id || !status) return res.status(400).json({ error: 'id und status erforderlich' })

    const client = await p.connect()
    try {
      await client.query(
        'UPDATE "Anfrage" SET status = $1::"AnfrageStatus", "updatedAt" = NOW() WHERE id = $2',
        [status, id],
      )
      return res.status(200).json({ success: true })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[Easy-B2B PATCH /anfragen]', error)
    return res.status(500).json({ error: 'Datenbankfehler' })
  }
}
