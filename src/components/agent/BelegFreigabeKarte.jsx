/**
 * BelegFreigabeKarte – ein Beleg-Bündel aus der Ablage-Freigabe (bot_inbox,
 * intent 'dokument_ablage') mit den beiden Entscheidungen „ablegen" / „verwerfen".
 *
 * Aus AiEmpfehlungenBereich herausgelöst, damit dieselbe Karte auch im Cockpit
 * läuft. Das Schreiben in Supabase bleibt unverändert: der lokale Ausführer liest
 * draft.stand === 'freigegeben'. Der Aufrufer entfernt die Karte aus seiner Liste
 * (onErledigt) – so bleibt es bei einer Datenquelle pro Ansicht.
 */
import { supabase } from '../../utils/supabaseClient.js'

// Schreibt die Entscheidung an das bot_inbox-Bündel. Rückgabe: Fehlertext oder ''.
export async function belegEntscheiden(item, freigabe) {
  const stand     = freigabe === 'ablegen' ? 'freigegeben' : 'verworfen'
  const dokumente = (item.draft?.dokumente || []).map(d => ({ ...d, freigabe }))
  const neuDraft  = { ...(item.draft || {}), stand, dokumente }
  const { error } = await supabase
    .from('bot_inbox')
    .update({ draft: neuDraft, status: 'verarbeitet' })
    .eq('id', item.id)
  return error ? error.message : ''
}

export default function BelegFreigabeKarte({ item, onFreigeben, onVerwerfen }) {
  const doks    = item.draft?.dokumente || []
  const sich    = item.draft?.sicherheit || 'hoch'
  const sichCol = sich === 'hoch' ? 'var(--green)' : sich === 'mittel' ? 'var(--yellow)' : 'var(--red)'

  return (
    <div style={{ border: '1px solid var(--border)', borderLeft: '4px solid var(--accent)', borderRadius: 'var(--radius)', background: 'var(--surface)', boxShadow: 'var(--shadow)', padding: '11px 14px' }}>
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
        <button onClick={() => onFreigeben(item)}
          style={{ background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)', padding: '7px 13px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
          📁 Alle ablegen freigeben
        </button>
        <button onClick={() => onVerwerfen(item)}
          style={{ background: 'none', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '7px 11px', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: 'pointer' }}>
          verwerfen
        </button>
      </div>
    </div>
  )
}
