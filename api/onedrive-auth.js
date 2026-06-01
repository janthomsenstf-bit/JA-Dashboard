/**
 * /api/onedrive-auth
 * Startet den Microsoft OAuth 2.0 Authorization Code Flow.
 * Öffnet in einem Popup-Fenster und leitet zu Microsoft weiter.
 */
export default function handler(req, res) {
  const clientId    = process.env.ONEDRIVE_CLIENT_ID
  const redirectUri = process.env.ONEDRIVE_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return res.status(500).send('<h2>Fehler: ONEDRIVE_CLIENT_ID oder ONEDRIVE_REDIRECT_URI fehlt.</h2>')
  }

  const params = new URLSearchParams({
    client_id:     clientId,
    response_type: 'code',
    redirect_uri:  redirectUri,
    scope:         'Files.ReadWrite offline_access User.Read Mail.Read Mail.Send',
    response_mode: 'query',
    prompt:        'select_account',
  })

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
  res.redirect(302, authUrl)
}
