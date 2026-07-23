
import { useState } from 'react';
import {
  MOCK_NEWSLETTER, MOCK_ABONNENTEN, INTERESSENGRUPPEN, BLOCK_TYPEN,
  generiereNewsletterMock, verbessereNewsletterMock,
  generiereAnfragenBlock,
  getNewsletterStatusLabel, getNewsletterStatusColor,
  getAbonnentStatusColor, getBlockMeta,
  type NewsletterBlock, type MockNewsletter,
} from '@easyb2b/lib/newsletter';
import { getLandFlag } from '@easyb2b/lib/mockdata';

type TabMain = 'uebersicht' | 'editor' | 'abonnenten' | 'statistiken';

export default function NewsletterPage() {
  const [tab, setTab] = useState<TabMain>('uebersicht');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#003366', fontSize: '24px' }}>Newsletter</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>Neues aus dem deutsch-dänischen Netzwerk</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {([['uebersicht', 'Übersicht'], ['editor', '✏️ Erstellen'], ['abonnenten', 'Abonnenten'], ['statistiken', 'Statistiken']] as [TabMain, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '12px',
              backgroundColor: tab === id ? '#003366' : '#f0f0f0', color: tab === id ? 'white' : '#666',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {tab === 'uebersicht' && <NewsletterUebersicht onCreate={() => setTab('editor')} />}
      {tab === 'editor' && <NewsletterEditor />}
      {tab === 'abonnenten' && <AbonnentenVerwaltung />}
      {tab === 'statistiken' && <NewsletterStatistiken />}
    </div>
  );
}

// ─── ÜBERSICHT ────────────────────────────────────────────────

function NewsletterUebersicht({ onCreate }: { onCreate: () => void }) {
  return (
    <div>
      <button onClick={onCreate} style={{
        padding: '12px 24px', backgroundColor: '#003366', color: 'white', border: 'none',
        borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 700, marginBottom: '24px',
      }}>
        ✏️ Neuen Newsletter erstellen
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {MOCK_NEWSLETTER.map(nl => (
          <div key={nl.id} style={{
            backgroundColor: 'white', borderRadius: '10px', padding: '18px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, fontSize: '15px', color: '#003366' }}>{nl.titel}</span>
                <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: 'white', backgroundColor: getNewsletterStatusColor(nl.status) }}>
                  {getNewsletterStatusLabel(nl.status)}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#444', marginBottom: '6px' }}>{nl.betreff}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{nl.vorschautext}</div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                {nl.zielgruppen.map(z => (
                  <span key={z} style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', backgroundColor: '#e8f0fe', color: '#003366' }}>{z}</span>
                ))}
              </div>
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right', marginLeft: '16px' }}>
              {nl.status === 'versendet' ? (
                <>
                  <div style={{ fontSize: '12px', color: '#666' }}>{nl.empfaengerCount} Empfänger</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#4CAF50', marginTop: '4px' }}>{nl.oeffnungsrate}%</div>
                  <div style={{ fontSize: '10px', color: '#666' }}>Öffnungsrate</div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>{nl.versendetAm}</div>
                </>
              ) : nl.status === 'geplant' ? (
                <>
                  <div style={{ fontSize: '11px', color: '#666' }}>Geplant für</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#2196F3' }}>{nl.geplantFuer}</div>
                </>
              ) : (
                <span style={{ fontSize: '12px', color: '#666' }}>Entwurf</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── EDITOR (Block-System) ────────────────────────────────────

function NewsletterEditor() {
  const [bloecke, setBloecke] = useState<NewsletterBlock[]>([]);
  const [betreff, setBetreff] = useState('');
  const [zielgruppen, setZielgruppen] = useState<string[]>([]);
  const [kiLaedt, setKiLaedt] = useState(false);
  const [voiceHinweise, setVoiceHinweise] = useState<string[] | null>(null);
  const [anfragenFilter, setAnfragenFilter] = useState<'alle' | 'de_dk' | 'dk_de'>('alle');
  const [toast, setToast] = useState<string | null>(null);
  const zeigeToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
  const empfaenger = MOCK_ABONNENTEN.filter(a => a.status === 'aktiv' && (zielgruppen.length === 0 || a.interessen.some(i => zielgruppen.includes(i)))).length;

  const handleKiGenerieren = async () => {
    setKiLaedt(true);
    const result = await generiereNewsletterMock();
    setBloecke(result);
    setBetreff('Neues aus dem deutsch-dänischen Netzwerk');
    setKiLaedt(false);
  };

  const handleVerbessern = async () => {
    setKiLaedt(true);
    const result = await verbessereNewsletterMock(bloecke);
    setVoiceHinweise(result.hinweise);
    setKiLaedt(false);
  };

  const handleBlockEntfernen = (id: string) => setBloecke(prev => prev.filter(b => b.id !== id));

  const handleBlockHinzufuegen = (typ: string) => {
    const meta = BLOCK_TYPEN.find(b => b.typ === typ)!;
    if (typ === 'neue_anfragen') {
      setBloecke(prev => [...prev, generiereAnfragenBlock(anfragenFilter)]);
    } else {
      setBloecke(prev => [...prev, { id: `block-${Date.now()}`, typ: meta.typ, titel: meta.label, inhalt: '' }]);
    }
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const neu = [...bloecke];
    const ziel = idx + dir;
    if (ziel < 0 || ziel >= neu.length) return;
    [neu[idx], neu[ziel]] = [neu[ziel], neu[idx]];
    setBloecke(neu);
  };

  return (
    <div style={{ display: 'flex', gap: '24px' }}>
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          backgroundColor: '#003366', color: 'white', padding: '14px 20px',
          borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: '14px', fontWeight: 600,
        }}>{toast}</div>
      )}
      {/* Editor links */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* KI-Aktionen */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={handleKiGenerieren} disabled={kiLaedt} style={{
            padding: '12px 20px', backgroundColor: kiLaedt ? '#ccc' : '#003366', color: 'white',
            border: 'none', borderRadius: '8px', cursor: kiLaedt ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 700,
          }}>
            {kiLaedt ? '✨ Generiert...' : '✨ Newsletter automatisch erstellen'}
          </button>
          {bloecke.length > 0 && (
            <button onClick={handleVerbessern} disabled={kiLaedt} style={{
              padding: '12px 20px', backgroundColor: 'transparent', color: '#003366',
              border: '1px solid #003366', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            }}>
              🎙 Voice-Check & Verbessern
            </button>
          )}
        </div>

        {/* Voice-Hinweise */}
        {voiceHinweise && (
          <div style={{ backgroundColor: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#2e7d32', marginBottom: '8px' }}>🎙 Voice-Check: Klingt nach Easy-B2B ✓</div>
            {voiceHinweise.map((h, i) => <div key={i} style={{ fontSize: '12px', color: '#444', marginBottom: '4px' }}>• {h}</div>)}
          </div>
        )}

        {/* Betreff */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#555', display: 'block', marginBottom: '5px' }}>Betreff</label>
          <input value={betreff} onChange={e => setBetreff(e.target.value)} placeholder="Betreff des Newsletters..."
            style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '14px', boxSizing: 'border-box' }} />
        </div>

        {/* Blöcke */}
        {bloecke.length === 0 ? (
          <div style={{ backgroundColor: 'white', borderRadius: '10px', padding: '40px', textAlign: 'center', color: '#666', border: '2px dashed #ddd' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📰</div>
            <p style={{ fontSize: '14px' }}>Noch keine Blöcke. Lass die KI einen Entwurf erstellen oder füge rechts Blöcke hinzu.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {bloecke.map((b, idx) => {
              const meta = getBlockMeta(b.typ);
              return (
                <div key={b.id} style={{ backgroundColor: 'white', borderRadius: '10px', padding: '16px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', borderLeft: '4px solid #003366' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#003366' }}>{meta.icon} {meta.label}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => moveBlock(idx, -1)} style={miniBtn}>↑</button>
                      <button onClick={() => moveBlock(idx, 1)} style={miniBtn}>↓</button>
                      <button onClick={() => handleBlockEntfernen(b.id)} style={{ ...miniBtn, color: '#f44336' }}>×</button>
                    </div>
                  </div>
                  <input value={b.titel} onChange={e => setBloecke(prev => prev.map(x => x.id === b.id ? { ...x, titel: e.target.value } : x))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #eee', borderRadius: '4px', fontSize: '14px', fontWeight: 600, marginBottom: '6px', boxSizing: 'border-box' }} />
                  <textarea value={b.inhalt} onChange={e => setBloecke(prev => prev.map(x => x.id === b.id ? { ...x, inhalt: e.target.value } : x))}
                    rows={b.typ === 'neue_anfragen' ? 5 : 3}
                    style={{ width: '100%', padding: '8px', border: '1px solid #eee', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }} />
                  {b.anfrageIds && b.anfrageIds.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#4CAF50', marginTop: '6px' }}>🔗 {b.anfrageIds.length} Anfrage(n) verknüpft</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Aktionen */}
        {bloecke.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
            <button onClick={() => zeigeToast(`Newsletter an ${empfaenger} Empfänger versendet ✓`)} style={{ padding: '12px 20px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>📤 Sofort versenden</button>
            <button onClick={() => zeigeToast('Versand geplant — du wirst vor dem Absenden erinnert')} style={{ padding: '12px 20px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>📅 Versand planen</button>
            <button onClick={() => zeigeToast('Als Entwurf gespeichert')} style={{ padding: '12px 20px', backgroundColor: 'transparent', color: '#666', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>💾 Als Entwurf speichern</button>
          </div>
        )}
      </div>

      {/* Block-Bibliothek rechts */}
      <div style={{ width: '280px', flexShrink: 0 }}>
        <div style={{ backgroundColor: 'white', borderRadius: '10px', padding: '18px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', position: 'sticky', top: '20px' }}>
          <h3 style={{ marginTop: 0, fontSize: '14px', color: '#003366', marginBottom: '14px' }}>Block hinzufügen</h3>

          {/* Anfragen-Filter */}
          <div style={{ backgroundColor: '#f9f9f9', borderRadius: '6px', padding: '10px', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', marginBottom: '6px' }}>Anfragen-Filter</div>
            <select value={anfragenFilter} onChange={e => setAnfragenFilter(e.target.value as any)}
              style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}>
              <option value="alle">Alle Anfragen</option>
              <option value="de_dk">Nur DE → DK</option>
              <option value="dk_de">Nur DK → DE</option>
            </select>
          </div>

          {BLOCK_TYPEN.map(b => (
            <button key={b.typ} onClick={() => handleBlockHinzufuegen(b.typ)} style={{
              width: '100%', padding: '10px', marginBottom: '6px', backgroundColor: '#f9f9f9',
              border: '1px solid #eee', borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
            }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e8f0fe'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f9f9f9'}
            >
              <span style={{ fontSize: '16px' }}>{b.icon}</span>
              <div>
                <div style={{ fontWeight: 600, color: '#003366' }}>{b.label}</div>
                <div style={{ fontSize: '10px', color: '#666' }}>{b.beschreibung}</div>
              </div>
            </button>
          ))}

          {/* Zielgruppen */}
          <h3 style={{ fontSize: '14px', color: '#003366', marginTop: '20px', marginBottom: '10px' }}>Zielgruppen</h3>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {INTERESSENGRUPPEN.map(g => (
              <button key={g} onClick={() => setZielgruppen(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])}
                style={{
                  padding: '4px 10px', borderRadius: '12px', border: '1px solid',
                  cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                  borderColor: zielgruppen.includes(g) ? '#003366' : '#ddd',
                  backgroundColor: zielgruppen.includes(g) ? '#003366' : 'white',
                  color: zielgruppen.includes(g) ? 'white' : '#666',
                }}>{g}</button>
            ))}
          </div>
          {zielgruppen.length > 0 && (
            <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
              ≈ {MOCK_ABONNENTEN.filter(a => a.status === 'aktiv' && a.interessen.some(i => zielgruppen.includes(i))).length} Empfänger
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ABONNENTEN ───────────────────────────────────────────────

function AbonnentenVerwaltung() {
  const [filterInteresse, setFilterInteresse] = useState('alle');
  const gefiltert = MOCK_ABONNENTEN.filter(a => filterInteresse === 'alle' || a.interessen.includes(filterInteresse));
  const aktiv = MOCK_ABONNENTEN.filter(a => a.status === 'aktiv').length;
  const de = MOCK_ABONNENTEN.filter(a => a.land === 'deutschland').length;
  const dk = MOCK_ABONNENTEN.filter(a => a.land === 'daenemark').length;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'Abonnenten', value: MOCK_ABONNENTEN.length, color: '#003366' },
          { label: '🟢 Aktiv', value: aktiv, color: '#4CAF50' },
          { label: '🇩🇪 Deutschland', value: de, color: '#2196F3' },
          { label: '🇩🇰 Dänemark', value: dk, color: '#E91E63' },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: '12px', color: '#666' }}>{s.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: s.color, marginTop: '4px' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <select value={filterInteresse} onChange={e => setFilterInteresse(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
          <option value="alle">Alle Interessen</option>
          {INTERESSENGRUPPEN.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <span style={{ marginLeft: '12px', fontSize: '13px', color: '#666' }}>{gefiltert.length} Abonnent(en)</span>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#003366', color: 'white' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Unternehmen</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>Interessen</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Engagement</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {gefiltert.map((a, i) => (
              <tr key={a.id} style={{ borderBottom: '1px solid #f0f0f0', backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ padding: '12px' }}>{getLandFlag(a.land)} {a.name}</td>
                <td style={{ padding: '12px', color: '#666' }}>{a.unternehmen}</td>
                <td style={{ padding: '12px' }}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {a.interessen.slice(0, 3).map(int => (
                      <span key={int} style={{ padding: '2px 6px', borderRadius: '8px', fontSize: '10px', backgroundColor: '#e8f0fe', color: '#003366' }}>{int}</span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
                  {a.geoeffnetCount}× geöffnet · {a.geklicktCount}× geklickt
                </td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, color: 'white', backgroundColor: getAbonnentStatusColor(a.status) }}>
                    {a.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── STATISTIKEN ──────────────────────────────────────────────

function NewsletterStatistiken() {
  const versendet = MOCK_NEWSLETTER.filter(n => n.status === 'versendet');
  const avgOeffnung = versendet.length ? (versendet.reduce((s, n) => s + (n.oeffnungsrate || 0), 0) / versendet.length).toFixed(1) : '–';
  const avgKlick = versendet.length ? (versendet.reduce((s, n) => s + (n.klickrate || 0), 0) / versendet.length).toFixed(1) : '–';

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: 'Newsletter gesamt', value: MOCK_NEWSLETTER.length, color: '#003366' },
          { label: 'Versendet', value: versendet.length, color: '#4CAF50' },
          { label: 'Abonnenten', value: MOCK_ABONNENTEN.length, color: '#9C27B0' },
          { label: 'Ø Öffnungsrate', value: `${avgOeffnung}%`, color: '#FF9900' },
          { label: 'Ø Klickrate', value: `${avgKlick}%`, color: '#2196F3' },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: '12px', color: '#666' }}>{s.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: s.color, marginTop: '4px' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', marginBottom: '24px' }}>
        <h3 style={{ marginTop: 0, color: '#003366', fontSize: '15px', marginBottom: '16px' }}>Versendete Newsletter — Performance</h3>
        {versendet.map(n => (
          <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#003366' }}>{n.titel}</div>
              <div style={{ fontSize: '11px', color: '#666' }}>{n.versendetAm} · {n.empfaengerCount} Empfänger</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#4CAF50' }}>{n.oeffnungsrate}%</div>
              <div style={{ fontSize: '10px', color: '#666' }}>Öffnung</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#2196F3' }}>{n.klickrate}%</div>
              <div style={{ fontSize: '10px', color: '#666' }}>Klick</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: '#e8f0fe', border: '1px solid #c5d3f0', borderRadius: '10px', padding: '20px' }}>
        <h3 style={{ marginTop: 0, color: '#003366', fontSize: '15px', marginBottom: '8px' }}>📊 Erkenntnis</h3>
        <p style={{ fontSize: '13px', color: '#3c4043', lineHeight: 1.6, margin: 0 }}>
          Newsletter mit Event-Bezug (April: Failure Night) erzielen die höchste Klickrate (15,8%). Kultur-Momente und konkrete Anfragen
          treiben das Engagement. Die durchschnittliche Öffnungsrate von ~50% liegt deutlich über dem B2B-Branchenschnitt (~21%) —
          ein Zeichen für ein engagiertes, vertrauensvolles Netzwerk.
        </p>
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  width: '24px', height: '24px', border: '1px solid #ddd', borderRadius: '4px',
  backgroundColor: 'white', cursor: 'pointer', fontSize: '13px', color: '#666', padding: 0,
};
