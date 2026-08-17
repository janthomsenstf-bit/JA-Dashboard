/**
 * PosteingangKnopf – stößt den lokalen Posteingang-Lauf an und zeigt den Job-Stand.
 * Aus AiEmpfehlungenBereich herausgelöst, damit der Knopf auch im Cockpit läuft.
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../utils/supabaseClient.js'

const fmtUhr = (d) => { if (!d) return ''; const x = new Date(d); return isNaN(x) ? '' : x.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }

// #27 – Posteingang-Verarbeitung anstoßen (Job-Queue). Der Knopf hinterlegt nur eine Anfrage
// in der Bot-Inbox; der lokale Worker (Skill „posteingang-verarbeiten") holt sie ab, macht OCR
// und schickt die Ablage-Vorschläge als Freigabe-Karten zurück. Kein Dateizugriff aus der Web-App.
export default function PosteingangKnopf() {
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
