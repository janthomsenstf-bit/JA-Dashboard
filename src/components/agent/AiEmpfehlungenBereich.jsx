import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../../utils/supabaseClient.js'
import VorgangKarte from './VorgangKarte.jsx'
import { generiereVorgaenge } from '../../utils/vorgangGenerator.js'
import { makeVorgang } from '../../utils/vorgang.js'
import SchnellMeldung   from './SchnellMeldung.jsx'
import PosteingangKnopf from './PosteingangKnopf.jsx'
import UnbekanntCard    from './UnbekanntCard.jsx'
import BelegFreigabeKarte, { belegEntscheiden } from './BelegFreigabeKarte.jsx'
import { ladeIgnore, speichereIgnore, istWahrscheinlichUnwichtig } from '../../utils/unbekannteMails.js'

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




export default function AiEmpfehlungenBereich({ clients = [], dispatcher, onOeffneMandant, onMailErledigt, unbekannteEmails = [], onAssignEmail, onDismissUnbekannt, emailVorlagen = [], onRefresh, onNeuerMandantAusMail }) {
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

  // #29a – Beleg-Bündel freigeben / verwerfen (Schreibpfad in BelegFreigabeKarte.jsx).
  async function dokFreigeben(item) {
    setDokKarten(prev => prev.filter(i => i.id !== item.id))
    const fehler = await belegEntscheiden(item, 'ablegen')
    if (fehler) { setLadeFehler(fehler); ladeDok() }
  }
  async function dokVerwerfen(item) {
    setDokKarten(prev => prev.filter(i => i.id !== item.id))
    await belegEntscheiden(item, 'verworfen')
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

        <SchnellMeldung clients={clients} onGemeldet={ladeMcp} />

        <PosteingangKnopf />

        {dokKarten.length > 0 && (
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
              📁 Belege zur Freigabe ({dokKarten.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dokKarten.map(item => (
                <BelegFreigabeKarte key={item.id} item={item}
                  onFreigeben={dokFreigeben} onVerwerfen={dokVerwerfen} />
              ))}
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
                <UnbekanntCard key={`${e.account}:${e.uid}`} email={e} clients={clients} emailVorlagen={emailVorlagen} onAssign={onAssignEmail} onIgnore={() => ignoriereUnbekannt(e)} onNeuerMandant={onNeuerMandantAusMail} />
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
                  <UnbekanntCard key={`${e.account}:${e.uid}`} email={e} clients={clients} emailVorlagen={emailVorlagen} onAssign={onAssignEmail} onIgnore={() => ignoriereUnbekannt(e)} onNeuerMandant={onNeuerMandantAusMail} />
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
