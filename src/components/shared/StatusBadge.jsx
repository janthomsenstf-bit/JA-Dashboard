import { getMandantStatus, MANDANT_STATUS_CONFIG } from '../../utils/progress.js'

// Props:
//   client  — komplettes Client-Objekt (Status wird intern berechnet)
//   size    — 'sm' | 'md' (default: 'sm')
export default function StatusBadge({ client, size = 'sm' }) {
  const status = getMandantStatus(client)
  const cfg    = MANDANT_STATUS_CONFIG[status] ?? MANDANT_STATUS_CONFIG['in_bearbeitung']

  const pad   = size === 'md' ? '4px 12px' : '2px 8px'
  const fs    = size === 'md' ? '12px'      : '10px'

  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           '4px',
      padding:       pad,
      borderRadius:  '20px',
      fontSize:      fs,
      fontWeight:    700,
      background:    cfg.bg,
      color:         cfg.color,
      border:        `1px solid ${cfg.border}`,
      whiteSpace:    'nowrap',
      flexShrink:    0,
    }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}
