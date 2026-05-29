/**
 * /api/telegram-setup
 *
 * Einmalige Hilfsfunktion (GET) zum Registrieren des Telegram-Webhooks.
 * Aufruf: https://deine-vercel-url.vercel.app/api/telegram-setup
 *
 * Umgebungsvariablen:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_WEBHOOK_SECRET
 *   VERCEL_URL  (wird automatisch von Vercel gesetzt)
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' })
  }

  const token  = process.env.TELEGRAM_BOT_TOKEN
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  const host   = process.env.VERCEL_URL || req.headers.host

  if (!token) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN nicht gesetzt' })
  }

  const webhookUrl = `https://${host}/api/telegram-webhook`
  const apiUrl = `https://api.telegram.org/bot${token}/setWebhook`

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secret || undefined,
        allowed_updates: ['message'],
      }),
    })

    const data = await response.json()

    return res.status(200).json({
      success: data.ok,
      webhook_url: webhookUrl,
      telegram_response: data,
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
