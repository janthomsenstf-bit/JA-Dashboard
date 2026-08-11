/**
 * agentClient.js – Die Agenten-Schleife des Co-Trainers.
 *
 * Ruft Claude mit Werkzeugen (Tool Use) auf. Solange Claude Werkzeuge anfordert,
 * führen wir sie lokal aus (agentTools) und geben das Ergebnis zurück – bis Claude
 * eine finale Textantwort gibt. Der Anthropic-Key ist derselbe wie im übrigen
 * Dashboard (Stammdaten → API-Schlüssel).
 *
 * Rein lesend: Alle V1-Werkzeuge verändern nichts (siehe agentTools.js).
 */

import { loadClaudeKey } from './aiClient.js'
import { werkzeugeFuerSkill, fuehreWerkzeugAus } from './agentTools.js'

// Modell bewusst gleich wie im übrigen Dashboard (bewährt mit dem hinterlegten Key).
const MODEL = 'claude-sonnet-4-6'
const MAX_RUNDEN = 8

function systemPrompt(skill, offenerMandantName) {
  const basis =
    'Du bist der „Co-Trainer" im Steuerkanzlei-Dashboard „Spielbuch" von Jan. ' +
    'Du hilfst per Chat, indem du die vorhandenen Werkzeuge benutzt, um echte Daten aus dem Dashboard nachzuschlagen. ' +
    'Antworte auf Deutsch, knapp, sachlich und in Stichpunkten, wenn es passt. ' +
    'Erfinde niemals Daten – nur, was die Werkzeuge liefern. Findest du nichts, sag das offen. ' +
    'Wenn der Nutzer einen Mandanten nennt, rufe zuerst „mandant_finden" auf. ' +
    'Gibt es mehrere Treffer, frage kurz nach, welcher gemeint ist, statt zu raten.'
  const kontext = offenerMandantName
    ? ` Aktuell ist im Dashboard der Mandant „${offenerMandantName}" geöffnet – beziehe dich darauf, wenn kein anderer genannt wird.`
    : ''
  const auftrag = skill?.anweisung
    ? `\n\nAktueller Skill „${skill.name}": ${skill.anweisung}`
    : ''
  return basis + kontext + auftrag
}

/**
 * runAgent – führt einen Chat-Zug aus.
 *
 * @param {object}   opts
 * @param {Array}    opts.messages   Bisheriger Verlauf im Anthropic-Format ({role, content}).
 * @param {object}   [opts.skill]    Aktiver Skill (bestimmt Anweisung + erlaubte Werkzeuge).
 * @param {Array}    opts.clients    Mandanten (für die Werkzeuge; rein lesend).
 * @param {string}   [opts.offenerMandantName]
 * @param {function} [opts.onEvent]  Fortschritt: ({typ:'werkzeug', name} | {typ:'text', text}).
 * @returns {Promise<{text:string, entwurf:object|null, messages:Array}>}
 */
export async function runAgent({ messages, skill, clients, offenerMandantName, onEvent }) {
  const key = loadClaudeKey()
  if (!key) throw new Error('Claude API-Schlüssel fehlt (Stammdaten → ⚙️ → API-Schlüssel).')

  const tools = werkzeugeFuerSkill(skill?.werkzeuge)
  const system = systemPrompt(skill, offenerMandantName)
  const verlauf = [...messages]
  let entwurf = null

  for (let runde = 0; runde < MAX_RUNDEN; runde++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system,
        tools,
        messages: verlauf,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error('Claude: ' + (err.error?.message ?? `HTTP ${res.status}`))
    }

    const data = await res.json()
    const content = data.content ?? []
    // Antwort des Assistenten in den Verlauf übernehmen.
    verlauf.push({ role: 'assistant', content })

    if (data.stop_reason === 'tool_use') {
      // Alle angeforderten Werkzeuge ausführen und die Ergebnisse zurückgeben.
      const tool_results = []
      for (const block of content) {
        if (block.type !== 'tool_use') continue
        onEvent?.({ typ: 'werkzeug', name: block.name, input: block.input })
        const ergebnis = fuehreWerkzeugAus(block.name, block.input, { clients })
        if (ergebnis && ergebnis._entwurf) entwurf = ergebnis
        tool_results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(ergebnis),
        })
      }
      verlauf.push({ role: 'user', content: tool_results })
      continue // nächste Runde: Claude verarbeitet die Ergebnisse
    }

    // Fertige Textantwort
    const text = content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
    onEvent?.({ typ: 'text', text })
    return { text, entwurf, messages: verlauf }
  }

  return {
    text: 'Ich habe zu viele Zwischenschritte gebraucht und höre hier lieber auf. Magst du die Frage etwas eingrenzen?',
    entwurf,
    messages: verlauf,
  }
}
