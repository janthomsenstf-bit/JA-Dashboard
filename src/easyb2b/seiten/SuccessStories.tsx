
import { useState } from 'react';
import { MOCK_SUCCESS_STORIES, getLandFlag, type MockSuccessStory } from '@easyb2b/lib/mockdata';
import {
  getFreigabeLabel, getFreigabeColor, getFreigabeIcon,
  getEntstehungswegLabel, getEntstehungswegIcon,
  getErgebnisTypLabel, getErgebnisTypColor,
  generiereStoryContent,
} from '@easyb2b/lib/storygen';

type TabMain = 'liste' | 'statistiken';
type TabDetail = 'inhalt' | 'veroeffentlichung' | 'ki';

export default function SuccessStoriesPage() {
  const [tabMain, setTabMain] = useState<TabMain>('liste');
  const [filterFreigabe, setFilterFreigabe] = useState('alle');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tabDetail, setTabDetail] = useState<TabDetail>('inhalt');
  const [kiGeneriert, setKiGeneriert] = useState<Record<string, any>>({});
  const [kiLaedt, setKiLaedt] = useState<string | null>(null);

  const filtered = MOCK_SUCCESS_STORIES.filter(s =>
    filterFreigabe === 'alle' || s.freigabe === filterFreigabe
  );

  const selected = selectedId ? MOCK_SUCCESS_STORIES.find(s => s.id === selectedId) : null;

  const handleKiGenerieren = async (story: MockSuccessStory) => {
    setKiLaedt(story.id);
    await new Promise(r => setTimeout(r, 1200));
    const content = generiereStoryContent({
      titel: story.titel,
      ausgangssituation: story.ausgangssituation,
      herausforderung: story.herausforderung,
      ergebnis: story.ergebnis,
      erkenntnisse: story.erkenntnisse,
      vermittlungsweg: story.vermittlungsweg,
      branche: story.branche,
      land: story.land,
      entstehungsweg: story.entstehungsweg,
      anonymisiert: story.anonymisiert,
      firma1: story.firma1Name,
      firma2: story.firma2Name,
    });
    setKiGeneriert(prev => ({ ...prev, [story.id]: content }));
    setKiLaedt(null);
    setTabDetail('ki');
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#003366', fontSize: '24px' }}>Success Stories</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
            Erfolgreiche Vermittlungen — Vertrauen durch echte Ergebnisse
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['liste', 'statistiken'] as TabMain[]).map(t => (
            <button key={t} onClick={() => setTabMain(t)} style={{
              padding: '8px 18px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '13px',
              backgroundColor: tabMain === t ? '#003366' : '#f0f0f0',
              color: tabMain === t ? 'white' : '#666',
            }}>
              {t === 'liste' ? 'Stories' : 'Statistiken'}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: LISTE ─────────────────────────────────── */}
      {tabMain === 'liste' && (
        <div style={{ display: 'flex', gap: '24px' }}>
          {/* Linke Spalte */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Filter */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', display: 'block', marginBottom: '3px' }}>Freigabe</label>
                <select value={filterFreigabe} onChange={e => setFilterFreigabe(e.target.value)}
                  style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
                  <option value="alle">Alle</option>
                  <option value="intern">🔒 Intern</option>
                  <option value="anonymisiert">👤 Anonymisiert</option>
                  <option value="freigegeben">🌐 Freigegeben</option>
                </select>
              </div>
              <span style={{ fontSize: '13px', color: '#666' }}>{filtered.length} Story/Stories</span>
            </div>

            {/* Story-Karten */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filtered.map(story => (
                <StoryCard
                  key={story.id}
                  story={story}
                  selected={selectedId === story.id}
                  onClick={() => {
                    setSelectedId(selectedId === story.id ? null : story.id);
                    setTabDetail('inhalt');
                  }}
                />
              ))}
            </div>
          </div>

          {/* Rechtes Detail-Panel */}
          {selected && (
            <StoryDetailPanel
              story={selected}
              activeTab={tabDetail}
              setActiveTab={setTabDetail}
              onClose={() => setSelectedId(null)}
              onKiGenerieren={() => handleKiGenerieren(selected)}
              kiLaedt={kiLaedt === selected.id}
              kiContent={kiGeneriert[selected.id]}
            />
          )}
        </div>
      )}

      {/* ── TAB: STATISTIKEN ──────────────────────────── */}
      {tabMain === 'statistiken' && (
        <StoryStatistiken stories={MOCK_SUCCESS_STORIES} />
      )}
    </div>
  );
}

// ─── STORY KARTE ─────────────────────────────────────────────

function StoryCard({ story, selected, onClick }: {
  story: MockSuccessStory; selected: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'white', borderRadius: '10px', padding: '20px',
        cursor: 'pointer',
        border: selected ? '2px solid #003366' : '2px solid transparent',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = '#ccc'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '16px' }}>{getEntstehungswegIcon(story.entstehungsweg)}</span>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#003366' }}>{story.titel}</span>
          </div>
          <p style={{ fontSize: '13px', color: '#555', lineHeight: 1.5, margin: '0 0 10px 0' }}>
            {story.kurzbeschreibung}
          </p>
          {/* Meta */}
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#666', marginBottom: '10px' }}>
            <span>{getLandFlag(story.land)} {story.branche}</span>
            <span>→ {getEntstehungswegLabel(story.entstehungsweg)}</span>
            <span>📅 {story.createdAt}</span>
          </div>
          {/* Ergebnis-Typen */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {story.ergebnisTypen.map(t => (
              <span key={t} style={{
                padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600,
                backgroundColor: getErgebnisTypColor(t) + '20', color: getErgebnisTypColor(t),
              }}>
                {getErgebnisTypLabel(t)}
              </span>
            ))}
          </div>
        </div>

        {/* Rechts: Freigabe + Firmen */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <span style={{
            padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
            color: 'white', backgroundColor: getFreigabeColor(story.freigabe),
          }}>
            {getFreigabeIcon(story.freigabe)} {getFreigabeLabel(story.freigabe)}
          </span>
          <div style={{ textAlign: 'right', fontSize: '12px', color: '#666' }}>
            <div>{story.firma1Name}</div>
            <div style={{ color: '#999' }}>↔</div>
            <div>{story.firma2Name}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DETAIL PANEL ─────────────────────────────────────────────

function StoryDetailPanel({ story, activeTab, setActiveTab, onClose, onKiGenerieren, kiLaedt, kiContent }: {
  story: MockSuccessStory;
  activeTab: TabDetail;
  setActiveTab: (t: TabDetail) => void;
  onClose: () => void;
  onKiGenerieren: () => void;
  kiLaedt: boolean;
  kiContent: any;
}) {
  const [selectedKiFormat, setSelectedKiFormat] = useState<'homepage' | 'linkedin' | 'newsletter'>('homepage');
  const [toast, setToast] = useState<string | null>(null);
  const zeigeToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const tabs: { id: TabDetail; label: string }[] = [
    { id: 'inhalt', label: 'Story' },
    { id: 'veroeffentlichung', label: 'Veröffentlichung' },
    { id: 'ki', label: '✨ KI-Content' },
  ];

  const mergedKi = {
    homepage: kiContent?.homepage || story.kiHomepage,
    linkedin: kiContent?.linkedin || story.kiLinkedIn,
    newsletter: kiContent?.newsletter || story.kiNewsletter,
  };

  return (
    <div style={{
      width: '420px', flexShrink: 0, backgroundColor: 'white',
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
      <div style={{ padding: '20px 20px 0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '16px', marginRight: '8px' }}>{getEntstehungswegIcon(story.entstehungsweg)}</span>
            <h2 style={{ margin: '4px 0 0 0', color: '#003366', fontSize: '16px', lineHeight: 1.3 }}>{story.titel}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666', flexShrink: 0 }}>×</button>
        </div>

        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, color: 'white', backgroundColor: getFreigabeColor(story.freigabe) }}>
          {getFreigabeIcon(story.freigabe)} {getFreigabeLabel(story.freigabe)}
        </span>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginTop: '16px', borderBottom: '2px solid #f0f0f0', paddingBottom: 0 }}>
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
        {/* ── INHALT ── */}
        {activeTab === 'inhalt' && (
          <div>
            {/* Firmen */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'center', marginBottom: '20px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
              <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#003366', padding: '6px', backgroundColor: '#e3f2fd', borderRadius: '6px' }}>{story.firma1Name}</div>
              <div style={{ textAlign: 'center', color: '#9C27B0', fontSize: '18px' }}>⟷</div>
              <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#880e4f', padding: '6px', backgroundColor: '#fce4ec', borderRadius: '6px' }}>{story.firma2Name}</div>
            </div>

            {/* Narrative */}
            {[
              { label: 'Ausgangssituation', value: story.ausgangssituation },
              { label: 'Herausforderung', value: story.herausforderung },
              { label: 'Gesuch', value: story.gesuch },
              { label: 'Vermittlungsweg', value: story.vermittlungsweg },
              { label: 'Ergebnis', value: story.ergebnis, highlight: true },
              { label: 'Erkenntnisse', value: story.erkenntnisse },
            ].filter(f => f.value).map(f => (
              <div key={f.label} style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{f.label}</div>
                <div style={{
                  fontSize: '13px', color: f.highlight ? '#003366' : '#444', lineHeight: 1.6,
                  backgroundColor: f.highlight ? '#e8f5e9' : 'transparent',
                  padding: f.highlight ? '10px' : '0',
                  borderRadius: f.highlight ? '6px' : '0',
                  borderLeft: f.highlight ? '3px solid #4CAF50' : 'none',
                  paddingLeft: f.highlight ? '12px' : '0',
                }}>
                  {f.value}
                </div>
              </div>
            ))}

            {/* Ergebnis-Typen */}
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>Ergebnis-Typen</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {story.ergebnisTypen.map(t => (
                  <span key={t} style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, backgroundColor: getErgebnisTypColor(t) + '20', color: getErgebnisTypColor(t) }}>
                    {getErgebnisTypLabel(t)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── VERÖFFENTLICHUNG ── */}
        {activeTab === 'veroeffentlichung' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>Aktueller Status</div>
              <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: getFreigabeColor(story.freigabe) + '15', border: `1px solid ${getFreigabeColor(story.freigabe)}40` }}>
                <div style={{ fontWeight: 700, color: getFreigabeColor(story.freigabe), fontSize: '14px' }}>
                  {getFreigabeIcon(story.freigabe)} {getFreigabeLabel(story.freigabe)}
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  {story.freigabe === 'intern' && 'Diese Story ist nur intern im Dashboard sichtbar.'}
                  {story.freigabe === 'anonymisiert' && 'Diese Story ist öffentlich sichtbar, aber ohne Firmennamen.'}
                  {story.freigabe === 'freigegeben' && 'Diese Story ist vollständig öffentlich freigegeben.'}
                </div>
              </div>
            </div>

            {/* Anonymisierte Version */}
            {(story.titelAnon || story.ergebnisAnon) && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>Anonymisierte Version</div>
                {story.titelAnon && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>Titel (anon):</div>
                    <div style={{ fontSize: '13px', color: '#333', fontStyle: 'italic' }}>{story.titelAnon}</div>
                  </div>
                )}
                {story.ergebnisAnon && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#666', marginBottom: '3px' }}>Ergebnis (anon):</div>
                    <div style={{ fontSize: '13px', color: '#333', fontStyle: 'italic', backgroundColor: '#f9f9f9', padding: '10px', borderRadius: '6px' }}>{story.ergebnisAnon}</div>
                  </div>
                )}
              </div>
            )}

            {/* Datenschutz-Hinweis */}
            <div style={{ backgroundColor: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '12px', color: '#555' }}>
              <strong>⚠️ Datenschutz:</strong> Vor Freigabe sicherstellen, dass beide Unternehmen zugestimmt haben. Nur über den Freigabe-Status ändern, nicht über direkte Bearbeitung.
            </div>

            {/* Status ändern */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => zeigeToast('Story als anonymisiert veröffentlicht')} style={{ padding: '10px', backgroundColor: story.freigabe !== 'anonymisiert' ? '#FF9900' : '#e0e0e0', color: story.freigabe !== 'anonymisiert' ? 'white' : '#999', border: 'none', borderRadius: '6px', cursor: story.freigabe !== 'anonymisiert' ? 'pointer' : 'default', fontSize: '13px', fontWeight: 600 }}>
                👤 Als anonymisiert veröffentlichen
              </button>
              <button onClick={() => zeigeToast('Story mit Freigabe veröffentlicht ✓')} style={{ padding: '10px', backgroundColor: story.freigabe !== 'freigegeben' ? '#4CAF50' : '#e0e0e0', color: story.freigabe !== 'freigegeben' ? 'white' : '#999', border: 'none', borderRadius: '6px', cursor: story.freigabe !== 'freigegeben' ? 'pointer' : 'default', fontSize: '13px', fontWeight: 600 }}>
                🌐 Mit Freigabe veröffentlichen
              </button>
              <button onClick={() => zeigeToast('Story auf intern zurückgesetzt')} style={{ padding: '10px', backgroundColor: 'transparent', color: '#666', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                🔒 Zurück auf intern setzen
              </button>
            </div>
          </div>
        )}

        {/* ── KI-CONTENT ── */}
        {activeTab === 'ki' && (
          <div>
            <p style={{ fontSize: '13px', color: '#666', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Generiere automatisch verschiedene Content-Formate aus dieser Story.
            </p>

            <button
              onClick={onKiGenerieren}
              disabled={kiLaedt}
              style={{
                width: '100%', padding: '12px', marginBottom: '20px',
                backgroundColor: kiLaedt ? '#ccc' : '#003366',
                color: 'white', border: 'none', borderRadius: '6px',
                cursor: kiLaedt ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 600,
              }}
            >
              {kiLaedt ? '✨ Wird generiert...' : '✨ Content mit KI generieren'}
            </button>

            {(mergedKi.homepage || mergedKi.linkedin || mergedKi.newsletter) && (
              <>
                {/* Format Auswahl */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                  {(['homepage', 'linkedin', 'newsletter'] as const).map(f => (
                    <button key={f} onClick={() => setSelectedKiFormat(f)} style={{
                      flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '11px', fontWeight: 600,
                      backgroundColor: selectedKiFormat === f ? '#003366' : '#f0f0f0',
                      color: selectedKiFormat === f ? 'white' : '#666',
                    }}>
                      {f === 'homepage' ? '🌐 Homepage' : f === 'linkedin' ? '💼 LinkedIn' : '📧 Newsletter'}
                    </button>
                  ))}
                </div>

                {/* Content Anzeige */}
                {mergedKi[selectedKiFormat] && (
                  <div style={{ backgroundColor: '#f9f9f9', borderRadius: '8px', padding: '14px', fontSize: '13px', color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap', border: '1px solid #e0e0e0' }}>
                    {mergedKi[selectedKiFormat]}
                  </div>
                )}

                <button onClick={() => { navigator.clipboard?.writeText(mergedKi[selectedKiFormat] || ''); zeigeToast('In Zwischenablage kopiert 📋'); }} style={{ width: '100%', padding: '10px', marginTop: '10px', backgroundColor: 'transparent', color: '#003366', border: '1px solid #003366', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                  📋 In Zwischenablage kopieren
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── STATISTIKEN ─────────────────────────────────────────────

function StoryStatistiken({ stories }: { stories: MockSuccessStory[] }) {
  const freigegeben = stories.filter(s => s.freigabe === 'freigegeben').length;
  const anon = stories.filter(s => s.freigabe === 'anonymisiert').length;
  const intern = stories.filter(s => s.freigabe === 'intern').length;

  // Entstehungsweg-Verteilung
  const wegCount: Record<string, number> = {};
  stories.forEach(s => { wegCount[s.entstehungsweg] = (wegCount[s.entstehungsweg] || 0) + 1; });

  // Branchenverteilung
  const brancheCount: Record<string, number> = {};
  stories.forEach(s => { brancheCount[s.branche] = (brancheCount[s.branche] || 0) + 1; });

  // Ergebnis-Typen
  const ergebnisCount: Record<string, number> = {};
  stories.forEach(s => s.ergebnisTypen.forEach(t => { ergebnisCount[t] = (ergebnisCount[t] || 0) + 1; }));

  // Land
  const deCount = stories.filter(s => s.land === 'deutschland').length;
  const dkCount = stories.filter(s => s.land === 'daenemark').length;

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '32px' }}>
        {[
          { label: 'Stories gesamt', value: stories.length, color: '#003366' },
          { label: '🌐 Freigegeben', value: freigegeben, color: '#4CAF50' },
          { label: '👤 Anonymisiert', value: anon, color: '#FF9900' },
          { label: '🔒 Intern', value: intern, color: '#999' },
          { label: '🇩🇪 Deutsche Seite', value: deCount, color: '#2196F3' },
          { label: '🇩🇰 Dänische Seite', value: dkCount, color: '#E91E63' },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: '12px', color: '#666' }}>{s.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: s.color, marginTop: '4px' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Entstehungsweg */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}>
          <h3 style={{ marginTop: 0, color: '#003366', fontSize: '15px', marginBottom: '16px' }}>Entstehungswege</h3>
          {Object.entries(wegCount).sort((a, b) => b[1] - a[1]).map(([weg, count]) => (
            <div key={weg} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '16px', minWidth: '20px' }}>{getEntstehungswegIcon(weg)}</span>
              <span style={{ flex: 1, fontSize: '13px' }}>{getEntstehungswegLabel(weg)}</span>
              <div style={{ width: '70px', height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', backgroundColor: '#003366', width: `${(count / stories.length) * 100}%`, borderRadius: '4px' }} />
              </div>
              <span style={{ fontSize: '12px', color: '#666', minWidth: '20px' }}>{count}×</span>
            </div>
          ))}
        </div>

        {/* Ergebnis-Typen */}
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}>
          <h3 style={{ marginTop: 0, color: '#003366', fontSize: '15px', marginBottom: '16px' }}>Ergebnis-Typen</h3>
          {Object.entries(ergebnisCount).sort((a, b) => b[1] - a[1]).map(([typ, count]) => (
            <div key={typ} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getErgebnisTypColor(typ), flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '13px' }}>{getErgebnisTypLabel(typ)}</span>
              <div style={{ width: '70px', height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', backgroundColor: getErgebnisTypColor(typ), width: `${(count / stories.length) * 100}%`, borderRadius: '4px' }} />
              </div>
              <span style={{ fontSize: '12px', color: '#666', minWidth: '20px' }}>{count}×</span>
            </div>
          ))}
        </div>
      </div>

      {/* Branchenverteilung */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}>
        <h3 style={{ marginTop: 0, color: '#003366', fontSize: '15px', marginBottom: '16px' }}>Branchenverteilung</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
          {Object.entries(brancheCount).map(([branche, count]) => (
            <div key={branche} style={{ padding: '10px 14px', borderRadius: '8px', backgroundColor: '#f9f9f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#333' }}>{branche}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#003366' }}>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
