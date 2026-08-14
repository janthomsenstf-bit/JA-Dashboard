import { useState } from 'react'
import { getMandantStatus, MANDANT_STATUS_CONFIG } from '../../utils/progress.js'
import { saveSessionState } from '../../utils/sessionPersistence.js'
import StandDerArbeitTab    from './StandDerArbeitTab.jsx'
import AuftragTab           from './AuftragTab.jsx'
import BeratungTab          from './BeratungTab.jsx'
import KommunikationTab     from './KommunikationTab.jsx'
import AuftraegeTab, { AUFTRAGS_TYP_CFG } from './AuftraegeTab.jsx'
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
  const [offeneGruppen, setOffeneGruppen] = useState(() => new Set())   // aufgeklappte Leistungs-Gruppen (rechtes Band)
  const [nurLeistungId, setNurLeistungId] = useState(null)              // Einzel-Fokus: nur dieser Auftrag in der Mitte
  const toggleGruppe = (typ) => setOffeneGruppen(prev => { const n = new Set(prev); n.has(typ) ? n.delete(typ) : n.add(typ); return n })
  // Klick auf ein Jahr: exakt diesen Auftrag fokussieren (nur er wird mittig gezeigt),
  // vormerken (AuftraegeTab liest den Key beim Mounten) und in den passenden Reiter navigieren.
  const oeffneLeistung = (au) => {
    try { localStorage.setItem('sda-expanded-auftrag_' + client.id, au.id) } catch { /* ignore */ }
    setNurLeistungId(au.id)
    navigateToAuftraegeTyp(au.typ)
  }

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

  // Leistungen (Aufträge) nach Typ gruppieren – für das rechte Band (aufklappbar).
  const leistungsGruppen = (() => {
    const g = {}
    for (const au of (client.auftraege || [])) { (g[au.typ] = g[au.typ] || []).push(au) }
    return Object.entries(g)
  })()

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

      {/* ── Body: Mandanten-Navigation links + Inhalt rechts ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Mandanten-Navigation (links) ── */}
        <nav className="tab-nav-left" aria-label="Mandanten-Bereiche">
          <div className="tab-nav-heading">Mandant</div>
          {TAB_NAV.map((tab, i) => (
            <button
              key={i}
              className={`tab-nav-btn${activeTab === i ? ' active' : ''}${(i === TAB.auftraege || i === TAB.jahresabschluss || i === TAB.lohn) ? ' leistung-links-aus' : ''}`}
              onClick={() => { setNurLeistungId(null); setActiveTab(i) }}
              title={tab.short}
              aria-current={activeTab === i ? 'page' : undefined}
            >
              <span className="tab-nav-icon">{tab.icon}</span>
              <span className="tab-nav-label">{tab.short}</span>
            </button>
          ))}
        </nav>

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
              nurAuftragId={nurLeistungId}
              onClearNur={() => setNurLeistungId(null)}
              initialFilterTyp={auftraegeFilterTyp}
              onOpenEmail={(emailId) => {
                setLocalPendingEmailId(emailId)
                setActiveTab(TAB.nachrichten)
              }}
              emailVorlagen={emailVorlagen}
              emailSignaturen={emailSignaturen}
              onedriveTokens={onedriveTokens}
              onUpdateOnedriveTokens={onUpdateOnedriveTokens}
              onAddRueckfrage={onAddRueckfrage}
              onToggleRueckfrage={onToggleRueckfrage}
              onDeleteRueckfrage={onDeleteRueckfrage}
              onUpdateRueckfrageAntwort={onUpdateRueckfrageAntwort}
              onUpdateRueckfrageBuchungskonto={onUpdateRueckfrageBuchungskonto}
              onAddRueckfrageFromCheckliste={onAddRueckfrageFromCheckliste}
            />
          )}

          {activeTab === TAB.jahresabschluss && (
            <AuftraegeTab
              key={client.id + '-jahresabschluss'}
              client={client}
              onUpdate={onUpdate}
              bereich="jahresabschluss"
              nurAuftragId={nurLeistungId}
              onClearNur={() => setNurLeistungId(null)}
              onOpenEmail={(emailId) => {
                setLocalPendingEmailId(emailId)
                setActiveTab(TAB.nachrichten)
              }}
              emailVorlagen={emailVorlagen}
              emailSignaturen={emailSignaturen}
              onedriveTokens={onedriveTokens}
              onUpdateOnedriveTokens={onUpdateOnedriveTokens}
              onAddRueckfrage={onAddRueckfrage}
              onToggleRueckfrage={onToggleRueckfrage}
              onDeleteRueckfrage={onDeleteRueckfrage}
              onUpdateRueckfrageAntwort={onUpdateRueckfrageAntwort}
              onUpdateRueckfrageBuchungskonto={onUpdateRueckfrageBuchungskonto}
              onAddRueckfrageFromCheckliste={onAddRueckfrageFromCheckliste}
            />
          )}

          {activeTab === TAB.lohn && (
            <AuftraegeTab
              key={client.id + '-lohn'}
              client={client}
              onUpdate={onUpdate}
              bereich="lohn"
              nurAuftragId={nurLeistungId}
              onClearNur={() => setNurLeistungId(null)}
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
            <HonorareTab key={client.id} client={client} onUpdate={onUpdate} emailSignaturen={emailSignaturen} />
          )}

          {activeTab === TAB.beratung && (
            <BeratungTab key={client.id} client={client} onUpdate={onUpdate} />
          )}

          {activeTab === TAB.historie && (
            <StandDerArbeitTab key={client.id} client={client} onUpdate={onUpdate} />
          )}

        </div>

        {/* ── Leistungen (rechts) – Schritt 1: additiv, öffnet die jeweilige Akte ──
            Listet die Aufträge dieses Mandanten. Klick nutzt die vorhandene
            Navigation (JA/Lohn eigener Reiter, sonst gefilterter Aufträge-Reiter).
            Links bleibt unverändert; unter 900px wird das Band ausgeblendet. */}
        <aside className="leistungen-right" aria-label="Leistungen">
          <div className="tab-nav-heading" style={{ padding: '0 4px 4px' }}>Leistungen</div>
          {(client.auftraege || []).length === 0 && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '6px 8px', lineHeight: 1.5 }}>
              Noch keine Leistungen angelegt.
            </div>
          )}
          {leistungsGruppen.map(([typ, list]) => {
            const cfg  = AUFTRAGS_TYP_CFG[typ] || AUFTRAGS_TYP_CFG.freitext
            const offen = offeneGruppen.has(typ)
            return (
              <div key={typ}>
                {/* Ordner-Kopf (Typ) – aufklappbar */}
                <button
                  onClick={() => toggleGruppe(typ)}
                  title={cfg.label}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: '7px 8px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: '13px', flexShrink: 0 }} aria-hidden="true">{cfg.icon}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cfg.label}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{list.length}</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', width: '10px', textAlign: 'center' }} aria-hidden="true">{offen ? '▾' : '▸'}</span>
                </button>
                {/* Jahre / einzelne Aufträge */}
                {offen && list.map(au => {
                  const jahr  = au.abschlussJahr ?? au.jahr
                  const label = jahr ? String(jahr) : (au.bezeichnung || 'Auftrag')
                  return (
                    <button
                      key={au.id}
                      onClick={() => oeffneLeistung(au)}
                      title={au.bezeichnung || `${cfg.label} ${jahr ?? ''}`.trim()}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 8px 6px 27px', borderRadius: '7px', fontSize: '12px', color: au.status === 'erledigt' ? 'var(--text-muted)' : 'var(--text)', textDecoration: au.status === 'erledigt' ? 'line-through' : 'none' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      {au.blockiert && <span aria-hidden="true">🚧</span>}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{label}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
          <button
            onClick={() => { setNurLeistungId(null); setActiveTab(TAB.auftraege) }}
            title="Neue Leistung / neuen Auftrag anlegen"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', textAlign: 'left', border: '1px dashed var(--border2)', background: 'transparent', cursor: 'pointer', padding: '7px 8px', borderRadius: '7px', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px' }}
          >
            ＋ neue Leistung
          </button>
        </aside>
        <style>{`
          .leistungen-right { width: 236px; flex-shrink: 0; border-left: 1px solid var(--border); background: var(--surface); overflow-y: auto; padding: 10px 8px; display: flex; flex-direction: column; gap: 2px; }
          @media (max-width: 900px) { .leistungen-right { display: none } }
          /* Aufträge/Jahresabschluss/Lohn leben ab 901px rechts im Leistungen-Band → links ausblenden.
             Darunter (schmaler Desktop/Handy) bleiben sie im linken Menü erreichbar. */
          @media (min-width: 901px) { .leistung-links-aus { display: none !important; } }
        `}</style>

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
