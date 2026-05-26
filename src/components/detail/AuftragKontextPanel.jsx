/**
 * AuftragKontextPanel – kompaktes Auftrags-Widget für einbettung in andere Tabs.
 *
 * Props:
 *   client              – Mandant-Objekt
 *   typen               – Array von Auftragstypen, die angezeigt werden sollen
 *                         z. B. ['lohn'] oder ['fibu', 'ust']
 *   onUpdate            – (patch) => void  (zum Speichern)
 *   onNavigateToTab     – (tabIndex) => void  (Sprung zum Aufträge-Tab)
 *   auftraegeTabIndex   – Index des Aufträge-Tabs (default 14)
 */
import { AUFTRAGS_TYP_CFG, AUFTRAGS_STATUS_CFG } from './AuftraegeTab.jsx'

const MONATE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
const STATUS_ORDER = ['offen', 'in_bearbeitung', 'erledigt']

function fmtFristShort(iso) {
  if (!iso) return null
  const d     = new Date(iso + 'T12:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff  = Math.ceil((d - today) / (1000 * 60 * 60 * 24))
  const ds    = `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
  if (diff < 0)   return { text: `${ds} (${Math.abs(diff)}d überfällig)`, color: '#ef4444' }
  if (diff === 0) return { text: `${ds} (heute)`,    color: '#f97316' }
  if (diff <= 7)  return { text: `${ds} (${diff}d)`, color: '#f97316' }
  return { text: ds, color: 'var(--text-muted)' }
}

export default function AuftragKontextPanel({
  client,
  typen,
  onUpdate,
  onNavigateToTab,
  auftraegeTabIndex = 14,
}) {
  const alle     = client.auftraege ?? []
  const relevant = alle.filter(a => typen.includes(a.typ) && a.status !== 'erledigt')

  if (relevant.length === 0) return null

  function cycleStatus(id, current) {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length]
    onUpdate({
      auftraege: alle.map(a =>
        a.id === id
          ? { ...a, status: next, erledigtAm: next === 'erledigt' ? new Date().toISOString() : null }
          : a
      ),
    })
  }

  return (
    <div style={{
      marginBottom: '20px',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 14px', background: 'var(--surface2)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>📋 Offene Aufträge</span>
        <span style={{
          fontSize: '11px', color: 'var(--text-muted)',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '0 7px',
        }}>
          {relevant.length}
        </span>
        {onNavigateToTab && (
          <button
            onClick={() => onNavigateToTab(auftraegeTabIndex)}
            style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
          >
            → Alle Aufträge
          </button>
        )}
      </div>

      {/* Aufträge */}
      <div style={{ background: 'var(--surface)' }}>
        {relevant.map((au, i) => {
          const typCfg    = AUFTRAGS_TYP_CFG[au.typ]     ?? AUFTRAGS_TYP_CFG.freitext
          const statusCfg = AUFTRAGS_STATUS_CFG[au.status] ?? AUFTRAGS_STATUS_CFG.offen
          const frist     = fmtFristShort(au.frist)
          const hinweise  = (au.hinweise ?? []).filter(h => !h.erledigt)
          const titel     = au.bezeichnung || `${typCfg.label}${au.monat ? ' ' + MONATE[au.monat - 1] : ''} ${au.jahr}`

          return (
            <div key={au.id} style={{
              borderBottom: i < relevant.length - 1 ? '1px solid var(--border)' : 'none',
              padding: '8px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{typCfg.icon}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {titel}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px', alignItems: 'center' }}>
                    {frist && (
                      <span style={{ fontSize: '10px', color: frist.color, fontWeight: 600 }}>⏰ {frist.text}</span>
                    )}
                    {hinweise.length > 0 && (
                      <span style={{ fontSize: '10px', color: '#f97316' }}>
                        · {hinweise.length} Hinweis{hinweise.length !== 1 ? 'e' : ''} offen
                      </span>
                    )}
                    {au.notiz && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                        · {au.notiz}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => cycleStatus(au.id, au.status)}
                  title="Status wechseln"
                  style={{
                    fontSize: '10px', fontWeight: 700, padding: '2px 9px', borderRadius: '20px',
                    border: `1px solid ${statusCfg.border}`,
                    background: statusCfg.bg, color: statusCfg.color,
                    cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                  }}
                >
                  {statusCfg.icon} {statusCfg.label}
                </button>
              </div>

              {/* Offene Hinweise */}
              {hinweise.length > 0 && (
                <div style={{ marginTop: '6px', marginLeft: '22px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {hinweise.slice(0, 3).map(h => (
                    <div key={h.id} style={{
                      fontSize: '11px', color: 'var(--text-secondary)',
                      padding: '2px 8px',
                      borderLeft: `2px solid ${typCfg.color}55`,
                    }}>
                      {h.text}
                    </div>
                  ))}
                  {hinweise.length > 3 && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', paddingLeft: '8px' }}>
                      + {hinweise.length - 3} weitere
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
