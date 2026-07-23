
import { useState } from 'react';
import {
  getStatusLabel, getStatusColor, getRichtungLabel, MOCK_INTERESSENTEN,
  getWorkflowStatusColor, getWorkflowStatusSchritt,
  WORKFLOW_SCHRITTE, PRUEF_KATEGORIEN, erstelleStandardPruefPunkte,
  type MockAnfrage, type PruefPunkt,
} from '@easyb2b/lib/mockdata';
import { verbessereAntwortMock } from '@easyb2b/lib/funfact';
import { useStore } from '@easyb2b/lib/store';
import { berechneAnfrageKlaerung } from '@easyb2b/lib/klaerungsstand';
import KlaerungsBox from '@easyb2b/components/KlaerungsBox';
import EditableSection, { editInputStyle, editTextareaStyle, editLabelStyle } from '@easyb2b/components/EditableSection';

export default function AnfragenPage() {
  const store = useStore();
  const [filterStatus, setFilterStatus] = useState('alle');
  const [filterRichtung, setFilterRichtung] = useState('alle');
  const [offeneIds, setOffeneIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const zeigeToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const toggleDetail = (id: string) => {
    setOffeneIds(prev => {
      const neu = new Set(prev);
      if (neu.has(id)) {
        neu.delete(id);
      } else {
        neu.clear();
        neu.add(id);
      }
      return neu;
    });
  };

  const filtered = store.anfragen.filter(a => {
    if (filterStatus !== 'alle' && a.status !== filterStatus) return false;
    if (filterRichtung !== 'alle' && a.richtung !== filterRichtung) return false;
    return true;
  });

  // KPIs
  const eingehend = store.anfragen.filter(a => a.status === 'eingehend').length;
  const inPruefung = store.anfragen.filter(a => a.workflowStatus === 'in_pruefung' || a.workflowStatus === 'rueckfragen_offen').length;
  const projektErstellt = store.anfragen.filter(a => a.workflowStatus === 'projekt_erstellt').length;

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, backgroundColor: 'var(--accent)', color: 'white', padding: '14px 20px', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: '14px', fontWeight: 600 }}>
          {toast}
        </div>
      )}

      <div style={{ marginBottom: '8px' }}>
        <h1 style={{ margin: 0, color: 'var(--text)', fontSize: '24px' }}>Anfragen</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#555' }}>
          Eingangskorb — Anfragen prüfen, qualifizieren und als Projekt anlegen. Veröffentlichung erfolgt im Modul Projekte.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '14px', margin: '24px 0' }}>
        {[
          { label: 'Anfragen gesamt', value: store.anfragen.length, color: 'var(--text)' },
          { label: '⏳ Eingehend', value: eingehend, color: '#E65100' },
          { label: '🔍 In Prüfung', value: inPruefung, color: '#FF9900' },
          { label: '🚀 Projekt erstellt', value: projektErstellt, color: '#9C27B0' },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.07)', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: '12px', color: '#444', fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: s.color, marginTop: '4px' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: '13px', fontWeight: 700, color: '#333', display: 'block', marginBottom: '4px' }}>Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #bbb', fontSize: '14px', minWidth: '160px', backgroundColor: 'white', color: '#222' }}>
            <option value="alle">Alle Status</option>
            <option value="eingehend">Eingehend</option>
            <option value="aktiv">Aktiv</option>
            <option value="interessent_vorhanden">Interessent vorhanden</option>
            <option value="kontakt_laeuft">Kontakt läuft</option>
            <option value="vermittelt">Vermittelt</option>
            <option value="pausiert">Pausiert</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '13px', fontWeight: 700, color: '#333', display: 'block', marginBottom: '4px' }}>Richtung</label>
          <select value={filterRichtung} onChange={e => setFilterRichtung(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #bbb', fontSize: '14px', minWidth: '160px', backgroundColor: 'white', color: '#222' }}>
            <option value="alle">Alle Richtungen</option>
            <option value="de_dk">Deutschland → Dänemark</option>
            <option value="dk_de">Dänemark → Deutschland</option>
          </select>
        </div>
        <div style={{ fontSize: '14px', color: '#444', paddingBottom: '9px', fontWeight: 600 }}>
          {filtered.length} Anfrage(n)
        </div>
      </div>

      {/* Liste mit Accordion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666', fontSize: '14px', backgroundColor: 'white', borderRadius: '8px' }}>
            Keine Anfragen gefunden.
          </div>
        ) : filtered.map(a => {
          const isOpen = offeneIds.has(a.id);
          return (
            <div key={a.id} style={{
              borderRadius: '10px', overflow: 'hidden',
              boxShadow: isOpen ? '0 4px 16px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.07)',
              transition: 'box-shadow 0.2s',
            }}>
              {/* Karten-Header */}
              <div
                onClick={() => toggleDetail(a.id)}
                style={{
                  backgroundColor: 'white', padding: '16px 20px', cursor: 'pointer',
                  borderLeft: `5px solid ${getStatusColor(a.status)}`,
                  borderBottom: isOpen ? '1px solid #f0f0f0' : 'none',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#444', backgroundColor: '#e8e8e8', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>{a.anzeigenId}</span>
                    <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text)' }}>{a.firmenname}</span>
                    <span style={{ fontSize: '12px', color: '#555' }}>{getRichtungLabel(a.richtung)}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#555', marginBottom: '4px' }}>{a.ziel}</div>
                  <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: '#666', flexWrap: 'wrap' }}>
                    <span>{a.branche}</span>
                    <span>{a.standort}</span>
                    {(() => {
                      const punkte = a.pruefPunkte || [];
                      const erledigt = punkte.filter(p => p.erledigt).length;
                      const gesamt = punkte.length;
                      if (gesamt > 0) {
                        return <span style={{ color: erledigt === gesamt ? '#2e7d32' : '#E65100', fontWeight: 600 }}>✓ {erledigt}/{gesamt} geprüft</span>;
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <span style={{
                    display: 'inline-block', minWidth: '28px', height: '24px', borderRadius: '12px', lineHeight: '24px', padding: '0 8px',
                    backgroundColor: a.interessentenCount > 0 ? '#e8f5e9' : '#eee',
                    color: a.interessentenCount > 0 ? '#1b5e20' : '#666',
                    fontWeight: 700, fontSize: '12px',
                  }}>
                    {a.interessentenCount} 👥
                  </span>
                  <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: 'white', backgroundColor: getStatusColor(a.status) }}>
                    {getStatusLabel(a.status)}
                  </span>
                </div>
                <span style={{ fontSize: '18px', color: '#888', flexShrink: 0, lineHeight: 1 }}>{isOpen ? '▴' : '▾'}</span>
              </div>

              {isOpen && (
                <AnfrageInhalt
                  anfrage={a}
                  store={store}
                  onToast={zeigeToast}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ACCORDION-INHALT ─────────────────────────────────────────

function AnfrageInhalt({ anfrage: a, store, onToast }: {
  anfrage: MockAnfrage;
  store: ReturnType<typeof useStore>;
  onToast: (m: string) => void;
}) {
  const [kiLaedt, setKiLaedt] = useState(false);
  const [kiErgebnis, setKiErgebnis] = useState<string | null>(null);
  const [duplikatKandidaten, setDuplikatKandidaten] = useState<typeof store.unternehmen | null>(null);

  const interessenten = MOCK_INTERESSENTEN.filter(i => i.anfrageId === a.id);
  const verknuepftesUnternehmen = a.unternehmensId ? store.unternehmen.find(u => u.id === a.unternehmensId) : null;
  const formular = a.anfrageFormularId ? store.formulare.find(f => f.id === a.anfrageFormularId) : null;

  // Prüfpunkte (aus Anfrage oder Standard-Checkliste)
  const pruefPunkte = a.pruefPunkte || [];
  const hatPruefPunkte = pruefPunkte.length > 0;

  // ── Speichern-Helper für Inline-Edit ──
  const speichereBereich = (patch: Partial<MockAnfrage>, bereichName: string) => {
    store.updateAnfrage(a.id, patch);
    store.logge(`${bereichName} aktualisiert`, a.anzeigenId || a.id, 'bearbeiten');
    onToast(`${bereichName} gespeichert ✓`);
  };

  // ── Status / Workflow Aktionen ──
  async function statusSchnellAendern(neuerStatus: string, label: string) {
    store.updateAnfrage(a.id, { status: neuerStatus });
    store.logge(`Status: "${label}"`, a.anzeigenId || a.id, 'status');
    try {
      const res = await fetch('/api/anfragen', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, status: neuerStatus }),
      });
      if (res.ok) onToast(`✅ Status auf "${label}" gesetzt`);
      else onToast(`⚠️ DB-Update fehlgeschlagen.`);
    } catch {
      onToast(`⚠️ Verbindungsfehler – Status nur lokal geändert`);
    }
  }

  function unternehmenAnlegen() {
    const kandidaten = store.unternehmen.filter(u =>
      u.firmenname.toLowerCase() === a.firmenname.toLowerCase() ||
      u.email.toLowerCase() === a.email.toLowerCase()
    );
    if (kandidaten.length > 0) {
      setDuplikatKandidaten(kandidaten);
    } else {
      store.legeUnternehmenAusAnfrageAn(a.id);
      onToast(`✅ Unternehmen "${a.firmenname}" angelegt`);
    }
  }

  function projektErstellen() {
    store.setzeWorkflowStatus(a.id, 'projekt_erstellt');
    store.logge('Projekt aus Anfrage erstellt', a.anzeigenId || a.id, 'anlegen');
    onToast(`✅ Projekt erstellt — weiter im Modul Projekte`);
  }

  async function kiVerbessern() {
    if (!a.funFactFrage || !a.funFactAntwort) return;
    setKiLaedt(true);
    await new Promise(r => setTimeout(r, 1000));
    const verbessert = verbessereAntwortMock(a.funFactFrage, a.funFactAntwort, a.firmenname);
    setKiErgebnis(verbessert);
    setKiLaedt(false);
  }

  return (
    <div style={{ backgroundColor: '#f9fafb', padding: '24px' }}>
      {/* Workflow-Fortschrittsleiste (ohne Veröffentlichen) */}
      <SimpleSection titel="Anfrage-Prozess">
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
          {WORKFLOW_SCHRITTE.filter(w => w.status !== 'archiviert').map((w, idx, arr) => {
            const aktuell = getWorkflowStatusSchritt(a.workflowStatus);
            const istErledigt = w.schritt < aktuell;
            const istAktiv = w.schritt === aktuell;
            return (
              <div key={w.status} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700,
                    backgroundColor: istErledigt ? '#4CAF50' : istAktiv ? getWorkflowStatusColor(w.status) : '#d0d0d0',
                    color: istErledigt || istAktiv ? 'white' : '#555',
                    boxShadow: istAktiv ? `0 0 0 4px ${getWorkflowStatusColor(w.status)}30` : 'none',
                  }}>
                    {istErledigt ? '✓' : w.schritt}
                  </div>
                  <div style={{ fontSize: '10px', color: istAktiv ? getWorkflowStatusColor(w.status) : '#555', fontWeight: istAktiv ? 700 : 500, whiteSpace: 'nowrap' }}>{w.label}</div>
                </div>
                {idx < arr.length - 1 && (
                  <div style={{ flex: 1, height: '2px', backgroundColor: istErledigt ? '#4CAF50' : '#d0d0d0', marginBottom: '16px', minWidth: '20px' }} />
                )}
              </div>
            );
          })}
        </div>
        {/* Hinweis: Veröffentlichung im Projekte-Modul */}
        {a.workflowStatus === 'projekt_erstellt' && (
          <div style={{ marginTop: '10px', padding: '8px 12px', backgroundColor: '#f3e5f5', borderRadius: '6px', fontSize: '11px', color: '#6a1b9a' }}>
            ✅ Projekt erstellt — die Veröffentlichung auf dem Marktplatz erfolgt im <a href="/dashboard/projekte" style={{ color: '#6a1b9a', fontWeight: 700, textDecoration: 'underline' }}>Modul Projekte</a>.
          </div>
        )}
      </SimpleSection>

      {/* Workflow-Aktionen */}
      {(!a.workflowStatus || a.workflowStatus === 'neu' || a.workflowStatus === 'in_pruefung' || a.workflowStatus === 'rueckfragen_offen' || a.workflowStatus === 'ausreichend_geklaert') && (
        <div style={{ backgroundColor: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0d47a1', marginBottom: '10px' }}>
            🏢 Nächster Schritt: Unternehmen aus dieser Anfrage anlegen
          </div>
          {duplikatKandidaten ? (
            <div>
              <div style={{ fontSize: '12px', color: '#b71c1c', marginBottom: '10px', padding: '8px 10px', backgroundColor: '#ffebee', borderRadius: '6px' }}>
                ⚠️ Mögliches bestehendes Unternehmen gefunden: <strong>{duplikatKandidaten.map(k => k.firmenname).join(', ')}</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={() => { store.legeUnternehmenAusAnfrageAn(a.id); setDuplikatKandidaten(null); onToast('✅ Neues Unternehmen angelegt'); }}
                  style={btnStyle('#1565C0')}>+ Trotzdem neu anlegen</button>
                {duplikatKandidaten.map(k => (
                  <button key={k.id} onClick={() => { store.verknuepfeMitUnternehmen(a.id, k.id); setDuplikatKandidaten(null); onToast(`✅ Mit "${k.firmenname}" verknüpft`); }}
                    style={{ ...btnStyle('white'), color: '#1565C0', border: '1px solid #1565C0' }}>
                    🔗 Mit „{k.firmenname}" verknüpfen
                  </button>
                ))}
                <button onClick={() => setDuplikatKandidaten(null)} style={{ ...btnStyle('#eee'), color: '#444', border: '1px solid #bbb' }}>Abbrechen</button>
              </div>
            </div>
          ) : (
            <button onClick={unternehmenAnlegen} style={btnStyle('#1565C0')}>🏢 Unternehmen aus Anfrage anlegen</button>
          )}
        </div>
      )}

      {(a.workflowStatus === 'unternehmen_angelegt' || a.workflowStatus === 'unternehmen_verifiziert') && (
        <div style={{ backgroundColor: '#f3e5f5', border: '1px solid #ce93d8', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#4a148c', marginBottom: '10px' }}>
            🚀 Nächster Schritt: Projekt erstellen
            {a.workflowStatus === 'unternehmen_angelegt' && (
              <span style={{ marginLeft: '8px', padding: '2px 6px', backgroundColor: '#fff3e0', color: '#bf360c', borderRadius: '4px', fontSize: '10px' }}>
                ⚠️ Unternehmen noch nicht ausreichend geklärt
              </span>
            )}
          </div>
          <p style={{ fontSize: '12px', color: '#4a148c', margin: '0 0 10px 0' }}>
            Nach Projekterstellung wird im Modul Projekte weitergearbeitet (Marktplatz-Veröffentlichung, Matchmaking).
          </p>
          <button onClick={projektErstellen} style={btnStyle('#6a1b9a')}>🚀 Projekt erstellen → Projekte-Modul</button>
        </div>
      )}

      {/* Schnellaktionen für neue Anfragen */}
      {a.status === 'eingehend' && (!a.workflowStatus || a.workflowStatus === 'neu') && (
        <div style={{ backgroundColor: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#6d4c00', marginBottom: '10px' }}>
            ⏳ Neue Anfrage — Prüfung starten
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => {
              store.setzeWorkflowStatus(a.id, 'in_pruefung');
              if (!a.pruefPunkte) store.initialisierePruefPunkte(a.id);
              onToast('✅ Prüfung gestartet');
            }} style={btnStyle('#FF9900')}>🔍 Prüfung starten</button>
            <button onClick={() => statusSchnellAendern('pausiert', 'Pausiert')} style={{ ...btnStyle('#eee'), color: '#444', border: '1px solid #bbb' }}>⏸ Zurückstellen</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          PRÜFUNG & QUALIFIZIERUNG — Checkliste
         ══════════════════════════════════════════════════════════ */}
      <PruefungUndQualifizierung
        anfrage={a}
        store={store}
        onToast={onToast}
      />

      {/* 2-Spalten-Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* LINKE SPALTE */}
        <div>
          {/* ── BESCHREIBUNG (Inline editierbar) ── */}
          <EditableSection
            titel="Beschreibung"
            startWerte={{ ziel: a.ziel, beschreibung: a.beschreibung }}
            beimSpeichern={(w) => speichereBereich(w, 'Beschreibung')}
            rendere={(w, set, edit) => edit ? (
              <div>
                <label style={editLabelStyle}>Ziel</label>
                <input style={editInputStyle} value={w.ziel} onChange={e => set('ziel', e.target.value)} />
                <label style={editLabelStyle}>Beschreibung</label>
                <textarea style={{ ...editTextareaStyle, minHeight: '120px' }} value={w.beschreibung} onChange={e => set('beschreibung', e.target.value)} />
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>{w.ziel}</div>
                <p style={{ fontSize: '14px', color: '#222', lineHeight: 1.7, margin: 0 }}>{w.beschreibung}</p>
              </div>
            )}
          />

          {formular && (
            <div style={{ marginTop: '-10px', marginBottom: '16px', padding: '10px 12px', backgroundColor: '#f0f4ff', borderRadius: '6px', fontSize: '12px', color: '#333' }}>
              📝 <strong>Anfrageformular:</strong> {formular.name} ({formular.fragen.length} Fragen)
              <a href="/dashboard/formulare" style={{ marginLeft: '8px', color: 'var(--text)', fontWeight: 600, textDecoration: 'none' }}>ansehen →</a>
            </div>
          )}

          {/* Interessenten */}
          <SimpleSection titel={`Interessenten (${interessenten.length})`}>
            {interessenten.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>Noch keine Interessenten für diese Anfrage.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {interessenten.map(i => (
                  <div key={i.id} style={{ padding: '12px 14px', backgroundColor: 'white', borderRadius: '8px', borderLeft: `3px solid ${getStatusColor(i.status)}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)' }}>{i.firmenname}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {i.matchScore && <span style={{ fontSize: '11px', fontWeight: 700, color: i.matchScore >= 80 ? '#2e7d32' : '#E65100' }}>{i.matchScore}%</span>}
                        <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, color: 'white', backgroundColor: getStatusColor(i.status) }}>{getStatusLabel(i.status)}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#555' }}>{i.ansprechpartner}</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      <a href={`mailto:${i.email}`} style={{ color: 'var(--text)' }}>{i.email}</a>
                      {i.telefon && <span style={{ color: '#666' }}> · {i.telefon}</span>}
                    </div>
                    {i.notiz && (
                      <div style={{ fontSize: '12px', color: '#444', fontStyle: 'italic', marginTop: '6px', padding: '6px 8px', backgroundColor: '#fff8e1', borderRadius: '4px' }}>{i.notiz}</div>
                    )}
                  </div>
                ))}
                <a href="/dashboard/interessenten" style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 600, textDecoration: 'none', marginTop: '4px' }}>
                  → Im Interessenten-Modul verwalten
                </a>
              </div>
            )}
          </SimpleSection>

          {/* ── PERSÖNLICHE NOTE (Inline editierbar) ── */}
          <EditableSection
            titel="Persönliche Note (FunFact)"
            startWerte={{
              funFactFrage: a.funFactFrage || '',
              funFactAntwort: a.funFactAntwort || '',
              funFactOeffentlich: !!a.funFactOeffentlich,
            }}
            beimSpeichern={(w) => speichereBereich({
              funFactFrage: w.funFactFrage || undefined,
              funFactAntwort: w.funFactAntwort || undefined,
              funFactOeffentlich: w.funFactOeffentlich,
            }, 'Persönliche Note')}
            rendere={(w, set, edit) => edit ? (
              <div>
                <label style={editLabelStyle}>FunFact-Frage</label>
                <input style={editInputStyle} value={w.funFactFrage} onChange={e => set('funFactFrage', e.target.value)} placeholder="z.B. Wie würdet ihr eine erfolgreiche Kooperation feiern?" />
                <label style={editLabelStyle}>Antwort</label>
                <textarea style={editTextareaStyle} value={w.funFactAntwort} onChange={e => set('funFactAntwort', e.target.value)} />
                <label style={{ ...editLabelStyle, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={w.funFactOeffentlich} onChange={e => set('funFactOeffentlich', e.target.checked)} />
                  Öffentlich in der Marktplatzanzeige anzeigen
                </label>
              </div>
            ) : (!w.funFactFrage && !w.funFactAntwort) ? (
              <p style={{ fontSize: '13px', color: '#666', margin: 0, fontStyle: 'italic' }}>Noch keine persönliche Note erfasst.</p>
            ) : (
              <div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, marginBottom: '10px',
                  backgroundColor: w.funFactOeffentlich ? '#e8f5e9' : '#eee',
                  color: w.funFactOeffentlich ? '#1b5e20' : '#444',
                }}>
                  {w.funFactOeffentlich ? '🌐 Öffentlich sichtbar' : '🔒 Nur intern'}
                </span>
                {w.funFactFrage && <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px', fontStyle: 'italic' }}>Frage: {w.funFactFrage}</div>}
                {w.funFactAntwort && (
                  <div style={{ backgroundColor: 'white', borderRadius: '6px', padding: '12px', marginBottom: '12px', fontSize: '13px', color: '#333' }}>
                    <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px', fontWeight: 700 }}>ORIGINAL-ANTWORT</div>
                    {w.funFactAntwort}
                  </div>
                )}
                {(kiErgebnis || a.funFactAntwortKI) && (
                  <div style={{ backgroundColor: '#e8f0fe', borderRadius: '6px', padding: '12px', marginBottom: '12px', fontSize: '13px', color: '#222', border: '1px solid #c5d3f0' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text)', marginBottom: '6px', fontWeight: 700 }}>
                      ✨ KI-VERBESSERUNG {kiErgebnis && <span style={{ backgroundColor: 'var(--accent)', color: 'white', padding: '1px 6px', borderRadius: '4px', fontSize: '9px', marginLeft: '6px' }}>NEU</span>}
                    </div>
                    {kiErgebnis || a.funFactAntwortKI}
                  </div>
                )}
                {w.funFactAntwort && (
                  <button onClick={kiVerbessern} disabled={kiLaedt}
                    style={{ padding: '8px 14px', backgroundColor: kiLaedt ? '#bbb' : 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', cursor: kiLaedt ? 'wait' : 'pointer', fontSize: '12px', fontWeight: 600 }}>
                    {kiLaedt ? '✨ KI verbessert…' : '✨ FunFact mit KI verbessern'}
                  </button>
                )}
              </div>
            )}
          />

          {/* ── KULTURHINWEIS (Inline editierbar) ── */}
          <EditableSection
            titel="Kulturhinweis (intern)"
            startWerte={{ kulturHinweis: a.kulturHinweis || '' }}
            beimSpeichern={(w) => speichereBereich({ kulturHinweis: w.kulturHinweis || undefined }, 'Kulturhinweis')}
            rendere={(w, set, edit) => edit ? (
              <textarea style={editTextareaStyle} value={w.kulturHinweis} onChange={e => set('kulturHinweis', e.target.value)} placeholder="z.B. Dänischer Kommunikationsstil: direkt, informell, herzlich." />
            ) : w.kulturHinweis ? (
              <div style={{ backgroundColor: '#fff8e1', borderRadius: '6px', padding: '12px', fontSize: '13px', color: '#5d4037', border: '1px solid #ffe082' }}>
                🌍 {w.kulturHinweis}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#666', margin: 0, fontStyle: 'italic' }}>Noch kein Kulturhinweis erfasst.</p>
            )}
          />

          {/* ── GESPRÄCHSEINSTIEG (Inline editierbar) ── */}
          <EditableSection
            titel="Gesprächseinstieg"
            startWerte={{ gespraechseinstieg: a.gespraechseinstieg || '' }}
            beimSpeichern={(w) => speichereBereich({ gespraechseinstieg: w.gespraechseinstieg || undefined }, 'Gesprächseinstieg')}
            rendere={(w, set, edit) => edit ? (
              <textarea style={editTextareaStyle} value={w.gespraechseinstieg} onChange={e => set('gespraechseinstieg', e.target.value)} placeholder="z.B. Frag nach der Familientradition im Unternehmen." />
            ) : w.gespraechseinstieg ? (
              <div style={{ backgroundColor: '#e8f5e9', borderRadius: '6px', padding: '12px', fontSize: '13px', color: '#1b5e20', border: '1px solid #a5d6a7' }}>
                💬 {w.gespraechseinstieg}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#666', margin: 0, fontStyle: 'italic' }}>Noch kein Gesprächseinstieg vorbereitet.</p>
            )}
          />

          {/* ── KLÄRUNGSSTAND (auf-/zuklappbar) ── */}
          <CollapsibleSection titel="Von Easy-B2B geklärte Punkte" icon="✓">
            <KlaerungsBox
              stand={berechneAnfrageKlaerung(a, a.klaerungsBestaetigungen)}
              typ="anfrage"
              zeigeVorschauHinweis
              onBestaetigen={(punktId, notiz) => {
                store.bestaetigeKlaerungsPunkt('anfrage', a.id, punktId, notiz);
                onToast('Klärungspunkt bestätigt ✓');
              }}
              onEntfernen={(punktId) => {
                store.entferneKlaerungsBestaetigung('anfrage', a.id, punktId);
                onToast('Bestätigung entfernt');
              }}
            />
          </CollapsibleSection>

          {/* ── INTERNE NOTIZEN (Inline editierbar) ── */}
          <EditableSection
            titel="Interne Notizen (nur Operator)"
            startWerte={{ interneNotiz: a.interneNotiz || '' }}
            beimSpeichern={(w) => speichereBereich({ interneNotiz: w.interneNotiz || undefined }, 'Interne Notiz')}
            rendere={(w, set, edit) => edit ? (
              <textarea style={editTextareaStyle} value={w.interneNotiz} onChange={e => set('interneNotiz', e.target.value)} placeholder="Notizen für das Operator-Team, nicht öffentlich sichtbar." />
            ) : w.interneNotiz ? (
              <div style={{ backgroundColor: '#fafafa', borderRadius: '6px', padding: '12px', fontSize: '13px', color: '#333', border: '1px solid #e0e0e0', whiteSpace: 'pre-wrap' }}>
                {w.interneNotiz}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#666', margin: 0, fontStyle: 'italic' }}>Noch keine interne Notiz.</p>
            )}
          />
        </div>

        {/* RECHTE SPALTE: Sidebar */}
        <div>
          {/* Verknüpftes Unternehmen */}
          {verknuepftesUnternehmen && (
            <div style={{ backgroundColor: 'white', borderRadius: '10px', padding: '14px', marginBottom: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                🏢 Verknüpftes Unternehmen
              </div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', marginBottom: '4px' }}>{verknuepftesUnternehmen.firmenname}</div>
              <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px' }}>{verknuepftesUnternehmen.ansprechpartner}</div>
              <a href="/dashboard/unternehmen" style={{ fontSize: '12px', color: 'var(--text)', fontWeight: 600, textDecoration: 'none' }}>
                → Zur Unternehmensakte
              </a>
            </div>
          )}

          {/* ── KONTAKTDATEN (Inline editierbar) ── */}
          <EditableSection
            titel="📞 Kontaktdaten"
            variante="kompakt"
            hintergrund="white"
            startWerte={{
              ansprechpartner: a.ansprechpartner,
              email: a.email,
              telefon: a.telefon || '',
              standort: a.standort,
              sichtbarkeit: a.sichtbarkeit,
            }}
            beimSpeichern={(w) => speichereBereich({
              ansprechpartner: w.ansprechpartner,
              email: w.email,
              telefon: w.telefon || undefined,
              standort: w.standort,
              sichtbarkeit: w.sichtbarkeit,
            }, 'Kontaktdaten')}
            rendere={(w, set, edit) => edit ? (
              <div>
                <label style={editLabelStyle}>Ansprechpartner</label>
                <input style={editInputStyle} value={w.ansprechpartner} onChange={e => set('ansprechpartner', e.target.value)} />
                <label style={editLabelStyle}>E-Mail</label>
                <input type="email" style={editInputStyle} value={w.email} onChange={e => set('email', e.target.value)} />
                <label style={editLabelStyle}>Telefon</label>
                <input type="tel" style={editInputStyle} value={w.telefon} onChange={e => set('telefon', e.target.value)} />
                <label style={editLabelStyle}>Standort</label>
                <input style={editInputStyle} value={w.standort} onChange={e => set('standort', e.target.value)} />
                <label style={editLabelStyle}>Sichtbarkeit</label>
                <select style={editInputStyle} value={w.sichtbarkeit} onChange={e => set('sichtbarkeit', e.target.value)}>
                  <option value="oeffentlich">Öffentlich</option>
                  <option value="anonym">Anonym</option>
                  <option value="intern">Intern</option>
                </select>
              </div>
            ) : (
              <div>
                <Row label="Person" value={w.ansprechpartner} />
                <Row label="E-Mail" value={<a href={`mailto:${w.email}`} style={{ color: 'var(--text)' }}>{w.email}</a>} />
                {w.telefon && <Row label="Telefon" value={w.telefon} />}
                <Row label="Standort" value={w.standort} />
                <Row label="Sichtbarkeit" value={w.sichtbarkeit} />
              </div>
            )}
          />

          {/* ── ECKDATEN (Inline editierbar) ── */}
          <EditableSection
            titel="📋 Eckdaten"
            variante="kompakt"
            hintergrund="white"
            startWerte={{
              branche: a.branche,
              art: a.art,
              richtung: a.richtung,
              ablaufDatum: a.ablaufDatum || '',
            }}
            beimSpeichern={(w) => speichereBereich({
              branche: w.branche,
              art: w.art,
              richtung: w.richtung as 'de_dk' | 'dk_de',
              ablaufDatum: w.ablaufDatum || undefined,
            }, 'Eckdaten')}
            rendere={(w, set, edit) => edit ? (
              <div>
                <label style={editLabelStyle}>Branche</label>
                <input style={editInputStyle} value={w.branche} onChange={e => set('branche', e.target.value)} />
                <label style={editLabelStyle}>Art der Suche</label>
                <select style={editInputStyle} value={w.art} onChange={e => set('art', e.target.value)}>
                  <option value="vertrieb">Vertrieb</option>
                  <option value="kooperation">Kooperation</option>
                  <option value="lieferant">Lieferant</option>
                  <option value="kunden">Kunden</option>
                </select>
                <label style={editLabelStyle}>Richtung</label>
                <select style={editInputStyle} value={w.richtung} onChange={e => set('richtung', e.target.value as 'de_dk' | 'dk_de')}>
                  <option value="de_dk">🇩🇪 → 🇩🇰 Deutschland → Dänemark</option>
                  <option value="dk_de">🇩🇰 → 🇩🇪 Dänemark → Deutschland</option>
                </select>
                <label style={editLabelStyle}>Ablaufdatum</label>
                <input type="date" style={editInputStyle} value={w.ablaufDatum} onChange={e => set('ablaufDatum', e.target.value)} />
                <div style={{ fontSize: '11px', color: '#666', marginTop: '10px', padding: '6px 8px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                  ℹ️ Eingangsdatum und Interessenten-Anzahl sind nicht editierbar.
                </div>
              </div>
            ) : (
              <div>
                <Row label="Branche" value={w.branche} />
                <Row label="Art" value={w.art} />
                <Row label="Richtung" value={getRichtungLabel(w.richtung)} />
                <Row label="Eingegangen" value={a.createdAt} />
                {w.ablaufDatum && <Row label="Läuft bis" value={w.ablaufDatum} />}
                <Row label="Interessenten" value={String(a.interessentenCount)} />
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// PRÜFUNG & QUALIFIZIERUNG — Checkliste
// ═════════════════════════════════════════════════════════════════

function PruefungUndQualifizierung({ anfrage: a, store, onToast }: {
  anfrage: MockAnfrage;
  store: ReturnType<typeof useStore>;
  onToast: (m: string) => void;
}) {
  const [editNotiz, setEditNotiz] = useState<{ id: string; notiz: string } | null>(null);
  const [offen, setOffen] = useState(false);

  const punkte = a.pruefPunkte || [];
  const hatPunkte = punkte.length > 0;

  if (!hatPunkte) {
    // Noch keine Prüfpunkte → Button zum Initialisieren
    return (
      <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#fff8e1', border: '1px solid #ffe082', borderRadius: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#6d4c00', marginBottom: '4px' }}>
              📋 Prüfung & Qualifizierung
            </div>
            <div style={{ fontSize: '12px', color: '#8a6d00' }}>
              Noch keine Prüfpunkte angelegt. Starte die strukturierte Prüfung dieser Anfrage.
            </div>
          </div>
          <button onClick={() => {
            store.initialisierePruefPunkte(a.id);
            onToast('✅ Prüfpunkte angelegt');
          }} style={btnStyle('#8a6d00')}>
            📋 Checkliste starten
          </button>
        </div>
      </div>
    );
  }

  const erledigt = punkte.filter(p => p.erledigt).length;
  const gesamt = punkte.length;
  const kritischeOffen = punkte.filter(p => p.kritisch && !p.erledigt);
  const fortschrittProzent = Math.round((erledigt / gesamt) * 100);

  // Nach Kategorie gruppieren
  const kategorien = PRUEF_KATEGORIEN.map(kat => ({
    ...kat,
    punkte: punkte.filter(p => p.kategorie === kat.key),
  }));

  return (
    <div style={{ marginBottom: '20px', backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      {/* Header mit Fortschritt — klickbar zum Auf-/Zuklappen */}
      <div
        onClick={() => setOffen(prev => !prev)}
        style={{ padding: '16px 20px', borderBottom: offen ? '1px solid #f0f0f0' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
            📋 Prüfung & Qualifizierung
          </h3>
          <div style={{ fontSize: '12px', color: '#555' }}>
            Von Easy-B2B geklärte Punkte — {erledigt} von {gesamt} Punkten geklärt
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {kritischeOffen.length > 0 && (
            <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, backgroundColor: '#ffebee', color: '#c62828' }}>
              ⚠️ {kritischeOffen.length} kritisch offen
            </span>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: fortschrittProzent >= 80 ? '#2e7d32' : fortschrittProzent >= 50 ? '#E65100' : '#c62828' }}>
              {erledigt}/{gesamt}
            </div>
          </div>
          <span style={{ fontSize: '18px', color: '#888', lineHeight: 1, transition: 'transform 0.2s', transform: offen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
        </div>
      </div>

      {/* Fortschrittsbalken — immer sichtbar */}
      <div style={{ height: '4px', backgroundColor: '#f0f0f0' }}>
        <div style={{ height: '100%', width: `${fortschrittProzent}%`, backgroundColor: fortschrittProzent >= 80 ? '#4CAF50' : fortschrittProzent >= 50 ? '#FF9900' : '#f44336', transition: 'width 0.3s' }} />
      </div>

      {/* Kategorien mit Prüfpunkten — nur wenn offen */}
      {offen && <div style={{ padding: '16px 20px' }}>
        {kategorien.map(kat => {
          const katErledigt = kat.punkte.filter(p => p.erledigt).length;
          return (
            <div key={kat.key} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px' }}>{kat.icon}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{kat.label}</span>
                <span style={{ fontSize: '11px', color: katErledigt === kat.punkte.length ? '#2e7d32' : '#666', fontWeight: 600 }}>
                  {katErledigt}/{kat.punkte.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {kat.punkte.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
                    backgroundColor: p.erledigt ? '#f0fdf4' : (p.kritisch ? '#fff8f8' : '#fafafa'),
                    borderRadius: '6px',
                    borderLeft: `3px solid ${p.erledigt ? '#4CAF50' : (p.kritisch ? '#ef5350' : '#e0e0e0')}`,
                  }}>
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={p.erledigt}
                      onChange={e => {
                        store.updatePruefPunkt(a.id, p.id, { erledigt: e.target.checked });
                        onToast(e.target.checked ? `✓ "${p.label}" erledigt` : `"${p.label}" wieder offen`);
                      }}
                      style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#4CAF50', flexShrink: 0 }}
                    />

                    {/* Label */}
                    <span style={{
                      flex: 1, fontSize: '13px',
                      color: p.erledigt ? '#2e7d32' : '#333',
                      textDecoration: p.erledigt ? 'line-through' : 'none',
                      fontWeight: p.kritisch && !p.erledigt ? 600 : 400,
                    }}>
                      {p.label}
                      {p.kritisch && !p.erledigt && (
                        <span style={{ marginLeft: '6px', fontSize: '10px', color: '#c62828', fontWeight: 700 }}>KRITISCH</span>
                      )}
                    </span>

                    {/* Notiz-Anzeige / Button */}
                    {p.notiz && editNotiz?.id !== p.id && (
                      <span
                        onClick={() => setEditNotiz({ id: p.id, notiz: p.notiz || '' })}
                        style={{ fontSize: '11px', color: '#888', cursor: 'pointer', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={p.notiz}
                      >
                        📝 {p.notiz}
                      </span>
                    )}

                    {/* Notiz-Edit inline */}
                    {editNotiz?.id === p.id ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input
                          autoFocus
                          value={editNotiz.notiz}
                          onChange={e => setEditNotiz({ id: p.id, notiz: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              store.updatePruefPunkt(a.id, p.id, { notiz: editNotiz.notiz || undefined });
                              setEditNotiz(null);
                              onToast('Notiz gespeichert');
                            }
                            if (e.key === 'Escape') setEditNotiz(null);
                          }}
                          placeholder="Notiz…"
                          style={{ padding: '3px 6px', fontSize: '11px', border: '1px solid #ccc', borderRadius: '4px', width: '140px' }}
                        />
                        <button onClick={() => {
                          store.updatePruefPunkt(a.id, p.id, { notiz: editNotiz.notiz || undefined });
                          setEditNotiz(null);
                          onToast('Notiz gespeichert');
                        }} style={{ padding: '2px 6px', fontSize: '10px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>✓</button>
                        <button onClick={() => setEditNotiz(null)} style={{ padding: '2px 6px', fontSize: '10px', backgroundColor: '#eee', color: '#666', border: '1px solid #ccc', borderRadius: '3px', cursor: 'pointer' }}>×</button>
                      </div>
                    ) : !p.notiz && (
                      <button
                        onClick={() => setEditNotiz({ id: p.id, notiz: '' })}
                        style={{ padding: '2px 6px', fontSize: '10px', color: '#888', backgroundColor: 'transparent', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer' }}
                        title="Notiz hinzufügen"
                      >
                        📝
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Workflow-Status Schnellaktionen basierend auf Prüfstand */}
        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#555', fontWeight: 600 }}>Status setzen:</span>
          {a.workflowStatus !== 'rueckfragen_offen' && (
            <button onClick={() => {
              store.setzeWorkflowStatus(a.id, 'rueckfragen_offen');
              onToast('Status: Rückfragen offen');
            }} style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 600, backgroundColor: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a', borderRadius: '6px', cursor: 'pointer' }}>
              ❓ Rückfragen offen
            </button>
          )}
          {a.workflowStatus !== 'ausreichend_geklaert' && erledigt >= Math.ceil(gesamt * 0.6) && (
            <button onClick={() => {
              store.setzeWorkflowStatus(a.id, 'ausreichend_geklaert');
              onToast('Status: Ausreichend geklärt');
            }} style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 600, backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7', borderRadius: '6px', cursor: 'pointer' }}>
              ✅ Ausreichend geklärt
            </button>
          )}
          {a.workflowStatus === 'rueckfragen_offen' && (
            <button onClick={() => {
              store.setzeWorkflowStatus(a.id, 'in_pruefung');
              onToast('Status: Wieder in Prüfung');
            }} style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 600, backgroundColor: '#fff8e1', color: '#6d4c00', border: '1px solid #ffe082', borderRadius: '6px', cursor: 'pointer' }}>
              🔍 Zurück in Prüfung
            </button>
          )}
        </div>
      </div>}
    </div>
  );
}

// ─── HILFSKOMPONENTEN ─────────────────────────────────────────

function SimpleSection({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{titel}</h3>
      {children}
    </div>
  );
}

function CollapsibleSection({ titel, icon, children, initialOffen = false }: {
  titel: string;
  icon?: string;
  children: React.ReactNode;
  initialOffen?: boolean;
}) {
  const [offen, setOffen] = useState(initialOffen);
  return (
    <div style={{ marginBottom: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      <div
        onClick={() => setOffen(prev => !prev)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 14px', cursor: 'pointer', userSelect: 'none',
          borderBottom: offen ? '1px solid #f0f0f0' : 'none',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {icon && <span style={{ marginRight: '6px' }}>{icon}</span>}{titel}
        </h3>
        <span style={{ fontSize: '16px', color: '#888', lineHeight: 1, transition: 'transform 0.2s', transform: offen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </div>
      {offen && <div style={{ padding: '14px' }}>{children}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', padding: '5px 0', borderBottom: '1px solid #f0f0f0', fontSize: '12px' }}>
      <span style={{ color: '#555', width: '90px', flexShrink: 0, fontWeight: 500 }}>{label}</span>
      <span style={{ color: '#222', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return { padding: '8px 14px', backgroundColor: bg, color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 };
}
