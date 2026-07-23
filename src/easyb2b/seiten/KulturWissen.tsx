
import { useState } from 'react';
import {
  MOCK_KULTUR_MOMENTE, MOCK_GRENZGESCHICHTEN, KATEGORIEN,
  getKategorieLabel, getKategorieIcon, getKategorieColor,
  getTonLabel, getTonIcon, getLandFlagKultur,
  getWissenStatusLabel, getWissenStatusColor,
  getGeschichteTypLabel, getGeschichteTypIcon,
  type MockKulturMoment, type MockGrenzgeschichte,
} from '@easyb2b/lib/kultur';

type TabMain = 'momente' | 'geschichten' | 'analytics';

export default function KulturWissenPage() {
  const [tab, setTab] = useState<TabMain>('momente');
  const [suche, setSuche] = useState('');
  const [filterKat, setFilterKat] = useState('alle');
  const [filterLand, setFilterLand] = useState('alle');
  const [selectedMoment, setSelectedMoment] = useState<string | null>(null);
  const [selectedGeschichte, setSelectedGeschichte] = useState<string | null>(null);

  const filteredMomente = MOCK_KULTUR_MOMENTE.filter(m => {
    if (filterKat !== 'alle' && m.kategorie !== filterKat) return false;
    if (filterLand !== 'alle' && m.land !== filterLand) return false;
    if (suche && !`${m.titel} ${m.lernmoment} ${m.aussage}`.toLowerCase().includes(suche.toLowerCase())) return false;
    return true;
  });

  const filteredGeschichten = MOCK_GRENZGESCHICHTEN.filter(g => {
    if (filterKat !== 'alle' && g.kategorie !== filterKat) return false;
    if (suche && !`${g.titel} ${g.situation} ${g.erkenntnis}`.toLowerCase().includes(suche.toLowerCase())) return false;
    return true;
  });

  const moment = selectedMoment ? MOCK_KULTUR_MOMENTE.find(m => m.id === selectedMoment) : null;
  const geschichte = selectedGeschichte ? MOCK_GRENZGESCHICHTEN.find(g => g.id === selectedGeschichte) : null;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#003366', fontSize: '24px' }}>Kultur & Wissen</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
            Die Wissensbibliothek deutsch-dänischer Zusammenarbeit
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {([['momente', 'Kultur-Momente'], ['geschichten', 'Grenzgeschichten'], ['analytics', 'Analytics']] as [TabMain, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '12px',
              backgroundColor: tab === id ? '#003366' : '#f0f0f0',
              color: tab === id ? 'white' : '#666',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Suche + Filter (nur in Listen-Tabs) */}
      {tab !== 'analytics' && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input
            placeholder="🔍 Suche in Titel, Aussage, Lernmoment..."
            value={suche}
            onChange={e => setSuche(e.target.value)}
            style={{ flex: 1, minWidth: '240px', padding: '9px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}
          />
          <select value={filterKat} onChange={e => setFilterKat(e.target.value)}
            style={{ padding: '9px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
            <option value="alle">Alle Kategorien</option>
            {KATEGORIEN.map(k => <option key={k} value={k}>{getKategorieIcon(k)} {getKategorieLabel(k)}</option>)}
          </select>
          {tab === 'momente' && (
            <select value={filterLand} onChange={e => setFilterLand(e.target.value)}
              style={{ padding: '9px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
              <option value="alle">Alle Länder</option>
              <option value="deutschland">🇩🇪 Deutschland</option>
              <option value="daenemark">🇩🇰 Dänemark</option>
              <option value="beide">🇩🇪🇩🇰 Beide</option>
            </select>
          )}
        </div>
      )}

      {/* ── KULTUR-MOMENTE ── */}
      {tab === 'momente' && (
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>{filteredMomente.length} Kultur-Moment(e)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
              {filteredMomente.map(m => (
                <MomentKarte key={m.id} m={m} selected={selectedMoment === m.id}
                  onClick={() => setSelectedMoment(selectedMoment === m.id ? null : m.id)} />
              ))}
            </div>
          </div>
          {moment && <MomentDetail m={moment} onClose={() => setSelectedMoment(null)} />}
        </div>
      )}

      {/* ── GRENZGESCHICHTEN ── */}
      {tab === 'geschichten' && (
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>{filteredGeschichten.length} Geschichte(n)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredGeschichten.map(g => (
                <GeschichteKarte key={g.id} g={g} selected={selectedGeschichte === g.id}
                  onClick={() => setSelectedGeschichte(selectedGeschichte === g.id ? null : g.id)} />
              ))}
            </div>
          </div>
          {geschichte && <GeschichteDetail g={geschichte} onClose={() => setSelectedGeschichte(null)} />}
        </div>
      )}

      {/* ── ANALYTICS ── */}
      {tab === 'analytics' && <KulturAnalytics />}
    </div>
  );
}

// ─── KULTUR-MOMENT KARTE ──────────────────────────────────────

function MomentKarte({ m, selected, onClick }: { m: MockKulturMoment; selected: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      backgroundColor: 'white', borderRadius: '10px', padding: '16px', cursor: 'pointer',
      border: selected ? '2px solid #003366' : '2px solid transparent',
      boxShadow: '0 2px 6px rgba(0,0,0,0.07)', transition: 'all 0.15s',
    }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = '#ccc'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px' }}>{getKategorieIcon(m.kategorie)}</span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span title={getTonLabel(m.ton)} style={{ fontSize: '14px' }}>{getTonIcon(m.ton)}</span>
          <span style={{ fontSize: '14px' }}>{getLandFlagKultur(m.land)}</span>
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: '15px', color: '#003366', marginBottom: '6px', fontStyle: m.originalSprache ? 'italic' : 'normal' }}>
        {m.titel}
      </div>
      <p style={{ fontSize: '12px', color: '#555', lineHeight: 1.5, margin: '0 0 10px 0' }}>
        {m.lernmoment.slice(0, 110)}{m.lernmoment.length > 110 ? '…' : ''}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}>
        <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, backgroundColor: getKategorieColor(m.kategorie) + '20', color: getKategorieColor(m.kategorie) }}>
          {getKategorieLabel(m.kategorie)}
        </span>
        <span style={{ fontSize: '10px', color: '#555', fontWeight: 500 }}>
          {m.oeffentlich ? '🌐' : '🔒'} · {m.verwendetCount}× genutzt
        </span>
      </div>
    </div>
  );
}

function MomentDetail({ m, onClose }: { m: MockKulturMoment; onClose: () => void }) {
  const [toast, setToast] = useState<string | null>(null);
  const zeigeToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
  return (
    <div style={{
      width: '400px', flexShrink: 0, backgroundColor: 'white', borderRadius: '10px',
      boxShadow: '0 2px 16px rgba(0,0,0,0.12)', alignSelf: 'flex-start', position: 'sticky', top: '20px',
      maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', padding: '24px',
    }}>
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          backgroundColor: '#003366', color: 'white', padding: '14px 20px',
          borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: '14px', fontWeight: 600,
        }}>{toast}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '22px', marginBottom: '4px' }}>{getKategorieIcon(m.kategorie)} {getLandFlagKultur(m.land)}</div>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#003366', fontStyle: m.originalSprache ? 'italic' : 'normal' }}>{m.titel}</h2>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666' }}>×</button>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <Tag color={getKategorieColor(m.kategorie)}>{getKategorieLabel(m.kategorie)}</Tag>
        <Tag color="#666">{getTonIcon(m.ton)} {getTonLabel(m.ton)}</Tag>
        <Tag color={getWissenStatusColor(m.status)}>{getWissenStatusLabel(m.status)}</Tag>
        <Tag color={m.oeffentlich ? '#4CAF50' : '#999'}>{m.oeffentlich ? '🌐 Öffentlich' : '🔒 Intern'}</Tag>
      </div>

      {m.ausgangssituation && <Block label="Ausgangssituation" text={m.ausgangssituation} />}
      {m.aussage && <Block label="Aussage" text={m.aussage} bg="#f0f4ff" />}
      {m.interpretation && <Block label="Deutsche Interpretation" text={m.interpretation} bg="#e3f2fd" />}
      {m.bedeutung && <Block label="Tatsächliche Bedeutung" text={m.bedeutung} bg="#fce4ec" />}
      <Block label="💡 Lernmoment" text={m.lernmoment} bg="#e8f5e9" highlight />

      {/* Content-Nutzung */}
      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>Verwenden für</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {['🌐 Homepage', '📧 Newsletter', '💼 LinkedIn', '🎤 Event'].map(z => (
            <button key={z} onClick={() => zeigeToast(`Für ${z.split(' ')[1]} übernommen`)} style={{ padding: '8px', backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#444' }}>{z}</button>
          ))}
        </div>
        <button onClick={() => { navigator.clipboard?.writeText(`${m.titel}\n\n${m.lernmoment}`); zeigeToast('Text kopiert 📋'); }} style={{ width: '100%', marginTop: '8px', padding: '10px', backgroundColor: '#003366', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
          📋 Text kopieren
        </button>
      </div>
    </div>
  );
}

// ─── GRENZGESCHICHTE KARTE ────────────────────────────────────

function GeschichteKarte({ g, selected, onClick }: { g: MockGrenzgeschichte; selected: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      backgroundColor: 'white', borderRadius: '10px', padding: '18px', cursor: 'pointer',
      border: selected ? '2px solid #003366' : '2px solid transparent',
      boxShadow: '0 2px 6px rgba(0,0,0,0.07)', transition: 'all 0.15s',
    }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = '#ccc'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '18px' }}>{getGeschichteTypIcon(g.typ)}</span>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#003366' }}>{g.titel}</span>
          </div>
          <p style={{ fontSize: '13px', color: '#555', lineHeight: 1.5, margin: '0 0 10px 0' }}>{g.situation}</p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Tag color={getKategorieColor(g.kategorie)}>{getKategorieLabel(g.kategorie)}</Tag>
            <Tag color="#9C27B0">{getGeschichteTypLabel(g.typ)}</Tag>
          </div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right', fontSize: '10px', color: '#666' }}>
          <div>{g.oeffentlich ? '🌐 Öffentlich' : '🔒 Intern'}</div>
          <div style={{ marginTop: '4px' }}>{g.verwendetCount}× genutzt</div>
        </div>
      </div>
    </div>
  );
}

function GeschichteDetail({ g, onClose }: { g: MockGrenzgeschichte; onClose: () => void }) {
  const [toast, setToast] = useState<string | null>(null);
  const zeigeToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };
  return (
    <div style={{
      width: '400px', flexShrink: 0, backgroundColor: 'white', borderRadius: '10px',
      boxShadow: '0 2px 16px rgba(0,0,0,0.12)', alignSelf: 'flex-start', position: 'sticky', top: '20px',
      maxHeight: 'calc(100vh - 80px)', overflowY: 'auto', padding: '24px',
    }}>
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          backgroundColor: '#003366', color: 'white', padding: '14px 20px',
          borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: '14px', fontWeight: 600,
        }}>{toast}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '22px', marginBottom: '4px' }}>{getGeschichteTypIcon(g.typ)}</div>
          <h2 style={{ margin: 0, fontSize: '17px', color: '#003366' }}>{g.titel}</h2>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666' }}>×</button>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <Tag color={getKategorieColor(g.kategorie)}>{getKategorieLabel(g.kategorie)}</Tag>
        <Tag color="#9C27B0">{getGeschichteTypLabel(g.typ)}</Tag>
        <Tag color={getWissenStatusColor(g.status)}>{getWissenStatusLabel(g.status)}</Tag>
      </div>

      {!g.anonymisiert && (g.beteiligteFirma1 || g.beteiligteFirma2) && (
        <div style={{ backgroundColor: '#f9f9f9', borderRadius: '8px', padding: '10px', marginBottom: '14px', fontSize: '12px', color: '#666' }}>
          Beteiligt: {g.beteiligteFirma1} {g.beteiligteFirma2 ? `↔ ${g.beteiligteFirma2}` : ''}
        </div>
      )}

      <Block label="Situation" text={g.situation} />
      {g.verlauf && <Block label="Verlauf" text={g.verlauf} />}
      <Block label="💡 Erkenntnis" text={g.erkenntnis} bg="#e8f5e9" highlight />

      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: '8px' }}>Verwenden für</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {['📧 Newsletter', '💼 LinkedIn', '🌐 Website', '🎤 Event'].map(z => (
            <button key={z} onClick={() => zeigeToast(`Für ${z.split(' ')[1]} übernommen`)} style={{ padding: '8px', backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#444' }}>{z}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ANALYTICS ────────────────────────────────────────────────

function KulturAnalytics() {
  const alle = [...MOCK_KULTUR_MOMENTE, ...MOCK_GRENZGESCHICHTEN];
  const katCount: Record<string, number> = {};
  MOCK_KULTUR_MOMENTE.forEach(m => { katCount[m.kategorie] = (katCount[m.kategorie] || 0) + 1; });
  MOCK_GRENZGESCHICHTEN.forEach(g => { katCount[g.kategorie] = (katCount[g.kategorie] || 0) + 1; });

  const topGenutzt = [...MOCK_KULTUR_MOMENTE].sort((a, b) => b.verwendetCount - a.verwendetCount).slice(0, 5);
  const gesamtVerwendung = alle.reduce((s, x) => s + x.verwendetCount, 0);
  const oeffentlich = alle.filter(x => x.oeffentlich).length;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        {[
          { label: 'Kultur-Momente', value: MOCK_KULTUR_MOMENTE.length, color: '#003366' },
          { label: 'Grenzgeschichten', value: MOCK_GRENZGESCHICHTEN.length, color: '#9C27B0' },
          { label: '🌐 Öffentlich nutzbar', value: oeffentlich, color: '#4CAF50' },
          { label: 'Verwendungen gesamt', value: gesamtVerwendung, color: '#FF9900' },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: '12px', color: '#666' }}>{s.label}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: s.color, marginTop: '4px' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}>
          <h3 style={{ marginTop: 0, color: '#003366', fontSize: '15px', marginBottom: '16px' }}>Häufigste Kategorien</h3>
          {Object.entries(katCount).sort((a, b) => b[1] - a[1]).map(([kat, count]) => (
            <div key={kat} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '16px', minWidth: '20px' }}>{getKategorieIcon(kat)}</span>
              <span style={{ flex: 1, fontSize: '13px' }}>{getKategorieLabel(kat)}</span>
              <div style={{ width: '70px', height: '8px', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '4px', backgroundColor: getKategorieColor(kat), width: `${(count / alle.length) * 100}%` }} />
              </div>
              <span style={{ fontSize: '12px', color: '#666', minWidth: '20px' }}>{count}</span>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)' }}>
          <h3 style={{ marginTop: 0, color: '#003366', fontSize: '15px', marginBottom: '16px' }}>Meistgenutzte Inhalte</h3>
          {topGenutzt.map((m, i) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#999', minWidth: '18px' }}>#{i + 1}</span>
              <span style={{ fontSize: '16px' }}>{getKategorieIcon(m.kategorie)}</span>
              <span style={{ flex: 1, fontSize: '13px' }}>{m.titel}</span>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#FF9900' }}>{m.verwendetCount}×</span>
            </div>
          ))}
        </div>
      </div>

      {/* KI-Integration Hinweis */}
      <div style={{ marginTop: '24px', backgroundColor: '#e8f0fe', border: '1px solid #c5d3f0', borderRadius: '10px', padding: '20px' }}>
        <h3 style={{ marginTop: 0, color: '#003366', fontSize: '15px', marginBottom: '8px' }}>🤖 KI-Anbindung</h3>
        <p style={{ fontSize: '13px', color: '#3c4043', lineHeight: 1.6, margin: 0 }}>
          Diese Wissensbibliothek dient als Datenquelle für die KI-Zentrale. Bei einem Match zwischen einem deutschen und einem dänischen Unternehmen
          kann die KI automatisch passende Kultur-Momente in Intro-Mails, Cultural Briefings und Eventvorbereitungen einbinden.
          Je mehr dokumentiert wird, desto klüger werden die Vorschläge.
        </p>
      </div>
    </div>
  );
}

// ─── HILFSKOMPONENTEN ─────────────────────────────────────────

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ padding: '3px 9px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, backgroundColor: color + '20', color }}>{children}</span>;
}

function Block({ label, text, bg, highlight }: { label: string; text: string; bg?: string; highlight?: boolean }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: highlight ? '#2e7d32' : '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>{label}</div>
      <div style={{
        fontSize: '13px', color: '#333', lineHeight: 1.6,
        backgroundColor: bg || 'transparent',
        padding: bg ? '10px 12px' : '0',
        borderRadius: bg ? '6px' : '0',
        border: highlight ? '1px solid #a5d6a7' : 'none',
      }}>{text}</div>
    </div>
  );
}
