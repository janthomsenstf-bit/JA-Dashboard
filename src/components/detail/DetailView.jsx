import { useState } from 'react'
import StandDerArbeitTab    from './StandDerArbeitTab.jsx'
import AufgabenTab          from './AufgabenTab.jsx'
import AuftragTab           from './AuftragTab.jsx'
import AbschlussTab         from './AbschlussTab.jsx'
import LohnTab              from './LohnTab.jsx'
import BeratungTab          from './BeratungTab.jsx'
import RechnerTab           from './rechner/RechnerTab.jsx'
import KommunikationTab     from './KommunikationTab.jsx'
import TermineSection       from './TermineSection.jsx'
import NewClientModal       from '../NewClientModal.jsx'

const TABS = ['📋 Auftrag', '📊 Status & Arbeit', '✅ Aufgaben', '📁 Abschluss', '💼 Lohn', '🧠 Beratung', '🔢 Rechner', '✉️ Kommunikation']


export default function DetailView({
  client,
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
  termine = [],
  onAddTermin,
  onUpdateTermin,
  onDeleteTermin,
}) {
  const [activeTab, setActiveTab]   = useState(0)
  const [showEdit, setShowEdit]     = useState(false)

  // Mandantennummern als Array (ohne leere)
  const allNrs = [client.mandantennummer, client.mandantennummer2, client.mandantennummer3]
    .filter(Boolean)

  function handleEditSave(formData) {
    onUpdate(formData)
    setShowEdit(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
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

        {/* Tab bar */}
        <div className="tab-bar">
          {TABS.map((tab, i) => (
            <button
              key={i}
              className={`tab-btn${activeTab === i ? ' active' : ''}`}
              onClick={() => setActiveTab(i)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Termine & Fristen – immer sichtbar, aufklappbar */}
      <TermineSection
        client={client}
        termine={termine}
        onAdd={onAddTermin}
        onUpdate={onUpdateTermin}
        onDelete={onDeleteTermin}
      />

      {/* Tab content */}
      <div style={{ flex: 1 }}>
        {activeTab === 0 && (
          <AuftragTab key={client.id} client={client} onUpdate={onUpdate} />
        )}
        {activeTab === 1 && (
          <StandDerArbeitTab key={client.id} client={client} onUpdate={onUpdate} />
        )}
        {activeTab === 2 && (
          <AufgabenTab key={client.id} client={client} onUpdate={onUpdate} />
        )}
        {activeTab === 3 && (
          <AbschlussTab key={client.id} client={client} onUpdate={onUpdate} />
        )}
        {activeTab === 4 && (
          <LohnTab key={client.id} client={client} onUpdate={onUpdate} />
        )}
        {activeTab === 5 && (
          <BeratungTab key={client.id} client={client} onUpdate={onUpdate} />
        )}
        {activeTab === 6 && (
          <RechnerTab key={client.id} client={client} onUpdate={onUpdate} />
        )}
        {activeTab === 7 && (
          <KommunikationTab key={client.id} client={client} onUpdate={onUpdate} />
        )}
      </div>

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
