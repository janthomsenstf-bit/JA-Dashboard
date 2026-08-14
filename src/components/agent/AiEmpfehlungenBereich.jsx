import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../../utils/supabaseClient.js'
import VorgangKarte from './VorgangKarte.jsx'
import { generiereVorgaenge } from '../../utils/vorgangGenerator.js'
import { makeVorgang } from '../../utils/vorgang.js'

/**
 * AiEmpfehlungenBereich – die „AI-Empfehlungen"-Liste (BP 1 + MCP-Integration BP 5).
 *
 * Zeigt Vorgänge aus zwei Quellen als einheitliche VorgangKarte:
 *   1) automatisch aus den vorhandenen Daten erkannt (rein lesend)
 *   2) von außen gemeldet (MCP / Handy) über bot_inbox (intent 'ai_aktion')
 *
 * Ausführung läuft immer über den injizierten `dispatcher` (App-eigene Setter →
 * sichere Speicherung). MCP-Vorgänge werden nach dem Ausführen als verarbeitet
 * markiert, damit sie nicht erneut erscheinen.
 */

// bot_inbox-Zeile → Vorgang
function rowZuVorgang(row) {
  const d = row.draft || {}
  const v = makeVorgang({
    schwere: d.schwere || 'hinweis',
    mandantId: row.client_id || null,
    titel: row.raw_text || 'Vorgang',
    feststellung: d.feststellung || '',
    einschaetzung: d.einschaetzung || '',
    empfehlung: d.empfehlung || '',
    aktionen: Array.isArray(d.aktionen) ? d.aktionen : [],
    quelle: d.quelle || { typ: 'mcp' },
  })
  v.botInboxId = row.id
  v.vonMcp = true
  v.mandantNameFallback = row.client_name || null
  return v
}

const IGNORE_KEY = 'ki-ignorierte-absender-v1'
function ladeIgnore() { try { return JSON.parse(localStorage.getItem(IGNORE_KEY) || '[]') } catch { return [] } }
function speichereIgnore(l) { try { localStorage.setItem(IGNORE_KEY, JSON.stringify(l)) } catch { /* ignore */ } }

export default function AiEmpfehlungenBereich({ clients = [], dispatcher, onOeffneMandant, onMailErledigt }) {
  const [ignore, setIgnore]      = useState(ladeIgnore)
  const generiert = useMemo(() => generiereVorgaenge(clients, ignore), [clients, ignore])
  const [mcp, setMcp]             = useState([])
  const [ladeFehler, setLadeFehler] = useState('')

  const nameOf = (id) => clients.find(c => c.id === id)?.name ?? null

  // Vorgang verwerfen: betroffene Mail(s) als erledigt markieren → kommt nicht wieder.
  function verwerfen(v) {
    if (v.vonMcp) { markErledigt(v.botInboxId); return }
    if (Array.isArray(v._mailEventIds) && v._mailEventIds.length) onMailErledigt?.(v.mandantId, v._mailEventIds)
  }
  // Absender künftig ignorieren (Spam) + betroffene Mail(s) als erledigt markieren.
  function absenderIgnorieren(v) {
    const abs = String(v._absender || '').toLowerCase().trim()
    if (abs) { const n = [...new Set([...ignore, abs])]; setIgnore(n); speichereIgnore(n) }
    if (Array.isArray(v._mailEventIds) && v._mailEventIds.length) onMailErledigt?.(v.mandantId, v._mailEventIds)
  }

  const ladeMcp = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('bot_inbox')
        .select('*').eq('intent', 'ai_aktion').eq('status', 'neu')
        .order('created_at', { ascending: false }).limit(50)
      if (error) { setLadeFehler(error.message); return }
      setLadeFehler('')
      setMcp((data || []).map(rowZuVorgang))
    } catch (e) { setLadeFehler(e?.message || String(e)) }
  }, [])

  useEffect(() => {
    ladeMcp()
    const t = setInterval(ladeMcp, 45000)   // regelmäßig nachladen (Handy-Meldungen)
    return () => clearInterval(t)
  }, [ladeMcp])

  async function markErledigt(botInboxId) {
    if (!botInboxId) return
    setMcp(prev => prev.filter(v => v.botInboxId !== botInboxId))
    try {
      await supabase.from('bot_inbox')
        .update({ status: 'verarbeitet', confirmed_at: new Date().toISOString() })
        .eq('id', botInboxId)
    } catch { /* Anzeige wurde schon entfernt; stiller Fehler ok */ }
  }

  const vorgaenge = [...mcp, ...generiert]
  const dringend = vorgaenge.filter(v => v.schwere === 'handlungsbedarf').length

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', minHeight: 0 }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '20px 16px 60px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
          <span style={{ fontSize: '22px' }} aria-hidden="true">🤖</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)' }}>AI-Empfehlungen</div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
              {vorgaenge.length} Vorgang{vorgaenge.length !== 1 ? 'e' : ''}
              {dringend ? ` · ${dringend} mit Handlungsbedarf` : ''}
              {mcp.length ? ` · ${mcp.length} vom Handy` : ''}
            </div>
          </div>
          <button
            onClick={ladeMcp}
            title="Neu laden"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '7px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer' }}
          >
            ↻ Aktualisieren
          </button>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '10px 0 18px', lineHeight: 1.55 }}>
          Automatisch erkannt aus deinen Daten und vom Handy gemeldet (über den MCP). Aktionen legen erst
          nach deinem Klick etwas an; außenwirksame Schritte (z. B. Mail senden) bleiben deiner Freigabe vorbehalten.
        </div>

        {ladeFehler && (
          <div style={{ fontSize: '11.5px', color: 'var(--yellow)', background: 'var(--yellow-dim)', border: '1px solid var(--yellow)', borderRadius: 'var(--radius-sm)', padding: '8px 11px', marginBottom: '14px' }}>
            Hinweis: Handy-Meldungen konnten nicht geladen werden ({ladeFehler}).
          </div>
        )}

        {vorgaenge.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '8vh 0', color: 'var(--text-muted)', fontSize: '14px' }}>
            <div style={{ fontSize: '30px', marginBottom: '8px' }} aria-hidden="true">✓</div>
            Nichts Offenes erkannt – alles im grünen Bereich.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {vorgaenge.map(v => (
              <div key={v.id}>
                {v.vonMcp && (
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#0d9488', marginBottom: '4px' }}>
                    📱 Vom Handy gemeldet
                  </div>
                )}
                <VorgangKarte
                  vorgang={v}
                  dispatcher={dispatcher}
                  mandantName={nameOf(v.mandantId) || v.mandantNameFallback}
                  onErledigt={() => { if (v.botInboxId) markErledigt(v.botInboxId) }}
                />
                <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                  {onOeffneMandant && v.mandantId && (
                    <button
                      onClick={() => onOeffneMandant(v.mandantId)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontSize: '11.5px' }}
                    >
                      → Mandant öffnen
                    </button>
                  )}
                  <div style={{ flex: 1 }} />
                  {(v.quelle?.typ === 'mail' || v.vonMcp) && (
                    <button
                      onClick={() => verwerfen(v)}
                      title="Diese Empfehlung ausblenden – kommt nicht wieder"
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11.5px' }}
                    >
                      ✕ Verwerfen
                    </button>
                  )}
                  {v.quelle?.typ === 'mail' && v._absender && (
                    <button
                      onClick={() => absenderIgnorieren(v)}
                      title={`Künftige E-Mails von ${v._absender} nicht mehr als Vorgang anzeigen`}
                      style={{ background: 'none', border: '1px solid var(--border)', padding: '3px 9px', borderRadius: '999px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '11px' }}
                    >
                      🚫 Als Spam · Absender ignorieren
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
