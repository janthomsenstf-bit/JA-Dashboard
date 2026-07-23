
import { useState } from 'react';
import {
  MOCK_EVENTS,
  getEventTypLabel,
  getEventTypIcon,
  getEventStatusLabel,
  getEventStatusColor,
  getEventZielLabel,
  getTeilnehmerStatusColor,
  getLandFlag,
  type MockEvent_Full,
} from '@easyb2b/lib/mockdata';

type TabType = 'liste' | 'detail' | 'analytics';

export default function EventsPage() {
  const [tab, setTab] = useState<TabType>('liste');
  const [filterStatus, setFilterStatus] = useState('alle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'teilnehmer' | 'feedback' | 'matches'>('info');

  const filtered = MOCK_EVENTS.filter(e =>
    filterStatus === 'alle' || e.status === filterStatus
  );

  const selectedEvent = selectedId ? MOCK_EVENTS.find(e => e.id === selectedId) : null;

  // ── Analytics Berechnungen ────────────────────────────────
  const totalTeilnehmer = MOCK_EVENTS.reduce((s, e) => s + e.teilnehmer.length, 0);
  const totalErschienen = MOCK_EVENTS.reduce((s, e) => s + e.teilnehmer.filter(t => t.erschienen).length, 0);
  const totalMatches = MOCK_EVENTS.reduce((s, e) => s + e.matches.length, 0);
  const totalKooperationen = MOCK_EVENTS.reduce((s, e) => s + e.matches.filter(m => m.kooperation).length, 0);
  const allFeedbacks = MOCK_EVENTS.flatMap(e => e.feedback);
  const avgBewertung = allFeedbacks.length > 0
    ? (allFeedbacks.reduce((s, f) => s + f.bewertung, 0) / allFeedbacks.length).toFixed(1)
    : '–';
  const durchgefuehrt = MOCK_EVENTS.filter(e => e.status === 'durchgefuehrt').length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, color: '#003366', fontSize: '24px' }}>Veranstaltungen</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['liste', 'analytics'] as TabType[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 18px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '13px',
              backgroundColor: tab === t ? '#003366' : '#f0f0f0',
              color: tab === t ? 'white' : '#666',
            }}>
              {t === 'liste' ? 'Alle Events' : 'Analytics'}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: LISTE ─────────────────────────────────── */}
      {tab === 'liste' && (
        <div style={{ display: 'flex', gap: '24px' }}>
          {/* Linke Spalte: Karten */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Filter */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', display: 'block', marginBottom: '3px' }}>Status</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
                  <option value="alle">Alle Events</option>
                  <option value="geplant">Geplant</option>
                  <option value="veroeffentlicht">Veröffentlicht</option>
                  <option value="ausgebucht">Ausgebucht</option>
                  <option value="durchgefuehrt">Durchgeführt</option>
                  <option value="abgesagt">Abgesagt</option>
                </select>
              </div>
              <span style={{ fontSize: '13px', color: '#666' }}>{filtered.length} Event(s)</span>
            </div>

            {/* Event-Karten */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filtered.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  selected={selectedId === event.id}
                  onClick={() => {
                    setSelectedId(selectedId === event.id ? null : event.id);
                    setDetailTab('info');
                    setTab('liste');
                  }}
                />
              ))}
            </div>
          </div>

          {/* Rechte Spalte: Detail */}
          {selectedEvent && (
            <EventDetailPanel
              event={selectedEvent}
              activeTab={detailTab}
              setActiveTab={setDetailTab}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      )}

      {/* ── TAB: ANALYTICS ─────────────────────────────── */}
      {tab === 'analytics' && (
        <EventAnalytics
          totalEvents={MOCK_EVENTS.length}
          durchgefuehrt={durchgefuehrt}
          totalTeilnehmer={totalTeilnehmer}
          totalErschienen={totalErschienen}
          totalMatches={totalMatches}
          totalKooperationen={totalKooperationen}
          avgBewertung={avgBewertung}
          allFeedbacks={allFeedbacks}
          events={MOCK_EVENTS}
        />
      )}
    </div>
  );
}

// ─── EVENT KARTE ─────────────────────────────────────────────

function EventCard({ event, selected, onClick }: {
  event: MockEvent_Full; selected: boolean; onClick: () => void;
}) {
  const bestaetigt = event.teilnehmer.filter(t => !t.warteliste).length;
  const warteliste = event.teilnehmer.filter(t => t.warteliste).length;
  const auslastung = event.maxTeilnehmer ? Math.round((bestaetigt / event.maxTeilnehmer) * 100) : 0;
  const isPast = event.status === 'durchgefuehrt';

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'white', borderRadius: '10px', padding: '20px', cursor: 'pointer',
        border: selected ? '2px solid #003366' : '2px solid transparent',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        opacity: event.status === 'abgesagt' ? 0.6 : 1,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = '#ccc'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* Links */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '22px' }}>{getEventTypIcon(event.typ)}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px', color: '#003366' }}>{event.titel}</div>
              {event.untertitel && <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{event.untertitel}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#666', marginBottom: '10px' }}>
            <span>📅 {event.datum}</span>
            <span>⏰ {event.uhrzeit}</span>
            <span>{getLandFlag(event.land)} {event.ort}</span>
          </div>
          {/* Ziele */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {event.ziele.map(z => (
              <span key={z} style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, backgroundColor: '#e8f0fe', color: '#003366' }}>
                {getEventZielLabel(z)}
              </span>
            ))}
          </div>
        </div>

        {/* Rechts */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', marginLeft: '16px', flexShrink: 0 }}>
          <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: 'white', backgroundColor: getEventStatusColor(event.status) }}>
            {getEventStatusLabel(event.status)}
          </span>
          <span style={{ fontSize: '12px', color: '#666' }}>{getEventTypLabel(event.typ)}</span>
          {/* Auslastungs-Bar */}
          {event.maxTeilnehmer && !isPast && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>
                {bestaetigt}/{event.maxTeilnehmer} Plätze {warteliste > 0 ? `(+${warteliste} WL)` : ''}
              </div>
              <div style={{ width: '100px', height: '6px', backgroundColor: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '3px',
                  width: `${Math.min(auslastung, 100)}%`,
                  backgroundColor: auslastung >= 90 ? '#f44336' : auslastung >= 70 ? '#FF9900' : '#4CAF50',
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )}
          {/* Feedback-Stats bei Vergangenen */}
          {isPast && event.feedback.length > 0 && (
            <div style={{ textAlign: 'right', fontSize: '12px' }}>
              <span style={{ color: '#FF9900', fontWeight: 700 }}>
                {'★'.repeat(Math.round(event.feedback.reduce((s, f) => s + f.bewertung, 0) / event.feedback.length))}
              </span>
              <span style={{ color: '#666' }}> ({event.feedback.length})</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EVENT DETAIL PANEL ───────────────────────────────────────

function EventDetailPanel({ event, activeTab, setActiveTab, onClose }: {
  event: MockEvent_Full;
  activeTab: 'info' | 'teilnehmer' | 'feedback' | 'matches';
  setActiveTab: (t: 'info' | 'teilnehmer' | 'feedback' | 'matches') => void;
  onClose: () => void;
}) {
  const tabs = [
    { id: 'info', label: 'Details' },
    { id: 'teilnehmer', label: `Teilnehmer (${event.teilnehmer.length})` },
    { id: 'feedback', label: `Feedback (${event.feedback.length})` },
    { id: 'matches', label: `Matches (${event.matches.length})` },
  ] as const;

  const deDE = event.teilnehmer.filter(t => t.land === 'deutschland').length;
  const deDK = event.teilnehmer.filter(t => t.land === 'daenemark').length;

  const [toast, setToast] = useState<string | null>(null);
  const zeigeToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  return (
    <div style={{
      width: '400px', flexShrink: 0, backgroundColor: 'white',
      borderRadius: '10px', boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
      alignSelf: 'flex-start', position: 'sticky', top: '20px',
      maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
    }}>
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          backgroundColor: '#003366', color: 'white', padding: '14px 20px',
          borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: '14px', fontWeight: 600,
        }}>{toast}</div>
      )}
      {/* Header */}
      <div style={{ padding: '20px 20px 0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '22px', marginBottom: '4px' }}>{getEventTypIcon(event.typ)}</div>
            <h2 style={{ margin: 0, color: '#003366', fontSize: '17px' }}>{event.titel}</h2>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>{getEventTypLabel(event.typ)}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666' }}>×</button>
        </div>
        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: 'white', backgroundColor: getEventStatusColor(event.status) }}>
          {getEventStatusLabel(event.status)}
        </span>

        {/* Tab Nav */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '16px', borderBottom: '2px solid #f0f0f0', paddingBottom: '0' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '8px 12px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              backgroundColor: 'transparent',
              color: activeTab === t.id ? '#003366' : '#666',
              borderBottom: activeTab === t.id ? '2px solid #003366' : '2px solid transparent',
              marginBottom: '-2px',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 20px 20px 20px' }}>
        {/* ── INFO TAB ── */}
        {activeTab === 'info' && (
          <div>
            <InfoRow icon="📅" label="Datum" value={`${event.datum} · ${event.uhrzeit}`} />
            <InfoRow icon="📍" label="Ort" value={`${event.ort} (${getLandFlag(event.land)})`} />
            <InfoRow icon="🎤" label="Veranstalter" value={event.veranstalter} />
            <InfoRow icon="🗣" label="Sprache" value={event.sprache} />
            {event.maxTeilnehmer && (
              <InfoRow icon="👥" label="Kapazität" value={`${event.teilnehmer.filter(t => !t.warteliste).length}/${event.maxTeilnehmer} Plätze · DE: ${deDE} / DK: ${deDK}`} />
            )}
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #f0f0f0' }}>
              <p style={{ fontSize: '13px', color: '#444', lineHeight: 1.6, margin: '0 0 12px 0' }}>{event.beschreibung}</p>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {event.ziele.map(z => (
                <span key={z} style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, backgroundColor: '#e8f0fe', color: '#003366' }}>
                  {getEventZielLabel(z)}
                </span>
              ))}
            </div>
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => zeigeToast('Einladungslink kopiert — bereit zum Teilen')} style={{ padding: '10px', backgroundColor: '#003366', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                Teilnehmer einladen
              </button>
              <button onClick={() => zeigeToast(`"${event.titel}" zum Bearbeiten geöffnet`)} style={{ padding: '10px', backgroundColor: 'transparent', color: '#003366', border: '1px solid #003366', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                Event bearbeiten
              </button>
            </div>
          </div>
        )}

        {/* ── TEILNEHMER TAB ── */}
        {activeTab === 'teilnehmer' && (
          <div>
            {/* DE/DK Split */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1565c0' }}>{deDE}</div>
                <div style={{ fontSize: '11px', color: '#1565c0' }}>🇩🇪 Deutschland</div>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#fce4ec', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#880e4f' }}>{deDK}</div>
                <div style={{ fontSize: '11px', color: '#880e4f' }}>🇩🇰 Dänemark</div>
              </div>
            </div>

            {event.teilnehmer.length === 0 ? (
              <div style={{ color: '#666', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Noch keine Anmeldungen</div>
            ) : (
              event.teilnehmer.map(t => (
                <div key={t.id} style={{
                  padding: '10px 12px', borderRadius: '8px', marginBottom: '8px',
                  backgroundColor: t.warteliste ? '#fff8e1' : '#f9f9f9',
                  border: t.warteliste ? '1px solid #ffe082' : '1px solid #eee',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#003366' }}>
                        {getLandFlag(t.land)} {t.firmenname}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                        {t.ansprechpartner}{t.rolle ? ` · ${t.rolle}` : ''}
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600,
                      color: 'white', backgroundColor: getTeilnehmerStatusColor(t.warteliste ? 'warteliste' : t.status),
                    }}>
                      {t.warteliste ? 'Warteliste' : t.status}
                    </span>
                  </div>
                  {t.erschienen && (
                    <div style={{ fontSize: '10px', color: '#4CAF50', marginTop: '4px', fontWeight: 600 }}>✓ Erschienen</div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── FEEDBACK TAB ── */}
        {activeTab === 'feedback' && (
          <div>
            {event.feedback.length === 0 ? (
              <div style={{ color: '#666', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                {event.status !== 'durchgefuehrt' ? 'Feedback wird nach dem Event erfasst.' : 'Noch kein Feedback vorhanden.'}
              </div>
            ) : (
              <>
                {/* Zusammenfassung */}
                <FeedbackSummary feedbacks={event.feedback} />
                {/* Einzelne Feedbacks */}
                {event.feedback.map(f => (
                  <div key={f.id} style={{ backgroundColor: '#f9f9f9', borderRadius: '8px', padding: '14px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#003366' }}>{f.firmenname}</div>
                      <div style={{ color: '#FF9900', fontSize: '14px' }}>{'★'.repeat(f.bewertung)}{'☆'.repeat(5 - f.bewertung)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      {f.wiederTeilnehmen && <MiniTag label="Kommt wieder" color="#4CAF50" />}
                      {f.neueKontakteGeknuepft && <MiniTag label="Neue Kontakte" color="#2196F3" />}
                      {f.kooperationEntstanden && <MiniTag label="Kooperation!" color="#9C27B0" />}
                    </div>
                    {f.kommentar && <p style={{ fontSize: '13px', color: '#444', lineHeight: 1.5, margin: '0 0 6px 0', fontStyle: 'italic' }}>"{f.kommentar}"</p>}
                    {f.verbesserungsvorschlag && (
                      <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                        <span style={{ fontWeight: 600 }}>Verbesserung:</span> {f.verbesserungsvorschlag}
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── MATCHES TAB ── */}
        {activeTab === 'matches' && (
          <div>
            {event.matches.length === 0 ? (
              <div style={{ color: '#666', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                Noch keine Matches dokumentiert.
              </div>
            ) : (
              event.matches.map(m => (
                <div key={m.id} style={{ backgroundColor: '#f9f9f9', borderRadius: '8px', padding: '14px', marginBottom: '10px', border: m.kooperation ? '1px solid #a5d6a7' : '1px solid #eee' }}>
                  {/* Match Darstellung */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ backgroundColor: '#e3f2fd', padding: '8px', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#1565c0' }}>
                      {m.firma1Name}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '18px' }}>🤝</div>
                    <div style={{ backgroundColor: '#fce4ec', padding: '8px', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#880e4f' }}>
                      {m.firma2Name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: m.notiz ? '8px' : '0' }}>
                    {m.folgekontakt && <MiniTag label="Folgekontakt" color="#2196F3" />}
                    {m.kooperation && <MiniTag label={`Kooperation: ${m.kooperationsArt || 'entstanden'}`} color="#4CAF50" />}
                  </div>
                  {m.notiz && <p style={{ fontSize: '12px', color: '#555', margin: 0, fontStyle: 'italic' }}>{m.notiz}</p>}
                  {m.vermitteltDurch && <div style={{ fontSize: '11px', color: '#666', marginTop: '6px' }}>Vermittelt von: {m.vermitteltDurch}</div>}
                </div>
              ))
            )}
            {event.status === 'durchgefuehrt' && (
              <button onClick={() => zeigeToast('Neuer Match-Eintrag angelegt')} style={{ width: '100%', padding: '10px', backgroundColor: '#003366', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginTop: '8px' }}>
                + Match dokumentieren
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ANALYTICS ────────────────────────────────────────────────

function EventAnalytics({ totalEvents, durchgefuehrt, totalTeilnehmer, totalErschienen, totalMatches, totalKooperationen, avgBewertung, allFeedbacks, events }: any) {
  const wiederRate = allFeedbacks.length > 0
    ? Math.round((allFeedbacks.filter((f: any) => f.wiederTeilnehmen).length / allFeedbacks.length) * 100)
    : 0;
  const koopRate = allFeedbacks.length > 0
    ? Math.round((allFeedbacks.filter((f: any) => f.kooperationEntstanden).length / allFeedbacks.length) * 100)
    : 0;

  // Typ-Häufigkeit
  const typCount: Record<string, number> = {};
  events.forEach((e: any) => { typCount[e.typ] = (typCount[e.typ] || 0) + 1; });
  const topTypen = Object.entries(typCount).sort((a: any, b: any) => b[1] - a[1]);

  return (
    <div>
      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '32px' }}>
        {[
          { label: 'Events gesamt', value: totalEvents, color: '#003366' },
          { label: 'Durchgeführt', value: durchgefuehrt, color: '#9C27B0' },
          { label: 'Anmeldungen', value: totalTeilnehmer, color: '#2196F3' },
          { label: 'Erschienen', value: totalErschienen, color: '#4CAF50' },
          { label: 'Matches', value: totalMatches, color: '#FF9900' },
          { label: 'Kooperationen', value: totalKooperationen, color: '#4CAF50' },
          { label: 'Ø Bewertung', value: `${avgBewertung}/5`, color: '#FF9900' },
          { label: 'Wieder-Rate', value: `${wiederRate}%`, color: '#4CAF50' },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: '12px', color: '#666' }}>{s.label}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: s.color, marginTop: '4px' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Beliebteste Formate */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}>
          <h3 style={{ marginTop: 0, color: '#003366', fontSize: '16px', marginBottom: '16px' }}>Eventformate</h3>
          {topTypen.map(([typ, count]: any) => (
            <div key={typ} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '18px', minWidth: '24px' }}>{getEventTypIcon(typ)}</span>
              <span style={{ flex: 1, fontSize: '13px' }}>{getEventTypLabel(typ)}</span>
              <div style={{ width: '80px', height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', backgroundColor: '#003366', width: `${(count / totalEvents) * 100}%`, borderRadius: '4px' }} />
              </div>
              <span style={{ fontSize: '12px', color: '#666', minWidth: '20px' }}>{count}×</span>
            </div>
          ))}
        </div>

        {/* Feedback Übersicht */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}>
          <h3 style={{ marginTop: 0, color: '#003366', fontSize: '16px', marginBottom: '16px' }}>Feedback-Überblick</h3>
          {allFeedbacks.length === 0 ? (
            <p style={{ color: '#666', fontSize: '13px' }}>Noch kein Feedback vorhanden.</p>
          ) : (
            <>
              <FeedbackMetric label="Würden wieder teilnehmen" value={wiederRate} color="#4CAF50" />
              <FeedbackMetric label="Neue Kontakte geknüpft" value={Math.round((allFeedbacks.filter((f: any) => f.neueKontakteGeknuepft).length / allFeedbacks.length) * 100)} color="#2196F3" />
              <FeedbackMetric label="Kooperation entstanden" value={koopRate} color="#9C27B0" />
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: '#FF9900' }}>{avgBewertung}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Durchschnittliche Bewertung (von 5)</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Event → Match → Kooperation Flow */}
      <div style={{ marginTop: '24px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}>
        <h3 style={{ marginTop: 0, color: '#003366', fontSize: '16px', marginBottom: '16px' }}>Event → Kooperations-Flow</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', alignItems: 'center' }}>
          {[
            { label: 'Events', value: totalEvents, color: '#003366' },
            { label: 'Anmeldungen', value: totalTeilnehmer, color: '#2196F3' },
            { label: 'Matches', value: totalMatches, color: '#FF9900' },
            { label: 'Kooperationen', value: totalKooperationen, color: '#4CAF50' },
          ].map((s, i) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {i > 0 && <span style={{ color: '#999', fontSize: '20px', flexShrink: 0 }}>→</span>}
              <div style={{ flex: 1, padding: '14px', backgroundColor: s.color + '15', borderRadius: '8px', textAlign: 'center', border: `2px solid ${s.color}30` }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── HILFSKOMPONENTEN ─────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', fontSize: '13px' }}>
      <span style={{ minWidth: '18px' }}>{icon}</span>
      <span style={{ color: '#666', minWidth: '80px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#333' }}>{value}</span>
    </div>
  );
}

function MiniTag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, backgroundColor: color + '20', color }}>
      {label}
    </span>
  );
}

function FeedbackSummary({ feedbacks }: { feedbacks: any[] }) {
  const avg = (feedbacks.reduce((s, f) => s + f.bewertung, 0) / feedbacks.length).toFixed(1);
  return (
    <div style={{ backgroundColor: '#fff8e1', borderRadius: '8px', padding: '12px', marginBottom: '14px', display: 'flex', gap: '20px', alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '28px', fontWeight: 700, color: '#FF9900', lineHeight: 1 }}>{avg}</div>
        <div style={{ fontSize: '10px', color: '#666' }}>von 5</div>
      </div>
      <div style={{ flex: 1, fontSize: '12px', color: '#555' }}>
        {feedbacks.length} Feedback(s) · {feedbacks.filter(f => f.wiederTeilnehmen).length} würden wiederkommen · {feedbacks.filter(f => f.kooperationEntstanden).length} Kooperation(en)
      </div>
    </div>
  );
}

function FeedbackMetric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
        <span style={{ color: '#555' }}>{label}</span>
        <span style={{ fontWeight: 600, color }}>{value}%</span>
      </div>
      <div style={{ height: '6px', backgroundColor: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', backgroundColor: color, width: `${value}%`, borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}
