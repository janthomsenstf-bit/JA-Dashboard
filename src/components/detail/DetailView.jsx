import { useState } from 'react'
import { getMandantStatus, MANDANT_STATUS_CONFIG } from '../../utils/progress.js'
import UebersichtTab        from './UebersichtTab.jsx'
import StandDerArbeitTab    from './StandDerArbeitTab.jsx'
import AufgabenTab          from './AufgabenTab.jsx'
import AuftragTab           from './AuftragTab.jsx'
import AbschlussTab         from './AbschlussTab.jsx'
import LohnTab              from './LohnTab.jsx'
import FIBUTab             from './FIBUTab.jsx'
import BeratungTab          from './BeratungTab.jsx'
import KommunikationTab     from './KommunikationTab.jsx'
import AuftraegeTab        from './AuftraegeTab.jsx'
import HonorareTab         from './HonorareTab.jsx'
import DokumenteTab         from './DokumenteTab.jsx'
import EStTab               from './EStTab.jsx'
import UStTab               from './UStTab.jsx'
import FormularTab          from '../formular/FormularTab.jsx'
import NewClientModal       from '../NewClientModal.jsx'
import SusaTab              from './SUSATab.jsx'
import MobileBottomNav      from '../MobileBottomNav.jsx'

const TAB_NAV = [
  { icon: '🏠', short: 'Dashboard'  },  // 0
  { icon: '🗂', short: 'Stammdaten' },  // 1
  { icon: '📊', short: 'Historie'   },  // 2
  { icon: '✅', short: 'Aufgaben'   },  // 3
  { icon: '📁', short: 'Abschluss'  },  // 4
  { icon: '💼', short: 'Lohn'       },  // 5
  { icon: '🧠', short: 'Beratung'   },  // 6
  { icon: '✉️', short: 'Nachrichten' },  // 7
  { icon: '📂', short: 'Dokumente'  },  // 8
  { icon: '📊', short: 'ESt'        },  // 9
  { icon: '🧾', short: 'USt'        },  // 10
  { icon: '📋', short: 'Formulare'  },  // 11
  { icon: '📊', short: 'SuSa'       },  // 12
  { icon: '📒', short: 'FIBU'       },  // 13
  { icon: '📋', short: 'Aufträge'   },  // 14
  { icon: '💰', short: 'Honorare'  },  // 15
]


export default function DetailView({
  client,
  initialTab = 0,
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
}) {
  const [activeTab, setActiveTab]         = useState(initialTab)
  const [showEdit, setShowEdit]           = useState(false)
  const [pendingAttachments, setPendingAttachments] = useState(null)  // OneDrive → E-Mail

  function handleSendAsAttachment(attachments) {
    setPendingAttachments(attachments)
    setActiveTab(7)  // Kommunikation-Tab öffnen
  }

  // Mandantennummern als Array (ohne leere)
  const allNrs = [client.mandantennummer, client.mandantennummer2, client.mandantennummer3]
    .filter(Boolean)

  function handleEditSave(formData) {
    onUpdate(formData)
    setShowEdit(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Detail Header */}
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
              padding: '5px 16px',
              borderTop: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.15)',
              fontSize: '11px',
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

      {/* Body: Inhalt + vertikale Tab-Navigation rechts */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
        {activeTab === 0 && (
          <UebersichtTab key={client.id} client={client} onNavigateToTab={setActiveTab} onUpdate={onUpdate} />
        )}
        {activeTab === 1 && (
          <AuftragTab key={client.id} client={client} onUpdate={onUpdate} claudeApiKey={claudeApiKey} onUpdateClaudeApiKey={onUpdateClaudeApiKey} emailSignaturen={emailSignaturen} />
        )}
        {activeTab === 2 && (
          <StandDerArbeitTab key={client.id} client={client} onUpdate={onUpdate} />
        )}
        {activeTab === 3 && (
          <AufgabenTab key={client.id} client={client} onUpdate={onUpdate} onAddTermin={onAddTermin} />
        )}
        {activeTab === 4 && (
          <AbschlussTab key={client.id} client={client} onUpdate={onUpdate} />
        )}
        {activeTab === 5 && (
          <LohnTab key={client.id} client={client} onUpdate={onUpdate} />
        )}
        {activeTab === 6 && (
          <BeratungTab key={client.id} client={client} onUpdate={onUpdate} />
        )}
        {activeTab === 7 && (
          <KommunikationTab key={client.id} client={client} onUpdate={onUpdate} emailVorlagen={emailVorlagen} onUpdateEmailVorlagen={onUpdateEmailVorlagen} emailSignaturen={emailSignaturen} onUpdateEmailSignaturen={onUpdateEmailSignaturen} onedriveTokens={onedriveTokens} onUpdateOnedriveTokens={onUpdateOnedriveTokens} pendingAttachments={pendingAttachments} onClearPendingAttachments={() => setPendingAttachments(null)} />
        )}
        {activeTab === 8 && (
          <DokumenteTab
            key={client.id}
            client={client}
            onUpdate={onUpdate}
            onNavigateToKomm={() => setActiveTab(7)}
            onedriveTokens={onedriveTokens}
            onUpdateOnedriveTokens={onUpdateOnedriveTokens}
            onSendAsAttachment={handleSendAsAttachment}
          />
        )}
        {activeTab === 9 && (
          <EStTab key={client.id} client={client} onUpdate={onUpdate} onAddRueckfrage={onAddRueckfrage} />
        )}
        {activeTab === 10 && (
          <UStTab
            key={client.id}
            client={client}
            onUpdate={onUpdate}
            emailVorlagen={emailVorlagen}
            emailSignaturen={emailSignaturen}
          />
        )}
        {activeTab === 11 && (
          <FormularTab
            key={client.id}
            client={client}
            onUpdate={onUpdate}
            formVorlagen={formVorlagen}
            onUpdateFormVorlagen={onUpdateFormVorlagen}
            emailVorlagen={emailVorlagen}
            emailSignaturen={emailSignaturen}
          />
        )}
        {activeTab === 12 && (
          <SusaTab key={client.id} client={client} onUpdate={onUpdate} />
        )}
        {activeTab === 13 && (
          <FIBUTab key={client.id} client={client} onUpdate={onUpdate} />
        )}
        {activeTab === 14 && (
          <AuftraegeTab key={client.id} client={client} onUpdate={(patch) => onUpdate(patch)} />
        )}
        {activeTab === 15 && (
          <HonorareTab key={client.id} client={client} onUpdate={onUpdate} />
        )}
      </div>{/* end tab content */}

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

      </div>{/* end body flex row */}

      {/* Mobile Bottom Navigation (nur auf ≤768px sichtbar via CSS) */}
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
