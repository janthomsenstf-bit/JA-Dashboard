
import { useState } from 'react';
import { useStore, neueEntityId } from '@easyb2b/lib/store';
import {
  MOCK_INTERESSENTEN,
  getKontaktQuelleLabel, getKontaktStatusLabel, getKontaktStatusColor,
  getKontaktZuordnungLabel, getKontaktZuordnungColor,
  getLandFlag, getRichtungLabel,
  type MockKontakt, type KontaktStatus, type KontaktQuelleTyp, type KontaktZuordnungStatus,
} from '@easyb2b/lib/mockdata';
import EntityModal, { type FeldDef } from '@easyb2b/components/EntityModal';
import { berechneInteressentKlaerung } from '@easyb2b/lib/klaerungsstand';
import KlaerungsBox from '@easyb2b/components/KlaerungsBox';

const KONTAKT_FELDER: FeldDef[] = [
  { key: 'firmenname', label: 'Firmenname', pflicht: true, spalte: 1 },
  { key: 'ansprechpartner', label: 'Ansprechpartner', pflicht: true, spalte: 2 },
  { key: 'email', label: 'E-Mail', typ: 'email', pflicht: true, spalte: 1 },
  { key: 'telefon', label: 'Telefon', typ: 'tel', spalte: 2 },
  { key: 'website', label: 'Website', typ: 'url', spalte: 1 },
  { key: 'linkedin', label: 'LinkedIn', spalte: 2 },
  { key: 'land', label: 'Land', typ: 'select', spalte: 1, optionen: [
    { value: 'deutschland', label: '🇩🇪 Deutschland' }, { value: 'daenemark', label: '🇩🇰 Dänemark' }, { value: 'andere', label: 'Andere' },
  ] },
  { key: 'region', label: 'Region', spalte: 2 },
  { key: 'branche', label: 'Branche', spalte: 1 },
  { key: 'quelleTyp', label: 'Quelle', typ: 'select', spalte: 2, optionen: [
    { value: 'manuell', label: '✏️ Manuell' }, { value: 'empfehlung', label: '⭐ Empfehlung' },
    { value: 'event', label: '🎤 Event' }, { value: 'gespraech', label: '📞 Gespräch' },
    { value: 'netzwerk', label: '🕸 Netzwerk' },
  ] },
  { key: 'interneNotiz', label: 'Interne Notiz', typ: 'textarea' },
];

export default function KontaktePage() {
  const store = useStore();
  const [filterStatus, setFilterStatus] = useState<'alle' | KontaktStatus>('alle');
  const [filterQuelle, setFilterQuelle] = useState<'alle' | KontaktQuelleTyp>('alle');
  const [suche, setSuche] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [modalOffen, setModalOffen] = useState<'neu' | 'edit' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const zeigeToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const q = suche.trim().toLowerCase();
  const gefiltert = store.geschaftskontakte.filter(k => {
    if (filterStatus !== 'alle' && k.status !== filterStatus) return false;
    if (filterQuelle !== 'alle' && k.quelleTyp !== filterQuelle) return false;
    if (q && ![k.firmenname, k.ansprechpartner, k.email, k.branche, k.region].some(f => f?.toLowerCase().includes(q))) return false;
    return true;
  });

  const detail = detailId ? store.geschaftskontakte.find(k => k.id === detailId) : null;

  const aktiv = store.geschaftskontakte.filter(k => k.status === 'aktiv').length;
  const ausInteressent = store.geschaftskontakte.filter(k => k.quelleTyp === 'interessent').length;
  const mitZuordnung = store.geschaftskontakte.filter(k => k.projektZuordnungen.length > 0).length;

  const speichereKontakt = (werte: Record<string, any>) => {
    if (modalOffen === 'edit' && detailId) {
      store.updateGeschaftskontakt(detailId, werte as Partial<MockKontakt>);
      store.logge(`Kontakt bearbeitet: ${werte.firmenname}`, werte.firmenname, 'bearbeiten');
      zeigeToast('Kontakt aktualisiert ✓');
    } else {
      const neu: MockKontakt = {
        id: neueEntityId('kon'),
        quelleTyp: (werte.quelleTyp as KontaktQuelleTyp) || 'manuell',
        firmenname: werte.firmenname,
        ansprechpartner: werte.ansprechpartner,
        email: werte.email,
        telefon: werte.telefon || undefined,
        website: werte.website || undefined,
        linkedin: werte.linkedin || undefined,
        land: werte.land || undefined,
        region: werte.region || undefined,
        branche: werte.branche || undefined,
        sprachen: [],
        status: 'aktiv',
        createdAt: new Date().toISOString().split('T')[0],
        interneNotiz: werte.interneNotiz || undefined,
        projektZuordnungen: [],
      };
      store.addGeschaftskontakt(neu);
      store.logge(`Neuer Kontakt angelegt: ${neu.firmenname}`, neu.firmenname, 'anlegen');
      zeigeToast('Kontakt angelegt ✓');
    }
    setModalOffen(null);
  };

  return (
    <div style={{ display: 'flex', gap: '24px' }}>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, backgroundColor: '#003366', color: 'white', padding: '14px 20px', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: '14px', fontWeight: 600 }}>
          {toast}
        </div>
      )}

      {modalOffen && (
        <EntityModal
          titel={modalOffen === 'edit' ? 'Kontakt bearbeiten' : 'Neuen Kontakt anlegen'}
          felder={KONTAKT_FELDER}
          initial={modalOffen === 'edit' && detail ? (detail as any) : {}}
          onSpeichern={speichereKontakt}
          onSchliessen={() => setModalOffen(null)}
        />
      )}

      {/* LINKE SPALTE */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <h1 style={{ margin: 0, color: '#003366', fontSize: '24px' }}>Kontakte</h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
              Dauerhafte Arbeitsakten — entstehen aus geprüften Interessenten oder werden manuell angelegt.
            </p>
          </div>
          <button onClick={() => { setDetailId(null); setModalOffen('neu'); }} style={{ padding: '10px 18px', backgroundColor: '#003366', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, flexShrink: 0 }}>
            + Neuer Kontakt
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', margin: '20px 0' }}>
          {[
            { label: 'Kontakte gesamt', v: store.geschaftskontakte.length, c: '#003366' },
            { label: 'Aktiv', v: aktiv, c: '#4CAF50' },
            { label: 'Aus Interessent', v: ausInteressent, c: '#2196F3' },
            { label: 'Projekt zugeordnet', v: mitZuordnung, c: '#9C27B0' },
          ].map(s => (
            <div key={s.label} style={{ backgroundColor: 'white', padding: '14px 16px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', borderLeft: `4px solid ${s.c}` }}>
              <div style={{ fontSize: '12px', color: '#666' }}>{s.label}</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: s.c, marginTop: '2px' }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', display: 'block', marginBottom: '4px' }}>Suche</label>
            <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Firma, Name, E-Mail, Region…" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', display: 'block', marginBottom: '4px' }}>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px' }}>
              <option value="alle">Alle</option>
              <option value="aktiv">Aktiv</option>
              <option value="pausiert">Pausiert</option>
              <option value="archiviert">Archiviert</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', display: 'block', marginBottom: '4px' }}>Quelle</label>
            <select value={filterQuelle} onChange={e => setFilterQuelle(e.target.value as any)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px' }}>
              <option value="alle">Alle Quellen</option>
              <option value="interessent">Interessent</option>
              <option value="manuell">Manuell</option>
              <option value="empfehlung">Empfehlung</option>
              <option value="event">Event</option>
              <option value="gespraech">Gespräch</option>
              <option value="netzwerk">Netzwerk</option>
            </select>
          </div>
          <div style={{ fontSize: '13px', color: '#666', paddingBottom: '9px' }}>{gefiltert.length} Kontakt(e)</div>
        </div>

        {/* Liste */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {gefiltert.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666', fontSize: '14px', backgroundColor: 'white', borderRadius: '8px' }}>
              Keine Kontakte gefunden.
            </div>
          ) : gefiltert.map(k => (
            <div key={k.id} onClick={() => setDetailId(detailId === k.id ? null : k.id)} style={{
              backgroundColor: detailId === k.id ? '#f0f4ff' : 'white', borderRadius: '10px', padding: '16px 18px', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.07)', borderLeft: `4px solid ${getKontaktStatusColor(k.status)}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    {k.land && <span>{getLandFlag(k.land)}</span>}
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#003366' }}>{k.firmenname}</span>
                    <span style={{ padding: '1px 7px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, backgroundColor: '#f0f0f0', color: '#666' }}>
                      {getKontaktQuelleLabel(k.quelleTyp)}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    {k.ansprechpartner} · {k.email}{k.region ? ` · ${k.region}` : ''}{k.branche ? ` · ${k.branche}` : ''}
                  </div>
                  {k.projektZuordnungen.length > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {k.projektZuordnungen.map(z => {
                        const proj = store.anfragen.find(a => a.id === z.projektId);
                        return (
                          <span key={z.id} style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, color: 'white', backgroundColor: getKontaktZuordnungColor(z.status) }}>
                            🔗 {proj?.anzeigenId || 'Projekt'} · {getKontaktZuordnungLabel(z.status)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: 'white', backgroundColor: getKontaktStatusColor(k.status), flexShrink: 0 }}>
                  {getKontaktStatusLabel(k.status)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RECHTES DETAIL-PANEL */}
      {detail && (
        <KontaktDetail
          kontakt={detail}
          store={store}
          onClose={() => setDetailId(null)}
          onEdit={() => setModalOffen('edit')}
          onToast={zeigeToast}
        />
      )}
    </div>
  );
}

// ─── DETAIL-PANEL ─────────────────────────────────────────────

function KontaktDetail({ kontakt: k, store, onClose, onEdit, onToast }: {
  kontakt: MockKontakt;
  store: ReturnType<typeof useStore>;
  onClose: () => void;
  onEdit: () => void;
  onToast: (m: string) => void;
}) {
  const [tab, setTab] = useState<'profil' | 'projekte' | 'historie'>('profil');
  const [zuordnenOffen, setZuordnenOffen] = useState(false);
  const [projektSuche, setProjektSuche] = useState('');
  const [zuordnungGrund, setZuordnungGrund] = useState('');

  const ursprungsInteressent = k.interessentId ? MOCK_INTERESSENTEN.find(i => i.id === k.interessentId) : null;
  const meineAktivitaeten = store.aktivitaeten.filter(a => a.bezug === k.firmenname);

  const zugeordneteIds = k.projektZuordnungen.map(z => z.projektId);
  const q = projektSuche.trim().toLowerCase();
  const verfuegbareProjekte = store.anfragen.filter(a =>
    !zugeordneteIds.includes(a.id) &&
    (!q || [a.firmenname, a.anzeigenId, a.ziel, a.branche].some(f => f?.toLowerCase().includes(q)))
  );

  function projektZuordnen(projektId: string) {
    const proj = store.anfragen.find(a => a.id === projektId);
    store.addKontaktProjektZuordnung(k.id, {
      id: neueEntityId('kpz'),
      projektId,
      status: 'vorgeschlagen',
      notiz: zuordnungGrund || undefined,
      erstelltAm: new Date().toISOString().split('T')[0],
      erstelltVon: 'Operator',
    });
    onToast(`Projekt "${proj?.anzeigenId}" zugeordnet ✓`);
    setZuordnenOffen(false);
    setProjektSuche('');
    setZuordnungGrund('');
  }

  function aendereZuordnungStatus(zuordnungId: string, neuerStatus: KontaktZuordnungStatus) {
    const neue = k.projektZuordnungen.map(z => z.id === zuordnungId ? { ...z, status: neuerStatus } : z);
    store.updateGeschaftskontakt(k.id, { projektZuordnungen: neue });
    store.logge(`Zuordnungsstatus: ${neuerStatus}`, k.firmenname, 'status');
    onToast('Status aktualisiert ✓');
  }

  const ZUORDNUNG_OPTIONEN: KontaktZuordnungStatus[] = ['vorgeschlagen', 'in_pruefung', 'freigegeben', 'kontakt_laeuft', 'abgelehnt', 'abgeschlossen'];

  return (
    <div style={{ width: '400px', flexShrink: 0, backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', padding: '24px', alignSelf: 'flex-start', position: 'sticky', top: '20px', maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {k.land && <span style={{ fontSize: '18px' }}>{getLandFlag(k.land)}</span>}
            <h2 style={{ margin: 0, color: '#003366', fontSize: '18px' }}>{k.firmenname}</h2>
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>{k.ansprechpartner}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666' }}>×</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, color: 'white', backgroundColor: getKontaktStatusColor(k.status) }}>
          {getKontaktStatusLabel(k.status)}
        </span>
        <button onClick={onEdit} style={{ padding: '6px 14px', backgroundColor: '#FF9900', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>✏️ Bearbeiten</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {([['profil', 'Profil'], ['projekte', `Projekte (${k.projektZuordnungen.length})`], ['historie', 'Historie']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '7px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, backgroundColor: tab === id ? '#003366' : '#f0f0f0', color: tab === id ? 'white' : '#666' }}>
            {label}
          </button>
        ))}
      </div>

      {/* TAB: PROFIL */}
      {tab === 'profil' && (
        <div style={{ fontSize: '13px' }}>
          <Row label="E-Mail" value={<a href={`mailto:${k.email}`} style={{ color: '#003366' }}>{k.email}</a>} />
          {k.telefon && <Row label="Telefon" value={k.telefon} />}
          {k.website && <Row label="Website" value={<a href={k.website} target="_blank" rel="noreferrer" style={{ color: '#003366' }}>{k.website}</a>} />}
          {k.linkedin && <Row label="LinkedIn" value={k.linkedin} />}
          {k.region && <Row label="Region" value={k.region} />}
          {k.branche && <Row label="Branche" value={k.branche} />}
          {k.sprachen && k.sprachen.length > 0 && <Row label="Sprachen" value={k.sprachen.join(', ')} />}
          <Row label="Quelle" value={getKontaktQuelleLabel(k.quelleTyp)} />
          <Row label="Angelegt" value={k.createdAt} />

          {ursprungsInteressent && (
            <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#1565C0', marginBottom: '6px' }}>📋 URSPRUNG: INTERESSENT</div>
              <div style={{ fontSize: '12px', color: '#444' }}>Meldete sich auf: <strong>{ursprungsInteressent.anfrageFirma}</strong></div>
              {ursprungsInteressent.warumInteresse && <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', fontStyle: 'italic' }}>„{ursprungsInteressent.warumInteresse.slice(0, 120)}…"</div>}
              <a href="/dashboard/interessenten" style={{ fontSize: '11px', color: '#1565C0', fontWeight: 600, textDecoration: 'none', display: 'inline-block', marginTop: '6px' }}>→ Ursprungs-Interessent ansehen</a>
            </div>
          )}

          {k.interneNotiz && (
            <div style={{ marginTop: '14px', padding: '12px', backgroundColor: '#fff8e1', borderRadius: '8px', fontSize: '12px', color: '#555', fontStyle: 'italic' }}>
              <strong style={{ fontStyle: 'normal', color: '#8a6d00' }}>Notiz:</strong> {k.interneNotiz}
            </div>
          )}

          {/* Klärungsstand — wenn aus Interessent abgeleitet */}
          {ursprungsInteressent && (
            <div style={{ marginTop: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Klärungsstand (aus Interessent)
              </div>
              <KlaerungsBox
                stand={berechneInteressentKlaerung(ursprungsInteressent)}
                typ="interessent"
                variante="kompakt"
              />
            </div>
          )}
        </div>
      )}

      {/* TAB: PROJEKTE */}
      {tab === 'projekte' && (
        <div>
          {k.projektZuordnungen.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#666' }}>Noch keinem Projekt zugeordnet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {k.projektZuordnungen.map(z => {
                const proj = store.anfragen.find(a => a.id === z.projektId);
                return (
                  <div key={z.id} style={{ padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '8px', borderLeft: `3px solid ${getKontaktZuordnungColor(z.status)}` }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: '#003366' }}>{proj ? `${proj.anzeigenId} – ${proj.ziel}` : 'Projekt'}</div>
                    {proj && <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{getRichtungLabel(proj.richtung)} {proj.firmenname}</div>}
                    {z.notiz && <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', marginTop: '4px' }}>„{z.notiz}"</div>}
                    <div style={{ marginTop: '8px' }}>
                      <select value={z.status} onChange={e => aendereZuordnungStatus(z.id, e.target.value as KontaktZuordnungStatus)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '11px' }}>
                        {ZUORDNUNG_OPTIONEN.map(s => <option key={s} value={s}>{getKontaktZuordnungLabel(s)}</option>)}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!zuordnenOffen ? (
            <button onClick={() => setZuordnenOffen(true)} style={{ width: '100%', padding: '10px', backgroundColor: '#003366', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              + Projekt zuordnen
            </button>
          ) : (
            <div style={{ padding: '14px', backgroundColor: '#f0f4ff', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#003366', marginBottom: '8px' }}>Projekt suchen & zuordnen</div>
              <input value={projektSuche} onChange={e => setProjektSuche(e.target.value)} placeholder="Suche nach Firma, ID, Ziel…" style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', boxSizing: 'border-box', marginBottom: '8px' }} />
              <textarea value={zuordnungGrund} onChange={e => setZuordnungGrund(e.target.value)} placeholder="Grund / Notiz (optional)" rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '12px', boxSizing: 'border-box', marginBottom: '8px', fontFamily: 'inherit', resize: 'vertical' }} />
              <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {verfuegbareProjekte.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>Keine passenden Projekte.</p>
                ) : verfuegbareProjekte.slice(0, 8).map(a => (
                  <button key={a.id} onClick={() => projektZuordnen(a.id)} style={{ textAlign: 'left', padding: '8px 10px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                    <div style={{ fontWeight: 600, color: '#003366' }}>{a.anzeigenId} – {a.ziel}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>{a.firmenname} · {a.branche}</div>
                  </button>
                ))}
              </div>
              <button onClick={() => { setZuordnenOffen(false); setProjektSuche(''); setZuordnungGrund(''); }} style={{ marginTop: '8px', padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#666' }}>
                Abbrechen
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB: HISTORIE */}
      {tab === 'historie' && (
        <div>
          {meineAktivitaeten.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#666' }}>Noch keine Aktivitäten protokolliert.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {meineAktivitaeten.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: '8px', fontSize: '12px', padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '6px' }}>
                  <span>{a.typ === 'anlegen' ? '➕' : a.typ === 'status' ? '🔄' : '✏️'}</span>
                  <div>
                    <div style={{ color: '#333' }}>{a.was}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>{a.wer} · {a.zeit}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
      <span style={{ color: '#666', width: '90px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#333' }}>{value}</span>
    </div>
  );
}
