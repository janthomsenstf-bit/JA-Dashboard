# MCP-Server für das Spielbuch (BP 5) – Einrichtung

Ziel: Vom **Handy / Cowork / Chat** einen Satz sagen wie „leg bei Müller eine Aufgabe an,
Frist morgen" → er landet **sicher** im Spielbuch als Vorgang und wird dort ausgeführt.

## Wie es sicher funktioniert (kein Roh-Schreiben)

```
Du (Cowork/Handy)  →  MCP-Server  →  POST /api/ai-aktion  →  bot_inbox (intent 'ai_aktion')
                                                                   │
Spielbuch liest bot_inbox → zeigt Vorgang in „AI-Empfehlungen" → du bestätigst → App führt aus
```

Der MCP schreibt **nie** direkt in Mandantendaten. Er meldet nur einen Vorgang; die
Ausführung passiert in der App über die vorhandenen sicheren Setter (wie bei den
Dokument-Vorschlägen).

## Was schon steht ✅

- **`/api/ai-aktion.js`** – die Vordertür (deployt). Secret **erforderlich** → ohne
  Konfiguration inaktiv (503), also auch öffentlich ungefährlich.
- Die **AI-Empfehlungen-Liste** in der App (führt Vorgänge sicher aus).
- Bewährtes `bot_inbox`-Muster (dieselbe Tabelle wie die Dokument-Vorschläge).

## Was NUR DU tun kannst (Konto/Config) 🔑

1. **Secret setzen** – im Vercel-Projekt `ja-dashboard` → Settings → Environment Variables:
   `AI_AKTION_SECRET = <langer Zufallswert>`  (Redeploy auslösen).
   `SUPABASE_SERVICE_ROLE_KEY` ist schon gesetzt (die Dokument-Vorschläge nutzen ihn).
2. **MCP-Server registrieren** – siehe unten (in Claude Desktop / Cowork als Connector).

## Was wir noch zusammen bauen (kurz, überwacht) 🔧

- **App liest `bot_inbox` (intent 'ai_aktion')** und mischt die Zeilen als Vorgänge in
  die AI-Empfehlungen-Liste. (Read-only; die App hat den Supabase-Client bereits.)
  Erst danach *erscheint* ein per Handy gemeldeter Vorgang in der App. Das ist der
  letzte Klick zum End-to-End-Betrieb – bewusst zusammen, weil es die Datenschicht berührt.

---

## Der MCP-Server (fertiger Code – in eigenen Ordner legen)

`spielbuch-mcp/package.json`
```json
{
  "name": "spielbuch-mcp",
  "version": "1.0.0",
  "type": "module",
  "bin": { "spielbuch-mcp": "index.mjs" },
  "dependencies": { "@modelcontextprotocol/sdk": "^1.0.0" }
}
```

`spielbuch-mcp/index.mjs`
```js
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const BASE   = process.env.SPIELBUCH_URL || 'https://ja-dashboard-three.vercel.app'
const SECRET = process.env.AI_AKTION_SECRET
const url = () => `${BASE}/api/ai-aktion?secret=${encodeURIComponent(SECRET || '')}`

async function meldeVorgang(vorgang) {
  const r = await fetch(url(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vorgang }),
  })
  return await r.json()
}

const server = new McpServer({ name: 'spielbuch', version: '1.0.0' })

// Freie Meldung eines Vorgangs (beliebige Katalog-Aktionen).
server.tool('vorgang_melden',
  { titel: z.string(), mandantName: z.string().optional(),
    empfehlung: z.string().optional(),
    aktionen: z.array(z.object({ id: z.string(), parameter: z.record(z.any()).optional() })) },
  async (v) => ({ content: [{ type: 'text', text: JSON.stringify(await meldeVorgang(v)) }] }))

// Bequemer Kurzbefehl: eine Aufgabe anlegen.
server.tool('aufgabe_anlegen',
  { titel: z.string(), mandantName: z.string().optional(),
    faelligkeit: z.string().optional().describe('YYYY-MM-DD'), beschreibung: z.string().optional() },
  async ({ titel, mandantName, faelligkeit, beschreibung }) => {
    const res = await meldeVorgang({
      titel: `Aufgabe: ${titel}`, mandantName, empfehlung: 'Aufgabe anlegen',
      aktionen: [{ id: 'aufgabe_anlegen', parameter: { titel, mandantName, faelligkeit, beschreibung } }],
    })
    return { content: [{ type: 'text', text: JSON.stringify(res) }] }
  })

await server.connect(new StdioServerTransport())
```

Installieren & registrieren (Claude Desktop / Cowork, `mcpServers`-Konfig):
```json
{
  "mcpServers": {
    "spielbuch": {
      "command": "node",
      "args": ["/PFAD/zu/spielbuch-mcp/index.mjs"],
      "env": {
        "SPIELBUCH_URL": "https://ja-dashboard-three.vercel.app",
        "AI_AKTION_SECRET": "<derselbe Wert wie in Vercel>"
      }
    }
  }
}
```
(`npm install` im Ordner `spielbuch-mcp` vorher.)

## Test (wenn Secret gesetzt)
```bash
curl -s -X POST "https://ja-dashboard-three.vercel.app/api/ai-aktion?secret=DEINSECRET" \
  -H "Content-Type: application/json" \
  -d '{"vorgang":{"titel":"Testaufgabe","mandantName":"Müller GmbH","aktionen":[{"id":"aufgabe_anlegen","parameter":{"titel":"Test vom MCP","faelligkeit":"2026-08-20"}}]}}'
```
Erwartet: `{"angelegt":1,"id":"…"}`. Danach (nach der App-Integration oben) erscheint der
Vorgang in „AI-Empfehlungen".
