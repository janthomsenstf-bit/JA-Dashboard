
import { useState } from 'react';
import { MOCK_INTERESSENTEN, MOCK_ANFRAGEN, getStatusLabel, getStatusColor, type MockInteressent } from '@easyb2b/lib/mockdata';
import { useStore } from '@easyb2b/lib/store';
import { ZUORDNUNG_STATUS, getZuordnungLabel, getZuordnungColor } from '@easyb2b/lib/projekte';
import { berechneInteressentKlaerung } from '@easyb2b/lib/klaerungsstand';
import KlaerungsBox from '@easyb2b/components/KlaerungsBox';

// KI-Zusammenfassung (Mock — später Anthropic API)
function kiZusammenfassung(i: MockInteressent): string {
  const teile: string[] = [];
  teile.push(`${i.firmenname} passt ${i.passung === 'hoch' ? 'sehr gut' : i.passung === 'mittel' ? 'grundsätzlich' : 'bedingt'} zur Anfrage von ${i.anfrageFirma}`);
  if (i.erfahrung) teile.push(`bringt Erfahrung mit (${i.erfahrung.slice(0, 60)}…)`);
  if (i.sprachen?.length) teile.push(`kommuniziert auf ${i.sprachen.join('/')}`);
  if (i.reaktionszeit) teile.push(`reagiert ${i.reaktionszeit.toLowerCase()}`);
  let text = teile.join(', ') + '.';
  const offen: string[] = [];
  if (!i.referenzenVorhanden) offen.push('konkrete Referenzen');
  if (!i.gespraechGefuehrt) offen.push('ein persönliches Gespräch');
  if (i.einschraenkungen) offen.push(`Voraussetzung: ${i.einschraenkungen}`);
  if (offen.length) text += ` Offen ist noch: ${offen.join(', ')}.`;
  return text;
}

// Eingangskorb-Lifecycle (primär) + Legacy-Status (Kompatibilität mit Bestandsdaten)
const STATUS_OPTIONEN = [
  'neu', 'in_pruefung', 'rueckfrage', 'abgelehnt', 'kontakt_erstellt',
  // Legacy (für bestehende Mock-Daten)
  'freigegeben', 'kontakt_laeuft', 'feedback_ausstehend', 'erfolgreich', 'nicht_passend', 'archiviert',
];

export default function InteressentenPage() {
  const [filterStatus, setFilterStatus] = useState('alle');
  const [interessenten, setInteressenten] = useState(MOCK_INTERESSENTEN);
  const [toast, setToast] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const zeigeToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const update = (id: string, patch: Partial<MockInteressent>, meldung?: string) => {
    setInteressenten(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    if (meldung) zeigeToast(meldung);
  };

  const filtered = interessenten.filter(i => filterStatus === 'alle' || i.status === filterStatus);
  const detail = detailId ? interessenten.find(i => i.id === detailId) : null;

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 4000, backgroundColor: '#003366', color: 'white', padding: '14px 20px', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: '14px', fontWeight: 600 }}>
          {toast}
        </div>
      )}

      {detail && (
        <InteressentDetail
          interessent={detail}
          alle={interessenten}
          onClose={() => setDetailId(null)}
          onUpdate={update}
          onToast={zeigeToast}
        />
      )}

      <h1 style={{ marginTop: 0, marginBottom: '24px', color: '#003366', fontSize: '24px' }}>Interessenten Verwaltung</h1>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#666', display: 'block', marginBottom: '4px' }}>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', minWidth: '200px' }}>
            <option value="alle">Alle Status</option>
            {STATUS_OPTIONEN.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
          </select>
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>{filtered.length} Interessent(en)</span>
        </div>
      </div>

      {/* Karten */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
        {filtered.map(i => (
          <div key={i.id} style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', padding: '20px', borderLeft: `4px solid ${getStatusColor(i.status)}` }}>
            {/* Header — klickbar */}
            <div onClick={() => setDetailId(i.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', cursor: 'pointer' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#003366' }}>{i.firmenname}</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
                  {i.ansprechpartner}{i.position ? ` · ${i.position}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {i.matchScore && (
                  <span style={{ padding: '4px 8px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, backgroundColor: i.matchScore >= 80 ? '#e8f5e9' : '#fff3e0', color: i.matchScore >= 80 ? '#2e7d32' : '#e65100' }}>
                    {i.matchScore}%
                  </span>
                )}
                <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: 'white', backgroundColor: getStatusColor(i.status) }}>
                  {getStatusLabel(i.status)}
                </span>
              </div>
            </div>

            {/* Anfrage-Bezug */}
            <div style={{ backgroundColor: '#f9f9f9', borderRadius: '6px', padding: '10px', marginBottom: '12px', fontSize: '13px' }}>
              <span style={{ color: '#555' }}>Interesse an:</span> <strong>{i.anfrageFirma}</strong>
            </div>

            {/* Vorschau warum */}
            {i.warumPassung && (
              <p style={{ fontSize: '13px', color: '#444', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                {i.warumPassung.slice(0, 110)}{i.warumPassung.length > 110 ? '…' : ''}
              </p>
            )}

            {/* Qualifizierungs-Indikatoren */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <PruefDot label="Gespräch" aktiv={i.gespraechGefuehrt} />
              <PruefDot label="Website" aktiv={i.websiteGeprueft} />
              <PruefDot label="LinkedIn" aktiv={i.linkedinGeprueft} />
              <PruefDot label="Referenzen" aktiv={i.referenzenVorhanden} />
            </div>

            {/* Quick Actions + Details */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              {i.status === 'neu' && (
                <>
                  <button onClick={() => update(i.id, { status: 'freigegeben' }, `${i.firmenname} freigegeben ✓`)} style={btnStyle('#4CAF50')}>Freigeben</button>
                  <button onClick={() => update(i.id, { status: 'abgelehnt' }, `${i.firmenname} abgelehnt`)} style={btnStyle('#f44336')}>Ablehnen</button>
                </>
              )}
              {i.status === 'freigegeben' && (
                <button onClick={() => update(i.id, { status: 'kontakt_laeuft' }, `Kontakt zu ${i.firmenname} hergestellt`)} style={btnStyle('#003366')}>Kontakt herstellen</button>
              )}
              <button onClick={() => setDetailId(i.id)} style={{ ...btnStyle('transparent'), color: '#003366', border: '1px solid #003366', marginLeft: 'auto' }}>
                Details ansehen →
              </button>
            </div>

            <div style={{ fontSize: '11px', color: '#555', marginTop: '12px' }}>Eingegangen: {i.createdAt}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DETAIL-MODAL ─────────────────────────────────────────────

function InteressentDetail({ interessent: i, alle, onClose, onUpdate, onToast }: {
  interessent: MockInteressent;
  alle: MockInteressent[];
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<MockInteressent>, meldung?: string) => void;
  onToast: (msg: string) => void;
}) {
  const store = useStore();
  const [kiText, setKiText] = useState<string | null>(null);
  const [kiLaedt, setKiLaedt] = useState(false);
  const [zuordnenOffen, setZuordnenOffen] = useState(false);
  const [neuProjekt, setNeuProjekt] = useState('');
  const [neuGrund, setNeuGrund] = useState('');
  const [kontaktDuplikate, setKontaktDuplikate] = useState<typeof store.geschaftskontakte | null>(null);

  // Kontakt aus Interessent erstellen (mit Duplikat-Check)
  const kontaktErstellen = () => {
    const duplikate = store.geschaftskontakte.filter(k =>
      k.email.toLowerCase() === i.email.toLowerCase() ||
      k.firmenname.toLowerCase() === i.firmenname.toLowerCase()
    );
    if (duplikate.length > 0) {
      setKontaktDuplikate(duplikate);
    } else {
      const kid = store.legeKontaktAusInteressentAn(i.id);
      if (kid) onUpdate(i.id, { status: 'kontakt_erstellt', kontaktId: kid }, `✅ Kontakt "${i.firmenname}" erstellt`);
    }
  };

  const kontaktNeuTrotzdem = () => {
    const kid = store.legeKontaktAusInteressentAn(i.id);
    if (kid) onUpdate(i.id, { status: 'kontakt_erstellt', kontaktId: kid }, `✅ Neuer Kontakt erstellt`);
    setKontaktDuplikate(null);
  };

  const kontaktVerknuepfen = (kontaktId: string) => {
    const k = store.geschaftskontakte.find(x => x.id === kontaktId);
    // Bestehenden Kontakt mit diesem Projekt verknüpfen (falls noch nicht)
    if (k && i.anfrageId && !k.projektZuordnungen.some(z => z.projektId === i.anfrageId)) {
      store.addKontaktProjektZuordnung(kontaktId, {
        id: `kpz-${Date.now()}`,
        projektId: i.anfrageId,
        status: 'freigegeben',
        notiz: 'Über Interessent verknüpft',
        erstelltAm: new Date().toISOString().split('T')[0],
        erstelltVon: 'Operator',
      });
    }
    onUpdate(i.id, { status: 'kontakt_erstellt', kontaktId }, `✅ Mit "${k?.firmenname}" verknüpft`);
    setKontaktDuplikate(null);
  };

  const anfrage = MOCK_ANFRAGEN.find(a => a.id === i.anfrageId);
  // Historie: andere Meldungen derselben Firma (per E-Mail-Domain oder Name)
  const historie = alle.filter(x => x.id !== i.id && (x.email === i.email || x.firmenname === i.firmenname));

  // Projektzuordnungen dieses Interessenten
  const meineZuordnungen = store.zuordnungen.filter(z => z.interessentId === i.id);
  const zugeordneteProjektIds = meineZuordnungen.map(z => z.projektId);
  const verfuegbareProjekte = store.anfragen.filter(a => !zugeordneteProjektIds.includes(a.id));

  const handleZuordnen = () => {
    if (!neuProjekt) return;
    const proj = store.anfragen.find(a => a.id === neuProjekt);
    store.addZuordnung({
      projektId: neuProjekt,
      interessentId: i.id,
      zuordnungsart: 'manuell',
      status: 'in_pruefung',
      grund: neuGrund || 'Manuell durch Operator zugeordnet',
      erstelltAm: 'gerade eben',
      erstelltVon: 'Operator',
      letzteAktivitaet: 'gerade eben',
    });
    store.logge(`${i.firmenname} manuell zu „${proj?.ziel}" zugeordnet`, i.firmenname, 'bearbeiten');
    onToast(`${i.firmenname} dem Projekt zugeordnet ✓`);
    setNeuProjekt(''); setNeuGrund(''); setZuordnenOffen(false);
  };

  const handleKi = async () => {
    setKiLaedt(true);
    await new Promise(r => setTimeout(r, 1100));
    setKiText(kiZusammenfassung(i));
    setKiLaedt(false);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '30px 20px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '760px', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, backgroundColor: 'white', borderRadius: '12px 12px 0 0', zIndex: 1 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#003366' }}>{i.firmenname}</h2>
            <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
              {i.ansprechpartner}{i.position ? ` · ${i.position}` : ''}{i.region ? ` · ${i.region}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {i.matchScore && (
              <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '14px', fontWeight: 700, backgroundColor: i.matchScore >= 80 ? '#e8f5e9' : '#fff3e0', color: i.matchScore >= 80 ? '#2e7d32' : '#e65100' }}>
                Match {i.matchScore}%
              </span>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#666' }}>×</button>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {/* ── MATCHING-BEZUG ── */}
          {anfrage && (
            <Box titel="🎯 Bezug zur Anfrage" bg="#f0f4ff">
              <div style={{ fontSize: '13px', color: '#003366', fontWeight: 600, marginBottom: '4px' }}>
                {anfrage.anzeigenId} · {anfrage.firmenname}
              </div>
              <div style={{ fontSize: '13px', color: '#444', marginBottom: '8px' }}>Sucht: {anfrage.ziel}</div>
              {i.matchGruende && i.matchGruende.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#2e7d32', marginBottom: '4px' }}>✓ GRÜNDE FÜR PASSUNG</div>
                  {i.matchGruende.map((g, idx) => <div key={idx} style={{ fontSize: '12px', color: '#444', marginBottom: '2px' }}>• {g}</div>)}
                </div>
              )}
              {i.matchRisiken && i.matchRisiken.length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#e65100', marginBottom: '4px' }}>⚠ MÖGLICHE RISIKEN</div>
                  {i.matchRisiken.map((r, idx) => <div key={idx} style={{ fontSize: '12px', color: '#444', marginBottom: '2px' }}>• {r}</div>)}
                </div>
              )}
            </Box>
          )}

          {/* ── KI-ZUSAMMENFASSUNG ── */}
          <div style={{ marginBottom: '20px' }}>
            <button onClick={handleKi} disabled={kiLaedt} style={{ padding: '10px 18px', backgroundColor: kiLaedt ? '#ccc' : '#003366', color: 'white', border: 'none', borderRadius: '8px', cursor: kiLaedt ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
              {kiLaedt ? '✨ Analysiert...' : '✨ KI-Kurzbewertung'}
            </button>
            {kiText && (
              <div style={{ marginTop: '12px', backgroundColor: '#e8f0fe', border: '1px solid #c5d3f0', borderRadius: '8px', padding: '14px', fontSize: '13px', color: '#333', lineHeight: 1.6 }}>
                {kiText}
              </div>
            )}
          </div>

          {/* ── KONTAKT & STAMMDATEN ── */}
          <Box titel="Stammdaten & Kontakt">
            <Grid>
              <Feld label="E-Mail" wert={<a href={`mailto:${i.email}`} style={{ color: '#003366' }}>{i.email}</a>} />
              {i.telefon && <Feld label="Telefon" wert={i.telefon} />}
              {i.website && <Feld label="Website" wert={i.website} />}
              {i.linkedin && <Feld label="LinkedIn" wert={i.linkedin} />}
              {i.land && <Feld label="Land" wert={i.land === 'deutschland' ? '🇩🇪 Deutschland' : '🇩🇰 Dänemark'} />}
              {i.sprachen?.length && <Feld label="Sprachen" wert={`${i.sprachen.join(', ')}${i.bevorzugteSprache ? ` (bevorzugt: ${i.bevorzugteSprache})` : ''}`} />}
            </Grid>
          </Box>

          {/* ── GENERISCHE FORMULAR-ANTWORTEN (aus zugeordnetem Formular) ── */}
          {i.formularAntworten && i.formularAntworten.length > 0 && (
            <Box titel="Formular-Antworten" bg="#f0f4ff">
              {(() => {
                const formular = i.formularId ? store.formulare.find(f => f.id === i.formularId) : null;
                return formular ? (
                  <div style={{ fontSize: '11px', color: '#1565C0', fontWeight: 600, marginBottom: '10px' }}>
                    📝 Formular: {formular.name}
                    <a href="/dashboard/formulare" style={{ marginLeft: '8px', color: '#003366', textDecoration: 'none' }}>ansehen →</a>
                  </div>
                ) : null;
              })()}
              {i.formularAntworten.map((a, idx) => (
                <Antwort key={idx} frage={a.frageText} antwort={a.wert} />
              ))}
            </Box>
          )}

          {/* ── FORMULAR-ANTWORTEN (Legacy) ── */}
          {(i.warumInteresse || i.warumPassung || i.beitrag) ? (
            <Box titel="Antworten aus dem Interessentenformular">
              {i.warumInteresse && <Antwort frage="Warum interessiert Sie diese Anfrage?" antwort={i.warumInteresse} />}
              {i.warumPassung && <Antwort frage="Warum passt Ihr Unternehmen?" antwort={i.warumPassung} />}
              {i.beitrag && <Antwort frage="Was können Sie beitragen?" antwort={i.beitrag} />}
              {i.erfahrung && <Antwort frage="Erfahrung in diesem Bereich?" antwort={i.erfahrung} />}
              {i.referenzen && <Antwort frage="Referenzen / Beispiele?" antwort={i.referenzen} />}
              {i.zusammenarbeit && <Antwort frage="Vorstellung der Zusammenarbeit?" antwort={i.zusammenarbeit} />}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {i.interesseLevel && <MiniTag color="#9C27B0">Interesse: {labelInteresse(i.interesseLevel)}</MiniTag>}
                {i.reaktionszeit && <MiniTag color="#2196F3">Reaktion: {i.reaktionszeit}</MiniTag>}
                {i.einschraenkungen && <MiniTag color="#FF5722">Voraussetzung: {i.einschraenkungen}</MiniTag>}
              </div>
              {i.persoenlicheNote && (
                <div style={{ marginTop: '10px', backgroundColor: '#fff8e1', borderRadius: '6px', padding: '10px', fontSize: '13px', color: '#555', fontStyle: 'italic' }}>
                  „{i.persoenlicheNote}"
                </div>
              )}
            </Box>
          ) : (
            <Box titel="Antworten aus dem Interessentenformular" bg="#fffde7">
              <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>
                Dieser Interessent hat nur Basisdaten übermittelt. Ergänze fehlende Infos über „Bearbeiten" nach einem Telefonat.
              </p>
            </Box>
          )}

          {/* ── PROJEKTZUORDNUNG ── */}
          <Box titel={`🔗 Projektzuordnung (${meineZuordnungen.length})`} bg="#f0f4ff">
            {meineZuordnungen.map(z => {
              const proj = store.anfragen.find(a => a.id === z.projektId);
              return (
                <div key={z.id} style={{ backgroundColor: 'white', borderRadius: '8px', padding: '12px', marginBottom: '8px', border: '1px solid #e0e0e0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#003366' }}>
                        {proj?.ziel || z.projektId}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{proj?.firmenname} · {proj?.anzeigenId}</div>
                      {z.grund && <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic', marginTop: '4px' }}>„{z.grund}"</div>}
                      <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                        {z.zuordnungsart === 'automatisch' ? '⚙ Automatisch' : '✋ Manuell'} · {z.erstelltVon} · {z.erstelltAm}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600,
                        color: 'white', backgroundColor: z.zuordnungsart === 'manuell' ? '#FF9900' : '#999',
                      }}>
                        {z.zuordnungsart === 'manuell' ? 'manuell' : 'automatisch'}
                      </span>
                      <select
                        value={z.status}
                        onChange={e => { store.updateZuordnung(z.id, { status: e.target.value }); onToast(`Zuordnung: ${getZuordnungLabel(e.target.value)}`); }}
                        style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${getZuordnungColor(z.status)}`, fontSize: '11px', color: getZuordnungColor(z.status), fontWeight: 600 }}
                      >
                        {ZUORDNUNG_STATUS.map(s => <option key={s} value={s}>{getZuordnungLabel(s)}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Zuordnen-Formular */}
            {zuordnenOffen ? (
              <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '14px', border: '1px solid #c5d3f0', marginTop: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Projekt wählen</label>
                <select value={neuProjekt} onChange={e => setNeuProjekt(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', marginBottom: '8px' }}>
                  <option value="">— Projekt auswählen —</option>
                  {verfuegbareProjekte.map(a => <option key={a.id} value={a.id}>{a.ziel} ({a.firmenname})</option>)}
                </select>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Grund der Zuordnung</label>
                <textarea value={neuGrund} onChange={e => setNeuGrund(e.target.value)} rows={2}
                  placeholder="z.B. Hat im Telefonat am 03.06. Interesse an diesem Projekt geäußert."
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', marginBottom: '8px' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleZuordnen} disabled={!neuProjekt} style={{ ...btnStyle(neuProjekt ? '#003366' : '#ccc'), cursor: neuProjekt ? 'pointer' : 'not-allowed' }}>Zuordnen</button>
                  <button onClick={() => setZuordnenOffen(false)} style={{ ...btnStyle('transparent'), color: '#666', border: '1px solid #ddd' }}>Abbrechen</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setZuordnenOffen(true)} style={{ ...btnStyle('#003366'), marginTop: '4px' }}>
                + Projekt zuordnen
              </button>
            )}
          </Box>

          {/* ── INTERNE PRÜFUNG (editierbar) ── */}
          <Box titel="🔍 Interne Prüfung" bg="#f9f9f9">
            <Grid>
              <SelectFeld label="Ersteindruck" wert={i.ersteindruck} optionen={[['sehr_gut','Sehr gut'],['gut','Gut'],['neutral','Neutral'],['kritisch','Kritisch']]} onChange={v => onUpdate(i.id, { ersteindruck: v })} />
              <SelectFeld label="Passung" wert={i.passung} optionen={[['hoch','Hoch'],['mittel','Mittel'],['niedrig','Niedrig']]} onChange={v => onUpdate(i.id, { passung: v })} />
              <SelectFeld label="Seriosität" wert={i.seriositaet} optionen={[['geprueft','Geprüft'],['ungeprueft','Ungeprüft'],['kritisch','Kritisch']]} onChange={v => onUpdate(i.id, { seriositaet: v })} />
            </Grid>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
              <CheckBtn label="Gespräch geführt" aktiv={i.gespraechGefuehrt} onClick={() => onUpdate(i.id, { gespraechGefuehrt: !i.gespraechGefuehrt })} />
              <CheckBtn label="Website geprüft" aktiv={i.websiteGeprueft} onClick={() => onUpdate(i.id, { websiteGeprueft: !i.websiteGeprueft })} />
              <CheckBtn label="LinkedIn geprüft" aktiv={i.linkedinGeprueft} onClick={() => onUpdate(i.id, { linkedinGeprueft: !i.linkedinGeprueft })} />
              <CheckBtn label="Referenzen vorhanden" aktiv={i.referenzenVorhanden} onClick={() => onUpdate(i.id, { referenzenVorhanden: !i.referenzenVorhanden })} />
            </div>
            {/* Gesprächsnotiz */}
            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Gesprächsnotiz</label>
              <textarea
                defaultValue={i.gespraechsnotiz || ''}
                onBlur={e => onUpdate(i.id, { gespraechsnotiz: e.target.value }, 'Notiz gespeichert')}
                placeholder="Notiz aus dem Telefonat / Gespräch..."
                rows={3}
                style={{ width: '100%', marginTop: '5px', padding: '9px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
          </Box>

          {/* ── HISTORIE ── */}
          {historie.length > 0 && (
            <Box titel={`📜 Historie: ${i.firmenname} hat sich ${historie.length + 1}× gemeldet`} bg="#fff8e1">
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Weitere Meldungen dieses Unternehmens:</div>
              {historie.map(h => (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #ffe082', fontSize: '13px' }}>
                  <span>{h.anfrageFirma}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, color: 'white', backgroundColor: getStatusColor(h.status) }}>{getStatusLabel(h.status)}</span>
                </div>
              ))}
            </Box>
          )}

          {/* ── KLÄRUNGSSTAND ── */}
          <Box titel="Klärungsstand">
            <KlaerungsBox
              stand={berechneInteressentKlaerung(i)}
              typ="interessent"
            />
            <div style={{ fontSize: '11px', color: '#666', marginTop: '8px', fontStyle: 'italic' }}>
              💡 Nach Konvertierung zum Kontakt werden Klärungspunkte dort dauerhaft pflegbar.
            </div>
          </Box>

          {/* ── KONTAKT ERSTELLEN ── */}
          <Box titel="Kontakt erstellen" bg="#e8f5e9">
            {i.kontaktId ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: '#2e7d32', fontWeight: 600 }}>✅ Kontakt wurde erstellt</span>
                <a href="/dashboard/kontakte" style={{ fontSize: '12px', color: '#003366', fontWeight: 600, textDecoration: 'none' }}>→ Im Kontakte-Modul ansehen</a>
              </div>
            ) : kontaktDuplikate ? (
              <div>
                <div style={{ fontSize: '12px', color: '#c62828', marginBottom: '8px', padding: '8px', backgroundColor: '#ffebee', borderRadius: '6px' }}>
                  ⚠️ Möglicher bestehender Kontakt gefunden: <strong>{kontaktDuplikate.map(k => k.firmenname).join(', ')}</strong>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={kontaktNeuTrotzdem} style={btnStyle('#1565C0')}>+ Trotzdem neu erstellen</button>
                  {kontaktDuplikate.map(k => (
                    <button key={k.id} onClick={() => kontaktVerknuepfen(k.id)} style={{ ...btnStyle('#fff'), color: '#1565C0', border: '1px solid #1565C0' }}>
                      🔗 Mit „{k.firmenname}" verknüpfen
                    </button>
                  ))}
                  <button onClick={() => setKontaktDuplikate(null)} style={{ ...btnStyle('#f5f5f5'), color: '#666' }}>Abbrechen</button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '12px', color: '#555', margin: '0 0 10px 0' }}>
                  Aus diesem geprüften Interessenten einen dauerhaften Kontakt anlegen. Der Interessent bleibt als Ursprungsvorgang erhalten.
                </p>
                <button onClick={kontaktErstellen} disabled={i.status === 'abgelehnt'} style={{ ...btnStyle('#2e7d32'), opacity: i.status === 'abgelehnt' ? 0.5 : 1, cursor: i.status === 'abgelehnt' ? 'not-allowed' : 'pointer' }}>
                  🤝 Kontakt aus Interessent erstellen
                </button>
              </div>
            )}
          </Box>

          {/* ── ENTSCHEIDUNG / STATUS ── */}
          <Box titel="Entscheidung">
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Aktueller Status: <strong style={{ color: getStatusColor(i.status) }}>{getStatusLabel(i.status)}</strong></div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => onUpdate(i.id, { status: 'freigegeben' }, `${i.firmenname} freigegeben ✓`)} style={btnStyle('#4CAF50')}>✓ Freigeben</button>
              <button onClick={() => onUpdate(i.id, { status: 'rueckfrage' }, 'Als Rückfrage markiert')} style={btnStyle('#FF5722')}>? Rückfrage</button>
              <button onClick={() => onUpdate(i.id, { status: 'abgelehnt' }, `${i.firmenname} abgelehnt`)} style={btnStyle('#f44336')}>✗ Ablehnen</button>
              <select
                value={i.status}
                onChange={e => onUpdate(i.id, { status: e.target.value }, `Status: ${getStatusLabel(e.target.value)}`)}
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', marginLeft: 'auto' }}
              >
                {STATUS_OPTIONEN.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
              </select>
            </div>
          </Box>
        </div>
      </div>
    </div>
  );
}

// ─── HILFSKOMPONENTEN ─────────────────────────────────────────

function btnStyle(bg: string): React.CSSProperties {
  return { padding: '7px 14px', backgroundColor: bg, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 };
}

function PruefDot({ label, aktiv }: { label: string; aktiv?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: aktiv ? '#4CAF50' : '#888' }}>
      <span>{aktiv ? '✓' : '○'}</span>{label}
    </span>
  );
}

function Box({ titel, children, bg }: { titel: string; children: React.ReactNode; bg?: string }) {
  return (
    <div style={{ marginBottom: '20px', backgroundColor: bg || 'transparent', borderRadius: bg ? '8px' : 0, padding: bg ? '14px' : 0 }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{titel}</h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>{children}</div>;
}

function Feld({ label, wert }: { label: string; wert: React.ReactNode }) {
  return (
    <div style={{ fontSize: '13px' }}>
      <span style={{ color: '#555', fontSize: '11px', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>{label}</span>
      <span style={{ color: '#333' }}>{wert}</span>
    </div>
  );
}

function Antwort({ frage, antwort }: { frage: string; antwort: string }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic', marginBottom: '2px' }}>{frage}</div>
      <div style={{ fontSize: '13px', color: '#333', lineHeight: 1.5 }}>{antwort}</div>
    </div>
  );
}

function MiniTag({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, backgroundColor: color + '20', color }}>{children}</span>;
}

function SelectFeld({ label, wert, optionen, onChange }: { label: string; wert?: string; optionen: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>{label}</label>
      <select value={wert || ''} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
        <option value="">—</option>
        {optionen.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function CheckBtn({ label, aktiv, onClick }: { label: string; aktiv?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', borderRadius: '20px', border: '1px solid', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
      borderColor: aktiv ? '#4CAF50' : '#ddd', backgroundColor: aktiv ? '#4CAF50' : 'white', color: aktiv ? 'white' : '#666',
    }}>
      {aktiv ? '✓ ' : ''}{label}
    </button>
  );
}

function labelInteresse(v: string): string {
  return { kennenlernen: 'Erstes Kennenlernen', gespraech: 'Konkretes Gespräch', pilot: 'Pilotprojekt', umsetzung: 'Kurzfristige Umsetzung' }[v] || v;
}
