/**
 * /api/mail-auth
 * Startet einen separaten OAuth-Flow nur für Mail.Read.
 * Wird nur aufgerufen wenn der Nutzer die Outlook-Suche verwenden möchte.
 * Nutzt "incremental consent" – fragt gezielt nur Mail.Read an.
 */
export default function handler(req, res) {
  const clientId    = process.env.ONEDRIVE_CLIENT_ID
  const redirectUri = process.env.ONEDRIVE_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return res.status(500).send('<h2>Fehler: ONEDRIVE_CLIENT_ID fehlt.</h2>')
  }

  const params = new URLSearchParams({
    client_id:     clientId,
    response_type: 'code',
    redirect_uri:  redirectUri,
    // Alle Scopes auf einmal – Microsoft erteilt was bereits genehmigt ist
    // und fragt nur neu nach Mail.Read
    scope:         'Files.ReadWrite offline_access User.Read Mail.Send Mail.Read',
    response_mode: 'query',
    prompt:        'consent',   // Erzwingt explizite Zustimmung für neuen Scope
  })

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
  res.redirect(302, authUrl)
}
