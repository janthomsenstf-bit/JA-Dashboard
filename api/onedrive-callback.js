/**
 * /api/onedrive-callback
 *
 * Kombinierter OAuth-Endpoint:
 *   - Ohne code/error → startet den OAuth-Flow (Redirect zu Microsoft)
 *   - Mit code/error  → empfängt den Authorization Code, tauscht ihn gegen Tokens
 *                        und sendet das Ergebnis per postMessage an das Opener-Fenster
 */
export default async function handler(req, res) {
  const { code, error, error_description } = req.query

  // ── Auth-Start (kein code/error → Redirect zu Microsoft) ──────────────────
  if (!code && !error) {
    const clientId    = process.env.ONEDRIVE_CLIENT_ID
    const redirectUri = process.env.ONEDRIVE_REDIRECT_URI

    if (!clientId || !redirectUri) {
      return res.status(500).send('<h2>Fehler: ONEDRIVE_CLIENT_ID oder ONEDRIVE_REDIRECT_URI fehlt.</h2>')
    }

    const params = new URLSearchParams({
      client_id:     clientId,
      response_type: 'code',
      redirect_uri:  redirectUri,
      scope:         'Files.ReadWrite offline_access User.Read Mail.Send',
      response_mode: 'query',
      prompt:        'select_account',
    })

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
    return res.redirect(302, authUrl)
  }

  // ── Callback (code oder error von Microsoft) ──────────────────────────────
  function sendResult(payload) {
    const json = JSON.stringify(payload)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.status(200).send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>OneDrive verbinden</title></head>
<body>
<p style="font-family:sans-serif;padding:24px;color:#555">Verbinde mit OneDrive…</p>
<script>
  try {
    window.opener.postMessage({ type: 'onedrive-auth', ...${json} }, '*')
  } catch(e) {}
  window.close()
</script>
</body>
</html>`)
  }

  if (error) {
    return sendResult({ success: false, error, error_description })
  }

  const clientId     = process.env.ONEDRIVE_CLIENT_ID
  const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET
  const redirectUri  = process.env.ONEDRIVE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return sendResult({ success: false, error: 'server_config_missing' })
  }

  try {
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        code,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
        scope:         'Files.ReadWrite offline_access User.Read',
      }).toString(),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || tokenData.error) {
      return sendResult({ success: false, error: tokenData.error ?? 'token_error', error_description: tokenData.error_description })
    }

    const tokens = {
      accessToken:  tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt:    Date.now() + (tokenData.expires_in ?? 3600) * 1000,
      scope:        tokenData.scope,
      tokenType:    tokenData.token_type ?? 'Bearer',
    }

    return sendResult({ success: true, tokens })
  } catch (err) {
    return sendResult({ success: false, error: 'fetch_failed', error_description: String(err) })
  }
}
