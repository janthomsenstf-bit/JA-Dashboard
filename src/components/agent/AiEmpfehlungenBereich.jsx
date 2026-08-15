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

// #26 – kleine Kennzahl-Pille fürs Tages-Briefing.
function BriefPill({ icon, n, label, tone = 'muted', sub = '' }) {
  const col = tone === 'red' ? 'var(--red)' : tone === 'yellow' ? 'var(--yellow)' : tone === 'accent' ? 'var(--accent)' : 'var(--text-muted)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '999px', padding: '5px 12px' }}>
      <span aria-hidden="true">{icon}</span>
      <span style={{ fontSize: '14px', fontWeight: 800, color: col }}>{n}</span>
      <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{label}{sub ? ` · ${sub}` : ''}</span>
    </div>
  )
}

function fmtBriefDatum(d) {
  if (!d) return ''
  const x = new Date(d)
  return isNaN(x) ? '' : x.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
}

const fmtUhr = (d) => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? '' : x.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }

// #28 – Schnellmeldung vom Handy (PWA). Wirft unterwegs kurz etwas in die Bot-Inbox
// (intent 'ai_aktion') → erscheint sofort als Vorgang unter „vom Handy" in AI-Empfehlungen.
// Optional als Aufgabe/Rückfrage/Notiz vorbereitet → auf dem Desktop ein Klick zum Übernehmen.
function SchnellMeldung({ clients = [], onGemeldet }) {
  const [text, setText]   = useState('')
  const [typ, setTyp]     = useState('aufgabe')   // 'aufgabe' | 'rueckfrage' | 'notiz' | 'hinweis'
  const [mid, setMid]     = useState('')
  const [busy, setBusy]   = useState(false)
  const [msg, setMsg]     = useState('')
  const [offen, setOffen] = useState(false)

  const aktive = clients.filter(c => !c.archiviert).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  const mandantPflicht = typ === 'rueckfrage' || typ === 'notiz'

  async function melden() {
    if (busy) return
    const t = text.trim()
    if (!t) { setMsg('⚠ Bitte kurz eintippen, worum es geht.'); return }
    if (mandantPflicht && !mid) { setMsg('⚠ Für Rückfrage/Notiz bitte einen Mandanten wählen.'); return }
    setBusy(true); setMsg('')
    let aktionen = []
    if (typ === 'aufgabe')        aktionen = [{ id: 'aufgabe_anlegen',    parameter: { titel: t, mandantId: mid || undefined } }]
    else if (typ === 'rueckfrage') aktionen = [{ id: 'rueckfrage_anlegen', parameter: { mandantId: mid, text: t } }]
    else if (typ === 'notiz')      aktionen = [{ id: 'notiz_anlegen',      parameter: { mandantId: mid, text: t } }]
    try {
      const { error } = await supabase.from('bot_inbox').insert({
        intent: 'ai_aktion',
        status: 'neu',
        client_id: mid || null,
        client_name: (aktive.find(c => c.id === mid)?.name) || null,
        raw_text: t,
        draft: { schwere: 'hinweis', feststellung: t, quelle: { typ: 'handy' }, aktionen },
        telegram_message_id: 'handy:' + Date.now().toString(36),
      })
      if (error) throw new Error(error.message)
      setText(''); setMsg('✓ Gemeldet – erscheint unter „vom Handy".')
      onGemeldet?.()
    } catch (e) { setMsg('⚠ ' + (e?.message || String(e))) }
    finally { setBusy(false) }
  }

  const feld = { padding: '7px 9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12.5px', fontFamily: 'inherit' }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', boxShadow: 'var(--shadow)', padding: '13px 16px', marginBottom: '18px' }}>
      <button onClick={() => setOffen(o => !o)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>＋ Schnellmeldung vom Handy</span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>{offen ? '▲' : '▼'}</span>
      </button>
      {offen && (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Kurz: worum geht es? z. B. Müller GmbH – USt-Vorauszahlung prüfen"
            style={{ ...feld, width: '100%', boxSizing: 'border-box', resize: 'vertical', outline: 'none' }} />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select value={typ} onChange={e => setTyp(e.target.value)} style={{ ...feld, cursor: 'pointer' }}>
              <option value="aufgabe">✅ als Aufgabe</option>
              <option value="rueckfrage">❓ als Rückfrage</option>
              <option value="notiz">📝 als Notiz</option>
              <option value="hinweis">💬 nur notieren</option>
            </select>
            <select value={mid} onChange={e => setMid(e.target.value)} style={{ ...feld, cursor: 'pointer', flex: '1 1 160px', minWidth: 0 }}>
              <option value="">{mandantPflicht ? '→ Mandant (nötig) …' : '→ Mandant (optional) …'}</option>
              {aktive.map(c => <option key={c.id} value={c.id}>{c.name}{c.mandantennummer ? ` (${c.mandantennummer})` : ''}</option>)}
            </select>
            <button onClick={melden} disabled={busy}
              style={{ background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)', padding: '7px 15px', borderRadius: 'var(--radius-sm)', fontSize: '12.5px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap' }}>
              {busy ? '⏳ …' : 'Melden'}
            </button>
          </div>
          {msg && <span style={{ fontSize: '11.5px', color: msg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{msg}</span>}
        </div>
      )}
    </div>
  )
}

// #27 – Posteingang-Verarbeitung anstoßen (Job-Queue). Der Knopf hinterlegt nur eine Anfrage
// in der Bot-Inbox; der lokale Worker (Skill „posteingang-verarbeiten") holt sie ab, macht OCR
// und schickt die Ablage-Vorschläge als Freigabe-Karten zurück. Kein Dateizugriff aus der Web-App.
function PosteingangKnopf() {
  const [job, setJob]   = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg]   = useState('')

  const laden = useCallback(async () => {
    try {
      const { data } = await supabase.from('bot_inbox').select('*')
        .eq('intent', 'posteingang_job').order('created_at', { ascending: false }).limit(1)
      setJob((data && data[0]) || null)
    } catch { /* Anzeige optional – stiller Fehler ok */ }
  }, [])
  useEffect(() => { laden(); const t = setInterval(laden, 30000); return () => clearInterval(t) }, [laden])

  const stand = job?.draft?.stand
  const offen = !!job && job.status !== 'verarbeitet' && stand !== 'fertig'

  async function anfordern() {
    if (busy || offen) return
    setBusy(true); setMsg('')
    try {
      const { error } = await supabase.from('bot_inbox').insert({
        intent: 'posteingang_job',
        status: 'neu',
        raw_text: 'Posteingang verarbeiten – im Dashboard angefordert',
        draft: { stand: 'angefordert', angefordertAm: new Date().toISOString(), quelle: 'dashboard' },
        telegram_message_id: 'pjob:' + Date.now().toString(36),
      })
      if (error) throw new Error(error.message)
      setMsg('✓ Anfrage gestellt – der nächste lokale Lauf holt sie ab.')
      await laden()
    } catch (e) { setMsg('⚠ ' + (e?.message || String(e))) }
    finally { setBusy(false) }
  }

  let statusZeile = null
  if (job) {
    if (stand === 'fertig' || job.status === 'verarbeitet') {
      statusZeile = <span style={{ color: 'var(--green)' }}>🟢 fertig {fmtUhr(job.draft?.fertigAm)}{job.draft?.ergebnis ? ` · ${job.draft.ergebnis}` : job.draft?.anzahl ? ` · ${job.draft.anzahl} Dok.` : ''}</span>
    } else if (stand === 'in_arbeit') {
      statusZeile = <span style={{ color: 'var(--accent)' }}>🔵 wird gerade verarbeitet …{job.draft?.startAm ? ` (seit ${fmtUhr(job.draft.startAm)})` : ''}</span>
    } else {
      statusZeile = <span style={{ color: 'var(--yellow)' }}>🟡 angefordert {fmtUhr(job.draft?.angefordertAm || job.created_at)} · wartet auf den lokalen Lauf</span>
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', boxShadow: 'var(--shadow)', padding: '13px 16px', marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)' }}>📥 Posteingang verarbeiten</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Stößt einen Beleg-Lauf an: OCR lokal, dann Ablage-Vorschläge zur Freigabe.
          </div>
        </div>
        <button onClick={anfordern} disabled={busy || offen}
          style={{ background: offen ? 'var(--surface2)' : 'var(--accent)', color: offen ? 'var(--text-muted)' : '#fff', border: '1px solid var(--accent)', padding: '8px 15px', borderRadius: 'var(--radius-sm)', fontSize: '12.5px', fontWeight: 700, cursor: (busy || offen) ? 'default' : 'pointer', opacity: (busy || offen) ? 0.6 : 1, whiteSpace: 'nowrap' }}>
          {busy ? '⏳ …' : offen ? 'läuft schon' : 'Jetzt verarbeiten'}
        </button>
      </div>
      {(statusZeile || msg) && (
        <div style={{ marginTop: '9px', fontSize: '11.5px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {statusZeile}
          {msg && <span style={{ color: msg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{msg}</span>}
        </div>
      )}
    </div>
  )
}

export default function AiEmpfehlungenBereich({ clients = [], dispatcher, onOeffneMandant, onMailErledigt, unbekannteEmails = [], onAssignEmail, onDismissUnbekannt, emailVorlagen = [], aufgaben = [], onRefresh }) {
  const [ignore, setIgnore]      = useState(ladeIgnore)
  const [aktualisiert, setAktualisiert] = useState('')   // '' | 'laeuft' | 'ok'
  const [zeigeUnwichtig, setZeigeUnwichtig] = useState(false)
  const [zeigeAusgeblendet, setZeigeAusgeblendet] = useState(false)
  const generiert = useMemo(() => generiereVorgaenge(clients, ignore), [clients, ignore])
  const [mcp, setMcp]             = useState([])
  const [dokKarten, setDokKarten] = useState([])   // #29a – Beleg-Ablage-Freigabe (intent dokument_ablage)
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

  // #29a – Beleg-Ablage-Freigabe-Karten laden (bisher nur im alten „Posteingang (KI)"-Reiter).
  const ladeDok = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('bot_inbox')
        .select('*').eq('intent', 'dokument_ablage').eq('status', 'neu')
        .order('created_at', { ascending: false }).limit(50)
      if (!error) setDokKarten(data || [])
    } catch { /* Anzeige optional – stiller Fehler ok */ }
  }, [])

  useEffect(() => {
    ladeMcp(); ladeDok()
    const t = setInterval(() => { ladeMcp(); ladeDok() }, 45000)   // regelmäßig nachladen (Handy-Meldungen, Freigaben)
    return () => clearInterval(t)
  }, [ladeMcp, ladeDok])

  // „Aktualisieren" lädt ALLES sichtbar neu: Mails (onRefresh=pollEmails) + MCP/Handy + Beleg-Freigaben.
  async function aktualisieren() {
    if (aktualisiert === 'laeuft') return
    setAktualisiert('laeuft')
    try { await Promise.all([Promise.resolve(onRefresh?.()), ladeMcp(), ladeDok()]) } catch { /* Feedback trotzdem */ }
    setAktualisiert('ok')
    setTimeout(() => setAktualisiert(''), 1800)
  }

  // #29a – Beleg-Bündel freigeben / verwerfen (lokaler Ausführer liest draft.stand === 'freigegeben').
  async function dokFreigeben(item) {
    const dokumente = (item.draft?.dokumente || []).map(d => ({ ...d, freigabe: 'ablegen' }))
    const neuDraft = { ...(item.draft || {}), stand: 'freigegeben', dokumente }
    setDokKarten(prev => prev.filter(i => i.id !== item.id))
    const { error } = await supabase.from('bot_inbox').update({ draft: neuDraft, status: 'verarbeitet' }).eq('id', item.id)
    if (error) { setLadeFehler(error.message); ladeDok() }
  }
  async function dokVerwerfen(item) {
    const dokumente = (item.draft?.dokumente || []).map(d => ({ ...d, freigabe: 'verworfen' }))
    const neuDraft = { ...(item.draft || {}), stand: 'verworfen', dokumente }
    setDokKarten(prev => prev.filter(i => i.id !== item.id))
    await supabase.from('bot_inbox').update({ draft: neuDraft, status: 'verarbeitet' }).eq('id', item.id)
  }

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

  // #26 – Tages-Briefing: datengetrieben, sofort & kostenlos (kein KI-Aufruf beim Öffnen).
  const jetzt = new Date()
  const heuteStr = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`
  const offeneAufgaben = (aufgaben || []).filter(a => a && !a.erledigt && a.faellig)
  const faelligHeute   = offeneAufgaben.filter(a => String(a.faellig).slice(0, 10) === heuteStr)
  const ueberfaellig   = offeneAufgaben.filter(a => String(a.faellig).slice(0, 10) <   heuteStr)
  const briefingLeer   = unbekannt.length === 0 && dringend === 0 && faelligHeute.length === 0 && ueberfaellig.length === 0 && mcp.length === 0

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
            onClick={aktualisieren}
            disabled={aktualisiert === 'laeuft'}
            title="Mails, Handy-Meldungen und Freigaben neu laden"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: aktualisiert === 'ok' ? 'var(--green)' : 'var(--text-secondary)', padding: '7px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: aktualisiert === 'laeuft' ? 'default' : 'pointer', opacity: aktualisiert === 'laeuft' ? 0.7 : 1, whiteSpace: 'nowrap' }}
          >
            {aktualisiert === 'laeuft' ? '⏳ lädt …' : aktualisiert === 'ok' ? '✓ aktualisiert' : '↻ Aktualisieren'}
          </button>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '10px 0 18px', lineHeight: 1.55 }}>
          Automatisch erkannt aus deinen Daten und vom Handy gemeldet (über den MCP). Aktionen legen erst
          nach deinem Klick etwas an; außenwirksame Schritte (z. B. Mail senden) bleiben deiner Freigabe vorbehalten.
        </div>

        {/* #26 – Tages-Briefing beim Öffnen */}
        <div style={{ border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)', borderRadius: 'var(--radius)', background: 'var(--surface)', boxShadow: 'var(--shadow)', padding: '14px 16px', marginBottom: '18px' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>☀️ Dein Überblick</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            {jetzt.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
          {briefingLeer ? (
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Nichts Dringendes — dein Eingang ist ruhig. 👍</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <BriefPill icon="📥" n={unbekannt.length}     label="unzugeordnete Mails" tone={wichtigUnbekannt.length ? 'yellow' : 'muted'} sub={wichtigUnbekannt.length ? `${wichtigUnbekannt.length} wichtig` : ''} />
                <BriefPill icon="🔴" n={dringend}             label="Handlungsbedarf"     tone={dringend ? 'red' : 'muted'} />
                <BriefPill icon="📅" n={faelligHeute.length}  label="heute fällig"        tone={faelligHeute.length ? 'accent' : 'muted'} />
                <BriefPill icon="⏳" n={ueberfaellig.length}  label="überfällig"          tone={ueberfaellig.length ? 'red' : 'muted'} />
                {mcp.length > 0 && <BriefPill icon="📱" n={mcp.length} label="vom Handy" tone="accent" />}
              </div>
              {(ueberfaellig.length > 0 || faelligHeute.length > 0) && (
                <div style={{ marginTop: '11px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {[...ueberfaellig.map(a => ({ a, ueb: true })), ...faelligHeute.map(a => ({ a, ueb: false }))].slice(0, 5).map(({ a, ueb }) => (
                    <div key={a.id} style={{ fontSize: '12px', color: 'var(--text)', display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                      <span aria-hidden="true">{ueb ? '⏳' : '📅'}</span>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titel || 'Aufgabe'}</span>
                      {nameOf(a.mandantId) && <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>· {nameOf(a.mandantId)}</span>}
                      <span style={{ color: ueb ? 'var(--red)' : 'var(--text-muted)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{fmtBriefDatum(a.faellig)}</span>
                    </div>
                  ))}
                  {(ueberfaellig.length + faelligHeute.length) > 5 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>… und {(ueberfaellig.length + faelligHeute.length) - 5} weitere</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <SchnellMeldung clients={clients} onGemeldet={ladeMcp} />

        <PosteingangKnopf />

        {dokKarten.length > 0 && (
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
              📁 Belege zur Freigabe ({dokKarten.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dokKarten.map(item => {
                const doks = item.draft?.dokumente || []
                const sich = item.draft?.sicherheit || 'hoch'
                const sichCol = sich === 'hoch' ? 'var(--green)' : sich === 'mittel' ? 'var(--yellow)' : 'var(--red)'
                return (
                  <div key={item.id} style={{ border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)', borderRadius: 'var(--radius)', background: 'var(--surface)', boxShadow: 'var(--shadow)', padding: '11px 14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                      📁 {item.client_name || 'Ohne Mandant'} · {doks.length} Dokument{doks.length !== 1 ? 'e' : ''}
                      <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 600, color: sichCol }}>{sich}</span>
                    </div>
                    {item.raw_text && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.raw_text}</div>}
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {doks.slice(0, 8).map((d, i) => (
                        <div key={d.id || i} style={{ fontSize: '12px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          • {d.neuerName || d.quelleRel}{d.typ ? <span style={{ color: 'var(--text-muted)' }}> · {d.typ}</span> : null}
                        </div>
                      ))}
                      {doks.length > 8 && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>… und {doks.length - 8} weitere</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                      <button onClick={() => dokFreigeben(item)}
                        style={{ background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)', padding: '7px 13px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                        📁 Alle ablegen freigeben
                      </button>
                      <button onClick={() => dokVerwerfen(item)}
                        style={{ background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '7px 11px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer' }}>
                        verwerfen
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
  const [auftragId, setAuftragId] = useState('')   // #24 – optional an eine Akte/Auftrag andocken
  const [speichernKontakt, setSpeichernKontakt] = useState(true)   // Absender in Stammdaten übernehmen
  const [body, setBody]     = useState(null)
  const [attachments, setAttachments] = useState(null) // #25 – null=noch nicht geladen, []=keine
  const [erk, setErk]       = useState({})             // #25 – Dateiname → { typ, erkannt, empfehlung }
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
    setBody(b)
    setAttachments(Array.isArray(data.attachments) ? data.attachments : [])   // #25 – Anhänge aus derselben Antwort
    return b
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

  // #25 – Anhänge laden (aus derselben Mail-Antwort) und anzeigen.
  async function anhaengePruefen() {
    if (busy || attachments != null) return
    setBusy('anhaenge'); setFehler('')
    try { await holeBody() } catch (e) { setFehler(e?.message || String(e)) }
    finally { setBusy('') }
  }

  // #25 – einen Anhang per KI einordnen (Dateiname + Typ + Mail-Kontext, keine Pixel-OCR).
  async function belegErkennen(att) {
    if (busy) return
    if (!hasAiKey()) { setFehler('Kein KI-Schlüssel hinterlegt (Stammdaten → ⚙️).'); return }
    setBusy('erk:' + att.name); setFehler('')
    try {
      const b = await holeBody()
      const sys  = 'Du bist die Assistenz eines deutschen Steuerberaters und ordnest einen E-Mail-Anhang ein. Nutze Dateiname, Dateityp und Mail-Kontext. Antworte AUSSCHLIESSLICH als JSON: {"typ":"Eingangsrechnung|Ausgangsrechnung|Kontoauszug|Vertrag|Bescheid|Lohnunterlage|Sonstiges","erkannt":"1 kurzer Satz, was das Dokument ist","empfehlung":"kurze Ablage-/Zuordnungsempfehlung"}. Nichts erfinden; bei Unsicherheit typ "Sonstiges". Deutsch.'
      const user = `Anhang: ${att.name} (${att.contentType || '?'}, ${Math.round((att.size || 0) / 1024)} KB)\n\nMail-Betreff: ${email.betreff || ''}\nAbsender: ${email.vonName || ''} <${email.von || ''}>\n\nMail-Text:\n${(b || '').slice(0, 1500)}`
      const r = await callAI(sys, user, { maxTokens: 400 })
      setErk(prev => ({ ...prev, [att.name]: { typ: r.typ || 'Sonstiges', erkannt: r.erkannt || '', empfehlung: r.empfehlung || '' } }))
    } catch (e) { setFehler(e?.message || String(e)) }
    finally { setBusy('') }
  }

  const aktive = clients.filter(c => !c.archiviert).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  const zielClient = aktive.find(c => c.id === zielId)
  const zielAuftraege = (zielClient?.auftraege || []).filter(a => a && !a.archiviert && a.status !== 'abgeschlossen' && a.status !== 'erledigt')
  const auftragLabel = (a) => a.bezeichnung || [a.typ, a.jahr].filter(Boolean).join(' ') || 'Auftrag'
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
      {attachments != null && attachments.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {attachments.map((att, i) => {
            const href = att.tooLarge
              ? `/api/download-attachment?uid=${encodeURIComponent(email.uid)}&account=${encodeURIComponent(email.account)}&name=${encodeURIComponent(att.name)}`
              : `data:${att.contentType || 'application/octet-stream'};base64,${att.data || ''}`
            const e = erk[att.name]
            return (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 9px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>📎 {att.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{Math.round((att.size || 0) / 1024)} KB</span>
                  <a href={href} download={att.name} target="_blank" rel="noreferrer" style={{ fontSize: '11.5px', color: 'var(--accent)', textDecoration: 'none' }}>⬇ Öffnen</a>
                  {!e && (
                    <button onClick={() => belegErkennen(att)} disabled={!!busy}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: busy ? 'default' : 'pointer', color: 'var(--accent)', fontSize: '11.5px' }}>
                      {busy === 'erk:' + att.name ? '⏳ erkennt …' : '🔍 Beleg erkennen (KI)'}
                    </button>
                  )}
                </div>
                {e && (
                  <div style={{ marginTop: '5px', fontSize: '12px', color: 'var(--text)', lineHeight: 1.45 }}>
                    <span style={{ background: 'var(--surface2)', borderRadius: '999px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{e.typ}</span>{' '}
                    {e.erkannt}
                    {e.empfehlung && <div style={{ color: 'var(--accent)', marginTop: '2px' }}>→ {e.empfehlung}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {attachments != null && attachments.length === 0 && (
        <div style={{ marginTop: '8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>📎 keine Anhänge</div>
      )}
      {fehler && <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--red)' }}>{fehler}</div>}
      {(!zus || !antwort || attachments === null) && (
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
          {attachments === null && (
            <button onClick={anhaengePruefen} disabled={!!busy}
              style={{ background: 'none', border: 'none', padding: 0, cursor: busy ? 'default' : 'pointer', color: 'var(--accent)', fontSize: '11.5px' }}>
              {busy === 'anhaenge' ? '⏳ lädt …' : '📎 Anhänge prüfen'}
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
        <select value={zielId} onChange={e => { setZielId(e.target.value); setAuftragId('') }}
          style={{ flex: '1 1 180px', minWidth: 0, padding: '6px 9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }}>
          <option value="">→ Mandant zuordnen …</option>
          {aktive.map(c => <option key={c.id} value={c.id}>{c.name}{c.mandantennummer ? ` (${c.mandantennummer})` : ''}</option>)}
        </select>
        {zielAuftraege.length > 0 && (
          <select value={auftragId} onChange={e => setAuftragId(e.target.value)}
            style={{ flex: '1 1 180px', minWidth: 0, padding: '6px 9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }}>
            <option value="">🔗 optional: an Auftrag andocken …</option>
            {zielAuftraege.map(a => <option key={a.id} value={a.id}>{auftragLabel(a)}</option>)}
          </select>
        )}
        {zielId && (
          <label title="Speichert den Absender als Kontakt beim Mandanten – künftige Mails werden dann automatisch zugeordnet."
            style={{ flexBasis: '100%', display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={speichernKontakt} onChange={e => setSpeichernKontakt(e.target.checked)} style={{ cursor: 'pointer' }} />
            Absender {email.vonName ? `„${email.vonName}" ` : ''}in Stammdaten speichern (künftige Mails automatisch zuordnen)
          </label>
        )}
        <button disabled={!zielId} onClick={() => { if (zielId) onAssign?.(email.uid, email.account, zielId, auftragId || undefined, speichernKontakt) }}
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
