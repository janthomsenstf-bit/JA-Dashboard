/**
 * SchnellMeldung – unterwegs kurz etwas in die Bot-Inbox werfen (intent 'ai_aktion').
 * Aus AiEmpfehlungenBereich herausgelöst, damit die Karte auch im Cockpit läuft.
 */
import { useState } from 'react'
import { supabase } from '../../utils/supabaseClient.js'


// #28 – Schnellmeldung vom Handy (PWA). Wirft unterwegs kurz etwas in die Bot-Inbox
// (intent 'ai_aktion') → erscheint sofort als Vorgang unter „vom Handy" in AI-Empfehlungen.
// Optional als Aufgabe/Rückfrage/Notiz vorbereitet → auf dem Desktop ein Klick zum Übernehmen.
export default function SchnellMeldung({ clients = [], onGemeldet }) {
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
