/**
 * aiClient.js – Gemeinsame KI-Abstraktionsschicht
 * Unterstützt: Claude (Anthropic) und ChatGPT (OpenAI)
 *
 * Nutzung:
 *   import { callAI, loadAiProvider, loadAiProviderKey } from '../../utils/aiClient.js'
 *   const result = await callAI(systemPrompt, userText)
 *   // result ist immer: { text: "..." } oder JSON-Objekt
 */

// ── Storage-Keys ──────────────────────────────────────────────────────────────
export const CLAUDE_KEY_STORAGE    = 'sda-claude-api-key'
export const OPENAI_KEY_STORAGE    = 'sda-openai-api-key'
export const AI_PROVIDER_STORAGE   = 'sda-ai-provider'   // 'claude' | 'openai'
export const OPENAI_MODEL_STORAGE  = 'sda-openai-model'  // z.B. 'gpt-4o-mini'

// ── Lesen / Schreiben ─────────────────────────────────────────────────────────
export function loadAiProvider()   { return localStorage.getItem(AI_PROVIDER_STORAGE) ?? 'claude' }
export function saveAiProvider(p)  { localStorage.setItem(AI_PROVIDER_STORAGE, p) }

export function loadClaudeKey()    { return (localStorage.getItem(CLAUDE_KEY_STORAGE)   ?? '').replace(/\s/g, '') }
export function saveClaudeKey(k)   { localStorage.setItem(CLAUDE_KEY_STORAGE, k) }

export function loadOpenAiKey()    { return (localStorage.getItem(OPENAI_KEY_STORAGE)   ?? '').replace(/\s/g, '') }
export function saveOpenAiKey(k)   { localStorage.setItem(OPENAI_KEY_STORAGE, k) }

export function loadOpenAiModel()  { return localStorage.getItem(OPENAI_MODEL_STORAGE) ?? 'gpt-4o-mini' }
export function saveOpenAiModel(m) { localStorage.setItem(OPENAI_MODEL_STORAGE, m) }

/** Gibt den aktiven API-Key zurück (je nach Anbieter) */
export function loadAiProviderKey() {
  return loadAiProvider() === 'openai' ? loadOpenAiKey() : loadClaudeKey()
}

/** Prüft ob ein gültiger Key vorhanden ist */
export function hasAiKey() {
  return !!loadAiProviderKey()
}

// ── Gemeinsamer Aufrufer ──────────────────────────────────────────────────────
/**
 * callAI(systemPrompt, userText)
 * Ruft Claude oder OpenAI auf – je nach Einstellung.
 * Gibt immer ein Objekt zurück: { text: "..." } oder geparste JSON-Struktur.
 */
export async function callAI(systemPrompt, userText) {
  const provider = loadAiProvider()
  return provider === 'openai'
    ? _callOpenAI(systemPrompt, userText)
    : _callClaude(systemPrompt, userText)
}

// ── Claude ────────────────────────────────────────────────────────────────────
async function _callClaude(systemPrompt, userText) {
  const key = loadClaudeKey()
  if (!key) throw new Error('Claude API-Schlüssel fehlt (Stammdaten → ⚙️ → API-Schlüssel).')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userText }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error('Claude: ' + (err.error?.message ?? `HTTP ${res.status}`))
  }

  const data = await res.json()
  return _parseResponse(data.content?.[0]?.text ?? '')
}

// ── OpenAI ────────────────────────────────────────────────────────────────────
async function _callOpenAI(systemPrompt, userText) {
  const key   = loadOpenAiKey()
  const model = loadOpenAiModel()
  if (!key) throw new Error('OpenAI API-Schlüssel fehlt (Stammdaten → ⚙️ → API-Schlüssel).')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userText },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error('OpenAI: ' + (err.error?.message ?? `HTTP ${res.status}`))
  }

  const data = await res.json()
  return _parseResponse(data.choices?.[0]?.message?.content ?? '')
}

// ── Antwort parsen ────────────────────────────────────────────────────────────
function _parseResponse(raw) {
  // JSON-Block aus der Antwort extrahieren
  const cb = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (cb) raw = cb[1]
  const m = raw.match(/\{[\s\S]*\}/)
  if (m) {
    try { return JSON.parse(m[0]) } catch {}
    // Fallback: Zeilenumbrüche in JSON-Strings bereinigen
    try {
      const fixed = m[0].replace(/("(?:[^"\\]|\\.)*")/gs, s =>
        s.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
      )
      return JSON.parse(fixed)
    } catch {}
  }
  // Kein JSON → Text direkt zurückgeben
  return { text: raw.trim() }
}

// ── Anbieter-Labels für UI ────────────────────────────────────────────────────
export const AI_PROVIDERS = [
  { key: 'claude', label: 'Claude (Anthropic)', short: 'Claude' },
  { key: 'openai', label: 'ChatGPT (OpenAI)',   short: 'ChatGPT' },
]

export const OPENAI_MODELS = [
  { key: 'gpt-4o-mini',       label: 'GPT-4o mini  (schnell, günstig – empfohlen)' },
  { key: 'gpt-4o',            label: 'GPT-4o       (beste Qualität)' },
  { key: 'gpt-4.1-mini',      label: 'GPT-4.1 mini (neu, sehr günstig)' },
  { key: 'gpt-4.1',           label: 'GPT-4.1      (neu, beste Qualität)' },
]
