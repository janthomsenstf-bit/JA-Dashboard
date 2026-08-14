import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../../utils/supabaseClient.js'
import VorgangKarte from './VorgangKarte.jsx'
import { generiereVorgaenge } from '../../utils/vorgangGenerator.js'
import { makeVorgang } from '../../utils/vorgang.js'
import { callAI, hasAiKey } from '../../utils/aiClient.js'

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

// Vorfilter OHNE KI: klar automatische/Bulk-Absender vorsortieren (konservativ,
// damit keine echte Mandanten-Mail versehentlich als „unwichtig" gilt).
const BULK_LOCAL = new Set(['noreply', 'no-reply', 'no_reply', 'donotreply', 'do-not-reply', 'mailer', 'mailer-daemon', 'notifications', 'notification', 'notify', 'mailings', 'mailing', 'postmaster', 'newsletter', 'news', 'marketing'])
function istWahrscheinlichUnwichtig(email) {
  const local = String(email.von || '').toLowerCase().split('@')[0] || ''
  if (BULK_LOCAL.has(local) || local.includes('noreply') || local.includes('no-reply') || local.includes('newsletter')) return true
  const bet = String(email.betreff || '').toLowerCase()
  if (bet.includes('newsletter') || bet.includes('unsubscribe') || bet.includes('abmelden')) return true
  return false
}

export default function AiEmpfehlungenBereich({ clients = [], dispatcher, onOeffneMandant, onMailErledigt, unbekannteEmails = [], onAssignEmail, onDismissUnbekannt, emailVorlagen = [] }) {
  const [ignore, setIgnore]      = useState(ladeIgnore)
  const [zeigeUnwichtig, setZeigeUnwichtig] = useState(false)
  const [zeigeAusgeblendet, setZeigeAusgeblendet] = useState(false)
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

  // Unzugeordnete E-Mails (unbekannter Absender) – gefiltert um ignorierte Absender.
  const ignoreSet = useMemo(() => new Set(ignore.map(a => String(a).toLowerCase().trim())), [ignore])
  const unbekannt = (unbekannteEmails || []).filter(e => !ignoreSet.has(String(e.von || '').toLowerCase().trim()))
  const wichtigUnbekannt   = unbekannt.filter(e => !istWahrscheinlichUnwichtig(e))
  const unwichtigUnbekannt = unbekannt.filter(e =>  istWahrscheinlichUnwichtig(e))
  function ignoriereUnbekannt(email) {
    const abs = String(email.von || '').toLowerCase().trim()
    if (abs) { const n = [...new Set([...ignore, abs])]; setIgnore(n); speichereIgnore(n) }
    onDismissUnbekannt?.(email.uid, email.account)
  }
  // #22 – ausgeblendete (ignorierte) Mails + Rückweg: Absender wieder einblenden.
  const ausgeblendet = (unbekannteEmails || []).filter(e => ignoreSet.has(String(e.von || '').toLowerCase().trim()))
  function absenderWiederAnzeigen(email) {
    const abs = String(email.von || '').toLowerCase().trim()
    const n = ignore.filter(a => String(a).toLowerCase().trim() !== abs)
    setIgnore(n); speichereIgnore(n)
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
              {unbekannt.length ? ` · ${unbekannt.length} unzugeordnete Mail${unbekannt.length !== 1 ? 's' : ''}` : ''}
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

        {wichtigUnbekannt.length > 0 && (
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
              📥 Unzugeordnete E-Mails ({wichtigUnbekannt.length}) – wem gehören sie?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {wichtigUnbekannt.map(e => (
                <UnbekanntCard key={`${e.account}:${e.uid}`} email={e} clients={clients} emailVorlagen={emailVorlagen} onAssign={onAssignEmail} onIgnore={() => ignoriereUnbekannt(e)} />
              ))}
            </div>
          </div>
        )}

        {unwichtigUnbekannt.length > 0 && (
          <div style={{ marginBottom: '18px' }}>
            <button
              onClick={() => setZeigeUnwichtig(v => !v)}
              style={{ background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span aria-hidden="true">{zeigeUnwichtig ? '▾' : '▸'}</span>
              Weniger wichtig · Werbung / Newsletter ({unwichtigUnbekannt.length})
            </button>
            {zeigeUnwichtig && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px', opacity: 0.85 }}>
                {unwichtigUnbekannt.map(e => (
                  <UnbekanntCard key={`${e.account}:${e.uid}`} email={e} clients={clients} emailVorlagen={emailVorlagen} onAssign={onAssignEmail} onIgnore={() => ignoriereUnbekannt(e)} />
                ))}
              </div>
            )}
          </div>
        )}

        {ausgeblendet.length > 0 && (
          <div style={{ marginBottom: '18px' }}>
            <button
              onClick={() => setZeigeAusgeblendet(v => !v)}
              style={{ background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span aria-hidden="true">{zeigeAusgeblendet ? '▾' : '▸'}</span>
              🚫 Ausgeblendet · ignorierte Absender ({ausgeblendet.length})
            </button>
            {zeigeAusgeblendet && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {ausgeblendet.map(e => (
                  <div key={`${e.account}:${e.uid}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.betreff || '(kein Betreff)'} · {e.von}</span>
                    <button onClick={() => absenderWiederAnzeigen(e)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--accent)', padding: '3px 9px', borderRadius: '999px', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>
                      wieder anzeigen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {vorgaenge.length === 0 && unbekannt.length === 0 ? (
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

// ── Karte für eine unzugeordnete E-Mail (unbekannter Absender) ──────────────────
function UnbekanntCard({ email, clients = [], emailVorlagen = [], onAssign, onIgnore }) {
  const [zielId, setZielId] = useState('')
  const [body, setBody]     = useState(null)
  const [zus, setZus]       = useState(null)   // { zusammenfassung, empfehlung }
  const [antwort, setAntwort] = useState(null) // { betreff, text }
  const [busy, setBusy]     = useState('')     // '' | 'zus' | 'antwort' | 'senden'
  const [fehler, setFehler] = useState('')
  const [sendMsg, setSendMsg] = useState('')

  // Inhalt der Mail EINMAL laden (für Zusammenfassung & Entwurf wiederverwendet).
  async function holeBody() {
    if (body != null) return body
    const res  = await fetch(`/api/get-email-content?uid=${encodeURIComponent(email.uid)}&account=${encodeURIComponent(email.account)}`)
    const data = await res.json().catch(() => ({}))
    const b = String(data.text || (data.html || '').replace(/<[^>]+>/g, ' ') || '').replace(/\s+/g, ' ').slice(0, 4000)
    setBody(b); return b
  }

  // #21 – KI-Zusammenfassung + Empfehlung, ERST auf Klick (kostenschonend).
  async function zusammenfassen() {
    if (busy || zus) return
    if (!hasAiKey()) { setFehler('Kein KI-Schlüssel hinterlegt (Stammdaten → ⚙️).'); return }
    setBusy('zus'); setFehler('')
    try {
      const b = await holeBody()
      const sys  = 'Du bist die Assistenz eines deutschen Steuerberaters. Fasse die eingegangene E-Mail in 1–2 knappen Sätzen zusammen und gib eine kurze Handlungsempfehlung. Antworte AUSSCHLIESSLICH als JSON: {"zusammenfassung":"...","empfehlung":"..."}. Nichts erfinden. Deutsch.'
      const user = `Von: ${email.vonName || ''} <${email.von || ''}>\nBetreff: ${email.betreff || ''}\n\n${b || '(kein Textinhalt abrufbar)'}`
      const r = await callAI(sys, user, { maxTokens: 500 })
      setZus({ zusammenfassung: r.zusammenfassung || r.text || '(keine Zusammenfassung)', empfehlung: r.empfehlung || '' })
    } catch (e) { setFehler(e?.message || String(e)) }
    finally { setBusy('') }
  }

  // #23 – Antwort-Entwurf, ERST auf Klick. Senden bleibt ein separater Nutzer-Klick.
  async function antwortEntwerfen() {
    if (busy || antwort) return
    if (!hasAiKey()) { setFehler('Kein KI-Schlüssel hinterlegt (Stammdaten → ⚙️).'); return }
    setBusy('antwort'); setFehler('')
    try {
      const b = await holeBody()
      const sys  = 'Du bist die Assistenz eines deutschen Steuerberaters und formulierst einen freundlichen, professionellen Antwort-Entwurf (Sie-Form) auf die eingegangene E-Mail. Antworte AUSSCHLIESSLICH als JSON: {"betreff":"...","text":"..."}. Der Text von Anrede bis Grußformel. Deutsch. Nichts erfinden; fehlen Infos, bleib allgemein höflich.'
      const user = `Eingegangene E-Mail:\nVon: ${email.vonName || ''} <${email.von || ''}>\nBetreff: ${email.betreff || ''}\n\n${b || '(kein Textinhalt)'}`
      const r = await callAI(sys, user, { maxTokens: 800 })
      setAntwort({ betreff: r.betreff || `Re: ${email.betreff || ''}`, text: r.text || '' })
    } catch (e) { setFehler(e?.message || String(e)) }
    finally { setBusy('') }
  }

  function vorlageEinsetzen(v) {
    if (!v) return
    const text = v.text || v.inhalt || v.body || String(v.html || '').replace(/<[^>]+>/g, ' ')
    setAntwort(a => ({ betreff: (a && a.betreff) || v.betreff || `Re: ${email.betreff || ''}`, text: text || (a && a.text) || '' }))
  }

  async function senden() {
    if (!antwort || busy) return
    if (!window.confirm(`Antwort an ${email.von} jetzt senden?`)) return
    setBusy('senden'); setSendMsg(''); setFehler('')
    try {
      const res  = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: email.von, subject: antwort.betreff, text: antwort.text, account: email.account || 'hostinger' }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`)
      setSendMsg('✓ Gesendet')
    } catch (e) { setSendMsg('⚠ ' + (e?.message || String(e))) }
    finally { setBusy('') }
  }

  const aktive = clients.filter(c => !c.archiviert).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  const fmt = (d) => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? '' : x.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) }
  const datum = fmt(email.datum || email.empfangenAm)
  return (
    <div style={{ border: '1px solid var(--border)', borderLeft: '4px solid var(--yellow)', borderRadius: 'var(--radius)', background: 'var(--surface)', boxShadow: 'var(--shadow)', padding: '11px 14px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.betreff || '(kein Betreff)'}</div>
      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
        von {email.vonName ? `${email.vonName} · ` : ''}{email.von || 'unbekannt'}{datum ? ` · ${datum}` : ''}
      </div>
      {zus && (
        <div style={{ marginTop: '8px', fontSize: '12.5px', color: 'var(--text)', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', lineHeight: 1.5 }}>
          <div>{zus.zusammenfassung}</div>
          {zus.empfehlung && <div style={{ marginTop: '4px', color: 'var(--accent)' }}>→ {zus.empfehlung}</div>}
        </div>
      )}
      {antwort && (
        <div style={{ marginTop: '8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <input value={antwort.betreff} onChange={e => setAntwort(a => ({ ...a, betreff: e.target.value }))}
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', outline: 'none', fontFamily: 'inherit' }} />
          <textarea value={antwort.text} onChange={e => setAntwort(a => ({ ...a, text: e.target.value }))} rows={6}
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', fontSize: '12.5px', color: 'var(--text)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }} />
          {emailVorlagen.length > 0 && (
            <select defaultValue="" onChange={e => { const v = emailVorlagen.find(x => String(x.id) === e.target.value); vorlageEinsetzen(v); e.target.value = '' }}
              style={{ padding: '6px 9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px', cursor: 'pointer' }}>
              <option value="">📄 Vorlage einsetzen …</option>
              {emailVorlagen.map(v => <option key={v.id} value={v.id}>{v.name || v.titel || v.bezeichnung || 'Vorlage'}</option>)}
            </select>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => { try { navigator.clipboard?.writeText(`Betreff: ${antwort.betreff}\n\n${antwort.text}`); setSendMsg('✓ Kopiert') } catch { /* noop */ } }}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 11px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer' }}>
              📋 Kopieren
            </button>
            <button onClick={senden} disabled={busy === 'senden'}
              style={{ background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)', padding: '6px 13px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700, cursor: busy === 'senden' ? 'default' : 'pointer', opacity: busy === 'senden' ? 0.6 : 1 }}>
              {busy === 'senden' ? '⏳ sendet …' : `📤 An ${email.von} senden`}
            </button>
            {sendMsg && <span style={{ fontSize: '11.5px', color: sendMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{sendMsg}</span>}
          </div>
        </div>
      )}
      {fehler && <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--red)' }}>{fehler}</div>}
      {(!zus || !antwort) && (
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '8px' }}>
          {!zus && (
            <button onClick={zusammenfassen} disabled={!!busy}
              style={{ background: 'none', border: 'none', padding: 0, cursor: busy ? 'default' : 'pointer', color: 'var(--accent)', fontSize: '11.5px' }}>
              {busy === 'zus' ? '⏳ fasst zusammen …' : '🧾 Zusammenfassen (KI)'}
            </button>
          )}
          {!antwort && (
            <button onClick={antwortEntwerfen} disabled={!!busy}
              style={{ background: 'none', border: 'none', padding: 0, cursor: busy ? 'default' : 'pointer', color: 'var(--accent)', fontSize: '11.5px' }}>
              {busy === 'antwort' ? '⏳ entwirft …' : '✍️ Antwort entwerfen (KI)'}
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
        <select value={zielId} onChange={e => setZielId(e.target.value)}
          style={{ flex: '1 1 180px', minWidth: 0, padding: '6px 9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }}>
          <option value="">→ Mandant zuordnen …</option>
          {aktive.map(c => <option key={c.id} value={c.id}>{c.name}{c.mandantennummer ? ` (${c.mandantennummer})` : ''}</option>)}
        </select>
        <button disabled={!zielId} onClick={() => { if (zielId) onAssign?.(email.uid, email.account, zielId) }}
          style={{ background: zielId ? 'var(--accent)' : 'var(--surface2)', color: zielId ? '#fff' : 'var(--text-muted)', border: '1px solid var(--accent)', padding: '6px 13px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700, cursor: zielId ? 'pointer' : 'default', opacity: zielId ? 1 : 0.6 }}>
          Zuordnen
        </button>
        <button onClick={() => onIgnore?.()} title="Künftige E-Mails von diesem Absender ignorieren"
          style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 11px', borderRadius: '999px', fontSize: '11px', cursor: 'pointer' }}>
          🚫 Absender ignorieren
        </button>
      </div>
    </div>
  )
}
