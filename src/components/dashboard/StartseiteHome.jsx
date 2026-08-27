import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { supabase } from '../../utils/supabaseClient.js'
import { callAI, hasAiKey } from '../../utils/aiClient.js'
import { getOpenRueckfragen, fmtDate } from '../../utils/search.js'
import { alleFristen, QUELLE_CFG } from '../../utils/fristen.js'
import { ladeIgnore, speichereIgnore, absenderKey, istWahrscheinlichUnwichtig } from '../../utils/unbekannteMails.js'
import SchnellMeldung   from '../agent/SchnellMeldung.jsx'
import PosteingangKnopf from '../agent/PosteingangKnopf.jsx'
import UnbekanntCard    from '../agent/UnbekanntCard.jsx'
import BelegFreigabeKarte, { belegEntscheiden } from '../agent/BelegFreigabeKarte.jsx'

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function isEmailOpen(incomingEvent, allEvents) {
  if (incomingEvent.erledigtAm) return false
  const t = new Date(incomingEvent.erstelltAm).getTime()
  return !allEvents.some(
    e => e.typ !== 'eingehend' && e.status === 'gesendet' && new Date(e.erstelltAm).getTime() > t
  )
}

// Zeitpunkt, nach dem der Posteingang sortiert: eine gerade zugeordnete Mail
// zählt ab ihrer Zuordnung, nicht ab ihrem (womöglich alten) Empfangsdatum.
function eingangsZeit(event) {
  return event.zugeordnetAm || event.erstelltAm
}

function isSehrNeu(iso) {
  return Date.now() - new Date(iso).getTime() < 2 * 60 * 60 * 1000
}

function relTime(iso) {
  if (!iso) return '–'
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1)   return 'gerade eben'
  if (min < 60)  return `vor ${min} Min`
  const h = Math.floor(min / 60)
  if (h < 24)    return `vor ${h} Std`
  const d = Math.floor(h / 24)
  if (d === 1)   return 'gestern'
  if (d < 7)     return `vor ${d} Tagen`
  return fmtDate(iso)
}

function truncate(str, max) {
  const s = String(str ?? '').replace(/\n/g, ' ')
  return s.length > max ? s.slice(0, max) + '…' : s
}

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}
const AVATAR_COLORS = ['#2f6df0', '#c67c12', '#1f9d5f', '#8b5cf6', '#e5484d', '#0891b2']
function avatarColor(id) {
  let h = 0; const s = String(id || '')
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

// ── Große E-Mail-Karte mit KI-Zusammenfassung (einmal erzeugt + gecacht) ────────

function EmailCard({ client, event, onOpen, onErledigt, onCacheSummary, onAuftrag, autoSummary = true }) {
  const [sum, setSum]     = useState(event.kiZusammenfassung || null)
  const [emp, setEmp]     = useState(event.kiEmpfehlung || '')
  const [laedt, setLaedt] = useState(false)
  const [aufgabeOffen, setAufgabeOffen] = useState(false)
  const [aTitel, setATitel]   = useState('')
  const [aFaellig, setAFaellig] = useState('')
  const [aGemerkt, setAGemerkt] = useState('')   // Bestätigung an der Karte
  const triedRef = useRef(false)
  const geradeZugeordnet = !!event.zugeordnetAm && isSehrNeu(event.zugeordnetAm)
  const sehrNeu = isSehrNeu(eingangsZeit(event))
  const col = avatarColor(client.id)

  useEffect(() => {
    if (!autoSummary) return   // aufgeklappte Karten fassen erst auf Klick zusammen
    zusammenfassen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Holt Text und lässt die KI zusammenfassen. Ergebnis wird am Event gecacht.
  function zusammenfassen() {
    if (sum || triedRef.current || !hasAiKey()) return
    triedRef.current = true
    setLaedt(true)
    ;(async () => {
      try {
        let body = event.text
        if (!body && event.sourceUid) {
          const res  = await fetch(`/api/get-email-content?uid=${encodeURIComponent(event.sourceUid)}&account=${encodeURIComponent(event.sourceAccount || 'hostinger')}`)
          const data = await res.json().catch(() => ({}))
          body = String(data.text || (data.html || '').replace(/<[^>]+>/g, ' ') || '').replace(/\s+/g, ' ').slice(0, 4000)
        }
        const sys  = 'Du bist die Assistenz eines deutschen Steuerberaters. Fasse die eingegangene E-Mail in 1–2 knappen Sätzen zusammen (worum geht es) und gib eine kurze Handlungsempfehlung. Antworte AUSSCHLIESSLICH als JSON: {"zusammenfassung":"...","empfehlung":"..."}. Nichts erfinden. Deutsch.'
        const user = `Von: ${event.absender || ''}\nBetreff: ${event.betreff || ''}\n\n${body || '(kein Textinhalt abrufbar)'}`
        const r = await callAI(sys, user, { maxTokens: 400 })
        const z = r.zusammenfassung || r.text || ''
        const e = r.empfehlung || ''
        if (z) { setSum(z); setEmp(e); onCacheSummary?.(client.id, event.id, z, e) }
      } catch { /* Fallback: Betreff bleibt sichtbar */ }
      finally { setLaedt(false) }
    })()
  }

  // Formular öffnen: Bezeichnung aus KI-Empfehlung, sonst aus dem Betreff vorschlagen.
  function auftragOeffnen() {
    setATitel(emp || event.betreff || '')
    setAFaellig('')
    setAufgabeOffen(true)
  }

  // Legt einen Auftrag beim Mandanten an – mit Frist, damit er in der
  // Auftrags-Übersicht (Menüpunkt „Aufträge") auftaucht. Die Mail bleibt
  // bewusst offen – „Erledigt" bleibt ein eigener, bewusster Klick.
  function auftragSpeichern() {
    const bezeichnung = aTitel.trim()
    if (!bezeichnung) return
    onAuftrag?.({
      clientId: client.id,
      bezeichnung,
      frist: aFaellig || '',
      notiz: [event.betreff ? `Aus E-Mail: ${event.betreff}` : '', event.absender ? `Absender: ${event.absender}` : '']
        .filter(Boolean).join('\n'),
      mail: { betreff: event.betreff || '', absender: event.absender || '', datum: event.erstelltAm || null },
    })
    setAufgabeOffen(false)
    setAGemerkt(aFaellig ? `✓ Auftrag angelegt · Frist ${fmtDate(aFaellig)}` : '✓ Auftrag angelegt')
    setTimeout(() => setAGemerkt(''), 6000)
  }

  return (
    <div style={{
      display: 'flex', gap: '15px', padding: '16px 18px',
      background: 'var(--surface)',
      border: `1px solid ${sehrNeu ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      boxShadow: sehrNeu ? '0 0 0 3px var(--accent-dim)' : 'var(--shadow)',
    }}>
      <div style={{ width: '42px', height: '42px', borderRadius: '11px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 800, color: '#fff', background: col }}>
        {initials(client.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14.5px', fontWeight: 750 }}>{client.name}</span>
          {sehrNeu && (
            <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--accent)', color: '#fff', padding: '2px 8px', borderRadius: '20px' }}>
              {geradeZugeordnet ? '● zugeordnet' : '● neu'}
            </span>
          )}
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {geradeZugeordnet ? `eingegangen ${relTime(event.erstelltAm)}` : relTime(event.erstelltAm)}
          </span>
        </div>
        {event.absender && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{event.absender}</div>}

        {sum ? (
          <div style={{ fontSize: '13.5px', color: 'var(--text)', lineHeight: 1.55, marginTop: '8px', padding: '10px 12px', background: 'var(--surface2)', borderLeft: '2px solid var(--accent)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '4px' }}>🧾 Zusammenfassung</span>
            {sum}
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', padding: '10px 12px', background: 'var(--surface2)', borderLeft: '2px solid var(--border2)', borderRadius: 'var(--radius-sm)' }}>
            {laedt ? '🧾 fasst zusammen …' : truncate(event.betreff || '(kein Betreff)', 90)}
          </div>
        )}
        {emp && <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '8px' }}>→ {emp}</div>}

        <div style={{ display: 'flex', gap: '9px', marginTop: '11px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-primary btn-sm" onClick={onOpen} style={{ fontSize: '11.5px' }}>✉️ Öffnen &amp; antworten</button>
          {!sum && !laedt && !autoSummary && hasAiKey() && (
            <button className="btn btn-ghost btn-sm" onClick={zusammenfassen} style={{ fontSize: '11.5px' }}
              title="Diese Mail von der KI zusammenfassen lassen">🧾 Zusammenfassen</button>
          )}
          {onAuftrag && !aufgabeOffen && (
            <button className="btn btn-ghost btn-sm" onClick={auftragOeffnen}
              title={'Auftrag aus dieser Mail anlegen – mit Frist, erscheint unter „Aufträge". Die Mail bleibt offen.'}
              style={{ fontSize: '11.5px' }}>📑 Auftrag anlegen</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onErledigt} style={{ fontSize: '11.5px', color: 'var(--green)' }}>✓ Erledigt</button>
          {aGemerkt && <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--green)' }}>{aGemerkt}</span>}
        </div>

        {aufgabeOffen && (
          <div style={{ marginTop: '10px', padding: '11px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                autoFocus
                value={aTitel}
                onChange={e => setATitel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') auftragSpeichern(); if (e.key === 'Escape') setAufgabeOffen(false) }}
                placeholder="Worum geht es? (Bezeichnung des Auftrags)"
                style={{ flex: '1 1 260px', minWidth: 0, fontSize: '12.5px', padding: '6px 9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)' }}
              />
              <input
                type="date"
                value={aFaellig}
                onChange={e => setAFaellig(e.target.value)}
                title="Frist (optional)"
                style={{ fontSize: '12.5px', padding: '6px 9px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)' }}
              />
              <button className="btn btn-primary btn-sm" onClick={auftragSpeichern} disabled={!aTitel.trim()} style={{ fontSize: '11.5px' }}>Anlegen</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAufgabeOffen(false)} style={{ fontSize: '11.5px' }}>Abbrechen</button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '7px' }}>
              Auftrag für {client.name} · mit Frist erscheint er unter „Aufträge" im gesetzten Monat, ohne Frist nur beim Mandanten. Die Mail bleibt offen und wird am Auftrag verknüpft.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── KPI-Kachel ──────────────────────────────────────────────────────────────

function Kpi({ icon, value, label, tone, sub, onClick }) {
  const col = tone === 'crit' ? 'var(--red)' : tone === 'warn' ? 'var(--yellow)' : tone === 'ok' ? 'var(--accent)' : 'var(--text)'
  const stripe = tone === 'crit' ? 'var(--red)' : tone === 'warn' ? 'var(--yellow)' : tone === 'ok' ? 'var(--accent)' : 'transparent'
  return (
    <div onClick={onClick} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${stripe}`, borderRadius: 'var(--radius)', padding: '12px 13px', boxShadow: 'var(--shadow)', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontSize: '15px' }}>{icon}</div>
      <div style={{ fontSize: '24px', fontWeight: 800, lineHeight: 1.1, marginTop: '5px', color: col, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{label}</div>
      {sub && <div style={{ fontSize: '10.5px', fontWeight: 600, marginTop: '4px', color: col }}>{sub}</div>}
    </div>
  )
}

// ── Kompaktzeile / Widget ─────────────────────────────────────────────────────

function SekEyebrow({ children, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '11px' }}>
      <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{children}</span>
      {note && <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{note}</span>}
    </div>
  )
}

// Trennt die beiden Zonen: oben was entschieden werden will, unten was nur informiert.
function ZonenTitel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginTop: '6px' }}>
      <span style={{ fontSize: '12.5px', fontWeight: 800, letterSpacing: '0.02em', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{children}</span>
      <span style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  )
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function StartseiteHome({
  clients, aufgaben = [], termine = [], onSelectClient, onSelectClientAtKomm, onUpdateClient, onRefresh, onOeffneEingang,
  unbekannteEmails = [], onAssignEmail, onDismissUnbekannt, emailVorlagen = [], onNeuerMandantAusMail, onAddAuftragAusMail,
  interessenten = [], onNeuerErstkontakt, onOeffneBogen,
}) {
  const activeClients = useMemo(() => clients.filter(c => !c.archiviert), [clients])
  const [botKarten, setBotKarten] = useState([])   // bot_inbox: Handy-Meldungen + Beleg-Freigaben
  const [aktualisiert, setAktualisiert] = useState('')
  const [ignore, setIgnore]           = useState(ladeIgnore)
  const [alleUnbekannt, setAlleUnbekannt] = useState(false)   // Top 3 oder alle zeigen
  const [alleMails, setAlleMails] = useState(false)           // Posteingang: Top 3 oder alle
  const posteingangRef = useRef(null)
  const [belegFehler, setBelegFehler] = useState('')

  // Offene eingehende E-Mails (Mandant + Event), neueste zuerst
  const offeneEmails = useMemo(() => {
    const result = []
    for (const c of activeClients) {
      const events = c.kommunikation?.events ?? []
      for (const e of events) {
        if (e.typ === 'eingehend' && isEmailOpen(e, events)) result.push({ client: c, event: e })
      }
    }
    return result.sort((a, b) => new Date(eingangsZeit(b.event)) - new Date(eingangsZeit(a.event)))
  }, [activeClients])

  const neueMails = useMemo(() => offeneEmails.filter(x => isSehrNeu(eingangsZeit(x.event))).length, [offeneEmails])

  // Offene Rückfragen (warten auf Mandant)
  const offeneRQ = useMemo(() =>
    activeClients.map(c => ({ client: c, count: getOpenRueckfragen(c).length })).filter(x => x.count > 0).sort((a, b) => b.count - a.count)
  , [activeClients])
  const rqGesamt = useMemo(() => offeneRQ.reduce((s, x) => s + x.count, 0), [offeneRQ])

  // ── Alles mit Datum aus EINER Quelle ───────────────────────────────────────
  // Aufträge, automatische Fristen, manuelle Aufgaben, Termine und Erinnerungen.
  // Dieselbe Funktion speist den Bereich „Aufgaben" – beide zeigen dasselbe.
  const fristenAlle = useMemo(
    () => alleFristen({ clients, aufgabenListe: aufgaben, termine, tageVor: 90, tageNach: 30 }),
    [clients, aufgaben, termine],
  )
  const ueberfaellig = useMemo(() => fristenAlle.filter(e => e.diff < 0),  [fristenAlle])
  const faelligHeute = useMemo(() => fristenAlle.filter(e => e.diff === 0), [fristenAlle])

  // Fristen (nächste 30 Tage, ohne heute/überfällig – die stehen schon oben)
  const fristen = useMemo(() => fristenAlle.filter(e => e.diff > 0 && e.diff <= 30), [fristenAlle])

  const nameOf = useCallback((id) => activeClients.find(c => c.id === id)?.name || null, [activeClients])

  // „Heute dran": überfällige + heute fällige Einträge, nach Datum
  const heuteDran = useMemo(
    () => [...ueberfaellig, ...faelligHeute].map(e => ({ ...e, ueb: e.diff < 0 })),
    [ueberfaellig, faelligHeute])

  // bot_inbox: Handy-Meldungen (ai_aktion) + Beleg-Freigaben (dokument_ablage)
  const ladeBot = useCallback(async () => {
    try {
      const { data } = await supabase.from('bot_inbox').select('*').eq('status', 'neu')
        .in('intent', ['ai_aktion', 'dokument_ablage']).order('created_at', { ascending: false }).limit(40)
      setBotKarten(data || [])
    } catch { /* still */ }
  }, [])
  useEffect(() => { ladeBot(); const t = setInterval(ladeBot, 45000); return () => clearInterval(t) }, [ladeBot])

  const handyKarten = botKarten.filter(k => k.intent === 'ai_aktion')
  const belegKarten = botKarten.filter(k => k.intent === 'dokument_ablage')

  // Mandanten-Radar: „offen"-Score je Mandant (Rückfragen + offene Mails + überfällige Aufgaben)
  const radar = useMemo(() => {
    const map = new Map()
    const add = (id, n) => { if (!id) return; map.set(id, (map.get(id) || 0) + n) }
    offeneRQ.forEach(x => add(x.client.id, x.count))
    offeneEmails.forEach(x => add(x.client.id, 1))
    ueberfaellig.forEach(a => add(a.mandantId, 1))
    return [...map.entries()].map(([id, n]) => ({ client: activeClients.find(c => c.id === id), n })).filter(x => x.client).sort((a, b) => b.n - a.n).slice(0, 6)
  }, [offeneRQ, offeneEmails, ueberfaellig, activeClients])
  const radarMax = radar[0]?.n || 1

  // ── Unzugeordnete Mails: ignorierte Absender raus, Bulk-Absender nach hinten ──
  const ignoreSet = useMemo(() => new Set(ignore.map(a => String(a).toLowerCase().trim())), [ignore])
  const unbekannt = useMemo(
    () => (unbekannteEmails || []).filter(e => !ignoreSet.has(absenderKey(e))),
    [unbekannteEmails, ignoreSet])
  // Wichtige zuerst – so steht oben nie ein Newsletter vor einer Mandantenmail.
  const unbekanntSortiert = useMemo(() => {
    const wichtig  = unbekannt.filter(e => !istWahrscheinlichUnwichtig(e))
    const unwichtig = unbekannt.filter(e =>  istWahrscheinlichUnwichtig(e))
    return [...wichtig, ...unwichtig]
  }, [unbekannt])
  const unbekanntWichtig = useMemo(() => unbekannt.filter(e => !istWahrscheinlichUnwichtig(e)).length, [unbekannt])

  function ignoriereUnbekannt(email) {
    const abs = absenderKey(email)
    if (abs) { const n = [...new Set([...ignore, abs])]; setIgnore(n); speichereIgnore(n) }
    onDismissUnbekannt?.(email.uid, email.account)
  }

  // ── Beleg-Freigabe: Karte sofort ausblenden, dann schreiben ──
  async function belegFreigeben(item) {
    setBotKarten(prev => prev.filter(k => k.id !== item.id))
    const fehler = await belegEntscheiden(item, 'ablegen')
    if (fehler) { setBelegFehler(fehler); ladeBot() }
  }
  async function belegVerwerfen(item) {
    setBotKarten(prev => prev.filter(k => k.id !== item.id))
    const fehler = await belegEntscheiden(item, 'verworfen')
    if (fehler) { setBelegFehler(fehler); ladeBot() }
  }

  // KI-Zusammenfassung dauerhaft am Event speichern (einmal erzeugen, dann sofort da)
  const cacheSummary = useCallback((clientId, eventId, z, e) => {
    const c = clients.find(x => x.id === clientId)
    if (!c) return
    const komm = c.kommunikation ?? { events: [] }
    const events = (komm.events ?? []).map(ev => ev.id === eventId ? { ...ev, kiZusammenfassung: z, kiEmpfehlung: e } : ev)
    onUpdateClient?.(clientId, { kommunikation: { ...komm, events } })
  }, [clients, onUpdateClient])

  function handleErledigt(client, event) {
    const komm   = client.kommunikation ?? { events: [] }
    const events = (komm.events ?? []).map(e => e.id === event.id ? { ...e, erledigtAm: new Date().toISOString() } : e)
    onUpdateClient(client.id, { kommunikation: { ...komm, events } })
  }

  async function aktualisieren() {
    if (aktualisiert === 'laeuft') return
    setAktualisiert('laeuft')
    try { await Promise.all([Promise.resolve(onRefresh?.()), ladeBot()]) } catch { /* egal */ }
    setAktualisiert('ok'); setTimeout(() => setAktualisiert(''), 1800)
  }

  const offeneInteressenten = useMemo(() => (interessenten || []).filter(b => b && !b.clientId && b.status !== 'verloren'), [interessenten])

  const jetzt = new Date()
  const dranGesamt = ueberfaellig.length + faelligHeute.length
  const brennt = ueberfaellig.length + neueMails
  const lagebild = brennt > 0
    ? <><span style={{ color: 'var(--red)', fontWeight: 700 }}>{brennt} {brennt === 1 ? 'Sache' : 'Dinge'}</span> {brennt === 1 ? 'braucht' : 'brauchen'} dich zuerst.</>
    : 'Nichts Dringendes — alles im grünen Bereich. 👍'

  const sichtbareMails = alleMails ? offeneEmails : offeneEmails.slice(0, 3)

  // Klappt den Posteingang auf und springt hin (z.B. aus der KPI-Kachel).
  function posteingangZeigen() {
    setAlleMails(true)
    setTimeout(() => posteingangRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const feld = { fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius-sm)', padding: '8px 13px', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text-secondary)' }

  return (
    <div style={{ padding: '24px', maxWidth: '1040px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '26px' }}>

      {/* ── Lagebild ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            {jetzt.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
          <h2 style={{ margin: '4px 0 2px', fontSize: '25px', fontWeight: 800, letterSpacing: '-0.01em' }}>🏠 Cockpit</h2>
          <div style={{ fontSize: '14.5px', color: 'var(--text-secondary)' }}>{lagebild}</div>
        </div>
        {onNeuerErstkontakt && (
          <button onClick={onNeuerErstkontakt} title="Erstgespräch mit einem Interessenten aufnehmen"
            style={{ ...feld, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 700 }}>
            ＋ Erstkontakt
          </button>
        )}
        <button onClick={aktualisieren} disabled={aktualisiert === 'laeuft'}
          style={{ ...feld, color: aktualisiert === 'ok' ? 'var(--green)' : 'var(--text-secondary)', opacity: aktualisiert === 'laeuft' ? 0.7 : 1 }}>
          {aktualisiert === 'laeuft' ? '⏳ lädt …' : aktualisiert === 'ok' ? '✓ aktualisiert' : '↻ Aktualisieren'}
        </button>
      </div>

      {/* ── Werkzeugleiste: schnell melden + Posteingang-Lauf starten ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <SchnellMeldung clients={clients} onGemeldet={ladeBot} />
        <PosteingangKnopf />
      </div>

      <ZonenTitel>Zu entscheiden</ZonenTitel>

      {/* ── 1) Posteingang (groß, oben) ── */}
      <div ref={posteingangRef}>
        <SekEyebrow note={offeneEmails.length > 3
          ? <button onClick={() => setAlleMails(v => !v)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontSize: '11.5px', fontWeight: 600 }}>
              {alleMails ? '↑ nur die neuesten 3' : `↓ alle ${offeneEmails.length} anzeigen`}
            </button>
          : null}>
          📥 Posteingang{offeneEmails.length ? ` · ${offeneEmails.length} unbeantwortet${neueMails ? `, ${neueMails} neu` : ''}` : ''}
        </SekEyebrow>
        {offeneEmails.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '13px' }}>
            ✓ Keine offenen E-Mails — alles beantwortet
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
              {sichtbareMails.map(({ client, event }, i) => (
                <EmailCard key={`${client.id}-${event.id}`} client={client} event={event}
                  autoSummary={i < 3}
                  onOpen={() => onSelectClientAtKomm(client.id)}
                  onErledigt={() => handleErledigt(client, event)}
                  onCacheSummary={cacheSummary}
                  onAuftrag={onAddAuftragAusMail} />
              ))}
            </div>
            {offeneEmails.length > 3 && (
              <div style={{ textAlign: 'center', marginTop: '11px' }}>
                <button onClick={() => setAlleMails(v => !v)} style={feld}>
                  {alleMails
                    ? '↑ weniger anzeigen'
                    : `${offeneEmails.length - 3} weitere unbeantwortete ${offeneEmails.length - 3 === 1 ? 'Mail' : 'Mails'} anzeigen`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 1b) Unzugeordnete Mails – zuordnen, zusammenfassen, antworten ── */}
      {unbekannt.length > 0 && (
        <div>
          <SekEyebrow note={unbekanntWichtig ? `${unbekanntWichtig} davon wichtig` : 'nur Bulk-Absender'}>
            📥 Unzugeordnet · {unbekannt.length} Mail{unbekannt.length !== 1 ? 's' : ''}
          </SekEyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(alleUnbekannt ? unbekanntSortiert : unbekanntSortiert.slice(0, 3)).map(e => (
              <UnbekanntCard
                key={`${e.account}:${e.uid}`}
                email={e}
                clients={clients}
                emailVorlagen={emailVorlagen}
                onAssign={onAssignEmail}
                onIgnore={() => ignoriereUnbekannt(e)}
                onNeuerMandant={onNeuerMandantAusMail}
              />
            ))}
          </div>
          {unbekanntSortiert.length > 3 && (
            <div style={{ textAlign: 'center', marginTop: '11px' }}>
              <button onClick={() => setAlleUnbekannt(v => !v)} style={feld}>
                {alleUnbekannt ? 'weniger anzeigen' : `${unbekanntSortiert.length - 3} weitere unzugeordnete ${unbekanntSortiert.length - 3 === 1 ? 'Mail' : 'Mails'} anzeigen`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 1c) Belege zur Freigabe – direkt entscheiden ── */}
      {belegKarten.length > 0 && (
        <div>
          <SekEyebrow note="aus dem Posteingang-Lauf">📁 Belege zur Freigabe · {belegKarten.length}</SekEyebrow>
          {belegFehler && (
            <div style={{ marginBottom: '9px', fontSize: '12px', color: 'var(--red)' }}>⚠ {belegFehler}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {belegKarten.map(item => (
              <BelegFreigabeKarte key={item.id} item={item}
                onFreigeben={belegFreigeben} onVerwerfen={belegVerwerfen} />
            ))}
          </div>
        </div>
      )}

      <ZonenTitel>Im Blick</ZonenTitel>

      {/* ── 2) KPI-Ampel ── */}
      <div>
        <SekEyebrow note="jede Kachel führt zum Detail">Auf einen Blick</SekEyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <Kpi icon="⏳" value={ueberfaellig.length} label="Überfällig" tone={ueberfaellig.length ? 'crit' : 'calm'} sub={ueberfaellig.length ? 'sofort ansehen' : ''} />
          <Kpi icon="📅" value={faelligHeute.length} label="Heute fällig" tone={faelligHeute.length ? 'warn' : 'calm'} />
          <Kpi icon="📥" value={offeneEmails.length} label="Unbeantw. Mails" tone={offeneEmails.length ? 'ok' : 'calm'} sub={neueMails ? `${neueMails} ganz neu` : ''} onClick={offeneEmails.length ? posteingangZeigen : undefined} />
          <Kpi icon="❓" value={rqGesamt} label="Wartet auf Mandant" tone="calm" />
          <Kpi icon="📁" value={belegKarten.length} label="Belege z. Freigabe" tone={belegKarten.length ? 'ok' : 'calm'} onClick={onOeffneEingang} />
        </div>
      </div>

      {/* ── 3) Heute dran ── */}
      {heuteDran.length > 0 && (
        <div>
          <SekEyebrow note="nach Dringlichkeit">Heute dran</SekEyebrow>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
            {heuteDran.slice(0, 6).map((r, i) => (
              <div key={r.id || i} onClick={() => r.mandantId && onSelectClient(r.mandantId)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 15px', borderBottom: i < Math.min(heuteDran.length, 6) - 1 ? '1px solid var(--border)' : 'none', borderLeft: `3px solid ${r.ueb ? 'var(--red)' : 'var(--yellow)'}`, cursor: r.mandantId ? 'pointer' : 'default' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.ueb ? 'var(--red)' : 'var(--yellow)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titel}</div>
                  {nameOf(r.mandantId) && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{nameOf(r.mandantId)}</div>}
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', whiteSpace: 'nowrap', background: r.ueb ? 'var(--red-dim, var(--surface2))' : 'var(--surface2)', color: r.ueb ? 'var(--red)' : 'var(--yellow)' }}>
                  {r.ueb ? 'überfällig' : 'heute'}
                </span>
              </div>
            ))}
            {dranGesamt > 6 && <div style={{ padding: '8px 15px', fontSize: '11px', color: 'var(--text-muted)' }}>… und {dranGesamt - 6} weitere</div>}
          </div>
        </div>
      )}

      {/* ── 4) Weitere Eingänge (Handy + Belege) ── */}
      {handyKarten.length > 0 && (
        <div>
          <SekEyebrow note={<button onClick={onOeffneEingang} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontSize: '11.5px', fontWeight: 600 }}>→ zum vollen Eingang</button>}>Weitere Eingänge</SekEyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            {handyKarten.slice(0, 2).map(k => (
              <div key={k.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '12px 13px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--yellow)' }}>vom Handy</span>
                <div style={{ fontSize: '13px', fontWeight: 650, marginTop: '4px' }}>{truncate(k.raw_text || 'Meldung', 70)}</div>
                {k.client_name && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{k.client_name}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5) Mandanten-Radar ── */}
      {radar.length > 0 && (
        <div>
          <SekEyebrow note="wer viel offen hat, wer ruhig ist">Mandanten-Radar</SekEyebrow>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '15px 16px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {radar.map(({ client, n }) => {
              const pct = Math.max(12, Math.round((n / radarMax) * 100))
              const col = n >= radarMax * 0.75 ? 'var(--red)' : n >= radarMax * 0.4 ? 'var(--yellow)' : 'var(--accent)'
              return (
                <div key={client.id} onClick={() => onSelectClient(client.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <span style={{ width: '190px', flexShrink: 0, fontSize: '12.5px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</span>
                  <div style={{ flex: 1, height: '9px', background: 'var(--surface2)', borderRadius: '20px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: '20px', background: col }} />
                  </div>
                  <span style={{ width: '70px', textAlign: 'right', flexShrink: 0, fontSize: '11px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{n} offen</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Interessenten aus dem Erstkontaktbogen ── */}
      {offeneInteressenten.length > 0 && (
        <div>
          <SekEyebrow note="aus dem Erstgespräch">Interessenten</SekEyebrow>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
            {offeneInteressenten.slice(0, 5).map((b, i) => (
              <div key={b.id} onClick={() => onOeffneBogen?.(b.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 15px', cursor: 'pointer',
                  borderBottom: i < Math.min(offeneInteressenten.length, 5) - 1 ? '1px solid var(--border)' : 'none' }}>
                <span aria-hidden="true">🤝</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.felder?.name?.trim() || 'Neuer Erstkontakt'}
                  </div>
                  {b.felder?.naechsterSchritt && (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      → {b.felder.naechsterSchritt}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '20px', background: 'var(--surface2)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {b.status || 'offen'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 6) Fristen (30 Tage) ── */}
      <div>
        <SekEyebrow note="nächste 30 Tage">Fristen</SekEyebrow>
        {fristen.length === 0 ? (
          <div style={{ padding: '18px', textAlign: 'center', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '12.5px' }}>
            Keine Fristen in den nächsten 30 Tagen
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '4px 16px' }}>
            {fristen.slice(0, 8).map((item, i) => (
              <div key={item.id} onClick={() => item.mandantId && onSelectClient(item.mandantId)} style={{ display: 'flex', gap: '13px', padding: '10px 0', borderBottom: i < Math.min(fristen.length, 8) - 1 ? '1px solid var(--border)' : 'none', cursor: item.mandantId ? 'pointer' : 'default' }}>
                <div style={{ width: '92px', flexShrink: 0, fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>{fmtDate(item.datum)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.titel}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {[QUELLE_CFG[item.quelle]?.label, item.mandantName].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>
            ))}
            {fristen.length > 8 && <div style={{ padding: '8px 0', fontSize: '11px', color: 'var(--text-muted)' }}>+ {fristen.length - 8} weitere</div>}
          </div>
        )}
      </div>

    </div>
  )
}
