import { useState } from 'react'
import { getMandantStatus, MANDANT_STATUS_CONFIG } from '../../utils/progress.js'
import { saveSessionState } from '../../utils/sessionPersistence.js'
import StandDerArbeitTab    from './StandDerArbeitTab.jsx'
import AuftragTab           from './AuftragTab.jsx'
import BeratungTab          from './BeratungTab.jsx'
import KommunikationTab     from './KommunikationTab.jsx'
import AuftraegeTab         from './AuftraegeTab.jsx'
import ImmobilienTab        from './ImmobilienTab.jsx'
import HonorareTab          from './HonorareTab.jsx'
import DokumenteTab         from './DokumenteTab.jsx'
import NewClientModal       from '../NewClientModal.jsx'
import MobileBottomNav      from '../MobileBottomNav.jsx'

// ── Zentrale Tab-Index-Konstanten (NIE hartcoden – immer diese nutzen) ─────────
export const TAB = {
  mandant:         0,
  auftraege:       1,
  jahresabschluss: 2,
  lohn:            3,
  immobilien:      4,
  nachrichten:     5,
  dokumente:       6,
  honorare:        7,
  beratung:        8,
  historie:        9,
}

const TAB_NAV = [
  { icon: '👤', short: 'Mandant'         },  // 0
  { icon: '📋', short: 'Aufträge'        },  // 1
  { icon: '📁', short: 'Jahresabschluss' },  // 2
  { icon: '💼', short: 'Lohn'            },  // 3
  { icon: '🏠', short: 'Immobilien'      },  // 4
  { icon: '✉️', short: 'Nachrichten'     },  // 5
  { icon: '📂', short: 'Dokumente'       },  // 6
  { icon: '💰', short: 'Honorare'        },  // 7
  { icon: '🧠', short: 'Beratung'        },  // 8
  { icon: '📊', short: 'Historie'        },  // 9
]

export default function DetailView({
  client,
  initialTab = 0,
  onTabChange,
  onUpdate,
  onAddRueckfrage,
  onToggleRueckfrage,
  onDeleteRueckfrage,
  onUpdateRueckfrageDate,
  onUpdateRueckfrageAntwort,
  onUpdateRueckfrageBuchungskonto,
  onAddErinnerung,
  onDeleteErinnerung,
  onArchive,
  onDelete,
  onUpdateBerechnungen,
  checklistenTypen,
  onUpdateCheckliste,
  onAddRueckfrageFromCheckliste,
  vorlagen = [],
  onUpdateVorlagen,
  emailVorlagen = [],
  onUpdateEmailVorlagen,
  emailSignaturen = [],
  onUpdateEmailSignaturen,
  formVorlagen = [],
  onUpdateFormVorlagen,
  termine = [],
  onAddTermin,
  onUpdateTermin,
  onDeleteTermin,
  onedriveTokens = null,
  onUpdateOnedriveTokens,
  claudeApiKey = '',
  onUpdateClaudeApiKey,
  pendingOpenEmailId = null,
  onClearPendingOpenEmailId,
}) {
  // Der aktive Tab wird ZENTRAL in App gehalten (Prop initialTab = detailInitialTab).
  // DetailView hat KEINEN eigenen Tab-State und KEINE Sync-Effekte mehr – dadurch
  // können sich lokaler Tab und App-Tab nicht mehr gegenseitig umschreiben
  // (das war die Ursache für das Flackern / Hin-und-Her-Springen zwischen Reitern).
  const activeTab = initialTab
  const setActiveTab = (n) => {
    onTabChange?.(n)
    saveSessionState({ selectedId: client.id, detailInitialTab: n, activeTab: n })
  }

  const [showEdit, setShowEdit]               = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState(null)
  const [auftraegeFilterTyp, setAuftraegeFilterTyp] = useState('alle')
  const [localPendingEmailId, setLocalPendingEmailId] = useState(null)  // für E-Mail-Öffnung aus Aufträge-Tab

  function handleSendAsAttachment(attachments) {
    setPendingAttachments(attachments)
    setActiveTab(TAB.nachrichten)
  }

  // Typ-gefilterter Sprung in Aufträge (z.B. aus Schnellnavigation oder BotInbox).
  // Jahresabschluss & Lohn haben eigene Reiter → dorthin springen.
  function navigateToAuftraegeTyp(typ) {
    if (typ === 'jahresabschluss') { setActiveTab(TAB.jahresabschluss); return }
    if (typ === 'lohn')            { setActiveTab(TAB.lohn); return }
    setAuftraegeFilterTyp(typ ?? 'alle')
    setActiveTab(TAB.auftraege)
  }

  const allNrs = [client.mandantennummer, client.mandantennummer2, client.mandantennummer3]
    .filter(Boolean)

  function handleEditSave(formData) {
    onUpdate(formData)
    setShowEdit(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Detail Header ── */}
      <div className="detail-header">
        <div className="detail-header-top">
          <div className="detail-header-info">
            <div className="detail-header-name">{client.name}</div>
            <div className="detail-header-meta">
              <span className="badge badge-blue">{client.rechtsform}</span>
              <span className="badge badge-muted">{client.gewinnermittlung}</span>
              {allNrs.map((nr, i) => (
                <span key={i} className="detail-meta-item">
                  <span style={{ color: 'var(--text-muted)' }}>Nr.{allNrs.length > 1 ? (i + 1) : ''}</span>
                  <span className="mono">{nr}</span>
                </span>
              ))}
              <span className="detail-meta-item">
                <span style={{ color: 'var(--text-muted)' }}>VJ</span>
                <span className="mono">
                  {[client.veranlagungsjahr, client.veranlagungsjahr2, client.veranlagungsjahr3]
                    .filter(Boolean).join(' / ')}
                </span>
              </span>
              {client.unternehmensgegenstand && (
                <span className="detail-meta-item">
                  <span style={{ color: 'var(--text-muted)' }}>Gegenstand</span>
                  <span>{client.unternehmensgegenstand}</span>
                </span>
              )}
              {client.archiviert && (
                <span className="badge badge-muted">Archiviert</span>
              )}
            </div>
          </div>
          <div className="detail-header-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowEdit(true)} title="Mandantendaten bearbeiten">
              ✏️ Bearbeiten
            </button>
            {!client.archiviert && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={onArchive}
                style={{ color: '#16a34a', borderColor: 'rgba(22,163,74,0.3)' }}
              >
                ✅ Abschließen
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={onDelete}
              style={{ color: 'var(--red)', borderColor: 'var(--red-dim)' }}
              title="Mandant dauerhaft löschen"
            >
              🗑 Löschen
            </button>
          </div>
        </div>

        {/* ── Status-Strip ── */}
        {(() => {
          const status = getMandantStatus(client)
          const cfg    = MANDANT_STATUS_CONFIG[status]
          const openQ  = (client.rueckfragen ?? []).filter(r => !r.beantwortet).length
          const rqGesendet = (client.rueckfragenSendungen ?? []).find(d => d)
          const faDatum    = client.faGeplantDatum
          const steDatum   = client.steGesendetDatum

          function fmtShort(iso) {
            if (!iso) return null
            const d = new Date(iso)
            return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
          }

          const datumItems = [
            rqGesendet ? `RQ gesendet ${fmtShort(rqGesendet)}` : null,
            steDatum   ? `STE ${fmtShort(steDatum)}` : null,
            faDatum    ? `FA ${fmtShort(faDatum)}` : null,
          ].filter(Boolean)

          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
              padding: '5px 16px', borderTop: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.15)', fontSize: '11px',
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '2px 9px', borderRadius: '20px', fontWeight: 700,
                background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                whiteSpace: 'nowrap',
              }}>
                {cfg.icon} {cfg.label}
              </span>
              {openQ > 0 && (
                <span style={{ color: '#ef4444', fontWeight: 600 }}>● {openQ} RQ offen</span>
              )}
              {openQ === 0 && (client.rueckfragen ?? []).length > 0 && (
                <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Alle RQ beantwortet</span>
              )}
              {datumItems.map((item, i) => (
                <span key={i} style={{ color: 'var(--text-muted)' }}>· {item}</span>
              ))}
              {client.mandatstyp === 'intern' && (
                <span style={{
                  marginLeft: 'auto', fontSize: '10px', fontWeight: 700,
                  padding: '1px 7px', borderRadius: '10px',
                  background: 'rgba(124,58,237,0.12)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.3)',
                }}>
                  INTERN
                </span>
              )}
            </div>
          )
        })()}
      </div>

      {/* ── Body: Inhalt + Tab-Navigation ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Tab-Inhalt */}
        <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>

          {activeTab === TAB.mandant && (
            <AuftragTab
              key={client.id}
              client={client}
              onUpdate={onUpdate}
              claudeApiKey={claudeApiKey}
              onUpdateClaudeApiKey={onUpdateClaudeApiKey}
              emailSignaturen={emailSignaturen}
              onedriveTokens={onedriveTokens}
              onUpdateOnedriveTokens={onUpdateOnedriveTokens}
              onNavigateToTab={setActiveTab}
              onNavigateToAuftraegeTyp={navigateToAuftraegeTyp}
            />
          )}

          {activeTab === TAB.auftraege && (
            <AuftraegeTab
              key={client.id + '-allgemein'}
              client={client}
              onUpdate={onUpdate}
              bereich="allgemein"
              initialFilterTyp={auftraegeFilterTyp}
              onOpenEmail={(emailId) => {
                setLocalPendingEmailId(emailId)
                setActiveTab(TAB.nachrichten)
              }}
              emailVorlagen={emailVorlagen}
              emailSignaturen={emailSignaturen}
              onedriveTokens={onedriveTokens}
              onUpdateOnedriveTokens={onUpdateOnedriveTokens}
            />
          )}

          {activeTab === TAB.jahresabschluss && (
            <AuftraegeTab
              key={client.id + '-jahresabschluss'}
              client={client}
              onUpdate={onUpdate}
              bereich="jahresabschluss"
              onOpenEmail={(emailId) => {
                setLocalPendingEmailId(emailId)
                setActiveTab(TAB.nachrichten)
              }}
              emailVorlagen={emailVorlagen}
              emailSignaturen={emailSignaturen}
              onedriveTokens={onedriveTokens}
              onUpdateOnedriveTokens={onUpdateOnedriveTokens}
            />
          )}

          {activeTab === TAB.lohn && (
            <AuftraegeTab
              key={client.id + '-lohn'}
              client={client}
              onUpdate={onUpdate}
              bereich="lohn"
              onOpenEmail={(emailId) => {
                setLocalPendingEmailId(emailId)
                setActiveTab(TAB.nachrichten)
              }}
              emailVorlagen={emailVorlagen}
              emailSignaturen={emailSignaturen}
              onedriveTokens={onedriveTokens}
              onUpdateOnedriveTokens={onUpdateOnedriveTokens}
            />
          )}

          {activeTab === TAB.immobilien && (
            <ImmobilienTab key={client.id} client={client} onUpdate={onUpdate} />
          )}

          {activeTab === TAB.nachrichten && (
            <KommunikationTab
              key={client.id}
              client={client}
              onUpdate={onUpdate}
              emailVorlagen={emailVorlagen}
              onUpdateEmailVorlagen={onUpdateEmailVorlagen}
              emailSignaturen={emailSignaturen}
              onUpdateEmailSignaturen={onUpdateEmailSignaturen}
              onedriveTokens={onedriveTokens}
              onUpdateOnedriveTokens={onUpdateOnedriveTokens}
              pendingAttachments={pendingAttachments}
              onClearPendingAttachments={() => setPendingAttachments(null)}
              pendingOpenEmailId={pendingOpenEmailId ?? localPendingEmailId}
              onClearPendingOpenEmailId={() => {
                onClearPendingOpenEmailId?.()
                setLocalPendingEmailId(null)
              }}
            />
          )}

          {activeTab === TAB.dokumente && (
            <DokumenteTab
              key={client.id}
              client={client}
              onUpdate={onUpdate}
              onNavigateToKomm={() => setActiveTab(TAB.nachrichten)}
              onedriveTokens={onedriveTokens}
              onUpdateOnedriveTokens={onUpdateOnedriveTokens}
              onSendAsAttachment={handleSendAsAttachment}
            />
          )}

          {activeTab === TAB.honorare && (
            <HonorareTab key={client.id} client={client} onUpdate={onUpdate} />
          )}

          {activeTab === TAB.beratung && (
            <BeratungTab key={client.id} client={client} onUpdate={onUpdate} />
          )}

          {activeTab === TAB.historie && (
            <StandDerArbeitTab key={client.id} client={client} onUpdate={onUpdate} />
          )}

        </div>

        {/* ── Vertikale Tab-Navigation rechts ── */}
        <nav className="tab-nav-right" aria-label="Reiter">
          {TAB_NAV.map((tab, i) => (
            <button
              key={i}
              className={`tab-nav-btn${activeTab === i ? ' active' : ''}`}
              onClick={() => setActiveTab(i)}
              title={tab.short}
            >
              <span className="tab-nav-icon">{tab.icon}</span>
              <span className="tab-nav-label">{tab.short}</span>
            </button>
          ))}
        </nav>

      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Bearbeitungs-Modal */}
      {showEdit && (
        <NewClientModal
          editMode={true}
          initialData={client}
          onClose={() => setShowEdit(false)}
          onSubmit={handleEditSave}
        />
      )}
    </div>
  )
}
