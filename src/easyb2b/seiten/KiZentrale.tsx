
import { useState } from 'react';
import { MOCK_ANFRAGEN, MOCK_UNTERNEHMEN } from '@easyb2b/lib/mockdata';
import {
  verbessereAnfrageMock, generiereIntroMailMock, formatIntroMail,
  generiereLinkedInPostMock, pruefeVoiceMock, generiereKulturTippsMock,
  analysiereMatchMock, KULTUR_HINWEISE_DATENBANK,
  type AnfrageVerbesserungResult, type IntroMailResult,
  type LinkedInResult, type VoiceCheckResult, type MatchAnalyseResult,
} from '@easyb2b/lib/ki';

type Tool = 'home' | 'anfrage' | 'mail' | 'linkedin' | 'voice' | 'kultur' | 'matching';

const TOOLS = [
  { id: 'anfrage' as Tool, icon: '📝', label: 'Anfrage verbessern', beschreibung: 'Aus Rohtext eine strukturierte Anfrage erstellen' },
  { id: 'mail' as Tool, icon: '📧', label: 'Intro-Mail', beschreibung: 'Einführungsmail für zwei Unternehmen (DE/DK/EN)' },
  { id: 'linkedin' as Tool, icon: '💼', label: 'LinkedIn-Post', beschreibung: 'Beitrag aus Anfrage, Event oder Story erstellen' },
  { id: 'voice' as Tool, icon: '🎙', label: 'Voice-Check', beschreibung: 'Prüft ob Text zur Easy-B2B-Stimme passt' },
  { id: 'kultur' as Tool, icon: '🌍', label: 'Kultur-Assistent', beschreibung: 'Deutsch-dänische Kulturhinweise für Meetings' },
  { id: 'matching' as Tool, icon: '🎯', label: 'Matching-Assistent', beschreibung: 'Analysiert ob zwei Unternehmen zusammenpassen' },
];

export default function KiZentralePage() {
  const [activeTool, setActiveTool] = useState<Tool>('home');
  const [laedt, setLaedt] = useState(false);

  const renderTool = () => {
    const props = { laedt, setLaedt };
    switch (activeTool) {
      case 'anfrage': return <ToolAnfrage {...props} />;
      case 'mail': return <ToolIntroMail {...props} />;
      case 'linkedin': return <ToolLinkedIn {...props} />;
      case 'voice': return <ToolVoiceCheck {...props} />;
      case 'kultur': return <ToolKultur {...props} />;
      case 'matching': return <ToolMatching {...props} />;
      default: return <KiHome onSelectTool={setActiveTool} />;
    }
  };

  return (
    <div style={{ display: 'flex', gap: '0', minHeight: 'calc(100vh - 40px)' }}>
      {/* ── LINKE SIDEBAR ── */}
      <div style={{ width: '220px', flexShrink: 0, borderRight: '1px solid #e0e0e0', paddingRight: '20px', marginRight: '28px' }}>
        <h2 style={{ margin: '0 0 4px 0', color: '#003366', fontSize: '18px' }}>KI-Zentrale</h2>
        <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: '#666' }}>Operator-Assistent</p>

        <button onClick={() => setActiveTool('home')} style={{
          width: '100%', padding: '10px 14px', marginBottom: '4px', borderRadius: '6px',
          border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: 600,
          backgroundColor: activeTool === 'home' ? '#003366' : 'transparent',
          color: activeTool === 'home' ? 'white' : '#666',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          🏠 Übersicht
        </button>

        <div style={{ height: '1px', backgroundColor: '#f0f0f0', margin: '8px 0 10px 0' }} />

        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTool(t.id)}
            style={{
              width: '100%', padding: '10px 14px', marginBottom: '4px', borderRadius: '6px',
              border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '13px',
              backgroundColor: activeTool === t.id ? '#003366' : 'transparent',
              color: activeTool === t.id ? 'white' : '#444',
              display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (activeTool !== t.id) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f5f5f5'; }}
            onMouseLeave={e => { if (activeTool !== t.id) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
          >
            <span style={{ fontSize: '16px' }}>{t.icon}</span>
            <span style={{ fontWeight: activeTool === t.id ? 600 : 400 }}>{t.label}</span>
          </button>
        ))}

        {/* API Hinweis */}
        <div style={{ marginTop: '24px', padding: '12px', backgroundColor: '#e8f0fe', borderRadius: '8px', fontSize: '11px', color: '#3c4043' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>🔌 API-Status</div>
          <div>Mock-Modus aktiv</div>
          <div style={{ color: '#666', marginTop: '4px' }}>Anthropic Claude API bereit zur Integration</div>
        </div>
      </div>

      {/* ── HAUPTBEREICH ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {renderTool()}
      </div>
    </div>
  );
}

// ─── HOME ─────────────────────────────────────────────────────

function KiHome({ onSelectTool }: { onSelectTool: (t: Tool) => void }) {
  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: '0 0 8px 0', color: '#003366', fontSize: '24px' }}>Willkommen, Operator 👋</h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#555', lineHeight: 1.6 }}>
          Hier sind alle KI-Werkzeuge gebündelt. Wähle ein Tool, gib deine Daten ein und lass die KI einen ersten Entwurf erstellen.
          Du behältst die Kontrolle — die KI bereitet vor, du entscheidest.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {TOOLS.map(t => (
          <div
            key={t.id}
            onClick={() => onSelectTool(t.id)}
            style={{
              backgroundColor: 'white', borderRadius: '10px', padding: '20px',
              cursor: 'pointer', border: '2px solid transparent',
              boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.borderColor = '#003366';
              el.style.boxShadow = '0 4px 12px rgba(0,51,102,0.12)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.borderColor = 'transparent';
              el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)';
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>{t.icon}</div>
            <h3 style={{ margin: '0 0 6px 0', color: '#003366', fontSize: '16px' }}>{t.label}</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#666', lineHeight: 1.5 }}>{t.beschreibung}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '32px', backgroundColor: '#f9f9f9', borderRadius: '10px', padding: '20px', border: '1px solid #e0e0e0' }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#003366', fontSize: '15px' }}>💡 Nutzungshinweis</h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#555', lineHeight: 1.7 }}>
          Alle Ergebnisse sind Entwürfe. Immer nochmals prüfen, bevor etwas veröffentlicht oder versandt wird.
          Die KI kennt das Easy-B2B-Konzept und hält sich an die Sprachregeln — aber du kennst die Menschen dahinter.
        </p>
      </div>
    </div>
  );
}

// ─── TOOL: ANFRAGE VERBESSERN ─────────────────────────────────

function ToolAnfrage({ laedt, setLaedt }: ToolProps) {
  const [rohtext, setRohtext] = useState('');
  const [branche, setBranche] = useState('');
  const [richtung, setRichtung] = useState('dk_de');
  const [ergebnis, setErgebnis] = useState<AnfrageVerbesserungResult | null>(null);
  const [ausAnfrage, setAusAnfrage] = useState('');

  const handleGenerieren = async () => {
    if (!rohtext.trim()) return;
    setLaedt(true);
    const result = await verbessereAnfrageMock(rohtext, branche || 'Allgemein', richtung);
    setErgebnis(result);
    setLaedt(false);
  };

  const handleAusAnfrageLaden = () => {
    const a = MOCK_ANFRAGEN.find(a => a.id === ausAnfrage);
    if (a) {
      setRohtext(a.beschreibung);
      setBranche(a.branche);
      setRichtung(a.richtung);
    }
  };

  return (
    <ToolLayout icon="📝" titel="Anfrage verbessern" beschreibung="Aus einer Rohfassung eine strukturierte Easy-B2B-Anfrage erstellen.">
      {/* Aus bestehender Anfrage laden */}
      <div style={{ backgroundColor: '#e8f0fe', borderRadius: '8px', padding: '12px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: '#003366', fontWeight: 600 }}>Aus Anfrage laden:</span>
        <select value={ausAnfrage} onChange={e => setAusAnfrage(e.target.value)}
          style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #c5d3f0', fontSize: '13px' }}>
          <option value="">— Anfrage wählen —</option>
          {MOCK_ANFRAGEN.map(a => <option key={a.id} value={a.id}>{a.firmenname} ({a.anzeigenId})</option>)}
        </select>
        <button onClick={handleAusAnfrageLaden} disabled={!ausAnfrage}
          style={{ padding: '6px 14px', backgroundColor: '#003366', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
          Laden
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label style={labelStyle}>Branche</label>
          <input value={branche} onChange={e => setBranche(e.target.value)}
            placeholder="z.B. Lebensmittel, Maschinenbau..." style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Richtung</label>
          <select value={richtung} onChange={e => setRichtung(e.target.value)} style={inputStyle}>
            <option value="dk_de">Dänemark → Deutschland</option>
            <option value="de_dk">Deutschland → Dänemark</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Rohtext / Beschreibung</label>
        <textarea
          value={rohtext}
          onChange={e => setRohtext(e.target.value)}
          placeholder="Schreib hier, was das Unternehmen sucht — auch als Stichwörter oder unstrukturiert..."
          rows={5}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      <KiButton onClick={handleGenerieren} laedt={laedt} disabled={!rohtext.trim()}>
        ✨ Anfrage strukturieren
      </KiButton>

      {ergebnis && !laedt && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#003366', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>Ergebnis</div>
          {[
            { label: 'Ziel', value: ergebnis.ziel },
            { label: 'Ausgangssituation', value: ergebnis.ausgangssituation },
            { label: 'Gesuch', value: ergebnis.gesuch },
            { label: 'Was wir mitbringen', value: ergebnis.mitbringen },
            { label: 'Must-Haves', value: ergebnis.mustHaves },
          ].map(f => (
            <div key={f.label} style={{ marginBottom: '14px' }}>
              <div style={ergebnisLabelStyle}>{f.label}</div>
              <div style={ergebnisTextStyle}>{f.value}</div>
            </div>
          ))}
          <div style={{ marginBottom: '14px' }}>
            <div style={ergebnisLabelStyle}>🌐 Marktplatz-Version</div>
            <div style={{ ...ergebnisTextStyle, backgroundColor: '#e8f5e9', borderColor: '#a5d6a7', color: '#2e7d32', fontWeight: 500 }}>
              {ergebnis.marktplatzVersion}
            </div>
          </div>
          <div>
            <div style={ergebnisLabelStyle}>🔒 Interne Notiz</div>
            <div style={{ ...ergebnisTextStyle, backgroundColor: '#fffde7', borderColor: '#fff176' }}>{ergebnis.interneVersion}</div>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}

// ─── TOOL: INTRO-MAIL ─────────────────────────────────────────

function ToolIntroMail({ laedt, setLaedt }: ToolProps) {
  const [firma1, setFirma1] = useState('');
  const [firma2, setFirma2] = useState('');
  const [kontext, setKontext] = useState('');
  const [funFact, setFunFact] = useState('');
  const [sprache, setSprache] = useState<'de' | 'dk' | 'en'>('de');
  const [ergebnis, setErgebnis] = useState<IntroMailResult | null>(null);

  const handleGenerieren = async () => {
    if (!firma1 || !firma2) return;
    setLaedt(true);
    const result = await generiereIntroMailMock(firma1, firma2, kontext, sprache, funFact || undefined);
    setErgebnis(result);
    setLaedt(false);
  };

  // Felder aus Mock-Daten befüllen
  const unternehmenOptions = MOCK_UNTERNEHMEN.map(u => ({ id: u.id, label: `${u.firmenname} (${u.land})` }));

  return (
    <ToolLayout icon="📧" titel="Intro-Mail Generator" beschreibung="Einführungsmail für zwei vermittelte Unternehmen in drei Sprachen.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label style={labelStyle}>Unternehmen 1 (Suchender)</label>
          <input value={firma1} onChange={e => setFirma1(e.target.value)} placeholder="Firmenname..." style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Unternehmen 2 (Interessent)</label>
          <input value={firma2} onChange={e => setFirma2(e.target.value)} placeholder="Firmenname..." style={inputStyle} />
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Kontext / Warum passen sie zusammen?</label>
        <textarea value={kontext} onChange={e => setKontext(e.target.value)}
          placeholder="Ein paar Sätze, warum diese Verbindung sinnvoll ist..."
          rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div>
          <label style={labelStyle}>FunFact (optional)</label>
          <input value={funFact} onChange={e => setFunFact(e.target.value)} placeholder="Persönliche Note..." style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Sprache</label>
          <select value={sprache} onChange={e => setSprache(e.target.value as 'de' | 'dk' | 'en')} style={inputStyle}>
            <option value="de">Deutsch</option>
            <option value="dk">Dänisch</option>
            <option value="en">Englisch</option>
          </select>
        </div>
      </div>

      <KiButton onClick={handleGenerieren} laedt={laedt} disabled={!firma1 || !firma2}>
        ✨ Intro-Mail erstellen
      </KiButton>

      {ergebnis && !laedt && (
        <div style={{ marginTop: '24px', backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', fontFamily: 'Georgia, serif' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#003366', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'system-ui' }}>
            Ergebnis ({sprache.toUpperCase()})
          </div>
          <div style={{ fontSize: '13px', lineHeight: 1.9, whiteSpace: 'pre-wrap', color: '#333' }}>
            {formatIntroMail(ergebnis)}
          </div>
          <button onClick={() => navigator.clipboard?.writeText(formatIntroMail(ergebnis))}
            style={{ marginTop: '14px', padding: '8px 16px', backgroundColor: 'transparent', color: '#003366', border: '1px solid #003366', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
            📋 Kopieren
          </button>
        </div>
      )}
    </ToolLayout>
  );
}

// ─── TOOL: LINKEDIN ───────────────────────────────────────────

function ToolLinkedIn({ laedt, setLaedt }: ToolProps) {
  const [inhalt, setInhalt] = useState('');
  const [typ, setTyp] = useState('anfrage');
  const [stil, setStil] = useState<'kurz' | 'standard' | 'story'>('standard');
  const [ergebnis, setErgebnis] = useState<LinkedInResult | null>(null);

  const handleGenerieren = async () => {
    if (!inhalt.trim()) return;
    setLaedt(true);
    const result = await generiereLinkedInPostMock(inhalt, typ, stil);
    setErgebnis(result);
    setLaedt(false);
  };

  return (
    <ToolLayout icon="💼" titel="LinkedIn-Post Generator" beschreibung="Aus beliebigen Inhalten einen Easy-B2B-konformen LinkedIn-Beitrag erstellen.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <label style={labelStyle}>Beitrags-Typ</label>
          <select value={typ} onChange={e => setTyp(e.target.value)} style={inputStyle}>
            <option value="anfrage">Anfrage/Match</option>
            <option value="event">Event</option>
            <option value="story">Success Story</option>
            <option value="netzwerk">Netzwerk</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Stil</label>
          <select value={stil} onChange={e => setStil(e.target.value as 'kurz' | 'standard' | 'story')} style={inputStyle}>
            <option value="kurz">Kurz (3-4 Sätze)</option>
            <option value="standard">Standard (6-8 Sätze)</option>
            <option value="story">Story (emotional, länger)</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Inhalt / Kernaussage</label>
        <textarea value={inhalt} onChange={e => setInhalt(e.target.value)}
          placeholder="Was ist die Geschichte? Was ist passiert? Was soll die Kernaussage sein?"
          rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      <KiButton onClick={handleGenerieren} laedt={laedt} disabled={!inhalt.trim()}>
        ✨ LinkedIn-Post erstellen
      </KiButton>

      {ergebnis && !laedt && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ backgroundColor: '#f0f4ff', border: '1px solid #c5d3f0', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#003366', marginBottom: '10px', textTransform: 'uppercase' }}>
              Post ({ergebnis.zeichenAnzahl} Zeichen)
            </div>
            <div style={{ fontSize: '14px', lineHeight: 1.8, whiteSpace: 'pre-wrap', color: '#333' }}>
              {ergebnis.text}
            </div>
            {ergebnis.hashtags.length > 0 && (
              <div style={{ marginTop: '10px', fontSize: '13px', color: '#1a73e8' }}>
                {ergebnis.hashtags.join(' ')}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => navigator.clipboard?.writeText(ergebnis.text + (ergebnis.hashtags.length ? '\n\n' + ergebnis.hashtags.join(' ') : ''))}
              style={{ padding: '8px 14px', backgroundColor: '#003366', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
              📋 Kopieren
            </button>
            <div style={{ fontSize: '12px', color: ergebnis.zeichenAnzahl > 2000 ? '#f44336' : '#4CAF50', alignSelf: 'center' }}>
              {ergebnis.zeichenAnzahl > 2000 ? '⚠️ Zu lang für LinkedIn' : '✓ LinkedIn-Limit ok'}
            </div>
          </div>
        </div>
      )}
    </ToolLayout>
  );
}

// ─── TOOL: VOICE CHECK ────────────────────────────────────────

function ToolVoiceCheck({ laedt, setLaedt }: ToolProps) {
  const [text, setText] = useState('');
  const [ergebnis, setErgebnis] = useState<VoiceCheckResult | null>(null);

  const handlePruefen = async () => {
    if (!text.trim()) return;
    setLaedt(true);
    const result = await pruefeVoiceMock(text);
    setErgebnis(result);
    setLaedt(false);
  };

  const schwereColor = { leicht: '#FF9900', mittel: '#FF5722', schwer: '#f44336' } as const;

  return (
    <ToolLayout icon="🎙" titel="Voice-Check" beschreibung="Prüft ob ein Text zur Easy-B2B-Stimme passt. Markiert Buzzwords, Marketing-Deutsch und Ich-Fokus.">
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Text zum Prüfen</label>
        <textarea value={text} onChange={e => setText(e.target.value)}
          placeholder="Füge hier einen Text ein — z.B. Marktplatz-Text, E-Mail, Social Media Post..."
          rows={6} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      <KiButton onClick={handlePruefen} laedt={laedt} disabled={!text.trim()}>
        🎙 Voice prüfen
      </KiButton>

      {ergebnis && !laedt && (
        <div style={{ marginTop: '24px' }}>
          {/* Score */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px', padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '10px' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              backgroundColor: ergebnis.score >= 80 ? '#e8f5e9' : ergebnis.score >= 60 ? '#fff3e0' : '#fce4ec',
              border: `3px solid ${ergebnis.score >= 80 ? '#4CAF50' : ergebnis.score >= 60 ? '#FF9900' : '#f44336'}`,
              flexShrink: 0,
            }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: ergebnis.score >= 80 ? '#2e7d32' : ergebnis.score >= 60 ? '#e65100' : '#c62828', lineHeight: 1 }}>{ergebnis.score}</div>
              <div style={{ fontSize: '10px', color: '#666' }}>/ 100</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#003366', marginBottom: '4px' }}>
                {ergebnis.score >= 80 ? '✅ Gut!' : ergebnis.score >= 60 ? '⚠️ Überarbeitbar' : '🚫 Überarbeitung nötig'}
              </div>
              <div style={{ fontSize: '13px', color: '#555' }}>{ergebnis.empfehlung}</div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>{ergebnis.wortanzahl} Wörter · {ergebnis.probleme.length} Problem(e) gefunden</div>
            </div>
          </div>

          {/* Probleme */}
          {ergebnis.probleme.length > 0 && (
            <div>
              <div style={ergebnisLabelStyle}>Gefundene Probleme</div>
              {ergebnis.probleme.map((p, i) => (
                <div key={i} style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '8px', backgroundColor: '#fafafa', border: `1px solid ${schwereColor[p.schwere]}30`, borderLeft: `4px solid ${schwereColor[p.schwere]}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#333' }}>{p.text}</span>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: schwereColor[p.schwere], textTransform: 'uppercase' }}>{p.schwere}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>→ {p.vorschlag}</div>
                </div>
              ))}
            </div>
          )}

          {ergebnis.probleme.length === 0 && (
            <div style={{ padding: '16px', backgroundColor: '#e8f5e9', borderRadius: '8px', textAlign: 'center', color: '#2e7d32', fontWeight: 600 }}>
              ✅ Kein Problem gefunden. Text klingt nach Easy-B2B!
            </div>
          )}
        </div>
      )}
    </ToolLayout>
  );
}

// ─── TOOL: KULTUR-ASSISTENT ───────────────────────────────────

function ToolKultur({ laedt, setLaedt }: ToolProps) {
  const [kontext, setKontext] = useState('');
  const [selectedKats, setSelectedKats] = useState<string[]>([]);
  const [ergebnis, setErgebnis] = useState<any | null>(null);

  const handleGenerieren = async () => {
    setLaedt(true);
    const result = await generiereKulturTippsMock(kontext, selectedKats);
    setErgebnis(result);
    setLaedt(false);
  };

  const alleKats = KULTUR_HINWEISE_DATENBANK.map(k => k.kategorie);

  const toggleKat = (kat: string) => {
    setSelectedKats(prev => prev.includes(kat) ? prev.filter(k => k !== kat) : [...prev, kat]);
  };

  return (
    <ToolLayout icon="🌍" titel="Kultur-Assistent" beschreibung="Deutsch-dänische Kulturhinweise für Meetings, Kommunikation und Zusammenarbeit.">
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Kontext (optional)</label>
        <input value={kontext} onChange={e => setKontext(e.target.value)}
          placeholder="z.B. Erstes Meeting, Vertragsverhandlung, E-Mail-Abstimmung..." style={inputStyle} />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Themen wählen (leer = alle)</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {alleKats.map(kat => (
            <button key={kat} onClick={() => toggleKat(kat)} style={{
              padding: '6px 12px', borderRadius: '20px', border: '1px solid',
              cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
              borderColor: selectedKats.includes(kat) ? '#003366' : '#ddd',
              backgroundColor: selectedKats.includes(kat) ? '#003366' : 'white',
              color: selectedKats.includes(kat) ? 'white' : '#666',
            }}>
              {KULTUR_HINWEISE_DATENBANK.find(k => k.kategorie === kat)?.icon} {kat}
            </button>
          ))}
        </div>
      </div>

      <KiButton onClick={handleGenerieren} laedt={laedt}>
        🌍 Kulturhinweise laden
      </KiButton>

      {ergebnis && !laedt && (
        <div style={{ marginTop: '24px' }}>
          {ergebnis.hinweise.map((h: any) => (
            <div key={h.kategorie} style={{ backgroundColor: '#f9f9f9', borderRadius: '10px', padding: '16px', marginBottom: '12px', border: '1px solid #eee' }}>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#003366', marginBottom: '12px' }}>
                {h.icon} {h.kategorie}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div style={{ backgroundColor: '#e3f2fd', borderRadius: '6px', padding: '10px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#1565c0', marginBottom: '4px', textTransform: 'uppercase' }}>🇩🇪 DEUTSCH</div>
                  <div style={{ fontSize: '12px', color: '#333', lineHeight: 1.5 }}>{h.deutsch}</div>
                </div>
                <div style={{ backgroundColor: '#fce4ec', borderRadius: '6px', padding: '10px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#880e4f', marginBottom: '4px', textTransform: 'uppercase' }}>🇩🇰 DÄNISCH</div>
                  <div style={{ fontSize: '12px', color: '#333', lineHeight: 1.5 }}>{h.daenisch}</div>
                </div>
              </div>
              <div style={{ backgroundColor: '#e8f5e9', borderRadius: '6px', padding: '10px', border: '1px solid #a5d6a7' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#2e7d32', marginBottom: '4px', textTransform: 'uppercase' }}>💡 Praxis-Tipp</div>
                <div style={{ fontSize: '13px', color: '#2e7d32', lineHeight: 1.5 }}>{h.tipp}</div>
              </div>
            </div>
          ))}
          {ergebnis.gesamtempfehlung && (
            <div style={{ backgroundColor: '#e8f0fe', border: '1px solid #c5d3f0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#003366', marginBottom: '6px', textTransform: 'uppercase' }}>Gesamtempfehlung</div>
              <div style={{ fontSize: '13px', color: '#003366', lineHeight: 1.6 }}>{ergebnis.gesamtempfehlung}</div>
            </div>
          )}
        </div>
      )}
    </ToolLayout>
  );
}

// ─── TOOL: MATCHING-ASSISTENT ─────────────────────────────────

function ToolMatching({ laedt, setLaedt }: ToolProps) {
  const [firma1, setFirma1] = useState('');
  const [branche1, setBranche1] = useState('');
  const [gesuch1, setGesuch1] = useState('');
  const [firma2, setFirma2] = useState('');
  const [branche2, setBranche2] = useState('');
  const [angebot2, setAngebot2] = useState('');
  const [ergebnis, setErgebnis] = useState<MatchAnalyseResult | null>(null);

  // Aus Mock-Daten befüllen
  const handleLadeFirma = (firmaId: string, slot: 1 | 2) => {
    const u = MOCK_UNTERNEHMEN.find(u => u.id === firmaId);
    if (!u) return;
    if (slot === 1) { setFirma1(u.firmenname); setBranche1(u.branche || ''); setGesuch1(u.kurzbeschreibung); }
    else { setFirma2(u.firmenname); setBranche2(u.branche || ''); setAngebot2(u.kurzbeschreibung); }
  };

  const handleAnalysieren = async () => {
    if (!firma1 || !firma2) return;
    setLaedt(true);
    const result = await analysiereMatchMock(firma1, branche1, gesuch1, firma2, branche2, angebot2);
    setErgebnis(result);
    setLaedt(false);
  };

  const levelColors = { mittel: '#FF9900', stark: '#4CAF50', sehr_stark: '#2e7d32' };

  return (
    <ToolLayout icon="🎯" titel="Matching-Assistent" beschreibung="Analysiert ob zwei Unternehmen zusammenpassen. Liefert Stärken, Risiken und Gesprächseinstiege.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '20px' }}>
        {/* Firma 1 */}
        <div style={{ backgroundColor: '#e3f2fd', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#1565c0', marginBottom: '12px', textTransform: 'uppercase' }}>🇩🇪/🇩🇰 Unternehmen 1</div>
          <select onChange={e => handleLadeFirma(e.target.value, 1)}
            style={{ ...inputStyle, backgroundColor: 'white', marginBottom: '8px' }}>
            <option value="">Aus System laden...</option>
            {MOCK_UNTERNEHMEN.map(u => <option key={u.id} value={u.id}>{u.firmenname}</option>)}
          </select>
          <input value={firma1} onChange={e => setFirma1(e.target.value)} placeholder="Firmenname" style={{ ...inputStyle, marginBottom: '8px', backgroundColor: 'white' }} />
          <input value={branche1} onChange={e => setBranche1(e.target.value)} placeholder="Branche" style={{ ...inputStyle, marginBottom: '8px', backgroundColor: 'white' }} />
          <input value={gesuch1} onChange={e => setGesuch1(e.target.value)} placeholder="Was suchen sie?" style={{ ...inputStyle, backgroundColor: 'white' }} />
        </div>

        {/* Firma 2 */}
        <div style={{ backgroundColor: '#fce4ec', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#880e4f', marginBottom: '12px', textTransform: 'uppercase' }}>🇩🇰/🇩🇪 Unternehmen 2</div>
          <select onChange={e => handleLadeFirma(e.target.value, 2)}
            style={{ ...inputStyle, backgroundColor: 'white', marginBottom: '8px' }}>
            <option value="">Aus System laden...</option>
            {MOCK_UNTERNEHMEN.map(u => <option key={u.id} value={u.id}>{u.firmenname}</option>)}
          </select>
          <input value={firma2} onChange={e => setFirma2(e.target.value)} placeholder="Firmenname" style={{ ...inputStyle, marginBottom: '8px', backgroundColor: 'white' }} />
          <input value={branche2} onChange={e => setBranche2(e.target.value)} placeholder="Branche" style={{ ...inputStyle, marginBottom: '8px', backgroundColor: 'white' }} />
          <input value={angebot2} onChange={e => setAngebot2(e.target.value)} placeholder="Was bieten sie?" style={{ ...inputStyle, backgroundColor: 'white' }} />
        </div>
      </div>

      <KiButton onClick={handleAnalysieren} laedt={laedt} disabled={!firma1 || !firma2}>
        🎯 Match analysieren
      </KiButton>

      {ergebnis && !laedt && (
        <div style={{ marginTop: '24px' }}>
          {/* Match Score */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '20px', padding: '16px',
            backgroundColor: levelColors[ergebnis.level] + '15',
            border: `2px solid ${levelColors[ergebnis.level]}40`, borderRadius: '10px', marginBottom: '20px',
          }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'white', border: `3px solid ${levelColors[ergebnis.level]}`,
            }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: levelColors[ergebnis.level], lineHeight: 1 }}>{ergebnis.score}</div>
              <div style={{ fontSize: '10px', color: '#666' }}>%</div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '17px', color: levelColors[ergebnis.level] }}>
                {ergebnis.level === 'sehr_stark' ? '🎯 Sehr starker Match' : ergebnis.level === 'stark' ? '✅ Starker Match' : '🔍 Möglicher Match'}
              </div>
              <div style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>{ergebnis.empfehlung}</div>
            </div>
          </div>

          {/* Details */}
          {[
            { icon: '✅', label: 'Stärken', items: ergebnis.staerken, color: '#4CAF50' },
            { icon: '⚠️', label: 'Risiken', items: ergebnis.risiken, color: '#FF9900' },
            { icon: '💬', label: 'Gesprächseinstiege', items: ergebnis.gespraechseinstiege, color: '#2196F3' },
            { icon: '💡', label: 'Mögliche Synergien', items: ergebnis.synergien, color: '#9C27B0' },
          ].map(s => (
            <div key={s.label} style={{ marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: s.color, marginBottom: '8px' }}>{s.icon} {s.label}</div>
              {s.items.map((item, i) => (
                <div key={i} style={{ padding: '8px 12px', backgroundColor: s.color + '10', borderLeft: `3px solid ${s.color}`, borderRadius: '4px', fontSize: '13px', color: '#444', marginBottom: '6px', lineHeight: 1.5 }}>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </ToolLayout>
  );
}

// ─── LAYOUT & SHARED COMPONENTS ──────────────────────────────

interface ToolProps { laedt: boolean; setLaedt: (v: boolean) => void; }

function ToolLayout({ icon, titel, beschreibung, children }: { icon: string; titel: string; beschreibung: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: '0 0 4px 0', color: '#003366', fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>{icon}</span>{titel}
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>{beschreibung}</p>
      </div>
      {children}
    </div>
  );
}

function KiButton({ onClick, laedt, disabled, children }: { onClick: () => void; laedt: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={laedt || disabled}
      style={{
        padding: '12px 24px', fontSize: '14px', fontWeight: 700,
        backgroundColor: laedt || disabled ? '#ccc' : '#003366',
        color: 'white', border: 'none', borderRadius: '8px',
        cursor: laedt || disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', gap: '8px',
        transition: 'background-color 0.2s',
      }}
      onMouseEnter={e => { if (!laedt && !disabled) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#001a4d'; }}
      onMouseLeave={e => { if (!laedt && !disabled) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#003366'; }}
    >
      {laedt ? (
        <>
          <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
          KI denkt nach...
        </>
      ) : children}
    </button>
  );
}

// ─── SHARED STYLES ────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 600, color: '#555',
  marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #ddd',
  borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const ergebnisLabelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase',
  letterSpacing: '0.5px', marginBottom: '5px',
};

const ergebnisTextStyle: React.CSSProperties = {
  fontSize: '13px', color: '#333', lineHeight: 1.6,
  backgroundColor: '#f9f9f9', padding: '10px 14px',
  borderRadius: '6px', border: '1px solid #eee',
};
