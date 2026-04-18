/**
 * MobileBottomNav – Bottom Navigation Bar für mobile Nutzung.
 * Nur sichtbar auf Screens ≤ 768px (via CSS).
 * Enthält 5 Haupt-Tabs + "Mehr"-Sheet für alle 15 Reiter.
 */
import { useState } from 'react'

// Alle 15 Reiter (identisch mit DetailView TAB_NAV)
const ALL_TABS = [
  { icon: '🏠', short: 'Übersicht'  },
  { icon: '🗂', short: 'Stammdaten' },
  { icon: '📊', short: 'Status'     },
  { icon: '✅', short: 'Aufgaben'   },
  { icon: '📁', short: 'Abschluss'  },
  { icon: '💼', short: 'Lohn'       },
  { icon: '🧠', short: 'Beratung'   },
  { icon: '🔢', short: 'Rechner'    },
  { icon: '✉️', short: 'Komm.'      },
  { icon: '📂', short: 'Dokumente'  },
  { icon: '📊', short: 'ESt'        },
  { icon: '⚡', short: 'Auftrag'    },
  { icon: '🧾', short: 'USt'        },
  { icon: '📋', short: 'Formulare'  },
  { icon: '📊', short: 'SuSa'       },
]

// 5 Tabs in der Bottom Bar
const BOTTOM_TABS = [
  { icon: '🏠', label: 'Start',    idx: 0  },
  { icon: '✉️', label: 'E-Mails',  idx: 8  },
  { icon: '✅', label: 'Aufgaben', idx: 3  },
  { icon: '📊', label: 'Status',   idx: 2  },
  { icon: '⋯',  label: 'Mehr',    idx: -1 },
]

export default function MobileBottomNav({ activeTab, setActiveTab }) {
  const [showSheet, setShowSheet] = useState(false)

  function go(idx) {
    setActiveTab(idx)
    setShowSheet(false)
  }

  return (
    <>
      {/* ── Bottom Navigation Bar ── */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        {BOTTOM_TABS.map(tab => (
          <button
            key={tab.idx}
            className={`mobile-nav-btn${activeTab === tab.idx || (tab.idx === -1 && showSheet) ? ' active' : ''}`}
            onClick={() => tab.idx === -1 ? setShowSheet(v => !v) : go(tab.idx)}
            aria-label={tab.label}
          >
            <span className="mobile-nav-icon">{tab.icon}</span>
            <span className="mobile-nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ── "Mehr"-Sheet: alle Reiter ── */}
      {showSheet && (
        <>
          <div className="mobile-sheet-backdrop" onClick={() => setShowSheet(false)} />
          <div className="mobile-sheet" role="dialog" aria-label="Alle Reiter">
            <div className="mobile-sheet-handle" />
            <div style={{ padding: '0 16px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Alle Bereiche
            </div>
            <div className="mobile-sheet-grid">
              {ALL_TABS.map((tab, i) => (
                <button
                  key={i}
                  className={`mobile-sheet-btn${activeTab === i ? ' active' : ''}`}
                  onClick={() => go(i)}
                >
                  <span style={{ fontSize: '20px', lineHeight: 1 }}>{tab.icon}</span>
                  <span style={{ fontSize: '11px', marginTop: '3px', lineHeight: 1.2 }}>{tab.short}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
