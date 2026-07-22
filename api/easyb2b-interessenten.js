/**
 * api/easyb2b-interessenten.js
 *
 * GET   /api/easyb2b-interessenten  →  Interessenten aus der Neon-Datenbank
 * PATCH /api/easyb2b-interessenten  →  Status setzen  { id, status, freigegeben }
 *
 * Übernommen aus dem eigenständigen Easy-B2B-Dashboard
 * (app/api/interessenten/route.ts). SQL und Feldabbildung unverändert;
 * angepasst wurde nur die Aufrufform (Next.js-Route → Vercel-Funktion).
 *
 * Voraussetzung: Umgebungsvariable DATABASE_URL (Neon-Verbindung).
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

/** Liest ein Feld tolerant gegenüber der Schreibweise – siehe easyb2b-anfragen.js. */
function feld(row, ...namen) {
  for (const n of namen) {
    if (row[n] !== undefined && row[n] !== null) return row[n]
  }
  return undefined
}

function mapInteressentStatus(dbStatus, freigegeben) {
  if (freigegeben && dbStatus === 'neu') return 'freigegeben'
  const map = {
    neu: 'neu',
    freigegeben: 'freigegeben',
    kontakt_laeuft: 'kontakt_laeuft',
    feedback_ausstehend: 'feedback_ausstehend',
    erfolgreich: 'erfolgreich',
    spam: 'spam',
    unqualifiziert: 'abgelehnt',
    stalled: 'abgelehnt',
    abgelehnt: 'abgelehnt',
  }
  return map[dbStatus] || 'neu'
}

function mapStatusToDb(status) {
  const map = {
    neu: 'neu',
    freigegeben: 'freigegeben',
    kontakt_laeuft: 'kontakt_laeuft',
    feedback_ausstehend: 'feedback_ausstehend',
    erfolgreich: 'erfolgreich',
    spam: 'spam',
    abgelehnt: 'abgelehnt',
  }
  return map[status] || 'neu'
}

const ABFRAGE = `
  SELECT
    i.id,
    i."anfrageId",
    i.firmenname,
    i.ansprechpartner,
    i.email,
    i.telefon,
    i.status::text,
    i."matchScore",
    i."createdAt",
    i.notiz,
    i.freigegeben,
    a."anzeigenId",
    a.firmenname AS anfrage_firma
  FROM "Interessent" i
  LEFT JOIN "Anfrage" a ON a.id = i."anfrageId"
  ORDER BY i."createdAt" DESC
`

export default async function handler(req, res) {
  const p = holePool()
  if (!p) {
    return res.status(503).json({
      error: 'Keine Datenbankverbindung konfiguriert. Die Umgebungsvariable DATABASE_URL fehlt.',
    })
  }

  if (req.method === 'GET')   return holeInteressenten(p, res)
  if (req.method === 'PATCH') return setzeStatus(p, req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}

async function holeInteressenten(p, res) {
  try {
    const client = await p.connect()
    try {
      const result = await client.query(ABFRAGE)

      const interessenten = result.rows.map(row => {
        const erstellt = feld(row, 'createdAt', 'createdat')
        return {
          id: row.id,
          anfrageId: feld(row, 'anfrageId', 'anfrageid'),
          anfrageFirma: feld(row, 'anfrage_firma') || '',
          anzeigenId: feld(row, 'anzeigenId', 'anzeigenid') || '',
          firmenname: row.firmenname,
          ansprechpartner: row.ansprechpartner,
          email: row.email,
          telefon: row.telefon || undefined,
          status: mapInteressentStatus(feld(row, 'status'), row.freigegeben),
          matchScore: feld(row, 'matchScore', 'matchscore'),
          createdAt: erstellt ? new Date(erstellt).toISOString().split('T')[0] : '',
          notiz: row.notiz || undefined,
          // Felder, die die Datenbank nicht führt – Vorgaben wie bisher
          sprachen: [],
          matchGruende: [],
          matchRisiken: [],
          ersteindruck: 'neutral',
          passung: 'mittel',
          seriositaet: 'ungeprueft',
        }
      })

      return res.status(200).json(interessenten)
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[Easy-B2B GET /interessenten]', error)
    return res.status(500).json({ error: 'Datenbankfehler' })
  }
}

async function setzeStatus(p, req, res) {
  try {
    const { id, status, freigegeben } = req.body ?? {}
    if (!id) return res.status(400).json({ error: 'id erforderlich' })

    const client = await p.connect()
    try {
      await client.query(
        'UPDATE "Interessent" SET status = $1::"InteressentStatus", freigegeben = $2, "updatedAt" = NOW() WHERE id = $3',
        [mapStatusToDb(status), freigegeben ?? false, id],
      )
      return res.status(200).json({ success: true })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[Easy-B2B PATCH /interessenten]', error)
    return res.status(500).json({ error: 'Datenbankfehler' })
  }
}
