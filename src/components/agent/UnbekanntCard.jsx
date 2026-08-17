/**
 * UnbekanntCard – Karte für eine unzugeordnete E-Mail (unbekannter Absender):
 * zuordnen, zusammenfassen lassen, Antwort entwerfen und senden.
 * Aus AiEmpfehlungenBereich herausgelöst, damit die Karte auch im Cockpit läuft.
 */
import { useState } from 'react'
import { callAI, hasAiKey } from '../../utils/aiClient.js'

export default function UnbekanntCard({ email, clients = [], emailVorlagen = [], onAssign, onIgnore, onNeuerMandant }) {
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
        {onNeuerMandant && (
          <button onClick={() => onNeuerMandant(email)}
            title="Neuen Mandanten anlegen – Name und E-Mail werden aus dieser Mail vorbelegt, danach wird die Mail gleich zugeordnet"
            style={{ background: 'none', border: '1px solid var(--border2)', color: 'var(--accent)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            ＋ Neuer Mandant
          </button>
        )}
        <button onClick={() => onIgnore?.()} title="Künftige E-Mails von diesem Absender ignorieren"
          style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '6px 11px', borderRadius: '999px', fontSize: '11px', cursor: 'pointer' }}>
          🚫 Absender ignorieren
        </button>
      </div>
    </div>
  )
}
