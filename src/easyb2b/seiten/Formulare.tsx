
import { useState } from 'react';
import { useStore, neueEntityId } from '@easyb2b/lib/store';
import {
  FRAGETYP_OPTIONEN, getFrageTypLabel, ALLE_PLATZHALTER,
  MATCHMAIL_TYP_LABELS, MATCHMAIL_TYP_ICONS,
  type FormularVorlage, type FormularFrage, type FormularTyp, type FrageTyp,
  type MatchmailVorlage, type MatchmailTyp, type MatchmailButton,
} from '@easyb2b/lib/mockdata';
import { schlageBranchenFragenVor, pruefeFormular, type FormularPruefErgebnis } from '@easyb2b/lib/formulare';

type HauptTab = FormularTyp | 'branchen' | 'matchmaking';

export default function FormularePage() {
  const store = useStore();
  const [tab, setTab] = useState<HauptTab>('anfrage');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [neuOffen, setNeuOffen] = useState(false);

  const zeigeToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  // Formulare-Listen
  const liste = tab === 'branchen'
    ? store.formulare.filter(f => !!f.branche)
    : tab === 'matchmaking'
    ? []
    : store.formulare.filter(f => f.typ === tab);

  const selected = selectedId ? store.formulare.find(f => f.id === selectedId) : null;
  const selectedMail = selectedMailId ? store.matchmailVorlagen.find(v => v.id === selectedMailId) : null;

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, backgroundColor: 'var(--accent)', color: 'white', padding: '14px 20px', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: '14px', fontWeight: 600 }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--text)', fontSize: '24px' }}>Formulare & Vorlagen</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
            Verwaltbare Vorlagen für Anfragen, Interessenten und Matchmaking-Kommunikation. Bessere Vorlagen → bessere Prozesse.
          </p>
        </div>
        {tab !== 'matchmaking' && (
          <button onClick={() => setNeuOffen(true)} style={{ padding: '10px 18px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, flexShrink: 0 }}>
            + Neue Vorlage
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', margin: '20px 0' }}>
        {([
          ['anfrage', '📋 Anfrageformulare'],
          ['interessent', '👥 Interessentenformulare'],
          ['branchen', '🏷 Branchenvorlagen'],
          ['matchmaking', '🎯 Matchmaking-Vorlagen'],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setSelectedId(null); setSelectedMailId(null); }} style={{
            padding: '10px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            backgroundColor: tab === id ? (id === 'matchmaking' ? '#0a3d2e' : 'var(--accent)') : '#f0f0f0',
            color: tab === id ? 'white' : '#666',
          }}>
            {label}
            {id === 'matchmaking' && (
              <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, backgroundColor: tab === id ? 'rgba(255,255,255,0.2)' : '#e8f5e9', color: tab === id ? 'white' : '#2e7d32' }}>
                {store.matchmailVorlagen.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Matchmaking-Vorlagen Tab */}
      {tab === 'matchmaking' ? (
        <MatchmakingVorlagenTab
          vorlagen={store.matchmailVorlagen}
          selectedId={selectedMailId}
          onSelect={setSelectedMailId}
          onUpdate={(id, patch) => { store.updateMatchmailVorlage(id, patch); zeigeToast('Vorlage gespeichert ✓'); }}
          onToast={zeigeToast}
        />
      ) : (
        /* Formulare Tabs (bestehend) */
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          {/* LISTE */}
          <div style={{ width: selected ? '320px' : '100%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {liste.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#666', fontSize: '14px', backgroundColor: 'white', borderRadius: '8px' }}>
                Keine Vorlagen. Lege eine neue an.
              </div>
            ) : liste.map(f => (
              <div key={f.id} onClick={() => setSelectedId(f.id)} style={{
                backgroundColor: selectedId === f.id ? '#f0f4ff' : 'white', borderRadius: '10px', padding: '16px', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)', borderLeft: `4px solid ${f.istStandard ? '#4CAF50' : '#9C27B0'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>{f.name}</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '3px' }}>
                      {f.typ === 'anfrage' ? '📋 Anfrage' : '👥 Interessent'} · {f.fragen.length} Fragen
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end', flexShrink: 0 }}>
                    {f.istStandard && <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, backgroundColor: '#e8f5e9', color: '#2e7d32' }}>STANDARD</span>}
                    {f.branche && <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, backgroundColor: '#f3e5f5', color: '#6a1b9a' }}>{f.branche}</span>}
                    {!f.aktiv && <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, backgroundColor: '#e8e8e8', color: '#444' }}>inaktiv</span>}
                  </div>
                </div>
                {f.beschreibung && <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>{f.beschreibung}</div>}
              </div>
            ))}
          </div>

          {/* EDITOR */}
          {selected && (
            <FormularEditor
              key={selected.id}
              formular={selected}
              store={store}
              onClose={() => setSelectedId(null)}
              onToast={zeigeToast}
            />
          )}
        </div>
      )}

      {/* Neue Vorlage Modal */}
      {neuOffen && (
        <NeueVorlageModal
          onClose={() => setNeuOffen(false)}
          onErstellen={(name, typ, branche) => {
            const neu: FormularVorlage = {
              id: neueEntityId('form'),
              name, typ, branche: branche || undefined,
              istStandard: false, beschreibung: '',
              fragen: [], aktiv: true,
              createdAt: new Date().toISOString().split('T')[0],
            };
            store.addFormular(neu);
            store.logge(`Formular-Vorlage angelegt: ${name}`, name, 'anlegen');
            setNeuOffen(false);
            setTab(typ);
            setSelectedId(neu.id);
            zeigeToast('Vorlage angelegt — jetzt Fragen hinzufügen');
          }}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// MATCHMAKING-VORLAGEN TAB
// ═════════════════════════════════════════════════════════════════

function MatchmakingVorlagenTab({ vorlagen, selectedId, onSelect, onUpdate, onToast }: {
  vorlagen: MatchmailVorlage[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<MatchmailVorlage>) => void;
  onToast: (m: string) => void;
}) {
  const selected = selectedId ? vorlagen.find(v => v.id === selectedId) : null;

  // Prozessübersicht zeigen wenn nichts selektiert
  if (!selected) {
    return (
      <div>
        {/* Prozess-Übersicht */}
        <div style={{ marginBottom: '24px', padding: '20px 24px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', color: '#0a3d2e' }}>🔄 So läuft der Matchmaking-Prozess</h3>
          <div style={{ display: 'flex', gap: '0', alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { icon: '🎯', label: 'Match-Vorschlag', sub: 'an Suchenden + Interessenten' },
              { icon: '⏳', label: 'Warten auf Zustimmung', sub: 'ggf. Erinnerung' },
              { icon: '✅', label: 'Beide zugestimmt', sub: 'Bestätigung' },
              { icon: '📦', label: 'Kontaktfreigabe', sub: 'Match-Paket mit Daten' },
              { icon: '📞', label: 'Erstkontakt', sub: 'ggf. Erinnerung' },
              { icon: '⭐', label: 'Abgeschlossen', sub: 'Feedback' },
            ].map((step, i, arr) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ textAlign: 'center', padding: '10px 14px' }}>
                  <div style={{ fontSize: '22px', marginBottom: '4px' }}>{step.icon}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0a3d2e' }}>{step.label}</div>
                  <div style={{ fontSize: '10px', color: '#15803d' }}>{step.sub}</div>
                </div>
                {i < arr.length - 1 && <div style={{ fontSize: '16px', color: '#86efac', margin: '0 2px' }}>→</div>}
              </div>
            ))}
          </div>
          <p style={{ margin: '14px 0 0 0', fontSize: '12px', color: '#166534' }}>
            Jede Nachricht in diesem Prozess ist unten als Vorlage sichtbar und editierbar. So wissen Sie immer genau, was Suchender und Interessent sehen.
          </p>
        </div>

        {/* Vorlagen-Liste */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
          {vorlagen.map(v => {
            const icon = MATCHMAIL_TYP_ICONS[v.typ];
            const typLabel = MATCHMAIL_TYP_LABELS[v.typ];
            return (
              <div key={v.id} onClick={() => onSelect(v.id)} style={{
                backgroundColor: 'white', borderRadius: '10px', padding: '18px', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)', borderLeft: `4px solid ${v.aktiv ? '#4CAF50' : '#999'}`,
                transition: 'box-shadow 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '20px', marginBottom: '6px' }}>{icon}</div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>{v.name}</div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>{typLabel}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                    {v.aktiv
                      ? <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, backgroundColor: '#e8f5e9', color: '#2e7d32' }}>AKTIV</span>
                      : <span style={{ padding: '2px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: 600, backgroundColor: '#e8e8e8', color: '#444' }}>INAKTIV</span>
                    }
                    {v.buttons.length > 0 && (
                      <span style={{ fontSize: '10px', color: '#666' }}>{v.buttons.length} Button{v.buttons.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '8px', lineHeight: 1.5 }}>{v.beschreibung}</div>
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#555', backgroundColor: '#f5f5f5', padding: '2px 8px', borderRadius: '4px' }}>📧 {v.betreff.slice(0, 45)}{v.betreff.length > 45 ? '…' : ''}</span>
                </div>
                {v.letzteBearbeitung && (
                  <div style={{ fontSize: '10px', color: '#999', marginTop: '6px' }}>Zuletzt bearbeitet: {v.letzteBearbeitung}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Vorlage ausgewählt → Editor
  return (
    <MatchmailEditor
      vorlage={selected}
      onUpdate={(patch) => onUpdate(selected.id, patch)}
      onClose={() => onSelect(null)}
      onToast={onToast}
    />
  );
}

// ═════════════════════════════════════════════════════════════════
// MATCHMAIL EDITOR (Betreff, Text, Platzhalter, Buttons, Vorschau)
// ═════════════════════════════════════════════════════════════════

function MatchmailEditor({ vorlage: v, onUpdate, onClose, onToast }: {
  vorlage: MatchmailVorlage;
  onUpdate: (patch: Partial<MatchmailVorlage>) => void;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [subTab, setSubTab] = useState<'editor' | 'vorschau' | 'platzhalter' | 'test'>('editor');
  const [editData, setEditData] = useState({ ...v });
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const upd = (patch: Partial<MatchmailVorlage>) => {
    setEditData(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const speichern = () => {
    onUpdate(editData);
    setDirty(false);
    onToast('Vorlage gespeichert ✓');
  };

  // Platzhalter ersetzen (für Vorschau)
  const ersetzePlatzhalter = (text: string): string => {
    let result = text;
    ALLE_PLATZHALTER.forEach(p => {
      result = result.replaceAll(p.key, p.beispiel);
    });
    return result;
  };

  const INPUT: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' };
  const TEXTAREA: React.CSSProperties = { ...INPUT, minHeight: '80px', resize: 'vertical' as const };
  const LABEL: React.CSSProperties = { fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.5px', display: 'block', marginBottom: '4px' };

  return (
    <div style={{ display: 'flex', gap: '0', alignItems: 'flex-start' }}>
      {/* Zurück-Sidebar */}
      <button onClick={onClose} style={{ padding: '10px 14px', backgroundColor: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: '8px 0 0 8px', cursor: 'pointer', fontSize: '12px', color: '#555', fontWeight: 600, writingMode: 'vertical-rl', letterSpacing: '1px', minHeight: '80px' }}>
        ← Zurück
      </button>

      <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '0 10px 10px 0', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}>{MATCHMAIL_TYP_ICONS[v.typ]}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text)' }}>{v.name}</div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{MATCHMAIL_TYP_LABELS[v.typ]} · {v.beschreibung}</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            {dirty && <span style={{ fontSize: '11px', color: '#FF9900', fontWeight: 600 }}>Ungespeicherte Änderungen</span>}
            <button onClick={speichern} disabled={!dirty} style={{ padding: '8px 18px', backgroundColor: dirty ? 'var(--accent)' : '#ccc', color: 'white', border: 'none', borderRadius: '6px', cursor: dirty ? 'pointer' : 'default', fontSize: '13px', fontWeight: 600 }}>
              💾 Speichern
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666' }}>×</button>
          </div>
        </div>

        {/* Sub-Tabs */}
        <div style={{ display: 'flex', gap: '6px', padding: '12px 20px 0 20px' }}>
          {([
            ['editor', '✏️ Editor'],
            ['vorschau', '👁 E-Mail-Vorschau'],
            ['platzhalter', '🔤 Platzhalter'],
            ['test', '🧪 Test senden'],
          ] as const).map(([id, label]) => (
            <button key={id} onClick={() => setSubTab(id)} style={{
              padding: '7px 14px', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              backgroundColor: subTab === id ? '#f0f4ff' : 'transparent', color: subTab === id ? 'var(--accent)' : '#666',
            }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: '20px' }}>
          {/* ── EDITOR ──────────────────────────────────────── */}
          {subTab === 'editor' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Betreff */}
              <div>
                <label style={LABEL}>Betreff</label>
                <input style={INPUT} value={editData.betreff} onChange={e => upd({ betreff: e.target.value })} />
                <div style={{ fontSize: '10px', color: '#999', marginTop: '3px' }}>Platzhalter wie {'{{Projektname}}'} werden automatisch ersetzt.</div>
              </div>

              {/* Einleitung */}
              <div>
                <label style={LABEL}>Einleitung (Begrüßung + Kontext)</label>
                <textarea style={TEXTAREA} value={editData.einleitung} onChange={e => upd({ einleitung: e.target.value })} />
              </div>

              {/* Hauptinhalt */}
              <div>
                <label style={LABEL}>Hauptinhalt (Informationen, Daten, Match-Details)</label>
                <textarea style={{ ...TEXTAREA, minHeight: '140px' }} value={editData.hauptinhalt} onChange={e => upd({ hauptinhalt: e.target.value })} />
              </div>

              {/* Hinweis */}
              <div>
                <label style={LABEL}>Hinweis / DSGVO-Info</label>
                <textarea style={TEXTAREA} value={editData.hinweis} onChange={e => upd({ hinweis: e.target.value })} />
              </div>

              {/* Buttons */}
              <div>
                <label style={LABEL}>Buttons / Aktionen</label>
                {editData.buttons.map((btn, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                    <input style={{ ...INPUT, flex: 1 }} value={btn.label} onChange={e => {
                      const neu = [...editData.buttons];
                      neu[i] = { ...neu[i], label: e.target.value };
                      upd({ buttons: neu });
                    }} placeholder="Button-Text…" />
                    <input type="color" value={btn.farbe} onChange={e => {
                      const neu = [...editData.buttons];
                      neu[i] = { ...neu[i], farbe: e.target.value };
                      upd({ buttons: neu });
                    }} style={{ width: '36px', height: '34px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', padding: '2px' }} />
                    <select style={{ ...INPUT, width: '120px' }} value={btn.aktion} onChange={e => {
                      const neu = [...editData.buttons];
                      neu[i] = { ...neu[i], aktion: e.target.value };
                      upd({ buttons: neu });
                    }}>
                      <option value="zustimmung">Zustimmung</option>
                      <option value="ablehnung">Ablehnung</option>
                      <option value="bestaetigung">Bestätigung</option>
                      <option value="problem">Problem</option>
                      <option value="antwort">Antwort</option>
                      <option value="link">Link</option>
                    </select>
                    <button onClick={() => { const neu = editData.buttons.filter((_, j) => j !== i); upd({ buttons: neu }); }} style={{ padding: '6px 10px', backgroundColor: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: '5px', fontSize: '11px', cursor: 'pointer' }}>🗑</button>
                  </div>
                ))}
                <button onClick={() => upd({ buttons: [...editData.buttons, { label: 'Neuer Button', aktion: 'link', farbe: 'var(--accent)' }] })} style={{ padding: '6px 14px', backgroundColor: '#f0f4ff', color: 'var(--text)', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                  + Button hinzufügen
                </button>
              </div>

              {/* Fußzeile */}
              <div>
                <label style={LABEL}>Fußzeile / Disclaimer</label>
                <textarea style={{ ...TEXTAREA, minHeight: '60px' }} value={editData.fusszeile} onChange={e => upd({ fusszeile: e.target.value })} />
              </div>

              {/* Aktiv-Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={editData.aktiv} onChange={e => upd({ aktiv: e.target.checked })} />
                  <span style={{ fontWeight: 600, color: editData.aktiv ? '#2e7d32' : '#666' }}>
                    {editData.aktiv ? '✅ Vorlage ist aktiv' : '⏸ Vorlage ist deaktiviert'}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* ── VORSCHAU ────────────────────────────────────── */}
          {subTab === 'vorschau' && (
            <div style={{ maxWidth: '620px', margin: '0 auto' }}>
              <div style={{ marginBottom: '12px', padding: '10px 14px', backgroundColor: '#f5f5f5', borderRadius: '6px', fontSize: '12px', color: '#555' }}>
                <strong>Vorschau:</strong> So sieht die E-Mail für den Empfänger aus. Platzhalter sind mit Beispieldaten gefüllt.
              </div>

              {/* E-Mail-Rendering */}
              <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                {/* E-Mail-Header */}
                <div style={{ padding: '10px 16px', backgroundColor: '#f9f9f9', borderBottom: '1px solid #e0e0e0', fontSize: '12px', color: '#555' }}>
                  <div style={{ marginBottom: '4px' }}><strong>An:</strong> beispiel@unternehmen.de</div>
                  <div><strong>Betreff:</strong> {ersetzePlatzhalter(editData.betreff)}</div>
                </div>

                {/* E-Mail-Body (wie echte E-Mail) */}
                <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '600px', margin: '0 auto', color: '#333' }}>
                  {/* Branded Header */}
                  <div style={{ background: 'var(--accent)', padding: '20px 24px', borderRadius: '0' }}>
                    <h1 style={{ color: 'white', margin: 0, fontSize: '18px' }}>
                      {MATCHMAIL_TYP_ICONS[editData.typ]} {editData.name}
                    </h1>
                    <p style={{ color: '#a8c4e0', margin: '4px 0 0 0', fontSize: '12px' }}>
                      {MATCHMAIL_TYP_LABELS[editData.typ]} · {ersetzePlatzhalter('{{Datum}}')}
                    </p>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '24px', background: 'white' }}>
                    {/* Einleitung */}
                    {editData.einleitung.split('\n').map((line, i) => (
                      <p key={i} style={{ fontSize: '14px', lineHeight: 1.6, margin: '0 0 8px 0' }}>
                        {ersetzePlatzhalter(line)}
                      </p>
                    ))}

                    {/* Hauptinhalt (als Box) */}
                    <div style={{ margin: '20px 0', padding: '20px', background: '#f0f4ff', border: '2px solid #2196F3', borderRadius: '8px' }}>
                      {editData.hauptinhalt.split('\n').map((line, i) => {
                        const replaced = ersetzePlatzhalter(line);
                        if (line.startsWith('MATCH-VORSCHLAG') || line.startsWith('PROJEKT-VORSTELLUNG') || line.startsWith('✅ MATCH BESTÄTIGT')) {
                          return <div key={i} style={{ fontSize: '11px', fontWeight: 'bold', color: '#1565C0', letterSpacing: '0.5px', marginBottom: '10px' }}>{replaced}</div>;
                        }
                        if (replaced.startsWith('•') || replaced.startsWith('- ')) {
                          return <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: '#333', padding: '3px 0' }}><span style={{ color: '#4CAF50', flexShrink: 0 }}>✓</span><span>{replaced.replace(/^[•\-]\s*/, '')}</span></div>;
                        }
                        if (line.includes(':') && !line.startsWith('Warum')) {
                          const [key, ...val] = replaced.split(':');
                          if (val.length > 0 && key.length < 30) {
                            return <div key={i} style={{ fontSize: '13px', padding: '3px 0' }}><span style={{ color: '#555' }}>{key}:</span> <strong>{val.join(':').trim()}</strong></div>;
                          }
                        }
                        if (replaced.startsWith('Warum wir glauben')) {
                          return <div key={i} style={{ fontSize: '12px', fontWeight: 'bold', color: '#1b5e20', margin: '12px 0 6px 0' }}>{replaced}</div>;
                        }
                        if (!replaced.trim()) return <div key={i} style={{ height: '8px' }} />;
                        return <div key={i} style={{ fontSize: '14px', fontWeight: replaced.length < 40 && !replaced.includes(' ') ? 'bold' : 'normal', color: replaced.length < 40 ? 'var(--accent)' : '#333', padding: '2px 0', lineHeight: 1.6 }}>{replaced}</div>;
                      })}
                    </div>

                    {/* Hinweis */}
                    {editData.hinweis && (
                      <div style={{ background: '#fff8e1', padding: '14px 16px', borderRadius: '8px', margin: '16px 0', fontSize: '13px', color: '#5d4037' }}>
                        {editData.hinweis.split('\n').map((line, i) => {
                          const replaced = ersetzePlatzhalter(line);
                          if (replaced.startsWith('•') || replaced.startsWith('- ')) {
                            return <div key={i} style={{ padding: '2px 0' }}>💡 {replaced.replace(/^[•\-]\s*/, '')}</div>;
                          }
                          return <p key={i} style={{ margin: '0 0 4px 0' }}>{replaced.startsWith('Hinweis') ? <><strong>Hinweis:</strong> {replaced.replace(/^Hinweis[es]*:\s*/i, '')}</> : replaced}</p>;
                        })}
                      </div>
                    )}

                    {/* Buttons */}
                    {editData.buttons.length > 0 && (
                      <div style={{ margin: '20px 0', textAlign: 'center' }}>
                        <p style={{ fontSize: '13px', color: '#555', marginBottom: '12px' }}>
                          {editData.buttons.some(b => b.aktion === 'zustimmung') ? 'Möchten Sie, dass Ihre Kontaktdaten weitergegeben werden?' : 'Bitte wählen Sie:'}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {editData.buttons.map((btn, i) => (
                            <div key={i} style={{
                              display: 'inline-block', padding: '12px 24px',
                              backgroundColor: btn.farbe,
                              color: ['#f5f5f5', '#ffffff', '#fff8e1', '#e8f5e9'].includes(btn.farbe.toLowerCase()) ? '#333' : 'white',
                              borderRadius: '8px', fontSize: '14px', fontWeight: 700,
                              border: btn.farbe === '#f5f5f5' ? '1px solid #ddd' : 'none',
                            }}>
                              {btn.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fußzeile */}
                    {editData.fusszeile && (
                      <p style={{ fontSize: '11px', color: '#888', lineHeight: 1.5, marginTop: '20px' }}>
                        {ersetzePlatzhalter(editData.fusszeile)}
                      </p>
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{ padding: '12px 24px', fontSize: '11px', color: '#999', textAlign: 'center', borderTop: '1px solid #f0f0f0' }}>
                    Easy-B2B · Deutsch-Dänisches Matchmaking-Netzwerk
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── PLATZHALTER ─────────────────────────────────── */}
          {subTab === 'platzhalter' && (
            <div>
              <p style={{ fontSize: '13px', color: '#555', margin: '0 0 16px 0' }}>
                Diese Platzhalter können in Betreff, Einleitung, Hauptinhalt und Hinweis verwendet werden. Sie werden beim Versand automatisch durch die echten Werte ersetzt.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
                {ALLE_PLATZHALTER.map(p => (
                  <div key={p.key} style={{ padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e8e8e8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <code style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', backgroundColor: '#e3f2fd', padding: '2px 8px', borderRadius: '4px' }}>{p.key}</code>
                      <button onClick={() => { navigator.clipboard.writeText(p.key); onToast(`${p.key} kopiert`); }} style={{ padding: '3px 8px', backgroundColor: 'transparent', border: '1px solid #ddd', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', color: '#555' }}>
                        📋 Kopieren
                      </button>
                    </div>
                    <div style={{ fontSize: '12px', color: '#555' }}>{p.label}</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>Beispiel: <em>{p.beispiel}</em></div>
                  </div>
                ))}
              </div>

              {/* Verwendete Platzhalter in dieser Vorlage */}
              <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#f0f4ff', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', marginBottom: '10px' }}>In dieser Vorlage verwendet:</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {ALLE_PLATZHALTER.filter(p => {
                    const all = editData.betreff + editData.einleitung + editData.hauptinhalt + editData.hinweis + editData.fusszeile;
                    return all.includes(p.key);
                  }).map(p => (
                    <code key={p.key} style={{ fontSize: '12px', padding: '3px 8px', backgroundColor: '#e3f2fd', color: 'var(--text)', borderRadius: '4px', fontWeight: 600 }}>{p.key}</code>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TEST SENDEN ──────────────────────────────────── */}
          {subTab === 'test' && (
            <div style={{ maxWidth: '500px' }}>
              <div style={{ padding: '16px', backgroundColor: '#fff8e1', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#8a6d00', marginBottom: '6px' }}>🧪 Test-E-Mail senden</div>
                <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                  Sendet eine Vorschau dieser Vorlage mit Beispieldaten an die Operator-E-Mail-Adresse. So können Sie die Darstellung im echten E-Mail-Postfach prüfen.
                </p>
              </div>

              <div style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px' }}><strong>Empfänger:</strong></div>
                <div style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 600 }}>jan.thomsen.stf@gmail.com</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>Resend Free-Tier: nur verifizierte Adressen</div>
              </div>

              <div style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: '#555', marginBottom: '6px' }}><strong>Betreff:</strong></div>
                <div style={{ fontSize: '13px', color: '#333' }}>🧪 TEST: {ersetzePlatzhalter(editData.betreff)}</div>
              </div>

              <button
                onClick={async () => {
                  setTestSending(true);
                  setTestResult(null);
                  try {
                    const res = await fetch('/api/email/test-vorlage', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        betreff: `🧪 TEST: ${ersetzePlatzhalter(editData.betreff)}`,
                        vorlageName: editData.name,
                        vorlageTyp: editData.typ,
                        einleitung: ersetzePlatzhalter(editData.einleitung),
                        hauptinhalt: ersetzePlatzhalter(editData.hauptinhalt),
                        hinweis: ersetzePlatzhalter(editData.hinweis),
                        buttons: editData.buttons,
                        fusszeile: ersetzePlatzhalter(editData.fusszeile),
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setTestResult('✅ Test-E-Mail erfolgreich gesendet!');
                    } else {
                      setTestResult(`❌ Fehler: ${data.error || 'Unbekannt'}`);
                    }
                  } catch (err) {
                    setTestResult('❌ Verbindungsfehler — bitte später erneut versuchen');
                  } finally {
                    setTestSending(false);
                  }
                }}
                disabled={testSending}
                style={{
                  padding: '12px 24px', backgroundColor: testSending ? '#ccc' : 'var(--accent)', color: 'white',
                  border: 'none', borderRadius: '8px', cursor: testSending ? 'wait' : 'pointer',
                  fontSize: '14px', fontWeight: 700, width: '100%',
                }}
              >
                {testSending ? '⏳ Sende…' : '📧 Test-E-Mail jetzt senden'}
              </button>

              {testResult && (
                <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, backgroundColor: testResult.startsWith('✅') ? '#e8f5e9' : '#ffebee', color: testResult.startsWith('✅') ? '#2e7d32' : '#c62828' }}>
                  {testResult}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// FORMULAR-EDITOR (bestehend — unverändert)
// ═════════════════════════════════════════════════════════════════

function FormularEditor({ formular: f, store, onClose, onToast }: {
  formular: FormularVorlage;
  store: ReturnType<typeof useStore>;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [editorTab, setEditorTab] = useState<'editor' | 'vorschau' | 'ki'>('editor');
  const [neueFrage, setNeueFrage] = useState('');
  const [neuerTyp, setNeuerTyp] = useState<FrageTyp>('text_kurz');
  const [kiBeschreibung, setKiBeschreibung] = useState('');
  const [kiFragen, setKiFragen] = useState<FormularFrage[] | null>(null);
  const [kiBranche, setKiBranche] = useState('');
  const [kiLoading, setKiLoading] = useState(false);
  const [pruefErgebnis, setPruefErgebnis] = useState<FormularPruefErgebnis | null>(null);

  const setFragen = (fragen: FormularFrage[]) => {
    const neu = fragen.map((fr, idx) => ({ ...fr, reihenfolge: idx + 1 }));
    store.updateFormular(f.id, { fragen: neu });
  };

  const frageHinzufuegen = () => {
    if (!neueFrage.trim()) return;
    const neu: FormularFrage = {
      id: neueEntityId('frq'),
      reihenfolge: f.fragen.length + 1,
      text: neueFrage.trim(),
      typ: neuerTyp,
      pflicht: true,
      optionen: ['auswahl_single', 'auswahl_multi'].includes(neuerTyp) ? ['Option 1', 'Option 2'] : undefined,
    };
    setFragen([...f.fragen, neu]);
    setNeueFrage('');
    onToast('Frage hinzugefügt');
  };

  const frageLoeschen = (id: string) => {
    setFragen(f.fragen.filter(fr => fr.id !== id));
    onToast('Frage gelöscht');
  };

  const frageBearbeiten = (id: string, patch: Partial<FormularFrage>) => {
    setFragen(f.fragen.map(fr => fr.id === id ? { ...fr, ...patch } : fr));
  };

  const verschieben = (index: number, richtung: -1 | 1) => {
    const neu = [...f.fragen];
    const ziel = index + richtung;
    if (ziel < 0 || ziel >= neu.length) return;
    [neu[index], neu[ziel]] = [neu[ziel], neu[index]];
    setFragen(neu);
  };

  async function kiVorschlagen() {
    if (!kiBeschreibung.trim()) return;
    setKiLoading(true);
    const res = await schlageBranchenFragenVor(kiBeschreibung, f.typ);
    setKiFragen(res.fragen);
    setKiBranche(res.erkannteBranche);
    setKiLoading(false);
  }

  function kiFragenUebernehmen() {
    if (!kiFragen) return;
    const mitNeuenIds = kiFragen.map(fr => ({ ...fr, id: neueEntityId('frq') }));
    setFragen([...f.fragen, ...mitNeuenIds]);
    setKiFragen(null);
    setKiBeschreibung('');
    onToast(`${mitNeuenIds.length} Fragen übernommen`);
  }

  async function kiPruefen() {
    setKiLoading(true);
    const res = await pruefeFormular(f.fragen, f.typ);
    setPruefErgebnis(res);
    setKiLoading(false);
  }

  const INPUT: React.CSSProperties = { padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' };

  return (
    <div style={{ flex: 1, minWidth: 0, backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <input
            value={f.name}
            onChange={e => store.updateFormular(f.id, { name: e.target.value })}
            style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', border: 'none', borderBottom: '1px dashed transparent', outline: 'none', width: '100%' }}
            onFocus={e => e.currentTarget.style.borderBottomColor = '#ddd'}
            onBlur={e => e.currentTarget.style.borderBottomColor = 'transparent'}
          />
          <input
            value={f.beschreibung || ''}
            onChange={e => store.updateFormular(f.id, { beschreibung: e.target.value })}
            placeholder="Beschreibung (optional)…"
            style={{ fontSize: '12px', color: '#666', border: 'none', outline: 'none', width: '100%', marginTop: '4px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <label style={{ fontSize: '11px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <input type="checkbox" checked={f.aktiv} onChange={e => store.updateFormular(f.id, { aktiv: e.target.checked })} /> aktiv
          </label>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#666' }}>×</button>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div style={{ display: 'flex', gap: '6px', padding: '12px 20px 0 20px' }}>
        {([['editor', '✏️ Editor'], ['vorschau', '👁 Vorschau'], ['ki', '🤖 KI-Hilfe']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setEditorTab(id)} style={{
            padding: '7px 14px', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
            backgroundColor: editorTab === id ? '#f0f4ff' : 'transparent', color: editorTab === id ? 'var(--accent)' : '#666',
          }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px' }}>
        {/* TAB: EDITOR */}
        {editorTab === 'editor' && (
          <div>
            {f.fragen.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#666', textAlign: 'center', padding: '20px' }}>Noch keine Fragen. Füge unten die erste hinzu oder nutze die KI-Hilfe.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {f.fragen.map((fr, idx) => (
                  <div key={fr.id} style={{ padding: '12px', backgroundColor: '#f5f7fa', borderRadius: '8px', border: '1px solid #ddd' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                        <button onClick={() => verschieben(idx, -1)} disabled={idx === 0} style={arrowBtn(idx === 0)}>▲</button>
                        <span style={{ fontSize: '10px', color: '#555', textAlign: 'center', fontWeight: 600 }}>{idx + 1}</span>
                        <button onClick={() => verschieben(idx, 1)} disabled={idx === f.fragen.length - 1} style={arrowBtn(idx === f.fragen.length - 1)}>▼</button>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <input value={fr.text} onChange={e => frageBearbeiten(fr.id, { text: e.target.value })} style={{ ...INPUT, width: '100%', fontWeight: 600, color: '#333', marginBottom: '6px' }} />
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <select value={fr.typ} onChange={e => {
                            const t = e.target.value as FrageTyp;
                            frageBearbeiten(fr.id, { typ: t, optionen: ['auswahl_single','auswahl_multi'].includes(t) ? (fr.optionen || ['Option 1','Option 2']) : undefined });
                          }} style={{ ...INPUT, fontSize: '12px' }}>
                            {FRAGETYP_OPTIONEN.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                          <label style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={fr.pflicht} onChange={e => frageBearbeiten(fr.id, { pflicht: e.target.checked })} /> Pflicht
                          </label>
                          <button onClick={() => frageLoeschen(fr.id)} style={{ marginLeft: 'auto', padding: '4px 10px', backgroundColor: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>🗑 Löschen</button>
                        </div>
                        {['auswahl_single', 'auswahl_multi'].includes(fr.typ) && (
                          <div style={{ marginTop: '6px' }}>
                            <input
                              value={(fr.optionen || []).join(', ')}
                              onChange={e => frageBearbeiten(fr.id, { optionen: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                              placeholder="Optionen, durch Komma getrennt"
                              style={{ ...INPUT, width: '100%', fontSize: '12px', backgroundColor: 'white' }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Frage hinzufügen */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '12px', backgroundColor: '#f0f4ff', borderRadius: '8px' }}>
              <input value={neueFrage} onChange={e => setNeueFrage(e.target.value)} onKeyDown={e => e.key === 'Enter' && frageHinzufuegen()} placeholder="Neue Frage eingeben…" style={{ ...INPUT, flex: 1 }} />
              <select value={neuerTyp} onChange={e => setNeuerTyp(e.target.value as FrageTyp)} style={{ ...INPUT, fontSize: '12px' }}>
                {FRAGETYP_OPTIONEN.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={frageHinzufuegen} style={{ padding: '8px 16px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>+ Hinzufügen</button>
            </div>
          </div>
        )}

        {/* TAB: VORSCHAU */}
        {editorTab === 'vorschau' && (
          <div style={{ maxWidth: '560px', margin: '0 auto' }}>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--accent)', color: 'white', borderRadius: '8px 8px 0 0', fontSize: '13px', fontWeight: 700 }}>
              {f.typ === 'anfrage' ? '📋 Anfrage einreichen' : '👥 Interesse bekunden'} — Vorschau
            </div>
            <div style={{ border: '1px solid #e0e0e0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '20px' }}>
              {f.fragen.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#666' }}>Noch keine Fragen.</p>
              ) : f.fragen.map((fr, idx) => (
                <div key={fr.id} style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '5px' }}>
                    {idx + 1}. {fr.text}{fr.pflicht && <span style={{ color: '#f44336' }}> *</span>}
                  </label>
                  <VorschauFeld frage={fr} />
                  {fr.hinweis && <div style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>{fr.hinweis}</div>}
                </div>
              ))}
              {f.fragen.length > 0 && (
                <button style={{ padding: '10px 24px', backgroundColor: '#FF9900', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 600, cursor: 'default', marginTop: '8px' }}>Absenden</button>
              )}
            </div>
          </div>
        )}

        {/* TAB: KI-HILFE */}
        {editorTab === 'ki' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Branchenfragen vorschlagen */}
            <div style={{ padding: '16px', backgroundColor: '#f0f4ff', borderRadius: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>✨ Branchenfragen vorschlagen</div>
              <p style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>Beschreibe das Vorhaben — die KI schlägt passende Zusatzfragen vor.</p>
              <textarea value={kiBeschreibung} onChange={e => setKiBeschreibung(e.target.value)} rows={2} placeholder="z.B. Lebensmittelunternehmen aus Dänemark sucht Vertriebspartner in Deutschland" style={{ ...INPUT, width: '100%', marginBottom: '8px', resize: 'vertical' }} />
              <button onClick={kiVorschlagen} disabled={kiLoading || !kiBeschreibung.trim()} style={{ padding: '8px 16px', backgroundColor: kiLoading ? '#ccc' : 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: kiLoading ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                {kiLoading ? '⏳ Analysiere…' : '✨ Fragen vorschlagen'}
              </button>
              {kiFragen && (
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #90caf9' }}>
                  <div style={{ fontSize: '11px', color: '#1565C0', fontWeight: 700, marginBottom: '8px' }}>Erkannt: {kiBranche} · {kiFragen.length} Vorschläge</div>
                  {kiFragen.map((fr, i) => (
                    <div key={i} style={{ fontSize: '12px', color: '#444', padding: '4px 0', borderBottom: '1px solid #f5f5f5' }}>
                      • {fr.text} <span style={{ color: '#666' }}>({getFrageTypLabel(fr.typ)})</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button onClick={kiFragenUebernehmen} style={{ padding: '6px 14px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>✓ Alle übernehmen</button>
                    <button onClick={() => setKiFragen(null)} style={{ padding: '6px 14px', backgroundColor: '#f5f5f5', color: '#666', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Verwerfen</button>
                  </div>
                </div>
              )}
            </div>

            {/* Formular prüfen */}
            <div style={{ padding: '16px', backgroundColor: '#fff8e1', borderRadius: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#8a6d00', marginBottom: '8px' }}>🔍 Formular prüfen</div>
              <p style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>Erkennt doppelte Fragen, fehlende wichtige Felder und gibt Tipps.</p>
              <button onClick={kiPruefen} disabled={kiLoading} style={{ padding: '8px 16px', backgroundColor: kiLoading ? '#ccc' : '#8a6d00', color: 'white', border: 'none', borderRadius: '6px', cursor: kiLoading ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                {kiLoading ? '⏳ Prüfe…' : '🔍 Jetzt prüfen'}
              </button>
              {pruefErgebnis && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: pruefErgebnis.score >= 80 ? '#2e7d32' : pruefErgebnis.score >= 60 ? '#E65100' : '#c62828', marginBottom: '8px' }}>
                    Qualitäts-Score: {pruefErgebnis.score}/100
                  </div>
                  {pruefErgebnis.hinweise.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#2e7d32' }}>✅ Keine Probleme gefunden — gutes Formular!</div>
                  ) : pruefErgebnis.hinweise.map((h, i) => (
                    <div key={i} style={{ fontSize: '12px', color: '#555', padding: '6px 10px', backgroundColor: 'white', borderRadius: '6px', marginBottom: '6px', borderLeft: `3px solid ${h.typ === 'doppelt' ? '#FF9900' : h.typ === 'fehlt' ? '#f44336' : '#2196F3'}` }}>
                      {h.typ === 'doppelt' ? '🔁' : h.typ === 'fehlt' ? '⚠️' : '💡'} {h.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── VORSCHAU-FELD ────────────────────────────────────────────

function VorschauFeld({ frage }: { frage: FormularFrage }) {
  const base: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', backgroundColor: 'white', color: '#333' };
  switch (frage.typ) {
    case 'text_lang': return <textarea rows={3} disabled style={{ ...base, resize: 'none' }} placeholder="Antwort…" />;
    case 'zahl': return <input type="number" disabled style={base} placeholder="0" />;
    case 'datum': return <input type="date" disabled style={base} />;
    case 'datei': return <div style={{ ...base, color: '#666' }}>📎 Datei auswählen…</div>;
    case 'ja_nein': return (
      <div style={{ display: 'flex', gap: '12px' }}>
        <label style={{ fontSize: '13px' }}><input type="radio" disabled /> Ja</label>
        <label style={{ fontSize: '13px' }}><input type="radio" disabled /> Nein</label>
      </div>
    );
    case 'skala': return (
      <div style={{ display: 'flex', gap: '4px' }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => <span key={n} style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#666' }}>{n}</span>)}
      </div>
    );
    case 'auswahl_single': return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {(frage.optionen || []).map((o, i) => <label key={i} style={{ fontSize: '13px' }}><input type="radio" disabled /> {o}</label>)}
      </div>
    );
    case 'auswahl_multi': return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {(frage.optionen || []).map((o, i) => <label key={i} style={{ fontSize: '13px' }}><input type="checkbox" disabled /> {o}</label>)}
      </div>
    );
    default: return <input disabled style={base} placeholder="Antwort…" />;
  }
}

// ─── NEUE VORLAGE MODAL ───────────────────────────────────────

function NeueVorlageModal({ onClose, onErstellen }: {
  onClose: () => void;
  onErstellen: (name: string, typ: FormularTyp, branche: string) => void;
}) {
  const [name, setName] = useState('');
  const [typ, setTyp] = useState<FormularTyp>('anfrage');
  const [branche, setBranche] = useState('');

  const INPUT: React.CSSProperties = { width: '100%', padding: '9px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box', marginTop: '5px' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 3000, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '12px', width: '100%', maxWidth: '440px', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text)' }}>Neue Formular-Vorlage</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#666' }}>×</button>
        </div>
        <div style={{ padding: '24px' }}>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#555' }}>Name *
            <input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. Food-Markteintritt Deutschland" style={INPUT} />
          </label>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#555', display: 'block', marginTop: '16px' }}>Formulartyp *
            <select value={typ} onChange={e => setTyp(e.target.value as FormularTyp)} style={INPUT}>
              <option value="anfrage">📋 Anfrageformular</option>
              <option value="interessent">👥 Interessentenformular</option>
            </select>
          </label>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#555', display: 'block', marginTop: '16px' }}>Branche (optional — leer = allgemein)
            <input value={branche} onChange={e => setBranche(e.target.value)} placeholder="z.B. Lebensmittel & Fischerei" style={INPUT} />
          </label>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', backgroundColor: 'transparent', color: '#666', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>Abbrechen</button>
          <button onClick={() => name.trim() && onErstellen(name.trim(), typ, branche.trim())} disabled={!name.trim()} style={{ padding: '10px 24px', backgroundColor: name.trim() ? 'var(--accent)' : '#ccc', color: 'white', border: 'none', borderRadius: '6px', cursor: name.trim() ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: 600 }}>Erstellen</button>
        </div>
      </div>
    </div>
  );
}

function arrowBtn(disabled: boolean): React.CSSProperties {
  return { background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer', fontSize: '10px', color: disabled ? '#ddd' : '#666', padding: '2px', lineHeight: 1 };
}
