
import { useState } from 'react';
import { getKommunikationStilLabel, getKommunikationStilIcon } from '@easyb2b/lib/funfact';
import { MOCK_INTERESSENTEN, getNetzwerkLabel, getNetzwerkColor, getGroesseLabel, getLandFlag, getStatusLabel, getStatusColor, getRichtungLabel, getWorkflowStatusLabel, getWorkflowStatusColor } from '@easyb2b/lib/mockdata';
import { berechneUnternehmenKlaerung, SCORE_LEVEL_META } from '@easyb2b/lib/klaerungsstand';
import KlaerungsBox, { ScoreCircle as KlaerungsScoreCircle } from '@easyb2b/components/KlaerungsBox';
import { useStore, neueEntityId, type ProjektInteressent } from '@easyb2b/lib/store';
import { berechneProjekt, getGesundheitEmoji, getGesundheitColor, getZuordnungLabel, getZuordnungColor } from '@easyb2b/lib/projekte';
import EntityModal, { type FeldDef } from '@easyb2b/components/EntityModal';

// ─── FELD-DEFINITIONEN (wiederverwendbar) ─────────────────────

const UNTERNEHMEN_FELDER: FeldDef[] = [
  { key: 'firmenname', label: 'Firmenname', pflicht: true },
  { key: 'land', label: 'Land', typ: 'select', spalte: 1, optionen: [{ value: 'deutschland', label: '🇩🇪 Deutschland' }, { value: 'daenemark', label: '🇩🇰 Dänemark' }] },
  { key: 'standort', label: 'Standort', spalte: 2 },
  { key: 'branche', label: 'Branche', spalte: 1 },
  { key: 'groesse', label: 'Größe', typ: 'select', spalte: 2, optionen: [{ value: 'solo', label: 'Solo' }, { value: 'klein', label: 'Klein' }, { value: 'mittel', label: 'Mittel' }, { value: 'gross', label: 'Groß' }, { value: 'konzern', label: 'Konzern' }] },
  { key: 'ansprechpartner', label: 'Ansprechpartner', pflicht: true, spalte: 1 },
  { key: 'email', label: 'E-Mail', typ: 'email', pflicht: true, spalte: 2 },
  { key: 'telefon', label: 'Telefon', typ: 'tel', spalte: 1 },
  { key: 'website', label: 'Website', typ: 'url', spalte: 2 },
  { key: 'linkedin', label: 'LinkedIn', spalte: 1 },
  { key: 'kurzbeschreibung', label: 'Kurzbeschreibung', typ: 'textarea' },
  { key: 'interneNotiz', label: 'Interne Notiz', typ: 'textarea' },
];

type DetailTab = 'ueberblick' | 'projekte' | 'beteiligungen' | 'historie' | 'notizen';

export default function UnternehmenPage() {
  const store = useStore();
  const [filterLand, setFilterLand] = useState('alle');
  const [selected, setSelected] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('ueberblick');
  const [toast, setToast] = useState<string | null>(null);
  const [modalOffen, setModalOffen] = useState<'neu' | 'edit' | null>(null);

  const zeigeToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const speichereUnternehmen = (werte: Record<string, any>) => {
    if (modalOffen === 'neu') {
      const neu = { id: neueEntityId('unt'), ...werte, sprachen: [], persoenlichesGespraech: false, websiteGeprueft: false, linkedinGeprueft: false, empfehlungVorhanden: false, netzwerkStatus: 'interessiert', erstkontakt: 'gerade eben', letzteAktivitaet: 'gerade eben', anfrageCount: 0, interessentCount: 0, successStories: 0, events: [] } as any;
      store.addUnternehmen(neu);
      store.logge(`Unternehmen angelegt: ${werte.firmenname}`, werte.firmenname, 'anlegen');
      zeigeToast(`${werte.firmenname} angelegt ✓`);
    } else if (selected) {
      store.updateUnternehmen(selected, werte);
      store.logge(`Unternehmen bearbeitet: ${werte.firmenname}`, werte.firmenname, 'bearbeiten');
      zeigeToast(`${werte.firmenname} aktualisiert ✓`);
    }
    setModalOffen(null);
  };

  const filtered = store.unternehmen.filter(u => filterLand === 'alle' || u.land === filterLand);
  const selectedU = selected ? store.unternehmen.find(u => u.id === selected) : null;

  // Detailansicht als Fullscreen-Overlay wenn gewählt
  if (selectedU) {
    return (
      <>
        {toast && <Toast msg={toast} />}
        {modalOffen && (
          <EntityModal titel={modalOffen === 'neu' ? 'Neues Unternehmen' : 'Bearbeiten'} felder={UNTERNEHMEN_FELDER} initial={modalOffen === 'edit' ? selectedU as any : {}} onSpeichern={speichereUnternehmen} onSchliessen={() => setModalOffen(null)} />
        )}
        <UnternehmenDetail
          u={selectedU} store={store} tab={detailTab} setTab={setDetailTab}
          onZurueck={() => { setSelected(null); setDetailTab('ueberblick'); }}
          onEdit={() => setModalOffen('edit')}
          onToast={zeigeToast}
        />
      </>
    );
  }

  return (
    <div>
      {toast && <Toast msg={toast} />}
      {modalOffen && (
        <EntityModal titel="Neues Unternehmen anlegen" felder={UNTERNEHMEN_FELDER} initial={{}} onSpeichern={speichereUnternehmen} onSchliessen={() => setModalOffen(null)} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, color: 'var(--text)', fontSize: '24px' }}>Unternehmen</h1>
        <button onClick={() => setModalOffen('neu')} style={{ padding: '10px 18px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>+ Neues Unternehmen</button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <select value={filterLand} onChange={e => setFilterLand(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
          <option value="alle">Alle Länder</option>
          <option value="deutschland">🇩🇪 Deutschland</option>
          <option value="daenemark">🇩🇰 Dänemark</option>
        </select>
        <span style={{ alignSelf: 'center', fontSize: '13px', color: '#666' }}>{filtered.length} Unternehmen</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map(u => {
          const projekte = store.anfragen.filter(a => a.email === u.email || a.firmenname === u.firmenname);
          const interessen = MOCK_INTERESSENTEN.filter(i => i.email === u.email || i.firmenname === u.firmenname);
          const klaerung = berechneUnternehmenKlaerung(u, u.klaerungsBestaetigungen);
          const klaerungsMeta = SCORE_LEVEL_META[klaerung.scoreLevel];

          return (
            <div key={u.id} onClick={() => { setSelected(u.id); setDetailTab('ueberblick'); }} style={{ backgroundColor: 'white', borderRadius: '10px', padding: '16px 20px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 14px rgba(0,0,0,0.12)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.07)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '16px' }}>{getLandFlag(u.land)}</span>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>{u.firmenname}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>{u.branche} · {u.standort} · {getGroesseLabel(u.groesse || '')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <KlaerungsScoreCircle score={klaerung.score} color={klaerungsMeta.color} size={40} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, color: klaerungsMeta.color, backgroundColor: klaerungsMeta.bg, border: `1px solid ${klaerungsMeta.color}40` }}>{klaerungsMeta.label}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, color: 'white', backgroundColor: getNetzwerkColor(u.netzwerkStatus) }}>{getNetzwerkLabel(u.netzwerkStatus)}</span>
                  </div>
                </div>
              </div>
              {/* Schnell-KPIs */}
              <div style={{ display: 'flex', gap: '16px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f0f0f0', fontSize: '12px', color: '#666' }}>
                <span>🚀 {projekte.length} Projekt(e)</span>
                <span>👥 {interessen.length} Beteiligung(en)</span>
                <span style={{ marginLeft: 'auto' }}>Aktiv: {u.letzteAktivitaet}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── FULLSCREEN DETAIL ────────────────────────────────────────

function UnternehmenDetail({ u, store, tab, setTab, onZurueck, onEdit, onToast }: {
  u: any; store: any; tab: DetailTab; setTab: (t: DetailTab) => void;
  onZurueck: () => void; onEdit: () => void; onToast: (m: string) => void;
}) {
  const klaerung = berechneUnternehmenKlaerung(u, u.klaerungsBestaetigungen);
  const klaerungsMeta = SCORE_LEVEL_META[klaerung.scoreLevel];

  // Eigene Projekte (via unternehmensId ODER firmenname-Match)
  const eigeneProjekte = store.anfragen.filter((a: any) =>
    a.unternehmensId === u.id || a.email === u.email || a.firmenname === u.firmenname
  );
  // Beteiligungen (als Interessent)
  const beteiligungen = MOCK_INTERESSENTEN.filter((i: any) => i.email === u.email || i.firmenname === u.firmenname);
  // Zuordnungen
  const eigeneZuordnungen = eigeneProjekte.flatMap((a: any) => store.zuordnungen.filter((z: ProjektInteressent) => z.projektId === a.id));
  // Aktivitäten
  const meineAktivitaeten = store.aktivitaeten.filter((a: any) => a.bezug === u.firmenname || a.bezug === u.ansprechpartner);

  const tabs: { id: DetailTab; label: string; count?: number }[] = [
    { id: 'ueberblick', label: 'Überblick' },
    { id: 'projekte', label: 'Eigene Projekte', count: eigeneProjekte.length },
    { id: 'beteiligungen', label: 'Beteiligungen', count: beteiligungen.length },
    { id: 'historie', label: 'Historie' },
    { id: 'notizen', label: 'Notizen' },
  ];

  return (
    <div>
      {/* Breadcrumb */}
      <button onClick={onZurueck} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '13px', fontWeight: 600, padding: 0, marginBottom: '16px' }}>
        ← Zurück zur Liste
      </button>

      {/* Header */}
      <div style={{ backgroundColor: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '24px' }}>{getLandFlag(u.land)}</span>
              <h1 style={{ margin: 0, fontSize: '24px', color: 'var(--text)' }}>{u.firmenname}</h1>
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>{u.ansprechpartner} · {u.branche} · {u.standort}</div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: klaerungsMeta.color, backgroundColor: klaerungsMeta.bg, border: `1px solid ${klaerungsMeta.color}40` }}>
                ✓ {klaerungsMeta.label} · {klaerung.score}%
              </span>
              <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: 'white', backgroundColor: getNetzwerkColor(u.netzwerkStatus) }}>{getNetzwerkLabel(u.netzwerkStatus)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'flex-start' }}>
            <KlaerungsScoreCircle score={klaerung.score} color={klaerungsMeta.color} size={56} />
            <button onClick={onEdit} style={{ padding: '8px 14px', backgroundColor: '#FF9900', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>✏️ Bearbeiten</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '20px', borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '10px 18px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              backgroundColor: tab === t.id ? 'var(--accent)' : '#f0f0f0', color: tab === t.id ? 'white' : '#666',
            }}>
              {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: ÜBERBLICK ── */}
      {tab === 'ueberblick' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <Card titel="Kontaktdaten">
            <Row label="Email" value={<a href={`mailto:${u.email}`} style={{ color: 'var(--text)' }}>{u.email}</a>} />
            {u.telefon && <Row label="Telefon" value={u.telefon} />}
            {u.website && <Row label="Website" value={u.website} />}
            {u.linkedin && <Row label="LinkedIn" value={u.linkedin} />}
            <Row label="Sprachen" value={u.sprachen?.join(', ') || '–'} />
            <Row label="Größe" value={getGroesseLabel(u.groesse || '')} />
          </Card>
          <Card titel="Kultur & Zusammenarbeit">
            {u.kommunikationsstil && <div style={{ display: 'inline-flex', gap: '6px', padding: '6px 12px', borderRadius: '20px', backgroundColor: '#e8f0fe', color: 'var(--text)', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>{getKommunikationStilIcon(u.kommunikationsstil)} {getKommunikationStilLabel(u.kommunikationsstil)}</div>}
            {u.kulturprofil && <p style={{ fontSize: '13px', color: '#444', lineHeight: 1.6, margin: '0 0 8px 0' }}>{u.kulturprofil}</p>}
            {u.funFactStandard && <div style={{ backgroundColor: '#fff8e1', borderRadius: '6px', padding: '10px', fontSize: '13px', color: '#555', border: '1px solid #ffe082' }}><span style={{ fontWeight: 600, color: '#f57f17' }}>FunFact:</span> "{u.funFactStandard}"</div>}
          </Card>
          <Card titel="Schnellübersicht">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {[
                { label: 'Eigene Projekte', v: eigeneProjekte.length, c: 'var(--accent)' },
                { label: 'Beteiligungen', v: beteiligungen.length, c: '#2196F3' },
                { label: 'Erfolge', v: u.successStories || 0, c: '#4CAF50' },
              ].map(k => (
                <div key={k.label} style={{ textAlign: 'center', padding: '12px', backgroundColor: k.c + '12', borderRadius: '8px', border: `1px solid ${k.c}30` }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: k.c }}>{k.v}</div>
                  <div style={{ fontSize: '10px', color: '#666' }}>{k.label}</div>
                </div>
              ))}
            </div>
          </Card>
          {/* Glaubwürdigkeits-Schnellaktionen (frühere Verifikations-Checkboxen) */}
          <Card titel="Glaubwürdigkeit dokumentieren">
            <p style={{ fontSize: '12px', color: '#666', margin: '0 0 10px 0' }}>
              Diese Punkte fließen in den Klärungsstand ein. Hake ab, was tatsächlich erledigt wurde.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { key: 'websiteGeprueft', label: '🌐 Website geprüft' },
                { key: 'linkedinGeprueft', label: '💼 LinkedIn geprüft' },
                { key: 'persoenlichesGespraech', label: '📞 Persönliches Gespräch geführt' },
                { key: 'empfehlungVorhanden', label: '⭐ Empfehlung vorhanden' },
              ].map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!(u as any)[item.key]}
                    onChange={e => {
                      store.updateUnternehmen(u.id, { [item.key]: e.target.checked } as any);
                      store.logge(`${item.label}: ${e.target.checked ? 'Ja' : 'Nein'}`, u.firmenname, 'bearbeiten');
                      // Verknüpfte Anfragen auf 'unternehmen_verifiziert' setzen, wenn ≥80% geklärt
                      if (e.target.checked) {
                        const neueKlaerung = berechneUnternehmenKlaerung({ ...u, [item.key]: true }, u.klaerungsBestaetigungen);
                        if (neueKlaerung.score >= 80) {
                          eigeneProjekte.forEach((a: any) => {
                            if (a.workflowStatus === 'unternehmen_angelegt') {
                              store.setzeWorkflowStatus(a.id, 'unternehmen_verifiziert');
                            }
                          });
                        }
                      }
                    }}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{ color: (u as any)[item.key] ? '#2e7d32' : '#666' }}>{item.label}</span>
                </label>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── KLÄRUNGSSTAND (immer im Überblick-Tab unter den Karten) ── */}
      {tab === 'ueberblick' && (
        <div style={{ marginTop: '20px' }}>
          <KlaerungsBox
            stand={klaerung}
            typ="unternehmen"
            onBestaetigen={(punktId, notiz) => {
              store.bestaetigeKlaerungsPunkt('unternehmen', u.id, punktId, notiz);
              onToast('Klärungspunkt bestätigt ✓');
            }}
            onEntfernen={(punktId) => {
              store.entferneKlaerungsBestaetigung('unternehmen', u.id, punktId);
              onToast('Bestätigung entfernt');
            }}
          />
        </div>
      )}

      {/* ── TAB: EIGENE PROJEKTE ── */}
      {tab === 'projekte' && (
        <div>
          {eigeneProjekte.length === 0 ? (
            <Card titel="Noch keine eigenen Projekte">
              <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>Dieses Unternehmen hat noch keine Anfrage gestellt.</p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {eigeneProjekte.map((a: any) => {
                const eigenInt = MOCK_INTERESSENTEN.filter((i: any) => i.anfrageId === a.id);
                const projektZuordnungen = store.zuordnungen.filter((z: ProjektInteressent) => z.projektId === a.id);
                const ps = berechneProjekt(a, eigenInt);
                return (
                  <div key={a.id} style={{ backgroundColor: 'white', borderRadius: '10px', padding: '18px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', borderLeft: `5px solid ${getGesundheitColor(ps.gesundheit)}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)', marginBottom: '4px' }}>
                          {getGesundheitEmoji(ps.gesundheit)} {a.ziel}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>{a.anzeigenId} · {a.branche} · {getRichtungLabel(a.richtung)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, color: 'white', backgroundColor: getStatusColor(a.status) }}>{getStatusLabel(a.status)}</span>
                        <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, color: 'white', backgroundColor: ps.veroeffentlichungColor }}>{ps.veroeffentlichung}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '18px', marginTop: '10px', fontSize: '12px', color: '#666' }}>
                      <span>Interessenten: <strong>{ps.kpi.interessenten}</strong></span>
                      <span>Freigegeben: <strong>{ps.kpi.freigegeben}</strong></span>
                      <span>Kontakte: <strong>{ps.kpi.kontakte}</strong></span>
                      <span>Erfolge: <strong style={{ color: '#4CAF50' }}>{ps.kpi.erfolge}</strong></span>
                      <span style={{ marginLeft: 'auto' }}>Erstellt: {a.createdAt}</span>
                    </div>
                    {/* Manuell zugeordnete Interessenten */}
                    {projektZuordnungen.filter((z: ProjektInteressent) => z.zuordnungsart === 'manuell').length > 0 && (
                      <div style={{ marginTop: '8px', fontSize: '11px', color: '#e65100' }}>
                        ✋ {projektZuordnungen.filter((z: ProjektInteressent) => z.zuordnungsart === 'manuell').length} manuell zugeordnete Interessenten
                      </div>
                    )}
                    {ps.hinweis && (
                      <div style={{ marginTop: '8px', padding: '6px 10px', backgroundColor: '#fff8e1', borderRadius: '6px', fontSize: '12px', color: '#8a6d00' }}>
                        💡 {ps.hinweis}
                      </div>
                    )}
                    {/* Workflow-Status + Aktionen */}
                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {a.workflowStatus && (
                        <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, color: 'white', backgroundColor: getWorkflowStatusColor(a.workflowStatus) }}>
                          Schritt {a.workflowStatus}: {getWorkflowStatusLabel(a.workflowStatus)}
                        </span>
                      )}
                      <a href="/dashboard/projekte" style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 600, textDecoration: 'none', marginLeft: 'auto' }}>
                        → Zum Projekt
                      </a>
                      {(a.workflowStatus === 'unternehmen_angelegt' || a.workflowStatus === 'unternehmen_verifiziert') && (
                        <button
                          onClick={() => {
                            store.setzeWorkflowStatus(a.id, 'projekt_erstellt');
                            store.logge('Projekt aus Unternehmen erstellt', a.anzeigenId || a.id, 'anlegen');
                            onToast('✅ Projekt erstellt — unter Projekte sichtbar');
                          }}
                          style={{ padding: '5px 12px', backgroundColor: '#6a1b9a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                        >
                          🚀 Projekt erstellen
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: BETEILIGUNGEN ── */}
      {tab === 'beteiligungen' && (
        <div>
          {beteiligungen.length === 0 ? (
            <Card titel="Keine Beteiligungen">
              <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>Dieses Unternehmen hat sich noch bei keinem Projekt als Interessent gemeldet.</p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {beteiligungen.map((i: any) => (
                <div key={i.id} style={{ backgroundColor: 'white', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', borderLeft: `4px solid ${getStatusColor(i.status)}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Interesse an: {i.anfrageFirma}</div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{i.ansprechpartner} · {i.createdAt}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {i.matchScore && <span style={{ fontSize: '12px', fontWeight: 700, color: i.matchScore >= 80 ? '#4CAF50' : '#FF9900' }}>{i.matchScore}%</span>}
                      <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, color: 'white', backgroundColor: getStatusColor(i.status) }}>{getStatusLabel(i.status)}</span>
                    </div>
                  </div>
                  {i.warumPassung && <p style={{ fontSize: '12px', color: '#444', margin: '6px 0 0 0', lineHeight: 1.5 }}>{i.warumPassung.slice(0, 120)}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: HISTORIE ── */}
      {tab === 'historie' && (
        <div>
          <Card titel="Aktivitätenprotokoll">
            {meineAktivitaeten.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>Noch keine protokollierten Aktivitäten für dieses Unternehmen.</p>
            ) : (
              meineAktivitaeten.map((a: any) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: '13px' }}>
                  <span>{a.typ === 'anlegen' ? '➕' : a.typ === 'status' ? '🔄' : '✏️'}</span>
                  <span style={{ flex: 1, color: '#333' }}>{a.was}</span>
                  <span style={{ fontSize: '11px', color: '#666' }}>{a.wer} · {a.zeit}</span>
                </div>
              ))
            )}
          </Card>
          <div style={{ marginTop: '16px' }}>
            <Card titel="Zusammenfassung">
              <div style={{ fontSize: '13px', color: '#444', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 6px 0' }}>📅 Erstkontakt: {u.erstkontakt}</p>
                <p style={{ margin: '0 0 6px 0' }}>🕐 Letzte Aktivität: {u.letzteAktivitaet}</p>
                <p style={{ margin: '0 0 6px 0' }}>🚀 Projekte erstellt: {eigeneProjekte.length}</p>
                <p style={{ margin: '0 0 6px 0' }}>👥 Als Interessent aufgetreten: {beteiligungen.length}×</p>
                <p style={{ margin: '0 0 0 0' }}>⭐ Erfolge: {u.successStories || 0}</p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB: NOTIZEN ── */}
      {tab === 'notizen' && (
        <div>
          <Card titel="Interne Notiz">
            <textarea
              defaultValue={u.interneNotiz || ''}
              onBlur={e => { store.updateUnternehmen(u.id, { interneNotiz: e.target.value }); onToast('Notiz gespeichert'); }}
              placeholder="Interne Notiz zu diesem Unternehmen..."
              rows={4}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </Card>
          {u.persoenlicheNotiz && (
            <Card titel="Persönliche Notiz (Operator)" style={{ marginTop: '16px' }}>
              <div style={{ backgroundColor: '#e8f5e9', borderRadius: '6px', padding: '10px', fontSize: '13px', color: '#2e7d32', fontStyle: 'italic' }}>💬 {u.persoenlicheNotiz}</div>
            </Card>
          )}
          {u.gespraechsnotiz && (
            <Card titel="Letzte Gesprächsnotiz" style={{ marginTop: '16px' }}>
              <div style={{ backgroundColor: '#fff8e1', borderRadius: '6px', padding: '10px', fontSize: '13px', color: '#555', fontStyle: 'italic' }}>{u.gespraechsnotiz}</div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── HILFSKOMPONENTEN ─────────────────────────────────────────

function Toast({ msg }: { msg: string }) {
  return <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 4000, backgroundColor: 'var(--accent)', color: 'white', padding: '14px 20px', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: '14px', fontWeight: 600 }}>{msg}</div>;
}

function Card({ titel, children, style: s }: { titel: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '10px', padding: '18px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', ...s }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{titel}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '13px' }}>
      <span style={{ color: '#666', minWidth: '80px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#333' }}>{value}</span>
    </div>
  );
}
