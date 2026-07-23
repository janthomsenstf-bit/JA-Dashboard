
import { useState } from 'react';
import { getLandFlag, type MockNetzwerkkontakt } from '@easyb2b/lib/mockdata';
import {
  getKontaktKategorieLabel, getKontaktKategorieIcon, getKontaktKategorieColor,
  getAktivitaetsLabel, getAktivitaetsColor,
  getHistorieTypLabel, getHistorieTypIcon,
  getEmpfehlungsStatusLabel, getEmpfehlungsStatusColor,
  getNetzwerkWertLabel, getNetzwerkWertColor,
} from '@easyb2b/lib/netzwerk';
import { useStore, neueEntityId } from '@easyb2b/lib/store';
import EntityModal, { type FeldDef } from '@easyb2b/components/EntityModal';

type TabMain = 'kontakte' | 'empfehlungen' | 'analytics';
type TabDetail = 'profil' | 'historie' | 'empfehlungen';

const KONTAKT_FELDER: FeldDef[] = [
  { key: 'name', label: 'Name', pflicht: true, spalte: 1 },
  { key: 'organisation', label: 'Organisation', spalte: 2 },
  { key: 'position', label: 'Position', spalte: 1 },
  { key: 'kategorie', label: 'Kategorie', typ: 'select', spalte: 2, optionen: [
    { value: 'unternehmer', label: 'Unternehmer/in' }, { value: 'verband', label: 'Verband' }, { value: 'kammer', label: 'Kammer/IHK' },
    { value: 'wirtschaftsfoerderung', label: 'Wirtschaftsförderung' }, { value: 'kommune', label: 'Kommune' },
    { value: 'berater', label: 'Berater/in' }, { value: 'investor', label: 'Investor/in' }, { value: 'sonstiges', label: 'Sonstiges' },
  ] },
  { key: 'land', label: 'Land', typ: 'select', spalte: 1, optionen: [
    { value: 'deutschland', label: '🇩🇪 Deutschland' }, { value: 'daenemark', label: '🇩🇰 Dänemark' },
  ] },
  { key: 'region', label: 'Region', spalte: 2 },
  { key: 'email', label: 'E-Mail', typ: 'email', spalte: 1 },
  { key: 'telefon', label: 'Telefon', typ: 'tel', spalte: 2 },
  { key: 'linkedin', label: 'LinkedIn', spalte: 1 },
  { key: 'branche', label: 'Branche', spalte: 2 },
  { key: 'quelle', label: 'Kennengelernt über' },
  { key: 'interneNotiz', label: 'Interne Notiz', typ: 'textarea' },
];

export default function NetzwerkPage() {
  const store = useStore();
  const [tabMain, setTabMain] = useState<TabMain>('kontakte');
  const [filterKat, setFilterKat] = useState('alle');
  const [filterStatus, setFilterStatus] = useState('alle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tabDetail, setTabDetail] = useState<TabDetail>('profil');
  const [suchbegriff, setSuchbegriff] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [modalOffen, setModalOffen] = useState<'neu' | 'edit' | null>(null);

  const zeigeToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const kontakte = store.kontakte;

  const filtered = kontakte.filter(k => {
    if (filterKat !== 'alle' && k.kategorie !== filterKat) return false;
    if (filterStatus !== 'alle' && k.aktivitaetsStatus !== filterStatus) return false;
    if (suchbegriff && !`${k.name} ${k.organisation} ${k.region}`.toLowerCase().includes(suchbegriff.toLowerCase())) return false;
    return true;
  });

  const selected = selectedId ? kontakte.find(k => k.id === selectedId) : null;

  const speichereKontakt = (werte: Record<string, any>) => {
    if (modalOffen === 'neu') {
      const neu = {
        id: neueEntityId('nk'),
        name: werte.name, organisation: werte.organisation, position: werte.position,
        kategorie: werte.kategorie || 'sonstiges', land: werte.land || 'deutschland', region: werte.region,
        branche: werte.branche, email: werte.email, telefon: werte.telefon, linkedin: werte.linkedin,
        quelle: werte.quelle, erstkontakt: 'gerade eben', letzterKontakt: 'gerade eben',
        aktivitaetsStatus: 'aktiv', interneNotiz: werte.interneNotiz, netzwerkWert: 10,
        empfehlungen: [], historie: [],
      } as any;
      store.addKontakt(neu);
      store.logge(`Netzwerkkontakt angelegt: ${werte.name}`, werte.name, 'anlegen');
      zeigeToast(`${werte.name} angelegt ✓`);
    } else if (selectedId) {
      store.updateKontakt(selectedId, werte);
      store.logge(`Kontakt bearbeitet: ${werte.name}`, werte.name, 'bearbeiten');
      zeigeToast(`${werte.name} aktualisiert ✓`);
    }
    setModalOffen(null);
  };

  const alleEmpfehlungen = kontakte.flatMap(k =>
    k.empfehlungen.map(e => ({ ...e, kontaktName: k.name, kontaktOrg: k.organisation }))
  );

  return (
    <div>
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          backgroundColor: '#003366', color: 'white', padding: '14px 20px',
          borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: '14px', fontWeight: 600,
        }}>{toast}</div>
      )}
      {modalOffen && (
        <EntityModal
          titel={modalOffen === 'neu' ? 'Neuen Netzwerkkontakt anlegen' : 'Kontakt bearbeiten'}
          felder={KONTAKT_FELDER}
          initial={modalOffen === 'edit' && selected ? selected as any : {}}
          onSpeichern={speichereKontakt}
          onSchliessen={() => setModalOffen(null)}
        />
      )}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#003366', fontSize: '24px' }}>Netzwerk</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
            Das Gedächtnis des deutsch-dänischen Easy-B2B-Netzwerks
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => { setSelectedId(null); setModalOffen('neu'); }} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '12px', backgroundColor: '#FF9900', color: 'white' }}>
            + Neuer Kontakt
          </button>
          {(['kontakte', 'empfehlungen', 'analytics'] as TabMain[]).map(t => (
            <button key={t} onClick={() => setTabMain(t)} style={{
              padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '12px',
              backgroundColor: tabMain === t ? '#003366' : '#f0f0f0',
              color: tabMain === t ? 'white' : '#666',
            }}>
              {t === 'kontakte' ? 'Kontakte' : t === 'empfehlungen' ? 'Empfehlungen' : 'Analytics'}
            </button>
          ))}
        </div>
      </div>

      {/* ── KONTAKTE ───────────────────────────────────── */}
      {tabMain === 'kontakte' && (
        <div style={{ display: 'flex', gap: '24px' }}>
          {/* Linke Spalte */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Suche + Filter */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <input
                placeholder="Suche nach Name, Organisation, Region..."
                value={suchbegriff}
                onChange={e => setSuchbegriff(e.target.value)}
                style={{ flex: 1, minWidth: '200px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}
              />
              <select value={filterKat} onChange={e => setFilterKat(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
                <option value="alle">Alle Kategorien</option>
                <option value="unternehmer">Unternehmer/in</option>
                <option value="verband">Verband</option>
                <option value="kammer">Kammer / IHK</option>
                <option value="wirtschaftsfoerderung">Wirtschaftsförderung</option>
                <option value="kommune">Kommune</option>
                <option value="berater">Berater/in</option>
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
                <option value="alle">Alle Status</option>
                <option value="aktiv">Aktiv</option>
                <option value="passiv">Passiv</option>
                <option value="ruhend">Ruhend</option>
              </select>
              <span style={{ alignSelf: 'center', fontSize: '13px', color: '#666' }}>{filtered.length} Kontakt(e)</span>
            </div>

            {/* Kontakt-Karten */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filtered.map(k => (
                <KontaktKarte
                  key={k.id}
                  kontakt={k}
                  selected={selectedId === k.id}
                  onClick={() => {
                    setSelectedId(selectedId === k.id ? null : k.id);
                    setTabDetail('profil');
                  }}
                />
              ))}
            </div>
          </div>

          {/* Detail-Panel */}
          {selected && (
            <KontaktDetailPanel
              kontakt={selected}
              activeTab={tabDetail}
              setActiveTab={setTabDetail}
              onClose={() => setSelectedId(null)}
              onAction={zeigeToast}
              onEdit={() => setModalOffen('edit')}
            />
          )}
        </div>
      )}

      {/* ── EMPFEHLUNGEN ───────────────────────────────── */}
      {tabMain === 'empfehlungen' && (
        <EmpfehlungsUebersicht empfehlungen={alleEmpfehlungen} />
      )}

      {/* ── ANALYTICS ──────────────────────────────────── */}
      {tabMain === 'analytics' && (
        <NetzwerkAnalytics kontakte={kontakte} />
      )}
    </div>
  );
}

// ─── KONTAKT-KARTE ────────────────────────────────────────────

function KontaktKarte({ kontakt, selected, onClick }: {
  kontakt: MockNetzwerkkontakt; selected: boolean; onClick: () => void;
}) {
  const offeneAktionen = kontakt.historie.filter(h => !h.erledigt && h.naechsteAktion).length;

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'white', borderRadius: '10px', padding: '16px 20px',
        cursor: 'pointer',
        border: selected ? '2px solid #003366' : '2px solid transparent',
        boxShadow: '0 2px 6px rgba(0,0,0,0.07)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = '#ccc'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        {/* Avatar + Info */}
        <div style={{ display: 'flex', gap: '14px', flex: 1 }}>
          {/* Avatar */}
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
            backgroundColor: getKontaktKategorieColor(kontakt.kategorie) + '20',
            border: `2px solid ${getKontaktKategorieColor(kontakt.kategorie)}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
          }}>
            {getKontaktKategorieIcon(kontakt.kategorie)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
              <span style={{ fontWeight: 700, fontSize: '15px', color: '#003366' }}>{kontakt.name}</span>
              {offeneAktionen > 0 && (
                <span style={{ backgroundColor: '#FF9900', color: 'white', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 700 }}>
                  {offeneAktionen} offen
                </span>
              )}
            </div>
            <div style={{ fontSize: '13px', color: '#444' }}>
              {kontakt.position && `${kontakt.position} · `}{kontakt.organisation || '–'}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>
              {getLandFlag(kontakt.land)} {kontakt.region || kontakt.land}
              {kontakt.branche && ` · ${kontakt.branche}`}
            </div>
          </div>
        </div>

        {/* Rechts: Wert + Status */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          {/* Netzwerkwert-Kreis */}
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            backgroundColor: getNetzwerkWertColor(kontakt.netzwerkWert) + '15',
            border: `2px solid ${getNetzwerkWertColor(kontakt.netzwerkWert)}50`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: getNetzwerkWertColor(kontakt.netzwerkWert), lineHeight: 1 }}>{kontakt.netzwerkWert}</span>
          </div>
          <span style={{
            padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600,
            color: 'white', backgroundColor: getAktivitaetsColor(kontakt.aktivitaetsStatus),
          }}>
            {getAktivitaetsLabel(kontakt.aktivitaetsStatus)}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f0f0f0', fontSize: '11px', color: '#666' }}>
        <span>{getKontaktKategorieLabel(kontakt.kategorie)}</span>
        <span>📨 {kontakt.empfehlungen.length} Empfehlung(en)</span>
        <span>📋 {kontakt.historie.length} Einträge</span>
        <span style={{ marginLeft: 'auto' }}>Letzter Kontakt: {kontakt.letzterKontakt}</span>
      </div>
    </div>
  );
}

// ─── KONTAKT-DETAIL-PANEL ─────────────────────────────────────

function KontaktDetailPanel({ kontakt, activeTab, setActiveTab, onClose, onAction, onEdit }: {
  kontakt: MockNetzwerkkontakt;
  activeTab: TabDetail;
  setActiveTab: (t: TabDetail) => void;
  onClose: () => void;
  onAction: (msg: string) => void;
  onEdit: () => void;
}) {
  const tabs: { id: TabDetail; label: string }[] = [
    { id: 'profil', label: 'Profil' },
    { id: 'historie', label: `Historie (${kontakt.historie.length})` },
    { id: 'empfehlungen', label: `Empfehlungen (${kontakt.empfehlungen.length})` },
  ];

  const offeneAktionen = kontakt.historie.filter(h => !h.erledigt && h.naechsteAktion);

  return (
    <div style={{
      width: '400px', flexShrink: 0, backgroundColor: 'white',
      borderRadius: '10px', boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
      alignSelf: 'flex-start', position: 'sticky', top: '20px',
      maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
    }}>
      <div style={{ padding: '20px 20px 0 20px' }}>
        {/* Avatar + Header */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '50%', flexShrink: 0,
            backgroundColor: getKontaktKategorieColor(kontakt.kategorie) + '20',
            border: `2px solid ${getKontaktKategorieColor(kontakt.kategorie)}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
          }}>
            {getKontaktKategorieIcon(kontakt.kategorie)}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '17px', color: '#003366' }}>{kontakt.name}</h2>
            <div style={{ fontSize: '13px', color: '#555', marginTop: '2px' }}>{kontakt.position}</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{kontakt.organisation}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666', flexShrink: 0 }}>×</button>
        </div>

        {/* Netzwerkwert */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
          borderRadius: '8px', marginBottom: '12px',
          backgroundColor: getNetzwerkWertColor(kontakt.netzwerkWert) + '10',
          border: `1px solid ${getNetzwerkWertColor(kontakt.netzwerkWert)}30`,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: getNetzwerkWertColor(kontakt.netzwerkWert), lineHeight: 1 }}>{kontakt.netzwerkWert}</div>
            <div style={{ fontSize: '9px', color: '#666' }}>/ 100</div>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', color: getNetzwerkWertColor(kontakt.netzwerkWert) }}>{getNetzwerkWertLabel(kontakt.netzwerkWert)}</div>
            <div style={{ fontSize: '11px', color: '#666' }}>{getKontaktKategorieLabel(kontakt.kategorie)} · {getAktivitaetsLabel(kontakt.aktivitaetsStatus)}</div>
          </div>
        </div>

        {/* Offene Aktionen — wenn vorhanden */}
        {offeneAktionen.length > 0 && (
          <div style={{ backgroundColor: '#fff3e0', border: '1px solid #FFB300', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#E65100', marginBottom: '6px', textTransform: 'uppercase' }}>
              🔔 Offene Aktionen ({offeneAktionen.length})
            </div>
            {offeneAktionen.map(h => (
              <div key={h.id} style={{ fontSize: '12px', color: '#555', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                <span>→ {h.naechsteAktion}</span>
                {h.naechsteAktionAm && <span style={{ color: '#E65100', fontWeight: 600 }}>{h.naechsteAktionAm}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #f0f0f0', paddingBottom: 0 }}>
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

      <div style={{ padding: '16px 20px 24px 20px' }}>
        {/* ── PROFIL ── */}
        {activeTab === 'profil' && (
          <div>
            {/* Kontaktdaten */}
            <SectionTitle>Kontaktdaten</SectionTitle>
            {kontakt.email && <InfoZeile icon="📧" value={<a href={`mailto:${kontakt.email}`} style={{ color: '#003366' }}>{kontakt.email}</a>} />}
            {kontakt.telefon && <InfoZeile icon="📞" value={kontakt.telefon} />}
            {kontakt.linkedin && <InfoZeile icon="💼" value={`linkedin.com/in/${kontakt.linkedin}`} />}
            {kontakt.website && <InfoZeile icon="🌐" value={kontakt.website} />}

            {/* Netzwerkdaten */}
            <SectionTitle>Netzwerkdaten</SectionTitle>
            <InfoZeile icon={getLandFlag(kontakt.land)} value={`${kontakt.region || ''} (${kontakt.land})`} />
            {kontakt.quelle && <InfoZeile icon="🔗" value={`Kennengelernt: ${kontakt.quelle}`} />}
            <InfoZeile icon="📅" value={`Erstkontakt: ${kontakt.erstkontakt}`} />
            <InfoZeile icon="🕐" value={`Letzter Kontakt: ${kontakt.letzterKontakt}`} />

            {/* Interne Notiz */}
            {kontakt.interneNotiz && (
              <>
                <SectionTitle>Interne Notiz</SectionTitle>
                <div style={{ backgroundColor: '#fffde7', border: '1px solid #fff176', borderRadius: '6px', padding: '12px', fontSize: '13px', color: '#444', lineHeight: 1.6, fontStyle: 'italic' }}>
                  {kontakt.interneNotiz}
                </div>
              </>
            )}

            {/* Aktionen */}
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={onEdit} style={{ padding: '10px', backgroundColor: '#FF9900', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                ✏️ Bearbeiten
              </button>
              <button onClick={() => onAction(`Kontakt mit ${kontakt.name} dokumentiert`)} style={{ padding: '10px', backgroundColor: '#003366', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                + Kontakt dokumentieren
              </button>
              <button onClick={() => onAction(`Empfehlung von ${kontakt.name} erfasst`)} style={{ padding: '10px', backgroundColor: 'transparent', color: '#003366', border: '1px solid #003366', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                Empfehlung erfassen
              </button>
            </div>
          </div>
        )}

        {/* ── HISTORIE ── */}
        {activeTab === 'historie' && (
          <div>
            {/* Zeitleiste */}
            <div style={{ position: 'relative' }}>
              {/* Vertikale Linie */}
              <div style={{ position: 'absolute', left: '18px', top: '8px', bottom: '0', width: '2px', backgroundColor: '#f0f0f0' }} />

              {kontakt.historie.map((h, idx) => (
                <div key={h.id} style={{ display: 'flex', gap: '14px', marginBottom: '20px', position: 'relative' }}>
                  {/* Icon */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: h.erledigt ? '#f0f0f0' : '#e8f0fe',
                    border: `2px solid ${h.erledigt ? '#ddd' : '#003366'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', zIndex: 1, position: 'relative',
                  }}>
                    {getHistorieTypIcon(h.typ)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingTop: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: h.erledigt ? '#666' : '#003366' }}>
                        {getHistorieTypLabel(h.typ)}
                      </span>
                      <span style={{ fontSize: '11px', color: '#666' }}>{h.datum}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: '#444', lineHeight: 1.5, margin: '0 0 6px 0' }}>{h.notiz}</p>
                    {h.ergebnis && (
                      <div style={{ backgroundColor: '#e8f5e9', borderRadius: '4px', padding: '6px 10px', fontSize: '12px', color: '#2e7d32', marginBottom: '6px' }}>
                        Ergebnis: {h.ergebnis}
                      </div>
                    )}
                    {h.naechsteAktion && !h.erledigt && (
                      <div style={{ backgroundColor: '#fff3e0', borderRadius: '4px', padding: '6px 10px', fontSize: '12px', color: '#E65100', display: 'flex', justifyContent: 'space-between' }}>
                        <span>→ {h.naechsteAktion}</span>
                        {h.naechsteAktionAm && <span style={{ fontWeight: 600 }}>bis {h.naechsteAktionAm}</span>}
                      </div>
                    )}
                    {h.eingetragenVon && (
                      <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>von {h.eingetragenVon}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── EMPFEHLUNGEN ── */}
        {activeTab === 'empfehlungen' && (
          <div>
            {kontakt.empfehlungen.length === 0 ? (
              <p style={{ color: '#666', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>Noch keine Empfehlungen von diesem Kontakt.</p>
            ) : (
              kontakt.empfehlungen.map(e => (
                <div key={e.id} style={{
                  backgroundColor: e.erfolgreich ? '#e8f5e9' : '#f9f9f9',
                  border: `1px solid ${e.erfolgreich ? '#a5d6a7' : '#eee'}`,
                  borderRadius: '8px', padding: '12px', marginBottom: '10px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#003366' }}>{e.empfohleneName}</span>
                    <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, color: 'white', backgroundColor: getEmpfehlungsStatusColor(e.status) }}>
                      {getEmpfehlungsStatusLabel(e.status)}
                    </span>
                  </div>
                  {e.kontext && <p style={{ fontSize: '12px', color: '#555', margin: '0 0 6px 0', fontStyle: 'italic' }}>{e.kontext}</p>}
                  {e.ergebnis && <p style={{ fontSize: '12px', color: '#2e7d32', margin: '0', fontWeight: 600 }}>→ {e.ergebnis}</p>}
                  <div style={{ fontSize: '10px', color: '#888', marginTop: '6px' }}>{e.datum}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EMPFEHLUNGSÜBERSICHT ─────────────────────────────────────

function EmpfehlungsUebersicht({ empfehlungen }: { empfehlungen: any[] }) {
  const erfolgreich = empfehlungen.filter(e => e.erfolgreich);
  const offen = empfehlungen.filter(e => e.status === 'offen' || e.status === 'kontaktiert');

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: 'Empfehlungen gesamt', value: empfehlungen.length, color: '#003366' },
          { label: 'Erfolgreich', value: erfolgreich.length, color: '#4CAF50' },
          { label: 'Offen', value: offen.length, color: '#FF9900' },
          { label: 'Erfolgsquote', value: empfehlungen.length > 0 ? `${Math.round((erfolgreich.length / empfehlungen.length) * 100)}%` : '–', color: '#9C27B0' },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: '12px', color: '#666' }}>{s.label}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: s.color, marginTop: '4px' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Alle Empfehlungen als Tabelle */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#003366', color: 'white' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Empfehler</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Empfohlenes Unternehmen</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Kontext</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Datum</th>
            </tr>
          </thead>
          <tbody>
            {empfehlungen.map((e, i) => (
              <tr key={e.id} style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ padding: '12px' }}>
                  <div style={{ fontWeight: 600 }}>{e.kontaktName}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>{e.kontaktOrg}</div>
                </td>
                <td style={{ padding: '12px', fontWeight: 600, color: '#003366' }}>{e.empfohleneName}</td>
                <td style={{ padding: '12px', fontSize: '12px', color: '#555', maxWidth: '220px' }}>{e.kontext || '–'}</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, color: 'white', backgroundColor: getEmpfehlungsStatusColor(e.status) }}>
                    {getEmpfehlungsStatusLabel(e.status)}
                    {e.erfolgreich ? ' ✓' : ''}
                  </span>
                </td>
                <td style={{ padding: '12px', fontSize: '12px', color: '#666' }}>{e.datum}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ANALYTICS ────────────────────────────────────────────────

function NetzwerkAnalytics({ kontakte }: { kontakte: MockNetzwerkkontakt[] }) {
  const alleEmpfehlungen = kontakte.flatMap(k => k.empfehlungen);
  const top5 = [...kontakte].sort((a, b) => b.netzwerkWert - a.netzwerkWert).slice(0, 5);

  const katCount: Record<string, number> = {};
  kontakte.forEach(k => { katCount[k.kategorie] = (katCount[k.kategorie] || 0) + 1; });

  const landDE = kontakte.filter(k => k.land === 'deutschland').length;
  const landDK = kontakte.filter(k => k.land === 'daenemark').length;

  const aktiv = kontakte.filter(k => k.aktivitaetsStatus === 'aktiv').length;
  const empfehlungenErfolgreich = alleEmpfehlungen.filter(e => e.erfolgreich).length;

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: 'Netzwerkkontakte', value: kontakte.length, color: '#003366' },
          { label: '🟢 Aktive Kontakte', value: aktiv, color: '#4CAF50' },
          { label: '🇩🇪 Deutschland', value: landDE, color: '#2196F3' },
          { label: '🇩🇰 Dänemark', value: landDK, color: '#E91E63' },
          { label: 'Empfehlungen', value: alleEmpfehlungen.length, color: '#FF9900' },
          { label: 'Erfolgreiche Empf.', value: empfehlungenErfolgreich, color: '#9C27B0' },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: '12px', color: '#666' }}>{s.label}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: s.color, marginTop: '4px' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Top 5 nach Netzwerkwert */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}>
          <h3 style={{ marginTop: 0, color: '#003366', fontSize: '15px', marginBottom: '16px' }}>Top-Netzwerkpartner</h3>
          {top5.map((k, i) => (
            <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#999', minWidth: '20px' }}>#{i + 1}</span>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: getKontaktKategorieColor(k.kategorie) + '20', border: `2px solid ${getKontaktKategorieColor(k.kategorie)}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                {getKontaktKategorieIcon(k.kategorie)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{k.name}</div>
                <div style={{ fontSize: '11px', color: '#666' }}>{k.organisation}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: getNetzwerkWertColor(k.netzwerkWert) }}>{k.netzwerkWert}</div>
                <div style={{ fontSize: '9px', color: '#666' }}>{k.empfehlungen.filter(e => e.erfolgreich).length} Erfolge</div>
              </div>
            </div>
          ))}
        </div>

        {/* Kategorien-Verteilung */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}>
          <h3 style={{ marginTop: 0, color: '#003366', fontSize: '15px', marginBottom: '16px' }}>Kontakt-Kategorien</h3>
          {Object.entries(katCount).sort((a, b) => b[1] - a[1]).map(([kat, count]) => (
            <div key={kat} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '16px', minWidth: '20px' }}>{getKontaktKategorieIcon(kat)}</span>
              <span style={{ flex: 1, fontSize: '13px' }}>{getKontaktKategorieLabel(kat)}</span>
              <div style={{ width: '70px', height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '4px', backgroundColor: getKontaktKategorieColor(kat), width: `${(count / kontakte.length) * 100}%` }} />
              </div>
              <span style={{ fontSize: '12px', color: '#666', minWidth: '20px' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Netzwerk-Herkunft der Vermittlungen */}
      <div style={{ marginTop: '24px', backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}>
        <h3 style={{ marginTop: 0, color: '#003366', fontSize: '15px', marginBottom: '4px' }}>Netzwerk-Herkunft der Kontakte</h3>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 16px 0' }}>Wer hat wie viele erfolgreiche Empfehlungen gebracht?</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
          {kontakte.filter(k => k.empfehlungen.length > 0).map(k => (
            <div key={k.id} style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#f9f9f9', border: '1px solid #eee' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#003366' }}>{k.name}</div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '2px', marginBottom: '8px' }}>{k.organisation}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ textAlign: 'center', flex: 1, backgroundColor: '#e8f0fe', borderRadius: '6px', padding: '6px' }}>
                  <div style={{ fontWeight: 700, color: '#003366', fontSize: '16px' }}>{k.empfehlungen.length}</div>
                  <div style={{ fontSize: '10px', color: '#666' }}>Gesamt</div>
                </div>
                <div style={{ textAlign: 'center', flex: 1, backgroundColor: '#e8f5e9', borderRadius: '6px', padding: '6px' }}>
                  <div style={{ fontWeight: 700, color: '#4CAF50', fontSize: '16px' }}>{k.empfehlungen.filter(e => e.erfolgreich).length}</div>
                  <div style={{ fontSize: '10px', color: '#666' }}>Erfolge</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── HILFSKOMPONENTEN ─────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '16px', marginBottom: '8px' }}>{children}</div>;
}

function InfoZeile({ icon, value }: { icon: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', fontSize: '13px', alignItems: 'flex-start' }}>
      <span style={{ minWidth: '18px', flexShrink: 0 }}>{icon}</span>
      <span style={{ color: '#333' }}>{value}</span>
    </div>
  );
}
